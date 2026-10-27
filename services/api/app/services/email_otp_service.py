"""Email OTP Service for 2FA.

Generates 6-digit PIN codes, SHA-256 hashes them before storing,
sends via the template system, and verifies with single-use consumption.
Rate-limited to 3 OTPs per 60 seconds.
"""

import hmac
import secrets
import hashlib
import logging
from datetime import datetime, timedelta, timezone

from app.core.config import setting
from app.core.prisma import prisma
from app.services.email_service import email_service
from app.services.email_templates import render_email

logger = logging.getLogger(__name__)

OTP_LENGTH = 6
OTP_TTL_SECONDS = 300  # 5 minutes
RATE_LIMIT_WINDOW = 60  # seconds
MAX_OTPS_PER_WINDOW = 5


def _hash_otp(code: str, user_id: int) -> str:
    secret = getattr(setting, "SECRET_KEY", "podacium_otp_secret")
    return hmac.new(
        secret.encode(),
        f"otp:{user_id}:{code.strip()}".encode(),
        hashlib.sha256,
    ).hexdigest()


class EmailOtpService:
    """Generate, send, and verify email OTPs for 2FA."""

    @staticmethod
    async def send_2fa_otp(user_id: int) -> tuple[bool, str]:
        """Generate a 6-digit OTP, store its salted HMAC-SHA256 hash, and email the user."""
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(seconds=RATE_LIMIT_WINDOW)

        recent = await prisma.emailotpcode.count(
            where={
                "userId": user_id,
                "purpose": "2fa_login",
                "createdAt": {"gte": window_start},
            }
        )
        if recent >= MAX_OTPS_PER_WINDOW:
            logger.warning(f"OTP rate limit exceeded for user {user_id}")
            return False, "rate_limited"

        user = await prisma.user.find_unique(where={"id": user_id})
        if not user or not user.email:
            return False, "no_email"

        code = f"{secrets.randbelow(10 ** OTP_LENGTH):06d}"
        code_hash = _hash_otp(code, user_id)

        await prisma.emailotpcode.create(
            data={
                "userId": user_id,
                "email": user.email,
                "code": code_hash,
                "purpose": "2fa_login",
                "expiresAt": now + timedelta(seconds=OTP_TTL_SECONDS),
            }
        )

        try:
            subject, text_body, html_body = render_email(
                "otp",
                locale="en",
                recipient_email=user.email,
                code=code,
            )
            if not email_service.check_smtp_config():
                logger.warning(
                    f"SMTP not configured, OTP for user {user_id} is: {code} (mock delivery)"
                )
                return False, "smtp_unconfigured"

            await email_service.send_email_with_retry(
                to_email=user.email,
                subject=subject,
                text_body=text_body,
                html_body=html_body,
            )
        except Exception as e:
            logger.error(f"Failed to send OTP email to user {user_id}: {e}")
            return False, "send_failed"

        return True, "sent"

    @staticmethod
    async def verify_2fa_otp(user_id: int, code: str) -> bool:
        """Verify a 6-digit OTP. Single-use — marks consumed on match."""
        salted_hash = _hash_otp(code, user_id)
        legacy_hash = hashlib.sha256(code.strip().encode()).hexdigest()
        now = datetime.now(timezone.utc)

        otp = await prisma.emailotpcode.find_first(
            where={
                "userId": user_id,
                "code": {"in": [salted_hash, legacy_hash]},
                "expiresAt": {"gte": now},
                "usedAt": None,
            },
            order={"createdAt": "desc"},
        )

        if not otp:
            return False

        # Atomic single-use update
        updated = await prisma.emailotpcode.update_many(
            where={
                "id": otp.id,
                "usedAt": None,
            },
            data={"usedAt": now},
        )
        return updated > 0

    @staticmethod
    async def cleanup_expired() -> int:
        """Delete expired OTP records. Returns count deleted."""
        result = await prisma.emailotpcode.delete_many(
            where={"expiresAt": {"lt": datetime.now(timezone.utc)}}
        )
        return result


email_otp_service = EmailOtpService()
