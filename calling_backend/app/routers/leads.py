import asyncio
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..config import settings
from ..database import get_db
from ..exceptions import DuplicatePhone, LeadNotFound
from ..models.user import UserRole
from ..repositories.callback_repo import CallbackRepository
from ..repositories.lead_repo import LeadRepository
from ..routers.auth import get_optional_user
from ..schemas.lead import LeadCreate, LeadDetail, LeadOut, LeadUpdate, LeadsListOut, StatsOut
from ..services.call_service import trigger_plivo_call
from ..services.memory_service import build_call_context

log = logging.getLogger(__name__)
router = APIRouter(prefix="/leads", tags=["leads"])


async def _poll_until_complete(api_id: str, lead_id: str, phone: str) -> None:
    """
    Background fallback: track the live call by destination phone number.
    Exits early if the lead's status is no longer "calling" (webhook fired first).
    """
    from ..repositories.lead_repo import LeadRepository
    from ..schemas.webhook import PlivoHangupPayload
    from ..services.webhook_processor import WebhookProcessor

    base_url = f"https://api.plivo.com/v1/Account/{settings.plivo_auth_id}/Call/"
    auth     = (settings.plivo_auth_id, settings.plivo_auth_token)

    log.info("Live-call poll started: lead=%s phone=%s api_id=%s", lead_id, phone, api_id)

    async def _webhook_handled() -> bool:
        try:
            db   = get_db()
            lead = await LeadRepository(db).get(lead_id)
            return lead.status != "calling"
        except Exception:
            return False

    # ── Phase 1: find the live call_uuid by destination phone (up to 45 s) ──
    found_uuid: str = ""
    for _ in range(9):
        await asyncio.sleep(5)
        if await _webhook_handled():
            log.info("Poll exit early (webhook handled) lead=%s", lead_id)
            return
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(base_url, params={"is_live": "true", "to": phone}, auth=auth)
            if r.status_code == 200:
                objs = r.json().get("objects", [])
                if objs:
                    found_uuid = objs[0].get("call_uuid", "")
                    log.info("Live call found uuid=%s lead=%s", found_uuid, lead_id)
                    break
        except Exception as exc:
            log.error("Phase-1 poll error lead=%s: %s", lead_id, exc)

    if not found_uuid:
        log.warning("No live call found for phone=%s lead=%s — deferring to webhook or timeout", phone, lead_id)
        await asyncio.sleep(300)
        if not await _webhook_handled():
            try:
                db   = get_db()
                repo = LeadRepository(db)
                lead = await repo.get(lead_id)
                if lead.status == "calling":
                    await repo.update(lead, status="not_answered")
                log.info("Deferred timeout reset for lead=%s", lead_id)
            except Exception as exc:
                log.error("Deferred reset failed lead=%s: %s", lead_id, exc)
        return

    # ── Phase 2: wait for call to disappear from live-calls (up to 12 min) ──
    for attempt in range(48):
        await asyncio.sleep(15)
        if await _webhook_handled():
            log.info("Poll exit early (webhook handled) call=%s", found_uuid)
            return
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(base_url, params={"is_live": "true"}, auth=auth)
            if r.status_code == 200:
                live_uuids = {obj.get("call_uuid") for obj in r.json().get("objects", [])}
                if found_uuid not in live_uuids:
                    log.info("Live call %s ended — fetching CDR for lead=%s", found_uuid, lead_id)

                    await asyncio.sleep(3)

                    cdr_status, hangup_cause, duration = "completed", "", 0
                    try:
                        async with httpx.AsyncClient(timeout=10) as client:
                            cdr_r = await client.get(f"{base_url}{found_uuid}/", auth=auth)
                        if cdr_r.status_code == 200:
                            d            = cdr_r.json()
                            cdr_status   = d.get("call_status", "completed").lower()
                            hangup_cause = d.get("hangup_cause_name", "")
                            duration     = int(d.get("duration") or 0)
                    except Exception as exc:
                        log.warning("CDR fetch failed call=%s: %s", found_uuid, exc)

                    payload = PlivoHangupPayload(
                        call_uuid    = found_uuid,
                        phone_to     = phone,
                        call_status  = cdr_status,
                        duration     = duration,
                        hangup_cause = hangup_cause,
                        lead_id      = lead_id,
                        extracted_variables={},
                    )
                    db = get_db()
                    await WebhookProcessor(db).process_hangup(payload)
                    log.info("Poll hangup processed call=%s status=%s", found_uuid, cdr_status)
                    return

                log.info("Poll attempt=%d call=%s still live", attempt + 1, found_uuid)
        except Exception as exc:
            log.error("Phase-2 poll error attempt=%d call=%s: %s", attempt + 1, found_uuid, exc)

    # ── Timeout ──
    log.warning("Poll timeout call=%s lead=%s — resetting to not_answered", found_uuid, lead_id)
    try:
        db   = get_db()
        repo = LeadRepository(db)
        lead = await repo.get(lead_id)
        if lead.status == "calling":
            await repo.update(lead, status="not_answered")
    except Exception as exc:
        log.error("Timeout reset failed lead=%s: %s", lead_id, exc)


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
async def create_lead(
    payload: LeadCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user=Depends(get_optional_user),
):
    track = payload.track
    if track is None and current_user is not None and current_user.track:
        track = current_user.track
    try:
        lead = await LeadRepository(db).create(
            name=payload.name, phone=payload.phone,
            address=payload.address, city=payload.city,
            course_interest=payload.course_interest,
            track=track,
        )
    except DuplicatePhone as exc:
        raise HTTPException(status_code=409, detail=str(exc.detail))
    return _to_out(lead)


@router.get("", response_model=LeadsListOut)
async def list_leads(
    page:            int           = Query(1, ge=1),
    page_size:       int           = Query(50, ge=1, le=200),
    status:          Optional[str] = None,
    search:          Optional[str] = None,
    course_interest: Optional[str] = None,
    track:           Optional[str] = None,
    db:              AsyncIOMotorDatabase = Depends(get_db),
    current_user=Depends(get_optional_user),
):
    effective_track = track
    if current_user is not None and current_user.role == UserRole.COUNSELOR.value:
        effective_track = current_user.track
    offset = (page - 1) * page_size
    rows, total = await LeadRepository(db).list_enriched(
        status=status, search=search, course_interest=course_interest,
        track=effective_track, offset=offset, limit=page_size,
    )
    items = [LeadOut(**row) for row in rows]
    return LeadsListOut(leads=items, total=total, page=page, page_size=page_size)


@router.get("/stats", response_model=StatsOut)
async def get_stats(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user=Depends(get_optional_user),
):
    track = None
    if current_user is not None and current_user.role == UserRole.COUNSELOR.value:
        track = current_user.track
    data = await LeadRepository(db).stats(track=track)
    return StatsOut(**data)


@router.get("/{lead_id}", response_model=LeadDetail)
async def get_lead(lead_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        data = await LeadRepository(db).get_detail(lead_id)
    except LeadNotFound:
        raise HTTPException(status_code=404, detail="Lead not found")
    return LeadDetail(**data)


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(lead_id: str, payload: LeadUpdate, db: AsyncIOMotorDatabase = Depends(get_db)):
    repo = LeadRepository(db)
    try:
        lead = await repo.get(lead_id)
    except LeadNotFound:
        raise HTTPException(status_code=404, detail="Lead not found")

    fields = payload.model_dump(exclude_unset=True)
    if "status" in fields and fields["status"] is not None:
        fields["status"] = fields["status"].value if hasattr(fields["status"], "value") else fields["status"]
    await repo.update(lead, **fields)
    return _to_out(lead)


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(lead_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    repo = LeadRepository(db)
    try:
        await repo.delete(lead_id)
    except LeadNotFound:
        raise HTTPException(status_code=404, detail="Lead not found")


@router.post("/{lead_id}/call", status_code=status.HTTP_202_ACCEPTED)
async def trigger_call(lead_id: str, background: BackgroundTasks, db: AsyncIOMotorDatabase = Depends(get_db)):
    from ..models.callback import CallbackStatus
    from ..repositories.conversation_repo import ConversationRepository
    from datetime import timedelta, timezone as tz

    repo = LeadRepository(db)
    try:
        lead = await repo.get(lead_id)
    except LeadNotFound:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.do_not_call:
        raise HTTPException(status_code=400, detail="Lead is marked do-not-call")

    previous_memory    = await build_call_context(lead_id, db)
    callback_scheduled = ""
    _IST = tz(timedelta(hours=5, minutes=30))
    cbs = await CallbackRepository(db).list_for_lead(lead_id)
    pending = [cb for cb in cbs if cb.status == CallbackStatus.PENDING.value]
    if pending:
        callback_scheduled = pending[0].scheduled_at.astimezone(_IST).strftime("%d %B %I:%M %p IST")

    result = await trigger_plivo_call(
        phone              = lead.phone,
        lead_id            = str(lead_id),
        previous_memory    = previous_memory,
        lead_name          = lead.name,
        callback_scheduled = callback_scheduled,
    )

    api_id = result.get("api_id") or result.get("call_uuid") or ""
    await repo.update(lead, status="calling")

    await ConversationRepository(db).create_phone(
        lead.id,
        message="Call initiated by Riya agent",
        call_id=api_id or None,
        meta={"call_status": "initiated", "api_id": api_id},
    )

    background.add_task(_poll_until_complete, api_id, str(lead_id), lead.phone)

    return {"status": "call_triggered", "api_id": api_id, "plivo_response": result}


@router.get("/{lead_id}/conversations")
async def get_lead_conversations(lead_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    from ..repositories.conversation_repo import ConversationRepository
    try:
        await LeadRepository(db).get(lead_id)
    except LeadNotFound:
        raise HTTPException(status_code=404, detail="Lead not found")
    convs = await ConversationRepository(db).list_for_lead(lead_id, limit=100)
    return [
        {
            "id": str(c.id), "lead_id": str(c.lead_id),
            "channel": c.channel, "direction": c.direction,
            "message": c.message, "agent_reply": c.agent_reply,
            "call_id": c.call_id, "metadata": c.meta,
            "created_at": c.created_at.isoformat(),
        }
        for c in convs
    ]


@router.get("/{lead_id}/callbacks")
async def get_lead_callbacks(lead_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        await LeadRepository(db).get(lead_id)
    except LeadNotFound:
        raise HTTPException(status_code=404, detail="Lead not found")
    cbs = await CallbackRepository(db).list_for_lead(lead_id)
    return [
        {
            "id": str(cb.id), "lead_id": str(cb.lead_id),
            "callback_type": cb.callback_type, "scheduled_at": cb.scheduled_at.isoformat(),
            "status": cb.status, "notes": cb.notes,
            "triggered_call_id": cb.triggered_call_id,
            "created_at": cb.created_at.isoformat(), "updated_at": cb.updated_at.isoformat(),
        }
        for cb in cbs
    ]


def _to_out(lead) -> LeadOut:
    return LeadOut(
        id=lead.id, name=lead.name, phone=lead.phone,
        address=lead.address, city=lead.city, course_interest=lead.course_interest,
        status=lead.status, do_not_call=lead.do_not_call,
        last_call_id=lead.last_call_id, last_call_at=lead.last_call_at,
        created_at=lead.created_at, updated_at=lead.updated_at,
        track=lead.track,
    )
