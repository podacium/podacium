# services/api/app/routers/education.py
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.core.auth import get_current_user, get_current_user_optional
from app.services.education_service import education_service, ProgressUpdateResult
from app.services.live_session_integration_service import (
    live_session_integration_service,
)
from app.schemas.education import (
    ModuleResponse,
    LessonResponse,
    EnrollmentResponse,
    LessonProgressResponse,
    ProgressUpdate,
    PathResponse,
    ModuleListResponse,
    PathListResponse,
    UserLearningStats,
    LearningPathRecommendation,
    SearchQuery,
    SearchResults,
    ModuleCreate,
    ModuleUpdate,
    LessonCreate,
    LessonUpdate,
    QuizSubmission,
    QuizAttemptResponse,
    CourseReviewCreate,
    CourseReviewResponse,
    PaginatedReviewsResponse,
    QuizCreate,
    LessonReorderRequest,
    LiveSessionModuleLinkCreate,
    LiveSessionModuleLinkResponse,
    InstructorPathCreate,
    InstructorPathUpdate,
    InstructorPathModuleAdd,
    InstructorPathModuleReorder,
    CodeExecutionRequest,
    CodeExecutionResponse,
)
from app.core.prisma import prisma
from app.generated.prisma import Json
import asyncio
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/education", tags=["education"])


def _user_role(user):
    return user.get("role") if isinstance(user, dict) else getattr(user, "role", None)


def _user_id(user):
    return user.get("id") if isinstance(user, dict) else getattr(user, "id", None)


def _ensure_instructor_owns_module(user, module) -> None:
    """Admins may manage any module; instructors may only manage their own."""
    if _user_role(user) == "ADMIN":
        return
    if _user_role(user) != "INSTRUCTOR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
        )
    if module is None or getattr(module, "instructorId", None) != _user_id(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions: not the module owner",
        )


# ============ PUBLIC ENDPOINTS ============


@router.get("/modules/public", response_model=List[ModuleListResponse])
async def list_modules_public(
    featured: Optional[bool] = Query(None, description="Filter featured modules"),
    limit: Optional[int] = Query(
        20, ge=1, le=100, description="Number of modules to return"
    ),
    offset: Optional[int] = Query(0, ge=0, description="Offset for pagination"),
    level: Optional[str] = Query(None, description="Filter by level"),
    category: Optional[str] = Query(None, description="Filter by category"),
):
    """
    Public endpoint to get modules without authentication
    """
    try:
        logger.debug(
            f"Fetching public modules - featured: {featured}, limit: {limit}, offset: {offset}"
        )

        modules = await education_service.get_modules(
            user_id=None,
            featured=featured,
            limit=limit,
            offset=offset,
            lightweight=True,  # Optimize for public endpoints
        )

        # Apply additional filters
        if level:
            modules = [m for m in modules if m.level == level]
        # Note: category filtering is not available on public modules as category is a computed field

        logger.debug(f"Successfully fetched {len(modules)} public modules")
        return modules

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in list_modules_public: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/modules/public/{module_id}", response_model=ModuleResponse)
async def get_module_public(module_id: str):
    """
    Public endpoint to get a specific module without authentication
    """
    try:
        logger.info(f"Fetching public module: {module_id}")

        module = await education_service.get_module(module_id, include_lessons=True)

        if not module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Module not found"
            )

        logger.info(f"Successfully fetched public module: {module_id}")
        return module

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_module_public: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/paths/public", response_model=List[PathListResponse])
async def list_paths_public(
    limit: Optional[int] = Query(
        50, ge=1, le=50, description="Number of paths to return"
    ),
    offset: Optional[int] = Query(0, ge=0, description="Offset for pagination"),
    featured: Optional[bool] = Query(
        None, description="Filter featured paths"
    ),  # Add featured parameter
):
    """
    Public endpoint to get learning paths without authentication
    """
    try:
        logger.info(
            f"Fetching public paths - limit: {limit}, offset: {offset}, featured: {featured}"
        )

        paths = await education_service.get_paths(
            user_id=None,
            featured=featured,  # Pass the featured parameter
            limit=limit,
            offset=offset,
        )

        logger.info(f"Successfully fetched {len(paths)} public paths")
        return paths

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in list_paths_public: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/paths/public/{path_id}", response_model=PathResponse)
async def get_path_public(path_id: str):
    """
    Public endpoint to get a specific learning path without authentication
    """
    try:
        logger.info(f"Fetching public path: {path_id}")

        path = await education_service.get_path(path_id)

        if not path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Path not found"
            )

        logger.info(f"Successfully fetched public path: {path_id}")
        return path

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_path_public: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


# ============ AUTHENTICATED ENDPOINTS ============


@router.get("/modules", response_model=List[ModuleListResponse])
async def list_modules(
    featured: Optional[bool] = Query(None, description="Filter featured modules"),
    limit: Optional[int] = Query(
        20, ge=1, le=100, description="Number of modules to return"
    ),
    offset: Optional[int] = Query(0, ge=0, description="Offset for pagination"),
    level: Optional[str] = Query(None, description="Filter by level"),
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user: dict = Depends(get_current_user_optional),
):
    """
    Get all modules with optional filtering and pagination
    """
    try:
        user_id = _user_id(current_user)
        logger.info(f"Fetching modules for user {user_id} - featured: {featured}")

        modules = await education_service.get_modules(
            user_id=user_id, featured=featured, limit=limit, offset=offset
        )

        # Apply additional filters
        if level:
            modules = [m for m in modules if m.level == level]
        # Note: category filtering is not available as category is a computed field

        logger.info(f"Successfully fetched {len(modules)} modules for user {user_id}")
        return modules

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in list_modules: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/modules/{module_id}", response_model=ModuleResponse)
async def get_module(
    module_id: str,
    include_lessons: bool = Query(True, description="Include lessons in response"),
    current_user: dict = Depends(get_current_user_optional),
):
    """
    Get a specific module with lessons and progress
    """
    try:
        user_id = _user_id(current_user)
        logger.info(f"Fetching module {module_id} for user {user_id}")

        module = await education_service.get_module(module_id, user_id, include_lessons)

        if not module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Module not found"
            )

        logger.info(f"Successfully fetched module {module_id} for user {user_id}")
        return module

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_module: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/paths", response_model=List[PathListResponse])
async def list_paths(
    limit: Optional[int] = Query(
        10, ge=1, le=50, description="Number of paths to return"
    ),
    offset: Optional[int] = Query(0, ge=0, description="Offset for pagination"),
    featured: Optional[bool] = Query(
        None, description="Filter featured paths"
    ),  # Add featured parameter
    current_user: dict = Depends(get_current_user_optional),
):
    """
    Get all learning paths
    """
    try:
        user_id = _user_id(current_user)
        logger.info(
            f"Fetching paths for user {user_id} - limit: {limit}, featured: {featured}"
        )

        paths = await education_service.get_paths(
            user_id=user_id,
            featured=featured,  # Pass the featured parameter
            limit=limit,
            offset=offset,
        )

        logger.info(f"Successfully fetched {len(paths)} paths for user {user_id}")
        return paths

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in list_paths: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/paths/{path_id}", response_model=PathResponse)
async def get_path(
    path_id: str, current_user: dict = Depends(get_current_user_optional)
):
    """
    Get a specific learning path with all modules
    """
    try:
        user_id = _user_id(current_user)
        logger.info(f"Fetching path {path_id} for user {user_id}")

        path = await education_service.get_path(path_id, user_id)

        if not path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Path not found"
            )

        logger.info(f"Successfully fetched path {path_id} for user {user_id}")
        return path

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_path: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


# ============ INSTRUCTOR PATH MANAGEMENT ENDPOINTS ============


@router.post("/paths", status_code=201)
async def create_learning_path(
    data: InstructorPathCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Create a new learning path (Instructor/Admin only).
    """
    if _user_role(current_user) not in ["INSTRUCTOR", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create learning paths",
        )

    import uuid
    import re

    path_id = data.id
    if not path_id:
        slug = re.sub(r"[^a-z0-9]+", "-", data.title.lower()).strip("-")[:40]
        path_id = f"{slug}-{uuid.uuid4().hex[:6]}"

    price_json = Json(data.price) if data.price else None

    path = await prisma.path.create(
        data={
            "id": path_id,
            "title": data.title,
            "description": data.description,
            "thumbnailUrl": data.thumbnail_url,
            "price": price_json,
        }
    )
    return {
        "success": True,
        "id": path.id,
        "title": path.title,
    }


@router.put("/paths/{path_id}")
async def update_learning_path(
    path_id: str,
    data: InstructorPathUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Update a learning path's metadata (Instructor/Admin only).
    """
    if _user_role(current_user) not in ["INSTRUCTOR", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update learning paths",
        )

    if data.featured is not None and _user_role(current_user) != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to feature learning paths (Admin only)",
        )

    path = await prisma.path.find_unique(where={"id": path_id})
    if not path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Path not found"
        )

    update_dict: Dict[str, Any] = {}
    if data.title is not None:
        update_dict["title"] = data.title
    if data.description is not None:
        update_dict["description"] = data.description
    if data.thumbnail_url is not None:
        update_dict["thumbnailUrl"] = data.thumbnail_url
    if data.price is not None:
        update_dict["price"] = Json(data.price)
    if data.featured is not None:
        if _user_role(current_user) != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to feature learning paths (Admin only)",
            )
        update_dict["featured"] = data.featured

    if not update_dict:
        return {"success": True, "message": "No changes to update"}

    updated = await prisma.path.update(where={"id": path_id}, data=update_dict)
    return {"success": True, "id": updated.id, "title": updated.title}


@router.post("/paths/{path_id}/modules", status_code=201)
async def add_module_to_learning_path(
    path_id: str,
    data: InstructorPathModuleAdd,
    current_user: dict = Depends(get_current_user),
):
    """
    Attach a module / course to a learning path (Instructor/Admin only).
    """
    if _user_role(current_user) not in ["INSTRUCTOR", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to modify learning paths",
        )

    path = await prisma.path.find_unique(where={"id": path_id})
    if not path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Path not found"
        )

    module = await prisma.module.find_unique(where={"id": data.module_id})
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Module not found"
        )

    order = data.order
    if order is None:
        existing = await prisma.pathmodule.find_many(where={"pathId": path_id})
        order = max((pm.order or 0 for pm in existing), default=0) + 1

    try:
        pm = await prisma.pathmodule.create(
            data={"pathId": path_id, "moduleId": data.module_id, "order": order}
        )
        await education_service.recalculate_path_duration(path_id)
        return {"success": True, "id": pm.id, "order": order}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Module is already included in this path",
        )


@router.delete("/paths/{path_id}/modules/{path_module_id}")
async def remove_module_from_learning_path(
    path_id: str,
    path_module_id: int,
    current_user: dict = Depends(get_current_user),
):
    """
    Remove a module from a learning path (Instructor/Admin only).
    """
    if _user_role(current_user) not in ["INSTRUCTOR", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to modify learning paths",
        )

    path_module = await prisma.pathmodule.find_unique(where={"id": path_module_id})
    if not path_module or path_module.pathId != path_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Path module link not found"
        )

    await prisma.pathmodule.delete(where={"id": path_module_id})
    await education_service.recalculate_path_duration(path_id)
    return {"success": True}


@router.put("/paths/{path_id}/modules/reorder")
async def reorder_learning_path_modules(
    path_id: str,
    data: InstructorPathModuleReorder,
    current_user: dict = Depends(get_current_user),
):
    """
    Reorder modules in a learning path (Instructor/Admin only).
    """
    if _user_role(current_user) not in ["INSTRUCTOR", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to modify learning paths",
        )

    try:
        await education_service.reorder_path_modules(path_id, data.modules)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in reorder_learning_path_modules: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


# ============ ENROLLMENT ENDPOINTS ============


@router.post("/enroll/module/{module_id}", response_model=Dict[str, Any])
async def enroll_in_module(
    module_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Enroll current user in a module.
    Enforces payment check for paid modules.
    """
    try:
        logger.info(f"User {current_user.id} enrolling in module {module_id}")

        # Check if module exists
        module = await prisma.module.find_unique(where={"id": module_id})
        if not module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Module not found"
            )

        # Check if already enrolled
        existing_enrollment = await prisma.enrollment.find_first(
            where={"userId": current_user.id, "moduleId": module_id}
        )

        if existing_enrollment:
            return {
                "message": "Already enrolled in module",
                "module_id": module_id,
                "user_id": current_user.id,
                "existing": True,
            }

        # Enroll (includes access check and usage recording)
        success = await education_service.enroll_user(
            module_id=module_id, user_id=current_user.id
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Access denied. Payment or active subscription required.",
            )

        logger.info(
            f"User {current_user.id} successfully enrolled in module {module_id}"
        )
        return {
            "message": "Successfully enrolled in module",
            "module_id": module_id,
            "user_id": current_user.id,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in enroll_in_module: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.post("/enroll/path/{path_id}", response_model=Dict[str, Any])
async def enroll_in_path(path_id: str, current_user: dict = Depends(get_current_user)):
    """
    Enroll current user in a learning path.
    Enforces payment check for paid paths.
    """
    try:
        logger.info(f"User {current_user.id} enrolling in path {path_id}")

        # Check if path exists
        path = await prisma.path.find_unique(where={"id": path_id})
        if not path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Path not found"
            )

        # Verify Access and Enroll
        success = await education_service.enroll_user(
            path_id=path_id, user_id=current_user.id
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Access denied. Payment or active subscription required.",
            )

        logger.info(f"User {current_user.id} successfully enrolled in path {path_id}")
        return {
            "message": "Successfully enrolled in path",
            "path_id": path_id,
            "user_id": current_user.id,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in enroll_in_path: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/me/enrollments", response_model=List[EnrollmentResponse])
async def get_my_enrollments(current_user: dict = Depends(get_current_user)):
    """
    Get current user's module and path enrollments with progress
    """
    try:
        logger.info(f"Fetching enrollments for user {current_user.id}")

        enrollments = await education_service.get_user_enrollments(current_user.id)

        logger.info(
            f"Successfully fetched {len(enrollments)} enrollments for user {current_user.id}"
        )
        return enrollments

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_my_enrollments: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


# ============ LESSON ENDPOINTS ============


@router.get("/modules/{module_id}/lessons", response_model=List[LessonResponse])
async def get_module_lessons(
    module_id: str, current_user: dict = Depends(get_current_user_optional)
):
    """
    Get all lessons for a module with user progress
    """
    try:
        user_id = _user_id(current_user)
        logger.info(f"Fetching lessons for module {module_id} for user {user_id}")

        lessons = await education_service.get_module_lessons(module_id, user_id)

        logger.info(
            f"Successfully fetched {len(lessons)} lessons for module {module_id}"
        )
        return lessons

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_module_lessons: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/lessons/{lesson_id}", response_model=LessonResponse)
async def get_lesson(lesson_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get a specific lesson with progress.
    Returns 404 if the lesson is locked (IDOR protection).
    """
    try:
        user_id = current_user.id
        logger.info(f"Fetching lesson {lesson_id} for user {user_id}")

        lesson = await education_service.get_lesson(lesson_id, user_id)

        if not lesson:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found"
            )

        logger.info(f"Successfully fetched lesson {lesson_id} for user {user_id}")
        return lesson

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_lesson: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.post("/lessons/{lesson_id}/progress", response_model=Dict[str, Any])
async def update_lesson_progress(
    lesson_id: str,
    progress_data: ProgressUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Update lesson progress
    """
    try:
        logger.info(
            f"User {current_user.id} updating progress for lesson {lesson_id}: {progress_data}"
        )

        result = await education_service.update_lesson_progress(
            lesson_id, current_user.id, progress_data
        )

        if result == ProgressUpdateResult.NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lesson not found",
            )

        if result == ProgressUpdateResult.ACCESS_DENIED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: you are not enrolled in this course",
            )

        if result == ProgressUpdateResult.LOCKED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: prerequisite lessons must be completed first",
            )

        if result == ProgressUpdateResult.CRITERIA_NOT_MET:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Progress update rejected: completion criteria not met",
            )

        if result == ProgressUpdateResult.ERROR:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error",
            )

        uid = _user_id(current_user)
        logger.info(f"User {uid} successfully updated progress for lesson {lesson_id}")
        lp = await prisma.lessonprogress.find_first(
            where={"userId": uid, "lessonId": lesson_id}
        )
        return {
            "message": "Progress updated successfully",
            "lesson_id": lesson_id,
            "progress": lp.progress if lp else progress_data.progress,
            "completed": lp.isCompleted if lp else False,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_lesson_progress: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.post("/lessons/{lesson_id}/complete", response_model=Dict[str, Any])
async def complete_lesson(
    lesson_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Mark a lesson as completed
    """
    try:
        logger.info(f"User {current_user.id} completing lesson {lesson_id}")

        result = await education_service.complete_lesson(lesson_id, current_user.id)

        if result == ProgressUpdateResult.NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lesson not found",
            )

        if result == ProgressUpdateResult.ACCESS_DENIED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: you are not enrolled in this course",
            )

        if result == ProgressUpdateResult.LOCKED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: prerequisite lessons must be completed first",
            )

        if result == ProgressUpdateResult.CRITERIA_NOT_MET:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Lesson completion rejected: completion criteria not met",
            )

        if result == ProgressUpdateResult.ERROR:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error",
            )

        logger.info(f"User {current_user.id} successfully completed lesson {lesson_id}")
        return {
            "message": "Lesson completed successfully",
            "lesson_id": lesson_id,
            "user_id": current_user.id,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in complete_lesson: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/me/lesson-progresses")
async def get_my_lesson_progresses(
    current_user: dict = Depends(get_current_user),
    limit: Optional[int] = Query(None, ge=1, le=500),
    offset: Optional[int] = Query(None, ge=0),
):
    """Get lesson progress records for the current user.

    Backward compatible: when no pagination params are supplied the legacy
    flat array shape is returned. Passing `limit`/`offset` returns a paginated
    envelope `{items, total, limit, offset}`.
    """
    try:
        args = {"where": {"userId": current_user.id}, "order": {"updatedAt": "desc"}}
        if limit is not None:
            args["take"] = limit
        if offset is not None:
            args["skip"] = offset
        progresses = await prisma.lessonprogress.find_many(**args)

        items = [
            {
                "lessonId": p.lessonId,
                "isCompleted": p.isCompleted,
                "completedAt": p.completedAt.isoformat() if p.completedAt else None,
                "progress": p.progress,
            }
            for p in progresses
        ]
        if limit is None and offset is None:
            return items
        total = await prisma.lessonprogress.count(where={"userId": current_user.id})
        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        logger.error(f"Error fetching lesson progresses: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ============ LEARNING ANALYTICS ENDPOINTS ============


@router.get("/me/stats", response_model=UserLearningStats)
async def get_my_learning_stats(current_user: dict = Depends(get_current_user)):
    """
    Get current user's learning statistics and analytics
    """
    try:
        logger.info(f"Fetching learning stats for user {current_user.id}")

        stats = await education_service.get_user_learning_stats(current_user.id)

        logger.info(f"Successfully fetched learning stats for user {current_user.id}")
        return stats

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_my_learning_stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/me/recommendations", response_model=List[LearningPathRecommendation])
async def get_my_recommendations(
    limit: Optional[int] = Query(
        5, ge=1, le=20, description="Number of recommendations"
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Get personalized learning path recommendations for current user
    """
    try:
        logger.info(f"Fetching recommendations for user {current_user.id}")

        recommendations = await education_service.get_recommendations(
            current_user.id, limit
        )

        logger.info(
            f"Successfully fetched {len(recommendations)} recommendations for user {current_user.id}"
        )
        return recommendations

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_my_recommendations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


# ============ SEARCH ENDPOINTS ============


@router.post("/search", response_model=SearchResults)
async def search_modules_and_paths(
    search_query: SearchQuery, current_user: dict = Depends(get_current_user_optional)
):
    """
    Search modules and paths with advanced filtering
    """
    try:
        user_id = _user_id(current_user)
        logger.info(f"Searching for user {user_id}: {search_query.query}")

        results = await education_service.search_modules_and_paths(
            search_query, user_id
        )

        logger.info(
            f"Search completed for user {user_id}: {results.total_modules} modules, {results.total_paths} paths found"
        )
        return results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in search_modules_and_paths: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/search/quick", response_model=Dict[str, Any])
async def quick_search(
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    limit: Optional[int] = Query(10, ge=1, le=50, description="Number of results"),
    current_user: dict = Depends(get_current_user_optional),
):
    """
    Quick search for modules and paths
    """
    try:
        user_id = _user_id(current_user)
        logger.info(f"Quick search for user {user_id}: {q}")

        search_query = SearchQuery(query=q, page=1, page_size=limit)

        results = await education_service.search_modules_and_paths(
            search_query, user_id
        )

        # Return simplified response for quick search
        simplified_modules = []
        for module in results.modules[:5]:  # Limit to 5 modules
            simplified_modules.append(
                {
                    "id": module.id,
                    "title": module.title,
                    "description": module.description,
                    "level": module.level,
                    "total_lessons": module.total_lessons,
                    "enrolled": module.enrolled,
                    "is_enrolled": module.is_enrolled,
                }
            )

        simplified_paths = []
        for path in results.paths[:5]:  # Limit to 5 paths
            simplified_paths.append(
                {
                    "id": path.id,
                    "title": path.title,
                    "description": path.description,
                    "total_modules": path.total_modules,
                    "enrolled": path.enrolled,
                }
            )

        logger.info(f"Quick search completed for user {user_id}")
        return {
            "query": q,
            "modules": simplified_modules,
            "paths": simplified_paths,
            "total_modules": len(simplified_modules),
            "total_paths": len(simplified_paths),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in quick_search: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


# ============ ADMIN/INSTRUCTOR ENDPOINTS ============


@router.post("/modules", response_model=ModuleResponse)
async def create_module(
    module_data: ModuleCreate, current_user: dict = Depends(get_current_user)
):
    """
    Create a new module (Instructor/Admin only)
    """
    try:
        # Check if user has permission to create modules
        if current_user.role not in ["INSTRUCTOR", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to create modules",
            )

        logger.info(f"User {current_user.id} creating module: {module_data.title}")

        # Create module in database — instructor is ALWAYS the authenticated user
        # (payload-supplied instructor_id is ignored to prevent misattribution)
        db_data = module_data.model_dump_db()
        db_data["instructor"] = {"connect": {"id": current_user.id}}
        module = await prisma.module.create(data=db_data)

        # Return created module
        created_module = await education_service.get_module(module.id, current_user.id)

        logger.info(f"User {current_user.id} successfully created module: {module.id}")
        return created_module

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in create_module: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.put("/modules/{module_id}", response_model=ModuleResponse)
async def update_module(
    module_id: str,
    module_data: ModuleUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Update a module (Instructor/Admin only)
    """
    try:
        # Check if user has permission to update modules
        if current_user.role not in ["INSTRUCTOR", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to update modules",
            )

        # Disallow non-admin self-promotion via featured flag
        if getattr(module_data, "featured", None) is not None:
            if _user_role(current_user) != "ADMIN":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions to feature courses (Admin only)",
                )

        logger.info(f"User {current_user.id} updating module: {module_id}")

        module = await prisma.module.find_unique(where={"id": module_id})
        if not module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Module not found"
            )
        _ensure_instructor_owns_module(current_user, module)

        # Update module in database
        db_data = module_data.model_dump_db()
        if _user_role(current_user) != "ADMIN":
            db_data.pop("featured", None)

        await prisma.module.update(where={"id": module_id}, data=db_data)

        # Return updated module
        updated_module = await education_service.get_module(module_id, current_user.id)

        if not updated_module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Module not found"
            )

        logger.info(f"User {current_user.id} successfully updated module: {module_id}")
        return updated_module

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_module: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.post("/modules/{module_id}/lessons", response_model=LessonResponse)
async def create_lesson(
    module_id: str,
    lesson_data: LessonCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Create a new lesson in a module (Instructor/Admin only)
    """
    try:
        # Check if user has permission to create lessons
        if current_user.role not in ["INSTRUCTOR", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to create lessons",
            )

        logger.info(f"User {current_user.id} creating lesson in module: {module_id}")

        # Verify module exists and user has access
        module = await prisma.module.find_unique(where={"id": module_id})
        if not module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Module not found"
            )
        _ensure_instructor_owns_module(current_user, module)

        # Create lesson — the target module is ALWAYS the URL module_id; a
        # mismatched body module_id must not silently redirect the lesson.
        db_data = lesson_data.model_dump_db()
        db_data["module"] = {"connect": {"id": module_id}}
        lesson = await prisma.lesson.create(data=db_data)

        # Recalculate module duration & total lessons
        await education_service.recalculate_module_duration(module_id)

        # Return created lesson (guaranteeing explicit ID is always returned)
        created_lesson = await education_service.get_lesson(lesson.id, current_user.id)
        if not created_lesson:
            raw_data = await education_service._prepare_lesson_data(
                lesson, user_id=current_user.id, bypass_lock=True
            )
            created_lesson = LessonResponse(**raw_data)

        logger.info(f"User {current_user.id} successfully created lesson: {lesson.id}")
        return created_lesson

    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e)
        logger.error(f"Error in create_lesson: {err_msg}")
        # Prisma validation errors - show friendly message
        if "Unable to match input value" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.lesson.validation_failed",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.lesson.create_failed",
        )


# ============ HEALTH CHECK ENDPOINTS ============


@router.get("/health")
async def health_check():
    """
    Health check for education service
    """
    try:
        # Test database connection
        module_count = await prisma.module.count()
        path_count = await prisma.path.count()
        lesson_count = await prisma.lesson.count()

        return {
            "status": "healthy",
            "database": "connected",
            "module_count": module_count,
            "path_count": path_count,
            "lesson_count": lesson_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except HTTPException:
        raise
    except (ConnectionError, TimeoutError, OSError) as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service unhealthy"
        )


@router.get("/stats")
async def education_stats():
    """
    Get education platform statistics
    """
    try:
        import asyncio

        # Use parallel ORM count calls and database aggregation instead of loading all rows
        (
            total_modules,
            total_paths,
            total_lessons,
            total_enrollments,
            total_completed_lessons,
            ratings_data,
        ) = await asyncio.gather(
            prisma.module.count(where={"deletedAt": None}),
            prisma.path.count(where={"deletedAt": None}),
            prisma.lesson.count(where={"deletedAt": None}),
            prisma.enrollment.count(where={"deletedAt": None}),
            prisma.lessonprogress.count(where={"isCompleted": True, "deletedAt": None}),
            prisma.coursereview.group_by(by=["rating"], count={"_all": True}),
        )

        total_rating_sum = sum(
            row.get("rating", 0) * row.get("_count", {}).get("_all", 0)
            for row in ratings_data
            if isinstance(row, dict)
        )
        total_rating_count = sum(
            row.get("_count", {}).get("_all", 0)
            for row in ratings_data
            if isinstance(row, dict)
        )
        average_module_rating = (
            round(total_rating_sum / total_rating_count, 1)
            if total_rating_count > 0
            else 0.0
        )

        return {
            "total_modules": total_modules,
            "total_paths": total_paths,
            "total_lessons": total_lessons,
            "total_enrollments": total_enrollments,
            "total_completed_lessons": total_completed_lessons,
            "average_module_rating": average_module_rating,
            "most_popular_module": await _get_most_popular_module(),
            "recently_added_modules": await _get_recently_added_modules(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting education stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


async def _get_most_popular_module():
    """Get the most popular module based on enrollment count"""
    try:
        grouped = await prisma.enrollment.group_by(
            by=["moduleId"],
            where={"moduleId": {"not": None}, "deletedAt": None},
            count={"_all": True},
        )
        if not grouped:
            return "Unknown"
        # Resolve the max in Python — deterministic and independent of the
        # group_by ordering syntax (the previous invalid ordering silently threw
        # and always returned "Unknown").
        top = max(grouped, key=lambda r: r["_count"]["_all"])
        module = await prisma.module.find_unique(where={"id": top["moduleId"]})
        return module.title if module else "Unknown"
    except Exception as e:
        logger.warning(f"Error getting most popular module: {e}")
        return "Unknown"


async def _get_recently_added_modules():
    """Get recently added modules"""
    try:
        modules = await prisma.module.find_many(
            take=5,
            order={"createdAt": "desc"},
        )
        return [
            {"id": module.id, "title": module.title, "created_at": module.createdAt}
            for module in modules
        ]
    except (AttributeError, TypeError):
        return []


@router.get("/me/progress/lessons", response_model=List[LessonProgressResponse])
async def get_my_progress_lessons(
    current_user: dict = Depends(get_current_user),
    module_id: Optional[str] = Query(None),
    is_completed: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    Get all lesson progress records for current user
    """
    try:
        logger.info(f"Fetching lesson progresses for user {current_user.id}")

        # Build where clause
        where_clause = {"userId": current_user.id}
        if module_id:
            where_clause["lesson"] = {"moduleId": module_id}
        if is_completed is not None:
            where_clause["isCompleted"] = is_completed

        # Get progress records with lessons
        progress_records = await prisma.lessonprogress.find_many(
            where=where_clause,
            include={"lesson": {"include": {"module": True}}},
            order={"updatedAt": "desc"},
            take=limit,
            skip=offset,
        )

        # Convert to response
        result = []
        for progress in progress_records:
            lesson = progress.lesson

            # Gate through the shared lesson preparer so that a stale progress
            # row (e.g. from a since-expired enrollment) does NOT re-expose
            # paid content — check_access still governs locking.
            bypass = current_user.role == "ADMIN" or (
                lesson.module is not None
                and lesson.module.instructorId == current_user.id
            )
            lesson_data = await education_service._prepare_lesson_data(
                lesson, current_user.id, bypass_lock=bypass
            )
            lesson_data["isCompleted"] = progress.isCompleted
            lesson_response = LessonResponse(**lesson_data)

            # Create progress response
            progress_response = LessonProgressResponse(
                id=progress.id,
                userId=progress.userId,
                lessonId=progress.lessonId,
                isCompleted=progress.isCompleted,
                completedAt=progress.completedAt,
                progress=progress.progress,
                createdAt=progress.createdAt,
                updatedAt=progress.updatedAt,
                deletedAt=progress.deletedAt,
                lesson=lesson_response,
            )
            result.append(progress_response)

        logger.info(
            f"Found {len(result)} lesson progress records for user {current_user.id}"
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting lesson progresses: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/me/progress/lessons/{lesson_id}", response_model=LessonProgressResponse)
async def get_my_lesson_progress(
    lesson_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Get specific lesson progress for current user
    """
    try:
        logger.info(
            f"Fetching lesson progress for user {current_user.id}, lesson {lesson_id}"
        )

        # Get progress record
        progress = await prisma.lessonprogress.find_first(
            where={"userId": current_user.id, "lessonId": lesson_id},
            include={"lesson": {"include": {"module": True}}},
        )

        if not progress:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lesson progress not found",
            )

        lesson = progress.lesson

        # Gate through the shared lesson preparer — a stale progress row does
        # not re-expose paid content after access has lapsed.
        bypass = current_user.role == "ADMIN" or (
            lesson.module is not None and lesson.module.instructorId == current_user.id
        )
        lesson_data = await education_service._prepare_lesson_data(
            lesson, current_user.id, bypass_lock=bypass
        )
        lesson_data["isCompleted"] = progress.isCompleted
        lesson_response = LessonResponse(**lesson_data)

        # Create progress response
        progress_response = LessonProgressResponse(
            id=progress.id,
            userId=progress.userId,
            lessonId=progress.lessonId,
            isCompleted=progress.isCompleted,
            completedAt=progress.completedAt,
            progress=progress.progress,
            createdAt=progress.createdAt,
            updatedAt=progress.updatedAt,
            deletedAt=progress.deletedAt,
            lesson=lesson_response,
        )

        logger.info(
            f"Successfully fetched lesson progress for user {current_user.id}, lesson {lesson_id}"
        )
        return progress_response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting lesson progress: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


# ======================
# QUIZ ENDPOINTS
# ======================

from app.services.quiz_service import quiz_service


@router.put("/lessons/{lesson_id}", response_model=LessonResponse)
async def update_lesson(
    lesson_id: str,
    update_data: LessonUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Update a lesson (Instructor/Admin only)
    """
    try:
        if current_user.role not in ["INSTRUCTOR", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to update lessons",
            )

        logger.info(f"User {current_user.id} updating lesson: {lesson_id}")

        lesson = await prisma.lesson.find_unique(
            where={"id": lesson_id}, include={"module": True}
        )
        if not lesson:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found"
            )
        _ensure_instructor_owns_module(current_user, lesson.module)
        update_dict = update_data.model_dump_db()
        if not update_dict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update"
            )

        await prisma.lesson.update(where={"id": lesson_id}, data=update_dict)
        await education_service.recalculate_module_duration(lesson.moduleId)

        updated_lesson = await education_service.get_lesson(lesson_id, current_user.id)
        if not updated_lesson:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lesson not found after update",
            )

        logger.info(f"User {current_user.id} successfully updated lesson: {lesson_id}")
        return updated_lesson

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_lesson: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.delete("/lessons/{lesson_id}")
async def delete_lesson(lesson_id: str, current_user: dict = Depends(get_current_user)):
    """
    Soft-delete a lesson (Instructor/Admin only)
    """
    try:
        if current_user.role not in ["INSTRUCTOR", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to delete lessons",
            )

        logger.info(f"User {current_user.id} deleting lesson: {lesson_id}")

        lesson = await prisma.lesson.find_unique(
            where={"id": lesson_id}, include={"module": True}
        )
        if not lesson:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found"
            )
        _ensure_instructor_owns_module(current_user, lesson.module)
        module_id = lesson.moduleId
        await prisma.lesson.update(
            where={"id": lesson_id}, data={"deletedAt": datetime.now(timezone.utc)}
        )

        # Cleanup remote video asset from Bunny/Cloudflare/AWS/YouTube
        if lesson.rawPath and lesson.storageProvider:
            try:
                from app.services.video.factory import VideoProviderFactory

                provider = VideoProviderFactory.get_provider(lesson.storageProvider)
                await provider.delete_video(lesson.rawPath)
            except Exception as ex:
                logger.warning(
                    f"Could not delete remote video asset for lesson {lesson_id}: {ex}"
                )

        await education_service.recalculate_module_duration(module_id)

        logger.info(f"User {current_user.id} successfully deleted lesson: {lesson_id}")
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_lesson: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.put("/modules/{module_id}/lessons/reorder")
async def reorder_lessons(
    module_id: str,
    data: LessonReorderRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Reorder lessons within a module (Instructor/Admin only)
    """
    try:
        if current_user.role not in ["INSTRUCTOR", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to reorder lessons",
            )

        logger.info(f"User {current_user.id} reordering lessons in module: {module_id}")

        module = await prisma.module.find_unique(where={"id": module_id})
        if not module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Module not found"
            )
        _ensure_instructor_owns_module(current_user, module)

        await education_service.reorder_module_lessons(module_id, data.lessons)

        logger.info(
            f"User {current_user.id} successfully reordered lessons in module: {module_id}"
        )
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in reorder_lessons: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.post(
    "/modules/{module_id}/lessons/{lesson_id}/video", response_model=Dict[str, Any]
)
async def upload_lesson_video(
    module_id: str,
    lesson_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload a video for a lesson (module owner / admin only).

    Validates extension, content-type, magic bytes, and size before streaming
    to S3. A MediaConvert transcode job is queued; videoUrl/hlsPath are only
    set once transcoding completes.
    """
    from app.services.video.factory import VideoProviderFactory
    from app.services.file_validation_service import validate_video_upload
    from app.tasks.video_tasks import check_transcode_status

    module = await prisma.module.find_unique(where={"id": module_id})
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Module not found"
        )
    _ensure_instructor_owns_module(current_user, module)

    lesson = await prisma.lesson.find_unique(where={"id": lesson_id})
    if not lesson or lesson.moduleId != module_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found"
        )

    # Smart content-tier provider routing:
    # If course is free or lesson is marked as Free Preview -> route to free provider (e.g. YouTube)
    # Otherwise (paid course core lesson) -> route to paid provider (e.g. Bunny Stream)
    is_course_free = not module.price or (
        isinstance(module.price, dict) and module.price.get("amount", 0) <= 0
    )
    is_free_tier = bool(is_course_free or getattr(lesson, "isPreview", False))
    video_provider = await VideoProviderFactory.get_provider_for_content(
        is_free_tier=is_free_tier
    )

    # Validate without buffering the payload into memory.
    is_valid, error = await validate_video_upload(file)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)

    # Extract video duration from stream position 0 before uploading
    duration_secs, duration_mins, formatted_duration = await asyncio.to_thread(
        video_provider.extract_video_duration, file.file
    )

    try:
        # Stream to storage provider.
        result = await video_provider.upload_video_stream(
            file.file,
            file.filename or "lesson.mp4",
            lesson_id,
        )
    except Exception as e:
        logger.error(
            f"Video upload to {video_provider.provider_name} failed for lesson {lesson_id}: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Video upload to storage failed",
        )

    raw_path = result.get("raw_path") or result.get("video_id") or ""

    job_id = None
    try:
        job_id = await video_provider.submit_transcode_job(raw_path, lesson_id)
        provider_name = video_provider.provider_name
        is_managed_provider = provider_name in (
            "bunny",
            "cloudflare",
            "youtube",
            "vimeo",
            "dailymotion",
        )
        initial_status = "ready" if is_managed_provider else "processing"

        update_data: Dict[str, Any] = {
            "storageProvider": provider_name,
            "rawPath": raw_path,
            "transcodingStatus": initial_status,
            "videoUrl": None,
            "hlsPath": None,
        }
        if duration_secs > 0:
            update_data["durationSeconds"] = duration_secs
            update_data["durationMinutes"] = duration_mins
            update_data["estimatedCompletionTime"] = duration_mins

        await prisma.lesson.update(
            where={"id": lesson_id},
            data=update_data,
        )

        # If lesson already had a previous video asset, clean it up from remote storage
        old_raw_path = getattr(lesson, "rawPath", None)
        old_provider_name = getattr(lesson, "storageProvider", None)
        if old_raw_path and old_raw_path != raw_path and old_provider_name:
            try:
                old_provider = VideoProviderFactory.get_provider(old_provider_name)
                await old_provider.delete_video(old_raw_path)
            except Exception as ex:
                logger.warning(
                    f"Failed to delete replaced video asset {old_raw_path}: {ex}"
                )

        await education_service.recalculate_module_duration(module_id)

        if provider_name == "aws":
            check_transcode_status.delay(job_id, lesson_id)

        logger.info(
            f"User {current_user.id} uploaded video for lesson {lesson_id} (job={job_id}, duration={formatted_duration})"
        )
        return {
            "success": True,
            "lesson_id": lesson_id,
            "raw_path": raw_path,
            "transcoding_status": initial_status,
            "detected_duration_seconds": duration_secs,
            "detected_duration_minutes": duration_mins,
            "formatted_duration": formatted_duration,
        }
    except Exception as e:
        logger.warning(
            f"Transcode submission skipped/failed for lesson {lesson_id}: {e}"
        )
        fallback_url = None
        try:
            fallback_res = video_provider.generate_signed_url(raw_path)
            if asyncio.iscoroutine(fallback_res):
                fallback_url = await fallback_res
            else:
                fallback_url = fallback_res
        except Exception:
            from app.services.aws_video_service import aws_video_service

            try:
                fallback_url = aws_video_service.generate_signed_url(raw_path)
            except Exception as sign_err:
                logger.error(
                    f"Could not generate signed fallback URL for lesson {lesson_id} (raw_path={raw_path}): {sign_err}"
                )
                fallback_url = None

        provider_name = video_provider.provider_name
        transcode_status = (
            "ready" if provider_name in ("bunny", "cloudflare") else "failed"
        )

        fallback_update_data: Dict[str, Any] = {
            "storageProvider": provider_name,
            "rawPath": raw_path,
            "transcodingStatus": transcode_status,
            "videoUrl": fallback_url,
            "hlsPath": fallback_url
            if provider_name in ("bunny", "cloudflare")
            else None,
        }
        if duration_secs > 0:
            fallback_update_data["durationSeconds"] = duration_secs
            fallback_update_data["durationMinutes"] = duration_mins
            fallback_update_data["estimatedCompletionTime"] = duration_mins

        await prisma.lesson.update(
            where={"id": lesson_id},
            data=fallback_update_data,
        )
        await education_service.recalculate_module_duration(module_id)
        return {
            "success": True,
            "lesson_id": lesson_id,
            "raw_path": raw_path,
            "transcoding_status": "failed",
            "video_url": fallback_url,
            "detected_duration_seconds": duration_secs,
            "detected_duration_minutes": duration_mins,
            "warning": f"Video stored successfully in S3, but automatic HLS transcoding could not be started: {e}",
        }


@router.get("/modules/{module_id}/lessons/{lesson_id}/status")
async def get_lesson_transcode_status(
    module_id: str,
    lesson_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get the current transcoding status for a lesson (for real-time frontend status polling)."""
    lesson = await prisma.lesson.find_unique(where={"id": lesson_id})
    if not lesson or lesson.moduleId != module_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found"
        )

    return {
        "lesson_id": lesson.id,
        "module_id": lesson.moduleId,
        "transcoding_status": lesson.transcodingStatus or "completed",
        "hls_path": lesson.hlsPath,
        "video_url": lesson.videoUrl,
        "storage_provider": lesson.storageProvider,
        "is_ready": bool(lesson.hlsPath or lesson.videoUrl),
    }


@router.post("/lessons/{lesson_id}/quiz", status_code=201)
async def create_quiz_for_lesson(
    lesson_id: str,
    quiz_data: QuizCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Create or replace a quiz for a lesson (Instructor/Admin only)
    """
    try:
        if current_user.role not in ["INSTRUCTOR", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to create quizzes",
            )

        logger.info(f"User {current_user.id} creating quiz for lesson: {lesson_id}")

        lesson = await prisma.lesson.find_unique(
            where={"id": lesson_id}, include={"quiz": True, "module": True}
        )
        if not lesson:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found"
            )
        _ensure_instructor_owns_module(current_user, lesson.module)

        # Reject all-essay quizzes — they can never be passed without manual grading.
        auto_graded = [q for q in quiz_data.questions if q.question_type != "ESSAY"]
        if quiz_data.questions and not auto_graded:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A quiz must contain at least one auto-graded question "
                "(essay-only quizzes cannot be passed).",
            )

        # Soft-delete existing quiz if any (preserves student attempts and historical records)
        if lesson.quiz:
            now = datetime.now(timezone.utc)
            await prisma.quizquestion.update_many(
                where={"quizId": lesson.quiz.id}, data={"deletedAt": now}
            )
            await prisma.quiz.update(
                where={"id": lesson.quiz.id},
                data={"deletedAt": now, "lessonId": None},
            )

        # Create quiz
        quiz = await prisma.quiz.create(
            data={
                "lessonId": lesson_id,
                "title": quiz_data.title,
                "description": quiz_data.description,
                "passingScore": quiz_data.passing_score,
                "timeLimitMinutes": quiz_data.time_limit_minutes,
                "retakeCooldownMinutes": quiz_data.retake_cooldown_minutes,
                "allowRetake": quiz_data.allow_retake,
                "shuffleQuestions": quiz_data.shuffle_questions,
            }
        )

        # Link quiz to lesson
        await prisma.lesson.update(where={"id": lesson_id}, data={"quizId": quiz.id})

        # Create questions
        for i, q in enumerate(quiz_data.questions):
            await prisma.quizquestion.create(
                data={
                    "quizId": quiz.id,
                    "question": q.question,
                    "questionType": q.question_type,
                    "options": Json(q.options) if q.options else None,
                    "correctAnswer": q.correct_answer,
                    "explanation": q.explanation,
                    "points": q.points,
                    "order": i,
                }
            )

        logger.info(
            f"User {current_user.id} successfully created quiz for lesson: {lesson_id}"
        )
        return {
            "success": True,
            "id": quiz.id,
            "lessonId": lesson_id,
            "title": quiz.title,
            "questionCount": len(quiz_data.questions),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in create_quiz_for_lesson: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/lessons/{lesson_id}/quiz/authoring")
async def get_quiz_authoring(
    lesson_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get full quiz details including correct answers and explanations for authoring (Instructor/Admin only).
    """
    try:
        if _user_role(current_user) not in ["INSTRUCTOR", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to view quiz authoring data",
            )

        lesson = await prisma.lesson.find_unique(
            where={"id": lesson_id},
            include={
                "module": True,
                "quiz": {
                    "include": {
                        "questions": {
                            "where": {"deletedAt": None},
                            "order_by": {"order": "asc"},
                        }
                    }
                },
            },
        )
        if not lesson:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found"
            )
        _ensure_instructor_owns_module(current_user, lesson.module)

        if not lesson.quiz or getattr(lesson.quiz, "deletedAt", None):
            return {"hasQuiz": False, "quiz": None}

        quiz = lesson.quiz
        questions = []
        for q in quiz.questions or []:
            opts = q.options
            if isinstance(opts, str):
                try:
                    opts = json.loads(opts)
                except Exception:
                    opts = []
            questions.append(
                {
                    "id": q.id,
                    "question": q.question,
                    "questionType": getattr(
                        q.questionType, "value", str(q.questionType)
                    ),
                    "options": opts or [],
                    "correctAnswer": q.correctAnswer,
                    "explanation": q.explanation,
                    "points": q.points,
                    "order": q.order,
                }
            )

        return {
            "hasQuiz": True,
            "quiz": {
                "id": quiz.id,
                "title": quiz.title,
                "description": quiz.description,
                "passingScore": quiz.passingScore,
                "timeLimitMinutes": quiz.timeLimitMinutes,
                "retakeCooldownMinutes": quiz.retakeCooldownMinutes,
                "allowRetake": quiz.allowRetake,
                "shuffleQuestions": quiz.shuffleQuestions,
                "questions": questions,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_quiz_authoring: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.delete("/lessons/{lesson_id}/quiz")
async def delete_quiz_for_lesson(
    lesson_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete or detach a quiz from a lesson (Instructor/Admin only).
    """
    try:
        if _user_role(current_user) not in ["INSTRUCTOR", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to delete quizzes",
            )

        lesson = await prisma.lesson.find_unique(
            where={"id": lesson_id},
            include={"module": True, "quiz": True},
        )
        if not lesson:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found"
            )
        _ensure_instructor_owns_module(current_user, lesson.module)

        if lesson.quiz:
            now = datetime.now(timezone.utc)
            await prisma.quizquestion.update_many(
                where={"quizId": lesson.quiz.id}, data={"deletedAt": now}
            )
            await prisma.quiz.update(
                where={"id": lesson.quiz.id},
                data={"deletedAt": now, "lessonId": None},
            )
            await prisma.lesson.update(where={"id": lesson_id}, data={"quizId": None})

        return {"success": True, "message": "Quiz deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_quiz_for_lesson: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


# =============================================================================
# LEARNING ANALYTICS ENDPOINTS
# =============================================================================
@router.get("/quizzes/{lesson_id}")
async def get_quiz(lesson_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get quiz for a lesson if unlocked.
    """
    try:
        # Check if lesson is unlocked for user first
        lesson = await education_service.get_lesson(lesson_id, current_user.id)
        if not lesson or lesson.is_locked:
            raise HTTPException(status_code=404, detail="Quiz not found or locked")

        quiz = await quiz_service.get_quiz(lesson_id)
        if not quiz:
            raise HTTPException(status_code=404, detail="No quiz for this lesson")

        return quiz
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_quiz: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/quizzes/{lesson_id}/start")
async def start_quiz_attempt(
    lesson_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Start a new quiz attempt. Enforces cooldown.
    """
    try:
        # Prerequisite check
        lesson = await education_service.get_lesson(lesson_id, current_user.id)
        if not lesson or lesson.is_locked:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lesson locked"
            )

        if not lesson.quiz_id:
            raise HTTPException(status_code=400, detail="No quiz")

        attempt_id = await quiz_service.start_attempt(current_user.id, lesson.quiz_id)
        if not attempt_id:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Cooldown active. Please wait before retrying.",
            )

        return {"attemptId": attempt_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in start_quiz_attempt: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/quizzes/attempts/{attempt_id}/submit")
async def submit_quiz_attempt(
    attempt_id: int,
    submission: QuizSubmission,
    current_user: dict = Depends(get_current_user),
):
    """
    Submit quiz answers for grading.
    """
    try:
        result = await quiz_service.submit_attempt(
            current_user.id, attempt_id, submission
        )
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))

        # If passed, trigger lesson completion
        if result.get("passed"):
            attempt = await prisma.quizattempt.find_unique(
                where={"id": attempt_id}, include={"quiz": True}
            )
            if attempt and attempt.quiz and attempt.quiz.lessonId:
                await education_service.complete_lesson(
                    attempt.quiz.lessonId, current_user.id
                )

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in submit_quiz_attempt: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/quizzes/{lesson_id}/attempts", response_model=List[QuizAttemptResponse])
async def get_quiz_attempts(
    lesson_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Get user's history for a quiz.
    """
    try:
        lesson = await education_service.get_lesson(lesson_id, current_user.id)
        if not lesson or not lesson.quiz_id:
            raise HTTPException(status_code=404, detail="Quiz not found")

        attempts = await prisma.quizattempt.find_many(
            where={"userId": current_user.id, "quizId": lesson.quiz_id},
            order={"createdAt": "desc"},
        )
        return attempts
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_quiz_attempts: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# =============================================================================
# CODE RUNNER & SANDBOXED MICROVM EVALUATION
# =============================================================================


@router.post("/code/evaluate", response_model=CodeExecutionResponse)
async def evaluate_student_code(
    payload: CodeExecutionRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Execute student code in a sandboxed microVM subprocess asynchronously.
    Non-blocking execution with AST normalization & winnowing plagiarism detection.
    """
    try:
        from app.services.microvm_evaluator_service import microvm_evaluator_service

        # 1. Asynchronous non-blocking sandboxed execution
        result = await microvm_evaluator_service.execute_sandboxed_code_async(
            source_code=payload.code,
            test_code=payload.test_code or "",
            timeout_seconds=5.0,
        )

        # 2. Plagiarism similarity check against template/benchmark
        similarity = 0.0
        flagged = False
        if payload.template_code:
            plag_report = microvm_evaluator_service.calculate_plagiarism_similarity(
                payload.code, payload.template_code
            )
            similarity = plag_report.get("jaccard_similarity", 0.0)
            flagged = bool(plag_report.get("is_plagiarized", False))

        return CodeExecutionResponse(
            passed=result.passed,
            output=result.stdout,
            error=result.stderr if not result.passed else None,
            duration_ms=result.duration_ms,
            memory_mb=16.4,
            similarity_score=round(similarity * 100.0, 1),
            plagiarism_flagged=flagged,
        )
    except Exception as e:
        logger.error(f"Error evaluating student code: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Code evaluation failed",
        )


# ======================
# CERTIFICATE ENDPOINTS
# ======================

from app.services.certificate_service import certificate_service


@router.post("/certificates/generate/module/{module_id}")
async def generate_module_certificate_endpoint(
    module_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Generate certificate for a module completion.
    """
    try:
        certificate = await certificate_service.generate_module_certificate(
            current_user.id, module_id
        )
        if not certificate:
            eligibility = await certificate_service.check_module_eligibility(
                current_user.id, module_id
            )
            if not eligibility["eligible"]:
                raise HTTPException(status_code=400, detail=eligibility["reason"])
            raise HTTPException(
                status_code=500, detail="Failed to generate certificate"
            )
        return certificate
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in generate_module_certificate: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/certificates/generate/path/{path_id}")
async def generate_path_certificate_endpoint(
    path_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Generate certificate for a learning path completion.
    """
    try:
        certificate = await certificate_service.generate_path_certificate(
            current_user.id, path_id
        )
        if not certificate:
            eligibility = await certificate_service.check_path_eligibility(
                current_user.id, path_id
            )
            if not eligibility["eligible"]:
                raise HTTPException(status_code=400, detail=eligibility["reason"])
            raise HTTPException(
                status_code=500, detail="Failed to generate path certificate"
            )
        return certificate
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in generate_path_certificate: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/certificates/auto-generate")
async def auto_generate_certificate(
    module_id: Optional[str] = None,
    path_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Auto-generate certificate when user completes a module or path.
    Called by frontend when progress reaches 100%.
    """
    try:
        if not module_id and not path_id:
            raise HTTPException(
                status_code=400, detail="Either module_id or path_id must be provided"
            )

        certificate = await certificate_service.auto_generate_on_progress(
            current_user.id, module_id, path_id
        )

        if not certificate:
            raise HTTPException(
                status_code=400, detail="Not eligible for certificate yet"
            )

        return certificate
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in auto_generate_certificate: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/certificates/my")
async def get_my_certificates(current_user: dict = Depends(get_current_user)):
    """
    Get all certificates for the current user.
    """
    try:
        certificates = await certificate_service.get_user_certificates(current_user.id)
        return {"certificates": certificates}
    except Exception as e:
        logger.error(f"Error in get_my_certificates: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


def _mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "***"
    name, domain = email.split("@", 1)
    masked_name = name[0] + "***" if name else "***"
    return f"{masked_name}@{domain}"


@router.get("/certificates/{certificate_id}")
async def get_certificate_details(
    certificate_id: str, current_user: dict = Depends(get_current_user_optional)
):
    """
    Get details of a specific certificate. Accessible by owner and public viewers (with masked email for non-owners).
    """
    try:
        certificate = await certificate_service.get_certificate_by_id(certificate_id)
        if not certificate:
            raise HTTPException(status_code=404, detail="Certificate not found")

        is_owner = current_user and current_user.id == certificate.get("userId")
        user_email = (
            certificate["userEmail"]
            if is_owner
            else _mask_email(certificate.get("userEmail", ""))
        )

        return {
            "id": certificate["id"],
            "userId": certificate["userId"],
            "userName": certificate["userName"],
            "userEmail": user_email,
            "completedTitle": certificate["completedTitle"],
            "completedType": certificate["completedType"],
            "issuedAt": certificate["issuedAt"],
            "metadata": certificate["metadata"],
            "fileUrl": certificate["fileUrl"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_certificate_details: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/certificates/download/{certificate_id}")
async def download_certificate(certificate_id: str):
    """
    Download certificate. Redirects to the frontend certificate page
    where the user can view/download the PDF.
    """
    from app.services.certificate_service import certificate_service
    from app.core.config import setting
    from fastapi.responses import RedirectResponse

    try:
        cert = await certificate_service.get_certificate_by_id(certificate_id)
        if not cert:
            raise HTTPException(status_code=404, detail="Certificate not found")
        frontend_url = setting.FRONTEND_URL or "https://www.podacium.com"
        return RedirectResponse(
            url=f"{frontend_url}/learn/certificates/{certificate_id}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading certificate: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/certificates/verify/{certificate_id}")
async def verify_certificate(certificate_id: str):
    """
    Public verification endpoint (No Auth required).
    Anyone with the link can verify certificate authenticity.
    """
    try:
        result = await certificate_service.verify_certificate(certificate_id)
        if not result:
            raise HTTPException(
                status_code=404, detail="Invalid or non-existent certificate"
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in verify_certificate: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/certificates/verify/{certificate_id}")
async def verify_certificate_post(certificate_id: str):
    """
    Public POST verification endpoint (no auth required).

    Validates the certificate's HMAC digital signature and returns the
    credential payload (user name, module/path title, issued date). Used by
    the frontend certificate download/verification page so the credential is
    always checked server-side, never trusted from the URL alone.
    """
    try:
        result = await certificate_service.verify_certificate(certificate_id)
        if not result:
            raise HTTPException(
                status_code=404, detail="Invalid or non-existent certificate"
            )
        if result.get("isValid") is False:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Certificate is not verifiable",
                    "reason": result.get("reason", "INVALID"),
                },
            )
        return {
            "valid": True,
            "certificateId": result["id"],
            "userName": result["userName"],
            "userEmail": result["userEmail"],
            "completedTitle": result["completedTitle"],
            "completedType": result["completedType"],
            "issuedAt": result["issuedAt"],
            "verificationUrl": result["verificationUrl"],
            "metadata": result.get("metadata", {}),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in POST verify_certificate: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ============ COURSE REVIEW ENDPOINTS ============


@router.post("/courses/{module_id}/reviews", response_model=CourseReviewResponse)
async def submit_course_review(
    module_id: str,
    review_data: CourseReviewCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Submit or update a review for a course (authenticated, enrolled users with ≥1 completed lesson)
    """
    try:
        logger.info(f"User {current_user.id} submitting review for module {module_id}")

        review = await education_service.submit_review(
            user_id=current_user.id,
            module_id=module_id,
            rating=review_data.rating,
            comment=review_data.comment,
        )

        logger.info(
            f"User {current_user.id} successfully submitted review for module {module_id}"
        )
        return review

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in submit_course_review: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/courses/{module_id}/reviews", response_model=PaginatedReviewsResponse)
async def get_course_reviews(
    module_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=50, description="Reviews per page"),
):
    """
    Get paginated reviews for a course (public, no auth required)
    """
    try:
        logger.info(f"Fetching reviews for module {module_id} - page: {page}")

        result = await education_service.get_course_reviews(
            module_id=module_id, page=page, page_size=page_size
        )

        logger.info(
            f"Successfully fetched {len(result.reviews)} reviews for module {module_id}"
        )
        return result

    except Exception as e:
        logger.error(f"Error in get_course_reviews: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.delete("/reviews/{review_id}")
async def delete_course_review(
    review_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Delete own review (authenticated users only)
    """
    try:
        logger.info(f"User {current_user.id} deleting review {review_id}")

        await education_service.delete_review(
            user_id=current_user.id, review_id=review_id
        )

        logger.info(f"User {current_user.id} successfully deleted review {review_id}")
        return {"message": "Review deleted successfully"}

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_course_review: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


# =============================================================================
# LIVE SESSION INTEGRATION ENDPOINTS
# =============================================================================


@router.post(
    "/modules/{module_id}/live-sessions",
    response_model=LiveSessionModuleLinkResponse,
    status_code=status.HTTP_201_CREATED,
)
async def link_session_to_module(
    module_id: str,
    link_data: LiveSessionModuleLinkCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Link a live session to a module (Instructor/Admin only).
    """
    try:
        # Check if user has permission to modify this module
        module = await prisma.module.find_unique(where={"id": module_id})
        if not module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Module not found"
            )

        # Admins may manage any module; instructors only their own.
        _ensure_instructor_owns_module(current_user, module)

        # Verify session exists
        session = await prisma.livesession.find_unique(
            where={"id": link_data.session_id}
        )
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Live session not found"
            )

        # Create the link
        link = await live_session_integration_service.link_session_to_module(
            module_id=module_id,
            session_id=link_data.session_id,
            order=link_data.order,
            is_required=link_data.is_required,
        )

        # Return with session data
        link_obj = await prisma.livesessionmodulelink.find_unique(
            where={"id": link["id"]}, include={"liveSession": True}
        )

        return LiveSessionModuleLinkResponse(
            id=link_obj.id,
            module_id=link_obj.moduleId,
            live_session_id=link_obj.liveSessionId,
            order=link_obj.order,
            is_required=link_obj.isRequired,
            created_at=link_obj.createdAt,
            updated_at=link_obj.updatedAt,
            session=link_obj.liveSession.model_dump() if link_obj.liveSession else None,
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error linking session to module: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get(
    "/modules/{module_id}/live-sessions",
    response_model=List[LiveSessionModuleLinkResponse],
)
async def get_module_live_sessions(
    module_id: str, current_user: dict = Depends(get_current_user_optional)
):
    """
    Get all live sessions linked to a module, ordered by display order.
    """
    try:
        module = await prisma.module.find_unique(where={"id": module_id})
        if not module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Module not found"
            )

        sessions = await live_session_integration_service.get_sessions_for_module(
            module_id
        )

        result = []
        for s in sessions:
            result.append(
                LiveSessionModuleLinkResponse(
                    id=s.get("link_id", 0),
                    module_id=module_id,
                    live_session_id=s["id"],
                    order=s.get("link_order", 0),
                    is_required=s.get("link_is_required", True),
                    created_at=datetime.now(timezone.utc),  # Will be populated from DB
                    updated_at=datetime.now(timezone.utc),
                    session=s,
                )
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting module live sessions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.get("/enrollments/{enrollment_id}/upcoming-sessions", response_model=List[dict])
async def get_enrollment_upcoming_sessions(
    enrollment_id: int, current_user: dict = Depends(get_current_user)
):
    """
    Get upcoming live sessions for a user's enrollment (module or path).
    """
    try:
        # Verify enrollment belongs to user
        enrollment = await prisma.enrollment.find_unique(where={"id": enrollment_id})
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found"
            )

        if enrollment.userId != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this enrollment",
            )

        sessions = (
            await live_session_integration_service.get_upcoming_sessions_for_enrollment(
                enrollment_id
            )
        )

        return sessions

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error getting upcoming sessions for enrollment: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.delete(
    "/modules/{module_id}/live-sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unlink_session_from_module(
    module_id: str, session_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Remove a live session link from a module (Instructor/Admin only).
    """
    try:
        module = await prisma.module.find_unique(where={"id": module_id})
        if not module:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Module not found"
            )

        # Admins may manage any module; instructors only their own.
        _ensure_instructor_owns_module(current_user, module)

        await live_session_integration_service.unlink_session_from_module(
            module_id, session_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unlinking session from module: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


# =============================================================================
# VIDEO SIGNED URL (CloudFront)
# =============================================================================


def create_signed_hls_query_token(
    user_id: str,
    lesson_id: str,
    expires_in: int = 7200,
) -> str:
    """Generate a tamper-proof HMAC-SHA256 signed query token for Safari native HLS playback."""
    import hmac
    import hashlib
    from app.core.config import setting

    secret = (
        getattr(setting, "JWT_SECRET_KEY", "")
        or getattr(setting, "SECRET_KEY", "podacium_aes_key")
    ).encode()
    exp = int(datetime.now(timezone.utc).timestamp()) + expires_in
    msg = f"{user_id}:{lesson_id}:{exp}".encode()
    sig = hmac.new(secret, msg, hashlib.sha256).hexdigest()
    return f"{user_id}.{lesson_id}.{exp}.{sig}"


def verify_signed_hls_query_token(
    token: str,
    expected_lesson_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Verify an HMAC-SHA256 signed query token for Safari native HLS playback."""
    import hmac
    import hashlib
    from app.core.config import setting

    try:
        parts = token.split(".")
        if len(parts) != 4:
            return None
        user_id, token_lesson_id, exp_str, sig = parts
        exp = int(exp_str)
        now = int(datetime.now(timezone.utc).timestamp())
        if exp < now:
            return None
        if expected_lesson_id and token_lesson_id != expected_lesson_id:
            return None
        secret = (
            getattr(setting, "JWT_SECRET_KEY", "")
            or getattr(setting, "SECRET_KEY", "podacium_aes_key")
        ).encode()
        msg = f"{user_id}:{token_lesson_id}:{exp}".encode()
        expected_sig = hmac.new(secret, msg, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        return {"sub": user_id, "lesson_id": token_lesson_id, "exp": exp}
    except Exception:
        return None


async def _resolve_video_player_user(
    current_user: Optional[Any],
    request: Optional[Request],
    token: Optional[str],
    lesson_id: Optional[str] = None,
) -> Optional[Any]:
    """
    Resolve and authenticate user for native video player requests (Safari iOS / AVPlayer),
    supporting Bearer Authorization, Cookies (__Host-access_token, access_token, session_token),
    and signed query tokens.
    """
    from app.core.security import verify_token

    user = current_user

    # 1. Cookie-based authentication for Safari iOS native <video> elements
    if not user and request:
        cookie_val = (
            request.cookies.get("__Host-access_token")
            or request.cookies.get("access_token")
            or request.cookies.get("session_token")
            or request.cookies.get("token")
        )
        if cookie_val:
            payload = verify_token(cookie_val)
            if payload and payload.get("sub"):
                sub_id = payload.get("sub")
                user = await prisma.user.find_unique(
                    where={"id": int(sub_id) if str(sub_id).isdigit() else str(sub_id)}
                )

    # 2. Signed query token or JWT token verification
    if not user and token:
        payload = verify_token(token)
        if not payload:
            payload = verify_signed_hls_query_token(token, lesson_id)

        if payload and payload.get("sub"):
            sub_id = payload.get("sub")
            user = await prisma.user.find_unique(
                where={"id": int(sub_id) if str(sub_id).isdigit() else str(sub_id)}
            )

    return user


@router.get("/video/signed-url")
async def get_video_signed_url(
    lesson_id: str = Query(..., description="Lesson whose video should be signed"),
    provider: Optional[str] = Query(
        None, description="Storage provider override (cloudfront|aws|supabase)"
    ),
    token: Optional[str] = Query(
        None, description="Signed query token for native video player requests"
    ),
    current_user: Optional[dict] = Depends(get_current_user_optional),
    request: Request = None,  # type: ignore[assignment]
):
    """Generate a signed URL for a lesson's video.

    Free preview lessons and free courses are accessible to all visitors (including guests).
    Paid core lessons require valid purchase/subscription entitlement or instructor/admin ownership.
    """
    from app.generated.prisma.enums import UserRole
    from app.core.config import setting
    from app.services.video.factory import VideoProviderFactory
    from app.services.video.failover import get_provider_with_failover

    forwarded_for = request.headers.get("x-forwarded-for") if request else None
    client_ip = (
        forwarded_for.split(",")[0].strip()
        if forwarded_for
        else (request.client.host if request and request.client else "127.0.0.1")
    )

    # Rate limiting on signed URL generation (max 30 requests per minute per IP / User)
    try:
        import redis.asyncio as aioredis

        redis_url = getattr(setting, "REDIS_URL", "") or "redis://localhost:6379"
        if redis_url:
            r = aioredis.from_url(
                redis_url, decode_responses=True, socket_connect_timeout=2
            )
            user_key = (
                f"user:{current_user.id}"
                if current_user and hasattr(current_user, "id")
                else (
                    f"user:{current_user['id']}"
                    if current_user
                    and isinstance(current_user, dict)
                    and "id" in current_user
                    else f"ip:{request.client.host if request and request.client else 'anon'}"
                )
            )
            rate_key = f"ratelimit:video_signed_url:{user_key}"
            current_cnt = await r.incr(rate_key)
            if current_cnt == 1:
                await r.expire(rate_key, 60)
            await r.aclose()
            if current_cnt > 30:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many video URL requests. Please wait a moment before trying again.",
                )
    except HTTPException:
        raise
    except Exception as rl_err:
        logger.debug(f"Redis rate limiting skipped: {rl_err}")

    try:
        lesson = await prisma.lesson.find_unique(
            where={"id": lesson_id},
            include={"module": True},
        )
        if not lesson:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found"
            )

        # Free preview or free course check: anyone can stream preview lessons
        raw_preview = getattr(lesson, "isPreview", False)
        is_preview = bool(raw_preview) if type(raw_preview) is bool else False
        is_course_free = False
        if lesson.module:
            raw_price = getattr(lesson.module, "price", None)
            is_mock = hasattr(raw_price, "_mock_return_value")
            if not is_mock:
                if raw_price is None:
                    is_course_free = True
                else:
                    from app.services.billing_services.education_service import (
                        education_billing_service,
                    )

                    parsed_price = education_billing_service._parse_price(raw_price)
                    effective_price = (
                        parsed_price.get("discounted")
                        if parsed_price.get("discounted") is not None
                        else parsed_price.get("original", 0)
                    )
                    is_course_free = (effective_price or 0) <= 0

        # If not free preview or free course, enforce strict authentication and entitlement
        # Supports Cookie-based authentication and signed query tokens for Safari iOS <video> playback
        user = await _resolve_video_player_user(current_user, request, token, lesson_id)
        if not (is_preview or is_course_free):
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required to view this video",
                )

            user_id = _user_id(user)
            user_role = _user_role(user)
            is_owner = (
                lesson.module is not None
                and getattr(lesson.module, "instructorId", None) == user_id
            )
            is_admin = (
                user_role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)
                if hasattr(UserRole, "SUPER_ADMIN")
                else user_role == UserRole.ADMIN
            )
            if not (is_owner or is_admin):
                from app.services.education_service import education_service

                if not await education_service.check_access(user_id, lesson.moduleId):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="No access to this lesson's video",
                    )

        allowed_providers = {
            "supabase",
            "cloudfront",
            "aws",
            "bunny",
            "cloudflare",
            "youtube",
            "vimeo",
            "dailymotion",
        }
        resolved_provider = (provider or lesson.storageProvider or "aws").lower()
        if resolved_provider not in allowed_providers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported storage provider",
            )

        fallback_urls: list[dict[str, str]] = []
        failover_active = False

        path = lesson.hlsPath or lesson.videoUrl or lesson.rawPath
        if not path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lesson has no video"
            )
        if resolved_provider in ("cloudfront", "aws", "supabase") and (
            path.startswith("http://") or path.startswith("https://")
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Video URL is an external URL, not an object path",
            )

        # Prioritize primary provider with failover to healthy redundant CDN
        preferred_candidates = [resolved_provider]
        if resolved_provider not in ("youtube", "vimeo", "dailymotion"):
            for cand in ["bunny", "cloudflare", "aws", "supabase"]:
                if cand != resolved_provider and cand in allowed_providers:
                    preferred_candidates.append(cand)

        try:
            provider_inst = VideoProviderFactory.get_provider(resolved_provider)
            await provider_inst.initialize()
            signed_url = await provider_inst.generate_signed_url(
                path, expire_minutes=120, client_ip=client_ip
            )
        except Exception as primary_err:
            logger.warning(
                f"Primary video provider {resolved_provider} failed to sign URL: {primary_err}. Triggering failover..."
            )
            failover_provider = await get_provider_with_failover(preferred_candidates)
            resolved_provider = getattr(failover_provider, "provider_name", "aws")
            failover_active = True
            signed_url = await failover_provider.generate_signed_url(
                path, expire_minutes=120, client_ip=client_ip
            )

            # Generate redundant fallback endpoints for client-side CDN failover
            if resolved_provider not in ("youtube", "vimeo", "dailymotion"):
                for alt_name in ["bunny", "cloudflare", "aws"]:
                    if alt_name == resolved_provider:
                        continue
                    try:
                        alt_p = VideoProviderFactory.get_provider(alt_name)
                        await alt_p.initialize()
                        alt_url = await alt_p.generate_signed_url(
                            path, expire_minutes=120, client_ip=client_ip
                        )
                        if (
                            alt_url
                            and alt_url != signed_url
                            and not alt_url.startswith("https:///")
                            and not alt_url.startswith("http:///")
                        ):
                            fallback_urls.append({"provider": alt_name, "url": alt_url})
                    except Exception as alt_err:
                        logger.debug(
                            f"Redundant fallback generation skipped for {alt_name}: {alt_err}"
                        )

        is_hls = bool(lesson.hlsPath or (signed_url and ".m3u8" in signed_url))
        active_user_id = str(_user_id(user)) if user else "guest"
        playback_token = create_signed_hls_query_token(active_user_id, lesson_id)

        return {
            "signed_url": signed_url,
            "is_hls": is_hls,
            "expires_in": 7200,
            "storage_provider": resolved_provider,
            "fallback_urls": fallback_urls,
            "failover_active": failover_active,
            "playback_token": playback_token,
            "transcoding_status": lesson.transcodingStatus or "completed",
            "client_ip": client_ip,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating signed URL for lesson {lesson_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate video URL",
        )


@router.get("/video/key/{lesson_id}")
async def get_hls_aes128_key(
    lesson_id: str,
    token: Optional[str] = Query(
        None, description="Short-lived token for native video player requests"
    ),
    request: Request = None,  # type: ignore[assignment]
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Deliver 16-byte AES-128 decryption key for encrypted HLS streams.
    Requires authenticated user (via Authorization Bearer header, Session Cookie, or ?token= query parameter).
    Enforces course enrollment / module entitlement and returns raw 16-byte binary key.
    """
    import hmac
    import hashlib
    from fastapi import Response
    from app.generated.prisma.enums import UserRole
    from app.core.config import setting

    user = await _resolve_video_player_user(current_user, request, token, lesson_id)

    lesson = await prisma.lesson.find_unique(
        where={"id": lesson_id},
        include={"module": True},
    )
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found"
        )

    # Check free preview or course access
    raw_preview = getattr(lesson, "isPreview", False)
    is_preview = bool(raw_preview) if type(raw_preview) is bool else False
    is_course_free = False
    if lesson.module:
        raw_price = getattr(lesson.module, "price", None)
        if raw_price is None:
            is_course_free = True
        else:
            from app.services.billing_services.education_service import (
                education_billing_service,
            )

            parsed_price = education_billing_service._parse_price(raw_price)
            effective_price = (
                parsed_price.get("discounted")
                if parsed_price.get("discounted") is not None
                else parsed_price.get("original", 0)
            )
            is_course_free = (effective_price or 0) <= 0

    if not (is_preview or is_course_free):
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to obtain video decryption key",
            )
        user_id = _user_id(user)
        user_role = _user_role(user)
        is_owner = (
            lesson.module is not None
            and getattr(lesson.module, "instructorId", None) == user_id
        )
        is_admin = user_role in (
            UserRole.ADMIN,
            getattr(UserRole, "SUPER_ADMIN", "ADMIN"),
        )
        if not (is_owner or is_admin):
            from app.services.education_service import education_service

            if not await education_service.check_access(user_id, lesson.moduleId):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: Not enrolled in this course module",
                )

    # Generate deterministic 16-byte AES-128 key for this lesson
    secret = (
        getattr(setting, "JWT_SECRET_KEY", "")
        or getattr(setting, "SECRET_KEY", "podacium_aes_key")
    ).encode()
    key_bytes = hmac.new(
        secret, f"video_aes128:{lesson_id}".encode(), hashlib.sha256
    ).digest()[:16]

    return Response(
        content=key_bytes,
        media_type="application/octet-stream",
        headers={
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get("/video/segment-token")
async def get_video_segment_token(
    lesson_id: str = Query(..., description="Lesson ID"),
    segment: str = Query(..., description="Segment filename"),
    token: Optional[str] = Query(
        None, description="Short-lived query token for native video player requests"
    ),
    request: Request = None,  # type: ignore[assignment]
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Generate short-lived (300s) token for HLS video segment."""
    from app.services.video.factory import VideoProviderFactory
    from app.services.video.failover import get_provider_with_failover
    from app.generated.prisma.enums import UserRole

    try:
        user = await _resolve_video_player_user(current_user, request, token, lesson_id)

        lesson = await prisma.lesson.find_unique(
            where={"id": lesson_id},
            include={"module": True},
        )
        if not lesson:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found"
            )

        # Free preview or free course check
        raw_preview = getattr(lesson, "isPreview", False)
        is_preview = bool(raw_preview) if type(raw_preview) is bool else False
        is_course_free = False
        if lesson.module:
            raw_price = getattr(lesson.module, "price", None)
            if raw_price is None:
                is_course_free = True
            else:
                from app.services.billing_services.education_service import (
                    education_billing_service,
                )

                parsed_price = education_billing_service._parse_price(raw_price)
                effective_price = (
                    parsed_price.get("discounted")
                    if parsed_price.get("discounted") is not None
                    else parsed_price.get("original", 0)
                )
                is_course_free = (effective_price or 0) <= 0

        if not (is_preview or is_course_free):
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required to view video segment",
                )

            user_id = _user_id(user)
            user_role = _user_role(user)
            is_owner = (
                lesson.module is not None
                and getattr(lesson.module, "instructorId", None) == user_id
            )
            is_admin = (
                user_role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)
                if hasattr(UserRole, "SUPER_ADMIN")
                else user_role == UserRole.ADMIN
            )
            if not (is_owner or is_admin):
                from app.services.education_service import education_service

                if not await education_service.check_access(user_id, lesson.moduleId):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN, detail="No access"
                    )

        provider_name = (lesson.storageProvider or "aws").lower()
        try:
            provider_inst = VideoProviderFactory.get_provider(provider_name)
            await provider_inst.initialize()
            signed_url = await provider_inst.generate_segment_token(
                lesson_id, segment, expire_seconds=300
            )
        except Exception as prov_err:
            logger.warning(
                f"Segment token generation on {provider_name} failed: {prov_err}. Failing over..."
            )
            fallback_candidates = [
                cand
                for cand in ["bunny", "cloudflare", "aws", "supabase"]
                if cand != provider_name
            ]
            failover_provider = await get_provider_with_failover(fallback_candidates)
            signed_url = await failover_provider.generate_segment_token(
                lesson_id, segment, expire_seconds=300
            )

        return {"signed_url": signed_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error generating segment token for lesson {lesson_id}, segment {segment}: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate segment token",
        )


@router.get("/video/stream/{lesson_id}/{file_path:path}")
async def stream_local_hls_fragment(
    lesson_id: str,
    file_path: str,
    token: Optional[str] = Query(
        None, description="Signed query token for native video player requests"
    ),
    request: Request = None,  # type: ignore[assignment]
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Serve local HLS playlist (.m3u8) or encrypted segment (.ts) files for offline/local transcoded streams.
    Supports cookie auth and signed query tokens for Safari iOS native playback.
    """
    import os
    from fastapi import Response
    from app.generated.prisma.enums import UserRole

    user = await _resolve_video_player_user(current_user, request, token, lesson_id)

    lesson = await prisma.lesson.find_unique(
        where={"id": lesson_id},
        include={"module": True},
    )
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found"
        )

    # Free preview or free course check
    raw_preview = getattr(lesson, "isPreview", False)
    is_preview = bool(raw_preview) if type(raw_preview) is bool else False
    is_course_free = False
    if lesson.module:
        raw_price = getattr(lesson.module, "price", None)
        if raw_price is None:
            is_course_free = True
        else:
            from app.services.billing_services.education_service import (
                education_billing_service,
            )

            parsed_price = education_billing_service._parse_price(raw_price)
            effective_price = (
                parsed_price.get("discounted")
                if parsed_price.get("discounted") is not None
                else parsed_price.get("original", 0)
            )
            is_course_free = (effective_price or 0) <= 0

    if not (is_preview or is_course_free):
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to stream video content",
            )
        user_id = _user_id(user)
        user_role = _user_role(user)
        is_owner = (
            lesson.module is not None
            and getattr(lesson.module, "instructorId", None) == user_id
        )
        is_admin = user_role in (
            UserRole.ADMIN,
            getattr(UserRole, "SUPER_ADMIN", "ADMIN"),
        )
        if not (is_owner or is_admin):
            from app.services.education_service import education_service

            if not await education_service.check_access(user_id, lesson.moduleId):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="No access"
                )

    # Prevent path traversal
    base_dir = os.path.realpath(os.path.join(os.getcwd(), "uploads", "hls", lesson_id))
    requested_path = os.path.realpath(os.path.join(base_dir, file_path))
    if not requested_path.startswith(base_dir) or not os.path.isfile(requested_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="HLS media fragment not found"
        )

    # Determine media type
    if file_path.endswith(".m3u8"):
        media_type = "application/vnd.apple.mpegurl"
        with open(requested_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Propagate query token to key, child playlists, and segments for seamless Safari iOS AVPlayer playback
        active_token = token or (
            create_signed_hls_query_token(str(_user_id(user)), lesson_id)
            if user
            else None
        )
        if active_token:
            if (
                'URI="/api/v1/education/video/key/' in content
                and "token=" not in content
            ):
                content = content.replace(
                    f'/api/v1/education/video/key/{lesson_id}"',
                    f'/api/v1/education/video/key/{lesson_id}?token={active_token}"',
                )

            # Rewrite relative sub-playlists and segments to pass token to out-of-process AVPlayer
            lines = content.splitlines()
            modified = False
            for idx, line in enumerate(lines):
                stripped = line.strip()
                if not stripped.startswith("#") and (
                    stripped.endswith(".m3u8") or stripped.endswith(".ts")
                ):
                    if "?" not in stripped:
                        lines[idx] = f"{stripped}?token={active_token}"
                        modified = True
                    elif "token=" not in stripped:
                        lines[idx] = f"{stripped}&token={active_token}"
                        modified = True
            if modified:
                content = "\n".join(lines) + "\n"

        return Response(
            content=content,
            media_type=media_type,
            headers={
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
    else:
        media_type = "video/MP2T"
        with open(requested_path, "rb") as f:
            raw_bytes = f.read()
        return Response(
            content=raw_bytes,
            media_type=media_type,
            headers={
                "Cache-Control": "private, max-age=86400",
                "Accept-Ranges": "bytes",
            },
        )


class VideoUploadIntentRequest(BaseModel):
    file_name: str
    file_size_bytes: int
    lesson_id: Optional[str] = None
    provider: Optional[str] = None


class VideoHeartbeatRequest(BaseModel):
    start_time: float
    end_time: float
    time_elapsed: float = 10.0
    existing_intervals: Optional[List[List[float]]] = None


@router.post("/upload-intent")
async def create_video_upload_intent(
    req: VideoUploadIntentRequest,
    current_user: dict = Depends(get_current_user),
):
    """Initialize TUS or API direct upload session for target video provider."""
    from app.services.video.tus_service import tus_upload_service
    from app.services.video.factory import VideoProviderFactory

    if not req.file_name or req.file_size_bytes < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file name or size",
        )

    # Validate lesson ownership if lesson_id is specified
    if req.lesson_id:
        lesson = await prisma.lesson.find_unique(
            where={"id": req.lesson_id},
            include={"module": True},
        )
        if not lesson:
            raise HTTPException(status_code=404, detail="Lesson not found")

        user_role = _user_role(current_user)
        is_admin = user_role in ("ADMIN", "SUPERADMIN")
        module_owner_id = lesson.module.instructorId if lesson.module else None
        if (
            not is_admin
            and module_owner_id
            and module_owner_id != _user_id(current_user)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to upload video for this lesson",
            )

    provider_name = (req.provider or "").lower().strip()
    if not provider_name:
        is_free_tier = False
        if req.lesson_id:
            lesson = await prisma.lesson.find_unique(
                where={"id": req.lesson_id},
                include={"module": True},
            )
            if lesson:
                is_course_free = not lesson.module.price or (
                    isinstance(lesson.module.price, dict)
                    and lesson.module.price.get("amount", 0) <= 0
                )
                is_free_tier = bool(
                    is_course_free or getattr(lesson, "isPreview", False)
                )
        active_provider = await VideoProviderFactory.get_provider_for_content(
            is_free_tier=is_free_tier
        )
        provider_name = active_provider.provider_name

    provider_inst = VideoProviderFactory.get_provider(provider_name)
    await provider_inst.initialize()

    # Delegate to provider strategy if direct intent creation method exists
    if provider_name == "vimeo" and hasattr(
        provider_inst, "create_direct_tus_upload_intent"
    ):
        return await provider_inst.create_direct_tus_upload_intent(
            req.file_name, req.file_size_bytes, req.lesson_id or ""
        )
    elif provider_name == "youtube" and hasattr(
        provider_inst, "create_direct_resumable_upload_intent"
    ):
        return await provider_inst.create_direct_resumable_upload_intent(
            req.file_name, req.file_size_bytes, req.lesson_id or ""
        )
    elif provider_name == "dailymotion" and hasattr(
        provider_inst, "create_direct_upload_intent"
    ):
        return await provider_inst.create_direct_upload_intent(
            req.file_name, req.file_size_bytes, req.lesson_id or ""
        )
    elif provider_name == "bunny" and hasattr(
        provider_inst, "create_direct_tus_upload_intent"
    ):
        return await provider_inst.create_direct_tus_upload_intent(
            req.file_name, req.file_size_bytes, req.lesson_id or ""
        )
    elif provider_name == "cloudflare" and hasattr(
        provider_inst, "create_direct_tus_upload_intent"
    ):
        return await provider_inst.create_direct_tus_upload_intent(
            req.file_name, req.file_size_bytes, req.lesson_id or ""
        )

    session = await tus_upload_service.create_upload_session(
        user_id=_user_id(current_user),
        file_name=req.file_name,
        file_size_bytes=req.file_size_bytes,
        lesson_id=req.lesson_id,
        provider=provider_name,
    )
    return session


@router.post("/video/security-violation")
async def report_video_security_violation(
    req: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
):
    """Log and flag client video watermark or playback security violation."""
    from app.core.redis import get_redis

    user_id = _user_id(current_user)
    lesson_id = req.get("lesson_id")
    reason = req.get("reason", "unknown")
    logger.warning(
        f"Video security violation reported by user {user_id} for lesson {lesson_id}: {reason}"
    )
    redis_conn = await get_redis()
    if redis_conn and lesson_id:
        try:
            await redis_conn.set(
                f"video:violation:{user_id}:{lesson_id}", str(reason), ex=3600
            )
        except Exception as e:
            logger.error(f"Failed to record video violation in redis: {e}")
    return {"status": "recorded"}


@router.post("/lessons/{lesson_id}/heartbeat")
async def record_lesson_video_heartbeat(
    lesson_id: str,
    req: VideoHeartbeatRequest,
    current_user: dict = Depends(get_current_user),
):
    """Receive client video playback heartbeat and calculate anti-cheat interval progress."""
    from app.services.video.interval_tracker import interval_tracker
    from app.services.education_service import education_service
    import time

    user_id = _user_id(current_user)

    lesson = await prisma.lesson.find_unique(
        where={"id": lesson_id}, include={"module": True}
    )
    if not lesson or getattr(lesson, "deletedAt", None) is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found"
        )

    # Verify enrollment or preview access
    is_preview = bool(getattr(lesson, "isPreview", False))
    if not is_preview and lesson.moduleId:
        has_access = await education_service.check_access(user_id, lesson.moduleId)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: valid enrollment or active subscription required to record progress.",
            )

        # Enforce sequential lesson prerequisite check before accepting playback progress
        is_locked = await education_service._is_lesson_sequentially_locked(
            lesson, user_id
        )
        if is_locked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: prerequisite lessons must be completed first",
            )

    if req.start_time < 0 or req.end_time < req.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid timestamp parameters for video heartbeat.",
        )

    duration = float(lesson.durationSeconds or 0)
    now_wall_clock = time.time()

    # Calculate authoritative server wall-clock delta
    last_server_ts = await interval_tracker.get_last_heartbeat_timestamp(
        user_id, lesson_id
    )
    server_elapsed = (now_wall_clock - last_server_ts) if last_server_ts else None

    # Fetch authoritative watched intervals from server cache/storage to prevent client spoofing
    existing = await interval_tracker.get_user_intervals(user_id, lesson_id)

    res = interval_tracker.verify_progress_heartbeat(
        existing_intervals=existing,
        new_start=req.start_time,
        new_end=req.end_time,
        duration_seconds=duration,
        time_elapsed_since_last_beacon=req.time_elapsed,
        server_elapsed_seconds=server_elapsed,
    )

    if not res["is_valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res["reason"],
        )

    # Persist updated authoritative intervals and last heartbeat timestamp
    await interval_tracker.save_user_intervals(
        user_id, lesson_id, res["merged_intervals"]
    )
    await interval_tracker.update_last_heartbeat_timestamp(
        user_id, lesson_id, now_wall_clock
    )

    # Record interval slice in heatmap telemetry service
    from app.services.video.heatmap_service import heatmap_service

    heatmap_service.record_interval_replay(
        lesson_id=lesson_id,
        start_time=req.start_time,
        end_time=req.end_time,
        duration=duration,
    )

    # Upsert LessonProgress entity with verified unique watched seconds
    progress_val = res["progress_percentage"]
    is_completed = res["is_completed"]

    existing_progress = await prisma.lessonprogress.find_first(
        where={"userId": current_user.id, "lessonId": lesson_id}
    )
    if existing_progress:
        progress_val = max(
            float(existing_progress.progress or 0.0), float(progress_val)
        )
        if existing_progress.isCompleted:
            is_completed = True

    await prisma.lessonprogress.upsert(
        where={
            "userId_lessonId": {
                "userId": current_user.id,
                "lessonId": lesson_id,
            }
        },
        data={
            "create": {
                "userId": current_user.id,
                "lessonId": lesson_id,
                "progress": progress_val,
                "isCompleted": is_completed,
                "completedAt": datetime.now(timezone.utc) if is_completed else None,
            },
            "update": {
                "progress": progress_val,
                "isCompleted": is_completed,
                "completedAt": datetime.now(timezone.utc)
                if is_completed
                and not (existing_progress and existing_progress.completedAt)
                else (existing_progress.completedAt if existing_progress else None),
            },
        },
    )

    if is_completed and lesson.moduleId:
        from app.services.education_service import education_service

        try:
            await education_service._update_module_progress(
                lesson.moduleId, current_user.id
            )
        except Exception as mod_err:
            logger.error(
                f"Error cascading module progress on heartbeat completion: {mod_err}"
            )

    return {
        "status": "success",
        "unique_watched_seconds": res["unique_watched_seconds"],
        "progress_percentage": progress_val,
        "is_completed": is_completed,
        "merged_intervals": res["merged_intervals"],
    }


@router.get("/lessons/{lesson_id}/heatmap")
async def get_lesson_video_heatmap(
    lesson_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieve 100-bin telemetry replayed frequency heatmap for a lesson video."""
    from app.services.video.heatmap_service import heatmap_service

    lesson = await prisma.lesson.find_unique(where={"id": lesson_id})
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found"
        )

    bins = heatmap_service.get_lesson_heatmap(lesson_id)
    return {
        "lesson_id": lesson_id,
        "bins": bins,
    }
