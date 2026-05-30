import asyncio
import json

import structlog
from prisma import Json


logger = structlog.get_logger(__name__)

_redis_conn = None


def _get_redis_conn():
    global _redis_conn
    if _redis_conn is None:
        import redis  # noqa: PLC0415
        from app.core.config import settings  # noqa: PLC0415
        _redis_conn = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_conn


def _publish_sync(job_id: str, event_type: str, data: dict | None = None) -> None:
    """Synchronously publish a WebSocket event via Redis."""
    payload = {"type": event_type, "job_id": job_id}
    if data:
        payload.update(data)
    try:
        _get_redis_conn().publish(f"job:{job_id}", json.dumps(payload))
    except Exception as exc:
        logger.warning("redis_publish_failed", job_id=job_id, event=event_type, error=str(exc))


async def _process_resume_async(
    job_id: str,
    resume_id: str,
    file_path: str,
    file_type: str,
) -> dict:
    from prisma import Prisma  # noqa: PLC0415

    db = Prisma()
    await db.connect()

    try:
        await db.resume.update(where={"id": resume_id}, data={"status": "PARSING"})
        _publish_sync(job_id, "JOB_STARTED", {"resume_id": resume_id})

        from app.ml.parsers.router import parse_file  # noqa: PLC0415

        raw_text = parse_file(file_path, file_type)
        _publish_sync(job_id, "PARSING_COMPLETE", {"chars": len(raw_text)})

        await db.resume.update(where={"id": resume_id}, data={"status": "ANALYZING"})

        from app.ml.nlp.pipeline import NLPPipeline  # noqa: PLC0415

        nlp = NLPPipeline()
        entities = nlp.run(raw_text)
        _publish_sync(job_id, "ENTITIES_READY", {"entity_count": len(entities)})

        from app.ml.nlp.section_segmenter import segment_sections  # noqa: PLC0415

        sections = segment_sections(raw_text)

        from app.ml.analysis.ats_scorer import ATSScorer  # noqa: PLC0415

        scorer = ATSScorer()
        ats_result = scorer.score(entities, raw_text, sections)
        breakdown_with_suggestions = {**ats_result["breakdown"], "suggestions": ats_result["suggestions"]}

        from app.ml.analysis.bias_detector import BiasDetector  # noqa: PLC0415

        bias_detector = BiasDetector()
        bias_flags = bias_detector.detect(raw_text)

        from app.ml.analysis.fraud_detector import FraudDetector  # noqa: PLC0415

        fraud_detector = FraudDetector()
        fraud_flags = fraud_detector.detect(entities)

        _publish_sync(job_id, "ANALYSIS_READY", {
            "ats_score": ats_result["score"],
            "bias_count": len(bias_flags),
            "fraud_count": len(fraud_flags),
        })

        existing = await db.resumeanalysis.find_unique(where={"resumeId": resume_id})
        if existing:
            await db.resumeanalysis.update(
                where={"resumeId": resume_id},
                data={
                    "rawText": raw_text,
                    "entitiesJson": Json(entities),
                    "atsScore": ats_result["score"],
                    "atsBreakdown": Json(breakdown_with_suggestions),
                    "biasFlagsJson": Json(bias_flags),
                    "fraudFlagsJson": Json(fraud_flags),
                },
            )
        else:
            await db.resumeanalysis.create(
                data={
                    "resumeId": resume_id,
                    "rawText": raw_text,
                    "entitiesJson": Json(entities),
                    "atsScore": ats_result["score"],
                    "atsBreakdown": Json(breakdown_with_suggestions),
                    "biasFlagsJson": Json(bias_flags),
                    "fraudFlagsJson": Json(fraud_flags),
                }
            )

        await db.resume.update(where={"id": resume_id}, data={"status": "ANALYZED"})
        _publish_sync(job_id, "COMPLETE", {"resume_id": resume_id, "ats_score": ats_result["score"]})

        logger.info("resume_processed", resume_id=resume_id, ats_score=ats_result["score"])
        return {
            "resume_id": resume_id,
            "ats_score": ats_result["score"],
            "entities": entities,
        }

    except Exception as exc:
        logger.error("resume_processing_failed", resume_id=resume_id, error=str(exc))
        try:
            await db.resume.update(where={"id": resume_id}, data={"status": "FAILED"})
        except Exception:
            pass
        _publish_sync(job_id, "ERROR", {"resume_id": resume_id, "error": str(exc)})
        raise

    finally:
        await db.disconnect()


def run_process_resume(
    job_id: str,
    resume_id: str,
    file_path: str,
    file_type: str,
) -> dict:
    """Synchronous entry point to run the async resume processing pipeline in a thread pool."""
    return asyncio.run(_process_resume_async(job_id, resume_id, file_path, file_type))
