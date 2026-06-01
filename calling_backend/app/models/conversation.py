import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


class Channel(str, enum.Enum):
    PHONE    = "phone"
    WHATSAPP = "whatsapp"


class Direction(str, enum.Enum):
    INBOUND  = "inbound"
    OUTBOUND = "outbound"
    SYSTEM   = "system"


@dataclass
class Conversation:
    id:          str
    lead_id:     str
    channel:     str
    direction:   str
    created_at:  datetime
    message:     Optional[str] = None
    agent_reply: Optional[str] = None
    call_id:     Optional[str] = None
    meta:        dict          = field(default_factory=dict)

    @property
    def metadata(self) -> dict:
        return self.meta
