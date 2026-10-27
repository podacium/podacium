from typing import Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, model_validator


class SubscriptionPlan(str, Enum):
    FREE = "FREE"
    STUDENT_STARTER = "STUDENT_STARTER"
    STUDENT_PLUS = "STUDENT_PLUS"
    STUDENT_PRO = "STUDENT_PRO"
    BI_GROWTH = "BI_GROWTH"
    BI_SCALE = "BI_SCALE"
    BI_ELITE = "BI_ELITE"
    CUSTOM = "CUSTOM"
    FREELANCER_PLUS = "FREELANCER_PLUS"
    FREELANCER_PREMIUM = "FREELANCER_PREMIUM"
    BUSINESS_STARTER = "BUSINESS_STARTER"
    BUSINESS_PRO = "BUSINESS_PRO"
    BUSINESS_ENTERPRISE = "BUSINESS_ENTERPRISE"


class SubscriptionStatus(str, Enum):
    ACTIVE = "ACTIVE"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class PaymentPurpose(str, Enum):
    COURSE_PURCHASE = "COURSE_PURCHASE"
    PATH_PURCHASE = "PATH_PURCHASE"
    STUDENT_SUBSCRIPTION = "STUDENT_SUBSCRIPTION"
    BI_SUBSCRIPTION = "BI_SUBSCRIPTION"
    CONTRACT_PAYMENT = "CONTRACT_PAYMENT"
    REFUND = "REFUND"
    LIVE_SESSION_PURCHASE = "LIVE_SESSION_PURCHASE"
    LIVE_SESSION_REFUND = "LIVE_SESSION_REFUND"
    CERTIFICATE_PURCHASE = "CERTIFICATE_PURCHASE"
    PODAPOINT_PURCHASE = "PODAPOINT_PURCHASE"
    FEATURE_PURCHASE = "FEATURE_PURCHASE"
    FREELANCER_SUBSCRIPTION = "FREELANCER_SUBSCRIPTION"
    BUSINESS_SUBSCRIPTION = "BUSINESS_SUBSCRIPTION"
    DEPOSIT = "DEPOSIT"
    CONTRACT_ESCROW = "CONTRACT_ESCROW"
    TRANSFER = "TRANSFER"
    CREATOR_ROYALTY = "CREATOR_ROYALTY"


class FreelancerTier(str, Enum):
    NEW = "NEW"
    STANDARD = "STANDARD"
    PRO = "PRO"
    EXPERT = "EXPERT"


class PriceSnapshot(BaseModel):
    amount: int
    currency: str = "DZD"
    billing_cycle: str  # "monthly", "yearly"


class SubscriptionCreate(BaseModel):
    user_id: Optional[int] = None
    organization_id: Optional[int] = None
    plan: SubscriptionPlan
    billing_cycle: str = "monthly"

    @model_validator(mode="after")
    def validate_entity(self) -> "SubscriptionCreate":
        if not self.user_id and not self.organization_id:
            raise ValueError("Either user_id or organization_id must be provided")
        return self


class CheckoutInitiate(BaseModel):
    amount: int
    purpose: PaymentPurpose
    success_url: str
    failure_url: str
    metadata: Optional[Dict[str, Any]] = None


# ── Subscription Management ──────────────────────────────────────────────────


class ChangePlanRequest(BaseModel):
    new_plan: SubscriptionPlan
    billing_cycle: str = "monthly"  # "monthly" or "yearly"


class CancelSubscriptionRequest(BaseModel):
    immediate: bool = False  # If True, cancel immediately; else at period end


class UsageBucket(BaseModel):
    used: int
    limit: int


class UsageSummaryResponse(BaseModel):
    has_subscription: bool
    plan: Optional[str] = None
    billing_cycle: Optional[str] = None
    courses: UsageBucket = UsageBucket(used=0, limit=0)
    certificates: UsageBucket = UsageBucket(used=0, limit=0)
    period_start: Optional[str] = None
    period_end: Optional[str] = None
