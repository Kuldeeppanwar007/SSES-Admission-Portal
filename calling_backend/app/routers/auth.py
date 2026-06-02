import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..database import get_db
from ..models.callback import CallbackStatus, CallbackType
from ..models.user import User, UserRole
from ..repositories.callback_repo import CallbackRepository
from ..repositories.lead_repo import LeadRepository
from ..repositories.user_repo import UserRepository, verify_password
from ..schemas.user import ProfileUpdateSelf, SeedRequest, TokenOut, UserCreate, UserOut, UserUpdate, UserLogin
from ..security import create_access_token, decode_access_token

log = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_access_token(creds.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    user = await UserRepository(db).get(user_id_str)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


async def get_optional_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Optional[User]:
    if not creds:
        return None
    payload = decode_access_token(creds.credentials)
    if not payload:
        return None
    user_id_str = payload.get("sub")
    if not user_id_str:
        return None
    user = await UserRepository(db).get(user_id_str)
    if not user or not user.is_active:
        return None
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


@router.post("/login", response_model=TokenOut)
async def login(payload: UserLogin, db: AsyncIOMotorDatabase = Depends(get_db)):
    repo = UserRepository(db)
    user = await repo.get_by_username(payload.username)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id), "role": user.role, "track": user.track})
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: ProfileUpdateSelf,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    repo = UserRepository(db)
    if payload.new_password:
        if not payload.current_password:
            raise HTTPException(status_code=400, detail="current_password required to change password")
        if not verify_password(payload.current_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    fields: dict = {}
    if payload.full_name is not None:
        fields["full_name"] = payload.full_name
    if payload.new_password:
        fields["password"] = payload.new_password
    if fields:
        await repo.update(current_user, **fields)
    return UserOut.model_validate(current_user)


@router.get("/users", response_model=list[UserOut])
async def list_users(
    _admin: User = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    users = await UserRepository(db).list_all()
    return [UserOut.model_validate(u) for u in users]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    _admin: User = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    repo = UserRepository(db)
    existing = await repo.get_by_username(payload.username)
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    user = await repo.create(
        username=payload.username,
        password=payload.password,
        role=payload.role,
        track=payload.track,
        full_name=payload.full_name,
    )
    return UserOut.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    repo = UserRepository(db)
    user = await repo.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    fields = payload.model_dump(exclude_unset=True)
    await repo.update(user, **fields)
    return UserOut.model_validate(user)


@router.get("/notifications")
async def get_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Returns pending HUMAN callbacks (requested but not done) and
    upcoming HUMAN callbacks within the next 15 minutes.
    Filtered by current user's track (admins see all).
    """
    now  = datetime.now(timezone.utc)
    soon = now + timedelta(minutes=15)

    cb_repo   = CallbackRepository(db)
    lead_repo = LeadRepository(db)

    rows, _ = await cb_repo.list_enriched(
        status=CallbackStatus.PENDING.value,
        callback_type=CallbackType.HUMAN.value,
        limit=200,
    )

    notifications = []
    for row in rows:
        scheduled_at = row["scheduled_at"]
        if scheduled_at is None:
            continue

        if current_user.role != UserRole.ADMIN.value and current_user.track:
            if row.get("lead_track") != current_user.track:
                # Enrich with track if needed
                try:
                    lead = await lead_repo.get(row["lead_id"])
                    if lead.track != current_user.track:
                        continue
                except Exception:
                    continue

        if scheduled_at <= now:
            notif_type = "human_requested"
        elif scheduled_at <= soon:
            notif_type = "upcoming"
        else:
            continue

        notifications.append({
            "id": row["id"],
            "type": notif_type,
            "lead_name": row["lead_name"],
            "lead_phone": row["lead_phone"],
            "scheduled_at": scheduled_at.isoformat(),
            "notes": row["notes"],
        })

    return {"notifications": notifications}


@router.post("/seed", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def seed_admin(payload: SeedRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    """One-time endpoint to bootstrap the first admin user. Only works if no users exist."""
    if payload.secret != "ssism-setup-2024":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid secret")
    repo = UserRepository(db)
    count = await repo.count()
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Users already exist. Use admin panel to create more users.",
        )
    existing = await repo.get_by_username(payload.username)
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    user = await repo.create(
        username=payload.username,
        password=payload.password,
        role=UserRole.ADMIN.value,
        track=None,
        full_name="Administrator",
    )
    log.info("Seeded initial admin user: %s", user.username)
    return UserOut.model_validate(user)
