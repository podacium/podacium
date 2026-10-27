"""Tests for LiveKit WebRTC Room Telemetry Verification & Host Payout Anti-Fraud Gates."""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from app.services.live_session_service import (
    verify_session_telemetry_for_payout,
    _process_session_payout,
    create_session_payout,
)


def _make_mock_session(
    session_id="sess-test-01",
    owner_id=1,
    duration_minutes=60,
    price_amount=5000,
    started_at=None,
    ended_at=None,
    metadata=None,
    participants=None,
):
    s = MagicMock()
    s.id = session_id
    s.ownerId = owner_id
    s.title = "Advanced Rust Systems Programming"
    s.durationMinutes = duration_minutes
    s.priceAmount = price_amount
    s.startedAt = started_at
    s.endedAt = ended_at
    s.roomMetadata = metadata or {}
    s.participants = participants or []
    return s


@pytest.mark.asyncio
async def test_telemetry_passes_when_duration_and_attendance_satisfied():
    """Valid session: 60m scheduled, broadcasted 50m (>=75%), 1 student attended 15m (>=5m)."""
    started = datetime.now(timezone.utc) - timedelta(minutes=50)
    ended = datetime.now(timezone.utc)
    student = MagicMock(
        userId=42,
        role="PARTICIPANT",
        metadata={"totalDurationSeconds": 900.0},
        joinedAt=started,
        leftAt=ended,
    )
    session = _make_mock_session(
        started_at=started,
        ended_at=ended,
        participants=[student],
    )

    is_valid, reasons = await verify_session_telemetry_for_payout(session)
    assert is_valid is True
    assert reasons == []


@pytest.mark.asyncio
async def test_telemetry_fails_when_broadcast_duration_under_75_percent():
    """Fraud attempt: 60m scheduled, host ended after 10m (<75%)."""
    started = datetime.now(timezone.utc) - timedelta(minutes=10)
    ended = datetime.now(timezone.utc)
    student = MagicMock(
        userId=42,
        role="PARTICIPANT",
        metadata={"totalDurationSeconds": 600.0},
        joinedAt=started,
        leftAt=ended,
    )
    session = _make_mock_session(
        duration_minutes=60,
        started_at=started,
        ended_at=ended,
        participants=[student],
    )

    is_valid, reasons = await verify_session_telemetry_for_payout(session)
    assert is_valid is False
    assert any("BROADCAST_DURATION_TOO_SHORT" in r for r in reasons)


@pytest.mark.asyncio
async def test_telemetry_fails_when_zero_student_attendance():
    """Fraud attempt: Host broadcasted 60m, but 0 students joined."""
    started = datetime.now(timezone.utc) - timedelta(minutes=60)
    ended = datetime.now(timezone.utc)
    # Only host in room
    host_participant = MagicMock(
        userId=1,
        role="HOST",
        metadata={"totalDurationSeconds": 3600.0},
    )
    session = _make_mock_session(
        owner_id=1,
        started_at=started,
        ended_at=ended,
        participants=[host_participant],
    )

    is_valid, reasons = await verify_session_telemetry_for_payout(session)
    assert is_valid is False
    assert any("INSUFFICIENT_STUDENT_ATTENDANCE" in r for r in reasons)


@pytest.mark.asyncio
async def test_telemetry_fails_when_student_attended_less_than_5_minutes():
    """Fraud attempt: Student bounced after 90 seconds (< 300s)."""
    started = datetime.now(timezone.utc) - timedelta(minutes=60)
    ended = datetime.now(timezone.utc)
    student = MagicMock(
        userId=99,
        role="PARTICIPANT",
        metadata={"totalDurationSeconds": 90.0},
        joinedAt=started,
        leftAt=started + timedelta(seconds=90),
    )
    session = _make_mock_session(
        started_at=started,
        ended_at=ended,
        participants=[student],
    )

    is_valid, reasons = await verify_session_telemetry_for_payout(session)
    assert is_valid is False
    assert any("INSUFFICIENT_STUDENT_ATTENDANCE" in r for r in reasons)


@pytest.mark.asyncio
@patch("app.core.prisma.prisma.livesession.update")
@patch("app.core.prisma.prisma.livesession.find_unique")
@patch("app.core.prisma.prisma.user.find_many")
@patch("app.services.notification_service.NotificationService.create_notification")
async def test_process_payout_flags_audit_required_and_notifies_admin(
    mock_notify, mock_find_users, mock_find_session, mock_update_session
):
    """When telemetry fails, _process_session_payout marks AUDIT_REQUIRED and alerts admins."""
    started = datetime.now(timezone.utc) - timedelta(minutes=5)
    ended = datetime.now(timezone.utc)
    session = _make_mock_session(
        started_at=started,
        ended_at=ended,
        participants=[],  # 0 attendees
    )
    mock_find_session.return_value = session
    mock_find_users.return_value = [MagicMock(id=10)]
    mock_notify.return_value = MagicMock()
    mock_update_session.return_value = session

    await _process_session_payout(session, session.ownerId, session.id)

    # Verify session updated with AUDIT_REQUIRED and payoutBlocked
    update_call = mock_update_session.call_args[1]["data"]["roomMetadata"]
    data = getattr(update_call, "data", update_call)
    assert data["auditStatus"] == "AUDIT_REQUIRED"
    assert data["payoutBlocked"] is True
    assert data["payoutReady"] is False
    assert len(data["auditReasons"]) > 0

    # Verify admin notification dispatched
    mock_notify.assert_awaited_once()


@pytest.mark.asyncio
@patch("app.services.wallet_service.wallet_service.credit_wallet")
async def test_create_session_payout_withholds_when_audit_required(mock_credit_wallet):
    """create_session_payout immediately halts without crediting wallet when AUDIT_REQUIRED."""
    session = _make_mock_session(
        metadata={"auditStatus": "AUDIT_REQUIRED", "payoutBlocked": True}
    )
    res = await create_session_payout(session)
    assert res is False
    mock_credit_wallet.assert_not_called()
