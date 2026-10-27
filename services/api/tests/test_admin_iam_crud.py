"""
Unit and Integration Tests for Sub-Admin CRUD, Provisioning, and Lifecycle Management.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException
from app.routers.admin_iam import (
    provision_subadmin,
    update_subadmin_profile,
    deprovision_subadmin,
    reissue_subadmin_invite,
    generate_subadmin_temp_password,
    ProvisionSubAdminRequest,
    UpdateSubAdminProfileRequest,
)
from app.generated.prisma import enums as p_enums


class TestSubAdminProvisioning:
    """Tests sub-admin provisioning with zero-knowledge credentials and invite links."""

    @pytest.mark.asyncio
    async def test_provision_subadmin_temporary_credential_success(self):
        """Super-admin provisions a new staff member with a single-use temporary password."""
        super_admin_user = MagicMock(id=1, role="ADMIN", email="super@podacium.com")

        mock_current_profile = MagicMock(
            id=1,
            userId=1,
            department=p_enums.AdminDepartment.SUPER_ADMIN,
            clearanceLevel=10,
            roleAssignments=[MagicMock(role=MagicMock(slug="super-admin"))],
        )

        mock_role = MagicMock(
            id=2,
            slug="compliance-officer",
            name="Compliance Officer",
            hierarchyRank=8,
        )

        mock_created_user = MagicMock(
            id=105,
            email="karim@podacium.com",
            fullName="Karim Hadj-Ahmed",
            role="ADMIN",
        )

        mock_created_profile = MagicMock(
            id=50,
            userId=105,
            department=p_enums.AdminDepartment.COMPLIANCE_AND_KYC,
            title="KYC Compliance Lead",
            clearanceLevel=8,
            mfaEnforced=True,
            isActive=True,
        )

        req = ProvisionSubAdminRequest(
            email="karim@podacium.com",
            fullName="Karim Hadj-Ahmed",
            phoneNumber="+213555123456",
            department="COMPLIANCE_AND_KYC",
            roleSlug="compliance-officer",
            title="KYC Compliance Lead",
            clearanceLevel=8,
            mfaEnforced=True,
            deliveryMethod="TEMPORARY_CREDENTIAL",
        )

        with (
            patch(
                "app.routers.admin_iam.prisma.adminrole.find_unique",
                new_callable=AsyncMock,
            ) as mock_role_find,
            patch(
                "app.routers.admin_iam.prisma.adminprofile.find_unique",
                new_callable=AsyncMock,
            ) as mock_prof_find,
            patch(
                "app.routers.admin_iam.prisma.user.find_unique", new_callable=AsyncMock
            ) as mock_user_find,
            patch(
                "app.routers.admin_iam.prisma.user.create", new_callable=AsyncMock
            ) as mock_user_create,
            patch(
                "app.routers.admin_iam.prisma.adminprofile.create",
                new_callable=AsyncMock,
            ) as mock_prof_create,
            patch(
                "app.routers.admin_iam.prisma.adminuserroleassignment.upsert",
                new_callable=AsyncMock,
            ) as mock_role_upsert,
            patch(
                "app.routers.admin_iam.invalidate_permission_cache",
                new_callable=AsyncMock,
            ),
            patch(
                "app.routers.admin_iam.AuditTrailService.log_action",
                new_callable=AsyncMock,
            ) as mock_audit,
        ):
            mock_role_find.return_value = mock_role
            mock_prof_find.return_value = mock_current_profile
            mock_user_find.return_value = None  # New user
            mock_user_create.return_value = mock_created_user
            mock_prof_create.return_value = mock_created_profile
            mock_role_upsert.return_value = MagicMock()

            res = await provision_subadmin(req=req, current_user=super_admin_user)

            assert res.success is True
            assert res.userId == 105
            assert res.email == "karim@podacium.com"
            assert res.tempPassword is not None
            assert res.tempPassword.startswith("Poda-")
            assert res.clearanceLevel == 8
            assert res.deliveryMethod == "TEMPORARY_CREDENTIAL"

            mock_audit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_provision_subadmin_invite_link_success(self):
        """Provisioning with INVITE_LINK generates a secure setup token and invite URL."""
        super_admin_user = MagicMock(id=1, role="ADMIN", email="super@podacium.com")

        mock_current_profile = MagicMock(
            id=1,
            userId=1,
            department=p_enums.AdminDepartment.SUPER_ADMIN,
            clearanceLevel=10,
            roleAssignments=[],
        )

        mock_role = MagicMock(
            id=3, slug="support-lead", name="Support Lead", hierarchyRank=4
        )
        mock_created_user = MagicMock(
            id=106, email="support.lead@podacium.com", fullName="Sarah B.", role="ADMIN"
        )
        mock_created_profile = MagicMock(
            id=51,
            userId=106,
            department=p_enums.AdminDepartment.CUSTOMER_SUPPORT,
            clearanceLevel=4,
        )

        req = ProvisionSubAdminRequest(
            email="support.lead@podacium.com",
            fullName="Sarah B.",
            department="CUSTOMER_SUPPORT",
            roleSlug="support-lead",
            deliveryMethod="INVITE_LINK",
        )

        with (
            patch(
                "app.routers.admin_iam.prisma.adminrole.find_unique",
                new_callable=AsyncMock,
            ) as mock_role_find,
            patch(
                "app.routers.admin_iam.prisma.adminprofile.find_unique",
                new_callable=AsyncMock,
            ) as mock_prof_find,
            patch(
                "app.routers.admin_iam.prisma.user.find_unique", new_callable=AsyncMock
            ) as mock_user_find,
            patch(
                "app.routers.admin_iam.prisma.user.create", new_callable=AsyncMock
            ) as mock_user_create,
            patch(
                "app.routers.admin_iam.prisma.adminprofile.create",
                new_callable=AsyncMock,
            ) as mock_prof_create,
            patch(
                "app.routers.admin_iam.prisma.adminuserroleassignment.upsert",
                new_callable=AsyncMock,
            ),
            patch(
                "app.routers.admin_iam.invalidate_permission_cache",
                new_callable=AsyncMock,
            ),
            patch(
                "app.routers.admin_iam.AuditTrailService.log_action",
                new_callable=AsyncMock,
            ),
        ):
            mock_role_find.return_value = mock_role
            mock_prof_find.return_value = mock_current_profile
            mock_user_find.return_value = None
            mock_user_create.return_value = mock_created_user
            mock_prof_create.return_value = mock_created_profile

            res = await provision_subadmin(req=req, current_user=super_admin_user)

            assert res.success is True
            assert res.tempPassword is None
            assert res.inviteUrl is not None
            assert "/auth/setup-admin?token=" in res.inviteUrl

    @pytest.mark.asyncio
    async def test_provision_subadmin_multi_role_success(self):
        """Super-admin provisions a new staff member with multiple assigned roles."""
        super_admin_user = MagicMock(id=1, role="ADMIN", email="super@podacium.com")

        mock_current_profile = MagicMock(
            id=1,
            userId=1,
            department=p_enums.AdminDepartment.SUPER_ADMIN,
            clearanceLevel=10,
            roleAssignments=[],
        )

        mock_role1 = MagicMock(
            id=2, slug="support-agent", name="Support Agent", hierarchyRank=3
        )
        mock_role2 = MagicMock(
            id=4, slug="content-moderator", name="Content Moderator", hierarchyRank=5
        )

        mock_created_user = MagicMock(
            id=107, email="multi.role@podacium.com", fullName="Nadia M.", role="ADMIN"
        )
        mock_created_profile = MagicMock(
            id=52,
            userId=107,
            department=p_enums.AdminDepartment.CUSTOMER_SUPPORT,
            clearanceLevel=5,
        )

        req = ProvisionSubAdminRequest(
            email="multi.role@podacium.com",
            fullName="Nadia M.",
            department="CUSTOMER_SUPPORT",
            roleSlugs=["support-agent", "content-moderator"],
            deliveryMethod="TEMPORARY_CREDENTIAL",
        )

        with (
            patch(
                "app.routers.admin_iam.prisma.adminrole.find_unique",
                new_callable=AsyncMock,
            ) as mock_role_find,
            patch(
                "app.routers.admin_iam.prisma.adminprofile.find_unique",
                new_callable=AsyncMock,
            ) as mock_prof_find,
            patch(
                "app.routers.admin_iam.prisma.user.find_unique", new_callable=AsyncMock
            ) as mock_user_find,
            patch(
                "app.routers.admin_iam.prisma.user.create", new_callable=AsyncMock
            ) as mock_user_create,
            patch(
                "app.routers.admin_iam.prisma.adminprofile.create",
                new_callable=AsyncMock,
            ) as mock_prof_create,
            patch(
                "app.routers.admin_iam.prisma.adminuserroleassignment.upsert",
                new_callable=AsyncMock,
            ) as mock_role_upsert,
            patch(
                "app.routers.admin_iam.invalidate_permission_cache",
                new_callable=AsyncMock,
            ),
            patch(
                "app.routers.admin_iam.AuditTrailService.log_action",
                new_callable=AsyncMock,
            ) as mock_audit,
        ):
            mock_role_find.side_effect = [mock_role1, mock_role2]
            mock_prof_find.return_value = mock_current_profile
            mock_user_find.return_value = None
            mock_user_create.return_value = mock_created_user
            mock_prof_create.return_value = mock_created_profile

            res = await provision_subadmin(req=req, current_user=super_admin_user)

            assert res.success is True
            assert res.userId == 107
            assert res.roleSlug == "support-agent"
            assert res.roleSlugs == ["support-agent", "content-moderator"]
            assert res.clearanceLevel == 5
            assert mock_role_upsert.await_count == 2
            mock_audit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_provision_invalid_email_fails(self):
        """Invalid email formats trigger 400 Bad Request."""
        super_admin_user = MagicMock(id=1, role="ADMIN")
        req = ProvisionSubAdminRequest(
            email="not-an-email",
            fullName="Valid Name",
            roleSlug="support-agent",
        )

        with pytest.raises(HTTPException) as exc:
            await provision_subadmin(req=req, current_user=super_admin_user)

        assert exc.value.status_code == 400
        assert exc.value.detail == "errors.iam.invalid_email"

    @pytest.mark.asyncio
    async def test_provision_empty_full_name_fails(self):
        """Empty or blank full name triggers 400 Bad Request."""
        super_admin_user = MagicMock(id=1, role="ADMIN")
        req = ProvisionSubAdminRequest(
            email="valid@podacium.com",
            fullName="   ",
            roleSlug="support-agent",
        )

        with pytest.raises(HTTPException) as exc:
            await provision_subadmin(req=req, current_user=super_admin_user)

        assert exc.value.status_code == 400
        assert exc.value.detail == "errors.iam.invalid_full_name"

    @pytest.mark.asyncio
    async def test_provision_missing_role_fails(self):
        """No role supplied triggers 400."""
        super_admin_user = MagicMock(id=1, role="ADMIN")
        req = ProvisionSubAdminRequest(
            email="valid@podacium.com",
            fullName="Valid Name",
            roleSlug="",
            roleSlugs=[],
        )

        with pytest.raises(HTTPException) as exc:
            await provision_subadmin(req=req, current_user=super_admin_user)

        assert exc.value.status_code == 400
        assert exc.value.detail == "errors.iam.role_not_found"

    @pytest.mark.asyncio
    async def test_provision_clearance_ceiling_restricted(self):
        """Non-super-admin cannot provision a role exceeding their own clearance level."""
        staff_user = MagicMock(id=10, role="ADMIN")
        staff_profile = MagicMock(
            id=10,
            userId=10,
            department=p_enums.AdminDepartment.CONTENT_MODERATION,
            clearanceLevel=4,
            roleAssignments=[],
        )

        mock_role = MagicMock(id=5, slug="financial-controller", hierarchyRank=8)

        req = ProvisionSubAdminRequest(
            email="new.finance@podacium.com",
            fullName="Finance Officer",
            department="FINANCE_AND_PAYMENTS",
            roleSlug="financial-controller",
            clearanceLevel=8,
        )

        with (
            patch(
                "app.routers.admin_iam.prisma.adminrole.find_unique",
                new_callable=AsyncMock,
            ) as mock_role_find,
            patch(
                "app.routers.admin_iam.prisma.adminprofile.find_unique",
                new_callable=AsyncMock,
            ) as mock_prof_find,
        ):
            mock_role_find.return_value = mock_role
            mock_prof_find.return_value = staff_profile

            with pytest.raises(HTTPException) as exc:
                await provision_subadmin(req=req, current_user=staff_user)

            assert exc.value.status_code == 403
            assert exc.value.detail == "errors.iam.clearance_level_exceeded"

    @pytest.mark.asyncio
    async def test_provision_already_active_admin_fails(self):
        """Provisioning an existing user who already has an active AdminProfile fails with 400."""
        super_admin_user = MagicMock(id=1, role="ADMIN")
        mock_current_profile = MagicMock(
            id=1,
            department=p_enums.AdminDepartment.SUPER_ADMIN,
            clearanceLevel=10,
            roleAssignments=[],
        )

        mock_role = MagicMock(id=2, slug="support-agent", hierarchyRank=3)
        existing_user = MagicMock(id=88, email="existing@podacium.com")
        existing_profile = MagicMock(id=20, userId=88, isActive=True)

        req = ProvisionSubAdminRequest(
            email="existing@podacium.com",
            fullName="Existing Admin",
            roleSlug="support-agent",
        )

        with (
            patch(
                "app.routers.admin_iam.prisma.adminrole.find_unique",
                new_callable=AsyncMock,
            ) as mock_role_find,
            patch(
                "app.routers.admin_iam.prisma.adminprofile.find_unique",
                new_callable=AsyncMock,
            ) as mock_prof_find,
            patch(
                "app.routers.admin_iam.prisma.user.find_unique", new_callable=AsyncMock
            ) as mock_user_find,
        ):
            mock_role_find.return_value = mock_role
            mock_prof_find.side_effect = [mock_current_profile, existing_profile]
            mock_user_find.return_value = existing_user

            with pytest.raises(HTTPException) as exc:
                await provision_subadmin(req=req, current_user=super_admin_user)

            assert exc.value.status_code == 400
            assert exc.value.detail == "errors.iam.user_already_admin"


class TestSubAdminProfileUpdateAndLifecycle:
    """Tests updating profile, re-issuing invite, temp passwords, and de-provisioning."""

    @pytest.mark.asyncio
    async def test_update_subadmin_profile_success(self):
        """Update sub-admin title, clearance level, and phone number."""
        super_admin_user = MagicMock(id=1, role="ADMIN")
        mock_current_profile = MagicMock(
            department=p_enums.AdminDepartment.SUPER_ADMIN,
            clearanceLevel=10,
            roleAssignments=[],
        )
        target_profile = MagicMock(id=25, userId=42, clearanceLevel=5)

        req = UpdateSubAdminProfileRequest(
            fullName="Updated Name",
            title="Senior Operations Lead",
            clearanceLevel=6,
            mfaEnforced=True,
        )

        with (
            patch(
                "app.routers.admin_iam.prisma.adminprofile.find_unique",
                new_callable=AsyncMock,
            ) as mock_prof_find,
            patch(
                "app.routers.admin_iam.prisma.user.update", new_callable=AsyncMock
            ) as mock_user_update,
            patch(
                "app.routers.admin_iam.prisma.adminprofile.update",
                new_callable=AsyncMock,
            ) as mock_prof_update,
            patch(
                "app.routers.admin_iam.invalidate_permission_cache",
                new_callable=AsyncMock,
            ),
            patch(
                "app.routers.admin_iam.AuditTrailService.log_action",
                new_callable=AsyncMock,
            ) as mock_audit,
        ):
            mock_prof_find.side_effect = [target_profile, mock_current_profile]

            res = await update_subadmin_profile(
                user_id=42, req=req, current_user=super_admin_user
            )

            assert res["success"] is True
            mock_user_update.assert_awaited_once()
            mock_prof_update.assert_awaited_once()
            mock_audit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_deprovision_subadmin_cannot_delete_self(self):
        """An administrator cannot de-provision their own account."""
        super_admin_user = MagicMock(id=1, role="ADMIN")

        with pytest.raises(HTTPException) as exc:
            await deprovision_subadmin(user_id=1, current_user=super_admin_user)

        assert exc.value.status_code == 400
        assert exc.value.detail == "errors.iam.cannot_delete_self"

    @pytest.mark.asyncio
    async def test_deprovision_subadmin_protects_last_super_admin(self):
        """De-provisioning the only remaining super-admin is blocked."""
        super_admin_user = MagicMock(id=1, role="ADMIN")
        target_profile = MagicMock(
            id=2,
            userId=2,
            department=p_enums.AdminDepartment.SUPER_ADMIN,
            clearanceLevel=10,
            roleAssignments=[MagicMock(role=MagicMock(slug="super-admin"))],
        )

        with (
            patch(
                "app.routers.admin_iam.prisma.adminprofile.find_unique",
                new_callable=AsyncMock,
            ) as mock_prof_find,
            patch(
                "app.routers.admin_iam.prisma.adminprofile.count",
                new_callable=AsyncMock,
            ) as mock_count,
        ):
            mock_prof_find.side_effect = [target_profile, target_profile]
            mock_count.return_value = 1  # Only 1 super admin left

            with pytest.raises(HTTPException) as exc:
                await deprovision_subadmin(user_id=2, current_user=super_admin_user)

            assert exc.value.status_code == 400
            assert exc.value.detail == "errors.iam.cannot_revoke_last_super_admin"

    @pytest.mark.asyncio
    async def test_deprovision_subadmin_success(self):
        """Successfully de-provisions a staff member, demoting user and revoking sessions."""
        super_admin_user = MagicMock(id=1, role="ADMIN")
        caller_profile = MagicMock(
            department=p_enums.AdminDepartment.SUPER_ADMIN,
            clearanceLevel=10,
            roleAssignments=[],
        )
        target_profile = MagicMock(
            id=30,
            userId=99,
            department=p_enums.AdminDepartment.CUSTOMER_SUPPORT,
            clearanceLevel=4,
            roleAssignments=[],
        )

        with (
            patch(
                "app.routers.admin_iam.prisma.adminprofile.find_unique",
                new_callable=AsyncMock,
            ) as mock_prof_find,
            patch(
                "app.routers.admin_iam.prisma.adminuserroleassignment.delete_many",
                new_callable=AsyncMock,
            ) as mock_ra_del,
            patch(
                "app.routers.admin_iam.prisma.adminsession.update_many",
                new_callable=AsyncMock,
            ) as mock_sess_del,
            patch(
                "app.routers.admin_iam.add_user_to_blocklist", new_callable=AsyncMock
            ) as mock_blk,
            patch(
                "app.routers.admin_iam.prisma.adminprofile.update",
                new_callable=AsyncMock,
            ) as mock_prof_update,
            patch(
                "app.routers.admin_iam.prisma.user.update", new_callable=AsyncMock
            ) as mock_user_update,
            patch(
                "app.routers.admin_iam.invalidate_permission_cache",
                new_callable=AsyncMock,
            ),
            patch(
                "app.routers.admin_iam.AuditTrailService.log_action",
                new_callable=AsyncMock,
            ) as mock_audit,
        ):
            mock_prof_find.side_effect = [target_profile, caller_profile]

            res = await deprovision_subadmin(user_id=99, current_user=super_admin_user)

            assert res["success"] is True
            mock_ra_del.assert_awaited_once()
            mock_sess_del.assert_awaited_once()
            mock_blk.assert_awaited_once_with(99)
            mock_prof_update.assert_awaited_once()
            mock_user_update.assert_awaited_once_with(
                where={"id": 99}, data={"role": "STUDENT"}
            )
            mock_audit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_reissue_subadmin_invite_success(self):
        """Re-issues a time-limited setup invite token for a staff profile."""
        super_admin_user = MagicMock(id=1, role="ADMIN")
        caller_profile = MagicMock(
            department=p_enums.AdminDepartment.SUPER_ADMIN,
            clearanceLevel=10,
            roleAssignments=[],
        )
        target_profile = MagicMock(
            id=12,
            userId=55,
            clearanceLevel=5,
            user=MagicMock(email="target@podacium.com"),
            roleAssignments=[],
        )

        with (
            patch(
                "app.routers.admin_iam.prisma.adminprofile.find_unique",
                new_callable=AsyncMock,
            ) as mock_prof_find,
            patch(
                "app.routers.admin_iam.AuditTrailService.log_action",
                new_callable=AsyncMock,
            ) as mock_audit,
        ):
            mock_prof_find.side_effect = [target_profile, caller_profile]

            res = await reissue_subadmin_invite(
                user_id=55, current_user=super_admin_user
            )

            assert res.success is True
            assert res.userId == 55
            assert res.email == "target@podacium.com"
            assert "/auth/setup-admin?token=" in res.inviteUrl
            mock_audit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_generate_subadmin_temp_password_success(self):
        """Generates a new single-use temporary password and invalidates previous sessions."""
        super_admin_user = MagicMock(id=1, role="ADMIN")
        caller_profile = MagicMock(
            department=p_enums.AdminDepartment.SUPER_ADMIN,
            clearanceLevel=10,
            roleAssignments=[],
        )
        target_profile = MagicMock(
            id=15,
            userId=77,
            clearanceLevel=6,
            user=MagicMock(email="locked.out@podacium.com"),
            roleAssignments=[],
        )

        with (
            patch(
                "app.routers.admin_iam.prisma.adminprofile.find_unique",
                new_callable=AsyncMock,
            ) as mock_prof_find,
            patch(
                "app.routers.admin_iam.prisma.user.update", new_callable=AsyncMock
            ) as mock_user_update,
            patch(
                "app.routers.admin_iam.add_user_to_blocklist", new_callable=AsyncMock
            ) as mock_blk,
            patch(
                "app.routers.admin_iam.prisma.adminsession.update_many",
                new_callable=AsyncMock,
            ) as mock_sess_upd,
            patch(
                "app.routers.admin_iam.invalidate_permission_cache",
                new_callable=AsyncMock,
            ),
            patch(
                "app.routers.admin_iam.AuditTrailService.log_action",
                new_callable=AsyncMock,
            ) as mock_audit,
        ):
            mock_prof_find.side_effect = [target_profile, caller_profile]

            res = await generate_subadmin_temp_password(
                user_id=77, current_user=super_admin_user
            )

            assert res.success is True
            assert res.userId == 77
            assert res.email == "locked.out@podacium.com"
            assert res.tempPassword.startswith("Poda-")
            mock_user_update.assert_awaited_once()
            mock_blk.assert_awaited_once_with(77)
            mock_sess_upd.assert_awaited_once()
            mock_audit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_lookup_user_for_iam_success(self):
        """Looking up a user returns formatted user metadata and admin profile attributes."""
        from app.routers.admin_iam import lookup_user_for_iam
        from datetime import datetime, timezone

        mock_user = MagicMock(
            id=42,
            fullName="Amina Khelifi",
            email="amina@podacium.com",
            username="aminak",
            phoneNumber="+213550112233",
            avatarUrl="https://cdn.podacium.com/avatars/42.png",
            role="STUDENT",
            isActive=True,
            createdAt=datetime.now(timezone.utc),
            adminProfile=MagicMock(
                department=p_enums.AdminDepartment.CUSTOMER_SUPPORT,
                title="Tier 2 Support",
                clearanceLevel=4,
                roleAssignments=[MagicMock(role=MagicMock(slug="support-agent"))],
            ),
        )

        with patch(
            "app.routers.admin_iam.prisma.user.find_unique",
            new_callable=AsyncMock,
        ) as mock_find:
            mock_find.return_value = mock_user

            res = await lookup_user_for_iam(user_id=42)

            assert res.id == 42
            assert res.fullName == "Amina Khelifi"
            assert res.email == "amina@podacium.com"
            assert res.hasAdminProfile is True
            assert res.department == "CUSTOMER_SUPPORT"
            assert res.title == "Tier 2 Support"
            assert "support-agent" in res.roles

    @pytest.mark.asyncio
    async def test_lookup_user_for_iam_not_found(self):
        """Looking up a non-existent user raises 404 HTTPException."""
        from app.routers.admin_iam import lookup_user_for_iam

        with patch(
            "app.routers.admin_iam.prisma.user.find_unique",
            new_callable=AsyncMock,
        ) as mock_find:
            mock_find.return_value = None

            with pytest.raises(HTTPException) as exc_info:
                await lookup_user_for_iam(user_id=999)

            assert exc_info.value.status_code == 404
            assert exc_info.value.detail == "errors.iam.user_not_found"
