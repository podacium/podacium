"""
Unit and integration tests for Layer 2: Platform Governance, Multi-Party Dual Approval,
Ephemeral Impersonation Guardrails, and Polymorphic Appeals.
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.generated.prisma import enums as p_enums
from app.services.maker_checker_service import (
    MakerCheckerService,
    ACTION_DEPROVISION_SUBADMIN,
)
from app.services.audit_trail_service import AuditTrailService
from app.services.content_moderation_service import content_moderation_service


class TestAutoPromotionPrevention:
    """[CRITICAL-ADM-01] Elimination of auto-promotion privilege escalation."""

    @pytest.mark.asyncio
    async def test_get_iam_me_unprovisioned_raises_403(self):
        from app.routers.admin_iam import get_admin_me

        admin_user = MagicMock(id=999, role="ADMIN", email="attacker@podacium.com")

        with patch(
            "app.routers.admin_iam.prisma.adminprofile.find_unique",
            new_callable=AsyncMock,
        ) as mock_find:
            mock_find.return_value = None

            with pytest.raises(HTTPException) as exc_info:
                await get_admin_me(current_user=admin_user)

            assert exc_info.value.status_code == 403
            assert exc_info.value.detail["code"] == "ADMIN_PROFILE_NOT_PROVISIONED"


class TestBulkModerationCorrection:
    """[CRITICAL-ADM-02] Bulk moderation status mutation vs. featured mismatch."""

    @pytest.mark.asyncio
    async def test_bulk_publish_validates_and_updates_status(self):
        valid_module = MagicMock(
            id=101,
            title="Advanced Machine Learning",
            description="Comprehensive guide",
            featured=False,
            deletedAt=None,
            lessons=[MagicMock(id=1, deletedAt=None, isPublished=True)],
        )

        with (
            patch(
                "app.services.content_moderation_service.prisma.module.find_unique",
                new_callable=AsyncMock,
            ) as mock_find,
            patch(
                "app.services.content_moderation_service.prisma.module.update",
                new_callable=AsyncMock,
            ) as mock_update,
            patch(
                "app.services.content_moderation_service.prisma.lesson.update_many",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.audit_trail_service.AuditTrailService.log_action",
                new_callable=AsyncMock,
            ) as mock_audit,
        ):
            mock_find.return_value = valid_module

            result = await content_moderation_service.bulk_moderate_modules(
                admin_id=1,
                ids=["101"],
                action="publish",
            )

            assert result["success"] == 1
            mock_update.assert_awaited_once()
            call_kwargs = mock_update.await_args.kwargs
            assert call_kwargs["where"] == {"id": "101"}
            assert call_kwargs["data"]["status"] == "PUBLISHED"
            assert "publishedAt" in call_kwargs["data"]
            mock_audit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_bulk_publish_rejects_empty_module(self):
        empty_module = MagicMock(
            id=102,
            title="",
            description="",
            featured=False,
            deletedAt=None,
            lessons=[],
        )

        with (
            patch(
                "app.services.content_moderation_service.prisma.module.find_unique",
                new_callable=AsyncMock,
            ) as mock_find,
            patch(
                "app.services.content_moderation_service.prisma.module.update",
                new_callable=AsyncMock,
            ) as mock_update,
        ):
            mock_find.return_value = empty_module

            result = await content_moderation_service.bulk_moderate_modules(
                admin_id=1,
                ids=["102"],
                action="publish",
            )

            assert result["failed"] == 1
            assert len(result["errors"]) == 1
            mock_update.assert_not_awaited()


class TestMakerCheckerTwoPersonIntegrity:
    """[SaaS 2.2] AWS Multi-Party Dual Approval Engine."""

    @pytest.mark.asyncio
    async def test_create_pending_action_enters_pending_status(self):
        mock_action = MagicMock(
            id="act_123",
            actionType=ACTION_DEPROVISION_SUBADMIN,
            targetResource="AdminProfile",
            targetId="50",
            payload={"userId": 50},
            status=p_enums.PendingActionStatus.PENDING_APPROVAL,
            expiresAt=datetime.now(timezone.utc) + timedelta(hours=24),
            initiator=MagicMock(fullName="Admin One", email="admin1@podacium.com"),
        )

        with (
            patch(
                "app.services.maker_checker_service.prisma.pendingadminaction.create",
                new_callable=AsyncMock,
            ) as mock_create,
            patch(
                "app.services.maker_checker_service.AuditTrailService.log_action",
                new_callable=AsyncMock,
            ) as mock_audit,
        ):
            mock_create.return_value = mock_action

            res = await MakerCheckerService.create_pending_action(
                initiator_id=1,
                action_type=ACTION_DEPROVISION_SUBADMIN,
                target_resource="AdminProfile",
                payload={"userId": 50},
                target_id="50",
            )

            assert res["status"] == "PENDING_APPROVAL"
            assert res["id"] == "act_123"
            mock_audit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_separation_of_duties_prevents_self_approval(self):
        mock_action = MagicMock(
            id="act_456",
            actionType=ACTION_DEPROVISION_SUBADMIN,
            status=p_enums.PendingActionStatus.PENDING_APPROVAL,
            initiatorId=10,
            expiresAt=datetime.now(timezone.utc) + timedelta(hours=12),
        )

        with patch(
            "app.services.maker_checker_service.prisma.pendingadminaction.find_unique",
            new_callable=AsyncMock,
        ) as mock_find:
            mock_find.return_value = mock_action

            with pytest.raises(HTTPException) as exc_info:
                await MakerCheckerService.approve_and_execute(
                    action_id="act_456",
                    approver_id=10,  # Same as initiator!
                )

            assert exc_info.value.status_code == 400
            assert exc_info.value.detail["code"] == "SEPARATION_OF_DUTIES_VIOLATION"

    @pytest.mark.asyncio
    async def test_dual_approval_atomic_execution_by_distinct_approver(self):
        mock_action = MagicMock(
            id="act_789",
            actionType=ACTION_DEPROVISION_SUBADMIN,
            status=p_enums.PendingActionStatus.PENDING_APPROVAL,
            initiatorId=10,
            targetId="55",
            payload={"userId": 55},
            expiresAt=datetime.now(timezone.utc) + timedelta(hours=12),
        )

        mock_profile = MagicMock(id=88, userId=55)

        with (
            patch(
                "app.services.maker_checker_service.prisma.pendingadminaction.find_unique",
                new_callable=AsyncMock,
            ) as mock_find,
            patch(
                "app.services.maker_checker_service.prisma.pendingadminaction.update",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.maker_checker_service.prisma.adminprofile.find_unique",
                new_callable=AsyncMock,
            ) as mock_prof_find,
            patch(
                "app.services.maker_checker_service.prisma.adminuserroleassignment.delete_many",
                new_callable=AsyncMock,
            ) as mock_ra_del,
            patch(
                "app.services.maker_checker_service.prisma.adminsession.update_many",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.maker_checker_service.prisma.adminprofile.update",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.maker_checker_service.prisma.user.update",
                new_callable=AsyncMock,
            ) as mock_user_upd,
            patch("app.core.rbac.invalidate_permission_cache", new_callable=AsyncMock),
            patch(
                "app.core.security.add_user_to_blocklist", new_callable=AsyncMock
            ) as mock_blk,
            patch(
                "app.services.maker_checker_service.AuditTrailService.log_action",
                new_callable=AsyncMock,
            ) as mock_audit,
        ):
            mock_find.return_value = mock_action
            mock_prof_find.return_value = mock_profile

            res = await MakerCheckerService.approve_and_execute(
                action_id="act_789",
                approver_id=20,  # Distinct approver!
                approval_notes="Approved after security review",
            )

            assert res["success"] is True
            assert res["status"] == "EXECUTED"
            mock_ra_del.assert_awaited_once()
            mock_user_upd.assert_awaited_once_with(
                where={"id": 55}, data={"role": "STUDENT"}
            )
            mock_blk.assert_awaited_once_with(55)
            mock_audit.assert_awaited_once()


class TestAuditTrailIntegrityAndLock:
    """[HIGH-ADM-05] Concurrency lock and chain verification."""

    @pytest.mark.asyncio
    async def test_verify_chain_integrity_with_genesis(self):
        with patch(
            "app.services.audit_trail_service.prisma.adminaudittrail.find_many",
            new_callable=AsyncMock,
        ) as mock_find:
            mock_find.return_value = []
            res = await AuditTrailService.verify_chain_integrity()
            assert res["is_valid"] is True
            assert res["verified_count"] == 0
