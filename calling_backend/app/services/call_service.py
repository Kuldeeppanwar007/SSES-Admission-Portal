from datetime import datetime, timedelta, timezone

import httpx

from ..config import settings

_IST = timezone(timedelta(hours=5, minutes=30))


async def trigger_plivo_call(
    phone: str,
    lead_id: str,
    previous_memory: str = "",
    lead_name: str = "",
    callback_scheduled: str = "",
) -> dict:
    """
    Trigger the SSISM Plivo AI Agent Flow for an outbound call.
    Endpoint: agentflow.plivo.com
    """
    url = (
        f"https://agentflow.plivo.com/v1/account/{settings.plivo_auth_id}"
        f"/flow/{settings.plivo_flow_id}"
    )
    current_datetime_ist = datetime.now(_IST).strftime("%A, %d %B %Y %I:%M %p IST")

    hangup_url      = f"{settings.backend_url}/api/v1/webhook/hangup"
    call_status_url = f"{settings.backend_url}/api/v1/webhook/call-status"

    # Build a single context block embedded inside previous_memory.
    # Plivo AgentFlow does not support injecting trigger variables into AI
    # Instructions at runtime, so we pre-format all dynamic context here and
    # pass it as one string the AI node can read via its single {{previous_memory}} ref.
    context_header_lines = [
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "📋 STUDENT CONTEXT (system-provided)",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        f"Student Name      : {lead_name or 'Unknown'}",
        f"Current IST Time  : {current_datetime_ist}",
        f"Scheduled Callback: {callback_scheduled or 'None'}",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    ]
    if previous_memory.strip():
        context_header_lines += ["Previous Memory:", previous_memory.strip()]
    else:
        context_header_lines.append("Previous Memory: None (first call)")
    context_header_lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    full_context = "\n".join(context_header_lines)

    body = {
        "phone_number":         phone,
        "lead_id":              lead_id,
        "backend_url":          settings.backend_url,
        "hangup_url":           hangup_url,
        "call_status_url":      call_status_url,
        # All dynamic context pre-formatted into one variable
        "previous_memory":      full_context,
        # Keep individual fields too — used by Plivo flow routing conditions
        "lead_name":            lead_name,
        "current_datetime_ist": current_datetime_ist,
        "callback_scheduled":   callback_scheduled,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            url, json=body,
            auth=(settings.plivo_auth_id, settings.plivo_auth_token),
        )
        resp.raise_for_status()
        return resp.json()
