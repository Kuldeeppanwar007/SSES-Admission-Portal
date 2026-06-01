import hashlib
import hmac
import base64
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Request
from jose import JWTError, jwt

from .config import settings

log = logging.getLogger(__name__)


def create_access_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours)
    payload["exp"] = expire
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None


def _compute_signature(body: bytes) -> str:
    key = settings.plivo_auth_token.encode()
    sig = hmac.new(key, body, hashlib.sha256).digest()
    return base64.b64encode(sig).decode()


async def verify_plivo_webhook(request: Request) -> None:
    if not settings.validate_plivo_signature:
        return
    body     = await request.body()
    expected = _compute_signature(body)
    received = (
        request.headers.get("X-Plivo-Signature-V3")
        or request.headers.get("X-Plivo-Signature")
        or ""
    )
    if not hmac.compare_digest(expected, received):
        from fastapi import HTTPException, status
        log.warning("Plivo webhook signature mismatch")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")


def normalise_phone(raw: str) -> str:
    import phonenumbers
    from .exceptions import InvalidPhoneNumber
    raw = raw.strip()
    try:
        parsed = phonenumbers.parse(raw, "IN")
        if not phonenumbers.is_valid_number(parsed):
            raise InvalidPhoneNumber(raw)
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except phonenumbers.NumberParseException:
        raise InvalidPhoneNumber(raw)



