"""
Tests for Multi-Channel Escalation Fallback Cascade (notification_cascade.py).
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.tasks.notification_cascade import (
    _do_orchestrate_cascade,
    _do_step_web_push,
    _do_step_whatsapp,
    _do_step_email,
)
from app.services.whatsapp_service import _resolve_whatsapp_language


class TestWhatsAppLanguageResolution:
    def test_kabyle_fallback_to_french(self):
        """Kabyle ('kab') must fall back to French ('fr') for Meta WhatsApp templates."""
        assert _resolve_whatsapp_language("kab") == "fr"
        assert _resolve_whatsapp_language("kab-DZ") == "fr"
        assert _resolve_whatsapp_language("kab_DZ") == "fr"

    def test_standard_languages_preserved(self):
        assert _resolve_whatsapp_language("ar") == "ar"
        assert _resolve_whatsapp_language("fr") == "fr"
        assert _resolve_whatsapp_language("en") == "en_US"
        assert _resolve_whatsapp_language("en_US") == "en_US"

    def test_unknown_or_empty_falls_back_to_french(self):
        assert _resolve_whatsapp_language(None) == "fr"
        assert _resolve_whatsapp_language("") == "fr"
        assert _resolve_whatsapp_language("de") == "fr"


class TestNotificationCascadeWorkflow:
    @pytest.mark.asyncio
    async def test_orchestrate_cascade_online_user_delivers_ws_and_schedules_push(self):
        mock_manager = MagicMock()
        mock_manager.is_online.return_value = True
        mock_manager.send_to_user_distributed = AsyncMock()

        payload = {"title": "Test Cascade", "body": "Message Body"}

        with (
            patch("app.routers.websocket.manager", mock_manager),
            patch(
                "app.tasks.notification_cascade.step_web_push.apply_async"
            ) as mock_push_apply,
        ):
            res = await _do_orchestrate_cascade(10, 1001, payload)

            assert res["status"] == "started"
            assert res["notification_id"] == 10
            mock_manager.is_online.assert_called_once_with(1001)
            mock_manager.send_to_user_distributed.assert_awaited_once()
            mock_push_apply.assert_called_once_with(
                args=[10, 1001, payload], countdown=15
            )

    @pytest.mark.asyncio
    async def test_step_web_push_skips_if_already_read(self):
        mock_notif = MagicMock(id=10, isRead=True)

        with (
            patch(
                "app.core.prisma.prisma.notification.find_unique",
                new=AsyncMock(return_value=mock_notif),
            ),
            patch(
                "app.tasks.notification_cascade.step_whatsapp.apply_async"
            ) as mock_wa_apply,
        ):
            res = await _do_step_web_push(10, 1001, {"title": "Test"})
            assert res["status"] == "read_or_deleted"
            mock_wa_apply.assert_not_called()

    @pytest.mark.asyncio
    async def test_step_whatsapp_skips_if_already_read(self):
        mock_notif = MagicMock(id=10, isRead=True)

        with (
            patch(
                "app.core.prisma.prisma.notification.find_unique",
                new=AsyncMock(return_value=mock_notif),
            ),
            patch(
                "app.tasks.notification_cascade.step_email.apply_async"
            ) as mock_email_apply,
        ):
            res = await _do_step_whatsapp(10, 1001, {"title": "Test"})
            assert res["status"] == "read"
            mock_email_apply.assert_not_called()

    @pytest.mark.asyncio
    async def test_step_whatsapp_dispatches_with_kabyle_locale_fallback(self):
        mock_notif = MagicMock(id=10, isRead=False, title="Alerte", body="Détails")
        mock_user = MagicMock(
            id=1001, phoneNumber="0550123456", isPhoneVerified=True, locale="kab"
        )

        mock_send_template = AsyncMock(return_value=True)

        with (
            patch(
                "app.core.prisma.prisma.notification.find_unique",
                new=AsyncMock(return_value=mock_notif),
            ),
            patch(
                "app.core.prisma.prisma.user.find_unique",
                new=AsyncMock(return_value=mock_user),
            ),
            patch(
                "app.services.whatsapp_service.whatsapp_service.send_template_message",
                new=mock_send_template,
            ),
            patch(
                "app.tasks.notification_cascade.step_email.apply_async"
            ) as mock_email_apply,
        ):
            res = await _do_step_whatsapp(
                10, 1001, {"title": "Alerte", "body": "Détails"}
            )
            assert res["status"] == "whatsapp_evaluated"
            mock_send_template.assert_awaited_once()
            call_kwargs = mock_send_template.call_args[1]
            assert call_kwargs["language_code"] == "kab"
            mock_email_apply.assert_called_once_with(
                args=[10, 1001, {"title": "Alerte", "body": "Détails"}], countdown=240
            )

    @pytest.mark.asyncio
    async def test_step_email_dispatches_localized_email(self):
        mock_notif = MagicMock(
            id=10, isRead=False, title="Message", body="Corps du message"
        )
        mock_user = MagicMock(id=1001, email="test@podacium.dz")
        mock_update = AsyncMock()

        with (
            patch(
                "app.core.prisma.prisma.notification.find_unique",
                new=AsyncMock(return_value=mock_notif),
            ),
            patch(
                "app.core.prisma.prisma.user.find_unique",
                new=AsyncMock(return_value=mock_user),
            ),
            patch("app.core.prisma.prisma.notification.update", new=mock_update),
            patch(
                "app.tasks.email_tasks.send_notification_email.delay"
            ) as mock_email_delay,
        ):
            res = await _do_step_email(
                10, 1001, {"title": "Message", "body": "Corps du message"}
            )
            assert res["status"] == "cascade_complete"
            mock_email_delay.assert_called_once()
            mock_update.assert_awaited_once_with(
                where={"id": 10}, data={"emailSent": True}
            )

    def test_celery_task_entries_use_run_async_in_worker(self):
        """Verify Celery task entrypoints use run_async_in_worker instead of direct asyncio.run."""
        from app.tasks.notification_cascade import (
            orchestrate_notification_cascade,
            step_web_push,
            step_whatsapp,
            step_email,
        )

        def fake_bridge(coro, timeout=None):
            coro.close()
            return {"status": "ok"}

        with patch(
            "app.tasks.notification_cascade.run_async_in_worker",
            side_effect=fake_bridge,
        ) as mock_bridge:
            res1 = orchestrate_notification_cascade(1, 101, {"title": "Test"})
            assert res1 == {"status": "ok"}
            assert mock_bridge.call_count == 1

            res2 = step_web_push(1, 101, {"title": "Test"})
            assert res2 == {"status": "ok"}
            assert mock_bridge.call_count == 2

            res3 = step_whatsapp(1, 101, {"title": "Test"})
            assert res3 == {"status": "ok"}
            assert mock_bridge.call_count == 3

            res4 = step_email(1, 101, {"title": "Test"})
            assert res4 == {"status": "ok"}
            assert mock_bridge.call_count == 4
