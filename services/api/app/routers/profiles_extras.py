"""Additional profile endpoints — edit, freelancer, completion, activity, badges."""

import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.core.prisma import prisma
from app.schemas.profiles import (
    ProfileUpdate,
    FreelancerProfileUpdate,
    CredentialCreate,
)
from app.services.profile_service import profile_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="")


# ─── PER-SECTION PRIVACY VISIBILITY ───────────────────────────────────

SECTION_VISIBILITY_FIELDS = {
    "bio_visibility",
    "headline_visibility",
    "tagline_visibility",
    "pronouns_visibility",
    "cover_image_visibility",
    "location_visibility",
    "social_links_visibility",
    "availability_visibility",
    "timezone_visibility",
    "profile_view_count_visibility",
    "last_active_visibility",
    "followers_visibility",
    "following_visibility",
    "badges_visibility",
    "skills_visibility",
    "activity_feed_visibility",
    "username_history_visibility",
}

DEFAULT_VISIBILITY = {f: "public" for f in SECTION_VISIBILITY_FIELDS}


SECTION_FIELD_MAP = {
    "bio_visibility": "showBio",
    "headline_visibility": "showHeadline",
    "tagline_visibility": "showTagline",
    "pronouns_visibility": "showPronouns",
    "cover_image_visibility": "showContactInfo",
    "location_visibility": "showOrganization",
    "social_links_visibility": "showContactInfo",
    "availability_visibility": "showAvailability",
    "timezone_visibility": "showAvailability",
    "profile_view_count_visibility": "showRating",
    "followers_visibility": "showRating",
    "following_visibility": "showRating",
    "badges_visibility": "showCertificates",
    "skills_visibility": "showSkills",
    "activity_feed_visibility": "showReviews",
    "username_history_visibility": "showContactInfo",
}


@router.get("/profiles/me/privacy/sections")
async def get_section_visibilities(current_user=Depends(get_current_user)):
    """Get per-section visibility settings for the current user."""
    privacy = await prisma.privacysettings.find_unique(
        where={"userId": current_user.id}
    )
    result = {}
    for field in SECTION_VISIBILITY_FIELDS:
        prisma_field = SECTION_FIELD_MAP.get(field)
        val = (
            getattr(privacy, prisma_field, "PUBLIC")
            if (privacy and prisma_field)
            else "PUBLIC"
        )
        if val is None:
            val_str = "public"
        elif hasattr(val, "value"):
            val_str = val.value.lower()
        else:
            val_str = str(val).lower()
        result[field] = val_str
    return result


@router.patch("/profiles/me/privacy/sections")
async def update_section_visibilities(
    data: dict, current_user=Depends(get_current_user)
):
    """Update per-section visibility settings for the current user."""
    safe = {k: data[k] for k in SECTION_VISIBILITY_FIELDS if k in data}
    if not safe:
        raise HTTPException(
            status_code=400, detail="No valid visibility fields provided"
        )
    # Validate values
    valid_values = {"public", "followers", "connections", "private", "inherit"}
    for field, value in safe.items():
        if not isinstance(value, str) or value.lower() not in valid_values:
            raise HTTPException(
                status_code=400, detail=f"Invalid value for {field}: {value}"
            )

    prisma_data = {}
    for k, v in safe.items():
        prisma_field = SECTION_FIELD_MAP.get(k)
        if prisma_field:
            prisma_data[prisma_field] = v.upper()

    if prisma_data:
        await prisma.privacysettings.upsert(
            where={"userId": current_user.id},
            data={
                "create": {"userId": current_user.id, **prisma_data},
                "update": prisma_data,
            },
        )

    return await get_section_visibilities(current_user)


# ── CORE PROFILE EDIT ──────────────────────────────────────────────


@router.put("/profiles/me")
async def update_profile(data: ProfileUpdate, current_user=Depends(get_current_user)):
    """Update core profile fields (bio, headline, tagline, pronouns, etc.)"""
    safe = data.model_dump(exclude_none=True)
    if not safe:
        raise HTTPException(status_code=400, detail="No editable fields provided")

    from app.generated.prisma import Json

    if "socialLinks" in safe and safe["socialLinks"] is not None:
        safe["socialLinks"] = Json(safe["socialLinks"])
    if "displayName" in safe and safe["displayName"] is not None:
        safe["displayName"] = Json(safe["displayName"])

    user = await prisma.user.update(where={"id": current_user.id}, data=safe)
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.fullName,
        "bio": user.bio,
        "headline": user.headline,
        "tagline": getattr(user, "tagline", None),
        "pronouns": getattr(user, "pronouns", None),
        "country": user.country,
        "city": user.city,
        "cover_image_url": getattr(user, "coverImageUrl", None),
        "avatar_url": getattr(user, "profilePictureUrl", None),
        "profile_picture_url": getattr(user, "profilePictureUrl", None),
        "social_links": user.socialLinks,
        "skills": getattr(user, "skills", []),
        "availability": getattr(user, "availability", None),
        "phone": getattr(user, "phoneNumber", None),
    }


@router.patch("/profiles/me")
async def patch_profile(data: ProfileUpdate, current_user=Depends(get_current_user)):
    """Partial update of core profile fields (alias for PUT /profiles/me)."""
    return await update_profile(data, current_user)


# ── FREELANCER PROFILE ────────────────────────────────────────────


@router.get("/profiles/{identifier}/freelancer")
async def get_freelancer_profile(identifier: str):
    """Full freelancer profile with rich fields from metadata."""
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    fp = await prisma.freelancerprofile.find_unique(where={"userId": user.id})
    if not fp:
        raise HTTPException(status_code=404, detail="Freelancer profile not found")
    meta = fp.metadata or {}
    return {
        "id": fp.id,
        "user_id": fp.userId,
        "tier": fp.tier,
        "headline": meta.get("headline"),
        "overview": meta.get("overview"),
        "english_level": meta.get("englishLevel"),
        "languages": meta.get("languages", []),
        "hourly_rate": meta.get("hourlyRate"),
        "availability": meta.get("availability", "AVAILABLE"),
        "available_hours_per_week": meta.get("availableHoursPerWeek"),
        "timezone": meta.get("timezone"),
        "job_success_score": meta.get("jobSuccessScore"),
        "response_rate": meta.get("responseRate"),
        "response_time_minutes": meta.get("responseTimeMinutes"),
        "total_earnings": fp.totalEarned,
        "completed_projects": fp.completedProjects,
        "categories": meta.get("categories", []),
        "video_intro": meta.get("videoIntro"),
        "employment_history": meta.get("employmentHistory"),
        "education": meta.get("education"),
        "test_scores": meta.get("testScores"),
        "is_verified": fp.isVerified,
        "is_premium": fp.isPremium,
        "skill_passport_verified": fp.skillPassportVerified,
        "created_at": fp.createdAt.isoformat() if fp.createdAt else None,
    }


@router.put("/profiles/me/freelancer")
async def update_freelancer_profile(
    data: FreelancerProfileUpdate, current_user=Depends(get_current_user)
):
    """Update freelancer profile (rich fields stored in metadata)."""
    fp = await prisma.freelancerprofile.find_unique(where={"userId": current_user.id})
    if not fp:
        raise HTTPException(status_code=404, detail="Freelancer profile not found")
    top_level = {}
    meta_updates = {}
    privileged_fields = {
        "tier",
        "isVerified",
        "featured",
        "isPremium",
        "skillPassportVerified",
    }
    for k, v in data.model_dump(exclude_none=True).items():
        if k in privileged_fields:
            if current_user.role == "ADMIN":
                top_level[k] = v
            else:
                logger.warning(
                    f"User {current_user.id} attempted to self-assign privileged field '{k}'"
                )
        else:
            meta_updates[k] = v
    merged_meta = {**(fp.metadata or {}), **meta_updates}
    update_data: dict[str, Any] = {"metadata": merged_meta}
    if top_level:
        update_data.update(top_level)
    await prisma.freelancerprofile.update(
        where={"userId": current_user.id},
        data=update_data,
    )
    return await get_freelancer_profile(str(current_user.id))


# ── PROFILE COMPLETION ────────────────────────────────────────────


def _score_field(val) -> float:
    if val is None:
        return 0.0
    if isinstance(val, str) and len(val.strip()) == 0:
        return 0.0
    if isinstance(val, (list, dict)) and len(val) == 0:
        return 0.0
    return 1.0


COMPLETION_FIELDS = [
    ("fullName", 0.15),
    ("bio", 0.15),
    ("headline", 0.10),
    ("profilePictureUrl", 0.10),
    ("socialLinks", 0.05),
    ("country", 0.05),
    ("city", 0.05),
    ("skills", 0.10),
    ("username", 0.10),
    ("coverImageUrl", 0.05),
    ("pronouns", 0.02),
    ("tagline", 0.03),
]


@router.get("/profiles/me/completion")
async def get_profile_completion(current_user=Depends(get_current_user)):
    """Profile completion percentage with missing fields and tips."""
    user = await prisma.user.find_unique(where={"id": current_user.id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    total = 0.0
    missing = []
    tips = []
    for field, weight in COMPLETION_FIELDS:
        val = getattr(user, field, None)
        score = _score_field(val)
        total += weight * score
        if score < 1.0:
            missing.append(field)
            tips.append(_completion_tip(field))
    pct = round(total * 100, 1)
    return {
        "completion_pct": pct,
        "missing_fields": missing,
        "tips": tips,
        "total_fields": len(COMPLETION_FIELDS),
        "completed_fields": len(COMPLETION_FIELDS) - len(missing),
    }


def _completion_tip(field: str) -> str:
    tips = {
        "fullName": "Add your full name so people can find you.",
        "bio": "Write a short bio to tell others about yourself.",
        "headline": "Add a professional headline (e.g. 'Full-Stack Developer').",
        "profilePictureUrl": "Upload a profile picture to build trust.",
        "socialLinks": "Link your social accounts (LinkedIn, GitHub, etc.).",
        "country": "Set your country to help others find you locally.",
        "city": "Set your city for local networking.",
        "skills": "Add your skills to get discovered for opportunities.",
        "username": "Choose a unique username for your profile URL.",
        "coverImageUrl": "Add a cover image to personalize your profile.",
        "pronouns": "Add your pronouns so people address you correctly.",
        "tagline": "Add a short tagline that captures who you are.",
    }
    return tips.get(field, f"Complete your {field} to strengthen your profile.")


# ── BADGES ─────────────────────────────────────────────────────────


@router.get("/profiles/{identifier}/badges")
async def get_profile_badges(identifier: str):
    """Get achievement badges from student profile or computed badges."""
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    badges = []
    student = await prisma.studentprofile.find_unique(where={"userId": user.id})
    if student and student.badges:
        badges.extend(student.badges)
    computed = []
    if user.emailVerified:
        computed.append(
            {"type": "verified_email", "name": "Verified Email", "icon": "email"}
        )
    if user.phoneVerified:
        computed.append(
            {"type": "verified_phone", "name": "Verified Phone", "icon": "phone"}
        )
    fp = await prisma.freelancerprofile.find_unique(where={"userId": user.id})
    if fp and fp.skillPassportVerified:
        computed.append(
            {
                "type": "skill_passport",
                "name": "Skill Passport Verified",
                "icon": "passport",
            }
        )
    if fp and fp.isPremium:
        computed.append({"type": "premium", "name": "Premium Member", "icon": "crown"})
    enrollments = await prisma.enrollment.count(
        where={"userId": user.id, "completedAt": {"not": None}}
    )
    if enrollments >= 5:
        computed.append(
            {
                "type": "learner",
                "name": f"Completed {enrollments} Courses",
                "icon": "graduation",
            }
        )
    return {"earned_badges": badges, "computed_badges": computed}


# ── ACTIVITY FEED ─────────────────────────────────────────────────


@router.get("/profiles/{identifier}/activity")
async def get_profile_activity(identifier: str):
    """Recent activity timeline for a user profile."""
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    uid = user.id
    certs, enrollments, projects, proposals = await asyncio.gather(
        prisma.certificate.find_many(
            where={"userId": uid}, order={"issuedAt": "desc"}, take=5
        ),
        prisma.enrollment.find_many(
            where={"userId": uid, "completedAt": {"not": None}},
            order={"completedAt": "desc"},
            take=5,
        ),
        prisma.project.find_many(
            where={"ownerId": uid}, order={"createdAt": "desc"}, take=5
        ),
        prisma.proposal.find_many(
            where={"freelancerId": uid}, order={"createdAt": "desc"}, take=5
        ),
    )
    activities = []
    for c in certs:
        activities.append(
            {
                "type": "certificate",
                "title": "Earned a certificate",
                "date": c.issuedAt.isoformat(),
                "id": c.id,
            }
        )
    for e in enrollments:
        activities.append(
            {
                "type": "course_completed",
                "title": "Completed a course",
                "date": e.completedAt.isoformat(),
                "id": e.id,
            }
        )
    for p in projects:
        activities.append(
            {
                "type": "project",
                "title": p.title,
                "date": p.createdAt.isoformat(),
                "id": p.id,
            }
        )
    for p in proposals:
        activities.append(
            {
                "type": "proposal",
                "title": "Submitted a proposal",
                "date": p.createdAt.isoformat(),
                "id": p.id,
            }
        )
    activities.sort(key=lambda a: a["date"], reverse=True)
    return activities[:20]


# ── USERNAME HISTORY ──────────────────────────────────────────────


@router.get("/profiles/me/username/history")
async def get_username_history(current_user=Depends(get_current_user)):
    """Username change history (90-day redirect entries)."""
    redirects = await prisma.usernameredirect.find_many(
        where={"newUserId": current_user.id},
        order={"changedAt": "desc"},
    )
    return [
        {
            "old_username": r.oldUsername,
            "changed_at": r.changedAt.isoformat(),
            "expires_at": r.expiresAt.isoformat(),
            "is_active": r.expiresAt > datetime.now(timezone.utc),
        }
        for r in redirects
    ]


# ── INSTRUCTOR CREDENTIALS ────────────────────────────────────────


@router.post("/profiles/me/instructor/credentials")
async def add_instructor_credential(
    data: CredentialCreate, current_user=Depends(get_current_user)
):
    """Add a credential (degree, cert) to instructor profile."""
    profile = await prisma.instructorprofile.find_unique(
        where={"userId": current_user.id}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Instructor profile not found")
    creds = list(profile.credentials or [])
    new_id = max((c.get("id", 0) for c in creds), default=0) + 1
    entry = {**data.model_dump(), "id": new_id}
    creds.append(entry)
    await prisma.instructorprofile.update(
        where={"userId": current_user.id}, data={"credentials": creds}
    )
    return {"id": new_id, **data.model_dump()}


@router.delete("/profiles/me/instructor/credentials/{credential_id}")
async def delete_instructor_credential(
    credential_id: int, current_user=Depends(get_current_user)
):
    """Remove a credential from instructor profile."""
    profile = await prisma.instructorprofile.find_unique(
        where={"userId": current_user.id}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Instructor profile not found")
    creds = [c for c in (profile.credentials or []) if c.get("id") != credential_id]
    if len(creds) == len(profile.credentials or []):
        raise HTTPException(status_code=404, detail="Credential not found")
    await prisma.instructorprofile.update(
        where={"userId": current_user.id}, data={"credentials": creds}
    )
    return {"status": "deleted", "credential_id": credential_id}
