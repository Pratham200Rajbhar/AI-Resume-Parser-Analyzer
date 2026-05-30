from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    from transformers import Pipeline as _HFPipeline

logger = structlog.get_logger(__name__)

_WEIGHTS_DIR = Path(__file__).parent.parent / "models" / "weights" / "resume_ner"

_pipeline_instance: _HFPipeline | None = None


def _get_pipeline() -> _HFPipeline:
    global _pipeline_instance
    if _pipeline_instance is None:
        from transformers import pipeline  # noqa: PLC0415

        model_path = str(_WEIGHTS_DIR)
        logger.info("bert_ner_loading", model_path=model_path)
        _pipeline_instance = pipeline(
            "ner",
            model=model_path,
            tokenizer=model_path,
            aggregation_strategy="simple",
            device=-1,  # CPU; set to 0 for GPU
        )
        logger.info("bert_ner_loaded")
    return _pipeline_instance


class BertNER:
    """
    Fine-tuned BERT NER extractor for resume-specific entities.
    Loads the model lazily as a singleton.
    """

    # Labels produced by the fine-tuned model
    RESUME_LABELS = {"ROLE", "SKILL", "DEGREE", "CERT", "NAME", "ORG", "DATE", "LOCATION"}

    def extract(self, text: str) -> list[dict]:
        """
        Run the fine-tuned BERT NER pipeline on text.

        Returns a list of dicts: {text, label, score}
        """
        if not text or not text.strip():
            return []

        ner_pipeline = _get_pipeline()

        # HuggingFace pipelines handle long text by chunking internally,
        # but we still cap to avoid OOM on extremely long inputs.
        truncated = text[:10_000]

        try:
            raw_results = ner_pipeline(truncated)
        except Exception as exc:
            logger.error("bert_ner_inference_failed", error=str(exc))
            return []

        entities: list[dict] = []
        seen: set[tuple[str, str]] = set()

        for item in raw_results:
            entity_text = item.get("word", "").strip()
            label = item.get("entity_group", item.get("entity", "")).upper()
            score = float(item.get("score", 0.0))

            # Strip B-/I- prefixes if aggregation_strategy didn't remove them
            for prefix in ("B-", "I-", "S-", "E-"):
                if label.startswith(prefix):
                    label = label[len(prefix):]
                    break

            if not entity_text or label not in self.RESUME_LABELS:
                continue

            key = (entity_text.lower(), label)
            if key in seen:
                continue
            seen.add(key)

            entities.append({
                "text": entity_text,
                "label": label,
                "score": round(score, 4),
            })

        logger.debug("bert_ner_done", entity_count=len(entities))
        return entities
