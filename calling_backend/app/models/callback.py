import enum
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


class CallbackType(str, enum.Enum):
    AGENT = "agent"
    HUMAN = "human"


class CallbackStatus(str, enum.Enum):
    PENDING   = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED    = "failed"


@dataclass
class CallbackSchedule:
    id:                str
    lead_id:           str
    callback_type:     str
    scheduled_at:      datetime
    status:            str
    created_at:        datetime
    updated_at:        datetime
    notes:             Optional[str] = None
    triggered_call_id: Optional[str] = None
    pre_nudge_sent:    bool          = False
