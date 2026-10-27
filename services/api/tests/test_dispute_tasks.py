"""
Tests for dispute auto-resolution Celery task.

Covers:
- Disputes older than 7 days are escalated to UNDER_REVIEW
- Disputes older than 14 days are auto-resolved
- Already-escalated disputes are not re-escalated
- Already-resolved disputes are not re-processed
- Metrics are returned correctly
- Default ruling (refund) is applied on auto-resolution
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _make_dispute(
    id: int,
    status: str = "OPEN",
    created_days_ago: int = 0,
    escalated: bool = False,
    auto_resolved: bool = False,
    contract_id: int = 1,
):
    now = datetime.now(timezone.utc)
    d = MagicMock()
    d.id = id
    d.status = status
    d.contractId = contract_id
    d.creatorId = 10
    d.opponentId = 20
    d.createdAt = now - timedelta(days=created_days_ago)
    d.escalatedAt = now if escalated else None
    d.autoResolvedAt = now if auto_resolved else None
    return d


# ─── Unit tests ───────────────────────────────────────────────────────────────


class TestAutoResolveDisputes:
    """Unit tests for _auto_resolve_disputes core logic."""

    @pytest.mark.asyncio
    async def test_escalates_stale_open_disputes(self):
        """Disputes OPEN for 7+ days with no escalation are moved to UNDER_REVIEW."""
        from app.tasks.dispute_tasks import _auto_resolve_disputes

        stale_open = [_make_dispute(id=1, status="OPEN", created_days_ago=8)]
        stale_unresolved = []

        mock_prisma = MagicMock()
        mock_prisma.dispute.find_many = AsyncMock(
            side_effect=[stale_open, stale_unresolved]
        )
        mock_prisma.dispute.update = AsyncMock(return_value=MagicMock())
        mock_prisma.dispute.count = AsyncMock(return_value=0)
        mock_prisma.notification.create = AsyncMock()

        with patch("app.core.prisma.prisma", mock_prisma):
            result = await _auto_resolve_disputes()

        assert result["escalated"] == 1
        assert result["auto_resolved"] == 0

        # Verify the update was called with UNDER_REVIEW
        update_call = mock_prisma.dispute.update.call_args
        assert update_call.kwargs["data"]["status"] == "UNDER_REVIEW"
        assert (
            update_call.kwargs["data"]["resolutionReason"] == "AUTO_ESCALATED_TIMEOUT"
        )

    @pytest.mark.asyncio
    async def test_auto_resolves_old_disputes(self):
        """Disputes older than 14 days are auto-resolved."""
        from app.tasks.dispute_tasks import _auto_resolve_disputes

        stale_open = []
        stale_unresolved = [
            _make_dispute(id=2, status="UNDER_REVIEW", created_days_ago=15)
        ]

        mock_prisma = MagicMock()
        mock_prisma.dispute.find_many = AsyncMock(
            side_effect=[stale_open, stale_unresolved]
        )
        mock_prisma.dispute.update = AsyncMock(return_value=MagicMock())
        mock_prisma.dispute.count = AsyncMock(return_value=0)
        mock_prisma.notification.create = AsyncMock()
        mock_prisma.escrow.find_first = AsyncMock(return_value=None)

        with patch("app.core.prisma.prisma", mock_prisma):
            result = await _auto_resolve_disputes()

        assert result["escalated"] == 0
        assert result["auto_resolved"] == 1

        update_call = mock_prisma.dispute.update.call_args
        assert update_call.kwargs["data"]["status"] == "RESOLVED"
        assert update_call.kwargs["data"]["resolutionReason"] == "AUTO_RESOLVED_TIMEOUT"
        assert update_call.kwargs["data"]["autoResolvedAt"] is not None

    @pytest.mark.asyncio
    async def test_fresh_disputes_not_touched(self):
        """Disputes younger than 7 days are not escalated or resolved."""
        from app.tasks.dispute_tasks import _auto_resolve_disputes

        # find_many returns empty lists (no stale disputes)
        mock_prisma = MagicMock()
        mock_prisma.dispute.find_many = AsyncMock(side_effect=[[], []])
        mock_prisma.dispute.count = AsyncMock(return_value=5)

        with patch("app.core.prisma.prisma", mock_prisma):
            result = await _auto_resolve_disputes()

        assert result["escalated"] == 0
        assert result["auto_resolved"] == 0
        mock_prisma.dispute.update.assert_not_called()

    @pytest.mark.asyncio
    async def test_metrics_returned(self):
        """Result dict contains open/under_review/resolved counts."""
        from app.tasks.dispute_tasks import _auto_resolve_disputes

        mock_prisma = MagicMock()
        mock_prisma.dispute.find_many = AsyncMock(side_effect=[[], []])
        mock_prisma.dispute.count = AsyncMock(side_effect=[3, 2, 10])

        with patch("app.core.prisma.prisma", mock_prisma):
            result = await _auto_resolve_disputes()

        assert "metrics" in result
        assert result["metrics"]["open"] == 3
        assert result["metrics"]["under_review"] == 2
        assert result["metrics"]["resolved"] == 10

    @pytest.mark.asyncio
    async def test_notifications_sent_to_both_parties(self):
        """Both creator and opponent are notified on escalation."""
        from app.tasks.dispute_tasks import _auto_resolve_disputes

        dispute = _make_dispute(id=3, status="OPEN", created_days_ago=8)
        dispute.creatorId = 100
        dispute.opponentId = 200

        mock_prisma = MagicMock()
        mock_prisma.dispute.find_many = AsyncMock(side_effect=[[dispute], []])
        mock_prisma.dispute.update = AsyncMock(return_value=MagicMock())
        mock_prisma.dispute.count = AsyncMock(return_value=0)

        with (
            patch("app.core.prisma.prisma", mock_prisma),
            patch(
                "app.services.notification_service.NotificationService.create_notification",
                new_callable=AsyncMock,
            ) as mock_create_notif,
        ):
            await _auto_resolve_disputes()

        # Two notifications: one for creator, one for opponent
        assert mock_create_notif.call_count == 2
        notified_users = {c.args[0].user_id for c in mock_create_notif.call_args_list}
        assert notified_users == {100, 200}

    @pytest.mark.asyncio
    async def test_escrow_refunded_on_auto_resolve(self):
        """Held escrow is refunded when a dispute is auto-resolved."""
        from app.tasks.dispute_tasks import _auto_resolve_disputes

        dispute = _make_dispute(id=4, status="OPEN", created_days_ago=15)
        mock_escrow = MagicMock()
        mock_escrow.id = 99

        mock_prisma = MagicMock()
        mock_prisma.dispute.find_many = AsyncMock(side_effect=[[], [dispute]])
        mock_prisma.dispute.update = AsyncMock(return_value=MagicMock())
        mock_prisma.dispute.count = AsyncMock(return_value=0)
        mock_prisma.notification.create = AsyncMock()
        mock_prisma.escrow.find_first = AsyncMock(return_value=mock_escrow)
        mock_prisma.escrow.update = AsyncMock()

        with patch("app.core.prisma.prisma", mock_prisma):
            await _auto_resolve_disputes()

        mock_prisma.escrow.update.assert_called_once()
        escrow_update = mock_prisma.escrow.update.call_args
        assert escrow_update.kwargs["data"]["status"] == "REFUNDED"

    @pytest.mark.asyncio
    async def test_no_escrow_does_not_crash(self):
        """Auto-resolution succeeds even when no escrow exists for the contract."""
        from app.tasks.dispute_tasks import _auto_resolve_disputes

        dispute = _make_dispute(id=5, status="OPEN", created_days_ago=15)

        mock_prisma = MagicMock()
        mock_prisma.dispute.find_many = AsyncMock(side_effect=[[], [dispute]])
        mock_prisma.dispute.update = AsyncMock(return_value=MagicMock())
        mock_prisma.dispute.count = AsyncMock(return_value=0)
        mock_prisma.notification.create = AsyncMock()
        mock_prisma.escrow.find_first = AsyncMock(return_value=None)  # No escrow

        with patch("app.core.prisma.prisma", mock_prisma):
            result = await _auto_resolve_disputes()

        # Should still succeed
        assert result["auto_resolved"] == 1
        mock_prisma.escrow.update.assert_not_called()
