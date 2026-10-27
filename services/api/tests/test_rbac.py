"""
Unit tests for Multi-Tier Sub-Admin RBAC engine.
Tests permissions evaluation, role assignments, super-admin wildcard bypass, and access gating.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.core.rbac import get_user_effective_permissions, require_permissions
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_super_admin_has_wildcard_permissions():
    """Super admin profile in SUPER_ADMIN department receives full wildcard perms."""
    mock_profile = MagicMock()
    mock_profile.department = "SUPER_ADMIN"
    mock_profile.isActive = True
    mock_profile.suspendedAt = None

    mock_perms = [MagicMock(code="finance:gateways:write"), MagicMock(code="users:ban")]

    with (
        patch("app.core.rbac.get_redis", return_value=None),
        patch(
            "app.core.rbac.prisma.adminprofile.find_unique", new_callable=AsyncMock
        ) as mock_find,
        patch(
            "app.core.rbac.prisma.adminpermission.find_many", new_callable=AsyncMock
        ) as mock_perms_find,
    ):
        mock_find.return_value = mock_profile
        mock_perms_find.return_value = mock_perms

        perms = await get_user_effective_permissions(user_id=1)
        assert "*" in perms
        assert "finance:gateways:write" in perms


@pytest.mark.asyncio
async def test_sub_admin_receives_assigned_role_permissions():
    """Content admin receives only education and content permissions."""
    mock_perm1 = MagicMock()
    mock_perm1.permission.code = "content:courses:read"
    mock_perm2 = MagicMock()
    mock_perm2.permission.code = "content:lessons:write"

    mock_assignment = MagicMock()
    mock_assignment.expiresAt = None
    mock_assignment.role.permissions = [mock_perm1, mock_perm2]

    mock_profile = MagicMock()
    mock_profile.department = "CONTENT_MODERATION"
    mock_profile.isActive = True
    mock_profile.suspendedAt = None
    mock_profile.roleAssignments = [mock_assignment]

    with (
        patch("app.core.rbac.get_redis", return_value=None),
        patch(
            "app.core.rbac.prisma.adminprofile.find_unique", new_callable=AsyncMock
        ) as mock_find,
    ):
        mock_find.return_value = mock_profile

        perms = await get_user_effective_permissions(user_id=2)
        assert "content:courses:read" in perms
        assert "content:lessons:write" in perms
        assert "finance:gateways:write" not in perms
        assert "*" not in perms


@pytest.mark.asyncio
async def test_require_permissions_blocks_unauthorized_user():
    """require_permissions raises HTTP 403 when user lacks required permission."""
    checker = require_permissions("finance:gateways:write")

    mock_request = MagicMock()
    mock_request.url.path = "/api/admin/settings/payment-gateways"
    mock_user = MagicMock()
    mock_user.id = 5
    mock_user.role = "MODERATOR"

    with patch(
        "app.core.rbac.get_user_effective_permissions", new_callable=AsyncMock
    ) as mock_get_perms:
        mock_get_perms.return_value = {"content:courses:read"}

        with pytest.raises(HTTPException) as exc_info:
            await checker(mock_request, current_user=mock_user)

        assert exc_info.value.status_code == 403
        assert exc_info.value.detail["code"] == "FORBIDDEN_PERMISSION_REQUIRED"
        assert "finance:gateways:write" in exc_info.value.detail["missing_permissions"]
