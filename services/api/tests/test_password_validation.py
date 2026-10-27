"""
Tests for password validation and hashing.
Covers: complexity rules, Argon2 hashing, edge cases.

OWASP Top 10 (2021): A07 (Auth Failures)
CWE: CWE-521 (Weak Password), CWE-916 (Password Hashing), CWE-330 (Insufficient Entropy)
"""
from app.core.security import (
    get_password_hash,
    verify_password,
    validate_password_complexity,
    generate_verification_token,
    generate_numeric_verification_code,
    generate_secure_token,
    is_token_secure,
)


class TestPasswordHashing:
    """Test Argon2 password hashing."""

    def test_hash_is_not_plaintext(self):
        """Hash should never equal the plaintext password."""
        password = "MySecurePass123!"
        hashed = get_password_hash(password)
        assert hashed != password

    def test_hash_is_verifiable(self):
        """Hashed password should verify against original."""
        password = "TestPassword1@"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True

    def test_wrong_password_fails(self):
        """Wrong password should not verify."""
        hashed = get_password_hash("CorrectPass1!")
        assert verify_password("WrongPass1!", hashed) is False

    def test_different_hashes_for_same_password(self):
        """Same password should produce different hashes (salt)."""
        password = "SamePassword1!"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)
        assert hash1 != hash2  # Different salts

    def test_empty_password_fails_verification(self):
        """Empty password should not verify against any hash."""
        hashed = get_password_hash("RealPassword1!")
        assert verify_password("", hashed) is False

    def test_unicode_password(self):
        """Unicode passwords should hash and verify correctly."""
        password = "Pässwörd1!日本語"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True

    def test_very_long_password(self):
        """Very long passwords should work (up to reasonable limits)."""
        password = "A1!" + "x" * 200
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True


class TestPasswordComplexity:
    """Test password complexity validation rules."""

    def test_valid_passwords(self):
        """Various valid passwords should pass."""
        valid = [
            "ValidPass1!",
            "C0mpl3x@Pass",
            "Str0ng#Password",
            "MyP@ss123",
            "Ab1!defg",
        ]
        for pw in valid:
            assert validate_password_complexity(pw) is None, f"Failed for: {pw}"

    def test_too_short(self):
        result = validate_password_complexity("Ab1!")
        assert result is not None
        assert "8 characters" in result

    def test_no_uppercase(self):
        result = validate_password_complexity("lowercase1!")
        assert "uppercase" in result

    def test_no_lowercase(self):
        result = validate_password_complexity("UPPERCASE1!")
        assert "lowercase" in result

    def test_no_digit(self):
        result = validate_password_complexity("NoDigits!@")
        assert "digit" in result

    def test_no_special_char(self):
        result = validate_password_complexity("NoSpecial1A")
        assert "special" in result

    def test_exactly_8_chars_valid(self):
        """Minimum length boundary — exactly 8 chars should pass if complex."""
        assert validate_password_complexity("Ab1!cdef") is None

    def test_7_chars_invalid(self):
        """Below minimum — 7 chars should fail."""
        result = validate_password_complexity("Ab1!cde")
        assert result is not None


class TestTokenGeneration:
    """Test verification token generation."""

    def test_verification_token_length(self):
        token = generate_verification_token(32)
        assert len(token) == 32

    def test_verification_token_custom_length(self):
        token = generate_verification_token(64)
        assert len(token) == 64

    def test_numeric_code_length(self):
        code = generate_numeric_verification_code(6)
        assert len(code) == 6
        assert code.isdigit()

    def test_numeric_code_custom_length(self):
        code = generate_numeric_verification_code(8)
        assert len(code) == 8
        assert code.isdigit()

    def test_secure_token_is_url_safe(self):
        token = generate_secure_token()
        assert len(token) > 20
        # URL-safe base64 characters
        assert all(c.isalnum() or c in "-_=" for c in token)

    def test_tokens_are_unique(self):
        """Generated tokens should be unique."""
        tokens = {generate_verification_token() for _ in range(100)}
        assert len(tokens) == 100

    def test_is_token_secure_valid(self):
        token = generate_secure_token()
        assert is_token_secure(token) is True

    def test_is_token_secure_too_short(self):
        assert is_token_secure("abc") is False

    def test_is_token_secure_low_entropy(self):
        assert is_token_secure("aaaaaaaaaaaaaaaa") is False

    def test_is_token_secure_empty(self):
        assert is_token_secure("") is False
        assert is_token_secure(None) is False
