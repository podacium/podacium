from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from app.core.auth import get_current_active_user
from app.core.prisma import prisma
from app.schemas.billing_schemas.base import (
    ChangePlanRequest, CancelSubscriptionRequest, UsageSummaryResponse,
)
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone

router = APIRouter(prefix="/billing/subscriptions", tags=["subscriptions"])


# ── Response Models ───────────────────────────────────────────────────────────

class SubscriptionResponse(BaseModel):
    id: int
    plan: str
    status: str
    amount: int
    currency: str
    current_period_end: datetime = Field(alias="currentPeriodEnd")
    started_at: datetime = Field(alias="startedAt")
    cancelled_at: Optional[datetime] = Field(None, alias="cancelledAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ── Existing Endpoints ────────────────────────────────────────────────────────

@router.get("/my", response_model=List[SubscriptionResponse])
async def get_my_subscriptions(current_user=Depends(get_current_active_user)):
    """Get current user's active subscriptions"""
    try:
        subscriptions = await prisma.subscription.find_many(
            where={
                "userId": current_user.id,
                "status": "ACTIVE"
            },
            order={"createdAt": "desc"}
        )
        return subscriptions
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error: {str(e)}"
        ) from e


@router.get("/check/{plan}")
async def check_subscription(plan: str, current_user=Depends(get_current_active_user)):
    """Check if user has an active subscription to a specific plan"""
    subscription = await prisma.subscription.find_first(
        where={
            "userId": current_user.id,
            "plan": plan,
            "status": "ACTIVE",
            "currentPeriodEnd": {"gt": datetime.now(timezone.utc)}
        }
    )
    return {"active": subscription is not None, "plan": plan}


# ── Cancel Subscription ──────────────────────────────────────────────────────

@router.post("/cancel")
async def cancel_subscription(
    body: CancelSubscriptionRequest,
    current_user=Depends(get_current_active_user),
):
    """Cancel the user's active subscription."""
    from app.services.subscription_billing_service import subscription_service

    subscription = await prisma.subscription.find_first(
        where={"userId": current_user.id, "status": "ACTIVE"},
    )

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.billing.no_active_subscription",
        )

    result = await subscription_service.cancel_subscription(
        subscription.id, immediate=body.immediate
    )
    return {
        "success": True,
        "subscription_id": subscription.id,
        "ends_at": result.ends_at.isoformat() if hasattr(result, "ends_at") and result.ends_at else None,
    }


# ── Change Plan (Upgrade / Downgrade) ────────────────────────────────────────

@router.post("/change-plan")
async def change_plan(
    body: ChangePlanRequest,
    current_user=Depends(get_current_active_user),
):
    """Upgrade or downgrade the user's subscription plan."""
    from app.services.subscription_billing_service import subscription_service

    subscription = await prisma.subscription.find_first(
        where={"userId": current_user.id, "status": "ACTIVE"},
    )

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.billing.no_active_subscription",
        )

    if subscription.plan == body.new_plan.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="errors.billing.already_on_plan",
        )

    result = await subscription_service.update_subscription(
        subscription.id, plan=body.new_plan, auto_renew=None
    )
    return {
        "success": True,
        "subscription_id": subscription.id,
        "new_plan": body.new_plan.value,
        "amount": result.amount if hasattr(result, "amount") else None,
    }


# ── Usage Summary ─────────────────────────────────────────────────────────────

@router.get("/usage", response_model=UsageSummaryResponse)
async def get_usage_summary(current_user=Depends(get_current_active_user)):
    """Get current billing period usage vs limits."""
    from app.services.billing_services.usage_tracking_service import usage_tracking_service

    summary = await usage_tracking_service.get_usage_summary(current_user.id)
    return UsageSummaryResponse(**summary)


# ── Billing Overview ──────────────────────────────────────────────────────────

class BillingOverviewResponse(BaseModel):
    has_subscription: bool
    plan: Optional[str] = None
    billing_cycle: Optional[str] = None
    subscription_status: Optional[str] = None
    period_end: Optional[str] = None
    courses: dict = {}
    certificates: dict = {}
    courses_used: int = 0
    courses_total: int = 0
    courses_progress: float = 0.0
    certificates_earned: int = 0
    certificates_total: int = 0
    certificates_progress: float = 0.0
    wallet_balance: int = 0
    wallet_on_hold: int = 0
    recent_transactions: list = []
    payment_methods: list = []
    pending_renewals: list = []


@router.get("/overview")
async def get_billing_overview(current_user=Depends(get_current_active_user)):
    """Get comprehensive billing overview for the current user."""
    from app.services.billing_services.usage_tracking_service import usage_tracking_service
    from app.services.wallet_service import wallet_service

    # 1. Usage summary
    usage = await usage_tracking_service.get_usage_summary(current_user.id)

    # 2. Wallet balance
    wallet_balance = 0
    wallet_on_hold = 0
    try:
        wallet = await wallet_service.get_user_wallet(current_user.id)
        if wallet:
            wallet_balance = wallet.poda_points or 0
            wallet_on_hold = 0
    except Exception:
        pass

    # 3. Recent transactions (last 10)
    recent = await prisma.transaction.find_many(
        where={"userId": current_user.id},
        order={"createdAt": "desc"},
        take=10,
    )

    # 4. Pending renewal transactions (created by cron — have checkoutUrl)
    pending_renewals_data = await prisma.transaction.find_many(
        where={
            "userId": current_user.id,
            "status": "PENDING",
            "checkoutUrl": {"not": None},
        },
        order={"createdAt": "desc"},
        take=5,
    )

    # 5. Payment methods (stub — follow on for Stripe/Chargily card list)
    payment_methods = []

    # Query active subscription for extra details
    sub = await prisma.subscription.find_first(
        where={
            "userId": current_user.id,
            "status": "ACTIVE",
            "currentPeriodEnd": {"gt": datetime.now(timezone.utc)},
        },
        order={"createdAt": "desc"},
    )

    courses_data = usage.get("courses", {})
    certs_data = usage.get("certificates", {})
    courses_used = courses_data.get("used", 0)
    courses_total = courses_data.get("limit", 0)
    certs_used = certs_data.get("used", 0)
    certs_total = certs_data.get("limit", 0)

    return BillingOverviewResponse(
        has_subscription=usage.get("has_subscription", False),
        plan=usage.get("plan"),
        billing_cycle=usage.get("billing_cycle"),
        subscription_status=sub.status if sub else None,
        period_end=sub.currentPeriodEnd.isoformat() if sub and sub.currentPeriodEnd else None,
        courses=courses_data,
        certificates=certs_data,
        courses_used=courses_used,
        courses_total=courses_total,
        courses_progress=round((courses_used / courses_total * 100) if courses_total > 0 else 0, 1),
        certificates_earned=certs_used,
        certificates_total=certs_total,
        certificates_progress=round((certs_used / certs_total * 100) if certs_total > 0 else 0, 1),
        wallet_balance=wallet_balance,
        wallet_on_hold=wallet_on_hold,
        recent_transactions=[
            {
                "id": t.id,
                "amount": t.amount,
                "currency": t.currency or "DZD",
                "purpose": t.purpose,
                "status": t.status,
                "created_at": t.createdAt.isoformat() if t.createdAt else None,
                "checkout_url": t.checkoutUrl,
            }
            for t in recent
        ],
        payment_methods=payment_methods,
        pending_renewals=[
            {
                "id": t.id,
                "amount": t.amount,
                "currency": t.currency or "DZD",
                "purpose": t.purpose,
                "created_at": t.createdAt.isoformat() if t.createdAt else None,
                "checkout_url": t.checkoutUrl,
            }
            for t in pending_renewals_data
        ],
    )
