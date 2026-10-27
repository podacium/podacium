"""
Unit tests for Deliverables AES-256-GCM Envelope Encryption Service.
"""

import pytest
from app.services.envelope_encryption_service import EnvelopeEncryptionService


def test_encryption_decryption_roundtrip():
    service = EnvelopeEncryptionService(
        master_secret="test_super_secret_key_32_bytes_long_12345"
    )
    sample_deliverable = (
        b"Podacium Deliverable: High-Res Algerian Architectural Blueprint PDF Content"
    )

    envelope = service.encrypt_file_payload(
        plaintext=sample_deliverable,
        contract_id=101,
        milestone_id=1,
        filename="blueprint_final.pdf",
    )

    assert envelope.algorithm == "AES-256-GCM"
    assert envelope.file_size_bytes == len(sample_deliverable)
    assert envelope.wrapped_dek is not None

    # Decrypt with matching context
    decrypted = service.decrypt_file_payload(
        envelope=envelope,
        contract_id=101,
        milestone_id=1,
        filename="blueprint_final.pdf",
    )
    assert decrypted == sample_deliverable


def test_tampered_context_fails():
    service = EnvelopeEncryptionService(
        master_secret="test_super_secret_key_32_bytes_long_12345"
    )
    sample_deliverable = b"Source Code ZIP"

    envelope = service.encrypt_file_payload(
        plaintext=sample_deliverable,
        contract_id=101,
        milestone_id=1,
        filename="source.zip",
    )

    # Attempt decrypt with different contract ID (AAD mismatch)
    with pytest.raises(ValueError) as exc:
        service.decrypt_file_payload(
            envelope=envelope,
            contract_id=999,
            milestone_id=1,
            filename="source.zip",
        )
    assert "envelope_aad_mismatch" in str(exc.value)


def test_download_token_lifecycle():
    service = EnvelopeEncryptionService(
        master_secret="test_super_secret_key_32_bytes_long_12345"
    )

    token = service.generate_download_token(
        contract_id=10,
        milestone_id=2,
        user_id=42,
        ttl_minutes=15,
    )

    assert (
        service.verify_download_token(
            token=token,
            expected_contract_id=10,
            expected_milestone_id=2,
            expected_user_id=42,
        )
        is True
    )

    # Wrong user fails
    assert (
        service.verify_download_token(
            token=token,
            expected_contract_id=10,
            expected_milestone_id=2,
            expected_user_id=99,
        )
        is False
    )


def test_expired_download_token():
    service = EnvelopeEncryptionService(
        master_secret="test_super_secret_key_32_bytes_long_12345"
    )

    # Generate token with negative TTL (already expired)
    token = service.generate_download_token(
        contract_id=10,
        milestone_id=2,
        user_id=42,
        ttl_minutes=-5,
    )

    assert (
        service.verify_download_token(
            token=token,
            expected_contract_id=10,
            expected_milestone_id=2,
            expected_user_id=42,
        )
        is False
    )


def test_corrupted_ciphertext():
    import base64

    service = EnvelopeEncryptionService(
        master_secret="test_super_secret_key_32_bytes_long_12345"
    )
    sample_deliverable = b"Important Document"

    envelope = service.encrypt_file_payload(
        plaintext=sample_deliverable,
        contract_id=101,
        milestone_id=1,
        filename="doc.pdf",
    )

    # Corrupt the ciphertext bytes
    raw_ct = bytearray(base64.b64decode(envelope.ciphertext))
    raw_ct[0] ^= 0xFF
    envelope.ciphertext = base64.b64encode(raw_ct).decode("utf-8")

    with pytest.raises(ValueError) as exc:
        service.decrypt_file_payload(
            envelope=envelope,
            contract_id=101,
            milestone_id=1,
            filename="doc.pdf",
        )
    assert "ciphertext_corrupted_or_tampered" in str(exc.value)


def test_vault_encryption_fail_closed_on_corruption():
    """Verify encrypt_vault_secret and decrypt_vault_secret fail closed with CryptographicOperationError."""
    import base64
    from unittest.mock import patch
    from app.core.security import (
        encrypt_vault_secret,
        decrypt_vault_secret,
        encrypt_field,
        decrypt_field,
        CryptographicOperationError,
    )

    # 0. Aliases point to envelope encryption functions
    assert encrypt_field is encrypt_vault_secret
    assert decrypt_field is decrypt_vault_secret

    # 1. Successful round-trip
    secret = "ghp_secure_oauth_token_9876543210"
    encrypted = encrypt_vault_secret(secret)
    assert encrypted is not None
    assert encrypted != secret
    decrypted = decrypt_vault_secret(encrypted)
    assert decrypted == secret

    # Round-trip via encrypt_field / decrypt_field aliases
    field_encrypted = encrypt_field(secret)
    assert field_encrypted is not None
    assert decrypt_field(field_encrypted) == secret

    # 2. Corrupted ciphertext raises CryptographicOperationError (NEVER returns cleartext/ciphertext)
    raw = bytearray(base64.b64decode(encrypted.encode("utf-8")))
    raw[-1] ^= 0xFF
    corrupted_b64 = base64.b64encode(raw).decode("utf-8")
    with pytest.raises(CryptographicOperationError):
        decrypt_vault_secret(corrupted_b64)
    with pytest.raises(CryptographicOperationError):
        decrypt_field(corrupted_b64)

    # 3. Truncated ciphertext (<13 bytes) raises CryptographicOperationError
    short_b64 = base64.b64encode(b"short").decode("utf-8")
    with pytest.raises(CryptographicOperationError):
        decrypt_vault_secret(short_b64)
    with pytest.raises(CryptographicOperationError):
        decrypt_field(short_b64)

    # 4. Invalid base64 raises CryptographicOperationError
    with pytest.raises(CryptographicOperationError):
        decrypt_vault_secret("!!!not_base64!!!")
    with pytest.raises(CryptographicOperationError):
        decrypt_field("!!!not_base64!!!")

    # 5. Encryption failure raises CryptographicOperationError
    with patch(
        "cryptography.hazmat.primitives.ciphers.aead.AESGCM.encrypt",
        side_effect=RuntimeError("Hardware failure"),
    ):
        with pytest.raises(CryptographicOperationError):
            encrypt_vault_secret("should_fail_and_never_store_cleartext")
        with pytest.raises(CryptographicOperationError):
            encrypt_field("should_fail_and_never_store_cleartext")


def test_key_ring_versioning_and_seamless_rotation():
    """Verify master key ring versioning, historical key resolution, and DEK rewrapping."""
    from app.services.envelope_encryption_service import (
        EnvelopeEncryptionService,
    )
    from app.core.security import CryptographicOperationError

    secret_v1 = "master_key_secret_version_1_32_bytes_long"
    secret_v2 = "master_key_secret_version_2_32_bytes_long"

    # Service with primary v1
    service_v1 = EnvelopeEncryptionService(master_secret=secret_v1, kek_id="v1")
    payload = b"Top secret Algerian fintech IP deliverables"

    envelope_v1 = service_v1.encrypt_file_payload(
        plaintext=payload,
        contract_id=42,
        milestone_id=7,
        filename="fintech_core.zip",
    )
    assert envelope_v1.kek_id == "v1"

    # Rotated service with primary v2 and v1 in key ring
    service_v2 = EnvelopeEncryptionService(
        master_secret=secret_v2,
        kek_id="v2",
        key_ring={"v1": secret_v1},
    )

    # Service v2 can decrypt v1 envelope seamlessly via key ring
    decrypted_by_v2 = service_v2.decrypt_file_payload(
        envelope=envelope_v1,
        contract_id=42,
        milestone_id=7,
        filename="fintech_core.zip",
    )
    assert decrypted_by_v2 == payload

    # Re-wrap envelope to v2 without decrypting data payload
    envelope_v2 = service_v2.rewrap_envelope(envelope_v1, new_kek_id="v2")
    assert envelope_v2.kek_id == "v2"
    assert envelope_v2.ciphertext == envelope_v1.ciphertext  # Ciphertext untouched!

    # Decrypt re-wrapped envelope
    decrypted_rewrapped = service_v2.decrypt_file_payload(
        envelope=envelope_v2,
        contract_id=42,
        milestone_id=7,
        filename="fintech_core.zip",
    )
    assert decrypted_rewrapped == payload

    # Service without v1 in key ring fails to decrypt v1 envelope
    service_isolated_v2 = EnvelopeEncryptionService(
        master_secret=secret_v2, kek_id="v2"
    )
    with pytest.raises(CryptographicOperationError):
        service_isolated_v2.decrypt_file_payload(
            envelope=envelope_v1,
            contract_id=42,
            milestone_id=7,
            filename="fintech_core.zip",
        )
