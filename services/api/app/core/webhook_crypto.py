"""
Standard Webhooks Specification Cryptographic Signing and Verification.
Conforms to the Standard Webhooks specification championed by Svix:
- Headers: webhook-id, webhook-timestamp, webhook-signature
- Signed Content: msg_id.timestamp.payload
- Signature format: v1,<base64_encoded_hmac>
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time
from typing import Dict, List, Optional


def generate_standard_secret() -> str:
    """Generate Standard Webhook compliant secret: whsec_<base64_encoded_32_bytes>."""
    raw_bytes = os.urandom(32)
    b64_str = base64.b64encode(raw_bytes).decode("ascii")
    return f"whsec_{b64_str}"


def _clean_secret_key(secret: str) -> bytes:
    """Extract raw 32 bytes from secret (handling whsec_ base64 or legacy raw keys)."""
    clean = secret.removeprefix("whsec_")
    try:
        raw_key = base64.b64decode(clean)
        if len(raw_key) == 32:
            return raw_key
    except Exception:
        pass
    # Fallback to UTF-8 encoded bytes for legacy keys
    return secret.encode("utf-8")


def compute_v1_signature(
    secret: str, msg_id: str, timestamp: int, payload: bytes
) -> str:
    """
    Computes HMAC-SHA256 signature according to Standard Webhooks specification:
    Signed Content = msg_id.timestamp.payload
    Signature = v1,base64(hmac)
    """
    raw_key = _clean_secret_key(secret)
    to_sign = f"{msg_id}.{timestamp}.".encode("utf-8") + payload
    mac = hmac.new(raw_key, to_sign, hashlib.sha256).digest()
    return f"v1,{base64.b64encode(mac).decode('ascii')}"


def build_standard_headers(
    msg_id: str,
    timestamp: int,
    payload_bytes: bytes,
    secret: str,
    previous_secret: Optional[str] = None,
) -> Dict[str, str]:
    """
    Generates Standard Webhooks specification headers, including dual-signing for
    active rotation windows, while preserving legacy X-Podacium headers for backwards compatibility.
    """
    sigs: List[str] = [compute_v1_signature(secret, msg_id, timestamp, payload_bytes)]
    if previous_secret:
        sigs.append(
            compute_v1_signature(previous_secret, msg_id, timestamp, payload_bytes)
        )

    # Standard Webhooks signature header (space-separated signatures)
    std_signature = " ".join(sigs)

    # Legacy hex signature format (comma-separated t=...,v1=...)
    legacy_mac = hmac.new(
        _clean_secret_key(secret),
        f"{timestamp}.".encode("utf-8") + payload_bytes,
        hashlib.sha256,
    ).hexdigest()
    legacy_sig = f"t={timestamp},v1={legacy_mac}"
    if previous_secret:
        prev_legacy_mac = hmac.new(
            _clean_secret_key(previous_secret),
            f"{timestamp}.".encode("utf-8") + payload_bytes,
            hashlib.sha256,
        ).hexdigest()
        legacy_sig += f",v1={prev_legacy_mac}"

    return {
        "Content-Type": "application/json",
        "webhook-id": msg_id,
        "webhook-timestamp": str(timestamp),
        "webhook-signature": std_signature,
        "X-Podacium-Event-ID": msg_id,
        "X-Podacium-Signature": legacy_sig,
        "User-Agent": "Podacium-Webhook-Dispatcher/3.0 (+https://podacium.com)",
    }


def verify_standard_signature(
    secret: str | List[str],
    msg_id: str,
    timestamp: int,
    payload_bytes: bytes,
    signature_header: str,
    tolerance_seconds: int = 300,
) -> bool:
    """
    Verify incoming Standard Webhooks payload signature using constant-time comparison
    and 5-minute replay tolerance window. Supports dual-secret rotation when secret is a list.
    """
    # 1. Replay tolerance check
    now = int(time.time())
    if abs(now - timestamp) > tolerance_seconds:
        return False

    secrets = [secret] if isinstance(secret, str) else secret
    received_sigs = signature_header.strip().split()

    for sec in secrets:
        expected_sig = compute_v1_signature(sec, msg_id, timestamp, payload_bytes)
        for sig in received_sigs:
            if hmac.compare_digest(expected_sig, sig):
                return True
    return False


def verify_standard_request(
    headers: Dict[str, str],
    payload_bytes: bytes,
    secret: str | List[str],
    tolerance_seconds: int = 300,
) -> bool:
    """
    High-level convenience validator for Standard Webhooks HTTP requests.
    Inspects standard headers (webhook-id, webhook-timestamp, webhook-signature)
    with backwards-compatible fallback to X-Podacium-* headers.
    """
    # Normalize header casing
    lower_headers = {k.lower(): v for k, v in headers.items()}

    msg_id = lower_headers.get("webhook-id") or lower_headers.get("x-podacium-event-id")
    raw_timestamp = lower_headers.get("webhook-timestamp")
    signature = lower_headers.get("webhook-signature")

    if not msg_id or not raw_timestamp or not signature:
        # Fallback check for legacy X-Podacium-Signature format: t=...,v1=...
        legacy_sig = lower_headers.get("x-podacium-signature")
        if legacy_sig and msg_id:
            parts = dict(
                item.split("=", 1) for item in legacy_sig.split(",") if "=" in item
            )
            t_str = parts.get("t")
            v1_hex = parts.get("v1")
            if t_str and v1_hex:
                try:
                    ts = int(t_str)
                    now = int(time.time())
                    if abs(now - ts) > tolerance_seconds:
                        return False
                    secrets = [secret] if isinstance(secret, str) else secret
                    for sec in secrets:
                        expected_mac = hmac.new(
                            _clean_secret_key(sec),
                            f"{ts}.".encode("utf-8") + payload_bytes,
                            hashlib.sha256,
                        ).hexdigest()
                        if hmac.compare_digest(expected_mac, v1_hex):
                            return True
                except (ValueError, TypeError):
                    pass
        return False

    try:
        ts = int(raw_timestamp)
    except (ValueError, TypeError):
        return False

    return verify_standard_signature(
        secret=secret,
        msg_id=msg_id,
        timestamp=ts,
        payload_bytes=payload_bytes,
        signature_header=signature,
        tolerance_seconds=tolerance_seconds,
    )
