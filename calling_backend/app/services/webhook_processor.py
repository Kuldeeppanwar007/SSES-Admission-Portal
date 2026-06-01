"""
WebhookProcessor: post-call business logic for SSISM admission agent.

KEY FIX: WhatsApp template messages do NOT contain URLs.
Meta rejects delivery when URLs are injected into {{1}} template parameters.
URLs are sent separately as session messages after the template.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.callback import CallbackStatus, CallbackType
from ..models.conversation import Direction
from ..models.lead import LeadStatus
from ..repositories.callback_repo import CallbackRepository
from ..repositories.conversation_repo import ConversationRepository
from ..repositories.lead_repo import LeadRepository
from ..repositories.memory_repo import MemoryRepository
from ..schemas.webhook import PlivoHangupPayload, WhatsAppInboundPayload
from .whatsapp_service import send_whatsapp, send_whatsapp_template

log = logging.getLogger(__name__)

WHATSAPP_ENABLED = False  # set True to re-enable post-call WhatsApp messages

_OUTCOME_TO_STATUS: dict[str, str] = {
    "interested_now":      LeadStatus.INTERESTED.value,
    "callback_scheduled":  LeadStatus.CALLBACK_SCHEDULED.value,
    "not_interested":      LeadStatus.NOT_INTERESTED.value,
    "busy_no_callback":    LeadStatus.NOT_ANSWERED.value,
    "wrong_number":        LeadStatus.WRONG_NUMBER.value,
    "do_not_call":         LeadStatus.DO_NOT_CALL.value,
    "hostile_dnc":         LeadStatus.DO_NOT_CALL.value,
    "voicemail":           LeadStatus.NOT_ANSWERED.value,
    "call_on_hold":        LeadStatus.NOT_ANSWERED.value,
    "unable_to_continue":  LeadStatus.NOT_ANSWERED.value,
    "college_visit":       LeadStatus.INTERESTED.value,
    "undecided":           LeadStatus.PENDING.value,
}

SSISM_WEBSITE = "ssism.org"
SSISM_PHONE   = "+91-9926845557"


def _first_name(lead_name: str) -> str:
    if not lead_name or lead_name.startswith("WhatsApp Lead"):
        return "Student"
    return lead_name.split()[0]


def _build_interested_msg(lead_name: str = "", summary: str = "") -> str:
    name = _first_name(lead_name)
    return (
        f"Namaste {name} ji! 🎓 Bahut shukriya interest dikhane ke liye!\n\n"
        "Aapka SSISM admission counselor aapko lagbhag 15 minute mein call karenge "
        "— please call zaroor pick up kariyega. 🙏"
    )


def _build_callback_scheduled_msg(cb_date: str, cb_time: str, lead_name: str = "") -> str:
    name = _first_name(lead_name)
    when = _format_callback_datetime(cb_date, cb_time)
    return (
        f"Namaste {name} ji! 📅 Aapka SSISM counselor se call *{when}* ke liye schedule ho gaya hai.\n\n"
        "Call aane par please zaroor pick up kariyega — sirf 5-10 minute ki baat hogi. 🙏"
    )


def _build_not_interested_msg(lead_name: str = "", disinterest_reason: str = "") -> str:
    name   = _first_name(lead_name)
    reason = f" ({disinterest_reason})" if disinterest_reason else ""
    return (
        f"Namaste {name} ji! 🙏 Abhi interest nahi hai, bilkul samajh aata hai{reason}.\n\n"
        "Jab bhi aage padhai ke baare mein sochein, hum yahan hain — WhatsApp par reply kijiye. 😊"
    )


def _build_reconnect_msg(lead_name: str = "") -> str:
    name = _first_name(lead_name)
    return (
        f"Namaste {name} ji! 🙏 Aapki call se theek se connect nahi ho paaya.\n\n"
        "SSISM admission ke baare mein koi sawaal ho to yahan WhatsApp reply kijiye — main hoon! 🎓"
    )


class WebhookProcessor:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db     = db
        self.leads  = LeadRepository(db)
        self.convs  = ConversationRepository(db)
        self.cbs    = CallbackRepository(db)
        self.memory = MemoryRepository(db)

    async def process_hangup(self, payload: PlivoHangupPayload) -> None:
        ev           = payload.extracted_variables
        outcome      = ev.get("conversation_outcome", "").lower()
        if not outcome:
            _interest = ev.get("interest_status", "").lower()
            if _interest == "interested":
                outcome = "interested_now"
            elif _interest == "not_interested":
                outcome = "not_interested"
        summary     = ev.get("summary_points", "")
        cb_date     = ev.get("callback_date", "")
        cb_time     = ev.get("callback_time", "")
        cb_validity = ev.get("callback_validity", "")
        disinterest = ev.get("disinterest_reason", "")

        lead = None
        if payload.lead_id:
            try:
                lead = await self.leads.get(payload.lead_id)
            except Exception:
                pass
        if not lead:
            lead = await self.leads.get_by_phone(payload.phone_to)
        if not lead:
            log.warning("HANGUP: no lead found id=%s phone=%s", payload.lead_id, payload.phone_to)
            return

        cs = payload.call_status.lower()
        if cs in ("no-answer", "no_answer", "busy"):
            new_status = LeadStatus.NOT_ANSWERED
        elif cs in ("failed", "error"):
            new_status = LeadStatus.FAILED
        elif outcome:
            val        = _OUTCOME_TO_STATUS.get(outcome, LeadStatus.NOT_ANSWERED.value)
            new_status = LeadStatus(val)
        elif cs == "completed" and payload.duration > 10:
            new_status = LeadStatus.PENDING
        else:
            new_status = LeadStatus.NOT_ANSWERED

        if new_status == LeadStatus.INTERESTED:
            existing_pending = await self.cbs.list_for_lead(lead.id)
            has_future_pending = any(
                cb.status == CallbackStatus.PENDING.value
                and cb.scheduled_at > datetime.now(timezone.utc)
                for cb in existing_pending
            )
            if has_future_pending:
                new_status = LeadStatus.CALLBACK_SCHEDULED

        dnc = new_status in (LeadStatus.DO_NOT_CALL, LeadStatus.WRONG_NUMBER)
        update_fields: dict = {
            "status":       new_status.value,
            "last_call_id": payload.call_uuid or lead.last_call_id,
            "last_call_at": datetime.now(timezone.utc),
        }
        if dnc:
            update_fields["do_not_call"] = True
        await self.leads.update(lead, **update_fields)

        await self.convs.create_phone(
            lead.id,
            message=summary or f"Call ended: {cs}",
            agent_reply=f"Outcome: {outcome}",
            call_id=payload.call_uuid or None,
            meta={
                "outcome": outcome, "call_status": cs,
                "duration": payload.duration, "hangup_cause": payload.hangup_cause,
                "extracted_data": ev, "summary_points": summary,
                "disinterest_reason": disinterest,
            },
        )

        next_action = (
            "schedule_counselor_callback" if new_status == LeadStatus.INTERESTED else
            "schedule_callback"           if new_status == LeadStatus.CALLBACK_SCHEDULED else
            "none"
        )
        await self.memory.upsert(
            lead.id, summary=summary, latest_outcome=outcome,
            extracted_data=ev, next_action=next_action,
        )

        if new_status == LeadStatus.CALLBACK_SCHEDULED and cb_validity == "valid":
            scheduled_at = _parse_dt(cb_date, cb_time)
            _cb, created = await self.cbs.upsert_pending(
                lead.id, scheduled_at=scheduled_at, callback_type=CallbackType.AGENT,
                notes=f"Post-call schedule ({cb_date} {cb_time})".strip() or None,
            )
            log.info("Post-call callback %s lead=%s scheduled_at=%s",
                     "created" if created else "updated", lead.id, scheduled_at)
            
            try:
                from .notification_service import create_incharge_notification
                title = f"Callback Scheduled: {lead.name}"
                when_str = _format_callback_datetime(cb_date, cb_time)
                message = f"A callback has been scheduled for {lead.name} ({lead.phone}) for {when_str}. Notes: Post-call schedule ({cb_date} {cb_time})."
                await create_incharge_notification(
                    db=self.db,
                    track=lead.track,
                    title=title,
                    message=message,
                    student_id_str=lead.student_id
                )
            except Exception as exc:
                log.error("Failed to notify incharge for post-call callback: %s", exc)

            if WHATSAPP_ENABLED:
                await _send_callback_scheduled_whatsapp(
                    lead.id, lead.phone, payload.call_uuid, cb_date, cb_time,
                    lead_name=lead.name or "", db=self.db,
                )

        if WHATSAPP_ENABLED and new_status == LeadStatus.INTERESTED:
            await _send_interested_whatsapp(
                lead.id, lead.phone, payload.call_uuid,
                lead_name=lead.name or "", db=self.db,
            )

        if WHATSAPP_ENABLED and new_status == LeadStatus.NOT_INTERESTED:
            await _send_not_interested_whatsapp(
                lead.id, lead.phone, payload.call_uuid,
                disinterest=disinterest, lead_name=lead.name or "", db=self.db,
            )

        _no_whatsapp_statuses = (
            LeadStatus.INTERESTED, LeadStatus.NOT_INTERESTED,
            LeadStatus.CALLBACK_SCHEDULED, LeadStatus.DO_NOT_CALL,
            LeadStatus.WRONG_NUMBER,
        )
        if WHATSAPP_ENABLED and new_status not in _no_whatsapp_statuses:
            await _send_reconnect_whatsapp(
                lead.id, lead.phone, payload.call_uuid,
                lead_name=lead.name or "", db=self.db,
            )

        # Notify track incharge/admin that call is completed, busy, scheduled, or failed
        try:
            from .notification_service import create_incharge_notification
            cs_lower = payload.call_status.lower()
            
            should_send = True
            if new_status == LeadStatus.CALLBACK_SCHEDULED:
                if cb_validity == "valid":
                    # Avoid duplicate since we already sent the Callback Scheduled notification
                    should_send = False
                else:
                    title = f"Call Ended & Scheduled: {lead.name}"
                    message = f"AI Call with {lead.name} ({lead.phone}) ended. Outcome: Callback Scheduled."
            elif cs_lower in ("busy", "no-answer", "no_answer") or new_status == LeadStatus.NOT_ANSWERED:
                title = f"Call Busy/No Answer: {lead.name}"
                message = f"AI Call with {lead.name} ({lead.phone}) was busy or not answered. Call Status: {payload.call_status}."
            elif cs_lower in ("failed", "error") or new_status == LeadStatus.FAILED:
                title = f"Call Failed: {lead.name}"
                message = f"AI Call with {lead.name} ({lead.phone}) failed. Call Status: {payload.call_status}."
            else:
                outcome_label = outcome.replace('_', ' ').capitalize() if outcome else "Completed"
                title = f"AI Call Completed: {lead.name}"
                message = f"AI Call with {lead.name} ({lead.phone}) completed. Status: {payload.call_status}. Outcome: {outcome_label}. Duration: {payload.duration}s."

            if should_send:
                await create_incharge_notification(
                    db=self.db,
                    track=lead.track,
                    title=title,
                    message=message,
                    student_id_str=lead.student_id
                )
        except Exception as exc:
            log.error("Failed to notify incharge/admin for call completion: %s", exc)

        log.info(
            "HANGUP processed lead=%s phone=%s call=%s status=%s outcome=%s",
            lead.id, lead.phone, payload.call_uuid, new_status.value, outcome,
        )

    async def process_recording(
        self, call_uuid: str, recording_url: str, *,
        transcription: str = "", conversation_summary: str = "",
    ) -> None:
        if call_uuid and recording_url:
            await self.convs.attach_recording(
                call_uuid, recording_url,
                transcription=transcription, conversation_summary=conversation_summary,
            )
            log.info("Recording attached call=%s transcript_len=%d", call_uuid, len(transcription))
            text = conversation_summary or transcription
            if text:
                await self._extract_intent_from_transcript(call_uuid, text)
        else:
            log.warning("Recording webhook missing call_uuid or recording_url")

    async def _extract_intent_from_transcript(self, call_uuid: str, text: str) -> None:
        import json as _json
        from .groq_service import GroqChatClient, GroqNotConfigured

        conv = await self.convs.find_by_call_id(call_uuid)
        if not conv:
            log.warning("Intent extract: no conversation for call=%s", call_uuid)
            return

        try:
            lead = await self.leads.get(conv.lead_id)
        except Exception:
            return

        if lead.status not in (
            LeadStatus.PENDING.value,
            LeadStatus.NOT_ANSWERED.value,
            LeadStatus.CALLING.value,
        ):
            log.info("Intent extract skipped — lead already has status=%s", lead.status)
            return

        system = (
            "You analyse Indian college admission call transcripts for SSISM.\n"
            "Classify the student's intent into EXACTLY ONE of:\n"
            "  interested_now       — actively interested in admission, wants counselor to call back soon\n"
            "  college_visit        — plans to visit the college in person (even if they refused a phone callback)\n"
            "  callback_scheduled   — asked to be called back at a specific future time\n"
            "  not_interested       — clearly said they do NOT want to study / join / visit / learn more\n"
            "  undecided            — hasn't decided, open to info, no commitment either way\n"
            "  no_answer            — call too short / voicemail / not really answered\n"
            "\n"
            "IMPORTANT RULES:\n"
            "- If student says they will visit the college in person → college_visit (NOT not_interested)\n"
            "- Refusing a phone callback ≠ not interested. Check if they still plan to engage.\n"
            "- Only use not_interested if student clearly wants NO further contact of any kind.\n"
            "Reply ONLY as JSON: {\"outcome\": \"<value>\", \"reason\": \"<one short line>\"}"
        )
        try:
            raw = await GroqChatClient().complete(
                system_prompt=system,
                messages=[{"role": "user", "content": text[:2000]}],
                temperature=0.1,
                max_tokens=80,
            )
            data    = _json.loads(raw.strip())
            outcome = data.get("outcome", "").lower().strip()
            reason  = data.get("reason", "")
        except (GroqNotConfigured, Exception) as exc:
            log.error("Intent Groq call failed call=%s: %s", call_uuid, exc)
            return

        if not outcome or outcome == "no_answer":
            return

        val = _OUTCOME_TO_STATUS.get(outcome, "")
        if not val:
            log.warning("Intent extract: unknown outcome=%s call=%s", outcome, call_uuid)
            return

        new_status = LeadStatus(val)
        await self.leads.update(lead, status=new_status.value)

        await self.db.agent_conversations.update_one(
            {"call_id": call_uuid, "channel": "phone"},
            {"$set": {"meta.outcome": outcome, "meta.intent_reason": reason}},
        )

        await self.memory.upsert(
            lead.id, summary=text, latest_outcome=outcome,
            extracted_data={"conversation_outcome": outcome, "intent_reason": reason},
            next_action="none",
        )
        log.info(
            "Intent extracted call=%s outcome=%s reason=%s lead=%s → status=%s",
            call_uuid, outcome, reason, lead.id, new_status.value,
        )

    async def process_whatsapp_inbound(self, payload: WhatsAppInboundPayload) -> bool:
        from .whatsapp_ai_service import WhatsAppAIService
        return await WhatsAppAIService(self.db).handle_inbound(payload)


# ── WhatsApp senders ──────────────────────────────────────────────────────────

async def _send_interested_whatsapp(
    lead_id: str, phone: str, call_uuid: str,
    lead_name: str = "", *, db=None,
) -> None:
    from .groq_service import GroqChatClient, GroqNotConfigured

    fallback_msg = _build_interested_msg(lead_name)
    content = fallback_msg
    try:
        first_name = _first_name(lead_name)
        system = (
            "Tu Riya hai — SSISM admission team ki WhatsApp assistant. "
            "Ek warm, friendly message likho (Hinglish, 2-3 chhote sentences, strictly under 50 words, no bullet lists). "
            "Student ne SSISM mein admission ke liye interest dikhaya. "
            "Unhe batao ki counselor ~15 minute mein call karenge, please pick up karein. "
            "Kabhi bhi 'Caller' ya 'Lead' mat likho. Student ke naam se address karo. "
            "Message mein koi link ya URL mat daalo."
        )
        user_content = f"Student name: {first_name}\nOutcome: interested_now — counselor will call in 15 min"
        content = await GroqChatClient().complete(
            system_prompt=system,
            messages=[{"role": "user", "content": user_content}],
            temperature=0.4, max_tokens=100,
        )
    except (GroqNotConfigured, Exception) as exc:
        log.warning("Groq failed for interested WhatsApp lead=%s: %s", lead_id, exc)
        content = fallback_msg

    await _dispatch_template(
        lead_id, phone, content, fallback_msg,
        trigger="interested_after_call", call_uuid=call_uuid, db=db,
    )


async def _send_callback_scheduled_whatsapp(
    lead_id: str, phone: str, call_uuid: str, cb_date: str, cb_time: str,
    lead_name: str = "", *, db=None,
) -> None:
    from .groq_service import GroqChatClient, GroqNotConfigured

    when         = _format_callback_datetime(cb_date, cb_time)
    fallback_msg = _build_callback_scheduled_msg(cb_date, cb_time, lead_name)
    content = fallback_msg
    try:
        first_name = _first_name(lead_name)
        system = (
            "Tu Riya hai — SSISM admission team ki WhatsApp assistant. "
            "Ek warm message likho (Hinglish, 2-3 chhote sentences, strictly under 50 words, no bullet lists). "
            "Student ka SSISM counselor callback schedule hua hai — unhe exact time aur pick up reminder do. "
            "Kabhi bhi 'Caller' ya 'Lead' mat likho. Student ke naam se address karo. "
            "Message mein koi link ya URL mat daalo."
        )
        user_content = (
            f"Student name: {first_name}\n"
            f"Callback scheduled: {when}"
        )
        content = await GroqChatClient().complete(
            system_prompt=system,
            messages=[{"role": "user", "content": user_content}],
            temperature=0.4, max_tokens=100,
        )
    except (GroqNotConfigured, Exception) as exc:
        log.warning("Groq failed for callback WhatsApp lead=%s: %s", lead_id, exc)
        content = fallback_msg

    await _dispatch_template(
        lead_id, phone, content, fallback_msg,
        trigger="callback_scheduled_after_call", call_uuid=call_uuid, db=db,
    )


async def _send_not_interested_whatsapp(
    lead_id: str, phone: str, call_uuid: str, disinterest: str = "",
    lead_name: str = "", *, db=None,
) -> None:
    from .groq_service import GroqChatClient, GroqNotConfigured

    fallback_msg = _build_not_interested_msg(lead_name, disinterest)
    content = fallback_msg
    try:
        first_name  = _first_name(lead_name)
        reason_note = f"Disinterest reason: {disinterest}." if disinterest else ""
        system = (
            "Tu Riya hai — SSISM admission team ki WhatsApp assistant. "
            "Ek warm, empathetic message likho (Hinglish, 2-3 chhote sentences, strictly under 50 words, no bullet lists). "
            "Student ne abhi interest nahi dikhaya — acknowledge karo bina pressure ke, door open rakho. "
            "Kabhi bhi 'Caller' ya 'Lead' mat likho. Student ke naam se address karo. "
            f"Message mein koi link ya URL mat daalo. {reason_note}"
        )
        user_content = f"Student name: {first_name}\nOutcome: not_interested"
        content = await GroqChatClient().complete(
            system_prompt=system,
            messages=[{"role": "user", "content": user_content}],
            temperature=0.4, max_tokens=100,
        )
    except (GroqNotConfigured, Exception) as exc:
        log.warning("Groq failed for not-interested WhatsApp lead=%s: %s", lead_id, exc)
        content = fallback_msg

    await _dispatch_template(
        lead_id, phone, content, fallback_msg,
        trigger="not_interested_after_call", call_uuid=call_uuid, db=db,
    )


async def _send_reconnect_whatsapp(
    lead_id: str, phone: str, call_uuid: str,
    lead_name: str = "", *, db=None,
) -> None:
    from .groq_service import GroqChatClient, GroqNotConfigured

    fallback_msg = _build_reconnect_msg(lead_name)
    content = fallback_msg
    try:
        first_name = _first_name(lead_name)
        system = (
            "Tu Riya hai — SSISM admission team ki WhatsApp assistant. "
            "Ek warm message likho (Hinglish, 2-3 chhote sentences, strictly under 50 words, no bullet lists). "
            "Call connect nahi ho payi — student ko WhatsApp par reply karne ka mauka do. "
            "Kabhi bhi 'Caller' ya 'Lead' mat likho. Student ke naam se address karo. "
            "Message mein koi link ya URL mat daalo."
        )
        user_content = f"Student name: {first_name}\nOutcome: call not connected / dropped"
        content = await GroqChatClient().complete(
            system_prompt=system,
            messages=[{"role": "user", "content": user_content}],
            temperature=0.4, max_tokens=100,
        )
    except (GroqNotConfigured, Exception) as exc:
        log.warning("Groq failed for reconnect WhatsApp lead=%s: %s", lead_id, exc)
        content = fallback_msg

    await _dispatch_template(
        lead_id, phone, content, fallback_msg,
        trigger="reconnect_after_call", call_uuid=call_uuid, db=db,
    )


async def _dispatch_template(
    lead_id: str, phone: str, content: str, fallback_msg: str, *,
    trigger: str, call_uuid: str, db=None,
) -> None:
    sent_via = "none"
    try:
        await send_whatsapp_template(phone, content)
        sent_via = "template"
        log.info("WhatsApp template sent lead=%s trigger=%s", lead_id, trigger)

        try:
            await send_whatsapp(phone, f"Aur jaankari ke liye: {SSISM_WEBSITE}")
        except Exception:
            pass

    except Exception as tmpl_exc:
        log.warning("Template failed lead=%s: %s — session fallback", lead_id, tmpl_exc)
        try:
            await send_whatsapp(phone, fallback_msg + f"\n\nJaankari: {SSISM_WEBSITE}")
            sent_via = "session"
            log.info("WhatsApp session msg sent lead=%s trigger=%s", lead_id, trigger)
        except Exception as exc:
            log.error("WhatsApp FAILED entirely lead=%s trigger=%s: %s", lead_id, trigger, exc)
            return

    meta = {"trigger": trigger, "call_uuid": call_uuid, "sent_via": sent_via}
    try:
        from ..database import get_db as _get_db
        _db = db or _get_db()
        await ConversationRepository(_db).create_whatsapp(
            lead_id, direction=Direction.OUTBOUND, agent_reply=content, meta=meta,
        )
    except Exception as exc:
        log.error("Failed to record WhatsApp conv lead=%s: %s", lead_id, exc)


def _format_callback_datetime(cb_date: str, cb_time: str, now_ist=None) -> str:
    try:
        from dateutil import parser as dtparse
        from datetime import timezone, timedelta
        IST = timezone(timedelta(hours=5, minutes=30))
        dt  = dtparse.parse(f"{cb_date} {cb_time}".strip())
        if now_ist is None:
            now_ist = datetime.now(IST)

        h      = dt.hour
        period = "subah" if h < 12 else "dopahar" if h < 17 else "shaam" if h < 20 else "raat"
        day    = str(dt.day).lstrip("0")
        month  = dt.strftime("%B")
        clock  = dt.strftime("%I:%M").lstrip("0")

        delta_days = (dt.date() - now_ist.date()).days
        if delta_days == 0:
            prefix = "aaj"
        elif delta_days == 1:
            prefix = "kal"
        elif delta_days == 2:
            prefix = "parso"
        else:
            prefix = None

        if prefix:
            return f"{prefix} ({day} {month}), {period} {clock} baje"
        return f"{day} {month}, {period} {clock} baje"
    except Exception:
        return f"{cb_date} {cb_time}".strip()


def _parse_dt(cb_date: str, cb_time: str) -> datetime:
    import re
    from dateutil import parser as dtparse
    from datetime import timezone, timedelta

    IST     = timezone(timedelta(hours=5, minutes=30))
    now_utc = datetime.now(timezone.utc)
    now_ist = now_utc.astimezone(IST)
    
    cb_date_clean = cb_date.strip().lower()
    cb_time_clean = cb_time.strip().lower()

    # 1. If cb_time is just digits (under 60), treat as relative minutes immediately
    if cb_time_clean.isdigit():
        val = int(cb_time_clean)
        if val < 60:
            return now_utc + timedelta(minutes=max(val, 2))

    # Support Hindi/English suffix "baad" or "later" after digits (e.g. "10 baad", "5 later")
    baad_m = re.match(r'^(\d+)\s*(?:baad|later|after)?$', cb_time_clean)
    if baad_m:
        val = int(baad_m.group(1))
        if val < 60:
            return now_utc + timedelta(minutes=max(val, 2))

    combined = f"{cb_date} {cb_time}".strip()
    combined_clean = combined.lower().strip()

    # Substitute today/tomorrow/aaj/kal
    today_str = now_ist.strftime("%Y-%m-%d")
    tomorrow_str = (now_ist + timedelta(days=1)).strftime("%Y-%m-%d")

    combined_clean = combined_clean.replace("today", today_str).replace("aaj", today_str)
    combined_clean = combined_clean.replace("tomorrow", tomorrow_str).replace("kal", tomorrow_str)

    # 2. Match relative minutes with words (e.g., "5 min", "10 minutes", "5m", "10 mins")
    min_m = re.search(r'(\d+)\s*(?:min|minute|minutes|minut|m|mins)\b', combined_clean)
    if min_m:
        return now_utc + timedelta(minutes=max(int(min_m.group(1)), 2))

    # 3. Match relative hours (e.g., "1 hour", "2 ghante")
    hr_m = re.search(r'(\d+)\s*(?:hour|hours|hr|hrs|ghante|ghanta)\b', combined_clean)
    if hr_m:
        return now_utc + timedelta(hours=int(hr_m.group(1)))

    # 4. Fallback to dateutil parser for absolute date-times
    try:
        if re.match(r'^\s*\d{4}', combined_clean):
            # ISO format (starts with YYYY) -> do NOT use dayfirst=True
            dt = dtparse.parse(combined_clean, default=now_ist.replace(tzinfo=None))
        else:
            dt = dtparse.parse(combined_clean, dayfirst=True, default=now_ist.replace(tzinfo=None))

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=IST)
        dt_utc = dt.astimezone(timezone.utc)

        if dt_utc < now_utc + timedelta(minutes=1):
            dt_utc += timedelta(days=1)

        return dt_utc
    except Exception:
        return now_utc + timedelta(hours=1)
