import hashlib
import io
import uuid
from datetime import datetime
from pathlib import Path

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status, BackgroundTasks
from fastapi.responses import StreamingResponse
from prisma.models import User
from pydantic import BaseModel, ConfigDict

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.db.repositories.analysis_repo import AnalysisRepository
from app.db.repositories.resume_repo import ResumeRepository
from app.services.export import ExportService
from app.services.storage import StorageService
from prisma import Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/resumes", tags=["resumes"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/png",
    "image/jpeg",
}


# ── Schemas ──────────────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    resume_id: str
    job_id: str
    cached: bool = False


class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    file_name: str
    file_type: str
    file_size: int
    status: str
    created_at: datetime
    analysis: dict | None = None


class ResumeListResponse(BaseModel):
    items: list[ResumeResponse]
    total: int
    page: int
    page_size: int


class AnalysisResponse(BaseModel):
    id: str
    resume_id: str
    ats_score: int
    ats_breakdown: dict
    entities_json: dict
    bias_flags_json: list
    fraud_flags_json: list
    created_at: datetime


# ── Helpers ──────────────────────────────────────────────────────────────────

def _compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _validate_file(file: UploadFile, content: bytes) -> str:
    """Validate file type and size. Returns the normalised extension."""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File type '{suffix}' not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {settings.max_upload_size_mb} MB",
        )
    return suffix.lstrip(".")


def _analysis_to_dict(analysis) -> dict | None:
    if analysis is None:
        return None
    return {
        "id": analysis.id,
        "resume_id": analysis.resumeId,
        "ats_score": analysis.atsScore,
        "ats_breakdown": analysis.atsBreakdown,
        "entities_json": analysis.entitiesJson,
        "bias_flags_json": analysis.biasFlagsJson,
        "fraud_flags_json": analysis.fraudFlagsJson,
        "created_at": analysis.createdAt.isoformat() if hasattr(analysis.createdAt, 'isoformat') else str(analysis.createdAt),
    }


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UploadResponse:
    content = await file.read()
    file_type = _validate_file(file, content)
    file_hash = _compute_sha256(content)

    repo = ResumeRepository(db)

    # Deduplication: return cached result if same hash + user
    existing = await repo.get_by_hash(file_hash, current_user.id)
    if existing:
        logger.info("resume_cache_hit", resume_id=existing.id, user_id=current_user.id)
        return UploadResponse(resume_id=existing.id, job_id=existing.id, cached=True)

    # Save file
    storage = StorageService()
    dest_dir = settings.upload_dir / current_user.id
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Re-wrap bytes as UploadFile-compatible for storage service
    file.file = io.BytesIO(content)
    file.filename = file.filename
    saved_path = await storage.save_file(file, dest_dir)

    # Create DB record
    resume = await repo.create(
        user_id=current_user.id,
        file_name=file.filename or f"resume_{uuid.uuid4()}",
        file_path=str(saved_path),
        file_type=file_type,
        file_size=len(content),
        file_hash=file_hash,
    )

    # Enqueue Background Task
    from app.tasks.parse_task import run_process_resume  # noqa: PLC0415

    job_id = str(uuid.uuid4())
    background_tasks.add_task(
        run_process_resume,
        job_id=job_id,
        resume_id=resume.id,
        file_path=str(saved_path),
        file_type=file_type,
    )

    logger.info("resume_uploaded", resume_id=resume.id, job_id=job_id, user_id=current_user.id)
    return UploadResponse(resume_id=resume.id, job_id=job_id)


@router.get("/", response_model=ResumeListResponse)
async def list_resumes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResumeListResponse:
    repo = ResumeRepository(db)
    skip = (page - 1) * page_size
    resumes = await repo.list_by_user(current_user.id, skip=skip, take=page_size)
    total = await repo.count_by_user(current_user.id)
    items = [
        ResumeResponse(
            id=r.id,
            file_name=r.fileName,
            file_type=r.fileType,
            file_size=r.fileSize,
            status=r.status,
            created_at=r.createdAt,
            analysis=_analysis_to_dict(r.analysis),
        )
        for r in resumes
    ]
    return ResumeListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{resume_id}", response_model=ResumeResponse)
async def get_resume(
    resume_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResumeResponse:
    repo = ResumeRepository(db)
    resume = await repo.get_by_id(resume_id, include_analysis=True)
    if resume is None or resume.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    return ResumeResponse(
        id=resume.id,
        file_name=resume.fileName,
        file_type=resume.fileType,
        file_size=resume.fileSize,
        status=resume.status,
        created_at=resume.createdAt,
        analysis=_analysis_to_dict(resume.analysis),
    )


@router.get("/{resume_id}/analysis", response_model=AnalysisResponse)
async def get_analysis(
    resume_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisResponse:
    resume_repo = ResumeRepository(db)
    resume = await resume_repo.get_by_id(resume_id)
    if resume is None or resume.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    analysis_repo = AnalysisRepository(db)
    analysis = await analysis_repo.get_by_resume_id(resume_id)
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not yet available",
        )
    return AnalysisResponse(
        id=analysis.id,
        resume_id=resume_id,
        ats_score=analysis.atsScore,
        ats_breakdown=analysis.atsBreakdown,
        entities_json=analysis.entitiesJson,
        bias_flags_json=analysis.biasFlagsJson,
        fraud_flags_json=analysis.fraudFlagsJson,
        created_at=analysis.createdAt,
    )


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    resume_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    repo = ResumeRepository(db)
    resume = await repo.get_by_id(resume_id)
    if resume is None or resume.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    storage = StorageService()
    await storage.delete_file(resume.filePath)
    await repo.delete(resume_id)
    logger.info("resume_deleted", resume_id=resume_id, user_id=current_user.id)


@router.get("/{resume_id}/export/pdf")
async def export_pdf(
    resume_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    resume_repo = ResumeRepository(db)
    resume = await resume_repo.get_by_id(resume_id)
    if resume is None or resume.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    analysis_repo = AnalysisRepository(db)
    analysis = await analysis_repo.get_by_resume_id(resume_id)
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not yet available",
        )

    analysis_data = {
        "ats_score": analysis.atsScore,
        "ats_breakdown": analysis.atsBreakdown,
        "entities": analysis.entitiesJson,
        "bias_flags": analysis.biasFlagsJson,
        "fraud_flags": analysis.fraudFlagsJson,
    }

    exporter = ExportService()
    pdf_bytes = exporter.resume_to_pdf(analysis_data, resume.fileName)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="analysis_{resume_id}.pdf"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )
