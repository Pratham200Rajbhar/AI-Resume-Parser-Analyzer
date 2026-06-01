from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from prisma.models import User
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db
from prisma import Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    body: str
    read: bool
    link: str | None
    created_at: datetime


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NotificationResponse]:
    notifs = await db.notification.find_many(
        where={"userId": current_user.id},
        order={"createdAt": "desc"},
        take=20,
    )
    return [
        NotificationResponse(
            id=n.id, type=n.type, title=n.title, body=n.body,
            read=n.read, link=n.link, created_at=n.createdAt,
        )
        for n in notifs
    ]


@router.get("/unread-count")
async def unread_count(
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    count = await db.notification.count(where={"userId": current_user.id, "read": False})
    return {"count": count}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationResponse:
    n = await db.notification.find_unique(where={"id": notification_id})
    if n is None or n.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    updated = await db.notification.update(where={"id": notification_id}, data={"read": True})
    return NotificationResponse(
        id=updated.id, type=updated.type, title=updated.title, body=updated.body,
        read=updated.read, link=updated.link, created_at=updated.createdAt,
    )


@router.patch("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    await db.notification.update_many(
        where={"userId": current_user.id, "read": False},
        data={"read": True},
    )
