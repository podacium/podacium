"""Multi-Factor Authentication router.

Unified endpoints for TOTP, Email OTP, WebAuthn, and Backup Codes.
Integrates with the existing auth flow (login temp token, Redis blocklist).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.auth import get_current_user
from app.core.prisma import prisma
from app.core.security import create_step_up_token
from app.services.mfa_service import mfa_service
from app.services.totp_service import totp_service
from app.services.email_otp_service import email_otp_service
from app.services.backup_code_service import backup_code_service
from app.services.webauthn_service import webauthn_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Multi-Factor Authentication"])


# ─── Schemas ───────────────────────────────────────────────────────────────────

from pydantic import BaseModel


class TotpSetupResponse(BaseModel):
    secret: str
    provisioning_uri: str


class TotpVerifyRequest(BaseModel):
    code: str
    secret: str  # The secret returned from setup, sent back for verification


class MfaCodeRequest(BaseModel):
    code: str


class PasswordRequest(BaseModel):
    password: str


class MfaStatusResponse(BaseModel):
    enabled: bool
    methods: list[dict]


class BackupCodesResponse(BaseModel):
    remaining: int


class BackupCodesRegenResponse(BaseModel):
    codes: list[str]


class MfaEnableResponse(BaseModel):
    success: bool
    backup_codes: list[str]


class WebAuthnRegBeginResponse(BaseModel):
    options: dict


class WebAuthnRegCompleteRequest(BaseModel):
    response: dict


# ─── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/mfa/status")
async def get_mfa_status(
    current_user=Depends(get_current_user),
):
    """Get user's 2FA status and enabled methods."""
    methods = await mfa_service.get_enabled_methods(current_user.id)
    return {"enabled": len(methods) > 0, "methods": methods}


@router.post("/mfa/totp/setup")
async def setup_totp(
    current_user=Depends(get_current_user),
):
    """Generate TOTP secret and provisioning URI for QR code."""
    if await totp_service.is_2fa_enabled(current_user.id):
        raise HTTPException(status_code=400, detail="TOTP already enabled")
    user = await prisma.user.find_unique(where={"id": current_user.id})
    email = user.email if user else "user@podacium.com"
    secret, uri = await totp_service.get_setup_data(current_user.id, email)
    return {"secret": secret, "provisioning_uri": uri}


@router.post("/mfa/totp/verify")
async def verify_totp_enable(
    body: TotpVerifyRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    """Verify TOTP code and enable 2FA. Returns backup codes."""
    backup_codes = await totp_service.enable_2fa(
        current_user.id, body.secret, body.code
    )
    if backup_codes is None:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    return {"success": True, "backup_codes": backup_codes}


@router.post("/mfa/totp/disable")
async def disable_totp(
    body: PasswordRequest,
    current_user=Depends(get_current_user),
):
    """Disable TOTP 2FA (requires password)."""
    from app.core.security import verify_password

    user = await prisma.user.find_unique(where={"id": current_user.id})
    if (
        not user
        or not user.passwordHash
        or not verify_password(body.password, user.passwordHash)
    ):
        raise HTTPException(status_code=400, detail="Invalid password")
    await prisma.securitysettings.update(
        where={"userId": current_user.id},
        data={"twoFactorEnabled": False, "twoFactorSecret": None},
    )
    return {"success": True}


@router.post("/mfa/email/send")
async def send_email_otp(
    current_user=Depends(get_current_user),
):
    """Send a 6-digit OTP to the user's email."""
    success, reason = await email_otp_service.send_2fa_otp(current_user.id)
    if not success:
        if reason == "rate_limited":
            raise HTTPException(
                status_code=429,
                detail="Too many OTP requests. Please wait a minute before requesting another code.",
            )
        elif reason == "no_email":
            raise HTTPException(
                status_code=400,
                detail="User does not have a registered email address.",
            )
        elif reason == "smtp_unconfigured":
            raise HTTPException(
                status_code=503,
                detail="Email delivery (SMTP) is not configured. Please use Authenticator App (TOTP) or WebAuthn.",
            )
        else:
            raise HTTPException(
                status_code=502,
                detail="Failed to send OTP email. Please try again or use another verification method.",
            )
    return {"success": True, "expires_in": 300}


@router.post("/mfa/email/verify")
async def verify_email_otp_enable(
    body: MfaCodeRequest,
    current_user=Depends(get_current_user),
):
    """Verify email OTP and enable email 2FA. Returns backup codes."""
    if not await email_otp_service.verify_2fa_otp(current_user.id, body.code):
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    await prisma.securitysettings.upsert(
        where={"userId": current_user.id},
        data={
            "update": {"emailOtpVerified": True},
            "create": {"userId": current_user.id, "emailOtpVerified": True},
        },
    )
    codes = await backup_code_service.regenerate_codes(current_user.id)
    return {"success": True, "backup_codes": codes}


@router.post("/mfa/webauthn/register/begin")
async def webauthn_register_begin(
    current_user=Depends(get_current_user),
):
    """Start WebAuthn registration. Returns options for the browser."""
    user = await prisma.user.find_unique(where={"id": current_user.id})
    user_name = user.fullName if user else f"User {current_user.id}"
    options = await webauthn_service.generate_registration_options(
        current_user.id, user_name
    )
    if not options:
        raise HTTPException(
            status_code=500, detail="Failed to generate registration options"
        )
    return {"options": options}


@router.post("/mfa/webauthn/register/complete")
async def webauthn_register_complete(
    body: WebAuthnRegCompleteRequest,
    current_user=Depends(get_current_user),
):
    """Complete WebAuthn registration. Stores credential."""
    result = await webauthn_service.verify_registration(current_user.id, body.response)
    if not result:
        raise HTTPException(status_code=400, detail="WebAuthn registration failed")
    return {"success": True, "credential_id": result["credentialId"]}


@router.post("/mfa/webauthn/auth/begin")
async def webauthn_auth_begin(
    current_user=Depends(get_current_user),
):
    """Start WebAuthn authentication. Returns options for the browser."""
    options = await webauthn_service.generate_authentication_options(current_user.id)
    if not options:
        raise HTTPException(status_code=404, detail="No WebAuthn credentials found")
    return {"options": options}


@router.post("/mfa/webauthn/auth/complete")
async def webauthn_auth_complete(
    body: WebAuthnRegCompleteRequest,
    current_user=Depends(get_current_user),
):
    """Complete WebAuthn authentication. Verifies assertion and returns step-up token."""
    result = await webauthn_service.verify_authentication(
        current_user.id, body.response
    )
    if not result:
        raise HTTPException(status_code=400, detail="WebAuthn authentication failed")

    # Generate step-up token with auth_method="webauthn"

    step_up_token = create_step_up_token(current_user.id, auth_method="webauthn")

    # Update active AdminSession to mark hardwareKeyUsed = True
    try:
        admin_profile = await prisma.adminprofile.find_unique(
            where={"userId": current_user.id}
        )
        if admin_profile:
            await prisma.adminsession.update_many(
                where={"adminProfileId": admin_profile.id, "revokedAt": None},
                data={"hardwareKeyUsed": True, "mfaVerified": True},
            )
    except Exception as e:
        logger.warning(
            f"Could not update AdminSession hardwareKeyUsed for user {current_user.id}: {e}"
        )

    return {
        "success": True,
        "credential_id": result["credentialId"],
        "step_up_token": step_up_token,
    }


@router.get("/mfa/backup-codes")
async def get_backup_codes(
    current_user=Depends(get_current_user),
):
    """Get remaining backup code count."""
    count = await backup_code_service.get_remaining_count(current_user.id)
    return {"remaining": count}


@router.post("/mfa/backup-codes/regenerate")
async def regenerate_backup_codes(
    current_user=Depends(get_current_user),
):
    """Generate new backup codes, invalidating old ones."""
    codes = await backup_code_service.regenerate_codes(current_user.id)
    return {"codes": codes}


@router.post("/mfa/disable")
async def disable_all_mfa(
    body: PasswordRequest,
    current_user=Depends(get_current_user),
):
    """Disable ALL 2FA methods (requires password)."""
    from app.core.security import verify_password

    user = await prisma.user.find_unique(where={"id": current_user.id})
    if (
        not user
        or not user.passwordHash
        or not verify_password(body.password, user.passwordHash)
    ):
        raise HTTPException(status_code=400, detail="Invalid password")
    await mfa_service.disable_all(current_user.id)
    return {"success": True}
