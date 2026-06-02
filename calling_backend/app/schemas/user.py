from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class UserLogin(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:         str
    username:   str
    role:       str
    track:      Optional[str]
    full_name:  Optional[str]
    is_active:  bool
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         UserOut


class UserCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    username:  str           = Field(min_length=1, max_length=100)
    password:  str           = Field(min_length=6)
    role:      str           = "counselor"
    track:     Optional[str] = None
    full_name: Optional[str] = Field(None, max_length=200)


class UserUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    password:  Optional[str] = Field(None, min_length=6)
    role:      Optional[str] = None
    track:     Optional[str] = None
    full_name: Optional[str] = Field(None, max_length=200)
    is_active: Optional[bool] = None


class ProfileUpdateSelf(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name:        Optional[str] = Field(None, max_length=200)
    current_password: Optional[str] = None
    new_password:     Optional[str] = Field(None, min_length=6)


class SeedRequest(BaseModel):
    secret:   str
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=6)
