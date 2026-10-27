import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user
from app.core.tenant import get_tenant_context, TenantContext
from app.core.security import verify_password, get_password_hash


class MockUser:
    def __init__(self, user_id=1, email="executive@podacium.com", org_id=100):
        self.id = user_id
        self.email = email
        self.fullName = "Executive Officer"
        self.role = "USER"
        self.is_admin = False
        self.primaryOrganizationId = org_id
        self.memberships = [MagicMock(organizationId=org_id)]


valid_user = MockUser(user_id=1, org_id=100)
valid_tenant_ctx = TenantContext(
    organization_id=100, user_id=1, role="OWNER", is_owner=True
)


@pytest.fixture
def client_override():
    app.dependency_overrides[get_current_user] = lambda: valid_user
    app.dependency_overrides[get_tenant_context] = lambda: valid_tenant_ctx
    with TestClient(app) as c:
        yield c
    app.dependency_overrides = {}


CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "x-csrf-token"


def _csrf_headers(client: TestClient) -> dict:
    if CSRF_COOKIE not in client.cookies:
        client.get("/api/bi/widgets/999")
    token = client.cookies.get(CSRF_COOKIE, "")
    return {CSRF_HEADER: token} if token else {}


@pytest.mark.asyncio
async def test_create_widget_direct(client_override):
    """Test POST /api/bi/widgets endpoint directly."""
    mock_dashboard = MagicMock(
        id=10,
        organizationId=100,
        deletedAt=None,
    )
    mock_widget = MagicMock(
        id=42,
        dashboardId=10,
        datasetId=5,
        description="Core cockpit trend",
        config={
            "visualization": {"type": "line"},
            "data_source": {"type": "dataset", "dataset_id": "5"},
        },
        x=0,
        y=0,
        w=6,
        h=4,
        minW=2,
        minH=2,
        order=0,
        createdAt=datetime.now(timezone.utc),
        updatedAt=datetime.now(timezone.utc),
    )
    mock_widget.name = "Quarterly Revenue Trend"
    mock_widget.type = MagicMock()
    mock_widget.type.name = "LINE"

    with (
        patch("app.services.bi_services.widget_service.prisma") as mock_prisma,
        patch("app.routers.bi_routers.widgets.prisma"),
    ):
        mock_prisma.dashboard.find_unique = AsyncMock(return_value=mock_dashboard)
        mock_prisma.dataset.find_unique = AsyncMock(
            return_value=MagicMock(id=5, organizationId=100, deletedAt=None)
        )
        mock_prisma.widget.create = AsyncMock(return_value=mock_widget)

        headers = _csrf_headers(client_override)
        payload = {
            "dashboard_id": 10,
            "type": "line",
            "title": "Quarterly Revenue Trend",
            "description": "Core cockpit trend",
            "dataset_id": 5,
            "x": 0,
            "y": 0,
            "w": 6,
            "h": 4,
            "visualization": {"type": "line"},
        }
        res = client_override.post("/api/bi/widgets", json=payload, headers=headers)
        assert res.status_code == 201
        data = res.json()
        assert data["id"] == 42
        assert data["title"] == "Quarterly Revenue Trend"
        assert data["dashboard_id"] == 10


@pytest.mark.asyncio
async def test_update_widget_put(client_override):
    """Test PUT /api/bi/widgets/{widget_id} endpoint."""
    mock_widget = MagicMock(
        id=42,
        dashboardId=10,
        datasetId=5,
        deletedAt=None,
        dashboard=MagicMock(organizationId=100),
        config={"visualization": {"type": "line"}},
    )
    updated_widget = MagicMock(
        id=42,
        dashboardId=10,
        datasetId=5,
        description="Updated description",
        config={"visualization": {"type": "bar"}},
        x=2,
        y=1,
        w=8,
        h=5,
        minW=None,
        minH=None,
        order=1,
        createdAt=datetime.now(timezone.utc),
        updatedAt=datetime.now(timezone.utc),
    )
    updated_widget.name = "Updated Widget Title"
    updated_widget.type = MagicMock()
    updated_widget.type.name = "BAR"

    with patch("app.services.bi_services.widget_service.prisma") as mock_prisma:
        mock_prisma.widget.find_unique = AsyncMock(return_value=mock_widget)
        mock_prisma.widget.update = AsyncMock(return_value=updated_widget)

        headers = _csrf_headers(client_override)
        payload = {
            "title": "Updated Widget Title",
            "type": "bar",
            "x": 2,
            "y": 1,
            "w": 8,
            "h": 5,
        }
        res = client_override.put("/api/bi/widgets/42", json=payload, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == 42
        assert data["title"] == "Updated Widget Title"
        assert data["x"] == 2
        assert data["w"] == 8


@pytest.mark.asyncio
async def test_update_widget_position_patch(client_override):
    """Test PATCH /api/bi/widgets/{widget_id}/position."""
    mock_widget = MagicMock(
        id=42,
        dashboardId=10,
        datasetId=5,
        deletedAt=None,
        dashboard=MagicMock(organizationId=100),
        config={},
    )
    updated_widget = MagicMock(
        id=42,
        dashboardId=10,
        datasetId=5,
        description=None,
        config={},
        x=4,
        y=6,
        w=4,
        h=3,
        minW=None,
        minH=None,
        order=2,
        createdAt=datetime.now(timezone.utc),
        updatedAt=datetime.now(timezone.utc),
    )
    updated_widget.name = "Widget 42"
    updated_widget.type = MagicMock()
    updated_widget.type.name = "LINE"

    with patch("app.services.bi_services.widget_service.prisma") as mock_prisma:
        mock_prisma.widget.find_unique = AsyncMock(return_value=mock_widget)
        mock_prisma.widget.update = AsyncMock(return_value=updated_widget)

        headers = _csrf_headers(client_override)
        payload = {"x": 4, "y": 6, "w": 4, "h": 3, "order": 2}
        res = client_override.patch(
            "/api/bi/widgets/42/position", json=payload, headers=headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["x"] == 4
        assert data["y"] == 6


@pytest.mark.asyncio
async def test_share_link_password_is_hashed(client_override):
    """Test CRITICAL-WGT-02: passwords must be hashed, not stored plaintext."""
    raw_password = "SecretExecutivePassword2026!"
    stored_hash = None

    async def mock_create_share_link(data):
        nonlocal stored_hash
        stored_hash = data.get("passwordHash")
        return MagicMock(
            id=101,
            dashboardId=data["dashboardId"],
            token=data["token"],
            passwordHash=stored_hash,
            expiresAt=data["expiresAt"],
            maxViews=data["maxViews"],
            viewCount=0,
            canFilter=data["canFilter"],
            canExport=data["canExport"],
            defaultFilters={},
            isRevoked=False,
            createdAt=datetime.now(timezone.utc),
        )

    mock_dashboard = MagicMock(
        id=1,
        organizationId=100,
        deletedAt=None,
    )

    with (
        patch("app.routers.bi_routers.collaboration.prisma") as mock_prisma,
        patch(
            "app.routers.bi_routers.collaboration.verify_organization_access",
            AsyncMock(return_value=100),
        ),
    ):
        mock_prisma.dashboard.find_unique = AsyncMock(return_value=mock_dashboard)
        mock_prisma.dashboardsharelink.create = AsyncMock(
            side_effect=mock_create_share_link
        )

        headers = _csrf_headers(client_override)
        payload = {
            "password": raw_password,
            "expires_in_days": 7,
            "max_views": 50,
            "can_filter": True,
            "can_export": True,
        }
        res = client_override.post(
            "/api/bi/dashboards/1/share-links", json=payload, headers=headers
        )
        assert res.status_code == 201
        data = res.json()
        assert data["has_password"] is True

        # Ensure password is NOT stored as raw plaintext!
        assert stored_hash != raw_password
        assert stored_hash is not None
        # Verify it verifies against the raw password using argon2 / bcrypt
        assert verify_password(raw_password, stored_hash) is True


@pytest.mark.asyncio
async def test_share_link_verify_endpoint(client_override):
    """Test verification endpoint for share link passwords."""
    raw_password = "CockpitSecure2026!"
    hashed = get_password_hash(raw_password)

    mock_link = MagicMock(
        id=55,
        dashboardId=1,
        token="tok_safe_test_123",
        passwordHash=hashed,
        expiresAt=None,
        maxViews=10,
        viewCount=1,
        canFilter=True,
        canExport=False,
        defaultFilters={},
        isRevoked=False,
        createdAt=datetime.now(timezone.utc),
    )

    with patch("app.routers.bi_routers.collaboration.prisma") as mock_prisma:
        mock_prisma.dashboardsharelink.find_unique = AsyncMock(return_value=mock_link)
        mock_prisma.dashboardsharelink.update = AsyncMock(return_value=mock_link)

        headers = _csrf_headers(client_override)

        # Invalid password returns 401
        bad_res = client_override.post(
            "/api/bi/dashboards/1/share-links/verify",
            json={"token": "tok_safe_test_123", "password": "WrongPassword!"},
            headers=headers,
        )
        assert bad_res.status_code == 401

        # Correct password returns 200
        good_res = client_override.post(
            "/api/bi/dashboards/1/share-links/verify",
            json={"token": "tok_safe_test_123", "password": raw_password},
            headers=headers,
        )
        assert good_res.status_code == 200
        assert good_res.json()["token"] == "tok_safe_test_123"
