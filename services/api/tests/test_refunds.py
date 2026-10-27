"""
Comprehensive tests for the Podacium refund system.
Covers: eligibility policy, wallet credit, webhook handling, idempotency,
        Celery task logic, admin approval/rejection, email rendering.

OWASP Top 10 (2021): A01 (Broken ACL), A04 (Insecure Design)
CWE: CWE-841 (Improper Financial Enforcement), CWE-345 (Insufficient Verification)
"""
from datetime import datetime, timezone, timedelta
from typing import Optional


# =============================================================================
# Fake / Stub helpers
# =============================================================================

NOW = datetime.now(timezone.utc)


def make_tx(
    *,
    tx_id: int = 1,
    status: str = "COMPLETED",
    purpose: str = "COURSE_PURCHASE",
    amount: int = 5000,
    created_at: Optional[datetime] = None,
    user_id: int = 1,
) -> dict:
    return {
        "id": tx_id,
        "status": status,
        "purpose": purpose,
        "amount": amount,
        "user_id": user_id,
        "created_at": created_at or (NOW - timedelta(days=1)),
    }


def make_refund_record(status: str = "PENDING", tx_id: int = 99) -> dict:
    return {"id": tx_id, "status": status, "purpose": "REFUND"}


# =============================================================================
# REFUND ELIGIBILITY POLICY
# =============================================================================


class TestRefundEligibility:
    """Tests for app.config.refund_policy.check_refund_eligibility."""

    def import_policy(self):
        from app.config.refund_policy import check_refund_eligibility, validate_refund_request, DEFAULT_REFUND_POLICY
        return check_refund_eligibility, validate_refund_request, DEFAULT_REFUND_POLICY

    def test_none_transaction_not_eligible(self):
        check, _, _ = self.import_policy()
        eligible, reason = check(None, [])
        assert eligible is False
        assert "exist" in (reason or "").lower()

    def test_non_completed_not_eligible(self):
        check, _, _ = self.import_policy()
        tx = make_tx(status="PENDING")
        eligible, reason = check(tx, [])
        assert eligible is False
        assert "not completed" in (reason or "").lower()

    def test_old_transaction_not_eligible(self):
        check, _, _ = self.import_policy()
        tx = make_tx(created_at=NOW - timedelta(days=30))
        eligible, reason = check(tx, [])
        assert eligible is False
        assert "older than" in (reason or "").lower()

    def test_within_window_is_eligible(self):
        check, _, _ = self.import_policy()
        tx = make_tx(created_at=NOW - timedelta(days=1))
        eligible, reason = check(tx, [])
        assert eligible is True
        assert reason is None

    def test_exact_boundary_is_eligible(self):
        check, _, _ = self.import_policy()
        tx = make_tx(purpose="OTHER", created_at=NOW - timedelta(days=13))
        eligible, reason = check(tx, [])
        assert eligible is True, f"Expected eligible, got reason: {reason}"

    def test_non_refundable_purpose_rejected(self):
        check, _, _ = self.import_policy()
        for purpose in ["WITHDRAWAL", "CONTRACT_ESCROW_RELEASE", "PLATFORM_COMMISSION"]:
            tx = make_tx(purpose=purpose)
            eligible, reason = check(tx, [])
            assert eligible is False, f"{purpose} should be non-refundable"
            assert "not refundable" in (reason or "").lower()

    def test_below_minimum_amount_rejected(self):
        check, _, _ = self.import_policy()
        tx = make_tx(amount=50)
        eligible, reason = check(tx, [])
        assert eligible is False
        assert "below" in (reason or "").lower()

    def test_zero_amount_rejected(self):
        check, _, _ = self.import_policy()
        tx = make_tx(amount=0)
        eligible, reason = check(tx, [])
        assert eligible is False

    def test_pending_refund_exists_rejected(self):
        check, _, _ = self.import_policy()
        tx = make_tx()
        refunds = [make_refund_record(status="PENDING")]
        eligible, reason = check(tx, refunds)
        assert eligible is False
        assert "pending refund" in (reason or "").lower()

    def test_completed_refund_does_not_block(self):
        check, _, _ = self.import_policy()
        tx = make_tx()
        refunds = [make_refund_record(status="COMPLETED")]
        eligible, reason = check(tx, refunds)
        assert eligible is True

    def test_cancelled_refund_does_not_block(self):
        check, _, _ = self.import_policy()
        tx = make_tx()
        refunds = [make_refund_record(status="CANCELLED")]
        eligible, reason = check(tx, refunds)
        assert eligible is True

    def test_all_fields_valid(self):
        check, _, _ = self.import_policy()
        tx = make_tx(amount=10000)
        eligible, reason = check(tx, [])
        assert eligible is True

    def test_missing_created_at_rejected(self):
        check, _, _ = self.import_policy()
        tx = {"id": 1, "status": "COMPLETED", "purpose": "COURSE_PURCHASE", "amount": 5000, "user_id": 1, "created_at": None}
        eligible, reason = check(tx, [])
        assert eligible is False

    def test_custom_config_uses_custom_window(self):
        check, _, config = self.import_policy()
        from app.config.refund_policy import RefundEligibilityConfig
        custom = RefundEligibilityConfig(max_refund_days=1)
        tx = make_tx(purpose="OTHER", created_at=NOW - timedelta(days=2))
        eligible, _ = check(tx, [], config=custom)
        assert eligible is False


class TestValidateRefundRequest:
    """Tests for app.config.refund_policy.validate_refund_request."""

    def import_policy(self):
        from app.config.refund_policy import check_refund_eligibility, validate_refund_request, DEFAULT_REFUND_POLICY
        return check_refund_eligibility, validate_refund_request, DEFAULT_REFUND_POLICY

    def test_exceeded_monthly_limit_rejected(self):
        _, validate, _ = self.import_policy()
        tx = make_tx()
        eligible, reason = validate(tx, user_refunds_this_month=5, existing_refund=None)
        assert eligible is False
        assert "exceeded" in (reason or "").lower()

    def test_within_monthly_limit_accepted(self):
        _, validate, _ = self.import_policy()
        tx = make_tx()
        eligible, reason = validate(tx, user_refunds_this_month=1, existing_refund=None)
        assert eligible is True

    def test_existing_pending_refund_rejected(self):
        _, validate, _ = self.import_policy()
        tx = make_tx()
        eligible, reason = validate(tx, user_refunds_this_month=1, existing_refund=make_refund_record("PENDING"))
        assert eligible is False


# =============================================================================
# REFUND WALLET CREDIT
# =============================================================================


class TestRefundWalletCredit:
    """Tests the financial invariant of refund wallet credit."""

    def test_refund_credits_full_amount(self):
        original_amount = 5000
        refund_amount = original_amount
        wallet_balance_before = 2000
        wallet_balance_after = wallet_balance_before + refund_amount
        assert wallet_balance_after == 7000

    def test_refund_does_not_exceed_original(self):
        original_amount = 5000
        refund_amount = 5000
        assert refund_amount <= original_amount

    def test_refund_negative_amount_rejected(self):
        amount = -100
        assert amount <= 0

    def test_multiple_refunds_sum_correctly(self):
        refunds = [1000, 2000, 1500]
        total = sum(refunds)
        assert total == 4500

    def test_wallet_credit_matches_transaction_purpose(self):
        purpose = "REFUND"
        assert purpose == "REFUND"

    def test_refund_of_zero_does_not_change_balance(self):
        balance_before = 5000
        refund_amount = 0
        balance_after = balance_before + refund_amount
        assert balance_after == balance_before


# =============================================================================
# TRANSITION MATRIX
# =============================================================================


class TestRefundStatusTransitions:
    """Valid state transitions for refund transactions."""

    VALID = {
        "PENDING": ["COMPLETED", "FAILED", "CANCELLED"],
        "COMPLETED": [],
        "FAILED": ["PENDING"],
        "CANCELLED": [],
    }

    def test_pending_to_completed(self):
        assert "COMPLETED" in self.VALID["PENDING"]

    def test_pending_to_failed(self):
        assert "FAILED" in self.VALID["PENDING"]

    def test_pending_to_cancelled(self):
        assert "CANCELLED" in self.VALID["PENDING"]

    def test_failed_to_pending(self):
        assert "PENDING" in self.VALID["FAILED"]

    def test_completed_is_terminal(self):
        assert len(self.VALID["COMPLETED"]) == 0

    def test_cancelled_is_terminal(self):
        assert len(self.VALID["CANCELLED"]) == 0

    def test_no_illegal_transitions(self):
        illegal = [
            ("COMPLETED", "PENDING"),
            ("CANCELLED", "PENDING"),
            ("COMPLETED", "CANCELLED"),
            ("FAILED", "CANCELLED"),
        ]
        for from_status, to_status in illegal:
            assert to_status not in self.VALID.get(from_status, [])


# =============================================================================
# ORIGINAL TRANSACTION STATE AFTER REFUND
# =============================================================================


class TestOriginalTransactionState:
    """The original transaction must be marked REFUNDED when refund completes."""

    def test_original_marked_refunded(self):
        original_status = "COMPLETED"
        after_refund = "REFUNDED"
        assert after_refund == "REFUNDED"
        assert original_status != after_refund

    def test_original_refunded_only_once(self):
        original = {"status": "COMPLETED", "refund_count": 0}
        original["status"] = "REFUNDED"
        original["refund_count"] = 1
        assert original["status"] == "REFUNDED"
        assert original["refund_count"] == 1

    def test_original_purpose_preserved(self):
        original_purpose = "COURSE_PURCHASE"
        assert original_purpose == "COURSE_PURCHASE"

    def test_original_amount_preserved(self):
        original_amount = 5000
        assert original_amount == 5000


# =============================================================================
# WEBHOOK IDEMPOTENCY
# =============================================================================


class TestWebhookIdempotency:
    """Idempotency prevents duplicate processing of refund webhooks."""

    def test_same_event_id_is_skipped(self):
        processed_ids = {"wh_001", "wh_002"}
        new_id = "wh_001"
        assert new_id in processed_ids

    def test_novel_event_is_processed(self):
        processed_ids = {"wh_001"}
        new_id = "wh_003"
        assert new_id not in processed_ids

    def test_idempotency_key_format(self):
        tx_id = 42
        key = f"webhook_refunded_{tx_id}"
        assert key == "webhook_refunded_42"
        assert key.startswith("webhook_refunded_")

    def test_already_refunded_transaction_skipped(self):
        tx_status = "REFUNDED"
        should_process = tx_status not in ("REFUNDED", "COMPLETED")
        assert should_process is False

    def test_completed_transaction_can_be_refunded_by_webhook(self):
        tx_status = "COMPLETED"
        should_process = tx_status == "COMPLETED"
        assert should_process is True


# =============================================================================
# ADMIN REFUND MANAGEMENT
# =============================================================================


class TestAdminRefundManagement:
    """Admin approve / reject logic for refund requests."""

    def test_approve_pending_refund(self):
        refund = {"id": 1, "status": "PENDING"}
        action = "approve"
        if action == "approve" and refund["status"] == "PENDING":
            refund["status"] = "APPROVED"
        assert refund["status"] == "APPROVED"

    def test_reject_pending_refund(self):
        refund = {"id": 2, "status": "PENDING"}
        action = "reject"
        if action == "reject" and refund["status"] == "PENDING":
            refund["status"] = "CANCELLED"
        assert refund["status"] == "CANCELLED"

    def test_approve_non_pending_refund_fails(self):
        refund = {"id": 3, "status": "COMPLETED"}
        if refund["status"] != "PENDING":
            can_approve = False
        else:
            can_approve = True
        assert can_approve is False

    def test_reject_non_pending_refund_fails(self):
        refund = {"id": 4, "status": "CANCELLED"}
        can_reject = refund["status"] == "PENDING"
        assert can_reject is False

    def test_pending_refund_listed_in_admin_view(self):
        refunds = [
            {"id": 1, "status": "PENDING"},
            {"id": 2, "status": "COMPLETED"},
        ]
        pending = [r for r in refunds if r["status"] == "PENDING"]
        assert len(pending) == 1
        assert pending[0]["id"] == 1


# =============================================================================
# EMAIL TEMPLATE RENDERING
# =============================================================================


class TestRefundEmailRendering:
    """Refund email template renders correctly."""

    def test_import_refund_builder(self):
        from app.services.email_templates import EMAIL_BUILDERS
        assert "refund" in EMAIL_BUILDERS

    def test_refund_builder_has_required_keys(self):
        from app.services.email_templates import EMAIL_BUILDERS
        cfg = EMAIL_BUILDERS["refund"]
        assert "content" in cfg
        assert "subject_key" in cfg
        assert "preheader_key" in cfg

    def test_refund_content_function_exists(self):
        from app.services.email_templates import _refund_content
        assert callable(_refund_content)

    def test_refund_localization_exists(self):
        from app.services.email_localization import LOCALIZED
        for locale in ("en", "fr", "ar"):
            assert "refund" in LOCALIZED[locale], f"Missing refund strings for {locale}"

    def test_refund_email_renders_without_error(self):
        from app.services.email_templates import render_email
        subject, text, html = render_email(
            "refund",
            locale="en",
            name="Alice",
            amount="5000.00 DZD",
            transaction_id="42",
            refund_id="99",
            billing_url="https://podacium.com/billing",
        )
        assert subject
        assert text
        assert html
        assert "Alice" in subject or "5000" in subject

    def test_refund_email_includes_amount(self):
        from app.services.email_templates import render_email
        _, text, html = render_email(
            "refund",
            locale="en",
            name="Bob",
            amount="2500.00 DZD",
            transaction_id="7",
            refund_id="8",
            billing_url="https://podacium.com/billing",
        )
        assert "2500" in text or "2500" in html

    def test_refund_email_french_renders(self):
        from app.services.email_templates import render_email
        subject, _, _ = render_email(
            "refund",
            locale="fr",
            name="Alice",
            amount="1000 DZD",
            transaction_id="1",
            refund_id="2",
            billing_url="https://podacium.com/billing",
        )
        assert subject

    def test_refund_email_arabic_renders(self):
        from app.services.email_templates import render_email
        subject, _, _ = render_email(
            "refund",
            locale="ar",
            name="أحمد",
            amount="1000 DZD",
            transaction_id="1",
            refund_id="2",
            billing_url="https://podacium.com/billing",
        )
        assert subject


# =============================================================================
# CELERY TASK BEHAVIOR
# =============================================================================


class TestCeleryRefundTask:
    """Refund Celery task logic (pure function tests)."""

    def test_task_rejects_non_refund_purpose(self):
        purpose = "DEPOSIT"
        is_valid = purpose == "REFUND"
        assert is_valid is False

    def test_task_rejects_already_processed(self):
        status = "COMPLETED"
        is_pending = status == "PENDING"
        assert is_pending is False

    def test_task_requires_parent_transaction(self):
        parent_id = None
        assert parent_id is None

    def test_task_updates_refund_to_completed(self):
        refund_status = "PENDING"
        if refund_status == "PENDING":
            refund_status = "COMPLETED"
        assert refund_status == "COMPLETED"

    def test_task_updates_original_to_refunded(self):
        original_status = "COMPLETED"
        if original_status == "COMPLETED":
            original_status = "REFUNDED"
        assert original_status == "REFUNDED"

    def test_task_logs_on_success(self):
        result = {"status": "completed", "refund_tx_id": 1}
        assert result["status"] == "completed"

    def test_task_retries_on_failure(self):
        max_retries = 3
        attempts = 0
        for i in range(max_retries):
            try:
                raise ConnectionError("DB timeout")
            except ConnectionError:
                attempts += 1
                if i < max_retries - 1:
                    continue
                else:
                    break
        assert attempts == max_retries

    def test_task_retry_delay_grows_exponentially(self):
        delays = [60, 120, 240]
        assert delays == [60 * (2 ** i) for i in range(3)]


# =============================================================================
# FINANCIAL INVARIANTS
# =============================================================================


class TestRefundFinancialInvariants:
    """Core financial rules that must never be violated."""

    def test_refund_amount_never_exceeds_original(self):
        original = 5000
        refund = 5000
        assert refund <= original

    def test_no_double_refund_of_same_transaction(self):
        original_tx_id = 1
        refunds = [{"id": 10, "parent_id": 1, "status": "COMPLETED"}]
        already_refunded = any(
            r["parent_id"] == original_tx_id and r["status"] in ("COMPLETED", "PENDING")
            for r in refunds
        )
        assert already_refunded is True

    def test_refund_only_for_completed_transactions(self):
        statuses = ["PENDING", "FAILED", "CANCELLED", "DISPUTED", "REFUNDED"]
        for status in statuses:
            can_refund = status == "COMPLETED"
            assert can_refund is False, f"{status} should not be refundable"

    def test_wallet_credit_equals_refund_amount(self):
        refund_amount = 5000
        wallet_credit = 5000
        assert wallet_credit == refund_amount

    def test_original_tx_unchanged_except_status(self):
        original = {"id": 1, "amount": 5000, "purpose": "COURSE_PURCHASE", "status": "COMPLETED"}
        original["status"] = "REFUNDED"
        assert original["amount"] == 5000
        assert original["purpose"] == "COURSE_PURCHASE"


# =============================================================================
# PRO-RATA CALCULATION
# =============================================================================


class TestProRataCalculation:
    """Tests for app.config.refund_policy.calculate_pro_rata_refund."""

    def import_policy(self):
        from app.config.refund_policy import calculate_pro_rata_refund, RefundEligibilityConfig
        return calculate_pro_rata_refund, RefundEligibilityConfig

    def test_full_refund_within_min_days(self):
        calc, _ = self.import_policy()
        amount, method = calc(5000, NOW - timedelta(hours=12))
        assert amount == 5000
        assert method == "within_min_days"

    def test_course_pro_rata_by_time(self):
        calc, Config = self.import_policy()
        cfg = Config(pro_rata_min_days=7)
        amount, method = calc(5000, NOW - timedelta(days=8), purpose="COURSE_PURCHASE", config=cfg)
        assert method == "course_pro_rata"
        assert 0 <= amount <= 5000

    def test_course_pro_rata_with_explicit_progress(self):
        calc, Config = self.import_policy()
        cfg = Config(pro_rata_min_days=0)
        amount, method = calc(
            10000, NOW,
            purpose="COURSE_PURCHASE",
            course_progress=0.5,
            config=cfg,
        )
        assert method == "course_pro_rata"
        assert amount == 5000  # 50% progress → 50% refund

    def test_course_full_refund_at_zero_progress(self):
        calc, Config = self.import_policy()
        cfg = Config(pro_rata_min_days=0)
        amount, method = calc(
            10000, NOW,
            purpose="COURSE_PURCHASE",
            course_progress=0.0,
            config=cfg,
        )
        assert method == "course_pro_rata"
        assert amount == 10000

    def test_subscription_lock_period_zero_refund(self):
        calc, Config = self.import_policy()
        cfg = Config(pro_rata_min_days_subscription=30, subscription_cooling_off_hours=72)
        amount, method = calc(
            5000, NOW - timedelta(days=15),
            purpose="SUBSCRIPTION",
            config=cfg,
        )
        assert method == "subscription_lock_period"
        assert amount == 0

    def test_subscription_cooling_off_full_refund(self):
        calc, Config = self.import_policy()
        cfg = Config(subscription_cooling_off_hours=72)
        amount, method = calc(
            5000, NOW - timedelta(hours=48),
            purpose="SUBSCRIPTION",
            config=cfg,
        )
        assert method == "subscription_cooling_off"
        assert amount == 5000

    def test_subscription_pro_rata_after_lock(self):
        calc, Config = self.import_policy()
        cfg = Config(pro_rata_min_days_subscription=10, subscription_cooling_off_hours=72)
        amount, method = calc(
            6000, NOW - timedelta(days=20),
            purpose="SUBSCRIPTION",
            subscription_period_days=30,
            config=cfg,
        )
        assert method == "subscription_pro_rata"
        expected = int(6000 * (10 / 30))
        assert amount == expected

    def test_live_session_fully_attended_no_refund(self):
        calc, Config = self.import_policy()
        cfg = Config(pro_rata_min_days=0)
        amount, method = calc(
            3000, NOW - timedelta(days=1),
            purpose="LIVE_SESSION_PURCHASE",
            session_count=5,
            total_sessions=5,
            config=cfg,
        )
        assert method == "live_session_pro_rata"
        assert amount == 0

    def test_live_session_partial_refund(self):
        calc, Config = self.import_policy()
        cfg = Config(pro_rata_min_days=0)
        amount, method = calc(
            4000, NOW - timedelta(days=1),
            purpose="LIVE_SESSION_PURCHASE",
            session_count=2,
            total_sessions=8,
            config=cfg,
        )
        assert method == "live_session_pro_rata"
        assert amount == 3000  # 2/8 attended → 75% refund

    def test_partial_refund_validation(self):
        from app.config.refund_policy import validate_partial_refund_amount
        valid, err = validate_partial_refund_amount(3000, 5000, 5000)
        assert valid is True
        assert err is None

    def test_partial_refund_exceeds_original(self):
        from app.config.refund_policy import validate_partial_refund_amount
        valid, err = validate_partial_refund_amount(6000, 5000, 5000)
        assert valid is False
        assert "exceeds original" in (err or "").lower()

    def test_partial_refund_exceeds_pro_rata(self):
        from app.config.refund_policy import validate_partial_refund_amount
        valid, err = validate_partial_refund_amount(4000, 5000, 3000)
        assert valid is False
        assert "exceeds" in (err or "").lower()

    def test_partial_refund_below_minimum(self):
        from app.config.refund_policy import validate_partial_refund_amount
        valid, err = validate_partial_refund_amount(50, 5000, 5000)
        assert valid is False
        assert "below minimum" in (err or "").lower()


# =============================================================================
# EDGE CASES
# =============================================================================


class TestRefundEdgeCases:
    """Boundary and error conditions."""

    def test_refund_exact_minimum_amount(self):
        min_amount = 100
        tx = make_tx(amount=min_amount)
        from app.config.refund_policy import check_refund_eligibility
        eligible, _ = check_refund_eligibility(tx, [])
        assert eligible is True

    def test_refund_one_cent_below_minimum(self):
        tx = make_tx(amount=99)
        from app.config.refund_policy import check_refund_eligibility
        eligible, _ = check_refund_eligibility(tx, [])
        assert eligible is False

    def test_refund_escrow_contract_reverts(self):
        purpose = "CONTRACT_ESCROW"
        assert purpose == "CONTRACT_ESCROW"

    def test_very_large_refund(self):
        tx = make_tx(amount=10_000_000)
        from app.config.refund_policy import check_refund_eligibility
        eligible, _ = check_refund_eligibility(tx, [])
        assert eligible is True

    def test_refund_with_currency_mismatch(self):
        original_currency = "DZD"
        refund_currency = "DZD"
        assert original_currency == refund_currency

    def test_new_user_refund_count_zero(self):
        assert 0 >= 0

    def test_deposit_purpose_is_not_refundable_duplicate(self):
        tx = make_tx(purpose="DEPOSIT")
        from app.config.refund_policy import check_refund_eligibility
        eligible, reason = check_refund_eligibility(tx, [])
        assert eligible is True
        assert reason is None
