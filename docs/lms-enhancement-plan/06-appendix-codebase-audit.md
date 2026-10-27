# Appendix: Current Codebase Audit

**Last Updated:** June 2026  
**Scope:** `services/api/` (backend) and `apps/web/` (frontend)

---

## A.1 Backend Overview

### A.1.1 Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Framework** | FastAPI | 0.115.0 | Async, Pydantic v2 |
| **ASGI Server** | Uvicorn | 0.24.0 | |
| **ORM** | Prisma (Python) | 0.11.0 | Async, auto-generated client |
| **Database** | PostgreSQL 16 | — | Via docker-compose |
| **Cache/Queue** | Redis 7 | — | Via docker-compose |
| **Task Queue** | Celery | 5.3.6 | Redis broker + backend |
| **Auth** | PyJWT + Passlib (Argon2) | — | JWT with RSA/HS256 |
| **Testing** | pytest | 8.3.4 | pytest-asyncio, hypothesis |
| **Linting** | ruff, mypy | — | |
| **Monitoring** | Sentry, Prometheus | — | Sentry for errors, Prometheus for metrics |

### A.1.2 Application Structure

```
services/api/app/
├── main.py              # FastAPI app creation, middleware, routes
├── startup.py           # Lifespan: DB connect, Sentry, background tasks, production guards
├── routes.py            # Centralized router registration
├── core/                # Config, auth, security, Prisma client, Celery, logging
├── routers/             # 30+ route files including bi_routers/
├── schemas/             # Pydantic models per domain
├── services/            # 45 service files (business logic)
├── tasks/               # 12 Celery task files + 2 async background loops
├── middleware/          # CORS, CSRF, rate limiting, security headers, idempotency
├── utils/               # Rate limiters, helpers
└── generated/           # Auto-generated Prisma client
```

### A.1.3 Routers Inventory

| Router | File | Endpoints | Auth Pattern |
|--------|------|-----------|-------------|
| Auth | `auth.py` | ~15 | None (login, register) + JWT (profile) |
| Users | `users.py` | ~10 | JWT required |
| **Education** | **`education.py`** | **46** | **Mixed (see Phase 1)** |
| Organizations | `organizations.py` | ~15 | JWT + role checks |
| Freelancing | `freelancing.py` | ~15 | JWT |
| BI (sub-routers) | `bi_routers/*.py` | ~50 | JWT + organization checks |
| Payments | `payment.py` | ~8 | JWT + webhooks |
| Files | `files.py` | ~5 | JWT |
| Notifications | `notifications.py` | ~12 | JWT |
| Admin | `admin.py` | ~20 | Admin role |
| Content Moderation | `content_moderation.py` | ~10 | Instructor/Admin |
| +16 more | | | |

### A.1.4 Services Inventory (45 files)

Key services relevant to the LMS enhancement plan:

| Service | File | Lines | Purpose |
|---------|------|-------|---------|
| Education Service | `education_service.py` | 2,394 | Core LMS logic (modules, paths, enrollments, lessons, progress, recommendations, search) |
| Quiz Service | `quiz_service.py` | 370 | Quiz attempt lifecycle, auto-grading (5 question types), cooldown enforcement |
| Content Moderation | `content_moderation_service.py` | 849 | DRAFT→IN_REVIEW→PUBLISHED workflow, completeness scoring |
| Certificate Service | `certificate_service.py` | — | Certificate generation (PDF via ReportLab) |
| Notification Service | `notification_service.py` | 1,138 | Multi-channel (in-app, email, push stubbed), rate limiting, caching |
| File Service | `file_service.py` | — | Upload to S3, signed URLs, size/type validation |
| Email Service | `email_service.py` | — | SMTP email sending |

### A.1.5 Background Tasks (14 files)

| Task File | Tasks | Schedule |
|-----------|-------|----------|
| `cleanup_tasks.py` | 4 (expired verifications, entitlements, tokens, idempotency keys) | Daily/Hourly |
| `financial_tasks.py` | 4 (escrow, payouts, subscriptions, dunning) | Hourly/15min |
| `education_tasks.py` | 1 (bulk certificate generation) | On demand (`.delay()`) |
| `video_tasks.py` | 1 (transcode status check, 60 retries) | On demand |
| `support_tasks.py` | 3 (SLA breaches, CSAT surveys, auto-close) | 15min/hourly |
| `dispute_tasks.py` | 1 (auto-resolution) | Every 6 hours |
| `email_tasks.py` | 1 (send notification email) | On demand |
| `dataset_tasks.py` | 1 (process BI dataset) | On demand |
| `certificate_backfill.py` | 1 (async loop, not Celery) | Every 2 minutes |
| `cleanup_idempotency_keys.py` | 1 (async loop, not Celery) | Every 6 hours |

### A.1.6 Tests

| Test Directory | Files | Focus |
|---------------|-------|-------|
| `tests/education/` | **5 files** (test_modules, test_lessons, test_enrollments, test_quizzes, test_certificates) | **2,619 lines, 228 test functions** |
| `tests/bi_tests/` | 4 files | BI analytics |
| `tests/` (root) | 22 files | Auth, payments, moderation, security, data privacy, websocket, etc. |

---

## A.2 Frontend Overview

### A.2.1 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js | 15.5.18 |
| **React** | React | 18.3.1 |
| **Language** | TypeScript | 5.9 |
| **Styling** | Tailwind CSS | v4 |
| **State Management** | Zustand (client) + TanStack Query (server) | 5.0 + 5.90 |
| **Animations** | Framer Motion | 12.23 |
| **i18n** | next-intl + custom loader | — |
| **Testing** | Vitest + Playwright | 3.1 + latest |

### A.2.2 Key Dependencies

| Package | Purpose |
|---------|---------|
| `lucide-react` | Icons |
| `recharts` | Charts |
| `react-player`, `hls.js`, `video.js` | Video playback |
| `@react-pdf/renderer` | PDF certificate generation |
| `html2canvas`, `html2pdf.js`, `jspdf` | Export/download |
| `idb` | IndexedDB for offline storage |
| `sonner` | Toast notifications |
| `jose` | JWT verification (edge middleware) |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Styling utilities |
| `@fingerprintjs/fingerprintjs` | Device fingerprinting |
| `@sentry/nextjs` | Error tracking |
| `@supabase/supabase-js` | Supabase integration |

### A.2.3 Application Routes

| Route Prefix | Purpose | Protected |
|-------------|---------|-----------|
| `/learn` | LMS course catalog, courses, paths, creation, management | Partial |
| `/auth` | Login, signup, verification, password reset | No |
| `/dashboard` | User dashboard | Yes |
| `/hub` | Freelancing marketplace | Partial |
| `/bi` | Business intelligence (datasets, dashboards, analytics) | Yes |
| `/admin` | Platform administration | Yes (admin role) |
| `/instructor` | Instructor dashboard | Not yet built (Phase 2) |
| `/profile`, `/settings` | User management | Yes |
| `/billing`, `/payment` | Payments | Yes |
| `/ai-analytics` | AI features | Yes (stub page) |

### A.2.4 LMS Frontend (Learn Routes)

| Route | File | Lines | Description |
|-------|------|-------|-------------|
| `/learn` | `page.tsx` | 604 | Learn landing page (course catalog) |
| `/learn/courses` | `page.tsx` | 32,649 | Browse courses (large file) |
| `/learn/courses/[id]` | `page.tsx` | 1,038 | Course detail (16 components) |
| `/learn/courses/[id]/` | components/ | 16 files | Video player, quiz engine, certificate generator, review system, sync indicator |
| `/learn/courses/[id]/` | hooks/ | 5 files | useCourseData, usePublicCourseData, useCurriculumState, useCourseAccess, AutomaticProgressSyncManager |
| `/learn/paths` | `page.tsx` | — | Browse learning paths |
| `/learn/paths/[id]` | `page.tsx` | 223 | Path detail |
| `/learn/paths/[id]/` | components/ | 4 files | PathHero, PathCurriculum, PathStatsBar, PathCertificate |
| `/learn/create` | `page.tsx` | — | Create course (instructor) |
| `/learn/manage` | `page.tsx` | — | Manage courses (instructor) |
| `/learn/manage/[id]` | `page.tsx` | 381 | Manage single course |

### A.2.5 i18n / Localization

| Feature | Status |
|---------|--------|
| **Locales** | `en`, `fr`, `ar` (3 locales) |
| **Namespaces** | 19 per locale (common, auth, learn, course, hub, bi, admin, etc.) |
| **Files** | 57 total (19 × 3) |
| **RTL** | `useBidi()` hook with margin/padding/flex/alignment mapping |
| **BiDi isolation** | Unicode control characters for mixed text |
| **Locale detection** | Header → Cookie → Accept-Language → `en` fallback |
| **Locale persistence** | Cookie with 1-year expiry |

---

## A.3 Infrastructure

### A.3.1 Docker Compose Services

| Service | Image | Purpose |
|---------|-------|---------|
| `api` | Dockerfile (./services/api) | FastAPI application |
| `celery-worker` | Same Dockerfile | Celery task worker |
| `celery-beat` | Same Dockerfile | Celery scheduled tasks |
| `postgres` | postgres:16-alpine | Database |
| `redis` | redis:7-alpine | Cache + queue |
| `db-migrate` | Same Dockerfile | Not yet added (Phase 1) |

### A.3.2 Production Environment (`.env.prod.example`)

Pre-configured for: PostgreSQL, Redis, Celery, JWT (RS256), Sentry, SMTP, Chargily Pay, WhatsApp, OAuth (Google/GitHub/LinkedIn), CORS.

---

## A.4 Security & Quality

### A.4.1 Security Features Present

| Feature | Status |
|---------|--------|
| JWT auth (access + refresh tokens) | ✅ Working |
| RS256 asymmetric signing support | ✅ Configured (HS256 fallback) |
| 2FA / MFA | ✅ WebAuthn + TOTP + backup codes |
| OAuth (Google, GitHub, LinkedIn) | ✅ |
| Rate limiting (per-IP, per-credential) | ✅ Redis-backed with in-memory fallback |
| CSRF protection | ✅ Double-submit cookie pattern |
| Device fingerprinting | ✅ FingerprintJS integration |
| Content moderation workflow | ✅ Manual admin review (no AI yet) |
| Password policies (lockout, validation) | ✅ |
| Data privacy (GDPR export/delete) | ✅ |
| API audit logging | ✅ |
| Security headers | ✅ CSP, HSTS, X-Frame-Options, etc. |

### A.4.2 Security Features Missing

| Feature | Status | Risk |
|---------|--------|------|
| AI content screening | ❌ Feature flag exists, not implemented | Manual review doesn't scale |
| Plagiarism detection | ❌ Feature flag exists, not implemented | Cannot detect copy-paste submissions |
| Advanced proctoring | ❌ Not implemented | Cannot run secure online exams |

### A.4.3 Code Quality

| Metric | Value |
|--------|-------|
| TODO/FIXME in `services/api/app/` | ~917 |
| Test files (LMS-related) | 6 files, 2,619 lines, 228 functions |
| Linting | ruff configured |
| Type checking | mypy configured |
| Coverage | pytest-cov configured (results not measured in this audit) |

---

## A.5 Key Observations for the Plan

### What's Strong

1. **Clean architecture separation** — routers → services → Prisma. The patterns are well-established.
2. **Existing sub-router pattern** — BI already uses `bi_routers/`. Education decomposition follows a proven pattern.
3. **Comprehensive testing** — 228 LMS test functions with edge cases (quiz cooldown boundaries, essay grading, time limits).
4. **RTL/Arabic support** — Well-implemented BiDi utilities, 3 locales, 19 namespaces.
5. **Offline awareness** — `AutomaticProgressSyncManager` and `SyncStatusIndicator` exist in the frontend.
6. **Celery infrastructure** — 12 task modules, 11 scheduled tasks, Redis broker, retry logic.
7. **WebSocket infrastructure** — Pub/sub across workers, authentication, reconnection.

### What's Weak

1. **Monolithic `education.py`** — 1,745 lines, 46 endpoints, 12 concerns mixed together.
2. **Generic error handling** — 40/46 endpoints use `try/except → 500` pattern.
3. **Zero AI/ML integration** — Feature flags exist but are unused. No AI dependencies.
4. **No database migrations** — Schema changes are manual.
5. **No service worker** — PWA is incomplete (manifest exists, no SW).
6. **Gradebook missing** — No way to compute course-wide grades.
7. **Assignments missing** — No submission/grading workflow.
8. **Live events marketplace missing** — No WebRTC integration. (Planned: LiveKit Cloud → self-hosted for scale. See `docs/live-sessions-implementation.md`.)
9. **Instructor dashboard missing** — No dedicated instructor analytics.
10. **SCORM/xAPI missing** — Cannot import existing content.
11. **Limited payment coverage** — Only Algeria (Chargily Pay).

---

## A.6 File Size Reference (for Effort Estimation)

| File | Lines | Complexity |
|------|-------|-----------|
| `routers/education.py` | 1,745 | Very High (46 endpoints, mixed concerns) |
| `services/education_service.py` | 2,394 | Very High (core LMS logic) |
| `services/quiz_service.py` | 370 | Medium (3 methods, 5 question types) |
| `services/content_moderation_service.py` | 849 | Medium (state machine, 10 methods) |
| `services/notification_service.py` | 1,138 | High (multi-channel, caching, rate limiting) |
| `schemas/education.py` | 786 | Medium (49 models) |
| `routes.py` | 121 | Low (router registration) |
| `core/config.py` | 156 | Low (settings) |
| `core/celery.py` | 88 | Low (Celery config) |
| `startup.py` | 219 | Medium (lifespan, validation) |
| Frontend: `learn/courses/[id]/page.tsx` | 1,038 | High (course detail with 16 components) |
| Frontend: `learn/courses/[id]/QuizEngine.tsx` | 760 | High (quiz UI state machine) |
| Frontend: `learn/courses/[id]/VideoPlayer.tsx` | 374 | Medium (video + progress) |
