from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    mongodb_url:     str = "mongodb://localhost:27017"
    mongodb_db_name: str = "SSES-Admission-Portal"

    plivo_auth_id:      str = ""
    plivo_auth_token:   str = ""
    plivo_flow_id:      str = ""
    plivo_from_number:  str = ""
    plivo_whatsapp_src: str = ""

    validate_plivo_signature: bool = False
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    backend_url: str  = "http://localhost:8000"
    debug:       bool = False

    groq_api_key:  str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model:    str = "llama-3.3-70b-versatile"

    jwt_secret:       str = "change-me-in-production"
    jwt_algorithm:    str = "HS256"
    jwt_expire_hours: int = 8

    internal_api_key: str = "sses-internal-key-2024"

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, str) and value.strip().lower() in {"release", "prod", "production"}:
            return False
        return value

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
