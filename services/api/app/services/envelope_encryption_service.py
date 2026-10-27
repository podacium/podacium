"""
Deliverables Vault & Envelope Encryption Service.

Implements military-grade AES-256-GCM envelope encryption for project submissions
and sensitive contract deliverables before resting on disk / S3.

Architecture:
1. Master KEK (Key Encryption Key): Derived via HKDF-SHA256 from application SECRET_KEY.
2. Per-Deliverable DEK (Data Encryption Key): 256-bit random key generated via os.urandom(32).
3. Encryption: AES-256-GCM with 96-bit random IV (nonce) and Authenticated Additional Data (AAD)
   binding the Contract ID, Milestone ID, and File Metadata.
4. DEK Wrapping: DEK is encrypted using AES Key Wrap (RFC 3394) with the Master KEK.
5. Delivery Token: HMAC-SHA256 signed time-limited token for authorized download post-PV de Réception.
"""

import os
import base64
import hmac
import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from pydantic import BaseModel

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.keywrap import aes_key_wrap, aes_key_unwrap

from app.core.config import setting
from app.core.security import CryptographicOperationError

logger = logging.getLogger(__name__)


class EncryptedEnvelope(BaseModel):
    version: str = "1.0"
    algorithm: str = "AES-256-GCM"
    kek_id: str = "v1"
    wrapped_dek: str  # Base64 encoded wrapped DEK
    iv: str  # Base64 encoded 12-byte IV (nonce)
    ciphertext: str  # Base64 encoded ciphertext (including GCM auth tag)
    aad: str  # Context string bound to encryption
    file_size_bytes: int
    sha256_checksum: str


class EnvelopeEncryptionService:
    """AES-256-GCM Envelope Encryption Engine."""

    def __init__(
        self,
        master_secret: Optional[str] = None,
        kek_id: str = "v1",
        key_ring: Optional[dict[str, str | bytes]] = None,
    ):
        self.kek_id = kek_id
        self._secret = (master_secret or setting.SECRET_KEY).encode("utf-8")
        self._key_ring: dict[str, bytes] = {}
        if key_ring:
            for kid, sec in key_ring.items():
                sec_bytes = sec.encode("utf-8") if isinstance(sec, str) else sec
                self._key_ring[kid] = self._derive_master_kek(sec_bytes, kid)
        self._master_kek = self._derive_master_kek(self._secret, kek_id)
        self._key_ring[kek_id] = self._master_kek

    def register_kek(self, kek_id: str, secret: str | bytes) -> None:
        """Register an additional key version in the key ring for seamless rotation."""
        sec_bytes = secret.encode("utf-8") if isinstance(secret, str) else sec
        self._key_ring[kek_id] = self._derive_master_kek(sec_bytes, kek_id)

    def _get_kek(self, kek_id: Optional[str] = None) -> bytes:
        """Retrieve KEK by version ID from key ring, falling back to current master KEK."""
        if not kek_id:
            return self._master_kek
        return self._key_ring.get(kek_id, self._master_kek)

    @staticmethod
    def _derive_master_kek(secret_bytes: bytes, kek_id: str = "v1") -> bytes:
        """Derive a 256-bit Master Key Encryption Key using HKDF-SHA256."""
        info = (
            b"podacium_master_kek_derivation"
            if kek_id == "v1"
            else f"podacium_master_kek_derivation_{kek_id}".encode("utf-8")
        )
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"podacium_envelope_encryption_v1_salt",
            info=info,
        )
        return hkdf.derive(secret_bytes)

    def encrypt_file_payload(
        self,
        plaintext: bytes,
        contract_id: int,
        milestone_id: int,
        filename: str,
    ) -> EncryptedEnvelope:
        """
        Encrypts deliverable bytes using a unique per-file DEK and wraps the DEK with Master KEK.
        """
        # 1. Compute SHA256 of original plaintext for integrity verification
        plaintext_hash = hashlib.sha256(plaintext).hexdigest()

        # 2. Generate random 256-bit DEK & 96-bit Nonce
        dek = os.urandom(32)
        iv = os.urandom(12)

        # 3. Formulate Associated Authenticated Data (AAD)
        aad = f"podacium:contract:{contract_id}:milestone:{milestone_id}:filename:{filename}"
        aad_bytes = aad.encode("utf-8")

        # 4. Encrypt with AES-256-GCM
        aesgcm = AESGCM(dek)
        ciphertext = aesgcm.encrypt(iv, plaintext, aad_bytes)

        # 5. Wrap DEK with Master KEK using RFC 3394 AES Key Wrap
        wrapped_dek = aes_key_wrap(self._master_kek, dek)

        return EncryptedEnvelope(
            version="1.0",
            algorithm="AES-256-GCM",
            kek_id=self.kek_id,
            wrapped_dek=base64.b64encode(wrapped_dek).decode("utf-8"),
            iv=base64.b64encode(iv).decode("utf-8"),
            ciphertext=base64.b64encode(ciphertext).decode("utf-8"),
            aad=aad,
            file_size_bytes=len(plaintext),
            sha256_checksum=plaintext_hash,
        )

    def decrypt_file_payload(
        self,
        envelope: EncryptedEnvelope,
        contract_id: int,
        milestone_id: int,
        filename: str,
    ) -> bytes:
        """
        Unwraps DEK and decrypts deliverable ciphertext, ensuring AAD matches.
        """
        expected_aad = f"podacium:contract:{contract_id}:milestone:{milestone_id}:filename:{filename}"
        if envelope.aad != expected_aad:
            raise CryptographicOperationError("errors.security.envelope_aad_mismatch")

        # 1. Unwrap DEK using Master KEK
        wrapped_dek = base64.b64decode(envelope.wrapped_dek)
        try:
            kek = self._get_kek(envelope.kek_id)
            dek = aes_key_unwrap(kek, wrapped_dek)
        except Exception as e:
            logger.error(f"Failed to unwrap DEK: {e}")
            raise CryptographicOperationError(
                "errors.security.invalid_encryption_key"
            ) from e

        # 2. Decrypt ciphertext with AES-256-GCM
        iv = base64.b64decode(envelope.iv)
        ciphertext = base64.b64decode(envelope.ciphertext)
        aad_bytes = envelope.aad.encode("utf-8")

        aesgcm = AESGCM(dek)
        try:
            plaintext = aesgcm.decrypt(iv, ciphertext, aad_bytes)
        except Exception as e:
            logger.error(f"AES-GCM decryption / tag verification failed: {e}")
            raise CryptographicOperationError(
                "errors.security.ciphertext_corrupted_or_tampered"
            ) from e

        # 3. Verify SHA256 integrity using constant-time comparison
        computed_checksum = hashlib.sha256(plaintext).hexdigest()
        if not hmac.compare_digest(computed_checksum, envelope.sha256_checksum):
            raise CryptographicOperationError("errors.security.checksum_mismatch")

        return plaintext

    def rewrap_envelope(
        self,
        envelope: EncryptedEnvelope,
        new_kek_id: Optional[str] = None,
    ) -> EncryptedEnvelope:
        """Re-wraps an envelope's DEK with target KEK without decrypting the payload."""
        wrapped_dek = base64.b64decode(envelope.wrapped_dek)
        old_kek = self._get_kek(envelope.kek_id)
        try:
            dek = aes_key_unwrap(old_kek, wrapped_dek)
        except Exception as e:
            logger.error(f"Failed to unwrap DEK during re-wrapping: {e}")
            raise CryptographicOperationError(
                "errors.security.invalid_encryption_key"
            ) from e

        target_kek_id = new_kek_id or self.kek_id
        target_kek = self._get_kek(target_kek_id)
        new_wrapped_dek = aes_key_wrap(target_kek, dek)

        return envelope.model_copy(
            update={
                "kek_id": target_kek_id,
                "wrapped_dek": base64.b64encode(new_wrapped_dek).decode("utf-8"),
            }
        )

    def generate_download_token(
        self,
        contract_id: int,
        milestone_id: int,
        user_id: int,
        ttl_minutes: int = 60,
    ) -> str:
        """Generate a signed time-limited token for downloading unlocked deliverables."""
        expires_at = int(
            (datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)).timestamp()
        )
        payload = {
            "contract_id": contract_id,
            "milestone_id": milestone_id,
            "user_id": user_id,
            "exp": expires_at,
        }
        raw_json = json.dumps(payload, sort_keys=True)
        sig = hmac.new(
            self._secret, raw_json.encode("utf-8"), hashlib.sha256
        ).hexdigest()
        token_data = {
            "payload": payload,
            "signature": sig,
        }
        return base64.urlsafe_b64encode(json.dumps(token_data).encode("utf-8")).decode(
            "utf-8"
        )

    def verify_download_token(
        self,
        token: str,
        expected_contract_id: int,
        expected_milestone_id: int,
        expected_user_id: int,
    ) -> bool:
        """Verify time-limited download token signature and expiry."""
        try:
            decoded = json.loads(
                base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
            )
            payload = decoded.get("payload", {})
            signature = decoded.get("signature", "")

            # Verify signature
            raw_json = json.dumps(payload, sort_keys=True)
            expected_sig = hmac.new(
                self._secret, raw_json.encode("utf-8"), hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(signature, expected_sig):
                return False

            # Check expiration
            if payload.get("exp", 0) < int(datetime.now(timezone.utc).timestamp()):
                return False

            # Check scope
            if payload.get("contract_id") != expected_contract_id:
                return False
            if payload.get("milestone_id") != expected_milestone_id:
                return False
            if payload.get("user_id") != expected_user_id:
                return False

            return True
        except Exception as e:
            logger.debug(f"Token verification failed: {e}")
            return False

    def encrypt_mail_credentials(
        self,
        password: str,
        account_id: str,
        email: str,
    ) -> str:
        """
        Encrypts mail account credentials (IMAP/SMTP password or token)
        using AES-256-GCM envelope encryption bound to account_id and email AAD.
        Returns a compact JSON-serialized string.
        """
        dek = os.urandom(32)
        iv = os.urandom(12)
        aad = f"podacium:mail_account:{account_id}:{email}".encode("utf-8")
        plaintext = password.encode("utf-8")

        aesgcm = AESGCM(dek)
        ciphertext = aesgcm.encrypt(iv, plaintext, aad)
        wrapped_dek = aes_key_wrap(self._master_kek, dek)

        envelope_data = {
            "v": "1.0",
            "kek_id": self.kek_id,
            "w": base64.b64encode(wrapped_dek).decode("utf-8"),
            "iv": base64.b64encode(iv).decode("utf-8"),
            "ct": base64.b64encode(ciphertext).decode("utf-8"),
        }
        return json.dumps(envelope_data, separators=(",", ":"))

    def decrypt_mail_credentials(
        self,
        encrypted_blob: str,
        account_id: str,
        email: str,
    ) -> str:
        """
        Decrypts mail account credentials, verifying authenticity against account_id and email.
        """
        try:
            data = json.loads(encrypted_blob)
            wrapped_dek = base64.b64decode(data["w"])
            iv = base64.b64decode(data["iv"])
            ciphertext = base64.b64decode(data["ct"])
            aad = f"podacium:mail_account:{account_id}:{email}".encode("utf-8")

            kek = self._get_kek(data.get("kek_id", "v1"))
            dek = aes_key_unwrap(kek, wrapped_dek)
            aesgcm = AESGCM(dek)
            plaintext = aesgcm.decrypt(iv, ciphertext, aad)
            return plaintext.decode("utf-8")
        except Exception as e:
            logger.error(f"Failed to decrypt mail credentials: {e}")
            raise CryptographicOperationError(
                "errors.security.mail_credentials_decryption_failed"
            ) from e

    def encrypt_credentials_triplet(
        self,
        password: str,
        account_id: str,
        email: str,
    ) -> Tuple[str, str, str]:
        """
        Encrypts password returning (ciphertext_b64, dek_wrapped_b64, iv_b64)
        matching the MailAccount database columns.
        """
        dek = os.urandom(32)
        iv = os.urandom(12)
        aad = f"podacium:mail_account:{account_id}:{email}".encode("utf-8")
        plaintext = password.encode("utf-8")

        aesgcm = AESGCM(dek)
        ciphertext = aesgcm.encrypt(iv, plaintext, aad)
        wrapped_dek = aes_key_wrap(self._master_kek, dek)

        return (
            base64.b64encode(ciphertext).decode("utf-8"),
            base64.b64encode(wrapped_dek).decode("utf-8"),
            base64.b64encode(iv).decode("utf-8"),
        )

    def decrypt_credentials_triplet(
        self,
        ciphertext_b64: str,
        dek_wrapped_b64: str,
        iv_b64: str,
        account_id: str,
        email: str,
    ) -> str:
        """
        Decrypts password from (ciphertext_b64, dek_wrapped_b64, iv_b64)
        verifying AAD against account_id and email.
        """
        try:
            wrapped_dek = base64.b64decode(dek_wrapped_b64)
            iv = base64.b64decode(iv_b64)
            ciphertext = base64.b64decode(ciphertext_b64)
            aad = f"podacium:mail_account:{account_id}:{email}".encode("utf-8")

            dek = aes_key_unwrap(self._master_kek, wrapped_dek)
            aesgcm = AESGCM(dek)
            plaintext = aesgcm.decrypt(iv, ciphertext, aad)
            return plaintext.decode("utf-8")
        except Exception as e:
            logger.error(f"Failed to decrypt credentials triplet: {e}")
            raise CryptographicOperationError(
                "errors.security.mail_credentials_decryption_failed"
            ) from e


envelope_encryption_service = EnvelopeEncryptionService()
