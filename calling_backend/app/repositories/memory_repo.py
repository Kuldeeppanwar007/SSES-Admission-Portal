from datetime import datetime, timezone
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.memory import LeadMemory


def _doc_to_mem(doc: dict) -> LeadMemory:
    return LeadMemory(
        lead_id        = doc["lead_id"],
        updated_at     = doc.get("updated_at", datetime.now(timezone.utc)),
        summary        = doc.get("summary"),
        latest_outcome = doc.get("latest_outcome"),
        extracted_data = doc.get("extracted_data", {}),
        next_action    = doc.get("next_action"),
    )


class MemoryRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def get(self, lead_id: str) -> Optional[LeadMemory]:
        doc = await self.db.agent_memory.find_one({"lead_id": lead_id})
        return _doc_to_mem(doc) if doc else None

    async def upsert(
        self, lead_id: str, *, summary: Optional[str],
        latest_outcome: Optional[str], extracted_data: dict,
        next_action: Optional[str] = None,
    ) -> LeadMemory:
        now = datetime.now(timezone.utc)
        summary_trimmed = summary[:500] if summary else None
        doc = {
            "lead_id":        lead_id,
            "summary":        summary_trimmed,
            "latest_outcome": latest_outcome,
            "extracted_data": extracted_data,
            "next_action":    next_action,
            "updated_at":     now,
        }
        await self.db.agent_memory.update_one(
            {"lead_id": lead_id},
            {"$set": doc, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        return _doc_to_mem(doc)
