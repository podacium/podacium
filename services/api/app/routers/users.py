import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from app.core.auth import get_current_user, get_current_user_optional
from app.core.prisma import prisma
import asyncio

from typing import Optional, Any, List
from datetime import datetime, timezone

from app.services.profile_service import ProfileVisibilityResolver

logger = logging.getLogger(__name__)

from app.schemas.users import (
    PublicProfileUpdate,
    PrivateSettingsUpdate,
    NotificationPreferences,
    SecuritySettings,
    EmailVerificationRequest,
    PhoneVerificationRequest,
    PasswordChangeRequest,
    AccountDeletionRequest,
    UserUpdateData,
    UserProfileResponse,
    PublicUserProfileResponse,
    UserSkillCreate,
    UserSkillResponse,
    UserSettingsResponse,
    VerificationResponse,
    AccountDeletionResponse,
)
from app.services.email_service import email_service
from app.core.security import verify_password, generate_verification_token
from app.core.auth import security


# Lightweight auth dependency for performance-critical endpoints
async def get_user_lightweight(
    request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)
):
    return await get_current_user(
        request, credentials=credentials, include_relations=False
    )


router = APIRouter(tags=["users"])

# ======================
# PROFILE ENDPOINTS
# ======================


# Dependency to get user with full relations
async def get_current_user_with_relations(
    request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)
):
    return await get_current_user(
        request, credentials=credentials, include_relations=True
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    current_user=Depends(get_current_user_with_relations),
):
    """Get current user profile with all data"""
    return current_user


@router.get("/me/profile-progress", response_model=dict)
@router.get("/users/me/profile-progress", response_model=dict)
async def get_profile_progress(current_user=Depends(get_current_user)):
    """Calculate profile completion percentage and missing fields."""
    score = 0.0
    total = 7.0
    missing = []

    if current_user.fullName and len(current_user.fullName.strip()) >= 3:
        score += 1.0
    else:
        missing.append("fullName")

    if current_user.bio and len(current_user.bio.strip()) >= 20:
        score += 1.0
    else:
        missing.append("bio")

    if current_user.profilePictureUrl:
        score += 1.0
    else:
        missing.append("profilePictureUrl")

    if current_user.skills and len(current_user.skills) >= 2:
        score += 1.0
    else:
        missing.append("skills")

    if current_user.country:
        score += 0.5
    else:
        missing.append("country")

    if current_user.city:
        score += 0.5
    else:
        missing.append("city")

    if current_user.phoneVerified:
        score += 1.0
    else:
        missing.append("phoneVerified")

    if current_user.fieldOfInterest:
        score += 1.0
    else:
        missing.append("fieldOfInterest")

    pct = round((score / total) * 100)

    return {
        "score": score,
        "total": total,
        "percentage": pct,
        "missing": missing,
        "completed": len(missing) == 0,
    }


@router.get("/me/public", response_model=PublicUserProfileResponse)
async def get_my_public_profile(current_user=Depends(get_current_user)):
    """Get current user's public profile data"""
    logger.debug("GET /me/public - Public profile request")

    # Get related data for public profile
    certificates = await prisma.certificate.find_many(
        where={"userId": current_user.id}, include={"module": True}
    )

    instructed_modules = await prisma.module.find_many(
        where={"instructorId": current_user.id}
    )

    skills_details = await prisma.userskill.find_many(where={"userId": current_user.id})

    return PublicUserProfileResponse(
        id=current_user.id,
        fullName=current_user.fullName,
        bio=current_user.bio,
        profilePictureUrl=current_user.profilePictureUrl,
        country=current_user.country,
        city=current_user.city,
        skills=current_user.skills,
        socialLinks=current_user.socialLinks,
        role=current_user.role,
        createdAt=current_user.createdAt,
        certificates=certificates,
        instructedModules=instructed_modules,
        skillsDetails=skills_details,
    )


@router.put("/me/profile", response_model=UserProfileResponse)
async def update_public_profile(
    update_data: PublicProfileUpdate, current_user=Depends(get_current_user)
):
    """Update only public profile information - supports partial updates"""
    logger.debug("BACKEND: PUT /me/profile - Public profile update")

    # Only include fields that were actually sent in the request
    update_dict = update_data.dict(exclude_unset=True, exclude_none=True)
    logger.debug(f"BACKEND: Raw update dict: {update_dict}")

    if not update_dict:
        raise HTTPException(status_code=400, detail="No data provided for update")

    # Build the update data
    update_data_prisma = {}

    # Handle regular text fields (non-enum fields)
    # NOTE: 'role' is intentionally excluded — role changes require admin action
    for field in ["fullName", "bio", "profilePictureUrl"]:
        if field in update_dict:
            # Keep the value as is (can be empty string for text fields)
            update_data_prisma[field] = update_dict[field]

    # Handle enum fields - convert empty strings to None
    enum_fields = ["country", "city"]
    for field in enum_fields:
        if field in update_dict:
            if update_dict[field] == "":
                update_data_prisma[field] = None
            elif isinstance(update_dict[field], str):
                update_data_prisma[field] = (
                    update_dict[field].strip().upper().replace(" ", "_")
                )
            else:
                update_data_prisma[field] = update_dict[field]

    # Handle skills array
    if "skills" in update_dict:
        update_data_prisma["skills"] = update_dict["skills"]

    # Handle socialLinks JSON field
    if "socialLinks" in update_dict:
        social_links = update_dict["socialLinks"]
        logger.debug(
            f"BACKEND: Processing socialLinks: {social_links} (type: {type(social_links)})"
        )

        if social_links is None:
            update_data_prisma["socialLinks"] = None
        else:
            from app.generated.prisma import Json

            update_data_prisma["socialLinks"] = Json(social_links)

    logger.debug(f"BACKEND: Final Prisma update data: {update_data_prisma}")

    try:
        updated_user = await prisma.user.update(
            where={"id": current_user.id}, data=update_data_prisma
        )

        logger.info(f"BACKEND: Public profile updated for user {current_user.id}")
        logger.debug(f"BACKEND: Updated user socialLinks: {updated_user.socialLinks}")

        # Ensure memberships is always a list for the response
        if updated_user.memberships is None:
            updated_user.memberships = []

        return updated_user

    except Exception as e:
        logger.error(f"BACKEND: ERROR in PUT /me/profile: {str(e)}")
        error_msg = str(e)
        if "is not a valid" in error_msg or "Parse error" in error_msg:
            raise HTTPException(
                status_code=400, detail="Invalid country or city selected."
            )
        raise HTTPException(status_code=500, detail="Failed to update profile")


@router.put("/me/settings", response_model=UserProfileResponse)
async def update_private_settings(
    update_data: PrivateSettingsUpdate, current_user=Depends(get_current_user)
):
    """Update private account settings - supports partial updates"""
    logger.debug("BACKEND: PUT /me/settings - Private settings update")

    # Only include fields that were actually sent in the request
    update_dict = update_data.dict(exclude_unset=True, exclude_none=True)

    if not update_dict:
        raise HTTPException(status_code=400, detail="No data provided for update")

    old_email = current_user.email
    email_changed = "email" in update_dict and update_dict["email"] != old_email

    # Handle email/phone verification status
    if email_changed:
        update_dict["emailVerified"] = False
        logger.debug(
            f"BACKEND: Email changed, verification required: {update_dict['email']}"
        )

    if (
        "phoneNumber" in update_dict
        and update_dict["phoneNumber"] != current_user.phoneNumber
    ):
        update_dict["phoneVerified"] = False
        logger.debug(
            f"BACKEND: Phone changed, verification required: {update_dict['phoneNumber']}"
        )

    try:
        updated_user = await prisma.user.update(
            where={"id": current_user.id}, data=update_dict
        )

        logger.info(f"BACKEND: Private settings updated for user {current_user.id}")

        # Send email change notification to old address
        if email_changed and old_email:
            from datetime import datetime, timezone

            try:
                await email_service.send_email_changed_email(
                    email=old_email,
                    name=current_user.fullName or "User",
                    old_email=old_email,
                    new_email=update_dict["email"],
                    time_val=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                )
            except Exception as ex:
                logger.error(f"Failed to send email changed notification: {ex}")

        return updated_user

    except Exception as e:
        logger.error(f"BACKEND: ERROR in PUT /me/settings: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update settings")


@router.put("/me", response_model=UserProfileResponse)
async def update_user_profile(
    update_data: UserUpdateData, current_user=Depends(get_current_user)
):
    """Legacy endpoint - updates both public and private data (partial updates supported)"""
    logger.debug("PUT /me - Legacy profile update")

    # Only include fields that were actually sent in the request
    update_dict = update_data.dict(exclude_unset=True, exclude_none=True)

    # 🔒 CRITICAL: Strip privileged fields that must NOT be self-assigned.
    # Users cannot escalate to ADMIN/INSTRUCTOR, bypass activation checks, or self-promote.
    # Role changes require admin action via dedicated admin endpoints.
    update_dict.pop("role", None)
    update_dict.pop("isActive", None)
    update_dict.pop("isDeactivated", None)

    if not update_dict:
        raise HTTPException(status_code=400, detail="No data provided for update")

    old_email = current_user.email
    email_changed = "email" in update_dict and update_dict["email"] != old_email

    # Handle verification status for email/phone changes
    if email_changed:
        update_dict["emailVerified"] = False

    if (
        "phoneNumber" in update_dict
        and update_dict["phoneNumber"] != current_user.phoneNumber
    ):
        update_dict["phoneVerified"] = False

    # Handle enum fields (country and city) - convert empty strings to None
    enum_fields = ["country", "city"]
    for field in enum_fields:
        if field in update_dict:
            if update_dict[field] == "":
                update_dict[field] = None
            elif isinstance(update_dict[field], str):
                update_dict[field] = (
                    update_dict[field].strip().upper().replace(" ", "_")
                )

    try:
        updated_user = await prisma.user.update(
            where={"id": current_user.id}, data=update_dict
        )

        logger.info(f"BACKEND: Legacy update successful for user {current_user.id}")

        # Send email change notification to old address
        if email_changed and old_email:
            from datetime import datetime, timezone

            try:
                await email_service.send_email_changed_email(
                    email=old_email,
                    name=current_user.fullName or "User",
                    old_email=old_email,
                    new_email=update_dict["email"],
                    time_val=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                )
            except Exception as ex:
                logger.error(f"Failed to send email changed notification: {ex}")

        return updated_user

    except Exception as e:
        logger.error(f"BACKEND: ERROR in PUT /me: {str(e)}")
        error_msg = str(e)
        if "is not a valid" in error_msg or "Parse error" in error_msg:
            raise HTTPException(
                status_code=400, detail="Invalid country or city selected."
            )
        raise HTTPException(status_code=500, detail="Failed to update profile")


# ======================
# SETTINGS ENDPOINTS
# ======================


@router.get("/me/settings", response_model=UserSettingsResponse)
async def get_user_settings(current_user=Depends(get_current_user)):
    """Get user settings and preferences"""
    logger.debug("BACKEND: GET /me/settings - User settings request")

    # In a real implementation, you might store these in a separate table
    # For now, return defaults or fetch from user preferences
    return UserSettingsResponse(
        notificationPreferences=NotificationPreferences(),
        securitySettings=SecuritySettings(),
    )


@router.put("/me/notifications")
async def update_notification_preferences(
    preferences: NotificationPreferences, current_user=Depends(get_current_user)
):
    """Update notification preferences"""
    logger.debug("BACKEND: PUT /me/notifications - Notification preferences update")

    # Store notification preferences (implement based on your storage strategy)
    # This could be in a separate table or as JSON in the user table

    logger.info(f"BACKEND: Notification preferences updated for user {current_user.id}")
    return {"message": "Notification preferences updated successfully"}


@router.put("/me/security")
async def update_security_settings(
    security_settings: SecuritySettings, current_user=Depends(get_current_user)
):
    """Update security settings"""
    logger.debug("BACKEND: PUT /me/security - Security settings update")

    # Store security settings (implement based on your storage strategy)

    logger.info(f"BACKEND: Security settings updated for user {current_user.id}")
    return {"message": "Security settings updated successfully"}


@router.post("/auth/change-password")
async def change_password(
    password_data: PasswordChangeRequest, current_user=Depends(get_current_user)
):
    logger.debug("BACKEND: POST /auth/change-password - Password change request")

    try:
        from app.services.security_service import security_service

        return await security_service.change_password(current_user.id, password_data)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"BACKEND: ERROR changing password: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to change password")


@router.post("/auth/verify-email/request")
async def request_email_verification(
    request_data: EmailVerificationRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    """Request email verification"""
    logger.debug(
        "BACKEND: POST /auth/verify-email/request - Email verification request"
    )

    # Generate verification token
    verification_token = generate_verification_token()

    # Store token in database (implement token storage)
    # await prisma.verificationtoken.create(...)

    # Send verification email
    try:
        await email_service.send_verification_email(
            email=request_data.email,
            token=verification_token,
            name=current_user.fullName,
            user_id=current_user.id,
        )

        logger.info(f"BACKEND: Email verification sent to {request_data.email}")
        return VerificationResponse(
            message="Verification email sent successfully",
            verificationSent=True,
            method="email",
        )

    except Exception as e:
        logger.error(f"BACKEND: ERROR sending verification email: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send verification email")


@router.post("/me/delete-account")
@router.post("/users/me/delete-account")
async def delete_account(
    delete_data: AccountDeletionRequest, current_user=Depends(get_current_user)
):
    """Delete user account"""
    logger.debug("BACKEND: POST /me/delete-account - Account deletion request")

    # Verify password
    if not verify_password(delete_data.password, current_user.passwordHash):
        raise HTTPException(status_code=400, detail="Password is incorrect")

    # Schedule account deletion (soft delete)
    try:
        await prisma.user.update(
            where={"id": current_user.id},
            data={"deletedAt": datetime.now(timezone.utc), "isActive": False},
        )

        # Log deletion reason
        if delete_data.reason or delete_data.feedback:
            from app.generated.prisma import Json

            await prisma.auditlog.create(
                data={
                    "actorId": current_user.id,
                    "entityType": "User",
                    "entityId": str(current_user.id),
                    "eventType": "ACCOUNT_DELETION",
                    "metadata": Json(
                        {"reason": delete_data.reason, "feedback": delete_data.feedback}
                    ),
                }
            )

        logger.info(f"BACKEND: Account deletion scheduled for user {current_user.id}")
        return AccountDeletionResponse(
            message="Account deletion scheduled successfully",
            deletionScheduled=True,
            scheduledAt=datetime.now(timezone.utc),
        )

    except Exception as e:
        logger.error(f"BACKEND: ERROR scheduling account deletion: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete account")


# ======================
# SKILLS ENDPOINTS
# ======================


@router.get("/users/me/skills", response_model=List[UserSkillResponse])
async def get_my_skills(current_user=Depends(get_user_lightweight)):
    """Get current user's skills."""
    skills = await prisma.userskill.find_many(where={"userId": current_user.id})
    return skills


@router.get("/users/{user_id}/skills", response_model=List[UserSkillResponse])
async def get_user_skills(user_id: int, current_user=Depends(get_current_user)):
    """Get user skills — self or admin access only."""
    logger.debug(f"BACKEND: GET /users/{user_id}/skills - User skills request")

    # SECURITY: Only the user themselves or an admin can view skills
    if current_user.role not in ["ADMIN"] and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.auth.insufficient_permissions",
        )

    skills = await prisma.userskill.find_many(where={"userId": user_id})

    return skills


@router.post("/users/me/skills", response_model=UserSkillResponse)
async def add_user_skill(
    skill_data: UserSkillCreate, current_user=Depends(get_user_lightweight)
):
    """Add user skill - ultra-fast optimized version"""
    user_id = current_user.id
    skill_name = skill_data.name.strip()

    try:
        # Single create operation - let database handle uniqueness
        new_skill = await prisma.userskill.create(
            data={"userId": user_id, "name": skill_name}
        )

        # Non-blocking background update (doesn't wait for response)
        # This improves perceived performance significantly
        import asyncio

        asyncio.create_task(_update_user_skills_array(user_id, skill_name))

        return new_skill

    except Exception as e:
        error_msg = str(e).lower()
        # Check for duplicate/unique constraint violations
        if any(
            keyword in error_msg for keyword in ["unique", "duplicate", "constraint"]
        ):
            raise HTTPException(status_code=400, detail="Skill already exists")
        raise HTTPException(status_code=500, detail="Failed to add skill")


async def _update_user_skills_array(user_id: int, skill_name: str):
    """Background task to update user skills array - non-blocking"""
    try:
        await prisma.user.update(
            where={"id": user_id}, data={"skills": {"push": skill_name}}
        )
    except Exception:
        # Silently fail - user's skill was created successfully
        pass


@router.delete("/users/me/skills/{skill_id}")
async def delete_user_skill(skill_id: int, current_user=Depends(get_user_lightweight)):
    """Delete user skill - verifies ownership before deletion"""
    user_id = current_user.id

    try:
        # Verify ownership BEFORE deleting (prevents TOCTOU race condition)
        skill = await prisma.userskill.find_unique(where={"id": skill_id})

        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")

        if skill.userId != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")

        # Safe to delete — ownership confirmed
        await prisma.userskill.delete(where={"id": skill_id})

        # Non-blocking background update
        asyncio.create_task(_remove_skill_from_array(user_id, skill.name))

        return {"message": "Skill deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e).lower()
        if "not found" in error_msg or "no record" in error_msg:
            raise HTTPException(status_code=404, detail="Skill not found")
        raise HTTPException(status_code=500, detail="Failed to delete skill")


async def _remove_skill_from_array(user_id: int, skill_name: str):
    """Background task to remove skill from user array - non-blocking"""
    try:
        user = await prisma.user.find_unique(where={"id": user_id})
        if user and user.skills:
            updated_skills = [s for s in user.skills if s != skill_name]
            await prisma.user.update(
                where={"id": user_id}, data={"skills": {"set": updated_skills}}
            )
    except Exception:
        pass  # Silently fail - skill was deleted successfully


# ======================
# PUBLIC PROFILE ENDPOINTS
# ======================


@router.get("/users/{user_id}/public", response_model=PublicUserProfileResponse)
async def get_user_public_profile(
    user_id: int,
    current_user=Depends(get_current_user_optional),
):
    """Get public profile for any user — privacy-enforced.

    Enforces profile_visibility and per-section visibility settings.
    Returns 404 if profile is PRIVATE, blocked, or not found.
    """
    logger.debug(f"BACKEND: GET /users/{user_id}/public - Public profile request")

    user = await prisma.user.find_unique(
        where={"id": user_id, "isActive": True, "deletedAt": None},
        include={
            "certificates": {"include": {"module": True}},
            "instructedModules": True,
            "skillsDetails": True,
        },
    )

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    requesting_id = current_user.id if current_user else None
    resolver = ProfileVisibilityResolver(user_id, requesting_id)

    if not await resolver.can_view_profile():
        raise HTTPException(status_code=404, detail="User not found")

    bio = getattr(user, "bio", None) if await resolver.can_view_section("bio") else None
    skills = (
        getattr(user, "skills", []) if await resolver.can_view_section("skills") else []
    )
    country = (
        getattr(user, "country", None)
        if await resolver.can_view_section("country")
        else None
    )
    city = (
        getattr(user, "city", None) if await resolver.can_view_section("city") else None
    )
    social_links = (
        getattr(user, "socialLinks", None)
        if await resolver.can_view_section("contact_info")
        else None
    )
    certificates = (
        getattr(user, "certificates", [])
        if await resolver.can_view_section("certificates")
        else []
    )

    return PublicUserProfileResponse(
        id=getattr(user, "id", user_id),
        fullName=getattr(user, "fullName", None) or "User",
        bio=bio,
        profilePictureUrl=getattr(user, "profilePictureUrl", None),
        country=country,
        city=city,
        skills=skills or [],
        socialLinks=social_links,
        role=getattr(user, "role", "STUDENT"),
        createdAt=getattr(user, "createdAt", None) or datetime.now(timezone.utc),
        certificates=certificates or [],
        instructedModules=(
            getattr(user, "instructedModules", [])
            if await resolver.can_view_section("teaching")
            else []
        ),
        skillsDetails=(
            getattr(user, "skillsDetails", [])
            if await resolver.can_view_section("skills")
            else []
        ),
    )


@router.get("/users/{user_id}")
async def get_user(user_id: int, current_user=Depends(get_current_user)):
    """
    Get user by ID.
    - Admin users: full details with all relations.
    - Non-admin users requesting their own profile: full details.
    - Non-admin users requesting another user: public fields only.
    """
    logger.debug(
        f"BACKEND: GET /users/{user_id} - User details request by user {current_user.id}"
    )

    # Non-admin requesting another user's data → return public profile only
    if current_user.role != "ADMIN" and current_user.id != user_id:
        user = await prisma.user.find_unique(
            where={"id": user_id, "isActive": True, "deletedAt": None},
            include={
                "certificates": {"include": {"module": True}},
                "instructedModules": True,
                "skillsDetails": True,
            },
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return PublicUserProfileResponse(
            id=user.id,
            fullName=user.fullName,
            bio=user.bio,
            profilePictureUrl=user.profilePictureUrl,
            country=user.country,
            city=user.city,
            skills=user.skills,
            socialLinks=user.socialLinks,
            role=user.role,
            createdAt=user.createdAt,
            certificates=user.certificates,
            instructedModules=user.instructedModules,
            skillsDetails=user.skillsDetails,
        )

    # Admin or self → full details
    user = await prisma.user.find_unique(
        where={"id": user_id},
        include={
            "certificates": True,
            "enrollments": True,
            "projects": True,
            "proposals": True,
            "datasets": True,
            "dashboards": True,
            "skillsDetails": True,
            "ownedOrganizations": True,
            "primaryOrganization": True,
            "memberships": {"include": {"organization": True}},
        },
    )

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


# ======================
# STATS AND ANALYTICS
# ======================


@router.get("/users/{user_id}/stats")
async def get_user_stats(user_id: int, current_user=Depends(get_current_user)):
    """Get user statistics — requires authentication. Non-admin users can only view their own stats."""
    # Non-admin users can only access their own stats
    if current_user.role not in ["ADMIN", "INSTRUCTOR"] and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    logger.debug(f"BACKEND: GET /users/{user_id}/stats - User stats request")

    return await _compute_user_stats(user_id)


async def _compute_user_stats(user_id: int):
    """Internal helper — compute stats for a given user ID."""

    # Run all counts in parallel for speed
    (
        total_courses,
        completed_courses,
        total_projects,
        certificates_count,
        dashboards_count,
        datasets_count,
        proposals_count,
        contracts_as_freelancer,
        contracts_as_client,
        organizations_count,
        insights_count,
        ml_models_count,
    ) = await asyncio.gather(
        prisma.enrollment.count(where={"userId": user_id}),
        prisma.enrollment.count(
            where={"userId": user_id, "completedAt": {"not": None}}
        ),
        prisma.project.count(where={"ownerId": user_id}),
        prisma.certificate.count(where={"userId": user_id}),
        prisma.dashboard.count(where={"ownerId": user_id}),
        prisma.dataset.count(where={"userId": user_id}),
        prisma.proposal.count(where={"freelancerId": user_id}),
        prisma.contract.count(where={"freelancerId": user_id}),
        prisma.contract.count(where={"clientId": user_id}),
        prisma.organizationmember.count(where={"userId": user_id}),
        prisma.insight.count(where={"userId": user_id}),
        prisma.mlmodel.count(where={"creatorId": user_id}),
    )

    # Freelancer profile (tier, earnings)
    freelancer_profile = await prisma.freelancerprofile.find_unique(
        where={"userId": user_id}
    )

    # Wallet balance
    wallet = await prisma.wallet.find_unique(where={"userId": user_id})

    # Active subscription
    active_sub = await prisma.subscription.find_first(
        where={"userId": user_id, "status": "ACTIVE"}, order={"startedAt": "desc"}
    )

    # Completed projects count
    completed_projects = await prisma.project.count(
        where={"ownerId": user_id, "status": "COMPLETED"}
    )

    return {
        "totalCourses": total_courses,
        "completedCourses": completed_courses,
        "ongoingCourses": total_courses - completed_courses,
        "totalProjects": total_projects,
        "completedProjects": completed_projects,
        "activeProjects": total_projects - completed_projects,
        "totalEarnings": freelancer_profile.totalEarned if freelancer_profile else 0,
        "thisMonthEarnings": 0,
        "dashboardsCount": dashboards_count,
        "datasetsCount": datasets_count,
        "certificatesCount": certificates_count,
        "organizationsCount": organizations_count,
        "insightsCount": insights_count,
        "mlModelsCount": ml_models_count,
        "proposalsCount": proposals_count,
        "contractsCount": contracts_as_freelancer + contracts_as_client,
        "contractsAsFreelancer": contracts_as_freelancer,
        "contractsAsClient": contracts_as_client,
        "freelancerTier": freelancer_profile.tier if freelancer_profile else None,
        "freelancerVerified": freelancer_profile.isVerified
        if freelancer_profile
        else False,
        "walletBalance": wallet.podaPoints if wallet else 0,
        "walletCurrency": wallet.currency if wallet else "DZD",
        "activeSubscriptionPlan": active_sub.plan if active_sub else None,
        "subscriptionStatus": active_sub.status if active_sub else None,
    }


@router.get("/users/me/projects")
async def get_my_projects(current_user=Depends(get_current_user)):
    """Get current user's owned projects"""
    logger.debug("BACKEND: GET /users/me/projects - My projects request")

    projects = await prisma.project.find_many(
        where={"ownerId": current_user.id, "deletedAt": None},
        order={"createdAt": "desc"},
        take=50,
    )

    return [
        {
            "id": p.id,
            "title": p.title,
            "description": p.description,
            "skills": p.skills or [],
            "status": p.status,
            "createdAt": p.createdAt.isoformat() if p.createdAt else None,
            "updatedAt": p.updatedAt.isoformat() if p.updatedAt else None,
            "budget": p.budget,
            "currency": p.currency,
        }
        for p in projects
    ]


@router.get("/dashboard/summary")
async def get_dashboard_summary(current_user=Depends(get_current_user)):
    """Get dashboard summary for current user"""
    logger.debug("BACKEND: GET /dashboard/summary - Dashboard summary request")

    return await _compute_user_stats(current_user.id)


from app.services.phone_verification_service import phone_verification_service
from app.schemas.users import PhoneVerificationCodeRequest, PhoneVerificationResponse


# Add these endpoints to your router
@router.post("/auth/verify-phone/request", response_model=VerificationResponse)
async def request_phone_verification(current_user=Depends(get_current_user)):
    """Request phone verification SMS - uses current user's phone number"""
    logger.debug("BACKEND: POST /auth/verify-phone/request")
    logger.debug(f"BACKEND: Current user ID: {current_user.id}")
    logger.debug(f"BACKEND: Current user phone: {current_user.phoneNumber}")

    # Use the user's current phone number from the database
    phone_to_verify = current_user.phoneNumber

    if not phone_to_verify:
        raise HTTPException(
            status_code=400,
            detail="No phone number associated with this account. Please add a phone number in your account settings first.",
        )

    logger.debug(f"BACKEND: Verifying phone: {phone_to_verify}")

    # Check rate limiting
    if await phone_verification_service.is_rate_limited(phone_to_verify):
        raise HTTPException(
            status_code=429,
            detail="Too many verification attempts. Please try again later.",
        )

    try:
        # Generate verification code
        verification_code = (
            await phone_verification_service.generate_verification_code()
        )

        logger.debug(f"BACKEND: Generated code: {verification_code}")

        # Store code in database - NO user_id parameter
        await phone_verification_service.store_verification_code(
            phone_to_verify, verification_code
        )

        # Send SMS
        sms_sent = await phone_verification_service.send_sms_verification(
            phone_to_verify, verification_code
        )

        if not sms_sent:
            raise HTTPException(
                status_code=500, detail="Failed to send SMS verification"
            )

        logger.info(f"BACKEND: Phone verification code sent to {phone_to_verify}")
        return VerificationResponse(
            message="Verification code sent successfully",
            verification_sent=True,
            method="sms",
        )

    except Exception as e:
        logger.error(f"BACKEND: ERROR sending phone verification: {str(e)}")
        import traceback

        logger.error(f"TRACEBACK:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to send verification code")


@router.post("/auth/verify-phone/code", response_model=PhoneVerificationResponse)
async def verify_phone_code(
    request_data: PhoneVerificationCodeRequest, current_user=Depends(get_current_user)
):
    """Verify phone number with code"""
    logger.debug(
        f"BACKEND: POST /auth/verify-phone/code - Verify code for: {request_data.phoneNumber}"
    )

    try:
        # Validate the code
        is_valid = await phone_verification_service.validate_verification_code(
            request_data.phoneNumber, request_data.code
        )

        if is_valid:
            # Update user's phone verification status
            await prisma.user.update(
                where={"id": current_user.id}, data={"phoneVerified": True}
            )

            logger.info(f"BACKEND: Phone number verified for user {current_user.id}")
            return PhoneVerificationResponse(
                success=True,
                message="Phone number verified successfully",
                verified=True,
                phoneNumber=request_data.phoneNumber,
            )
        else:
            logger.error(
                f"BACKEND: Invalid verification code for {request_data.phoneNumber}"
            )
            return PhoneVerificationResponse(
                success=False,
                message="Invalid or expired verification code",
                verified=False,
                phoneNumber=request_data.phoneNumber,
            )

    except Exception as e:
        logger.error(f"BACKEND: ERROR verifying phone code: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to verify phone code")


@router.post("/auth/verify-phone/resend", response_model=VerificationResponse)
async def resend_phone_verification(
    request_data: PhoneVerificationRequest, current_user=Depends(get_current_user)
):
    """Resend phone verification code"""
    logger.debug(
        f"BACKEND: POST /auth/verify-phone/resend - Resend code for: {request_data.phoneNumber}"
    )

    # Check rate limiting
    if await phone_verification_service.is_rate_limited(request_data.phoneNumber):
        raise HTTPException(
            status_code=429,
            detail="Too many verification attempts. Please try again later.",
        )

    try:
        # Generate new verification code
        verification_code = (
            await phone_verification_service.generate_verification_code()
        )

        # Store new code in database
        await phone_verification_service.store_verification_code(
            request_data.phoneNumber, verification_code
        )

        # Send SMS
        sms_sent = await phone_verification_service.send_sms_verification(
            request_data.phoneNumber, verification_code
        )

        if not sms_sent:
            raise HTTPException(
                status_code=500, detail="Failed to send SMS verification"
            )

        logger.info(
            f"BACKEND: Phone verification code resent to {request_data.phoneNumber}"
        )
        return VerificationResponse(
            message="Verification code resent successfully",
            verificationSent=True,
            method="sms",
        )

    except Exception as e:
        logger.error(f"BACKEND: ERROR resending phone verification: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Failed to resend verification code"
        )


# Add these imports at the top
from app.schemas.users import ContactFormRequest, ContactFormResponse


async def get_current_user_optional(token: Optional[str] = None) -> Optional[Any]:
    """
    Optional authentication - returns user if authenticated, None otherwise.
    Doesn't throw error if no token provided.
    """
    if not token:
        return None

    try:
        # Use the existing JWT verification from security module
        from app.core.security import verify_token

        payload = verify_token(token)
        if payload:
            user_id = payload.get("sub")
            if user_id:
                user = await prisma.user.find_unique(where={"id": int(user_id)})
                return user
    except Exception as e:
        logger.warning(f"Optional auth failed (but that's OK): {str(e)}")
        return None

    return None


@router.post("/contact", response_model=ContactFormResponse)
async def submit_contact_form(
    contact_data: ContactFormRequest,
    background_tasks: BackgroundTasks,
    request: Request,  # Add Request parameter to access headers
    current_user: Optional[Any] = None,  # Make it explicitly Optional
):
    """
    Submit contact form message (works for both authenticated and non-authenticated users)

    **Authentication is optional** - if provided, user info will be included in the email.
    """
    logger.debug(
        f"BACKEND: POST /contact - Contact form from: {contact_data.name} <{contact_data.email}>"
    )

    # Try to get user from token if provided
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "")
        try:
            # Use the existing JWT verification from security module
            from app.core.security import verify_token

            payload = verify_token(token)
            if payload:
                user_id = payload.get("sub")
                if user_id:
                    current_user = await prisma.user.find_unique(
                        where={"id": int(user_id)}
                    )
                    logger.debug(
                        f"BACKEND: User authenticated: {current_user.fullName} (ID: {current_user.id})"
                    )
        except Exception as e:
            logger.warning(f"BACKEND: Token decoding failed (but that's OK): {str(e)}")
            current_user = None
    else:
        logger.debug("BACKEND: No authentication token provided")
        current_user = None

    try:
        # Prepare email content with user context if authenticated
        enhanced_subject = contact_data.subject or "Contact Form Submission"
        enhanced_message = contact_data.message

        if current_user:
            enhanced_subject = f"[Auth User] {enhanced_subject}"
            enhanced_message = (
                f"🔐 SUBMITTED BY AUTHENTICATED USER\n"
                f"User ID: {current_user.id}\n"
                f"Name in DB: {current_user.fullName or 'N/A'}\n"
                f"Email in DB: {current_user.email}\n\n"
                f"--- CONTACT FORM MESSAGE ---\n\n"
                f"{enhanced_message}"
            )
        else:
            enhanced_subject = f"[Public] {enhanced_subject}"
            enhanced_message = (
                f"🌐 PUBLIC SUBMISSION (No authentication)\n\n"
                f"--- CONTACT FORM MESSAGE ---\n\n"
                f"{enhanced_message}"
            )

        # Add contact form metadata
        enhanced_message += "\n\n--- CONTACT DETAILS ---\n"
        enhanced_message += f"Name: {contact_data.name}\n"
        enhanced_message += f"Email: {contact_data.email}\n"
        if contact_data.phone:
            enhanced_message += f"Phone: {contact_data.phone}\n"
        if contact_data.category:
            enhanced_message += f"Category: {contact_data.category}\n"
        enhanced_message += f"Submission Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"

        # Send email in background
        background_tasks.add_task(
            send_contact_email_async,
            name=contact_data.name,
            email=contact_data.email,
            subject=enhanced_subject,
            message=enhanced_message,
            phone=contact_data.phone,
            category=contact_data.category,
        )

        # Prepare success message
        if current_user:
            success_message = f"Thank you {current_user.fullName or contact_data.name}! Your message has been sent. We'll respond to {contact_data.email} within 24-48 hours."
        else:
            success_message = f"Thank you {contact_data.name}! Your message has been sent successfully. We'll respond to {contact_data.email} within 24-48 hours."

        logger.info("Contact form queued for email delivery")

        return ContactFormResponse(
            success=True,
            message=success_message,
            submitted_at=datetime.now(timezone.utc),
        )

    except Exception as e:
        logger.error(f"BACKEND: ERROR in contact form: {str(e)}")
        import traceback

        logger.error(f"TRACEBACK:\n{traceback.format_exc()}")

        raise HTTPException(
            status_code=500,
            detail="Failed to submit contact form. Please try again later.",
        )


async def send_contact_email_async(
    name: str,
    email: str,
    subject: str,
    message: str,
    phone: Optional[str] = None,
    category: Optional[str] = None,
):
    """
    Async wrapper to send contact email using your email_service.
    This runs in the background[citation:1].
    """
    try:
        # Use your existing email service
        await email_service.send_contact_email(
            name=name,
            email=email,
            message=message,
            phone=phone,
            subject=subject,
            category=category,
            reply_to_admin=False,  # Set to False to allow direct reply to the user's email
        )
        logger.debug(f"Contact email sent successfully from {email}")
    except Exception as e:
        logger.error(f"Failed to send contact email: {str(e)}")
        # Don't raise here since this runs in background
