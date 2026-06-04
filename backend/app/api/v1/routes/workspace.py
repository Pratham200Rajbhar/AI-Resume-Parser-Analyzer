from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from prisma.models import User
from pydantic import BaseModel, ConfigDict

from app.api.deps import get_current_user, get_db
from prisma import Json, Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/workspace", tags=["workspace"])


class CandidateCreate(BaseModel):
    resume_id: str
    name: str
    ats_score: int = 0
    match_score: int = 0
    top_skills: list[str] = []
    notes: str = ""
    column: str = "shortlisted"
    position: int = 0
    job_description_id: str | None = None


class CandidateUpdate(BaseModel):
    column: str | None = None
    notes: str | None = None
    position: int | None = None
    match_score: int | None = None


class CandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    resume_id: str
    name: str
    ats_score: int
    match_score: int
    top_skills: list
    notes: str
    column: str
    position: int
    job_description_id: str | None
    created_at: datetime
    updated_at: datetime


class ColumnCreate(BaseModel):
    name: str
    slug: str
    position: int = 0


class ColumnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    position: int
    created_at: datetime


@router.get("/candidates", response_model=list[CandidateResponse])
async def list_candidates(
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CandidateResponse]:
    candidates = await db.workspacecandidate.find_many(
        where={"userId": current_user.id},
        order={"position": "asc"},
    )
    return [
        CandidateResponse(
            id=c.id,
            resume_id=c.resumeId,
            name=c.name,
            ats_score=c.atsScore,
            match_score=c.matchScore,
            top_skills=c.topSkills or [],
            notes=c.notes,
            column=c.column,
            position=c.position,
            job_description_id=c.jobDescriptionId,
            created_at=c.createdAt,
            updated_at=c.updatedAt,
        )
        for c in candidates
    ]


@router.post("/candidates", response_model=CandidateResponse, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    body: CandidateCreate,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CandidateResponse:
    existing = await db.workspacecandidate.find_first(
        where={"userId": current_user.id, "resumeId": body.resume_id}
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Candidate already in workspace")

    c = await db.workspacecandidate.create(
        data={
            "userId": current_user.id,
            "resumeId": body.resume_id,
            "name": body.name,
            "atsScore": body.ats_score,
            "matchScore": body.match_score,
            "topSkills": Json(body.top_skills),
            "notes": body.notes,
            "column": body.column,
            "position": body.position,
            "jobDescriptionId": body.job_description_id,
        }
    )
    logger.info("workspace_candidate_created", candidate_id=c.id, user_id=current_user.id)
    return CandidateResponse(
        id=c.id, resume_id=c.resumeId, name=c.name, ats_score=c.atsScore,
        match_score=c.matchScore, top_skills=c.topSkills or [], notes=c.notes,
        column=c.column, position=c.position, job_description_id=c.jobDescriptionId,
        created_at=c.createdAt, updated_at=c.updatedAt,
    )


@router.patch("/candidates/{candidate_id}", response_model=CandidateResponse)
async def update_candidate(
    candidate_id: str,
    body: CandidateUpdate,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CandidateResponse:
    c = await db.workspacecandidate.find_unique(where={"id": candidate_id})
    if c is None or c.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    update_data = {k: v for k, v in {
        "column": body.column,
        "notes": body.notes,
        "position": body.position,
        "matchScore": body.match_score,
    }.items() if v is not None}

    updated = await db.workspacecandidate.update(where={"id": candidate_id}, data=update_data)
    return CandidateResponse(
        id=updated.id, resume_id=updated.resumeId, name=updated.name,
        ats_score=updated.atsScore, match_score=updated.matchScore,
        top_skills=updated.topSkills or [], notes=updated.notes,
        column=updated.column, position=updated.position,
        job_description_id=updated.jobDescriptionId,
        created_at=updated.createdAt, updated_at=updated.updatedAt,
    )


@router.delete("/candidates/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_candidate(
    candidate_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    c = await db.workspacecandidate.find_unique(where={"id": candidate_id})
    if c is None or c.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    await db.workspacecandidate.delete(where={"id": candidate_id})


@router.get("/columns", response_model=list[ColumnResponse])
async def list_columns(
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ColumnResponse]:
    cols = await db.workspacecolumn.find_many(
        where={"userId": current_user.id},
        order={"position": "asc"},
    )
    return [ColumnResponse(id=c.id, name=c.name, slug=c.slug, position=c.position, created_at=c.createdAt) for c in cols]


@router.post("/columns", response_model=ColumnResponse, status_code=status.HTTP_201_CREATED)
async def create_column(
    body: ColumnCreate,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ColumnResponse:
    col = await db.workspacecolumn.create(
        data={"userId": current_user.id, "name": body.name, "slug": body.slug, "position": body.position}
    )
    return ColumnResponse(id=col.id, name=col.name, slug=col.slug, position=col.position, created_at=col.createdAt)
