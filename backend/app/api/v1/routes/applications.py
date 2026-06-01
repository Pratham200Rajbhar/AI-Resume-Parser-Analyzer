from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from prisma.models import User
from pydantic import BaseModel, ConfigDict

from app.api.deps import get_current_user, get_db
from prisma import Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/applications", tags=["applications"])


class ApplicationCreate(BaseModel):
    company: str
    job_title: str
    job_description_id: str | None = None
    resume_id: str | None = None
    application_date: datetime | None = None
    deadline: datetime | None = None
    stage: str = "SAVED"
    notes: str = ""


class ApplicationUpdate(BaseModel):
    company: str | None = None
    job_title: str | None = None
    job_description_id: str | None = None
    resume_id: str | None = None
    deadline: datetime | None = None
    stage: str | None = None
    notes: str | None = None


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company: str
    job_title: str
    job_description_id: str | None
    resume_id: str | None
    application_date: datetime
    deadline: datetime | None
    stage: str
    notes: str
    created_at: datetime
    updated_at: datetime


@router.get("", response_model=list[ApplicationResponse])
async def list_applications(
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ApplicationResponse]:
    apps = await db.jobapplication.find_many(
        where={"userId": current_user.id},
        order={"createdAt": "desc"},
    )
    return [
        ApplicationResponse(
            id=a.id, company=a.company, job_title=a.jobTitle,
            job_description_id=a.jobDescriptionId, resume_id=a.resumeId,
            application_date=a.applicationDate, deadline=a.deadline,
            stage=a.stage, notes=a.notes,
            created_at=a.createdAt, updated_at=a.updatedAt,
        )
        for a in apps
    ]


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    body: ApplicationCreate,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApplicationResponse:
    data: dict = {
        "userId": current_user.id,
        "company": body.company,
        "jobTitle": body.job_title,
        "stage": body.stage,
        "notes": body.notes,
    }
    if body.job_description_id:
        data["jobDescriptionId"] = body.job_description_id
    if body.resume_id:
        data["resumeId"] = body.resume_id
    if body.application_date:
        data["applicationDate"] = body.application_date
    if body.deadline:
        data["deadline"] = body.deadline

    a = await db.jobapplication.create(data=data)
    logger.info("application_created", app_id=a.id, user_id=current_user.id)
    return ApplicationResponse(
        id=a.id, company=a.company, job_title=a.jobTitle,
        job_description_id=a.jobDescriptionId, resume_id=a.resumeId,
        application_date=a.applicationDate, deadline=a.deadline,
        stage=a.stage, notes=a.notes,
        created_at=a.createdAt, updated_at=a.updatedAt,
    )


@router.patch("/{app_id}", response_model=ApplicationResponse)
async def update_application(
    app_id: str,
    body: ApplicationUpdate,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApplicationResponse:
    a = await db.jobapplication.find_unique(where={"id": app_id})
    if a is None or a.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    update_data = {k: v for k, v in {
        "company": body.company,
        "jobTitle": body.job_title,
        "jobDescriptionId": body.job_description_id,
        "resumeId": body.resume_id,
        "deadline": body.deadline,
        "stage": body.stage,
        "notes": body.notes,
    }.items() if v is not None}

    updated = await db.jobapplication.update(where={"id": app_id}, data=update_data)
    return ApplicationResponse(
        id=updated.id, company=updated.company, job_title=updated.jobTitle,
        job_description_id=updated.jobDescriptionId, resume_id=updated.resumeId,
        application_date=updated.applicationDate, deadline=updated.deadline,
        stage=updated.stage, notes=updated.notes,
        created_at=updated.createdAt, updated_at=updated.updatedAt,
    )


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    app_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    a = await db.jobapplication.find_unique(where={"id": app_id})
    if a is None or a.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    await db.jobapplication.delete(where={"id": app_id})
