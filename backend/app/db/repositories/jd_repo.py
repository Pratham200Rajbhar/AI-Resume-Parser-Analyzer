from prisma.models import JdMatchResult, JobDescription

from prisma import Prisma


class JdRepository:
    def __init__(self, db: Prisma) -> None:
        self.db = db

    async def create(
        self,
        user_id: str,
        title: str,
        raw_text: str,
        embedding_vector: list[float],
        company: str | None = None,
    ) -> JobDescription:
        return await self.db.jobdescription.create(
            data={
                "userId": user_id,
                "title": title,
                "company": company,
                "rawText": raw_text,
                "embeddingVector": embedding_vector,
            }
        )

    async def get_by_id(self, jd_id: str) -> JobDescription | None:
        return await self.db.jobdescription.find_unique(where={"id": jd_id})

    async def list_by_user(self, user_id: str, skip: int = 0, take: int = 20) -> list[JobDescription]:
        return await self.db.jobdescription.find_many(
            where={"userId": user_id},
            order={"createdAt": "desc"},
            skip=skip,
            take=take,
        )

    async def delete(self, jd_id: str) -> JobDescription:
        return await self.db.jobdescription.delete(where={"id": jd_id})


class MatchRepository:
    def __init__(self, db: Prisma) -> None:
        self.db = db

    async def upsert(
        self,
        resume_id: str,
        jd_id: str,
        match_score: float,
        matched_skills: list,
        gap_skills: list,
        keyword_report: dict,
    ) -> JdMatchResult:
        data = {
            "resumeId": resume_id,
            "jobDescriptionId": jd_id,
            "matchScore": match_score,
            "matchedSkills": matched_skills,
            "gapSkills": gap_skills,
            "keywordReport": keyword_report,
        }
        return await self.db.jdmatchresult.upsert(
            where={"resumeId_jobDescriptionId": {"resumeId": resume_id, "jobDescriptionId": jd_id}},
            data={"create": data, "update": data},
        )

    async def get(self, resume_id: str, jd_id: str) -> JdMatchResult | None:
        return await self.db.jdmatchresult.find_unique(
            where={"resumeId_jobDescriptionId": {"resumeId": resume_id, "jobDescriptionId": jd_id}}
        )

    async def list_by_resume(self, resume_id: str) -> list[JdMatchResult]:
        return await self.db.jdmatchresult.find_many(
            where={"resumeId": resume_id},
            include={"jobDescription": True},
            order={"matchScore": "desc"},
        )
