"""
Tests for live session services.
Covers: booking, transfer, reviews, host codes, recording, chat, approval, payouts.

IMPORTANT: This test file patches app.core.prisma at import hook level to prevent
the Prisma ORM client from trying to connect to the database during import.
"""

import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

from tests.conftest import build_fake_prisma_module

# ─── Pre-import mock: replace app.core.prisma before any app import ─────────
# Prisma() constructor hangs on import, so we must prevent the real module from loading.
# The fake is built by the shared helper so it exposes the complete module
# surface (prisma + connect/disconnect/ensure_connection/get_prisma) plus rich
# model namespaces — a partial fake breaks unrelated suites for the whole run.

prisma_mod = build_fake_prisma_module()
_mock_prisma = prisma_mod.prisma
sys.modules["app.core.prisma"] = prisma_mod


# Also mock generated prisma to prevent its slow import
class _FakeJson:
    def __init__(self, data):
        self.data = data

    def __getitem__(self, item):
        return self.data[item]

    def __contains__(self, item):
        return item in self.data

    def __repr__(self):
        return f"Json({self.data})"

    def __eq__(self, other):
        return self.data == (other.data if hasattr(other, "data") else other)


generated_prisma_mod = types.ModuleType("app.generated.prisma")
generated_prisma_mod.Json = _FakeJson
generated_prisma_mod.fields = MagicMock()  # filter helpers used by routers
generated_prisma_mod.fields.Json = _FakeJson
generated_prisma_mod.enums = MagicMock()  # purpose/status enums

# Snapshot the *real* generated-prisma modules before shadowing them: leaving
# MagicMock enums in sys.modules poisons every module imported later in the same
# process (enum comparisons become identity checks against unrelated mocks).
import importlib as _importlib  # noqa: E402

_REAL_GENERATED_PRISMA: dict[str, types.ModuleType] = {}
for _module_name in (
    "app.generated.prisma",
    "app.generated.prisma.enums",
    "app.generated.prisma.fields",
    "app.generated.prisma.types",
    "app.generated.prisma.models",
):
    try:
        _REAL_GENERATED_PRISMA[_module_name] = _importlib.import_module(_module_name)
    except Exception:  # pragma: no cover - generated client may be absent
        pass

sys.modules["app.generated.prisma"] = generated_prisma_mod
sys.modules["app.generated.prisma.fields"] = generated_prisma_mod.fields
sys.modules["app.generated.prisma.enums"] = generated_prisma_mod.enums
sys.modules["app.generated.prisma.types"] = MagicMock()
sys.modules["app.generated.prisma.models"] = MagicMock()

import pytest
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException

# Now safe to import from app services


from app.services.live_session_service import (
    _serialize_session,
    _generate_coupon_code,
    generate_host_codes,
    validate_host_code,
    get_effective_price,
    book_session,
    transfer_booking,
    accept_transfer,
    get_recording_download,
    get_replay_access,
    create_review,
    get_session_reviews,
    get_user_review,
    approve_session,
    reject_session,
    get_pending_approval_count,
    save_chat_message,
    get_chat_messages,
    process_pending_payouts,
    join_session,
    get_join_token,
    refresh_join_token,
    create_session,
    start_session,
    leave_session,
    get_live_ecosystem_context,
    HOST_MONTHLY_FREE_CODES,
)

from app.routers.live_sessions import livekit_webhook, router as live_sessions_router
from app.core.auth import get_current_super_admin
from app.services.livekit_service import create_access_token
from app.core.security import create_access_token as security_create_token
from app.tasks.live_session_tasks import reconcile_orphaned_sessions_async

# This module's imports are done; put the genuine generated-prisma modules back
# so the rest of the test process is not poisoned by the MagicMock enums above.
for _module_name, _module in _REAL_GENERATED_PRISMA.items():
    sys.modules[_module_name] = _module


@pytest.fixture(autouse=True)
def _mock_interactive_transaction():
    """Stub prisma.tx() so atomic book_session code paths run against the same
    mock objects the individual tests configure (find_unique/count/create)."""
    original_tx = _mock_prisma.tx
    tx = MagicMock()
    tx.livesession = _mock_prisma.livesession
    tx.livesessionbooking = _mock_prisma.livesessionbooking
    tx.livesessionparticipant = _mock_prisma.livesessionparticipant
    tx.query_raw = AsyncMock(return_value=[{"id": "sess-001"}])
    # Real transactions expose both raw helpers; the payout path takes a row
    # lock with execute_raw before re-reading the session.
    tx.execute_raw = AsyncMock(return_value=1)
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=tx)
    cm.__aexit__ = AsyncMock(return_value=False)
    _mock_prisma.tx = MagicMock(return_value=cm)
    yield
    # Restore the shared fake instead of leaving a bare MagicMock behind: a
    # bare mock is not an async context manager, which used to break every
    # later module that relied on prisma.tx() in the same process.
    _mock_prisma.tx = original_tx


def _make_session(
    id="sess-001",
    title="Test Session",
    owner_id=1,
    price_amount=0,
    status="SCHEDULED",
    approved=True,
    visibility="PUBLIC",
    room_name="room-001",
    scheduled_at=None,
    recording_url=None,
    replay_url=None,
    max_participants=None,
    started_at=None,
    room_metadata=None,
    duration_minutes=None,
    recording_egress_id=None,
):
    s = MagicMock()
    s.id = id
    s.title = title
    s.ownerId = owner_id
    s.priceAmount = price_amount
    s.currency = "DZD"
    s.status = status
    s.approvedAt = datetime.now(timezone.utc) if approved else None
    s.rejectedAt = None
    s.rejectionReason = None
    s.visibility = visibility
    s.roomName = room_name
    s.recordingUrl = recording_url
    s.replayUrl = replay_url
    s.replayExpiresAt = None
    s.maxParticipants = max_participants
    s.scheduledAt = scheduled_at or (datetime.now(timezone.utc) + timedelta(days=2))
    s.startedAt = started_at
    s.endedAt = None
    s.roomMetadata = room_metadata or {}
    s.moduleId = None
    s.lessonId = None
    s.durationMinutes = duration_minutes
    s.recordingEgressId = recording_egress_id
    s.createdAt = datetime.now(timezone.utc)
    s.updatedAt = datetime.now(timezone.utc)
    s.deletedAt = None
    s.participant_count = 0
    return s


def _make_participant(
    id=1, session_id="sess-001", user_id=2, role="PARTICIPANT", joined_at=None
):
    p = MagicMock()
    p.id = id
    p.liveSessionId = session_id
    p.userId = user_id
    p.role = role
    p.joinedAt = joined_at or datetime.now(timezone.utc) - timedelta(minutes=5)
    p.leftAt = None
    p.attendancePct = None
    return p


def _make_booking(
    id=1,
    session_id="sess-001",
    user_id=1,
    status="confirmed",
    deleted=False,
    host_code=None,
    metadata=None,
):
    b = MagicMock()
    b.id = id
    b.liveSessionId = session_id
    b.userId = user_id
    b.status = status
    b.deletedAt = datetime.now(timezone.utc) if deleted else None
    b.hostCode = host_code
    b.metadata = metadata
    return b


def _make_transaction(
    id=1,
    user_id=2,
    amount=5000,
    status="COMPLETED",
    purpose="LIVE_SESSION_PURCHASE",
    metadata=None,
):
    t = MagicMock()
    t.id = id
    t.userId = user_id
    t.amount = amount
    t.status = status
    t.purpose = purpose
    t.metadata = metadata
    return t


def _make_user(id=1, email="user@test.com", name="Test User", role="STUDENT"):
    u = MagicMock()
    u.id = id
    u.email = email
    u.fullName = name
    u.role = role
    return u


# ─── Host Codes ──────────────────────────────────────────────────────────────


class TestGenerateHostCodes:
    @pytest.mark.asyncio
    async def test_generates_codes_when_under_limit(self):
        _mock_prisma.livesessionbooking.count = AsyncMock(return_value=0)
        codes = await generate_host_codes(creator_id=1, count=3)
        assert len(codes) == 3
        assert all(c.startswith("HOST-1-") for c in codes)

    @pytest.mark.asyncio
    async def test_limits_to_monthly_limit(self):
        _mock_prisma.livesessionbooking.count = AsyncMock(return_value=0)
        codes = await generate_host_codes(creator_id=1, count=999)
        assert len(codes) == HOST_MONTHLY_FREE_CODES

    @pytest.mark.asyncio
    async def test_raises_when_exhausted(self):
        _mock_prisma.livesessionbooking.count = AsyncMock(
            return_value=HOST_MONTHLY_FREE_CODES
        )
        with pytest.raises(HTTPException) as exc:
            await generate_host_codes(creator_id=1)
        assert exc.value.status_code == 429

    @pytest.mark.asyncio
    async def test_remaining_honored(self):
        used = HOST_MONTHLY_FREE_CODES - 2
        _mock_prisma.livesessionbooking.count = AsyncMock(return_value=used)
        codes = await generate_host_codes(creator_id=1, count=5)
        assert len(codes) == 2


class TestValidateHostCode:
    @pytest.mark.asyncio
    async def test_valid_code_format(self):
        _mock_prisma.livesessionbooking.count = AsyncMock(return_value=0)
        valid_code = _generate_coupon_code(1)
        assert await validate_host_code(valid_code, 1) is True

    @pytest.mark.asyncio
    async def test_wrong_prefix(self):
        valid_code = _generate_coupon_code(1)
        wrong_prefix = "INVALID" + valid_code[4:]
        assert await validate_host_code(wrong_prefix, 1) is False

    @pytest.mark.asyncio
    async def test_wrong_owner(self):
        valid_code = _generate_coupon_code(1)
        assert await validate_host_code(valid_code, 2) is False

    @pytest.mark.asyncio
    async def test_garbage_code(self):
        assert await validate_host_code("not-a-code", 1) is False

    @pytest.mark.asyncio
    async def test_exhausted_returns_false(self):
        _mock_prisma.livesessionbooking.count = AsyncMock(
            return_value=HOST_MONTHLY_FREE_CODES
        )
        valid_code = _generate_coupon_code(1)
        assert await validate_host_code(valid_code, 1) is False


# ─── Pricing ─────────────────────────────────────────────────────────────────


class TestGetEffectivePrice:
    def test_no_price(self):
        s = _make_session(price_amount=0)
        assert get_effective_price(s) == 0

    def test_regular_price_no_early_bird(self):
        s = _make_session(price_amount=5000, room_metadata={})
        assert get_effective_price(s) == 5000

    def test_early_bird_applies(self):
        future = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        s = _make_session(
            price_amount=5000,
            room_metadata={"earlyBirdPrice": 3000, "earlyBirdDeadline": future},
        )
        assert get_effective_price(s) == 3000

    def test_early_bird_expired(self):
        past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        s = _make_session(
            price_amount=5000,
            room_metadata={"earlyBirdPrice": 3000, "earlyBirdDeadline": past},
        )
        assert get_effective_price(s) == 5000


# ─── Booking ─────────────────────────────────────────────────────────────────


class TestBookSession:
    @pytest.mark.asyncio
    async def test_raises_if_session_not_found(self):
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc:
            await book_session("bad-id", user_id=1)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_raises_own_session(self):
        s = _make_session(owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        with pytest.raises(HTTPException) as exc:
            await book_session("sess-001", user_id=1)
        assert exc.value.status_code == 400
        assert exc.value.detail["code"] == "OWN_SESSION"

    @pytest.mark.asyncio
    async def test_raises_not_approved(self):
        s = _make_session(approved=False)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        with pytest.raises(HTTPException) as exc:
            await book_session("sess-001", user_id=2)
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "NOT_APPROVED"

    @pytest.mark.asyncio
    async def test_free_session_books_without_transaction(self):
        s = _make_session(price_amount=0, owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessionbooking.count = AsyncMock(return_value=0)
        _mock_prisma.livesessionbooking.create = AsyncMock(return_value=_make_booking())
        _mock_prisma.livesessionwaitlist.find_unique = AsyncMock(return_value=None)
        result = await book_session("sess-001", user_id=2)
        assert result["status"] == "confirmed"

    @pytest.mark.asyncio
    async def test_paid_session_requires_transaction(self):
        s = _make_session(price_amount=5000, owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        with pytest.raises(HTTPException) as exc:
            await book_session("sess-001", user_id=2)
        assert exc.value.status_code == 402

    @pytest.mark.asyncio
    async def test_paid_session_accepts_valid_live_session_transaction(self):
        s = _make_session(price_amount=5000, owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.transaction.find_unique = AsyncMock(
            return_value=_make_transaction(
                id=42,
                user_id=2,
                amount=5000,
                metadata={"live_session_id": "sess-001"},
            )
        )
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessionbooking.count = AsyncMock(return_value=0)
        _mock_prisma.livesessionbooking.create = AsyncMock(return_value=_make_booking())
        _mock_prisma.livesessionwaitlist.find_unique = AsyncMock(return_value=None)
        result = await book_session("sess-001", user_id=2, transaction_id=42)
        assert result["status"] == "confirmed"
        created = _mock_prisma.livesessionbooking.create.call_args
        assert created.kwargs["data"]["transactionId"] == 42

    @pytest.mark.asyncio
    async def test_paid_session_rejects_wallet_topup_transaction(self):
        s = _make_session(price_amount=5000, owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.transaction.find_unique = AsyncMock(
            return_value=_make_transaction(
                id=7,
                user_id=2,
                amount=5000,
                purpose="DEPOSIT",
                metadata={"type": "wallet_topup"},
            )
        )
        with pytest.raises(HTTPException) as exc:
            await book_session("sess-001", user_id=2, transaction_id=7)
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "INVALID_TRANSACTION"

    @pytest.mark.asyncio
    async def test_paid_session_rejects_unrelated_live_session_transaction(self):
        s = _make_session(price_amount=5000, owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.transaction.find_unique = AsyncMock(
            return_value=_make_transaction(
                id=9,
                user_id=2,
                amount=5000,
                metadata={"live_session_id": "sess-OTHER"},
            )
        )
        with pytest.raises(HTTPException) as exc:
            await book_session("sess-001", user_id=2, transaction_id=9)
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "INVALID_TRANSACTION"

    @pytest.mark.asyncio
    async def test_paid_session_rejects_incomplete_transaction(self):
        s = _make_session(price_amount=5000, owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.transaction.find_unique = AsyncMock(
            return_value=_make_transaction(
                id=11,
                user_id=2,
                amount=5000,
                status="PENDING",
                metadata={"live_session_id": "sess-001"},
            )
        )
        with pytest.raises(HTTPException) as exc:
            await book_session("sess-001", user_id=2, transaction_id=11)
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "INVALID_TRANSACTION"

    @pytest.mark.asyncio
    async def test_paid_session_rejects_undersized_transaction(self):
        s = _make_session(price_amount=5000, owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.transaction.find_unique = AsyncMock(
            return_value=_make_transaction(
                id=13,
                user_id=2,
                amount=1000,
                metadata={"live_session_id": "sess-001"},
            )
        )
        with pytest.raises(HTTPException) as exc:
            await book_session("sess-001", user_id=2, transaction_id=13)
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "INVALID_TRANSACTION"

    @pytest.mark.asyncio
    async def test_paid_session_rejects_transaction_of_another_user(self):
        s = _make_session(price_amount=5000, owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.transaction.find_unique = AsyncMock(
            return_value=_make_transaction(
                id=17,
                user_id=999,
                amount=5000,
                metadata={"live_session_id": "sess-001"},
            )
        )
        with pytest.raises(HTTPException) as exc:
            await book_session("sess-001", user_id=2, transaction_id=17)
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "INVALID_TRANSACTION"

    @pytest.mark.asyncio
    async def test_host_code_bypasses_payment(self):
        code = _generate_coupon_code(1)
        s = _make_session(price_amount=5000, owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.count = AsyncMock(return_value=0)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessionbooking.create = AsyncMock(
            return_value=_make_booking(host_code=code)
        )
        _mock_prisma.livesessionwaitlist.find_unique = AsyncMock(return_value=None)
        result = await book_session("sess-001", user_id=2, host_code=code)
        assert result["status"] == "confirmed"

    @pytest.mark.asyncio
    async def test_invalid_host_code(self):
        s = _make_session(price_amount=5000, owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        with pytest.raises(HTTPException) as exc:
            await book_session("sess-001", user_id=2, host_code="BAD-CODE")
        assert exc.value.status_code == 400
        assert exc.value.detail["code"] == "INVALID_HOST_CODE"

    @pytest.mark.asyncio
    async def test_full_session(self):
        s = _make_session(price_amount=0, owner_id=1, max_participants=5)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.count = AsyncMock(return_value=5)
        with pytest.raises(HTTPException) as exc:
            await book_session("sess-001", user_id=2)
        assert exc.value.status_code == 409
        assert exc.value.detail["code"] == "SESSION_FULL"

    @pytest.mark.asyncio
    async def test_already_booked(self):
        s = _make_session(price_amount=0, owner_id=1)
        existing = _make_booking()
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=existing)
        with pytest.raises(HTTPException) as exc:
            await book_session("sess-001", user_id=2)
        assert exc.value.status_code == 409
        assert exc.value.detail["code"] == "ALREADY_BOOKED"


# ─── Transfer Booking ────────────────────────────────────────────────────────


class TestTransferBooking:
    @pytest.mark.asyncio
    async def test_raises_if_booking_not_found(self):
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc:
            await transfer_booking(
                booking_id=1, from_user_id=1, recipient_email="r@t.com"
            )
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_raises_not_owner(self):
        booking = _make_booking(user_id=1)
        booking.liveSession = _make_session()
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=booking)
        with pytest.raises(HTTPException) as exc:
            await transfer_booking(
                booking_id=1, from_user_id=999, recipient_email="r@t.com"
            )
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_raises_too_close_to_session(self):
        booking = _make_booking(user_id=1)
        session = _make_session(
            scheduled_at=datetime.now(timezone.utc) + timedelta(hours=12)
        )
        booking.liveSession = session
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=booking)
        with pytest.raises(HTTPException) as exc:
            await transfer_booking(
                booking_id=1, from_user_id=1, recipient_email="r@t.com"
            )
        assert exc.value.status_code == 400
        assert exc.value.detail["code"] == "TOO_LATE"

    @pytest.mark.asyncio
    async def test_raises_self_transfer(self):
        booking = _make_booking(user_id=1)
        booking.liveSession = _make_session()
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=booking)
        _mock_prisma.user.find_first = AsyncMock(return_value=_make_user(id=1))
        with pytest.raises(HTTPException) as exc:
            await transfer_booking(
                booking_id=1, from_user_id=1, recipient_email="same@test.com"
            )
        assert exc.value.status_code == 400
        assert exc.value.detail["code"] == "OWN_SESSION"

    @pytest.mark.asyncio
    async def test_successful_transfer_issues_acceptance_token(self):
        booking = _make_booking(user_id=1)
        booking.liveSession = _make_session()
        recipient = _make_user(id=2, email="recipient@test.com")
        # find_unique called twice: first for booking lookup (return booking),
        # then for duplicate check (return None)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(
            side_effect=[booking, None]
        )
        _mock_prisma.user.find_first = AsyncMock(return_value=recipient)
        updated_booking = _make_booking(user_id=1)
        _mock_prisma.livesessionbooking.update = AsyncMock(return_value=updated_booking)
        result = await transfer_booking(
            booking_id=1, from_user_id=1, recipient_email="recipient@test.com"
        )
        # Two-step flow: only a signed acceptance link is returned; the booking
        # stays with the original owner until the recipient accepts it.
        assert result["transfer_url"].startswith("/live/transfer/accept/")
        assert result["booking"]["userId"] == 1


class TestAcceptTransfer:
    @pytest.mark.asyncio
    async def test_accept_reassigns_booking_to_recipient(self):
        booking = _make_booking(user_id=1)
        booking.liveSession = _make_session()
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(
            side_effect=[booking, None]
        )
        updated_booking = _make_booking(user_id=2)
        _mock_prisma.livesessionbooking.update = AsyncMock(return_value=updated_booking)
        with patch(
            "app.services.live_session_service._send_notification"
        ) as send_notification:
            token = security_create_token(
                {"sub": "2", "booking_id": 1, "purpose": "booking_transfer"},
                expires_delta=timedelta(days=7),
            )
            result = await accept_transfer(token, user_id=2)

        assert result["userId"] == 2
        assert result["status"] == "confirmed"
        send_notification.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_accept_denied_for_non_recipient(self):
        booking = _make_booking(user_id=1)
        booking.liveSession = _make_session()
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=booking)
        token = security_create_token(
            {"sub": "2", "booking_id": 1, "purpose": "booking_transfer"},
            expires_delta=timedelta(days=7),
        )
        with pytest.raises(HTTPException) as exc:
            await accept_transfer(token, user_id=99)
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "FORBIDDEN"

    @pytest.mark.asyncio
    async def test_accept_denied_invalid_token(self):
        with pytest.raises(HTTPException) as exc:
            await accept_transfer("not-a-jwt", user_id=2)
        assert exc.value.status_code == 400
        assert exc.value.detail["code"] == "INVALID_TOKEN"

    @pytest.mark.asyncio
    async def test_accept_denied_expired_token(self):
        token = security_create_token(
            {"sub": "2", "booking_id": 1, "purpose": "booking_transfer"},
            expires_delta=timedelta(days=-1),
        )
        with pytest.raises(HTTPException) as exc:
            await accept_transfer(token, user_id=2)
        assert exc.value.status_code == 400
        assert exc.value.detail["code"] == "INVALID_TOKEN"

    @pytest.mark.asyncio
    async def test_accept_denied_when_booking_already_owned(self):
        booking = _make_booking(user_id=2)
        booking.liveSession = _make_session()
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=booking)
        token = security_create_token(
            {"sub": "2", "booking_id": 1, "purpose": "booking_transfer"},
            expires_delta=timedelta(days=7),
        )
        with pytest.raises(HTTPException) as exc:
            await accept_transfer(token, user_id=2)
        assert exc.value.status_code == 409
        assert exc.value.detail["code"] == "ALREADY_OWNED"


# ─── Recording Download ──────────────────────────────────────────────────────


class TestGetRecordingDownload:
    @pytest.mark.asyncio
    async def test_returns_none_if_not_found(self):
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=None)
        assert await get_recording_download("bad-id", user_id=1) is None

    @pytest.mark.asyncio
    async def test_allows_owner_download(self):
        s = _make_session(owner_id=1, recording_url="https://cdn.example.com/rec.mp4")
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        url = await get_recording_download("sess-001", user_id=1)
        assert url == "https://cdn.example.com/rec.mp4"

    @pytest.mark.asyncio
    async def test_raises_for_non_owner_no_cohost(self):
        s = _make_session(owner_id=1, recording_url="https://cdn.example.com/rec.mp4")
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessioncohost.find_unique = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc:
            await get_recording_download("sess-001", user_id=2)
        assert exc.value.status_code == 403


# ─── Reviews ─────────────────────────────────────────────────────────────────


class TestCreateReview:
    @pytest.mark.asyncio
    async def test_raises_not_found(self):
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc:
            await create_review("bad-id", user_id=1, rating=5)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_raises_own_session(self):
        s = _make_session(owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        with pytest.raises(HTTPException) as exc:
            await create_review("sess-001", user_id=1, rating=5)
        assert exc.value.status_code == 400
        assert exc.value.detail["code"] == "OWN_SESSION"

    @pytest.mark.asyncio
    async def test_raises_duplicate(self):
        s = _make_session(owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionreview.find_unique = AsyncMock(
            return_value=MagicMock(id=1)
        )
        with pytest.raises(HTTPException) as exc:
            await create_review("sess-001", user_id=2, rating=4)
        assert exc.value.status_code == 409
        assert exc.value.detail["code"] == "ALREADY_REVIEWED"


class TestGetSessionReviews:
    @pytest.mark.asyncio
    async def test_empty_reviews(self):
        _mock_prisma.livesessionreview.count = AsyncMock(return_value=0)
        _mock_prisma.livesessionreview.find_many = AsyncMock(return_value=[])
        result = await get_session_reviews("sess-001")
        assert result["total"] == 0
        assert result["items"] == []


class TestGetUserReview:
    @pytest.mark.asyncio
    async def test_returns_none_if_no_review(self):
        _mock_prisma.livesessionreview.find_unique = AsyncMock(return_value=None)
        assert await get_user_review("sess-001", user_id=1) is None


# ─── Approval ────────────────────────────────────────────────────────────────


class TestApproveSession:
    @pytest.mark.asyncio
    async def test_raises_not_found(self):
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc:
            await approve_session("bad-id")
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_approves_successfully(self):
        s = _make_session(approved=False)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesession.update = AsyncMock(return_value=s)
        assert await approve_session("sess-001") is True


class TestRejectSession:
    @pytest.mark.asyncio
    async def test_raises_not_found(self):
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc:
            await reject_session("bad-id", reason="Bad content")
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_rejects_successfully(self):
        s = _make_session(approved=False)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesession.update = AsyncMock(return_value=s)
        assert await reject_session("sess-001", reason="Bad content") is True


class TestGetPendingApprovalCount:
    @pytest.mark.asyncio
    async def test_returns_count(self):
        _mock_prisma.livesession.count = AsyncMock(return_value=3)
        assert await get_pending_approval_count() == 3


# ─── Chat Messages ───────────────────────────────────────────────────────────


class TestSaveChatMessage:
    @pytest.mark.asyncio
    async def test_raises_not_found(self):
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc:
            await save_chat_message("bad-id", user_id=1, message="Hello")
        assert exc.value.status_code == 404


class TestGetChatMessages:
    @pytest.mark.asyncio
    async def test_returns_empty(self):
        _mock_prisma.livesessionchatmessage.count = AsyncMock(return_value=0)
        _mock_prisma.livesessionchatmessage.find_many = AsyncMock(return_value=[])
        result = await get_chat_messages("sess-001")
        assert result["total"] == 0


# ─── Join Session ────────────────────────────────────────────────────────────


class TestLeaveSessionAttendance:
    @pytest.mark.asyncio
    async def test_attendance_measured_against_session_duration(self):
        """A 20-minute stay in a 30-minute session must yield ~66.7% attendance,
        not the old fixed-one-hour math that would report ~33%."""
        joined = datetime.now(timezone.utc) - timedelta(minutes=20)
        participant = _make_participant(joined_at=joined)
        _mock_prisma.livesessionparticipant.find_unique = AsyncMock(
            return_value=participant
        )
        _mock_prisma.livesession.find_unique = AsyncMock(
            return_value=_make_session(duration_minutes=30)
        )
        _mock_prisma.livesessionparticipant.update = AsyncMock(return_value=participant)

        result = await leave_session("sess-001", user_id=2)

        assert result is True
        data = _mock_prisma.livesessionparticipant.update.call_args.kwargs["data"]
        assert data["leftAt"] is not None
        assert data["attendancePct"] == pytest.approx(66.666, abs=0.1)

    @pytest.mark.asyncio
    async def test_full_session_caps_at_100(self):
        joined = datetime.now(timezone.utc) - timedelta(minutes=90)
        participant = _make_participant(joined_at=joined)
        _mock_prisma.livesessionparticipant.find_unique = AsyncMock(
            return_value=participant
        )
        _mock_prisma.livesession.find_unique = AsyncMock(
            return_value=_make_session(duration_minutes=30)
        )
        _mock_prisma.livesessionparticipant.update = AsyncMock(return_value=participant)

        await leave_session("sess-001", user_id=2)

        data = _mock_prisma.livesessionparticipant.update.call_args.kwargs["data"]
        assert data["attendancePct"] == 100.0


class TestLiveKitTokenGrants:
    @patch("app.services.livekit_service._get_api_key", return_value="key")
    @patch("app.services.livekit_service._get_api_secret", return_value="secret")
    @patch("app.services.livekit_service.AccessToken")
    @patch("app.services.livekit_service.VideoGrants")
    def test_participant_token_cannot_publish(
        self, video_grants_cls, access_token_cls, _secret, _key
    ):
        create_access_token("user_2", "room-x", role="PARTICIPANT")
        grants = video_grants_cls.call_args.kwargs
        assert grants["room_join"] is True
        assert grants["room"] == "room-x"
        assert grants["can_publish"] is False
        assert grants["can_publish_data"] is True
        assert grants["can_subscribe"] is True

    @patch("app.services.livekit_service._get_api_key", return_value="key")
    @patch("app.services.livekit_service._get_api_secret", return_value="secret")
    @patch("app.services.livekit_service.AccessToken")
    @patch("app.services.livekit_service.VideoGrants")
    def test_host_token_can_publish(
        self, video_grants_cls, access_token_cls, _secret, _key
    ):
        create_access_token("user_1", "room-x", role="HOST")
        grants = video_grants_cls.call_args.kwargs
        assert grants["can_publish"] is True
        assert grants["can_publish_data"] is True

    @patch("app.services.livekit_service._get_api_key", return_value="key")
    @patch("app.services.livekit_service._get_api_secret", return_value="secret")
    @patch("app.services.livekit_service.AccessToken")
    @patch("app.services.livekit_service.VideoGrants")
    def test_cohost_and_admin_tokens_can_publish(
        self, video_grants_cls, access_token_cls, _secret, _key
    ):
        create_access_token("user_3", "room-x", role="CO_HOST")
        create_access_token("user_4", "room-x", role="ADMIN")
        grants = video_grants_cls.call_args_list
        assert all(g.kwargs["can_publish"] is True for g in grants)

    @patch("app.services.livekit_service._get_api_key", return_value="key")
    @patch("app.services.livekit_service._get_api_secret", return_value="secret")
    @patch("app.services.livekit_service.AccessToken")
    @patch("app.services.livekit_service.VideoGrants")
    def test_default_role_is_participant(
        self, video_grants_cls, access_token_cls, _secret, _key
    ):
        create_access_token("user_5", "room-x")
        grants = video_grants_cls.call_args.kwargs
        assert grants["can_publish"] is False


class TestReconcileOrphanedSessions:
    @pytest.mark.asyncio
    @patch("app.services.livekit_service.get_room")
    @patch("app.services.wallet_service.wallet_service")
    @patch("app.services.live_session_service._send_notification")
    async def test_marks_orphaned_session_ended_and_pays_host(
        self, send_notification, wallet_service, get_room
    ):
        """A LIVE session whose LiveKit room no longer exists must be ended,
        given a duration, flagged payoutReady, and the host paid immediately."""
        started = datetime.now(timezone.utc) - timedelta(minutes=60)
        s = _make_session(
            status="LIVE",
            price_amount=5000,
            room_name="room-orphan",
            started_at=started,
        )
        s.durationMinutes = 60
        s.roomMetadata = {}
        s.participants = [
            MagicMock(
                userId=999,
                role="PARTICIPANT",
                metadata={"totalDurationSeconds": 3600.0},
                joinedAt=started,
                leftAt=started + timedelta(minutes=60),
            )
        ]
        _mock_prisma.livesession.find_many = AsyncMock(return_value=[s])
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesession.update = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_many = AsyncMock(
            return_value=[_make_booking()]
        )
        _mock_prisma.wallet.find_unique = AsyncMock(return_value=MagicMock(id=1))
        get_room.return_value = None
        wallet_service.credit_wallet = AsyncMock()

        await reconcile_orphaned_sessions_async()

        end_data = _mock_prisma.livesession.update.call_args_list[0].kwargs["data"]
        assert end_data["status"] == "ENDED"
        assert end_data["endedAt"] is not None
        assert end_data["durationMinutes"] == 60
        assert (
            getattr(end_data["roomMetadata"], "data", end_data["roomMetadata"])[
                "payoutReady"
            ]
            is True
        )
        wallet_service.credit_wallet.assert_awaited_once()
        send_notification.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("app.services.livekit_service.get_room")
    async def test_keeps_live_room_untouched(self, get_room):
        """A LIVE session whose room still exists must NOT be touched."""
        s = _make_session(status="LIVE", room_name="room-alive")
        s.roomMetadata = {}
        _mock_prisma.livesession.find_many = AsyncMock(return_value=[s])
        _mock_prisma.livesession.update = AsyncMock(return_value=s)
        get_room.return_value = MagicMock(name="room")

        await reconcile_orphaned_sessions_async()

        _mock_prisma.livesession.update.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("app.services.livekit_service.get_room")
    @patch("app.services.wallet_service.wallet_service")
    @patch("app.services.live_session_service._send_notification")
    async def test_free_orphaned_session_skips_payout(
        self, send_notification, wallet_service, get_room
    ):
        """Free sessions are ended and flagged but never generate a payout."""
        s = _make_session(status="LIVE", price_amount=0, room_name="room-orphan-free")
        s.roomMetadata = {}
        _mock_prisma.livesession.find_many = AsyncMock(return_value=[s])
        _mock_prisma.livesession.update = AsyncMock(return_value=s)
        get_room.return_value = None
        wallet_service.credit_wallet = AsyncMock()

        await reconcile_orphaned_sessions_async()

        end_data = _mock_prisma.livesession.update.call_args_list[0].kwargs["data"]
        assert end_data["status"] == "ENDED"
        assert (
            getattr(end_data["roomMetadata"], "data", end_data["roomMetadata"])[
                "payoutReady"
            ]
            is True
        )
        wallet_service.credit_wallet.assert_not_awaited()
        send_notification.assert_not_awaited()


class TestBookSessionConcurrency:
    @pytest.mark.asyncio
    async def test_concurrent_bookings_respect_capacity(self):
        import asyncio

        s = _make_session(price_amount=0, owner_id=1, max_participants=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessionwaitlist.find_unique = AsyncMock(return_value=None)

        seat_calls = 0

        async def count_seats(**kwargs):
            nonlocal seat_calls
            seat_calls += 1
            return 0 if seat_calls == 1 else 1

        _mock_prisma.livesessionbooking.count = AsyncMock(side_effect=count_seats)
        _mock_prisma.livesessionbooking.create = AsyncMock(return_value=_make_booking())

        results = await asyncio.gather(
            book_session("sess-001", user_id=2),
            book_session("sess-001", user_id=3),
            book_session("sess-001", user_id=4),
            return_exceptions=True,
        )

        ok = [r for r in results if not isinstance(r, HTTPException)]
        full = [
            r for r in results if isinstance(r, HTTPException) and r.status_code == 409
        ]
        assert len(ok) == 1
        assert len(full) == 2
        assert all(r.detail["code"] == "SESSION_FULL" for r in full)


class TestJoinSession:
    @pytest.mark.asyncio
    async def test_raises_not_live(self):
        s = _make_session(status="SCHEDULED")
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        with pytest.raises(HTTPException) as exc:
            await join_session("sess-001", user_id=2)
        assert exc.value.status_code == 409
        assert exc.value.detail["code"] == "NOT_LIVE"

    @pytest.mark.asyncio
    async def test_paid_session_requires_booking(self):
        s = _make_session(status="LIVE", price_amount=5000)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessioncohost.find_unique = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc:
            await join_session("sess-001", user_id=2)
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "NOT_BOOKED"

    @pytest.mark.asyncio
    async def test_owner_can_join_without_booking(self):
        s = _make_session(status="LIVE", owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessionparticipant.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessionparticipant.count = AsyncMock(return_value=0)
        _mock_prisma.livesessionparticipant.create = AsyncMock(return_value=None)
        _mock_prisma.livesession.update = AsyncMock(return_value=None)
        with patch(
            "app.services.live_session_service.create_access_token"
        ) as mock_token:
            mock_token.return_value = "mock-token"
            token = await join_session("sess-001", user_id=1)
            assert token == "mock-token"

    @pytest.mark.asyncio
    async def test_late_arrival_for_free_session(self):
        started = datetime.now(timezone.utc) - timedelta(minutes=30)
        s = _make_session(status="LIVE", price_amount=0, started_at=started)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(
            return_value=_make_booking(user_id=2)
        )
        _mock_prisma.livesessioncohost.find_unique = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc:
            await join_session("sess-001", user_id=2)
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "LATE_ARRIVAL"

    @pytest.mark.asyncio
    async def test_admin_can_join_without_booking(self):
        s = _make_session(status="LIVE", price_amount=5000, owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessionparticipant.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessionparticipant.count = AsyncMock(return_value=0)
        _mock_prisma.livesessionparticipant.create = AsyncMock(return_value=None)
        _mock_prisma.livesession.update = AsyncMock(return_value=None)
        with patch(
            "app.services.live_session_service.create_access_token"
        ) as mock_token:
            mock_token.return_value = "admin-token"
            token = await join_session("sess-001", user_id=99, user_role="ADMIN")
            assert token == "admin-token"
            assert mock_token.call_args.kwargs["role"] == "HOST"


class TestRefreshJoinToken:
    """Silent renewal: an already-authorized participant gets a fresh token."""

    @pytest.mark.asyncio
    async def test_refresh_requires_existing_authorization(self):
        s = _make_session(status="LIVE", price_amount=5000, owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessioncohost.find_unique = AsyncMock(return_value=None)
        token = await refresh_join_token("sess-001", user_id=2)
        assert token is None

    @pytest.mark.asyncio
    async def test_refresh_issues_new_token_for_owner(self):
        s = _make_session(status="LIVE", owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessionparticipant.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessionparticipant.count = AsyncMock(return_value=0)
        _mock_prisma.livesessionparticipant.create = AsyncMock(return_value=None)
        _mock_prisma.livesession.update = AsyncMock(return_value=None)
        with patch(
            "app.services.live_session_service.create_access_token"
        ) as mock_token:
            mock_token.return_value = "fresh-token"
            token = await refresh_join_token("sess-001", user_id=1)
        assert token == "fresh-token"

    @pytest.mark.asyncio
    async def test_refresh_issues_token_for_admin_without_booking(self):
        s = _make_session(status="LIVE", price_amount=5000, owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessionparticipant.find_unique = AsyncMock(return_value=None)
        with patch(
            "app.services.live_session_service.create_access_token"
        ) as mock_token:
            mock_token.return_value = "admin-refresh-token"
            token = await refresh_join_token(
                "sess-001", user_id=99, user_role="SUPERADMIN"
            )
        assert token == "admin-refresh-token"
        assert mock_token.call_args.kwargs["role"] == "HOST"

    @pytest.mark.asyncio
    async def test_refresh_reuses_owner_role(self):
        s = _make_session(status="LIVE", owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessionparticipant.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessionparticipant.count = AsyncMock(return_value=0)
        _mock_prisma.livesessionparticipant.create = AsyncMock(return_value=None)
        _mock_prisma.livesession.update = AsyncMock(return_value=None)
        with patch(
            "app.services.live_session_service.create_access_token"
        ) as mock_token:
            mock_token.return_value = "fresh-token"
            await refresh_join_token("sess-001", user_id=1)
        assert mock_token.call_args.kwargs["role"] == "HOST"


class TestGetJoinToken:
    """Token acquisition for authorized members, owners, and administrators."""

    @pytest.mark.asyncio
    async def test_owner_gets_host_token(self):
        s = _make_session(status="LIVE", owner_id=1, room_name="room-001")
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessioncohost.find_unique = AsyncMock(return_value=None)
        with patch(
            "app.services.live_session_service.create_access_token"
        ) as mock_token:
            mock_token.return_value = "token-owner"
            token = await get_join_token("sess-001", user_id=1)
            assert token == "token-owner"
            assert mock_token.call_args.kwargs["role"] == "HOST"

    @pytest.mark.asyncio
    async def test_admin_gets_host_token_without_booking(self):
        s = _make_session(
            status="LIVE", price_amount=5000, owner_id=1, room_name="room-001"
        )
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessioncohost.find_unique = AsyncMock(return_value=None)
        with patch(
            "app.services.live_session_service.create_access_token"
        ) as mock_token:
            mock_token.return_value = "token-admin"
            token = await get_join_token("sess-001", user_id=99, user_role="ADMIN")
            assert token == "token-admin"
            assert mock_token.call_args.kwargs["role"] == "HOST"

    @pytest.mark.asyncio
    async def test_booked_participant_gets_participant_token(self):
        s = _make_session(
            status="LIVE", price_amount=5000, owner_id=1, room_name="room-001"
        )
        booking = MagicMock(id="bk-001", userId=2, liveSessionId="sess-001")
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=booking)
        _mock_prisma.livesessioncohost.find_unique = AsyncMock(return_value=None)
        with patch(
            "app.services.live_session_service.create_access_token"
        ) as mock_token:
            mock_token.return_value = "token-participant"
            token = await get_join_token("sess-001", user_id=2)
            assert token == "token-participant"
            assert mock_token.call_args.kwargs["role"] == "PARTICIPANT"

    @pytest.mark.asyncio
    async def test_unbooked_user_paid_session_returns_none(self):
        s = _make_session(
            status="LIVE", price_amount=5000, owner_id=1, room_name="room-001"
        )
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessioncohost.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessionparticipant.find_unique = AsyncMock(return_value=None)
        token = await get_join_token("sess-001", user_id=2)
        assert token is None

    @pytest.mark.asyncio
    async def test_free_session_allows_token(self):
        s = _make_session(
            status="LIVE", price_amount=0, owner_id=1, room_name="room-001"
        )
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessioncohost.find_unique = AsyncMock(return_value=None)
        with patch(
            "app.services.live_session_service.create_access_token"
        ) as mock_token:
            mock_token.return_value = "token-free"
            token = await get_join_token("sess-001", user_id=2)
            assert token == "token-free"
            assert mock_token.call_args.kwargs["role"] == "PARTICIPANT"


# ─── Payout ──────────────────────────────────────────────────────────────────


class TestProcessPendingPayouts:
    @pytest.mark.asyncio
    async def test_no_eligible_sessions(self):
        _mock_prisma.livesession.find_many = AsyncMock(return_value=[])
        count = await process_pending_payouts()
        assert count == 0

    @pytest.mark.asyncio
    @patch("app.services.wallet_service.wallet_service")
    @patch("app.services.live_session_service._send_notification")
    async def test_pays_host_without_payoutready_flag(
        self, send_notification, wallet_service
    ):
        """A paid ended session must be paid out even if the payoutReady flag
        was never set (e.g. it ended via the room_finished webhook before the
        fix, or the flag was missed entirely)."""
        ended = datetime.now(timezone.utc) - timedelta(hours=72)
        s = _make_session(
            status="ENDED", price_amount=5000, started_at=ended - timedelta(hours=1)
        )
        s.endedAt = ended
        s.roomMetadata = {"commissionRate": 0.15}
        _mock_prisma.livesession.find_many = AsyncMock(return_value=[s])
        _mock_prisma.livesessionbooking.find_many = AsyncMock(
            return_value=[_make_booking()]
        )
        _mock_prisma.wallet.find_unique = AsyncMock(return_value=MagicMock(id=1))
        wallet_service.credit_wallet = AsyncMock()
        _mock_prisma.livesession.update = AsyncMock(return_value=s)

        count = await process_pending_payouts()

        assert count == 1
        wallet_service.credit_wallet.assert_awaited_once()
        updated = _mock_prisma.livesession.update.call_args.kwargs["data"]
        assert (
            getattr(updated["roomMetadata"], "data", updated["roomMetadata"])[
                "payoutProcessed"
            ]
            is True
        )
        send_notification.assert_awaited_once()


class TestLiveKitWebhookRoomFinished:
    @pytest.mark.asyncio
    async def test_room_finished_marks_paid_session_payout_ready(self):
        """Regression: room_finished must set status ENDED, durationMinutes and
        payoutReady so hosts get paid when they never hit the /end endpoint."""
        started = datetime.now(timezone.utc) - timedelta(minutes=90)
        s = _make_session(
            status="LIVE", price_amount=5000, room_name="room-x", started_at=started
        )
        _mock_prisma.livesession.find_first = AsyncMock(return_value=s)
        _mock_prisma.livesession.update = AsyncMock(return_value=s)

        request = MagicMock()
        request.headers.get = MagicMock(return_value="")
        request.body = AsyncMock(return_value=b"{}")

        with patch("app.routers.live_sessions.verify_webhook") as verify:
            event = MagicMock()
            event.event = "room_finished"
            event.room.name = "room-x"
            event.participant = None
            verify.return_value = event
            await livekit_webhook(request)

        _mock_prisma.livesession.find_first.assert_awaited_once()
        data = _mock_prisma.livesession.update.call_args.kwargs["data"]
        assert data["status"] == "ENDED"
        assert data["durationMinutes"] >= 90
        assert (
            getattr(data["roomMetadata"], "data", data["roomMetadata"])["payoutReady"]
            is True
        )

    @pytest.mark.asyncio
    async def test_room_finished_free_session_no_payout_flag(self):
        started = datetime.now(timezone.utc) - timedelta(minutes=10)
        s = _make_session(
            status="LIVE", price_amount=0, room_name="room-free", started_at=started
        )
        _mock_prisma.livesession.find_first = AsyncMock(return_value=s)
        _mock_prisma.livesession.update = AsyncMock(return_value=s)

        request = MagicMock()
        request.headers.get = MagicMock(return_value="")
        request.body = AsyncMock(return_value=b"{}")

        with patch("app.routers.live_sessions.verify_webhook") as verify:
            event = MagicMock()
            event.event = "room_finished"
            event.room.name = "room-free"
            event.participant = None
            verify.return_value = event
            await livekit_webhook(request)

        data = _mock_prisma.livesession.update.call_args.kwargs["data"]
        assert data["status"] == "ENDED"
        assert "payoutReady" not in getattr(
            data["roomMetadata"], "data", data["roomMetadata"]
        )


class TestLiveKitWebhookRecordingComplete:
    def _event(self, egress_id="eg-1", url="https://livekit-cdn.example/rec.mp4"):
        event = MagicMock()
        event.event = "recording_complete"
        event.room.name = "room-x"
        event.participant = None
        event.egress_info = MagicMock()
        event.egress_info.egress_id = egress_id
        event.egress_info.url = url
        return event

    async def _dispatch(self, event):
        request = MagicMock()
        request.headers.get = MagicMock(return_value="")
        request.body = AsyncMock(return_value=b"{}")
        with patch("app.routers.live_sessions.verify_webhook") as verify:
            verify.return_value = event
            await livekit_webhook(request)

    @pytest.mark.asyncio
    @patch("app.services.aws_video_service.aws_video_service.generate_signed_url")
    @patch("app.services.aws_video_service.aws_video_service.upload_video")
    @patch("httpx.AsyncClient")
    async def test_stores_cloudfront_signed_url(
        self, httpx_client, upload_video, gen_url
    ):
        """recording_complete must move the recording to private S3 and expose a
        short-lived CloudFront signed URL — never LiveKit's public CDN link."""
        s = _make_session(
            status="ENDED", room_name="room-x", recording_egress_id="eg-1"
        )
        _mock_prisma.livesession.find_first = AsyncMock(return_value=s)
        _mock_prisma.livesession.update = AsyncMock(return_value=s)

        resp = MagicMock()
        resp.content = b"video-bytes"
        resp.raise_for_status = MagicMock()
        httpx_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=resp
        )
        upload_video.return_value = {"raw_path": "raw/sess-001/abc.mp4"}
        gen_url.return_value = (
            "https://cloudfront.example.net/raw/sess-001/abc.mp4?Signature=signed"
        )

        await self._dispatch(self._event())

        data = _mock_prisma.livesession.update.call_args.kwargs["data"]
        assert data["replayUrl"].startswith("https://cloudfront.example.net/")
        assert "Signature" in data["replayUrl"]
        upload_video.assert_awaited_once()
        assert data["replayExpiresAt"] is not None

    @pytest.mark.asyncio
    async def test_ignores_stale_egress_for_other_session(self):
        """An egress event that does not match the session's recordingEgressId
        must not overwrite this session's replay."""
        s = _make_session(
            status="ENDED", room_name="room-x", recording_egress_id="eg-1"
        )
        _mock_prisma.livesession.find_first = AsyncMock(return_value=s)
        _mock_prisma.livesession.update = AsyncMock(return_value=s)

        await self._dispatch(
            self._event(egress_id="eg-999", url="https://other/rec.mp4")
        )

        _mock_prisma.livesession.update.assert_not_awaited()


class TestReplayAccess:
    @pytest.mark.asyncio
    async def test_owner_gets_signed_url(self):
        s = _make_session(
            owner_id=1, replay_url="https://cloudfront.example.net/x.mp4?Signature=a"
        )
        s.replayExpiresAt = datetime.now(timezone.utc) + timedelta(days=5)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)

        url = await get_replay_access("sess-001", user_id=1)

        assert url == "https://cloudfront.example.net/x.mp4?Signature=a"

    @pytest.mark.asyncio
    async def test_unrelated_user_denied(self):
        s = _make_session(
            owner_id=1, replay_url="https://cloudfront.example.net/x.mp4?Signature=a"
        )
        s.replayExpiresAt = datetime.now(timezone.utc) + timedelta(days=5)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        _mock_prisma.livesessionbooking.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessioncohost.find_unique = AsyncMock(return_value=None)

        url = await get_replay_access("sess-001", user_id=99)

        assert url is None

    @pytest.mark.asyncio
    async def test_expired_replay_denied(self):
        s = _make_session(
            owner_id=1, replay_url="https://cloudfront.example.net/x.mp4?Signature=a"
        )
        s.replayExpiresAt = datetime.now(timezone.utc) - timedelta(days=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)

        url = await get_replay_access("sess-001", user_id=1)

        assert url is None

    def test_public_response_exposes_has_recording_not_url(self):
        """The public session response must expose a hasRecording boolean and
        never the raw recordingUrl/replayUrl."""
        s = _make_session(replay_url="https://cloudfront.example.net/x.mp4?Signature=a")
        payload = _serialize_session(s)
        assert payload["hasRecording"] is True
        assert "replayUrl" not in payload
        assert "recordingUrl" not in payload


# ─── Moderation queue (Item 15) ──────────────────────────────────────────────


class TestCreateSessionModeration:
    @pytest.mark.asyncio
    @patch("app.services.live_session_service._check_concurrent_rooms")
    @patch("app.services.live_session_service._enforce_min_price")
    async def test_creates_session_unapproved(self, enforce_price, check_concurrent):
        check_concurrent.return_value = True
        owner = _make_user(role="INSTRUCTOR")
        owner.freelancerProfile = None
        owner.memberships = []
        _mock_prisma.user.find_unique = AsyncMock(return_value=owner)
        created = _make_session(status="SCHEDULED")
        _mock_prisma.livesession.create = AsyncMock(return_value=created)

        result = await create_session(
            owner_id=1,
            title="New session",
            scheduled_at=datetime.now(timezone.utc) + timedelta(days=1),
            session_type="COURSE",
        )

        assert result["status"] == "SCHEDULED"
        data = _mock_prisma.livesession.create.call_args.kwargs["data"]
        assert data["approvedAt"] is None


class TestStartSessionModeration:
    @pytest.mark.asyncio
    async def test_blocks_unapproved_session(self):
        s = _make_session(status="SCHEDULED", approved=False, owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        with pytest.raises(HTTPException) as exc:
            await start_session("sess-001", owner_id=1)
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "NOT_APPROVED"

    @pytest.mark.asyncio
    async def test_join_blocks_unapproved_session(self):
        s = _make_session(status="LIVE", approved=False, price_amount=0)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        with pytest.raises(HTTPException) as exc:
            await join_session("sess-001", user_id=2)
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "NOT_APPROVED"

    @pytest.mark.asyncio
    @patch("app.services.live_session_service.create_room")
    async def test_approved_session_can_start(self, create_room):
        s = _make_session(status="SCHEDULED", approved=True, owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=s)
        room = MagicMock()
        room.sid = "sid-1"
        create_room.return_value = room
        updated = _make_session(status="LIVE", approved=True, owner_id=1)
        _mock_prisma.livesession.update = AsyncMock(return_value=updated)

        result = await start_session("sess-001", owner_id=1)

        assert result["status"] == "LIVE"
        create_room.assert_awaited_once()


# ─── Admin authorization (Item 6) ────────────────────────────────────────────


class TestGetCurrentSuperAdmin:
    @pytest.mark.asyncio
    async def test_rejects_student_with_403(self):
        student = _make_user(role="STUDENT")
        with pytest.raises(HTTPException) as exc:
            await get_current_super_admin(current_user=student)
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_rejects_regular_user_with_403(self):
        regular = _make_user(role="USER")
        with pytest.raises(HTTPException) as exc:
            await get_current_super_admin(current_user=regular)
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_allows_admin(self):
        admin = _make_user(role="ADMIN")
        result = await get_current_super_admin(current_user=admin)
        assert result.role == "ADMIN"


class TestAdminLiveSessionEndpointsProtected:
    """The admin endpoints must be guarded by get_current_super_admin and must
    never call `.get("role")` on the (model) current_user."""

    def _dependencies(self, path: str, method: str) -> list:
        names: list[str] = []
        for route in live_sessions_router.routes:
            if getattr(route, "path", None) != path or method not in route.methods:
                continue
            stack = [route.dependant] if getattr(route, "dependant", None) else []
            while stack:
                d = stack.pop()
                if getattr(d, "call", None) is not None:
                    names.append(getattr(d.call, "__name__", str(d.call)))
                stack.extend(getattr(d, "dependencies", []) or [])
        return names

    def test_approve_uses_super_admin_dep(self):
        deps = self._dependencies(
            "/live-sessions/sessions/{session_id}/approve", "POST"
        )
        assert any(d in deps for d in ["permission_checker", "get_current_super_admin"])

    def test_reject_uses_super_admin_dep(self):
        deps = self._dependencies("/live-sessions/sessions/{session_id}/reject", "POST")
        assert any(d in deps for d in ["permission_checker", "get_current_super_admin"])

    def test_pending_count_uses_super_admin_dep(self):
        deps = self._dependencies("/live-sessions/admin/pending-count", "GET")
        assert any(d in deps for d in ["permission_checker", "get_current_super_admin"])

    def test_admin_stats_uses_super_admin_dep(self):
        deps = self._dependencies("/live-sessions/admin/stats", "GET")
        assert any(d in deps for d in ["permission_checker", "get_current_super_admin"])

    def test_admin_sessions_uses_super_admin_dep(self):
        deps = self._dependencies("/live-sessions/admin/sessions", "GET")
        assert any(d in deps for d in ["permission_checker", "get_current_super_admin"])

    @pytest.mark.asyncio
    @patch("app.routers.live_sessions.admin_list_sessions")
    async def test_admin_sessions_works_with_model_user(self, admin_list):
        """Regression: current_user is a model, not a dict — .get("role") crashed."""
        session_dict = {
            "id": "sess-001",
            "title": "Test",
            "type": "COURSE",
            "status": "LIVE",
            "visibility": "PUBLIC",
            "description": None,
            "thumbnailUrl": None,
            "category": None,
            "tags": [],
            "ownerId": 1,
            "contractId": None,
            "orgOnly": False,
            "owner": None,
            "scheduledAt": None,
            "startedAt": None,
            "endedAt": None,
            "durationMinutes": 60,
            "maxParticipants": None,
            "priceAmount": 0,
            "currency": "DZD",
            "earlyBirdPrice": None,
            "earlyBirdDeadline": None,
            "chatMode": None,
            "moderationThreshold": None,
            "organizationId": None,
            "roomName": None,
            "recordingUrl": None,
            "replayUrl": None,
            "replayExpiresAt": None,
            "approvedAt": None,
            "rejectedAt": None,
            "rejectionReason": None,
            "moduleId": None,
            "lessonId": None,
            "createdAt": None,
            "updatedAt": None,
            "participantCount": 0,
            "bookingCount": 0,
        }
        admin_list.return_value = ([session_dict], 1)
        _mock_prisma.auditlog = MagicMock()
        _mock_prisma.auditlog.create = AsyncMock()

        from app.routers.live_sessions import admin_sessions

        admin = _make_user(role="ADMIN")
        result = await admin_sessions(status=None, skip=0, limit=50, current_user=admin)

        assert result.items[0].id == "sess-001"
        admin_list.assert_awaited_once_with(status=None, skip=0, limit=50)
        _mock_prisma.auditlog.create.assert_awaited_once()
        create_data = _mock_prisma.auditlog.create.call_args.kwargs["data"]
        metadata_val = create_data["metadata"]
        assert metadata_val == {"status": None, "total": 1} or getattr(
            metadata_val, "data", None
        ) == {"status": None, "total": 1}


# ─── Ecosystem / Companion panel (A3) ─────────────────────────────────


class TestLiveEcosystemContext:
    @pytest.fixture(autouse=True)
    def _seed_members(self):
        _mock_prisma.livesessioncohost.find_unique = AsyncMock(return_value=None)
        _mock_prisma.livesessionparticipant.find_unique = AsyncMock(
            return_value=_make_participant(user_id=2)
        )
        _mock_prisma.organizationmember.find_first = AsyncMock(
            return_value=MagicMock(organizationId=7)
        )
        _mock_prisma.user.find_unique = AsyncMock(
            return_value=MagicMock(
                id=2,
                fullName="Amina B.",
                username="amina",
                headline="Data Analyst",
                profilePictureUrl="https://cdn.example/amina.jpg",
                primaryOrganizationId=None,
            )
        )
        _mock_prisma.userskill.find_many = AsyncMock(
            return_value=[
                types.SimpleNamespace(name="SQL"),
                types.SimpleNamespace(name="Python"),
                types.SimpleNamespace(name="Excel"),
            ]
        )
        _mock_prisma.skillendorsement.count = AsyncMock(side_effect=[3, 0, 1])
        yield
        _mock_prisma.livesessioncohost.find_unique = AsyncMock()
        _mock_prisma.livesessionparticipant.find_unique = AsyncMock()
        _mock_prisma.organizationmember.find_first = AsyncMock()
        _mock_prisma.user.find_unique = AsyncMock()
        _mock_prisma.userskill.find_many = AsyncMock()
        _mock_prisma.skillendorsement.count = AsyncMock()

    @pytest.mark.asyncio
    async def test_returns_health_score_and_verified_skills(self):
        _mock_prisma.livesession.find_unique = AsyncMock(
            return_value=_make_session(owner_id=1)
        )
        health = {
            "score": 82.0,
            "color": "green",
            "status": "Excellent",
            "trend": [{"score": 80, "week": "W1"}],
        }
        with patch(
            "app.services.bi_services.health_score_service.HealthScoreService.calculate_health_score",
            new=AsyncMock(return_value=health),
        ) as mock_health:
            result = await get_live_ecosystem_context(
                session_id="sess-001", requester_id=1, target_user_id=2
            )

        mock_health.assert_awaited_once()
        assert result["health"]["available"] is True
        assert result["health"]["score"] == 82.0
        assert result["health"]["color"] == "green"
        assert result["profile"]["fullName"] == "Amina B."
        assert result["profile"]["isHost"] is False
        # Skills sorted by endorsements: SQL (3) first, Excel (1) second, Python (0) last.
        assert [s["name"] for s in result["skillPassport"]["skills"]] == [
            "SQL",
            "Excel",
            "Python",
        ]
        assert result["skillPassport"]["skills"][0]["verified"] is True
        assert result["skillPassport"]["skills"][2]["verified"] is False
        assert result["skillPassport"]["verified"] is True

    @pytest.mark.asyncio
    async def test_host_can_read_cohost_context(self):
        session = _make_session(owner_id=1)
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=session)
        _mock_prisma.livesessioncohost.find_unique = AsyncMock(
            return_value=MagicMock(liveSessionId="sess-001", userId=5, deletedAt=None)
        )
        result = await get_live_ecosystem_context(
            session_id="sess-001", requester_id=1, target_user_id=5
        )
        assert result["userId"] == 5
        assert result["profile"]["isHost"] is False

    @pytest.mark.asyncio
    async def test_forbidden_for_non_member(self):
        _mock_prisma.livesession.find_unique = AsyncMock(
            return_value=_make_session(owner_id=1)
        )
        _mock_prisma.livesessionparticipant.find_unique = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc:
            await get_live_ecosystem_context(
                session_id="sess-001", requester_id=99, target_user_id=2
            )
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_unknown_session_404(self):
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc:
            await get_live_ecosystem_context(
                session_id="nope", requester_id=1, target_user_id=2
            )
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_health_unavailable_when_no_organization(self):
        _mock_prisma.livesession.find_unique = AsyncMock(
            return_value=_make_session(owner_id=1)
        )
        _mock_prisma.organizationmember.find_first = AsyncMock(return_value=None)
        result = await get_live_ecosystem_context(
            session_id="sess-001", requester_id=1, target_user_id=2
        )
        assert result["health"]["available"] is False
        assert result["health"]["score"] == 0.0
        # Skill passport still resolves without health data.
        assert len(result["skillPassport"]["skills"]) == 3


class TestKickParticipant:
    @pytest.mark.asyncio
    @patch("app.services.livekit_service.remove_participant")
    async def test_host_can_kick_participant(self, remove_p):
        from app.services.live_session_service import kick_participant

        session = _make_session(owner_id=1, room_name="room-123")
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=session)
        participant = MagicMock(
            id=10,
            liveSessionId="sess-001",
            userId=2,
            metadata={},
        )
        _mock_prisma.livesessionparticipant.find_unique = AsyncMock(
            return_value=participant
        )
        _mock_prisma.livesessionparticipant.update = AsyncMock(return_value=participant)
        remove_p.return_value = True

        res = await kick_participant(
            session_id="sess-001",
            host_user_id=1,
            target_user_id=2,
            is_banned=True,
        )
        assert res is True
        _mock_prisma.livesessionparticipant.update.assert_awaited_once()
        assert remove_p.call_count >= 1

    @pytest.mark.asyncio
    async def test_non_host_cannot_kick(self):
        from app.services.live_session_service import kick_participant

        session = _make_session(owner_id=1, room_name="room-123")
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=session)
        _mock_prisma.livesessioncohost.find_unique = AsyncMock(return_value=None)

        with pytest.raises(HTTPException) as exc:
            await kick_participant(
                session_id="sess-001",
                host_user_id=99,
                target_user_id=2,
                is_banned=True,
            )
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_cannot_kick_host(self):
        from app.services.live_session_service import kick_participant

        session = _make_session(owner_id=1, room_name="room-123")
        _mock_prisma.livesession.find_unique = AsyncMock(return_value=session)

        with pytest.raises(HTTPException) as exc:
            await kick_participant(
                session_id="sess-001",
                host_user_id=1,
                target_user_id=1,
                is_banned=True,
            )
        assert exc.value.status_code == 400
