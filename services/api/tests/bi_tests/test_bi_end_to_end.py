"""
BI End-to-End Integration Tests
Tests the full report run + download flow using proper AsyncMock patches.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timezone

from app.main import app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class MockUser:
    def __init__(self, user_id: int = 1, email: str = "test@example.com", org_id: int = 100):
        self.id = user_id
        self.email = email
        self.primaryOrganizationId = org_id


valid_user = MockUser(user_id=1, org_id=100)

_NOW = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)


def _make_mock_report() -> MagicMock:
    """Build a realistic mock Report object."""
    m = MagicMock()
    m.id = 1
    m.name = "Test Exec Report"
    m.description = "Test report description"
    m.format = "csv"
    m.organizationId = 100
    m.recipients = ["test@example.com"]
    m.scheduleType = "manual"
    m.scheduleCron = None
    m.scheduleInterval = None
    m.dashboardId = None
    m.isActive = True
    m.createdById = 1
    m.nextRun = None
    m.createdAt = _NOW
    m.updatedAt = _NOW
    return m


def _make_mock_run(report_mock: MagicMock) -> MagicMock:
    """Build a realistic mock ReportRun object."""
    m = MagicMock()
    m.id = 10
    m.reportId = 1
    m.status = "completed"
    m.startedAt = _NOW
    m.completedAt = _NOW
    m.fileUrl = "/api/bi/reports/1/runs/10/download"
    m.fileSize = 1024
    m.errorMessage = None
    m.recipientCount = 1
    m.report = report_mock
    return m


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    """Test client with auth dependency overridden."""
    from app.core.auth import get_current_user
    app.dependency_overrides[get_current_user] = lambda: valid_user
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides = {}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_report_run_and_download_flow(client):
    """
    Verify that:
      1. POST /api/bi/reports/1/run returns 200 with fileUrl containing 'download'.
      2. GET  /api/bi/reports/1/runs/10/download returns 200 with CSV content.
    """
    mock_report = _make_mock_report()
    mock_run = _make_mock_run(mock_report)

    # ReportExporter.generate_report_file is called in both run_report and download_report_run.
    # We stub it to return a minimal CSV payload so no real I/O is needed.
    mock_export_result = {
        "run_id": 10,
        "report_id": 1,
        "file_url": "/api/bi/reports/1/runs/10/download",
        "file_size": 1024,
        "content_type": "text/csv",
        "filename_ext": "csv",
        "file_bytes": b"id,name\n1,Test",
    }

    with (
        # Patch prisma where the *router* imported it (direct name binding)
        patch("app.routers.bi_routers.reports.prisma") as mock_prisma,
        # Patch prisma where *report_exporter* imported it
        patch("app.services.bi_services.report_exporter.prisma") as mock_exporter_prisma,
        # Patch verify_organization_access at the router module (module-level import)
        patch("app.routers.bi_routers.reports.verify_organization_access", new_callable=AsyncMock) as mock_voa,
        # Patch the heavy ReportExporter so we never touch real files/DB
        patch(
            "app.services.bi_services.report_exporter.ReportExporter.generate_report_file",
            new_callable=AsyncMock,
            return_value=mock_export_result,
        ),
        # Also patch its usage inside the router's import (lazy import at call time)
        patch(
            "app.routers.bi_routers.reports.ReportExporter",
            create=True,
        ) as mock_re_cls,
    ):
        # ---------------------------------------------------------------
        # Wire up AsyncMock returns for every prisma call in reports.py
        # ---------------------------------------------------------------
        mock_prisma.report.find_unique = AsyncMock(return_value=mock_report)
        mock_prisma.report.update = AsyncMock(return_value=mock_report)
        mock_prisma.reportrun.create = AsyncMock(return_value=mock_run)
        mock_prisma.reportrun.update = AsyncMock(return_value=mock_run)
        mock_prisma.reportrun.find_unique = AsyncMock(return_value=mock_run)
        mock_prisma.reportrun.find_many = AsyncMock(return_value=[mock_run])

        # Wire up exporter prisma (used inside generate_report_file)
        mock_exporter_prisma.reportrun.find_unique = AsyncMock(return_value=mock_run)
        mock_exporter_prisma.dataset.find_first = AsyncMock(return_value=None)

        # Wire up the lazy import of ReportExporter inside run_report
        mock_re_cls.generate_report_file = AsyncMock(return_value=mock_export_result)

        # org-access stub returns org_id
        mock_voa.return_value = 100

        # ---------------------------------------------------------------
        # 1. Trigger report run (POST)
        # ---------------------------------------------------------------
        client.cookies.set("csrf_token", "test_token")
        response = client.post(
            "/api/bi/reports/1/run",
            headers={"X-CSRF-Token": "test_token"},
        )

        print("RUN RESP STATUS:", response.status_code, response.text)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert data["reportId"] == 1
        assert "download" in (data.get("fileUrl") or "")

        # ---------------------------------------------------------------
        # 2. Download report run file (GET)
        # ---------------------------------------------------------------
        dl_response = client.get("/api/bi/reports/1/runs/10/download")
        print("DL RESP STATUS:", dl_response.status_code, dl_response.text[:200])
        assert dl_response.status_code == 200, (
            f"Expected 200, got {dl_response.status_code}: {dl_response.text}"
        )
        assert dl_response.headers["content-type"].startswith("text/csv")
        assert "attachment" in dl_response.headers.get("content-disposition", "")


def test_report_run_not_found(client):
    """POST /api/bi/reports/999/run should return 404 when the report doesn't exist."""
    with patch("app.routers.bi_routers.reports.prisma") as mock_prisma:
        mock_prisma.report.find_unique = AsyncMock(return_value=None)

        client.cookies.set("csrf_token", "tok2")
        response = client.post(
            "/api/bi/reports/999/run",
            headers={"X-CSRF-Token": "tok2"},
        )
        assert response.status_code == 404


def test_download_run_not_found(client):
    """GET /api/bi/reports/1/runs/999/download should return 404 for missing run."""
    mock_report = _make_mock_report()

    with (
        patch("app.routers.bi_routers.reports.prisma") as mock_prisma,
        patch("app.routers.bi_routers.reports.verify_organization_access", new_callable=AsyncMock) as mock_voa,
    ):
        mock_prisma.report.find_unique = AsyncMock(return_value=mock_report)
        mock_prisma.reportrun.find_unique = AsyncMock(return_value=None)
        mock_voa.return_value = 100

        dl_response = client.get("/api/bi/reports/1/runs/999/download")
        assert dl_response.status_code == 404
