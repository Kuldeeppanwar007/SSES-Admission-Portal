"""
Internal API for SSES-Admission-Portal frontend integration.
Uses API key auth — no separate login needed.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..config import settings
from ..database import get_db
from ..models.callback import CallbackStatus, CallbackType
from ..models.lead import LeadStatus
from ..repositories.callback_repo import CallbackRepository
from ..repositories.conversation_repo import ConversationRepository
from ..repositories.lead_repo import LeadRepository
from ..security import normalise_phone
from ..services.call_service import trigger_plivo_call
from ..services.memory_service import build_call_context

log = logging.getLogger(__name__)
router = APIRouter(prefix="/agent", tags=["agent"])


def _verify_api_key(x_api_key: Optional[str] = Header(None)):
    if x_api_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")


_auth = Depends(_verify_api_key)


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats", dependencies=[_auth])
async def get_stats(db: AsyncIOMotorDatabase = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

    calls_today = await db.agent_conversations.count_documents(
        {"channel": "phone", "created_at": {"$gte": today_start}}
    )
    pending_callbacks = await db.agent_callbacks.count_documents(
        {"status": CallbackStatus.PENDING.value}
    )
    interested = await db.agent_leads.count_documents(
        {"status": LeadStatus.INTERESTED.value}
    )
    converted = await db.agent_leads.count_documents(
        {"status": LeadStatus.CONVERTED.value}
    )

    return {
        "calls_today": calls_today,
        "pending_callbacks": pending_callbacks,
        "interested": interested,
        "converted": converted,
    }


# ── Call by phone ─────────────────────────────────────────────────────────────

@router.post("/call", dependencies=[_auth])
async def trigger_call(
    body: dict,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    raw_phone: str = body.get("phone", "")
    name: str = body.get("name", "")

    if not raw_phone:
        raise HTTPException(status_code=400, detail="phone required")

    try:
        phone = normalise_phone(raw_phone)
    except Exception:
        phone = raw_phone

    lead_repo = LeadRepository(db)
    lead = await lead_repo.get_by_phone(phone)

    if not lead:
        from ..exceptions import DuplicatePhone
        try:
            lead = await lead_repo.create(name=name or phone, phone=phone)
        except DuplicatePhone:
            lead = await lead_repo.get_by_phone(phone)

    if lead.do_not_call:
        raise HTTPException(status_code=400, detail="This number is marked Do Not Call")
    if lead.status == LeadStatus.CALLING.value:
        raise HTTPException(status_code=400, detail="Call already in progress")

    previous_memory = await build_call_context(lead.id, db)
    await lead_repo.update(lead, status=LeadStatus.CALLING.value, last_call_at=datetime.now(timezone.utc))

    try:
        result = await trigger_plivo_call(
            phone=phone,
            lead_id=str(lead.id),
            previous_memory=previous_memory,
            lead_name=lead.name or name or "",
        )
        return {"status": "initiated", "lead_id": str(lead.id), "result": result}
    except Exception as e:
        await lead_repo.update(lead, status=LeadStatus.FAILED.value)
        raise HTTPException(status_code=500, detail=str(e))


# ── Call history by phone ─────────────────────────────────────────────────────

@router.get("/history", dependencies=[_auth])
async def call_history(
    phone: str = Query(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        norm = normalise_phone(phone)
    except Exception:
        norm = phone

    lead_repo = LeadRepository(db)
    lead = await lead_repo.get_by_phone(norm)
    if not lead:
        return {"lead": None, "conversations": [], "callbacks": []}

    conv_repo = ConversationRepository(db)
    conversations = await conv_repo.list_for_lead(lead.id, limit=50)

    cb_repo = CallbackRepository(db)
    callbacks = await cb_repo.list_for_lead(lead.id)

    phone_count    = sum(1 for c in conversations if c.channel == "phone")
    whatsapp_count = sum(1 for c in conversations if c.channel == "whatsapp")
    pending_cbs    = sum(1 for cb in callbacks if cb.status == "pending")

    return {
        "lead": {
            "id": str(lead.id),
            "status": lead.status,
            "call_count": phone_count,
            "whatsapp_count": whatsapp_count,
            "pending_callbacks": pending_cbs,
            "last_call_at": lead.last_call_at.isoformat() if lead.last_call_at else None,
            "memory_summary": lead.memory_summary,
        },
        "conversations": [
            {
                "id": str(c.id),
                "channel": c.channel,
                "direction": c.direction,
                "message": c.message,
                "agent_reply": c.agent_reply,
                "intent":        c.meta.get("intent")               if c.meta else None,
                "outcome":       c.meta.get("outcome")              if c.meta else None,
                "summary":       (c.meta.get("conversation_summary") or c.meta.get("summary_points")) if c.meta else None,
                "transcript":    c.meta.get("transcript")           if c.meta else None,
                "recording_url": c.meta.get("recording_url")        if c.meta else None,
                "duration":      c.meta.get("duration")             if c.meta else None,
                "created_at": c.created_at.isoformat(),
            }
            for c in conversations
        ],
        "callbacks": [
            {
                "id": str(cb.id),
                "type": cb.callback_type,
                "scheduled_at": cb.scheduled_at.isoformat(),
                "status": cb.status,
                "notes": cb.notes,
            }
            for cb in callbacks
        ],
    }


# ── Schedule callback by phone ────────────────────────────────────────────────

@router.post("/callback", dependencies=[_auth])
async def schedule_callback(
    body: dict,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    raw_phone: str = body.get("phone", "")
    name: str = body.get("name", "")
    scheduled_at_str: str = body.get("scheduled_at", "")
    notes: str = body.get("notes", "")
    cb_type: str = body.get("callback_type", "human")

    if not raw_phone or not scheduled_at_str:
        raise HTTPException(status_code=400, detail="phone and scheduled_at required")

    try:
        phone = normalise_phone(raw_phone)
    except Exception:
        phone = raw_phone

    from dateutil import parser as dtparse
    try:
        scheduled_at = dtparse.parse(scheduled_at_str)
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid scheduled_at format")

    lead_repo = LeadRepository(db)
    lead = await lead_repo.get_by_phone(phone)
    if not lead:
        from ..exceptions import DuplicatePhone
        try:
            lead = await lead_repo.create(name=name or phone, phone=phone)
        except DuplicatePhone:
            lead = await lead_repo.get_by_phone(phone)

    cb_repo = CallbackRepository(db)
    cb_type_enum = CallbackType.HUMAN if cb_type == "human" else CallbackType.AGENT
    cb, created = await cb_repo.upsert_pending(
        lead.id, scheduled_at=scheduled_at,
        callback_type=cb_type_enum, notes=notes or None,
    )

    return {
        "id": str(cb.id),
        "scheduled_at": cb.scheduled_at.isoformat(),
        "status": cb.status,
        "created": created,
    }


# ── Pending callbacks list ─────────────────────────────────────────────────────

@router.get("/callbacks", dependencies=[_auth])
async def list_callbacks(
    status: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    query_status = status or CallbackStatus.PENDING.value
    rows, _ = await CallbackRepository(db).list_enriched(status=query_status, limit=200)

    return {
        "callbacks": [
            {
                "id": row["id"],
                "lead_name": row["lead_name"],
                "lead_phone": row["lead_phone"],
                "callback_type": row["callback_type"],
                "scheduled_at": row["scheduled_at"].isoformat() if row["scheduled_at"] else None,
                "status": row["status"],
                "notes": row["notes"],
            }
            for row in rows
        ]
    }


# ── Cancel callback ────────────────────────────────────────────────────────────

@router.patch("/callbacks/{callback_id}/cancel", dependencies=[_auth])
async def cancel_callback(callback_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    cb_repo = CallbackRepository(db)
    cb = await cb_repo.get(callback_id)
    if not cb:
        raise HTTPException(status_code=404, detail="Callback not found")
    await cb_repo.update(cb, status=CallbackStatus.CANCELLED.value)
    return {"status": "cancelled"}


# ── Send WhatsApp message ──────────────────────────────────────────────────────

@router.post("/whatsapp", dependencies=[_auth])
async def send_whatsapp_message(body: dict):
    from ..services.whatsapp_service import send_whatsapp
    phone: str = body.get("phone", "")
    text:  str = body.get("text", "")
    if not phone or not text:
        raise HTTPException(status_code=400, detail="phone and text required")
    try:
        phone = normalise_phone(phone)
    except Exception:
        pass
    result = await send_whatsapp(phone, text)
    return {"status": "sent", "result": result}
