"""
Core security module — JWT handling, password hashing, token management.

Uses PyJWT (actively maintained) instead of python-jose.
Uses Redis-backed blocklist for token revocation across workers.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict
import hashlib
import jwt as pyjwt
from passlib.context import CryptContext
from app.core.config import setting
from app.core.redis_blocklist import token_blocklist
import logging
import secrets
import string
import re

logger = logging.getLogger(__name__)

# Use Argon2 with OWASP-recommended parameters
pwd_context = CryptContext(
    schemes=["argon2", "pbkdf2_sha256"],
    deprecated="auto",
    argon2__time_cost=3,
    argon2__memory_cost=19456,
    argon2__parallelism=1,
    argon2__hash_len=32,
)

# JWT settings
SECRET_KEY = setting.JWT_SECRET_KEY
ALGORITHM = setting.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = setting.JWT_REFRESH_TOKEN_EXPIRE_DAYS


# RS256 keypair (for asymmetric signing — preferred in production)
# PEM keys in env vars often have literal \n instead of real newlines — normalise them.
def _normalise_pem(value: Optional[str]) -> Optional[str]:
    """Convert literal ``\\n`` inside env-var PEM strings to real newlines."""
    if not value:
        return value
    return value.replace("\\n", "\n")


_PRIVATE_KEY = _normalise_pem(setting.JWT_PRIVATE_KEY)  # only used for encoding
_PUBLIC_KEY = _normalise_pem(
    setting.JWT_PUBLIC_KEY
)  # only used for decoding (verification)


def _get_signing_key() -> str:
    """Return the key used to sign JWTs (HS256: shared secret; RS256: private key)."""
    if ALGORITHM.startswith("RS") or ALGORITHM.startswith("ES"):
        if not _PRIVATE_KEY:
            raise ValueError(
                f"JWT_ALGORITHM is {ALGORITHM} but JWT_PRIVATE_KEY is not set"
            )
        return _PRIVATE_KEY
    return SECRET_KEY


def _get_verifying_key() -> str:
    """Return the key used to verify JWTs (HS256: shared secret; RS256: public key)."""
    if ALGORITHM.startswith("RS") or ALGORITHM.startswith("ES"):
        if not _PUBLIC_KEY:
            raise ValueError(
                f"JWT_ALGORITHM is {ALGORITHM} but JWT_PUBLIC_KEY is not set"
            )
        return _PUBLIC_KEY
    return SECRET_KEY


# ======================
# TOKEN BLOCKLIST (Redis-backed)
# ======================


async def add_token_to_blocklist(token: str, ttl_seconds: Optional[int] = None) -> None:
    """Add a JWT to the Redis-backed blocklist."""
    if ttl_seconds is None:
        ttl_seconds = REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    await token_blocklist.add(token, ttl_seconds=ttl_seconds)


def add_token_to_blocklist_sync(token: str) -> None:
    """
    Synchronous wrapper — adds to in-memory fallback immediately.
    The Redis write happens on next async opportunity.
    """
    import hashlib

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    token_blocklist._fallback.add(token_hash)


def is_token_blocklisted_locally(token: str) -> bool:
    """Check if a JWT is in the local in-memory cache (sync, fast path)."""
    return token_blocklist.contains_sync(token)


# Legacy aliases for backward compatibility with existing code
def is_token_blocklisted(token: str) -> bool:
    """Legacy alias for local blocklist check."""
    return is_token_blocklisted_locally(token)


def clear_token_blocklist() -> None:
    """Clear the local blocklist cache (for testing only)."""
    token_blocklist.clear()


# ======================
# USER-LEVEL REVOCATION (for session invalidation on password reset / forced logout)
# ======================

USER_MIN_IAT_PREFIX = "user_min_iat:"


async def add_user_to_blocklist(user_id: int, revoked_at: Optional[int] = None) -> None:
    """Add a user-level revocation timestamp that invalidates prior sessions.

    Any token for this user issued before revoked_at (default: now) will be rejected.
    The entry expires after REFRESH_TOKEN_EXPIRE_DAYS.
    """
    min_iat = (
        revoked_at
        if revoked_at is not None
        else int(datetime.now(timezone.utc).timestamp())
    )
    ttl = REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    await token_blocklist.set_user_min_iat(user_id, min_iat, ttl_seconds=ttl)


async def is_user_blocklisted(user_id: int, token_iat: Optional[int] = None) -> bool:
    """Check if a user session is revoked based on token issuance timestamp (iat)."""
    min_iat = await token_blocklist.get_user_min_iat(user_id)
    if min_iat is None:
        return False
    if token_iat is not None:
        return token_iat < min_iat
    return True


def is_user_blocklisted_sync(user_id: int, token_iat: Optional[int] = None) -> bool:
    """Synchronous check for user-level revocation (fast path)."""
    min_iat = token_blocklist.get_user_min_iat_sync(user_id)
    if min_iat is None:
        return False
    if token_iat is not None:
        return token_iat < min_iat
    return True


def extract_token_payload(token: str) -> Optional[Dict[str, Any]]:
    """Extract and verify JWT payload without full blocklist check.

    Used when you need the raw payload (e.g., for scope checking)
    before the user-level blocklist check.
    """
    return verify_token(token)


# ======================
# PASSWORD FUNCTIONS
# ======================


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        logger.error("Password verification failed due to hashing error")
        return False


def get_password_hash(password: str) -> str:
    """Hash a password using Argon2."""
    try:
        return pwd_context.hash(password)
    except Exception:
        logger.error("Argon2 hashing failed, attempting fallback")
        try:
            from passlib.hash import pbkdf2_sha256

            return pbkdf2_sha256.hash(password)
        except Exception:
            logger.error("All hashing methods failed")
            raise ValueError("Failed to hash password")


# ======================
# PASSWORD COMPLEXITY
# ======================


def validate_password_complexity(password: str) -> Optional[str]:
    """
    Validate password meets complexity requirements.
    Returns None if valid, or an error message string if invalid.
    """
    if len(password) < 8:
        return "Password must be at least 8 characters long"
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter"
    if not re.search(r"[0-9]", password):
        return "Password must contain at least one digit"
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?`~]', password):
        return "Password must contain at least one special character (!@#$%^&*...)"
    return None


# ======================
# JWT TOKEN FUNCTIONS (PyJWT)
# ======================


def create_access_token(
    data: Dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT access token with custom data."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update(
        {
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "access",
        }
    )
    return pyjwt.encode(to_encode, _get_signing_key(), algorithm=ALGORITHM)


def create_refresh_token(
    data: Dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT refresh token with custom data."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode.update(
        {
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "refresh",
        }
    )
    return pyjwt.encode(to_encode, _get_signing_key(), algorithm=ALGORITHM)


def create_access_token_for_user(
    user_id: int,
    scope: Optional[str] = None,
    session_id: Optional[str] = None,
    actor: Optional[dict] = None,
    role: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
    fingerprint: Optional[str] = None,
    fpt: Optional[str] = None,
) -> str:
    """Create access token with configured expiration and optional device fingerprint binding."""
    payload: Dict[str, Any] = {"sub": str(user_id)}
    if scope:
        payload["scope"] = scope
    if session_id:
        payload["session_id"] = session_id
    if actor:
        payload["actor"] = actor
    if role:
        payload["role"] = role
    fpt_claim = fpt or (
        hashlib.sha256(fingerprint.strip().encode()).hexdigest()
        if fingerprint
        else None
    )
    if fpt_claim:
        payload["fpt"] = fpt_claim
    delta = expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return create_access_token(payload, delta)


def create_refresh_token_for_user(
    user_id: int,
    scope: Optional[str] = None,
    fingerprint: Optional[str] = None,
    fpt: Optional[str] = None,
) -> str:
    """Create refresh token with configured expiration and optional device fingerprint binding."""
    payload: Dict[str, Any] = {"sub": str(user_id)}
    if scope:
        payload["scope"] = scope
    fpt_claim = fpt or (
        hashlib.sha256(fingerprint.strip().encode()).hexdigest()
        if fingerprint
        else None
    )
    if fpt_claim:
        payload["fpt"] = fpt_claim
    expires_delta = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return create_refresh_token(payload, expires_delta)


def create_step_up_token(
    user_id: int,
    auth_method: str = "totp",
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a short-lived signed JWT step-up token for high-risk operations."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=5)
    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "step_up",
        "auth_method": auth_method,
    }
    return pyjwt.encode(to_encode, _get_signing_key(), algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode JWT token.

    Supports algorithm rotation:
    - Primary: current configured algorithm (e.g. RS256).
    - Fallback: HS256 (shared secret) — allows tokens signed *before* an
      HS256→RS256 migration to remain valid until they expire naturally.
    """
    try:
        # Check local blocklist first (sync, fast path)
        if is_token_blocklisted_locally(token):
            return None

        # Build ordered list of (key, [algorithms]) pairs to try.
        verifiers = []

        # 1. Primary: configured algorithm and its key
        verifiers.append((_get_verifying_key(), [ALGORITHM]))

        # 2. Fallback: if configured algorithm is asymmetric (RS256/ES256),
        #    also try HS256 with the shared secret for tokens signed before migration.
        if ALGORITHM.startswith(("RS", "ES")):
            verifiers.append((SECRET_KEY, ["HS256"]))

        for key, algs in verifiers:
            try:
                payload = pyjwt.decode(token, key, algorithms=algs)
                return payload
            except pyjwt.InvalidTokenError:
                continue  # try next key/algorithm

        return None
    except pyjwt.ExpiredSignatureError:
        return None
    except pyjwt.InvalidTokenError:
        return None


# ======================
# SESSION COOKIE (for Edge middleware)
# ======================


def create_session_cookie(
    user_id: int,
    role: Optional[str] = None,
    fingerprint: Optional[str] = None,
    fpt: Optional[str] = None,
) -> Optional[str]:
    """
    Create a lightweight JWT for the podacium_session cookie.
    Used by the Next.js Edge middleware (middleware.ts) to verify
    authentication AND role at the edge without exposing the full access token.

    Carries the user's role so the Edge middleware can enforce route-level
    RBAC (e.g. /admin) without trusting any client-side cookie. Signed with
    a dedicated secret. Returns None if EDGE_AUTH_SECRET is not configured.
    """
    edge_secret = _get_edge_secret()
    if not edge_secret:
        return None

    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    payload: Dict[str, Any] = {
        "sub": str(user_id),
        "type": "session",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    if role:
        payload["role"] = role
    fpt_claim = fpt or (
        hashlib.sha256(fingerprint.strip().encode()).hexdigest()
        if fingerprint
        else None
    )
    if fpt_claim:
        payload["fpt"] = fpt_claim
    return pyjwt.encode(payload, edge_secret, algorithm="HS256")


EDGE_SESSION_COOKIE_NAME = "podacium_session"
EDGE_SESSION_MAX_AGE = 60 * 60  # 1 hour


def _get_edge_secret() -> Optional[str]:
    """Return the EDGE_AUTH_SECRET, falling back to SECRET_KEY if not set."""
    if setting.EDGE_AUTH_SECRET:
        return setting.EDGE_AUTH_SECRET
    # Fallback: derive from SECRET_KEY so the session cookie still works even
    # when EDGE_AUTH_SECRET hasn't been explicitly configured.
    # This is safe because SECRET_KEY is already a high-entropy secret.
    if setting.SECRET_KEY:
        return hashlib.sha256(setting.SECRET_KEY.encode()).hexdigest()[:32]
    return None


def set_session_cookie(
    response,
    user_id: int,
    role: Optional[str] = None,
    fingerprint: Optional[str] = None,
    fpt: Optional[str] = None,
) -> None:
    """
    Set the podacium_session cookie on a FastAPI response.
    The cookie is set on the parent domain (.podacium.com) so it is
    readable by the frontend domain's Edge middleware. The value is a
    signed JWT, not a plain flag — forgery-resistant.
    """
    token = create_session_cookie(user_id, role=role, fingerprint=fingerprint, fpt=fpt)
    if not token:
        return

    from app.core.config import setting as _cfg

    kwargs = dict(
        key=EDGE_SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=setting.ENVIRONMENT == "production",
        samesite="lax",
        max_age=EDGE_SESSION_MAX_AGE,
        path="/",
    )
    # Only set domain when configured — on localhost with empty domain,
    # setting domain="" would break the cookie in some browsers.
    if _cfg.COOKIE_DOMAIN:
        kwargs["domain"] = _cfg.COOKIE_DOMAIN

    response.set_cookie(**kwargs)

    # Publish the raw device fingerprint on the parent domain as well. The
    # client writes this cookie too, but only after its async FingerprintJS
    # lookup resolves — which can be after the post-login redirect. Setting it
    # here guarantees every navigation made with the freshly issued session
    # carries the fingerprint, so the Edge middleware can verify the `fpt`
    # claim instead of downgrading the session to unverified (which would
    # bounce role-gated routes such as /admin back to /auth/login).
    if fingerprint:
        fingerprint_kwargs = dict(
            key="x-fingerprint",
            value=fingerprint,
            httponly=False,  # Read by the API client / Edge-adjacent JS
            secure=setting.ENVIRONMENT == "production",
            samesite="lax",
            max_age=EDGE_SESSION_MAX_AGE,
            path="/",
        )
        if _cfg.COOKIE_DOMAIN:
            fingerprint_kwargs["domain"] = _cfg.COOKIE_DOMAIN
        response.set_cookie(**fingerprint_kwargs)


def clear_session_cookie(response) -> None:
    """Clear the podacium_session cookie on logout."""
    from app.core.config import setting as _cfg

    kwargs = dict(
        key=EDGE_SESSION_COOKIE_NAME,
        path="/",
        secure=setting.ENVIRONMENT == "production",
        samesite="lax",
    )
    if _cfg.COOKIE_DOMAIN:
        kwargs["domain"] = _cfg.COOKIE_DOMAIN

    response.delete_cookie(**kwargs)


# ======================
# VERIFICATION TOKEN FUNCTIONS
# ======================


def generate_verification_token(length: int = 32) -> str:
    """Generate a secure random verification token."""
    alphabet = string.ascii_letters + string.digits + "-_"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_numeric_verification_code(length: int = 6) -> str:
    """Generate a numeric verification code for SMS/phone verification."""
    return "".join(secrets.choice(string.digits) for _ in range(length))


def generate_secure_token() -> str:
    """Generate a secure token for various verification purposes."""
    return secrets.token_urlsafe(32)


def create_email_verification_token(email: str, user_id: int) -> str:
    """Create a JWT token specifically for email verification."""
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    payload = {
        "sub": str(user_id),
        "email": email,
        "type": "email_verification",
        "exp": expire,
    }
    return pyjwt.encode(payload, _get_signing_key(), algorithm=ALGORITHM)


def create_password_reset_token(user_id: int) -> str:
    """Create a JWT token specifically for password reset (1 hour expiry)."""
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    payload = {
        "sub": str(user_id),
        "type": "password_reset",
        "exp": expire,
    }
    return pyjwt.encode(payload, _get_signing_key(), algorithm=ALGORITHM)


def verify_email_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode email verification token."""
    try:
        payload = pyjwt.decode(token, _get_verifying_key(), algorithms=[ALGORITHM])
        if payload.get("type") != "email_verification":
            return None
        return payload
    except pyjwt.InvalidTokenError:
        return None


def verify_password_reset_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode password reset token."""
    try:
        payload = pyjwt.decode(token, _get_verifying_key(), algorithms=[ALGORITHM])
        if payload.get("type") != "password_reset":
            return None
        return payload
    except pyjwt.InvalidTokenError:
        return None


def is_token_secure(token: str, min_length: int = 16) -> bool:
    """Check if a token meets basic security requirements."""
    if not token or len(token) < min_length:
        return False
    if len(set(token)) < min_length // 2:
        return False
    return True


def verify_step_up_token(
    token: str,
    expected_user_id: int,
    required_method: Optional[str] = None,
) -> bool:
    """Verify a signed RFC 9470 Step-Up JWT token for sensitive high-value operations."""
    if not token or not isinstance(token, str):
        return False
    try:
        payload = verify_token(token)
        if not payload:
            return False
        if payload.get("type") != "step_up":
            return False
        if str(payload.get("sub")) != str(expected_user_id):
            return False
        if required_method and payload.get("auth_method") != required_method:
            return False
        return True
    except Exception:
        return False


class CryptographicOperationError(RuntimeError, ValueError):
    """Raised when an envelope encryption or cryptographic operation fails."""

    pass


def encrypt_vault_secret(plain_text: Optional[str]) -> Optional[str]:
    """Encrypt sensitive OAuth tokens using AES-256-GCM at rest."""
    if not plain_text:
        return plain_text
    try:
        import base64
        import os
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        raw_key = hashlib.sha256(SECRET_KEY.encode()).digest()
        aesgcm = AESGCM(raw_key)
        nonce = os.urandom(12)
        ct = aesgcm.encrypt(nonce, plain_text.encode("utf-8"), None)
        return base64.b64encode(nonce + ct).decode("utf-8")
    except Exception as e:
        logger.error(f"Vault encryption failed: {e}")
        raise CryptographicOperationError("Envelope encryption operation failed") from e


def decrypt_vault_secret(cipher_text: Optional[str]) -> Optional[str]:
    """Decrypt sensitive OAuth tokens using AES-256-GCM."""
    if not cipher_text:
        return cipher_text
    try:
        import base64
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        raw_data = base64.b64decode(cipher_text.encode("utf-8"))
        if len(raw_data) < 13:
            raise CryptographicOperationError(
                "Envelope encryption operation failed: invalid payload length"
            )
        nonce = raw_data[:12]
        ct = raw_data[12:]
        raw_key = hashlib.sha256(SECRET_KEY.encode()).digest()
        aesgcm = AESGCM(raw_key)
        return aesgcm.decrypt(nonce, ct, None).decode("utf-8")
    except CryptographicOperationError:
        raise
    except Exception as e:
        logger.error(f"Vault decryption failed: {e}")
        raise CryptographicOperationError("Envelope encryption operation failed") from e


# Aliases for domain field-level encryption
encrypt_field = encrypt_vault_secret
decrypt_field = decrypt_vault_secret
