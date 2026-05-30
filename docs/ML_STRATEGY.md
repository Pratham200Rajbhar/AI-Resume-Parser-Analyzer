# ML Strategy
## AI Resume Parser & Analyzer

---

## Model Overview

| Model | Type | Task |
|-------|------|------|
| Regex + Rules | Rule-based | Contact info, dates, URLs |
| Section Classifier | Logistic Regression / SVM | Split resume into sections |
| spaCy `en_core_web_trf` | Pre-trained Transformer | General NER (person, org, location, date) |
| Fine-tuned BERT | Transformer (fine-tuned) | Resume NER (job title, skill, degree, cert) |
| Sentence-Transformer MiniLM | Bi-encoder | Semantic similarity (resume ↔ JD) |
| ATS Scorer | XGBoost | Predict ATS compatibility score |
| Bias Classifier | Logistic Regression (TF-IDF) | Detect gender/age bias signals |
| Skill Normalizer | Taxonomy + Fuzzy + Embedding | Map skills to canonical O*NET IDs |
| GPT-4o / Claude | External LLM API | Coaching, rewrites, cover letters |

All models run in-process inside the Celery worker. No separate model server.

---

## Fine-tuned BERT (Resume NER)

- **Base:** `bert-base-uncased` (110M params) — high accuracy, low memory footprint.
- **Data:** ResumeNER dataset (~200 resumes), augmented to ~2,000 examples via synonym replacement, date format variants, company name substitutions.
- **Labels (BIO):** `NAME`, `ORG`, `ROLE`, `SKILL`, `DEGREE`, `DATE`, `CERT`, `O`
- **Serving:** Loaded directly via HuggingFace `pipeline` API inside the worker.

---

## Sentence-Transformer (JD Matching)

- **Model:** `all-MiniLM-L6-v2` — fast on CPU, 384-dim embeddings.
- **Method:** Embed resume (weighted: Skills + Experience sections get higher weight) and JD text. Cosine similarity → 0–100 match score.

---

## ATS Scorer

Hybrid of rule-based checks + XGBoost regression:

- **Rules:** File format, required sections present, contact info, keyword density.
- **XGBoost:** Trained on synthetic data with common ATS-failing patterns (complex tables, missing headers, font anomalies). Predicts score degradation.

---

## Bias Classifier

- **Architecture:** Logistic Regression over TF-IDF — intentionally simple for interpretability (shows user exactly which terms triggered a flag).
- **Detects:** Gender-coded language, age signals (graduation year inference, very long experience spans).

---

## Skill Normalization (3-Layer)

1. **Exact match** — direct O*NET taxonomy lookup.
2. **Fuzzy match** — Levenshtein distance for typos/variants.
3. **Embedding similarity** — Sentence-Transformer nearest-neighbor search against a pre-built FAISS index of all 32,000+ O*NET skills.

---

## MLOps (Simplified)

- Model weights tracked via Git LFS or direct file storage (`.bin`, `.safetensors`, `.joblib`).
- Training/eval runs logged to local JSON files (hyperparams + scores).
- Update = replace local model files + restart workers.

---

## LLM Integration

- LangChain manages prompts. System prompt contains resume entities (JSON) + target JD.
- **Fallback:** If OpenAI/Anthropic API is down, return pre-configured template-based suggestions.
- **Cost control:** Prompt-response pairs cached in Redis.
