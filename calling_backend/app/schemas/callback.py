from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from ..models.callback import CallbackStatus, CallbackType


class CallbackCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    lead_id:       str
    callback_type: CallbackType  = CallbackType.AGENT
    scheduled_at:  datetime
    notes:         Optional[str] = Field(None, max_length=500)


class CallbackUpdate(BaseModel):
    status:       Optional[CallbackStatus] = None
    scheduled_at: Optional[datetime]       = None
    notes:        Optional[str]            = Field(None, max_length=500)


class CallbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                str
    lead_id:           str
    callback_type:     str
    scheduled_at:      datetime
    status:            str
    notes:             Optional[str]
    triggered_call_id: Optional[str]
    created_at:        datetime
    updated_at:        datetime
    lead_name:   Optional[str] = None
    lead_phone:  Optional[str] = None
    lead_status: Optional[str] = None


class CallbacksListOut(BaseModel):
    callbacks: list[CallbackOut]
    total:     int
