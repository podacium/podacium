"""
Comprehensive Test Suite for Admin Multi-Tier RBAC, Cryptographic Audit Trail,
and Security Controls (100/100 Perfection Gate).
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException, Request
from app.services.audit_trail_service import AuditTrailService
from app.core.rbac import require_permissions
from app.core.encryption import encrypt_field, decrypt_field, mask_secret


# =============================================================================
# 1. CRYPTOGRAPHIC HMAC-SHA256 AUDIT TRAIL TESTS
# =============================================================================


class TestAuditTrailCryptographicChain:
    """Tests the tamper-evident hash-chained audit logging."""

    @pytest.mark.asyncio
    async def test_audit_log_hash_chaining(self):
        """Verify that sequential audit entries properly chain HMAC digests."""
        mock_entries = []

        async def fake_create(data=None, **kwargs):
            payload = data if data is not None else kwargs.get("data", {})
            entry = MagicMock()
            for k, v in payload.items():
                setattr(entry, k, v)
            mock_entries.append(entry)
            return entry

        async def fake_find_first(order=None, **kwargs):
            return mock_entries[-1] if mock_entries else None

        with patch("app.services.audit_trail_service.prisma") as mock_prisma:
            mock_prisma.adminaudittrail.create = AsyncMock(side_effect=fake_create)
            mock_prisma.adminaudittrail.find_first = AsyncMock(
                side_effect=fake_find_first
            )

            entry1 = await AuditTrailService.log_action(
                action="USER_BAN",
                domain="USERS",
                resource_type="User",
                resource_id="101",
                metadata={"reason": "Terms violation"},
            )

            assert entry1.sequenceNumber == 1
            assert entry1.previousHash == "0" * 64
            assert len(entry1.sha256Hash) == 64

            entry2 = await AuditTrailService.log_action(
                action="PAYMENT_GATEWAY_UPDATE",
                domain="BILLING",
                resource_type="PaymentGatewayConfig",
                resource_id="1",
                metadata={"gateway": "CHARGILY"},
            )

            assert entry2.sequenceNumber == 2
            assert entry2.previousHash == entry1.sha256Hash
            assert len(entry2.sha256Hash) == 64
            assert entry2.sha256Hash != entry1.sha256Hash

    @pytest.mark.asyncio
    async def test_audit_trail_chain_verification_intact(self):
        """Verify that an untampered audit chain passes verification."""
        mock_entries = []

        async def fake_create(data=None, **kwargs):
            payload = data if data is not None else kwargs.get("data", {})
            entry = MagicMock()
            for k, v in payload.items():
                setattr(entry, k, v)
            mock_entries.append(entry)
            return entry

        async def fake_find_first(order=None, **kwargs):
            return mock_entries[-1] if mock_entries else None

        async def fake_find_many(**kwargs):
            return mock_entries

        with patch("app.services.audit_trail_service.prisma") as mock_prisma:
            mock_prisma.adminaudittrail.create = AsyncMock(side_effect=fake_create)
            mock_prisma.adminaudittrail.find_first = AsyncMock(
                side_effect=fake_find_first
            )
            mock_prisma.adminaudittrail.find_many = AsyncMock(
                side_effect=fake_find_many
            )

            for i in range(3):
                await AuditTrailService.log_action(
                    action=f"ACTION_{i}",
                    domain="SYSTEM",
                    resource_type="System",
                )

            verification = await AuditTrailService.verify_chain_integrity()
            assert verification["is_valid"] is True
            assert verification["verified_count"] == 3
            assert len(verification["corruptions"]) == 0

    @pytest.mark.asyncio
    async def test_audit_trail_detects_tampering(self):
        """Verify that altering an entry hash or payload triggers tampering detection."""
        mock_entries = []

        async def fake_create(data=None, **kwargs):
            payload = data if data is not None else kwargs.get("data", {})
            entry = MagicMock()
            for k, v in payload.items():
                setattr(entry, k, v)
            mock_entries.append(entry)
            return entry

        async def fake_find_first(order=None, **kwargs):
            return mock_entries[-1] if mock_entries else None

        async def fake_find_many(**kwargs):
            return mock_entries

        with patch("app.services.audit_trail_service.prisma") as mock_prisma:
            mock_prisma.adminaudittrail.create = AsyncMock(side_effect=fake_create)
            mock_prisma.adminaudittrail.find_first = AsyncMock(
                side_effect=fake_find_first
            )
            mock_prisma.adminaudittrail.find_many = AsyncMock(
                side_effect=fake_find_many
            )

            for i in range(3):
                await AuditTrailService.log_action(
                    action=f"ACTION_{i}",
                    domain="SYSTEM",
                    resource_type="System",
                )

            # Tamper with the 2nd record's action
            mock_entries[1].action = "MALICIOUS_TAMPERED_ACTION"

            verification = await AuditTrailService.verify_chain_integrity()
            assert verification["is_valid"] is False
            assert len(verification["corruptions"]) > 0


# =============================================================================
# 2. GRANULAR RBAC PERMISSION ENFORCEMENT TESTS
# =============================================================================


class TestRbacPermissionEnforcement:
    """Tests the 65-permission and multi-tier sub-admin security gating."""

    @pytest.mark.asyncio
    async def test_super_admin_has_unrestricted_bypass(self):
        """Super admin (department=SUPER_ADMIN) bypasses any permission requirement."""
        super_admin_user = MagicMock()
        super_admin_user.id = 1
        super_admin_user.role = "ADMIN"
        super_admin_user.email = "owner@podacium.com"

        mock_profile = MagicMock()
        mock_profile.department = "SUPER_ADMIN"
        mock_profile.isActive = True

        mock_request = MagicMock(spec=Request)
        mock_request.state = MagicMock()

        with patch(
            "app.core.rbac.prisma.adminprofile.find_unique", new_callable=AsyncMock
        ) as mock_find:
            mock_find.return_value = mock_profile

            dep = require_permissions("finance:gateways:write", "users:ban")
            result = await dep(request=mock_request, current_user=super_admin_user)
            assert result == super_admin_user

    @pytest.mark.asyncio
    async def test_sub_admin_with_exact_permission_allowed(self):
        """A sub-admin with the required permission granted via roles succeeds."""
        sub_admin = MagicMock()
        sub_admin.id = 42
        sub_admin.role = "ADMIN"
        sub_admin.email = "billing.lead@podacium.com"

        mock_request = MagicMock(spec=Request)
        mock_request.state = MagicMock()

        with (
            patch(
                "app.core.rbac.prisma.adminprofile.find_unique", new_callable=AsyncMock
            ) as mock_find,
            patch(
                "app.core.rbac.get_user_effective_permissions", new_callable=AsyncMock
            ) as mock_perms,
        ):
            mock_find.return_value = MagicMock(department="BILLING", isActive=True)
            mock_perms.return_value = {
                "admin:access",
                "finance:gateways:read",
                "finance:gateways:write",
            }

            dep = require_permissions("finance:gateways:write")
            result = await dep(request=mock_request, current_user=sub_admin)
            assert result == sub_admin

    @pytest.mark.asyncio
    async def test_sub_admin_missing_permission_forbidden(self):
        """A sub-admin missing the required permission gets 403 Forbidden."""
        sub_admin = MagicMock()
        sub_admin.id = 42
        sub_admin.role = "ADMIN"
        sub_admin.email = "content.lead@podacium.com"

        mock_request = MagicMock(spec=Request)
        mock_request.state = MagicMock()

        with (
            patch(
                "app.core.rbac.prisma.adminprofile.find_unique", new_callable=AsyncMock
            ) as mock_find,
            patch(
                "app.core.rbac.get_user_effective_permissions", new_callable=AsyncMock
            ) as mock_perms,
        ):
            mock_find.return_value = MagicMock(department="EDUCATION", isActive=True)
            mock_perms.return_value = {
                "admin:access",
                "content:courses:read",
                "content:courses:write",
            }

            dep = require_permissions("finance:gateways:write")
            with pytest.raises(HTTPException) as exc_info:
                await dep(request=mock_request, current_user=sub_admin)

            assert exc_info.value.status_code == 403
            assert "finance:gateways:write" in str(exc_info.value.detail)


# =============================================================================
# 3. SECRET MASKING & ENCRYPTION CONTROLS
# =============================================================================


class TestSecretMaskingAndEncryption:
    """Tests the masking and Fernet encryption of secrets in system settings."""

    def test_fernet_encryption_and_decryption(self):
        """Verify that secret settings are encrypted with Fernet and decrypted cleanly."""
        raw_secret = "sk_live_chargily_secret_key_algeria_987654321"

        encrypted = encrypt_field(raw_secret)
        assert encrypted != raw_secret
        assert not encrypted.startswith("sk_live_")

        decrypted = decrypt_field(encrypted)
        assert decrypted == raw_secret

    def test_secret_masking_utility(self):
        """Verify that masked secrets expose only the last few characters."""
        secret = "super_secret_api_key_12345"

        masked = mask_secret(secret)
        assert masked.startswith("••••••••")
        assert masked.endswith("2345")
        assert "super_secret_api_key" not in masked


# =============================================================================
# 4. IAM CLEARANCE HIERARCHY & SAFEGUARD TESTS
# =============================================================================


class TestIamClearanceHierarchyAndSafeguards:
    """Tests the clearance level hierarchy, last super-admin protection, and audit logging."""

    @pytest.mark.asyncio
    async def test_non_super_admin_cannot_assign_higher_clearance_role(self):
        """A sub-admin with clearance 5 cannot assign a role with clearance 8."""
        from app.routers.admin_iam import assign_admin_role, AssignRoleRequest

        sub_admin_user = MagicMock()
        sub_admin_user.id = 10
        sub_admin_user.role = "ADMIN"

        mock_current_profile = MagicMock()
        mock_current_profile.department = "EDUCATION"
        mock_current_profile.clearanceLevel = 5
        mock_current_profile.roleAssignments = []

        mock_target_role = MagicMock()
        mock_target_role.id = 2
        mock_target_role.slug = "compliance-officer"
        mock_target_role.name = "Compliance Officer"
        mock_target_role.hierarchyRank = 8

        mock_target_user = MagicMock()
        mock_target_user.id = 99

        req = AssignRoleRequest(
            targetUserId=99,
            roleSlug="compliance-officer",
            department="LEGAL_COMPLIANCE",
        )

        with (
            patch(
                "app.routers.admin_iam.prisma.adminrole.find_unique",
                new_callable=AsyncMock,
            ) as mock_role_find,
            patch(
                "app.routers.admin_iam.prisma.user.find_unique", new_callable=AsyncMock
            ) as mock_user_find,
            patch(
                "app.routers.admin_iam.prisma.adminprofile.find_unique",
                new_callable=AsyncMock,
            ) as mock_prof_find,
        ):
            mock_role_find.return_value = mock_target_role
            mock_user_find.return_value = mock_target_user
            mock_prof_find.side_effect = [mock_current_profile, None]

            with pytest.raises(HTTPException) as exc_info:
                await assign_admin_role(req=req, current_user=sub_admin_user)

            assert exc_info.value.status_code == 403
            assert exc_info.value.detail == "errors.iam.clearance_level_exceeded"

    @pytest.mark.asyncio
    async def test_cannot_revoke_last_remaining_super_admin(self):
        """System blocks revoking the super-admin role if only 1 exists."""
        from app.routers.admin_iam import revoke_admin_role, RevokeRoleRequest

        super_admin_user = MagicMock()
        super_admin_user.id = 1
        super_admin_user.role = "ADMIN"

        mock_profile = MagicMock()
        mock_profile.id = 1
        mock_profile.userId = 1
        mock_profile.department = "SUPER_ADMIN"
        mock_profile.clearanceLevel = 10
        mock_role_assign = MagicMock()
        mock_role_assign.role = MagicMock(slug="super-admin")
        mock_profile.roleAssignments = [mock_role_assign]

        mock_role = MagicMock()
        mock_role.id = 1
        mock_role.slug = "super-admin"
        mock_role.name = "Super Administrator"

        req = RevokeRoleRequest(
            targetUserId=1,
            roleSlug="super-admin",
        )

        with (
            patch(
                "app.routers.admin_iam.prisma.adminprofile.find_unique",
                new_callable=AsyncMock,
            ) as mock_prof_find,
            patch(
                "app.routers.admin_iam.prisma.adminrole.find_unique",
                new_callable=AsyncMock,
            ) as mock_role_find,
            patch(
                "app.routers.admin_iam.prisma.adminuserroleassignment.count",
                new_callable=AsyncMock,
            ) as mock_count,
        ):
            mock_prof_find.side_effect = [mock_profile, mock_profile]
            mock_role_find.return_value = mock_role
            mock_count.return_value = 1  # Only 1 super admin

            with pytest.raises(HTTPException) as exc_info:
                await revoke_admin_role(req=req, current_user=super_admin_user)

            assert exc_info.value.status_code == 400
            assert exc_info.value.detail == "errors.iam.cannot_revoke_last_super_admin"

    @pytest.mark.asyncio
    async def test_list_subadmins_returns_directory(self):
        """List subadmins returns staff with role assignments and departments."""
        from app.routers.admin_iam import list_subadmins

        mock_profile = MagicMock()
        mock_profile.id = 1
        mock_profile.userId = 42
        mock_profile.department = "FINANCE_BILLING"
        mock_profile.title = "Financial Controller"
        mock_profile.clearanceLevel = 7
        mock_profile.isActive = True
        mock_profile.lastAdminLoginAt = None
        mock_profile.createdAt = MagicMock()
        mock_profile.user = MagicMock(
            fullName="Amine Belkacem", email="amine@podacium.com", avatarUrl=None
        )
        mock_role = MagicMock(slug="finance-controller")
        mock_assignment = MagicMock(role=mock_role)
        mock_profile.roleAssignments = [mock_assignment]

        with (
            patch(
                "app.routers.admin_iam.prisma.adminprofile.count",
                new_callable=AsyncMock,
            ) as mock_count,
            patch(
                "app.routers.admin_iam.prisma.adminprofile.find_many",
                new_callable=AsyncMock,
            ) as mock_find,
        ):
            mock_count.return_value = 1
            mock_find.return_value = [mock_profile]

            res = await list_subadmins(page=1, page_size=20)
            assert res.total == 1
            assert len(res.subadmins) == 1
            assert res.subadmins[0].fullName == "Amine Belkacem"
            assert res.subadmins[0].roles == ["finance-controller"]
            assert res.subadmins[0].clearanceLevel == 7

    @pytest.mark.asyncio
    async def test_get_subadmin_detail_returns_permission_matrix(self):
        """Detailed subadmin response includes effective permissions and role assignments."""
        from app.routers.admin_iam import get_subadmin_detail

        mock_profile = MagicMock()
        mock_profile.id = 2
        mock_profile.userId = 88
        mock_profile.department = "LEGAL_COMPLIANCE"
        mock_profile.title = "Compliance Lead"
        mock_profile.clearanceLevel = 8
        mock_profile.isActive = True
        mock_profile.mfaEnforced = True
        mock_profile.lastAdminLoginAt = None
        mock_profile.createdAt = MagicMock()
        mock_profile.user = MagicMock(
            fullName="Samira Kaci", email="samira@podacium.com", avatarUrl=None
        )
        mock_role = MagicMock(slug="compliance-officer", hierarchyRank=8)
        mock_role.name = "Compliance Officer"
        mock_assignment = MagicMock(
            role=mock_role, createdAt=MagicMock(), expiresAt=None
        )
        mock_profile.roleAssignments = [mock_assignment]

        with (
            patch(
                "app.routers.admin_iam.prisma.adminprofile.find_unique",
                new_callable=AsyncMock,
            ) as mock_find,
            patch(
                "app.routers.admin_iam.get_user_effective_permissions",
                new_callable=AsyncMock,
            ) as mock_perms,
        ):
            mock_find.return_value = mock_profile
            mock_perms.return_value = {"kyc:read", "kyc:approve", "audit:read"}

            res = await get_subadmin_detail(user_id=88)
            assert res.userId == 88
            assert res.fullName == "Samira Kaci"
            assert res.clearanceLevel == 8
            assert "kyc:read" in res.effectivePermissions
            assert len(res.roleAssignments) == 1
