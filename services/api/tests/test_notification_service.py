"""
Comprehensive tests for NotificationService, schemas, quiet hours, and domain events.
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.schemas.notifications import (
    NotificationCategory,
    NotificationPriority,
    NotificationCreate,
    NotificationPayload,
    NotificationAction,
    NotificationPreferencesResponse,
)
from app.services.notification_service import NotificationService


class TestNotificationSchemas:
    """Test Pydantic v2 notification schemas and normalization."""

    def test_schema_backward_compatibility_title_body_keys(self):
        """Ensure title_key and body_key are normalized to title and body."""
        data = {
            "user_id": 1,
            "type": "live_session_booked",
            "title_key": "live_session.booked.title",
            "body_key": "live_session.booked.body",
            "category": "LIVE",
            "priority": "HIGH",
        }
        notif = NotificationCreate(**data)
        assert notif.title == "live_session.booked.title"
        assert notif.body == "live_session.booked.body"
        assert notif.category == NotificationCategory.LIVE

    def test_schema_priority_normalization(self):
        """Ensure legacy MEDIUM priority normalizes to NORMAL."""
        data = {
            "user_id": 1,
            "type": "project_update",
            "title": "Project Update",
            "body": "Your project status has changed",
            "category": "PROJECT",
            "priority": "MEDIUM",
        }
        notif = NotificationCreate(**data)
        assert notif.priority == NotificationPriority.NORMAL

    def test_schema_structured_payload_actions(self):
        """Ensure NotificationPayload and actions serialize correctly."""
        action = NotificationAction(
            label="actions.view_proposal",
            target="/hub/projects/42",
            variant="primary",
        )
        payload = NotificationPayload(
            entity_type="project",
            entity_id="42",
            action_url="/hub/projects/42",
            actions=[action],
        )
        notif = NotificationCreate(
            user_id=1,
            type="project_bid",
            title="project.new_proposal.title",
            body="project.new_proposal.message",
            category=NotificationCategory.PROJECT,
            priority=NotificationPriority.HIGH,
            payload=payload,
            data={"link": "/hub/projects/42"},
        )
        assert notif.payload is not None
        assert notif.payload.actions[0].target == "/hub/projects/42"
        assert notif.data["link"] == "/hub/projects/42"


class TestQuietHours:
    """Test quiet hours detection."""

    def test_quiet_hours_same_day(self):
        """Test quiet hours window within the same calendar day (e.g. 13:00 to 15:00)."""
        pref = MagicMock(
            quiet_hours_start="13:00",
            quiet_hours_end="15:00",
            quiet_hours_timezone="UTC",
        )
        now_inside = datetime(2026, 9, 18, 14, 0, tzinfo=timezone.utc)
        now_outside = datetime(2026, 9, 18, 16, 0, tzinfo=timezone.utc)

        with patch("app.services.notification_service.datetime") as mock_dt:
            mock_dt.now.return_value = now_inside
            assert NotificationService._is_in_quiet_hours(pref) is True

            mock_dt.now.return_value = now_outside
            assert NotificationService._is_in_quiet_hours(pref) is False

    def test_quiet_hours_overnight(self):
        """Test quiet hours window spanning overnight (e.g. 22:00 to 07:00)."""
        pref = MagicMock(
            quiet_hours_start="22:00",
            quiet_hours_end="07:00",
            quiet_hours_timezone="UTC",
        )
        late_night = datetime(2026, 9, 18, 23, 30, tzinfo=timezone.utc)
        early_morning = datetime(2026, 9, 19, 5, 0, tzinfo=timezone.utc)
        mid_day = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)

        with patch("app.services.notification_service.datetime") as mock_dt:
            mock_dt.now.return_value = late_night
            assert NotificationService._is_in_quiet_hours(pref) is True

            mock_dt.now.return_value = early_morning
            assert NotificationService._is_in_quiet_hours(pref) is True

            mock_dt.now.return_value = mid_day
            assert NotificationService._is_in_quiet_hours(pref) is False


class TestNotificationServiceEngine:
    """Test core creation, delivery, and security override."""

    @pytest.mark.asyncio
    async def test_security_urgent_bypasses_email_opt_out(self):
        """Security and Urgent notifications must bypass email opt-out and quiet hours."""
        service = NotificationService()
        user_id = 99

        fake_db_notif = MagicMock(
            id=1,
            userId=user_id,
            user_id=user_id,
            title="New Login from Chrome on Linux",
            body="We detected a new login to your account",
            category="SECURITY",
            priority="URGENT",
            type="security_alert",
            isRead=False,
            is_read=False,
            createdAt=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc),
            data={"link": "/settings/security"},
            email_sent=False,
        )

        fake_pref = NotificationPreferencesResponse(
            id=1,
            user_id=user_id,
            email_notifications=False,
            push_notifications=False,
            in_app_notifications=True,
            sms_notifications=False,
            marketing_emails=False,
            newsletter=False,
            digest_frequency="WEEKLY",
            quiet_hours_start="00:00",
            quiet_hours_end="23:59",
            quiet_hours_timezone="UTC",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        with (
            patch(
                "app.core.prisma.prisma.notification.create", new_callable=AsyncMock
            ) as mock_create,
            patch(
                "app.core.prisma.prisma.notificationdelivery.create",
                new_callable=AsyncMock,
            ),
            patch.object(
                NotificationService, "get_user_preferences", new_callable=AsyncMock
            ) as mock_get_prefs,
            patch(
                "app.core.prisma.prisma.user.find_unique", new_callable=AsyncMock
            ) as mock_user,
            patch(
                "app.tasks.email_tasks.send_notification_email.delay"
            ) as mock_email_task,
            patch(
                "app.routers.websocket.manager.send_to_user_distributed",
                new_callable=AsyncMock,
            ) as mock_ws,
        ):
            mock_create.return_value = fake_db_notif
            mock_get_prefs.return_value = fake_pref
            mock_user.return_value = MagicMock(id=user_id, email="user@podacium.com")

            notif_in = NotificationCreate(
                user_id=user_id,
                type="security_alert",
                title="New Login from Chrome on Linux",
                body="We detected a new login to your account",
                category=NotificationCategory.SECURITY,
                priority=NotificationPriority.URGENT,
                send_email=True,
                data={"link": "/settings/security"},
            )

            result = await service.create_notification(notif_in)
            import asyncio

            await asyncio.sleep(0.05)

            assert result.id == 1
            mock_email_task.assert_called_once()
            mock_ws.assert_called_once()

    @pytest.mark.asyncio
    async def test_idempotency_duplicate_suppression(self):
        """Duplicate notifications with same idempotency key must be suppressed."""
        service = NotificationService()

        with (
            patch(
                "app.services.notification_service.NotificationCache.get",
                new_callable=AsyncMock,
            ) as mock_cache_get,
            patch(
                "app.core.prisma.prisma.notification.find_unique",
                new_callable=AsyncMock,
            ) as mock_find_unique,
        ):
            mock_cache_get.return_value = 42
            mock_find_unique.return_value = MagicMock(
                id=42,
                userId=1,
                user_id=1,
                type="project_update",
                title="Duplicate notification",
                body="Already sent",
                category="PROJECT",
                priority="NORMAL",
                isRead=False,
                is_read=False,
                createdAt=datetime.now(timezone.utc),
                created_at=datetime.now(timezone.utc),
                data={},
                email_sent=False,
            )

            notif_in = NotificationCreate(
                user_id=1,
                type="project_update",
                title="Duplicate notification",
                body="Already sent",
                category=NotificationCategory.PROJECT,
                priority=NotificationPriority.NORMAL,
                idempotency_key="unique_evt_12345",
            )

            result = await service.create_notification(notif_in)
            assert result.id == 42
