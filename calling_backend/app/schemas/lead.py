from datetime import datetime
from typing import Annotated, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from ..models.lead import LeadStatus
from ..security import normalise_phone

PhoneStr = Annotated[str, Field(min_length=7, max_length=20)]


class LeadCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name:            str           = Field(min_length=1, max_length=200)
    phone:           PhoneStr
    address:         Optional[str] = Field(None, max_length=500)
    city:            Optional[str] = Field(None, max_length=100)
    course_interest: Optional[str] = Field(None, max_length=200)
    track:           Optional[str] = Field(None, max_length=50)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return normalise_phone(v)


class LeadUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name:            Optional[str]        = Field(None, min_length=1, max_length=200)
    address:         Optional[str]        = Field(None, max_length=500)
    city:            Optional[str]        = Field(None, max_length=100)
    course_interest: Optional[str]        = Field(None, max_length=200)
    status:          Optional[LeadStatus] = None
    do_not_call:     Optional[bool]       = None
    track:           Optional[str]        = Field(None, max_length=50)


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:              str
    name:            str
    phone:           str
    address:         Optional[str]
    city:            Optional[str]
    course_interest: Optional[str] = None
    status:          str
    do_not_call:     bool
    last_call_id:    Optional[str]
    last_call_at:    Optional[datetime]
    created_at:      datetime
    updated_at:      datetime
    track:             Optional[str] = None
    call_count:        int           = 0
    whatsapp_count:    int           = 0
    pending_callbacks: int           = 0
    memory_summary:    Optional[str] = None


class LeadDetail(LeadOut):
    latest_outcome:    Optional[str]      = None
    extracted_data:    dict               = {}
    next_action:       Optional[str]      = None
    memory_updated_at: Optional[datetime] = None


class LeadsListOut(BaseModel):
    leads:     list[LeadOut]
    total:     int
    page:      int
    page_size: int


class StatsOut(BaseModel):
    total_leads:        int
    calls_today:        int
    callbacks_due:      int
    callbacks_upcoming: int
    by_status:          dict[str, int]
