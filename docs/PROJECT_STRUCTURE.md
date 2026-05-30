# Project Structure
## AI Resume Parser & Analyzer

---

```
ai-resume-analyzer/
│
├── backend/                          # Python FastAPI application
│   ├── app/
│   │   ├── api/v1/routes/            # Route handlers (resumes, jds, batches, coaching, auth)
│   │   ├── api/websocket/            # WebSocket event handlers
│   │   ├── core/                     # Config, security (JWT), logging, middleware
│   │   ├── db/
│   │   │   ├── prisma/
│   │   │   │   └── schema.prisma     # Prisma schema — single source of truth for DB
│   │   │   └── repositories/         # Data access layer (wraps Prisma client calls)
│   │   ├── services/                 # Storage, cache (Redis), export (PDF/CSV)
│   │   └── tasks/                    # Celery tasks: parse_task, analyze_task, batch_task
│   ├── tests/
│   ├── requirements.txt
│   └── pyproject.toml
│
├── ml/                               # All ML/NLP code (imported by Celery workers)
│   ├── parsers/                      # PDF (PyMuPDF), DOCX, OCR (Tesseract), plain text
│   ├── nlp/                          # Section segmenter, spaCy NER, BERT NER, skill normalizer, pipeline
│   ├── models/                       # Training scripts for BERT NER, ATS scorer, bias detector
│   ├── analysis/                     # ATS scoring, JD matching, bias, skill gap, fraud, ranker
│   ├── llm/                          # LangChain coach, prompt templates, fallback responses
│   └── data/                         # O*NET taxonomy, ResumeNER dataset, evaluation set
│
├── frontend/                         # Next.js + TypeScript
│   ├── app/                          # App Router pages (auth, dashboard, workspace, coach)
│   ├── components/                   # Upload, analysis charts, coaching chat, workspace Kanban
│   ├── lib/                          # API client (Axios), WebSocket wrapper, utils
│   ├── stores/                       # Zustand stores (resume, analysis, workspace)
│   └── hooks/                        # useResumeUpload, useAnalysis, useCoachSession
│
├── docs/
├── .env.example
├── .gitignore
├── Makefile
└── README.md
```

---

## Key Decisions

- `backend/` never runs ML models directly — all model code lives in `ml/` and is imported by Celery workers.
- `schema.prisma` is the single source of truth for the database schema. Run `prisma migrate dev` to apply changes.
- `db/repositories/` wraps Prisma client calls to keep business logic separate from query code.
