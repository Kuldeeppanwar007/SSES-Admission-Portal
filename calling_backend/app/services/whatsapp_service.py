import logging

import httpx

from ..config import settings

log = logging.getLogger(__name__)

TMPL_SSISM_ADMISSION = "swiggy_onboarding"  # update with your approved template name


def _plivo_url() -> str:
    return f"https://api.plivo.com/v1/Account/{settings.plivo_auth_id}/Message/"


async def send_whatsapp(to: str, text: str) -> dict:
    """Send a WhatsApp session message (within 24-h user-initiated window)."""
    dst  = to.lstrip("+")
    body = {
        "src":  settings.plivo_whatsapp_src,
        "dst":  dst,
        "type": "whatsapp",
        "text": text,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            _plivo_url(), json=body,
            auth=(settings.plivo_auth_id, settings.plivo_auth_token),
        )
        if resp.status_code not in (200, 201, 202):
            log.error("Plivo WA session error %d → %s | dst=%s", resp.status_code, resp.text[:400], dst)
            resp.raise_for_status()
        return resp.json()


async def send_whatsapp_template(to: str, content: str) -> dict:
    """
    Send WhatsApp template message.
    IMPORTANT: content must be plain text only — NO URLs.
    URLs injected into {{1}} cause Meta delivery failures.
    Send URLs separately via send_whatsapp() session message.
    """
    dst = to.lstrip("+")

    # Primary format: language as object {"code": "hi"}
    body_primary = {
        "src":  settings.plivo_whatsapp_src,
        "dst":  dst,
        "type": "whatsapp",
        "template": {
            "name":     TMPL_SSISM_ADMISSION,
            "language": {"code": "hi"},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": content}],
                }
            ],
        },
    }

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.post(
                _plivo_url(), json=body_primary,
                auth=(settings.plivo_auth_id, settings.plivo_auth_token),
            )
            if resp.status_code not in (200, 201, 202):
                log.warning(
                    "Plivo WA template primary failed %d → %s | trying fallback",
                    resp.status_code, resp.text[:400],
                )
                resp.raise_for_status()
            return resp.json()
        except Exception:
            # Fallback: flat string language "hi"
            body_fallback = {
                "src":  settings.plivo_whatsapp_src,
                "dst":  dst,
                "type": "whatsapp",
                "template": {
                    "name":     TMPL_SSISM_ADMISSION,
                    "language": "hi",
                    "components": [
                        {
                            "type": "body",
                            "parameters": [{"type": "text", "text": content}],
                        }
                    ],
                },
            }
            resp_fb = await client.post(
                _plivo_url(), json=body_fallback,
                auth=(settings.plivo_auth_id, settings.plivo_auth_token),
            )
            if resp_fb.status_code not in (200, 201, 202):
                log.error(
                    "Plivo WA template fallback also failed %d → %s | dst=%s",
                    resp_fb.status_code, resp_fb.text[:400], dst,
                )
                resp_fb.raise_for_status()
            return resp_fb.json()
