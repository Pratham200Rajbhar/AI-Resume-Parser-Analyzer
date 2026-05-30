# System Design
## AI Resume Parser & Analyzer

---

## Architecture Overview

Five layers, all async:

1. **API Layer** — FastAPI handles HTTP/WebSocket. Validates input, creates DB records via Prisma, enqueues Celery jobs, returns job ID immediately.
2. **Task Layer** — Celery workers run the full parse → NLP → ML pipeline per resume. Stateless.
3. **Data Layer** — PostgreSQL (via Prisma) for all app state. Redis for caching + Celery broker. Local filesystem or S3 for raw files.
4. **ML Layer** — All model code lives in `ml/`. Workers import it as a library; the API never runs models directly.
5. **Frontend Layer** — Next.js talks to FastAPI via REST + WebSocket.

---

## Data Flow — Single Resume

1. **Upload** — `POST /api/v1/resumes/upload` validates file, saves to storage, creates `resume` record (status: `PENDING`) via Prisma, enqueues Celery task, returns `job_id`.
2. **WebSocket** — Frontend connects to `ws://api/ws/jobs/{job_id}` for live progress.
3. **Parse** — Worker loads file, routes to correct parser (PyMuPDF / python-docx / Tesseract / plain text), emits `PARSING_COMPLETE`.
4. **NER** — Hybrid NER pipeline (spaCy + fine-tuned BERT) extracts entities, emits `ENTITIES_READY`.
5. **Analysis** — Sentence-Transformer match score, skill normalization, ATS scoring, bias detection.
6. **Persist** — Full analysis JSON written to PostgreSQL via Prisma, cached in Redis. Emits `COMPLETE`.

## Data Flow — Bulk Ranking

User uploads up to 500 resumes + one JD. API creates a `batch_job` record and fans out individual parse tasks. A coordinator Celery task waits for all to finish (Redis counters), computes composite ranking scores, writes ranked list to PostgreSQL via Prisma, and notifies frontend.

---

## Database Schema (Prisma)

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  resumes   Resume[]
  batches   BatchJob[]
  sessions  CoachingSession[]
}

model Resume {
  id           String        @id @default(uuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id])
  filePath     String
  fileType     String
  fileHash     String
  status       UploadStatus  @default(PENDING)
  createdAt    DateTime      @default(now())
  analysis     ResumeAnalysis?
  matchResults JdMatchResult[]
}

model ResumeAnalysis {
  id              String   @id @default(uuid())
  resumeId        String   @unique
  resume          Resume   @relation(fields: [resumeId], references: [id])
  entitiesJson    Json
  atsScore        Int
  atsBreakdown    Json
  biasFlagsJson   Json
  createdAt       DateTime @default(now())
}

model JobDescription {
  id             String          @id @default(uuid())
  userId         String
  title          String
  rawText        String
  embeddingVector Float[]
  createdAt      DateTime        @default(now())
  matchResults   JdMatchResult[]
}

model JdMatchResult {
  id               String         @id @default(uuid())
  resumeAnalysisId String
  jobDescriptionId String
  matchScore       Float
  matchedSkills    Json
  gapSkills        Json
  createdAt        DateTime       @default(now())
  jobDescription   JobDescription @relation(fields: [jobDescriptionId], references: [id])
  resume           Resume         @relation(fields: [resumeAnalysisId], references: [id])
}

model BatchJob {
  id              String      @id @default(uuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id])
  totalCount      Int
  completedCount  Int         @default(0)
  status          BatchStatus @default(IN_PROGRESS)
  rankedResults   Json?
  createdAt       DateTime    @default(now())
}

model CoachingSession {
  id               String   @id @default(uuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id])
  resumeAnalysisId String?
  messages         Json
  createdAt        DateTime @default(now())
}

enum UploadStatus { PENDING PARSING ANALYZED FAILED }
enum BatchStatus  { IN_PROGRESS COMPLETE FAILED }
```

---

## API Endpoints

All endpoints require JWT auth except `/health`.

**Resumes:** `POST /upload` · `GET /{id}` · `GET /{id}/analysis` · `DELETE /{id}`

**Job Descriptions:** `POST /jds` · `GET /jds/{id}` · `POST /jds/{id}/match/{resume_id}`

**Batches:** `POST /batches` · `POST /batches/{id}/upload` · `GET /batches/{id}/status` · `GET /batches/{id}/rankings`

**Coaching:** `POST /coaching/sessions` · `POST /coaching/sessions/{id}/messages` · `GET /coaching/sessions/{id}`

**Exports:** `GET /resumes/{id}/export/pdf` · `GET /batches/{id}/export/csv`

### WebSocket Events (`ws://api/ws/jobs/{job_id}`)

| Event | When |
|-------|------|
| `JOB_STARTED` | Worker picks up task |
| `PARSING_COMPLETE` | Text extracted |
| `ENTITIES_READY` | NER done |
| `ANALYSIS_READY` | ML scoring done |
| `COMPLETE` | Full result ready |
| `ERROR` | Any failure |

---

## Caching

- **File hash cache** (Redis, 24h TTL) — same file uploaded twice skips the whole ML pipeline.
- **Embedding cache** (Redis, 7d TTL) — JD text embedded once, reused across all resumes in a batch.

---

## Failure Handling

Celery auto-retries on transient errors with exponential backoff: 3 retries at 30s → 120s → 480s.
