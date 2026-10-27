"""
Security-focused tests.
Covers: token blocklist, auth guards, token verification.

OWASP Top 10 (2021): A07 (Auth Failures), A04 (Insecure Design)
CWE: CWE-613 (Session Expiry), CWE-287 (Improper Auth), CWE-613
"""
from app.core.security import (
    add_token_to_blocklist_sync,
    is_token_blocklisted_locally,
    clear_token_blocklist,
    create_access_token_for_user,
    create_access_token,
    verify_token,
)
from datetime import timedelta


class TestTokenBlocklist:
    """Test token revocation via blocklist."""

    def setup_method(self):
        clear_token_blocklist()

    def test_add_and_check_blocklist(self):
        token = "test_token_123"
        assert is_token_blocklisted_locally(token) is False
        add_token_to_blocklist_sync(token)
        assert is_token_blocklisted_locally(token) is True

    def test_blocklisted_token_fails_verification(self):
        token = create_access_token_for_user(1)
        # Token should verify before blocklisting
        assert verify_token(token) is not None
        # After blocklisting, verification should fail
        add_token_to_blocklist_sync(token)
        assert verify_token(token) is None

    def test_clear_blocklist(self):
        add_token_to_blocklist_sync("token_a")
        add_token_to_blocklist_sync("token_b")
        clear_token_blocklist()
        assert is_token_blocklisted_locally("token_a") is False
        assert is_token_blocklisted_locally("token_b") is False


class TestTokenExpiry:
    """Test token expiration behavior."""

    def test_expired_token_fails_verification(self):
        """Expired tokens should not verify."""
        token = create_access_token(
            {"sub": "1"},
            expires_delta=timedelta(seconds=-1)
        )
        payload = verify_token(token)
        assert payload is None

    def test_valid_token_verifies(self):
        """Non-expired tokens should verify."""
        token = create_access_token(
            {"sub": "99"},
            expires_delta=timedelta(hours=1)
        )
        payload = verify_token(token)
        assert payload is not None
        assert payload["sub"] == "99"

    def test_token_type_preserved(self):
        """Token type should be preserved in payload."""
        token = create_access_token_for_user(5)
        payload = verify_token(token)
        assert payload["type"] == "access"
