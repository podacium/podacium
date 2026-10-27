from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.core.config import setting
from app.core.prisma import prisma
from app.core.scopes import scopes_to_bitmask, validate_scopes
from app.schemas.api_keys import (
    ApiKeyCreate,
    ApiKeyCreatedResponse,
    ApiKeyListResponse,
    ApiKeyResponse,
)

logger = logging.getLogger(__name__)


@dataclass
class ApiKeyContext:
    key_id: int
    user_id: int
    scopes: List[str]
    scope_bitmask: int
    environment: str


def compute_masked_key(key_prefix: str, raw_secret: str) -> str:
    """Generate display mask like sk_live_podacium_••••••••••••3x9Q."""
    tail = raw_secret[-4:] if len(raw_secret) >= 4 else "xxxx"
    return f"{key_prefix}••••••••••••{tail}"


class ApiKeyService:
    def __init__(self) -> None:
        self.db = prisma
        self._pepper = (
            getattr(setting, "API_KEY_PEPPER", None) or setting.SECRET_KEY or ""
        ).encode("utf-8")

    def compute_key_hash(self, raw_key: str) -> str:
        """
        Compute primary SHA-256 hash stored in PostgreSQL.
        Consistent with existing database entries.
        """
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    async def create_api_key(
        self, user_id: int, request: ApiKeyCreate
    ) -> ApiKeyCreatedResponse:
        """Generate a Stripe-style API key, storing only SHA-256 hash in PostgreSQL."""
        env_tag = "live" if request.environment == "production" else "test"
        random_entropy = secrets.token_urlsafe(32)
        raw_secret = f"sk_{env_tag}_podacium_{random_entropy}"
        key_prefix = f"sk_{env_tag}_podacium_"
        key_hash = self.compute_key_hash(raw_secret)

        # Validate requested scopes
        if request.scopes:
            if not validate_scopes(request.scopes):
                raise ValueError("One or more requested scopes are invalid")
            assigned_scopes = request.scopes
        else:
            # Principle of least privilege: default to standard read scopes instead of full superuser '*'
            assigned_scopes = ["read:courses", "read:contracts", "read:invoices"]

        now_utc = datetime.now(timezone.utc)
        expires_at = None
        if request.expires_days and request.expires_days > 0:
            expires_at = now_utc + timedelta(days=request.expires_days)

        record = await self.db.apikey.create(
            data={
                "userId": user_id,
                "name": request.name,
                "keyPrefix": key_prefix,
                "keyHash": key_hash,
                "scopes": assigned_scopes,
                "environment": request.environment,
                "expiresAt": expires_at,
            }
        )

        masked = compute_masked_key(key_prefix, raw_secret)

        return ApiKeyCreatedResponse(
            id=record.id,
            user_id=record.userId,
            name=record.name,
            key_prefix=record.keyPrefix,
            masked_key=masked,
            scopes=record.scopes,
            environment=record.environment,
            last_used_at=record.lastUsedAt,
            expires_at=record.expiresAt,
            grace_expires_at=record.graceExpiresAt,
            successor_key_id=record.successorKeyId,
            replaced_key_id=record.replacedKeyId,
            created_at=record.createdAt,
            revoked_at=record.revokedAt,
            secret_key=raw_secret,
        )

    async def list_api_keys(self, user_id: int) -> ApiKeyListResponse:
        """List active and historical API keys for a user with masked display."""
        records = await self.db.apikey.find_many(
            where={"userId": user_id},
            order={"createdAt": "desc"},
        )
        keys = [
            ApiKeyResponse(
                id=r.id,
                user_id=r.userId,
                name=r.name,
                key_prefix=r.keyPrefix,
                masked_key=f"{r.keyPrefix}••••••••••••{r.keyHash[:4]}",
                scopes=r.scopes,
                environment=r.environment,
                last_used_at=r.lastUsedAt,
                expires_at=r.expiresAt,
                grace_expires_at=r.graceExpiresAt,
                successor_key_id=r.successorKeyId,
                replaced_key_id=r.replacedKeyId,
                created_at=r.createdAt,
                revoked_at=r.revokedAt,
            )
            for r in records
        ]
        return ApiKeyListResponse(api_keys=keys)

    async def revoke_api_key(self, user_id: int, key_id: int) -> bool:
        """Instantly revoke an API key."""
        try:
            key = await self.db.apikey.find_unique(where={"id": key_id})
            if not key or key.userId != user_id:
                return False

            now_utc = datetime.now(timezone.utc)
            await self.db.apikey.update(
                where={"id": key_id},
                data={"revokedAt": now_utc},
            )
            return True
        except Exception as e:
            logger.error(f"Failed to revoke API key {key_id}: {e}")
            return False

    async def verify_api_key(self, raw_key: str) -> Optional[int]:
        """
        Authenticate incoming request by matching keyHash with constant-time comparison,
        enforcing UTC expiration, and strictly blocking expired rotation grace periods.
        """
        ctx = await self.verify_api_key_context(raw_key)
        return ctx.user_id if ctx else None

    async def verify_api_key_context(self, raw_key: str) -> Optional[ApiKeyContext]:
        """
        Full authentication returning rich ApiKeyContext (id, user_id, scopes, bitmask).
        Validates key active state, standard expiration, and 7-day rotation grace expiration.
        """
        if not raw_key or not raw_key.startswith("sk_"):
            return None

        incoming_hash = self.compute_key_hash(raw_key)
        key = await self.db.apikey.find_unique(where={"keyHash": incoming_hash})

        if not key:
            # Constant-time dummy comparison to mitigate timing attacks on nonexistent keys
            dummy_hash = self.compute_key_hash(
                "sk_live_podacium_dummyentropy0000000000000000"
            )
            hmac.compare_digest(dummy_hash, incoming_hash)
            return None

        # Constant-time verification of stored keyHash
        if not hmac.compare_digest(key.keyHash, incoming_hash):
            return None

        if key.revokedAt is not None:
            return None

        now_utc = datetime.now(timezone.utc)

        # 1. Standard key expiration check (UTC-normalized)
        if key.expiresAt:
            exp_utc = (
                key.expiresAt
                if key.expiresAt.tzinfo
                else key.expiresAt.replace(tzinfo=timezone.utc)
            )
            if exp_utc < now_utc:
                return None

        # 2. [CRITICAL-DEV-02] Rotated key grace-period expiration check (UTC-normalized)
        if key.graceExpiresAt:
            grace_utc = (
                key.graceExpiresAt
                if key.graceExpiresAt.tzinfo
                else key.graceExpiresAt.replace(tzinfo=timezone.utc)
            )
            if grace_utc < now_utc:
                logger.warning(
                    f"Rejected API key {key.id}: rotation grace period expired at {key.graceExpiresAt} (now={now_utc})"
                )
                # Auto-revoke expired key for defense-in-depth
                try:
                    await self.db.apikey.update(
                        where={"id": key.id},
                        data={"revokedAt": now_utc},
                    )
                except Exception as e:
                    logger.warning(
                        f"Could not update revokedAt for grace-expired key {key.id}: {e}"
                    )
                return None

        # Update last used timestamp asynchronously
        try:
            await self.db.apikey.update(
                where={"id": key.id},
                data={"lastUsedAt": now_utc},
            )
        except Exception:
            pass

        return ApiKeyContext(
            key_id=key.id,
            user_id=key.userId,
            scopes=key.scopes,
            scope_bitmask=scopes_to_bitmask(key.scopes),
            environment=key.environment,
        )

    async def rotate_api_key_with_grace_period(
        self, user_id: int, key_id: int, grace_hours: int = 168
    ) -> ApiKeyCreatedResponse:
        """Rotate an API key with a 7-day transition window (dual-key active rotation)."""
        existing = await self.db.apikey.find_unique(where={"id": key_id})
        if not existing or existing.userId != user_id:
            raise ValueError("API key not found")

        now_utc = datetime.now(timezone.utc)

        # Generate new successor key
        env_tag = "live" if existing.environment == "production" else "test"
        random_entropy = secrets.token_urlsafe(32)
        raw_secret = f"sk_{env_tag}_podacium_{random_entropy}"
        key_prefix = f"sk_{env_tag}_podacium_"
        key_hash = self.compute_key_hash(raw_secret)

        # Set grace expiration on predecessor key
        grace_expires_at = now_utc + timedelta(hours=grace_hours)
        await self.db.apikey.update(
            where={"id": key_id},
            data={"graceExpiresAt": grace_expires_at},
        )

        # Create successor key
        new_record = await self.db.apikey.create(
            data={
                "userId": user_id,
                "name": f"{existing.name} (Rotated)",
                "keyPrefix": key_prefix,
                "keyHash": key_hash,
                "scopes": existing.scopes,
                "environment": existing.environment,
                "replacedKeyId": existing.id,
            }
        )

        # Link predecessor to successor
        await self.db.apikey.update(
            where={"id": key_id},
            data={"successorKeyId": new_record.id},
        )

        masked = compute_masked_key(key_prefix, raw_secret)

        return ApiKeyCreatedResponse(
            id=new_record.id,
            user_id=new_record.userId,
            name=new_record.name,
            key_prefix=new_record.keyPrefix,
            masked_key=masked,
            scopes=new_record.scopes,
            environment=new_record.environment,
            last_used_at=new_record.lastUsedAt,
            expires_at=new_record.expiresAt,
            grace_expires_at=new_record.graceExpiresAt,
            successor_key_id=new_record.successorKeyId,
            replaced_key_id=new_record.replacedKeyId,
            created_at=new_record.createdAt,
            revoked_at=new_record.revokedAt,
            secret_key=raw_secret,
        )

    async def rotate_api_key(self, user_id: int, key_id: int) -> ApiKeyCreatedResponse:
        """Rotate an API key by generating a new key while retaining metadata."""
        return await self.rotate_api_key_with_grace_period(
            user_id, key_id, grace_hours=168
        )

    async def get_api_key_analytics(self, user_id: int, key_id: int) -> Dict[str, Any]:
        """Fetch request volume metrics and analytics for an API key."""
        key = await self.db.apikey.find_unique(where={"id": key_id})
        if not key or key.userId != user_id:
            raise ValueError("API key not found")

        usages = await self.db.apikeyusage.find_many(
            where={"apiKeyId": key_id},
            order={"timestamp": "desc"},
            take=100,
        )

        total_calls = len(usages)
        error_calls = sum(1 for u in usages if u.statusCode >= 400)
        avg_resp_ms = sum(u.responseTimeMs or 0 for u in usages) / max(total_calls, 1)

        return {
            "key_id": key_id,
            "key_name": key.name,
            "total_requests": total_calls,
            "error_requests": error_calls,
            "error_rate_percentage": round(
                (error_calls / max(total_calls, 1)) * 100, 2
            ),
            "avg_response_time_ms": round(avg_resp_ms, 2),
            "recent_usages": [
                {
                    "endpoint": u.endpoint,
                    "method": u.method,
                    "status_code": u.statusCode,
                    "response_time_ms": u.responseTimeMs,
                    "timestamp": u.timestamp.isoformat(),
                }
                for u in usages[:10]
            ],
        }


api_key_service = ApiKeyService()
