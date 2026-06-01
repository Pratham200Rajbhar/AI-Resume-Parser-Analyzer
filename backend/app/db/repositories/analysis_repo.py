from typing import Any

from prisma.models import ResumeAnalysis

from prisma import Json, Prisma


class AnalysisRepository:
    def __init__(self, db: Prisma) -> None:
        self.db = db

    async def create(
        self,
        resume_id: str,
        raw_text: str,
        entities: dict,
        ats_score: int,
        ats_breakdown: dict,
        bias_flags: list,
        fraud_flags: list,
    ) -> ResumeAnalysis:
        return await self.db.resumeanalysis.create(
            data={
                "resumeId": resume_id,
                "rawText": raw_text,
                "entitiesJson": Json(entities),
                "atsScore": ats_score,
                "atsBreakdown": Json(ats_breakdown),
                "biasFlagsJson": Json(bias_flags),
                "fraudFlagsJson": Json(fraud_flags),
            }
        )

    async def get_by_id(self, analysis_id: str) -> ResumeAnalysis | None:
        return await self.db.resumeanalysis.find_unique(where={"id": analysis_id})

    async def get_by_resume_id(self, resume_id: str) -> ResumeAnalysis | None:
        return await self.db.resumeanalysis.find_unique(where={"resumeId": resume_id})

    async def update(self, resume_id: str, **fields: Any) -> ResumeAnalysis:
        return await self.db.resumeanalysis.update(
            where={"resumeId": resume_id}, data=fields
        )
