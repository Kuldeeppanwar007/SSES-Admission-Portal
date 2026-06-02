"""
memory_service.py — shared context for phone agent + WhatsApp AI.
build_call_context → Groq-summarised Hinglish notes injected as previous_memory.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.callback import CallbackStatus
from ..models.conversation import Channel
from ..models.lead import Lead
from ..repositories.callback_repo import CallbackRepository
from ..repositories.conversation_repo import ConversationRepository
from ..repositories.lead_repo import LeadRepository
from ..repositories.memory_repo import MemoryRepository

_PLACEHOLDER_NAME_PREFIX = "WhatsApp Lead"

log = logging.getLogger(__name__)
_IST = timezone(timedelta(hours=5, minutes=30))


async def get_pending_callback_str(lead_id: str, db: AsyncIOMotorDatabase) -> str:
    all_cbs = await CallbackRepository(db).list_for_lead(lead_id)
    pending = [cb for cb in all_cbs if cb.status == CallbackStatus.PENDING.value]
    if not pending:
        return ""
    cb = pending[0]
    return cb.scheduled_at.astimezone(_IST).strftime("%d %B %I:%M %p IST")


async def build_call_context(lead_id: str, db: AsyncIOMotorDatabase) -> str:
    memory  = await MemoryRepository(db).get(lead_id)
    convs   = await ConversationRepository(db).list_for_lead(lead_id, limit=80)
    all_cbs = await CallbackRepository(db).list_for_lead(lead_id)
    lead    = await LeadRepository(db).get(lead_id)

    pending_cbs = [cb for cb in all_cbs if cb.status == CallbackStatus.PENDING.value]

    has_previous_calls = any(
        c.channel == Channel.PHONE.value
        and (c.meta or {}).get("call_status") != "initiated"
        for c in convs
    )

    raw = _build_raw(memory, convs, pending_cbs, lead)
    if not raw:
        return ""

    summary = await _summarise_with_groq(raw)
    result  = summary or raw[:1000]

    if pending_cbs:
        cb         = pending_cbs[0]
        t          = cb.scheduled_at.astimezone(_IST).strftime("%d %B %I:%M %p IST")
        exact_line = f"- PENDING CALLBACK: {t}"
        if exact_line not in result:
            result = exact_line + "\n" + result

    if has_previous_calls:
        first_name = (lead.name or "Student").split()[0] if lead else "Student"
        result = (
            f"⚡ REPEAT CALL — {first_name} se pehle baat ho chuki hai. "
            f"Call shuru karte waqt zaroor mention karein: "
            f"'Namaste {first_name} ji, hum pehle bhi SSISM ke baare mein baat kar chuke hain.'\n"
            + result
        )

    return result


build_key_facts = build_call_context


def _build_raw(memory, convs, pending_cbs, lead: Optional[Lead] = None) -> str:
    lines: list[str] = []

    if lead and lead.name and not lead.name.startswith(_PLACEHOLDER_NAME_PREFIX):
        identity = f"- Student name: {lead.name}"
        if lead.city:
            identity += f" ({lead.city})"
        if lead.course_interest:
            identity += f" | Course interest: {lead.course_interest}"
        lines.append(identity)

    if pending_cbs:
        cb = pending_cbs[0]
        t  = cb.scheduled_at.astimezone(_IST).strftime("%d %B %I:%M %p IST")
        lines.append(f"- PENDING CALLBACK: {t}")

    if memory:
        ev = memory.extracted_data or {}
        if memory.latest_outcome:
            lines.append(f"- Last call outcome: {memory.latest_outcome}")
        if ev.get("disinterest_reason"):
            lines.append(f"- Disinterest reason: {ev['disinterest_reason']}")

    interactions: list[tuple[datetime, str]] = []
    pending_q:    Optional[tuple[datetime, str]] = None

    for conv in reversed(convs):
        if conv.channel == Channel.PHONE.value:
            msg = (conv.message or "").strip()
            if msg:
                interactions.append((conv.created_at, f"- Phone call: {msg[:300]}"))
            continue

        if conv.message:
            pending_q = (conv.created_at, conv.message.strip())
        if conv.agent_reply:
            reply_txt = conv.agent_reply.strip()
            if pending_q is not None:
                q_text = pending_q[1]
                interactions.append((
                    conv.created_at,
                    f'- WhatsApp Asked: "{q_text[:180]}" → Bot reply: "{reply_txt[:220]}"',
                ))
                pending_q = None
            else:
                interactions.append((
                    conv.created_at,
                    f'- WhatsApp Bot proactive: "{reply_txt[:220]}"',
                ))

    if pending_q is not None:
        interactions.append((pending_q[0], f'- WhatsApp Asked (no reply yet): "{pending_q[1][:120]}"'))

    interactions.sort(key=lambda x: x[0], reverse=True)
    lines.extend(line for _, line in interactions)
    return "\n".join(lines)


async def _summarise_with_groq(raw: str) -> Optional[str]:
    from .groq_service import GroqChatClient, GroqNotConfigured
    try:
        result = await GroqChatClient(timeout=8.0).complete(
            system_prompt=(
                "You are a CRM assistant for SSISM college admission team.\n"
                "Summarise the student interaction log into concise Hinglish agent notes under 700 characters and strictly under 90 words.\n\n"
                "STRICT OUTPUT FORMAT — bullet list only, descending chronological order (newest first):\n"
                "1. First bullet: student's name (and city if known) and course interest\n"
                "2. MANDATORY — PENDING CALLBACK bullet (if present): copy EXACT line `- PENDING CALLBACK: <time>` verbatim\n"
                "3. Last call outcome bullet (if any)\n"
                "4. WhatsApp conversation bullets: MUST include ALL Q&A pairs\n"
                "   Format: `- WhatsApp: Asked <topic> -> <reply gist>`\n"
                "5. Phone call bullets: `- Call: <topic> -> <outcome gist>`\n\n"
                "RULES:\n"
                "- WhatsApp history equally important as call history — do NOT skip\n"
                "- One bullet per topic. No preamble, no closing. Each bullet under 12 words.\n"
                "- Pending callback time MUST appear exactly as given.\n"
                "- Capture course interest, fees, scholarship, hostel, placement topics.\n"
                "- MANDATORY: Kabhi bhi 'Caller' ya 'Lead' shabd mat use karo. Student ke naam se address karo."
            ),
            messages=[{"role": "user", "content": raw}],
            max_tokens=450,
            temperature=0.1,
        )
        return result
    except GroqNotConfigured:
        log.debug("Groq not configured — using raw context")
        return None
    except Exception as exc:
        log.warning("Groq memory summary failed: %s", exc)
        return None
