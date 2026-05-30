import hashlib
import io
from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from prisma.models import User
from pydantic import BaseModel, ConfigDict

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.db.repositories.batch_repo import BatchRepository
from app.db.repositories.resume_repo import ResumeRepository
from app.services.export import ExportService
from app.services.storage import StorageService
from prisma import Prisma

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/batches", tags=["batches"])

MAX_BATCH_FILES = 500


# ── Schemas ──────────────────────────────────────────────────────────────────

class CreateBatchRequest(BaseModel):
    jd_id: str | None = None


class BatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    total_count: int
    completed_count: int
    failed_count: int
    created_at: datetime


class BatchUploadResponse(BaseModel):
    batch_id: str
    accepted: int
    job_id: str


class BatchStatusResponse(BaseModel):
    batch_id: str
    status: str
    total: int
    completed: int
    failed: int
    progress_pct: float


class RankingsResponse(BaseModel):
    batch_id: str
    rankings: list[dict]


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
async def create_batch(
    body: CreateBatchRequest,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BatchResponse:
    repo = BatchRepository(db)
    batch = await repo.create(user_id=current_user.id, total_count=0, jd_id=body.jd_id)
    logger.info("batch_created", batch_id=batch.id, user_id=current_user.id)
    return BatchResponse(
        id=batch.id,
        status=batch.status,
        total_count=batch.totalCount,
        completed_count=batch.completedCount,
        failed_count=batch.failedCount,
        created_at=batch.createdAt,
    )


@router.post("/{batch_id}/upload", response_model=BatchUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_batch_files(
    batch_id: str,
    files: list[UploadFile] = File(...),
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BatchUploadResponse:
    if len(files) > MAX_BATCH_FILES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Maximum {MAX_BATCH_FILES} files per batch",
        )

    batch_repo = BatchRepository(db)
    batch = await batch_repo.get_by_id(batch_id)
    if batch is None or batch.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    storage = StorageService()
    resume_repo = ResumeRepository(db)
    resume_ids: list[str] = []

    for file in files:
        content = await file.read()
        suffix = "pdf"
        if file.filename:
            suffix = file.filename.rsplit(".", 1)[-1].lower()

        file_hash = hashlib.sha256(content).hexdigest()
        existing = await resume_repo.get_by_hash(file_hash, current_user.id)
        if existing:
            resume_ids.append(existing.id)
            continue

        dest_dir = settings.upload_dir / current_user.id / "batch" / batch_id
        dest_dir.mkdir(parents=True, exist_ok=True)

        file.file = io.BytesIO(content)
        saved_path = await storage.save_file(file, dest_dir)

        resume = await resume_repo.create(
            user_id=current_user.id,
            file_name=file.filename or f"resume_{len(resume_ids)}",
            file_path=str(saved_path),
            file_type=suffix,
            file_size=len(content),
            file_hash=file_hash,
        )
        resume_ids.append(resume.id)

    # Update total count
    await db.batchjob.update(
        where={"id": batch_id},
        data={"totalCount": len(resume_ids)},
    )

    from app.tasks.batch_task import process_batch  # noqa: PLC0415

    task = process_batch.delay(
        batch_id=batch_id,
        resume_ids=resume_ids,
        jd_id=batch.jobDescriptionId,
    )

    logger.info("batch_upload", batch_id=batch_id, count=len(resume_ids), task_id=task.id)
    return BatchUploadResponse(batch_id=batch_id, accepted=len(resume_ids), job_id=task.id)


@router.get("/", response_model=list[BatchResponse])
async def list_batches(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BatchResponse]:
    repo = BatchRepository(db)
    skip = (page - 1) * page_size
    batches = await repo.list_by_user(current_user.id, skip=skip, take=page_size)
    return [
        BatchResponse(
            id=b.id,
            status=b.status,
            total_count=b.totalCount,
            completed_count=b.completedCount,
            failed_count=b.failedCount,
            created_at=b.createdAt,
        )
        for b in batches
    ]


@router.get("/{batch_id}", response_model=BatchResponse)
async def get_batch(
    batch_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BatchResponse:
    repo = BatchRepository(db)
    batch = await repo.get_by_id(batch_id)
    if batch is None or batch.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    return BatchResponse(
        id=batch.id,
        status=batch.status,
        total_count=batch.totalCount,
        completed_count=batch.completedCount,
        failed_count=batch.failedCount,
        created_at=batch.createdAt,
    )


@router.get("/{batch_id}/status", response_model=BatchStatusResponse)
async def get_batch_status(
    batch_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BatchStatusResponse:
    repo = BatchRepository(db)
    batch = await repo.get_by_id(batch_id)
    if batch is None or batch.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    total = batch.totalCount or 1  # avoid division by zero
    progress = round((batch.completedCount / total) * 100, 1)
    return BatchStatusResponse(
        batch_id=batch_id,
        status=batch.status,
        total=batch.totalCount,
        completed=batch.completedCount,
        failed=batch.failedCount,
        progress_pct=progress,
    )


@router.get("/{batch_id}/rankings", response_model=RankingsResponse)
async def get_rankings(
    batch_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RankingsResponse:
    repo = BatchRepository(db)
    batch = await repo.get_by_id(batch_id)
    if batch is None or batch.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    if batch.status != "COMPLETE":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Batch is not complete yet (status: {batch.status})",
        )
    return RankingsResponse(batch_id=batch_id, rankings=batch.rankedResults or [])


@router.get("/{batch_id}/export/csv")
async def export_csv(
    batch_id: str,
    db: Prisma = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    repo = BatchRepository(db)
    batch = await repo.get_by_id(batch_id)
    if batch is None or batch.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    if not batch.rankedResults:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No rankings available")

    exporter = ExportService()
    csv_content = exporter.batch_to_csv(batch.rankedResults)

    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="batch_{batch_id}_rankings.csv"',
        },
    )
