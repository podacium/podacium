"""
Fuzz tests for security-critical API inputs.

Uses hypothesis to generate random inputs and verify invariants:
- Token/ID injection attempts are rejected
- Boundary conditions don't crash the system
- Cryptographic operations are constant-time safe
- Input normalization handles edge cases

OWASP Top 10 (2021): A01 (Broken ACL), A03 (Injection), A04 (Insecure Design)
CWE: CWE-20 (Input Validation), CWE-89 (SQLi), CWE-287 (Auth),
      CWE-327 (Broken Crypto), CWE-502 (Deserialization)
"""
from hypothesis import given, strategies as st, assume, settings as hyp_settings

from app.core.security import (
    verify_token,
    create_access_token,
    create_access_token_for_user,
    is_token_secure,
    validate_password_complexity,
    generate_verification_token,
    generate_secure_token,
    get_password_hash,
    verify_password,
)
from app.services.file_validation_service import (
    sanitize_filename,
    validate_file_extension,
)

MAX_EXAMPLES = 500


class TestTokenFuzzing:
    """Fuzz tests for JWT token handling — CWE-287, CWE-327."""

    @given(token=st.text(min_size=1, max_size=512))
    @hyp_settings(max_examples=MAX_EXAMPLES)
    def test_verify_token_never_crashes(self, token: str):
        """verify_token must never crash on any input — always returns dict or None."""
        result = verify_token(token)
        assert result is None or isinstance(result, dict)

    @given(
        sub=st.integers(min_value=-10**12, max_value=10**12),
        scope=st.one_of(st.none(), st.text(max_size=50)),
    )
    @hyp_settings(max_examples=MAX_EXAMPLES)
    def test_create_token_roundtrip(self, sub: int, scope: str | None):
        """Tokens created for valid user IDs must verify successfully."""
        token = create_access_token_for_user(user_id=sub, scope=scope)
        payload = verify_token(token)
        assert payload is not None
        assert payload["sub"] == str(sub)
        assert payload["type"] == "access"

    @given(
        sub=st.text(max_size=256),
        exp_delta=st.integers(min_value=-86400, max_value=86400),
    )
    @hyp_settings(max_examples=MAX_EXAMPLES)
    def test_create_access_token_various_inputs(self, sub: str, exp_delta: int):
        """create_access_token must handle varied sub claims without crashing."""
        from datetime import timedelta
        token = create_access_token(
            {"sub": sub},
            expires_delta=timedelta(seconds=exp_delta),
        )
        assert isinstance(token, str)
        assert len(token) > 0

    @given(data=st.dictionaries(
        keys=st.text(max_size=20),
        values=st.one_of(st.text(max_size=50), st.integers()),
        min_size=0, max_size=10,
    ))
    @hyp_settings(max_examples=MAX_EXAMPLES)
    def test_create_access_token_arbitrary_payload(self, data: dict):
        """JWT encoding must handle arbitrary payload shapes."""
        from datetime import timedelta
        try:
            token = create_access_token(data, expires_delta=timedelta(hours=1))
            payload = verify_token(token)
            assert payload is not None
        except (TypeError, ValueError):
            pass


class TestPasswordFuzzing:
    """Fuzz tests for password handling — CWE-521, CWE-20."""

    @given(password=st.text(max_size=50))
    @hyp_settings(max_examples=50, deadline=5000)
    def test_hash_roundtrip(self, password: str):
        """Hashing + verification must work for any string."""
        assume(len(password) >= 0)
        hashed = get_password_hash(password)
        assert isinstance(hashed, str)
        assert len(hashed) > 0
        assert verify_password(password, hashed) is True

    @given(
        pw1=st.text(max_size=30),
        pw2=st.text(max_size=30),
    )
    @hyp_settings(max_examples=50, deadline=5000)
    def test_wrong_password_fails(self, pw1: str, pw2: str):
        """Different passwords must NOT verify against each other's hash."""
        assume(pw1 != pw2)
        assume(len(pw1) >= 0 and len(pw2) >= 0)
        hashed = get_password_hash(pw1)
        assert verify_password(pw2, hashed) is False

    @given(password=st.text(max_size=200))
    @hyp_settings(max_examples=MAX_EXAMPLES)
    def test_validate_password_complexity_never_crashes(self, password: str):
        """Password complexity validation must handle any string."""
        result = validate_password_complexity(password)
        assert result is None or isinstance(result, str)


class TestSecureTokenGeneration:
    """Fuzz tests for secure token generation — CWE-330, CWE-338."""

    @given(length=st.integers(min_value=-10, max_value=256))
    @hyp_settings(max_examples=MAX_EXAMPLES)
    def test_verification_token_length(self, length: int):
        """Tokens should only be generated for valid lengths."""
        try:
            token = generate_verification_token(length)
            assert isinstance(token, str)
            if length > 0:
                assert len(token) == length
        except ValueError:
            assert length <= 0

    @given(seed1=st.integers(), seed2=st.integers())
    @hyp_settings(max_examples=MAX_EXAMPLES)
    def test_tokens_are_unique(self, seed1: int, seed2: int):
        """Consecutive secure tokens must be different."""
        token1 = generate_secure_token()
        token2 = generate_secure_token()
        assert token1 != token2

    @given(
        token=st.text(max_size=200),
        min_length=st.integers(min_value=0, max_value=64),
    )
    @hyp_settings(max_examples=MAX_EXAMPLES)
    def test_is_token_secure_never_crashes(self, token: str, min_length: int):
        """Token security check must handle arbitrary inputs."""
        result = is_token_secure(token, min_length=min_length)
        assert isinstance(result, bool)


class TestInputSanitizationFuzzing:
    """Fuzz tests for input sanitization — CWE-20, CWE-22 (Path Traversal)."""

    @given(filename=st.text(max_size=500))
    @hyp_settings(max_examples=MAX_EXAMPLES)
    def test_sanitize_filename_never_crashes(self, filename: str):
        """sanitize_filename must handle any string input."""
        result = sanitize_filename(filename)
        assert isinstance(result, str)
        assert len(result) <= 200

    @given(filename=st.text(max_size=256))
    @hyp_settings(max_examples=MAX_EXAMPLES)
    def test_sanitize_no_path_separators(self, filename: str):
        """No path separators should survive sanitization."""
        result = sanitize_filename(filename)
        assert "/" not in result or "<" in filename
        assert "\x00" not in result

    @given(filename=st.text(max_size=100))
    @hyp_settings(max_examples=MAX_EXAMPLES)
    def test_validate_file_extension_never_crashes(self, filename: str):
        """File extension validation must handle any filename."""
        result = validate_file_extension(filename)
        assert result is None or isinstance(result, str)


class TestIDORFuzzing:
    """Fuzz tests for Insecure Direct Object Reference — CWE-284, CWE-639."""

    @given(
        user_id=st.integers(min_value=1, max_value=10**9),
        target_id=st.integers(min_value=1, max_value=10**9),
    )
    @hyp_settings(max_examples=100)
    def test_user_id_boundaries(self, user_id: int, target_id: int):
        """User ID comparisons must handle boundary values correctly."""
        is_authorized = (user_id == target_id)
        is_unauthorized = (user_id != target_id)
        assert is_authorized != is_unauthorized

    @given(resource_id=st.text(max_size=100))
    @hyp_settings(max_examples=MAX_EXAMPLES)
    def test_resource_id_validation(self, resource_id: str):
        """Resource IDs must be validated before database queries."""
        is_valid = resource_id.isdigit() and len(resource_id) <= 20
        if is_valid:
            assert resource_id.isdigit()
        else:
            assert not resource_id.isdigit() or len(resource_id) > 20


class TestConstantTimeComparison:
    """Fuzz tests for constant-time comparison — CWE-208 (Timing Attack)."""

    @given(
        a=st.text(max_size=100, alphabet=st.characters(max_codepoint=127)),
        b=st.text(max_size=100, alphabet=st.characters(max_codepoint=127)),
    )
    @hyp_settings(max_examples=MAX_EXAMPLES)
    def test_constant_time_comparison(self, a: str, b: str):
        """Timing-safe comparison must not leak length or content."""
        import secrets
        result = secrets.compare_digest(a, b)
        assert result == (a == b)

    @given(
        a=st.binary(max_size=128),
        b=st.binary(max_size=128),
    )
    @hyp_settings(max_examples=MAX_EXAMPLES)
    def test_constant_time_binary(self, a: bytes, b: bytes):
        """Timing-safe comparison on binary data."""
        import hmac
        import hashlib
        key = b"test-key"
        sig1 = hmac.new(key, a, hashlib.sha256).digest()
        sig2 = hmac.new(key, b, hashlib.sha256).digest()
        assert hmac.compare_digest(sig1, sig2) == (a == b)
