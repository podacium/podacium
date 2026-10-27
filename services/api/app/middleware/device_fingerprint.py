"""Device fingerprint middleware — fire-and-forget device registration.

On every authenticated request, reads the X-Fingerprint header from the
frontend, hashes it, and registers/updates the device in the background.
Extracts OS, browser, and device info from User-Agent headers.
"""

import logging
import re
import time
from typing import Dict
from fastapi import Request

logger = logging.getLogger(__name__)

_last_registered: Dict[str, float] = {}
_RATE_LIMIT_SECONDS = 60


def _extract_os(ua: str) -> str:
    """Extract OS name and version from User-Agent string."""
    ua_lower = ua.lower()
    if "windows nt 10" in ua_lower:
        return "Windows 10"
    if "windows nt 11" in ua_lower:
        return "Windows 11"
    if "windows nt 6.3" in ua_lower:
        return "Windows 8.1"
    if "windows nt 6.2" in ua_lower:
        return "Windows 8"
    if "windows nt 6.1" in ua_lower:
        return "Windows 7"
    if "windows" in ua_lower:
        return "Windows"
    if "mac os x" in ua_lower:
        m = re.search(r"mac os x (\d+[._]\d+)", ua_lower)
        return f"macOS {m.group(1).replace('_', '.')}" if m else "macOS"
    if "android" in ua_lower:
        m = re.search(r"android (\d+(?:\.\d+)?)", ua_lower)
        return f"Android {m.group(1)}" if m else "Android"
    if "ios" in ua_lower or "iphone" in ua_lower or "ipad" in ua_lower:
        m = re.search(r"os (\d+[._]\d+)", ua_lower)
        return f"iOS {m.group(1).replace('_', '.')}" if m else "iOS"
    if "linux" in ua_lower:
        return "Linux"
    if "cros" in ua_lower:
        return "ChromeOS"
    return "Unknown"


def _extract_device_model(ua: str) -> str:
    """Extract device model from User-Agent (mobile only)."""
    ua_lower = ua.lower()
    m = re.search(r";\s*(SM-[A-Za-z0-9]+)\s*[\);]", ua_lower)  # Samsung
    if m:
        return m.group(1)
    m = re.search(r";\s*(iPhone\s?\d+,\d+)\s*[\);]", ua_lower)
    if m:
        return m.group(1)
    m = re.search(r";\s*(iPad\s?\d+,\d+)\s*[\);]", ua_lower)
    if m:
        return m.group(1)
    m = re.search(r";\s*(mi\s*\w+)\s*[\);]", ua_lower)  # Xiaomi
    if m:
        return m.group(1).title()
    return ""


def _extract_browser(ua: str) -> str:
    """Extract browser name from user-agent string."""
    ua_lower = ua.lower()
    if "chrome" in ua_lower and "edg" not in ua_lower and "opr" not in ua_lower:
        return "Chrome"
    if "firefox" in ua_lower:
        return "Firefox"
    if "safari" in ua_lower and "chrome" not in ua_lower:
        return "Safari"
    if "edg" in ua_lower:
        return "Edge"
    if "opera" in ua_lower or "opr" in ua_lower:
        return "Opera"
    return "Unknown"


async def register_device_background(
    user_id: int,
    raw_fingerprint: str,
    request: Request,
) -> None:
    """Fire-and-forget device registration (runs concurrently, never blocks)."""
    if not raw_fingerprint:
        return
    now = time.time()
    last_ts = _last_registered.get(raw_fingerprint, 0)
    if now - last_ts < _RATE_LIMIT_SECONDS:
        return
    _last_registered[raw_fingerprint] = now

    if len(_last_registered) > 10000:
        cutoff = now - 300
        for k in list(_last_registered.keys()):
            if _last_registered[k] < cutoff:
                del _last_registered[k]

    try:
        from app.core.auth import get_client_ip
        from app.services.device_fingerprint_service import register_or_update_device

        ua = request.headers.get("user-agent", "")

        screen = request.headers.get("sec-ch-viewport-width", "")
        if screen:
            height = request.headers.get("sec-ch-viewport-height", "")
            screen = f"{screen}x{height}" if height else screen

        request_info = {
            "ip": get_client_ip(request) if request else None,
            "user_agent": ua,
            "platform": request.headers.get("sec-ch-ua-platform", "").strip('"')
            or _extract_os(ua),
            "browser_name": _extract_browser(ua),
            "browser_version": request.headers.get("sec-ch-ua-version", "").strip('"'),
            "os_version": _extract_os(ua),
            "device_model": _extract_device_model(ua),
            "screen_resolution": screen or None,
        }
        await register_or_update_device(user_id, raw_fingerprint, request_info)
    except Exception as e:
        logger.warning(
            f"Device registration background task failed: {type(e).__name__}: {e}"
        )
