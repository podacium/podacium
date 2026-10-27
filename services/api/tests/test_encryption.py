from app.core.encryption import (
    get_fernet_key,
    encrypt_field,
    decrypt_field,
    mask_secret,
)


def test_fernet_key_derivation():
    """Test that get_fernet_key returns a valid 32-byte urlsafe base64 key."""
    key = get_fernet_key()
    assert isinstance(key, bytes)
    assert len(key) == 44  # Base64 encoding of 32 bytes is 44 characters


def test_encryption_decryption_roundtrip():
    """Test that a plaintext string encrypts and decrypts losslessly."""
    plaintext = "bunny_secret_api_key_123456789"
    ciphertext = encrypt_field(plaintext)
    assert ciphertext != plaintext
    assert len(ciphertext) > 0

    decrypted = decrypt_field(ciphertext)
    assert decrypted == plaintext


def test_decrypt_invalid_ciphertext_fallback():
    """Test that decrypt_field handles unencrypted legacy text without raising an error."""
    unencrypted = "plain_unencrypted_setting"
    result = decrypt_field(unencrypted)
    assert result == unencrypted


def test_mask_secret():
    """Test that mask_secret correctly masks secret keys for UI display."""
    assert mask_secret("abcdefghij1234") == "••••••••1234"
    assert mask_secret("short") == "••••••••hort"
    assert mask_secret("abc") == "•••"
    assert mask_secret("") == ""
