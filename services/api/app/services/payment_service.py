import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
import secrets

from app.core.prisma import prisma
from app.generated.prisma import enums
from app.core.config import setting
from app.schemas.payment import (
    PaymentInitiateRequest,
    PaymentResponse,
    PaymentStatus,
    PaymentGateway,
    PaymentPurpose,
    WebhookPayload,
    ChargilyWebhookData,
)
from app.schemas.education import serialize_json_field

logger = logging.getLogger(__name__)


class PaymentService:
    """Service for handling payment gateway integrations"""

    def __init__(self):
        self.gateways = {
            PaymentGateway.CHARGILY: self._initiate_chargily_payment,
            PaymentGateway.MOCK: self._initiate_mock_payment,
        }

    async def initiate_payment(
        self, request: PaymentInitiateRequest
    ) -> PaymentResponse:
        """Initiate a payment with the specified gateway"""
        try:
            logger.info(
                f"Initiating payment: {request.purpose} for {request.amount} {request.currency}"
            )

            # FINANCIAL_MODE gatekeeper
            from app.core.config import FinancialMode

            if (
                getattr(setting, "FINANCIAL_MODE", FinancialMode.NON_CUSTODIAL)
                == FinancialMode.NON_CUSTODIAL
            ):
                custodial_purposes = [
                    PaymentPurpose.CONTRACT_ESCROW,
                    PaymentPurpose.DEPOSIT,
                    PaymentPurpose.TRANSFER,
                    PaymentPurpose.CONTRACT_PAYMENT,
                ]
                if request.purpose in custodial_purposes:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.billing.custodial_escrow_disabled",
                    )

            # Check for existing pending transaction
            existing_tx = await self._check_existing_transaction(request)
            if existing_tx:
                return PaymentResponse.from_orm(existing_tx)

            # Create transaction record
            transaction = await self._create_transaction_record(request)

            # Process with gateway
            gateway_handler = self.gateways.get(request.gateway)
            if not gateway_handler:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported payment gateway: {request.gateway}",
                )

            # SECURITY: Block mock gateway in production
            if (
                request.gateway == PaymentGateway.MOCK
                and getattr(setting, "ENVIRONMENT", "") == "production"
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Mock gateway is not available in production",
                )

            gateway_result = await gateway_handler(request, transaction.id)

            # Update transaction with gateway response
            await self._update_transaction_with_gateway_response(
                transaction.id, gateway_result
            )

            # Reload the full transaction with all fields
            full_transaction = await prisma.transaction.find_unique(
                where={"id": transaction.id}
            )

            try:
                from app.middleware.metrics import PAYMENT_ATTEMPT

                PAYMENT_ATTEMPT.labels(
                    provider=request.gateway.value
                    if hasattr(request.gateway, "value")
                    else str(request.gateway),
                    status="initiated",
                ).inc()
            except Exception:
                pass

            return PaymentResponse.from_orm(full_transaction)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Payment initiation failed: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Payment initiation failed: {str(e)}",
            )

    async def _initiate_chargily_payment(
        self, request: PaymentInitiateRequest, transaction_id: int
    ) -> Dict[str, Any]:
        """Initiate Chargily Pay payment via HTTP client."""
        from app.services.payment_providers.chargily import chargily_client

        if not chargily_client.is_configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Payment gateway not configured. Contact support.",
            )

        checkout = await chargily_client.create_checkout(
            amount=request.amount,
            currency=request.currency.lower(),
            success_url=request.success_url,
            failure_url=request.failure_url,
            description=f"Podacium - {request.purpose.value.replace('_', ' ').title()}",
            metadata={
                "transaction_id": transaction_id,
                "purpose": request.purpose.value,
                "user_id": request.user_id,
                "organization_id": request.organization_id,
            },
        )

        logger.info(f"Chargily checkout created: {checkout.id}")

        return {
            "checkout_url": checkout.checkout_url,
            "provider_reference": checkout.id,
            "status": "pending",
            "gateway_data": {
                "checkout_id": checkout.id,
                "amount": checkout.amount,
                "currency": checkout.currency,
                "status": checkout.status,
            },
        }

    async def _initiate_mock_payment(
        self, request: PaymentInitiateRequest, transaction_id: int
    ) -> Dict[str, Any]:
        """Mock payment gateway for testing - redirects to local mock checkout page"""
        # Build mock checkout URL that points to local frontend
        frontend_url = setting.FRONTEND_URL
        mock_checkout_url = f"{frontend_url}/payment/mock-checkout?transaction_id={transaction_id}&amount={request.amount}&currency={request.currency}&purpose={request.purpose.value}"

        return {
            "checkout_url": mock_checkout_url,
            "provider_reference": f"MOCK-{transaction_id}",
            "status": "pending",
            "gateway_data": {"mock": True, "transaction_id": transaction_id},
        }

    async def _create_transaction_record(self, request: PaymentInitiateRequest):
        """Create transaction record in database"""
        try:
            # Generate unique reference
            reference = f"TX-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{secrets.token_hex(8)}"

            # Calculate commission if applicable
            commission = await self._calculate_commission(request)
            net_amount = request.amount - commission if commission else None

            # Prepare metadata as JSON string for Prisma
            metadata = request.metadata or {}
            metadata_json = serialize_json_field(metadata) if metadata else None

            # Create transaction
            transaction_data = {
                "amount": request.amount,
                "currency": request.currency,
                "purpose": getattr(enums.PaymentPurpose, request.purpose.value),
                "status": PaymentStatus.PENDING.value,
                "gateway": request.gateway.value,
                "provider": "CHARGILY"
                if request.gateway == PaymentGateway.CHARGILY
                else "OTHER",
                "checkoutUrl": None,  # Will be updated
                "webhookUrl": f"{setting.FRONTEND_URL}/api/webhooks/payment",
                "commission": commission,
                "netAmount": net_amount,
                "metadata": metadata_json,
            }

            # Add entity references
            if request.user_id:
                transaction_data["userId"] = request.user_id
            if request.organization_id:
                transaction_data["organizationId"] = request.organization_id
            if request.contract_id:
                transaction_data["contractId"] = request.contract_id
            if request.subscription_id:
                transaction_data["subscriptionId"] = request.subscription_id

            transaction = await prisma.transaction.create(data=transaction_data)

            logger.info(
                f"Created transaction {transaction.id} with reference {reference}"
            )
            return transaction

        except Exception as e:
            logger.error(f"Failed to create transaction record: {str(e)}")
            raise

    async def _calculate_commission(
        self, request: PaymentInitiateRequest
    ) -> Optional[int]:
        """Calculate platform commission based on payment purpose using Decimal precision.
        Reads rates from CommissionRateConfig for freelance, uses defaults for education."""
        from decimal import Decimal, ROUND_HALF_UP

        # Default rates for education purchases
        # Model: platform retains 80%, instructor receives 20% royalty (on top of 30K DZD upfront flat fee)
        commission_rates = {
            PaymentPurpose.COURSE_PURCHASE: Decimal("0.80"),  # 80% to platform
            PaymentPurpose.PATH_PURCHASE: Decimal("0.80"),  # 80% to platform
        }

        rate = commission_rates.get(request.purpose)

        # Special handling for Freelance Contracts: Fetch dynamic rate from config or profile
        if request.purpose == PaymentPurpose.CONTRACT_ESCROW and request.contract_id:
            try:
                contract = await prisma.contract.find_unique(
                    where={"id": request.contract_id},
                    include={"freelancer": {"include": {"freelancerProfile": True}}},
                )

                if (
                    contract
                    and contract.freelancer
                    and contract.freelancer.freelancerProfile
                ):
                    profile = contract.freelancer.freelancerProfile

                    # First try to get rate from CommissionRateConfig table
                    config_rate = await prisma.commissionrateconfig.find_first(
                        where={"tier": profile.tier, "isActive": True},
                        order={"effectiveFrom": "desc"},
                    )

                    if config_rate:
                        # Config stores as percentage (e.g. 15.0 for 15%)
                        rate = Decimal(str(config_rate.commissionPercent)) / Decimal(
                            "100.0"
                        )
                    elif profile.commissionRate and float(profile.commissionRate) > 0:
                        # Fallback to profile rate (stored as percentage in Decimal(5,2))
                        rate = Decimal(str(profile.commissionRate)) / Decimal("100.0")
                    else:
                        # Final fallback
                        rate = Decimal("0.15")
                else:
                    # No profile found — use default from config for NEW tier
                    config_rate = await prisma.commissionrateconfig.find_first(
                        where={"tier": "NEW", "isActive": True},
                        order={"effectiveFrom": "desc"},
                    )
                    rate = (
                        Decimal(str(config_rate.commissionPercent)) / Decimal("100.0")
                        if config_rate
                        else Decimal("0.20")
                    )
            except Exception as e:
                logger.error(f"Failed to fetch dynamic commission rate: {e}")
                rate = Decimal("0.15")  # Safe fallback

        if rate is not None:
            amount = Decimal(str(request.amount))
            commission = amount * rate
            # Round to nearest cent
            return int(commission.quantize(Decimal("1"), rounding=ROUND_HALF_UP))

        return None

    async def _check_existing_transaction(self, request: PaymentInitiateRequest):
        """Check for existing pending transaction for same entity"""
        # For wallet deposits, always create a new transaction to avoid expired checkout URLs
        if request.purpose == PaymentPurpose.DEPOSIT:
            return None

        where_clause = {
            "status": PaymentStatus.PENDING.value,
            "purpose": request.purpose.value,
            "amount": request.amount,
        }

        if request.user_id:
            where_clause["userId"] = request.user_id
        elif request.organization_id:
            where_clause["organizationId"] = request.organization_id

        if request.contract_id:
            where_clause["contractId"] = request.contract_id

        existing = await prisma.transaction.find_first(
            where=where_clause, order={"createdAt": "desc"}
        )

        return existing

    async def _handle_existing_transaction(self, transaction):
        """Handle existing pending transaction"""
        # Check if transaction is expired (older than 30 minutes)
        age = datetime.now(timezone.utc) - transaction.createdAt
        if age > timedelta(minutes=30):
            # Expire old transaction
            await prisma.transaction.update(
                where={"id": transaction.id},
                data={"status": PaymentStatus.CANCELLED.value},
            )
            return None
        return transaction

    async def _update_transaction_with_gateway_response(
        self, transaction_id: int, gateway_result: Dict[str, Any]
    ):
        """Update transaction with gateway response"""
        gateway_data = gateway_result.get("gateway_data")

        # Build update data
        update_data: Dict[str, Any] = {"updatedAt": datetime.now(timezone.utc)}

        if gateway_result.get("checkout_url"):
            update_data["checkoutUrl"] = gateway_result["checkout_url"]

        if gateway_result.get("provider_reference"):
            update_data["providerReference"] = gateway_result["provider_reference"]

        if gateway_data:
            update_data["gatewayMetadata"] = serialize_json_field(gateway_data)

        # Update transaction
        await prisma.transaction.update(where={"id": transaction_id}, data=update_data)

        # Return the full updated transaction
        return await prisma.transaction.find_unique(where={"id": transaction_id})

    async def get_transaction(self, transaction_id: int) -> Optional[PaymentResponse]:
        """Get transaction by ID"""
        transaction = await prisma.transaction.find_unique(
            where={"id": transaction_id},
            include={"user": True, "organization": True, "contract": True},
        )

        if transaction:
            return PaymentResponse.from_orm(transaction)
        return None

    async def _verify_webhook_signature(self, webhook: WebhookPayload) -> bool:
        """Verify webhook signature (delegates to payment provider with proper HMAC)."""
        if webhook.gateway == PaymentGateway.CHARGILY:
            from app.services.payment_providers.chargily import chargily_client

            if webhook.raw_body is not None:
                raw_body = webhook.raw_body
            else:
                raw_body = (serialize_json_field(webhook.payload) or "").encode("utf-8")
            return await chargily_client.verify_webhook_signature(
                raw_body, webhook.signature or ""
            )
        return bool(webhook.signature)

    async def _parse_gateway_payload(self, webhook: WebhookPayload) -> Dict[str, Any]:
        """Parse gateway-specific payload"""
        if webhook.gateway == PaymentGateway.CHARGILY:
            return ChargilyWebhookData(**webhook.payload).model_dump()
        return webhook.payload

    async def _find_transaction_by_gateway_reference(
        self, gateway: PaymentGateway, data: Dict[str, Any]
    ):
        """Find transaction by gateway reference"""
        if gateway == PaymentGateway.CHARGILY:
            # For Chargily, check metadata for transaction_id
            metadata = data.get("metadata", {})
            transaction_id = metadata.get("transaction_id")
            if transaction_id:
                return await prisma.transaction.find_unique(
                    where={"id": transaction_id}
                )

        # Fallback: search by provider reference
        provider_ref = data.get("checkout_id") or data.get("id")
        if provider_ref:
            return await prisma.transaction.find_first(
                where={"providerReference": provider_ref}
            )

        return None

    def _map_webhook_to_status(self, event_type) -> PaymentStatus:
        """Map webhook event to transaction status"""
        mapping = {
            "PAYMENT_PENDING": PaymentStatus.PENDING,
            "PAYMENT_PAID": PaymentStatus.COMPLETED,
            "PAYMENT_FAILED": PaymentStatus.FAILED,
            "PAYMENT_CANCELED": PaymentStatus.CANCELLED,
            "PAYMENT_REFUNDED": PaymentStatus.REFUNDED,
            "PAYMENT_DISPUTED": PaymentStatus.DISPUTED,
        }
        return mapping.get(event_type.value, PaymentStatus.PENDING)


# Singleton instance
payment_service = PaymentService()
