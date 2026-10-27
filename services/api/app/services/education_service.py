from typing import List, Optional, Dict, Any
from app.core.prisma import prisma
from app.core.config import setting
from app.schemas.education import (
    ModuleResponse,
    LessonResponse,
    ProgressUpdate,
    EnrollmentResponse,
    PathResponse,
    ModuleListResponse,
    PathListResponse,
    UserLearningStats,
    LearningPathRecommendation,
    SearchQuery,
    SearchResults,
    InstructorResponse,
    CourseReviewResponse,
    PaginatedReviewsResponse,
)
from app.schemas.auth import UserRole
from datetime import datetime, timedelta, timezone
import math
import logging
import json
from enum import Enum
import asyncio
import inspect

from app.services.billing_services.entitlement_service import entitlement_service
from app.services.billing_services.usage_tracking_service import usage_tracking_service


logger = logging.getLogger(__name__)


class SortBy(str, Enum):
    RELEVANCE = "relevance"
    POPULARITY = "popularity"
    RECENT = "recent"
    DURATION = "duration"
    DIFFICULTY = "difficulty"
    PRICE = "price"


class ProgressUpdateResult(str, Enum):
    """Typed result from update_lesson_progress / complete_lesson.

    Distinct values allow the router to return precise HTTP status codes
    instead of collapsing all failures into a generic 403.
    """

    OK = "ok"
    NOT_FOUND = "not_found"  # Lesson does not exist         → 404
    ACCESS_DENIED = "access_denied"  # User has no module access     → 403
    LOCKED = "locked"  # Lesson is sequentially locked  → 403
    CRITERIA_NOT_MET = "criteria_not_met"  # Server-side policy rejection → 403
    ERROR = "error"  # Unexpected exception           → 500


class EducationService:
    def __init__(self):
        """Initialize education service"""
        pass

    async def check_access(self, user_id: int, module_id: str) -> bool:
        """
        Authoritative check if a user has access to a module.
        Checks:
        0. Enrollment expiry — if the enrollment has expired, deny access
        1. Direct module entitlement (one-time purchase)
        2. Path entitlement (if the module belongs to a path the user owns)
        3. Subscription entitlement (if the user has an active student subscription)
        4. Check if module is FREE
        """
        from datetime import datetime, timezone

        # Unpublished/deleted modules are never accessible to non-owners.
        if not await self._can_view_module(module_id, user_id):
            return False

        # 0. Check enrollment expiry — subscription-based enrollments have expiresAt
        enrollment = await prisma.enrollment.find_first(
            where={"userId": user_id, "moduleId": module_id, "deletedAt": None}
        )
        if enrollment and enrollment.expiresAt:
            if datetime.now(timezone.utc) > enrollment.expiresAt:
                logger.info(f"Enrollment expired for user {user_id} module {module_id}")
                return False

        # Batch check path-level enrollment expiry
        path_links = await prisma.pathmodule.find_many(where={"moduleId": module_id})
        if path_links:
            path_ids = [link.pathId for link in path_links]
            path_enrollments_raw = await prisma.enrollment.find_many(
                where={"userId": user_id, "pathId": {"in": path_ids}, "deletedAt": None}
            )
            path_enrollments = {e.pathId: e for e in path_enrollments_raw}
            for link in path_links:
                path_enrollment = path_enrollments.get(link.pathId)
                if path_enrollment and path_enrollment.expiresAt:
                    if datetime.now(timezone.utc) > path_enrollment.expiresAt:
                        logger.info(
                            f"Path enrollment expired for user {user_id} path {link.pathId}"
                        )
                        return False

        # 1. Direct one-time purchase
        if await entitlement_service.has_entitlement(user_id, "course", module_id):
            return True

        # 2. Check if part of an owned path (use cached path_links from above)
        if path_links:
            for link in path_links:
                if await entitlement_service.has_entitlement(
                    user_id, "path", link.pathId
                ):
                    return True

        # 3. Check active subscription permissions
        try:
            from app.services.billing_services.education_service import (
                education_billing_service,
            )

            if await education_billing_service.can_access_course_via_subscription(
                user_id, module_id
            ):
                return True
        except Exception:
            logger.exception(
                f"Error checking subscription for user {user_id} module {module_id}"
            )

        # 3b. Check corporate seat pool allocation
        allocation = await prisma.seatallocation.find_first(
            where={
                "userId": user_id,
                "revokedAt": None,
                "pool": {"moduleId": module_id, "organization": {"deletedAt": None}},
            }
        )
        if allocation:
            return True

        # 4. Check if module is FREE
        module = await prisma.module.find_unique(where={"id": module_id})
        if module:
            # Soft-deleted modules are never accessible, even via the free-price path.
            if module.deletedAt is not None:
                return False
            price_data = self._parse_price(module.price)
            original_price = price_data.get("original", 0) or 0
            discounted_price = price_data.get("discounted")

            # If either price is 0 or less, it's a free module
            if original_price <= 0 or (
                discounted_price is not None and discounted_price <= 0
            ):
                return True

        return False

    async def _can_view_module(self, module_id: str, user_id: Optional[int]) -> bool:
        """Returns True if the user may view this module.

        Soft-deleted modules are always denied. Unpublished modules are only
        visible to the owner, admins, and moderators.
        """
        module = await prisma.module.find_unique(
            where={"id": module_id},
        )
        if not module:
            return False
        # Soft-deleted modules are denied unconditionally.
        if getattr(module, "deletedAt", None) is not None:
            return False
        if module.status == "PUBLISHED":
            return True
        if not user_id:
            return False
        if module.instructorId == user_id:
            return True

        # [HIGH-EDT-02] Active enrollment verification: paying/enrolled students retain access even if module is DRAFT or IN_REVIEW
        try:
            enrollment = await prisma.enrollment.find_first(
                where={
                    "userId": user_id,
                    "moduleId": module_id,
                    "deletedAt": None,
                }
            )
            if enrollment:
                return True
        except Exception as e:
            logger.warning(
                f"Failed to check enrollment for user {user_id} (module {module_id}): {e}"
            )

        try:
            from app.core.auth import is_privileged_role

            user = await prisma.user.find_unique(where={"id": user_id})
            if user and is_privileged_role(user.role):
                return True
        except Exception as e:
            logger.warning(
                f"Failed to resolve role for user {user_id} (module {module_id}): {e}"
            )
        return False

    async def get_modules(
        self,
        user_id: Optional[int] = None,
        featured: Optional[bool] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        lightweight: bool = False,  # For public endpoints
    ) -> List[ModuleListResponse]:
        """Get modules with optimized queries for list view"""
        try:
            logger.debug(
                f"Getting modules - user_id: {user_id}, featured: {featured}, limit: {limit}, lightweight: {lightweight}"
            )

            # Build WHERE clause
            where_clause = {"deletedAt": None}
            if featured is not None:
                where_clause["featured"] = featured

            # Public/lightweight queries only show PUBLISHED modules
            if lightweight:
                where_clause["status"] = "PUBLISHED"

            # Load modules with includes - ONLY ESSENTIAL DATA
            modules = await prisma.module.find_many(
                where=where_clause,
                include={
                    "instructor": True,
                    "enrollments": {
                        "where": {"userId": user_id} if user_id else {},
                        "take": 1,  # Only need first enrollment for user
                    },
                },
                order={"createdAt": "desc"},
                take=limit,
                skip=offset,
            )

            logger.debug(f"Found {len(modules)} modules")

            # EARLY RETURN if no modules
            if not modules:
                return []

            # BATCH QUERIES FOR ALL MODULES AT ONCE
            module_ids = [m.id for m in modules]

            # Get all counts in PARALLEL using asyncio
            enrollment_counts = {}
            lesson_counts = {}
            module_paths = {}

            # Run all batch queries in parallel
            async def get_enrollment_counts():
                try:
                    if not module_ids:
                        return {}

                    results = await prisma.enrollment.group_by(
                        by=["moduleId"],
                        where={"moduleId": {"in": module_ids}},
                        count={"_all": True},
                    )
                    return {r["moduleId"]: r["_count"]["_all"] for r in results}
                except Exception as e:
                    logger.error(f"Error getting enrollment counts: {e}")
                    return {}

            async def get_lesson_counts():
                try:
                    if not module_ids:
                        return {}

                    results = await prisma.lesson.group_by(
                        by=["moduleId"],
                        where={"moduleId": {"in": module_ids}},
                        count={"_all": True},
                    )
                    return {r["moduleId"]: r["_count"]["_all"] for r in results}
                except Exception as e:
                    logger.error(f"Error getting lesson counts: {e}")
                    return {}

            async def get_module_paths():
                try:
                    if not module_ids:
                        return {}

                    path_modules = await prisma.pathmodule.find_many(
                        where={"moduleId": {"in": module_ids}},
                        include={"path": True},
                        order={"order": "asc"},
                    )

                    module_paths_dict = {}
                    for pm in path_modules:
                        module_id = pm.moduleId
                        if module_id not in module_paths_dict:
                            module_paths_dict[module_id] = []
                        if pm.path:
                            module_paths_dict[module_id].append(pm.path.title)
                    return module_paths_dict
                except Exception as e:
                    logger.error(f"Error getting path relationships: {e}")
                    return {}

            # Run tasks in parallel - skip path lookup for lightweight queries
            if lightweight:
                # Fast path: skip module paths for public endpoints
                (
                    enrollment_counts,
                    lesson_counts,
                    module_avg_ratings,
                ) = await asyncio.gather(
                    get_enrollment_counts(),
                    get_lesson_counts(),
                    self._get_module_avg_ratings(module_ids),
                )
                module_paths = {}
            else:
                # Full path: include all data
                (
                    enrollment_counts,
                    lesson_counts,
                    module_paths,
                    module_avg_ratings,
                ) = await asyncio.gather(
                    get_enrollment_counts(),
                    get_lesson_counts(),
                    get_module_paths(),
                    self._get_module_avg_ratings(module_ids),
                )

            # Build response
            result = []
            for module in modules:
                try:
                    # User enrollment/progress
                    is_enrolled = False
                    progress = 0.0

                    if user_id and module.enrollments:
                        is_enrolled = True
                        progress = (
                            module.enrollments[0].progress
                            if module.enrollments
                            else 0.0
                        )

                    # Get counts from batch data
                    lesson_count = lesson_counts.get(module.id, 0)
                    enrolled_count = enrollment_counts.get(module.id, 0)

                    # Instructor
                    instructor_data = None
                    if module.instructor:
                        instructor_data = InstructorResponse(
                            id=module.instructor.id,
                            fullName=module.instructor.fullName,
                            profilePictureUrl=module.instructor.profilePictureUrl,
                            bio=module.instructor.bio,
                            role=module.instructor.role,
                        )

                    # Parse price
                    price_data = self._parse_price(module.price)

                    # Category
                    category = "General"
                    if module.tags and len(module.tags) > 0:
                        category = module.tags[0]
                    elif module.skills and len(module.skills) > 0:
                        category = module.skills[0]

                    # Format duration
                    formatted_duration = (
                        self._format_duration(module.durationMinutes)
                        if module.durationMinutes
                        else "Unknown"
                    )

                    # Get paths
                    module_path_titles = module_paths.get(module.id, [])

                    # Build response
                    module_data = ModuleListResponse(
                        id=module.id,
                        title=module.title,
                        description=module.description,
                        level=module.level or "Beginner",
                        durationMinutes=module.durationMinutes,
                        duration_minutes=module.durationMinutes,
                        duration=formatted_duration,
                        totalLessons=lesson_count,
                        total_lessons=lesson_count,
                        thumbnailUrl=module.thumbnailUrl,
                        thumbnail_url=module.thumbnailUrl,
                        skills=module.skills or [],
                        tags=module.tags or [],
                        price=price_data,
                        featured=module.featured or False,
                        gradient=self._get_module_gradient(module),
                        icon=self._get_module_icon(module),
                        category=category,
                        progress=progress,
                        isEnrolled=is_enrolled,
                        is_enrolled=is_enrolled,
                        rating=module_avg_ratings.get(module.id),
                        enrolled=enrolled_count,
                        isNew=self._is_module_new(module),
                        is_new=self._is_module_new(module),
                        paths=module_path_titles,
                        instructor=instructor_data,
                        createdAt=module.createdAt.isoformat()
                        if module.createdAt
                        else None,
                        updatedAt=module.updatedAt.isoformat()
                        if module.updatedAt
                        else None,
                    )

                    result.append(module_data)

                except Exception as e:
                    logger.error(f"Error processing module {module.id}: {e}")
                    continue

            logger.debug(f"Successfully processed {len(result)} modules")
            return result

        except Exception as e:
            logger.error(f"Error in get_modules: {e}", exc_info=True)
            return []

    async def get_module(
        self,
        module_id: str,
        user_id: Optional[int] = None,
        include_lessons: bool = True,
    ) -> Optional[ModuleResponse]:
        """Get a single module with full details"""
        try:
            # Get the module with related data (optimized fields for <150ms response latency)
            include_data = {
                # The generated client emits invalid GraphQL for nested relation
                # selects (instructor.select), so load the full User object.
                "instructor": True,
                "enrollments": {"where": {"userId": user_id} if user_id else {}},
            }

            if include_lessons:
                # Nested relation selects are unsupported by the client; load full
                # lessons and let get_module_lessons() build the display fields.
                include_data["lessons"] = {
                    "order_by": {"order": "asc"},
                    "where": {"deletedAt": None},
                }

            module = await prisma.module.find_unique(
                where={"id": module_id}, include=include_data
            )

            if not module:
                return None

            # Early-exit for soft-deleted modules.
            if module.deletedAt is not None:
                logger.info(
                    f"Blocked view of soft-deleted module {module_id} for user {user_id}"
                )
                return None

            # Unpublished modules are only visible to owner/admin.
            if not await self._can_view_module(module_id, user_id):
                logger.info(
                    f"Blocked view of non-published module {module_id} for user {user_id}"
                )
                return None

            # Get enrollment count
            enrolled_count = await prisma.enrollment.count(
                where={"moduleId": module_id}
            )

            # Get lessons with progress if requested
            lessons_data = []
            if include_lessons and module.lessons:
                lessons_data = await self.get_module_lessons(module_id, user_id)

            # Get progress and enrollment status
            progress = 0.0
            is_enrolled = False
            has_access = False

            if user_id:
                has_access = await self.check_access(user_id, module_id)
                if module.enrollments:
                    is_enrolled = True
                    progress = module.enrollments[0].progress

            # Prepare instructor data
            instructor_data = None
            if module.instructor:
                instructor_data = InstructorResponse(
                    id=module.instructor.id,
                    fullName=module.instructor.fullName,
                    profilePictureUrl=module.instructor.profilePictureUrl,
                    bio=module.instructor.bio,
                    role=module.instructor.role,
                )

            # Calculate total duration from lessons if not set
            total_duration = module.durationMinutes
            if not total_duration and module.lessons:
                total_duration = sum(
                    lesson.durationMinutes or 0 for lesson in module.lessons
                )

            # Extract metadata from JSON if available
            metadata = {}
            if module.price and isinstance(module.price, str):
                try:
                    metadata = json.loads(module.price)
                except json.JSONDecodeError:
                    logger.debug(
                        f"Failed to parse module price JSON for module {module.id}"
                    )
            elif isinstance(module.price, dict):
                metadata = module.price

            # Get paths this module belongs to
            path_titles = []
            path_objects = []
            try:
                path_links = await prisma.pathmodule.find_many(
                    where={"moduleId": module_id}, include={"path": True}
                )
                for link in path_links:
                    if link.path:
                        path_titles.append(link.path.title)
                        path_objects.append(
                            {"id": link.path.id, "title": link.path.title}
                        )
            except Exception as e:
                logger.error(f"Error fetching paths for module {module_id}: {e}")

            # Get live sessions linked to this module
            live_sessions = []
            try:
                session_links = await prisma.livesessionmodulelink.find_many(
                    where={"moduleId": module_id},
                    include={"liveSession": True},
                    order={"order": "asc"},
                )
                for link in session_links:
                    if (
                        link.liveSession
                        and getattr(link.liveSession, "deletedAt", None) is None
                    ):
                        session_data = link.liveSession.model_dump()
                        session_data["link_order"] = link.order
                        session_data["link_is_required"] = link.isRequired
                        session_data["link_id"] = link.id
                        live_sessions.append(session_data)
            except Exception as e:
                logger.error(
                    f"Error fetching live sessions for module {module_id}: {e}"
                )

            # Prepare module response
            module_response = ModuleResponse(
                id=module.id,
                title=module.title,
                description=module.description,
                fullDescription=module.fullDescription,
                durationMinutes=total_duration,
                estimatedEffort=module.estimatedEffort
                or metadata.get("estimatedEffort"),
                totalLessons=len(module.lessons) if module.lessons else 0,
                level=module.level or metadata.get("level") or "Beginner",
                instructorId=module.instructorId,
                skills=module.skills or metadata.get("skills") or [],
                tags=module.tags or metadata.get("tags") or [],
                price=self._parse_price(module.price),
                featured=module.featured or False,
                lastUpdated=module.lastUpdated or module.updatedAt,
                createdAt=module.createdAt,
                updatedAt=module.updatedAt,
                deletedAt=module.deletedAt,
                gradient=self._get_module_gradient(module) or metadata.get("gradient"),
                icon=self._get_module_icon(module) or metadata.get("icon"),
                category=self._get_module_category(module)
                or metadata.get("category")
                or "Foundation",
                learningObjectives=module.skills
                or metadata.get("learningObjectives")
                or [],
                prerequisites=metadata.get("prerequisites") or [],
                completionBadge=module.title + " Badge"
                if not metadata.get("completionBadge")
                else metadata.get("completionBadge"),
                what_you_get=metadata.get("whatYouGet")
                or [
                    f"{len(module.lessons) if module.lessons else 0} lessons",
                    "Full access",
                ],
                features=metadata.get("features") or ["Mobile access"],
                requirements=metadata.get("requirements") or ["Internet connection"],
                target_audience=metadata.get("targetAudience") or ["Students"],
                paths=path_objects if path_objects else path_titles,
                instructor=instructor_data,
                lessons=lessons_data,
                progress=progress,
                isEnrolled=is_enrolled,
                hasAccess=has_access,
                rating=await self._get_module_avg_rating(module_id),
                enrolled=enrolled_count,
                isNew=self._is_module_new(module),
                totalDuration=self._format_duration(total_duration),
                live_sessions=live_sessions,
            )

            return module_response

        except Exception as e:
            logger.error(f"Error getting module {module_id}: {e}")
            logger.error(f"Error getting module {module_id}: {e}")
            import traceback

            traceback.print_exc()
            return None

    async def get_paths(
        self,
        user_id: Optional[int] = None,
        featured: Optional[bool] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[PathListResponse]:
        """Get all learning paths with optimized queries"""
        try:
            # Build query conditions
            where_clause = {}
            if featured is not None:
                where_clause["featured"] = featured

            # Get paths with their modules - FIXED: Use correct Prisma syntax
            paths = await prisma.path.find_many(
                where=where_clause,
                take=limit,
                skip=offset,
                include={
                    "modules": {
                        "include": {
                            "module": True  # Load all module fields for now
                        },
                        "order_by": {"order": "asc"},
                    },
                    "enrollments": {
                        "where": {"userId": user_id} if user_id else {},
                        "take": 1,
                    },
                },
                order={"createdAt": "desc"},
            )

            if not paths:
                return []

            # EARLY RETURN for empty paths
            if not paths:
                return []

            # Prepare for batch queries
            path_ids = [path.id for path in paths]
            all_module_ids = []

            # Collect all module IDs for batch queries
            for path in paths:
                for path_module in path.modules:
                    if path_module.module:
                        all_module_ids.append(path_module.module.id)

            # Run ALL batch queries in parallel
            async def get_path_enrollment_counts():
                try:
                    if not path_ids:
                        return {}

                    results = await prisma.enrollment.group_by(
                        by=["pathId"],
                        where={"pathId": {"in": path_ids}},
                        count={"_all": True},
                    )
                    return {r["pathId"]: r["_count"]["_all"] for r in results}
                except Exception as e:
                    logger.error(f"Error getting path enrollment counts: {e}")
                    return {}

            async def get_module_enrollment_counts():
                try:
                    if not all_module_ids:
                        return {}

                    results = await prisma.enrollment.group_by(
                        by=["moduleId"],
                        where={"moduleId": {"in": all_module_ids}},
                        count={"_all": True},
                    )
                    return {r["moduleId"]: r["_count"]["_all"] for r in results}
                except Exception as e:
                    logger.error(f"Error getting module enrollment counts: {e}")
                    return {}

            async def get_module_lesson_counts():
                try:
                    if not all_module_ids:
                        return {}

                    results = await prisma.lesson.group_by(
                        by=["moduleId"],
                        where={"moduleId": {"in": all_module_ids}},
                        count={"_all": True},
                    )
                    return {r["moduleId"]: r["_count"]["_all"] for r in results}
                except Exception as e:
                    logger.error(f"Error getting module lesson counts: {e}")
                    return {}

            # Execute all batch queries in parallel
            (
                path_enrollment_counts,
                module_enrollment_counts,
                module_lesson_counts,
                module_avg_ratings,
            ) = await asyncio.gather(
                get_path_enrollment_counts(),
                get_module_enrollment_counts(),
                get_module_lesson_counts(),
                self._get_module_avg_ratings(all_module_ids),
            )

            result = []
            for path in paths:
                try:
                    # Get enrollment status and progress
                    is_enrolled = bool(path.enrollments)
                    progress = path.enrollments[0].progress if path.enrollments else 0.0

                    # Get path enrollment count from batch data
                    enrolled_count = path_enrollment_counts.get(path.id, 0)
                    total_modules = len(path.modules)

                    # Calculate total duration from modules
                    total_duration = 0
                    for path_module in path.modules:
                        if path_module.module and path_module.module.durationMinutes:
                            total_duration += path_module.module.durationMinutes

                    # Get featured modules (first 3 for preview) - USE BATCH DATA
                    featured_modules = []
                    for i, path_module in enumerate(path.modules[:3]):
                        if path_module.module:
                            module = path_module.module

                            # Get counts from batch data
                            module_enrolled = module_enrollment_counts.get(module.id, 0)
                            module_lesson_count = module_lesson_counts.get(module.id, 0)

                            # Get category
                            category = "General"
                            if module.tags and len(module.tags) > 0:
                                category = module.tags[0]
                            elif module.skills and len(module.skills) > 0:
                                category = module.skills[0]

                            # Create simplified module response
                            module_response = ModuleListResponse(
                                id=module.id,
                                title=module.title,
                                description=module.description,
                                level=module.level or "Beginner",
                                duration_minutes=module.durationMinutes,
                                durationMinutes=module.durationMinutes,
                                duration=self._format_duration(module.durationMinutes)
                                if module.durationMinutes
                                else "Unknown",
                                total_lessons=module_lesson_count,
                                totalLessons=module_lesson_count,
                                thumbnailUrl=module.thumbnailUrl,
                                thumbnail_url=module.thumbnailUrl,
                                skills=module.skills or [],
                                tags=module.tags or [],
                                price=self._parse_price(module.price),
                                featured=module.featured or False,
                                gradient=self._get_module_gradient(module),
                                icon=self._get_module_icon(module),
                                category=category,
                                progress=0.0,
                                is_enrolled=False,
                                isEnrolled=False,
                                rating=module_avg_ratings.get(module.id),
                                enrolled=module_enrolled,
                                is_new=self._is_module_new(module),
                                isNew=self._is_module_new(module),
                                instructor=None,
                                paths=[],
                            )
                            featured_modules.append(module_response)

                    # Compute path price as 80% of module effective prices
                    path_module_sum = sum(
                        self._get_effective_price(self._parse_price(pm.module.price))
                        for pm in path.modules
                        if pm.module
                    )
                    path_discounted = int(path_module_sum * 0.8)
                    path_price = {
                        "original": path_module_sum,
                        "discounted": path_discounted
                        if path_discounted < path_module_sum
                        else None,
                        "currency": "DZD",
                    }

                    path_response = PathListResponse(
                        id=path.id,
                        title=path.title,
                        description=path.description,
                        total_modules=total_modules,
                        totalModules=total_modules,
                        total_lessons=path.totalLessons or 0,
                        totalLessons=path.totalLessons or 0,
                        total_duration=self._format_duration(total_duration),
                        totalDuration=self._format_duration(total_duration),
                        progress=progress,
                        is_enrolled=is_enrolled,
                        isEnrolled=is_enrolled,
                        enrolled=enrolled_count,
                        estimated_completion_time=self._estimate_completion_time(
                            total_duration
                        ),
                        estimatedCompletionTime=self._estimate_completion_time(
                            total_duration
                        ),
                        featured=path.featured or False,
                        level="Beginner",
                        thumbnailUrl=path.thumbnailUrl,
                        thumbnail_url=path.thumbnailUrl,
                        featured_modules=featured_modules,
                        price=path_price,
                        created_at=path.createdAt.isoformat()
                        if path.createdAt
                        else None,
                        updated_at=path.updatedAt.isoformat()
                        if path.updatedAt
                        else None,
                    )

                    result.append(path_response)

                except Exception as e:
                    logger.error(f"Error processing path {path.id}: {e}")
                    continue

            return result

        except Exception as e:
            logger.error(f"Error getting paths: {e}")
            return []

    async def get_path(
        self, path_id: str, user_id: Optional[int] = None
    ) -> Optional[PathResponse]:
        """Get a specific learning path with all modules"""
        try:
            # Optimized query
            path = await prisma.path.find_unique(
                where={"id": path_id},
                include={
                    "modules": {
                        "include": {
                            "module": {
                                "include": {
                                    # Nested relation selects are unsupported by the
                                    # client (invalid GraphQL); load full lessons.
                                    "lessons": {
                                        "where": {"deletedAt": None},
                                        "order_by": {"order": "asc"},
                                    },
                                    # Load full instructor; fields picked below.
                                    "instructor": True,
                                    "enrollments": {
                                        "where": {"userId": user_id} if user_id else {}
                                    },
                                }
                            }
                        },
                        "order_by": {"order": "asc"},
                    },
                    "enrollments": {"where": {"userId": user_id} if user_id else {}},
                },
            )

            if not path:
                return None

            # Deny soft-deleted paths.
            if path.deletedAt is not None:
                logger.info(
                    f"Blocked view of soft-deleted path {path_id} for user {user_id}"
                )
                return None

            # Get all module IDs for batch enrollment count query
            module_ids = []
            for path_module in path.modules:
                if path_module.module:
                    module_ids.append(path_module.module.id)

            # Batch query for module enrollment counts
            module_enrollment_counts = {}
            module_avg_ratings = {}
            if module_ids:
                try:
                    result, module_avg_ratings = await asyncio.gather(
                        prisma.enrollment.group_by(
                            by=["moduleId"],
                            where={"moduleId": {"in": module_ids}},
                            count={"_all": True},
                        ),
                        self._get_module_avg_ratings(module_ids),
                    )
                    module_enrollment_counts = {
                        r["moduleId"]: r["_count"]["_all"] for r in result
                    }
                except Exception as e:
                    logger.error(f"Error getting batch module enrollment counts: {e}")

            # Calculate path statistics and prepare modules
            total_duration = 0
            modules_data = []
            path_progress = 0.0

            for path_module in path.modules:
                module = path_module.module
                if module:
                    # Skip unpublished/deleted modules from path listings.
                    if not await self._can_view_module(module.id, user_id):
                        continue
                    module_duration = module.durationMinutes or 0
                    total_duration += module_duration

                    # Get module progress
                    module_progress = 0.0
                    module_is_enrolled = False
                    if user_id and module.enrollments:
                        module_is_enrolled = True
                        module_progress = module.enrollments[0].progress

                    # Get enrollment count from batch data
                    enrolled_count = module_enrollment_counts.get(module.id, 0)

                    # Prepare module response with access gating and progress calculation
                    module_lessons = await self.get_module_lessons(module.id, user_id)
                    lesson_count = len(module_lessons)
                    module_response = ModuleResponse(
                        id=module.id,
                        title=module.title,
                        description=module.description,
                        fullDescription=module.fullDescription,
                        durationMinutes=module_duration,
                        estimatedEffort=module.estimatedEffort,
                        totalLessons=lesson_count,
                        level=module.level or "Beginner",
                        instructorId=module.instructorId,
                        skills=module.skills or [],
                        tags=module.tags or [],
                        price=self._parse_price(module.price),
                        featured=module.featured or False,
                        lastUpdated=module.lastUpdated or module.updatedAt,
                        createdAt=module.createdAt,
                        updatedAt=module.updatedAt,
                        deletedAt=module.deletedAt,
                        gradient=self._get_module_gradient(module),
                        icon=self._get_module_icon(module),
                        category=self._get_module_category(module),
                        learningObjectives=module.skills or [],
                        prerequisites=[],
                        completionBadge=f"{module.title} Completion Badge",
                        requirements=["Computer with internet"],
                        targetAudience=["Students", "Professionals"],
                        instructor=InstructorResponse(
                            id=module.instructor.id,
                            fullName=module.instructor.fullName,
                            profilePictureUrl=module.instructor.profilePictureUrl,
                            bio=module.instructor.bio,
                            role=module.instructor.role,
                        )
                        if module.instructor
                        else None,
                        lessons=module_lessons,
                        progress=module_progress,
                        isEnrolled=module_is_enrolled,
                        rating=module_avg_ratings.get(module.id),
                        enrolled=enrolled_count,
                        isNew=self._is_module_new(module),
                        totalDuration=self._format_duration(module_duration),
                        whatYouGet=await self._get_what_you_get(module, lesson_count),
                        features=await self._get_module_features(module, lesson_count),
                    )

                    modules_data.append(module_response)
                    path_progress += module_progress

            # Calculate average progress
            if modules_data:
                path_progress = path_progress / len(modules_data)

            # Get enrollment status
            is_enrolled = bool(path.enrollments)
            if path.enrollments:
                path_progress = path.enrollments[0].progress

            # Get path enrollment count
            enrolled_count = await prisma.enrollment.count(where={"pathId": path_id})

            # Compute path price as 80% of module effective prices
            path_module_sum = sum(
                self._get_effective_price(self._parse_price(pm.module.price))
                for pm in path.modules
                if pm.module
            )
            path_discounted = int(path_module_sum * 0.8)
            path_price = {
                "original": path_module_sum,
                "discounted": path_discounted
                if path_discounted < path_module_sum
                else None,
                "currency": "DZD",
            }

            path_response = PathResponse(
                id=path.id,
                title=path.title,
                description=path.description,
                createdAt=path.createdAt,
                updatedAt=path.updatedAt,
                deletedAt=path.deletedAt,
                modules=modules_data,
                totalModules=len(modules_data),
                totalDuration=self._format_duration(total_duration),
                progress=path_progress,
                isEnrolled=is_enrolled,
                enrolled=enrolled_count,
                estimatedCompletionTime=self._estimate_completion_time(total_duration),
                price=path_price,
            )

            return path_response

        except Exception as e:
            logger.error(f"Error getting path {path_id}: {e}")
            return None

    async def _prepare_lesson_data(
        self,
        lesson,
        user_id: Optional[int] = None,
        lesson_progress_map: Optional[Dict[str, Any]] = None,
        enrollment_map: Optional[Dict[str, Any]] = None,
        ordered_lessons: Optional[list] = None,
        quiz_pass_map: Optional[Dict[str, bool]] = None,
        bypass_lock: bool = False,
        quiz_map: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Prepare lesson data for response - OPTIMIZED with pre-fetched data (NO N+1 queries)

        Sequential unlock logic:
        - Lesson 1: unlocked if enrolled
        - Lesson N (N>1): unlocked if lesson N-1 is completed AND its quiz passed (if any)
        """
        try:
            is_completed = False
            is_locked = True
            has_access = False

            if user_id:
                has_access = await self.check_access(user_id, lesson.moduleId)

                # OPTIMIZATION: Use pre-fetched progress data instead of individual queries
                progress = (
                    lesson_progress_map.get(lesson.id) if lesson_progress_map else None
                )

                if progress and progress.isCompleted:
                    is_completed = True
                    is_locked = False
                else:
                    if progress:
                        is_completed = False
                    # Sequential unlock: Lesson 1 is unlocked; subsequent lessons require all earlier lessons completed
                    first_lesson_id = ordered_lessons[0].id if ordered_lessons else None
                    if lesson.order == 1 or (
                        first_lesson_id and lesson.id == first_lesson_id
                    ):
                        is_locked = False
                    elif ordered_lessons:
                        # Transitive sequential unlock: check all earlier lessons
                        earlier_incomplete = False
                        for ol in ordered_lessons:
                            if ol.order < lesson.order:
                                ol_progress = (
                                    lesson_progress_map.get(ol.id)
                                    if lesson_progress_map
                                    else None
                                )
                                ol_completed = bool(
                                    ol_progress and ol_progress.isCompleted
                                )
                                ol_quiz_passed = True
                                ol_has_quiz = bool(
                                    ol.quizId or (quiz_map and quiz_map.get(ol.id))
                                )
                                if ol_has_quiz and quiz_pass_map is not None:
                                    ol_quiz_passed = quiz_pass_map.get(ol.id, False)

                                if not (ol_completed and ol_quiz_passed):
                                    earlier_incomplete = True
                                    break
                        is_locked = earlier_incomplete

            raw_preview = getattr(lesson, "isPreview", False)
            is_preview = bool(raw_preview) if type(raw_preview) is bool else False

            # OVERRIDE: If no entitlement/access, it's locked unless marked as Free Preview
            if not has_access and not bypass_lock:
                is_locked = not is_preview

            # BYPASS LOCK for instructors, admins, or free previews
            if bypass_lock or is_preview:
                is_locked = False

            # Count resources and exercises
            # We fetch these from the database values, not the gated response values
            attachments_list = self._parse_json_field(lesson.attachments, [])
            resources_count = len(attachments_list)

            # Verify whether a valid non-deleted Quiz record actually exists for this lesson
            resolved_quiz_id = None
            exercises_count = 0
            if quiz_map is not None:
                resolved_quiz_id = quiz_map.get(lesson.id) or (
                    quiz_map.get(lesson.quizId) if lesson.quizId else None
                )
                if resolved_quiz_id:
                    exercises_count = 1
            else:
                try:
                    quiz_obj = None
                    if lesson.quizId:
                        quiz_obj = await prisma.quiz.find_first(
                            where={"id": lesson.quizId, "deletedAt": None}
                        )
                    if not quiz_obj:
                        quiz_obj = await prisma.quiz.find_first(
                            where={"lessonId": lesson.id, "deletedAt": None}
                        )
                    if quiz_obj:
                        resolved_quiz_id = quiz_obj.id
                        exercises_count = 1
                except Exception:
                    logger.debug(f"Failed to check quiz for lesson {lesson.id}")

            # Build subtitle URL
            subtitles_url = None
            if lesson.subtitlesPath and lesson.subtitlesEnabled and not is_locked:
                subtitles_url = f"/api/subtitles/{lesson.id}"

            # Prepare complete lesson data
            lesson_data = {
                "id": lesson.id,
                "title": lesson.title or "Untitled Lesson",
                "description": lesson.description or "No description available",
                "moduleId": lesson.moduleId,
                "order": lesson.order or 1,
                "durationMinutes": lesson.durationMinutes or 30,
                "durationSeconds": getattr(lesson, "durationSeconds", None),
                "isPreview": bool(getattr(lesson, "isPreview", False)),
                "type": lesson.type or "text",
                "videoUrl": lesson.videoUrl if not is_locked else None,
                "storageProvider": getattr(lesson, "storageProvider", "supabase"),
                "hlsPath": lesson.hlsPath if not is_locked else None,
                "rawPath": lesson.rawPath if not is_locked else None,
                "transcodingStatus": getattr(lesson, "transcodingStatus", None),
                "transcript": lesson.transcript if not is_locked else None,
                "subtitlesUrl": subtitles_url,
                "subtitlesLanguage": lesson.subtitlesLanguage
                if not is_locked
                else None,
                "subtitlesEnabled": lesson.subtitlesEnabled if not is_locked else False,
                "attachments": attachments_list if not is_locked else [],
                "quizId": resolved_quiz_id,
                "requiredPassScore": lesson.requiredPassScore or 90,
                "thumbnailUrl": lesson.thumbnailUrl,
                "thumbnailBlurDataURL": lesson.thumbnailBlurDataURL,
                "learningObjectives": lesson.learningObjectives
                or [f"Understand {lesson.title}"],
                "keyTakeaways": lesson.keyTakeaways
                or [f"Key concepts from {lesson.title}"],
                "instructorNotes": lesson.instructorNotes,
                "estimatedCompletionTime": lesson.estimatedCompletionTime or 30,
                "difficulty": lesson.difficulty or "Beginner",
                "tags": lesson.tags or [],
                "relatedResources": self._parse_json_field(lesson.relatedResources, [])
                if not is_locked
                else [],
                "createdAt": lesson.createdAt,
                "updatedAt": lesson.updatedAt,
                "deletedAt": lesson.deletedAt,
                "isCompleted": is_completed,
                "isLocked": is_locked,
                "isPreview": is_preview,
                "hasAccess": bool(has_access or is_preview or bypass_lock),
                "resources": resources_count,
                "exercises": exercises_count,
            }

            return lesson_data

        except Exception as e:
            logger.error(f"Error preparing lesson data for lesson {lesson.id}: {e}")

            # Never expose media URLs in the error fallback — always report locked.
            return {
                "id": lesson.id,
                "title": lesson.title or "Untitled Lesson",
                "description": lesson.description or "No description available",
                "moduleId": lesson.moduleId,
                "order": lesson.order or 1,
                "durationMinutes": 30,
                "type": "text",
                "videoUrl": None,
                "storageProvider": lesson.storageProvider,
                "hlsPath": None,
                "transcript": None,
                "subtitlesUrl": None,
                "subtitlesLanguage": None,
                "subtitlesEnabled": False,
                "attachments": [],
                "quizId": None,
                "requiredPassScore": 70,
                "thumbnailUrl": None,
                "thumbnailBlurDataURL": None,
                "learningObjectives": [],
                "keyTakeaways": [],
                "instructorNotes": None,
                "estimatedCompletionTime": 30,
                "difficulty": "Beginner",
                "tags": [],
                "relatedResources": [],
                "createdAt": lesson.createdAt,
                "updatedAt": lesson.updatedAt,
                "deletedAt": lesson.deletedAt,
                "isCompleted": False,
                "isLocked": True,
                "resources": 0,
                "exercises": 0,
            }

    async def get_lesson(
        self, lesson_id: str, user_id: Optional[int] = None
    ) -> Optional[LessonResponse]:
        """Get a specific lesson with progress - OPTIMIZED with parallel data fetching"""
        try:
            lesson = await prisma.lesson.find_unique(
                where={"id": lesson_id}, include={"module": True}
            )

            if not lesson:
                return None

            # OPTIMIZATION: Prepare batched data structures
            lesson_progress_map = {}
            enrollment_map = {}
            ordered_lessons = None
            quiz_pass_map = {}

            if user_id:
                # To check sequential unlock, we need all lessons of the module
                async def fetch_module_lessons():
                    return await prisma.lesson.find_many(
                        where={"moduleId": lesson.moduleId}, order={"order": "asc"}
                    )

                async def fetch_progress():
                    # Fetch progress for ALL lessons in module to assist _prepare_lesson_data
                    records = await prisma.lessonprogress.find_many(
                        where={
                            "userId": user_id,
                            "lesson": {"moduleId": lesson.moduleId},
                        }
                    )
                    return {p.lessonId: p for p in records}

                async def fetch_enrollment():
                    return await prisma.enrollment.find_first(
                        where={"userId": user_id, "moduleId": lesson.moduleId}
                    )

                async def fetch_quiz_passes():
                    records = await prisma.quizattempt.find_many(
                        where={
                            "userId": user_id,
                            "quiz": {"lesson": {"moduleId": lesson.moduleId}},
                            "isPassed": True,
                        },
                        include={"quiz": True},
                    )
                    result = {}
                    for r in records:
                        if r.quiz and r.quiz.lessonId:
                            result[r.quiz.lessonId] = True
                    logger.info(
                        f"Quiz pass map for user {user_id} in module {lesson.moduleId}: {result}"
                    )
                    return result

                ol, lp_map, enrollment, qp_map = await asyncio.gather(
                    fetch_module_lessons(),
                    fetch_progress(),
                    fetch_enrollment(),
                    fetch_quiz_passes(),
                )

                ordered_lessons = ol
                lesson_progress_map = lp_map
                quiz_pass_map = qp_map
                if enrollment:
                    enrollment_map[lesson.moduleId] = enrollment

            # Determine if user should bypass lock (Instructor or Admin)
            bypass_lock = False
            if user_id:
                # Check if user is the instructor
                if lesson.module.instructorId == user_id:
                    bypass_lock = True
                else:
                    # Check if user is admin - requires fetching user
                    try:
                        user = await prisma.user.find_unique(where={"id": user_id})
                        if user and user.role == UserRole.ADMIN:
                            bypass_lock = True
                    except Exception as e:
                        logger.error(f"Error determining user role for bypass: {e}")

            lesson_data = await self._prepare_lesson_data(
                lesson,
                user_id,
                lesson_progress_map,
                enrollment_map,
                ordered_lessons=ordered_lessons,
                quiz_pass_map=quiz_pass_map,
                bypass_lock=bypass_lock,
            )
            return LessonResponse(**lesson_data)

        except Exception as e:
            logger.error(f"Error getting lesson {lesson_id}: {e}")
            return None

    async def get_module_lessons(
        self, module_id: str, user_id: Optional[int] = None
    ) -> List[LessonResponse]:
        """Get all lessons for a module with progress - OPTIMIZED with batch queries and parallel processing"""
        try:
            lessons = await prisma.lesson.find_many(
                where={"moduleId": module_id, "deletedAt": None}, order={"order": "asc"}
            )

            if not lessons:
                return []

            lesson_ids = [l.id for l in lessons]

            # Batch fetch all quizzes for the module lessons to eliminate N+1 queries
            quiz_records = []
            try:
                quiz_call = prisma.quiz.find_many(
                    where={
                        "OR": [
                            {"lessonId": {"in": lesson_ids}},
                            {"id": {"in": [l.quizId for l in lessons if l.quizId]}},
                        ],
                        "deletedAt": None,
                    }
                )
                if inspect.isawaitable(quiz_call):
                    quiz_records = await quiz_call
                elif isinstance(quiz_call, list):
                    quiz_records = quiz_call
            except Exception as e:
                logger.debug(f"Failed to batch fetch quizzes: {e}")

            quiz_map: Dict[str, str] = {}
            for q in quiz_records:
                if hasattr(q, "lessonId") and q.lessonId:
                    quiz_map[q.lessonId] = q.id
                if hasattr(q, "id") and q.id:
                    quiz_map[q.id] = q.id

            # OPTIMIZATION: Batch-fetch all progress and enrollment data at once
            lesson_progress_map = {}
            enrollment_map = {}
            quiz_pass_map = {}

            if user_id:
                # Parallelize progress, enrollment, and quiz passes
                async def fetch_progress():
                    records = await prisma.lessonprogress.find_many(
                        where={"userId": user_id, "lessonId": {"in": lesson_ids}}
                    )
                    return {p.lessonId: p for p in records}

                async def fetch_enrollment():
                    return await prisma.enrollment.find_first(
                        where={
                            "userId": user_id,
                            "moduleId": module_id,
                            "deletedAt": None,
                        }
                    )

                async def fetch_quiz_passes():
                    # Check which lessons have passed quizzes
                    records = await prisma.quizattempt.find_many(
                        where={
                            "userId": user_id,
                            "quiz": {"lessonId": {"in": lesson_ids}},
                            "isPassed": True,
                        },
                        include={"quiz": True},
                    )
                    return {
                        r.quiz.lessonId: True
                        for r in records
                        if r.quiz and r.quiz.lessonId
                    }

                lp_map, enrollment, qp_map = await asyncio.gather(
                    fetch_progress(), fetch_enrollment(), fetch_quiz_passes()
                )

                lesson_progress_map = lp_map
                quiz_pass_map = qp_map
                if enrollment:
                    enrollment_map[module_id] = enrollment

            # OPTIMIZATION: Parallelize lesson data preparation with asyncio.gather()
            lesson_tasks = [
                self._prepare_lesson_data(
                    lesson,
                    user_id,
                    lesson_progress_map,
                    enrollment_map,
                    ordered_lessons=lessons,
                    quiz_pass_map=quiz_pass_map,
                    quiz_map=quiz_map,
                )
                for lesson in lessons
            ]
            lesson_data_list = await asyncio.gather(*lesson_tasks)

            result = [LessonResponse(**data) for data in lesson_data_list]
            return result

        except Exception as e:
            logger.error(f"Error getting module lessons for {module_id}: {e}")
            return []

    async def enroll_user(
        self,
        module_id: Optional[str] = None,
        path_id: Optional[str] = None,
        user_id: int = None,
        transaction_id: Optional[int] = None,
    ) -> bool:
        """Enroll a user in a module or path with access verification and usage recording.

        Uses upsert instead of find-then-create to be safe under concurrent webhook deliveries.
        """
        try:
            if not module_id and not path_id:
                raise ValueError("Either module_id or path_id must be provided")

            # 2. Access Verification (skip when called from a guaranteed purchase flow)
            if not transaction_id:
                if module_id:
                    # Check if module is free first
                    module = await prisma.module.find_unique(where={"id": module_id})
                    if not module:
                        return False

                    price_data = self._parse_price(module.price)
                    original_price = price_data.get("original", 0) or 0
                    discounted_price = price_data.get("discounted")

                    # effective price is discounted if available, else original
                    effective_price = (
                        discounted_price
                        if discounted_price is not None
                        else original_price
                    )

                    if effective_price > 0:
                        # Paid module, check entitlements/subscriptions
                        has_access = await self.check_access(user_id, module_id)
                        if not has_access:
                            logger.warning(
                                f"User {user_id} attempted enrollment in module {module_id} without access"
                            )
                            return False

                        # 3. Usage Recording for Subscriptions
                        # We record ONLY if they don't have a direct purchase
                        has_direct = await entitlement_service.has_entitlement(
                            user_id, "course", module_id
                        )
                        if not has_direct:
                            # Must be via path or subscription. If not via path, it's subscription
                            # Check if part of an owned path
                            path_links = await prisma.pathmodule.find_many(
                                where={"moduleId": module_id}
                            )
                            is_via_path = False
                            for link in path_links:
                                if await entitlement_service.has_entitlement(
                                    user_id, "path", link.pathId
                                ):
                                    is_via_path = True
                                    break

                            if not is_via_path:
                                # It's a subscription enrollment, record it
                                recorded = (
                                    await usage_tracking_service.record_course_access(
                                        user_id
                                    )
                                )
                                if not recorded:
                                    logger.warning(
                                        f"User {user_id} hit subscription course limit"
                                    )
                                    return False

                elif path_id:
                    path = await prisma.path.find_unique(where={"id": path_id})
                    if not path:
                        return False

                    price_data = self._parse_price(path.price)
                    original_price = price_data.get("original", 0) or 0
                    discounted_price = price_data.get("discounted")

                    effective_price = (
                        discounted_price
                        if discounted_price is not None
                        else original_price
                    )

                    if effective_price > 0:
                        has_direct_path = await entitlement_service.has_entitlement(
                            user_id, "path", path_id
                        )
                        if not has_direct_path:
                            # No direct purchase — check subscription path access
                            has_sub = await usage_tracking_service.check_course_limit(
                                user_id
                            )
                            if not has_sub["allowed"]:
                                return False
                            # Enrolling via subscription; course-level usage
                            # will be recorded when individual courses are enrolled

            # Atomic upsert — converges safely if two workers race on the same enrollment.
            enrollment_data = {
                "userId": user_id,
                "progress": 0.0,
                "startedAt": datetime.now(timezone.utc),
                "transactionId": transaction_id,
            }

            if module_id:
                # Upsert on (userId, moduleId); preserves existing progress on conflict.
                try:
                    await prisma.enrollment.upsert(
                        where={
                            "userId_moduleId": {
                                "userId": user_id,
                                "moduleId": module_id,
                            }
                        },
                        data={
                            "create": {**enrollment_data, "moduleId": module_id},
                            # On conflict: preserve existing progress, only update
                            # the transaction link if it wasn't set before.
                            "update": {
                                "transactionId": transaction_id,
                            },
                        },
                    )
                except Exception as upsert_err:
                    # Swallow duplicate-key errors — enrollment already exists.
                    err_str = str(upsert_err).lower()
                    if "unique" in err_str or "duplicate" in err_str:
                        logger.info(
                            f"Enrollment already exists (race resolved) for "
                            f"user={user_id} module={module_id}"
                        )
                    else:
                        raise

            if path_id:
                try:
                    await prisma.enrollment.upsert(
                        where={"userId_pathId": {"userId": user_id, "pathId": path_id}},
                        data={
                            "create": {**enrollment_data, "pathId": path_id},
                            "update": {"transactionId": transaction_id},
                        },
                    )
                except Exception as upsert_err:
                    err_str = str(upsert_err).lower()
                    if "unique" in err_str or "duplicate" in err_str:
                        logger.info(
                            f"Path enrollment already exists (race resolved) for "
                            f"user={user_id} path={path_id}"
                        )
                    else:
                        raise

                # Also auto-enroll in all modules belonging to this path
                path_modules = await prisma.pathmodule.find_many(
                    where={"pathId": path_id}, include={"module": True}
                )
                for pm in path_modules:
                    if pm.module:
                        try:
                            await prisma.enrollment.upsert(
                                where={
                                    "userId_moduleId": {
                                        "userId": user_id,
                                        "moduleId": pm.module.id,
                                    }
                                },
                                data={
                                    "create": {
                                        "userId": user_id,
                                        "moduleId": pm.module.id,
                                        "pathId": path_id,
                                        "progress": 0.0,
                                        "startedAt": datetime.now(timezone.utc),
                                        "transactionId": transaction_id,
                                    },
                                    "update": {"transactionId": transaction_id},
                                },
                            )
                        except Exception as upsert_err:
                            err_str = str(upsert_err).lower()
                            if "unique" in err_str or "duplicate" in err_str:
                                logger.info(
                                    f"Module enrollment in path already exists (race resolved) for "
                                    f"user={user_id} module={pm.module.id}"
                                )
                            else:
                                raise

            # Send enrollment confirmation email
            try:
                from app.services.email_service import email_service

                user = await prisma.user.find_unique(where={"id": user_id})
                course_name = ""
                course_url = ""
                if module_id:
                    mod = await prisma.module.find_unique(where={"id": module_id})
                    if mod:
                        course_name = mod.title
                        course_url = f"{setting.FRONTEND_URL}/learn/courses/{module_id}"
                elif path_id:
                    p = await prisma.path.find_unique(where={"id": path_id})
                    if p:
                        course_name = p.title
                        course_url = f"{setting.FRONTEND_URL}/learn/paths/{path_id}"

                if user and user.email and course_name:
                    await email_service.send_enrollment_email(
                        email=user.email,
                        name=user.fullName or "User",
                        course_name=course_name,
                        course_url=course_url,
                        user_id=user_id,
                    )

                # Send in-app notification
                try:
                    from app.services.notification_service import NotificationService
                    from app.schemas.notifications import (
                        NotificationCreate,
                        NotificationCategory,
                        NotificationPriority,
                        NotificationPayload,
                    )

                    target_entity_type = "module" if module_id else "path"
                    target_entity_id = module_id or path_id
                    target_action_url = (
                        f"/learn/courses/{module_id}"
                        if module_id
                        else f"/learn/paths/{path_id}"
                    )

                    await NotificationService.create_notification(
                        NotificationCreate(
                            user_id=user_id,
                            type="COURSE_ENROLLMENT",
                            title=f"Enrolled in {course_name}",
                            body=f"You have successfully enrolled in '{course_name}'. Start learning now!",
                            category=NotificationCategory.EDUCATION,
                            priority=NotificationPriority.NORMAL,
                            payload=NotificationPayload(
                                entity_type=target_entity_type,
                                entity_id=str(target_entity_id),
                                action_url=target_action_url,
                                metadata={"course_name": course_name},
                            ),
                            data={
                                "course_name": course_name,
                                "module_id": module_id,
                                "path_id": path_id,
                                "action_url": target_action_url,
                                "url": target_action_url,
                            },
                        )
                    )
                except Exception as notif_err:
                    logger.warning(
                        f"Failed to dispatch enrollment in-app notification: {notif_err}"
                    )

            except Exception as ex:
                logger.warning(f"Failed to send enrollment email: {ex}")

            return True

        except Exception as e:
            logger.error(f"Error in enroll_user: {e}", exc_info=True)
            return False

    async def update_lesson_progress(
        self, lesson_id: str, user_id: int, progress_data: ProgressUpdate
    ) -> "ProgressUpdateResult":
        """Update lesson progress and module progress.

        Returns a ProgressUpdateResult enum value so the router can map
        each failure reason to the correct HTTP status code.
        """
        try:
            # Get lesson to find module
            lesson = await prisma.lesson.find_unique(
                where={"id": lesson_id}, include={"module": True, "quiz": True}
            )

            if not lesson:
                return ProgressUpdateResult.NOT_FOUND

            # SECURITY: enforce module access before recording progress so that
            # unenrolled or expired users cannot forge completion (or certificates).
            bypass = lesson.module is not None and lesson.module.instructorId == user_id
            if not bypass:
                try:
                    user = await prisma.user.find_unique(where={"id": user_id})
                    if user and user.role == UserRole.ADMIN:
                        bypass = True
                except Exception:
                    pass
                if not bypass and not await self.check_access(user_id, lesson.moduleId):
                    logger.warning(
                        f"User {user_id} attempted to update progress on lesson {lesson_id} without access"
                    )
                    return ProgressUpdateResult.ACCESS_DENIED

            # Check sequential locking before allowing progress or completion
            if not bypass:
                is_locked = await self._is_lesson_sequentially_locked(lesson, user_id)
                if is_locked:
                    logger.warning(
                        f"User {user_id} attempted to progress locked lesson {lesson_id} (order {lesson.order})"
                    )
                    return ProgressUpdateResult.LOCKED

            # Update or create lesson progress
            existing_progress = await prisma.lessonprogress.find_first(
                where={"userId": user_id, "lessonId": lesson_id}
            )

            # Never trust client-declared completion — verify server-side criteria.
            lesson_type = (lesson.type or "").lower()
            is_media = lesson_type in {"video", "audio", "interactive"}

            # [CRITICAL-EDT-01] For video/media lessons, client cannot assert arbitrary progress or completion.
            # Verified progress and completion must come strictly from interval_tracker.
            if is_media:
                raw_duration = getattr(lesson, "durationSeconds", 0)
                duration = (
                    float(raw_duration)
                    if isinstance(raw_duration, (int, float))
                    else 0.0
                )
                if duration > 0:
                    from app.services.video.interval_tracker import interval_tracker

                    intervals = await interval_tracker.get_user_intervals(
                        user_id, lesson.id
                    )
                    unique_seconds = interval_tracker.calculate_unique_watched_seconds(
                        intervals
                    )
                    verified_progress = round(
                        min(100.0, (unique_seconds / duration) * 100.0), 2
                    )
                else:
                    verified_progress = float(progress_data.progress or 0)

                effective_progress = max(
                    float(existing_progress.progress or 0)
                    if existing_progress
                    else 0.0,
                    verified_progress,
                )
                is_completed = (effective_progress >= 90.0) or bool(
                    existing_progress and existing_progress.isCompleted
                )

                # Client-asserted completion or client declaring progress >= 90 without verified intervals is rejected
                if (
                    progress_data.completed
                    or float(progress_data.progress or 0) >= 90.0
                ) and not is_completed:
                    logger.warning(
                        f"User {user_id} video completion FORGERY attempt on lesson {lesson_id} "
                        f"(verified={verified_progress}%, declared={progress_data.progress}) rejected"
                    )
                    return ProgressUpdateResult.CRITERIA_NOT_MET
            else:
                completed = bool(progress_data.completed)
                if completed and not await self._lesson_completion_satisfied(
                    lesson, user_id, progress_data.progress, existing_progress
                ):
                    logger.warning(
                        f"User {user_id} completion FORGERY attempt on lesson {lesson_id} "
                        f"(declared progress={progress_data.progress}) rejected by server-side criteria"
                    )
                    return ProgressUpdateResult.CRITERIA_NOT_MET

                # Progress is strictly monotonic — a client may never rewind the
                # recorded progress, and completion can only be reached by meeting
                # the lesson criteria above.
                recorded_progress = (
                    float(existing_progress.progress or 0) if existing_progress else 0.0
                )
                effective_progress = max(
                    recorded_progress, float(progress_data.progress or 0)
                )
                is_completed = completed or bool(
                    existing_progress and existing_progress.isCompleted
                )

            update_data = {
                "progress": effective_progress,
                "isCompleted": is_completed,
                "updatedAt": datetime.now(timezone.utc),
            }

            if is_completed and not (
                existing_progress and existing_progress.completedAt
            ):
                update_data["completedAt"] = datetime.now(timezone.utc)

            if existing_progress:
                await prisma.lessonprogress.update(
                    where={"id": existing_progress.id}, data=update_data
                )
            else:
                await prisma.lessonprogress.create(
                    data={"userId": user_id, "lessonId": lesson_id, **update_data}
                )

            # Update module progress if completed
            if is_completed:
                await self._update_module_progress(lesson.moduleId, user_id)

            return ProgressUpdateResult.OK

        except Exception as e:
            logger.error(f"Error updating lesson progress: {e}")
            return ProgressUpdateResult.ERROR

    async def _is_lesson_sequentially_locked(self, lesson, user_id: int) -> bool:
        """Verify whether a lesson is locked because earlier lessons or their quizzes are incomplete."""
        if not lesson or not getattr(lesson, "moduleId", None):
            return False

        order_val = getattr(lesson, "order", 1)
        if not isinstance(order_val, (int, float)):
            order_val = 1

        if order_val <= 1:
            return False

        try:
            earlier_lessons = await prisma.lesson.find_many(
                where={
                    "moduleId": lesson.moduleId,
                    "order": {"lt": order_val},
                    "deletedAt": None,
                },
                order={"order": "asc"},
            )

            if not earlier_lessons:
                return False

            earlier_ids = [el.id for el in earlier_lessons]
            progress_rows = await prisma.lessonprogress.find_many(
                where={
                    "userId": user_id,
                    "lessonId": {"in": earlier_ids},
                    "isCompleted": True,
                }
            )
            completed_ids = {p.lessonId for p in progress_rows}

            for el in earlier_lessons:
                if el.id not in completed_ids:
                    return True
                if el.quizId:
                    passed_attempt = await prisma.quizattempt.find_first(
                        where={"userId": user_id, "quizId": el.quizId, "isPassed": True}
                    )
                    if not passed_attempt:
                        return True

            return False
        except Exception as e:
            logger.error(f"Error checking sequential lock for lesson {lesson.id}: {e}")
            return False

    async def _lesson_completion_satisfied(
        self,
        lesson,
        user_id: int,
        declared_progress: float,
        existing_progress,
    ) -> bool:
        """Server-side verification of a lesson's completion criteria.

        Returns True only when the criteria for the lesson type are genuinely
        satisfied — client-supplied `completed=true` is never trusted on its own:
          - Quiz lessons (lesson.quizId): a PASSED quiz attempt must exist.
          - Media lessons (video/audio/interactive): >= 90% watch progress must
            have been reported through periodic progress updates (server tracks
            the monotonic max; the incoming value counts only if it carries a
            real watch progress).
          - Text / case-study / project lessons: manual completion allowed.
        """
        lesson_type = (lesson.type or "").lower()

        if lesson_type in {"video", "audio", "interactive"}:
            duration = float(getattr(lesson, "durationSeconds", 0) or 0)
            if duration > 0:
                from app.services.video.interval_tracker import interval_tracker

                intervals = await interval_tracker.get_user_intervals(
                    user_id, lesson.id
                )
                unique_seconds = interval_tracker.calculate_unique_watched_seconds(
                    intervals
                )
                if unique_seconds < (0.90 * duration):
                    return False
            else:
                recorded = (
                    float(existing_progress.progress or 0) if existing_progress else 0.0
                )
                if recorded < 90.0:
                    return False

        if getattr(lesson, "quizId", None):
            passed = await prisma.quizattempt.find_first(
                where={"userId": user_id, "quizId": lesson.quizId, "isPassed": True}
            )
            return passed is not None

        return True

    async def _update_module_progress(self, module_id: str, user_id: int):
        """Recalculate module progress based on completed lessons"""
        try:
            total_lessons = await prisma.lesson.count(
                where={"moduleId": module_id, "deletedAt": None}
            )

            completed_lessons = await prisma.lessonprogress.count(
                where={
                    "userId": user_id,
                    "lesson": {"moduleId": module_id, "deletedAt": None},
                    "isCompleted": True,
                }
            )

            if total_lessons == 0:
                progress = 0.0
            elif completed_lessons >= total_lessons:
                progress = 100.0
            else:
                progress = round((completed_lessons / total_lessons) * 100.0, 2)

            # Update enrollment progress and set completedAt if 100%
            update_data: Dict[str, Any] = {"progress": progress}
            if progress >= 100.0:
                update_data["completedAt"] = datetime.now(timezone.utc)

            # Update enrollment progress
            await prisma.enrollment.update_many(
                where={"userId": user_id, "moduleId": module_id}, data=update_data
            )

            # 3. Handle automatic certificate issuance on course completion (100% progress)
            if progress >= 100:
                cert_granted = False
                try:
                    from app.services.billing_services.education_service import (
                        education_billing_service,
                    )

                    cert_granted = (
                        await education_billing_service.grant_subscription_certificate(
                            user_id, module_id
                        )
                    )
                except Exception as e:
                    logger.error(
                        f"Error triggering subscription certificate for user {user_id} on module {module_id}: {e}"
                    )

                # Only auto-generate via certificate_service if:
                # a) the subscription path didn't grant the cert (user may have
                #    a one-time purchase entitlement, not a subscription), AND
                # b) the user has access to this course (direct purchase, path, or free course)
                if not cert_granted:
                    has_direct = await entitlement_service.has_entitlement(
                        user_id=user_id,
                        entitlement_type="course",
                        resource_id=module_id,
                    )
                    has_access = has_direct or await self.check_access(
                        user_id, module_id
                    )
                    if has_access:
                        try:
                            from app.services.certificate_service import (
                                certificate_service,
                            )

                            cert = (
                                await certificate_service.generate_module_certificate(
                                    user_id, module_id
                                )
                            )
                        except Exception as e:
                            logger.error(
                                f"Error auto-generating certificate for user {user_id} on module {module_id}: {e}"
                            )
                            cert = None
                        else:
                            try:
                                from app.services.email_service import email_service

                                user = await prisma.user.find_unique(
                                    where={"id": user_id}
                                )
                                module = await prisma.module.find_unique(
                                    where={"id": module_id}
                                )
                                if user and user.email and module:
                                    cert_id = (
                                        cert.get("id", "")
                                        if isinstance(cert, dict)
                                        else getattr(cert, "certificateId", "")
                                    )
                                    cert_url = (
                                        f"{setting.FRONTEND_URL}/learn/certificates/{cert_id}"
                                        if cert_id
                                        else ""
                                    )
                                    await email_service.send_completion_email(
                                        email=user.email,
                                        name=user.fullName or "User",
                                        course_name=module.title,
                                        score="100%",
                                        cert_url=cert_url
                                        or f"{setting.FRONTEND_URL}/learn/courses/{module_id}",
                                        user_id=user_id,
                                    )
                            except Exception as ex:
                                logger.warning(f"Failed to send completion email: {ex}")

            # 4. Cascade progress to parent learning paths containing this module
            try:
                parent_path_links = await prisma.pathmodule.find_many(
                    where={"moduleId": module_id, "deletedAt": None},
                    include={
                        "path": {"include": {"modules": {"where": {"deletedAt": None}}}}
                    },
                )
                for pl in parent_path_links:
                    if not pl.path:
                        continue
                    path_id = pl.pathId
                    path_enrollment = await prisma.enrollment.find_first(
                        where={"userId": user_id, "pathId": path_id, "deletedAt": None}
                    )
                    if not path_enrollment:
                        continue

                    all_module_ids = [
                        pm.moduleId for pm in pl.path.modules if pm.moduleId
                    ]
                    if all_module_ids:
                        all_module_enrollments = await prisma.enrollment.find_many(
                            where={
                                "userId": user_id,
                                "moduleId": {"in": all_module_ids},
                                "deletedAt": None,
                            }
                        )
                        mod_progress_map = {
                            me.moduleId: me.progress for me in all_module_enrollments
                        }
                        total_p = sum(
                            mod_progress_map.get(mid, 0.0) for mid in all_module_ids
                        )
                        avg_path_progress = round(total_p / len(all_module_ids), 2)

                        path_update: Dict[str, Any] = {"progress": avg_path_progress}
                        if (
                            avg_path_progress >= 100.0
                            and not path_enrollment.completedAt
                        ):
                            path_update["completedAt"] = datetime.now(timezone.utc)

                        await prisma.enrollment.update(
                            where={"id": path_enrollment.id},
                            data=path_update,
                        )

                        if avg_path_progress >= 100.0:
                            try:
                                from app.services.certificate_service import (
                                    certificate_service,
                                )

                                await certificate_service.generate_path_certificate(
                                    user_id, path_id
                                )
                            except Exception as path_cert_err:
                                logger.error(
                                    f"Error auto-generating path certificate for user {user_id} on path {path_id}: {path_cert_err}"
                                )
            except Exception as cascade_err:
                logger.warning(
                    f"Error cascading module progress to parent paths: {cascade_err}"
                )

        except Exception as e:
            logger.error(f"Error updating module progress: {e}")

    async def complete_lesson(
        self, lesson_id: str, user_id: int
    ) -> "ProgressUpdateResult":
        """Mark a lesson as completed if criteria are genuinely satisfied."""
        try:
            lesson = await prisma.lesson.find_unique(
                where={"id": lesson_id}, include={"module": True, "quiz": True}
            )
            if not lesson:
                return ProgressUpdateResult.NOT_FOUND

            existing_progress = await prisma.lessonprogress.find_first(
                where={"userId": user_id, "lessonId": lesson_id}
            )

            # [CRITICAL-EDT-01] Server-side criteria must be genuinely met
            if not await self._lesson_completion_satisfied(
                lesson, user_id, 100.0, existing_progress
            ):
                logger.warning(
                    f"User {user_id} attempted complete_lesson on {lesson_id} but criteria not met"
                )
                return ProgressUpdateResult.CRITERIA_NOT_MET

            progress_data = ProgressUpdate(progress=100.0, completed=True)
            return await self.update_lesson_progress(lesson_id, user_id, progress_data)

        except Exception as e:
            logger.error(f"Error completing lesson: {e}")
            return ProgressUpdateResult.ERROR

    async def get_user_enrollments(self, user_id: int) -> List[EnrollmentResponse]:
        """Get user's module and path enrollments with progress - OPTIMIZED"""
        try:
            # Get enrollments with CORRECT Prisma syntax
            enrollments = await prisma.enrollment.find_many(
                where={"userId": user_id},
                include={
                    "module": True,  # Simple include for all module fields
                    "path": True,  # Simple include for all path fields
                },
                order={"updatedAt": "desc"},
            )

            if not enrollments:
                return []

            # Collect module IDs for batch queries
            module_ids = [e.moduleId for e in enrollments if e.moduleId]
            path_ids = [e.pathId for e in enrollments if e.pathId]

            # Batch queries for statistics
            async def get_module_stats():
                if not module_ids:
                    return {}, {}

                # Get lesson counts
                lesson_counts_results = await prisma.lesson.group_by(
                    by=["moduleId"],
                    where={"moduleId": {"in": module_ids}},
                    count={"_all": True},
                )
                lesson_counts = {
                    r["moduleId"]: r["_count"]["_all"] for r in lesson_counts_results
                }

                # Get enrollment counts
                enrollment_counts_results = await prisma.enrollment.group_by(
                    by=["moduleId"],
                    where={"moduleId": {"in": module_ids}},
                    count={"_all": True},
                )
                enrollment_counts = {
                    r["moduleId"]: r["_count"]["_all"]
                    for r in enrollment_counts_results
                }

                return lesson_counts, enrollment_counts

            async def get_path_stats():
                if not path_ids:
                    return {}

                # Get path module counts
                path_module_counts_results = await prisma.pathmodule.group_by(
                    by=["pathId"],
                    where={"pathId": {"in": path_ids}},
                    count={"_all": True},
                )
                return {
                    r["pathId"]: r["_count"]["_all"] for r in path_module_counts_results
                }

            # Run batch queries in parallel
            (
                (lesson_counts, enrollment_counts),
                path_module_counts,
                module_avg_ratings,
            ) = await asyncio.gather(
                get_module_stats(),
                get_path_stats(),
                self._get_module_avg_ratings(module_ids),
            )

            # Build response
            result = []
            for enrollment in enrollments:
                enrollment_data = EnrollmentResponse(
                    id=enrollment.id,
                    userId=enrollment.userId,
                    moduleId=enrollment.moduleId,
                    pathId=enrollment.pathId,
                    progress=enrollment.progress,
                    createdAt=enrollment.createdAt,
                    updatedAt=enrollment.updatedAt,
                    completedAt=enrollment.completedAt,
                    deletedAt=enrollment.deletedAt,
                    startedAt=enrollment.startedAt,
                    certificateId=enrollment.certificateId,
                    module=None,
                    path=None,
                )

                # Add module data if exists
                if enrollment.module:
                    lesson_count = lesson_counts.get(enrollment.moduleId, 0)
                    enrolled_count = enrollment_counts.get(enrollment.moduleId, 0)

                    enrollment_data.module = ModuleListResponse(
                        id=enrollment.module.id,
                        title=enrollment.module.title,
                        description=enrollment.module.description,
                        level=enrollment.module.level or "Beginner",
                        duration_minutes=enrollment.module.durationMinutes,
                        total_lessons=lesson_count,
                        skills=enrollment.module.skills or [],
                        tags=enrollment.module.tags or [],
                        price=self._parse_price(enrollment.module.price),
                        featured=enrollment.module.featured or False,
                        gradient=self._get_module_gradient(enrollment.module),
                        icon=self._get_module_icon(enrollment.module),
                        category=self._get_module_category(enrollment.module),
                        progress=enrollment.progress,
                        is_enrolled=True,
                        rating=module_avg_ratings.get(enrollment.module.id),
                        enrolled=enrolled_count,
                        is_new=self._is_module_new(enrollment.module),
                        instructor=None,
                        paths=[],
                    )

                # Add path data if exists
                if enrollment.path:
                    total_modules = path_module_counts.get(enrollment.pathId, 0)

                    enrollment_data.path = PathListResponse(
                        id=enrollment.path.id,
                        title=enrollment.path.title,
                        description=enrollment.path.description,
                        total_modules=total_modules,
                        total_duration="Unknown",
                        progress=enrollment.progress,
                        is_enrolled=True,
                        enrolled=0,
                        estimated_completion_time="Unknown",
                        featured_modules=[],
                        created_at=enrollment.path.createdAt.isoformat()
                        if enrollment.path.createdAt
                        else None,
                        updated_at=None,
                    )

                result.append(enrollment_data)

            return result

        except Exception as e:
            logger.error(f"Error getting user enrollments: {e}", exc_info=True)
            return []

    async def get_user_learning_stats(self, user_id: int) -> UserLearningStats:
        """Get comprehensive learning statistics for a user - OPTIMIZED with ORM queries"""
        try:
            import asyncio

            async def get_enrollment_stats():
                enrollments = await prisma.enrollment.find_many(
                    where={"userId": user_id, "deletedAt": None}
                )
                modules_enrolled = len([e for e in enrollments if e.moduleId])
                paths_enrolled = len([e for e in enrollments if e.pathId])
                avg_progress = (
                    sum(e.progress or 0 for e in enrollments) / len(enrollments)
                    if enrollments
                    else 0
                )
                return modules_enrolled, paths_enrolled, avg_progress

            async def get_lesson_stats():
                completed_lessons = await prisma.lessonprogress.find_many(
                    where={"userId": user_id, "isCompleted": True},
                    include={"lesson": True},
                )
                lessons_completed = len(completed_lessons)
                total_time = sum(
                    (lp.lesson.durationMinutes or 0)
                    for lp in completed_lessons
                    if lp.lesson
                )
                return lessons_completed, total_time

            async def get_quiz_avg():
                attempts = await prisma.quizattempt.find_many(where={"userId": user_id})
                if attempts:
                    return sum(a.score or 0 for a in attempts) / len(attempts)
                return 0.0

            async def get_cert_count():
                return await prisma.certificate.count(where={"userId": user_id})

            async def get_favorite_tag():
                enrollments = await prisma.enrollment.find_many(
                    where={"userId": user_id, "moduleId": {"not": None}},
                    include={"module": True},
                )
                tag_counts = {}
                for e in enrollments:
                    if e.module and e.module.tags:
                        for tag in e.module.tags[:1]:  # First tag only
                            tag_counts[tag] = tag_counts.get(tag, 0) + 1
                if tag_counts:
                    return max(tag_counts, key=tag_counts.get)
                return "Foundation"

            (
                (modules_enrolled, paths_enrolled, avg_progress),
                (lessons_completed, total_time),
                avg_quiz,
                cert_count,
                fav_tag,
            ) = await asyncio.gather(
                get_enrollment_stats(),
                get_lesson_stats(),
                get_quiz_avg(),
                get_cert_count(),
                get_favorite_tag(),
            )

            # Calculate streak from completed lessons
            completed_progresses = await prisma.lessonprogress.find_many(
                where={
                    "userId": user_id,
                    "isCompleted": True,
                    "completedAt": {"not": None},
                },
                order={"completedAt": "desc"},
            )
            from datetime import timedelta

            streak = 0
            if completed_progresses:
                today = datetime.now(timezone.utc).date()
                dates = set()
                for lp in completed_progresses:
                    if lp.completedAt:
                        dates.add(lp.completedAt.date())
                current = today
                while current in dates:
                    streak += 1
                    current -= timedelta(days=1)

            return UserLearningStats(
                total_modules_enrolled=modules_enrolled,
                total_lessons_completed=lessons_completed,
                total_learning_time=total_time,
                current_streak=streak,
                certificates_earned=cert_count,
                favorite_category=fav_tag,
                average_progress=avg_progress,
                average_quiz_score=avg_quiz,
            )

        except Exception as e:
            logger.error(f"Error getting user learning stats: {e}", exc_info=True)
            return UserLearningStats()

    async def search_modules_and_paths(
        self, search_query: SearchQuery, user_id: Optional[int] = None
    ) -> SearchResults:
        """Search modules and paths with filters - optimized"""
        try:
            # Build module search query
            module_where = {}

            if search_query.query:
                module_where["OR"] = [
                    {"title": {"contains": search_query.query, "mode": "insensitive"}},
                    {
                        "description": {
                            "contains": search_query.query,
                            "mode": "insensitive",
                        }
                    },
                    {"tags": {"has": search_query.query}},
                    {"skills": {"has": search_query.query}},
                ]

            if search_query.filters:
                if search_query.filters.level:
                    module_where["level"] = {"in": search_query.filters.level}
                if search_query.filters.featured is not None:
                    module_where["featured"] = search_query.filters.featured
                if search_query.filters.instructor_id:
                    module_where["instructorId"] = search_query.filters.instructor_id

            # Get modules with pagination
            modules = await prisma.module.find_many(
                where=module_where,
                include={
                    "instructor": True,
                    "lessons": True,
                    "enrollments": {
                        "where": {"userId": user_id} if user_id else {},
                        "take": 1,
                    },
                },
                skip=(search_query.page - 1) * search_query.page_size,
                take=search_query.page_size,
                order=self._get_sort_order(search_query.sort_by),
            )

            total_modules = await prisma.module.count(where=module_where)

            # Get enrollment counts in batch for modules
            module_ids = [module.id for module in modules]
            module_enrollment_counts = {}
            if module_ids:
                try:
                    enrollment_results = await prisma.enrollment.group_by(
                        by=["moduleId"],
                        where={"moduleId": {"in": module_ids}},
                        count={"_all": True},
                    )
                    module_enrollment_counts = {
                        result["moduleId"]: result["_count"]["_all"]
                        for result in enrollment_results
                    }
                except Exception as e:
                    logger.error(
                        f"Error getting batch enrollment counts in search: {e}"
                    )

            # Build path search query
            path_where = {}
            if search_query.query:
                path_where["OR"] = [
                    {"title": {"contains": search_query.query, "mode": "insensitive"}},
                    {
                        "description": {
                            "contains": search_query.query,
                            "mode": "insensitive",
                        }
                    },
                ]

            paths = await prisma.path.find_many(
                where=path_where,
                include={
                    "modules": {
                        "include": {"module": True},
                        "order_by": {"order": "asc"},
                    }
                },
                skip=(search_query.page - 1) * search_query.page_size,
                take=search_query.page_size,
                order={"createdAt": "desc"},
            )

            total_paths = await prisma.path.count(where=path_where)

            # Get path enrollment counts in batch
            path_ids = [path.id for path in paths]
            path_enrollment_counts = {}
            if path_ids:
                try:
                    path_enrollment_results = await prisma.enrollment.group_by(
                        by=["pathId"],
                        where={"pathId": {"in": path_ids}},
                        count={"_all": True},
                    )
                    path_enrollment_counts = {
                        result["pathId"]: result["_count"]["_all"]
                        for result in path_enrollment_results
                    }
                except Exception as e:
                    logger.error(f"Error getting batch path enrollment counts: {e}")

            # Convert modules to response
            module_responses = []

            # Batch query for lesson counts in search results
            module_ids_for_lessons = [m.id for m in modules]
            module_lesson_counts = {}
            module_avg_ratings = {}
            if module_ids_for_lessons:
                try:
                    lesson_counts_result, module_avg_ratings = await asyncio.gather(
                        prisma.lesson.group_by(
                            by=["moduleId"],
                            where={"moduleId": {"in": module_ids_for_lessons}},
                            count={"_all": True},
                        ),
                        self._get_module_avg_ratings(module_ids_for_lessons),
                    )
                    module_lesson_counts = {
                        r["moduleId"]: r["_count"]["_all"] for r in lesson_counts_result
                    }
                except Exception as e:
                    logger.error(f"Error getting lesson counts in search: {e}")

            for module in modules:
                progress = 0.0
                is_enrolled = False
                if user_id and module.enrollments:
                    is_enrolled = True
                    progress = module.enrollments[0].progress

                enrolled_count = module_enrollment_counts.get(module.id, 0)
                lesson_count = module_lesson_counts.get(
                    module.id, len(module.lessons) if module.lessons else 0
                )

                module_response = ModuleResponse(
                    id=module.id,
                    title=module.title,
                    description=module.description,
                    fullDescription=module.fullDescription,
                    durationMinutes=module.durationMinutes,
                    estimatedEffort=module.estimatedEffort,
                    totalLessons=lesson_count,
                    level=module.level or "Beginner",
                    instructorId=module.instructorId,
                    skills=module.skills or [],
                    tags=module.tags or [],
                    price=self._parse_price(module.price),
                    featured=module.featured or False,
                    lastUpdated=module.lastUpdated or module.updatedAt,
                    createdAt=module.createdAt,
                    updatedAt=module.updatedAt,
                    deletedAt=module.deletedAt,
                    gradient=self._get_module_gradient(module),
                    icon=self._get_module_icon(module),
                    category=self._get_module_category(module),
                    learningObjectives=module.skills or [],
                    prerequisites=[],
                    completionBadge=f"{module.title} Completion Badge",
                    whatYouGet=await self._get_what_you_get(module, lesson_count),
                    requirements=["Computer with internet"],
                    targetAudience=["Students", "Professionals"],
                    instructor=InstructorResponse(
                        id=module.instructor.id,
                        fullName=module.instructor.fullName,
                        profilePictureUrl=module.instructor.profilePictureUrl,
                        bio=module.instructor.bio,
                        role=module.instructor.role,
                    )
                    if module.instructor
                    else None,
                    lessons=[],
                    progress=progress,
                    isEnrolled=is_enrolled,
                    rating=module_avg_ratings.get(module.id),
                    enrolled=enrolled_count,
                    isNew=self._is_module_new(module),
                    totalDuration=self._format_duration(module.durationMinutes or 0),
                    features=await self._get_module_features(module, lesson_count),
                )
                module_responses.append(module_response)

            # Convert paths to response
            path_responses = []
            for path in paths:
                total_modules = len(path.modules)
                total_duration = sum(
                    pm.module.durationMinutes or 0 for pm in path.modules if pm.module
                )

                enrolled_count = path_enrollment_counts.get(path.id, 0)

                path_response = PathResponse(
                    id=path.id,
                    title=path.title,
                    description=path.description,
                    createdAt=path.createdAt,
                    updatedAt=path.updatedAt,
                    deletedAt=path.deletedAt,
                    modules=[],
                    totalModules=total_modules,
                    totalDuration=self._format_duration(total_duration),
                    progress=0.0,
                    isEnrolled=False,
                    enrolled=enrolled_count,
                    estimatedCompletionTime=self._estimate_completion_time(
                        total_duration
                    ),
                )
                path_responses.append(path_response)

            return SearchResults(
                modules=module_responses,
                paths=path_responses,
                total_modules=total_modules,
                total_paths=total_paths,
                page=search_query.page,
                page_size=search_query.page_size,
                total_pages=math.ceil(total_modules / search_query.page_size),
            )

        except Exception as e:
            logger.error(f"Error searching modules and paths: {e}")
            return SearchResults(
                modules=[],
                paths=[],
                total_modules=0,
                total_paths=0,
                page=1,
                page_size=20,
                total_pages=0,
            )

    async def get_recommendations(
        self, user_id: int, limit: int = 5
    ) -> List[LearningPathRecommendation]:
        """Get personalized learning path recommendations - FAST"""
        try:
            # Get user's skills directly with ORM
            user_record = await prisma.user.find_unique(
                where={"id": user_id}, include={}
            )

            user_skills = set()
            if user_record and user_record.skills:
                user_skills = set(user_record.skills)

            # Also get skills from enrolled modules
            enrolled_modules = await prisma.enrollment.find_many(
                where={"userId": user_id, "moduleId": {"not": None}},
                include={"module": True},
                take=20,
            )
            for e in enrolled_modules:
                if e.module and e.module.skills:
                    user_skills.update(e.module.skills)

            logger.info(f"User {user_id} skills: {user_skills}")

            # Get paths ordered by enrollment count using ORM
            all_paths_orm = await prisma.path.find_many(
                where={"deletedAt": None},
                include={
                    "modules": {
                        "include": {"module": True},
                        "order_by": {"order": "asc"},
                    }
                },
            )

            # Count enrollments for each path for sorting
            path_enrollment_counts = {}
            if all_paths_orm:
                path_ids_for_count = [p.id for p in all_paths_orm]
                enrollment_counts = await prisma.enrollment.group_by(
                    by=["pathId"],
                    where={"pathId": {"in": path_ids_for_count}},
                    count={"_all": True},
                )
                path_enrollment_counts = {
                    r["pathId"]: r["_count"]["_all"] for r in enrollment_counts
                }

            # Sort by enrollment count desc, then createdAt desc
            all_paths_orm.sort(
                key=lambda p: (-path_enrollment_counts.get(p.id, 0), p.createdAt),
                reverse=False,
            )
            paths_with_modules = all_paths_orm[: limit * 3]

            logger.info(f"Found {len(paths_with_modules)} paths for recommendations")

            if not paths_with_modules:
                logger.warning(f"No paths found in database for user {user_id}")
                return []

            # Batch query for module lesson counts
            all_module_ids = []
            for path in paths_with_modules:
                for path_module in path.modules:
                    if path_module.module:
                        all_module_ids.append(path_module.module.id)

            lesson_counts = {}
            if all_module_ids:
                try:
                    result = await prisma.lesson.group_by(
                        by=["moduleId"],
                        where={"moduleId": {"in": all_module_ids}},
                        count={"_all": True},
                    )
                    lesson_counts = {r["moduleId"]: r["_count"]["_all"] for r in result}
                except Exception as e:
                    logger.error(f"Error getting batch lesson counts: {e}")

            recommendations = []
            for path in paths_with_modules:
                if len(recommendations) >= limit:
                    break

                # Calculate match score based on skills overlap
                path_skills = set()
                for path_module in path.modules:
                    if path_module.module:
                        path_skills.update(path_module.module.skills or [])

                common_skills = user_skills.intersection(path_skills)
                match_score = (
                    len(common_skills) / len(path_skills) if path_skills else 0
                )

                # If user has no skills, recommend all paths (match_score = 0)
                # Otherwise, only recommend if there's a reasonable match (>0.2)
                should_recommend = (len(user_skills) == 0) or (match_score > 0.2)

                logger.debug(
                    f"Path {path.id}: skills={path_skills}, match_score={match_score}, should_recommend={should_recommend}"
                )

                if should_recommend:
                    # Convert path modules to SIMPLIFIED module responses
                    modules_data = []
                    for path_module in path.modules:
                        if path_module.module:
                            module = path_module.module
                            lesson_count = lesson_counts.get(module.id, 0)

                            # Use ModuleListResponse
                            modules_data.append(
                                ModuleListResponse(
                                    id=module.id,
                                    title=module.title,
                                    description=module.description,
                                    level=module.level or "Beginner",
                                    duration_minutes=module.durationMinutes,
                                    total_lessons=lesson_count,
                                    skills=module.skills or [],
                                    tags=module.tags or [],
                                    price=self._parse_price(module.price),
                                    featured=module.featured or False,
                                    gradient=self._get_module_gradient(module),
                                    icon=self._get_module_icon(module),
                                    category=self._get_module_category(module),
                                    progress=0.0,
                                    is_enrolled=False,
                                    rating=None,
                                    enrolled=0,
                                    is_new=self._is_module_new(module),
                                    instructor=None,
                                    paths=[],
                                )
                            )

                    # Get path statistics
                    total_modules = len(modules_data)
                    total_duration = sum(
                        module.duration_minutes or 0 for module in modules_data
                    )

                    # Create path response
                    path_response = PathResponse(
                        id=path.id,
                        title=path.title,
                        description=path.description,
                        createdAt=path.createdAt,
                        updatedAt=path.updatedAt,
                        deletedAt=path.deletedAt,
                        modules=[],
                        totalModules=total_modules,
                        totalDuration=self._format_duration(total_duration),
                        progress=0.0,
                        isEnrolled=False,
                        enrolled=0,
                        estimatedCompletionTime=self._estimate_completion_time(
                            total_duration
                        ),
                    )

                    reason = (
                        f"Matches {len(common_skills)} of your skills"
                        if common_skills
                        else "Popular learning path"
                    )

                    recommendation = LearningPathRecommendation(
                        path=path_response,
                        modules=modules_data,
                        match_score=match_score,
                        reason=reason,
                        target_url=f"/learn/paths/{path.id}",
                        target_id=path.id,
                        target_type="path",
                    )

                    recommendations.append(recommendation)

            # Sort by match score and return top recommendations
            recommendations.sort(key=lambda x: x.match_score, reverse=True)
            return recommendations[:limit]

        except Exception as e:
            logger.error(f"Error getting recommendations: {e}")
            return []

    def _get_module_icon(self, module) -> str:
        """Get icon based on module tags or skills"""
        icons = {
            "programming": "💻",
            "design": "🎨",
            "business": "💼",
            "marketing": "📈",
            "data": "📊",
            "ai": "🤖",
            "web": "🌐",
            "mobile": "📱",
        }

        result = "📚"
        if module.tags:
            for tag in module.tags:
                tag_lower = tag.lower()
                for key in icons:
                    if key in tag_lower:
                        result = icons[key]
                        break
                if result != "📚":
                    break

        if result == "📚" and module.skills:
            for skill in module.skills:
                skill_lower = skill.lower()
                for key in icons:
                    if key in skill_lower:
                        result = icons[key]
                        break
                if result != "📚":
                    break

        return result

    def _get_module_gradient(self, module) -> str:
        """Get gradient based on module ID"""
        gradients = [
            "from-violet-500 to-sky-500",
            "from-blue-600 to-indigo-500",
            "from-green-500 to-teal-500",
            "from-orange-500 to-red-500",
            "from-purple-500 to-pink-500",
        ]

        try:
            module_hash = hash(str(module.id)) % len(gradients)
            result = gradients[module_hash]
        except Exception:
            result = gradients[0]

        return result

    def _get_module_category(self, module) -> str:
        """Get category based on module tags or skills"""
        result = "General"
        if module.tags and len(module.tags) > 0:
            result = module.tags[0]

        return result

    def _is_module_new(self, module) -> bool:
        """Check if module was created in the last 30 days"""
        if not module.createdAt:
            return False
        return module.createdAt > datetime.now(timezone.utc) - timedelta(days=30)

    def _parse_price(self, price_data: Any) -> Dict[str, Optional[int]]:
        """Parse price field from JSON with robust numeric handling"""
        if not price_data:
            return {"original": 0, "discounted": None}

        parsed = {}
        if isinstance(price_data, dict):
            parsed = price_data
        else:
            try:
                parsed = json.loads(price_data) if isinstance(price_data, str) else {}
            except Exception:
                return {"original": 0, "discounted": None}

        # Ensure values are integers or None
        def to_int(val):
            if val is None:
                return None
            try:
                return int(val)
            except (ValueError, TypeError):
                return 0

        # Support both formats: {original, discounted} and {amount, currency}
        original = parsed.get("original")
        if original is None:
            original = parsed.get("amount", 0)

        discounted = parsed.get("discounted")
        currency = parsed.get("currency", "DZD")

        return {
            "original": to_int(original),
            "discounted": to_int(discounted) if discounted is not None else None,
            "amount": to_int(original),  # For backward compatibility with frontend
            "currency": currency,
        }

    def _get_effective_price(self, price_dict: Dict[str, Any]) -> int:
        discounted = price_dict.get("discounted")
        if discounted is not None and discounted > 0:
            return discounted
        return price_dict.get("original", 0) or 0

    def _parse_json_field(self, value: Any, default: Any = None) -> Any:
        """Parse JSON field from database"""
        if value is None:
            return default
        if isinstance(value, (list, dict)):
            return value
        try:
            return json.loads(value) if value else default
        except:
            return default

    async def _get_what_you_get(
        self, module, lesson_count: Optional[int] = None
    ) -> List[str]:
        """Generate what you get list for module - OPTIMIZED to accept pre-computed lesson count"""
        # OPTIMIZATION: Accept lesson_count parameter to avoid redundant database queries
        if lesson_count is None:
            lessons_count = (
                await prisma.lesson.count(
                    where={"moduleId": module.id, "deletedAt": None}
                )
                if hasattr(module, "id")
                else 0
            )
        else:
            lessons_count = lesson_count

        return [
            f"{lessons_count} comprehensive lessons",
            "Interactive exercises",
            "Professional certificate",
            "Lifetime access",
        ]

    async def _get_module_features(
        self, module, lesson_count: Optional[int] = None
    ) -> List[str]:
        """Generate features list for module - OPTIMIZED to accept pre-computed lesson count"""
        # OPTIMIZATION: Accept lesson_count parameter to avoid redundant database queries
        if lesson_count is None:
            lessons_count = (
                await prisma.lesson.count(
                    where={"moduleId": module.id, "deletedAt": None}
                )
                if hasattr(module, "id")
                else 0
            )
        else:
            lessons_count = lesson_count

        return [
            f"{lessons_count} comprehensive lessons",
            "Interactive exercises",
            "Professional certificates",
            "Lifetime access",
            "Mobile friendly",
            "Community support",
        ]

    def _format_duration(self, minutes: int) -> str:
        """Format duration in minutes to human readable string"""
        if not minutes or minutes <= 0:
            return "Unknown"

        hours = minutes // 60
        mins = minutes % 60

        if hours > 0:
            return f"{hours}h {mins}min" if mins > 0 else f"{hours}h"
        return f"{mins} min"

    def _estimate_completion_time(self, total_minutes: int) -> str:
        """Estimate completion time based on total minutes"""
        if not total_minutes:
            return "Unknown"

        # Assuming 1-2 hours per week of study
        weeks = math.ceil(total_minutes / (90 * 1))  # 90 minutes per week
        if weeks == 1:
            return "1 week"
        elif weeks <= 4:
            return f"{weeks} weeks"
        else:
            months = math.ceil(weeks / 4)
            return f"{months} month" if months == 1 else f"{months} months"

    async def _get_module_enrollment_count(self, module_id: str) -> int:
        """Get enrollment count for a module"""
        return await prisma.enrollment.count(where={"moduleId": module_id})

    async def _get_path_enrollment_count(self, path_id: str) -> int:
        """Get enrollment count for a path"""
        return await prisma.enrollment.count(where={"pathId": path_id})

    def _get_sort_order(self, sort_by: str) -> Dict[str, str]:
        """Get sort order based on sort_by parameter"""
        sort_mapping = {
            "relevance": {"createdAt": "desc"},
            "popularity": {"enrollments": {"_count": "desc"}},
            "recent": {"createdAt": "desc"},
            "duration": {"durationMinutes": "desc"},
            "difficulty": {"level": "asc"},
            "price": {"price": "desc"},
        }
        return sort_mapping.get(sort_by, {"createdAt": "desc"})

    def _calculate_streak(self, completion_dates: List[datetime.date]) -> int:
        """Calculate current learning streak from completion dates"""
        if not completion_dates:
            return 0

        # Sort dates and remove duplicates
        unique_dates = sorted(set(completion_dates), reverse=True)

        streak = 0
        current_date = datetime.now(timezone.utc).date()

        for i, date in enumerate(unique_dates):
            if i == 0 and date == current_date:
                streak += 1
                current_date = current_date - timedelta(days=1)
            elif date == current_date:
                streak += 1
                current_date = current_date - timedelta(days=1)
            else:
                break

        return streak

    # ============ COURSE REVIEW METHODS ============

    async def _get_module_avg_rating(self, module_id: str) -> Optional[float]:
        """Get the average rating for a single module."""
        try:
            results = await prisma.coursereview.group_by(
                by=["moduleId"], where={"moduleId": module_id}, avg={"rating": True}
            )
            if results and results[0].get("_avg", {}).get("rating") is not None:
                return round(results[0]["_avg"]["rating"], 1)
            return None
        except Exception as e:
            logger.error(f"Error getting avg rating for module {module_id}: {e}")
            return None

    async def _get_module_avg_ratings(
        self, module_ids: list
    ) -> Dict[str, Optional[float]]:
        """Get average ratings for multiple modules in a single batch query."""
        try:
            if not module_ids:
                return {}
            results = await prisma.coursereview.group_by(
                by=["moduleId"],
                where={"moduleId": {"in": module_ids}},
                avg={"rating": True},
            )
            return {
                r["moduleId"]: round(r["_avg"]["rating"], 1)
                for r in results
                if r.get("_avg", {}).get("rating") is not None
            }
        except Exception as e:
            logger.error(f"Error getting batch avg ratings: {e}")
            return {}

    async def submit_review(
        self, user_id: int, module_id: str, rating: int, comment: Optional[str] = None
    ) -> CourseReviewResponse:
        """Submit or update a course review. Validates enrollment and lesson completion."""
        # Validate rating range
        if not 1 <= rating <= 5:
            raise ValueError("Rating must be between 1 and 5")

        # Check enrollment
        enrollment = await prisma.enrollment.find_first(
            where={"userId": user_id, "moduleId": module_id}
        )
        if not enrollment:
            raise PermissionError(
                "You must be enrolled in this course to submit a review"
            )

        # Check at least one completed lesson
        # First get lesson IDs for this module, then check completion
        module_lessons = await prisma.lesson.find_many(
            where={"moduleId": module_id}, distinct=["id"]
        )
        module_lesson_ids = [l.id for l in module_lessons]

        completed_lesson = None
        if module_lesson_ids:
            completed_lesson = await prisma.lessonprogress.find_first(
                where={
                    "userId": user_id,
                    "isCompleted": True,
                    "lessonId": {"in": module_lesson_ids},
                }
            )
        if not completed_lesson:
            raise PermissionError(
                "You must complete at least one lesson before submitting a review"
            )

        # Upsert review (one per user per course)
        review = await prisma.coursereview.upsert(
            where={"userId_moduleId": {"userId": user_id, "moduleId": module_id}},
            data={
                "create": {
                    "userId": user_id,
                    "moduleId": module_id,
                    "rating": rating,
                    "comment": comment,
                },
                "update": {"rating": rating, "comment": comment},
            },
            include={"user": True},
        )

        return CourseReviewResponse(
            id=review.id,
            userId=review.userId,
            moduleId=review.moduleId,
            rating=review.rating,
            comment=review.comment,
            createdAt=review.createdAt,
            updatedAt=review.updatedAt,
            user_full_name=review.user.fullName if review.user else "",
            user_profile_picture_url=review.user.profilePictureUrl
            if review.user
            else None,
        )

    async def get_course_reviews(
        self, module_id: str, page: int = 1, page_size: int = 10
    ) -> PaginatedReviewsResponse:
        """Get paginated reviews for a course with user info and average rating."""
        try:
            skip = (page - 1) * page_size

            # Fetch count, reviews, and avg rating
            total = await prisma.coursereview.count(where={"moduleId": module_id})
            reviews = await prisma.coursereview.find_many(
                where={"moduleId": module_id},
                include={"user": True},
                order={"createdAt": "desc"},
                skip=skip,
                take=page_size,
            )
            avg_rating = await self._get_module_avg_rating(module_id)

            review_responses = [
                CourseReviewResponse(
                    id=r.id,
                    userId=r.userId,
                    moduleId=r.moduleId,
                    rating=r.rating,
                    comment=r.comment,
                    createdAt=r.createdAt,
                    updatedAt=r.updatedAt,
                    user_full_name=r.user.fullName if r.user else "",
                    user_profile_picture_url=r.user.profilePictureUrl
                    if r.user
                    else None,
                )
                for r in reviews
            ]

            return PaginatedReviewsResponse(
                reviews=review_responses,
                total=total,
                page=page,
                page_size=page_size,
                average_rating=avg_rating,
            )
        except Exception as e:
            logger.error(f"Error getting reviews for module {module_id}: {e}")
            return PaginatedReviewsResponse(
                reviews=[], total=0, page=page, page_size=page_size, average_rating=None
            )

    async def delete_review(self, user_id: int, review_id: str) -> bool:
        """Delete a review. Only the owner can delete their own review."""
        review = await prisma.coursereview.find_unique(where={"id": review_id})
        if not review:
            raise ValueError("Review not found")
        if review.userId != user_id:
            raise PermissionError("You can only delete your own review")

        await prisma.coursereview.delete(where={"id": review_id})
        return True

    async def recalculate_module_duration(self, module_id: str) -> None:
        """Recalculate Module.durationMinutes and Module.totalLessons from active lessons
        and cascade changes to parent Path records.
        """
        try:
            lessons = await prisma.lesson.find_many(
                where={"moduleId": module_id, "deletedAt": None}
            )
            total_lessons = len(lessons)
            total_minutes = sum(l.durationMinutes or 0 for l in lessons)

            await prisma.module.update(
                where={"id": module_id},
                data={
                    "durationMinutes": total_minutes,
                    "totalLessons": total_lessons,
                },
            )
            await self.recalculate_parent_paths_for_module(module_id)
        except Exception as e:
            logger.error(f"Error recalculating duration for module {module_id}: {e}")

    async def recalculate_path_duration(self, path_id: str) -> None:
        """Recalculate Path.durationMinutes and Path.totalLessons from linked active modules."""
        try:
            path_modules = await prisma.pathmodule.find_many(
                where={"pathId": path_id}, include={"module": True}
            )
            active_modules = [
                pm.module
                for pm in path_modules
                if pm.module and pm.module.deletedAt is None
            ]
            total_minutes = sum(m.durationMinutes or 0 for m in active_modules)
            total_lessons = sum(m.totalLessons or 0 for m in active_modules)

            await prisma.path.update(
                where={"id": path_id},
                data={
                    "durationMinutes": total_minutes,
                    "totalLessons": total_lessons,
                },
            )
        except Exception as e:
            logger.error(f"Error recalculating duration for path {path_id}: {e}")

    async def recalculate_parent_paths_for_module(self, module_id: str) -> None:
        """Recalculate all parent paths that include module_id."""
        try:
            links = await prisma.pathmodule.find_many(where={"moduleId": module_id})
            for link in links:
                await self.recalculate_path_duration(link.pathId)
        except Exception as e:
            logger.error(
                f"Error recalculating parent paths for module {module_id}: {e}"
            )

    async def reorder_module_lessons(
        self,
        module_id: str,
        lesson_orders: List[Any],
    ) -> bool:
        """Reorder lessons within a module atomically in a single sequential write pass.

        Ensures sibling items are re-indexed sequentially (1, 2, 3, ...) without positional
        collisions, gaps, or duplicate index bugs.
        """
        if not lesson_orders:
            return True

        # 1. Parse and extract (lesson_id, target_order, original_index)
        parsed_items = []
        for idx, item in enumerate(lesson_orders):
            if isinstance(item, dict):
                lid = item.get("lessonId") or item.get("lesson_id") or item.get("id")
                ord_val = item.get("order")
            else:
                lid = (
                    getattr(item, "lessonId", None)
                    or getattr(item, "lesson_id", None)
                    or getattr(item, "id", None)
                )
                ord_val = getattr(item, "order", None)

            if not lid:
                continue
            parsed_items.append(
                (str(lid), ord_val if ord_val is not None else idx + 1, idx)
            )

        if not parsed_items:
            return True

        # Check for duplicate lesson IDs
        lesson_ids = [item[0] for item in parsed_items]
        if len(set(lesson_ids)) != len(lesson_ids):
            raise ValueError("Duplicate lesson IDs in reorder request")

        # Verify all lessons belong to this module and are not deleted
        member_count = await prisma.lesson.count(
            where={"id": {"in": lesson_ids}, "moduleId": module_id, "deletedAt": None}
        )
        if member_count != len(lesson_ids):
            raise ValueError("One or more lessons do not belong to this module")

        # 2. Sort by target order with stable original index as tie-breaker
        sorted_items = sorted(parsed_items, key=lambda x: (x[1], x[2]))

        # 3. Single sequential write pass inside an atomic database transaction
        async with prisma.tx() as tx:
            for seq_idx, (lid, _, _) in enumerate(sorted_items, start=1):
                await tx.lesson.update(
                    where={"id": lid},
                    data={"order": seq_idx},
                )

        # 4. Recalculate durations
        await self.recalculate_module_duration(module_id)
        await self.recalculate_parent_paths_for_module(module_id)

        return True

    async def reorder_path_modules(
        self,
        path_id: str,
        module_orders: List[Any],
    ) -> bool:
        """Reorder modules (sections) within a learning path atomically in a single sequential write pass.

        Ensures sibling items are re-indexed sequentially (1, 2, 3, ...) without positional
        collisions, gaps, or duplicate index bugs.
        """
        if not module_orders:
            return True

        # 1. Parse and extract (module_id, target_order, original_index)
        parsed_items = []
        for idx, item in enumerate(module_orders):
            if isinstance(item, dict):
                mid = item.get("moduleId") or item.get("module_id") or item.get("id")
                ord_val = item.get("order")
            else:
                mid = (
                    getattr(item, "moduleId", None)
                    or getattr(item, "module_id", None)
                    or getattr(item, "id", None)
                )
                ord_val = getattr(item, "order", None)

            if not mid:
                continue
            parsed_items.append(
                (str(mid), ord_val if ord_val is not None else idx + 1, idx)
            )

        if not parsed_items:
            return True

        # Check for duplicate module IDs
        module_ids = [item[0] for item in parsed_items]
        if len(set(module_ids)) != len(module_ids):
            raise ValueError("Duplicate module IDs in reorder request")

        # Verify all modules belong to this path
        path_links = await prisma.pathmodule.find_many(
            where={"pathId": path_id, "moduleId": {"in": module_ids}}
        )
        if len(path_links) != len(module_ids):
            raise ValueError("One or more modules do not belong to this learning path")

        link_map = {link.moduleId: link.id for link in path_links}

        # 2. Sort by target order with stable original index tie-breaker
        sorted_items = sorted(parsed_items, key=lambda x: (x[1], x[2]))

        # 3. Single sequential write pass inside an atomic database transaction
        async with prisma.tx() as tx:
            for seq_idx, (mid, _, _) in enumerate(sorted_items, start=1):
                link_id = link_map[mid]
                await tx.pathmodule.update(
                    where={"id": link_id},
                    data={"order": seq_idx},
                )

        # 4. Recalculate path duration
        await self.recalculate_path_duration(path_id)

        return True


# Singleton instance
education_service = EducationService()
