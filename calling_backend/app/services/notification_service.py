import logging
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

log = logging.getLogger(__name__)

async def create_incharge_notification(
    db: AsyncIOMotorDatabase,
    track: Optional[str],
    title: str,
    message: str,
    student_id_str: Optional[str] = None
) -> None:
    try:
        # Query active admins, and track incharges if a track is specified
        or_conditions = [{"role": "admin"}]
        if track:
            or_conditions.append({"track": track, "role": "track_incharge"})
            
        query = {
            "isActive": True,
            "$or": or_conditions
        }
        
        users_to_notify = await db.users.find(query).to_list(None)
        
        if not users_to_notify:
            log.info("No active users (admin/incharge) found to notify.")
            return
            
        now = datetime.now(timezone.utc)
        for user in users_to_notify:
            doc = {
                "user": user["_id"],  # ObjectId in MongoDB
                "title": title,
                "message": message,
                "type": "general",
                "student": ObjectId(student_id_str) if student_id_str else None,
                "isRead": False,
                "createdAt": now,
                "updatedAt": now
            }
            await db.notifications.insert_one(doc)
            log.info("Created notification for %s (%s): %s", user.get("name"), user.get("role"), title)
    except Exception as e:
        log.error("Failed to create notifications: %s", e)
