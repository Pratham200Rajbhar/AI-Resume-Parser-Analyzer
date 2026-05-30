# PRD — AI Resume Parser & Analyzer

---

## What It Does

An AI platform that parses, scores, and analyzes resumes using NLP + ML. Serves two users: **job seekers** who want resume feedback, and **recruiters** who want ranked candidate shortlists.

---

## Problems It Solves

**Job seekers:** Don't know if their resume passes ATS, can't identify skill gaps, no affordable actionable feedback.

**Recruiters:** Manual screening is slow and biased, keyword-only ATS misses qualified candidates, no objective comparison system.

---

## Goals

- 90%+ entity extraction accuracy
- Semantic JD matching with >85% relevance precision
- Single resume processed end-to-end in <10 seconds
- Bulk ranking of up to 500 resumes against one JD

---

## Features

### Phase 1 & 2 — Core (Must Have)

| Feature | Description |
|---------|-------------|
| Multi-format ingestion | PDF, DOCX, TXT, images (OCR), LinkedIn URL. Max 10MB, batch up to 500 files |
| Entity extraction | Name, email, phone, education, experience, skills, projects, certifications — output as structured JSON with confidence scores |
| ATS score simulation | 0–100 score with per-component breakdown (keywords, format, section completeness) and fix suggestions |
| JD matching | Semantic similarity score, keyword gap report, matched skills list |
| Dashboard | Score cards, skills radar chart, career timeline, ATS breakdown, skill gap heatmap |

### Phase 3 — Advanced (Should Have)

| Feature | Description |
|---------|-------------|
| LLM career coach | Conversational chat with resume context. Bullet rewrites, cover letter, interview prep, salary guidance |
| Bias detection | Flags gender-coded language, age signals. One-click anonymization |
| Bulk ranker | Upload 2–500 resumes + JD → ranked sortable table → export CSV/PDF |
| Fraud detector | Flags date overlaps, impossible timelines, GitHub cross-reference for devs |
| Skill gap advisor | Maps to O*NET taxonomy, suggests specific courses per gap |

### Phase 4 — Platform (Could Have)

| Feature | Description |
|---------|-------------|
| REST API | OpenAPI spec, API key auth, PDF/CSV export |
| Recruiter workspace | Job pipelines, candidate Kanban board, status tracking, notes |

---

## Non-Goals (v1.0)

- Video interview analysis
- Job board scraping / auto-apply
- Non-English resumes
- Multi-tenant enterprise management

---

## Performance Targets

- Single resume parse + analysis: <10s (P95)
- 100 resumes bulk: <3 minutes
- Entity extraction F1: ≥0.90 · JD match precision: ≥0.85 · Bias recall: ≥0.90

---

## Timeline

| Phase | Weeks | Deliverable |
|-------|-------|-------------|
| Foundation | 1–2 | Parser + basic NER + API + Prisma DB |
| ML Core | 3–4 | BERT NER + SBERT matching + ATS scorer |
| Advanced | 5–6 | LLM coach + bias detector + bulk ranker |
| Frontend | 7–8 | Next.js dashboard + deployment |
