import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from decimal import Decimal
from fastapi import HTTPException

from app.core.rbac import is_ip_allowed
from app.services.billing_services.commission_service import (
    quantize_poda_points,
    commission_service,
)
from app.schemas.payment import FreelancerTier
from app.schemas.billing_schemas.base import PaymentPurpose


class TestIpSubnetEnforcement:
    def test_empty_allowed_subnets_allows_all(self):
        assert is_ip_allowed("192.168.1.10", []) is True
        assert is_ip_allowed("10.0.0.1", []) is True

    def test_single_ipv4_exact_match(self):
        assert is_ip_allowed("192.168.1.50", ["192.168.1.50"]) is True
        assert is_ip_allowed("192.168.1.51", ["192.168.1.50"]) is False

    def test_cidr_ipv4_range_match(self):
        allowed = ["10.0.0.0/24", "192.168.1.0/28"]
        assert is_ip_allowed("10.0.0.42", allowed) is True
        assert is_ip_allowed("10.0.0.254", allowed) is True
        assert is_ip_allowed("10.0.1.1", allowed) is False
        assert is_ip_allowed("192.168.1.10", allowed) is True
        assert is_ip_allowed("192.168.1.20", allowed) is False

    def test_invalid_ip_handled_gracefully(self):
        assert is_ip_allowed("not-an-ip", ["10.0.0.0/24"]) is False


class TestDecimalCommissionPrecision:
    def test_quantize_poda_points_half_up(self):
        assert quantize_poda_points(Decimal("100.4")) == 100
        assert quantize_poda_points(Decimal("100.5")) == 101
        assert quantize_poda_points(Decimal("100.6")) == 101
        assert quantize_poda_points(19999 * 0.07) == 1400

    @pytest.mark.asyncio
    async def test_calculate_commission_decimal_quantized(self):
        calc = await commission_service.calculate_commission(
            amount=19999,
            freelancer_tier=FreelancerTier.ENTERPRISE,
            purpose=PaymentPurpose.CONTRACT_PAYMENT,
        )
        assert calc.commission == 1400  # 19999 * 0.07 = 1399.93 -> rounded to 1400
        assert calc.net_amount == 18599
        assert calc.amount == 19999


class TestMakerCheckerPayoutLogic:
    @pytest.mark.asyncio
    async def test_maker_review_high_value_payout(self):
        from app.services.wallet_service import WalletService

        service = WalletService()
        mock_payout = MagicMock(
            id=101,
            amount=150_000,
            status="PENDING",
            currency="DZD",
            metadata={},
        )

        with patch(
            "app.core.prisma.prisma.payout.find_unique",
            new=AsyncMock(return_value=mock_payout),
        ):
            with patch(
                "app.core.prisma.prisma.payout.update_many",
                new=AsyncMock(return_value=1),
            ) as mock_update:
                result = await service.maker_review_withdrawal(
                    payout_id=101, admin_id=5, admin_notes="Maker verified RIB"
                )
                assert result["status"] == "PENDING_CHECKER_APPROVAL"
                assert result["maker_admin_id"] == 5
                # Maker review is an atomic PENDING -> PENDING_CHECKER_APPROVAL CAS.
                mock_update.assert_called_once()
                assert mock_update.call_args.kwargs["where"]["status"] == "PENDING"

    @pytest.mark.asyncio
    async def test_checker_self_approval_rejected(self):
        from app.services.wallet_service import WalletService

        service = WalletService()
        mock_payout = MagicMock(
            id=102,
            amount=200_000,
            status="PENDING_CHECKER_APPROVAL",
            currency="DZD",
            metadata={"makerAdminId": 5},
            wallet=MagicMock(id=1, podaPoints=500_000),
        )

        with patch("app.core.prisma.prisma.tx") as mock_tx:
            tx_instance = MagicMock()
            tx_instance.payout.find_unique = AsyncMock(return_value=mock_payout)
            tx_instance.execute_raw = AsyncMock()
            mock_tx.return_value.__aenter__.return_value = tx_instance

            with pytest.raises(HTTPException) as exc_info:
                # Same admin 5 attempting checker approval
                await service.approve_withdrawal(payout_id=102, admin_id=5)

            assert exc_info.value.status_code == 400
            assert exc_info.value.detail["code"] == "SEPARATION_OF_DUTIES_VIOLATION"

    @pytest.mark.asyncio
    async def test_checker_distinct_admin_approved(self):
        from app.services.wallet_service import WalletService

        service = WalletService()
        mock_payout = MagicMock(
            id=103,
            amount=200_000,
            status="PENDING_CHECKER_APPROVAL",
            currency="DZD",
            metadata={"makerAdminId": 5},
            wallet=MagicMock(id=1, podaPoints=500_000),
        )
        updated_mock = MagicMock(
            id=103,
            status="COMPLETED",
            processedAt=None,
        )

        with patch("app.core.prisma.prisma.tx") as mock_tx:
            tx_instance = MagicMock()
            tx_instance.payout.find_unique = AsyncMock(return_value=mock_payout)
            tx_instance.wallet.find_unique = AsyncMock(return_value=mock_payout.wallet)
            tx_instance.wallet.update = AsyncMock()
            tx_instance.payout.update = AsyncMock(return_value=updated_mock)
            tx_instance.wallettransaction.create = AsyncMock()
            tx_instance.execute_raw = AsyncMock()
            mock_tx.return_value.__aenter__.return_value = tx_instance

            # Distinct admin 9 acting as Checker
            result = await service.approve_withdrawal(
                payout_id=103, admin_id=9, admin_notes="Checker verified wire"
            )
            assert result["status"] == "COMPLETED"
            assert result["amount"] == 200_000


class TestHardwareKeyEnforcement:
    @pytest.mark.asyncio
    async def test_step_up_hardware_key_required_rejected_for_totp(self):
        from app.core.auth import require_recent_2fa

        mock_request = MagicMock()
        mock_request.headers = {"X-Step-Up-Token": "mock_token"}
        mock_user = MagicMock(id=1, twoFactorEnabled=True)
        mock_admin_profile = MagicMock(id=1, hardwareKeyRequired=True)

        payload = {"sub": "1", "type": "step_up", "auth_method": "totp"}

        with patch("app.core.security.verify_token", return_value=payload):
            with patch(
                "app.core.prisma.prisma.adminprofile.find_unique",
                new=AsyncMock(return_value=mock_admin_profile),
            ):
                with pytest.raises(HTTPException) as exc_info:
                    await require_recent_2fa(
                        request=mock_request, current_user=mock_user
                    )

                assert exc_info.value.status_code == 403
                assert exc_info.value.detail["code"] == "HARDWARE_KEY_REQUIRED"

    @pytest.mark.asyncio
    async def test_step_up_hardware_key_required_accepted_for_webauthn(self):
        from app.core.auth import require_recent_2fa

        mock_request = MagicMock()
        mock_request.headers = {"X-Step-Up-Token": "mock_token"}
        mock_user = MagicMock(id=1, twoFactorEnabled=True)
        mock_admin_profile = MagicMock(id=1, hardwareKeyRequired=True)

        payload = {"sub": "1", "type": "step_up", "auth_method": "webauthn"}

        with patch("app.core.security.verify_token", return_value=payload):
            with patch(
                "app.core.prisma.prisma.adminprofile.find_unique",
                new=AsyncMock(return_value=mock_admin_profile),
            ):
                user = await require_recent_2fa(
                    request=mock_request, current_user=mock_user
                )
                assert user.id == 1
