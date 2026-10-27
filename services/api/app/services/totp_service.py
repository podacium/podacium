"""
TOTP (Time-based One-Time Password) 2FA Service.

Implements RFC 6238 TOTP for two-factor authentication:
- Generate TOTP secret for user enrollment
- Verify TOTP codes during login
- Generate backup codes for account recovery
- TOTP secrets are encrypted at rest using Fernet (AES-128-CBC + HMAC-SHA256)
"""
import logging
import secrets
import string
from typing import Optional, List, Tuple

import pyotp

from app.core.prisma import prisma
from app.core.security import get_password_hash, verify_password
from app.core.encryption import encrypt_field, decrypt_field

logger = logging.getLogger(__name__)

APP_NAME = "Podacium"
BACKUP_CODE_COUNT = 10
BACKUP_CODE_LENGTH = 8


class TOTPService:
    """Service for managing TOTP-based two-factor authentication."""

    def generate_secret(self) -> str:
        """Generate a new TOTP secret for a user."""
        return pyotp.random_base32()

    def get_provisioning_uri(self, secret: str, email: str) -> str:
        """Generate the otpauth:// URI for QR code scanning."""
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(name=email, issuer_name=APP_NAME)

    def verify_code(self, secret: str, code: str) -> bool:
        """
        Verify a TOTP code against the secret.
        Allows a 30-second window tolerance (valid_window=1).
        """
        if not secret or not code:
            return False
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)

    def generate_backup_codes(self) -> List[str]:
        """Generate a set of single-use backup codes."""
        codes = []
        for _ in range(BACKUP_CODE_COUNT):
            code = "".join(
                secrets.choice(string.ascii_uppercase + string.digits)
                for _ in range(BACKUP_CODE_LENGTH)
            )
            # Format as XXXX-XXXX for readability
            formatted = f"{code[:4]}-{code[4:]}"
            codes.append(formatted)
        return codes

    async def enable_2fa(self, user_id: int, secret: str, verification_code: str) -> Optional[List[str]]:
        """
        Enable 2FA for a user after verifying their first code.
        Returns backup codes on success, None on failure.
        TOTP secret is encrypted at rest.
        """
        # Verify the code first to ensure the user has set up their authenticator correctly
        if not self.verify_code(secret, verification_code):
            logger.warning(f"2FA enable failed: invalid code for user {user_id}")
            return None

        # Generate backup codes
        backup_codes = self.generate_backup_codes()
        # Hash backup codes for storage
        hashed_codes = [get_password_hash(code.replace("-", "")) for code in backup_codes]

        # Encrypt the TOTP secret before storing
        encrypted_secret = encrypt_field(secret)

        # Store in database
        try:
            await prisma.securitysettings.upsert(
                where={"userId": user_id},
                data={"create": {
                    "userId": user_id,
                    "twoFactorEnabled": True,
                    "twoFactorSecret": encrypted_secret,
                    "backupCodes": hashed_codes,
                }, "update": {
                    "twoFactorEnabled": True,
                    "twoFactorSecret": encrypted_secret,
                    "backupCodes": hashed_codes,
                }},
            )
            logger.info(f"2FA enabled for user {user_id}")
            return backup_codes
        except Exception as e:
            logger.error(f"Failed to enable 2FA for user {user_id}: {e}")
            return None

    async def disable_2fa(self, user_id: int, password: str, user_password_hash: str) -> bool:
        """Disable 2FA for a user (requires password confirmation)."""
        if not verify_password(password, user_password_hash):
            return False

        try:
            await prisma.securitysettings.update(
                where={"userId": user_id},
                data={
                    "twoFactorEnabled": False,
                    "twoFactorSecret": None,
                    "backupCodes": [],
                },
            )
            logger.info(f"2FA disabled for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to disable 2FA for user {user_id}: {e}")
            return False

    async def verify_2fa(self, user_id: int, code: str) -> bool:
        """
        Verify a 2FA code for login.
        Checks TOTP code first, then backup codes.
        Decrypts the TOTP secret from storage before verification.
        """
        try:
            settings = await prisma.securitysettings.find_unique(
                where={"userId": user_id}
            )
            if not settings or not settings.twoFactorEnabled or not settings.twoFactorSecret:
                return False

            # Decrypt the TOTP secret
            decrypted_secret = decrypt_field(settings.twoFactorSecret)

            # Try TOTP code first
            if self.verify_code(decrypted_secret, code):
                return True

            # Try backup codes (single-use)
            clean_code = code.replace("-", "").upper()
            if settings.backupCodes:
                for i, hashed_code in enumerate(settings.backupCodes):
                    if verify_password(clean_code, hashed_code):
                        # Remove used backup code
                        remaining_codes = settings.backupCodes.copy()
                        remaining_codes.pop(i)
                        await prisma.securitysettings.update(
                            where={"userId": user_id},
                            data={"backupCodes": remaining_codes},
                        )
                        logger.info(f"Backup code used for user {user_id} ({len(remaining_codes)} remaining)")
                        return True

            return False
        except Exception as e:
            logger.error(f"2FA verification error for user {user_id}: {e}")
            return False

    async def is_2fa_enabled(self, user_id: int) -> bool:
        """Check if 2FA is enabled for a user."""
        try:
            settings = await prisma.securitysettings.find_unique(
                where={"userId": user_id}
            )
            return bool(settings and settings.twoFactorEnabled)
        except Exception:
            return False

    async def get_setup_data(self, user_id: int, email: str) -> Tuple[str, str]:
        """
        Generate setup data for 2FA enrollment.
        Returns (secret, provisioning_uri).
        """
        secret = self.generate_secret()
        uri = self.get_provisioning_uri(secret, email)
        return secret, uri


# Singleton
totp_service = TOTPService()
