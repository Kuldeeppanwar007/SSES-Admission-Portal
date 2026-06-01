import re
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.lead import Lead, LeadStatus
from ..exceptions import DuplicatePhone, LeadNotFound


def _phone_variants(phone: str) -> list[str]:
    variants = [phone]
    if phone.startswith("+91") and len(phone) == 13:
        core = phone[3:]
        variants += ["91" + core, core, "0" + core]
    elif phone.startswith("91") and len(phone) == 12:
        variants += ["+" + phone, phone[2:], "0" + phone[2:]]
    elif len(phone) == 10 and phone.isdigit():
        variants += ["91" + phone, "+91" + phone, "0" + phone]
    elif phone.startswith("0") and len(phone) == 11:
        core = phone[1:]
        variants += [core, "91" + core, "+91" + core]
    return list(dict.fromkeys(variants))


async def _sses_student(db: AsyncIOMotorDatabase, phone: str) -> Optional[dict]:
    """READ-ONLY lookup from SSES students collection."""
    for variant in _phone_variants(phone):
        doc = await db.students.find_one({"mobileNo": variant})
        if doc:
            return doc
    return None


def _doc_to_lead(doc: dict) -> Lead:
    now = datetime.now(timezone.utc)
    return Lead(
        id              = str(doc["_id"]),
        name            = doc.get("name", ""),
        phone           = doc["phone"],
        address         = doc.get("address"),
        city            = doc.get("city"),
        course_interest = doc.get("course_interest"),
        status          = doc.get("status", LeadStatus.NEW.value if hasattr(LeadStatus, "NEW") else LeadStatus.PENDING.value),
        do_not_call     = doc.get("do_not_call", False),
        last_call_id    = doc.get("last_call_id"),
        last_call_at    = doc.get("last_call_at"),
        created_at      = doc.get("created_at", now),
        updated_at      = doc.get("updated_at", now),
        track           = doc.get("track"),
        student_id      = doc.get("student_id"),
    )


class LeadRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def get(self, lead_id: str) -> Lead:
        try:
            doc = await self.db.agent_leads.find_one({"_id": ObjectId(lead_id)})
        except Exception:
            raise LeadNotFound()
        if not doc:
            raise LeadNotFound()
        return _doc_to_lead(doc)

    async def get_by_phone(self, phone: str) -> Optional[Lead]:
        doc = await self.db.agent_leads.find_one({"phone": phone})
        return _doc_to_lead(doc) if doc else None

    async def create(
        self, *, name: str, phone: str,
        address: Optional[str] = None, city: Optional[str] = None,
        course_interest: Optional[str] = None, track: Optional[str] = None,
    ) -> Lead:
        student = await _sses_student(self.db, phone)
        if student:
            if not name or name == phone:
                name = student.get("name") or student.get("studentName") or name
            if not city:
                city = student.get("city") or student.get("address")
            if not track:
                track = student.get("track")
            if not course_interest:
                course_interest = student.get("course") or student.get("courseInterest")

        now = datetime.now(timezone.utc)
        doc = {
            "name":            name,
            "phone":           phone,
            "address":         address,
            "city":            city,
            "course_interest": course_interest,
            "status":          LeadStatus.PENDING.value,
            "do_not_call":     False,
            "last_call_id":    None,
            "last_call_at":    None,
            "created_at":      now,
            "updated_at":      now,
            "track":           track,
            "student_id":      str(student["_id"]) if student else None,
        }
        try:
            result = await self.db.agent_leads.insert_one(doc)
        except Exception as exc:
            if "duplicate" in str(exc).lower() or "E11000" in str(exc):
                raise DuplicatePhone(phone) from exc
            raise
        doc["_id"] = result.inserted_id
        return _doc_to_lead(doc)

    async def update(self, lead: Lead, **fields) -> Lead:
        now = datetime.now(timezone.utc)
        update: dict = {"updated_at": now}
        for k, v in fields.items():
            if v is not None or k in ("do_not_call", "last_call_id", "last_call_at"):
                update[k] = v
        await self.db.agent_leads.update_one(
            {"_id": ObjectId(lead.id)}, {"$set": update}
        )
        for k, v in update.items():
            if hasattr(lead, k):
                setattr(lead, k, v)
        return lead

    async def delete(self, lead_id: str) -> None:
        try:
            result = await self.db.agent_leads.delete_one({"_id": ObjectId(lead_id)})
        except Exception:
            raise LeadNotFound()
        if result.deleted_count == 0:
            raise LeadNotFound()

    async def get_detail(self, lead_id: str) -> dict:
        try:
            oid = ObjectId(lead_id)
        except Exception:
            raise LeadNotFound()
        doc = await self.db.agent_leads.find_one({"_id": oid})
        if not doc:
            raise LeadNotFound()

        call_count = await self.db.agent_conversations.count_documents(
            {"lead_id": lead_id, "channel": "phone"}
        )
        wa_count = await self.db.agent_conversations.count_documents(
            {"lead_id": lead_id, "channel": "whatsapp"}
        )
        cb_count = await self.db.agent_callbacks.count_documents(
            {"lead_id": lead_id, "status": "pending"}
        )
        mem = await self.db.agent_memory.find_one({"lead_id": lead_id})

        return {
            "id": str(doc["_id"]), "name": doc.get("name", ""), "phone": doc["phone"],
            "address": doc.get("address"), "city": doc.get("city"),
            "course_interest": doc.get("course_interest"),
            "status": doc.get("status", LeadStatus.PENDING.value),
            "do_not_call": doc.get("do_not_call", False),
            "last_call_id": doc.get("last_call_id"), "last_call_at": doc.get("last_call_at"),
            "created_at": doc.get("created_at"), "updated_at": doc.get("updated_at"),
            "track": doc.get("track"),
            "call_count": call_count, "whatsapp_count": wa_count, "pending_callbacks": cb_count,
            "memory_summary": mem.get("summary") if mem else None,
            "latest_outcome": mem.get("latest_outcome") if mem else None,
            "extracted_data": mem.get("extracted_data", {}) if mem else {},
            "next_action": mem.get("next_action") if mem else None,
            "memory_updated_at": mem.get("updated_at") if mem else None,
        }

    async def list_enriched(
        self, *, status: Optional[str] = None, search: Optional[str] = None,
        course_interest: Optional[str] = None, track: Optional[str] = None,
        offset: int = 0, limit: int = 50,
    ) -> tuple[list[dict], int]:
        query: dict = {}
        if status:
            query["status"] = status
        if search:
            pattern = re.compile(re.escape(search), re.IGNORECASE)
            query["$or"] = [{"name": pattern}, {"phone": pattern}]
        if course_interest:
            query["course_interest"] = re.compile(re.escape(course_interest), re.IGNORECASE)
        if track:
            query["track"] = track

        total = await self.db.agent_leads.count_documents(query)
        docs = await (
            self.db.agent_leads.find(query)
            .sort("created_at", -1)
            .skip(offset)
            .limit(limit)
            .to_list(limit)
        )

        results = []
        for doc in docs:
            lead_id = str(doc["_id"])
            call_count = await self.db.agent_conversations.count_documents(
                {"lead_id": lead_id, "channel": "phone"}
            )
            wa_count = await self.db.agent_conversations.count_documents(
                {"lead_id": lead_id, "channel": "whatsapp"}
            )
            cb_count = await self.db.agent_callbacks.count_documents(
                {"lead_id": lead_id, "status": "pending"}
            )
            mem = await self.db.agent_memory.find_one({"lead_id": lead_id})
            results.append({
                "id": lead_id, "name": doc.get("name", ""), "phone": doc["phone"],
                "address": doc.get("address"), "city": doc.get("city"),
                "course_interest": doc.get("course_interest"),
                "status": doc.get("status", LeadStatus.PENDING.value),
                "do_not_call": doc.get("do_not_call", False),
                "last_call_id": doc.get("last_call_id"), "last_call_at": doc.get("last_call_at"),
                "created_at": doc.get("created_at"), "updated_at": doc.get("updated_at"),
                "track": doc.get("track"),
                "call_count": call_count, "whatsapp_count": wa_count,
                "pending_callbacks": cb_count,
                "memory_summary": mem.get("summary") if mem else None,
            })
        return results, total

    async def stats(self, *, track: Optional[str] = None) -> dict:
        query: dict = {}
        if track:
            query["track"] = track

        pipeline = [
            {"$match": query},
            {"$group": {"_id": "$status", "cnt": {"$sum": 1}}},
        ]
        by_status: dict = {}
        async for row in self.db.agent_leads.aggregate(pipeline):
            by_status[row["_id"]] = row["cnt"]

        now = datetime.now(timezone.utc)
        today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        conv_query = {"channel": "phone", "created_at": {"$gte": today_start}}

        if track:
            pipeline2 = [
                {"$match": conv_query},
                {"$addFields": {"lead_oid": {"$toObjectId": "$lead_id"}}},
                {"$lookup": {"from": "agent_leads", "localField": "lead_oid", "foreignField": "_id", "as": "lead"}},
                {"$match": {"lead.track": track}},
                {"$count": "cnt"},
            ]
            rows = await self.db.agent_conversations.aggregate(pipeline2).to_list(1)
            calls_today = rows[0]["cnt"] if rows else 0
        else:
            calls_today = await self.db.agent_conversations.count_documents(conv_query)

        if track:
            pipeline3 = [
                {"$match": {"status": "pending", "scheduled_at": {"$lte": now}}},
                {"$addFields": {"lead_oid": {"$toObjectId": "$lead_id"}}},
                {"$lookup": {"from": "agent_leads", "localField": "lead_oid", "foreignField": "_id", "as": "lead"}},
                {"$match": {"lead.track": track}},
                {"$count": "cnt"},
            ]
            r1 = await self.db.agent_callbacks.aggregate(pipeline3).to_list(1)
            callbacks_due = r1[0]["cnt"] if r1 else 0

            pipeline4 = [
                {"$match": {"status": "pending", "scheduled_at": {"$gt": now}}},
                {"$addFields": {"lead_oid": {"$toObjectId": "$lead_id"}}},
                {"$lookup": {"from": "agent_leads", "localField": "lead_oid", "foreignField": "_id", "as": "lead"}},
                {"$match": {"lead.track": track}},
                {"$count": "cnt"},
            ]
            r2 = await self.db.agent_callbacks.aggregate(pipeline4).to_list(1)
            callbacks_upcoming = r2[0]["cnt"] if r2 else 0
        else:
            callbacks_due = await self.db.agent_callbacks.count_documents(
                {"status": "pending", "scheduled_at": {"$lte": now}}
            )
            callbacks_upcoming = await self.db.agent_callbacks.count_documents(
                {"status": "pending", "scheduled_at": {"$gt": now}}
            )

        return {
            "total_leads": sum(by_status.values()),
            "calls_today": calls_today,
            "callbacks_due": callbacks_due,
            "callbacks_upcoming": callbacks_upcoming,
            "by_status": by_status,
        }

    async def fetch_dormant_interested(self, *, dormant_since: datetime, limit: int = 20) -> list[Lead]:
        pending_cb_docs = await self.db.agent_callbacks.find(
            {"status": "pending"}, {"lead_id": 1}
        ).to_list(10000)
        excluded_lead_ids = {d["lead_id"] for d in pending_cb_docs}

        query: dict = {
            "status":       LeadStatus.INTERESTED.value,
            "do_not_call":  False,
            "last_call_at": {"$lte": dormant_since},
        }
        if excluded_lead_ids:
            valid_oids = [ObjectId(lid) for lid in excluded_lead_ids if ObjectId.is_valid(lid)]
            if valid_oids:
                query["_id"] = {"$nin": valid_oids}

        docs = await (
            self.db.agent_leads.find(query)
            .sort("last_call_at", 1)
            .limit(limit)
            .to_list(limit)
        )
        return [_doc_to_lead(d) for d in docs]
