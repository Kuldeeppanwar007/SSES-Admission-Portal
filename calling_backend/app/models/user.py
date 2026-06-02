import enum
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


class UserRole(str, enum.Enum):
    ADMIN     = "admin"
    COUNSELOR = "counselor"


class Track(str, enum.Enum):
    KHATEGAON      = "khategaon"
    HARDA          = "harda"
    NEMAWAR        = "nemawar"
    KANNOD         = "kannod"
    SATWAS_KATAPHOD = "satwas_kataphod"
    GOPALPUR       = "gopalpur"
    BHERUNDA       = "bherunda"


TRACK_LABELS = {
    "khategaon":      "Khategaon",
    "harda":          "Harda",
    "nemawar":        "Nemawar",
    "kannod":         "Kannod",
    "satwas_kataphod": "Satwas-Kataphod",
    "gopalpur":       "Gopalpur",
    "bherunda":       "Bherunda",
}


@dataclass
class User:
    id:            str
    username:      str
    password_hash: str
    role:          str
    is_active:     bool
    created_at:    datetime
    updated_at:    datetime
    track:         Optional[str] = None
    full_name:     Optional[str] = None
