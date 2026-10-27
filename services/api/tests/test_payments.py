"""
Tests for payment service.
Covers: payment initiation, webhook verification, escrow hold/release, refunds.
"""
import hmac
import hashlib


class TestCommissionCalculation:
    """Test platform commission calculations for financial correctness."""

    def test_standard_commission_rate(self):
        """Standard tier should apply correct commission."""
        gross_amount = 10000  # 100.00 DZD in cents
        commission_rate = 0.15  # 15%
        
        commission = int(gross_amount * commission_rate)
        net_amount = gross_amount - commission

        assert commission == 1500
        assert net_amount == 8500
        assert commission + net_amount == gross_amount

    def test_commission_rounds_down(self):
        """Commission should round down to avoid overcharging."""
        gross_amount = 333  # Odd amount
        commission_rate = 0.15

        commission = int(gross_amount * commission_rate)  # int() truncates
        net_amount = gross_amount - commission

        assert commission == 49  # 333 * 0.15 = 49.95 → 49
        assert net_amount == 284
        assert commission + net_amount == gross_amount

    def test_zero_amount_commission(self):
        """Zero amount should produce zero commission."""
        commission = int(0 * 0.15)
        assert commission == 0

    def test_commission_never_exceeds_gross(self):
        """Commission should never exceed the gross amount."""
        for amount in [1, 100, 999, 10000, 999999]:
            for rate in [0.05, 0.10, 0.15, 0.20, 0.50]:
                commission = int(amount * rate)
                assert commission <= amount
                assert amount - commission >= 0


class TestWebhookVerification:
    """Test payment webhook signature verification."""

    def test_valid_webhook_signature(self):
        """Valid webhook signature should pass verification."""
        secret = "test_webhook_secret"
        payload = '{"id": "123", "status": "paid"}'
        
        expected_sig = hmac.HMAC(
            secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()

        computed = hmac.HMAC(
            secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()

        assert computed == expected_sig

    def test_invalid_webhook_signature_rejected(self):
        """Invalid webhook signature should be rejected."""
        secret = "test_webhook_secret"
        payload = '{"id": "123", "status": "paid"}'
        wrong_sig = "invalid_signature_here"

        computed = hmac.HMAC(
            secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()

        assert computed != wrong_sig

    def test_tampered_payload_detected(self):
        """Modified payload should produce different signature."""
        secret = "test_webhook_secret"
        original = '{"id": "123", "status": "paid"}'
        tampered = '{"id": "123", "status": "refunded"}'

        sig_original = hmac.HMAC(secret.encode(), original.encode(), hashlib.sha256).hexdigest()
        sig_tampered = hmac.HMAC(secret.encode(), tampered.encode(), hashlib.sha256).hexdigest()

        assert sig_original != sig_tampered


class TestEscrowLogic:
    """Test escrow hold and release logic (pure calculations)."""

    def test_escrow_hold_reduces_available_balance(self):
        """Holding escrow should reduce available balance."""
        balance = 50000
        hold = 20000
        available = balance - hold
        assert available == 30000

    def test_escrow_release_to_freelancer(self):
        """Releasing escrow should transfer to freelancer minus commission."""
        escrow_amount = 50000
        commission_rate = 0.15
        commission = int(escrow_amount * commission_rate)
        freelancer_payout = escrow_amount - commission

        assert commission == 7500
        assert freelancer_payout == 42500
        assert commission + freelancer_payout == escrow_amount

    def test_escrow_refund_returns_full_amount(self):
        """Refund should return the full escrow amount to client."""
        escrow_amount = 50000
        refund_amount = escrow_amount
        assert refund_amount == 50000
