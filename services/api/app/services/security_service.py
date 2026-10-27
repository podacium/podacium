import logging

logger = logging.getLogger(__name__)
# security_service.py
from app.core.prisma import prisma
from app.schemas.security import *
from app.core.security import verify_password, get_password_hash
from datetime import datetime


class SecurityService:
    def __init__(self):
        self.db = prisma

    async def change_password(
        self, user_id: int, request: PasswordChangeRequest
    ) -> PasswordChangeResponse:
        # Use camelCase field names directly
        current_password = request.currentPassword
        new_password = request.newPassword
        confirm_password = request.confirmPassword

        logger.debug("Operation processed")
        logger.debug("Operation processed")
        logger.debug("Operation processed")
        logger.debug("Operation processed")

        # Verify current password
        user = await self.db.user.find_unique(where={"id": user_id})
        if not user or not user.passwordHash:
            raise ValueError("User not found or no password set")

        if not verify_password(current_password, user.passwordHash):
            raise ValueError("Current password is incorrect")

        if new_password != confirm_password:
            raise ValueError("New passwords do not match")

        # Update password
        new_hash = get_password_hash(new_password)
        now_dt = datetime.now()
        await self.db.user.update(
            where={"id": user_id},
            data={"passwordHash": new_hash, "lastPasswordChangeAt": now_dt},
        )
        await self.db.securitysettings.upsert(
            where={"userId": user_id},
            data={
                "create": {"userId": user_id, "lastPasswordChange": now_dt},
                "update": {"lastPasswordChange": now_dt},
            },
        )

        # Send password changed email
        try:
            from app.services.email_service import email_service

            now_str = now_dt.strftime("%Y-%m-%d %H:%M UTC")
            await email_service.send_password_changed_email(
                email=user.email,
                name=user.fullName or "User",
                time_val=now_str,
                ip_val="",
            )
        except Exception as e:
            logger.error(f"Failed to send password changed email: {e}")

        # 🔒 SECURITY: Revoke ALL existing tokens for this user.
        try:
            from app.core.security import add_token_to_blocklist, add_user_to_blocklist

            # Invalidate all user tokens via user-level blocklist timestamp
            await add_user_to_blocklist(user_id)

            # Revoke all non-expired AuthTokens for this user
            active_tokens = await self.db.authtoken.find_many(
                where={
                    "userId": user_id,
                    "type": {"in": ["access", "refresh"]},
                    "expiresAt": {"gte": now_dt},
                }
            )
            for t in active_tokens:
                await add_token_to_blocklist(t.token)
            # Also deactivate all UserDevice sessions
            await self.db.userdevice.update_many(
                where={"userId": user_id, "isActive": True}, data={"isActive": False}
            )
            logger.info(
                f"Revoked {len(active_tokens)} active tokens and deactivated all device sessions for user {user_id}"
            )
        except Exception as e:
            logger.error(f"Failed to revoke tokens after password change: {e}")

        logger.info("Operation completed")

        return PasswordChangeResponse(
            message="Password changed successfully. All other sessions have been logged out.",
            changed_at=datetime.now(),
        )

    async def get_security_settings(self, user_id: int) -> SecuritySettingsResponse:
        try:
            sec = await self.db.securitysettings.find_unique(where={"userId": user_id})
            user = await self.db.user.find_unique(where={"id": user_id})
            last_pw = (
                sec.lastPasswordChange
                if (sec and sec.lastPasswordChange)
                else (user.lastPasswordChangeAt if user else None)
            )

            if sec:
                return SecuritySettingsResponse(
                    user_id=user_id,
                    two_factor_enabled=sec.twoFactorEnabled,
                    login_alerts=sec.loginAlerts,
                    device_management=sec.deviceManagement,
                    session_timeout=sec.sessionTimeout,
                    last_password_change=last_pw,
                    created_at=sec.createdAt,
                    updated_at=sec.updatedAt,
                )

            return SecuritySettingsResponse(
                user_id=user_id,
                two_factor_enabled=False,
                login_alerts=True,
                device_management=True,
                session_timeout=24,
                last_password_change=last_pw,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
        except Exception as e:
            logger.error(f"Error fetching security settings for user {user_id}: {e}")
            return SecuritySettingsResponse(
                user_id=user_id,
                two_factor_enabled=False,
                login_alerts=True,
                device_management=True,
                session_timeout=24,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )

    async def update_security_settings(
        self, user_id: int, settings: SecuritySettingsUpdate
    ) -> SecuritySettingsResponse:
        try:
            data: dict[str, Any] = {}
            if hasattr(settings, "login_alerts") and settings.login_alerts is not None:
                data["loginAlerts"] = settings.login_alerts
            if (
                hasattr(settings, "device_management")
                and settings.device_management is not None
            ):
                data["deviceManagement"] = settings.device_management
            if (
                hasattr(settings, "session_timeout")
                and settings.session_timeout is not None
            ):
                data["sessionTimeout"] = settings.session_timeout

            # NOTE: twoFactorEnabled is NOT modifiable via this generic endpoint (SEC-2FA-01).
            # It must be toggled strictly via verified MFA enrollment/disable endpoints.
            await self.db.securitysettings.upsert(
                where={"userId": user_id},
                data={
                    "create": {"userId": user_id, **data},
                    "update": data,
                },
            )
            return await self.get_security_settings(user_id)
        except Exception as e:
            logger.error(f"Error updating security settings for user {user_id}: {e}")
            raise


# Singleton instance
security_service = SecurityService()
