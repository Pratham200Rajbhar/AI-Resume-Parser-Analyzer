import secrets
from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from prisma.models import User
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db
from prisma import Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/share", tags=["share"])


class ShareLinkCreate(BaseModel):
    visible_sections: list[str] = []
    password: str | None = None
    expires_at: datetime | None = None


class ShareLinkResponse(BaseModel):
    id: str
    token: str
    visible_sections: list
    expires_at: datetime | None
    view_count: int
    created_at: datetime


@router.post("/resumes/{resume_id}", response_model=ShareLinkResponse, status_code=status.HTTP_201_CREATED)
async def create_share_link(
    resume_id: str,
    body: ShareLinkCreate,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShareLinkResponse:
    resume = await db.resume.find_unique(where={"id": resume_id})
    if resume is None or resume.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    token = secrets.token_urlsafe(9)  # ~12 chars URL-safe

    password_hash = None
    if body.password:
        import hashlib
        password_hash = hashlib.sha256(body.password.encode()).hexdigest()

    link = await db.sharelink.create(data={
        "resumeId": resume_id,
        "userId": current_user.id,
        "token": token,
        "visibleSections": body.visible_sections,
        "passwordHash": password_hash,
        "expiresAt": body.expires_at,
    })
    return ShareLinkResponse(
        id=link.id, token=link.token, visible_sections=link.visibleSections or [],
        expires_at=link.expiresAt, view_count=link.viewCount, created_at=link.createdAt,
    )


@router.get("/resumes/{resume_id}", response_model=list[ShareLinkResponse])
async def list_share_links(
    resume_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ShareLinkResponse]:
    resume = await db.resume.find_unique(where={"id": resume_id})
    if resume is None or resume.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    links = await db.sharelink.find_many(where={"resumeId": resume_id}, order={"createdAt": "desc"})
    return [
        ShareLinkResponse(
            id=l.id, token=l.token, visible_sections=l.visibleSections or [],
            expires_at=l.expiresAt, view_count=l.viewCount, created_at=l.createdAt,
        )
        for l in links
    ]


@router.delete("/resumes/{resume_id}/{token}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_share_link(
    resume_id: str,
    token: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    link = await db.sharelink.find_unique(where={"token": token})
    if link is None or link.resumeId != resume_id or link.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")
    await db.sharelink.delete(where={"token": token})


@router.get("/{token}")
async def get_shared_report(
    token: str,
    password: str | None = Query(None),
    db: Prisma = Depends(get_db),
) -> dict:
    link = await db.sharelink.find_unique(where={"token": token}, include={"resume": {"include": {"analysis": True}}})
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")

    if link.expiresAt and link.expiresAt < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Share link has expired")

    if link.passwordHash:
        if not password:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Password required")
        import hashlib
        if hashlib.sha256(password.encode()).hexdigest() != link.passwordHash:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password")

    await db.sharelink.update(where={"token": token}, data={"viewCount": {"increment": 1}})

    resume = link.resume
    analysis = resume.analysis if resume else None
    visible = set(link.visibleSections or [])

    result: dict = {"token": token, "visible_sections": list(visible)}
    if analysis:
        if not visible or "ats_score" in visible:
            result["ats_score"] = analysis.atsScore
        if not visible or "ats_breakdown" in visible:
            result["ats_breakdown"] = analysis.atsBreakdown
        if not visible or "entities" in visible:
            result["entities"] = analysis.entitiesJson
        if not visible or "bias_flags" in visible:
            result["bias_flags"] = analysis.biasFlagsJson
        if not visible or "fraud_flags" in visible:
            result["fraud_flags"] = analysis.fraudFlagsJson

    return result
