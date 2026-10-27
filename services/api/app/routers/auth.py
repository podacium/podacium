from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    BackgroundTasks,
    Response,
    Request,
)
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    PasswordResetRequest,
    PasswordReset,
    EmailVerificationRequest,
    ResendVerificationRequest,
)
from app.services.auth_service import auth_service
from app.services.token_rotation_service import token_rotation_service
from app.services.magic_link_service import MagicLinkService
from app.services.email_service import EmailService
from app.services.oauth_state_store import oauth_state_store
from app.core.auth import (
    get_current_active_user,
    get_current_user,
    get_client_ip,
)
from app.core.security import (
    verify_token,
    verify_password,
    add_token_to_blocklist,
    set_session_cookie,
    clear_session_cookie,
    _get_signing_key,
    ALGORITHM,
)
from app.core.redis_blocklist import token_blocklist
from app.core.prisma import prisma
from app.utils.rate_limit import (
    login_rate_limiter,
    login_ip_rate_limiter,
    complete_2fa_rate_limiter,
    password_reset_limiter,
    resend_verification_email_limiter,
    resend_verification_ip_limiter,
)
from urllib.parse import urlencode
from fastapi.responses import RedirectResponse
from app.core.config import setting
import logging
import hashlib
import secrets
import inspect
import redis.asyncio as aioredis
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, EmailStr, Field
import json
from typing import Optional, Union, Any

router = APIRouter(prefix="/auth", tags=["authentication"])
logger = logging.getLogger(__name__)


@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserRegister,
    background_tasks: BackgroundTasks,
    request: Request,
):
    """Register a new user.

    🔒 No auto-login — user must verify their email before first login.
    Verification email is sent in the background.
    """
    try:
        if user_data.honeypot and user_data.honeypot.strip():
            logger.warning(f"Bot registration caught by honeypot: {user_data.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Bot activity detected.",
                    "code": "BOT_DETECTED",
                },
            )

        from app.core.turnstile import verify_turnstile_token

        client_ip = request.client.host if request.client else None
        valid_captcha = await verify_turnstile_token(
            user_data.turnstileToken, client_ip
        )
        if not valid_captcha:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "CAPTCHA verification failed. Please try again.",
                    "code": "CAPTCHA_FAILED",
                },
            )

        if not user_data.acceptedTerms:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "You must accept the terms and conditions.",
                    "code": "TERMS_NOT_ACCEPTED",
                },
            )

        result = await auth_service.register_user(user_data, background_tasks)
        user = result["user"]

        return {
            "message": "Registration successful. Please check your email to verify your account.",
            "user_id": user["id"],
            "verification_sent": bool(user_data.email),
        }

    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Registration validation: {e}")
        raw_msg = str(e)
        code = "VALIDATION_ERROR"
        if "email already registered" in raw_msg.lower():
            code = "EMAIL_ALREADY_REGISTERED"
            detail_msg = "This email is already registered."
        elif "phone number already registered" in raw_msg.lower():
            code = "PHONE_ALREADY_REGISTERED"
            detail_msg = "This phone number is already registered."
        elif "password" in raw_msg.lower():
            code = "PASSWORD_COMPLEXITY_ERROR"
            detail_msg = raw_msg
        elif "full name" in raw_msg.lower():
            code = "FULL_NAME_REQUIRED"
            detail_msg = "Full name is required."
        elif "terms" in raw_msg.lower():
            code = "TERMS_NOT_ACCEPTED"
            detail_msg = "You must accept the terms and conditions."
        else:
            detail_msg = (
                raw_msg
                or "Registration failed. Please check your information and try again."
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": detail_msg,
                "code": code,
            },
        )
    except Exception:
        logger.error(f"Registration failed", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Registration failed. Please try again.",
                "code": "SERVER_ERROR",
            },
        )


@router.post("/login")
async def login(login_data: UserLogin, request: Request):
    """User login with account lockout protection."""
    from app.services.account_lockout_service import account_lockout_service

    # SECURITY: Per-IP rate limiting (prevents brute-force across accounts from same IP)
    client_ip = request.client.host if request.client else "unknown"
    if await login_ip_rate_limiter.is_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Too many login attempts from this network. Please try again later.",
                "code": "IP_RATE_LIMITED",
            },
        )

    # SECURITY: Per-email rate limiting (prevents credential stuffing across IPs)
    if await login_rate_limiter.is_limited(login_data.email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Too many attempts. Please try again later.",
                "code": "RATE_LIMITED",
            },
        )

    # Check lockout status
    is_locked, remaining = await account_lockout_service.is_locked_out(login_data.email)
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Too many attempts. Please try again later.",
                "code": "ACCOUNT_LOCKED",
            },
        )

    # Dynamic CAPTCHA: Check if failed attempts require Turnstile token
    if login_data.email and await account_lockout_service.should_require_captcha(
        login_data.email
    ):
        from app.core.turnstile import verify_turnstile_token

        client_ip = request.client.host if request.client else None
        if not login_data.turnstileToken:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "CAPTCHA verification required due to multiple failed attempts.",
                    "code": "REQUIRES_CAPTCHA",
                },
            )
        valid_captcha = await verify_turnstile_token(
            login_data.turnstileToken, client_ip
        )
        if not valid_captcha:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "CAPTCHA verification failed. Please try again.",
                    "code": "CAPTCHA_FAILED",
                },
            )

    try:
        clean_email = login_data.email.lower().strip()
        user = await prisma.user.find_unique(where={"email": clean_email})

        # Pre-computed dummy hash to ensure constant-time Argon2 computation on non-existent accounts
        dummy_argon2_hash = "$argon2id$v=19$m=19456,t=3,p=1$c29tZXNhbHQ$R0p83trziZjwKchpB6JIZUQasOggucwCeLDQqWhjC8E"

        if not user or not user.passwordHash:
            verify_password(login_data.password or "dummy_pwd", dummy_argon2_hash)
            await account_lockout_service.record_failed_attempt(clean_email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "message": "Invalid email or password. Please try again.",
                    "code": "INVALID_CREDENTIALS",
                },
            )

        # Verify password
        password_valid = verify_password(login_data.password, user.passwordHash)

        if not password_valid:
            await account_lockout_service.record_failed_attempt(clean_email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "message": "Invalid email or password. Please try again.",
                    "code": "INVALID_CREDENTIALS",
                },
            )

        # Check if user is active
        if user.deletedAt:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "This account has been deleted and cannot be used.",
                    "code": "ACCOUNT_DELETED",
                },
            )
        if not user.isActive or user.isDeactivated or user.deactivatedAt:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "This account is deactivated. Please contact support.",
                    "code": "ACCOUNT_DEACTIVATED",
                },
            )

        # 🔒 Require email verification for email-based accounts
        if user.email and not user.emailVerified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email before logging in. Check your inbox or request a new verification link.",
            )

        # Clear failed attempts on successful login
        await account_lockout_service.clear_attempts(login_data.email)
        await login_rate_limiter.reset(login_data.email)
        await login_ip_rate_limiter.reset(client_ip)

        # Check if 2FA is required
        from app.services.totp_service import totp_service

        if await totp_service.is_2fa_enabled(user.id):
            # 🔒 Issue a hardened temp token:
            # - 5-minute max TTL
            # - Bound to originating IP and User-Agent
            # - Marked for single-use via blocklist on consumption
            from app.core.security import _get_signing_key, ALGORITHM
            import jwt as pyjwt

            client_ip = request.client.host if request.client else "unknown"
            user_agent = request.headers.get("user-agent", "unknown")
            temp_token = pyjwt.encode(
                {
                    "sub": str(user.id),
                    "type": "2fa_pending",
                    "ip": hashlib.sha256(client_ip.encode()).hexdigest()[:16],
                    "ua": hashlib.sha256(user_agent.encode()).hexdigest()[:16],
                    "jti": secrets.token_urlsafe(16),
                    "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
                    "iat": datetime.now(timezone.utc),
                },
                _get_signing_key(),
                algorithm=ALGORITHM,
            )
            from app.services.mfa_service import mfa_service

            methods = await mfa_service.get_enabled_methods(user.id)
            # Auto-send email OTP if email is an enabled method
            if any(m["method"] == "email" for m in methods):
                try:
                    from app.services.email_otp_service import EmailOtpService

                    await EmailOtpService.send_2fa_otp(user.id)
                except Exception as e:
                    logger.warning(
                        f"Failed to auto-send email OTP for user {user.id}: {e}"
                    )
            from fastapi.responses import JSONResponse

            return JSONResponse(
                content={
                    "requires_2fa": True,
                    "temp_token": temp_token,
                    "methods": methods,
                    "message": "2FA verification required",
                }
            )

        raw_fingerprint = (
            request.headers.get("X-Fingerprint")
            or request.headers.get("x-fingerprint")
            or request.cookies.get("x-fingerprint")
        )

        # Create tokens (RFC 9700 family-tracked with JTI and device fingerprint binding)
        access_token, refresh_token = await token_rotation_service.issue_token_pair(
            user.id, fingerprint=raw_fingerprint
        )

        # Generate persistent AdminSession for administrative profiles
        profile = await prisma.adminprofile.find_unique(where={"userId": user.id})
        if profile and profile.isActive:
            client_ip = get_client_ip(request)
            user_agent = request.headers.get("user-agent", "unknown")
            expires_at = datetime.now(timezone.utc) + timedelta(
                minutes=setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
            )
            admin_session = await prisma.adminsession.create(
                data={
                    "adminProfileId": profile.id,
                    "tokenHash": hashlib.sha256(access_token.encode()).hexdigest(),
                    "ipAddress": client_ip,
                    "userAgent": user_agent,
                    "mfaVerified": getattr(user, "twoFactorEnabled", False),
                    "hardwareKeyUsed": False,
                    "expiresAt": expires_at,
                    "lastActivityAt": datetime.now(timezone.utc),
                }
            )
            from app.core.security import create_access_token_for_user

            access_token = create_access_token_for_user(
                user_id=user.id,
                session_id=admin_session.id,
                fingerprint=raw_fingerprint,
            )
            new_hash = hashlib.sha256(access_token.encode()).hexdigest()
            await prisma.adminsession.update(
                where={"id": admin_session.id},
                data={"tokenHash": new_hash},
            )

        # Update last login
        await prisma.user.update(
            where={"id": user.id}, data={"lastLoginAt": datetime.now(timezone.utc)}
        )

        # Prepare response (including onboarding status so the frontend
        # can skip the heavy /api/me call after login)
        response = {
            "user": {
                "id": user.id,
                "email": user.email,
                "fullName": user.fullName,
                "role": user.role,
                "onboardingCompleted": user.onboardingCompleted,
            },
            "message": "Login successful",
        }

        # Set cookies
        from fastapi.responses import JSONResponse

        res = JSONResponse(content=response)

        # Access Token Cookie (short-lived)
        res.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            path="/",
            domain=setting.COOKIE_DOMAIN or None,
        )

        # Refresh Token Cookie (longer-lived)
        res.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=setting.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
            path="/",
            domain=setting.COOKIE_DOMAIN or None,
        )

        # Edge middleware session cookie (signed JWT on parent domain)
        set_session_cookie(res, user.id, user.role, fingerprint=raw_fingerprint)

        return res

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login failed: {type(e).__name__}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Login failed. Please try again.",
                "code": "SERVER_ERROR",
            },
        )


@router.post("/verify-email")
async def verify_email(verification_data: EmailVerificationRequest, response: Response):
    """Verify email address.

    On success, issues fresh full-scope tokens (replacing the restricted
    email_unverified tokens from registration) and sets them as HTTP-only cookies.
    """
    from fastapi.responses import JSONResponse

    result = await auth_service.verify_email(verification_data.token)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Invalid or expired verification token.",
                "code": "INVALID_TOKEN",
            },
        )

    tokens = result.get("tokens")
    res = JSONResponse(content={"message": "Email verified successfully"})

    if tokens:
        res.set_cookie(
            key="access_token",
            value=tokens["access_token"],
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            path="/",
            domain=setting.COOKIE_DOMAIN or None,
        )
        res.set_cookie(
            key="refresh_token",
            value=tokens["refresh_token"],
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=setting.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
            path="/",
            domain=setting.COOKIE_DOMAIN or None,
        )
        # Edge middleware session cookie — resolve role for RBAC at the edge
        _u = None
        try:
            if (
                hasattr(prisma, "user")
                and prisma.user is not None
                and hasattr(prisma.user, "find_unique")
            ):
                _res = prisma.user.find_unique(where={"id": int(result["user_id"])})
                if inspect.isawaitable(_res):
                    _u = await _res
        except Exception:
            _u = None
        set_session_cookie(
            res, result["user_id"], getattr(_u, "role", None) if _u else None
        )

    return res


@router.post("/resend-verification")
async def resend_verification(
    request_data: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    request: Request,
):
    """Resend email verification link.

    🔒 Rate-limited per-email (3/hour) and per-IP (10/hour).
    🔒 Always returns the same response to prevent user enumeration.
    """
    # Per-email rate limiting
    if await resend_verification_email_limiter.is_limited(request_data.email):
        return {
            "message": "If the account exists and is not verified, a new link has been sent"
        }

    # Per-IP rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if await resend_verification_ip_limiter.is_limited(client_ip):
        return {
            "message": "If the account exists and is not verified, a new link has been sent"
        }

    await auth_service.resend_verification_email(request_data.email, background_tasks)

    return {
        "message": "If the account exists and is not verified, a new link has been sent"
    }


@router.post("/forgot-password")
async def forgot_password(
    reset_request: PasswordResetRequest, background_tasks: BackgroundTasks
):
    """Request password reset email.

    🔒 Always returns the same response to prevent user enumeration.
    🔒 Always creates a token (even for non-existent emails — immediately discarded)
       to maintain consistent timing.
    """
    # SECURITY: Per-email rate limiting for password resets (prevents email flooding)
    if await password_reset_limiter.is_limited(reset_request.email):
        return {"message": "If the email exists, a reset link has been sent"}

    email_service = EmailService()

    try:
        reset_token = await auth_service.create_password_reset_token(
            reset_request.email
        )

        # Always attempt to send — if token is None (user doesn't exist),
        # the background task is a no-op but timing is consistent
        if reset_token:
            user = await auth_service.get_user_by_email(reset_request.email)
            if user:
                # Get user's locale for localized email
                user_locale = "en"
                try:
                    user_record = await prisma.user.find_unique(
                        where={"email": reset_request.email},
                        include={"userSettings": True},
                    )
                    if user_record and user_record.userSettings:
                        user_locale = user_record.userSettings.language
                except Exception:
                    pass
                background_tasks.add_task(
                    email_service.send_password_reset_email,
                    reset_request.email,
                    reset_token,
                    user["fullName"],
                    user_locale,
                    user["id"],
                )
            # If user is None (race condition — user deleted between token creation and fetch),
            # token goes unused. This is safe.

        return {"message": "If the email exists, a reset link has been sent"}

    except Exception as e:
        logger.error(f"Forgot password error: {type(e).__name__}")
        return {"message": "If the email exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(reset_data: PasswordReset):
    """Reset password using token."""
    try:
        success = await auth_service.reset_password(
            reset_data.token, reset_data.new_password
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token",
            )

        return {"message": "Password reset successfully"}

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset error: {type(e).__name__}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Password reset failed"
        )


class Complete2FARequest(BaseModel):
    temp_token: str
    totp_code: Optional[Union[str, dict]] = None
    assertion_response: Optional[dict] = None
    method: str = "totp"  # totp, email, backup, webauthn


class WebAuthnLoginBeginRequest(BaseModel):
    temp_token: Optional[str] = None
    email: Optional[str] = None


class WebAuthnLoginCompleteRequest(BaseModel):
    temp_token: Optional[str] = None
    email: Optional[str] = None
    response: dict


@router.post("/complete-2fa-login")
async def complete_2fa_login(
    request: Request,
    response: Response,
    body: Complete2FARequest,
):
    """Complete 2FA-required login by verifying the TOTP code.

    🔒 Validates the temp token (issued during /login when 2FA is enabled):
       - Checks signature + type
       - Enforces 5-minute max TTL (via JWT exp)
       - Verifies IP and User-Agent binding
       - Single-use via blocklist (prevents replay)

    On success, issues real full-scope tokens and sets cookies.
    """
    from fastapi.responses import JSONResponse

    temp_token = body.temp_token

    # 1. Verify temp token signature and type
    payload = verify_token(temp_token)
    if not payload or payload.get("type") != "2fa_pending":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired 2FA session",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid 2FA token payload"
        )

    # 2. Rate limit 2FA attempts per user and IP
    client_ip = get_client_ip(request)
    if await complete_2fa_rate_limiter.is_limited(
        f"2fa:{user_id}"
    ) or await complete_2fa_rate_limiter.is_limited(f"2fa_ip:{client_ip}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Too many 2FA verification attempts. Please try again later.",
                "code": "RATE_LIMITED",
            },
        )

    # 3. IP binding check (soft — log mismatch but don't block, since IP can change behind proxies/CGNAT)
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]
    if payload.get("ip") and payload["ip"] != ip_hash:
        logger.warning(
            f"2FA IP mismatch for user {user_id}: expected {payload['ip']}, got {ip_hash}"
        )

    # 3. User-Agent binding check (soft — log mismatch but don't block)
    user_agent = request.headers.get("user-agent", "unknown")
    ua_hash = hashlib.sha256(user_agent.encode()).hexdigest()[:16]
    if payload.get("ua") and payload["ua"] != ua_hash:
        logger.warning(
            f"2FA UA mismatch for user {user_id}: expected {payload['ua']}, got {ua_hash}"
        )

    # 4. Single-use check via distributed blocklist (prevents multi-worker replay)
    if await token_blocklist.contains(temp_token):
        logger.warning(f"2FA temp_token replay attempt for user {user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="2FA session has already been used — possible replay attack",
        )

    # 5. Verify 2FA code via MFA service
    from app.services.mfa_service import mfa_service

    logger.debug(f"Verifying {body.method} code for user {user_id}")
    challenge_payload: Any = body.totp_code
    if body.method == "webauthn":
        if body.assertion_response:
            challenge_payload = body.assertion_response
        elif isinstance(body.totp_code, dict):
            challenge_payload = body.totp_code
        elif isinstance(body.totp_code, str):
            try:
                challenge_payload = json.loads(body.totp_code)
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid WebAuthn assertion payload dictionary format",
                )
        if not isinstance(challenge_payload, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="WebAuthn verification requires an assertion dictionary payload",
            )
    elif not challenge_payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code is required",
        )

    valid = await mfa_service.verify_challenge(
        int(user_id), body.method, challenge_payload
    )
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid 2FA code"
        )

    # 6. Blocklist the temp token (single-use consumption)
    await add_token_to_blocklist(temp_token)
    await complete_2fa_rate_limiter.reset(f"2fa:{user_id}")
    await complete_2fa_rate_limiter.reset(f"2fa_ip:{client_ip}")

    raw_fingerprint = (
        request.headers.get("X-Fingerprint")
        or request.headers.get("x-fingerprint")
        or request.cookies.get("x-fingerprint")
    )

    # 7. Issue real full-scope tokens (RFC 9700 family-tracked with JTI and device fingerprint binding)
    access_token, refresh_token = await token_rotation_service.issue_token_pair(
        int(user_id), fingerprint=raw_fingerprint
    )

    # Generate persistent AdminSession for administrative profiles
    profile = await prisma.adminprofile.find_unique(where={"userId": int(user_id)})
    if profile and profile.isActive:
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )
        admin_session = await prisma.adminsession.create(
            data={
                "adminProfileId": profile.id,
                "tokenHash": hashlib.sha256(access_token.encode()).hexdigest(),
                "ipAddress": client_ip,
                "userAgent": user_agent,
                "mfaVerified": True,
                "hardwareKeyUsed": body.method == "webauthn",
                "expiresAt": expires_at,
                "lastActivityAt": datetime.now(timezone.utc),
            }
        )
        from app.core.security import create_access_token_for_user

        access_token = create_access_token_for_user(
            user_id=int(user_id),
            session_id=admin_session.id,
            fingerprint=raw_fingerprint,
        )
        new_hash = hashlib.sha256(access_token.encode()).hexdigest()
        await prisma.adminsession.update(
            where={"id": admin_session.id},
            data={"tokenHash": new_hash},
        )

    # 8. Update last login
    await prisma.user.update(
        where={"id": int(user_id)}, data={"lastLoginAt": datetime.now(timezone.utc)}
    )

    # 9. Fetch user data for response
    user = await prisma.user.find_unique(where={"id": int(user_id)})

    res = JSONResponse(
        content={
            "user": {
                "id": user.id,
                "email": user.email,
                "fullName": user.fullName,
                "role": user.role,
                "onboardingCompleted": user.onboardingCompleted,
            },
            "message": "2FA verification successful",
        }
    )

    # Set cookies
    res.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        domain=setting.COOKIE_DOMAIN or None,
    )

    res.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=setting.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
        domain=setting.COOKIE_DOMAIN or None,
    )
    set_session_cookie(res, int(user_id), user.role, fingerprint=raw_fingerprint)

    return res


@router.post("/webauthn/login/begin")
async def webauthn_login_begin(
    request: Request,
    body: WebAuthnLoginBeginRequest,
):
    """Generate PublicKeyCredentialRequestOptions for WebAuthn login initiation."""
    from app.services.webauthn_service import webauthn_service

    temp_token = body.temp_token or request.headers.get("X-Temp-Token")
    user_id: Optional[int] = None

    if temp_token:
        payload = verify_token(temp_token)
        if not payload or payload.get("type") != "2fa_pending":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired 2FA session",
            )
        user_id = int(payload.get("sub"))
    elif body.email:
        user = await prisma.user.find_unique(
            where={"email": body.email.strip().lower()}
        )
        if not user or user.isBanned or user.deletedAt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        user_id = user.id
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either temp_token or email is required to initiate WebAuthn login",
        )

    options = await webauthn_service.generate_authentication_options(user_id)
    if not options:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No WebAuthn credentials registered for this user",
        )

    return {"options": options, "user_id": user_id}


@router.post("/webauthn/login/complete")
async def webauthn_login_complete(
    request: Request,
    body: WebAuthnLoginCompleteRequest,
):
    """Complete WebAuthn login assertion and issue tokens with session fingerprinting."""
    from fastapi.responses import JSONResponse
    from app.services.webauthn_service import webauthn_service
    from app.core.security import create_access_token_for_user

    temp_token = body.temp_token or request.headers.get("X-Temp-Token")
    user_id: Optional[int] = None

    if temp_token:
        payload = verify_token(temp_token)
        if not payload or payload.get("type") != "2fa_pending":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired 2FA session",
            )
        user_id = int(payload.get("sub"))
    elif body.email:
        user = await prisma.user.find_unique(
            where={"email": body.email.strip().lower()}
        )
        if not user or user.isBanned or user.deletedAt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        user_id = user.id
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either temp_token or email is required",
        )

    result = await webauthn_service.verify_authentication(user_id, body.response)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid WebAuthn assertion signature",
        )

    if temp_token:
        await add_token_to_blocklist(temp_token)

    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")
    raw_fingerprint = (
        request.headers.get("X-Fingerprint")
        or request.headers.get("x-fingerprint")
        or request.cookies.get("x-fingerprint")
    )

    access_token, refresh_token = await token_rotation_service.issue_token_pair(
        user_id, fingerprint=raw_fingerprint
    )

    profile = await prisma.adminprofile.find_unique(where={"userId": user_id})
    if profile and profile.isActive:
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )
        admin_session = await prisma.adminsession.create(
            data={
                "adminProfileId": profile.id,
                "tokenHash": hashlib.sha256(access_token.encode()).hexdigest(),
                "ipAddress": client_ip,
                "userAgent": user_agent,
                "mfaVerified": True,
                "hardwareKeyUsed": True,
                "expiresAt": expires_at,
                "lastActivityAt": datetime.now(timezone.utc),
            }
        )
        access_token = create_access_token_for_user(
            user_id=user_id,
            session_id=admin_session.id,
            fingerprint=raw_fingerprint,
        )
        new_hash = hashlib.sha256(access_token.encode()).hexdigest()
        await prisma.adminsession.update(
            where={"id": admin_session.id},
            data={"tokenHash": new_hash},
        )

    await prisma.user.update(
        where={"id": user_id}, data={"lastLoginAt": datetime.now(timezone.utc)}
    )

    user_record = await prisma.user.find_unique(where={"id": user_id})
    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    res = JSONResponse(
        content={
            "user": {
                "id": user_record.id,
                "email": user_record.email,
                "fullName": user_record.fullName,
                "role": user_record.role,
                "onboardingCompleted": user_record.onboardingCompleted,
            },
            "message": "WebAuthn authentication successful",
            "access_token": access_token,
            "refresh_token": refresh_token,
        }
    )

    res.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        domain=setting.COOKIE_DOMAIN or None,
    )

    res.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=setting.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
        domain=setting.COOKIE_DOMAIN or None,
    )
    set_session_cookie(res, user_id, user_record.role, fingerprint=raw_fingerprint)

    return res


@router.post("/refresh-token")
async def refresh_token(request: Request, response: Response):
    """Refresh access token using refresh token cookie."""
    try:
        # Try to get refresh token from cookie
        refresh_token_val = request.cookies.get("refresh_token")

        if not refresh_token_val:
            # Fallback to body for transition period (optional, but requested to remove tokens from body)
            # For now, let's strictly use cookies if possible
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing"
            )

        raw_fingerprint = (
            request.headers.get("X-Fingerprint")
            or request.headers.get("x-fingerprint")
            or request.cookies.get("x-fingerprint")
        )

        tokens = await auth_service.refresh_tokens(
            refresh_token_val, fingerprint=raw_fingerprint
        )

        # Set new cookies
        response.set_cookie(
            key="access_token",
            value=tokens["access_token"],
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            path="/",
            domain=setting.COOKIE_DOMAIN or None,
        )

        response.set_cookie(
            key="refresh_token",
            value=tokens["refresh_token"],
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=setting.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
            path="/",
            domain=setting.COOKIE_DOMAIN or None,
        )

        # Edge middleware session cookie (signed JWT on parent domain)
        # Extract user_id from tokens to refresh the session cookie
        try:
            payload = verify_token(tokens["access_token"])
            if payload and payload.get("sub"):
                # Resolve the role so the Edge middleware's RBAC stays in sync
                # after a token refresh.
                _u = await prisma.user.find_unique(where={"id": int(payload["sub"])})
                set_session_cookie(
                    response,
                    int(payload["sub"]),
                    _u.role if _u else None,
                    fingerprint=raw_fingerprint,
                )
        except Exception:
            pass

        return {"message": "Token refreshed successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/logout")
async def logout(
    response: Response,
    request: Request,
    current_user: dict = Depends(get_current_active_user),
):
    """Logout user — invalidates the current access token server-side (permanently)."""
    # Try to get token from header or cookie for revocation
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    else:
        token = request.cookies.get("access_token")

    if token:
        await add_token_to_blocklist(token)

    # Also blocklist the refresh token
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        await add_token_to_blocklist(refresh_token)

    # Persist to database for multi-server synchronization and server restarts
    try:
        payload = verify_token(token)
        if payload:
            exp_timestamp = payload.get("exp")
            expires_at = (
                datetime.fromtimestamp(exp_timestamp)
                if exp_timestamp
                else datetime.now(timezone.utc) + timedelta(hours=1)
            )

            await prisma.authtoken.upsert(
                where={"token": token},
                data={
                    "create": {
                        "userId": current_user.id,
                        "token": token,
                        "type": "REVOKED",
                        "expiresAt": expires_at,
                    },
                    "update": {"type": "REVOKED", "expiresAt": expires_at},
                },
            )
    except Exception as e:
        logger.error(f"Failed to persist token revocation: {type(e).__name__}")

    # Clear cookies (both old __Host-* and new scoped names)
    response.delete_cookie(
        "access_token", path="/", domain=setting.COOKIE_DOMAIN or None
    )
    response.delete_cookie(
        "refresh_token", path="/", domain=setting.COOKIE_DOMAIN or None
    )
    response.delete_cookie("__Host-access_token", path="/")
    response.delete_cookie("__Host-refresh_token", path="/")
    clear_session_cookie(response)  # Edge middleware session cookie

    logger.info(f"User {current_user.id} logged out, cookies cleared")
    return {"message": "Logged out successfully"}


# ======================
# OAuth Endpoints
# ======================


class OAuthCallback(BaseModel):
    code: str
    state: Optional[str] = None
    redirect_uri: Optional[str] = None


class OAuthAuthorizeRequest(BaseModel):
    redirect_uri: Optional[str] = None


@router.get("/oauth/{provider}/authorize")
async def oauth_authorize(
    provider: str,
    redirect_uri: Optional[str] = None,
    background_tasks: BackgroundTasks = None,
):
    """Get OAuth authorization URL."""
    try:
        if provider.upper() not in ["GOOGLE", "GITHUB", "LINKEDIN"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported OAuth provider: {provider}",
            )

        auth_url = await auth_service.get_oauth_authorization_url(
            provider.upper(), redirect_uri
        )

        return {"authorization_url": auth_url, "provider": provider.upper()}

    except Exception as e:
        logger.exception(f"OAuth authorize error: {type(e).__name__}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get authorization URL: {str(e)}",
        )


@router.post("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    callback_data: OAuthCallback,
    background_tasks: BackgroundTasks = None,
):
    """Handle OAuth callback and authenticate user with cookies."""
    try:
        # SECURITY: State token is MANDATORY for CSRF protection
        if not callback_data.state:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing state token — possible CSRF attack",
            )
        state_payload = verify_token(callback_data.state)
        if not state_payload or state_payload.get("provider") != provider.upper():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid state token"
            )

        # SECURITY: Replay protection — state nonce (jti) must be single-use
        jti = state_payload.get("jti")
        if not jti:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="State token missing nonce (jti)",
            )
        if await oauth_state_store.is_used(jti):
            logger.warning(
                f"OAuth state nonce replayed: jti={jti[:16]}... provider={provider}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="State token has already been used — possible replay attack",
            )
        await oauth_state_store.mark_used(jti)

        result = await auth_service.oauth_authenticate(
            provider=provider.upper(),
            code=callback_data.code,
            redirect_uri=callback_data.redirect_uri,
        )

        # Extract tokens
        tokens = result.get("tokens") or {}
        access_token = tokens.get("access_token")
        refresh_token_val = tokens.get("refresh_token")

        # Prepare response
        from fastapi.responses import JSONResponse

        res = JSONResponse(
            content={
                "user": result["user"],
                "message": "OAuth authentication successful",
            }
        )

        if access_token:
            res.set_cookie(
                key="access_token",
                value=access_token,
                httponly=True,
                secure=True,
                samesite="lax",
                max_age=setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                path="/",
                domain=setting.COOKIE_DOMAIN or None,
            )

        if refresh_token_val:
            res.set_cookie(
                key="refresh_token",
                value=refresh_token_val,
                httponly=True,
                secure=True,
                samesite="lax",
                max_age=setting.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
                path="/",
                domain=setting.COOKIE_DOMAIN or None,
            )

        # Edge middleware session cookie
        user_data = result.get("user", {})
        if user_data.get("id"):
            set_session_cookie(res, user_data["id"], user_data.get("role"))

        return res

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/oauth/{provider}/callback")
async def oauth_callback_get(
    provider: str,
    code: Optional[str] = None,
    error: Optional[str] = None,
    state: Optional[str] = None,
    redirect_uri: Optional[str] = None,
    background_tasks: BackgroundTasks = None,
):
    """Handle OAuth provider GET callback (providers redirect with GET)."""
    try:
        # Handle provider-side errors
        if error or not code:
            frontend_url = setting.FRONTEND_URL
            error_msg = error or "No authorization code received"
            error_params = urlencode(
                {
                    "oauth_error": "true",
                    "error": f"OAuth denied: {error_msg}",
                    "provider": provider.lower(),
                }
            )
            return RedirectResponse(
                url=f"{frontend_url}/auth/login-failed?{error_params}",
                status_code=status.HTTP_302_FOUND,
            )

        # SECURITY: State token is MANDATORY for CSRF protection
        if not state:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing state token — possible CSRF attack",
            )
        state_payload = verify_token(state)
        if (
            not state_payload
            or state_payload.get("provider", "").upper() != provider.upper()
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid state token"
            )

        # SECURITY: Replay protection — state nonce (jti) must be single-use
        jti = state_payload.get("jti")
        if not jti:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="State token missing nonce (jti)",
            )
        if await oauth_state_store.is_used(jti):
            logger.warning(
                f"OAuth state nonce replayed: jti={jti[:16]}... provider={provider}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="State token has already been used — possible replay attack",
            )
        await oauth_state_store.mark_used(jti)

        result = await auth_service.oauth_authenticate(
            provider=provider.upper(), code=code, redirect_uri=redirect_uri
        )

        # Extract tokens
        tokens = result.get("tokens") or {}
        access_token = tokens.get("access_token")
        refresh_token_val = tokens.get("refresh_token")

        # SECURITY: Tokens are set ONLY in HTTP-only cookies, never in URL params
        frontend_url = setting.FRONTEND_URL
        query_params = {"oauth_success": "true"}

        redirect_url = f"{frontend_url}/?{urlencode(query_params)}"
        response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)

        if access_token:
            response.set_cookie(
                key="access_token",
                value=access_token,
                httponly=True,
                secure=True,
                samesite="lax",
                max_age=setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                path="/",
                domain=setting.COOKIE_DOMAIN or None,
            )

        if refresh_token_val:
            response.set_cookie(
                key="refresh_token",
                value=refresh_token_val,
                httponly=True,
                secure=True,
                samesite="lax",
                max_age=setting.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
                path="/",
                domain=setting.COOKIE_DOMAIN or None,
            )

        # Edge middleware session cookie
        user_data = result.get("user", {})
        if user_data.get("id"):
            set_session_cookie(response, user_data["id"], user_data.get("role"))

        return response

    except ValueError as e:
        frontend_url = setting.FRONTEND_URL
        error_params = urlencode(
            {"oauth_error": "true", "error": str(e), "provider": provider.lower()}
        )
        return RedirectResponse(
            url=f"{frontend_url}/auth/login-failed?{error_params}",
            status_code=status.HTTP_302_FOUND,
        )
    except Exception as e:
        logger.exception(f"OAuth GET callback error: {type(e).__name__}")
        frontend_url = setting.FRONTEND_URL
        error_params = urlencode(
            {
                "oauth_error": "true",
                "error": "Authentication failed. Please try again.",
                "provider": provider.lower(),
            }
        )
        return RedirectResponse(
            url=f"{frontend_url}/auth/login-failed?{error_params}",
            status_code=status.HTTP_302_FOUND,
        )


@router.post("/oauth/{provider}/login")
async def oauth_login(provider: str, callback_data: OAuthCallback, response: Response):
    """Alternative OAuth login endpoint that sets cookies."""
    try:
        # SECURITY: State token is MANDATORY for CSRF protection
        if not callback_data.state:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing state token — possible CSRF attack",
            )
        state_payload = verify_token(callback_data.state)
        if not state_payload or state_payload.get("provider") != provider.upper():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid state token"
            )

        # SECURITY: Replay protection — state nonce (jti) must be single-use
        jti = state_payload.get("jti")
        if not jti:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="State token missing nonce (jti)",
            )
        if await oauth_state_store.is_used(jti):
            logger.warning(
                f"OAuth state nonce replayed: jti={jti[:16]}... provider={provider}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="State token has already been used — possible replay attack",
            )
        await oauth_state_store.mark_used(jti)

        result = await auth_service.oauth_authenticate(
            provider=provider.upper(),
            code=callback_data.code,
            redirect_uri=callback_data.redirect_uri,
        )

        tokens = result["tokens"]

        # Set cookies
        response.set_cookie(
            key="access_token",
            value=tokens["access_token"],
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            path="/",
            domain=setting.COOKIE_DOMAIN or None,
        )

        response.set_cookie(
            key="refresh_token",
            value=tokens["refresh_token"],
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=setting.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
            path="/",
            domain=setting.COOKIE_DOMAIN or None,
        )

        # Edge middleware session cookie
        user_data = result.get("user", {})
        if user_data.get("id"):
            set_session_cookie(response, user_data["id"], user_data.get("role"))

        return {"message": "OAuth login successful", "user": result["user"]}

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.get("/oauth/{provider}/redirect")
async def oauth_redirect_frontend(provider: str, redirect_uri: Optional[str] = None):
    """Simple redirect endpoint for frontend OAuth flows."""
    try:
        auth_url = await auth_service.get_oauth_authorization_url(
            provider.upper(), redirect_uri
        )

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Redirecting to {provider}</title>
            <script>
                window.location.href = "{auth_url}";
            </script>
        </head>
        <body>
            <p>Redirecting to {provider} authentication...</p>
            <p>If you are not redirected automatically, <a href="{auth_url}">click here</a>.</p>
        </body>
        </html>
        """

        from fastapi.responses import HTMLResponse

        return HTMLResponse(content=html_content)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to redirect: {str(e)}",
        )


@router.post("/ws-ticket")
async def create_ws_ticket(user=Depends(get_current_active_user)):
    ticket = secrets.token_urlsafe(32)
    r = aioredis.from_url(
        setting.REDIS_URL, decode_responses=True, socket_connect_timeout=2
    )
    try:
        await r.setex(f"ws_ticket:{ticket}", 30, str(user.id))
    finally:
        await r.close()
    return {"ticket": ticket}


class MagicLinkRequest(BaseModel):
    email: EmailStr
    locale: Optional[str] = "en"


class MagicLinkVerifyRequest(BaseModel):
    token: str = Field(..., min_length=16)


@router.post("/magic-link", status_code=status.HTTP_200_OK)
async def request_magic_link(
    body: MagicLinkRequest,
    request: Request,
):
    """Request a passwordless sign-in magic link."""
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    return await MagicLinkService.request_magic_link(
        email=body.email,
        client_ip=client_ip,
        user_agent=user_agent,
        locale=body.locale or "en",
    )


@router.post("/magic-link/verify", status_code=status.HTTP_200_OK)
async def verify_magic_link(
    body: MagicLinkVerifyRequest,
    request: Request,
    response: Response,
):
    """Verify passwordless sign-in magic link and set session cookies."""
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    try:
        (
            user_dict,
            access_token,
            refresh_token,
        ) = await MagicLinkService.verify_magic_link(
            raw_token=body.token,
            client_ip=client_ip,
            user_agent=user_agent,
        )

        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=setting.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            path="/",
            domain=setting.COOKIE_DOMAIN or None,
        )
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=setting.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
            path="/",
            domain=setting.COOKIE_DOMAIN or None,
        )

        return {
            "message": "Successfully authenticated",
            "user": user_dict,
            "access_token": access_token,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Magic link verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed",
        )


class StepUpRequest(BaseModel):
    code: str
    method: str = "totp"
    required_acr: str = "urn:podacium:loa:2"


@router.post("/step-up")
async def step_up_authenticate(
    body: StepUpRequest,
    current_user=Depends(get_current_user),
):
    """
    RFC 9470 Step-Up Authentication endpoint.
    Verifies 2FA / WebAuthn / TOTP factor and issues a high-assurance Step-Up Access Token.
    """
    from app.services.mfa_service import mfa_service
    import jwt as pyjwt

    valid = await mfa_service.verify_challenge(
        current_user.id, body.method, body.code.strip()
    )
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_MFA_CODE", "message": "Invalid verification code"},
        )

    now = int(datetime.now(timezone.utc).timestamp())
    payload = {
        "sub": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
        "type": "access",
        "acr": body.required_acr,
        "amr": ["pwd", body.method],
        "auth_time": now,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "iat": datetime.now(timezone.utc),
    }
    step_up_token = pyjwt.encode(payload, _get_signing_key(), algorithm=ALGORITHM)
    return {
        "success": True,
        "data": {
            "step_up_token": step_up_token,
            "acr": body.required_acr,
            "auth_time": now,
        },
    }


@router.get("/auth/session-revocation-status")
async def get_session_revocation_status(user_id: int):
    """
    Sub-3ms Edge Session Revocation Status Check.
    Queries Redis directly for user session revocation epoch without hitting PostgreSQL.
    """
    from app.core.redis_blocklist import token_blocklist

    revoked_at = await token_blocklist.get_user_min_iat(user_id)
    return {"user_id": user_id, "revoked_at": revoked_at}
