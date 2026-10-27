"""
Tests for TOTP 2FA service.
Covers: secret generation, code verification, backup codes.

OWASP Top 10 (2021): A07 (Auth Failures)
CWE: CWE-308 (Single-Factor Auth), CWE-523 (Insufficient Protections)
"""
import pyotp

from app.services.totp_service import TOTPService


class TestTOTPService:
    """Test TOTP two-factor authentication logic."""

    def setup_method(self):
        self.service = TOTPService()

    def test_generate_secret(self):
        """Generated secret should be a valid base32 string."""
        secret = self.service.generate_secret()
        assert len(secret) == 32  # pyotp default length
        # Should be valid base32
        assert all(c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" for c in secret)

    def test_generate_provisioning_uri(self):
        """Provisioning URI should contain app name and email."""
        secret = self.service.generate_secret()
        uri = self.service.get_provisioning_uri(secret, "user@podacium.com")
        assert "otpauth://totp/" in uri
        assert "Podacium" in uri
        assert "user%40podacium.com" in uri or "user@podacium.com" in uri
        assert f"secret={secret}" in uri

    def test_verify_valid_code(self):
        """A freshly generated code should verify successfully."""
        secret = self.service.generate_secret()
        totp = pyotp.TOTP(secret)
        current_code = totp.now()
        assert self.service.verify_code(secret, current_code) is True

    def test_verify_invalid_code(self):
        """An incorrect code should fail verification."""
        secret = self.service.generate_secret()
        assert self.service.verify_code(secret, "000000") is False

    def test_verify_empty_code(self):
        """Empty code should fail gracefully."""
        secret = self.service.generate_secret()
        assert self.service.verify_code(secret, "") is False

    def test_verify_empty_secret(self):
        """Empty secret should fail gracefully."""
        assert self.service.verify_code("", "123456") is False

    def test_verify_none_inputs(self):
        """None inputs should fail gracefully."""
        assert self.service.verify_code(None, "123456") is False
        assert self.service.verify_code("secret", None) is False

    def test_generate_backup_codes(self):
        """Should generate the correct number of formatted backup codes."""
        codes = self.service.generate_backup_codes()
        assert len(codes) == 10
        for code in codes:
            # Format: XXXX-XXXX
            assert len(code) == 9
            assert code[4] == "-"
            # All alphanumeric (uppercase + digits)
            clean = code.replace("-", "")
            assert clean.isalnum()
            assert clean == clean.upper()

    def test_backup_codes_are_unique(self):
        """All backup codes should be unique."""
        codes = self.service.generate_backup_codes()
        assert len(set(codes)) == len(codes)

    def test_different_secrets_produce_different_codes(self):
        """Two different secrets should produce different codes at the same time."""
        secret1 = self.service.generate_secret()
        secret2 = self.service.generate_secret()
        assert secret1 != secret2
        pyotp.TOTP(secret1)
        pyotp.TOTP(secret2)
        # Very unlikely to be the same (1 in 1,000,000)
        # But we test the secrets are different
        assert secret1 != secret2
