from prisma.models import BatchJob, CoachingSession

from prisma import Prisma


class BatchRepository:
    def __init__(self, db: Prisma) -> None:
        self.db = db

    async def create(self, user_id: str, total_count: int, jd_id: str | None = None) -> BatchJob:
        return await self.db.batchjob.create(
            data={"userId": user_id, "totalCount": total_count, "jobDescriptionId": jd_id}
        )

    async def get_by_id(self, batch_id: str) -> BatchJob | None:
        return await self.db.batchjob.find_unique(where={"id": batch_id})

    async def increment_completed(self, batch_id: str) -> BatchJob:
        return await self.db.batchjob.update(
            where={"id": batch_id},
            data={"completedCount": {"increment": 1}},
        )

    async def increment_failed(self, batch_id: str) -> BatchJob:
        return await self.db.batchjob.update(
            where={"id": batch_id},
            data={"failedCount": {"increment": 1}},
        )

    async def finalize(self, batch_id: str, ranked_results: list, status: str) -> BatchJob:
        return await self.db.batchjob.update(
            where={"id": batch_id},
            data={"status": status, "rankedResults": ranked_results},
        )

    async def list_by_user(self, user_id: str, skip: int = 0, take: int = 20) -> list[BatchJob]:
        return await self.db.batchjob.find_many(
            where={"userId": user_id},
            order={"createdAt": "desc"},
            skip=skip,
            take=take,
        )


class CoachingRepository:
    def __init__(self, db: Prisma) -> None:
        self.db = db

    async def create(
        self,
        user_id: str,
        title: str = "New Session",
        resume_analysis_id: str | None = None,
        jd_id: str | None = None,
    ) -> CoachingSession:
        return await self.db.coachingsession.create(
            data={
                "userId": user_id,
                "title": title,
                "resumeAnalysisId": resume_analysis_id,
                "jobDescriptionId": jd_id,
                "messages": [],
            }
        )

    async def get_by_id(self, session_id: str) -> CoachingSession | None:
        return await self.db.coachingsession.find_unique(where={"id": session_id})

    async def append_message(self, session_id: str, messages: list) -> CoachingSession:
        return await self.db.coachingsession.update(
            where={"id": session_id}, data={"messages": messages}
        )

    async def list_by_user(self, user_id: str, skip: int = 0, take: int = 20) -> list[CoachingSession]:
        return await self.db.coachingsession.find_many(
            where={"userId": user_id},
            order={"updatedAt": "desc"},
            skip=skip,
            take=take,
        )

    async def delete(self, session_id: str) -> CoachingSession:
        return await self.db.coachingsession.delete(where={"id": session_id})
