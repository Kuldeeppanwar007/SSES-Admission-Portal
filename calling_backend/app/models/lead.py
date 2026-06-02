import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


class LeadStatus(str, enum.Enum):
    PENDING            = "pending"
    CALLING            = "calling"
    NOT_ANSWERED       = "not_answered"
    BUSY               = "busy"
    FAILED             = "failed"
    INTERESTED         = "interested"
    NOT_INTERESTED     = "not_interested"
    CALLBACK_SCHEDULED = "callback_scheduled"
    WRONG_NUMBER       = "wrong_number"
    DO_NOT_CALL        = "do_not_call"
    CONVERTED          = "converted"


@dataclass
class Lead:
    id:              str
    phone:           str
    name:            str
    status:          str
    do_not_call:     bool
    created_at:      datetime
    updated_at:      datetime
    track:             Optional[str]      = None
    course_interest:   Optional[str]      = None
    address:           Optional[str]      = None
    city:              Optional[str]      = None
    student_id:        Optional[str]      = None
    last_call_id:      Optional[str]      = None
    last_call_at:      Optional[datetime] = None
    call_count:        int                = 0
    whatsapp_count:    int                = 0
    pending_callbacks: int                = 0
    memory_summary:    Optional[str]      = None
    latest_outcome:    Optional[str]      = None
    extracted_data:    dict               = field(default_factory=dict)
    next_action:       Optional[str]      = None
    memory_updated_at: Optional[datetime] = None

    def is_callable(self) -> bool:
        return not self.do_not_call and self.status != LeadStatus.CALLING.value
