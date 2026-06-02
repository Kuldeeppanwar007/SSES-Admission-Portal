import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..database import get_db
from ..exceptions import LeadNotFound
from ..models.callback import CallbackStatus
from ..repositories.callback_repo import CallbackRepository
from ..repositories.lead_repo import LeadRepository
from ..schemas.callback import CallbackCreate, CallbackOut, CallbackUpdate, CallbacksListOut

log = logging.getLogger(__name__)
router = APIRouter(prefix="/callbacks", tags=["callbacks"])


@router.post("", response_model=CallbackOut, status_code=status.HTTP_201_CREATED)
async def create_callback(payload: CallbackCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        lead = await LeadRepository(db).get(payload.lead_id)
    except LeadNotFound:
        raise HTTPException(status_code=404, detail="Lead not found")
    cb = await CallbackRepository(db).create(
        payload.lead_id,
        callback_type=payload.callback_type,
        scheduled_at=payload.scheduled_at,
        notes=payload.notes,
    )
    
    try:
        from datetime import timedelta
        from ..services.notification_service import create_incharge_notification
        title = f"Callback Scheduled: {lead.name}"
        ist_offset = timezone(timedelta(hours=5, minutes=30))
        time_str = payload.scheduled_at.astimezone(ist_offset).strftime("%d %b %I:%M %p")
        message = f"A callback has been scheduled for {lead.name} ({lead.phone}) for {time_str} IST. Notes: {payload.notes or 'No notes provided'}."
        await create_incharge_notification(
            db=db,
            track=lead.track,
            title=title,
            message=message,
            student_id_str=lead.student_id
        )
    except Exception as exc:
        log.error("Failed to notify incharge for manual callback: %s", exc)
        
    return _enrich(cb, lead)


@router.get("", response_model=CallbacksListOut)
async def list_callbacks(
    lead_id:   Optional[str] = None,
    cb_status: Optional[str] = Query(None, alias="status"),
    due_only:  bool          = False,
    page:      int           = Query(1, ge=1),
    page_size: int           = Query(50, ge=1, le=200),
    db:        AsyncIOMotorDatabase = Depends(get_db),
):
    cb_repo = CallbackRepository(db)
    if lead_id:
        all_cbs = await cb_repo.list_for_lead(lead_id)
    else:
        all_cbs = await cb_repo.list_all()

    if cb_status:
        all_cbs = [cb for cb in all_cbs if cb.status == cb_status]
    if due_only:
        now     = datetime.now(timezone.utc)
        all_cbs = [cb for cb in all_cbs if cb.status == CallbackStatus.PENDING.value and cb.scheduled_at <= now]

    total     = len(all_cbs)
    offset    = (page - 1) * page_size
    page_cbs  = all_cbs[offset: offset + page_size]

    lead_repo = LeadRepository(db)
    items = []
    for cb in page_cbs:
        try:
            lead = await lead_repo.get(cb.lead_id)
        except LeadNotFound:
            lead = None
        items.append(_enrich(cb, lead))

    return CallbacksListOut(callbacks=items, total=total)


@router.get("/fire-due", include_in_schema=False)
async def fire_due_callbacks(db: AsyncIOMotorDatabase = Depends(get_db)):
    """
    Cron/external-scheduler endpoint — call this every minute to auto-fire
    pending AGENT callbacks whose scheduled time has passed.
    """
    from datetime import timedelta
    from ..repositories.conversation_repo import ConversationRepository
    from ..services.call_service import trigger_plivo_call
    from ..services.memory_service import build_call_context

    _IST    = timezone(timedelta(hours=5, minutes=30))
    cb_repo = CallbackRepository(db)
    due_cbs = await cb_repo.fetch_due(limit=20)

    fired: list[str]   = []
    skipped: list[str] = []

    for cb in due_cbs:
        try:
            lead = await LeadRepository(db).get(cb.lead_id)
        except LeadNotFound:
            await cb_repo.update(cb, status=CallbackStatus.CANCELLED.value)
            skipped.append(str(cb.id))
            continue

        if lead.do_not_call:
            await cb_repo.update(cb, status=CallbackStatus.CANCELLED.value)
            skipped.append(str(cb.id))
            continue

        try:
            previous_memory = await build_call_context(lead.id, db)
            cb_time = cb.scheduled_at.astimezone(_IST).strftime("%d %B %I:%M %p IST")

            result = await trigger_plivo_call(
                phone              = lead.phone,
                lead_id            = str(lead.id),
                previous_memory    = previous_memory,
                lead_name          = lead.name,
                callback_scheduled = cb_time,
            )
            api_id = result.get("api_id") or result.get("call_uuid") or ""

            await LeadRepository(db).update(
                lead, status="calling", last_call_at=datetime.now(timezone.utc),
            )
            await ConversationRepository(db).create_phone(
                lead.id,
                message=f"Auto-callback fired (scheduled {cb_time})",
                call_id=api_id or None,
                meta={"call_status": "initiated", "api_id": api_id, "callback_id": str(cb.id)},
            )
            await cb_repo.update(cb, status=CallbackStatus.COMPLETED.value)
            fired.append(str(cb.id))
            log.info("Auto-fired callback %s for lead %s", cb.id, lead.id)
        except Exception as exc:
            log.error("Failed to fire callback %s: %s", cb.id, exc)

    return {"fired": fired, "skipped": skipped, "total_due": len(due_cbs)}


@router.get("/{callback_id}", response_model=CallbackOut)
async def get_callback(callback_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    cb = await CallbackRepository(db).get(callback_id)
    if not cb:
        raise HTTPException(status_code=404, detail="Callback not found")
    try:
        lead = await LeadRepository(db).get(cb.lead_id)
    except LeadNotFound:
        lead = None
    return _enrich(cb, lead)


@router.patch("/{callback_id}", response_model=CallbackOut)
async def update_callback(
    callback_id: str,
    payload:     CallbackUpdate,
    db:          AsyncIOMotorDatabase = Depends(get_db),
):
    cb_repo = CallbackRepository(db)
    cb      = await cb_repo.get(callback_id)
    if not cb:
        raise HTTPException(status_code=404, detail="Callback not found")

    fields = payload.model_dump(exclude_unset=True)
    await cb_repo.update(cb, **fields)
    try:
        lead = await LeadRepository(db).get(cb.lead_id)
    except LeadNotFound:
        lead = None
    return _enrich(cb, lead)


@router.delete("/{callback_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_callback(callback_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    cb_repo = CallbackRepository(db)
    cb      = await cb_repo.get(callback_id)
    if not cb:
        raise HTTPException(status_code=404, detail="Callback not found")
    await cb_repo.delete(callback_id)


@router.post("/{callback_id}/trigger", status_code=status.HTTP_202_ACCEPTED)
async def trigger_callback_call(callback_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    from datetime import timedelta
    from ..services.call_service import trigger_plivo_call
    from ..services.memory_service import build_call_context

    _IST    = timezone(timedelta(hours=5, minutes=30))
    cb_repo = CallbackRepository(db)
    cb      = await cb_repo.get(callback_id)
    if not cb:
        raise HTTPException(status_code=404, detail="Callback not found")
    if cb.status != CallbackStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Callback is not pending")

    try:
        lead = await LeadRepository(db).get(cb.lead_id)
    except LeadNotFound:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.do_not_call:
        raise HTTPException(status_code=400, detail="Lead is marked do-not-call")

    previous_memory    = await build_call_context(lead.id, db)
    callback_scheduled = cb.scheduled_at.astimezone(_IST).strftime("%d %B %I:%M %p IST")

    result = await trigger_plivo_call(
        phone              = lead.phone,
        lead_id            = str(lead.id),
        previous_memory    = previous_memory,
        lead_name          = lead.name,
        callback_scheduled = callback_scheduled,
    )
    await cb_repo.update(cb, status=CallbackStatus.COMPLETED.value)
    return {"status": "call_triggered", "plivo_response": result}


def _enrich(cb, lead) -> CallbackOut:
    return CallbackOut(
        id                = cb.id,
        lead_id           = cb.lead_id,
        callback_type     = cb.callback_type,
        scheduled_at      = cb.scheduled_at,
        status            = cb.status,
        notes             = cb.notes,
        triggered_call_id = cb.triggered_call_id,
        created_at        = cb.created_at,
        updated_at        = cb.updated_at,
        lead_name         = lead.name   if lead else None,
        lead_phone        = lead.phone  if lead else None,
        lead_status       = lead.status if lead else None,
    )
