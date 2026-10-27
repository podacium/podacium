"""Profile API routes — unified profile with privacy enforcement."""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user_optional, get_current_user
from app.core.prisma import prisma
from app.schemas.profiles import (
    StudentProfileUpdate,
    InstructorProfileUpdate,
    BusinessProfileUpdate,
    ServiceCreate,
    ServiceUpdate,
    PublicDashboardCreate,
    OrgProfileUpdate,
    OrgReviewCreate,
)
from app.services.profile_service import (
    profile_service,
    ProfileVisibilityResolver,
    validate_username,
    slugify,
    USERNAME_CHANGE_COOLDOWN_DAYS,
    USERNAME_REDIRECT_TTL_DAYS,
)
from app.services.pillar_profile_service import pillar_profile_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/profiles", tags=["profiles"])
org_router = APIRouter(tags=["profiles"])


@router.get("/me")
async def get_own_profile(current_user=Depends(get_current_user)):
    """Get own profile — all sections, no privacy filtering."""
    user = await prisma.user.find_unique(where={"id": current_user.id})
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")
    resolver = ProfileVisibilityResolver(user.id, user.id)
    profile = await profile_service.get_public_profile_data(user, resolver)
    profile["is_own_profile"] = True
    return profile


@router.put("/me/username")
async def change_username(
    username: str,
    current_user=Depends(get_current_user),
):
    """Change own username with validation and rate limiting."""
    username = username.strip().lower()
    error = validate_username(username)
    if error:
        raise HTTPException(status_code=400, detail=error)
    existing = await prisma.user.find_unique(where={"username": username})
    if existing and existing.id != current_user.id:
        raise HTTPException(status_code=409, detail="Username already taken")
    last_change = await prisma.usernameredirect.find_first(
        where={"newUserId": current_user.id},
        order={"changedAt": "desc"},
    )
    if last_change:
        days_since = (datetime.now(timezone.utc) - last_change.changedAt).days
        if days_since < USERNAME_CHANGE_COOLDOWN_DAYS:
            remaining = USERNAME_CHANGE_COOLDOWN_DAYS - days_since
            raise HTTPException(
                status_code=429,
                detail=f"Can change username once per {USERNAME_CHANGE_COOLDOWN_DAYS} days. {remaining} days remaining.",
            )
    old_username = getattr(current_user, "username", None)
    if old_username and old_username != username:
        await prisma.usernameredirect.create(
            data={
                "oldUsername": old_username,
                "newUserId": current_user.id,
                "expiresAt": datetime.now(timezone.utc) + timedelta(days=USERNAME_REDIRECT_TTL_DAYS),
            }
        )
    new_slug = slugify(username)
    await prisma.user.update(
        where={"id": current_user.id},
        data={"username": username, "slug": new_slug},
    )
    return {
        "username": username,
        "slug": new_slug,
        "old_username": old_username,
        "redirect_days": USERNAME_REDIRECT_TTL_DAYS,
    }


@router.get("/username/available/{username}")
async def check_username_available(username: str):
    """Check if a username is available."""
    username = username.strip().lower()
    error = validate_username(username)
    if error:
        return {"available": False, "reason": error}
    existing = await prisma.user.find_unique(where={"username": username})
    return {"available": existing is None}


# ── FOLLOW SYSTEM ─────────────────────────────────────────────────────


@router.post("/{identifier}/follow")
async def follow_user(
    identifier: str,
    current_user=Depends(get_current_user),
):
    """Follow a user by ID or username."""
    target = await profile_service.resolve_profile(identifier)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    await prisma.userfollow.upsert(
        where={
            "followerId_followingId": {
                "followerId": current_user.id,
                "followingId": target.id,
            }
        },
        data={
            "create": {"followerId": current_user.id, "followingId": target.id},
            "update": {},
        },
    )
    return {"status": "following", "user_id": target.id, "username": target.username}


@router.delete("/{identifier}/follow")
async def unfollow_user(
    identifier: str,
    current_user=Depends(get_current_user),
):
    """Unfollow a user by ID or username."""
    target = await profile_service.resolve_profile(identifier)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await prisma.userfollow.delete_many(
        where={"followerId": current_user.id, "followingId": target.id}
    )
    return {"status": "unfollowed", "user_id": target.id, "username": target.username}


@router.get("/{identifier}/followers")
async def get_followers(identifier: str):
    """Get followers list for a user."""
    target = await profile_service.resolve_profile(identifier)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        follows = await prisma.userfollow.find_many(
            where={"followingId": target.id},
            include={"follower": True},
            order={"createdAt": "desc"},
            take=50,
        )
    except Exception as e:
        logger.error(f"Failed to fetch followers for {identifier}: {e}")
        return {"followers": [], "total": 0}
    total = await prisma.userfollow.count(where={"followingId": target.id})
    return {
        "followers": [
            {"id": f.follower.id, "username": f.follower.username, "fullName": f.follower.fullName, "avatarUrl": f.follower.profilePictureUrl, "followedAt": f.createdAt.isoformat()}
            for f in follows
        ],
        "total": total,
    }


@router.get("/{identifier}/following")
async def get_following(identifier: str):
    """Get following list for a user."""
    target = await profile_service.resolve_profile(identifier)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        follows = await prisma.userfollow.find_many(
            where={"followerId": target.id},
            include={"following": True},
            order={"createdAt": "desc"},
            take=50,
        )
    except Exception as e:
        logger.error(f"Failed to fetch following for {identifier}: {e}")
        return {"following": [], "total": 0}
    total = await prisma.userfollow.count(where={"followerId": target.id})
    return {
        "following": [
            {"id": f.following.id, "username": f.following.username, "fullName": f.following.fullName, "avatarUrl": f.following.profilePictureUrl, "followedAt": f.createdAt.isoformat()}
            for f in follows
        ],
        "total": total,
    }


@router.get("/{identifier}/follow/status")
async def get_follow_status(
    identifier: str,
    current_user=Depends(get_current_user),
):
    """Check if current user is following the target user."""
    target = await profile_service.resolve_profile(identifier)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    follow = await prisma.userfollow.find_unique(
        where={
            "followerId_followingId": {
                "followerId": current_user.id,
                "followingId": target.id,
            }
        }
    )
    return {"is_following": follow is not None}


# ── BLOCK SYSTEM ──────────────────────────────────────────────────────


@router.post("/{identifier}/block")
async def block_user(
    identifier: str,
    current_user=Depends(get_current_user),
):
    """Block a user by ID or username."""
    target = await profile_service.resolve_profile(identifier)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    await prisma.userblock.upsert(
        where={
            "blockerId_blockedId": {
                "blockerId": current_user.id,
                "blockedId": target.id,
            }
        },
        data={
            "create": {"blockerId": current_user.id, "blockedId": target.id},
            "update": {},
        },
    )
    await prisma.userfollow.delete_many(
        where={
            "OR": [
                {"followerId": current_user.id, "followingId": target.id},
                {"followerId": target.id, "followingId": current_user.id},
            ]
        }
    )
    return {"status": "blocked", "user_id": target.id, "username": target.username}


@router.delete("/{identifier}/block")
async def unblock_user(
    identifier: str,
    current_user=Depends(get_current_user),
):
    """Unblock a user by ID or username."""
    target = await profile_service.resolve_profile(identifier)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await prisma.userblock.delete_many(
        where={"blockerId": current_user.id, "blockedId": target.id}
    )
    return {"status": "unblocked", "user_id": target.id, "username": target.username}


@router.get("/me/blocks")
async def get_blocked_users(current_user=Depends(get_current_user)):
    """List all users blocked by the current user."""
    blocks = await prisma.userblock.find_many(
        where={"blockerId": current_user.id},
        include={"blocked": True},
        order={"createdAt": "desc"},
    )
    return [
        {"id": b.blocked.id, "username": b.blocked.username, "fullName": b.blocked.fullName, "avatarUrl": b.blocked.profilePictureUrl, "blockedAt": b.createdAt.isoformat()}
        for b in blocks
    ]


# ── STUDENT PROFILE ───────────────────────────────────────────────────


@router.get("/{identifier}/student")
async def get_student_profile(identifier: str):
    """Get student profile data (learning goals, badges, quiz scores)."""
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    profile = await pillar_profile_service.get_student_profile(user.id)
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")
    stats = await pillar_profile_service.get_student_learning_stats(user.id)
    return {**profile, **stats}


@router.put("/me/student")
async def update_student_profile(data: StudentProfileUpdate, current_user=Depends(get_current_user)):
    """Update own student profile."""
    return await pillar_profile_service.upsert_student_profile(current_user.id, data.model_dump(exclude_none=True))


# ── INSTRUCTOR PROFILE ────────────────────────────────────────────────


@router.get("/{identifier}/instructor")
async def get_instructor_profile(identifier: str):
    """Get instructor profile (credentials, experience, publications)."""
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    profile = await pillar_profile_service.get_instructor_profile(user.id)
    if not profile:
        raise HTTPException(status_code=404, detail="Instructor profile not found")
    stats = await pillar_profile_service.get_instructor_teaching_stats(user.id)
    return {**profile, **stats}


@router.put("/me/instructor")
async def update_instructor_profile(data: InstructorProfileUpdate, current_user=Depends(get_current_user)):
    """Update own instructor profile."""
    return await pillar_profile_service.upsert_instructor_profile(current_user.id, data.model_dump(exclude_none=True))


# ── BUSINESS PROFILE ──────────────────────────────────────────────────


@router.get("/{identifier}/business")
async def get_business_profile(identifier: str):
    """Get business profile (company role, industry, expertise)."""
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    profile = await pillar_profile_service.get_business_profile(user.id)
    if not profile:
        raise HTTPException(status_code=404, detail="Business profile not found")
    return profile


@router.put("/me/business")
async def update_business_profile(data: BusinessProfileUpdate, current_user=Depends(get_current_user)):
    """Update own business profile."""
    return await pillar_profile_service.upsert_business_profile(current_user.id, data.model_dump(exclude_none=True))


# ── FREELANCER SERVICES ───────────────────────────────────────────────


@router.get("/{identifier}/freelancer/services")
async def list_freelancer_services(identifier: str):
    """List service catalog for a freelancer."""
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await pillar_profile_service.list_services(user.id)


@router.post("/me/freelancer/services")
async def create_freelancer_service(data: ServiceCreate, current_user=Depends(get_current_user)):
    """Create a new service listing."""
    return await pillar_profile_service.create_service(current_user.id, data.model_dump(exclude_none=True))


@router.put("/me/freelancer/services/{service_id}")
async def update_freelancer_service(service_id: int, data: ServiceUpdate, current_user=Depends(get_current_user)):
    """Update a service listing."""
    result = await pillar_profile_service.update_service(service_id, current_user.id, data.model_dump(exclude_none=True))
    if not result:
        raise HTTPException(status_code=404, detail="Service not found")
    return result


@router.delete("/me/freelancer/services/{service_id}")
async def delete_freelancer_service(service_id: int, current_user=Depends(get_current_user)):
    """Delete a service listing."""
    deleted = await pillar_profile_service.delete_service(service_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"status": "deleted"}


# ── SKILL ENDORSEMENTS ────────────────────────────────────────────────


@router.post("/{identifier}/endorse/{skill_name}")
async def endorse_skill(identifier: str, skill_name: str, current_user=Depends(get_current_user)):
    """Endorse a user's skill."""
    target = await profile_service.resolve_profile(identifier)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot endorse yourself")
    return await pillar_profile_service.endorse_skill(current_user.id, target.id, skill_name)


@router.delete("/{identifier}/endorse/{skill_name}")
async def remove_endorsement(identifier: str, skill_name: str, current_user=Depends(get_current_user)):
    """Remove a skill endorsement."""
    target = await profile_service.resolve_profile(identifier)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    return await pillar_profile_service.remove_endorsement(current_user.id, target.id, skill_name)


@router.get("/{identifier}/endorsements")
async def get_endorsements(identifier: str):
    """Get all skill endorsements for a user."""
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await pillar_profile_service.get_endorsements(user.id)


# ── ORGANIZATION PROFILE (extended) ───────────────────────────────────


@org_router.get("/organizations/{org_id}/profile")
async def get_org_extended_profile(org_id: int):
    """Get extended organization profile (About, specialties, funding)."""
    profile = await pillar_profile_service.get_org_profile(org_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Organization profile not found")
    return profile


@org_router.put("/organizations/{org_id}/profile")
async def update_org_extended_profile(org_id: int, data: OrgProfileUpdate, current_user=Depends(get_current_user)):
    """Update extended organization profile (owner only)."""
    org = await prisma.organization.find_unique(where={"id": org_id})
    if not org or org.ownerId != current_user.id:
        raise HTTPException(status_code=403, detail="Only the organization owner can update the profile")
    return await pillar_profile_service.upsert_org_profile(org_id, data.model_dump(exclude_none=True))


# ── ORGANIZATION REVIEWS ──────────────────────────────────────────────


@org_router.post("/organizations/{org_id}/reviews")
async def create_org_review(org_id: int, data: OrgReviewCreate, current_user=Depends(get_current_user)):
    """Review an organization."""
    try:
        return await pillar_profile_service.create_org_review(org_id, current_user.id, data.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@org_router.get("/organizations/{org_id}/reviews")
async def get_org_reviews(org_id: int):
    """Get all reviews for an organization."""
    return await pillar_profile_service.get_org_reviews(org_id)


# ── ORGANIZATION FOLLOW ───────────────────────────────────────────────


@org_router.post("/organizations/{org_id}/follow")
async def follow_organization(org_id: int, current_user=Depends(get_current_user)):
    """Follow an organization."""
    return await pillar_profile_service.follow_org(org_id, current_user.id)


@org_router.delete("/organizations/{org_id}/follow")
async def unfollow_organization(org_id: int, current_user=Depends(get_current_user)):
    """Unfollow an organization."""
    return await pillar_profile_service.unfollow_org(org_id, current_user.id)


@org_router.get("/organizations/{org_id}/followers")
async def get_org_followers(org_id: int):
    """Get followers of an organization."""
    return await pillar_profile_service.get_org_followers(org_id)


# ── PUBLIC DASHBOARDS ─────────────────────────────────────────────────


@router.get("/{identifier}/dashboards")
async def get_public_dashboards(identifier: str):
    """Get public BI dashboards for a user."""
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await pillar_profile_service.list_public_dashboards(user_id=user.id)


@router.post("/me/dashboards")
async def create_public_dashboard(data: PublicDashboardCreate, current_user=Depends(get_current_user)):
    """Make a dashboard public on your profile."""
    return await pillar_profile_service.create_public_dashboard({**data.model_dump(exclude_none=True), "userId": current_user.id})


@router.get("/{identifier}/skills")
async def get_user_skills(identifier: str):
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        skills = getattr(user, "skills", []) or []
        names = [s if isinstance(s, str) else s.get("name", str(s)) for s in skills]
        counts = await asyncio.gather(*[
            prisma.skillendorsement.count(
                where={"endorsedId": user.id, "skillName": name}
            )
            for name in names
        ])
        result = [{"name": names[i], "endorsement_count": counts[i]} for i in range(len(names))]
        return {"skills": result}
    except Exception as e:
        logger.error(f"Error fetching skills for {identifier}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch skills")


@router.get("/{identifier}/certificates")
async def get_user_certificates(identifier: str):
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        certs = await prisma.certificate.find_many(
            where={"userId": user.id},
            order={"issuedAt": "desc"},
        )
        return [
            {
                "id": c.id,
                "title": getattr(c, "module", None) and (getattr(c.module, "title", None) or "") or getattr(c, "path", None) and (getattr(c.path, "title", None) or "") or "",
                "issuedAt": c.issuedAt.isoformat() if getattr(c, "issuedAt", None) else None,
                "certificateId": getattr(c, "certificateId", None),
                "qrCodeUrl": getattr(c, "qrCodeUrl", None),
                "verificationUrl": getattr(c, "verificationUrl", None),
            }
            for c in certs
        ]
    except Exception as e:
        logger.error(f"Error fetching certificates for {identifier}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch certificates")


@router.get("/{identifier}/portfolio")
async def get_user_portfolio(identifier: str):
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        items = await prisma.portfolioitem.find_many(
            where={"userId": user.id},
            order={"createdAt": "desc"},
        )
        return [
            {
                "id": item.id,
                "title": item.title,
                "description": getattr(item, "description", None),
                "imageUrl": getattr(item, "imageUrl", None),
                "tags": getattr(item, "tags", None) or [],
                "createdAt": item.createdAt.isoformat() if getattr(item, "createdAt", None) else None,
            }
            for item in items
        ]
    except Exception as e:
        logger.error(f"Error fetching portfolio for {identifier}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch portfolio")


@router.get("/{identifier}/reviews")
async def get_user_reviews(identifier: str):
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        reviews = await prisma.orgreview.find_many(
            where={"organization": {"ownerId": user.id}},
        )
        distribution = {}
        for r in reviews:
            rating = getattr(r, "rating", 0) or 0
            distribution[rating] = distribution.get(rating, 0) + 1
        total = len(reviews)
        avg = sum(getattr(r, "rating", 0) or 0 for r in reviews) / total if total > 0 else 0
        return {
            "reviews": [
                {
                    "id": r.id,
                    "rating": getattr(r, "rating", None),
                    "comment": getattr(r, "comment", None),
                    "createdAt": r.createdAt.isoformat() if getattr(r, "createdAt", None) else None,
                }
                for r in reviews
            ],
            "average_rating": round(avg, 2),
            "total_reviews": total,
            "distribution": {str(k): distribution.get(k, 0) for k in range(1, 6)},
        }
    except Exception as e:
        logger.error(f"Error fetching reviews for {identifier}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch reviews")


@router.get("/{identifier}/stats")
async def get_user_stats(identifier: str):
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        uid = user.id
        counts = await asyncio.gather(
            prisma.enrollment.count(where={"userId": uid, "completedAt": {"not": None}}),
            prisma.certificate.count(where={"userId": uid}),
            prisma.project.count(where={"ownerId": uid}),
            prisma.proposal.count(where={"freelancerId": uid}),
            prisma.userfollow.count(where={"followingId": uid}),
            prisma.userfollow.count(where={"followerId": uid}),
            prisma.portfolioitem.count(where={"userId": uid}),
        )
        return {
            "completed_courses": counts[0],
            "certificates": counts[1],
            "projects": counts[2],
            "proposals": counts[3],
            "followers": counts[4],
            "following": counts[5],
            "portfolio_items": counts[6],
        }
    except Exception as e:
        logger.error(f"Error fetching stats for {identifier}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stats")


@router.get("/{identifier}/business/datasets")
async def get_user_datasets(identifier: str):
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        datasets = await prisma.dataset.find_many(
            where={"ownerUser": {"id": user.id}},
            take=20,
            order={"createdAt": "desc"},
        )
        return [
            {
                "id": d.id,
                "name": d.name,
                "description": getattr(d, "description", None),
                "format": getattr(d, "format", None),
                "rowCount": getattr(d, "rowCount", None),
                "createdAt": d.createdAt.isoformat() if getattr(d, "createdAt", None) else None,
            }
            for d in datasets
        ]
    except Exception as e:
        logger.error(f"Error fetching datasets for {identifier}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch datasets")


@router.get("/{identifier}/business/ml-models")
async def get_user_ml_models(identifier: str):
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        models = await prisma.mlmodel.find_many(
            where={"creatorId": user.id},
            take=20,
            order={"createdAt": "desc"},
        )
        return [
            {
                "id": m.id,
                "name": m.name,
                "type": getattr(m, "type", None),
                "metrics": getattr(m, "metrics", None),
                "createdAt": m.createdAt.isoformat() if getattr(m, "createdAt", None) else None,
            }
            for m in models
        ]
    except Exception as e:
        logger.error(f"Error fetching ML models for {identifier}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch ML models")


@router.get("/{identifier}/freelancer/services/{service_id}")
async def get_freelancer_service(identifier: str, service_id: str):
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        service = await prisma.freelancerservice.find_first(
            where={"id": int(service_id), "userId": user.id}
        )
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        return service
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching freelancer service {service_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch service")


# ── Catch-all profile lookup. Registered LAST so static routes
#    (/me, /me/..., /username/available/...) take precedence.
@router.get("/{identifier}")
async def get_profile(
    identifier: str,
    current_user=Depends(get_current_user_optional),
):
    """Get unified public profile by ID or username. Privacy-filtered."""
    user = await profile_service.resolve_profile(identifier)
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")
    requesting_id = current_user.id if current_user else None
    resolver = ProfileVisibilityResolver(user.id, requesting_id)
    if not await resolver.can_view_profile():
        raise HTTPException(status_code=404, detail="Profile not found")
    profile = await profile_service.get_public_profile_data(user, resolver)
    profile["is_own_profile"] = requesting_id == user.id
    if current_user and current_user.id != user.id:
        profile["can_message"] = getattr(user, "isActive", True)
    return profile


@org_router.get("/organizations/{org_id}/jobs")
async def get_organization_jobs(org_id: int):
    try:
        org = await prisma.organization.find_unique(where={"id": org_id})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        org_profile = await prisma.orgprofile.find_unique(where={"organizationId": org_id})
        if not org_profile:
            return []
        jobs = getattr(org_profile, "jobs", None) or []
        return jobs
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching jobs for org {org_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch jobs")


@org_router.get("/organizations/{org_id}/stats")
async def get_organization_stats(org_id: int):
    try:
        org = await prisma.organization.find_unique(where={"id": org_id})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        followers = await prisma.orgfollow.count(where={"organizationId": org_id})
        projects = await prisma.project.count(where={"organizationId": org_id})
        reviews = await prisma.orgreview.find_many(where={"organizationId": org_id})
        total_reviews = len(reviews)
        avg_rating = sum(getattr(r, "rating", 0) or 0 for r in reviews) / total_reviews if total_reviews > 0 else 0
        return {
            "followers": followers,
            "projects": projects,
            "average_rating": round(avg_rating, 2),
            "total_reviews": total_reviews,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching stats for org {org_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch organization stats")