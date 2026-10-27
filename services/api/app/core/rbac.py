# services/api/app/core/rbac.py
"""
Multi-Tier Sub-Admin Role-Based Access Control (RBAC) Engine.
Enforces NIST SP 800-53 (AC-2/AC-5/AC-6) and SOC 2 Type II least privilege.
"""

import hashlib
import ipaddress
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Set
from fastapi import Depends, HTTPException, Request, status

from app.core.auth import get_current_active_user
from app.core.prisma import prisma
from app.core.redis import get_redis

logger = logging.getLogger("podacium.rbac")

CACHE_TTL_SECONDS = 60


def is_ip_allowed(client_ip_str: str, allowed_subnets: List[str]) -> bool:
    """Check if client IP matches any allowed CIDR subnets."""
    if not allowed_subnets:
        return True
    try:
        client_ip = ipaddress.ip_address(client_ip_str)
        for subnet_str in allowed_subnets:
            cleaned = subnet_str.strip()
            if not cleaned:
                continue
            if "/" not in cleaned:
                cleaned = f"{cleaned}/32" if ":" not in cleaned else f"{cleaned}/128"
            network = ipaddress.ip_network(cleaned, strict=False)
            if client_ip in network:
                return True
        return False
    except Exception as e:
        logger.warning(
            f"Error validating IP {client_ip_str} against subnets {allowed_subnets}: {e}"
        )
        return False


def get_client_ip(request: Request) -> str:
    """Extract client IP handling reverse proxy headers safely via trusted CIDRs."""
    from app.core.auth import get_client_ip as _get_client_ip

    return _get_client_ip(request)


async def get_user_effective_permissions(user_id: int) -> Set[str]:
    """Retrieve effective permissions from Redis or hydrate from PostgreSQL."""
    redis = await get_redis()
    cache_key = f"rbac:perms:{user_id}"

    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return set(json.loads(cached))
        except Exception as e:
            logger.warning(f"Redis permission cache read error for user {user_id}: {e}")

    # Hydrate from PostgreSQL database
    profile = await prisma.adminprofile.find_unique(
        where={"userId": user_id},
        include={
            "roleAssignments": {
                "include": {
                    "role": {
                        "include": {
                            "permissions": {
                                "include": {
                                    "permission": True,
                                }
                            }
                        }
                    }
                }
            }
        },
    )

    if not profile or not profile.isActive or profile.suspendedAt is not None:
        return set()

    # Super admin wildcard bypass
    if profile.department == "SUPER_ADMIN":
        # Load all system permissions
        all_perms = await prisma.adminpermission.find_many()
        super_perms = {p.code for p in all_perms}
        super_perms.add("*")
        if redis:
            try:
                await redis.set(
                    cache_key, json.dumps(list(super_perms)), ex=CACHE_TTL_SECONDS
                )
            except Exception as e:
                logger.warning(f"Redis permission cache write error: {e}")
        return super_perms

    perms: Set[str] = set()
    now = datetime.now(timezone.utc)
    for assignment in profile.roleAssignments:
        if assignment.expiresAt and assignment.expiresAt < now:
            continue
        for rp in assignment.role.permissions:
            if rp.permission and rp.permission.code:
                perms.add(rp.permission.code)

    if redis:
        try:
            await redis.set(cache_key, json.dumps(list(perms)), ex=CACHE_TTL_SECONDS)
        except Exception as e:
            logger.warning(f"Redis permission cache write error: {e}")

    return perms


async def invalidate_permission_cache(user_id: int) -> None:
    """Invalidate cached permissions in Redis when roles change."""
    redis = await get_redis()
    if redis:
        try:
            await redis.delete(f"rbac:perms:{user_id}")
        except Exception as e:
            logger.warning(
                f"Failed to invalidate permission cache for user {user_id}: {e}"
            )


def require_permissions(*required_permissions: str):
    """
    FastAPI Dependency enforcing granular multi-tier permissions and IP subnet restrictions.
    """

    async def permission_checker(
        request: Request,
        current_user=Depends(get_current_active_user),
    ):
        admin_profile = await prisma.adminprofile.find_unique(
            where={"userId": current_user.id}
        )

        # 1. IP Subnet CIDR Enforcement (NIST AC-6 / SOC 2 CC6.1)
        allowed_subnets = getattr(admin_profile, "allowedIpSubnets", None)
        if (
            allowed_subnets
            and isinstance(allowed_subnets, (list, tuple))
            and any(isinstance(s, str) and s.strip() for s in allowed_subnets)
        ):
            client_ip = get_client_ip(request)
            valid_subnets = [
                s for s in allowed_subnets if isinstance(s, str) and s.strip()
            ]
            if not is_ip_allowed(client_ip, valid_subnets):
                logger.warning(
                    f"Access DENIED for admin user {current_user.id} from unauthorized IP '{client_ip}'. "
                    f"Allowed subnets: {allowed_subnets}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "message": "Access denied: client IP address is not permitted for this administrative profile",
                        "code": "FORBIDDEN_IP_SUBNET",
                        "client_ip": client_ip,
                    },
                )

        if admin_profile:
            request.state.admin_profile = admin_profile
            session_id = getattr(request.state, "session_id", None)
            from app.services.audit_trail_service import current_session_id_ctx

            if session_id:
                current_session_id_ctx.set(session_id)
            else:
                token_hash = hashlib.sha256(
                    f"adm_{current_user.id}_{datetime.now(timezone.utc).timestamp()}".encode()
                ).hexdigest()
                admin_session = await prisma.adminsession.create(
                    data={
                        "adminProfileId": admin_profile.id,
                        "tokenHash": token_hash,
                        "ipAddress": get_client_ip(request),
                        "userAgent": request.headers.get("user-agent", "unknown"),
                        "mfaVerified": True,
                        "expiresAt": datetime.now(timezone.utc) + timedelta(hours=8),
                        "lastActivityAt": datetime.now(timezone.utc),
                    }
                )
                request.state.session_id = admin_session.id
                current_session_id_ctx.set(admin_session.id)

        # 2. Super Admin bypass check
        if getattr(current_user, "role", None) == "ADMIN":
            if (
                admin_profile
                and admin_profile.department == "SUPER_ADMIN"
                and admin_profile.isActive
            ):
                return current_user

        # 3. Evaluate effective permissions
        user_perms = await get_user_effective_permissions(current_user.id)
        if "*" in user_perms:
            return current_user

        missing = [p for p in required_permissions if p not in user_perms]

        if missing:
            logger.warning(
                f"Access DENIED for user {current_user.id} on '{request.url.path}'. Missing permissions: {missing}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "Access denied: insufficient administrative privileges",
                    "code": "FORBIDDEN_PERMISSION_REQUIRED",
                    "missing_permissions": missing,
                },
            )

        return current_user

    return permission_checker
