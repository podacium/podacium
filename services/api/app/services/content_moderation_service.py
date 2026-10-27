"""
Content Moderation Service — Draft/Publish workflow with admin approval.

Flow:
  1. Instructor creates module (status=DRAFT)
  2. Instructor submits for review (status=IN_REVIEW)
  3. Admin approves (status=PUBLISHED) or rejects (status=DRAFT with reason)
  4. Admin can unpublish (status=ARCHIVED) at any time
  5. Instructor can re-submit after rejection (DRAFT → IN_REVIEW again)

Robustness features:
  - Audit logging for all state transitions
  - Concurrency-safe updates (check status before write)
  - Input sanitization (strip HTML from rejection reasons)
  - Module completeness validation before submission
  - Graceful notification failures (never block main flow)
  - Bulk operations for admin efficiency
  - Status filter support for instructor queries
"""

import logging
import re
import html
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from fastapi import HTTPException, status

from app.core.prisma import prisma
from app.generated.prisma import Json
from app.services.notification_service import NotificationService, NotificationCreate
from app.schemas.notifications import NotificationCategory

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

# Valid state transitions: current_status → set of allowed next statuses
VALID_TRANSITIONS: Dict[str, set] = {
    "DRAFT": {"IN_REVIEW"},
    "IN_REVIEW": {"PUBLISHED", "DRAFT"},  # approve or reject
    "PUBLISHED": {"ARCHIVED"},
    "ARCHIVED": {"DRAFT"},  # allow re-drafting archived modules
}

MIN_REJECTION_REASON_LENGTH = 10
MAX_REJECTION_REASON_LENGTH = 2000
MIN_LESSONS_FOR_REVIEW = 1
MIN_TITLE_LENGTH = 3
MIN_DESCRIPTION_LENGTH = 10


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _sanitize_text(text: str) -> str:
    """Strip HTML tags and escape special characters to prevent XSS in stored content."""
    # Remove HTML tags
    clean = re.sub(r"<[^>]+>", "", text)
    # Escape remaining HTML entities
    clean = html.escape(clean)
    return clean.strip()


def _validate_transition(current: str, target: str) -> None:
    """Raise if the status transition is not allowed."""
    allowed = VALID_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"errors.module.invalid_status_transition",
        )


# ─── Service ─────────────────────────────────────────────────────────────────


class ContentModerationService:
    """Handles module review, approval, rejection, and publication lifecycle."""

    # ─── Submit for Review ────────────────────────────────────────────────────

    async def submit_for_review(
        self, module_id: str, instructor_id: int
    ) -> Dict[str, Any]:
        """
        Instructor submits their module for admin review.
        Transitions: DRAFT → IN_REVIEW

        Validations:
          - Module exists and is not deleted
          - Caller is the module owner
          - Module is in DRAFT status
          - Module has title (≥3 chars) and description (≥10 chars)
          - Module has at least 1 non-deleted lesson
          - Each lesson has a title
        """
        module = await prisma.module.find_unique(
            where={"id": module_id},
            include={"lessons": True},
        )

        if not module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.module.not_found",
            )

        if module.instructorId != instructor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.module.not_owner",
            )

        if module.deletedAt is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.module.deleted",
            )

        current_status = getattr(module, "status", "DRAFT")
        _validate_transition(current_status, "IN_REVIEW")

        # ── Content completeness checks ──────────────────────────────────────

        errors = self._validate_module_completeness(module)
        if errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.module.incomplete",
                headers={"X-Validation-Errors": "; ".join(errors)},
            )

        # ── Perform transition ───────────────────────────────────────────────

        now = datetime.now(timezone.utc)
        await prisma.module.update(
            where={"id": module_id},
            data={
                "status": "IN_REVIEW",
                "submittedAt": now,
                "rejectionReason": None,
            },
        )

        # Audit log
        await self._log_transition(
            module_id=module_id,
            actor_id=instructor_id,
            from_status=current_status,
            to_status="IN_REVIEW",
            reason=None,
        )

        # Notify admins (fire-and-forget — don't block response)
        await self._safe_notify(self._notify_admins_new_submission, module)

        logger.info(
            f"Module {module_id} submitted for review by instructor {instructor_id}"
        )

        return {
            "success": True,
            "module_id": module_id,
            "status": "IN_REVIEW",
            "submitted_at": now.isoformat(),
            "message": "Module submitted for review successfully",
        }

    # ─── Approve Module ───────────────────────────────────────────────────────

    async def approve_module(self, module_id: str, admin_id: int) -> Dict[str, Any]:
        """
        Admin approves a module for publication.
        Transitions: IN_REVIEW → PUBLISHED
        Also publishes all DRAFT lessons within the module.
        """
        module = await prisma.module.find_unique(
            where={"id": module_id},
            include={"lessons": {"where": {"deletedAt": None}}},
        )

        if not module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.module.not_found",
            )

        current_status = getattr(module, "status", "DRAFT")
        _validate_transition(current_status, "PUBLISHED")

        now = datetime.now(timezone.utc)
        await prisma.module.update(
            where={"id": module_id},
            data={
                "status": "PUBLISHED",
                "publishedAt": now,
                "reviewedBy": admin_id,
                "rejectionReason": None,
                "featured": module.featured,  # preserve existing featured state
            },
        )

        # Publish all draft lessons in this module
        lesson_count = await prisma.lesson.update_many(
            where={"moduleId": module_id, "status": "DRAFT", "deletedAt": None},
            data={"status": "PUBLISHED"},
        )

        # Update totalLessons count
        published_lessons = len(
            [l for l in (module.lessons or []) if l.deletedAt is None]
        )
        await prisma.module.update(
            where={"id": module_id},
            data={"totalLessons": published_lessons},
        )

        # Audit log
        await self._log_transition(
            module_id=module_id,
            actor_id=admin_id,
            from_status=current_status,
            to_status="PUBLISHED",
            reason=None,
        )

        # Notify instructor
        if module.instructorId:
            await self._safe_notify(self._notify_instructor_approved, module)

        logger.info(f"Module {module_id} approved by admin {admin_id}")

        return {
            "success": True,
            "module_id": module_id,
            "status": "PUBLISHED",
            "published_at": now.isoformat(),
            "lessons_published": getattr(lesson_count, "count", 0)
            if hasattr(lesson_count, "count")
            else 0,
        }

    # ─── Reject Module ────────────────────────────────────────────────────────

    async def reject_module(
        self, module_id: str, admin_id: int, reason: str
    ) -> Dict[str, Any]:
        """
        Admin rejects a module, sending it back to DRAFT with a reason.
        Transitions: IN_REVIEW → DRAFT

        The instructor can then edit and re-submit.
        """
        # Sanitize and validate reason
        clean_reason = _sanitize_text(reason)
        if len(clean_reason) < MIN_REJECTION_REASON_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.module.rejection_reason_too_short",
            )
        if len(clean_reason) > MAX_REJECTION_REASON_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.module.rejection_reason_too_long",
            )

        module = await prisma.module.find_unique(where={"id": module_id})

        if not module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.module.not_found",
            )

        current_status = getattr(module, "status", "DRAFT")
        _validate_transition(current_status, "DRAFT")

        await prisma.module.update(
            where={"id": module_id},
            data={
                "status": "DRAFT",
                "reviewedBy": admin_id,
                "rejectionReason": clean_reason,
            },
        )

        # Audit log
        await self._log_transition(
            module_id=module_id,
            actor_id=admin_id,
            from_status=current_status,
            to_status="DRAFT",
            reason=clean_reason,
        )

        # Notify instructor
        if module.instructorId:
            await self._safe_notify(
                self._notify_instructor_rejected, module, clean_reason
            )

        logger.info(
            f"Module {module_id} rejected by admin {admin_id}: {clean_reason[:50]}..."
        )

        return {
            "success": True,
            "module_id": module_id,
            "status": "DRAFT",
            "reason": clean_reason,
        }

    # ─── Unpublish Module ─────────────────────────────────────────────────────

    async def unpublish_module(
        self, module_id: str, admin_id: int, reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Admin takes down a published module.
        Transitions: PUBLISHED → ARCHIVED
        """
        module = await prisma.module.find_unique(where={"id": module_id})

        if not module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.module.not_found",
            )

        current_status = getattr(module, "status", "DRAFT")
        _validate_transition(current_status, "ARCHIVED")

        clean_reason = _sanitize_text(reason) if reason else None

        await prisma.module.update(
            where={"id": module_id},
            data={
                "status": "ARCHIVED",
                "reviewedBy": admin_id,
                "rejectionReason": clean_reason,
            },
        )

        # Audit log
        await self._log_transition(
            module_id=module_id,
            actor_id=admin_id,
            from_status=current_status,
            to_status="ARCHIVED",
            reason=clean_reason,
        )

        # Notify instructor
        if module.instructorId:
            await self._safe_notify(self._notify_instructor_unpublished, module)

        logger.info(f"Module {module_id} unpublished by admin {admin_id}")

        return {
            "success": True,
            "module_id": module_id,
            "status": "ARCHIVED",
        }

    # ─── Bulk Moderate Modules ───────────────────────────────────────────────

    async def bulk_moderate_modules(
        self, admin_id: int, ids: List[str], action: str
    ) -> Dict[str, Any]:
        """
        Bulk publish, unpublish, or delete modules with verification gates and audit logging.
        """
        from app.services.audit_trail_service import AuditTrailService

        success = 0
        failed = 0
        errors: List[str] = []

        for module_id in ids:
            try:
                module = await prisma.module.find_unique(
                    where={"id": module_id},
                    include={"lessons": {"where": {"deletedAt": None}}},
                )
                if not module:
                    failed += 1
                    errors.append(f"{module_id}: Module not found")
                    continue
                if module.deletedAt is not None:
                    failed += 1
                    errors.append(f"{module_id}: Module is deleted")
                    continue

                before_state = {
                    "status": getattr(module, "status", None),
                    "featured": module.featured,
                }

                if action == "publish":
                    if not module.title or not module.title.strip():
                        failed += 1
                        errors.append(f"{module_id}: Module title cannot be empty")
                        continue
                    if not module.description or not module.description.strip():
                        failed += 1
                        errors.append(
                            f"{module_id}: Module description cannot be empty"
                        )
                        continue
                    active_lessons = [
                        l for l in (module.lessons or []) if l.deletedAt is None
                    ]
                    if len(active_lessons) < 1:
                        failed += 1
                        errors.append(
                            f"{module_id}: Module requires at least 1 lesson before publication"
                        )
                        continue

                    now = datetime.now(timezone.utc)
                    await prisma.module.update(
                        where={"id": module_id},
                        data={
                            "status": "PUBLISHED",
                            "publishedAt": now,
                            "reviewedBy": admin_id,
                            "rejectionReason": None,
                        },
                    )
                    await prisma.lesson.update_many(
                        where={
                            "moduleId": module_id,
                            "status": "DRAFT",
                            "deletedAt": None,
                        },
                        data={"status": "PUBLISHED"},
                    )
                    await AuditTrailService.log_action(
                        actor_id=admin_id,
                        action="MODULE_BULK_PUBLISHED",
                        domain="EDUCATION",
                        resource_type="Module",
                        resource_id=module_id,
                        before_state=before_state,
                        after_state={
                            "status": "PUBLISHED",
                            "publishedAt": now.isoformat(),
                        },
                    )
                    success += 1

                elif action == "unpublish":
                    await prisma.module.update(
                        where={"id": module_id},
                        data={"status": "ARCHIVED"},
                    )
                    await AuditTrailService.log_action(
                        actor_id=admin_id,
                        action="MODULE_BULK_UNPUBLISHED",
                        domain="EDUCATION",
                        resource_type="Module",
                        resource_id=module_id,
                        before_state=before_state,
                        after_state={"status": "ARCHIVED"},
                    )
                    success += 1

                elif action == "delete":
                    now = datetime.now(timezone.utc)
                    await prisma.module.update(
                        where={"id": module_id},
                        data={"deletedAt": now},
                    )
                    await AuditTrailService.log_action(
                        actor_id=admin_id,
                        action="MODULE_BULK_DELETED",
                        domain="EDUCATION",
                        resource_type="Module",
                        resource_id=module_id,
                        before_state=before_state,
                        after_state={"deletedAt": now.isoformat()},
                    )
                    success += 1

                else:
                    failed += 1
                    errors.append(f"{module_id}: Unknown action {action}")

            except Exception as e:
                failed += 1
                errors.append(f"{module_id}: {str(e)}")

        return {"success": success, "failed": failed, "errors": errors}

    # ─── Restore Archived Module ──────────────────────────────────────────────

    async def restore_module(self, module_id: str, admin_id: int) -> Dict[str, Any]:
        """
        Admin restores an archived module back to DRAFT for re-editing.
        Transitions: ARCHIVED → DRAFT
        """
        module = await prisma.module.find_unique(where={"id": module_id})

        if not module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.module.not_found",
            )

        current_status = getattr(module, "status", "DRAFT")
        _validate_transition(current_status, "DRAFT")

        await prisma.module.update(
            where={"id": module_id},
            data={
                "status": "DRAFT",
                "rejectionReason": None,
                "reviewedBy": admin_id,
            },
        )

        await self._log_transition(
            module_id=module_id,
            actor_id=admin_id,
            from_status=current_status,
            to_status="DRAFT",
            reason="Restored from archive",
        )

        logger.info(f"Module {module_id} restored to DRAFT by admin {admin_id}")

        return {
            "success": True,
            "module_id": module_id,
            "status": "DRAFT",
        }

    # ─── Bulk Operations ──────────────────────────────────────────────────────

    async def bulk_approve(
        self, module_ids: List[str], admin_id: int
    ) -> Dict[str, Any]:
        """Approve multiple modules at once. Skips any that aren't IN_REVIEW."""
        results: Dict[str, List[Any]] = {"approved": [], "skipped": [], "errors": []}

        for mid in module_ids:
            try:
                await self.approve_module(mid, admin_id)
                results["approved"].append(mid)
            except HTTPException as e:
                if e.status_code == 400:
                    results["skipped"].append({"id": mid, "reason": e.detail})
                else:
                    results["errors"].append({"id": mid, "reason": e.detail})

        return {
            "success": True,
            "approved_count": len(results["approved"]),
            "skipped_count": len(results["skipped"]),
            "error_count": len(results["errors"]),
            "details": results,
        }

    async def bulk_reject(
        self, module_ids: List[str], admin_id: int, reason: str
    ) -> Dict[str, Any]:
        """Reject multiple modules at once with the same reason."""
        results: Dict[str, List[Any]] = {"rejected": [], "skipped": [], "errors": []}

        for mid in module_ids:
            try:
                await self.reject_module(mid, admin_id, reason)
                results["rejected"].append(mid)
            except HTTPException as e:
                if e.status_code == 400:
                    results["skipped"].append({"id": mid, "reason": e.detail})
                else:
                    results["errors"].append({"id": mid, "reason": e.detail})

        return {
            "success": True,
            "rejected_count": len(results["rejected"]),
            "skipped_count": len(results["skipped"]),
            "error_count": len(results["errors"]),
            "details": results,
        }

    # ─── List Pending Review ──────────────────────────────────────────────────

    async def get_pending_review(
        self, page: int = 1, page_size: int = 20
    ) -> Dict[str, Any]:
        """Get all modules awaiting admin review, ordered by submission date (oldest first)."""
        skip = (page - 1) * page_size

        where_clause = {"status": "IN_REVIEW", "deletedAt": None}

        total = await prisma.module.count(where=where_clause)

        modules = await prisma.module.find_many(
            where=where_clause,
            include={
                "instructor": True,
                "lessons": {"where": {"deletedAt": None}},
            },
            order={"submittedAt": "asc"},
            skip=skip,
            take=page_size,
        )

        items = []
        for m in modules:
            items.append(
                {
                    "id": m.id,
                    "title": m.title,
                    "description": m.description,
                    "level": m.level,
                    "instructorId": m.instructorId,
                    "instructorName": m.instructor.fullName if m.instructor else None,
                    "instructorEmail": m.instructor.email if m.instructor else None,
                    "submittedAt": m.submittedAt.isoformat()
                    if getattr(m, "submittedAt", None)
                    else None,
                    "lessonCount": len(m.lessons) if m.lessons else 0,
                    "thumbnailUrl": m.thumbnailUrl,
                    "skills": m.skills or [],
                    "tags": m.tags or [],
                }
            )

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        }

    # ─── Instructor Modules ───────────────────────────────────────────────────

    async def get_instructor_drafts(
        self,
        instructor_id: int,
        page: int = 1,
        page_size: int = 20,
        status_filter: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get instructor's own modules.
        Optionally filter by status (DRAFT, IN_REVIEW, PUBLISHED, ARCHIVED).
        """
        skip = (page - 1) * page_size

        where_clause: Dict[str, Any] = {
            "instructorId": instructor_id,
            "deletedAt": None,
        }
        if status_filter and status_filter in VALID_TRANSITIONS:
            where_clause["status"] = status_filter

        total = await prisma.module.count(where=where_clause)

        modules = await prisma.module.find_many(
            where=where_clause,
            include={
                "lessons": {"where": {"deletedAt": None}},
                "enrollments": True,
                "reviews": True,
            },
            order={"updatedAt": "desc"},
            skip=skip,
            take=page_size,
        )

        items = []
        for m in modules:
            # Calculate average rating from reviews
            reviews = m.reviews or []
            avg_rating = (
                sum(r.rating for r in reviews) / len(reviews) if reviews else None
            )

            items.append(
                {
                    "id": m.id,
                    "title": m.title,
                    "description": m.description,
                    "status": getattr(m, "status", "DRAFT"),
                    "level": m.level,
                    "lessonCount": len(m.lessons) if m.lessons else 0,
                    "enrollmentCount": len(m.enrollments) if m.enrollments else 0,
                    "averageRating": round(avg_rating, 1) if avg_rating else None,
                    "reviewCount": len(reviews),
                    "rejectionReason": getattr(m, "rejectionReason", None),
                    "submittedAt": m.submittedAt.isoformat()
                    if getattr(m, "submittedAt", None)
                    else None,
                    "publishedAt": m.publishedAt.isoformat()
                    if getattr(m, "publishedAt", None)
                    else None,
                    "thumbnailUrl": m.thumbnailUrl,
                    "price": m.price,
                    "createdAt": m.createdAt.isoformat(),
                    "updatedAt": m.updatedAt.isoformat(),
                }
            )

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        }

    # ─── Module Detail for Review ─────────────────────────────────────────────

    async def get_module_review_detail(self, module_id: str) -> Dict[str, Any]:
        """
        Get full module detail for admin review — includes lessons, quiz info,
        and instructor profile.
        """
        module = await prisma.module.find_unique(
            where={"id": module_id},
            include={
                "instructor": True,
                "lessons": {
                    "where": {"deletedAt": None},
                    "order_by": {"order": "asc"},
                },
            },
        )

        if not module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.module.not_found",
            )

        lessons_data = []
        for lesson in module.lessons or []:
            lessons_data.append(
                {
                    "id": lesson.id,
                    "title": lesson.title,
                    "description": lesson.description,
                    "type": lesson.type,
                    "order": lesson.order,
                    "durationMinutes": lesson.durationMinutes,
                    "hasVideo": bool(lesson.videoUrl or lesson.hlsPath),
                    "hasQuiz": lesson.quizId is not None,
                    "status": getattr(lesson, "status", "DRAFT"),
                }
            )

        return {
            "id": module.id,
            "title": module.title,
            "description": module.description,
            "fullDescription": module.fullDescription,
            "level": module.level,
            "status": getattr(module, "status", "DRAFT"),
            "skills": module.skills or [],
            "tags": module.tags or [],
            "thumbnailUrl": module.thumbnailUrl,
            "price": module.price,
            "durationMinutes": module.durationMinutes,
            "estimatedEffort": module.estimatedEffort,
            "submittedAt": module.submittedAt.isoformat()
            if getattr(module, "submittedAt", None)
            else None,
            "instructor": {
                "id": module.instructor.id,
                "fullName": module.instructor.fullName,
                "email": module.instructor.email,
                "bio": module.instructor.bio,
                "profilePictureUrl": module.instructor.profilePictureUrl,
            }
            if module.instructor
            else None,
            "lessons": lessons_data,
            "lessonCount": len(lessons_data),
            "completenessScore": self._calculate_completeness_score(module),
        }

    # ─── Validation Helpers ───────────────────────────────────────────────────

    def _validate_module_completeness(self, module) -> List[str]:
        """
        Validate that a module meets minimum requirements for review submission.
        Returns a list of error messages (empty = valid).
        """
        errors = []

        # Title check
        if not module.title or len(module.title.strip()) < MIN_TITLE_LENGTH:
            errors.append(f"Title must be at least {MIN_TITLE_LENGTH} characters")

        # Description check
        if (
            not module.description
            or len(module.description.strip()) < MIN_DESCRIPTION_LENGTH
        ):
            errors.append(
                f"Description must be at least {MIN_DESCRIPTION_LENGTH} characters"
            )

        # Lessons check
        lessons = module.lessons or []
        active_lessons = [l for l in lessons if l.deletedAt is None]
        if len(active_lessons) < MIN_LESSONS_FOR_REVIEW:
            errors.append(
                f"Module must have at least {MIN_LESSONS_FOR_REVIEW} lesson(s)"
            )

        # Each lesson must have a title
        for i, lesson in enumerate(active_lessons):
            if not lesson.title or len(lesson.title.strip()) < 3:
                errors.append(f"Lesson {i + 1} is missing a title")

        return errors

    def _calculate_completeness_score(self, module) -> int:
        """
        Calculate a 0-100 completeness score for a module.
        Used by admins to quickly assess review readiness.
        """
        score = 0
        max_score = 0

        # Title (10 points)
        max_score += 10
        if module.title and len(module.title) >= 5:
            score += 10

        # Description (15 points)
        max_score += 15
        if module.description and len(module.description) >= 20:
            score += 15
        elif module.description and len(module.description) >= 10:
            score += 8

        # Full description (10 points)
        max_score += 10
        if module.fullDescription and len(module.fullDescription) >= 50:
            score += 10

        # Level set (5 points)
        max_score += 5
        if module.level:
            score += 5

        # Thumbnail (10 points)
        max_score += 10
        if module.thumbnailUrl:
            score += 10

        # Skills/tags (10 points)
        max_score += 10
        if module.skills and len(module.skills) >= 2:
            score += 5
        if module.tags and len(module.tags) >= 1:
            score += 5

        # Lessons (30 points)
        max_score += 30
        lessons = module.lessons or []
        active_lessons = [l for l in lessons if l.deletedAt is None]
        if len(active_lessons) >= 5:
            score += 30
        elif len(active_lessons) >= 3:
            score += 20
        elif len(active_lessons) >= 1:
            score += 10

        # Duration info (5 points)
        max_score += 5
        if module.durationMinutes and module.durationMinutes > 0:
            score += 5

        # Price set (5 points)
        max_score += 5
        if module.price is not None:
            score += 5

        return round((score / max_score) * 100) if max_score > 0 else 0

    # ─── Audit Logging ────────────────────────────────────────────────────────

    async def _log_transition(
        self,
        module_id: str,
        actor_id: int,
        from_status: str,
        to_status: str,
        reason: Optional[str] = None,
    ) -> None:
        """Log a status transition to the audit log for compliance tracking."""
        try:
            await prisma.auditlog.create(
                data={
                    "actorId": actor_id,
                    "eventType": "MODULE_STATUS_CHANGE",
                    "entityType": "Module",
                    "entityId": module_id,
                    "metadata": Json(
                        {
                            "from_status": from_status,
                            "to_status": to_status,
                            "reason": reason,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    ),
                }
            )
        except Exception as e:
            # Audit log failure should never block the main operation, but it must
            # be loud: a silently-dropped audit trail is a compliance failure.
            logger.error(
                f"FAILED to write audit log for module {module_id} "
                f"(actor={actor_id}, {from_status}->{to_status}): {e}",
                exc_info=True,
            )

    # ─── Safe Notification Wrapper ────────────────────────────────────────────

    async def _safe_notify(self, notify_fn, *args) -> None:
        """
        Call a notification function without letting failures propagate.
        Notifications are best-effort — they should never block the main flow.
        """
        try:
            await notify_fn(*args)
        except Exception as e:
            logger.warning(f"Notification delivery failed (non-blocking): {e}")

    # ─── Notification Implementations ─────────────────────────────────────────

    async def _notify_admins_new_submission(self, module) -> None:
        """Notify all admins that a new module is awaiting review."""
        admins = await prisma.user.find_many(
            where={"role": "ADMIN", "deletedAt": None, "isActive": True}
        )
        for admin in admins:
            await NotificationService.create_notification(
                NotificationCreate(
                    userId=admin.id,
                    type="module_submitted_for_review",
                    title="New module awaiting review",
                    body=f'"{module.title}" has been submitted for review by an instructor.',
                    category=NotificationCategory.COURSE,
                    data={
                        "moduleId": module.id,
                        "moduleTitle": module.title,
                        "instructorId": module.instructorId,
                        "action_url": f"/admin/content-review",
                    },
                )
            )

    async def _notify_instructor_approved(self, module) -> None:
        """Notify instructor their module was approved and published."""
        await NotificationService.create_notification(
            NotificationCreate(
                userId=module.instructorId,
                type="module_approved",
                title="notifications.module_approved.title",
                body="notifications.module_approved.body",
                category=NotificationCategory.COURSE,
                data={
                    "moduleId": module.id,
                    "moduleTitle": module.title,
                    "action_url": f"/learn/manage/{module.id}",
                },
            )
        )

    async def _notify_instructor_rejected(self, module, reason: str) -> None:
        """Notify instructor their module was rejected with feedback."""
        await NotificationService.create_notification(
            NotificationCreate(
                userId=module.instructorId,
                type="module_rejected",
                title="notifications.module_rejected.title",
                body="notifications.module_rejected.body",
                category=NotificationCategory.COURSE,
                data={
                    "moduleId": module.id,
                    "moduleTitle": module.title,
                    "reason": reason,
                    "action_url": f"/learn/manage/{module.id}",
                },
            )
        )

    async def _notify_instructor_unpublished(self, module) -> None:
        """Notify instructor their module was taken down."""
        await NotificationService.create_notification(
            NotificationCreate(
                userId=module.instructorId,
                type="module_unpublished",
                title="notifications.module_unpublished.title",
                body="notifications.module_unpublished.body",
                category=NotificationCategory.COURSE,
                data={
                    "moduleId": module.id,
                    "moduleTitle": module.title,
                    "action_url": f"/learn/manage/{module.id}",
                },
            )
        )


# Singleton
content_moderation_service = ContentModerationService()

# ─── Multilingual Profanity & Content Filtering ────────────────────────────────

_ENGLISH_TERMS = {
    "fuck",
    "fucker",
    "fucking",
    "shit",
    "bitch",
    "asshole",
    "bastard",
    "cunt",
    "dick",
    "pussy",
    "nigger",
    "nigga",
    "whore",
    "slut",
    "faggot",
    "cock",
}

_FRENCH_TERMS = {
    "merde",
    "putain",
    "pute",
    "salope",
    "connard",
    "connasse",
    "encule",
    "enculer",
    "batard",
    "chienne",
    "pd",
    "trouduc",
    "bite",
    "couille",
    "salaud",
}

_ARABIC_TERMS = {
    "قحبة",
    "شرموطة",
    "عرص",
    "منيك",
    "طيز",
    "زب",
    "كس",
    "قواد",
    "ديوث",
    "خرا",
    "حقير",
    "كلب",
    "ابن الكلب",
    "يلعن",
    "نعل",
    "سافل",
    "زبور",
}

_DARJA_ARABIZI_TERMS = {
    "kahba",
    "9ahba",
    "zebi",
    "zbi",
    "nek",
    "nik",
    "mnik",
    "mnyek",
    "terma",
    "7mar",
    "hmar",
    "klab",
    "chmeta",
    "kheb",
    "9awad",
    "gawad",
    "9a7ba",
    "zamel",
    "zammel",
    "khra",
    "kelb",
    "khanzir",
}

_ALL_PROHIBITED: set[str] = set()
_ALL_PROHIBITED.update(_ENGLISH_TERMS)
_ALL_PROHIBITED.update(_FRENCH_TERMS)
_ALL_PROHIBITED.update(_ARABIC_TERMS)
_ALL_PROHIBITED.update(_DARJA_ARABIZI_TERMS)


def _normalize_text(text: str) -> str:
    normalized = text.lower()
    normalized = re.sub(r"[@]", "a", normalized)
    normalized = re.sub(r"[$]", "s", normalized)
    normalized = re.sub(r"[!]", "i", normalized)
    normalized = re.sub(r"[0]", "o", normalized)
    normalized = re.sub(r"[1]", "i", normalized)
    return normalized


_PATTERNS: list[re.Pattern] = []
for term in _ALL_PROHIBITED:
    escaped = "".join(f"{re.escape(c)}+" for c in term)
    pattern = re.compile(
        rf"(?<![a-zA-Z0-9؀-ۿ]){escaped}(?![a-zA-Z0-9؀-ۿ])",
        re.IGNORECASE | re.UNICODE,
    )
    _PATTERNS.append(pattern)


def contains_profanity(text: str) -> bool:
    if not text or not text.strip():
        return False
    normalized = _normalize_text(text)
    for pattern in _PATTERNS:
        if pattern.search(text) or pattern.search(normalized):
            return True
    return False


def get_flagged_words(text: str) -> list[str]:
    if not text or not text.strip():
        return []
    flagged: list[str] = []
    normalized = _normalize_text(text)
    for pattern in _PATTERNS:
        for match in pattern.finditer(text):
            flagged.append(match.group(0))
        for match in pattern.finditer(normalized):
            flagged.append(match.group(0))
    return list(set(flagged))


def moderate_text(text: str, mode: str = "censor") -> tuple[str, bool]:
    if not text or not text.strip():
        return text, False

    was_flagged = False
    result = text

    for pattern in _PATTERNS:
        matches = list(pattern.finditer(result))
        if matches:
            was_flagged = True
            for match in reversed(matches):
                start, end = match.span()
                length = end - start
                mask = "*" * max(length, 3)
                result = result[:start] + mask + result[end:]

    if was_flagged:
        logger.info("Content moderation: Profanity sanitized in message.")

    return result, was_flagged


# ─── Disintermediation & Contact Obfuscation Defense ─────────────────────────

# Direct and obfuscated Algerian phone numbers (+213 / 00213 / 05 / 06 / 07)
_PHONE_REGEX = re.compile(
    r"(?:\+213|00213|0)[ -._/]*[5-7](?:[ -._/]*\d){8}\b",
    re.IGNORECASE,
)

# Algerian Postal / Bank RIP (20 digits, standard prefix 007 or plain 20 digits)
_RIP_REGEX = re.compile(
    r"\b007(?:[ -._/]*\d){17}\b|\b(?:\d[ -._/]*){20}\b",
    re.IGNORECASE,
)

# External messaging links & handles
_EXTERNAL_CHANNELS_REGEX = re.compile(
    r"(?:https?:\/\/)?(?:www\.)?(?:wa\.me|t\.me|telegram\.me|api\.whatsapp\.com|viber\.com|instagram\.com|fb\.me)\/[a-zA-Z0-9_\+\-\.]+|"
    r"\b(?:whatsapp|watsap|watssap|watsapp|viber|telegram|telegrame|insta(?:gram)?|snap(?:chat)?)\s*[:=]?\s*[@+]?[a-zA-Z0-9_.\-]{3,30}\b",
    re.IGNORECASE,
)

# Obfuscated emails (e.g. name at gmail dot com, name[at]gmail[dot]com)
_OBFUSCATED_EMAIL_REGEX = re.compile(
    r"\b[a-zA-Z0-9._%+-]+(?:\s*@\s*|\s+(?:at|arobase|arobas)\s+)[a-zA-Z0-9.-]+(?:\s*\.\s*|\s+(?:dot|point)\s+)[a-zA-Z]{2,}\b",
    re.IGNORECASE,
)

# Phonetic / Spelled-out numbers in French, Arabic, and Algerian Darja
_PHONETIC_NUMBER_PATTERNS = [
    # French spelled-out phone prefix: zero cinq / zero six / zero sept
    re.compile(
        r"\b(?:z[eé]ro|o)\s+(?:cinq|six|sept)\s+(?:[a-z0-9\s]{4,30})\b", re.IGNORECASE
    ),
    # Darja / Arabizi spelled-out phone prefix: sefra khamsa / sefra setta / sefra sab3a / zero khamsa
    re.compile(
        r"\b(?:sefr?a?|zero)\s+(?:khams[a-z]*|sett?[a-z]*|sab[3a-z]*|seb[3a-z]*|khmsa)\s+(?:[a-z0-9\s]{4,30})\b",
        re.IGNORECASE,
    ),
    # Arabic spelled-out phone prefix: صفر خمسة / صفر ستة / صفر سبعة
    re.compile(
        r"\b(?:صفر)\s+(?:خمسة|ستة|سبعة)\s+(?:[؀-ۿ0-9\s]{4,30})\b", re.IGNORECASE
    ),
]


def detect_disintermediation(text: str) -> tuple[bool, list[str]]:
    """Detect off-platform contact sharing and disintermediation attempts."""
    if not text or not text.strip():
        return False, []

    detected_reasons: list[str] = []

    if _PHONE_REGEX.search(text):
        detected_reasons.append("phone_number")
    if _RIP_REGEX.search(text):
        detected_reasons.append("algerian_rip")
    if _EXTERNAL_CHANNELS_REGEX.search(text):
        detected_reasons.append("external_social_channel")
    if _OBFUSCATED_EMAIL_REGEX.search(text):
        detected_reasons.append("obfuscated_email")

    for pat in _PHONETIC_NUMBER_PATTERNS:
        if pat.search(text):
            detected_reasons.append("phonetic_phone_number")
            break

    return len(detected_reasons) > 0, detected_reasons


def mask_disintermediation(text: str) -> tuple[str, bool]:
    """
    Sanitize text to replace off-platform contact information with standard compliance placeholders.
    Returns (sanitized_text, was_modified).
    """
    if not text or not text.strip():
        return text, False

    result = text
    modified = False

    if _PHONE_REGEX.search(result):
        result = _PHONE_REGEX.sub("[NUMÉRO MASQUÉ]", result)
        modified = True

    if _RIP_REGEX.search(result):
        result = _RIP_REGEX.sub("[RIP MASQUÉ]", result)
        modified = True

    if _EXTERNAL_CHANNELS_REGEX.search(result):
        result = _EXTERNAL_CHANNELS_REGEX.sub("[CANAL EXTERNE MASQUÉ]", result)
        modified = True

    if _OBFUSCATED_EMAIL_REGEX.search(result):
        result = _OBFUSCATED_EMAIL_REGEX.sub("[EMAIL MASQUÉ]", result)
        modified = True

    for pat in _PHONETIC_NUMBER_PATTERNS:
        if pat.search(result):
            result = pat.sub("[NUMÉRO PHONÉTIQUE MASQUÉ]", result)
            modified = True

    return result, modified
