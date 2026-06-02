from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from .config import settings

_client: AsyncIOMotorClient = None
_db: AsyncIOMotorDatabase   = None


def get_db() -> AsyncIOMotorDatabase:
    return _db


async def init_db() -> None:
    global _client, _db
    _client = AsyncIOMotorClient(settings.mongodb_url)
    _db     = _client[settings.mongodb_db_name]

    await _db.agent_leads.create_index("phone", unique=True)
    await _db.agent_conversations.create_index([("lead_id", 1), ("created_at", -1)])
    await _db.agent_conversations.create_index("call_id", sparse=True)
    await _db.agent_callbacks.create_index([("lead_id", 1), ("status", 1)])
    await _db.agent_callbacks.create_index([("status", 1), ("scheduled_at", 1)])
    await _db.agent_memory.create_index("lead_id", unique=True)
    await _db.agent_users.create_index("username", unique=True)
    await _db.students.create_index("mobileNo")


async def close_db() -> None:
    global _client
    if _client:
        _client.close()
