"""
RFC 9470 Step-Up Authentication Challenge Protocol Engine.

Evaluates:
- ACR (Authentication Context Class Reference): e.g. urn:podacium:loa:1, loa:2, loa:3
- AMR (Authentication Methods References): e.g. ["pwd"], ["pwd", "totp"], ["webauthn"]
- Ephemeral auth_time freshness relative to max_age
"""

from datetime import datetime, timezone
from typing import Callable
from fastapi import HTTPException, status, Depends

from app.core.auth import get_current_user, get_token_payload
from app.generated.prisma.models import User

ACR_HIERARCHY = {
    "urn:podacium:loa:1": 1,
    "urn:podacium:loa:2": 2,
    "urn:podacium:loa:3": 3,
}


def require_step_up(
    required_acr: str = "urn:podacium:loa:2",
    max_auth_age_seconds: int = 300,
) -> Callable:
    """
    Enforces RFC 9470 Step-Up Authentication on sensitive endpoints.

    Raises HTTP 401 with standard RFC 9470 WWW-Authenticate challenge header
    if the presenting token lacks sufficient assurance or is too old.
    """

    async def step_up_guard(
        current_user: User = Depends(get_current_user),
        token_payload: dict = Depends(get_token_payload),
    ) -> User:
        token_acr = token_payload.get("acr", "urn:podacium:loa:1")
        auth_time = token_payload.get("auth_time")

        current_level = ACR_HIERARCHY.get(token_acr, 1)
        required_level = ACR_HIERARCHY.get(required_acr, 2)

        now = int(datetime.now(timezone.utc).timestamp())
        is_fresh = (
            auth_time is not None and (now - int(auth_time)) <= max_auth_age_seconds
        )

        if current_level < required_level or not is_fresh:
            www_auth = (
                f'Bearer error="insufficient_user_authentication", '
                f'error_description="Action requires step-up authentication", '
                f'acr_values="{required_acr}", '
                f"max_age={max_auth_age_seconds}"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "STEP_UP_REQUIRED",
                    "message": "Step-up authentication required for this operation",
                    "required_acr": required_acr,
                    "max_age": max_auth_age_seconds,
                },
                headers={"WWW-Authenticate": www_auth},
            )

        return current_user

    return step_up_guard
