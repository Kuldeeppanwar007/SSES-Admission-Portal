from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.callback import CallbackSchedule, CallbackStatus, CallbackType


def _doc_to_cb(doc: dict) -> CallbackSchedule:
    now = datetime.now(timezone.utc)
    return CallbackSchedule(
        id                = str(doc["_id"]),
        lead_id           = doc["lead_id"],
        callback_type     = doc.get("callback_type", CallbackType.AGENT.value),
        scheduled_at      = doc["scheduled_at"],
        status            = doc.get("status", CallbackStatus.PENDING.value),
        notes             = doc.get("notes"),
        triggered_call_id = doc.get("triggered_call_id"),
        pre_nudge_sent    = doc.get("pre_nudge_sent", False),
        created_at        = doc.get("created_at", now),
        updated_at        = doc.get("updated_at", now),
    )


class CallbackRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def get(self, callback_id: str) -> Optional[CallbackSchedule]:
        try:
            doc = await self.db.agent_callbacks.find_one({"_id": ObjectId(callback_id)})
        except Exception:
            return None
        return _doc_to_cb(doc) if doc else None

    async def list_enriched(
        self, *, status: Optional[str] = None, callback_type: Optional[str] = None,
        offset: int = 0, limit: int = 50,
    ) -> tuple[list[dict], int]:
        query: dict = {}
        if status:
            query["status"] = status
        if callback_type:
            query["callback_type"] = callback_type

        total = await self.db.agent_callbacks.count_documents(query)
        docs = await (
            self.db.agent_callbacks.find(query)
            .sort("scheduled_at", 1)
            .skip(offset)
            .limit(limit)
            .to_list(limit)
        )

        results = []
        for doc in docs:
            lead_id = doc["lead_id"]
            lead_doc = None
            if ObjectId.is_valid(lead_id):
                lead_doc = await self.db.agent_leads.find_one({"_id": ObjectId(lead_id)})
            results.append({
                "id": str(doc["_id"]), "lead_id": lead_id,
                "callback_type": doc.get("callback_type"),
                "scheduled_at": doc.get("scheduled_at"), "status": doc.get("status"),
                "notes": doc.get("notes"), "triggered_call_id": doc.get("triggered_call_id"),
                "created_at": doc.get("created_at"), "updated_at": doc.get("updated_at"),
                "lead_name":   lead_doc.get("name")   if lead_doc else None,
                "lead_phone":  lead_doc.get("phone")  if lead_doc else None,
                "lead_status": lead_doc.get("status") if lead_doc else None,
            })
        return results, total

    async def create(
        self, lead_id: str, *, callback_type: CallbackType = CallbackType.AGENT,
        scheduled_at: datetime, notes: Optional[str] = None,
    ) -> CallbackSchedule:
        now = datetime.now(timezone.utc)
        doc = {
            "lead_id":           lead_id,
            "callback_type":     callback_type.value,
            "scheduled_at":      scheduled_at,
            "status":            CallbackStatus.PENDING.value,
            "notes":             notes,
            "triggered_call_id": None,
            "pre_nudge_sent":    False,
            "created_at":        now,
            "updated_at":        now,
        }
        result = await self.db.agent_callbacks.insert_one(doc)
        doc["_id"] = result.inserted_id
        return _doc_to_cb(doc)

    async def upsert_pending(
        self, lead_id: str, *, scheduled_at: datetime,
        callback_type: CallbackType = CallbackType.HUMAN, notes: Optional[str] = None,
    ) -> tuple[CallbackSchedule, bool]:
        existing_doc = await self.db.agent_callbacks.find_one(
            {"lead_id": lead_id, "status": CallbackStatus.PENDING.value},
            sort=[("scheduled_at", -1)],
        )
        now = datetime.now(timezone.utc)
        if existing_doc is not None:
            update: dict = {
                "scheduled_at":   scheduled_at,
                "callback_type":  callback_type.value,
                "pre_nudge_sent": False,
                "updated_at":     now,
            }
            if notes is not None:
                update["notes"] = notes
            await self.db.agent_callbacks.update_one(
                {"_id": existing_doc["_id"]}, {"$set": update}
            )
            existing_doc.update(update)
            return _doc_to_cb(existing_doc), False

        doc = {
            "lead_id":           lead_id,
            "callback_type":     callback_type.value,
            "scheduled_at":      scheduled_at,
            "status":            CallbackStatus.PENDING.value,
            "notes":             notes,
            "triggered_call_id": None,
            "pre_nudge_sent":    False,
            "created_at":        now,
            "updated_at":        now,
        }
        result = await self.db.agent_callbacks.insert_one(doc)
        doc["_id"] = result.inserted_id
        return _doc_to_cb(doc), True

    async def update(self, cb: CallbackSchedule, **fields) -> CallbackSchedule:
        now = datetime.now(timezone.utc)
        update: dict = {"updated_at": now}
        for k, v in fields.items():
            if v is not None:
                update[k] = v.value if hasattr(v, "value") else v
        await self.db.agent_callbacks.update_one(
            {"_id": ObjectId(cb.id)}, {"$set": update}
        )
        for k, v in update.items():
            if hasattr(cb, k):
                setattr(cb, k, v)
        return cb

    async def list_all(self) -> list[CallbackSchedule]:
        docs = await self.db.agent_callbacks.find({}).sort("scheduled_at", -1).to_list(500)
        return [_doc_to_cb(d) for d in docs]

    async def delete(self, callback_id: str) -> None:
        try:
            await self.db.agent_callbacks.delete_one({"_id": ObjectId(callback_id)})
        except Exception:
            pass

    async def list_for_lead(self, lead_id: str) -> list[CallbackSchedule]:
        query = {"lead_id": lead_id}
        if ObjectId.is_valid(lead_id):
            query = {"$or": [{"lead_id": lead_id}, {"lead_id": ObjectId(lead_id)}]}
        docs = await (
            self.db.agent_callbacks.find(query)
            .sort("scheduled_at", -1)
            .to_list(100)
        )
        return [_doc_to_cb(d) for d in docs]

    async def fetch_due(self, *, limit: int = 10) -> list[CallbackSchedule]:
        now = datetime.now(timezone.utc)
        docs = await (
            self.db.agent_callbacks.find({
                "status":        CallbackStatus.PENDING.value,
                "callback_type": CallbackType.AGENT.value,
                "scheduled_at":  {"$lte": now},
            })
            .sort("scheduled_at", 1)
            .limit(limit)
            .to_list(limit)
        )
        return [_doc_to_cb(d) for d in docs]

    async def fetch_pre_nudge_due(
        self, *, window_start: datetime, window_end: datetime, limit: int = 20,
    ) -> list[CallbackSchedule]:
        docs = await (
            self.db.agent_callbacks.find({
                "status":         CallbackStatus.PENDING.value,
                "callback_type":  CallbackType.HUMAN.value,
                "pre_nudge_sent": False,
                "scheduled_at":   {"$gte": window_start, "$lte": window_end},
            })
            .sort("scheduled_at", 1)
            .limit(limit)
            .to_list(limit)
        )
        return [_doc_to_cb(d) for d in docs]
