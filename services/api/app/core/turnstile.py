"""
Cloudflare Turnstile Token Verifier Module.
"""

import logging
from typing import Optional
import httpx

from app.core.config import setting

logger = logging.getLogger(__name__)

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile_token(
    token: Optional[str], client_ip: Optional[str] = None
) -> bool:
    """
    Verifies Cloudflare Turnstile token with Turnstile Siteverify API.
    Bypasses verification if TURNSTILE_SECRET_KEY is not configured or in dev/test mode.
    """
    secret = getattr(setting, "TURNSTILE_SECRET_KEY", "").strip()

    # If no secret key is set or setting is in test environment, bypass token validation
    if not secret or getattr(setting, "ENVIRONMENT", "") == "test":
        return True

    if not token:
        logger.warning("Turnstile token missing when verification was requested")
        return False

    payload = {
        "secret": secret,
        "response": token,
    }
    if client_ip:
        payload["remoteip"] = client_ip

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(TURNSTILE_VERIFY_URL, data=payload)
            if resp.status_code != 200:
                logger.error(f"Turnstile API returned HTTP status {resp.status_code}")
                return False

            data = resp.json()
            success = bool(data.get("success", False))
            if not success:
                logger.warning(
                    f"Turnstile verification failed. Errors: {data.get('error-codes', [])}"
                )
            return success
    except Exception as e:
        logger.error(f"Exception during Turnstile token verification: {e}")
        # Fail closed on network/verification errors in production if key is present
        return False
