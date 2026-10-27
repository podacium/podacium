# Phase 4: Instructor Tools — Gradebook & Assignments

**Priority:** P3 (institutional, post-launch)  
**Target Score:** 90/100 tech  
**Dependencies:** Phase 1 (router decomposition), Phase 3 (AI moderation for assignment grading)

---

## Overview

Phase 4 builds the grading and assessment tools instructors need for institutional credibility: gradebook, assignment submission, and instructor analytics. These are **not launch-critical** — the business plan launches September 23 with course consumption, quizzes, and certificates. Gradebook and assignments ship post-launch when the first instructor cohort requests them.

**Business plan alignment:** Section 4.2 defines the Education pillar feature set. Gradebook and assignments support the "instructor dashboard" identified as P0, but the dashboard itself (revenue, enrollments) is higher priority than gradebook. Build revenue dashboard first, gradebook second.

**Algerian grading context:** Universities use a 0-20 scale. Grade categories must support the TD (tutorial) + TP (practical) + Exam three-component model. Pass threshold defaults to 10/20 (50%).

### Why These Four Features

| Feature | Student Need | Instructor Need | Institutional Need |
|---------|-------------|----------------|-------------------|
| **Gradebook** | "What's my current grade?" | "I need to grade fairly" | Accreditation requires grade records |
| **Assignments** | "How do I submit my work?" | "I need to collect and grade work" | Assessment audit trail |
| **Live Events** | "I learn better in real-time" | "I need to teach synchronously" | Not launch-critical but P1 differentiator |
| **Instructor Dashboard** | — | "How are my students performing?" | Faculty performance metrics |

### Architecture Decisions Register

| Decision | Option Chosen | Alternatives Rejected | Rationale |
|----------|--------------|----------------------|-----------|
| Grade calculation engine | Weighted average server-side | Client-side calculation | Prevents grade manipulation. Single source of truth. |
| Assignment file storage | Existing `file_service` + S3 | Direct upload to S3 | Reuse existing auth, virus scanning, CDN signing. |
| Live classroom provider | LiveKit Cloud (MVP) → Self-hosted (scale) | 100ms, Zoom API | Skip Daily.co detour. LiveKit-native from day one for data sovereignty + marketplace features. |
| Attendance tracking | Webhook-based from provider | Polling, client-side | Webhooks are reliable, avoid race conditions. |
| Instructor dashboard data | Aggregated queries (no caching) | Redis-cached pre-computed | Low traffic initially. Cache later when performance demands it. |

---

## Section 1: Gradebook System (Week 4)

### 1.1 What It Does

A weighted gradebook where instructors define categories (e.g., "Quizzes" = 30%, "Assignments" = 40%, "Final" = 30%) and enter scores per student. The system calculates weighted averages, produces letter grades, and exports to CSV.

### 1.2 Data Model

Three new Prisma models:

**`GradeCategory`** — Belongs to a Module. Defines a grading bucket with a name and weight.
- `moduleId` → Module
- `name` (string) — e.g., "Homework", "Midterm Exam"
- `weight` (float) — e.g., 0.3 for 30%
- Unique constraint: `[moduleId, name]` — no duplicate category names per course

**`GradebookEntry`** — Belongs to an Enrollment + Category. A single score.
- `enrollmentId` → Enrollment
- `categoryId` → GradeCategory
- `score` (float) — actual points earned
- `maxScore` (float) — maximum possible points
- `gradedBy` (int?) — instructor user ID
- `feedback` (string?) — instructor comments

**`Rubric` + `RubricCriterion`** — Optional grading rubric for assignments/lessons.
- Rubric has a `lessonId`, name, and multiple criteria
- Each criterion has `name`, `maxPoints`, `description`
- Used by the grading UI to guide consistent scoring

### 1.3 Grade Calculation Algorithm

```
For each enrollment in a course:
  1. Group GradebookEntries by GradeCategory
  2. For each category:
     - Calculate category_pct = sum(scores) / sum(maxScores) * 100
     - weighted_contribution = category_pct * category.weight
  3. Overall = sum(weighted_contributions) / sum(weights)
  4. Letter grade mapping:
     - 90-100: A, 80-89: B, 70-79: C, 60-69: D, <60: F
```

### 1.4 Edge Cases

| Scenario | Handling |
|----------|----------|
| **No entries exist** | Return 0% with "no grades yet" status |
| **Category has weight but no entries** | Exclude that category from calculation (weight redistributed proportionally) |
| **Weights don't sum to 100%** | Normalize: divide each contribution by `sum(weights)` |
| **Score exceeds maxScore** | Cap at 100% with warning to instructor |
| **Multiple instructors grade same student** | Last update wins (tracked by `gradedBy` and `updatedAt`) |
| **Student not enrolled anymore** | Grade is preserved but marked inactive |
| **Late submissions need retroactive grading** | Gradebook allows edit at any time (audit log tracks changes) |

### 1.5 API Endpoints (New Sub-router: `gradebook.py`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/education/grades/{enrollment_id}` | Student | Get my grade for a course (weighted average, letter, per-category breakdown) |
| GET | `/education/grades/course/{module_id}` | Instructor | Gradebook grid — all students × all categories |
| POST | `/education/grades/{enrollment_id}` | Instructor | Create/update a single grade entry |
| POST | `/education/grades/bulk/{module_id}` | Instructor | Bulk grade update (CSV or JSON array) |
| GET | `/education/grades/export/{module_id}` | Instructor | Download grades as CSV |
| POST | `/education/grades/categories` | Instructor | Create grade category |
| PUT | `/education/grades/categories/{id}` | Instructor | Update category weight/name |
| DELETE | `/education/grades/categories/{id}` | Instructor | Delete category (requires migration of entries) |
| GET | `/education/grades/rubrics/{lesson_id}` | Both | Get rubric for lesson |
| POST | `/education/grades/rubrics/{lesson_id}` | Instructor | Create/update rubric |

### 1.6 Frontend Components (New Routes)

**Instructor gradebook:**
- Route: `/instructor/grades/{moduleId}`
- Grid view: students as rows, categories as columns, editable cells
- Category manager sidebar: add/edit/delete categories
- CSV import/export buttons
- Rubric editor per lesson

**Student grade view:**
- Route: `/learn/courses/{id}/grades`
- Shows overall grade (big number + letter) + per-category breakdown as progress bars
- Each category shows individual entries (quiz scores, assignment scores)

### 1.7 Integration Points

| Integration | What It Does | Existing Code |
|-------------|-------------|---------------|
| **Quiz auto-grading** | When quiz is submitted, auto-create GradebookEntry in "Quizzes" category | `quiz_service.submit_attempt()` calls `gradebook_service.auto_grade_quiz()` |
| **Assignment grading** | When instructor grades submission, auto-create/update GradebookEntry | `assignment_service.grade_submission()` calls `gradebook_service.upsert_grade()` |
| **Notification** | Notify student when grade is posted | Send via existing `notification_service` |

### 1.8 Testing Focus

| Test | Scenario |
|------|----------|
| Weighted average with 2 categories | 30% quizzes (85 avg) + 70% exam (75) = 78% |
| Weight normalization | Categories weigh [0.4, 0.4] (sum 0.8) → normalized to [50%, 50%] |
| Missing category | Only 2 of 3 categories have entries |
| Score exceeds max | Score 110 / max 100 → capped at 100% |
| Letter grade boundaries | 89.9% → B, 90.0% → A |
| CSV export format | Headers match gradebook columns |
| Bulk import validation | Invalid rows rejected, valid rows processed |

---

## Section 2: Assignment Submission System (Week 5)

### 2.1 What It Does

Instructors create assignments with deadlines, file type restrictions, and rubrics. Students upload files or write responses. Instructors grade with scores and feedback. Late submissions are penalized automatically.

### 2.2 Data Model

Two new Prisma models:

**`Assignment`** — Belongs to a Lesson. Defines the task.
- `lessonId` → Lesson
- `title`, `description`, `instructions`
- `dueDate` (datetime?) — if null, no deadline
- `latePenaltyPct` (float?) — e.g., 0.1 = 10% per day late
- `maxFileSize` (int) — default 50MB
- `allowedFileTypes` (string[]) — e.g., ["pdf", "docx", "zip"]
- `maxScore` (float) — default 100

**`Submission`** — One per student per assignment (upsert).
- `assignmentId` → Assignment
- `userId` → User
- `fileUrl`, `fileType`, `fileSize` — uploaded file metadata
- `comment` (string?) — student's submission note
- `status` — enum: submitted | late | graded | returned
- `score` (float?) — instructor grade
- `feedback` (string?) — instructor comments
- `gradedBy`, `gradedAt` — grading metadata
- Unique constraint: `[assignmentId, userId]`

### 2.3 Late Penalty Algorithm

```python
def apply_late_penalty(submitted_at, due_date, late_penalty_pct, raw_score):
    if not due_date or submitted_at <= due_date:
        return raw_score, "on_time"
    
    days_late = max(0, (submitted_at - due_date).days)
    if days_late == 0:
        return raw_score, "late_same_day"
    
    penalty = min(1.0, days_late * late_penalty_pct)  # Max 100% penalty
    final_score = max(0, raw_score * (1.0 - penalty))
    return final_score, f"late_{days_late}d"
```

### 2.4 File Upload Flow

```
1. Student submits via multipart POST /education/assignments/{id}/submit
2. Router validates: file type allowed, file size within limit, deadline not passed (or flag as late)
3. Upload to existing file_service → S3 with signed URL
4. Create/update Submission record
5. If past due: calculate late penalty, store base_score + penalized_score
6. Notify instructor via notification_service
7. Return submission details
```

### 2.5 Edge Cases

| Scenario | Handling |
|----------|----------|
| **Student submits multiple times** | Upsert — only latest submission is kept. Previous files are garbage-collected. |
| **Deadline passes while uploading** | Check deadline at submission start, not upload end. Grace period of 60 seconds. |
| **File type spoofing** | Validate MIME type server-side (not just extension). Reuse `file_validation_service`. |
| **Assignment has no due date** | No late penalty. Status is always "submitted" until graded. |
| **Instructor re-grades** | Submission gradedAt is updated. Gradebook entry is updated. Previous grade is logged in audit trail. |
| **Student unenrolled mid-course** | Submissions preserved but marked inactive. No new submissions allowed. |

### 2.6 Frontend Components

**Instructor:**
- Assignment creation form: rich text for instructions, file type selector, due date picker with timezone
- Submission list: table with student name, status badge (submitted/late/graded), submission date, grade column
- Grading panel: view submission file inline (PDF/image preview), score input, feedback text box, rubric checklist

**Student:**
- Assignment detail page: instructions, due date countdown, file uploader (drag-and-drop), submission history
- Status indicator: "Not submitted" → "Submitted" → "Late" → "Graded"
- Grade display: score + feedback + rubric scores

### 2.7 Integration Points

| Integration | What It Does |
|-------------|-------------|
| **Gradebook** | Grading a submission auto-creates GradebookEntry in default "Assignments" category |
| **File service** | Reuse existing `file_service` for upload, virus scanning, CDN signing |
| **Notification** | Email/push notification to student when graded; to instructor when submitted |
| **Calendar** | Assignment due dates appear on student dashboard calendar (existing dashboard) |

---

> **Live Classroom has been replaced by the Live Events Marketplace.**  
> See the comprehensive plan at: [`docs/live-sessions-implementation.md`](/docs/live-sessions-implementation.md)  
> Priority: **P1** (post-launch differentiator) — revenue-generating, not just an add-on.

### 3.5 Webhook Flow: Attendance Tracking (LiveKit)

LiveKit sends webhooks for room events. Backend exposes a single `POST /webhooks/livekit` endpoint:

```
1. Backend creates LiveKit room via REST API + stores LiveSession row
2. Student clicks "Join" → backend validates → returns JWT token
3. Frontend connects using @livekit/components-react with token
4. LiveKit fires webhook POST /webhooks/livekit (participant_joined):
   {
     "event": "participant_joined",
     "room": { "name": "module-abc-123", "sid": "RM_..." },
     "participant": { "identity": "user-42", "name": "Ahmed" }
   }
5. Backend creates/updates SessionAttendance record (joinedAt = now)
6. When student leaves, LiveKit fires webhook (participant_left):
   {
     "event": "participant_left",
     "participant": { "identity": "user-42", "duration": 1847 }
   }
7. Backend updates leftAt + stores duration in SessionAttendance
8. Instructor queries attendance via GET /education/live-sessions/{id}/attendance
```

**Webhook signature verification:**
LiveKit signs each webhook with `HMAC-SHA256` using the API secret. The backend verifies the `Authorization: Bearer <hmac>` header against a recomputed hash of the request body before processing. Failed signatures return 401 and are logged for audit. LiveKit retries failed webhooks with exponential backoff (up to 5 retries within 10 minutes).

### 3.6 Frontend Architecture (LiveKit Native)

All components use `@livekit/components-react` and `livekit-client`. No iframes.

**Core files under `apps/web/src/components/live/`:**
```
live/
├── LiveSessionProvider.tsx         # React context: holds Room, connection state
├── PreJoinForm.tsx                 # Mic/camera preview before joining (w/ Arabic labels)
├── VideoConference.tsx             # Main grid: participant tiles, active speaker
├── ParticipantTile.tsx             # Single participant: video, name badge, mic icon
├── ChatSidebar.tsx                 # In-session text chat (RTL-aware)
├── ScreenShareOverlay.tsx          # Full-screen screen share view
├── RecordingIndicator.tsx          # Red dot when recording
├── ConnectionStatus.tsx            # Signal strength indicator
├── AudioOnlyToggle.tsx             # Bandwidth-saving audio-only mode
├── HandRaiseButton.tsx             # Hand raise with animation
└── LiveKitRoom.tsx                 # Wrapper: connects Room, handles disconnect
```

**Key page layouts:**

**Session lobby** (`/learn/sessions/{id}`): Two-phase layout. Phase 1 (pre-join): mic/camera preview with device selector and name input. Phase 2 (in-session): full video grid with sidebar. RTL-aware layout uses `flex-direction: row-reverse` for the sidebar and mirrored participant list ordering.

**Live player** (within lobby): Wraps `LiveKitRoom` with `connect={true}` and `adaptiveStream: true`. Child components (`VideoConference`, `ChatSidebar`) are arranged in a responsive flex container that respects `dir="rtl"`. The container collapses the sidebar below the video grid on screens < 768px for mobile/PWA support.

### 3.7 Edge Cases

| Scenario | Handling |
|----------|----------|
| **Student joins before instructor** | Default — all participants enter same room. Instructor gets "moderator" grant (`canPublish: true, canMute: true`); students get `canPublish: false` until instructor promotes them. |
| **More attendees than maxAttendees** | Reject with 429 "Session full" in `/join` endpoint (check count via LiveKit `ListParticipants` API before issuing token). |
| **Network drops during session** | `livekit-client` auto-reconnects with exponential backoff. `adaptiveStream: true` downgrades video quality. Browser fires `pagehide` event to track intentional leaves. |
| **Recording fails** | LiveKit's egress (recording) writes directly to S3. Failure notification via webhook (`egress_ended` with error). Celery retry task re-triggers egress. |
| **Session over, student tries to join** | Backend checks `endTime` before issuing token — returns 410 "Session ended" + recording link if available. |
| **Timezone confusion** | All times stored in UTC. Frontend renders `startTime` in user's locale via `useTranslation()` + `date-fns-tz`. |
| **Webhook delivery failure** | LiveKit retries webhooks with exponential backoff (up to 5 times). If still failing, poll `ListParticipants` API every 60s as fallback. |
| **Student on 2G connection** | Default to audio-only. `AudioOnlyToggle` lets student disable video. `adaptiveStream: true` + simulcast layers (q/h/f) let LiveKit send lowest bitrate. |
| **Participant list empty on reconnect** | After network reconnect, call `Room.getAllParticipants()` and reconcile with local state in `LiveSessionProvider`. |

### 3.8 LiveKit Cloud → Self-Hosted Cutover Checklist

| Step | Detail |
|------|--------|
| **1. DNS** | Create `livekit.podacium.com` CNAME → LiveKit Cloud (launch) → update to self-hosted LB (scale) |
| **2. Env vars** | `LIVEKIT_URL=wss://livekit.podacium.com` stays the same; only `API_KEY`/`API_SECRET` rotate |
| **3. Recording** | LiveKit Cloud records to their S3 → Self-hosted records to your S3 — update `egress.s3` config |
| **4. TURN** | Self-hosted needs TURN servers for NAT traversal (LiveKit Cloud includes this) — deploy `livekit/turn` container on same K8s cluster |
| **5. Webhook URL** | Update LiveKit webhook target from cloud dashboard → self-hosted ingress |
| **6. Verification** | Join a test session, verify audio/video, verify attendance webhook, verify recording |
| **7. Rollback** | Keep LiveKit Cloud API keys in secrets manager — swap back in 2 minutes if issues arise |

### 3.9 Frontend Components

- **Session calendar** (`/learn/live`): Calendar view of upcoming sessions per course
- **Session lobby** (`/learn/sessions/{id}`): Countdown timer, session info, materials download, "Join Session" button, PreJoinForm
- **Live player** (within lobby): `LiveKitRoom` + `VideoConference` + `ChatSidebar` — all LiveKit native, RTL-aware
- **Recording player**: Video.js player with HLS recording stream from S3
- **Attendance report** (`/instructor/sessions/{id}/attendance`): Table of students, join/leave times, duration, export CSV
- **Instructor controls**: Mute all, spotlight participant, end session for all, lock room, start recording

### 3.10 MENA Considerations

| Factor | Decision |
|--------|----------|
| **Data sovereignty** | LiveKit Cloud (launch) → Self-host on AWS Bahrain or OVHcloud Algeria (scale). All recording data stays in-region. |
| **Bandwidth** | Default to audio-only on slow connections. `adaptiveStream: true` + LiveKit simulcast (q/h/f layers). Student can toggle video on. |
| **Arabic/RTL UI** | `@livekit/components-react` is headless — all labels, layouts, and icons are custom components with `dir="rtl"` and `useTranslation()` for i18n. No iframe to fight with. |
| **Recording storage** | S3-compatible storage with CloudFront CDN. LiveKit egress writes directly to S3 bucket. Recording accessible post-session via signed URLs. |
| **Cost at scale** | Self-hosted on 2x `c5.2xlarge` + EBS = ~$400/mo for 500k MAU. No per-minute fees. TURN relay adds minimal egress cost (~$50/mo for 95% peer-to-peer). |

---

## Section 4: Instructor Dashboard (Week 8)

### 4.1 What It Does

A dedicated dashboard for course creators showing:
- **Overview:** total enrollments, revenue, average completion rate, active students
- **Course analytics:** per-course breakdown, enrollment trends over time
- **Student engagement:** which students are active, which are at risk of dropping out
- **Content performance:** which lessons have the highest drop-off rates

### 4.2 Data Sources

| Metric | Source | Aggregation |
|--------|--------|-------------|
| **Enrollments** | `Enrollment` table | COUNT, grouped by course, by date |
| **Revenue** | `Transaction` table | SUM(amountCents), grouped by course, month |
| **Completion rate** | `Enrollment.progress` | AVG, grouped by course |
| **Lesson completion** | `LessonProgress` table | COUNT, grouped by lesson within course |
| **Quiz scores** | `QuizAttempt` table | AVG score, grouped by quiz/course |
| **Active students** | `Enrollment.updatedAt` | COUNT where updated in last 7 days |
| **Drop-off points** | `LessonProgress` | Identify where progress stops (max lesson completed per student) |

### 4.3 API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/education/instructor/courses` | List my courses with key stats (enrollments, revenue, completion) |
| GET | `/education/instructor/courses/{id}/analytics` | Deep dive: trends, engagement, drop-off |
| GET | `/education/instructor/revenue` | Revenue report: by course, by month, totals |
| GET | `/education/instructor/students/{courseId}` | Per-student progress table |
| GET | `/education/instructor/content/{courseId}` | Lesson-by-lesson drop-off analysis |

### 4.4 Frontend Components

- **Overview cards**: Enrollments (total + this month), Revenue (total + trend), Active students, Completion rate
- **Enrollment chart**: Line chart (recharts) — enrollments over time with course breakdown
- **Revenue chart**: Bar chart — monthly revenue, stacked by course
- **Completion funnel**: Bar chart — enrollment → started first lesson → 25% → 50% → 75% → completed
- **Student table**: Searchable table with student name, enrollment date, progress %, last active, quiz avg
- **Content drop-off**: Horizontal bar chart — each lesson shows % who reached it vs. % who completed it

---

## Phase 2 Success Criteria

- [ ] Gradebook schema (GradeCategory, GradebookEntry, Rubric, RubricCriterion) migrated
- [ ] Weighted grade calculation tested for all edge cases
- [ ] CSV grade export with correct formatting
- [ ] Assignment schema (Assignment, Submission) migrated
- [ ] File upload with type/size validation, S3 storage
- [ ] Late penalty calculation tested (1 day, 7 days, no due date)
- [ ] Live Sessions schema (LiveSession, LiveSessionParticipant, LiveSessionBooking) migrated
- [ ] LiveKit Cloud room creation + JWT token flow working end-to-end
- [ ] Webhook-based attendance tracking with retry logic
- [ ] Booking flow (100 DZD minimum via Chargily)
- [ ] Instructor dashboard with real aggregated data from existing tables
- [ ] All new endpoints use Phase 1 exception hierarchy
- [ ] All new features behind feature flags
- [ ] Tests covering gradebook (10+), assignments (8+), live sessions (6+), dashboard (5+)
- [ ] Frontend routes for gradebook, assignments, live events, instructor dashboard
- [ ] No breaking changes to existing endpoints
