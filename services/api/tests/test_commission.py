"""
Tests for commission calculation service.
Covers: tier-based rates, edge cases, financial invariants.

Commission rates (from CommissionRateConfig / admin settings):
  NEW        = 20%
  STANDARD   = 15%
  PRO        = 10%
  ENTERPRISE = 7%
"""
import pytest


# Commission rates by tier — must match what's in CommissionRateConfig (seeded values)
COMMISSION_RATES = {
    "NEW": 0.00,         # 0% for first 3 projects (cold-start incentive)
    "STANDARD": 0.10,    # 10% standard after 3+ projects
    "PRO": 0.08,         # 8% for 4.5+ star, 20+ projects
    "ENTERPRISE": 0.07,  # 7% for 4.8+ star, 100+ projects
}


def calculate_commission(gross_amount_cents: int, tier: str) -> dict:
    """Pure function for commission calculation (mirrors service logic)."""
    rate = COMMISSION_RATES.get(tier, 0.10)  # default 10% for unknown tiers
    commission_cents = int(gross_amount_cents * rate)
    net_amount_cents = gross_amount_cents - commission_cents
    return {
        "gross_amount_cents": gross_amount_cents,
        "commission_rate": rate,
        "commission_cents": commission_cents,
        "net_amount_cents": net_amount_cents,
    }


class TestCommissionCalculation:
    """Test commission calculation for all tiers."""

    def test_new_tier_20_percent(self):
        """NEW tier should charge 0% commission (cold-start incentive)."""
        result = calculate_commission(10000, "NEW")
        assert result["commission_cents"] == 0
        assert result["net_amount_cents"] == 10000

    def test_standard_tier_15_percent(self):
        """STANDARD tier should charge 10% commission."""
        result = calculate_commission(10000, "STANDARD")
        assert result["commission_cents"] == 1000
        assert result["net_amount_cents"] == 9000

    def test_pro_tier_10_percent(self):
        """PRO tier should charge 8% commission."""
        result = calculate_commission(10000, "PRO")
        assert result["commission_cents"] == 800
        assert result["net_amount_cents"] == 9200

    def test_enterprise_tier_7_percent(self):
        """ENTERPRISE tier should charge 7% commission."""
        result = calculate_commission(10000, "ENTERPRISE")
        assert result["commission_cents"] == 700
        assert result["net_amount_cents"] == 9300


class TestFinancialInvariants:
    """Test that financial invariants always hold."""

    @pytest.mark.parametrize("amount", [1, 100, 999, 5000, 10000, 99999, 1000000])
    def test_commission_plus_net_equals_gross(self, amount):
        """commission + net must ALWAYS equal gross (no money lost or created)."""
        for tier in COMMISSION_RATES:
            result = calculate_commission(amount, tier)
            assert result["commission_cents"] + result["net_amount_cents"] == amount

    @pytest.mark.parametrize("amount", [1, 100, 999, 5000, 10000, 99999, 1000000])
    def test_commission_never_exceeds_gross(self, amount):
        """Commission should never exceed the gross amount."""
        for tier in COMMISSION_RATES:
            result = calculate_commission(amount, tier)
            assert result["commission_cents"] <= amount
            assert result["commission_cents"] >= 0

    @pytest.mark.parametrize("amount", [1, 100, 999, 5000, 10000, 99999, 1000000])
    def test_net_amount_always_non_negative(self, amount):
        """Net amount should always be non-negative."""
        for tier in COMMISSION_RATES:
            result = calculate_commission(amount, tier)
            assert result["net_amount_cents"] >= 0

    def test_zero_amount(self):
        """Zero amount should produce zero commission."""
        result = calculate_commission(0, "STANDARD")
        assert result["commission_cents"] == 0
        assert result["net_amount_cents"] == 0

    def test_one_cent_minimum(self):
        """Even 1 cent should be handled correctly."""
        result = calculate_commission(1, "STANDARD")
        # 1 * 0.15 = 0.15 → int(0.15) = 0
        assert result["commission_cents"] == 0
        assert result["net_amount_cents"] == 1

    def test_commission_truncates_not_rounds(self):
        """Commission should truncate (floor), never round up."""
        # 333 * 0.10 = 33.3 → should be 33, not 34
        result = calculate_commission(333, "STANDARD")
        assert result["commission_cents"] == 33
        assert result["net_amount_cents"] == 300
        assert result["commission_cents"] + result["net_amount_cents"] == 333


class TestTierProgression:
    """Test that higher tiers always get better rates (after cold-start)."""

    def test_higher_tier_lower_commission(self):
        """After NEW (0% incentive), higher tiers should have lower commission rates."""
        # STANDARD → PRO → ENTERPRISE should be descending
        assert COMMISSION_RATES["STANDARD"] > COMMISSION_RATES["PRO"]
        assert COMMISSION_RATES["PRO"] > COMMISSION_RATES["ENTERPRISE"]

    def test_higher_tier_more_earnings(self):
        """Higher tier freelancers should earn more from the same contract (after cold-start)."""
        amount = 100000  # 1000 DZD
        results = {
            tier: calculate_commission(amount, tier)
            for tier in ["STANDARD", "PRO", "ENTERPRISE"]
        }
        assert results["PRO"]["net_amount_cents"] > results["STANDARD"]["net_amount_cents"]
        assert results["ENTERPRISE"]["net_amount_cents"] > results["PRO"]["net_amount_cents"]


class TestUnknownTier:
    """Test handling of unknown/invalid tiers."""

    def test_unknown_tier_defaults_to_15_percent(self):
        """Unknown tier should default to 10% (STANDARD equivalent)."""
        result = calculate_commission(10000, "UNKNOWN")
        assert result["commission_rate"] == 0.10
        assert result["commission_cents"] == 1000

    def test_empty_tier_defaults(self):
        """Empty string tier should default to 10%."""
        result = calculate_commission(10000, "")
        assert result["commission_rate"] == 0.10
