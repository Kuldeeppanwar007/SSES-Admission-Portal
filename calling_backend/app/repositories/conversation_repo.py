from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.conversation import Channel, Conversation, Direction


def _doc_to_conv(doc: dict) -> Conversation:
    return Conversation(
        id          = str(doc["_id"]),
        lead_id     = doc["lead_id"],
        channel     = doc["channel"],
        direction   = doc["direction"],
        created_at  = doc.get("created_at", datetime.now(timezone.utc)),
        message     = doc.get("message"),
        agent_reply = doc.get("agent_reply"),
        call_id     = doc.get("call_id"),
        meta        = doc.get("meta", {}),
    )


class ConversationRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def list_for_lead(self, lead_id: str, *, limit: int = 100) -> list[Conversation]:
        query = {"lead_id": lead_id}
        if ObjectId.is_valid(lead_id):
            query = {"$or": [{"lead_id": lead_id}, {"lead_id": ObjectId(lead_id)}]}
        docs = await self.db.agent_conversations.find(
            query
        ).sort("created_at", -1).limit(limit).to_list(limit)
        return [_doc_to_conv(d) for d in docs]

    async def find_by_call_id(self, call_id: str) -> Optional[Conversation]:
        doc = await self.db.agent_conversations.find_one(
            {"call_id": call_id, "channel": Channel.PHONE.value}
        )
        return _doc_to_conv(doc) if doc else None

    async def create_phone(self, lead_id: str, *, message: Optional[str] = None,
                            agent_reply: Optional[str] = None, call_id: Optional[str] = None,
                            meta: Optional[dict] = None) -> Conversation:
        now = datetime.now(timezone.utc)
        doc = {
            "lead_id":     lead_id,
            "channel":     Channel.PHONE.value,
            "direction":   Direction.SYSTEM.value,
            "message":     message,
            "agent_reply": agent_reply,
            "call_id":     call_id,
            "meta":        meta or {},
            "created_at":  now,
        }
        result = await self.db.agent_conversations.insert_one(doc)
        doc["_id"] = result.inserted_id
        return _doc_to_conv(doc)

    async def create_whatsapp(self, lead_id: str, *, direction: Direction,
                               message: Optional[str] = None, agent_reply: Optional[str] = None,
                               meta: Optional[dict] = None) -> Conversation:
        now = datetime.now(timezone.utc)
        doc = {
            "lead_id":     lead_id,
            "channel":     Channel.WHATSAPP.value,
            "direction":   direction.value,
            "message":     message,
            "agent_reply": agent_reply,
            "call_id":     None,
            "meta":        meta or {},
            "created_at":  now,
        }
        result = await self.db.agent_conversations.insert_one(doc)
        doc["_id"] = result.inserted_id
        return _doc_to_conv(doc)

    async def attach_recording(self, call_id: str, recording_url: str, *,
                                transcription: str = "", conversation_summary: str = "") -> None:
        updates: dict = {"meta.recording_url": recording_url}
        if transcription:
            updates["meta.transcript"] = transcription
        if conversation_summary:
            updates["meta.conversation_summary"] = conversation_summary
        await self.db.agent_conversations.update_one(
            {"call_id": call_id, "channel": Channel.PHONE.value},
            {"$set": updates},
        )
