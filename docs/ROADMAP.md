# Roadmap
## AI Resume Parser & Analyzer — 8 Weeks (Solo)

---

## Phase 1 — Foundation (Weeks 1–2)

**Goal:** Running system that parses files, extracts basic info, and returns JSON via API.

**Week 1 — Setup & Parsing**
- Monorepo structure: `/backend`, `/frontend`, `/ml`, `/docs`
- PostgreSQL + Redis running locally
- Prisma schema + `prisma migrate dev` initialized
- `POST /api/v1/resumes/upload` — accepts PDF, DOCX, TXT, images
- PDF parser (PyMuPDF), DOCX parser (python-docx), OCR (Tesseract)
- File saved to local storage

✅ Done when: API runs, files upload, text extracted, records written to DB via Prisma.

**Week 2 — NER & Task Queue**
- Celery + Redis broker configured
- spaCy `en_core_web_trf` integrated for basic NER (name, email, phone, location)
- Rule-based section segmentation (Experience, Education, Skills, etc.)
- Job status: `PENDING → PARSING → ANALYZED → FAILED`

✅ Done when: Upload triggers async Celery task, job ID returned, entities stored in DB.

---

## Phase 2 — ML Core (Weeks 3–4)

**Goal:** Fine-tuned NER, skill normalization, semantic matching, ATS scoring, bias detection.

**Week 3 — BERT NER & Skill Normalization**
- Fine-tune `bert-base-uncased` on ResumeNER dataset
- O*NET skill taxonomy loaded into PostgreSQL
- Skill normalizer: exact → fuzzy → embedding similarity (FAISS)
- BERT + skill normalizer integrated into NLP pipeline

✅ Done when: "ReactJS" and "React.js" map to same O*NET ID.

**Week 4 — Matching & Scoring**
- Sentence-Transformer (`all-MiniLM-L6-v2`) for embeddings
- `POST /api/v1/jds` — JD ingestion
- Cosine similarity match score + keyword gap report
- XGBoost ATS scoring model (rule-based + regression hybrid)
- Logistic Regression bias classifier + anonymization engine

✅ Done when: Resume vs matching JD scores high; unrelated JD scores low. Bias terms flagged.

---

## Phase 3 — Advanced Features (Weeks 5–6)

**Goal:** LLM coach, bulk ranking, WebSockets, fraud detection.

**Week 5 — LLM Coach & Fraud Detection**
- LangChain + GPT-4o / Claude integration
- Prompt templates: bullet rewrites, cover letter, skill gap advice
- Coaching sessions API (`POST /coaching/sessions`)
- Redis prompt cache to control LLM costs
- Employment timeline validator (overlapping dates, unrealistic gaps)
- GitHub API cross-reference for developers

✅ Done when: Chat references resume facts. Cover letter generated from JD. Date overlaps flagged.

**Week 6 — Bulk Ranker & WebSockets**
- `POST /api/v1/batches` — up to 500 files
- Celery chord/group for parallel processing
- Ranking coordinator: composite score (JD match 50%, skills 25%, experience 15%, education 10%)
- Socket.io WebSocket streaming (`PARSING_COMPLETE`, `ENTITIES_READY`, `COMPLETE`)
- CSV + PDF export

✅ Done when: 50 resumes ranked in a sortable table. Progress streams live to frontend.

---

## Phase 4 — Frontend & Deployment (Weeks 7–8)

**Goal:** Next.js dashboard, charts, recruiter workspace, deployed to public URL.

**Week 7 — Dashboard UI**
- Next.js + Tailwind + shadcn/ui setup
- Drag-and-drop upload with real-time progress bar
- ATS score ring, JD match gauge, entity display
- Skills radar chart (Recharts), career timeline (D3.js), skill gap heatmap

✅ Done when: Upload → charts render correctly. Mobile-responsive at 768px+.

**Week 8 — Workspace & Deploy**
- Recruiter workspace: job pipelines, candidate Kanban (Shortlisted / Review / Rejected / Hired)
- AI coach chat sidebar
- PDF export of analysis dashboard
- Deploy: Next.js → Vercel, FastAPI + Celery + PostgreSQL + Redis → Render / Railway / VPS

✅ Done when: Public URL live. Full journey works: upload → dashboard → coach → export.

---

## Milestones

| Milestone | Week |
|-----------|------|
| File parsing + DB via Prisma working | 1 |
| Celery NER pipeline stores entities | 2 |
| BERT NER + skill normalization | 3 |
| JD match + ATS score + bias detection | 4 |
| LLM coach active | 5 |
| Bulk ranking + WebSockets | 6 |
| Next.js dashboard complete | 7 |
| Deployed + verified | 8 |
