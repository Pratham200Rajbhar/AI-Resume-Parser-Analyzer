---

## Phase 1 — Fix Foundations

**Prompt 1: Workspace DB Persistence**
```
Migrate the Workspace Kanban board from localStorage to PostgreSQL. Create a `workspace_candidates` table in Prisma with fields: id, userId, resumeId, name, atsScore, matchScore, topSkills (JSON), notes, column, position, createdAt, updatedAt. Add REST endpoints: GET/POST /api/v1/workspace/candidates, PATCH /api/v1/workspace/candidates/:id (for column/notes/position updates), DELETE /api/v1/workspace/candidates/:id. Also add a `workspace_columns` table so users can create custom columns beyond the default 4. Update the frontend WorkspacePage to fetch from API instead of localStorage, keep optimistic UI updates, and remove all localStorage references.
```

**Prompt 2: Settings & Profile Page**
```
Create a /dashboard/settings page with 4 tabs: Profile (name, email, avatar upload, change password), Notifications (toggle email alerts per event type: analysis complete, batch done, deadline reminder), API Keys (generate/revoke personal API tokens shown once), and Preferences (default LLM provider selector between OpenAI and Anthropic, default export format). Add backend endpoints: GET/PATCH /api/v1/auth/me for profile, GET/POST/DELETE /api/v1/auth/api-keys for key management, GET/PATCH /api/v1/auth/preferences for user preferences. Store preferences in a new `user_preferences` table in Prisma.
```

**Prompt 3: JD Detail Page**
```
Create a /dashboard/jds/[id] page showing: the full job description text in a readable format, extracted skills and requirements (run JD through spaCy NER if not already parsed), an edit mode to update title/company/text and re-run all existing matches, and a "Matched Resumes" section listing every resume ever matched against this JD sorted by score with date. Add a GET /api/v1/jds/:id/matches endpoint that returns all historical match results for that JD. Update the JD cards on the list page to link to this detail page.
```

**Prompt 4: JD URL Importer**
```
Add a URL import option to the Add JD dialog. When a URL is pasted, call a new POST /api/v1/jds/import-url endpoint that fetches the page, strips HTML using readability/trafilatura, extracts job title, company, and description text, and returns a prefilled preview. The user can edit before saving. Handle LinkedIn, Indeed, Greenhouse, Lever, and Workday URLs. Show a loading state while fetching and a clear error if the URL is blocked or unreadable.
```

**Prompt 5: Resume List — Server-side Sorting & Bulk Actions**
```
Move resume filtering and sorting to the backend. Add query params to GET /api/v1/resumes: sortBy (fileName, atsScore, createdAt, status), sortOrder (asc/desc), and status filter. On the frontend, add sortable column headers with direction indicators, and a bulk selection mode with a checkbox column. Bulk actions: delete selected, export selected as CSV (fileName, status, atsScore, createdAt). Add a "Columns" button to show/hide optional columns (fileSize, analysisDate).
```

## Phase 2 — Core Value

**Prompt 6: Analytics Dashboard**
```
Replace the /dashboard overview with a real analytics page. Use Recharts. Include: an ATS score trend line showing average score per week over the last 3 months, a bar chart of resume count by status (analyzed/pending/failed), a horizontal bar chart of the top 15 most common skills across all analyzed resumes, a score distribution histogram (buckets: 0-20, 20-40, 40-60, 60-80, 80-100), and a stat row showing total resumes, average ATS score, highest score this month, and active coaching sessions. All charts pull from a new GET /api/v1/analytics/summary endpoint.
```

**Prompt 7: Inline Bullet Rewriter**
```
On the resume detail page, after the Extracted Information panel, add an "Experience Bullets" section that lists every bullet point from the resume's experience entries. For each bullet, run a quality check client-side: flag it red if it has no metric/number, yellow if it uses passive voice or weak verbs (was, helped, assisted, worked on). Show a "Rewrite" button on flagged bullets. On click, call POST /api/v1/resumes/:id/rewrite-bullet with the bullet text and receive 3 AI alternatives with a brief reason for each. The user picks one, edits if needed, and saves it. Saved rewrites are stored in a `resume_rewrites` table and shown with a "Rewritten" badge.
```

**Prompt 8: Smart Score Explainer**
```
Enhance the ATS Score Breakdown section on the resume detail page. Below each breakdown category (formatting, keywords, readability, etc.), add an expandable "Why this score?" panel. It should list the specific issues found (e.g. "Missing LinkedIn URL", "3 bullet points have no quantifiable result", "Date format inconsistent in 2 places") each tagged as easy/medium/hard to fix, with an estimated point gain if fixed. Add a "Fix progress" bar at the top showing X of Y issues resolved. When a user applies a rewrite or edits their resume version, auto-recheck the relevant issues and mark them resolved.
```

**Prompt 9: Resume Version History**
```
Add version support to resumes. When uploading a new resume, show a prompt: "Is this a new version of an existing resume?" with a dropdown to select the original. Store versions linked by a `parentResumeId` foreign key. Create a /dashboard/resumes/[id]/versions page showing a timeline of all versions with their ATS scores, upload dates, and a diff view comparing extracted text between any two versions side by side. Show score delta badges (+12, -3) between consecutive versions. The resume detail page should show a "View all versions" link if versions exist.
```

**Prompt 10: Batch Page Improvements**
```
Improve the /dashboard/batch page and add a /dashboard/batch/[id] detail page. The detail page should show: a score distribution chart for the batch, a full sortable and filterable ranked table (filter by min score, skill presence), a "Shortlist top N" button that pushes selected candidates directly to the Workspace Kanban as a new column, CSV export of all rankings, and a comparison mode to run the same batch against a second JD side by side. Add a progress indicator for in-progress batches using the existing WebSocket.
```

## Phase 3 — Growth Features

**Prompt 11: Cover Letter Generator Page**
```
Create a /dashboard/cover-letters page. The generator form has: resume selector (analyzed only), JD selector, tone dropdown (professional/conversational/enthusiastic/concise), and length selector (short 150w/standard 300w/detailed 500w). On generate, call POST /api/v1/coaching/cover-letter which uses the resume entities and JD text as context and returns a structured cover letter. Display it in a rich text editor (use TipTap or similar). Allow paragraph-level AI suggestions via a right-click menu. Save generated letters to a `cover_letters` table linked to resume and JD. List saved letters in a sidebar. Export as DOCX or copy to clipboard.
```

**Prompt 12: Application Tracker**
```
Create a /dashboard/applications page. Each application record has: company name, job title, linked JD (optional), linked resume, application date, deadline, current stage (Saved/Applied/Phone Screen/Interview/Offer/Rejected), and notes. Display as a Kanban board with columns per stage. Store in a `job_applications` table in PostgreSQL. Show a deadline badge in red when within 3 days. Add a dashboard widget on the overview page showing count of active applications by stage. Add GET/POST/PATCH/DELETE /api/v1/applications endpoints. Include a calendar view toggle showing upcoming deadlines.
```

**Prompt 13: Interview Prep Module**
```
Create a /dashboard/interview-prep page. The user selects a resume and optionally a JD, then clicks Generate. Call POST /api/v1/coaching/interview-questions which returns 10 questions categorized as behavioural, technical, or situational, each with a STAR-format answer template pre-filled with details from the resume. Display in an accordion list. Add a Practice Mode where the user types their answer and submits for AI feedback on clarity, specificity, and use of metrics. Show a score 1-10 per answer with improvement notes. Save practiced answers. Export the full prep sheet as PDF using the existing PDF export service.
```

**Prompt 14: Global Search**
```
Add a global Cmd+K / Ctrl+K search palette. It searches across: resume file names and extracted candidate names, JD titles and companies, coaching session titles and message content, and application tracker entries. Backend: add GET /api/v1/search?q=&types= endpoint that queries all four tables and returns grouped results with type labels. Frontend: a full-screen modal overlay with a search input, grouped results list with keyboard navigation (arrow keys, Enter to navigate, Escape to close). Show a recent history of last 5 searches. Trigger from the header search icon as well.
```

**Prompt 15: Notification System**
```
Add an in-app notification system. Create a `notifications` table: id, userId, type, title, body, read, link, createdAt. Types: ANALYSIS_COMPLETE, BATCH_COMPLETE, DEADLINE_REMINDER, COACH_INACTIVE, WEEKLY_DIGEST. Add a bell icon to the header with unread count badge. Clicking opens a dropdown panel with the last 20 notifications, mark-all-read button, and links to relevant pages. Add GET /api/v1/notifications, PATCH /api/v1/notifications/:id/read, PATCH /api/v1/notifications/read-all endpoints. Trigger notifications from existing Celery tasks on analysis/batch completion. Add a 24h deadline reminder Celery beat task for applications.
```

**Prompt 16: Multi-format Export**
```
Expand export options across the app. On the resume detail page, replace the single PDF export button with an Export dropdown: PDF (existing), DOCX (structured report with headings and tables), JSON (raw analysis data), and Share Link (see prompt below). On the resumes list, add bulk CSV export. On the batch detail page, add CSV export of rankings. For DOCX, use python-docx on the backend via a new POST /api/v1/resumes/:id/export?format=docx endpoint. For JSON, return the full analysis object. Add a download handler in the frontend that calls the correct endpoint per format and triggers browser download.
```

## Phase 4 — Scale

**Prompt 17: Public Share Links**
```
Add shareable read-only analysis reports. Add a `share_links` table: id, resumeId, token (nanoid 12 chars), visibleSections (JSON array), passwordHash (nullable), expiresAt (nullable), viewCount, createdAt. Add endpoints: POST /api/v1/resumes/:id/share (create link with options), GET /api/v1/share/:token (public, no auth), DELETE /api/v1/resumes/:id/share/:token. Create a public route /share/[token] that renders the analysis report without sidebar/header, showing only the sections the owner enabled. On the resume detail page, add a Share button that opens a dialog to configure visibility, expiry, and optional password.
```

**Prompt 18: Team & Recruiter Mode**
```
Add multi-user team support. Create `teams`, `team_members` (userId, teamId, role: owner/admin/reviewer/viewer), and migrate JDs, workspace candidates, and batch jobs to be team-scoped with a teamId. Add a /dashboard/settings/team page for: inviting members by email (sends invite link), managing roles, viewing member activity log. Shared resources (JDs, workspace, batches) should be visible to all team members based on role. Viewers can only read; reviewers can add notes; admins can modify; owners can delete and manage billing. Add GET/POST/DELETE /api/v1/teams and /api/v1/teams/:id/members endpoints.
```