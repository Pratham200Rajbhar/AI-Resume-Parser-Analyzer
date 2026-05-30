# AI Resume Parser & Analyzer

An AI platform that parses, scores, and analyzes resumes using NLP + ML. Serves job seekers who want resume feedback and recruiters who want ranked candidate shortlists.

## Features

- **Resume Parsing** — PDF, DOCX, TXT, and image (OCR) ingestion
- **Entity Extraction** — Fine-tuned BERT NER for name, email, skills, experience, education, certifications
- **ATS Scoring** — Rule-based + XGBoost regression, 0–100 score with per-component breakdown and fix suggestions
- **JD Matching** — Sentence-Transformer semantic similarity + keyword gap report
- **Bias Detection** — Flags gender-coded language and age signals
- **Fraud Detection** — Overlapping employment dates, impossible timelines
- **Bulk Ranking** — Upload up to 500 resumes against one JD, composite ranked table
- **AI Career Coach** — LangChain + GPT-4o/Claude chat with resume context, bullet rewrites, cover letters
- **Recruiter Workspace** — Kanban board (Shortlisted / Review / Rejected / Hired)
- **Real-time Progress** — WebSocket streaming of parse/analyze pipeline stages

## Architecture

```
frontend/          Next.js 14 + TypeScript + Tailwind
backend/
  app/
    api/           FastAPI routes + WebSocket handler
    core/          Config, security (JWT), logging, middleware
    db/            Prisma schema, repositories
    services/      Storage (local/S3), Redis cache, PDF/CSV export
    tasks/         Celery tasks (parse, batch)
    ml/
      parsers/     PDF (PyMuPDF), DOCX, OCR (Tesseract), text
      nlp/         Section segmenter, spaCy NER, BERT NER, skill normalizer, pipeline
      analysis/    ATS scorer, JD matcher, bias detector, fraud detector, ranker
      llm/         LangChain career coach, prompt templates
      models/      Model weights (BERT NER, XGBoost, bias classifiers)
      data/        O*NET skill taxonomy
```

## Quick Start

### Prerequisites

- Docker + Docker Compose
- (Optional) OpenAI or Anthropic API key for the AI coach

### 1. Clone and configure

```bash
cp .env.example .env
# Edit .env — set SECRET_KEY, DATABASE_URL, and optionally OPENAI_API_KEY
```

### 2. Start all services

```bash
make dev
# or: docker-compose up
```

This starts PostgreSQL, Redis, the FastAPI backend, Celery worker, and Next.js frontend.

### 3. Run migrations

```bash
make migrate
```

### 4. Open the app

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs

## Development

### Backend only

```bash
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_trf
prisma generate
prisma migrate dev
uvicorn app.main:app --reload
```

### Celery worker

```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info
```

### Frontend only

```bash
cd frontend
npm install
npm run dev
```

### Tests

```bash
make test
# or individually:
cd backend && pytest -v
cd frontend && npm run test
```

### Lint + format

```bash
make lint
make format
```

## Environment Variables

See `.env.example` for all variables. Key ones:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis URL (broker + cache) |
| `SECRET_KEY` | JWT signing key — change in production |
| `OPENAI_API_KEY` | For AI career coach (optional) |
| `ANTHROPIC_API_KEY` | Alternative LLM provider |
| `STORAGE_BACKEND` | `local` or `s3` |

## ML Models

Pre-trained weights are included in `backend/app/ml/models/weights/`:

| Model | File | Purpose |
|-------|------|---------|
| Fine-tuned BERT | `resume_ner/` | Resume-specific NER |
| XGBoost | `xgboost_v2.joblib` | ATS score regression |
| Bias classifiers | `bias/` | Gender, age, personal info detection |

The `all-MiniLM-L6-v2` Sentence-Transformer and `en_core_web_trf` spaCy model are downloaded automatically on first use.

## API Reference

Interactive docs available at `http://localhost:8000/docs` (Swagger UI).

Key endpoints:

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/resumes/upload
GET    /api/v1/resumes/{id}/analysis
POST   /api/v1/jds/
POST   /api/v1/jds/{id}/match/{resume_id}
POST   /api/v1/batches/
GET    /api/v1/batches/{id}/rankings
POST   /api/v1/coaching/sessions
POST   /api/v1/coaching/sessions/{id}/messages
WS     /ws/jobs/{job_id}
```

## Deployment

- **Frontend** → Vercel (`vercel deploy`)
- **Backend + Worker** → Render, Railway, or any VPS with Docker
- **Database** → Managed PostgreSQL (Render, Supabase, Neon)
- **Redis** → Managed Redis (Upstash, Redis Cloud)

Set `ENVIRONMENT=production` and update `CORS_ORIGINS` to your frontend URL.
