"""
Tests for device fingerprint service and security schemas.
Covers: fingerprint hashing, subnet extraction, device matching, and SecurityEventResponse metadata serialization.
"""

import pytest

from app.services.device_fingerprint_service import (
    _hash_fingerprint,
    _extract_subnet,
)
from app.schemas.security import SecurityEventResponse


class TestFingerprintHashing:
    """Test device fingerprint SHA-256 hashing."""

    def test_empty_fingerprint_returns_empty(self):
        assert _hash_fingerprint("") == ""

    def test_hash_is_deterministic(self):
        fp = "fingerprint_visitor_id_123"
        assert _hash_fingerprint(fp) == _hash_fingerprint(fp)
        assert len(_hash_fingerprint(fp)) == 64


class TestSubnetExtraction:
    """Test IP subnet extraction."""

    def test_extract_ipv4_subnet(self):
        assert _extract_subnet("192.168.1.100") == "192.168"
        assert _extract_subnet("41.200.15.5") == "41.200"

    def test_extract_invalid_ip_returns_none(self):
        assert _extract_subnet("") is None


class TestSecurityEventResponseSchema:
    """Test SecurityEventResponse Pydantic model retains metadata."""

    def test_security_event_response_includes_metadata(self):
        event_dict = {
            "id": 1,
            "eventType": "NEW_DEVICE_DETECTED",
            "description": None,
            "metadata": {"browser": "Chrome", "platform": "Linux"},
            "createdAt": "2026-08-30T10:00:00Z",
            "wilaya": None,
        }
        resp = SecurityEventResponse(**event_dict)
        assert resp.metadata == {"browser": "Chrome", "platform": "Linux"}
        dumped = resp.model_dump(by_alias=True)
        assert dumped["metadata"] == {"browser": "Chrome", "platform": "Linux"}


class TestAlgerianGeoAndCgnat:
    """Test Wilaya resolution, ASN mapping, CGNAT exemptions, and travel checks."""

    def test_ip_to_wilaya_mapping(self):
        from app.services.device_fingerprint_service import _ip_to_wilaya

        # Algiers subnet
        assert _ip_to_wilaya("41.200.10.5") == "16"
        # Oran subnet
        assert _ip_to_wilaya("41.201.20.1") == "31"
        # Constantine subnet
        assert _ip_to_wilaya("105.106.5.9") == "25"
        # Unknown IP returns None
        assert _ip_to_wilaya("8.8.8.8") is None
        assert _ip_to_wilaya("") is None

    def test_ip_to_asn_mapping(self):
        from app.services.device_fingerprint_service import _ip_to_asn

        # Mobilis (AS36947)
        assert _ip_to_asn("197.200.1.1") == "AS36947"
        # Djezzy (AS327712)
        assert _ip_to_asn("154.240.10.2") == "AS327712"
        # Ooredoo (AS327931)
        assert _ip_to_asn("197.144.5.5") == "AS327931"
        # CGNAT RFC 6598
        assert _ip_to_asn("100.64.0.1") == "AS_CGNAT"

    def test_cgnat_exemption(self):
        from app.services.device_fingerprint_service import is_cgnat_exempt

        # Both on Mobilis AS36947 -> exempt even with different IP
        assert is_cgnat_exempt("197.200.1.1", "105.101.2.2", "16", "31") is True

        # Adjacent wilayas (Algiers 16 and Blida 09) -> exempt
        assert is_cgnat_exempt("8.8.8.8", "9.9.9.9", "16", "09") is True

        # RFC 6598 CGNAT IP -> exempt
        assert is_cgnat_exempt("100.64.1.1", "41.200.1.1", "16", "31") is True

        # Non-adjacent, non-mobile ASNs -> not exempt
        assert is_cgnat_exempt("1.1.1.1", "2.2.2.2", "16", "11") is False

    def test_impossible_travel_logic(self):
        from datetime import datetime, timezone, timedelta
        from app.services.device_fingerprint_service import _is_impossible_travel

        now = datetime.now(timezone.utc)
        ten_mins_ago = now - timedelta(minutes=10)

        # Non-adjacent distant travel within 10 mins (Algiers 16 -> Tamanrasset 11)
        violation, desc = _is_impossible_travel(
            prev_ip="1.1.1.1",
            prev_wilaya="16",
            prev_time=ten_mins_ago,
            current_time=now,
            current_wilaya="11",
            current_ip="2.2.2.2",
        )
        assert violation is True
        assert "Impossible travel detected: 16 → 11" in desc

        # Same wilaya -> no violation
        violation, _ = _is_impossible_travel(
            prev_ip="1.1.1.1",
            prev_wilaya="16",
            prev_time=ten_mins_ago,
            current_time=now,
            current_wilaya="16",
            current_ip="2.2.2.2",
        )
        assert violation is False

        # Adjacent wilaya (Algiers 16 -> Boumerdes 35) -> exempt, no violation
        violation, _ = _is_impossible_travel(
            prev_ip="1.1.1.1",
            prev_wilaya="16",
            prev_time=ten_mins_ago,
            current_time=now,
            current_wilaya="35",
            current_ip="2.2.2.2",
        )
        assert violation is False


class TestAntiSharingStepUp:
    """Test three-strikes step-up challenge prompt behavior."""

    @pytest.mark.asyncio
    async def test_strike_three_issues_step_up_challenge_without_immediate_lock(
        self, monkeypatch
    ):
        from unittest.mock import AsyncMock, MagicMock
        from app.services.device_fingerprint_service import _handle_policy_violation
        from app.services.device_fingerprint_service import prisma

        mock_user = MagicMock()
        mock_user.update = AsyncMock()
        monkeypatch.setattr(prisma, "user", mock_user)

        events_created = []

        async def fake_create_security_event(*args, **kwargs):
            events_created.append(
                args[1] if len(args) > 1 else kwargs.get("event_type")
            )

        monkeypatch.setattr(
            "app.services.device_fingerprint_service._create_security_event",
            fake_create_security_event,
        )
        monkeypatch.setattr(
            "app.services.device_fingerprint_service._send_security_notification",
            AsyncMock(),
        )

        # Trigger 3rd strike (current strikes = 2, so new_strikes = 3)
        await _handle_policy_violation(
            user_id=10,
            reason="EXCESSIVE_SUBNET_SPREAD",
            current_strikes=2,
            ip="197.200.1.1",
            wilaya="16",
            fingerprint_hash="abc",
        )

        # Security strikes updated to 3
        mock_user.update.assert_called_once_with(
            where={"id": 10},
            data={"securityStrikes": 3},
        )
        # STEP_UP_CHALLENGE_REQUIRED emitted, NOT accountRestricted = True
        assert "STRIKE_ISSUED" in events_created
        assert "STEP_UP_CHALLENGE_REQUIRED" in events_created
        # Verify account was not locked
        for call in mock_user.update.call_args_list:
            assert "accountRestricted" not in call[1].get("data", {})
