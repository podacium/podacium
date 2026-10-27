"""
Initial data and lightweight user endpoints.

These endpoints are performance-optimized to reduce frontend waterfall requests.
Moved from main.py to maintain clean architecture.
"""

import asyncio
import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, EmailStr

from app.core.auth import get_current_user
from app.core.prisma import prisma

router = APIRouter()
logger = logging.getLogger(__name__)


# =============================================================================
# SCHEMAS
# =============================================================================


class LightUserResponse(BaseModel):
    id: int
    email: str
    fullName: str
    role: str
    emailVerified: bool
    profilePictureUrl: Optional[str]
    phoneVerified: bool
    onboardingCompleted: bool


class UserDashboardData(BaseModel):
    user: Dict[str, Any]
    skills: List[Dict[str, Any]]
    dashboard: Dict[str, Any]
    enrollments: List[Dict[str, Any]]
    notifications: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    recentActivity: List[Dict[str, Any]]


class CheckEmailRequest(BaseModel):
    email: EmailStr


class CheckEmailResponse(BaseModel):
    available: bool
    email: str


# =============================================================================
# ENDPOINTS
# =============================================================================


@router.get("/auth/me-light", response_model=LightUserResponse)
async def get_current_user_light(
    response: Response,
    current_user=Depends(get_current_user),
):
    """Lightweight user endpoint with only essential data."""
    try:
        from app.core.security import set_session_cookie

        set_session_cookie(response, current_user.id, current_user.role)
    except Exception:
        pass

    return LightUserResponse(
        id=current_user.id,
        email=current_user.email,
        fullName=current_user.fullName,
        role=current_user.role,
        emailVerified=current_user.emailVerified,
        profilePictureUrl=current_user.profilePictureUrl,
        phoneVerified=current_user.phoneVerified,
        onboardingCompleted=current_user.onboardingCompleted,
    )


@router.get("/user/initial-data", response_model=UserDashboardData)
async def get_initial_data(
    response: Response,
    current_user=Depends(get_current_user),
):
    """
    Get all initial data in one request to prevent sequential loading.
    Replaces multiple API calls from the frontend.
    """
    try:
        from app.core.security import set_session_cookie

        set_session_cookie(response, current_user.id, current_user.role)
    except Exception:
        pass

    user_id = current_user.id

    results = await asyncio.gather(
        _get_user_light_data(user_id),
        _get_user_skills(user_id),
        _get_dashboard_data(user_id),
        _get_user_enrollments(user_id),
        _get_user_notifications(user_id),
        _get_recent_activity(user_id),
        _get_recommendations(user_id),
        return_exceptions=True,
    )

    user_data = results[0] if not isinstance(results[0], Exception) else {}
    skills_data = results[1] if not isinstance(results[1], Exception) else []
    dashboard_data = results[2] if not isinstance(results[2], Exception) else {}
    enrollments_data = results[3] if not isinstance(results[3], Exception) else []
    notifications_data = results[4] if not isinstance(results[4], Exception) else {}
    recent_activity = results[5] if not isinstance(results[5], Exception) else []
    recommendations = results[6] if not isinstance(results[6], Exception) else []

    return UserDashboardData(
        user=user_data,
        skills=skills_data,
        dashboard=dashboard_data,
        enrollments=enrollments_data,
        notifications=notifications_data,
        recentActivity=recent_activity,
        recommendations=recommendations,
    )


@router.post("/auth/check-email", response_model=CheckEmailResponse)
async def check_email(payload: CheckEmailRequest):
    """Check if an email is available for registration.

    SECURITY: Rate-limited to prevent email enumeration. Does NOT reveal
    whether an email is already registered — always returns available=true
    to prevent attackers from discovering registered accounts via this endpoint.
    Registration will report conflicts natively.
    """
    email = payload.email.strip().lower()
    # Always return available=true regardless of actual registration status.
    # This prevents email enumeration while still allowing the frontend to
    # validate email format before form submission.
    return CheckEmailResponse(available=True, email=email)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


async def _get_user_light_data(user_id: int) -> Dict[str, Any]:
    user = await prisma.user.find_unique(
        where={"id": user_id},
    )
    if not user:
        return {}
    return {
        "id": user.id,
        "email": user.email,
        "fullName": user.fullName,
        "role": user.role,
        "emailVerified": user.emailVerified,
        "profilePictureUrl": user.profilePictureUrl,
        "phoneVerified": user.phoneVerified,
        "bio": user.bio,
        "city": user.city,
        "country": user.country,
        "createdAt": user.createdAt.isoformat() if user.createdAt else None,
        "lastLoginAt": user.lastLoginAt.isoformat() if user.lastLoginAt else None,
    }


async def _get_user_skills(user_id: int) -> List[Dict[str, Any]]:
    skills = await prisma.userskill.find_many(
        where={"userId": user_id},
    )
    return [{"id": s.id, "name": s.name, "createdAt": str(s.createdAt)} for s in skills]


async def _get_dashboard_data(user_id: int) -> Dict[str, Any]:
    enrolled, completed, skills_count, notif_count = await asyncio.gather(
        prisma.enrollment.count(where={"userId": user_id}),
        prisma.enrollment.count(
            where={"userId": user_id, "completedAt": {"not": None}}
        ),
        prisma.userskill.count(where={"userId": user_id}),
        prisma.notification.count(where={"userId": user_id, "isRead": False}),
        return_exceptions=True,
    )
    return {
        "stats": {
            "enrolledModules": enrolled if not isinstance(enrolled, Exception) else 0,
            "completedModules": completed
            if not isinstance(completed, Exception)
            else 0,
            "skillsCount": skills_count
            if not isinstance(skills_count, Exception)
            else 0,
            "unreadNotifications": notif_count
            if not isinstance(notif_count, Exception)
            else 0,
        },
        "recentActivity": [],
        "recommendations": [],
    }


async def _get_user_enrollments(user_id: int) -> List[Dict[str, Any]]:
    enrollments = await prisma.enrollment.find_many(
        where={"userId": user_id},
        include={"module": True},
        take=10,
        order={"createdAt": "desc"},
    )
    return [
        {
            "id": e.id,
            "progress": e.progress,
            "completed": e.completedAt is not None,
            "enrolledAt": str(e.createdAt),
            "completedAt": str(e.completedAt) if e.completedAt else None,
            "module": {
                "id": e.module.id,
                "title": e.module.title,
                "description": e.module.description,
                "difficulty": e.module.level,
                "duration": e.module.durationMinutes,
                "thumbnailUrl": e.module.thumbnailUrl,
            }
            if e.module
            else None,
        }
        for e in enrollments
    ]


async def _get_user_notifications(user_id: int) -> Dict[str, Any]:
    notifications = await prisma.notification.find_many(
        where={"userId": user_id},
        take=5,
        order={"createdAt": "desc"},
    )
    unread_count = await prisma.notification.count(
        where={"userId": user_id, "isRead": False}
    )
    return {
        "notifications": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "isRead": n.isRead,
                "createdAt": str(n.createdAt),
            }
            for n in notifications
        ],
        "unreadCount": unread_count,
    }


async def _get_recent_activity(user_id: int) -> List[Dict[str, Any]]:
    try:
        lessons = await prisma.lessonprogress.find_many(
            where={"userId": user_id, "isCompleted": True},
            take=5,
            order={"completedAt": "desc"},
            include={"lesson": True},
        )
        return [
            {
                "type": "LESSON_COMPLETE",
                "title": f"Completed: {lp.lesson.title}",
                "date": lp.completedAt.isoformat() if lp.completedAt else "",
                "metadata": {"lessonId": lp.lessonId, "moduleId": lp.lesson.moduleId},
            }
            for lp in lessons
        ][:10]
    except Exception:
        return []


async def _get_recommendations(user_id: int) -> List[Dict[str, Any]]:
    try:
        enrollments = await prisma.enrollment.find_many(
            where={"userId": user_id},
        )
        enrolled_ids = [e.moduleId for e in enrollments if e.moduleId]
        modules = await prisma.module.find_many(
            where={"id": {"notIn": enrolled_ids}, "deletedAt": None},
            take=3,
            order={"createdAt": "desc"},
        )
        return [m.dict() for m in modules]
    except Exception:
        return []
