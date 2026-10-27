# services/api/app/core/encryption.py
"""
Fernet AES-128-CBC + HMAC-SHA256 Authenticated Encryption for System Settings.
Enforces secret masking and MultiFernet key rotation.
"""

import os
import base64
import logging
from cryptography.fernet import Fernet, MultiFernet
from app.core.config import setting

logger = logging.getLogger(__name__)


def get_fernet_key() -> bytes:
    """Derive 32-byte URL-safe base64 key from platform SECRET_KEY or ENCRYPTION_SECRET_KEY."""
    raw_key = os.getenv("ENCRYPTION_SECRET_KEY", setting.SECRET_KEY)
    # Pads or truncates to 32 bytes and encodes as urlsafe base64
    padded_key = raw_key.zfill(32)[:32].encode("utf-8")
    return base64.urlsafe_b64encode(padded_key)


def encrypt_field(plaintext: str) -> str:
    """Encrypt plaintext string using Fernet AES-128-CBC + HMAC-SHA256."""
    if not plaintext:
        return ""
    try:
        f = Fernet(get_fernet_key())
        return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")
    except Exception as err:
        logger.error(f"Fernet encryption error: {err}")
        from app.core.security import CryptographicOperationError

        raise CryptographicOperationError("Fernet encryption failed") from err


def decrypt_field(ciphertext: str) -> str:
    """Decrypt Fernet ciphertext. Falls back to plaintext for legacy unencrypted settings."""
    if not ciphertext:
        return ""
    try:
        f = Fernet(get_fernet_key())
        return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except Exception:
        # Graceful fallback if value was stored in unencrypted plaintext
        return ciphertext


def mask_secret(val: str) -> str:
    """Mask secret key showing only last 4 characters preceded by an 8-bullet sequence."""
    if not val:
        return ""
    if len(val) <= 4:
        return "•" * len(val)
    return f"••••••••{val[-4:]}"


def rotate_setting_ciphertext(
    current_ciphertext: str, fallback_keys: list[bytes]
) -> str:
    """Rotates ciphertext to primary key using MultiFernet."""
    if not current_ciphertext:
        return ""
    keys = [Fernet(get_fernet_key())] + [Fernet(k) for k in fallback_keys]
    multi_f = MultiFernet(keys)
    return multi_f.rotate(current_ciphertext.encode("utf-8")).decode("utf-8")
