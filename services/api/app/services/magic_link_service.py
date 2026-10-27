"""
Magic Link (Passwordless Authentication) Service.

Provides cryptographically secure, single-use, time-limited magic links
for passwordless user login with anti-enumeration and anti-replay protection.
"""

from datetime import datetime, timezone
import hashlib
import json
import logging
import secrets
import time
from typing import Optional, Tuple

import redis.asyncio as aioredis

from app.core.config import setting
from app.core.prisma import prisma
from app.services.email_service import email_service
from app.services.email_templates import render_email
from app.services.notification_service import NotificationService, NotificationCreate

logger = logging.getLogger(__name__)

MAGIC_LINK_TTL_SECONDS = 15 * 60  # 15 minutes
MAGIC_LINK_REDIS_PREFIX = "magic_link:"

# In-memory fallback if Redis is unavailable
_memory_fallback: dict[str, tuple[str, float]] = {}


def _hash_token(raw_token: str) -> str:
    """Compute SHA-256 hash of raw magic link token."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


class MagicLinkService:
    """Service handling passwordless magic link lifecycle."""

    _redis: Optional[aioredis.Redis] = None

    @classmethod
    async def _get_redis(cls) -> Optional[aioredis.Redis]:
        """Lazy-initialize Redis connection."""
        if cls._redis is None:
            try:
                redis_url = getattr(setting, "REDIS_URL", "")
                if redis_url:
                    cls._redis = aioredis.from_url(
                        redis_url,
                        decode_responses=True,
                        socket_connect_timeout=2,
                    )
            except Exception as e:
                logger.warning(
                    f"Could not connect to Redis for magic link service: {e}"
                )
                cls._redis = None
        return cls._redis

    @classmethod
    async def request_magic_link(
        cls,
        email: str,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        locale: str = "en",
    ) -> dict:
        """
        Initiate a passwordless login flow.
        Always returns generic success to prevent email enumeration.
        """
        normalized_email = email.lower().strip()
        user = await prisma.user.find_first(
            where={"email": {"equals": normalized_email, "mode": "insensitive"}}
        )

        if not user or not user.isActive:
            # User doesn't exist or is disabled — return generic message for security
            logger.info(
                f"Magic link requested for non-existent or inactive email: {normalized_email}"
            )
            return {
                "message": "If an active account exists for this email, a sign-in link has been sent.",
                "expires_in_minutes": 15,
            }

        # Generate single-use cryptographic token
        raw_token = secrets.token_urlsafe(32)
        token_hash = _hash_token(raw_token)
        redis_key = f"{MAGIC_LINK_REDIS_PREFIX}{token_hash}"

        payload = {
            "user_id": user.id,
            "email": user.email,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "ip": client_ip or "",
            "user_agent": user_agent or "",
        }
        json_payload = json.dumps(payload)

        # Store in Redis with TTL or in fallback memory
        redis = await cls._get_redis()
        stored = False
        if redis:
            try:
                await redis.setex(
                    redis_key,
                    MAGIC_LINK_TTL_SECONDS,
                    json_payload,
                )
                stored = True
            except Exception as e:
                logger.warning(
                    f"Redis store failed for magic link: {e}, falling back to memory"
                )

        if not stored:
            expiry_time = time.time() + MAGIC_LINK_TTL_SECONDS
            _memory_fallback[token_hash] = (json_payload, expiry_time)

        # Build verification URL
        magic_url = f"{setting.FRONTEND_URL}/auth/magic-link?token={raw_token}"

        # Send email
        try:
            subject, text_body, html_body = render_email(
                "magic_link",
                locale=locale if locale in ["en", "fr", "ar", "kab"] else "en",
                recipient_email=user.email,
                name=user.fullName or "User",
                magic_url=magic_url,
                expires_in_minutes=15,
                client_ip=client_ip or "Unknown",
            )
            await email_service.send_email_with_retry(
                to_email=user.email,
                subject=subject,
                text_body=text_body,
                html_body=html_body,
            )
        except Exception as e:
            logger.error(f"Failed to send magic link email to {user.email}: {e}")
            try:
                await email_service.send_email(
                    to_email=user.email,
                    subject="Your Podacium Sign-In Link",
                    html_content=f'<p>Click <a href="{magic_url}">here</a> to sign in. Link expires in 15 minutes.</p>',
                )
            except Exception as inner_e:
                logger.error(f"Fallback magic link email failed: {inner_e}")

        logger.info(f"Magic link successfully issued for user {user.id}")
        return {
            "message": "If an active account exists for this email, a sign-in link has been sent.",
            "expires_in_minutes": 15,
        }

    @classmethod
    async def verify_magic_link(
        cls,
        raw_token: str,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[dict, str, str]:
        """
        Verify raw magic link token and return user info with JWT tokens.
        Ensures strict single-use anti-replay.
        """
        if not raw_token or len(raw_token) < 16:
            raise ValueError("Invalid or expired sign-in link.")

        token_hash = _hash_token(raw_token)
        redis_key = f"{MAGIC_LINK_REDIS_PREFIX}{token_hash}"

        raw_payload: Optional[str] = None
        redis = await cls._get_redis()
        if redis:
            try:
                raw_payload = await redis.get(redis_key)
                if raw_payload:
                    await redis.delete(redis_key)
            except Exception as e:
                logger.warning(f"Redis get failed for magic link: {e}")

        if not raw_payload and token_hash in _memory_fallback:
            payload_str, expires_at = _memory_fallback.pop(token_hash)
            if time.time() <= expires_at:
                raw_payload = payload_str

        if not raw_payload:
            raise ValueError(
                "Invalid or expired sign-in link. Please request a new one."
            )

        try:
            payload = json.loads(raw_payload)
        except Exception:
            raise ValueError("Invalid token payload.")

        user_id = payload.get("user_id")
        user = await prisma.user.find_unique(where={"id": user_id})
        if not user or not user.isActive:
            raise ValueError("User account is inactive or not found.")

        # If user's email was unverified, magic link proves email ownership
        if not getattr(user, "emailVerified", False):
            await prisma.user.update(
                where={"id": user.id},
                data={
                    "emailVerified": True,
                    "emailVerifiedAt": datetime.now(timezone.utc),
                },
            )

        # Generate JWT tokens (RFC 9700 family-tracked with JTI)
        from app.services.token_rotation_service import token_rotation_service

        access_token, refresh_token = await token_rotation_service.issue_token_pair(
            user.id
        )

        # Audit event / notification
        try:
            await NotificationService.create_notification(
                NotificationCreate(
                    userId=user.id,
                    type="SECURITY_ALERT",
                    title="Signed In via Magic Link",
                    message="A successful login was completed using a passwordless email link.",
                )
            )
        except Exception as e:
            logger.warning(f"Failed to create notification for magic link login: {e}")

        user_dict = {
            "id": user.id,
            "email": user.email,
            "fullName": user.fullName,
            "role": user.role,
            "emailVerified": True,
            "onboardingCompleted": getattr(user, "onboardingCompleted", False),
        }

        return user_dict, access_token, refresh_token
