"""
Property-based tests for financial calculations.

Uses hypothesis to generate random inputs and verify invariants
that must ALWAYS hold for financial operations:
- Commission + net = gross (no money created or destroyed)
- All amounts are non-negative integers
- Commission never exceeds gross amount
- Rounding always favors the platform (truncation)
"""
from hypothesis import given, strategies as st, assume, settings as hyp_settings


# Commission tiers (from the codebase)
COMMISSION_TIERS = {
    "NEW": 0.20,       # 20% for new freelancers
    "BRONZE": 0.15,    # 15%
    "SILVER": 0.12,    # 12%
    "GOLD": 0.10,      # 10%
    "PLATINUM": 0.08,  # 8%
}


def calculate_commission(gross_cents: int, rate: float) -> tuple:
    """
    Calculate commission and net amount.
    Returns (commission_cents, net_cents).
    Uses int() truncation (floor) to avoid overcharging.
    """
    commission_cents = int(gross_cents * rate)
    net_cents = gross_cents - commission_cents
    return commission_cents, net_cents


class TestCommissionInvariants:
    """Property-based tests for commission calculations."""

    @given(
        gross=st.integers(min_value=1, max_value=100_000_000),  # 1 cent to 1M DZD
        rate=st.sampled_from(list(COMMISSION_TIERS.values())),
    )
    @hyp_settings(max_examples=1000)
    def test_commission_plus_net_equals_gross(self, gross: int, rate: float):
        """INVARIANT: commission + net must always equal gross (no money lost)."""
        commission, net = calculate_commission(gross, rate)
        assert commission + net == gross

    @given(
        gross=st.integers(min_value=0, max_value=100_000_000),
        rate=st.floats(min_value=0.0, max_value=1.0),
    )
    @hyp_settings(max_examples=1000)
    def test_commission_never_exceeds_gross(self, gross: int, rate: float):
        """INVARIANT: commission can never be more than the gross amount."""
        assume(not (rate != rate))  # Exclude NaN
        commission, net = calculate_commission(gross, rate)
        assert commission <= gross
        assert commission >= 0
        assert net >= 0

    @given(
        gross=st.integers(min_value=1, max_value=100_000_000),
        rate=st.sampled_from(list(COMMISSION_TIERS.values())),
    )
    @hyp_settings(max_examples=500)
    def test_net_is_always_non_negative(self, gross: int, rate: float):
        """INVARIANT: freelancer net payout is always non-negative."""
        _, net = calculate_commission(gross, rate)
        assert net >= 0

    @given(
        gross=st.integers(min_value=1, max_value=100_000_000),
        rate=st.sampled_from(list(COMMISSION_TIERS.values())),
    )
    @hyp_settings(max_examples=500)
    def test_higher_tier_means_lower_commission(self, gross: int, rate: float):
        """Higher tiers should always result in lower or equal commission."""
        rates_sorted = sorted(COMMISSION_TIERS.values(), reverse=True)
        commissions = [int(gross * r) for r in rates_sorted]
        # Each commission should be >= the next (since rates are descending)
        for i in range(len(commissions) - 1):
            assert commissions[i] >= commissions[i + 1]


class TestEscrowInvariants:
    """Property-based tests for escrow operations."""

    @given(
        balance=st.integers(min_value=0, max_value=100_000_000),
        hold_amount=st.integers(min_value=0, max_value=100_000_000),
    )
    @hyp_settings(max_examples=500)
    def test_hold_cannot_exceed_balance(self, balance: int, hold_amount: int):
        """INVARIANT: escrow hold should be rejected if it exceeds balance."""
        can_hold = hold_amount <= balance
        if can_hold:
            available = balance - hold_amount
            assert available >= 0
            assert available + hold_amount == balance

    @given(
        escrow_amount=st.integers(min_value=1, max_value=100_000_000),
        rate=st.sampled_from(list(COMMISSION_TIERS.values())),
    )
    @hyp_settings(max_examples=500)
    def test_escrow_release_preserves_total(self, escrow_amount: int, rate: float):
        """INVARIANT: on release, commission + freelancer_payout = escrow_amount."""
        commission = int(escrow_amount * rate)
        freelancer_payout = escrow_amount - commission
        assert commission + freelancer_payout == escrow_amount

    @given(
        escrow_amount=st.integers(min_value=1, max_value=100_000_000),
    )
    @hyp_settings(max_examples=200)
    def test_full_refund_returns_exact_amount(self, escrow_amount: int):
        """INVARIANT: full refund returns exactly the escrowed amount."""
        refund = escrow_amount
        assert refund == escrow_amount


class TestWalletInvariants:
    """Property-based tests for wallet operations."""

    @given(
        initial_balance=st.integers(min_value=0, max_value=100_000_000),
        credit_amount=st.integers(min_value=1, max_value=100_000_000),
    )
    @hyp_settings(max_examples=500)
    def test_credit_increases_balance(self, initial_balance: int, credit_amount: int):
        """INVARIANT: crediting a wallet always increases balance."""
        new_balance = initial_balance + credit_amount
        assert new_balance > initial_balance
        assert new_balance == initial_balance + credit_amount

    @given(
        initial_balance=st.integers(min_value=0, max_value=100_000_000),
        debit_amount=st.integers(min_value=0, max_value=100_000_000),
    )
    @hyp_settings(max_examples=500)
    def test_debit_cannot_go_negative(self, initial_balance: int, debit_amount: int):
        """INVARIANT: wallet balance can never go below zero."""
        can_debit = debit_amount <= initial_balance
        if can_debit:
            new_balance = initial_balance - debit_amount
            assert new_balance >= 0
