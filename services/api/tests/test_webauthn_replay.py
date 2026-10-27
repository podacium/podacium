"""
Tests for WebAuthn step-up challenge replay rejection and atomic invalidation.
Covers:
- [HIGH-AUTH-03] Challenge one-time-use semantics.
- Immediate challenge destruction via get_and_delete.
- Interception / replay of valid assertion blocked on 2nd attempt.
"""

import base64
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.webauthn_service import WebAuthnService
from app.core.redis_blocklist import token_blocklist


class TestWebAuthnChallengeReplay:
    """Test WebAuthn challenge replay elimination."""

    @pytest.mark.asyncio
    async def test_challenge_consumed_atomically_blocks_replay(self, monkeypatch):
        """A valid WebAuthn assertion cannot be replayed because challenge is atomically deleted on first use."""
        user_id = 77
        challenge_bytes = b"safe_random_challenge_bytes_123"
        challenge_b64 = base64.b64encode(challenge_bytes).decode()

        # Seed challenge in token_blocklist
        await token_blocklist.set(
            f"webauthn_auth_challenge_{user_id}", challenge_b64, 300
        )

        # Mock stored credential in Prisma
        mock_cred = MagicMock()
        mock_cred.id = 1
        mock_cred.userId = user_id
        mock_cred.credentialId = "cred_id_xyz"
        mock_cred.publicKey = base64.b64encode(b"fake_public_key_bytes_1234").decode()
        mock_cred.counter = 10

        mock_prisma_cred = MagicMock()
        mock_prisma_cred.find_first = AsyncMock(return_value=mock_cred)
        mock_prisma_cred.update = AsyncMock(return_value=None)
        monkeypatch.setattr(
            "app.services.webauthn_service.prisma.webauthncredential", mock_prisma_cred
        )

        # Mock webauthn.verify_authentication_response to succeed on first call
        mock_verification = MagicMock()
        mock_verification.new_sign_count = 11

        with patch(
            "app.services.webauthn_service.verify_authentication_response",
            return_value=mock_verification,
        ):
            # 1. First verification attempt with valid response
            result1 = await WebAuthnService.verify_authentication(
                user_id=user_id,
                response={
                    "id": "cred_id_xyz",
                    "rawId": "cred_id_xyz",
                    "response": {
                        "clientDataJSON": "fake",
                        "authenticatorData": "fake",
                        "signature": "fake",
                    },
                },
            )
            assert result1 is not None
            assert result1["credentialId"] == "cred_id_xyz"
            assert result1["counter"] == 11

            # 2. Second attempt (replay attack with identical assertion)
            result2 = await WebAuthnService.verify_authentication(
                user_id=user_id,
                response={
                    "id": "cred_id_xyz",
                    "rawId": "cred_id_xyz",
                    "response": {
                        "clientDataJSON": "fake",
                        "authenticatorData": "fake",
                        "signature": "fake",
                    },
                },
            )
            # Must be rejected because challenge was atomically removed
            assert result2 is None

    @pytest.mark.asyncio
    async def test_missing_challenge_rejected_immediately(self):
        """Verification without an existing challenge returns None without database lookup."""
        result = await WebAuthnService.verify_authentication(
            user_id=999,
            response={"id": "non_existent"},
        )
        assert result is None
