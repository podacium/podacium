"""
RFC 9700 Refresh Token Family Rotation & Replay Detection Service.

Implements:
- Monotonic generation state machine per token family.
- Atomic Lua execution in Redis with a 10-second concurrency grace period.
- Cascading revocation on detected token reuse / theft.
- SHA-256 hashed persistence in PostgreSQL AuthToken table.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Tuple, cast

from app.core.config import setting
from app.core.prisma import prisma
from app.generated.prisma import Json
from app.core.redis import get_redis
from app.core.security import (
    create_access_token_for_user,
    create_refresh_token,
    verify_token,
    add_token_to_blocklist,
    add_user_to_blocklist,
)

logger = logging.getLogger("podacium.token_rotation")

REFRESH_ROTATION_LUA = """
-- KEYS[1]: rt:fam:<family_id>
-- KEYS[2]: rt:jti:<incoming_jti>
-- KEYS[3]: rt:jti:<new_jti>
-- KEYS[4]: rt:grace:<incoming_jti>
-- ARGV[1]: incoming_jti
-- ARGV[2]: new_jti
-- ARGV[3]: family_id
-- ARGV[4]: user_id
-- ARGV[5]: grace_ttl_seconds (10)
-- ARGV[6]: family_ttl_seconds (2592000 - 30 days)

local fam_key = KEYS[1]
local old_jti_key = KEYS[2]
local new_jti_key = KEYS[3]
local grace_key = KEYS[4]

local incoming_jti = ARGV[1]
local new_jti = ARGV[2]
local family_id = ARGV[3]
local user_id = ARGV[4]
local grace_ttl = tonumber(ARGV[5])
local fam_ttl = tonumber(ARGV[6])

-- 1. Check if token is in active Grace Period (Idempotent concurrent request)
local cached_grace = redis.call("GET", grace_key)
if cached_grace then
    return { "GRACE_HIT", cached_grace }
end

-- 2. Fetch Family Metadata
local fam_data = redis.call("HMGET", fam_key, "current_jti", "current_gen", "revoked")
local current_jti = fam_data[1]
local current_gen = tonumber(fam_data[2])
local is_revoked = tonumber(fam_data[3])

-- 3. Check for Revoked Family
if is_revoked == 1 then
    return { "BREACH_FAMILY_REVOKED", "Family has been revoked due to prior compromise" }
end

if not current_jti then
    -- Brand new family creation
    redis.call("HMSET", fam_key, "current_jti", new_jti, "current_gen", 1, "user_id", user_id, "revoked", 0)
    redis.call("EXPIRE", fam_key, fam_ttl)
    redis.call("HMSET", new_jti_key, "family_id", family_id, "gen", 1, "user_id", user_id, "status", "ACTIVE")
    redis.call("EXPIRE", new_jti_key, fam_ttl)
    return { "OK", "1", new_jti }
end

-- 4. Check if incoming JTI matches current active JTI
if current_jti ~= incoming_jti then
    -- BREACH DETECTED: Reuse of an expired/consumed token outside grace period!
    redis.call("HSET", fam_key, "revoked", 1)
    redis.call("EXPIRE", fam_key, 86400)
    return { "BREACH_REUSE_DETECTED", tostring(current_gen) }
end

-- 5. Valid Rotation: Advance Generation
local next_gen = current_gen + 1

redis.call("HSET", old_jti_key, "status", "CONSUMED")
redis.call("EXPIRE", old_jti_key, grace_ttl + 60)

redis.call("SETEX", grace_key, grace_ttl, new_jti)

redis.call("HMSET", new_jti_key, "family_id", family_id, "gen", next_gen, "user_id", user_id, "status", "ACTIVE")
redis.call("EXPIRE", new_jti_key, fam_ttl)

redis.call("HMSET", fam_key, "current_jti", new_jti, "current_gen", next_gen)
redis.call("EXPIRE", fam_key, fam_ttl)

return { "OK", tostring(next_gen), new_jti }
"""


def hash_token(token: str) -> str:
    """Hash a token for secure storage (never store raw refresh tokens)."""
    return hashlib.sha256(token.encode()).hexdigest()


class TokenRotationService:
    def __init__(self) -> None:
        self._lua_sha: Optional[str] = None

    async def _get_lua_sha(self, redis: Any) -> Optional[str]:
        if not self._lua_sha and redis:
            try:
                self._lua_sha = await redis.script_load(REFRESH_ROTATION_LUA)
            except Exception:
                self._lua_sha = None
        return self._lua_sha

    async def issue_token_pair(
        self,
        user_id: int,
        family_id: Optional[str] = None,
        fingerprint: Optional[str] = None,
        fpt: Optional[str] = None,
    ) -> Tuple[str, str]:
        """Issue a new access + refresh token pair initialized in a token family."""
        fid = family_id or f"fam_{user_id}_{secrets.token_urlsafe(8)}"
        jti = secrets.token_urlsafe(16)
        fpt_claim = fpt or (
            hashlib.sha256(fingerprint.strip().encode()).hexdigest()
            if fingerprint
            else None
        )

        access_token = create_access_token_for_user(user_id, fpt=fpt_claim)
        refresh_payload: Dict[str, Any] = {
            "sub": str(user_id),
            "jti": jti,
            "family_id": fid,
        }
        if fpt_claim:
            refresh_payload["fpt"] = fpt_claim
        refresh_token = create_refresh_token(refresh_payload)

        redis = await get_redis()
        if redis:
            try:
                keys = [
                    f"rt:fam:{fid}",
                    f"rt:jti:{jti}",
                    f"rt:jti:{jti}",
                    f"rt:grace:{jti}",
                ]
                args = [jti, jti, fid, str(user_id), "10", "2592000"]
                await cast(Any, redis).eval(
                    REFRESH_ROTATION_LUA, len(keys), *keys, *args
                )
            except Exception as e:
                logger.warning(f"Redis family initialization error: {e}")

        # Record hash in PostgreSQL
        token_hash = hash_token(refresh_token)
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=setting.JWT_REFRESH_TOKEN_EXPIRE_DAYS
        )
        await prisma.authtoken.create(
            data={
                "userId": user_id,
                "token": token_hash,
                "type": "REFRESH",
                "expiresAt": expires_at,
            }
        )

        return access_token, refresh_token

    async def rotate_refresh_token(
        self, old_refresh_token: str, fingerprint: Optional[str] = None
    ) -> Optional[Tuple[str, str]]:
        """
        Rotate a refresh token using atomic Redis Lua family verification with grace period.
        """
        payload = verify_token(old_refresh_token)
        if not payload or payload.get("type") != "refresh":
            logger.warning("Token rotation failed: invalid or non-refresh token")
            return None

        user_id = int(payload["sub"])

        # 🔒 Fingerprint verification during token refresh (VULN-W2-10)
        token_fpt = payload.get("fpt")
        if token_fpt:
            if not fingerprint:
                logger.warning(
                    f"Refresh rejected: refresh token for user {user_id} is bound to fingerprint, but no fingerprint provided"
                )
                return None
            current_fpt = hashlib.sha256(fingerprint.strip().encode()).hexdigest()
            if not secrets.compare_digest(token_fpt, current_fpt):
                logger.critical(
                    f"🚨 FINGERPRINT MISMATCH during refresh token rotation for user {user_id} — possible session hijacking"
                )
                return None

        incoming_jti = payload.get("jti")
        family_id = (
            payload.get("family_id") or f"fam_{user_id}_{secrets.token_urlsafe(8)}"
        )

        if not incoming_jti:
            # Fallback legacy token without JTI
            return await self._rotate_legacy_db_token(old_refresh_token, user_id)

        old_hash = hash_token(old_refresh_token)

        # ── PostgreSQL Eviction Defense & Lineage Check ───────────────────────
        # If Redis was evicted or restarted, PostgreSQL maintains authoritative lineage.
        stored_token = await prisma.authtoken.find_first(
            where={"token": old_hash, "userId": user_id}
        )
        if stored_token:
            if stored_token.type == "REVOKED":
                logger.critical(
                    f"🚨 PRESENTED REVOKED TOKEN for user {user_id}, family {family_id} — breach detected"
                )
                await self.revoke_token_family(family_id, user_id)
                return None

            if stored_token.usedAt is not None:
                used_at = stored_token.usedAt
                if used_at.tzinfo is None:
                    used_at = used_at.replace(tzinfo=timezone.utc)
                # 10s grace period + 5s latency allowance
                grace_cutoff = datetime.now(timezone.utc) - timedelta(seconds=15)
                if used_at < grace_cutoff:
                    logger.critical(
                        f"🚨 REFRESH TOKEN REPLAY OUTSIDE GRACE PERIOD for user {user_id}, family {family_id} — revoking token family"
                    )
                    await self.revoke_token_family(family_id, user_id)
                    return None

            if stored_token.expiresAt:
                exp_at = stored_token.expiresAt
                if exp_at.tzinfo is None:
                    exp_at = exp_at.replace(tzinfo=timezone.utc)
                if exp_at < datetime.now(timezone.utc):
                    logger.critical(
                        f"🚨 EXPIRED REFRESH TOKEN PRESENTED for user {user_id}, family {family_id}"
                    )
                    await self.revoke_token_family(family_id, user_id)
                    return None

        new_jti = secrets.token_urlsafe(16)
        redis = await get_redis()

        if redis:
            keys = [
                f"rt:fam:{family_id}",
                f"rt:jti:{incoming_jti}",
                f"rt:jti:{new_jti}",
                f"rt:grace:{incoming_jti}",
            ]
            args = [incoming_jti, new_jti, family_id, str(user_id), "10", "2592000"]

            sha = await self._get_lua_sha(redis)
            try:
                redis_client = cast(Any, redis)
                if sha:
                    result = await redis_client.evalsha(sha, len(keys), *keys, *args)
                else:
                    result = await redis_client.eval(
                        REFRESH_ROTATION_LUA, len(keys), *keys, *args
                    )
            except Exception:
                result = await cast(Any, redis).eval(
                    REFRESH_ROTATION_LUA, len(keys), *keys, *args
                )

            status_code = (
                result[0].decode() if isinstance(result[0], bytes) else result[0]
            )

            if (
                status_code == "BREACH_REUSE_DETECTED"
                or status_code == "BREACH_FAMILY_REVOKED"
            ):
                logger.critical(
                    f"🚨 TOKEN REPLAY DETECTED in Redis for user {user_id}, family {family_id} — revoking token family and all sessions"
                )
                await self.revoke_token_family(family_id, user_id)
                return None

            fpt_claim = token_fpt or (
                hashlib.sha256(fingerprint.strip().encode()).hexdigest()
                if fingerprint
                else None
            )

            if status_code == "GRACE_HIT":
                actual_new_jti = (
                    result[1].decode() if isinstance(result[1], bytes) else result[1]
                )
                new_access = create_access_token_for_user(user_id, fpt=fpt_claim)
                new_refresh_payload: Dict[str, Any] = {
                    "sub": str(user_id),
                    "jti": actual_new_jti,
                    "family_id": family_id,
                }
                if fpt_claim:
                    new_refresh_payload["fpt"] = fpt_claim
                new_refresh = create_refresh_token(new_refresh_payload)
                new_hash = hash_token(new_refresh)
                expires_at = datetime.now(timezone.utc) + timedelta(
                    days=setting.JWT_REFRESH_TOKEN_EXPIRE_DAYS
                )
                # Atomically persist grace hit state and token lineage in PostgreSQL
                try:
                    async with prisma.tx() as tx:
                        await tx.authtoken.update_many(
                            where={"token": old_hash, "userId": user_id},
                            data={"usedAt": datetime.now(timezone.utc)},
                        )
                        existing_rec = await tx.authtoken.find_first(
                            where={"token": new_hash, "userId": user_id}
                        )
                        if not existing_rec:
                            await tx.authtoken.create(
                                data={
                                    "userId": user_id,
                                    "token": new_hash,
                                    "type": "REFRESH",
                                    "expiresAt": expires_at,
                                }
                            )
                except Exception as e:
                    logger.warning(
                        f"Database update error during grace hit token rotation: {e}"
                    )
                return new_access, new_refresh

        # Normal successful rotation
        fpt_claim = token_fpt or (
            hashlib.sha256(fingerprint.strip().encode()).hexdigest()
            if fingerprint
            else None
        )
        new_access = create_access_token_for_user(user_id, fpt=fpt_claim)
        new_refresh_payload = {
            "sub": str(user_id),
            "jti": new_jti,
            "family_id": family_id,
        }
        if fpt_claim:
            new_refresh_payload["fpt"] = fpt_claim
        new_refresh = create_refresh_token(new_refresh_payload)

        # Update PostgreSQL atomically within a transaction
        new_hash = hash_token(new_refresh)
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=setting.JWT_REFRESH_TOKEN_EXPIRE_DAYS
        )

        try:
            async with prisma.tx() as tx:
                await tx.authtoken.update_many(
                    where={"token": old_hash, "type": "REFRESH"},
                    data={"usedAt": datetime.now(timezone.utc)},
                )
                await tx.authtoken.create(
                    data={
                        "userId": user_id,
                        "token": new_hash,
                        "type": "REFRESH",
                        "expiresAt": expires_at,
                    }
                )
        except Exception as e:
            logger.warning(f"Database update error during token rotation: {e}")

        return new_access, new_refresh

    async def _rotate_legacy_db_token(
        self, old_refresh_token: str, user_id: int
    ) -> Optional[Tuple[str, str]]:
        old_hash = hash_token(old_refresh_token)
        stored_token = await prisma.authtoken.find_first(
            where={"token": old_hash, "type": "REFRESH", "userId": user_id}
        )

        # If token was stored and marked used, allow a 30-second concurrency grace period
        if stored_token and stored_token.usedAt is not None:
            grace_cutoff = datetime.now(timezone.utc) - timedelta(seconds=30)
            if stored_token.usedAt < grace_cutoff:
                logger.warning(
                    f"Legacy refresh token reuse outside grace period for user {user_id}"
                )
                return None
            # Within grace window, smoothly reissue
            return await self.issue_token_pair(user_id)

        if stored_token and stored_token.expiresAt < datetime.now(timezone.utc):
            return None

        if stored_token:
            try:
                await prisma.authtoken.update(
                    where={"id": stored_token.id},
                    data={"usedAt": datetime.now(timezone.utc)},
                )
            except Exception as e:
                logger.warning(f"Error marking legacy token used: {e}")

        # If not stored (or newly consumed legacy token), smoothly migrate user to family rotation
        return await self.issue_token_pair(user_id)

    async def revoke_all_user_tokens(self, user_id: int) -> None:
        """Revoke ALL user refresh tokens and session cutoff."""
        await prisma.authtoken.update_many(
            where={"userId": user_id, "type": {"in": ["REFRESH", "ACCESS"]}},
            data={"type": "REVOKED"},
        )
        await add_user_to_blocklist(user_id)
        logger.info(f"Revoked all sessions and tokens for user {user_id}")

    async def revoke_refresh_token(self, refresh_token: str) -> bool:
        """Revoke a single refresh token."""
        token_hash = hash_token(refresh_token)
        result = await prisma.authtoken.update_many(
            where={"token": token_hash, "type": "REFRESH"},
            data={"type": "REVOKED", "usedAt": datetime.now(timezone.utc)},
        )
        await add_token_to_blocklist(refresh_token)
        return result > 0

    async def revoke_token_family(self, family_id: str, user_id: int) -> None:
        """
        Revoke an entire token family in both Redis and PostgreSQL,
        revoke all active sessions for that user/family, and record a high-severity security audit event.
        """
        logger.critical(
            f"🚨 CRITICAL BREACH: Revoking token family {family_id} for user {user_id}"
        )
        # 1. Revoke in Redis
        redis = await get_redis()
        if redis:
            try:
                fam_key = f"rt:fam:{family_id}"
                await cast(Any, redis).hset(fam_key, "revoked", "1")
                await cast(Any, redis).expire(fam_key, 86400)
            except Exception as e:
                logger.warning(f"Failed to revoke family in Redis: {e}")

        # 2. Revoke in PostgreSQL and record AuditLog
        try:
            async with prisma.tx() as tx:
                await tx.authtoken.update_many(
                    where={"userId": user_id, "type": "REFRESH"},
                    data={"type": "REVOKED"},
                )
                try:
                    await tx.auditlog.create(
                        data={
                            "actorId": user_id,
                            "entityType": "TokenFamily",
                            "entityId": family_id,
                            "eventType": "SECURITY_TOKEN_FAMILY_BREACH",
                            "metadata": Json(
                                {
                                    "reason": "token_replay_outside_grace_period",
                                    "family_id": family_id,
                                    "action": "family_revocation_all_sessions_terminated",
                                }
                            ),
                        }
                    )
                except Exception as audit_err:
                    logger.warning(
                        f"Failed to create audit log for token breach: {audit_err}"
                    )
        except Exception as e:
            logger.warning(f"Error persisting family revocation in PostgreSQL: {e}")

        # 3. Revoke all active sessions via user-level blocklist (Edge epoch update)
        await add_user_to_blocklist(user_id)

    async def cleanup_expired_tokens(self) -> int:
        """Remove expired token records."""
        result = await prisma.authtoken.delete_many(
            where={
                "expiresAt": {"lt": datetime.now(timezone.utc)},
                "type": {"in": ["REFRESH", "REVOKED"]},
            }
        )
        return result


token_rotation_service = TokenRotationService()

# Export module-level helpers for backward compatibility
issue_token_pair = token_rotation_service.issue_token_pair
rotate_refresh_token = token_rotation_service.rotate_refresh_token
revoke_all_user_tokens = token_rotation_service.revoke_all_user_tokens
revoke_token_family = token_rotation_service.revoke_token_family
revoke_refresh_token = token_rotation_service.revoke_refresh_token
cleanup_expired_tokens = token_rotation_service.cleanup_expired_tokens
