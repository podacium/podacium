"""Device fingerprinting and security policy service.

Integrates with FingerprintJS client-side library. Handles device registration,
anti-sharing policy (three strikes), impossible-travel detection, and
escrow/payout cooldown enforcement for CGNAT environments.
"""

import hashlib
import ipaddress
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple

from app.core.config import setting
from app.core.prisma import prisma
from app.generated.prisma import Json
from app.services.notification_service import NotificationService, NotificationCreate

logger = logging.getLogger(__name__)

# ─── Configurable Policy Constants ────────────────────────────────────────────

MAX_SUBNETS_BEFORE_STRIKE = int(getattr(setting, "MAX_SUBNETS_BEFORE_STRIKE", "2"))
TRAVEL_TIME_THRESHOLD_MINUTES = int(
    getattr(setting, "TRAVEL_TIME_THRESHOLD_MINUTES", "90")
)
COOLDOWN_HOURS_SENSITIVE_ACTION = int(
    getattr(setting, "COOLDOWN_HOURS_SENSITIVE_ACTION", "72")
)
STRIKE_COOLDOWN_DAYS = int(getattr(setting, "STRIKE_COOLDOWN_DAYS", "30"))
MAX_DEVICES = int(getattr(setting, "MAX_DEVICES", "10"))

WILAYA_MAP: Dict[str, str] = {
    "algiers": "Alger",
    "oran": "Oran",
    "constantine": "Constantine",
    "annaba": "Annaba",
    "setif": "Sétif",
    "tizi-ouzou": "Tizi Ouzou",
    "bejaia": "Bejaïa",
    "blida": "Blida",
    "biskra": "Biskra",
    "tebessa": "Tébessa",
    "tiaret": "Tiaret",
    "saida": "Saïda",
    "skikda": "Skikda",
    "sidi-bel-abbes": "Sidi Bel Abbès",
    "batna": "Batna",
    "djelfa": "Djelfa",
}


def _hash_fingerprint(raw_fingerprint: str) -> str:
    """SHA-256 hash of the client-side FingerprintJS visitorId."""
    if not raw_fingerprint:
        return ""
    return hashlib.sha256(raw_fingerprint.encode()).hexdigest()


def _extract_subnet(ip_address: str) -> Optional[str]:
    """Extract the first two octets (/16 subnet) from an IPv4 address."""
    if not ip_address:
        return None
    parts = ip_address.split(".")
    if len(parts) >= 2:
        return f"{parts[0]}.{parts[1]}"
    return None


# ─── Realistic Algerian IP Subnet, Wilaya & ASN Resolution ───────────────────────
ALGERIAN_SUBNET_WILAYA_MAP: list[Tuple[ipaddress.IPv4Network, str, str, str]] = [
    # (Network, Wilaya Code, Wilaya Name, ASN)
    # Mobilis / Algérie Télécom (AS36947)
    (ipaddress.IPv4Network("105.96.0.0/16"), "16", "Alger", "AS36947"),
    (ipaddress.IPv4Network("105.97.0.0/16"), "16", "Alger", "AS36947"),
    (ipaddress.IPv4Network("105.98.0.0/16"), "16", "Alger", "AS36947"),
    (ipaddress.IPv4Network("105.99.0.0/16"), "16", "Alger", "AS36947"),
    (ipaddress.IPv4Network("105.100.0.0/16"), "16", "Alger", "AS36947"),
    (ipaddress.IPv4Network("105.101.0.0/16"), "16", "Alger", "AS36947"),
    (ipaddress.IPv4Network("105.102.0.0/16"), "16", "Alger", "AS36947"),
    (ipaddress.IPv4Network("105.103.0.0/16"), "16", "Alger", "AS36947"),
    (ipaddress.IPv4Network("105.104.0.0/16"), "16", "Alger", "AS36947"),
    (ipaddress.IPv4Network("105.105.0.0/16"), "31", "Oran", "AS36947"),
    (ipaddress.IPv4Network("105.106.0.0/16"), "25", "Constantine", "AS36947"),
    (ipaddress.IPv4Network("105.107.0.0/16"), "23", "Annaba", "AS36947"),
    (ipaddress.IPv4Network("105.108.0.0/16"), "19", "Sétif", "AS36947"),
    (ipaddress.IPv4Network("105.109.0.0/16"), "05", "Batna", "AS36947"),
    (ipaddress.IPv4Network("105.110.0.0/16"), "06", "Béjaïa", "AS36947"),
    (ipaddress.IPv4Network("105.111.0.0/16"), "15", "Tizi Ouzou", "AS36947"),
    (ipaddress.IPv4Network("41.100.0.0/16"), "16", "Alger", "AS36947"),
    (ipaddress.IPv4Network("41.101.0.0/16"), "16", "Alger", "AS36947"),
    (ipaddress.IPv4Network("41.102.0.0/16"), "31", "Oran", "AS36947"),
    (ipaddress.IPv4Network("41.103.0.0/16"), "25", "Constantine", "AS36947"),
    (ipaddress.IPv4Network("41.107.0.0/16"), "09", "Blida", "AS36947"),
    (ipaddress.IPv4Network("41.111.0.0/16"), "15", "Tizi Ouzou", "AS36947"),
    (ipaddress.IPv4Network("41.200.0.0/16"), "16", "Alger", "AS36947"),
    (ipaddress.IPv4Network("41.201.0.0/16"), "31", "Oran", "AS36947"),
    (ipaddress.IPv4Network("197.200.0.0/16"), "16", "Alger", "AS36947"),
    (ipaddress.IPv4Network("197.201.0.0/16"), "31", "Oran", "AS36947"),
    (ipaddress.IPv4Network("197.202.0.0/16"), "25", "Constantine", "AS36947"),
    (ipaddress.IPv4Network("197.203.0.0/16"), "23", "Annaba", "AS36947"),
    (ipaddress.IPv4Network("197.112.0.0/16"), "16", "Alger", "AS36947"),
    (ipaddress.IPv4Network("154.121.0.0/16"), "16", "Alger", "AS36947"),
    # Djezzy / Optimum Telecom (AS327712)
    (ipaddress.IPv4Network("154.240.0.0/16"), "16", "Alger", "AS327712"),
    (ipaddress.IPv4Network("154.241.0.0/16"), "16", "Alger", "AS327712"),
    (ipaddress.IPv4Network("154.242.0.0/16"), "16", "Alger", "AS327712"),
    (ipaddress.IPv4Network("154.243.0.0/16"), "31", "Oran", "AS327712"),
    (ipaddress.IPv4Network("154.244.0.0/16"), "25", "Constantine", "AS327712"),
    (ipaddress.IPv4Network("154.245.0.0/16"), "09", "Blida", "AS327712"),
    (ipaddress.IPv4Network("154.246.0.0/16"), "19", "Sétif", "AS327712"),
    (ipaddress.IPv4Network("154.247.0.0/16"), "23", "Annaba", "AS327712"),
    (ipaddress.IPv4Network("105.235.128.0/17"), "16", "Alger", "AS327712"),
    # Ooredoo / Wataniya Telecom (AS327931)
    (ipaddress.IPv4Network("197.144.0.0/16"), "16", "Alger", "AS327931"),
    (ipaddress.IPv4Network("197.145.0.0/16"), "31", "Oran", "AS327931"),
    (ipaddress.IPv4Network("197.146.0.0/16"), "25", "Constantine", "AS327931"),
    (ipaddress.IPv4Network("197.147.0.0/16"), "35", "Boumerdès", "AS327931"),
    (ipaddress.IPv4Network("197.148.0.0/16"), "09", "Blida", "AS327931"),
    (ipaddress.IPv4Network("197.149.0.0/16"), "19", "Sétif", "AS327931"),
    (ipaddress.IPv4Network("197.150.0.0/16"), "23", "Annaba", "AS327931"),
    (ipaddress.IPv4Network("197.151.0.0/16"), "15", "Tizi Ouzou", "AS327931"),
    (ipaddress.IPv4Network("41.220.0.0/16"), "16", "Alger", "AS327931"),
    (ipaddress.IPv4Network("41.221.0.0/16"), "31", "Oran", "AS327931"),
    (ipaddress.IPv4Network("105.234.0.0/16"), "16", "Alger", "AS327931"),
    # Carrier Grade NAT (RFC 6598)
    (ipaddress.IPv4Network("100.64.0.0/10"), "16", "CGNAT-Pool", "AS_CGNAT"),
]

ALGERIAN_MOBILE_ASNS = {"AS36947", "AS327712", "AS327931", "AS_CGNAT", "CGNAT"}

# Wilaya geographic adjacency table
ADJACENT_WILAYAS: Dict[str, set[str]] = {
    "16": {"09", "35", "42"},  # Alger -> Blida, Boumerdès, Tipaza
    "09": {"16", "42", "26", "35", "44"},  # Blida
    "35": {"16", "09", "10", "15"},  # Boumerdès
    "42": {"16", "09", "44", "48"},  # Tipaza
    "15": {"35", "06", "10"},  # Tizi Ouzou
    "06": {"15", "19", "18", "34", "10"},  # Béjaïa
    "31": {
        "27",
        "29",
        "22",
        "46",
    },  # Oran -> Mostaganem, Mascara, Sidi Bel Abbès, Aïn Témouchent
    "27": {"31", "29", "48"},  # Mostaganem
    "22": {"31", "46", "29", "20", "13"},  # Sidi Bel Abbès
    "46": {"31", "22", "13"},  # Aïn Témouchent
    "25": {
        "43",
        "04",
        "21",
        "24",
    },  # Constantine -> Mila, Oum El Bouaghi, Skikda, Guelma
    "43": {"25", "19", "18", "21"},  # Mila
    "23": {"36", "24", "21"},  # Annaba
    "19": {"05", "06", "28", "34", "43"},  # Sétif
    "05": {"19", "07", "40", "28", "04"},  # Batna
}


def _ip_to_wilaya(ip_address: str) -> Optional[str]:
    """
    Coarse wilaya mapping via realistic GeoIP resolution fallback supporting
    Algerian IP subnets and Wilaya code mapping.
    """
    if not ip_address:
        return None
    try:
        ip_obj = ipaddress.ip_address(ip_address.strip())
        for network, wilaya_code, _, _ in ALGERIAN_SUBNET_WILAYA_MAP:
            if ip_obj in network:
                return wilaya_code
    except Exception:
        pass
    return None


def _ip_to_asn(ip_address: str) -> Optional[str]:
    """Resolve an IP address to its ASN if it belongs to known Algerian mobile operators."""
    if not ip_address:
        return None
    try:
        ip_obj = ipaddress.ip_address(ip_address.strip())
        for network, _, _, asn in ALGERIAN_SUBNET_WILAYA_MAP:
            if ip_obj in network:
                return asn
    except Exception:
        pass
    return None


def is_cgnat_exempt(
    ip1: Optional[str],
    ip2: Optional[str],
    wilaya1: Optional[str] = None,
    wilaya2: Optional[str] = None,
) -> bool:
    """
    Algerian CGNAT Exemption Heuristic:
    If both IPs belong to known Algerian mobile ASNs (AS36947 Algérie Télécom / Mobilis,
    AS327712 Djezzy, AS327931 Ooredoo), or are within adjacent wilayas, or in RFC 6598 CGNAT pool,
    exempt from unauthorized account-sharing strikes.
    """
    if not ip1 or not ip2:
        return False

    asn1 = _ip_to_asn(ip1)
    asn2 = _ip_to_asn(ip2)

    # 1. RFC 6598 CGNAT pool
    if asn1 in ("CGNAT", "AS_CGNAT") or asn2 in ("CGNAT", "AS_CGNAT"):
        return True

    # 2. Both belong to known Algerian mobile ASNs
    if asn1 in ALGERIAN_MOBILE_ASNS and asn2 in ALGERIAN_MOBILE_ASNS:
        # Same operator dynamic IP churn (tower / gateway handoff)
        if asn1 == asn2:
            return True
        # Cross-operator or mobile roaming in adjacent wilayas
        w1 = wilaya1 or _ip_to_wilaya(ip1)
        w2 = wilaya2 or _ip_to_wilaya(ip2)
        if w1 and w2:
            if (
                w1 == w2
                or w2 in ADJACENT_WILAYAS.get(w1, set())
                or w1 in ADJACENT_WILAYAS.get(w2, set())
            ):
                return True

    # 3. Adjacent wilayas check (e.g. Algiers-Blida daily commute)
    w1 = wilaya1 or _ip_to_wilaya(ip1)
    w2 = wilaya2 or _ip_to_wilaya(ip2)
    if w1 and w2:
        if (
            w1 == w2
            or w2 in ADJACENT_WILAYAS.get(w1, set())
            or w1 in ADJACENT_WILAYAS.get(w2, set())
        ):
            return True

    return False


async def _is_cgnat_or_algerian_mobile_subnet_churn(
    user_id: int, current_ip: str, current_subnet: Optional[str]
) -> bool:
    """Check if the user's active subnets fall within Algerian mobile operators or CGNAT pools."""
    current_asn = _ip_to_asn(current_ip)
    if not current_asn:
        return False
    if current_asn == "CGNAT":
        return True

    # Check recent devices for this user
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    devices = await prisma.userdevice.find_many(
        where={
            "userId": user_id,
            "isActive": True,
            "lastActiveAt": {"gte": cutoff},
        },
    )
    for d in devices:
        if d.lastKnownIp:
            dev_asn = _ip_to_asn(d.lastKnownIp)
            if dev_asn in ALGERIAN_MOBILE_ASNS or dev_asn == "CGNAT":
                return True
    return current_asn in ALGERIAN_MOBILE_ASNS


def _is_impossible_travel(
    prev_ip: Optional[str],
    prev_wilaya: Optional[str],
    prev_time: Optional[datetime],
    current_time: datetime,
    current_wilaya: Optional[str] = None,
    current_ip: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Detect impossible travel: same user from two distant wilayas within
    TRAVEL_TIME_THRESHOLD_MINUTES. Returns (is_violation, description).
    Respects Algerian CGNAT and adjacent wilaya commuting heuristics.
    """
    if not prev_time or not prev_ip or not prev_wilaya or not current_wilaya:
        return False, None
    if prev_wilaya.strip().lower() == current_wilaya.strip().lower():
        return False, None

    # Check if CGNAT exempt or adjacent wilayas
    if is_cgnat_exempt(prev_ip, current_ip, prev_wilaya, current_wilaya):
        return False, None

    t1 = prev_time if prev_time.tzinfo else prev_time.replace(tzinfo=timezone.utc)
    t2 = (
        current_time
        if current_time.tzinfo
        else current_time.replace(tzinfo=timezone.utc)
    )
    elapsed = (t2 - t1).total_seconds() / 60
    if elapsed >= TRAVEL_TIME_THRESHOLD_MINUTES or elapsed < 0:
        return False, None
    return (
        True,
        f"Impossible travel detected: {prev_wilaya} → {current_wilaya} in {int(elapsed)} minutes",
    )


async def _count_active_subnets(user_id: int, current_subnet: str) -> int:
    """
    Count distinct /16 subnets among active, recently seen devices for this user.
    Deduplicates subnets by (platform, browserName) to avoid counting dynamic IP shifts
    on the same physical device as multiple subnets.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    devices = await prisma.userdevice.find_many(
        where={
            "userId": user_id,
            "isActive": True,
            "lastActiveAt": {"gte": cutoff},
        },
    )
    # Map (platform, browserName) -> latest subnet
    device_subnets = {}
    for d in devices:
        key = (d.platform or "unknown", d.browserName or "unknown")
        if d.lastKnownSubnet:
            device_subnets[key] = d.lastKnownSubnet

    subnets = set(device_subnets.values())
    if current_subnet:
        subnets.add(current_subnet)
    return len(subnets)


async def _create_security_event(
    user_id: int,
    event_type: str,
    description: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    wilaya: Optional[str] = None,
    fingerprint: Optional[str] = None,
) -> None:
    """Record a security event in the database."""
    try:
        await prisma.securityevent.create(
            data={
                "userId": user_id,
                "eventType": event_type,
                "description": description,
                "metadata": Json(metadata) if metadata else None,
                "ipAddress": ip_address,
                "wilaya": wilaya,
                "fingerprint": fingerprint,
            }
        )
    except Exception as e:
        logger.error(f"Failed to create security event: {e}")


async def _send_security_notification(
    user_id: int,
    title_key: str,
    body_key: str,
    data: Optional[Dict[str, Any]] = None,
) -> None:
    """Send an in-app (and optionally WhatsApp) security notification."""
    try:
        from app.schemas.notifications import (
            NotificationCategory,
            NotificationPriority,
            NotificationPayload,
        )

        notif_data = data.copy() if data else {}
        notif_data["action_url"] = "/settings/security"
        notif_data["url"] = "/settings/security"

        await NotificationService.create_notification(
            NotificationCreate(
                userId=user_id,
                type="security_alert",
                title=title_key,
                body=body_key,
                category=NotificationCategory.SECURITY,
                priority=NotificationPriority.URGENT,
                payload=NotificationPayload(
                    entity_type="security",
                    entity_id=str(user_id),
                    action_url="/settings/security",
                    metadata=notif_data,
                ),
                data=notif_data,
            )
        )
    except Exception as e:
        logger.error(f"Failed to send security notification: {e}")


async def register_or_update_device(
    user_id: int,
    raw_fingerprint: str,
    request_info: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Core device registration function. Called on every authenticated request.

    1. Hash the client fingerprint
    2. Look up existing device by exact fingerprint hash or (platform + browser_name) fallback
    3. If existing: update lastActiveAt, loginCount, and refresh fingerprint hash if updated
    4. If new device: run anti-sharing policy checks before creating

    Returns a dict with isTrusted, isPrimary, strikes, accountRestricted.
    """
    fingerprint_hash = _hash_fingerprint(raw_fingerprint)
    if not fingerprint_hash:
        return {
            "isTrusted": False,
            "isPrimary": False,
            "strikes": 0,
            "accountRestricted": False,
        }
    now = datetime.now(timezone.utc)
    ip = request_info.get("ip", "")
    subnet = _extract_subnet(ip)
    wilaya = _ip_to_wilaya(ip)

    existing = await prisma.userdevice.find_first(
        where={"userId": user_id, "fingerprintHash": fingerprint_hash}
    )

    if not existing:
        # Fallback match: Check if user has an existing active device with identical platform & browser
        platform_val = request_info.get("platform")
        browser_val = request_info.get("browser_name")
        if platform_val and browser_val:
            existing = await prisma.userdevice.find_first(
                where={
                    "userId": user_id,
                    "platform": platform_val,
                    "browserName": browser_val,
                    "isActive": True,
                },
                order={"lastActiveAt": "desc"},
            )

    if existing:
        # ─── Existing device — update ───────────────────────────────────────────
        await prisma.userdevice.update(
            where={"id": existing.id},
            data={
                "fingerprintHash": fingerprint_hash,
                "lastActiveAt": now,
                "loginCount": existing.loginCount + 1,
                "lastKnownIp": ip,
                "lastKnownSubnet": subnet,
                "lastKnownWilaya": wilaya,
                "platform": request_info.get("platform") or existing.platform,
                "browserName": request_info.get("browser_name") or existing.browserName,
                "browserVersion": request_info.get("browser_version")
                or existing.browserVersion,
                "osVersion": request_info.get("os_version") or existing.osVersion,
                "deviceModel": request_info.get("device_model") or existing.deviceModel,
                "screenResolution": request_info.get("screen_resolution")
                or existing.screenResolution,
            },
        )

        travel_violation, travel_desc = _is_impossible_travel(
            existing.lastKnownIp,
            existing.lastKnownWilaya,
            existing.lastActiveAt,
            now,
            wilaya,
            current_ip=ip,
        )
        if travel_violation:
            await _handle_travel_violation(
                user_id, travel_desc, ip, wilaya, fingerprint_hash
            )

        user = await prisma.user.find_unique(where={"id": user_id})
        strikes = user.securityStrikes if user else 0
        requires_step_up = strikes >= 3
        return {
            "isTrusted": existing.isTrusted,
            "isPrimary": existing.isPrimary,
            "strikes": strikes,
            "accountRestricted": user.accountRestricted if user else False,
            "requiresStepUp": requires_step_up,
            "stepUpMethods": ["totp", "webauthn", "email_otp"]
            if requires_step_up
            else [],
        }

    # ─── New device ────────────────────────────────────────────────────────
    # Check if the same fingerprint exists for another user (debug log only)
    collision = await prisma.userdevice.find_first(
        where={"fingerprintHash": fingerprint_hash}
    )
    if collision:
        logger.debug(
            f"Fingerprint hash {fingerprint_hash[:12]} already used by user "
            f"{collision.userId} (current user {user_id}) — creating separate device"
        )
    subnet_count = await _count_active_subnets(user_id, subnet) if subnet else 0
    user = await prisma.user.find_unique(where={"id": user_id})
    current_strikes = user.securityStrikes if user else 0
    is_primary = False

    # Check if this is the user's first device
    device_count = await prisma.userdevice.count(where={"userId": user_id})
    if device_count == 0:
        is_primary = True

    try:
        await prisma.userdevice.create(
            data={
                "userId": user_id,
                "fingerprintHash": fingerprint_hash,
                "platform": request_info.get("platform"),
                "browserName": request_info.get("browser_name"),
                "browserVersion": request_info.get("browser_version"),
                "osVersion": request_info.get("os_version"),
                "deviceModel": request_info.get("device_model"),
                "screenResolution": request_info.get("screen_resolution"),
                "lastKnownIp": ip,
                "lastKnownWilaya": wilaya,
                "lastKnownSubnet": subnet,
                "isPrimary": is_primary,
                "isTrusted": is_primary,
            }
        )
    except Exception:
        # Race condition: another concurrent request already created this device.
        # Update the existing record instead.
        existing = await prisma.userdevice.find_first(
            where={"userId": user_id, "fingerprintHash": fingerprint_hash}
        )
        if existing:
            await prisma.userdevice.update(
                where={"id": existing.id},
                data={
                    "lastActiveAt": now,
                    "loginCount": existing.loginCount + 1,
                    "lastKnownIp": ip,
                    "lastKnownSubnet": subnet,
                    "lastKnownWilaya": wilaya,
                    "platform": request_info.get("platform") or existing.platform,
                    "browserName": request_info.get("browser_name")
                    or existing.browserName,
                    "browserVersion": request_info.get("browser_version")
                    or existing.browserVersion,
                    "osVersion": request_info.get("os_version") or existing.osVersion,
                    "deviceModel": request_info.get("device_model")
                    or existing.deviceModel,
                    "screenResolution": request_info.get("screen_resolution")
                    or existing.screenResolution,
                },
            )
            requires_step_up = current_strikes >= 3
            return {
                "isTrusted": existing.isTrusted,
                "isPrimary": existing.isPrimary,
                "strikes": current_strikes,
                "accountRestricted": user.accountRestricted if user else False,
                "requiresStepUp": requires_step_up,
                "stepUpMethods": ["totp", "webauthn", "email_otp"]
                if requires_step_up
                else [],
            }

    await _create_security_event(
        user_id,
        "NEW_DEVICE_DETECTED",
        description=None,
        metadata={
            "browser": request_info.get("browser_name", "unknown"),
            "platform": request_info.get("platform", "unknown"),
        },
        ip_address=ip,
        wilaya=wilaya,
        fingerprint=fingerprint_hash,
    )

    await _send_security_notification(
        user_id,
        "settings-devices.notifications.newDevice.title",
        "settings-devices.notifications.newDevice.body",
        data={"device": request_info.get("browser_name", "unknown")},
    )

    # Send new device email alert
    try:
        from app.services.email_service import email_service

        await email_service.send_new_device_email(
            email=user.email,
            name=user.fullName or "User",
            device=request_info.get(
                "device_model", request_info.get("platform", "Unknown")
            ),
            browser=request_info.get("browser_name", "Unknown"),
            os_name=request_info.get("os_version", "Unknown"),
            ip=request_info.get("ip", "Unknown"),
            location=wilaya or "Unknown",
            time_val=now.strftime("%Y-%m-%d %H:%M UTC"),
        )
    except Exception as e:
        logger.error(f"Failed to send new device email: {e}")

    # Enforce MAX_DEVICES: deactivate oldest if over limit
    device_count = await prisma.userdevice.count(
        where={"userId": user_id, "isActive": True}
    )
    if device_count > MAX_DEVICES:
        oldest = await prisma.userdevice.find_first(
            where={"userId": user_id, "isActive": True, "isPrimary": False},
            order={"lastActiveAt": "asc"},
        )
        if oldest:
            await prisma.userdevice.update(
                where={"id": oldest.id},
                data={"isActive": False},
            )

    # ─── Anti-Sharing Policy Check ─────────────────────────────────────────
    policy_violation = False
    policy_reason = None

    if subnet_count > MAX_SUBNETS_BEFORE_STRIKE:
        is_churn = await _is_cgnat_or_algerian_mobile_subnet_churn(user_id, ip, subnet)
        if not is_churn:
            policy_violation = True
            policy_reason = f"EXCESSIVE_SUBNET_SPREAD: {subnet_count} subnets (max {MAX_SUBNETS_BEFORE_STRIKE})"
        else:
            logger.info(
                f"User {user_id} exceeded subnet spread ({subnet_count}), "
                f"but exempted due to Algerian mobile ASN / CGNAT churn."
            )

    if policy_violation:
        await _handle_policy_violation(
            user_id,
            policy_reason,
            current_strikes,
            ip,
            wilaya,
            fingerprint_hash,
        )

    user = await prisma.user.find_unique(where={"id": user_id})
    final_strikes = user.securityStrikes if user else current_strikes
    requires_step_up = final_strikes >= 3
    return {
        "isTrusted": is_primary,
        "isPrimary": is_primary,
        "strikes": final_strikes,
        "accountRestricted": user.accountRestricted if user else False,
        "requiresStepUp": requires_step_up,
        "stepUpMethods": ["totp", "webauthn", "email_otp"] if requires_step_up else [],
    }


async def _handle_travel_violation(
    user_id: int,
    description: Optional[str] = None,
    ip: Optional[str] = None,
    wilaya: Optional[str] = None,
    fingerprint_hash: Optional[str] = None,
) -> None:
    """Log impossible travel and issue a warning (no strike)."""
    await _create_security_event(
        user_id,
        "GEO_IMPOSSIBLE_TRAVEL",
        description=None,
        metadata={"detail": description} if description else None,
        ip_address=ip,
        wilaya=wilaya,
        fingerprint=fingerprint_hash,
    )
    await _send_security_notification(
        user_id,
        "settings-devices.notifications.impossibleTravel.title",
        "settings-devices.notifications.impossibleTravel.body",
    )


async def _handle_policy_violation(
    user_id: int,
    reason: Optional[str] = None,
    current_strikes: int = 0,
    ip: Optional[str] = None,
    wilaya: Optional[str] = None,
    fingerprint_hash: Optional[str] = None,
) -> None:
    """Execute the three-strikes anti-sharing policy."""
    new_strikes = current_strikes + 1
    await prisma.user.update(
        where={"id": user_id},
        data={"securityStrikes": new_strikes},
    )

    await _create_security_event(
        user_id,
        "STRIKE_ISSUED",
        description=None,
        metadata={"strike": new_strikes, "reason": reason},
        ip_address=ip,
        wilaya=wilaya,
        fingerprint=fingerprint_hash,
    )

    if new_strikes >= 5:
        # Hard lock only if repeated violations continue beyond step-up threshold
        await prisma.user.update(
            where={"id": user_id},
            data={
                "accountRestricted": True,
                "accountRestrictedAt": datetime.now(timezone.utc),
            },
        )
        await _create_security_event(
            user_id,
            "ACCOUNT_RESTRICTED_MAX_STRIKES",
            description=None,
            metadata={"reason": reason, "strikes": new_strikes},
            ip_address=ip,
            wilaya=wilaya,
            fingerprint=fingerprint_hash,
        )
        await _send_security_notification(
            user_id,
            "settings-devices.notifications.strike3.title",
            "settings-devices.notifications.strike3.body",
        )
    elif new_strikes >= 3:
        # Instead of locking accounts immediately, issue a step-up challenge prompt
        await _create_security_event(
            user_id,
            "STEP_UP_CHALLENGE_REQUIRED",
            description=None,
            metadata={
                "strike": new_strikes,
                "reason": reason,
                "stepUpMethods": ["totp", "webauthn", "email_otp"],
            },
            ip_address=ip,
            wilaya=wilaya,
            fingerprint=fingerprint_hash,
        )
        await _send_security_notification(
            user_id,
            "settings-devices.notifications.stepUpRequired.title",
            "settings-devices.notifications.stepUpRequired.body",
            data={
                "stepUpMethods": ["totp", "webauthn", "email_otp"],
                "strike": new_strikes,
                "reason": reason,
            },
        )
    elif new_strikes >= 2:
        await _create_security_event(
            user_id,
            "STRIKE_TWO_REACHED",
            description=None,
            metadata={"reason": reason},
            ip_address=ip,
            wilaya=wilaya,
            fingerprint=fingerprint_hash,
        )
        await _send_security_notification(
            user_id,
            "settings-devices.notifications.strike2.title",
            "settings-devices.notifications.strike2.body",
        )
    else:
        await _send_security_notification(
            user_id,
            "settings-devices.notifications.strike1.title",
            "settings-devices.notifications.strike1.body",
        )


async def check_escrow_eligibility(
    user_id: int,
    fingerprint_hash: str,
) -> Dict[str, Any]:
    """
    Check if the current device is allowed to perform sensitive actions
    (escrow release, payout changes). Returns a dict with:
      - allowed (bool)
      - cooldown_expires_at (datetime or None)
      - requires_2fa_bypass (bool)
    """
    device = await prisma.userdevice.find_first(
        where={"userId": user_id, "fingerprintHash": fingerprint_hash}
    )
    if not device:
        return {
            "allowed": False,
            "cooldown_expires_at": None,
            "requires_2fa_bypass": False,
        }

    if device.isTrusted:
        return {
            "allowed": True,
            "cooldown_expires_at": None,
            "requires_2fa_bypass": False,
        }

    active_cooldown = await prisma.devicecooldown.find_first(
        where={
            "userId": user_id,
            "fingerprintHash": fingerprint_hash,
            "isActive": True,
            "expiresAt": {"gte": datetime.now(timezone.utc)},
        },
        order={"expiresAt": "desc"},
    )

    if active_cooldown:
        return {
            "allowed": False,
            "cooldown_expires_at": active_cooldown.expiresAt.isoformat(),
            "requires_2fa_bypass": False,
        }

    cooldown_expires = datetime.now(timezone.utc) + timedelta(
        hours=COOLDOWN_HOURS_SENSITIVE_ACTION
    )
    await prisma.devicecooldown.create(
        data={
            "userId": user_id,
            "fingerprintHash": fingerprint_hash,
            "cooldownType": "sensitive_action",
            "expiresAt": cooldown_expires,
        }
    )
    await _create_security_event(
        user_id,
        "ESCROW_COOLDOWN_STARTED",
        description=None,
        fingerprint=fingerprint_hash,
    )

    return {
        "allowed": False,
        "cooldown_expires_at": cooldown_expires.isoformat(),
        "requires_2fa_bypass": False,
    }


async def bypass_cooldown_with_2fa(
    user_id: int,
    fingerprint_hash: str,
) -> Dict[str, Any]:
    """
    Bypass a device cooldown after successful 2FA verification.
    Marks the device as trusted and expires active cooldowns.
    """
    now = datetime.now(timezone.utc)
    await prisma.devicecooldown.update_many(
        where={
            "userId": user_id,
            "fingerprintHash": fingerprint_hash,
            "isActive": True,
        },
        data={"isActive": False, "bypassedAt": now, "bypassMethod": "2fa"},
    )
    await prisma.userdevice.update_many(
        where={"userId": user_id, "fingerprintHash": fingerprint_hash},
        data={"isTrusted": True},
    )
    await _create_security_event(
        user_id,
        "COOLDOWN_BYPASS_2FA",
        description=None,
        fingerprint=fingerprint_hash,
    )
    return {"allowed": True, "cooldown_expires_at": None, "requires_2fa_bypass": False}


async def get_device_stats(user_id: int) -> Dict[str, Any]:
    """Get device summary stats for the user dashboard."""
    now = datetime.now(timezone.utc)
    yesterday = now - timedelta(days=1)
    seven_days = now - timedelta(days=7)

    total = await prisma.userdevice.count(where={"userId": user_id, "isActive": True})
    trusted = await prisma.userdevice.count(
        where={"userId": user_id, "isActive": True, "isTrusted": True}
    )
    active_today = await prisma.userdevice.count(
        where={"userId": user_id, "isActive": True, "lastActiveAt": {"gte": yesterday}}
    )
    events_7d = await prisma.securityevent.count(
        where={"userId": user_id, "createdAt": {"gte": seven_days}}
    )

    return {
        "total": total,
        "trusted": trusted,
        "active_today": active_today,
        "events_7d": events_7d,
    }


async def get_user_devices(user_id: int) -> list:
    """Get all active devices for a user, ordered by last active."""
    devices = await prisma.userdevice.find_many(
        where={"userId": user_id, "isActive": True},
        order={"lastActiveAt": "desc"},
    )
    return [
        {
            "id": d.id,
            "fingerprintHash": d.fingerprintHash[:16],
            "platform": d.platform,
            "browserName": d.browserName,
            "browserVersion": d.browserVersion,
            "osVersion": d.osVersion,
            "deviceModel": d.deviceModel,
            "screenResolution": d.screenResolution,
            "lastKnownWilaya": d.lastKnownWilaya,
            "lastActiveAt": d.lastActiveAt.isoformat(),
            "firstSeenAt": d.firstSeenAt.isoformat(),
            "loginCount": d.loginCount,
            "isTrusted": d.isTrusted,
            "isPrimary": d.isPrimary,
        }
        for d in devices
    ]


async def toggle_device_trust(
    user_id: int,
    device_id: int,
    trust: bool,
) -> Dict[str, Any]:
    """Toggle isTrusted for a device. Requires 2FA verification on the frontend."""
    device = await prisma.userdevice.find_first(
        where={"id": device_id, "userId": user_id},
    )
    if not device:
        raise ValueError("Device not found")

    await prisma.userdevice.update(
        where={"id": device_id},
        data={"isTrusted": trust},
    )
    event_type = "DEVICE_TRUSTED" if trust else "DEVICE_REVOKED"
    await _create_security_event(
        user_id,
        event_type,
        description=None,
        metadata={"trusted": trust},
        fingerprint=device.fingerprintHash,
    )
    return {"isTrusted": trust}


async def get_security_events(
    user_id: int,
    limit: int = 20,
) -> list:
    """Get recent security events for a user."""
    events = await prisma.securityevent.find_many(
        where={"userId": user_id},
        order={"createdAt": "desc"},
        take=limit,
    )
    return [
        {
            "id": e.id,
            "eventType": e.eventType,
            "description": e.description,
            "metadata": e.metadata,
            "createdAt": e.createdAt.isoformat(),
            "wilaya": e.wilaya,
        }
        for e in events
    ]


async def remove_device(user_id: int, device_id: int) -> Dict[str, Any]:
    """Soft-delete a device by setting isActive to False."""
    device = await prisma.userdevice.find_first(
        where={"id": device_id, "userId": user_id, "isActive": True},
    )
    if not device:
        raise ValueError("Device not found or already removed")

    if device.isPrimary:
        raise ValueError("Cannot remove primary device")

    await prisma.userdevice.update(
        where={"id": device_id},
        data={"isActive": False},
    )
    await _create_security_event(
        user_id,
        "DEVICE_REVOKED",
        description=None,
        metadata={"removed": True, "device": device.browserName or "unknown"},
        fingerprint=device.fingerprintHash,
    )
    return {"id": device_id, "isActive": False}


async def set_primary_device(user_id: int, device_id: int) -> Dict[str, Any]:
    """Set a device as the primary device, unsetting any existing primary."""
    device = await prisma.userdevice.find_first(
        where={"id": device_id, "userId": user_id, "isActive": True},
    )
    if not device:
        raise ValueError("Device not found")

    await prisma.userdevice.update_many(
        where={"userId": user_id, "isPrimary": True},
        data={"isPrimary": False},
    )
    await prisma.userdevice.update(
        where={"id": device_id},
        data={"isPrimary": True},
    )
    await _create_security_event(
        user_id,
        "DEVICE_TRUSTED",
        description=None,
        metadata={"primary": True, "device": device.browserName or "unknown"},
        fingerprint=device.fingerprintHash,
    )
    return {"id": device_id, "isPrimary": True}


async def get_device_by_fingerprint(
    user_id: int, fingerprint_hash: str
) -> Optional[Dict[str, Any]]:
    """Look up a device by its hashed fingerprint for a given user."""
    device = await prisma.userdevice.find_first(
        where={"userId": user_id, "fingerprintHash": fingerprint_hash},
    )
    if not device:
        return None
    return {
        "id": device.id,
        "userId": device.userId,
        "isTrusted": device.isTrusted,
        "isPrimary": device.isPrimary,
        "isActive": device.isActive,
    }
