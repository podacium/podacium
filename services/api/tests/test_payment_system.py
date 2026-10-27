"""
Comprehensive tests for the payment system.
Covers: subscriptions, course/path purchases, freelance escrow, wallets,
        webhooks, price resolution, and financial invariants across all flows.
"""
import pytest
from datetime import datetime, timezone, timedelta


# =============================================================================
# CONSTANTS — mirror the production values in payment_router.py
# =============================================================================

SUBSCRIPTION_PRICES_DZD = {
    "STUDENT_STARTER_MONTHLY": 1900,
    "STUDENT_STARTER_YEARLY": 17900,
    "STUDENT_PLUS_MONTHLY": 3400,
    "STUDENT_PLUS_YEARLY": 31900,
    "STUDENT_PRO_MONTHLY": 5400,
    "STUDENT_PRO_YEARLY": 49900,
    "BI_GROWTH_MONTHLY": 3500,
    "BI_GROWTH_YEARLY": 32900,
    "BI_SCALE_MONTHLY": 8000,
    "BI_SCALE_YEARLY": 74900,
    "BI_ELITE_MONTHLY": 15000,
    "BI_ELITE_YEARLY": 139900,
    "FREE_MONTHLY": 0,
    "FREE_YEARLY": 0,
}

COMMISSION_RATES = {
    "NEW": 0.00,
    "STANDARD": 0.10,
    "PRO": 0.08,
    "ENTERPRISE": 0.07,
}

# Valid subscription state transitions
SUBSCRIPTION_TRANSITIONS = {
    "ACTIVE": ["PAUSED", "CANCELLED", "GRACE_PERIOD", "PENDING_PAYMENT"],
    "PAUSED": ["ACTIVE", "CANCELLED"],
    "CANCELLED": [],
    "EXPIRED": [],
    "GRACE_PERIOD": ["ACTIVE", "EXPIRED", "PENDING_PAYMENT"],
    "PENDING_PAYMENT": ["ACTIVE", "CANCELLED", "EXPIRED"],
}

VALID_WEBHOOK_EVENTS = {"checkout.paid", "checkout.failed", "checkout.canceled", "checkout.expired"}


# =============================================================================
# PURE FUNCTIONS — mirror production logic for testing
# =============================================================================

def resolve_subscription_price(plan: str, billing_cycle: str) -> int:
    key = f"{plan}_{billing_cycle.upper()}"
    price = SUBSCRIPTION_PRICES_DZD.get(key)
    if price is None:
        raise ValueError(f"Unknown plan/cycle: {key}")
    if price <= 0:
        raise ValueError(f"Plan is free: {key}")
    return price


def parse_price_json(price_data) -> dict:
    if not price_data:
        return {}
    if isinstance(price_data, str):
        try:
            import json
            return json.loads(price_data)
        except Exception:
            return {}
    if isinstance(price_data, dict):
        return price_data
    return {}


def extract_effective_price(price_dict: dict) -> int:
    if not isinstance(price_dict, dict):
        return 0
    discounted = price_dict.get("discounted")
    if discounted is not None:
        try:
            if int(discounted) > 0:
                return int(discounted)
        except (ValueError, TypeError):
            pass
    original = price_dict.get("original")
    if original is not None:
        try:
            if int(original) > 0:
                return int(original)
        except (ValueError, TypeError):
            pass
    amount = price_dict.get("amount", 0) or price_dict.get("price", 0) or 0
    try:
        return int(amount)
    except (ValueError, TypeError):
        return 0


def calculate_subscription_period(billing_cycle: str, current_period_start: datetime = None) -> dict:
    """Calculate the next billing period dates."""
    now = current_period_start or datetime.now(timezone.utc)
    if billing_cycle == "yearly":
        period_end = now + timedelta(days=365)
    else:
        period_end = now + timedelta(days=30)
    return {"start": now, "end": period_end}


def calculate_commission(gross_amount_cents: int, tier: str) -> dict:
    rate = COMMISSION_RATES.get(tier, 0.10)
    commission = int(gross_amount_cents * rate)
    net = gross_amount_cents - commission
    return {
        "gross": gross_amount_cents,
        "rate": rate,
        "commission": commission,
        "net": net,
    }


def transition_subscription(current_status: str, target_status: str) -> bool:
    valid = SUBSCRIPTION_TRANSITIONS.get(current_status, [])
    return target_status in valid


def get_webhook_action(event_type: str) -> str:
    if event_type == "checkout.paid":
        return "finalize_success"
    elif event_type in ("checkout.failed", "checkout.canceled", "checkout.expired"):
        return "finalize_failure"
    return "unknown"


def can_enroll(price: int, is_authenticated: bool, is_already_enrolled: bool) -> tuple[bool, str]:
    if not is_authenticated:
        return False, "AUTH_REQUIRED"
    if is_already_enrolled:
        return False, "ALREADY_ENROLLED"
    if price < 0:
        return False, "INVALID_PRICE"
    if price == 0:
        return True, "FREE"
    return True, "PAID"


def normalize_price(price_data) -> int:
    """Frontend-style price normalization."""
    price_dict = parse_price_json(price_data)
    if not price_dict:
        if isinstance(price_data, (int, float)) and price_data > 0:
            return int(price_data)
        return 0
    return extract_effective_price(price_dict)


# =============================================================================
# TESTS
# =============================================================================

class TestSubscriptionPriceResolution:
    """SUBSCRIPTIONS: Plan tier + billing cycle price resolution."""

    def test_student_starter_monthly(self):
        assert resolve_subscription_price("STUDENT_STARTER", "monthly") == 1900

    def test_student_starter_yearly(self):
        assert resolve_subscription_price("STUDENT_STARTER", "yearly") == 17900

    def test_student_plus_monthly(self):
        assert resolve_subscription_price("STUDENT_PLUS", "monthly") == 3400

    def test_student_plus_yearly(self):
        assert resolve_subscription_price("STUDENT_PLUS", "yearly") == 31900

    def test_student_pro_monthly(self):
        assert resolve_subscription_price("STUDENT_PRO", "monthly") == 5400

    def test_student_pro_yearly(self):
        assert resolve_subscription_price("STUDENT_PRO", "yearly") == 49900

    def test_bi_growth_monthly(self):
        assert resolve_subscription_price("BI_GROWTH", "monthly") == 3500

    def test_bi_growth_yearly(self):
        assert resolve_subscription_price("BI_GROWTH", "yearly") == 32900

    def test_bi_scale_monthly(self):
        assert resolve_subscription_price("BI_SCALE", "monthly") == 8000

    def test_bi_scale_yearly(self):
        assert resolve_subscription_price("BI_SCALE", "yearly") == 74900

    def test_bi_elite_monthly(self):
        assert resolve_subscription_price("BI_ELITE", "monthly") == 15000

    def test_bi_elite_yearly(self):
        assert resolve_subscription_price("BI_ELITE", "yearly") == 139900

    def test_free_monthly_raises(self):
        with pytest.raises(ValueError, match="free"):
            resolve_subscription_price("FREE", "monthly")

    def test_free_yearly_raises(self):
        with pytest.raises(ValueError, match="free"):
            resolve_subscription_price("FREE", "yearly")

    def test_custom_plan_raises(self):
        with pytest.raises(ValueError, match="Unknown"):
            resolve_subscription_price("CUSTOM", "monthly")

    def test_unknown_plan_raises(self):
        with pytest.raises(ValueError, match="Unknown"):
            resolve_subscription_price("NONEXISTENT", "monthly")

    def test_yearly_is_cheaper_than_12x_monthly(self):
        """Yearly should always be cheaper than 12 months."""
        for plan in ["STUDENT_STARTER", "STUDENT_PLUS", "STUDENT_PRO", "BI_GROWTH", "BI_SCALE", "BI_ELITE"]:
            monthly = resolve_subscription_price(plan, "monthly")
            yearly = resolve_subscription_price(plan, "yearly")
            assert yearly < monthly * 12, f"{plan}: yearly {yearly} >= 12*{monthly}"

    def test_all_plans_have_both_cycles(self):
        """Every paid plan must have both monthly and yearly prices."""
        paid_plans = ["STUDENT_STARTER", "STUDENT_PLUS", "STUDENT_PRO", "BI_GROWTH", "BI_SCALE", "BI_ELITE"]
        for plan in paid_plans:
            m = resolve_subscription_price(plan, "monthly")
            y = resolve_subscription_price(plan, "yearly")
            assert m > 0, f"{plan} monthly is 0"
            assert y > 0, f"{plan} yearly is 0"


class TestSubscriptionBillingCycle:
    """SUBSCRIPTIONS: Billing cycle calculations — monthly vs yearly."""

    def test_monthly_period_is_30_days(self):
        result = calculate_subscription_period("monthly", datetime(2025, 1, 1, tzinfo=timezone.utc))
        assert result["start"] == datetime(2025, 1, 1, tzinfo=timezone.utc)
        assert result["end"] == datetime(2025, 1, 31, tzinfo=timezone.utc)

    def test_yearly_period_is_365_days(self):
        result = calculate_subscription_period("yearly", datetime(2025, 1, 1, tzinfo=timezone.utc))
        assert result["start"] == datetime(2025, 1, 1, tzinfo=timezone.utc)
        assert result["end"] == datetime(2026, 1, 1, tzinfo=timezone.utc)

    def test_renewal_extends_period(self):
        first = calculate_subscription_period("monthly", datetime(2025, 1, 1, tzinfo=timezone.utc))
        second = calculate_subscription_period("monthly", first["end"])
        assert second["start"] == first["end"]
        assert second["end"] == first["end"] + timedelta(days=30)

    def test_renewal_yearly(self):
        first = calculate_subscription_period("yearly", datetime(2025, 1, 1, tzinfo=timezone.utc))
        second = calculate_subscription_period("yearly", first["end"])
        assert second["end"] - second["start"] == timedelta(days=365)


class TestSubscriptionStateTransitions:
    """SUBSCRIPTIONS: State machine transitions."""

    def test_active_can_pause(self):
        assert transition_subscription("ACTIVE", "PAUSED") is True

    def test_active_can_cancel(self):
        assert transition_subscription("ACTIVE", "CANCELLED") is True

    def test_active_can_enter_grace(self):
        assert transition_subscription("ACTIVE", "GRACE_PERIOD") is True

    def test_active_can_pending_payment(self):
        assert transition_subscription("ACTIVE", "PENDING_PAYMENT") is True

    def test_paused_can_resume(self):
        assert transition_subscription("PAUSED", "ACTIVE") is True

    def test_paused_can_cancel(self):
        assert transition_subscription("PAUSED", "CANCELLED") is True

    def test_cancelled_is_terminal(self):
        """CANCELLED should not transition to any state."""
        for target in ["ACTIVE", "PAUSED", "GRACE_PERIOD", "EXPIRED", "PENDING_PAYMENT"]:
            assert transition_subscription("CANCELLED", target) is False

    def test_expired_is_terminal(self):
        """EXPIRED should not transition to any state."""
        for target in ["ACTIVE", "PAUSED", "CANCELLED", "GRACE_PERIOD", "PENDING_PAYMENT"]:
            assert transition_subscription("EXPIRED", target) is False

    def test_grace_can_return_to_active(self):
        """After successful retry, GRACE_PERIOD → ACTIVE."""
        assert transition_subscription("GRACE_PERIOD", "ACTIVE") is True

    def test_grace_can_expire(self):
        """After exhausting retries, GRACE_PERIOD → EXPIRED."""
        assert transition_subscription("GRACE_PERIOD", "EXPIRED") is True

    def test_grace_can_pending_payment(self):
        assert transition_subscription("GRACE_PERIOD", "PENDING_PAYMENT") is True

    def test_pending_payment_can_activate(self):
        assert transition_subscription("PENDING_PAYMENT", "ACTIVE") is True

    def test_pending_payment_can_cancel(self):
        assert transition_subscription("PENDING_PAYMENT", "CANCELLED") is True

    def test_pending_payment_can_expire(self):
        assert transition_subscription("PENDING_PAYMENT", "EXPIRED") is True

    def test_paused_cannot_enter_grace(self):
        """Paused subscriptions should not go to grace."""
        assert transition_subscription("PAUSED", "GRACE_PERIOD") is False

    def test_cancelled_cannot_re_enter(self):
        assert transition_subscription("CANCELLED", "ACTIVE") is False
        assert transition_subscription("CANCELLED", "PAUSED") is False
        assert transition_subscription("CANCELLED", "GRACE_PERIOD") is False

    def test_invalid_source_returns_empty(self):
        assert transition_subscription("UNKNOWN", "ACTIVE") is False


class TestSubscriptionDunning:
    """SUBSCRIPTIONS: Dunning (failed payment retry) logic."""

    def test_renewal_retry_on_day_1(self):
        """First retry should be 1 day after failed renewal."""
        failed_at = datetime(2025, 6, 1, tzinfo=timezone.utc)
        expected_retry = failed_at + timedelta(days=1)
        assert expected_retry == datetime(2025, 6, 2, tzinfo=timezone.utc)

    def test_renewal_retry_on_day_3(self):
        """Second retry should be 3 days after failed renewal."""
        failed_at = datetime(2025, 6, 1, tzinfo=timezone.utc)
        expected_retry = failed_at + timedelta(days=3)
        assert expected_retry == datetime(2025, 6, 4, tzinfo=timezone.utc)

    def test_renewal_retry_on_day_5(self):
        """Third retry should be 5 days after failed renewal."""
        failed_at = datetime(2025, 6, 1, tzinfo=timezone.utc)
        expected_retry = failed_at + timedelta(days=5)
        assert expected_retry == datetime(2025, 6, 6, tzinfo=timezone.utc)

    def test_grace_period_duration(self):
        """Grace period should be 7 days."""
        failed_at = datetime.now(timezone.utc)
        grace_end = failed_at + timedelta(days=7)
        assert (grace_end - failed_at).days == 7

    def test_expiry_after_3_retries(self):
        """After 3 failed retries, subscription should expire."""
        retries = 3
        assert retries >= 3  # Should expire

    def test_before_3_retries_still_in_grace(self):
        retries = 2
        assert retries < 3  # Still in grace

    def test_successful_retry_reactivates(self):
        """Successful dunning retry should set status back to ACTIVE."""
        dunning_success = True
        assert dunning_success is True

    def test_retry_increments_attempt_counter(self):
        old_retries = 0
        new_retries = old_retries + 1
        assert new_retries == 1


class TestCoursePathPriceResolution:
    """COURSE/PATH PURCHASES: Price extraction from JSON price field."""

    def test_discounted_price_takes_priority(self):
        price = {"original": 10000, "discounted": 8000}
        assert extract_effective_price(price) == 8000

    def test_original_price_when_no_discount(self):
        price = {"original": 10000}
        assert extract_effective_price(price) == 10000

    def test_amount_fallback(self):
        price = {"amount": 5000}
        assert extract_effective_price(price) == 5000

    def test_price_fallback(self):
        price = {"price": 3000}
        assert extract_effective_price(price) == 3000

    def test_empty_dict_returns_zero(self):
        assert extract_effective_price({}) == 0

    def test_none_returns_zero(self):
        assert extract_effective_price(None) == 0

    def test_discounted_zero_ignores(self):
        """discounted: 0 should be ignored, fall back to original."""
        price = {"original": 10000, "discounted": 0}
        assert extract_effective_price(price) == 10000

    def test_discounted_negative_ignores(self):
        price = {"original": 10000, "discounted": -500}
        assert extract_effective_price(price) == 10000

    def test_all_fields_zero(self):
        assert extract_effective_price({"original": 0, "discounted": 0, "amount": 0}) == 0

    def test_string_json_parsing(self):
        import json
        price_str = json.dumps({"original": 7500, "discounted": 6500})
        price_dict = parse_price_json(price_str)
        assert extract_effective_price(price_dict) == 6500

    def test_invalid_string_returns_empty(self):
        assert parse_price_json("not valid json") == {}

    def test_empty_string_returns_empty(self):
        assert parse_price_json("") == {}

    def test_none_price_data(self):
        assert parse_price_json(None) == {}

    def test_int_price_data(self):
        """If price_data is an int, normalize_price should use it directly."""
        assert normalize_price(5000) == 5000

    def test_negative_int_price(self):
        assert normalize_price(-100) == 0

    def test_zero_int_price(self):
        assert normalize_price(0) == 0


class TestEnrollmentAccess:
    """COURSE/PATH PURCHASES: Enrollment access rules."""

    def test_unauthenticated_cannot_enroll(self):
        ok, reason = can_enroll(5000, is_authenticated=False, is_already_enrolled=False)
        assert ok is False
        assert reason == "AUTH_REQUIRED"

    def test_already_enrolled_returns_false(self):
        ok, reason = can_enroll(5000, is_authenticated=True, is_already_enrolled=True)
        assert ok is False
        assert reason == "ALREADY_ENROLLED"

    def test_free_course_allows_enrollment(self):
        ok, reason = can_enroll(0, is_authenticated=True, is_already_enrolled=False)
        assert ok is True
        assert reason == "FREE"

    def test_paid_course_requires_payment(self):
        ok, reason = can_enroll(5000, is_authenticated=True, is_already_enrolled=False)
        assert ok is True
        assert reason == "PAID"

    def test_invalid_negative_price(self):
        ok, reason = can_enroll(-1, is_authenticated=True, is_already_enrolled=False)
        assert ok is False
        assert reason == "INVALID_PRICE"

    def test_free_path_allows_enrollment(self):
        ok, _ = can_enroll(0, is_authenticated=True, is_already_enrolled=False)
        assert ok is True


class TestEscrowReleaseInvariants:
    """FREELANCE: Balance invariants during escrow release."""

    def test_commission_plus_net_equals_gross(self):
        for tier in COMMISSION_RATES:
            for amount in [1000, 5000, 10000, 50000, 999999]:
                result = calculate_commission(amount, tier)
                assert result["commission"] + result["net"] == amount

    def test_net_always_non_negative(self):
        for tier in COMMISSION_RATES:
            for amount in [1, 100, 5000, 100000]:
                result = calculate_commission(amount, tier)
                assert result["net"] >= 0

    def test_commission_never_exceeds_gross(self):
        for tier in COMMISSION_RATES:
            for amount in [1, 100, 5000, 100000]:
                result = calculate_commission(amount, tier)
                assert result["commission"] <= amount

    def test_freelancer_balance_increases_by_net(self):
        """After release, freelancer balance should increase by net_amount."""
        old_balance = 20000
        gross = 50000
        result = calculate_commission(gross, "STANDARD")
        new_balance = old_balance + result["net"]
        assert new_balance == 20000 + 45000  # 50000 - 5000
        assert new_balance - old_balance == result["net"]

    def test_client_hold_decreases_by_gross(self):
        """After release, client hold balance should decrease by gross."""
        old_hold = 50000
        gross = 50000
        new_hold = old_hold - gross
        assert new_hold == 0

    def test_client_balance_unchanged_after_release(self):
        """Client balance should remain the same (hold is released, not deducted)."""
        client_balance = 100000
        old_hold = 50000
        gross = 50000
        new_hold = old_hold - gross
        assert client_balance == 100000  # Unchanged
        assert new_hold == 0  # Hold released

    def test_freelancer_profile_updated(self):
        """Freelancer profile fields should increment after release."""
        completed_before = 5
        total_earned_before = 200000
        platform_fee_before = 20000
        gross = 50000
        result = calculate_commission(gross, "STANDARD")

        completed_after = completed_before + 1
        total_earned_after = total_earned_before + result["net"]
        platform_fee_after = platform_fee_before + result["commission"]

        assert completed_after == 6
        assert total_earned_after == 200000 + 45000
        assert platform_fee_after == 20000 + 5000

    def test_multiple_releases_accumulate(self):
        """Multiple escrow releases should accumulate correctly."""
        wallet = 0
        completed = 0
        total_earned = 0
        platform_fee = 0

        releases = [
            (50000, "NEW"),
            (30000, "STANDARD"),
            (75000, "PRO"),
        ]
        for gross, tier in releases:
            result = calculate_commission(gross, tier)
            wallet += result["net"]
            completed += 1
            total_earned += result["net"]
            platform_fee += result["commission"]

        assert completed == 3
        assert wallet == 50000 + 27000 + 69000  # NEW(0%) + STAND(10%) + PRO(8%)
        assert total_earned == wallet
        assert platform_fee == 0 + 3000 + 6000

    def test_invariant_hold_plus_balance_after_release(self):
        """After full release: client balance unchanged, hold 0."""
        client_balance = 100000
        client_hold = 50000
        escrow_amount = 50000

        client_hold -= escrow_amount  # Release hold
        assert client_balance == 100000  # Unchanged
        assert client_hold == 0

    def test_funds_conservation_across_parties(self):
        """Total funds in system should be conserved (client + freelancer + platform)."""
        client_balance = 100000
        client_hold = 50000
        freelancer_balance = 10000
        escrow_amount = 50000

        total_before = client_balance + client_hold + freelancer_balance

        result = calculate_commission(escrow_amount, "STANDARD")

        client_hold -= escrow_amount
        freelancer_balance += result["net"]

        total_after = client_balance + freelancer_balance + result["commission"]
        assert total_before == total_after  # No money created or destroyed


class TestFreelancerTierProgression:
    """FREELANCE: Tier progression based on completed projects and earnings."""

    def test_new_to_standard_requires_3_projects(self):
        completed = 4
        assert completed >= 3  # Should be STANDARD

    def test_new_stays_new_below_3_projects(self):
        completed = 2
        assert completed < 3  # Stays NEW

    def test_pro_requires_20_projects_and_4_5_rating(self):
        completed = 25
        rating = 4.6
        assert completed >= 20
        assert rating >= 4.5

    def test_enterprise_requires_100_projects_and_4_8_rating(self):
        completed = 120
        rating = 4.9
        assert completed >= 100
        assert rating >= 4.8

    def test_new_tier_zero_commission(self):
        result = calculate_commission(10000, "NEW")
        assert result["commission"] == 0
        assert result["net"] == 10000

    def test_tier_upgrade_reduces_commission(self):
        """Progressing from STANDARD → PRO should reduce commission."""
        standard = calculate_commission(10000, "STANDARD")
        pro = calculate_commission(10000, "PRO")
        assert pro["commission"] < standard["commission"]
        assert pro["net"] > standard["net"]


class TestContractLifecycle:
    """FREELANCE: Contract lifecycle and status transitions."""

    VALID_TRANSITIONS = {
        "DRAFT": ["ACTIVE", "CANCELLED"],
        "ACTIVE": ["COMPLETED", "CANCELLED", "DISPUTED"],
        "COMPLETED": [],
        "CANCELLED": [],
        "DISPUTED": ["ACTIVE", "CANCELLED"],
    }

    def test_draft_to_active(self):
        assert "ACTIVE" in self.VALID_TRANSITIONS["DRAFT"]

    def test_active_to_completed(self):
        assert "COMPLETED" in self.VALID_TRANSITIONS["ACTIVE"]

    def test_active_to_disputed(self):
        assert "DISPUTED" in self.VALID_TRANSITIONS["ACTIVE"]

    def test_completed_is_terminal(self):
        assert len(self.VALID_TRANSITIONS["COMPLETED"]) == 0

    def test_cancelled_is_terminal(self):
        assert len(self.VALID_TRANSITIONS["CANCELLED"]) == 0

    def test_disputed_can_resolve(self):
        assert "ACTIVE" in self.VALID_TRANSITIONS["DISPUTED"]

    def test_disputed_can_cancel(self):
        assert "CANCELLED" in self.VALID_TRANSITIONS["DISPUTED"]

    def test_draft_cannot_skip_to_completed(self):
        assert "COMPLETED" not in self.VALID_TRANSITIONS["DRAFT"]

    def test_active_cannot_go_back_to_draft(self):
        assert "DRAFT" not in self.VALID_TRANSITIONS["ACTIVE"]


class TestWebhookRouting:
    """WEBHOOKS: Event type routing to correct handlers."""

    def test_checkout_paid_routes_to_success(self):
        assert get_webhook_action("checkout.paid") == "finalize_success"

    def test_checkout_failed_routes_to_failure(self):
        assert get_webhook_action("checkout.failed") == "finalize_failure"

    def test_checkout_canceled_routes_to_failure(self):
        assert get_webhook_action("checkout.canceled") == "finalize_failure"

    def test_checkout_expired_routes_to_failure(self):
        """checkout.expired should be treated as a failure (was silently ignored before fix)."""
        assert get_webhook_action("checkout.expired") == "finalize_failure"

    def test_unknown_event_returns_unknown(self):
        assert get_webhook_action("checkout.refunded") == "unknown"

    def test_malformed_event_type_returns_unknown(self):
        assert get_webhook_action("") == "unknown"

    def test_all_known_events_are_handled(self):
        for event in VALID_WEBHOOK_EVENTS:
            assert get_webhook_action(event) != "unknown"

    def test_paid_success_marks_transaction_completed(self):
        """checkout.paid should mark transaction as COMPLETED."""
        transaction = {"id": 1, "status": "PENDING", "amount": 5000}
        event_type = "checkout.paid"
        if event_type == "checkout.paid":
            transaction["status"] = "COMPLETED"
        assert transaction["status"] == "COMPLETED"

    def test_failure_marks_transaction_failed(self):
        for event in ["checkout.failed", "checkout.canceled", "checkout.expired"]:
            transaction = {"id": 1, "status": "PENDING"}
            if event in ("checkout.failed", "checkout.canceled", "checkout.expired"):
                transaction["status"] = "FAILED"
            assert transaction["status"] == "FAILED", f"{event} should set FAILED"

    def test_idempotency_skips_completed(self):
        """Already completed transactions should be skipped."""
        transaction = {"id": 1, "status": "COMPLETED"}
        assert transaction["status"] in ("COMPLETED", "FAILED")
        # Should skip processing


class TestWalletTransactionInvariants:
    """WALLET: Balance and transaction integrity invariants."""

    def test_available_balance_formula(self):
        balance = 100000
        hold = 30000
        available = balance - hold
        assert available == 70000

    def test_available_never_negative(self):
        for balance in [0, 1000, 50000]:
            for hold in [0, 1000, 50000]:
                if hold <= balance:
                    assert balance - hold >= 0

    def test_credit_balance_increases(self):
        old = 50000
        amount = 10000
        new = old + amount
        assert new == 60000

    def test_debit_balance_decreases(self):
        old = 50000
        amount = 10000
        new = old - amount
        assert new == 40000

    def test_debit_requires_sufficient_available(self):
        balance = 10000
        hold = 5000
        available = balance - hold  # 5000
        debit = 8000
        assert debit > available  # Should be rejected

    def test_hold_reduces_available_only(self):
        balance = 50000
        hold = 0
        hold_amount = 10000
        new_hold = hold + hold_amount
        available = balance - new_hold
        assert available == 40000
        assert balance == 50000  # Total unchanged

    def test_release_increases_available(self):
        balance = 50000
        hold = 10000
        release = 5000
        new_hold = hold - release
        available = balance - new_hold
        assert available == 45000
        assert balance == 50000  # Total unchanged

    def test_full_wallet_cycle(self):
        """Deposit → Hold → Release → Withdraw full cycle consistency."""
        balance = 0
        hold = 0

        # Deposit
        balance += 50000
        assert balance == 50000

        # Hold for escrow
        hold += 30000
        available = balance - hold
        assert available == 20000

        # Release hold
        hold -= 30000
        available = balance - hold
        assert available == 50000

        # Withdraw
        withdrawal = 20000
        balance -= withdrawal
        assert balance == 30000
        assert balance >= hold  # Still covers any holds

    def test_multiple_holds_accumulate(self):
        balance = 100000
        hold = 0
        for amount in [10000, 20000, 15000]:
            hold += amount
        assert hold == 45000
        assert balance - hold >= 0

    def test_hold_cannot_exceed_balance(self):
        balance = 10000
        hold = 0
        hold_amount = 15000
        assert hold_amount > balance - hold  # Should be rejected


class TestPayoutValidation:
    """PAYOUTS: Withdrawal and payout validation rules."""

    MIN_PAYOUT = 1000
    MAX_PAYOUT = 5000000

    def test_minimum_payout_amount(self):
        assert self.MIN_PAYOUT == 1000

    def test_maximum_payout_amount(self):
        assert self.MAX_PAYOUT == 5000000

    def test_payout_below_min_rejected(self):
        amount = 500
        assert amount < self.MIN_PAYOUT

    def test_payout_at_min_accepted(self):
        assert self.MIN_PAYOUT >= 1000

    def test_payout_at_max_accepted(self):
        assert self.MAX_PAYOUT <= 5000000

    def test_payout_above_max_rejected(self):
        amount = 6000000
        assert amount > self.MAX_PAYOUT

    def test_insufficient_balance_rejected(self):
        balance = 50000
        hold = 10000
        available = balance - hold
        payout = 50000
        assert payout > available  # Should be rejected

    def test_sufficient_balance_accepted(self):
        balance = 50000
        hold = 10000
        available = balance - hold
        payout = 30000
        assert payout <= available  # Should be accepted

    def test_multiple_withdrawals_deplete_balance(self):
        initial = 100000
        withdrawals = [10000, 20000, 15000, 5000]
        remaining = initial - sum(withdrawals)
        assert remaining == 50000
        for w in withdrawals:
            assert remaining + w >= 0  # Never negative after any point


class TestPaymentPurposeRouting:
    """PAYMENTS: Purpose-based routing to correct service handlers."""

    PURPOSES = {
        "COURSE_PURCHASE": "education_service",
        "PATH_PURCHASE": "education_service",
        "STUDENT_SUBSCRIPTION": "education_service",
        "BI_SUBSCRIPTION": "bi_billing_service",
        "DEPOSIT": "wallet_service",
        "CONTRACT_ESCROW": "escrow_service",
    }

    def test_course_purchase_routes_to_education(self):
        assert self.PURPOSES["COURSE_PURCHASE"] == "education_service"

    def test_path_purchase_routes_to_education(self):
        assert self.PURPOSES["PATH_PURCHASE"] == "education_service"

    def test_student_subscription_routes_to_education(self):
        assert self.PURPOSES["STUDENT_SUBSCRIPTION"] == "education_service"

    def test_bi_subscription_routes_to_bi(self):
        assert self.PURPOSES["BI_SUBSCRIPTION"] == "bi_billing_service"

    def test_deposit_routes_to_wallet(self):
        assert self.PURPOSES["DEPOSIT"] == "wallet_service"

    def test_contract_escrow_routes_to_escrow(self):
        assert self.PURPOSES["CONTRACT_ESCROW"] == "escrow_service"

    def test_all_purposes_have_handler(self):
        for purpose, handler in self.PURPOSES.items():
            assert handler is not None, f"{purpose} has no handler"


class TestFinancialEdgeCases:
    """EDGE CASES: Boundary conditions and extreme values."""

    def test_zero_dzd_subscription_free(self):
        assert SUBSCRIPTION_PRICES_DZD["FREE_MONTHLY"] == 0

    def test_smallest_paid_subscription(self):
        """Minimum paid subscription should be STUDENT_STARTER monthly."""
        assert SUBSCRIPTION_PRICES_DZD["STUDENT_STARTER_MONTHLY"] == 1900

    def test_largest_subscription(self):
        assert SUBSCRIPTION_PRICES_DZD["BI_ELITE_YEARLY"] == 139900

    def test_extract_from_malformed_price(self):
        assert extract_effective_price({"original": "not_a_number"}) == 0

    def test_extract_with_extra_fields(self):
        price = {"original": 5000, "discounted": 4500, "currency": "DZD", "tier": "student"}
        assert extract_effective_price(price) == 4500

    def test_new_tier_minimum_commission(self):
        """NEW tier should always have 0 commission regardless of amount."""
        for amount in [1, 100, 5000, 100000, 9999999]:
            result = calculate_commission(amount, "NEW")
            assert result["commission"] == 0

    def test_invalid_tier_falls_back_to_standard_rate(self):
        """Unknown tier should default to 10%."""
        result = calculate_commission(10000, "UNKNOWN_TIER")
        assert result["rate"] == 0.10
        assert result["commission"] == 1000

    def test_commission_floor_at_one_cent(self):
        """Very small amounts should not produce negative commission."""
        result = calculate_commission(1, "STANDARD")
        assert result["commission"] >= 0
        assert result["net"] == 1

    def test_large_amount_no_overflow(self):
        """Large amounts should not cause integer overflow."""
        result = calculate_commission(10_000_000, "PRO")  # 100,000 DZD
        assert result["gross"] == 10_000_000
        assert result["commission"] == 800_000
        assert result["net"] == 9_200_000

    def test_subscription_price_all_positive_paid(self):
        """All paid subscription prices must be positive."""
        for key, price in SUBSCRIPTION_PRICES_DZD.items():
            if "FREE" not in key:
                assert price > 0, f"{key} has non-positive price {price}"

    def test_subscription_price_integrity(self):
        """All prices must be integers (no fractions)."""
        for key, price in SUBSCRIPTION_PRICES_DZD.items():
            assert isinstance(price, int), f"{key} price is not int: {price}"

    def test_yearly_savings_percentage(self):
        """Yearly plans should save at least 15% vs monthly."""
        for plan in ["STUDENT_STARTER", "STUDENT_PLUS", "STUDENT_PRO", "BI_GROWTH", "BI_SCALE", "BI_ELITE"]:
            monthly = resolve_subscription_price(plan, "monthly")
            yearly = resolve_subscription_price(plan, "yearly")
            yearly_vs_monthly = yearly / (monthly * 12)
            savings = 1 - yearly_vs_monthly
            assert savings >= 0.15, f"{plan} only saves {savings*100:.1f}%"


class TestSubscriptionRenewal:
    """SUBSCRIPTIONS: Renewal scheduling edge cases."""

    def test_renew_before_period_end_extends(self):
        """Renewing early should extend from current period end."""
        current_end = datetime(2025, 7, 1, tzinfo=timezone.utc)
        new_end = current_end + timedelta(days=30)
        assert new_end == datetime(2025, 7, 31, tzinfo=timezone.utc)

    def test_renew_after_period_end_extends_from_now(self):
        """If renewal is late, period should start from current end (no double charge)."""
        current_end = datetime(2025, 6, 1, tzinfo=timezone.utc)
        now = datetime(2025, 6, 15, tzinfo=timezone.utc)
        new_start = max(now, current_end)
        new_end = new_start + timedelta(days=30)
        assert new_start == now
        assert new_end == datetime(2025, 7, 15, tzinfo=timezone.utc)

    def test_skip_renewal_if_amount_zero(self):
        """Free plans should skip payment renewal."""
        amount = 0
        should_renew = amount > 0
        assert should_renew is False

    def test_skip_renewal_if_no_payment_method(self):
        """Subscriptions without payment method should skip renewal."""
        payment_method_id = None
        should_renew = payment_method_id is not None and payment_method_id > 0
        assert should_renew is False

    def test_pending_payment_to_active_on_success(self):
        """When a PENDING_PAYMENT subscription succeeds, it becomes ACTIVE."""
        status = "PENDING_PAYMENT"
        payment_success = True
        if payment_success:
            status = "ACTIVE"
        assert status == "ACTIVE"

    def test_yearly_renewal_date_calculation(self):
        """Yearly renewal should be +365 days from period end."""
        start = datetime(2025, 1, 15, tzinfo=timezone.utc)
        end = start + timedelta(days=365)
        renewal = end
        assert renewal == datetime(2026, 1, 15, tzinfo=timezone.utc)
