"""
Tests for Payment Price Verification & Entitlement Hardening.
Verifies that:
1. Transactions lacking `price_verified_at` metadata marker are blocked.
2. Transactions where amount != DB module price are blocked.
3. Valid transactions with matching amount and `price_verified_at` succeed.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone

from app.schemas.billing_schemas.base import PaymentPurpose
from app.services.billing_services.billing_core_service import PRICE_VERIFIED_KEY
from app.services.billing_services.education_service import EducationBillingService


@pytest.mark.asyncio
class TestPaymentPriceVerification:

    @pytest.fixture
    def billing_service(self):
        return EducationBillingService()

    async def test_unverified_price_metadata_blocks_entitlement(self, billing_service):
        """Transaction lacking price_verified_at marker should be hard-blocked."""
        mock_tx = MagicMock()
        mock_tx.id = 101
        mock_tx.userId = 1
        mock_tx.purpose = PaymentPurpose.COURSE_PURCHASE.value
        mock_tx.amount = 5000
        mock_tx.metadata = {"course_id": "module_123"}  # Lacks price_verified_at

        with patch("app.services.billing_services.education_service.prisma.transaction.find_unique", new_callable=AsyncMock) as mock_find_tx, \
             patch.object(billing_service, "_handle_course_purchase", new_callable=AsyncMock) as mock_handle_course:
            mock_find_tx.return_value = mock_tx

            await billing_service.grant_entitlements(101)

            # Handler should NEVER be called
            mock_handle_course.assert_not_called()

    async def test_price_mismatch_blocks_entitlement(self, billing_service):
        """Transaction with paid_amount != DB module price should be hard-blocked."""
        mock_tx = MagicMock()
        mock_tx.id = 102
        mock_tx.userId = 1
        mock_tx.purpose = PaymentPurpose.COURSE_PURCHASE.value
        mock_tx.amount = 1  # Attacker paid 1 DZD instead of 5000 DZD
        mock_tx.metadata = {
            "course_id": "module_123",
            PRICE_VERIFIED_KEY: datetime.now(timezone.utc).isoformat(),
        }

        mock_module = MagicMock()
        mock_module.price = '{"original": 5000, "discounted": 5000}'

        with patch("app.services.billing_services.education_service.prisma.transaction.find_unique", new_callable=AsyncMock) as mock_find_tx, \
             patch("app.services.billing_services.education_service.prisma.module.find_unique", new_callable=AsyncMock) as mock_find_module, \
             patch.object(billing_service, "_handle_course_purchase", new_callable=AsyncMock) as mock_handle_course:
            mock_find_tx.return_value = mock_tx
            mock_find_module.return_value = mock_module

            await billing_service.grant_entitlements(102)

            # Handler should NOT be called due to price mismatch
            mock_handle_course.assert_not_called()

    async def test_matching_price_grants_entitlement(self, billing_service):
        """Transaction matching DB price and containing verification marker succeeds."""
        mock_tx = MagicMock()
        mock_tx.id = 103
        mock_tx.userId = 1
        mock_tx.purpose = PaymentPurpose.COURSE_PURCHASE.value
        mock_tx.amount = 5000
        mock_tx.metadata = {
            "course_id": "module_123",
            PRICE_VERIFIED_KEY: datetime.now(timezone.utc).isoformat(),
        }

        mock_module = MagicMock()
        mock_module.price = '{"original": 5000, "discounted": 5000}'

        with patch("app.services.billing_services.education_service.prisma.transaction.find_unique", new_callable=AsyncMock) as mock_find_tx, \
             patch("app.services.billing_services.education_service.prisma.module.find_unique", new_callable=AsyncMock) as mock_find_module, \
             patch.object(billing_service, "_handle_course_purchase", new_callable=AsyncMock) as mock_handle_course:
            mock_find_tx.return_value = mock_tx
            mock_find_module.return_value = mock_module

            await billing_service.grant_entitlements(103)

            # Handler should be called
            mock_handle_course.assert_called_once_with(1, mock_tx.metadata, 103)
