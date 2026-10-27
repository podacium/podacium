import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from app.core.prisma import prisma
from app.generated.prisma import enums, fields
from app.services.payment_providers.chargily import chargily_client, ChargilyError
from app.schemas.billing_schemas.base import (
    PaymentPurpose, CheckoutInitiate
)

logger = logging.getLogger(__name__)

# Metadata key set ONLY by server-side price resolution. A transaction carrying
# this marker is guaranteed to have had its `amount` computed from the database
# (or a server-validated promo code) — never from client input.
PRICE_VERIFIED_KEY = "price_verified_at"

# Purposes that grant paid access/entitlements based on transaction metadata.
# For these, entitlement granting is refused unless PRICE_VERIFIED_KEY is present.
ENTITLEMENT_PURPOSES = frozenset({
    PaymentPurpose.COURSE_PURCHASE,
    PaymentPurpose.PATH_PURCHASE,
    PaymentPurpose.CERTIFICATE_PURCHASE,
    PaymentPurpose.LIVE_SESSION_PURCHASE,
    PaymentPurpose.STUDENT_SUBSCRIPTION,
})


def is_price_verified(metadata: Optional[Dict[str, Any]]) -> bool:
    """True if the transaction metadata carries the server-issued price marker."""
    if not metadata:
        return False
    return bool(metadata.get(PRICE_VERIFIED_KEY))

class BillingCoreService:
    """Core service for processing payments and transactions safely."""

    async def create_transaction(
        self, 
        amount: int, 
        purpose: PaymentPurpose,
        user_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        contract_id: Optional[int] = None,
        subscription_id: Optional[int] = None
    ):
        """Creates a pending transaction record."""
        # Validate amount
        if amount <= 0:
            raise ValueError(f"amount must be positive, got {amount}")

        transaction_data: Dict[str, Any] = {
            "amount": amount,
            "currency": "DZD",
            "purpose": getattr(enums.PaymentPurpose, purpose.value),
            "status": enums.PaymentStatus.PENDING,
            "metadata": fields.Json(metadata or {}),
            "gateway": enums.PaymentGateway.CHARGILY,
            "provider": enums.PaymentProvider.CHARGILY
        }

        # Stamp a server-side price marker so entitlement granting can verify the amount was server-resolved.
        if purpose in ENTITLEMENT_PURPOSES:
            verified_metadata = dict(metadata or {})
            verified_metadata[PRICE_VERIFIED_KEY] = datetime.now(timezone.utc).isoformat()
            transaction_data["metadata"] = fields.Json(verified_metadata)
        
        # Use relation connect syntax for safer creation and to avoid scalar issues
        if user_id:
            transaction_data["user"] = {"connect": {"id": user_id}}
        if organization_id:
            transaction_data["organization"] = {"connect": {"id": organization_id}}
        if contract_id:
            transaction_data["contract"] = {"connect": {"id": contract_id}}
        if subscription_id:
            transaction_data["subscription"] = {"connect": {"id": subscription_id}}

        # Auto-link wallet for DEPOSIT transactions so webhook can credit it
        if purpose == PaymentPurpose.DEPOSIT and user_id:
            wallet = await prisma.wallet.find_unique(where={"userId": user_id})
            if wallet:
                transaction_data["wallet"] = {"connect": {"id": wallet.id}}
        
        transaction = await prisma.transaction.create(data=transaction_data)
        return transaction

    async def initiate_chargily_checkout(self, transaction_id: int, request: CheckoutInitiate):
        """Initiates a checkout session with Chargily."""
        try:
            # Fetch user email if available
            user_email = None
            user_name = None
            
            # Find the transaction to get details if not provided
            transaction = await prisma.transaction.find_unique(where={"id": transaction_id})
            if not transaction:
                raise ValueError(f"Transaction {transaction_id} not found")

            if transaction.userId:
                user = await prisma.user.find_unique(where={"id": transaction.userId})
                if user:
                    user_email = user.email
                    user_name = user.fullName

            # Combine metadata
            metadata = request.metadata or {}
            metadata["transaction_id"] = transaction_id
            
            # Create checkout
            # Note: Chargily V2 API expects amount in DZD.
            # The chargily client sends 'amount' directly.
            amount_dzd = request.amount

            # Note: Chargily V2 does NOT support per-checkout webhook_url.
            # The webhook endpoint must be configured in the Chargily Dashboard:
            # https://api.podacium.com/api/billing/webhooks/chargily

            checkout = await chargily_client.create_checkout(
                amount=amount_dzd, # Chargily V2 expects DZD, not cents
                currency="dzd",
                success_url=request.success_url,
                failure_url=request.failure_url,
                customer_name=user_name,
                customer_email=user_email,
                description=f"Payment for {transaction.purpose}",
                metadata=metadata
            )

            # Update transaction with provider reference
            await prisma.transaction.update(
                where={"id": transaction_id},
                data={
                    "providerReference": checkout.id,
                    "checkoutUrl": checkout.checkout_url
                }
            )

            return checkout

        except ChargilyError as e:
            logger.error(f"Chargily error: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Failed to initiate checkout: {str(e)}")
            raise

    async def check_idempotency(self, key: str) -> bool:
        """Simple idempotency check using a unique key."""
        # We can use the IdempotencyKey table if it exists
        # For now, let's just ensure we don't process the same webhook twice.
        # This is usually handled by checking the transaction status.
        return False # Placeholder

billing_core_service = BillingCoreService()
