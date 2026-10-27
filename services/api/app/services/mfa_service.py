"""MFA Orchestration Service.

Routes 2FA challenge verification to the appropriate method handler.
Provides a unified interface for checking enabled methods and
verifying codes across TOTP, Email OTP, WebAuthn, and Backup Codes.
"""

import json
import logging
from typing import Any

from app.core.prisma import prisma

logger = logging.getLogger(__name__)


class MFAService:
    """Orchestrate MFA methods."""

    @staticmethod
    async def get_enabled_methods(user_id: int) -> list[dict]:
        """Return list of enabled 2FA methods with their status."""
        settings = await prisma.securitysettings.find_unique(
            where={"userId": user_id},
        )
        if not settings:
            return []

        methods = []
        if settings.twoFactorEnabled:
            methods.append(
                {"method": "totp", "enabled": True, "label": "Authenticator App"}
            )
        if settings.emailOtpVerified:
            methods.append({"method": "email", "enabled": True, "label": "Email OTP"})
        if settings.webauthnEnabled:
            methods.append({"method": "webauthn", "enabled": True, "label": "Passkey"})
        return methods

    @staticmethod
    async def is_mfa_required(user_id: int) -> bool:
        """Check if user has any 2FA method enabled."""
        settings = await prisma.securitysettings.find_unique(
            where={"userId": user_id},
        )
        if not settings:
            return False
        return (
            settings.twoFactorEnabled
            or settings.emailOtpVerified
            or settings.webauthnEnabled
        )

    @staticmethod
    async def verify_challenge(user_id: int, method: str, code: Any) -> bool:
        """Route the verification to the appropriate service."""
        if method == "totp":
            from app.services.totp_service import totp_service

            return await totp_service.verify_2fa(user_id, str(code))
        elif method == "email":
            from app.services.email_otp_service import EmailOtpService

            return await EmailOtpService.verify_2fa_otp(user_id, str(code))
        elif method == "backup":
            from app.services.backup_code_service import BackupCodeService

            return await BackupCodeService.verify_code(user_id, str(code))
        elif method == "webauthn":
            from app.services.webauthn_service import WebAuthnService

            assertion = code
            if isinstance(code, str):
                try:
                    assertion = json.loads(code)
                except Exception:
                    return False
            if not isinstance(assertion, dict):
                return False
            result = await WebAuthnService.verify_authentication(user_id, assertion)
            return result is not None
        return False

    @staticmethod
    async def disable_all(user_id: int) -> None:
        """Disable all 2FA methods. Deletes WebAuthn credentials."""
        await prisma.securitysettings.update(
            where={"userId": user_id},
            data={
                "twoFactorEnabled": False,
                "twoFactorSecret": None,
                "emailOtpVerified": False,
                "webauthnEnabled": False,
                "backupCodes": [],
            },
        )
        await prisma.webauthncredential.delete_many(where={"userId": user_id})
        logger.info(f"All MFA methods disabled for user {user_id}")


mfa_service = MFAService()
