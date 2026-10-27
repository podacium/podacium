"""Onboarding emails must read the locale from UserSettings, not User.

``User`` has no ``locale`` column; the old code raised
``AttributeError("'User' object has no attribute 'locale'")`` and the Celery
task retried forever instead of delivering the welcome sequence.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.tasks.email_tasks import _async_send_onboarding_welcome


def _user(language):
    user = MagicMock()
    user.fullName = "Test User"
    user.email = "test@example.com"
    user.userSettings = MagicMock(language=language) if language else None
    return user


@pytest.mark.asyncio
async def test_onboarding_uses_user_settings_language():
    fake_prisma = MagicMock()
    fake_prisma.user.find_unique = AsyncMock(return_value=_user("ar"))

    fake_email = MagicMock()
    fake_email.check_smtp_config.return_value = True
    fake_email.send_email_with_retry = AsyncMock()

    with (
        patch("app.core.prisma.prisma", fake_prisma),
        patch("app.services.email_service.EmailService", return_value=fake_email),
        patch(
            "app.services.email_templates.render_email",
            return_value=("subject", "text", "<p>html</p>"),
        ) as render_email,
    ):
        result = await _async_send_onboarding_welcome(1, "welcome")

    assert result == {"status": "sent", "to": "test@example.com"}
    assert render_email.call_args.kwargs["locale"] == "ar"
    fake_email.send_email_with_retry.assert_awaited_once()


@pytest.mark.asyncio
async def test_onboarding_falls_back_to_english_without_settings():
    fake_prisma = MagicMock()
    fake_prisma.user.find_unique = AsyncMock(return_value=_user(None))

    fake_email = MagicMock()
    fake_email.check_smtp_config.return_value = True
    fake_email.send_email_with_retry = AsyncMock()

    with (
        patch("app.core.prisma.prisma", fake_prisma),
        patch("app.services.email_service.EmailService", return_value=fake_email),
        patch(
            "app.services.email_templates.render_email",
            return_value=("subject", "text", "<p>html</p>"),
        ) as render_email,
    ):
        await _async_send_onboarding_welcome(1, "welcome")

    assert render_email.call_args.kwargs["locale"] == "en"
