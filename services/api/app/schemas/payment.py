from typing import Optional, Dict, Any, Literal
from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


# Payment Enums matching schema.prisma
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


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"
    CANCELLED = "CANCELLED"
    DISPUTED = "DISPUTED"


class PaymentProvider(str, Enum):
    CHARGILY = "CHARGILY"
    CASH = "CASH"
    BANK_TRANSFER = "BANK_TRANSFER"
    OTHER = "OTHER"


class PaymentGateway(str, Enum):
    CHARGILY = "CHARGILY"
    MOCK = "MOCK"


class SubscriptionPlan(str, Enum):
    STUDENT_STARTER = "STUDENT_STARTER"
    STUDENT_PLUS = "STUDENT_PLUS"
    STUDENT_PRO = "STUDENT_PRO"
    BI_GROWTH = "BI_GROWTH"
    BI_SCALE = "BI_SCALE"
    BI_ELITE = "BI_ELITE"
    FREE = "FREE"
    CUSTOM = "CUSTOM"
    FREELANCER_PLUS = "FREELANCER_PLUS"
    FREELANCER_PREMIUM = "FREELANCER_PREMIUM"
    BUSINESS_STARTER = "BUSINESS_STARTER"
    BUSINESS_PRO = "BUSINESS_PRO"
    BUSINESS_ENTERPRISE = "BUSINESS_ENTERPRISE"


class SubscriptionStatus(str, Enum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    GRACE_PERIOD = "GRACE_PERIOD"
    PENDING_PAYMENT = "PENDING_PAYMENT"


class FreelancerTier(str, Enum):
    NEW = "NEW"
    STANDARD = "STANDARD"
    PRO = "PRO"
    ENTERPRISE = "ENTERPRISE"


# Base Models
class PaymentBase(BaseModel):
    amount: int = Field(..., ge=1, description="Amount in DZD")
    currency: str = Field(default="DZD", pattern="^[A-Z]{3}$")
    purpose: PaymentPurpose
    metadata: Optional[Dict[str, Any]] = None


class WalletBase(BaseModel):
    balance: int = Field(default=0, ge=0)
    currency: str = Field(default="DZD", pattern="^[A-Z]{3}$")
    is_active: bool = Field(default=True)


# Request Models
class PaymentInitiateRequest(PaymentBase):
    user_id: Optional[int] = None
    organization_id: Optional[int] = None
    contract_id: Optional[int] = None
    subscription_id: Optional[int] = None
    gateway: PaymentGateway = PaymentGateway.CHARGILY
    success_url: str = Field(..., description="URL to redirect on success")
    failure_url: str = Field(..., description="URL to redirect on failure")

    @model_validator(mode="before")
    @classmethod
    def validate_entity(cls, values):
        user_id = values.get("user_id")
        organization_id = values.get("organization_id")
        if not user_id and not organization_id:
            raise ValueError("Either user_id or organization_id must be specified")
        return values


class WalletTransferRequest(BaseModel):
    from_wallet_id: int
    to_wallet_id: int
    amount: int = Field(..., gt=0)
    purpose: PaymentPurpose
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    @model_validator(mode="after")
    def _reject_self_transfer(self) -> "WalletTransferRequest":
        # Layer 1 validation: reject self-transfers early with a clear error.
        if self.from_wallet_id == self.to_wallet_id:
            raise ValueError("Cannot transfer funds to the same wallet")
        return self


class SubscriptionCreateRequest(BaseModel):
    user_id: Optional[int] = None
    organization_id: Optional[int] = None
    plan: SubscriptionPlan
    payment_method_id: Optional[int] = None
    auto_renew: bool = Field(default=True)
    billing_cycle: Literal["monthly", "yearly"] = "monthly"

    @model_validator(mode="before")
    @classmethod
    def validate_entity(cls, values):
        user_id = values.get("user_id")
        organization_id = values.get("organization_id")
        if not user_id and not organization_id:
            raise ValueError("Either user_id or organization_id must be specified")
        return values


class PayoutRequest(BaseModel):
    wallet_id: int
    amount: int = Field(..., gt=0)
    method: PaymentProvider = PaymentProvider.BANK_TRANSFER
    bank_account_details: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: int) -> int:
        if v < 1000:  # Minimum 1000 DZD for payouts
            raise ValueError("Minimum payout amount is 1000 DZD")
        return v


class EscrowReleaseRequest(BaseModel):
    contract_id: int
    amount: int
    description: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v


class WithdrawalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class WithdrawalRequest(BaseModel):
    amount: int = Field(..., gt=0, description="Amount to withdraw in DZD")
    bank_name: Optional[str] = Field(
        None, description="Bank name (e.g., BNA, CPA, BADR)"
    )
    account_number: Optional[str] = Field(None, description="RIB/RIP account number")
    account_holder_name: Optional[str] = Field(
        None, description="Name on the bank account"
    )
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes")

    @field_validator("amount")
    @classmethod
    def validate_minimum_amount(cls, v: int) -> int:
        if v < 1000:  # Minimum 1000 DZD for withdrawals
            raise ValueError("Minimum withdrawal amount is 1000 DZD")
        return v


class WithdrawalResponse(BaseModel):
    id: int
    wallet_id: int = Field(alias="walletId")
    user_id: Optional[int] = Field(None, alias="userId")
    amount: int = Field(alias="amount")
    currency: str
    status: WithdrawalStatus
    bank_name: Optional[str] = Field(None, alias="bankName")
    account_number: Optional[str] = Field(None, alias="accountNumber")
    account_holder_name: Optional[str] = Field(None, alias="accountHolderName")
    notes: Optional[str] = None
    admin_notes: Optional[str] = Field(None, alias="adminNotes")
    requested_at: datetime = Field(alias="requestedAt")
    processed_at: Optional[datetime] = Field(None, alias="processedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# Response Models
class PaymentResponse(BaseModel):
    id: int
    amount: int = Field(alias="amount")
    currency: str
    purpose: PaymentPurpose
    status: PaymentStatus
    gateway: PaymentGateway
    checkout_url: Optional[str] = Field(None, alias="checkoutUrl")
    provider_reference: Optional[str] = Field(None, alias="providerReference")
    created_at: datetime = Field(alias="createdAt")
    user_id: Optional[int] = Field(None, alias="userId")
    organization_id: Optional[int] = Field(None, alias="organizationId")
    contract_id: Optional[int] = Field(None, alias="contractId")
    subscription_id: Optional[int] = Field(None, alias="subscriptionId")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class WalletResponse(BaseModel):
    id: int
    user_id: Optional[int] = Field(None, alias="userId")
    organization_id: Optional[int] = Field(None, alias="organizationId")
    poda_points: int = Field(alias="podaPoints")
    currency: str
    is_active: bool = Field(alias="isActive")
    last_top_up_at: Optional[datetime] = Field(None, alias="lastTopUpAt")
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TransactionResponse(BaseModel):
    id: int
    amount: int = Field(alias="amount")
    currency: str
    purpose: PaymentPurpose
    status: PaymentStatus
    commission: Optional[int] = Field(None, alias="commission")
    net_amount: Optional[int] = Field(None, alias="netAmount")
    created_at: datetime = Field(alias="createdAt")
    wallet: Optional[WalletResponse] = None
    metadata: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class SubscriptionResponse(BaseModel):
    id: int
    user_id: Optional[int] = Field(None, alias="userId")
    organization_id: Optional[int] = Field(None, alias="organizationId")
    plan: SubscriptionPlan
    status: SubscriptionStatus
    amount: int = Field(alias="amount")
    currency: str
    current_period_start: datetime = Field(alias="currentPeriodStart")
    current_period_end: datetime = Field(alias="currentPeriodEnd")
    auto_renew: bool = Field(alias="autoRenew")
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PayoutResponse(BaseModel):
    id: int
    wallet_id: int = Field(alias="walletId")
    amount: int = Field(alias="amount")
    currency: str
    method: PaymentProvider
    status: str
    reference: Optional[str] = None
    requested_at: datetime = Field(alias="requestedAt")
    processed_at: Optional[datetime] = Field(None, alias="processedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class EscrowHoldResponse(BaseModel):
    id: int
    contract_id: int = Field(alias="contractId")
    wallet_id: int = Field(alias="walletId")
    amount: int = Field(alias="amount")
    currency: str
    status: str
    scheduled_release_at: Optional[datetime] = Field(None, alias="scheduledReleaseAt")
    created_at: datetime = Field(alias="createdAt")
    released_at: Optional[datetime] = Field(None, alias="releasedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# Webhook Models
class WebhookEventType(str, Enum):
    PAYMENT_PENDING = "PAYMENT_PENDING"
    PAYMENT_PAID = "PAYMENT_PAID"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    PAYMENT_CANCELED = "PAYMENT_CANCELED"
    PAYMENT_REFUNDED = "PAYMENT_REFUNDED"
    PAYMENT_DISPUTED = "PAYMENT_DISPUTED"


class WebhookPayload(BaseModel):
    event_type: WebhookEventType
    gateway: PaymentGateway
    payload: Dict[str, Any]
    signature: Optional[str] = None
    raw_body: Optional[bytes] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChargilyWebhookData(BaseModel):
    checkout_id: str
    status: str
    amount: int
    currency: str
    customer_id: Optional[str]
    metadata: Optional[Dict[str, Any]]


# Commission Models
class CommissionCalculation(BaseModel):
    amount: int
    freelancer_tier: FreelancerTier
    commission_rate: float = Field(..., ge=0, le=1)
    commission: int
    net_amount: int

    model_config = ConfigDict(from_attributes=True)
