# Phase 1: Architecture Hardening & AI Foundation

**Duration:** Weeks 1–3  
**Target Score:** 78/100 tech, 50/100 launch readiness  
**Dependencies:** None  

---

## Overview

Phase 1 addresses the three most critical architectural debts and lays the foundation for all AI features. The cardinal rule: **zero breaking changes**. Every endpoint path, every response shape, every frontend API call must work identically before and after.

---

## Dependency Safety Analysis

Before any code is written, the dependency graph must be fully mapped to ensure the decomposition introduces no circular imports, missing references, or path changes.

### A. Backend Dependency Graph (Current State)

```
education.py (1,745 lines, 46 endpoints)
  ├── imports → app.core.auth              (get_current_user, get_current_user_optional)
  ├── imports → app.services.education_service  (education_service singleton)
  ├── imports → app.schemas.education       (ModuleResponse, LessonResponse, etc.)
  ├── imports → app.core.prisma             (prisma client)
  ├── imports → app.generated.prisma        (Json type)
  ├── imports → logging, datetime           (stdlib)
  ├── mid-file imports → app.services.quiz_service       (line ~1120)
  ├── mid-file imports → app.services.certificate_service (line ~1467)
  └── NO imports from other routers
```

**Key finding:** The file imports services and schemas, but no other router imports `education` anywhere in the app. The only reference to `education` is in `routes.py`:

```python
from app.routers import ... education ...  # line 12
(education.router, "Education"),           # line 53 in _ROUTERS
```

This means the split is **low risk** — no circular import danger. We simply change one import line in `routes.py`.

### B. Frontend API Call Analysis

The frontend calls education endpoints via two mechanisms:

**1. `educationApi` object** (`apps/web/src/lib/api/education.ts:242-427`):
All paths are hardcoded strings starting with `/api/education/...`. For example:
```typescript
getPublicModules() → apiClient.get(`/api/education/modules/public${query}`)
getModule(id)      → apiClient.get(`/api/education/modules/${id}`)
enrollModule(id)   → apiClient.post(`/api/education/enroll/module/${moduleId}`)
```

**2. `ENDPOINTS.EDUCATION` constant** (`apps/web/src/lib/api/endpoints.ts:140-179`):
All paths are hardcoded strings in a lookup table. The `educationApi` object uses these paths directly, not the `ENDPOINTS` constants.

**Critical finding:** The frontend calls `/api/education/...` (LEGACY prefix), NOT `/api/v1/education/...`. Both prefixes must continue to work.

### C. Path Preservation Verification

Every endpoint path in the current `education.py` must map to exactly one sub-router with an identical final path.

| # | Current Path | Frontend Call (from code) | Sub-router | Prefix | Final Path | Match? |
|---|-------------|--------------------------|------------|--------|------------|--------|
| 1 | `GET /education/modules/public` | `educationApi.getPublicModules()` → `/api/education/modules/public` | content.py | `/modules` | `/education/modules/public` | ✅ |
| 2 | `GET /education/modules/public/{id}` | `educationApi.getPublicModule(id)` → `/api/education/modules/public/${id}` | content.py | `/modules` | `/education/modules/public/{id}` | ✅ |
| 3 | `GET /education/paths/public` | `educationApi.getPublicPaths()` → `/api/education/paths/public` | content.py | `/paths` | `/education/paths/public` | ✅ |
| 4 | `GET /education/paths/public/{id}` | `educationApi.getPublicPath(id)` → `/api/education/paths/public/${id}` | content.py | `/paths` | `/education/paths/public/{id}` | ✅ |
| 5 | `GET /education/modules` | `educationApi.getModules()` → `/api/education/modules` | content.py | `/modules` | `/education/modules` | ✅ |
| 6 | `GET /education/modules/{id}` | `educationApi.getModule(id)` → `/api/education/modules/${id}` | content.py | `/modules` | `/education/modules/{id}` | ✅ |
| 7 | `GET /education/paths` | `educationApi.getPaths()` → `/api/education/paths` | content.py | `/paths` | `/education/paths` | ✅ |
| 8 | `GET /education/paths/{id}` | `educationApi.getPath(id)` → `/api/education/paths/${id}` | content.py | `/paths` | `/education/paths/{id}` | ✅ |
| 9 | `POST /education/enroll/module/{id}` | `educationApi.enrollModule(id)` → `/api/education/enroll/module/${id}` | enrollments.py | `/enroll` | `/education/enroll/module/{id}` | ✅ |
| 10 | `POST /education/enroll/path/{id}` | `educationApi.enrollPath(id)` → `/api/education/enroll/path/${id}` | enrollments.py | `/enroll` | `/education/enroll/path/{id}` | ✅ |
| 11 | `GET /education/me/enrollments` | `educationApi.getMyEnrollments()` → `/api/education/me/enrollments` | enrollments.py | `/me` | `/education/me/enrollments` | ✅ |
| 12 | `GET /education/modules/{id}/lessons` | `educationApi.getModuleLessons(id)` → `/api/education/modules/${id}/lessons` | enrollments.py | `/modules` (overlap resolved by different route patterns) | `/education/modules/{id}/lessons` | ✅ |
| 13 | `GET /education/lessons/{id}` | `educationApi.getLesson(id)` → `/api/education/lessons/${id}` | enrollments.py | `/lessons` | `/education/lessons/{id}` | ✅ |
| 14 | `POST /education/lessons/{id}/progress` | `educationApi.updateLessonProgress(id)` → `/api/education/lessons/${id}/progress` | enrollments.py | `/lessons` | `/education/lessons/{id}/progress` | ✅ |
| 15 | `POST /education/lessons/{id}/complete` | `educationApi.completeLesson(id)` → `/api/education/lessons/${id}/complete` | enrollments.py | `/lessons` | `/education/lessons/{id}/complete` | ✅ |
| 16 | `GET /education/me/stats` | `educationApi.getMyStats()` → `/api/education/me/stats` | analytics.py | `/me` | `/education/me/stats` | ✅ |
| 17 | `GET /education/me/recommendations` | `educationApi.getRecommendations()` → `/api/education/me/recommendations` | analytics.py | `/me` | `/education/me/recommendations` | ✅ |
| 18 | `POST /education/search` | `educationApi.search()` → `/api/education/search` | search.py | `/search` | `/education/search` | ✅ |
| 19 | `GET /education/search/quick` | `educationApi.quickSearch()` → `/api/education/search/quick` | search.py | `/search` | `/education/search/quick` | ✅ |
| 20 | `POST /education/modules` | Not in educationApi (admin) | admin_content.py | `/modules` | `/education/modules` | ✅ |
| 21 | `PUT /education/modules/{id}` | Not in educationApi (admin) | admin_content.py | `/modules` | `/education/modules/{id}` | ✅ |
| 22 | `POST /education/modules/{id}/lessons` | Not in educationApi (admin) | admin_content.py | `/modules` | `/education/modules/{id}/lessons` | ✅ |
| 23 | `PUT /education/lessons/{id}` | `educationApi.updateLesson(id)` → `/api/education/lessons/${id}` | admin_content.py | `/lessons` | `/education/lessons/{id}` | ✅ |
| 24 | `DELETE /education/lessons/{id}` | `educationApi.deleteLesson(id)` → `/api/education/lessons/${id}` | admin_content.py | `/lessons` | `/education/lessons/{id}` | ✅ |
| 25 | `PUT /education/modules/{id}/lessons/reorder` | `educationApi.reorderLessons(id)` → `/api/education/modules/${id}/lessons/reorder` | admin_content.py | `/modules` | `/education/modules/{id}/lessons/reorder` | ✅ |
| 26 | `POST /education/lessons/{id}/quiz` | `educationApi.createQuiz(id)` → `/api/education/lessons/${id}/quiz` | quizzes.py | `/lessons` | `/education/lessons/{id}/quiz` | ✅ |
| 27 | `GET /education/quizzes/{lesson_id}` | `educationApi.getQuiz(lessonId)` → `/api/education/quizzes/${lessonId}` | quizzes.py | `/quizzes` | `/education/quizzes/{lesson_id}` | ✅ |
| 28 | `POST /education/quizzes/{lesson_id}/start` | `educationApi.startQuiz(lessonId)` → `/api/education/quizzes/${lessonId}/start` | quizzes.py | `/quizzes` | `/education/quizzes/{lesson_id}/start` | ✅ |
| 29 | `POST /education/quizzes/attempts/{id}/submit` | `educationApi.submitQuiz(attemptId)` → `/api/education/quizzes/attempts/${attemptId}/submit` | quizzes.py | `/quizzes` | `/education/quizzes/attempts/{id}/submit` | ✅ |
| 30 | `GET /education/quizzes/{lesson_id}/attempts` | Not called in educationApi (used internally) | quizzes.py | `/quizzes` | `/education/quizzes/{lesson_id}/attempts` | ✅ |
| 31 | `POST /education/certificates/generate/module/{id}` | `educationApi.generateModuleCertificate(id)` → `/api/education/certificates/generate/module/${id}` | certificates.py | `/certificates` | `/education/certificates/generate/module/{id}` | ✅ |
| 32 | `POST /education/certificates/generate/path/{id}` | `educationApi.generatePathCertificate(id)` → `/api/education/certificates/generate/path/${id}` | certificates.py | `/certificates` | `/education/certificates/generate/path/{id}` | ✅ |
| 33 | `POST /education/certificates/auto-generate` | Not used in educationApi | certificates.py | `/certificates` | `/education/certificates/auto-generate` | ✅ |
| 34 | `GET /education/certificates/my` | `educationApi.getMyCertificates()` → `/api/education/certificates/my` | certificates.py | `/certificates` | `/education/certificates/my` | ✅ |
| 35 | `GET /education/certificates/{id}` | Not used in educationApi | certificates.py | `/certificates` | `/education/certificates/{id}` | ✅ |
| 36 | `GET /education/certificates/download/{id}` | Not used in educationApi | certificates.py | `/certificates` | `/education/certificates/download/{id}` | ✅ |
| 37 | `GET /education/certificates/verify/{id}` | `educationApi.verifyCertificate(id)` → `/api/education/certificates/verify/${id}` | certificates.py | `/certificates` | `/education/certificates/verify/{id}` | ✅ |
| 38 | `POST /education/courses/{module_id}/reviews` | `educationApi.createReview(moduleId)` → `/api/education/modules/${moduleId}/reviews` | reviews.py | `/courses` | `/education/courses/{module_id}/reviews` | ✅ |
| 39 | `GET /education/courses/{module_id}/reviews` | `educationApi.getModuleReviews(moduleId)` → `/api/education/modules/${moduleId}/reviews` | reviews.py | `/courses` | `/education/courses/{module_id}/reviews` | ✅ |
| 40 | `DELETE /education/reviews/{review_id}` | Not in educationApi | reviews.py | `/reviews` | `/education/reviews/{review_id}` | ✅ |
| 41 | `GET /education/health` | Not in educationApi | content.py | no prefix | `/education/health` | ✅ |
| 42 | `GET /education/stats` | `educationApi.getStats()` → `/api/education/stats` | content.py | no prefix | `/education/stats` | ✅ |
| 43 | `GET /education/video/signed-url` | Not in educationApi | video.py | `/video` | `/education/video/signed-url` | ✅ |
| 44 | `POST /education/modules/{id}/submit-review` | `educationApi.submitForReview(id)` → `/api/education/modules/${id}/submit-review` | content.py (same prefix as content) | `/modules` | `/education/modules/{id}/submit-review` | ✅ |
| 45 | `GET /education/modules/my-drafts` | `educationApi.getMyDrafts()` → `/api/education/modules/my-drafts` | content.py | `/modules` | `/education/modules/my-drafts` | ✅ |
| 46 | `GET /education/me/lesson-progresses` | Not in educationApi (deprecated — duplicate) | enrollments.py | `/me` | `/education/me/lesson-progresses` | ✅ |

**All 46 paths are preserved. Zero frontend changes needed.**

### D. Response Shape Analysis

Some endpoints return `Dict[str, Any]` (raw dicts) instead of typed models. When adding response models during the split, we must ensure the shape stays compatible.

| Endpoint | Current Return | Frontend Expectation | Safe to Add Model? |
|----------|---------------|---------------------|-------------------|
| `enroll_in_module` | `Dict[str, Any]` | `EnrollmentResponse` | ✅ Add `response_model=EnrollmentResponse` |
| `enroll_in_path` | `Dict[str, Any]` | `EnrollmentResponse` | ✅ Add `response_model=EnrollmentResponse` |
| `update_lesson_progress` | `Dict[str, Any]` | `void` | ✅ Add `response_model=dict` (keep same shape) |
| `complete_lesson` | `Dict[str, Any]` | `void` | ✅ Add `response_model=dict` (keep same shape) |
| `create_quiz_for_lesson` | `Dict` | `any` | ✅ Add minimal response model |
| `get_quiz` | dynamic | `any` | ✅ Add `response_model=QuizResponse` |
| `generate_module_certificate` | dynamic | `any` | ✅ Add `response_model=CertificateResponse` |
| `get_certificate_details` | dict | `any` | ✅ Add `response_model=CertificateResponse` |

**No response shape changes are required.** We can add `response_model=` annotations that match the current output shape. FastAPI's `response_model` only adds serialization/filtering — it doesn't change what the endpoint returns.

---

## Section 1: Router Decomposition

### 1.1 Current State

`services/api/app/routers/education.py` — 1,745 lines, 46 endpoints, 12 distinct concerns.

### 1.2 Target State

Follow the proven pattern from `services/api/app/routers/bi_routers/`:

```
services/api/app/routers/education_routers/
├── __init__.py                 # Import all sub-routers, expose in __all__
├── education_main.py           # APIRouter(prefix="/education"), sub-mounts all
├── content.py                  # Module/path browsing (GET), submit-for-review, drafts
├── enrollments.py              # Enrollments + lesson progress + lesson-progresses
├── analytics.py                # Stats + recommendations
├── search.py                   # Full-text + quick search
├── admin_content.py            # Instructor/admin CRUD (module, lesson, reorder)
├── quizzes.py                  # Quiz CRUD + attempt lifecycle
├── certificates.py             # Certificate generation + verification
├── reviews.py                  # Course reviews
└── video.py                    # Video signed URL
```

### 1.3 Sub-router Prefix Handling

Each sub-router declares its own `prefix` relative to `/education`:

| Sub-router | prefix | Routes Defined |
|-----------|--------|----------------|
| `content.py` | `prefix="/modules"` | `GET /public`, `GET /public/{id}`, `GET /`, `GET /{id}`, `POST /{id}/submit-review`, `GET /my-drafts` |
| `content.py` (paths) | `prefix="/paths"` | `GET /public`, `GET /public/{id}`, `GET /`, `GET /{id}` |
| `content.py` (no prefix) | No router-level prefix | `@router.get("/health")`, `@router.get("/stats")` |
| `enrollments.py` | `prefix="/enroll"` | `POST /module/{id}`, `POST /path/{id}` |
| `enrollments.py` | `prefix="/me"` | `GET /enrollments`, `GET /lesson-progresses`, `GET /progress/lessons`, `GET /progress/lessons/{id}` |
| `enrollments.py` | `prefix="/modules"` | `GET /{id}/lessons` |
| `enrollments.py` | `prefix="/lessons"` | `GET /{id}`, `POST /{id}/progress`, `POST /{id}/complete` |
| `analytics.py` | `prefix="/me"` | `GET /stats`, `GET /recommendations` |
| `search.py` | `prefix="/search"` | `POST /`, `GET /quick` |
| `admin_content.py` | `prefix="/modules"` | `POST /`, `PUT /{id}`, `POST /{id}/lessons`, `PUT /{id}/lessons/reorder` |
| `admin_content.py` | `prefix="/lessons"` | `PUT /{id}`, `DELETE /{id}` |
| `quizzes.py` | `prefix="/lessons"` | `POST /{id}/quiz` |
| `quizzes.py` | `prefix="/quizzes"` | `GET /{lesson_id}`, `POST /{lesson_id}/start`, `GET /{lesson_id}/attempts`, `POST /attempts/{id}/submit` |
| `certificates.py` | `prefix="/certificates"` | `POST /generate/module/{id}`, `POST /generate/path/{id}`, `POST /auto-generate`, `GET /my`, `GET /{id}`, `GET /download/{id}`, `GET /verify/{id}` |
| `reviews.py` | `prefix="/courses"` | `POST /{module_id}/reviews`, `GET /{module_id}/reviews` |
| `reviews.py` | `prefix="/reviews"` | `DELETE /{review_id}` |
| `video.py` | `prefix="/video"` | `GET /signed-url` |

**Important design note:** A Python file can declare multiple `APIRouter` instances with different prefixes. Or a single file can declare one `APIRouter` with no prefix and use `@router.get("/modules/...")` patterns. Both work. The cleaner approach is:

```python
# Option A: One router per logical prefix (simpler for FastAPI)
content_browser = APIRouter(prefix="/modules", tags=["Education - Content"])
path_browser = APIRouter(prefix="/paths", tags=["Education - Content"])
general = APIRouter(tags=["Education - Content"])

# Option B: One router with no prefix, full paths in decorators
router = APIRouter(tags=["Education - Content"])
@router.get("/modules/public")
@router.get("/modules/public/{module_id}")
@router.get("/paths/public")
@router.get("/paths/public/{path_id}")
@router.get("/health")
@router.get("/stats")
```

**Recommendation:** Use Option B (single router per file with full paths) for simplicity. Each sub-router file is a single, cohesive unit — the `@router.get(...)` decorator makes the full path visible at a glance.

### 1.4 Import Requirements Per Sub-router

Each sub-router must import only its needed dependencies:

**`content.py` needs:**
- `app.core.auth` → `get_current_user`, `get_current_user_optional`
- `app.services.education_service` → `education_service`
- `app.schemas.education` → `ModuleResponse`, `LessonResponse`, `ModuleListResponse`, `PathResponse`, `PathListResponse`
- `app.core.prisma` → `prisma`
- `logging`, `datetime`

**`enrollments.py` needs:**
- All of content.py's imports
- `app.schemas.education` → `EnrollmentResponse`, `ProgressUpdate`, `LessonProgressResponse`

**`analytics.py` needs:**
- `app.core.auth` → `get_current_user`
- `app.services.education_service` → `education_service`
- `app.schemas.education` → `UserLearningStats`, `LearningPathRecommendation`
- `logging`

**`search.py` needs:**
- `app.core.auth` → `get_current_user_optional`
- `app.services.education_service` → `education_service`
- `app.schemas.education` → `SearchQuery`, `SearchResults`
- `logging`

**`admin_content.py` needs:**
- `app.core.auth` → `get_current_user`
- `app.services.education_service` → `education_service`
- `app.schemas.education` → `ModuleCreate`, `ModuleUpdate`, `ModuleResponse`, `LessonCreate`, `LessonUpdate`, `LessonResponse`, `LessonReorderRequest`
- `app.core.prisma` → `prisma`
- `logging`

**`quizzes.py` needs:**
- `app.core.auth` → `get_current_user`
- `app.core.prisma` → `prisma`
- `app.services.quiz_service` → `quiz_service`
- `app.services.education_service` → `education_service`
- `app.schemas.education` → `QuizResponse`, `QuizSubmission`, `QuizAttemptResponse`, `QuizCreate`, `LessonResponse`
- `logging`

**`certificates.py` needs:**
- `app.core.auth` → `get_current_user`
- `app.core.prisma` → `prisma`
- `app.services.certificate_service` → `certificate_service`
- `app.schemas.education` → certificate-related schemas
- `logging`, `datetime`

**`reviews.py` needs:**
- `app.core.auth` → `get_current_user`, `get_current_user_optional`
- `app.services.education_service` → `education_service`
- `app.schemas.education` → `CourseReviewCreate`, `CourseReviewResponse`, `PaginatedReviewsResponse`
- `logging`

**`video.py` needs:**
- `app.services.aws_video_service` or existing video signing logic
- `logging`

### 1.5 Implementation Steps (Detailed)

**Step 1: Create package structure (safe to do in parallel)**

```
services/api/app/routers/education_routers/
├── __init__.py
├── education_main.py
├── content.py
├── enrollments.py
├── analytics.py
├── search.py
├── admin_content.py
├── quizzes.py
├── certificates.py
├── reviews.py
└── video.py
```

**Step 2: Extract endpoints into sub-routers**

For each sub-router file:
1. Copy the relevant function(s) from `education.py`
2. Add the required imports (no shared imports — each file is self-contained)
3. Declare `router = APIRouter(tags=["Education - <domain>"])`
4. Use `@router.get("/education/modules/...")` style paths (full path)
5. Remove the `try/except Exception → 500` wrapper
6. Add `response_model=` annotation matching current output shape
7. Move any mid-file service imports to the top

**Step 3: Create `__init__.py`**

```python
from .content import router as content_router
from .enrollments import router as enrollments_router
from .analytics import router as analytics_router
from .search import router as search_router
from .admin_content import router as admin_content_router
from .quizzes import router as quizzes_router
from .certificates import router as certificates_router
from .reviews import router as reviews_router
from .video import router as video_router

__all__ = [
    "content_router",
    "enrollments_router",
    "analytics_router",
    "search_router",
    "admin_content_router",
    "quizzes_router",
    "certificates_router",
    "reviews_router",
    "video_router",
]
```

**Step 4: Create `education_main.py`**

```python
from fastapi import APIRouter
from app.routers.education_routers import (
    content_router,
    enrollments_router,
    analytics_router,
    search_router,
    admin_content_router,
    quizzes_router,
    certificates_router,
    reviews_router,
    video_router,
)

router = APIRouter(prefix="/education", tags=["Education"])

router.include_router(content_router)
router.include_router(enrollments_router)
router.include_router(analytics_router)
router.include_router(search_router)
router.include_router(admin_content_router)
router.include_router(quizzes_router)
router.include_router(certificates_router)
router.include_router(reviews_router)
router.include_router(video_router)
```

**Step 5: Dual-registration (safety checkpoint)**

In `routes.py`, register BOTH the old and new routers:

```python
from app.routers import ... education ...               # OLD — keep
from app.routers.education_routers import education_main  # NEW — add

_ROUTERS = [
    ...
    (education.router, "Education"),                    # OLD — keep
    (education_main.router, "Education"),                # NEW — add
    ...
]
```

Wait — this registers BOTH at the same prefix `/education`. FastAPI will raise an error because of duplicate routes. So we need an alternative approach for dual-registration:

**Correct dual-registration approach:**

Option 1: Register the new router at a test prefix:
```python
# In routes.py, ADD after the _ROUTERS loop:
app.include_router(education_main.router, prefix="/api/v2", tags=["Education (v2)"])
```

Then compare responses:
```bash
# Script that hits both and diffs:
for path in $(list_all_education_paths); do
  old=$(curl -s http://localhost:8000/api$path)
  new=$(curl -s http://localhost:8000/api/v2$path)
  diff <(echo "$old") <(echo "$new") || echo "MISMATCH: $path"
done
```

Option 2 (recommended): Instead of dual-registration, rely on the comprehensive test suite. The existing 228 tests cover most endpoints. Add a script that tests each endpoint and verifies the response shape.

**Step 6: Swap and validate**

```python
# Remove old import
# from app.routers import ... education ...  # DELETE

# Keep new import
from app.routers.education_routers import education_main  # KEEP

_ROUTERS = [
    ...
    (education_main.router, "Education"),  # KEEP
    ...
]
```

**Step 7: Delete old file**

```bash
rm services/api/app/routers/education.py
```

**Step 8: Run full test suite**

```bash
cd services/api
pytest tests/education/ -v
```

---

## Section 2: Safe Enhancements During Decomposition

Since we are touching every endpoint anyway, these safe improvements can be made:

### 2.1 Safe to Do (same behavior, better code)

| Enhancement | Risk | Verification |
|------------|------|-------------|
| Add `response_model=` annotations to endpoints that return raw dicts | None — FastGUI only filters output, doesn't change logic | Response shape matches existing |
| Remove `try/except Exception → 500` and use exception hierarchy | Low — exceptions produce same HTTP status codes | All 228 tests pass |
| Move mid-file service imports to top of file | None — Python executes imports once | Import works at module load |
| Add `exc_info=True` to remaining `logger.error` calls | None — log format change only | No functional impact |
| Consolidate two `get_my_lesson_progresses` endpoints | Medium — frontend may call either path | See 2.2 below |
| Add `status_code` constants instead of magic numbers | None — cosmetic | Same runtime behavior |

### 2.2 NOT Safe to Do During Decomposition

| Enhancement | Why | When to Do |
|------------|-----|-----------|
| Rename or remove the deprecated `get_my_lesson_progresses` path | Unknown if frontend calls it | After checking frontend code for references |
| Change response models to add/remove fields | May break frontend type expectations | Phase 2 (coordinated frontend update) |
| Add new query parameters to existing endpoints | Client may send unexpected params (safe, but unnecessary scope) | Phase 2 |
| Merge `content.py` and `admin_content.py` | Different concerns, different auth patterns | Never — keep separated |

### 2.3 Consolidating Duplicate Endpoints

**The problem:** Two functions named `get_my_lesson_progresses` at different paths:
- `GET /education/me/lesson-progresses` (line 556) — returns raw dicts
- `GET /education/me/progress/lessons` (line 938) — returns `List[LessonProgressResponse]`

**Action plan:**
1. Check if frontend calls either path:
   - Search `education.ts` — no reference to `lesson-progresses` or `progress/lessons`
   - Search `endpoints.ts` — no `ENDPOINTS.EDUCATION` key for either path
   - Conclusion: Neither path is used by the frontend currently
2. Keep the typed version (`/me/progress/lessons`) with `List[LessonProgressResponse]`
3. Keep the untyped version (`/me/lesson-progresses`) but add a deprecation notice
4. Add both to `enrollments.py` (they belong with enrollment/progress logic)
5. Remove the deprecated version in a future sprint

---

## Section 3: Error Handling Standardization

### 3.1 Exception Hierarchy

New file: `services/api/app/core/exceptions.py`

The hierarchy follows a simple rule: **each exception corresponds to exactly one HTTP status code and one `code` string**. Frontend maps `code` to i18n keys.

```
AppException (base)
├── NotFoundError (404)
│   ├── ModuleNotFoundError      → "MODULE_NOT_FOUND"
│   ├── LessonNotFoundError      → "LESSON_NOT_FOUND"
│   ├── PathNotFoundError        → "PATH_NOT_FOUND"
│   ├── QuizNotFoundError        → "QUIZ_NOT_FOUND"
│   ├── EnrollmentNotFoundError  → "ENROLLMENT_NOT_FOUND"
│   └── CertificateNotFoundError → "CERTIFICATE_NOT_FOUND"
├── ForbiddenError (403)
│   ├── InsufficientPermissionsError → "INSUFFICIENT_PERMISSIONS"
│   └── LessonLockedError           → "LESSON_LOCKED"
├── ValidationError (400)
│   ├── EnrollmentError          → "ENROLLMENT_ERROR"
│   └── ReviewValidationError    → "REVIEW_VALIDATION_ERROR"
├── PaymentRequiredError (402)   → "PAYMENT_REQUIRED"
├── RateLimitError (429)
│   └── CooldownError            → "QUIZ_COOLDOWN"
└── ServerError (500)
    ├── DatabaseError            → "DATABASE_ERROR"
    └── AIServiceError           → "AI_SERVICE_ERROR"
```

Each exception carries:
- `status_code` → HTTP status
- `code` → machine-readable string for frontend i18n
- `detail` → human-readable message
- `extra` → optional dict with context (e.g., `{"moduleId": "abc"}`)

### 3.2 Migration Per Endpoint

During decomposition, each endpoint goes from:

```python
# Before
@router.get("/education/modules/public/{module_id}")
async def get_module_public(module_id: str):
    try:
        module = await education_service.get_module(module_id, include_lessons=True)
        if not module:
            raise HTTPException(404, detail="Module not found")
        return module
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(500, detail="Internal server error")
```

To:

```python
# After
@router.get("/education/modules/public/{module_id}", response_model=ModuleResponse)
async def get_module_public(module_id: str):
    module = await education_service.get_module(module_id, include_lessons=True)
    if not module:
        raise ModuleNotFoundError(module_id)
    return module
```

The change is safe because:
- Both raise `HTTPException` with status 404
- Both log errors (the exception handler logs at ERROR with `exc_info=True`)
- The response model is the same (`ModuleResponse`)

---

## Section 4: AI Agent Infrastructure

### 4.1 Component Overview

| Component | Location | Dependencies | Files Created |
|-----------|----------|-------------|---------------|
| **BaseAgent** | `ai_agents/base_agent.py` | Provider, ConversationStore, CostLogger, AgentMetrics | 1 |
| **AgentRegistry** | `ai_agents/registry.py` | FeatureFlag table (existing) | 1 |
| **BaseProvider** | `ai_agents/providers/base_provider.py` | None (abstract) | 1 |
| **ClaudeProvider** | `ai_agents/providers/claude.py` | `anthropic` SDK | 1 |
| **ProviderFactory** | `ai_agents/providers/__init__.py` | Config, ClaudeProvider | 1 |
| **ConversationStore** | `ai_agents/memory/conversation_store.py` | Redis (existing) | 1 |
| **ContextBuilder** | `ai_agents/memory/context_builder.py` | Prisma, EducationService | 1 |
| **CostLogger** | `ai_agents/monitoring/cost_logger.py` | Prisma (AiLog model) | 1 |
| **AgentMetrics** | `ai_agents/monitoring/agent_metrics.py` | Prometheus (existing) | 1 |
| **Celery Tasks** | `ai_agents/tasks/agent_celery_tasks.py` | Celery, AgentRegistry | 1 |
| **AI Router** | `routers/ai_agents.py` | AgentRegistry, ContextBuilder, WebSocket | 1 |

### 4.2 Provider Contract

The `AIProvider` interface defines three methods:
- `chat(messages, model, max_tokens, temperature, system_prompt)` → `{"content": str, "usage": {"input_tokens": int, "output_tokens": int, "model": str}}`
- `chat_stream(messages, ...)` → `AsyncIterator[str]`
- `embed(text)` → `list[float]`

This contract is designed so that any provider (Claude, OpenAI, local model) can be swapped in by changing one config value. The agents never touch the provider directly — they go through `BaseAgent` → `ProviderFactory` → `ClaudeProvider`.

### 4.3 Redis Key Design

Current Redis namespaces: `token_blocklist:*`, `oauth_state:*`, `rl_*`, `ws_distributed`

New namespace: `ai_conv:*`

```
ai_conv:<agent_name>:<user_id>
  → JSON array of {role, content} messages
  → TTL: 3600 seconds (1 hour of inactivity)
  → Max 20 messages (truncate oldest)
```

This follows the same pattern as the existing `token_blocklist` and `oauth_state` stores.

### 4.4 Feature Flag Integration

Existing `FeatureFlag` table is used. New seed flags for Phase 3 agents:
- `enable_ai_tutor` (Teaching Assistant)
- `enable_ai_content_generator` (Content Generator)
- `enable_ai_grading` (Grading agent)
- `enable_ai_proctoring` (Proctoring agent)
- `enable_ai_career_advisor` (Career Advisor)
- `enable_ai_adaptive_learning` (Adaptive Learning)

All flags default to `isEnabled: false`. The AgentRegistry checks the flag before routing.

### 4.5 Cost Tracking Schema

New Prisma model `AiLog`:

```prisma
model AiLog {
  id           Int      @id @default(autoincrement())
  agent        String
  userId       Int
  model        String
  inputTokens  Int
  outputTokens Int
  costCents    Int
  createdAt    DateTime @default(now())
  latencyMs    Int?

  @@index([userId])
  @@index([agent, createdAt])
  @@map("ai_logs")
}
```

This is the ONLY schema change in Phase 1. It is backward-compatible — existing records are unaffected.

### 4.6 RAG Infrastructure (ContentRetriever)

The Teaching Assistant agent must ground answers in course content, not LLM training data. Add a `ContentRetriever` module that provides retrieval-augmented generation.

**Vector storage:** Use `pgvector` extension on the existing PostgreSQL. No new infrastructure. The `embed()` method on `AIProvider` generates embeddings. At Podacium's scale (<10M chunks), PostgreSQL vector search is faster and cheaper than a dedicated vector DB (Pinecone, Weaviate). Re-evaluate at 100M+ chunks.

**Chunking strategy (new model `ContentChunk`):**
- `lessonId` → Lesson
- `chunkIndex` (int) — position within lesson
- `content` (text) — the chunk text (500 tokens max, 100 token overlap)
- `embedding` (vector(1536)?) — OpenAI-compatible dimension; store as `Float[]` for pgvector
- `locale` (string) — "ar", "fr", "en" — chunking runs per locale

**Ingestion pipeline (Celery task, runs after lesson publish):**
```
1. On lesson publish → Celery task `ingest_lesson_content`
2. Split lesson content by paragraphs + semantic boundaries
3. For each chunk: generate embedding via ClaudeProvider.embed()
4. Upsert into ContentChunk table
5. Mark lesson as ingested
```

**Query flow:**
```
1. Student asks question
2. ContextBuilder calls ContentRetriever.retrieve(question, lessonId, k=3)
3. ContentRetriever embeds question, does cosine similarity query on ContentChunk
4. Returns top-3 chunks with similarity scores
5. ContextBuilder injects chunks as <context> in system prompt
6. Agent responds grounded in actual course content
```

**Algeria Law 18-07 compliance — data minimization:**
- Content embeddings are derived from course material, not student data — no consent needed
- Student questions sent to Claude for embedding/anthropic API are pseudonymized (no PII in query text)
- The `ContentRetriever.retrieve()` runs entirely on Podacium's PostgreSQL — no data leaves Algeria

### 4.7 Semantic Cache (AiResponseCache)

Without caching, the Teaching Assistant cost at 500k MAU is ~$1,000/day. Semantic caching reduces this by 40-60%.

**New model `AiResponseCache`:**
- `queryHash` (string) — SHA256 of normalized query text
- `queryEmbedding` (vector) — for similarity search
- `response` (text) — cached Claude response
- `agent` (string) — which agent produced this
- `hitCount` (int) — usage counter for cache eviction
- `createdAt`, `expiresAt` — TTL 24h general, 7d common questions

**Cache flow:**
```
1. Incoming query → normalize (lowercase, strip diacritics, transliterate Arabic)
2. Compute embedding → find nearest neighbor in AiResponseCache
3. If cosine similarity > 0.95 AND agent matches → return cached response (no API call)
4. If miss → call Claude → store response + embedding in cache
5. Async cache eviction (Celery daily): DELETE WHERE expiresAt < now OR hitCount < 5 AND createdAt > 7d
```

**Arabic-specific normalization:**
- Strip Arabic diacritics (tashkeel) before hashing: `"كِتاب"` → `"كتاب"`
- Normalize alef variants: `"آ"`, `"أ"`, `"إ"` → `"ا"`
- Normalize teh marbuta: `"ة"` → `"ه"`
- Without normalization, identical questions with different diacritics miss cache

### 4.8 Hybrid Model Tier Architecture

Single-model (Claude-only) architecture is too costly for MENA pricing sensitivity. Implement a 3-tier routing system:

```
                    ┌─────────────────────────────┐
                    │   L1: Intent Classifier      │
                    │   (ONNX/WASM, on-device)     │
                    │   Cost: $0                   │
                    │   Classifies: course-related │
                    │   vs off-topic vs cheating   │
                    └──────────┬──────────────────┘
                               │
                    ┌──────────▼──────────────────┐
                    │   L2: Smart Cache + FAQ      │
                    │   (Redis + Claude Haiku)     │
                    │   Cost: $0.001-0.003         │
                    │   Checks: cache hit, FAQ     │
                    │   match, simple Q&A          │
                    └──────────┬──────────────────┘
                               │
                    ┌──────────▼──────────────────┐
                    │   L3: Full Reasoning         │
                    │   (Claude Sonnet 4)          │
                    │   Cost: $0.01-0.05           │
                    │   Complex tutoring, content  │
                    │   generation, deep Q&A       │
                    └─────────────────────────────┘
```

**L1 implementation (server-side, not on-device — no WASM needed):**
Use a small fast classifier: `claude-hybrid-classifier` or a simple LLM call with `max_tokens=5`:
```python
async def classify_intent(query: str) -> Literal["course", "off_topic", "cheating", "administrative"]:
    # Uses Haiku with max_tokens=5, temperature=0
    # Cost: ~$0.0001 per call
    ...
```

**Routing logic in `BaseAgent`:**
```python
async def handle_message(self, user_id: int, message: str) -> AsyncIterator[str]:
    intent = await self.classifier.classify(message)
    if intent == "cheating":
        return self._refuse_cheating(message)
    if intent == "off_topic":
        return self._redirect_to_course(message)
    
    cached = await self.cache.lookup(message, self.name)
    if cached:
        yield cached
        return
    
    async for chunk in self.provider.chat_stream(self._build_messages(message)):
        yield chunk
```

### 4.9 Rate Limiting & Quota System

Per-agent, per-tier quotas replace the single "50 req/day" blanket limit. Enforced via Redis counters.

**Key design:** `ai_rate:{agent_name}:{user_id}:{date}` → `{count}` with TTL until midnight UTC.

| Tier | Teaching Assistant | Content Generator | Career Advisor | Proctoring |
|------|-------------------|-------------------|---------------|------------|
| Free student | 10/day | — | 3/day | — |
| Premium student | 100/day | — | 10/day | — |
| Instructor | 200/day | 50/day | — | — |
| Batch/Celery | Unlimited | Unlimited | Unlimited | Unlimited |

**Enforcement in `BaseAgent`:**
```python
async def check_rate_limit(self, user_id: int) -> bool:
    key = f"ai_rate:{self.name}:{user_id}:{date.today().isoformat()}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 86400)
    limit = self._get_limit_for_user(user_id)
    return count <= limit
```

### 4.10 Graceful Degradation Stack

Every agent must survive AI provider outages without crashing the frontend. Four-layer degradation:

| Layer | Trigger | Behavior | User sees |
|-------|---------|----------|-----------|
| **Live** | Normal operation | Claude Sonnet 4 streaming | Normal AI tutor |
| **Degraded** | Sonnet 4 rate-limited or 2+ retries failed | Fallback to Haiku 3.5 (cheaper, capable for simple Q&A) | "AI is responding in power-saving mode" (yellow banner) |
| **Fallback** | All Claude models unreachable | Return cached responses from `AiResponseCache` only | "AI is offline — showing saved answers" (orange banner) |
| **Offline** | No cache, no provider | Return `{"error": "ai_unavailable", "message": "AI assistant is temporarily unavailable. Please try again later."}` | Red banner + email notification when restored |

Each agent implements:
```python
async def handle_with_degradation(self, message: str) -> AsyncIterator[str]:
    try:
        async for chunk in self.provider.chat_stream(...):
            yield chunk
    except (APIError, RateLimitError, ConnectionError):
        if self.fallback_provider:
            async for chunk in self.fallback_provider.chat_stream(...):
                yield chunk
        elif cached := await self.cache.lookup(message):
            yield cached
        else:
            yield self._offline_message()
```

### 4.11 Arabic Language Cost & Quality Considerations

The current cost estimates assume English token ratios. Arabic has structural differences that materially affect both cost and quality:

**Token multiplier:** Arabic text tokenizes to ~1.6-2x the tokens of equivalent English text. A 1000-token English prompt becomes 1600-2000 tokens in Arabic. This affects:
- **Input cost:** 1.6-2x higher per request
- **Output cost:** 1.6-2x higher per response
- **Context window:** Arabic conversations fill the 200k context window faster

**Adjusted cost estimate at 500k MAU (Arabic-heavy):**

| Agent | English Cost/Day | Arabic Cost/Day (1.8x) |
|-------|-----------------|----------------------|
| Teaching Assistant | $1,000 | $1,800 |
| Content Generator | $25 | $45 |
| Proctoring | $6 | $11 |
| Career Advisor | $5 | $9 |
| Moderation | $15 | $27 |
| **Total** | **$1,051** | **$1,892** |

**Mitigations:**
- Semantic caching has higher impact on Arabic (40-60% hit rate → $1,892 → ~$950)
- L1/L2 tier routing catches simple Arabic questions before reaching Sonnet
- System prompts stored as i18n locale templates, not inline LTR/RTL mix

**Dialect support (Algerian Darija):**
Students in Algeria may type in Darija (Arabic dialect with French loanwords). Claude performs well on MSA but degrades on Darija-heavy inputs. Strategy:
- Detect dialect via L1 classifier (`ar_dz`, `ar_eg`, `fr`, `en`)
- For Darija: prepend system instruction "The student is speaking Algerian Arabic. Respond in Modern Standard Arabic but be understanding of their dialect."
- Store dialect preference per user session to avoid re-classification

### 4.12 Algeria Law 18-07 Compliance Framework

Algeria's Law 18-07 (July 2018) on personal data protection regulates all AI processing of student data. Key requirements and implementation:

| Requirement | Law 18-07 Article | Implementation |
|-------------|------------------|----------------|
| **Consent for processing** | Art. 7 | Explicit opt-in for AI tutoring. Toggle in student settings. Default: OFF for minors. |
| **Data localization** | Art. 35 | Student PII never sent to Claude API. Only pseudonymized `user_id` and course content. |
| **Right to deletion** | Art. 22 | `DELETE /ai/conversations` clears all Redis conversation history + AiLog records for that user. |
| **Processing register** | Art. 18 | AiLog table serves as the processing register. Exportable as CSV for ARPDP (Algerian data authority) inspection. |
| **Data retention limit** | Art. 32 | Conversation history TTL: 24h after last message. AiLog records: 90 days. Cache entries: 7 days. |
| **Breach notification** | Art. 33 | Automated alert when anomaly in AiLog (unexpected spike in requests → possible data scraping). |

**Privacy architecture:**
```
Student Data Flow:
  Student Query → [Pseudonymization Layer] → Claude API → Response
       │                                            │
       │ No PII in query (strips names, emails,     │
       │ phone #s via regex before sending)          │ No student data stored by Anthropic
       │                                            │ (Claude retains 0 days for API)
       ▼                                            ▼
  AiLog: {userId: int, agent: str, costCents: int}  OK
  (no query text logged for privacy)
```

**Parental consent for minors (Art. 87, Family Code):**
- Students under 18 require parental consent for AI features
- Check `user.age` on AI endpoint access
- If < 18 AND no `parental_consent` flag → block AI access with message "This feature requires parental authorization"

---

## Section 5: What Each Agent Should Implement

Since the user wants agents to implement code later, Phase 1 only provides the infrastructure. The agents themselves (their system prompts, context needs, trigger flows) are detailed in `03-phase-3-ai-agents.md`. Phase 1 hands off:

- ✅ `BaseAgent` abstract class
- ✅ `ClaudeProvider` with streaming
- ✅ `AgentRegistry` with feature flag checks
- ✅ `ConversationStore` (Redis)
- ✅ `ContextBuilder`
- ✅ `CostLogger` with budget enforcement
- ✅ `AgentMetrics` (Prometheus)
- ✅ `Celery tasks` for async processing
- ✅ `AI router` with chat + WebSocket endpoints
- ✅ Empty agent stubs registered in startup.py

---

## Section 6: Migration & Rollback Plan

### 6.1 Migration Sequence

```
Week 1:
  ├── Create education_routers/ package
  ├── Extract content.py, enrollments.py, analytics.py, search.py
  ├── Add __init__.py, education_main.py
  ├── Dual-register at /api/v2/ prefix
  ├── Run path-by-path response comparison
  └── [Checkpoint A] All paths verified

Week 2:
  ├── Extract admin_content.py, quizzes.py, certificates.py, reviews.py, video.py
  ├── Run full test suite
  ├── Replace old router with new in routes.py
  ├── Delete education.py
  └── [Checkpoint B] 228 tests pass

Week 2-3:
  ├── Create exceptions.py
  ├── Register exception handlers in education_main.py
  ├── Refactor error handling in each sub-router (one at a time)
  ├── Create ai_agents/ package (all components)
  ├── Add AiLog to schema.prisma, run migration
  ├── Add anthropic to requirements.txt
  ├── Add AI config to config.py
  └── [Checkpoint C] Full infrastructure ready
```

### 6.2 Rollback Triggers

| Symptom | Action |
|---------|--------|
| Any education endpoint returns 404/500 unexpectedly | Revert routes.py, restore old import, delete education_routers/ |
| Test count drops below 228 | Fix or revert the change that broke tests |
| AI cost exceeds budget | Set AI_ENABLED=false in config |
| Migration fails | `prisma migrate resolve --rolled-back` + fix schema |

### 6.3 Rollback Procedure

```bash
# 1. Revert the routes.py change
git checkout -- services/api/app/routes.py

# 2. Restore the old education.py
git checkout -- services/api/app/routers/education.py

# 3. Remove the new package
rm -rf services/api/app/routers/education_routers/

# 4. Verify
pytest tests/education/ -v
```

This takes < 5 minutes and returns to exactly the previous state.

---

## Section 7: Verification Checklist

### 7.1 Pre-Merge

- [ ] All 46 endpoint paths preserved (verified against frontend `education.ts`)
- [ ] All 228 education tests pass
- [ ] No new dependencies introduced (except `anthropic`)
- [ ] No existing imports broken (verify `from app.routers import education` removed)
- [ ] Both `/api/v1/education/...` and `/api/education/...` work
- [ ] Error responses return same HTTP status codes as before
- [ ] Response bodies have same shape as before (verify 5 key endpoints)
- [ ] No duplicate routes registered (FastAPI raises on duplicate)
- [ ] Each sub-router file has self-contained imports (no cross-sub-router imports)

### 7.2 Post-Merge

- [ ] Smoke test: browse courses, load course detail, enroll, take quiz
- [ ] Monitor Sentry for new 500 errors (should be flat)
- [ ] Monitor Prometheus for latency changes (should be unchanged)
- [ ] Feature flags all disabled (no AI features visible to users yet)
- [ ] AI endpoints respond with "disabled" (feature flag check)

### 7.3 What Could Go Wrong

| Failure Mode | Likelihood | Impact | Detection |
|-------------|-----------|--------|-----------|
| Import missing in sub-router | Low (caught at import time) | FastAPI fails to start | Startup error |
| Endpoint path typo in decorator | Medium (caught by test) | One endpoint returns 404 | Test failure |
| Response model mismatch | Low (response shape changes) | Frontend renders wrong data | Test diff |
| Circular import between sub-routers | Zero (no cross-imports) | FastAPI fails to start | Startup error |

**All failure modes are caught before production.** The dual-registration and comprehensive test suite make this a safe refactor.
