"""
Tests for token rotation service.
Covers: token hashing, pair issuance logic, replay detection.

OWASP Top 10 (2021): A07 (Auth Failures)
CWE: CWE-323 (Reusing Nonces), CWE-613 (Session Expiry), CWE-330 (Insufficient Entropy)
"""

import hashlib
import pytest

from app.services.token_rotation_service import hash_token
from app.core.security import (
    create_access_token_for_user,
    create_refresh_token_for_user,
    verify_token,
    add_token_to_blocklist_sync,
    is_token_blocklisted_locally,
    clear_token_blocklist,
)


class TestTokenHashing:
    """Test token hashing for secure storage."""

    def test_hash_token_produces_sha256(self):
        """Hash should be a valid SHA-256 hex digest."""
        token = "test_refresh_token_value"
        hashed = hash_token(token)
        assert len(hashed) == 64  # SHA-256 produces 64 hex chars
        assert hashed == hashlib.sha256(token.encode()).hexdigest()

    def test_hash_is_deterministic(self):
        """Same token should always produce same hash."""
        token = "consistent_token"
        assert hash_token(token) == hash_token(token)

    def test_different_tokens_produce_different_hashes(self):
        """Different tokens should produce different hashes."""
        assert hash_token("token_a") != hash_token("token_b")

    def test_hash_empty_string(self):
        """Empty string should still produce a valid hash."""
        hashed = hash_token("")
        assert len(hashed) == 64


class TestRefreshTokenCreation:
    """Test refresh token creation and verification."""

    def setup_method(self):
        clear_token_blocklist()

    def test_refresh_token_has_correct_type(self):
        """Refresh token payload should have type='refresh'."""
        token = create_refresh_token_for_user(1)
        payload = verify_token(token)
        assert payload is not None
        assert payload["type"] == "refresh"
        assert payload["sub"] == "1"

    def test_refresh_token_different_from_access(self):
        """Refresh and access tokens should be different."""
        access = create_access_token_for_user(1)
        refresh = create_refresh_token_for_user(1)
        assert access != refresh

    def test_blocklisted_refresh_token_fails_verification(self):
        """Blocklisted refresh token should not verify."""
        token = create_refresh_token_for_user(1)
        assert verify_token(token) is not None
        add_token_to_blocklist_sync(token)
        assert verify_token(token) is None

    def test_refresh_token_contains_user_id(self):
        """Refresh token should contain the user ID in sub claim."""
        token = create_refresh_token_for_user(42)
        payload = verify_token(token)
        assert payload["sub"] == "42"


class TestReplayDetection:
    """Test replay attack detection logic (unit-level)."""

    def test_used_token_in_blocklist(self):
        """A token added to blocklist should be detected."""
        token = "used_refresh_token_123"
        assert is_token_blocklisted_locally(token) is False
        add_token_to_blocklist_sync(token)
        assert is_token_blocklisted_locally(token) is True

    def test_blocklist_survives_multiple_additions(self):
        """Multiple tokens can be blocklisted."""
        tokens = [f"token_{i}" for i in range(100)]
        for t in tokens:
            add_token_to_blocklist_sync(t)
        for t in tokens:
            assert is_token_blocklisted_locally(t) is True

    def test_non_blocklisted_token_passes(self):
        """Tokens not in blocklist should pass."""
        add_token_to_blocklist_sync("blocked_token")
        assert is_token_blocklisted_locally("other_token") is False


class TestLegacyAndGraceTokenRotation:
    """Test safe legacy token rotation and grace windows."""

    @pytest.mark.asyncio
    async def test_legacy_token_without_db_record_rotates_safely(self, monkeypatch):
        """A valid legacy refresh token not in AuthToken must NOT trigger replay revocation."""
        from unittest.mock import AsyncMock, MagicMock
        from app.services.token_rotation_service import token_rotation_service
        from app.services.token_rotation_service import prisma

        # Token created without JTI (legacy)
        legacy_token = create_refresh_token_for_user(42)

        # Mock prisma so authtoken.find_first returns None (never stored in DB)
        mock_authtoken = MagicMock()
        mock_authtoken.find_first = AsyncMock(return_value=None)
        mock_authtoken.create = AsyncMock(return_value=None)
        monkeypatch.setattr(prisma, "authtoken", mock_authtoken)

        # Ensure revoke_all_user_tokens is NOT called
        mock_revoke = AsyncMock()
        monkeypatch.setattr(
            token_rotation_service, "revoke_all_user_tokens", mock_revoke
        )

        res = await token_rotation_service.rotate_refresh_token(legacy_token)
        assert res is not None
        new_access, new_refresh = res
        assert new_access is not None
        assert new_refresh is not None
        mock_revoke.assert_not_called()

    @pytest.mark.asyncio
    async def test_normal_token_rotation_with_jti(self, monkeypatch):
        """A valid refresh token with JTI rotates successfully and hashes the new refresh token."""
        from unittest.mock import AsyncMock, MagicMock
        from app.services.token_rotation_service import token_rotation_service
        from app.services.token_rotation_service import prisma
        from app.core.security import create_refresh_token

        token = create_refresh_token(
            {"sub": "42", "jti": "initial_jti", "family_id": "fam_42_abc"}
        )

        mock_authtoken = MagicMock()
        mock_authtoken.find_first = AsyncMock(return_value=None)
        mock_authtoken.update_many = AsyncMock(return_value=1)
        mock_authtoken.create = AsyncMock(return_value=None)
        monkeypatch.setattr(prisma, "authtoken", mock_authtoken)

        mock_redis = AsyncMock()
        mock_redis.evalsha = AsyncMock(return_value=["SUCCESS", "new_jti"])
        mock_redis.eval = AsyncMock(return_value=["SUCCESS", "new_jti"])
        monkeypatch.setattr(
            "app.services.token_rotation_service.get_redis",
            AsyncMock(return_value=mock_redis),
        )

        res = await token_rotation_service.rotate_refresh_token(token)
        assert res is not None
        new_access, new_refresh = res
        assert new_access is not None
        assert new_refresh is not None

        mock_authtoken.create.assert_called_once()
        create_call_args = mock_authtoken.create.call_args[1]["data"]
        assert create_call_args["token"] == hash_token(new_refresh)
        assert create_call_args["userId"] == 42

    @pytest.mark.asyncio
    async def test_grace_hit_persists_lineage_to_postgres(self, monkeypatch):
        """When Redis returns GRACE_HIT, new tokens are generated and lineage is persisted in PostgreSQL."""
        from unittest.mock import AsyncMock, MagicMock
        from app.services.token_rotation_service import token_rotation_service
        from app.services.token_rotation_service import prisma
        from app.core.security import create_refresh_token

        token = create_refresh_token(
            {"sub": "42", "jti": "grace_jti", "family_id": "fam_42_grace"}
        )

        mock_authtoken = MagicMock()
        mock_authtoken.find_first = AsyncMock(return_value=None)
        mock_authtoken.update_many = AsyncMock(return_value=1)
        mock_authtoken.create = AsyncMock(return_value=None)
        monkeypatch.setattr(prisma, "authtoken", mock_authtoken)

        # Mock Redis returning GRACE_HIT
        mock_redis = AsyncMock()
        mock_redis.evalsha = AsyncMock(
            return_value=["GRACE_HIT", "new_acc_jti", "new_ref_jti"]
        )
        mock_redis.eval = AsyncMock(
            return_value=["GRACE_HIT", "new_acc_jti", "new_ref_jti"]
        )
        monkeypatch.setattr(
            "app.services.token_rotation_service.get_redis",
            AsyncMock(return_value=mock_redis),
        )

        res = await token_rotation_service.rotate_refresh_token(token)
        assert res is not None
        new_access, new_refresh = res
        assert new_access is not None
        assert new_refresh is not None

        # Verify PostgreSQL persistence was invoked
        mock_authtoken.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_post_grace_replay_detected_via_postgres_when_redis_evicted(
        self, monkeypatch
    ):
        """If Redis evicts keys (NOT_FOUND), but PostgreSQL shows token was used outside grace window, breach detection triggers."""
        from datetime import datetime, timezone, timedelta
        from unittest.mock import AsyncMock, MagicMock
        from app.services.token_rotation_service import token_rotation_service
        from app.services.token_rotation_service import prisma
        from app.core.security import create_refresh_token

        token = create_refresh_token(
            {"sub": "42", "jti": "evicted_jti", "family_id": "fam_42_evicted"}
        )

        # Mock DB record showing token was already used 15 seconds ago (outside 10s grace)
        stale_used_at = datetime.now(timezone.utc) - timedelta(seconds=15)
        mock_record = MagicMock()
        mock_record.usedAt = stale_used_at
        mock_record.type = "REFRESH"

        mock_authtoken = MagicMock()
        mock_authtoken.find_first = AsyncMock(return_value=mock_record)
        mock_authtoken.update_many = AsyncMock(return_value=1)
        monkeypatch.setattr(prisma, "authtoken", mock_authtoken)

        # Redis has evicted the key, so it returns NOT_FOUND
        mock_redis = AsyncMock()
        mock_redis.evalsha = AsyncMock(return_value=["NOT_FOUND"])
        mock_redis.eval = AsyncMock(return_value=["NOT_FOUND"])
        monkeypatch.setattr(
            "app.services.token_rotation_service.get_redis",
            AsyncMock(return_value=mock_redis),
        )

        mock_revoke_family = AsyncMock()
        monkeypatch.setattr(
            token_rotation_service, "revoke_token_family", mock_revoke_family
        )

        res = await token_rotation_service.rotate_refresh_token(token)
        # Should detect replay and reject
        assert res is None
        # Should revoke entire token family
        mock_revoke_family.assert_called_once_with("fam_42_evicted", 42)

    @pytest.mark.asyncio
    async def test_revoke_token_family_purges_redis_and_postgres(self, monkeypatch):
        """revoke_token_family marks tokens REVOKED in DB, logs audit event, and updates revocation epoch."""
        from unittest.mock import AsyncMock, MagicMock
        from app.services.token_rotation_service import token_rotation_service
        from app.services.token_rotation_service import prisma

        mock_authtoken = MagicMock()
        mock_authtoken.update_many = AsyncMock(return_value=2)
        monkeypatch.setattr(prisma, "authtoken", mock_authtoken)

        mock_audit = MagicMock()
        mock_audit.create = AsyncMock(return_value=None)
        monkeypatch.setattr(prisma, "auditlog", mock_audit)

        mock_redis = AsyncMock()
        mock_redis.hset = AsyncMock(return_value=1)
        mock_redis.expire = AsyncMock(return_value=True)
        monkeypatch.setattr(
            "app.services.token_rotation_service.get_redis",
            AsyncMock(return_value=mock_redis),
        )

        mock_blocklist = AsyncMock()
        monkeypatch.setattr(
            "app.services.token_rotation_service.add_user_to_blocklist",
            mock_blocklist,
        )

        await token_rotation_service.revoke_token_family("fam_99_test", 99)

        # 1. DB updated
        mock_authtoken.update_many.assert_called_once_with(
            where={"userId": 99, "type": "REFRESH"},
            data={"type": "REVOKED"},
        )
        # 2. Audit log recorded
        mock_audit.create.assert_called_once()
        audit_call = mock_audit.create.call_args[1]["data"]
        assert audit_call["eventType"] == "SECURITY_TOKEN_FAMILY_BREACH"
        assert audit_call["actorId"] == 99
        # 3. Redis family revocation key set via hset and expire
        mock_redis.hset.assert_called_once_with("rt:fam:fam_99_test", "revoked", "1")
        mock_redis.expire.assert_called_once_with("rt:fam:fam_99_test", 86400)
        # 4. User session revoked at edge
        mock_blocklist.assert_called_once_with(99)
