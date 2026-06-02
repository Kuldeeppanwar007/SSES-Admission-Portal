import logging

from fastapi import APIRouter, BackgroundTasks, Request

from ..database import get_db
from ..schemas.webhook import PlivoHangupPayload, PlivoRecordingPayload

log    = logging.getLogger(__name__)
router = APIRouter(prefix="/webhook", tags=["webhook"])


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


async def _run_hangup(payload: PlivoHangupPayload) -> None:
    from ..services.webhook_processor import WebhookProcessor
    db = get_db()
    await WebhookProcessor(db).process_hangup(payload)


async def _run_recording(payload: PlivoRecordingPayload) -> None:
    from ..services.webhook_processor import WebhookProcessor
    db = get_db()
    await WebhookProcessor(db).process_recording(
        payload.call_uuid,
        payload.recording_url,
        transcription=payload.transcription,
        conversation_summary=payload.conversation_summary,
    )


@router.post("/hangup")
async def hangup_webhook(request: Request):
    data    = await _parse_body(request)
    log.info("Hangup webhook: %s", {k: v for k, v in data.items() if k != "extracted_variables"})
    payload = PlivoHangupPayload.from_raw(data)
    await _run_hangup(payload)
    return {"status": "ok"}


@router.post("/recording")
async def recording_webhook(request: Request):
    data    = await _parse_body(request)
    log.info("Recording webhook: call_uuid=%s", data.get("CallUUID") or data.get("call_uuid"))
    payload = PlivoRecordingPayload.from_raw(data)
    await _run_recording(payload)
    return {"status": "ok"}


@router.post("/call-status")
async def call_status_webhook(request: Request):
    data   = await _parse_body(request)
    status = data.get("CallStatus") or data.get("call_status", "")
    uuid   = data.get("CallUUID") or data.get("call_uuid", "")
    log.info("Call-status: status=%s uuid=%s raw_keys=%s", status, uuid, list(data.keys()))

    if status.lower() in ("completed", "failed", "no-answer", "no_answer", "busy"):
        payload = PlivoHangupPayload.from_raw(data)
        await _run_hangup(payload)

    return {"status": "ok"}
