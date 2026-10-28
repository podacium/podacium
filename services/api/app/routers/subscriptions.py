import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_active_user
from app.schemas.payment import (
    SubscriptionResponse, SubscriptionCreateRequest,
    SubscriptionPlan, SubscriptionStatus
)
from app.services.subscription_billing_service import subscription_service
from app.core.prisma import prisma

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])
logger = logging.getLogger(__name__)

@router.post("/", response_model=SubscriptionResponse)
async def create_subscription(
    request: SubscriptionCreateRequest,
    current_user=Depends(get_current_active_user)
):
    """Create a new subscription"""
    try:
        # Ensure user can only create for themselves unless admin
        if request.user_id and request.user_id != current_user.id and current_user.role not in ["ADMIN", "INSTRUCTOR"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create subscription for other users"
            )
        
        if request.organization_id:
            # Check organization membership
            membership = await prisma.organizationmember.find_first(
                where={
                    "organizationId": request.organization_id,
                    "userId": current_user.id,
                    "role": {"in": ["OWNER", "ADMIN"]}
                }
            )
            if not membership and current_user.role not in ["ADMIN"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to create subscription for this organization"
                )
        
        # Set user_id if not provided (default to current user)
        if not request.user_id and not request.organization_id:
            request.user_id = current_user.id
        
        # Create subscription
        subscription = await subscription_service.create_subscription(request)
        
        return subscription
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create subscription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create subscription"
        )

@router.get("/me", response_model=List[SubscriptionResponse])
async def get_my_subscriptions(
    include_inactive: bool = False,
    current_user=Depends(get_current_active_user)
):
    """Get current user's subscriptions"""
    try:
        subscriptions = await subscription_service.get_user_subscriptions(
            current_user.id, include_inactive
        )
        
        return subscriptions
        
    except Exception as e:
        logger.error(f"Failed to get user subscriptions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_subscriptions_list"
        )

@router.get("/organization/{org_id}", response_model=List[SubscriptionResponse])
async def get_organization_subscriptions(
    org_id: int,
    include_inactive: bool = False,
    current_user=Depends(get_current_active_user)
):
    """Get organization subscriptions"""
    try:
        # Check organization membership or admin access
        membership = await prisma.organizationmember.find_first(
            where={
                "organizationId": org_id,
                "userId": current_user.id
            }
        )
        
        if not membership and current_user.role not in ["ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view organization subscriptions"
            )
        
        subscriptions = await subscription_service.get_organization_subscriptions(
            org_id, include_inactive
        )
        
        return subscriptions
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get organization subscriptions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_subscriptions_list"
        )

@router.get("/pricing")
async def get_public_pricing():
    """Public endpoint: Get all pricing data from config tables (single source of truth).
    Used by the pricing page and billing page to display consistent prices."""
    try:
        # Fetch subscription tiers
        tiers = await prisma.subscriptiontierconfig.find_many(
            where={"isActive": True},
            order={"sortOrder": "asc"}
        )
        
        # Fetch commission rates
        commission_rates = await prisma.commissionrateconfig.find_many(
            where={"isActive": True},
            order={"tier": "asc"}
        )
        
        # Format tiers by category
        edtech_plans = []
        bi_plans = []
        
        for tier in tiers:
            plan_data = {
                "plan": tier.plan,
                "name": tier.name,
                "description": tier.description,
                "price": tier.price,
                "yearly_price": tier.yearlyPrice,
                "billing_cycle": tier.billingCycle,
                "max_courses": tier.maxCourses,
                "max_storage_mb": tier.maxStorage,
                "max_students": tier.maxStudents,
                "max_datasets": tier.maxDatasets,
                "max_dashboards": tier.maxDashboards,
                "max_api_calls": tier.maxApiCalls,
                "features": tier.features,
                "trial_days": tier.trialDays,
                "sort_order": tier.sortOrder,
            }
            if tier.category == "EDTECH":
                edtech_plans.append(plan_data)
            else:
                bi_plans.append(plan_data)
        
        # Format commission rates
        freelance_rates = [
            {
                "key": "freelance",
                "tier": rate.tier,
                "commission_percent": rate.commissionPercent,
                "min_project": rate.minProject,
                "max_project": rate.maxProject,
                "description": rate.description,
            }
            for rate in commission_rates
        ]
        
        return {
            "edtech": edtech_plans,
            "bi": bi_plans,
            "freelance": freelance_rates,
            "currency": "DZD",
        }
    except Exception as e:
        logger.error(f"Failed to get public pricing: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_pricing"
        )


@router.get("/plans/{plan}/features")
async def get_plan_features(plan: SubscriptionPlan):
    """Get features for a specific plan from the SubscriptionTierConfig table."""
    try:
        # Try to get from config table first (single source of truth)
        config = await prisma.subscriptiontierconfig.find_first(
            where={"plan": plan.value, "isActive": True}
        )
        
        if config:
            features = {
                "max_courses": config.maxCourses,
                "max_storage_mb": config.maxStorage,
                "max_students": config.maxStudents,
                "max_datasets": config.maxDatasets,
                "max_dashboards": config.maxDashboards,
                "max_api_calls": config.maxApiCalls,
                "trial_days": config.trialDays,
                "custom_features": config.features,
            }
            # Remove None values
            features = {k: v for k, v in features.items() if v is not None}
            
            return {
                "plan": plan.value,
                "name": config.name,
                "description": config.description,
                "category": config.category,
                "price": config.price,
                "yearly_price": config.yearlyPrice,
                "billing_cycle": config.billingCycle,
                "features": features,
                "is_active": config.isActive,
                "trial_days": config.trialDays,
            }
        
        # Fallback to hardcoded if config not found
        features = subscription_service.PLAN_FEATURES.get(plan, {})
        price = subscription_service.PLAN_PRICES.get(plan, 0)
        
        return {
            "plan": plan.value,
            "price": price,
            "features": features,
            "billing_cycles": ["monthly", "yearly"],
        }
        
    except Exception as e:
        logger.error(f"Failed to get plan features: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_features"
        )


@router.get("/plans/all")
async def get_all_plans():
    """Get all available subscription plans from the SubscriptionTierConfig table (single source of truth)."""
    try:
        # Read from config table — this is the single source of truth set by admin
        configs = await prisma.subscriptiontierconfig.find_many(
            where={"isActive": True},
            order={"sortOrder": "asc"}
        )
        
        if configs:
            plans = []
            for config in configs:
                features = {
                    "max_courses": config.maxCourses,
                    "max_storage_mb": config.maxStorage,
                    "max_students": config.maxStudents,
                    "max_datasets": config.maxDatasets,
                    "max_dashboards": config.maxDashboards,
                    "max_api_calls": config.maxApiCalls,
                    "trial_days": config.trialDays,
                    "custom_features": config.features,
                }
                features = {k: v for k, v in features.items() if v is not None}
                
                plans.append({
                    "plan": config.plan,
                    "name": config.name,
                    "description": config.description,
                    "category": config.category,
                    "price": config.price,
                    "yearly_price": config.yearlyPrice,
                    "billing_cycle": config.billingCycle,
                    "features": features,
                    "is_active": config.isActive,
                    "trial_days": config.trialDays,
                    "sort_order": config.sortOrder,
                })
            return {"plans": plans}
        
        # Fallback to hardcoded prices if config table is empty
        return subscription_service.get_all_fallback_plans()
    except Exception as e:
        logger.error(f"Failed to get all plans: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_plans"
        )


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
async def get_subscription(
    subscription_id: int,
    current_user=Depends(get_current_active_user)
):
    """Get subscription by ID"""
    try:
        subscription = await subscription_service.get_subscription(subscription_id)
        
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.billing.subscription_not_found"
            )
        
        # Check authorization
        if subscription.user_id and subscription.user_id != current_user.id and current_user.role not in ["ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.billing.not_authorized_subscription"
            )
        
        if subscription.organization_id:
            # Check organization membership
            membership = await prisma.organizationmember.find_first(
                where={
                    "organizationId": subscription.organization_id,
                    "userId": current_user.id
                }
            )
            if not membership and current_user.role not in ["ADMIN"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="errors.billing.not_authorized_subscription"
                )
        return subscription

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get subscription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_subscription"
        )

@router.put("/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: int,
    plan: Optional[SubscriptionPlan] = None,
    auto_renew: Optional[bool] = None,
    current_user=Depends(get_current_active_user)
):
    """Update subscription plan or settings"""
    try:
        subscription = await subscription_service.get_subscription(subscription_id)
        
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.billing.subscription_not_found"
            )
        
        # Check authorization
        if subscription.user_id and subscription.user_id != current_user.id and current_user.role not in ["ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.billing.not_authorized_subscription"
            )
        
        if subscription.organization_id:
            membership = await prisma.organizationmember.find_first(
                where={
                    "organizationId": subscription.organization_id,
                    "userId": current_user.id,
                    "role": {"in": ["OWNER", "ADMIN"]}
                }
            )
            if not membership and current_user.role not in ["ADMIN"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="errors.billing.not_authorized_subscription"
                )
        
        # Update subscription
        updated = await subscription_service.update_subscription(
            subscription_id, plan, auto_renew
        )
        
        return updated
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update subscription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_update_subscription"
        )

@router.post("/{subscription_id}/cancel")
async def cancel_subscription(
    subscription_id: int,
    immediate: bool = False,
    current_user=Depends(get_current_active_user)
):
    """Cancel subscription"""
    try:
        subscription = await subscription_service.get_subscription(subscription_id)
        
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.billing.subscription_not_found"
            )
        
        # Check authorization
        if subscription.user_id and subscription.user_id != current_user.id and current_user.role not in ["ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.billing.not_authorized_cancel"
            )
        
        if subscription.organization_id:
            membership = await prisma.organizationmember.find_first(
                where={
                    "organizationId": subscription.organization_id,
                    "userId": current_user.id,
                    "role": {"in": ["OWNER", "ADMIN"]}
                }
            )
            if not membership and current_user.role not in ["ADMIN"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="errors.billing.not_authorized_cancel"
                )
        
        # Cancel subscription
        cancelled = await subscription_service.cancel_subscription(
            subscription_id, immediate
        )
        
        return {
            "success": True,
            "subscription_id": subscription_id,
            "status": cancelled.status,
            "ends_at": cancelled.ends_at,
            "message": "Subscription cancelled successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel subscription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_cancel_subscription"
        )

@router.post("/{subscription_id}/pause")
async def pause_subscription(
    subscription_id: int,
    current_user=Depends(get_current_active_user)
):
    """Pause subscription"""
    try:
        subscription = await subscription_service.get_subscription(subscription_id)
        
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.billing.subscription_not_found"
            )
        
        # Check authorization
        if subscription.user_id and subscription.user_id != current_user.id and current_user.role not in ["ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.billing.not_authorized_pause"
            )
        
        if subscription.organization_id:
            membership = await prisma.organizationmember.find_first(
                where={
                    "organizationId": subscription.organization_id,
                    "userId": current_user.id,
                    "role": {"in": ["OWNER", "ADMIN"]}
                }
            )
            if not membership and current_user.role not in ["ADMIN"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="errors.billing.not_authorized_pause"
                )
        
        # Pause subscription
        paused = await subscription_service.pause_subscription(subscription_id)
        
        return {
            "success": True,
            "subscription_id": subscription_id,
            "status": paused.status,
            "message": "Subscription paused successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to pause subscription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_pause_subscription"
        )

@router.post("/{subscription_id}/resume")
async def resume_subscription(
    subscription_id: int,
    current_user=Depends(get_current_active_user)
):
    """Resume paused subscription"""
    try:
        subscription = await subscription_service.get_subscription(subscription_id)
        
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.billing.subscription_not_found"
            )
        
        # Check authorization
        if subscription.user_id and subscription.user_id != current_user.id and current_user.role not in ["ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.billing.not_authorized_resume"
            )
        
        if subscription.organization_id:
            membership = await prisma.organizationmember.find_first(
                where={
                    "organizationId": subscription.organization_id,
                    "userId": current_user.id,
                    "role": {"in": ["OWNER", "ADMIN"]}
                }
            )
            if not membership and current_user.role not in ["ADMIN"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="errors.billing.not_authorized_resume"
                )
        
        # Resume subscription
        resumed = await subscription_service.resume_subscription(subscription_id)
        
        return {
            "success": True,
            "subscription_id": subscription_id,
            "status": resumed.status,
            "message": "Subscription resumed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resume subscription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_resume_subscription"
        )


@router.get("/check-access/{feature}")
async def check_feature_access(
    feature: str,
    organization_id: Optional[int] = None,
    current_user=Depends(get_current_active_user)
):
    """Check if user/organization has access to a feature"""
    try:
        has_access = await subscription_service.check_subscription_access(
            user_id=current_user.id if not organization_id else None,
            organization_id=organization_id,
            feature=feature
        )
        
        return {
            "has_access": has_access,
            "user_id": current_user.id if not organization_id else None,
            "organization_id": organization_id,
            "feature": feature
        }
        
    except Exception as e:
        logger.error(f"Failed to check feature access: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_check_access"
        )

# Admin endpoints
@router.get("/admin/all", response_model=List[SubscriptionResponse])
async def admin_get_all_subscriptions(
    user_id: Optional[int] = None,
    organization_id: Optional[int] = None,
    plan: Optional[SubscriptionPlan] = None,
    status: Optional[SubscriptionStatus] = None,
    limit: int = 100,
    offset: int = 0,
    current_user=Depends(get_current_active_user)
):
    """Admin: Get all subscriptions (requires admin role)"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.admin.access_required"
        )
    
    try:
        where_clause = {}
        
        if user_id:
            where_clause["userId"] = user_id
        
        if organization_id:
            where_clause["organizationId"] = organization_id
        
        if plan:
            where_clause["plan"] = plan.value
        
        if status:
            where_clause["status"] = status.value
        
        subscriptions = await prisma.subscription.find_many(
            where=where_clause,
            include={"user": True, "organization": True},
            order={"startedAt": "desc"},
            take=limit,
            skip=offset
        )
        
        return [SubscriptionResponse.from_orm(sub) for sub in subscriptions]
        
    except Exception as e:
        logger.error(f"Admin failed to get subscriptions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_subscriptions_list"
        )

@router.post("/admin/process-renewals")
async def admin_process_renewals(current_user=Depends(get_current_active_user)):
    """Admin: Manually trigger subscription renewal processing"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.admin.access_required"
        )
    
    try:
        # Process renewals
        await subscription_service.process_renewals()
        
        return {
            "success": True,
            "message": "Subscription renewals processing triggered"
        }
        
    except Exception as e:
        logger.error(f"Admin failed to process renewals: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_process_renewals"
        )


# -------------------------------------------------------------------------
# TamWheel Founder SaaS OS Subscription & Entitlement Endpoints (Section 10)
# -------------------------------------------------------------------------
from app.services.saas_subscription import saas_subscription_engine
from app.schemas.saas_subscription import (
    SaaSTier,
    SaaSFeature,
    SaaSPlanCatalogResponse,
    StartupSubscriptionResponse,
    SaaSPlanUpgradeRequest,
    EntitlementCheckResult,
    ValidateStakeholdersRequest,
    ValidateStorageRequest,
)


@router.get("/saas/plans", response_model=SaaSPlanCatalogResponse)
async def get_saas_plan_catalog():
    """Retrieve full catalog of Founder SaaS OS pricing tiers (Genesis, Seed OS, Growth OS, Enterprise OS)."""
    return saas_subscription_engine.get_plan_catalog()


@router.get("/saas/startups/{startup_id}", response_model=StartupSubscriptionResponse)
async def get_startup_saas_subscription(
    startup_id: str,
    current_user=Depends(get_current_active_user),
):
    """Retrieve current Founder OS subscription plan, usage limits, and renewal dates."""
    return saas_subscription_engine.get_subscription_response(startup_id)


@router.post("/saas/startups/{startup_id}/upgrade", response_model=StartupSubscriptionResponse)
async def upgrade_startup_saas_subscription(
    startup_id: str,
    req: SaaSPlanUpgradeRequest,
    current_user=Depends(get_current_active_user),
):
    """Upgrade startup Founder OS plan tier (e.g. Genesis -> Seed OS -> Growth OS -> Enterprise OS)."""
    return saas_subscription_engine.upgrade_subscription(
        startup_id=startup_id,
        target_tier=req.target_tier,
        billing_cycle=req.billing_cycle,
    )


@router.get("/saas/startups/{startup_id}/entitlements/{feature}", response_model=EntitlementCheckResult)
async def check_startup_feature_entitlement(
    startup_id: str,
    feature: SaaSFeature,
    current_user=Depends(get_current_active_user),
):
    """Check feature entitlement status under active subscription plan."""
    return saas_subscription_engine.validate_feature_access(startup_id, feature)


@router.post("/saas/startups/{startup_id}/validate-stakeholders", response_model=EntitlementCheckResult)
async def validate_startup_stakeholders(
    startup_id: str,
    req: ValidateStakeholdersRequest,
    current_user=Depends(get_current_active_user),
):
    """Validate whether candidate cap-table stakeholders exceed subscription limits."""
    return saas_subscription_engine.validate_stakeholder_capacity(startup_id, req.candidate_count)


@router.post("/saas/startups/{startup_id}/validate-storage", response_model=EntitlementCheckResult)
async def validate_startup_storage(
    startup_id: str,
    req: ValidateStorageRequest,
    current_user=Depends(get_current_active_user),
):
    """Validate whether file upload exceeds subscription VDR storage or tier allowances."""
    return saas_subscription_engine.validate_vdr_storage_capacity(
        startup_id=startup_id,
        additional_bytes=req.additional_bytes,
        document_tier=req.document_tier,
    )
