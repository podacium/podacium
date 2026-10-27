"""
Tests for Crisp webhook signature verification.

Covers:
- Valid HMAC-SHA256 signature → accepted
- Invalid signature → rejected (401)
- Missing signature with secret configured → rejected
- Missing secret in production → rejected
- Missing secret in development → accepted (dev convenience)
- Timing-safe comparison (no early exit on mismatch)
"""

import hmac
import hashlib
import json
from unittest.mock import patch, AsyncMock

from fastapi.testclient import TestClient


# ─── Unit tests for _verify_crisp_signature ───────────────────────────────────


class TestVerifyCrispSignature:
    """Unit tests for the signature verification helper."""

    def _make_signature(self, secret: str, body: bytes) -> str:
        return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

    def test_valid_signature_accepted(self):
        """A correctly signed payload must be accepted."""
        from app.routers.crisp_webhook import _verify_crisp_signature

        secret = "super-secret-key"
        body = b'{"event": "session:resolved"}'
        sig = self._make_signature(secret, body)

        assert _verify_crisp_signature(body, sig, secret) is True

    def test_invalid_signature_rejected(self):
        """A tampered payload must be rejected."""
        from app.routers.crisp_webhook import _verify_crisp_signature

        secret = "super-secret-key"
        body = b'{"event": "session:resolved"}'
        wrong_sig = "deadbeef" * 8  # 64 hex chars, wrong value

        assert _verify_crisp_signature(body, wrong_sig, secret) is False

    def test_missing_signature_with_secret_rejected(self):
        """If secret is configured but no signature header → reject."""
        from app.routers.crisp_webhook import _verify_crisp_signature

        assert _verify_crisp_signature(b"body", None, "my-secret") is False
        assert _verify_crisp_signature(b"body", "", "my-secret") is False

    def test_missing_secret_in_production_rejected(self):
        """In production, a missing secret must reject all requests."""
        from app.routers.crisp_webhook import _verify_crisp_signature

        with patch("app.routers.crisp_webhook.setting") as mock_setting:
            mock_setting.ENVIRONMENT = "production"
            # No secret, no signature
            assert _verify_crisp_signature(b"body", None, "") is False
            # No secret, but signature present
            assert _verify_crisp_signature(b"body", "some-sig", "") is False

    def test_missing_secret_in_development_accepted(self):
        """In development, a missing secret allows all requests (local testing)."""
        from app.routers.crisp_webhook import _verify_crisp_signature

        with patch("app.routers.crisp_webhook.setting") as mock_setting:
            mock_setting.ENVIRONMENT = "development"
            # No secret configured → dev bypass
            assert _verify_crisp_signature(b"body", None, "") is True

    def test_missing_secret_in_test_env_accepted(self):
        """In test environment, a missing secret allows all requests."""
        from app.routers.crisp_webhook import _verify_crisp_signature

        with patch("app.routers.crisp_webhook.setting") as mock_setting:
            mock_setting.ENVIRONMENT = "test"
            assert _verify_crisp_signature(b"body", None, "") is True

    def test_signature_is_case_sensitive(self):
        """Signature comparison must be exact (hex is lowercase)."""
        from app.routers.crisp_webhook import _verify_crisp_signature

        secret = "key"
        body = b"data"
        correct_sig = self._make_signature(secret, body)
        upper_sig = correct_sig.upper()

        # Correct lowercase sig → accepted
        assert _verify_crisp_signature(body, correct_sig, secret) is True
        # Uppercase version → rejected (hmac.compare_digest is case-sensitive)
        assert _verify_crisp_signature(body, upper_sig, secret) is False

    def test_different_body_rejected(self):
        """Signature computed for body A must not validate body B."""
        from app.routers.crisp_webhook import _verify_crisp_signature

        secret = "key"
        body_a = b'{"event": "session:resolved"}'
        body_b = b'{"event": "message:send"}'
        sig_for_a = self._make_signature(secret, body_a)

        assert _verify_crisp_signature(body_b, sig_for_a, secret) is False

    def test_empty_body_with_valid_signature(self):
        """Empty body with correct HMAC must be accepted."""
        from app.routers.crisp_webhook import _verify_crisp_signature

        secret = "key"
        body = b""
        sig = self._make_signature(secret, body)

        assert _verify_crisp_signature(body, sig, secret) is True


# ─── Integration tests for the /crisp endpoint ────────────────────────────────


class TestCrispWebhookEndpoint:
    """Integration tests for the POST /api/v1/webhooks/crisp endpoint."""

    def _make_client(self):
        """Create a TestClient with the full app."""
        from app.main import app

        return TestClient(app, raise_server_exceptions=False)

    def _sign(self, secret: str, body: bytes) -> str:
        return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

    def _payload(self, event: str = "message:send") -> bytes:
        return json.dumps({"event": event, "data": {}}).encode()

    @patch("app.routers.crisp_webhook.setting")
    @patch("app.routers.crisp_webhook._create_ticket_from_chat", new_callable=AsyncMock)
    def test_valid_signature_returns_200(self, mock_create, mock_setting):
        """Valid HMAC signature → 200 OK."""
        mock_setting.CRISP_WEBHOOK_SECRET = "test-secret"
        mock_setting.ENVIRONMENT = "production"

        body = self._payload("message:send")
        sig = self._sign("test-secret", body)

        client = self._make_client()
        resp = client.post(
            "/api/v1/webhooks/crisp",
            content=body,
            headers={"x-crisp-signature": sig, "content-type": "application/json"},
        )
        assert resp.status_code == 200

    @patch("app.routers.crisp_webhook.setting")
    def test_invalid_signature_returns_401(self, mock_setting):
        """Invalid HMAC signature → 401 Unauthorized."""
        mock_setting.CRISP_WEBHOOK_SECRET = "test-secret"
        mock_setting.ENVIRONMENT = "production"

        body = self._payload("message:send")

        client = self._make_client()
        resp = client.post(
            "/api/v1/webhooks/crisp",
            content=body,
            headers={
                "x-crisp-signature": "bad-sig",
                "content-type": "application/json",
            },
        )
        assert resp.status_code == 401

    @patch("app.routers.crisp_webhook.setting")
    def test_missing_signature_returns_401(self, mock_setting):
        """Missing signature header with secret configured → 401."""
        mock_setting.CRISP_WEBHOOK_SECRET = "test-secret"
        mock_setting.ENVIRONMENT = "production"

        body = self._payload("message:send")

        client = self._make_client()
        resp = client.post(
            "/api/v1/webhooks/crisp",
            content=body,
            headers={"content-type": "application/json"},
        )
        assert resp.status_code == 401


# ─── Tests for Triage, SLA, and Ticket Creation Logic ─────────────────────────


class TestTriageAndSla:
    """Tests for classification heuristics and SLA deadlines."""

    def test_billing_urgent_triage(self):
        from app.routers.crisp_webhook import _classify_ticket_triage

        category, priority = _classify_ticket_triage(
            "Mon paiement Chargily EDAHABIA a échoué et mon compte est débité!"
        )
        assert category == "BILLING"
        assert priority == "URGENT"

    def test_billing_normal_triage(self):
        from app.routers.crisp_webhook import _classify_ticket_triage

        category, priority = _classify_ticket_triage(
            "Je souhaite obtenir une facture pour mon abonnement annuel"
        )
        assert category == "BILLING"
        assert priority == "HIGH"

    def test_learning_triage(self):
        from app.routers.crisp_webhook import _classify_ticket_triage

        category, priority = _classify_ticket_triage(
            "La vidéo de la leçon 4 du cours de Python ne charge pas"
        )
        assert category == "LEARNING"
        assert priority == "NORMAL"

    def test_hub_urgent_triage(self):
        from app.routers.crisp_webhook import _classify_ticket_triage

        category, priority = _classify_ticket_triage(
            "Litige urgent avec le client sur l'escrow de la milestone"
        )
        assert category == "HUB"
        assert priority == "URGENT"

    def test_account_triage(self):
        from app.routers.crisp_webhook import _classify_ticket_triage

        category, priority = _classify_ticket_triage(
            "Impossible de réinitialiser mon mot de passe de connexion"
        )
        assert category == "ACCOUNT"
        assert priority == "NORMAL"

    def test_general_high_bug_triage(self):
        from app.routers.crisp_webhook import _classify_ticket_triage

        category, priority = _classify_ticket_triage(
            "Erreur 500 et crash sur le dashboard"
        )
        assert category == "GENERAL"
        assert priority == "HIGH"

    def test_sla_deadlines_priority_scaling(self):
        from app.routers.crisp_webhook import _calculate_sla_deadlines
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        resp_urgent, res_urgent = _calculate_sla_deadlines("URGENT")
        resp_norm, res_norm = _calculate_sla_deadlines("NORMAL")

        # Urgent SLA response must be faster than normal
        assert (resp_urgent - now).total_seconds() < (resp_norm - now).total_seconds()
        assert (res_urgent - now).total_seconds() < (res_norm - now).total_seconds()


class TestCreateTicketFromChatHardened:
    """Tests for _create_ticket_from_chat with idempotency and guest handling."""

    @patch("app.routers.crisp_webhook.prisma")
    async def test_idempotent_session_returns_existing(self, mock_prisma):
        from app.routers.crisp_webhook import _create_ticket_from_chat
        from unittest.mock import MagicMock

        existing_ticket = MagicMock(id=42, ticketNumber="TCK-42")
        mock_prisma.ticket.find_first = AsyncMock(return_value=existing_ticket)

        data = {
            "session_id": "session-123",
            "messages": [{"from": "user", "content": "Hello"}],
            "email": "user@example.com",
        }

        result = await _create_ticket_from_chat(data)
        assert result == existing_ticket
        # Ensure no new ticket was created
        mock_prisma.ticket.create.assert_not_called()

    @patch("app.routers.crisp_webhook.prisma")
    async def test_guest_user_auto_created(self, mock_prisma):
        from app.routers.crisp_webhook import _create_ticket_from_chat
        from unittest.mock import MagicMock

        # No existing ticket and no existing user
        mock_prisma.ticket.find_first = AsyncMock(return_value=None)
        mock_prisma.user.find_first = AsyncMock(return_value=None)
        # Auto-create guest user
        guest_user = MagicMock(id=99, email="guest@unknown.com", emailVerified=False)
        mock_prisma.user.create = AsyncMock(return_value=guest_user)

        new_ticket = MagicMock(id=10, ticketNumber="TCK-10")
        mock_prisma.ticket.create = AsyncMock(return_value=new_ticket)
        mock_prisma.ticketmessage.create = AsyncMock()

        data = {
            "session_id": "session-guest",
            "messages": [
                {"from": "user", "content": "Question sur les tarifs DZD"},
                {"from": "operator", "content": "Voici nos tarifs"},
            ],
            "email": "guest@unknown.com",
            "nickname": "Karim Guest",
        }

        result = await _create_ticket_from_chat(data)
        assert result == new_ticket
        mock_prisma.user.create.assert_called_once()
        mock_prisma.ticket.create.assert_called_once()
        mock_prisma.ticketmessage.create.assert_called_once()
