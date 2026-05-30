# Tech Stack
## AI Resume Parser & Analyzer

---

## Backend

| Tech | Purpose |
|------|---------|
| Python 3.11+ | Backend + ML runtime |
| FastAPI | REST + WebSocket API |
| Celery + Redis | Async task queue for resume processing |
| Redis | Caching (file hash, LLM responses, session data) |
| PostgreSQL 16 | Primary database (JSONB for analysis results) |
| **Prisma (Python client)** | **ORM — schema, migrations, type-safe queries** |
| PostgreSQL FTS | Candidate full-text search |
| Local Filesystem / S3 | Resume file storage |

## NLP & ML

| Tech | Purpose |
|------|---------|
| spaCy `en_core_web_trf` | General NER (names, orgs, dates) |
| Fine-tuned BERT | Resume-specific NER (titles, skills, degrees) |
| Sentence-Transformers `all-MiniLM-L6-v2` | Semantic JD matching via cosine similarity |
| NLTK + HuggingFace Tokenizers | Preprocessing & tokenization |
| XGBoost | ATS score regression model |
| Logistic Regression (TF-IDF) | Bias detection classifier |
| O*NET + Lightcast Taxonomy | Skill normalization (32,000+ skills) |

## LLM

| Tech | Purpose |
|------|---------|
| GPT-4o / Claude API | Career coaching, rewrites, cover letters |
| LangChain | Prompt management, memory, caching |

## Frontend

| Tech | Purpose |
|------|---------|
| React 18 + TypeScript | Dashboard UI |
| Next.js 14 (App Router) | Routing + SSR |
| Tailwind CSS + shadcn/ui | Styling |
| Recharts + D3.js | Charts and visualizations |
| React Query | Server state (API data fetching) |
| Zustand | Client UI state |
| Socket.io | Real-time parse progress streaming |

## Infrastructure & Testing

| Tech | Purpose |
|------|---------|
| GitHub Actions | CI/CD (lint, test, deploy) |
| Render / Railway / VPS | Deployment target |
| pytest | Backend unit + integration tests |
| Vitest + Playwright | Frontend component + E2E tests |

---

> **ORM:** Prisma Python client handles all schema definitions, migrations (`prisma migrate dev`), and queries.
