"""
Security hardening tests.

Regression tests for critical security fixes:
  - Price tampering via legacy /payments/initiate (server-side price stamp)
  - Moderator -> Admin privilege escalation on PATCH /admin/users/{id}
  - Broken audit log writes (wrong field mapping silently swallowed)
  - Public enumeration of unpublished (draft) course content
  - Quiz answer-key leak, webhook idempotency race, upload validation

These use the shared fake prisma from conftest (no real DB) and exercise the
actual service/router code paths, not copies of the logic.
"""

import pytest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from pydantic import ValidationError
from fastapi import HTTPException

from app.core.prisma import prisma
from app.schemas.payment import PaymentInitiateRequest, PaymentPurpose, PaymentGateway
from app.schemas.admin import AdminUserUpdate
from app.core.auth import get_current_admin_only
from app.services.billing_services.billing_core_service import (
    billing_core_service,
    is_price_verified,
    PRICE_VERIFIED_KEY,
)
from app.services.billing_services.education_service import education_billing_service
from app.services.billing_services.live_session_billing_service import (
    live_session_billing_service,
)
from app.services.content_moderation_service import ContentModerationService
from app.services.education_service import EducationService
from app.services.quiz_service import quiz_service
from app.services.file_validation_service import validate_upload
from app.routers.billing_routers.webhook_router import finalize_payment_success
from app.routers.admin import update_user


def _tx(
    purpose="COURSE_PURCHASE", metadata=None, amount=100, status="COMPLETED", user_id=7
):
    return SimpleNamespace(
        id=42,
        userId=user_id,
        amount=amount,
        currency="DZD",
        purpose=purpose,
        metadata=metadata or {},
        status=status,
        gateway="CHARGILY",
        provider="CHARGILY",
    )


class TestPriceTampering:
    """Server-side price verification must gate every entitlement grant."""

    @pytest.mark.asyncio
    async def test_legacy_initiate_rejects_course_purchase(self):
        request = PaymentInitiateRequest(
            amount=1,
            purpose=PaymentPurpose.COURSE_PURCHASE,
            user_id=1,
            success_url="http://test/success",
            failure_url="http://test/failure",
            metadata={"course_id": "m1"},
        )
        current_user = SimpleNamespace(id=1, role="STUDENT")
        from app.routers.payment import initiate_payment

        with pytest.raises(HTTPException) as exc:
            await initiate_payment(request, current_user)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_legacy_initiate_still_allows_wallet_deposit(self):
        request = PaymentInitiateRequest(
            amount=1000,
            purpose=PaymentPurpose.DEPOSIT,
            user_id=1,
            success_url="http://test/success",
            failure_url="http://test/failure",
        )
        current_user = SimpleNamespace(id=1, role="STUDENT")
        from app.routers.payment import initiate_payment
        from app.services.payment_service import payment_service

        payment_service.initiate_payment = AsyncMock(return_value={"id": "p1"})
        result = await initiate_payment(request, current_user)
        assert result == {"id": "p1"}

    def test_legacy_initiate_gateway_defaults_to_chargily(self):
        request = PaymentInitiateRequest(
            amount=1000,
            purpose=PaymentPurpose.DEPOSIT,
            user_id=1,
            success_url="http://test/success",
            failure_url="http://test/failure",
        )
        assert request.gateway == PaymentGateway.CHARGILY

    @pytest.mark.asyncio
    async def test_create_transaction_stamps_price_verified(self):
        prisma.transaction.create = AsyncMock()
        prisma.transaction.create.return_value = SimpleNamespace(id=1)
        await billing_core_service.create_transaction(
            amount=500,
            purpose=PaymentPurpose.COURSE_PURCHASE,
            user_id=1,
            metadata={"course_id": "m1"},
        )
        data = prisma.transaction.create.call_args.kwargs["data"]
        raw = data["metadata"].data
        assert PRICE_VERIFIED_KEY in raw
        assert raw["course_id"] == "m1"

    def test_is_price_verified_helpers(self):
        assert is_price_verified({PRICE_VERIFIED_KEY: "2026-01-01T00:00:00Z"})
        assert not is_price_verified({})
        assert not is_price_verified(None)
        assert not is_price_verified({"course_id": "m1"})

    @pytest.mark.asyncio
    async def test_grant_entitlements_blocks_unverified_transaction(self):
        # A legacy /payments/initiate transaction has NO price_verified_at stamp.
        prisma.transaction.find_unique = AsyncMock(
            return_value=_tx(purpose="COURSE_PURCHASE", metadata={"course_id": "m1"})
        )
        prisma.enrollment.create = AsyncMock()
        await education_billing_service.grant_entitlements(42)
        prisma.enrollment.create.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_grant_entitlements_proceeds_when_verified(self):
        prisma.transaction.find_unique = AsyncMock(
            return_value=_tx(
                purpose="COURSE_PURCHASE",
                metadata={
                    "course_id": "m1",
                    PRICE_VERIFIED_KEY: "2026-01-01T00:00:00Z",
                },
            )
        )
        prisma.module.find_unique = AsyncMock(
            return_value=SimpleNamespace(id="m1", title="Test Module", price=100.0)
        )
        prisma.enrollment.create = AsyncMock(return_value=SimpleNamespace(id=1))
        prisma.enrollment.upsert = AsyncMock(return_value=SimpleNamespace(id=1))
        # `userentitlement` is not in the shared fake prisma model list; provide
        # it here so the entitlement grant path resolves.
        user_ent = MagicMock()
        user_ent.upsert = AsyncMock()
        user_ent.find_first = AsyncMock(return_value=None)
        user_ent.find_many = AsyncMock(return_value=[])
        prisma.userentitlement = user_ent
        await education_billing_service.grant_entitlements(42)
        assert (
            prisma.enrollment.upsert.await_count > 0
            or prisma.enrollment.create.await_count > 0
        )

    @pytest.mark.asyncio
    async def test_live_session_grant_blocks_unverified_transaction(self):
        prisma.transaction.find_unique = AsyncMock(
            return_value=_tx(
                purpose="LIVE_SESSION_PURCHASE", metadata={"live_session_id": "s1"}
            )
        )
        prisma.livesession.update = AsyncMock()
        prisma.livesessionbooking.create = AsyncMock()
        await live_session_billing_service.grant_access(42)
        prisma.livesessionbooking.create.assert_not_awaited()


class TestAdminEscalation:
    """Only ADMIN may change roles; moderators are locked out."""

    @pytest.mark.asyncio
    async def test_admin_only_rejects_moderator(self):
        moderator = SimpleNamespace(id=3, role="MODERATOR")
        with pytest.raises(HTTPException) as exc:
            await get_current_admin_only(moderator)
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_only_rejects_instructor(self):
        instructor = SimpleNamespace(id=4, role="INSTRUCTOR")
        with pytest.raises(HTTPException):
            await get_current_admin_only(instructor)

    @pytest.mark.asyncio
    async def test_admin_only_allows_admin(self):
        admin = SimpleNamespace(id=2, role="ADMIN")
        assert await get_current_admin_only(admin) is admin

    def test_admin_user_update_rejects_unknown_role(self):
        with pytest.raises(ValidationError):
            AdminUserUpdate(role="SUPERUSER")

    def test_admin_user_update_allows_known_roles(self):
        assert AdminUserUpdate(role="MODERATOR").role == "MODERATOR"
        assert AdminUserUpdate(role="STUDENT").role == "STUDENT"

    @pytest.mark.asyncio
    async def test_self_demotion_is_blocked(self):
        prisma.user.find_unique = AsyncMock(
            return_value=SimpleNamespace(id=2, role="ADMIN", email="admin@test.com")
        )
        admin = SimpleNamespace(id=2, role="ADMIN")
        with pytest.raises(HTTPException) as exc:
            await update_user(2, AdminUserUpdate(role="STUDENT"), admin)
        assert exc.value.status_code == 400


class TestAuditLog:
    """AuditLog writes must use the model's real fields."""

    def setup_method(self):
        self.service = ContentModerationService()

    @pytest.mark.asyncio
    async def test_log_transition_uses_auditlog_schema_fields(self):
        prisma.auditlog.create = AsyncMock()
        await self.service._log_transition(
            module_id="m1",
            actor_id=5,
            from_status="DRAFT",
            to_status="PUBLISHED",
            reason="approved",
        )
        data = prisma.auditlog.create.call_args.kwargs["data"]
        assert data["actorId"] == 5
        assert data["eventType"] == "MODULE_STATUS_CHANGE"
        assert data["entityType"] == "Module"
        assert data["entityId"] == "m1"
        meta = getattr(data["metadata"], "data", data["metadata"])
        assert meta["from_status"] == "DRAFT"
        assert meta["to_status"] == "PUBLISHED"
        # The old broken fields must never be written.
        assert "userId" not in data
        assert "action" not in data
        assert "details" not in data


class TestDraftLeakage:
    """Unpublished modules must never be publicly viewable."""

    def setup_method(self):
        self.service = EducationService()

    @pytest.mark.asyncio
    async def test_get_module_hides_unpublished_from_anonymous(self):
        draft = SimpleNamespace(id="m1", status="DRAFT", instructorId=999)
        prisma.module.find_unique = AsyncMock(return_value=draft)
        result = await self.service.get_module("m1", user_id=None)
        assert result is None

    @pytest.mark.asyncio
    async def test_check_access_denies_unpublished_for_student(self):
        draft = SimpleNamespace(id="m1", status="DRAFT", instructorId=999)
        prisma.module.find_unique = AsyncMock(return_value=draft)
        prisma.user.find_unique = AsyncMock(
            return_value=SimpleNamespace(role="STUDENT")
        )
        assert not await self.service.check_access(7, "m1")

    @pytest.mark.asyncio
    async def test_can_view_module_allows_owner(self):
        draft = SimpleNamespace(id="m1", status="DRAFT", instructorId=7)
        prisma.module.find_unique = AsyncMock(return_value=draft)
        assert await self.service._can_view_module("m1", 7)

    @pytest.mark.asyncio
    async def test_can_view_module_allows_admin(self):
        draft = SimpleNamespace(id="m1", status="DRAFT", instructorId=999)
        prisma.module.find_unique = AsyncMock(return_value=draft)
        prisma.user.find_unique = AsyncMock(return_value=SimpleNamespace(role="ADMIN"))
        assert await self.service._can_view_module("m1", 2)

    @pytest.mark.asyncio
    async def test_can_view_module_denies_student(self):
        draft = SimpleNamespace(id="m1", status="DRAFT", instructorId=999)
        prisma.module.find_unique = AsyncMock(return_value=draft)
        prisma.user.find_unique = AsyncMock(
            return_value=SimpleNamespace(role="STUDENT")
        )
        assert not await self.service._can_view_module("m1", 7)

    @pytest.mark.asyncio
    async def test_prepare_lesson_data_fallback_does_not_leak_media(self):
        lesson = SimpleNamespace(
            id="l1",
            title="Lesson",
            description="d",
            moduleId="m1",
            order=1,
            type="video",
            storageProvider="aws",
            durationMinutes=30,
            createdAt=datetime.now(timezone.utc),
            updatedAt=datetime.now(timezone.utc),
            deletedAt=None,
        )
        self.service._parse_json_field = MagicMock(side_effect=RuntimeError("boom"))
        result = await self.service._prepare_lesson_data(lesson)
        assert result["videoUrl"] is None
        assert result["hlsPath"] is None
        assert result["isLocked"] is True


class TestQuizLeak:
    """The answer explanation must not be exposed before submission."""

    @pytest.mark.asyncio
    async def test_get_quiz_does_not_expose_hint_or_explanation(self):
        question = SimpleNamespace(
            id=1,
            question="Q?",
            questionType="MULTIPLE_CHOICE",
            points=10,
            explanation="THE_SECRET_EXPLANATION",
            options=["a", "b"],
            order=1,
            deletedAt=None,
        )
        quiz = SimpleNamespace(
            id=1,
            title="Quiz",
            description="d",
            passingScore=50,
            timeLimitMinutes=10,
            allowRetake=True,
            shuffleQuestions=False,
            questions=[question],
        )
        prisma.quiz.find_unique = AsyncMock(return_value=quiz)
        payload = await quiz_service.get_quiz("l1")
        assert payload is not None
        assert "hint" not in payload["questions"][0]
        assert "explanation" not in payload["questions"][0]


class TestWebhookIdempotency:
    """Concurrent/replayed webhook deliveries must not double-run side effects."""

    @pytest.mark.asyncio
    async def test_finalize_success_skips_when_not_pending(self):
        # The atomic CAS returns 0 rows -> already finalized by a concurrent delivery.
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=cm)
        cm.__aexit__ = AsyncMock(return_value=False)
        cm.transaction.update_many = AsyncMock(return_value=0)
        cm.auditlog.create = AsyncMock()
        prisma.tx.return_value = cm

        transaction = _tx(purpose="COURSE_PURCHASE", status="PENDING")
        finalized = await finalize_payment_success(transaction, {"id": "co_1"})
        assert finalized is False
        cm.auditlog.create.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_finalize_success_proceeds_when_pending(self):
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=cm)
        cm.__aexit__ = AsyncMock(return_value=False)
        cm.transaction.update_many = AsyncMock(return_value=1)
        cm.auditlog.create = AsyncMock()
        prisma.tx.return_value = cm

        transaction = _tx(purpose="DEPOSIT", status="PENDING", metadata={"w": 1})
        transaction.walletId = 9
        prisma.transaction.update = AsyncMock()
        prisma.wallet.find_unique = AsyncMock(return_value=SimpleNamespace(id=9))

        from app.services.wallet_service import wallet_service

        wallet_service.credit_wallet = AsyncMock()

        finalized = await finalize_payment_success(transaction, {"id": "co_1"})
        assert finalized is True
        cm.auditlog.create.assert_awaited()


class TestFileValidation:
    """Unknown binary content must be rejected for strict categories."""

    @pytest.mark.asyncio
    async def test_strict_magic_rejects_unknown_content(self):
        class FakeUpload:
            filename = "evil.jpg"
            content_type = "image/jpeg"

            async def read(self, n=-1):
                # MZ executable header pretending to be a JPEG.
                return b"MZ\x90\x00\x03\x00\x00\x00" + b"\x00" * 100

            async def seek(self, pos):
                pass

        ok, err = await validate_upload(FakeUpload(), "avatar")
        assert ok is False
        assert err

    @pytest.mark.asyncio
    async def test_strict_magic_accepts_real_png(self):
        class FakeUpload:
            filename = "pic.png"
            content_type = "image/png"
            _sent = False

            async def read(self, n=-1):
                if not self._sent:
                    self._sent = True
                    return b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
                return b""

            async def seek(self, pos):
                pass

        ok, err = await validate_upload(FakeUpload(), "avatar")
        assert ok is True, err
        assert err is None
