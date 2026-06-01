from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class LeadMemory:
    lead_id:        str
    updated_at:     datetime
    summary:        Optional[str] = None
    latest_outcome: Optional[str] = None
    extracted_data: dict          = field(default_factory=dict)
    next_action:    Optional[str] = None
