from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator
import json


def _parse_jsonish(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            return value
    return value


def _plivo_object(data: dict) -> dict:
    nested = _parse_jsonish(data.get("data"))
    if not isinstance(nested, dict):
        return data
    obj = _parse_jsonish(nested.get("object"))
    return obj if isinstance(obj, dict) else data


def _event_data(data: dict) -> dict:
    obj   = _plivo_object(data)
    value = _parse_jsonish(obj.get("event_data") or data.get("event_data") or {})
    return value if isinstance(value, dict) else {}


def _first(*values: Any) -> Any:
    for value in values:
        if value not in (None, ""):
            return value
    return None


def _event_value(event_data: dict, *keys: str) -> Any:
    for key in keys:
        value = event_data.get(key)
        if value not in (None, ""):
            return value
    suffixes = tuple(f".{key}" for key in keys)
    for key, value in event_data.items():
        if key.endswith(suffixes) and value not in (None, ""):
            return value
    return None


def _extracted_variables(event_data: dict, data: dict) -> dict:
    raw = (
        data.get("extracted_variables")
        or data.get("ExtractedVariables")
        or data.get("variables")
        or {}
    )
    raw      = _parse_jsonish(raw)
    extracted = raw if isinstance(raw, dict) else {}

    for key in (
        "conversation_outcome", "interest_status", "availability_status",
        "summary_points", "callback_date", "callback_time", "callback_validity",
        "disinterest_reason", "voicemail_detected",
    ):
        value = _event_value(event_data, key)
        if value not in (None, ""):
            extracted[key] = value

    return extracted


class PlivoHangupPayload(BaseModel):
    call_uuid:    str            = Field(alias="CallUUID",    default="")
    phone_to:     str            = Field(alias="To",          default="")
    duration:     int            = Field(alias="Duration",    default=0)
    hangup_cause: str            = Field(alias="HangupCause", default="")
    call_status:  str            = Field(alias="CallStatus",  default="")
    lead_id:      Optional[str]  = Field(alias="lead_id",     default=None)
    extracted_variables: Any     = Field(default_factory=dict)

    model_config = {"populate_by_name": True}

    @field_validator("extracted_variables", mode="before")
    @classmethod
    def parse_extracted(cls, v: Any) -> dict:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return {}
        return v or {}

    @field_validator("duration", mode="before")
    @classmethod
    def coerce_int(cls, v: Any) -> int:
        try:
            return int(v)
        except (TypeError, ValueError):
            return 0

    @classmethod
    def from_raw(cls, data: dict) -> "PlivoHangupPayload":
        obj        = _plivo_object(data)
        event_data = _event_data(data)
        normalised = {
            "CallUUID": _first(
                data.get("CallUUID"), data.get("call_uuid"), obj.get("call_uuid"),
                _event_value(event_data, "Call Partner.uuid", "call_uuid"), "",
            ),
            "To": _first(
                data.get("To"), data.get("to"), data.get("phone_number"),
                _event_value(event_data, "Call Partner.to", "phone_number"), "",
            ),
            "Duration": _first(
                data.get("Duration"), data.get("duration"),
                _event_value(event_data, "call_duration"), 0,
            ),
            "HangupCause": _first(
                data.get("HangupCause"), data.get("hangup_cause"),
                _event_value(event_data, "hangup_source"), "",
            ),
            "CallStatus": _first(
                data.get("CallStatus"), data.get("call_status"),
                _event_value(event_data, "Call Partner.call_status", "call_status"), "",
            ),
            "lead_id": _first(
                data.get("lead_id"),
                _event_value(event_data, "Start.http.params.lead_id", "lead_id"),
            ),
            "extracted_variables": _extracted_variables(event_data, data),
        }
        return cls.model_validate(normalised)


class PlivoRecordingPayload(BaseModel):
    call_uuid:            str = Field(default="")
    recording_url:        str = Field(default="")
    transcription:        str = Field(default="")
    conversation_summary: str = Field(default="")

    @classmethod
    def from_raw(cls, data: dict) -> "PlivoRecordingPayload":
        obj        = _plivo_object(data)
        event_data = _event_data(data)
        return cls(
            call_uuid=_first(
                data.get("CallUUID"), data.get("call_uuid"), obj.get("call_uuid"),
                _event_value(event_data, "Call Partner.uuid", "call_uuid"), "",
            ),
            recording_url=_first(
                data.get("RecordUrl"), data.get("record_url"),
                data.get("recording_url"), _event_value(event_data, "recording_url"), "",
            ),
            transcription=_first(_event_value(event_data, "transcription"), ""),
            conversation_summary=_first(_event_value(event_data, "conversation_summary"), ""),
        )


class WhatsAppInboundPayload(BaseModel):
    from_number:  str
    text:         str
    message_uuid: str = ""

    @classmethod
    def from_raw(cls, data: dict) -> "WhatsAppInboundPayload":
        raw_from = data.get("From") or data.get("from", "")
        text = (
            data.get("Text") or data.get("Body")
            or data.get("text") or data.get("body", "")
        )
        return cls(
            from_number=raw_from.lstrip("+"),
            text=text,
            message_uuid=data.get("MessageUUID") or data.get("message_uuid", ""),
        )
