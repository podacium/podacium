import asyncio
import hashlib
import ipaddress
import logging
import secrets
from datetime import datetime
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.security import (
    verify_token,
    is_token_blocklisted_locally,
    is_user_blocklisted,
)
from app.core.redis_blocklist import token_blocklist
from app.core.prisma import prisma
from app.middleware.device_fingerprint import register_device_background

router = APIRouter()
security = HTTPBearer(auto_error=False)
security_optional = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Reverse Proxy Trusted CIDRs & Client IP Extraction (VULN-W2-10)
# ---------------------------------------------------------------------------

TRUSTED_PROXY_NETWORKS: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = [
    # Loopback
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    # Docker bridge & internal container subnets (RFC 1918)
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network(
        "172.16.0.0/12"
    ),  # covers 172.16.0.0/12 including Docker 172.17.x, 172.18.x
    ipaddress.ip_network("192.168.0.0/16"),
    # IPv6 private / link-local
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    # Cloudflare IPv4 ranges
    ipaddress.ip_network("173.245.48.0/20"),
    ipaddress.ip_network("103.21.244.0/22"),
    ipaddress.ip_network("103.22.200.0/22"),
    ipaddress.ip_network("103.31.4.0/22"),
    ipaddress.ip_network("141.101.64.0/18"),
    ipaddress.ip_network("108.162.192.0/18"),
    ipaddress.ip_network("190.93.240.0/20"),
    ipaddress.ip_network("188.114.96.0/20"),
    ipaddress.ip_network("197.234.240.0/22"),
    ipaddress.ip_network("198.41.128.0/17"),
    ipaddress.ip_network("162.158.0.0/15"),
    ipaddress.ip_network("104.16.0.0/13"),
    ipaddress.ip_network("104.24.0.0/14"),
    ipaddress.ip_network("172.64.0.0/13"),
    ipaddress.ip_network("131.0.72.0/22"),
    # Cloudflare IPv6 ranges
    ipaddress.ip_network("2400:cb00::/32"),
    ipaddress.ip_network("2606:4700::/32"),
    ipaddress.ip_network("2803:f800::/32"),
    ipaddress.ip_network("2405:b500::/32"),
    ipaddress.ip_network("2405:8100::/32"),
    ipaddress.ip_network("2a06:98c0::/29"),
    ipaddress.ip_network("2c0f:f248::/32"),
]


def is_trusted_proxy(ip_str: str) -> bool:
    """Check if an IP address falls within trusted reverse proxy subnets."""
    try:
        ip = ipaddress.ip_address(ip_str.strip())
        return any(ip in net for net in TRUSTED_PROXY_NETWORKS)
    except ValueError:
        return False


def get_client_ip(request: Optional[Request]) -> str:
    """Resolve the real client IP address through reverse proxies (Docker, Caddy, Cloudflare).

    Validates that intermediary hops belong to trusted reverse proxy CIDRs rather than
    blindly trusting headers or falling victim to Docker subnet blindness (172.18.x.x).
    """
    if request is None:
        return "127.0.0.1"

    peer_host = request.client.host if request.client else None

    # Only inspect forwarded headers if peer is absent (e.g. test client) or is a trusted proxy
    if peer_host is None or is_trusted_proxy(peer_host):
        # 1. Cloudflare edge header
        cf_ip = request.headers.get("cf-connecting-ip")
        if cf_ip:
            cf_ip_clean = cf_ip.strip()
            try:
                ipaddress.ip_address(cf_ip_clean)
                return cf_ip_clean
            except ValueError:
                pass

        # 2. X-Forwarded-For: traverse right-to-left to find first non-trusted IP
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            hops = [h.strip() for h in forwarded_for.split(",") if h.strip()]
            for hop in reversed(hops):
                try:
                    ip_obj = ipaddress.ip_address(hop)
                    if not is_trusted_proxy(str(ip_obj)):
                        return str(ip_obj)
                except ValueError:
                    continue
            # If all hops are trusted (e.g. internal network/test), pick leftmost valid IP
            for hop in hops:
                try:
                    ipaddress.ip_address(hop)
                    return hop
                except ValueError:
                    continue

        # 3. X-Real-IP
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            real_ip_clean = real_ip.strip()
            try:
                ipaddress.ip_address(real_ip_clean)
                return real_ip_clean
            except ValueError:
                pass

    if peer_host:
        return peer_host

    return "127.0.0.1"


# ---------------------------------------------------------------------------
# Device Fingerprint Binding Helpers (VULN-W2-10)
# ---------------------------------------------------------------------------


def hash_device_fingerprint(raw_fingerprint: str) -> str:
    """Compute deterministic SHA-256 hex digest of a client device fingerprint."""
    if not raw_fingerprint:
        return ""
    return hashlib.sha256(raw_fingerprint.strip().encode()).hexdigest()


def verify_device_fingerprint_binding(
    token_fpt: Optional[str],
    raw_fingerprint: Optional[str],
) -> bool:
    """Verify raw fingerprint against the expected token fpt claim in constant time.

    If token_fpt is None/empty (legacy or unbound token), passes.
    If token_fpt is present, raw_fingerprint must match its SHA-256 hash.
    """
    if not token_fpt:
        return True
    if not raw_fingerprint:
        return False
    computed = hash_device_fingerprint(raw_fingerprint)
    return secrets.compare_digest(token_fpt, computed)


# -------------------------------
# Dependencies
# -------------------------------


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    include_relations: bool = False,
):
    """Extract and validate the current user from JWT bearer token (Header or Cookie)."""
    token = None

    # 1. Try to get token from Authorization Header
    if credentials:
        token = credentials.credentials

    # 2. If no header, try to get from HTTP-only Cookie or X-API-Key header
    if not token and request is not None:
        token = (
            request.cookies.get("__Host-access_token")
            or request.cookies.get("access_token")
            or request.headers.get("X-API-Key")
            or request.headers.get("x-api-key")
        )

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="errors.auth.invalid_credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Support API Keys starting with sk_
    if token.startswith("sk_"):
        from app.services.api_key_service import api_key_service

        key_ctx = await api_key_service.verify_api_key_context(token)
        if not key_ctx:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="errors.auth.invalid_api_key",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if request is not None:
            request.state.api_key = key_ctx
            request.state.api_key_scopes = set(key_ctx.scopes)
            from app.core.api_key_rate_limiter import enforce_api_key_rate_limit

            await enforce_api_key_rate_limit(request, key_ctx.key_id)

        user = await prisma.user.find_unique(where={"id": key_ctx.user_id})
        if not user or user.isBanned or user.deletedAt:
            raise HTTPException(status_code=401, detail="User account restricted")
        return user

    # Check local blocklist cache first (performance optimization)
    if is_token_blocklisted_locally(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="errors.auth.token_revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_token(token)

    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="errors.auth.invalid_credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    token_iat = int(payload.get("iat", 0))
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="errors.auth.invalid_token",
        )

    # 🔒 Cryptographic device fingerprint binding verification (VULN-W2-10)
    token_fpt = payload.get("fpt")
    if token_fpt:
        raw_fingerprint = ""
        if request is not None:
            raw_fingerprint = (
                request.headers.get("X-Fingerprint")
                or request.headers.get("x-fingerprint")
                or request.cookies.get("x-fingerprint")
                or ""
            )
        if not raw_fingerprint:
            logger.warning(
                f"Device fingerprint required but missing for user {user_id}"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="errors.auth.device_fingerprint_required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not verify_device_fingerprint_binding(token_fpt, raw_fingerprint):
            logger.warning(f"Device fingerprint mismatch for user {user_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="errors.auth.device_fingerprint_mismatch",
                headers={"WWW-Authenticate": "Bearer"},
            )

    try:
        user_id_int = int(user_id)

        # PERSISTENT REVOCATION & USER DATA (Parallelized for performance)
        includes = {}
        if include_relations:
            includes = {
                "skillsDetails": True,
                "primaryOrganization": True,
                "ownedOrganizations": True,
                "memberships": {"include": {"organization": True}},
            }

        # Parallel fetch: User data + Async Distributed Token Blocklist + User min_iat revocation check
        user_task = prisma.user.find_unique(
            where={"id": user_id_int}, include=includes if includes else None
        )
        token_blocklist_task = token_blocklist.contains(token)
        user_blocklist_task = is_user_blocklisted(user_id_int, token_iat)

        user, token_is_blocked, user_is_blocklisted = await asyncio.gather(
            user_task, token_blocklist_task, user_blocklist_task
        )

        if token_is_blocked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="errors.auth.token_revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="errors.auth.user_not_found",
            )

        # SECURITY: User-level timestamp revocation check (password reset / forced logout)
        if user_is_blocklisted:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="errors.auth.token_revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Invalidate if token was issued prior to user's last password change
        last_pwd = getattr(user, "lastPasswordChangeAt", None)
        if isinstance(last_pwd, datetime) and isinstance(token_iat, (int, float)):
            pwd_change_ts = int(last_pwd.timestamp())
            if token_iat < pwd_change_ts:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="errors.auth.password_changed",
                    headers={"WWW-Authenticate": "Bearer"},
                )

        # SECURITY: Account Lockout / Deactivation check
        if getattr(user, "deletedAt", None):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.auth.account_deleted",
            )

        is_active = getattr(user, "isActive", True)
        is_deactivated = getattr(user, "isDeactivated", False)
        deactivated_at = getattr(user, "deactivatedAt", None)
        if not is_active or is_deactivated or deactivated_at:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.auth.account_deactivated",
            )

        if getattr(user, "isBanned", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.auth.user_banned",
            )

        # -------------------------------------------------------------
        # AdminSession Traceability & Revocation Check (HIGH-ADM-03)
        # -------------------------------------------------------------
        session_id = payload.get("session_id")
        admin_session = None
        if session_id:
            admin_session = await prisma.adminsession.find_unique(
                where={"id": session_id}
            )
        else:
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            admin_session = await prisma.adminsession.find_unique(
                where={"tokenHash": token_hash}
            )

        if admin_session:
            if admin_session.revokedAt is not None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="errors.auth.token_revoked",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            if request:
                request.state.session_id = admin_session.id
            from app.services.audit_trail_service import current_session_id_ctx

            current_session_id_ctx.set(admin_session.id)

        # -------------------------------------------------------------
        # Retool/Vanta Guardrails: Ephemeral Impersonation Check (2.1)
        # -------------------------------------------------------------
        actor = payload.get("actor")
        if actor:
            if request:
                request.state.actor = actor
                request.state.is_impersonated = True
            from app.services.audit_trail_service import current_impersonator_id_ctx

            actor_id = actor.get("id")
            if actor_id:
                try:
                    current_impersonator_id_ctx.set(int(actor_id))
                except (ValueError, TypeError):
                    pass

            if request:
                method = request.method.upper()
                if method in ["POST", "PUT", "PATCH", "DELETE"]:
                    path = request.url.path.lower()
                    blocked_prefixes = (
                        "/api/billing",
                        "/billing",
                        "/api/wallets/withdraw",
                        "/wallets/withdraw",
                        "/api/payouts",
                        "/payouts",
                        "/api/auth/password",
                        "/auth/password",
                        "/api/auth/mfa",
                        "/auth/mfa",
                        "/api/auth/webauthn",
                        "/auth/webauthn",
                    )
                    if any(path.startswith(prefix) for prefix in blocked_prefixes):
                        logger.warning(
                            f"IMPERSONATION BLOCKED: Actor {actor.get('email')} attempted mutating operation {method} {path}"
                        )
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail={
                                "code": "IMPERSONATION_FINANCIAL_MUTATION_BLOCKED",
                                "message": "Financial and security credential mutations are strictly prohibited during active impersonation sessions.",
                            },
                        )

    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="errors.auth.invalid_user_id",
        )
    except Exception as e:
        logger.error(f"Security error during user validation: {type(e).__name__}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.auth.internal_server_error",
        )

    # Ensure skills is always a list (handle None case)
    if user.skills is None:
        user.skills = []

    # Ensure socialLinks is properly handled (handle JSON string case)
    if user.socialLinks and isinstance(user.socialLinks, str):
        try:
            import json

            user.socialLinks = json.loads(user.socialLinks)
        except Exception:
            user.socialLinks = {}

    # Fire-and-forget device fingerprint registration
    # Only register when X-Fingerprint header is present from real FingerprintJS.
    # The UA:IP fallback creates hash collisions and duplicates because it produces
    # a different fingerprint hash than the real FingerprintJS visitorId.
    try:
        fingerprint = request.headers.get("X-Fingerprint", "") if request else ""
        if fingerprint and user:
            asyncio.ensure_future(
                register_device_background(user.id, fingerprint, request)
            )
    except Exception:
        pass

    return user


async def get_token_payload(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
) -> dict[str, Any]:
    """Extract and return the verified JWT payload."""
    token = None
    if credentials:
        token = credentials.credentials
    if not token and request is not None:
        token = (
            request.cookies.get("__Host-access_token")
            or request.cookies.get("access_token")
            or request.headers.get("X-API-Key")
            or request.headers.get("x-api-key")
        )
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="errors.auth.invalid_credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = verify_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="errors.auth.invalid_credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 🔒 Cryptographic device fingerprint binding verification (VULN-W2-10)
    token_fpt = payload.get("fpt")
    if token_fpt:
        raw_fingerprint = ""
        if request is not None:
            raw_fingerprint = (
                request.headers.get("X-Fingerprint")
                or request.headers.get("x-fingerprint")
                or request.cookies.get("x-fingerprint")
                or ""
            )
        if not raw_fingerprint or not verify_device_fingerprint_binding(
            token_fpt, raw_fingerprint
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="errors.auth.device_fingerprint_mismatch",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return payload


async def get_current_active_user(current_user=Depends(get_current_user)):
    """Check if user is active (not deleted)."""
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="errors.auth.validation_failed",
        )

    # Check if user account is deactivated
    if hasattr(current_user, "deletedAt") and current_user.deletedAt is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.auth.account_deactivated",
        )

    return current_user


async def verify_organization_access(
    organization_id: Optional[int],
    user: Any,
) -> int:
    """
    Verify that the user is authorized for the given organization_id.
    If organization_id is None, defaults to user.primaryOrganizationId.
    If user is not authorized, raises HTTP 403 Forbidden.
    Returns the resolved organization_id.
    """
    user_org = getattr(user, "primaryOrganizationId", None) or getattr(
        user, "organization_id", None
    )
    org_id = organization_id or user_org
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization ID is required and primaryOrganizationId is not set",
        )

    # Allow platform ADMIN bypass
    if getattr(user, "role", "") == "ADMIN" or getattr(user, "is_admin", False):
        return org_id

    # Always verify active membership or ownership in Organization
    from app.core.prisma import prisma

    user_id = getattr(user, "id", 0)
    org = await prisma.organization.find_first(where={"id": org_id, "deletedAt": None})
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization {org_id} not found or inactive",
        )

    if org.ownerId == user_id:
        return org_id

    member = await prisma.organizationmember.find_first(
        where={
            "organizationId": org_id,
            "userId": user_id,
            "deletedAt": None,
        }
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Unauthorized access to organization {org_id}",
        )

    return org_id


async def get_current_verified_user(
    current_user=Depends(get_current_active_user),
    token_payload: Optional[dict] = Depends(get_token_payload),
):
    """Require that the user has verified their email address.

    Checks BOTH:
    1. Token-level scope claim (defense-in-depth against scope elevation)
    2. Database emailVerified field
    """
    # 🔒 Token-level scope check: if the token carries scope=email_unverified,
    # reject even if the DB record was somehow marked verified.
    if token_payload and token_payload.get("scope") == "email_unverified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.auth.email_not_verified",
        )

    if not current_user.emailVerified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.auth.email_not_verified",
        )
    return current_user


async def get_current_admin_user(current_user=Depends(get_current_active_user)):
    """Require ADMIN role exclusively."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.auth.admin_access_required",
        )
    return current_user


async def get_current_staff_user(current_user=Depends(get_current_active_user)):
    """Require ADMIN or INSTRUCTOR role for staff operations."""
    if current_user.role not in ["ADMIN", "INSTRUCTOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.auth.insufficient_permissions",
        )
    return current_user


async def get_current_super_admin(current_user=Depends(get_current_active_user)):
    """Require ADMIN role exclusively (platform administration access)."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.auth.admin_access_required",
        )
    return current_user


async def get_current_admin_only(current_user=Depends(get_current_active_user)):
    """Require the ADMIN role exclusively — stricter than get_current_super_admin.

    Moderators are excluded so they cannot escalate their own privileges.
    Use this on any endpoint that changes roles or manages accounts.
    """
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.auth.admin_access_required",
        )
    return current_user


def is_privileged_role(role: str) -> bool:
    """True for roles that may see unpublished content (ADMIN, MODERATOR)."""
    return role in ("ADMIN", "MODERATOR")


security_optional = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
) -> Optional[dict]:
    """
    Get the current user from Bearer token or cookie, but don't raise 401 if missing.
    Returns None if no valid token is found.
    """
    if not credentials and not request.cookies.get("access_token"):
        return None
    # Any exception here (401, etc.) should propagate
    return await get_current_user(request, credentials=credentials)


# Alias for backward compatibility across routers
get_optional_current_user = get_current_user_optional


def require_permission(permission: str):
    """
    Attribute-Based Access Control (ABAC) dependency factory.
    Scopes: 'content:review', 'financial:audit', 'user:ban', 'kyc:approve', 'dispute:arbitrate', etc.
    """

    async def permission_checker(current_user=Depends(get_current_active_user)):
        # Super admin has all permissions
        if current_user.role == "ADMIN":
            return current_user

        # Check explicit permissions or role mappings
        role_permissions = {
            "MODERATOR": {"content:review", "kyc:approve", "dispute:arbitrate"},
            "INSTRUCTOR": {"content:review"},
        }
        allowed = role_permissions.get(current_user.role, set())
        if permission not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"errors.auth.missing_permission_{permission.replace(':', '_')}",
            )
        return current_user

    return permission_checker


async def require_recent_2fa(
    request: Request,
    current_user=Depends(get_current_active_user),
    max_age_seconds: int = 300,
):
    """
    Enforces Step-Up 2FA verification for high-risk operations (dispute payout, role change).
    Validates cryptographically signed step-up JWT token from X-2FA-Token / X-Step-Up-Token header.
    """
    from app.core.prisma import prisma

    two_factor_enabled = getattr(current_user, "twoFactorEnabled", False)
    if not two_factor_enabled:
        sec = await prisma.securitysettings.find_unique(
            where={"userId": current_user.id}
        )
        if sec and (
            sec.twoFactorEnabled or sec.webauthnEnabled or sec.emailOtpVerified
        ):
            two_factor_enabled = True

    # If user does not have 2FA enabled, they are not blocked
    if not two_factor_enabled:
        return current_user

    step_up_token = (
        request.headers.get("X-2FA-Token")
        or request.headers.get("X-Step-Up-Token")
        or request.headers.get("X-2FA-Timestamp")
    )

    if not step_up_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.auth.step_up_2fa_required",
        )

    try:
        from app.core.security import verify_token

        payload = verify_token(step_up_token)
        if (
            not payload
            or payload.get("type") != "step_up"
            or payload.get("sub") != str(current_user.id)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.auth.step_up_2fa_expired",
            )

        # Check if admin profile requires hardware key (WebAuthn / FIDO2)
        admin_profile = await prisma.adminprofile.find_unique(
            where={"userId": current_user.id}
        )
        if admin_profile and admin_profile.hardwareKeyRequired:
            auth_method = payload.get("auth_method")
            if auth_method != "webauthn":
                logger.warning(
                    f"Admin user {current_user.id} attempted step-up with method '{auth_method}' but hardware key is required"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "message": "FIDO2 / WebAuthn hardware security key authentication is required for this administrative profile",
                        "code": "HARDWARE_KEY_REQUIRED",
                    },
                )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.auth.invalid_2fa_token",
        )

    return current_user


def require_scope(required_scope: str):
    """
    FastAPI endpoint dependency enforcing granular API key scope checks.
    Interactive session users bypass API key scope checks; API key callers
    must satisfy the required permission scope.
    """
    from app.core.scopes import check_scope_match

    async def _scope_guard(request: Request, current_user=Depends(get_current_user)):
        key_ctx = getattr(request.state, "api_key", None)
        if key_ctx is not None:
            if not check_scope_match(key_ctx.scopes, required_scope):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": "insufficient_scope",
                        "message": f"API key lacks required scope: {required_scope}",
                        "required_scope": required_scope,
                        "granted_scopes": key_ctx.scopes,
                    },
                )
        return current_user

    return _scope_guard
