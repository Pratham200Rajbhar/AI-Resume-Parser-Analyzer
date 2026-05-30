from prisma.models import Resume

from prisma import Prisma


class ResumeRepository:
    def __init__(self, db: Prisma) -> None:
        self.db = db

    async def create(
        self,
        user_id: str,
        file_name: str,
        file_path: str,
        file_type: str,
        file_size: int,
        file_hash: str,
    ) -> Resume:
        return await self.db.resume.create(
            data={
                "userId": user_id,
                "fileName": file_name,
                "filePath": file_path,
                "fileType": file_type,
                "fileSize": file_size,
                "fileHash": file_hash,
            }
        )

    async def get_by_id(self, resume_id: str, include_analysis: bool = False) -> Resume | None:
        return await self.db.resume.find_unique(
            where={"id": resume_id},
            include={"analysis": include_analysis, "matchResults": include_analysis},
        )

    async def get_by_hash(self, file_hash: str, user_id: str) -> Resume | None:
        return await self.db.resume.find_first(
            where={"fileHash": file_hash, "userId": user_id},
            include={"analysis": True},
        )

    async def list_by_user(self, user_id: str, skip: int = 0, take: int = 20) -> list[Resume]:
        return await self.db.resume.find_many(
            where={"userId": user_id},
            include={"analysis": True},
            order={"createdAt": "desc"},
            skip=skip,
            take=take,
        )

    async def update_status(self, resume_id: str, status: str) -> Resume:
        return await self.db.resume.update(
            where={"id": resume_id}, data={"status": status}
        )

    async def delete(self, resume_id: str) -> Resume:
        return await self.db.resume.delete(where={"id": resume_id})

    async def count_by_user(self, user_id: str) -> int:
        return await self.db.resume.count(where={"userId": user_id})
