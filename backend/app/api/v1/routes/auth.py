from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from prisma.models import User
from pydantic import BaseModel, ConfigDict, EmailStr

from app.api.deps import get_current_user, get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.db.repositories.user_repo import UserRepository
from prisma import Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str | None
    avatar_url: str | None
    created_at: datetime


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: Prisma = Depends(get_db)) -> TokenResponse:
    repo = UserRepository(db)
    existing = await repo.get_by_email(body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = await repo.create(
        email=body.email,
        password=body.password,
        full_name=body.full_name,
    )
    logger.info("user_registered", user_id=user.id, email=user.email)
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: Prisma = Depends(get_db)) -> TokenResponse:
    repo = UserRepository(db)
    user = await repo.get_by_email(body.email)
    if user is None or not verify_password(body.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    logger.info("user_login", user_id=user.id)
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(body: RefreshRequest, db: Prisma = Depends(get_db)) -> AccessTokenResponse:
    try:
        payload = decode_token(body.refresh_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not a refresh token",
        )
    user_id: str = payload["sub"]
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return AccessTokenResponse(access_token=create_access_token(user_id))


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.fullName,
        avatar_url=current_user.avatarUrl,
        created_at=current_user.createdAt,
    )


class UserSearchResult(BaseModel):
    id: str
    email: str
    full_name: str | None


@router.get("/users/search", response_model=list[UserSearchResult])
async def search_users(
    q: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserSearchResult]:
    """Search for users by email prefix (for team invite). Returns up to 10 matches, excluding self."""
    if len(q) < 2:
        return []
    users = await db.user.find_many(
        where={"email": {"contains": q, "mode": "insensitive"}, "id": {"not": current_user.id}},
        take=10,
    )
    return [UserSearchResult(id=u.id, email=u.email, full_name=u.fullName) for u in users]

