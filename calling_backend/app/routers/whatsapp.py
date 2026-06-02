import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from ..database import get_db
from ..schemas.webhook import WhatsAppInboundPayload

log    = logging.getLogger(__name__)
router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


async def _parse_body(request: Request) -> dict:
    ct = request.headers.get("content-type", "")
    if "application/json" in ct:
        try:
            return await request.json()
        except Exception:
            pass
    try:
        form = await request.form()
        return dict(form)
    except Exception:
        pass
    return {}


async def _run_whatsapp(payload: WhatsAppInboundPayload) -> None:
    from ..services.whatsapp_ai_service import WhatsAppAIService
    db = get_db()
    await WhatsAppAIService(db).handle_inbound(payload)


@router.post("/inbound")
async def whatsapp_inbound(request: Request, background: BackgroundTasks):
    data = await _parse_body(request)
    log.info(
        "WhatsApp inbound: from=%s msg=%.80s",
        data.get("From") or data.get("from"),
        data.get("Text") or data.get("Body") or data.get("text") or "",
    )
    payload = WhatsAppInboundPayload.from_raw(data)
    if not payload.text.strip():
        return {"status": "ignored", "reason": "empty message"}

    background.add_task(_run_whatsapp, payload)
    return {"status": "ok"}


@router.post("/send")
async def whatsapp_send(request: Request):
    from ..services.whatsapp_service import send_whatsapp
    data = await _parse_body(request)
    phone = data.get("phone") or data.get("to", "")
    text  = data.get("text") or data.get("message", "")
    if not phone or not text:
        raise HTTPException(status_code=422, detail="phone and text required")
    result = await send_whatsapp(phone, text)
    return {"status": "sent", "result": result}


@router.post("/status")
async def whatsapp_status(request: Request):
    data = await _parse_body(request)
    log.info(
        "WhatsApp status: MessageUUID=%s Status=%s",
        data.get("MessageUUID") or data.get("message_uuid"),
        data.get("Status") or data.get("status"),
    )
    return {"status": "ok"}
