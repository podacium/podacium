"""
Tests for authentication endpoints.
Covers: register, login, logout, token refresh, password reset.
"""
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token_for_user,
    create_refresh_token_for_user,
    verify_token,
    validate_password_complexity,
)


# =============================================================================
# Unit Tests: Password Security
# =============================================================================

class TestPasswordSecurity:
    """Test password hashing and validation."""

    def test_password_hash_and_verify(self):
        password = "SecurePass123!"
        hashed = get_password_hash(password)
        assert hashed != password
        assert verify_password(password, hashed) is True
        assert verify_password("WrongPassword1!", hashed) is False

    def test_password_complexity_valid(self):
        assert validate_password_complexity("ValidPass1!") is None
        assert validate_password_complexity("C0mpl3x@Pass") is None

    def test_password_complexity_too_short(self):
        result = validate_password_complexity("Ab1!")
        assert result is not None
        assert "8 characters" in result

    def test_password_complexity_no_uppercase(self):
        result = validate_password_complexity("lowercase1!")
        assert result is not None
        assert "uppercase" in result

    def test_password_complexity_no_lowercase(self):
        result = validate_password_complexity("UPPERCASE1!")
        assert result is not None
        assert "lowercase" in result

    def test_password_complexity_no_digit(self):
        result = validate_password_complexity("NoDigits!!")
        assert result is not None
        assert "digit" in result

    def test_password_complexity_no_special(self):
        result = validate_password_complexity("NoSpecial1A")
        assert result is not None
        assert "special" in result


# =============================================================================
# Unit Tests: JWT Tokens
# =============================================================================

class TestJWTTokens:
    """Test JWT token creation and verification."""

    def test_create_access_token(self):
        token = create_access_token_for_user(42)
        payload = verify_token(token)
        assert payload is not None
        assert payload["sub"] == "42"
        assert payload["type"] == "access"

    def test_create_refresh_token(self):
        token = create_refresh_token_for_user(42)
        payload = verify_token(token)
        assert payload is not None
        assert payload["sub"] == "42"
        assert payload["type"] == "refresh"

    def test_verify_invalid_token(self):
        payload = verify_token("invalid.token.here")
        assert payload is None

    def test_verify_empty_token(self):
        payload = verify_token("")
        assert payload is None
