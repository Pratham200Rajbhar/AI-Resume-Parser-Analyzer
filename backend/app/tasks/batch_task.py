import asyncio
import json

import structlog

from app.tasks.celery_app import celery_app

logger = structlog.get_logger(__name__)


def _publish_sync(channel: str, event_type: str, data: dict | None = None) -> None:
    import redis

    from app.core.config import settings  # noqa: PLC0415

    r = redis.from_url(settings.redis_url, decode_responses=True)
    payload = {"type": event_type, "channel": channel}
    if data:
        payload.update(data)
    r.publish(channel, json.dumps(payload))
    r.close()


async def _process_batch_async(
    batch_id: str,
    resume_ids: list[str],
    jd_id: str | None,
) -> dict:
    from prisma import Prisma  # noqa: PLC0415

    db = Prisma()
    await db.connect()
    channel = f"job:{batch_id}"

    try:
        _publish_sync(channel, "BATCH_STARTED", {"batch_id": batch_id, "total": len(resume_ids)})

        from app.ml.analysis.ats_scorer import ATSScorer  # noqa: PLC0415
        from app.ml.analysis.bias_detector import BiasDetector  # noqa: PLC0415
        from app.ml.analysis.fraud_detector import FraudDetector  # noqa: PLC0415
        from app.ml.analysis.jd_matcher import JDMatcher  # noqa: PLC0415
        from app.ml.analysis.ranker import BatchRanker  # noqa: PLC0415
        from app.ml.nlp.pipeline import NLPPipeline  # noqa: PLC0415
        from app.ml.nlp.section_segmenter import segment_sections  # noqa: PLC0415
        from app.ml.parsers.router import parse_file  # noqa: PLC0415

        nlp = NLPPipeline()
        scorer = ATSScorer()
        bias_detector = BiasDetector()
        fraud_detector = FraudDetector()
        matcher = JDMatcher()
        ranker = BatchRanker()

        jd_text: str | None = None
        jd_embedding: list[float] | None = None
        if jd_id:
            jd_record = await db.jobdescription.find_unique(where={"id": jd_id})
            if jd_record:
                jd_text = jd_record.rawText
                jd_embedding = jd_record.embeddingVector

        candidates: list[dict] = []

        for idx, resume_id in enumerate(resume_ids):
            try:
                resume = await db.resume.find_unique(where={"id": resume_id})
                if resume is None:
                    await db.batchjob.update(
                        where={"id": batch_id},
                        data={"failedCount": {"increment": 1}},
                    )
                    continue

                await db.resume.update(where={"id": resume_id}, data={"status": "PARSING"})

                raw_text = parse_file(resume.filePath, resume.fileType)
                entities = nlp.run(raw_text)
                sections = segment_sections(raw_text)

                await db.resume.update(where={"id": resume_id}, data={"status": "ANALYZING"})

                ats_result = scorer.score(entities, raw_text, sections)
                breakdown_with_suggestions = {**ats_result["breakdown"], "suggestions": ats_result["suggestions"]}
                bias_flags = bias_detector.detect(raw_text)
                fraud_flags = fraud_detector.detect(entities)

                existing = await db.resumeanalysis.find_unique(where={"resumeId": resume_id})
                if existing:
                    await db.resumeanalysis.update(
                        where={"resumeId": resume_id},
                        data={
                            "rawText": raw_text,
                            "entitiesJson": entities,
                            "atsScore": ats_result["score"],
                            "atsBreakdown": breakdown_with_suggestions,
                            "biasFlagsJson": bias_flags,
                            "fraudFlagsJson": fraud_flags,
                        },
                    )
                else:
                    await db.resumeanalysis.create(
                        data={
                            "resumeId": resume_id,
                            "rawText": raw_text,
                            "entitiesJson": entities,
                            "atsScore": ats_result["score"],
                            "atsBreakdown": breakdown_with_suggestions,
                            "biasFlagsJson": bias_flags,
                            "fraudFlagsJson": fraud_flags,
                        }
                    )

                await db.resume.update(where={"id": resume_id}, data={"status": "ANALYZED"})

                match_score = 0.0
                if jd_text and jd_embedding:
                    match_result = matcher.match(entities, raw_text, jd_text, jd_embedding)
                    match_score = match_result["match_score"]

                candidates.append({
                    "resume_id": resume_id,
                    "candidate_name": entities.get("name", "Unknown"),
                    "entities": entities,
                    "ats_score": ats_result["score"],
                    "match_score": match_score,
                })

                await db.batchjob.update(
                    where={"id": batch_id},
                    data={"completedCount": {"increment": 1}},
                )

                _publish_sync(channel, "RESUME_PROCESSED", {
                    "batch_id": batch_id,
                    "resume_id": resume_id,
                    "completed": idx + 1,
                    "total": len(resume_ids),
                })

            except Exception as exc:
                logger.error("batch_resume_failed", resume_id=resume_id, error=str(exc))
                try:
                    await db.resume.update(where={"id": resume_id}, data={"status": "FAILED"})
                    await db.batchjob.update(
                        where={"id": batch_id},
                        data={"failedCount": {"increment": 1}},
                    )
                except Exception:
                    pass

        ranked = ranker.rank(candidates, jd_embedding)

        await db.batchjob.update(
            where={"id": batch_id},
            data={"status": "COMPLETE", "rankedResults": ranked},
        )

        _publish_sync(channel, "COMPLETE", {"batch_id": batch_id, "ranked_count": len(ranked)})
        logger.info("batch_complete", batch_id=batch_id, ranked=len(ranked))
        return {"batch_id": batch_id, "ranked_count": len(ranked)}

    except Exception as exc:
        logger.error("batch_failed", batch_id=batch_id, error=str(exc))
        try:
            await db.batchjob.update(where={"id": batch_id}, data={"status": "FAILED"})
        except Exception:
            pass
        _publish_sync(channel, "ERROR", {"batch_id": batch_id, "error": str(exc)})
        raise

    finally:
        await db.disconnect()


@celery_app.task(bind=True, name="tasks.process_batch", max_retries=2)
def process_batch(
    self,
    batch_id: str,
    resume_ids: list[str],
    jd_id: str | None = None,
) -> dict:
    try:
        return asyncio.run(_process_batch_async(batch_id, resume_ids, jd_id))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
