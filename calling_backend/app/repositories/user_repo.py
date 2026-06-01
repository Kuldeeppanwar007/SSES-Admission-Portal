import hashlib
import hmac
import os
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.user import User, UserRole

_ITERATIONS = 260_000


def hash_password(plain: str) -> str:
    salt = os.urandom(32)
    key  = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, _ITERATIONS)
    return (salt + key).hex()


def verify_password(plain: str, stored: str) -> bool:
    try:
        raw   = bytes.fromhex(stored)
        salt  = raw[:32]
        key   = raw[32:]
        check = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, _ITERATIONS)
        return hmac.compare_digest(key, check)
    except Exception:
        return False


def _doc_to_user(doc: dict) -> User:
    now = datetime.now(timezone.utc)
    return User(
        id            = str(doc["_id"]),
        username      = doc["username"],
        password_hash = doc["password_hash"],
        role          = doc.get("role", UserRole.COUNSELOR.value),
        track         = doc.get("track"),
        full_name     = doc.get("full_name"),
        is_active     = doc.get("is_active", True),
        created_at    = doc.get("created_at", now),
        updated_at    = doc.get("updated_at", now),
    )


class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def get(self, user_id: str) -> Optional[User]:
        try:
            doc = await self.db.agent_users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return None
        return _doc_to_user(doc) if doc else None

    async def get_by_username(self, username: str) -> Optional[User]:
        doc = await self.db.agent_users.find_one({"username": username})
        return _doc_to_user(doc) if doc else None

    async def list_all(self) -> list[User]:
        docs = await self.db.agent_users.find({}).sort("created_at", -1).to_list(500)
        return [_doc_to_user(d) for d in docs]

    async def count(self) -> int:
        return await self.db.agent_users.count_documents({})

    async def create(self, *, username: str, password: str,
                     role: str = UserRole.COUNSELOR.value,
                     track: Optional[str] = None,
                     full_name: Optional[str] = None) -> User:
        now = datetime.now(timezone.utc)
        doc = {
            "username":      username,
            "password_hash": hash_password(password),
            "role":          role,
            "track":         track,
            "full_name":     full_name,
            "is_active":     True,
            "created_at":    now,
            "updated_at":    now,
        }
        result = await self.db.agent_users.insert_one(doc)
        doc["_id"] = result.inserted_id
        return _doc_to_user(doc)

    async def update(self, user: User, **fields) -> User:
        now    = datetime.now(timezone.utc)
        update = {"updated_at": now}
        if "password" in fields and fields["password"]:
            update["password_hash"] = hash_password(fields.pop("password"))
        for k, v in fields.items():
            if v is not None or k == "is_active":
                update[k] = v
        await self.db.agent_users.update_one(
            {"_id": ObjectId(user.id)}, {"$set": update}
        )
        for k, v in update.items():
            if hasattr(user, k):
                setattr(user, k, v)
        user.updated_at = now
        return user
