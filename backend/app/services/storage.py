import asyncio
from pathlib import Path

import structlog
from fastapi import UploadFile

from app.core.config import settings

logger = structlog.get_logger(__name__)


class StorageService:
    """Handles file persistence to local disk or S3."""

    def __init__(self) -> None:
        self.backend = settings.storage_backend

    async def save_file(self, file: UploadFile, dest_dir: Path) -> Path:
        """Save an UploadFile to dest_dir. Returns the saved path."""
        if self.backend == "s3":
            return await self._save_s3(file, dest_dir)
        return await self._save_local(file, dest_dir)

    async def _save_local(self, file: UploadFile, dest_dir: Path) -> Path:
        dest_dir.mkdir(parents=True, exist_ok=True)
        filename = file.filename or f"upload_{id(file)}"
        dest_path = dest_dir / filename

        # Avoid overwriting: append a counter if file already exists
        counter = 1
        stem = dest_path.stem
        suffix = dest_path.suffix
        while dest_path.exists():
            dest_path = dest_dir / f"{stem}_{counter}{suffix}"
            counter += 1

        content = await file.read()
        await asyncio.to_thread(dest_path.write_bytes, content)
        logger.info("file_saved_local", path=str(dest_path), size=len(content))
        return dest_path

    async def _save_s3(self, file: UploadFile, dest_dir: Path) -> Path:
        try:
            import boto3  # type: ignore
        except ImportError as exc:
            raise RuntimeError("boto3 is required for S3 storage") from exc

        content = await file.read()
        filename = file.filename or f"upload_{id(file)}"
        key = str(dest_dir / filename)

        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_s3_region,
        )
        await asyncio.to_thread(
            s3.put_object,
            Bucket=settings.aws_s3_bucket,
            Key=key,
            Body=content,
        )
        logger.info("file_saved_s3", bucket=settings.aws_s3_bucket, key=key)
        # Return a pseudo-path that encodes the S3 key
        return Path(f"s3://{settings.aws_s3_bucket}/{key}")

    async def delete_file(self, path: str) -> None:
        """Delete a file from local disk or S3."""
        if path.startswith("s3://"):
            await self._delete_s3(path)
        else:
            await self._delete_local(path)

    async def _delete_local(self, path: str) -> None:
        p = Path(path)
        if p.exists():
            await asyncio.to_thread(p.unlink)
            logger.info("file_deleted_local", path=path)
        else:
            logger.warning("file_not_found_for_delete", path=path)

    async def _delete_s3(self, path: str) -> None:
        try:
            import boto3  # type: ignore
        except ImportError as exc:
            raise RuntimeError("boto3 is required for S3 storage") from exc

        # path format: s3://bucket/key
        without_scheme = path[len("s3://"):]
        bucket, _, key = without_scheme.partition("/")
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_s3_region,
        )
        await asyncio.to_thread(s3.delete_object, Bucket=bucket, Key=key)
        logger.info("file_deleted_s3", bucket=bucket, key=key)

    async def get_file_bytes(self, path: str) -> bytes:
        """Read file bytes from local disk or S3."""
        if path.startswith("s3://"):
            return await self._get_s3_bytes(path)
        return await self._get_local_bytes(path)

    async def _get_local_bytes(self, path: str) -> bytes:
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(f"File not found: {path}")
        return await asyncio.to_thread(p.read_bytes)

    async def _get_s3_bytes(self, path: str) -> bytes:
        try:
            import boto3  # type: ignore
        except ImportError as exc:
            raise RuntimeError("boto3 is required for S3 storage") from exc

        without_scheme = path[len("s3://"):]
        bucket, _, key = without_scheme.partition("/")
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_s3_region,
        )
        response = await asyncio.to_thread(s3.get_object, Bucket=bucket, Key=key)
        return response["Body"].read()
