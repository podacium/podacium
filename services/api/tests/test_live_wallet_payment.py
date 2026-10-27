"""
Regression tests for the wallet-payment entitlement dispatch fix.

Ensures `_try_wallet_payment` grants access according to the transaction's
purpose: live-session purchases must be routed to
`live_session_billing_service.grant_access` (creating the booking), not to the
education entitlements pipeline which silently swallowed paid access.
"""

import sys
from unittest.mock import MagicMock, AsyncMock, patch

from tests.conftest import build_fake_prisma_module

import pytest

# Pre-import mock: prevents the Prisma client from connecting at import time.
# Built by the shared helper so it exposes the complete app.core.prisma surface
# (incl. ensure_connection) — a partial fake here corrupts sys.modules for the
# rest of the process and breaks every other suite.
prisma_module = build_fake_prisma_module()
_mock_prisma = prisma_module.prisma
sys.modules["app.core.prisma"] = prisma_module

# `app.generated.prisma` is kept REAL (safe: defines models/fields/enums, no DB
# connection) so later `from app.generated.prisma.enums import ...` submodule
# imports work no matter what order this module is collected in. Replacing it
# with a bare `types.ModuleType` makes it "not a package" and breaks every
# file that imports app.main afterwards.

from app.routers.billing_routers.payment_router import _try_wallet_payment  # noqa: E402
from app.schemas.billing_schemas.base import PaymentPurpose  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_prisma_mock():
    _mock_prisma.transaction.update = AsyncMock()
    yield


def _make_wallet(balance=100000):
    w = MagicMock()
    w.id = 1
    w.podaPoints = balance
    return w


@pytest.mark.asyncio
@patch("app.services.wallet_service.wallet_service")
@patch(
    "app.services.billing_services.live_session_billing_service.live_session_billing_service"
)
@patch("app.services.billing_services.education_service.education_billing_service")
async def test_live_session_purchase_routes_to_grant_access(
    education_billing_service, live_session_billing_service, wallet_service
):
    wallet_service.get_user_wallet = AsyncMock(return_value=_make_wallet())
    wallet_service.debit_wallet = AsyncMock()
    live_session_billing_service.grant_access = AsyncMock()
    education_billing_service.grant_entitlements = AsyncMock()

    result = await _try_wallet_payment(
        user_id=2,
        amount=5000,
        transaction_id=42,
        purpose=PaymentPurpose.LIVE_SESSION_PURCHASE,
        description="Live session",
    )

    assert result is True
    live_session_billing_service.grant_access.assert_awaited_once_with(42)
    education_billing_service.grant_entitlements.assert_not_awaited()
    _mock_prisma.transaction.update.assert_awaited_once()
    call_data = _mock_prisma.transaction.update.call_args.kwargs["data"]
    assert call_data["status"] == "COMPLETED"


@pytest.mark.asyncio
@patch("app.services.wallet_service.wallet_service")
@patch(
    "app.services.billing_services.live_session_billing_service.live_session_billing_service"
)
@patch("app.services.billing_services.education_service.education_billing_service")
async def test_course_purchase_still_routes_to_grant_entitlements(
    education_billing_service, live_session_billing_service, wallet_service
):
    wallet_service.get_user_wallet = AsyncMock(return_value=_make_wallet())
    wallet_service.debit_wallet = AsyncMock()
    live_session_billing_service.grant_access = AsyncMock()
    education_billing_service.grant_entitlements = AsyncMock()

    result = await _try_wallet_payment(
        user_id=2,
        amount=9000,
        transaction_id=43,
        purpose=PaymentPurpose.COURSE_PURCHASE,
        description="Course",
    )

    assert result is True
    education_billing_service.grant_entitlements.assert_awaited_once_with(43)
    live_session_billing_service.grant_access.assert_not_awaited()


@pytest.mark.asyncio
@patch("app.services.wallet_service.wallet_service")
@patch(
    "app.services.billing_services.live_session_billing_service.live_session_billing_service"
)
@patch("app.services.billing_services.education_service.education_billing_service")
async def test_insufficient_balance_returns_false(
    education_billing_service, live_session_billing_service, wallet_service
):
    wallet_service.get_user_wallet = AsyncMock(return_value=_make_wallet(balance=100))
    wallet_service.debit_wallet = AsyncMock()
    live_session_billing_service.grant_access = AsyncMock()
    education_billing_service.grant_entitlements = AsyncMock()

    result = await _try_wallet_payment(
        user_id=2,
        amount=5000,
        transaction_id=44,
        purpose=PaymentPurpose.LIVE_SESSION_PURCHASE,
        description="Live session",
    )

    assert result is False
    live_session_billing_service.grant_access.assert_not_awaited()
    education_billing_service.grant_entitlements.assert_not_awaited()
    _mock_prisma.transaction.update.assert_not_awaited()
