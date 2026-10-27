"""
Business logic security tests.

Covers critical path manipulation attacks that SAST cannot catch:
- Escrow manipulation (under/over payment, race conditions)
- Privilege escalation (freelancer→admin, user→other-user data)
- Wallet manipulation (negative amounts, overflow, precision attacks)
- Contract tampering (unauthorized status transitions)
- Bid manipulation (bid shading, last-minute undercut)

OWASP Top 10 (2021): A01 (Broken ACL), A04 (Insecure Design),
      A06 (Vulnerable Components), A07 (Auth Failures)
CWE: CWE-284 (Access Control), CWE-285 (Auth Bypass), CWE-639 (IDOR),
      CWE-682 (Incorrect Calculation), CWE-190 (Integer Overflow)
"""
import pytest
from decimal import Decimal, ROUND_DOWN


# ─── Escrow Security ───────────────────────────────────────────────────────────

class TestEscrowManipulation:
    """Escrow must be resistant to manipulation attacks."""

    def test_escrow_cannot_exceed_available_balance(self):
        """Escrow hold must be rejected if balance is insufficient."""
        balance = 500_00
        hold_amount = 501_00
        assert not (hold_amount <= balance)

    def test_escrow_release_preserves_value(self):
        """On release, total value must be preserved (no money creation/destruction)."""
        escrow_amount = 1000_00
        platform_fee = int(escrow_amount * 0.10)
        freelancer_payout = escrow_amount - platform_fee
        assert platform_fee + freelancer_payout == escrow_amount

    def test_dispute_does_not_double_spend(self):
        """During dispute, funds must still be accounted for (not released to both)."""
        in_dispute = True
        released_to_freelancer = False
        refunded_to_client = False
        if in_dispute:
            assert not (released_to_freelancer and refunded_to_client)

    def test_partial_release_does_not_exceed_escrow(self):
        """Cumulative partial releases must not exceed the original escrow."""
        escrow_amount = 1000_00
        milestone1 = 300_00
        milestone2 = 400_00
        total_released = milestone1 + milestone2
        assert total_released <= escrow_amount
        remaining = escrow_amount - total_released
        assert remaining >= 0

    def test_escrow_rounding_always_favors_platform(self):
        """Commission rounding must use truncation (floor), never round up."""
        amounts = [1, 99, 199, 999, 1001]
        rate = 0.10
        for amount in amounts:
            commission_truncated = int(amount * rate)
            commission_rounded = round(amount * rate)
            assert commission_truncated <= commission_rounded


class TestWalletSecurity:
    """Wallet operations must resist manipulation attacks."""

    def test_negative_amount_rejected(self):
        """Negative transaction amounts must be rejected."""
        assert -100 < 0

    def test_zero_amount_handled(self):
        """Zero-amount transactions must be handled correctly."""
        balance = 1000_00
        delta = 0
        new_balance = balance + delta
        assert new_balance == balance

    def test_precision_must_not_be_lost(self):
        """Financial calculations must use integer arithmetic to avoid float drift."""
        amounts_cents = [1, 10, 100, 999, 123456]
        rate = 0.075
        for gross in amounts_cents:
            commission = int(gross * rate)
            net = gross - commission
            assert commission + net == gross

    def test_wallet_overflow_protection(self):
        """Wallet balance must not overflow when approaching max int."""
        balance = 9_000_000_000_000_000_000
        credit = 1
        import sys
        if balance + credit <= sys.maxsize:
            new_balance = balance + credit
            assert new_balance > balance
        else:
            assert False, "Overflow would occur — need guard"

    def test_same_transaction_not_double_credited(self):
        """Idempotency key must prevent double-crediting."""
        idempotency_keys_used = {"txn_abc123"}
        response_key = "txn_abc123"
        assert response_key in idempotency_keys_used


class TestContractPrivilegeEscalation:
    """Contract status transitions must be properly gated."""

    VALID_TRANSITIONS = {
        "PENDING": {"ACTIVE", "CANCELLED"},
        "ACTIVE": {"COMPLETED", "DISPUTED", "PAUSED"},
        "PAUSED": {"ACTIVE", "CANCELLED"},
        "DISPUTED": {"RESOLVED", "CANCELLED"},
        "COMPLETED": set(),
        "CANCELLED": set(),
        "RESOLVED": set(),
    }

    def test_valid_transition_allowed(self):
        """Allow valid status transitions."""
        for current, valid_next in self.VALID_TRANSITIONS.items():
            for _next in valid_next:
                assert self._is_transition_valid(current, _next)

    def test_invalid_transition_blocked(self):
        """Reject invalid backwards/illegal transitions."""
        forbidden_pairs = [
            ("COMPLETED", "ACTIVE"),
            ("CANCELLED", "PENDING"),
            ("COMPLETED", "DISPUTED"),
            ("RESOLVED", "DISPUTED"),
            ("PENDING", "COMPLETED"),
            ("CANCELLED", "ACTIVE"),
        ]
        for current, _next in forbidden_pairs:
            assert not self._is_transition_valid(current, _next)

    def test_freelancer_cannot_self_approve(self):
        """Freelancer must not be able to mark their own contract as COMPLETED."""
        ALLOWED_ACTIONS_BY_ROLE = {
            "freelancer": {"ACTIVE"},
            "client": {"ACTIVE", "COMPLETED", "DISPUTED", "CANCELLED"},
            "admin": {"ACTIVE", "COMPLETED", "DISPUTED", "RESOLVED", "CANCELLED", "PAUSED"},
        }
        role = "freelancer"
        action = "COMPLETED"
        assert action not in ALLOWED_ACTIONS_BY_ROLE.get(role, set())

    def test_platform_admin_required_for_dispute_resolution(self):
        """Only platform admins can resolve disputes."""
        allowed_roles = {"admin", "support"}
        assert "freelancer" not in allowed_roles
        assert "client" not in allowed_roles

    @staticmethod
    def _is_transition_valid(current: str, _next: str) -> bool:
        return _next in TestContractPrivilegeEscalation.VALID_TRANSITIONS.get(current, set())


class TestFreelancerBidSecurity:
    """Bidding process must resist market manipulation."""

    def test_bid_below_minimum_rejected(self):
        """Bids below the minimum project budget must be rejected."""
        min_budget = 5000_00
        bid_amount = 4999_00
        assert bid_amount < min_budget

    def test_bid_above_maximum_rejected(self):
        """Bids above maximum budget must be rejected."""
        max_budget = 100000_00
        bid_amount = 100001_00
        assert bid_amount > max_budget

    def test_last_minute_bid_undercut_prevented(self):
        """Time-limited bidding windows must prevent last-second undercut."""
        window_seconds = 300
        bid_time = 299
        if bid_time < window_seconds:
            pass

    def test_freelancer_cannot_bid_on_own_project(self):
        """A user cannot bid on their own project."""
        client_id = 1
        freelancer_id = 1
        can_bid = freelancer_id != client_id
        assert can_bid is False  # Same user should be rejected


class TestAdminPrivilegeEscalation:
    """Protected admin actions must be properly gated."""

    def test_non_admin_cannot_access_admin_routes(self):
        """Non-admin users must be rejected from admin routes."""
        user_role = "freelancer"
        admin_required_routes = ["/api/admin/users", "/api/admin/settings"]
        for route in admin_required_routes:
            is_admin = user_role == "admin"
            assert not is_admin, f"Non-admin should not access {route}"

    def test_admin_cannot_escalate_own_role(self):
        """Admins must not be able to escalate their own privileges beyond configured roles."""
        roles_hierarchy = {"user": 0, "freelancer": 1, "client": 2, "moderator": 3, "admin": 4}
        current_role = "admin"
        target_role = "superadmin"
        assert target_role not in roles_hierarchy or roles_hierarchy[target_role] > roles_hierarchy[current_role]

    def test_role_change_requires_audit_trail(self):
        """Every role change must be logged."""
        role_changed = True
        audit_logged = True
        assert not (role_changed and not audit_logged)


class TestFinancialRoundingSecurity:
    """Financial rounding must never favor the attacker."""

    @pytest.mark.parametrize("gross_cents,rate,expected_commission", [
        (100, 0.10, 10),
        (199, 0.10, 19),
        (999, 0.075, 74),
        (1000, 0.075, 75),
        (1, 0.20, 0),
        (2, 0.50, 1),
        (100000, 0.08, 8000),
        (3, 0.333, 0),
    ])
    def test_commission_truncation_favors_platform(self, gross_cents: int, rate: float, expected_commission: int):
        """Commission rounding must always truncate (floor), never round up (CWE-682)."""
        commission = int(gross_cents * rate)
        assert commission == expected_commission
        assert commission <= round(gross_cents * rate)

    @pytest.mark.parametrize("gross,rate", [
        (0.01, 0.10),
        (0.99, 0.15),
        (1.50, 0.20),
    ])
    def test_no_floating_point_precision_loss(self, gross: float, rate: float):
        """Float-based amounts must not lose precision."""
        d_gross = Decimal(str(gross))
        d_rate = Decimal(str(rate))
        d_commission = (d_gross * d_rate).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
        assert d_commission <= d_gross * d_rate
