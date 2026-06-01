"""
WhatsApp AI service for SSISM admission counseling.
Handles inbound WhatsApp messages from prospective students.
"""
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..exceptions import DuplicatePhone
from ..models.callback import CallbackStatus, CallbackType
from ..models.conversation import Direction
from ..models.lead import Lead, LeadStatus
from ..repositories.callback_repo import CallbackRepository
from ..repositories.conversation_repo import ConversationRepository
from ..repositories.lead_repo import LeadRepository
from ..repositories.memory_repo import MemoryRepository
from ..schemas.webhook import WhatsAppInboundPayload
from ..security import normalise_phone
from .call_service import trigger_plivo_call
from .groq_service import GroqChatClient, GroqNotConfigured
from .knowledge_base import SSISM_KNOWLEDGE_BASE
from .whatsapp_service import send_whatsapp

log = logging.getLogger(__name__)

_PLACEHOLDER_NAME_PREFIX = "WhatsApp Lead"

CALLBACK_WINDOW_START_HOUR = 9
CALLBACK_WINDOW_END_HOUR   = 21

_NEW_LEAD_INTRO_TEMPLATE = (
    "Namaste! SSISM Admission Team ki taraf se shukriya. 🎓\n\n"
    "Aapki details share karein taaki hum better help kar sakein:\n\n"
    "Example:\n"
    "Name - Rahul Sharma\n"
    "City - Dewas\n"
    "Course - BCA"
)

_CALL_TERMS = (
    "call karo", "call karna", "call kar", "phone karo",
    "baat karni", "baat karna", "counselor se baat",
    "expert se baat", "abhi baat",
)

_OPT_OUT_TERMS = (
    "call mat", "mat call", "do not call", "don't call",
    "band karo", "stop", "not interested", "nahi chahiye",
)

_WA_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "schedule_callback",
            "description": (
                "Schedule a counselor callback for the student at a specific future IST datetime. "
                "ONLY call this when student EXPLICITLY requests scheduling — "
                "e.g. 'kal 3 baje callback karo', 'Sunday 10 baje slot do'. "
                "DO NOT call for questions about courses/fees/placements. "
                "Provide EXACT datetime in IST 24h format YYYY-MM-DD HH:MM."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "datetime_ist": {
                        "type": "string",
                        "description": "Callback datetime in IST 24h: YYYY-MM-DD HH:MM",
                    }
                },
                "required": ["datetime_ist"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "trigger_immediate_call",
            "description": (
                "Trigger a Plivo AI call to the student RIGHT NOW. "
                "Use ONLY when student wants a call THIS INSTANT — "
                "e.g. 'call karo', 'abhi call karo'. "
                "NEVER use if message has any time reference."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


class WhatsAppAIService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db     = db
        self.leads  = LeadRepository(db)
        self.convs  = ConversationRepository(db)
        self.cbs    = CallbackRepository(db)
        self.memory = MemoryRepository(db)
        self.groq   = GroqChatClient()

    async def handle_inbound(self, payload: WhatsAppInboundPayload) -> bool:
        phone            = _normalise_inbound_phone(payload.from_number)
        lead             = await self.leads.get_by_phone(phone)
        is_brand_new     = lead is None

        if not lead:
            lead = await self._create_placeholder_lead(phone)
            log.info("WhatsApp inbound created placeholder lead=%s phone=%s", lead.id, phone)

        prior_convs             = await self.convs.list_for_lead(lead.id, limit=1)
        had_prior_conversations = len(prior_convs) > 0

        await self.convs.create_whatsapp(
            lead.id, direction=Direction.INBOUND,
            message=payload.text, meta={"wa_message_id": payload.message_uuid},
        )

        text    = payload.text.strip()
        lowered = text.lower()

        if _is_opt_out(lowered):
            await self.leads.update(lead, status=LeadStatus.DO_NOT_CALL.value, do_not_call=True)
            reply = "Theek hai, hum aapko aage call nahi karenge. Shukriya."
            await self._send_and_record(lead, reply, trigger="whatsapp_opt_out")
            return True

        detail_updates = _extract_lead_details(text)
        if detail_updates:
            was_placeholder = _is_placeholder_name(lead.name or _PLACEHOLDER_NAME_PREFIX)
            await self._apply_detail_updates(lead, detail_updates)
            refreshed = await self.leads.get(lead.id)
            if refreshed:
                lead = refreshed
            name_just_set = (
                "name" in detail_updates
                and was_placeholder
                and not _is_placeholder_name(lead.name or _PLACEHOLDER_NAME_PREFIX)
            )
            if name_just_set:
                first_name  = lead.name.split()[0]
                course_part = ""
                if detail_updates.get("course_interest"):
                    course_part = f" Aapki {detail_updates['course_interest']} mein interest note kar li hai."
                ack = (
                    f"Shukriya {first_name} ji! 🎓 Aapki details save ho gayi hain.{course_part}\n\n"
                    "Counselor se seedha baat karni ho to 'call karo' likhein ya "
                    f"ssism.org par details dekh sakte hain. 🙏"
                )
                await self._send_and_record(lead, ack, trigger="whatsapp_details_ack")
                return True

        is_unidentified = is_brand_new or _is_placeholder_name(lead.name or _PLACEHOLDER_NAME_PREFIX)
        if is_unidentified and not had_prior_conversations and not detail_updates:
            await self._send_and_record(lead, _NEW_LEAD_INTRO_TEMPLATE, trigger="whatsapp_new_lead_intro")
            return True

        reply, trigger = await self._reply_with_tools(lead, text)
        await self._send_and_record(lead, reply, trigger=trigger)
        log.info("WhatsApp reply lead=%s phone=%s trigger=%s", lead.id, phone, trigger)
        return True

    async def _create_placeholder_lead(self, phone: str) -> Lead:
        try:
            return await self.leads.create(
                name=f"{_PLACEHOLDER_NAME_PREFIX} {phone[-4:]}", phone=phone,
            )
        except DuplicatePhone:
            lead = await self.leads.get_by_phone(phone)
            if lead:
                return lead
            raise

    async def _apply_detail_updates(self, lead: Lead, updates: dict[str, str]) -> None:
        fields: dict = {}
        if updates.get("name") and _is_placeholder_name(lead.name):
            fields["name"] = updates["name"][:200]
        if updates.get("address"):
            fields["address"] = updates["address"][:500]
        if updates.get("city"):
            fields["city"] = updates["city"][:100]
        if updates.get("course_interest"):
            fields["course_interest"] = updates["course_interest"][:200]
        if fields:
            await self.leads.update(lead, **fields)

    async def _reply_with_tools(self, lead: Lead, text: str) -> tuple[str, str]:
        from .memory_service import build_key_facts
        from .webhook_processor import _format_callback_datetime
        from zoneinfo import ZoneInfo
        IST     = ZoneInfo("Asia/Kolkata")
        now_ist = datetime.now(IST)

        pending_cbs = [cb for cb in await self.cbs.list_for_lead(lead.id)
                       if cb.status == CallbackStatus.PENDING.value]
        pending_cb_str = None
        if pending_cbs:
            cb_ist         = pending_cbs[0].scheduled_at.astimezone(IST)
            pending_cb_str = _format_callback_datetime(
                cb_ist.strftime("%Y-%m-%d"), cb_ist.strftime("%H:%M"), now_ist,
            )

        key_facts  = await build_key_facts(lead.id, self.db)
        sys_prompt = _system_prompt(lead, key_facts, now_ist, pending_cb_str)

        recent_wa = await self.convs.list_for_lead(lead.id, limit=12)
        messages  = _recent_messages(recent_wa)
        if not messages or messages[-1] != {"role": "user", "content": text}:
            messages.append({"role": "user", "content": text})

        try:
            text_reply, tool_calls = await self.groq.complete_with_tools(
                system_prompt=sys_prompt, messages=messages, tools=_WA_TOOLS,
            )
        except GroqNotConfigured:
            if _wants_call(text.lower()):
                return await self._trigger_call(lead), "whatsapp_call_request"
            return _fallback_reply(text), "whatsapp_fallback"
        except Exception as exc:
            log.error("Groq tool call failed lead=%s: %s", lead.id, exc)
            if _wants_call(text.lower()):
                return await self._trigger_call(lead), "whatsapp_call_request"
            return _fallback_reply(text), "whatsapp_fallback"

        if tool_calls:
            tc = tool_calls[0]
            if tc["name"] == "schedule_callback":
                reply = await self._execute_schedule(lead, tc["arguments"].get("datetime_ist", ""), IST)
                return reply, "whatsapp_callback_scheduled"
            if tc["name"] == "trigger_immediate_call":
                return await self._trigger_call(lead), "whatsapp_call_request"

        if text_reply:
            return text_reply, "whatsapp_llm_reply"
        return _fallback_reply(text), "whatsapp_llm_empty_fallback"

    async def _trigger_call(self, lead: Lead) -> str:
        if lead.do_not_call or lead.status == LeadStatus.DO_NOT_CALL.value:
            return "Aapka number do-not-call marked hai, isliye call trigger nahi kar sakte."
        if lead.status == LeadStatus.CALLING.value:
            return "Aapke liye call already in progress hai. Thoda wait kijiye."

        from .memory_service import build_call_context, get_pending_callback_str
        previous_memory = await build_call_context(lead.id, self.db)
        cb_str          = await get_pending_callback_str(lead.id, self.db)

        await self.leads.update(
            lead, status=LeadStatus.CALLING.value, last_call_at=datetime.now(timezone.utc),
        )
        await _fire_plivo_call(lead.id, lead.phone, previous_memory, lead.name or "", cb_str, self.db)
        log.info("WhatsApp requested call triggered lead=%s phone=%s", lead.id, lead.phone)
        return "Theek hai! SSISM counselor aapko abhi call kar raha hai — please phone zaroor uthayega. 🎓"

    async def _execute_schedule(self, lead: Lead, datetime_ist_str: str, IST) -> str:
        from .webhook_processor import _format_callback_datetime
        now_ist           = datetime.now(IST)
        scheduled_at_utc: Optional[datetime] = None
        parsed_dt_ist:    Optional[datetime] = None

        try:
            from dateutil import parser as dtparse
            dt = dtparse.parse(datetime_ist_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=IST)
            parsed_dt_ist = dt.astimezone(IST)
            if dt > now_ist:
                scheduled_at_utc = dt.astimezone(timezone.utc)
        except Exception as exc:
            log.warning("LLM datetime_ist parse failed '%s': %s", datetime_ist_str, exc)

        if parsed_dt_ist is not None and not (CALLBACK_WINDOW_START_HOUR <= parsed_dt_ist.hour < CALLBACK_WINDOW_END_HOUR):
            return (
                f"Counselor callback subah {CALLBACK_WINDOW_START_HOUR} baje se "
                f"raat {CALLBACK_WINDOW_END_HOUR} baje ke beech possible hai — "
                "kripya is range mein koi time batayein. 🙏"
            )

        if not scheduled_at_utc:
            existing = [cb for cb in await self.cbs.list_for_lead(lead.id)
                        if cb.status == CallbackStatus.PENDING.value]
            if existing:
                cb_ist = existing[0].scheduled_at.astimezone(IST)
                when   = _format_callback_datetime(
                    cb_ist.strftime("%Y-%m-%d"), cb_ist.strftime("%H:%M"), now_ist,
                )
                return (
                    f"Aapka counselor callback pehle se *{when}* ke liye scheduled hai. 📅 "
                    "Koi aur time chahiye to din aur samay ke saath batayein."
                )
            return "Kripya callback ka din aur samay clearly batayein — jaise 'kal subah 10 baje'. 😊"

        _cb, created = await self.cbs.upsert_pending(
            lead.id, scheduled_at=scheduled_at_utc,
            callback_type=CallbackType.HUMAN,
            notes="WhatsApp se schedule kiya",
        )
        if not created:
            _cb.notes = "WhatsApp se update kiya"
        action = "schedule kar diya" if created else "update kar diya"

        if lead.status != LeadStatus.CONVERTED.value:
            await self.leads.update(lead, status=LeadStatus.CALLBACK_SCHEDULED.value)

        scheduled_ist = scheduled_at_utc.astimezone(IST)
        when          = _format_callback_datetime(
            scheduled_ist.strftime("%Y-%m-%d"), scheduled_ist.strftime("%H:%M"), now_ist,
        )
        known_name = not _is_placeholder_name(lead.name or _PLACEHOLDER_NAME_PREFIX)
        name_part  = (" " + lead.name.split()[0] + " ji") if known_name else ""
        return (
            f"Ho gaya{name_part}! SSISM counselor ka callback *{when}* ke liye {action} hai. 📅 "
            "Woh tab call karenge — please pick up zaroor kariyega. 🙏"
        )

    async def _send_and_record(self, lead: Lead, reply: str, *, trigger: str) -> None:
        try:
            await send_whatsapp(lead.phone, reply)
        except Exception as sess_exc:
            log.warning("Session msg failed lead=%s: %s — template fallback", lead.id, sess_exc)
            from .whatsapp_service import send_whatsapp_template
            await send_whatsapp_template(lead.phone, reply[:500])
        await self.convs.create_whatsapp(
            lead.id, direction=Direction.OUTBOUND, agent_reply=reply,
            meta={"trigger": trigger},
        )


# ── module-level helpers ──────────────────────────────────────────────────────

async def _fire_plivo_call(
    lead_id: str, phone: str, previous_memory: str,
    lead_name: str = "", callback_scheduled: str = "", db=None,
) -> None:
    try:
        result = await trigger_plivo_call(
            phone, lead_id, previous_memory, lead_name, callback_scheduled,
        )
        run_id = result.get("run_uuid") or result.get("api_id", "")
        if run_id and db is not None:
            lead = await LeadRepository(db).get(lead_id)
            await LeadRepository(db).update(lead, last_call_id=run_id)
    except Exception as exc:
        log.error("WhatsApp requested Plivo call failed lead=%s: %s", lead_id, exc)
        if db is not None:
            try:
                lead = await LeadRepository(db).get(lead_id)
                if lead.status == LeadStatus.CALLING.value:
                    await LeadRepository(db).update(lead, status=LeadStatus.FAILED.value)
            except Exception:
                pass


def _normalise_inbound_phone(from_number: str) -> str:
    try:
        return normalise_phone("+" + from_number.lstrip("+"))
    except Exception:
        return "+" + from_number.lstrip("+")


def _is_placeholder_name(name: str) -> bool:
    return name.startswith(_PLACEHOLDER_NAME_PREFIX)


def _is_opt_out(lowered: str) -> bool:
    return any(term in lowered for term in _OPT_OUT_TERMS)


def _wants_call(lowered: str) -> bool:
    if _is_opt_out(lowered):
        return False
    return any(term in lowered for term in _CALL_TERMS)


def _extract_lead_details(text: str) -> dict[str, str]:
    updates: dict[str, str] = {}
    key_map = {
        "name": "name", "naam": "name",
        "city": "city", "shahar": "city", "shehar": "city",
        "address": "address", "pata": "address",
        "course": "course_interest", "course interest": "course_interest",
        "stream": "course_interest",
    }
    for line in text.splitlines():
        if "-" in line:
            parts = line.split("-", 1)
        elif ":" in line:
            parts = line.split(":", 1)
        else:
            continue
        if len(parts) != 2:
            continue
        raw_key, raw_value = parts
        key   = key_map.get(raw_key.strip().lower())
        value = raw_value.strip()
        if key and value:
            updates[key] = value

    if not updates:
        patterns = {
            "name":            r"(?:name|naam)\s*(?:is|hai|=|-)?\s*([A-Za-z .]{2,80})",
            "city":            r"(?:city|shahar|shehar)\s*(?:is|hai|=|-)?\s*([A-Za-z .]{2,80})",
            "address":         r"(?:address|pata)\s*(?:is|hai|=|-)?\s*(.{4,160})",
            "course_interest": r"(?:course|stream|subject)\s*(?:is|hai|=|-)?\s*([A-Za-z .()]{2,80})",
        }
        for key, pattern in patterns.items():
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                updates[key] = match.group(1).strip(" .,-")
    return updates


def _system_prompt(lead: Lead, key_facts: str, now_ist=None, pending_cb: str = "") -> str:
    from zoneinfo import ZoneInfo
    if now_ist is None:
        now_ist = datetime.now(ZoneInfo("Asia/Kolkata"))

    now_str    = now_ist.strftime("%A, %d %B %Y, %I:%M %p IST")
    known_name = not _is_placeholder_name(lead.name or _PLACEHOLDER_NAME_PREFIX)
    name       = lead.name if known_name else None

    name_instruction = (
        f"Student ka naam {name} hai — unhe directly naam se address karo (e.g. '{name} ji') aur warm tarike se baat karo."
        if known_name else
        "Student ka naam pata nahi — naturally poochho. "
        "Jab naam/city batayein to note kar lo."
    )

    course_note = f"Course interest: {lead.course_interest}." if lead.course_interest else ""

    status_note = {
        "callback_scheduled": "Counselor call schedule hai — student ko pick up karne ke liye encourage karo.",
        "interested":         "Student interested hai — counselor callback pe focus karo.",
        "not_interested":     "Student abhi interested nahi — respectfully respond karo.",
        "not_answered":       "Student ne call nahi uthaya — politely re-engage karo.",
    }.get(lead.status, "")

    pending_section = (
        f"DB MEIN PENDING CALLBACK: *{pending_cb}*\n"
        "Schedule ke baare mein SIRF yahi string batao — apne se date/time mat add karo."
    ) if pending_cb else "Abhi koi callback scheduled nahi hai."

    return f"""
Tu Riya hai — SSISM admission team ki WhatsApp assistant.
Aaj ka din aur samay: {now_str}
Jawab Hinglish/Hindi mein do. 2-3 chhote sentences max. Kabhi list ya bullet mat banao.

{name_instruction}
{course_note}
{f"STATUS: {status_note}" if status_note else ""}

{pending_section}

⚠️ TOOLS — SABSE IMPORTANT: Koi bhi tool SIRF tab use karo jab student ne EXPLICITLY call ya callback maanga ho.
Agar sawaal poochh raha hai → SIRF text reply do, koi tool NAHI.

GALAT examples (koi tool NAHI):
• "Hello" → greet karo
• "fees kitni hai" → fees info do
• "hostel hai" → hostel info do
• "BCA mein kya padhate hain" → course info do

SAHI examples (tool use karo):
• "kal 3 baje callback karo" → schedule_callback
• "abhi call karo" → trigger_immediate_call

TIME WINDOW: Callbacks sirf subah 9 se raat 9 (09:00-21:00 IST).
Aaj ka date for tool args: {now_ist.strftime('%Y-%m-%d')}

RULES:
- Exact fees kabhi mat batao — "counselor detail mein batayenge" kaho
- 100% placement guarantee mat do
- Aadhaar/PAN/bank kabhi mat maango
- Founder = Pranjal Dubey (NOT Sandeep Mahagaonkar)
- College = 2010 mein shuru hua (NOT 2013)

Key facts (calls + WhatsApp history):
{key_facts or "Pehli baar baat ho rahi hai."}

Knowledge base:
{SSISM_KNOWLEDGE_BASE}
""".strip()


def _recent_messages(conversations) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    for conv in reversed(conversations):
        if conv.message:
            messages.append({"role": "user", "content": conv.message})
        if conv.agent_reply:
            messages.append({"role": "assistant", "content": conv.agent_reply})
    return messages[-12:]


def _fallback_reply(text: str) -> str:
    lowered = text.lower()

    if any(w in lowered for w in ("thank", "shukriya", "dhanyawad")):
        return "Bahut shukriya! 🙏 SSISM se judi koi bhi query ho to batayein. 😊"

    if any(w in lowered for w in ("hello", "namaste", "hii", "helo")) or re.search(r"\bhi\b", lowered):
        return "Namaste! 🎓 SSISM admission ke baare mein kuch poochhna ho to batayein. Counselor se baat karni ho to 'call karo' likhein."

    if any(w in lowered for w in ("fees", "fee", "kitna lagta", "kitna lagega", "paisa")):
        return "Fees course ke hisaab se alag hoti hai. Exact fees counselor detail mein batayenge — unse baat karni ho to 'call karo' likhein. 🙏"

    if any(w in lowered for w in ("placement", "job", "naukri", "company")):
        return "SSISM ke IT batch 2021-22 mein sabhi students placed hue, 1.5–3 LPA. Physics Wallah mein 35+ students, 5 LPA. Biology (BEG) students teaching, pathology lab, hospital roles mein jaate hain. Company guarantee nahi de sakte, lekin track record accha hai."

    if any(w in lowered for w in ("hostel", "accommodation", "rehna")):
        return "Haan, boys aur girls ke liye alag hostel available hai, separate warden ke saath. Mess mein veg/non-veg dono options hain. 🏠"

    if any(w in lowered for w in ("scholarship", "free", "muft")):
        return "SSISM mein SNS (girls) aur SVS (boys) scholarship hai — deserving students ko poori tarah free education milti hai. Written exam + interview + home visit se selection hota hai. 🎓"

    if any(w in lowered for w in ("course", "bca", "bba", "mba", "btech", "b.tech", "computer", "biotechnology")):
        return "SSISM mein BCA, B.Sc CS, BBA, B.Com, MBA, Biotechnology, MSW aur SSEC mein B.Tech CS available hai. Kaunsa course aapko suitable lagta hai?"

    if any(w in lowered for w in ("admission", "join", "kaise kare", "process")):
        return "Admission process simple hai — counseling, document verification, confirmation. Regular courses mein koi entrance exam nahi. B.Tech ke liye JEE preferred. 📝"

    return (
        "Aapka sawaal samajh gaya — is detail ke liye SSISM counselor better help karenge. "
        "Call chahiye to 'call karo' likh dijiye. 🎓 ssism.org"
    )
