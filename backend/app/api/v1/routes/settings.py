import hashlib
import secrets
from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from prisma.models import User
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db
from app.core.security import hash_password, verify_password
from prisma import Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    avatar_url: str | None
    created_at: datetime


class PreferencesUpdate(BaseModel):
    default_llm_provider: str | None = None
    default_export_format: str | None = None
    email_analysis_complete: bool | None = None
    email_batch_done: bool | None = None
    email_deadline_reminder: bool | None = None


class PreferencesResponse(BaseModel):
    default_llm_provider: str
    default_export_format: str
    email_analysis_complete: bool
    email_batch_done: bool
    email_deadline_reminder: bool


class ApiKeyCreate(BaseModel):
    name: str


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    last_used_at: datetime | None
    created_at: datetime


class ApiKeyCreatedResponse(ApiKeyResponse):
    key: str  # shown only once


@router.patch("/me", response_model=ProfileResponse)
async def update_profile(
    body: ProfileUpdate,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProfileResponse:
    update_data = {}
    if body.full_name is not None:
        update_data["fullName"] = body.full_name
    if body.avatar_url is not None:
        update_data["avatarUrl"] = body.avatar_url

    if update_data:
        updated = await db.user.update(where={"id": current_user.id}, data=update_data)
    else:
        updated = current_user

    return ProfileResponse(
        id=updated.id, email=updated.email,
        full_name=updated.fullName, avatar_url=updated.avatarUrl,
        created_at=updated.createdAt,
    )


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: PasswordChange,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    if not verify_password(body.current_password, current_user.password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    await db.user.update(
        where={"id": current_user.id},
        data={"password": hash_password(body.new_password)},
    )


@router.get("/preferences", response_model=PreferencesResponse)
async def get_preferences(
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PreferencesResponse:
    prefs = await db.userpreferences.find_unique(where={"userId": current_user.id})
    if prefs is None:
        prefs = await db.userpreferences.create(data={"userId": current_user.id})
    return PreferencesResponse(
        default_llm_provider=prefs.defaultLlmProvider,
        default_export_format=prefs.defaultExportFormat,
        email_analysis_complete=prefs.emailAnalysisComplete,
        email_batch_done=prefs.emailBatchDone,
        email_deadline_reminder=prefs.emailDeadlineReminder,
    )


@router.patch("/preferences", response_model=PreferencesResponse)
async def update_preferences(
    body: PreferencesUpdate,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PreferencesResponse:
    update_data = {k: v for k, v in {
        "defaultLlmProvider": body.default_llm_provider,
        "defaultExportFormat": body.default_export_format,
        "emailAnalysisComplete": body.email_analysis_complete,
        "emailBatchDone": body.email_batch_done,
        "emailDeadlineReminder": body.email_deadline_reminder,
    }.items() if v is not None}

    prefs = await db.userpreferences.upsert(
        where={"userId": current_user.id},
        data={"create": {"userId": current_user.id, **update_data}, "update": update_data},
    )
    return PreferencesResponse(
        default_llm_provider=prefs.defaultLlmProvider,
        default_export_format=prefs.defaultExportFormat,
        email_analysis_complete=prefs.emailAnalysisComplete,
        email_batch_done=prefs.emailBatchDone,
        email_deadline_reminder=prefs.emailDeadlineReminder,
    )


@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ApiKeyResponse]:
    keys = await db.apikey.find_many(where={"userId": current_user.id}, order={"createdAt": "desc"})
    return [
        ApiKeyResponse(id=k.id, name=k.name, key_prefix=k.keyPrefix, last_used_at=k.lastUsedAt, created_at=k.createdAt)
        for k in keys
    ]


@router.post("/api-keys", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    body: ApiKeyCreate,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiKeyCreatedResponse:
    raw_key = f"rsk_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:12]

    k = await db.apikey.create(data={
        "userId": current_user.id,
        "name": body.name,
        "keyHash": key_hash,
        "keyPrefix": key_prefix,
    })
    logger.info("api_key_created", key_id=k.id, user_id=current_user.id)
    return ApiKeyCreatedResponse(
        id=k.id, name=k.name, key_prefix=k.keyPrefix,
        last_used_at=k.lastUsedAt, created_at=k.createdAt, key=raw_key,
    )


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    key_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    k = await db.apikey.find_unique(where={"id": key_id})
    if k is None or k.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    await db.apikey.delete(where={"id": key_id})
