"""
Tests for BI collaboration schemas and models.
"""

from datetime import datetime, timezone
import pytest

from app.schemas.bi_schemas.collaboration import (
    DashboardBookmarkCreate,
    DashboardBookmarkResponse,
    DashboardCommentCreate,
    DashboardCommentResponse,
    DashboardShareLinkCreate,
    DashboardShareLinkResponse,
    DashboardSnapshotCreate,
    DashboardSnapshotResponse,
)


def test_dashboard_comment_create_schema():
    payload = DashboardCommentCreate(
        widget_id=5,
        content="Check this revenue spike in Q3",
        position_x=42.5,
        position_y=68.0,
        metadata={"metric": "Revenue", "value": 150000},
    )
    assert payload.widget_id == 5
    assert payload.content == "Check this revenue spike in Q3"
    assert payload.position_x == 42.5
    assert payload.metadata["metric"] == "Revenue"


def test_dashboard_comment_response_schema():
    response = DashboardCommentResponse(
        id=1,
        dashboard_id=10,
        widget_id=5,
        author_id=101,
        author_name="User Test",
        content="Spatial annotation pin",
        position_x=10.0,
        position_y=20.0,
        is_resolved=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        replies_count=2,
    )
    assert response.id == 1
    assert response.replies_count == 2
    assert response.is_resolved is False


def test_dashboard_bookmark_create_schema():
    payload = DashboardBookmarkCreate(
        name="Executive Sales View",
        is_shared=True,
        is_default=True,
        filter_state={"region": "Algiers", "year": 2026},
        layout_state={"columns": 12},
    )
    assert payload.name == "Executive Sales View"
    assert payload.is_shared is True
    assert payload.filter_state["region"] == "Algiers"


def test_dashboard_share_link_create_schema():
    payload = DashboardShareLinkCreate(
        password="SecurePassword123",
        expires_in_days=30,
        max_views=100,
        can_filter=True,
        can_export=False,
    )
    assert payload.expires_in_days == 30
    assert payload.can_export is False
