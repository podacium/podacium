"""Refund eligibility configuration for the Podacium payment system."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration dataclasses
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RefundEligibilityConfig:
    """Configures the rules that determine whether a transaction may be refunded."""

    max_refund_days: int = 14
    """Maximum number of days after the transaction was created that a refund
    request is still accepted. Used as fallback when purpose-specific value
    is not set."""

    max_refund_days_courses: int = 7
    """Maximum number of days for course/path purchase refund eligibility,
    matching the 7-day window stated in the Refund Policy."""

    max_refund_days_subscriptions: int = 14
    """Maximum number of days for subscription refund eligibility."""

    min_refund_amount: int = 100
    """Minimum transaction amount (in DZD cents) that is eligible for a refund."""

    non_refundable_purposes: set[str] = field(
        default_factory=lambda: {
            "WITHDRAWAL",
            "CONTRACT_ESCROW_RELEASE",
            "PLATFORM_COMMISSION",
        }
    )
    """Set of transaction purposes that are never refundable."""

    require_reason: bool = True
    """Whether the refund request must include a reason."""

    max_refund_requests_per_month: int = 3
    """Maximum number of refund requests a user may submit per calendar month."""

    # Partial refund configuration
    allow_partial_refunds: bool = True
    """Whether partial/pro-rata refunds are allowed."""

    pro_rata_min_days: int = 1
    """Minimum days of usage before pro-rata applies for non-subscription purposes."""

    pro_rata_min_days_subscription: int = 30
    """First 30 days of each billing cycle are non-refundable (except 72-hour cooling-off).
    Matches the policy: 'The first 30 days of each billing cycle are non-refundable'."""

    subscription_cooling_off_hours: int = 72
    """First 72 hours cooling-off period for new subscriptions — full refund allowed."""

    max_partial_refund_ratio: float = 1.0
    """Maximum ratio of original amount that can be refunded in partial refunds (1.0 = 100%)."""


# ---------------------------------------------------------------------------
# Default global instance
# ---------------------------------------------------------------------------

DEFAULT_REFUND_POLICY = RefundEligibilityConfig()


# ---------------------------------------------------------------------------
# Pro-rata / Partial Refund Calculation
# ---------------------------------------------------------------------------

def calculate_pro_rata_refund(
    original_amount: int,
    transaction_created_at: datetime,
    *,
    purpose: str = "",
    metadata: Optional[dict] = None,
    config: RefundEligibilityConfig = DEFAULT_REFUND_POLICY,
    # Params used by payment.py route for richer calculation
    usage_started_at: Optional[datetime] = None,
    course_progress: Optional[float] = None,
    subscription_period_days: Optional[int] = None,
    session_count: Optional[int] = None,
    total_sessions: Optional[int] = None,
    now: Optional[datetime] = None,
) -> tuple[int, str]:
    """Calculate pro-rata refund amount based on time elapsed and usage.

    Parameters
    ----------
    original_amount:
        The original transaction amount in cents.
    transaction_created_at:
        When the original transaction was created.
    purpose:
        Transaction purpose (e.g., "COURSE_PURCHASE", "SUBSCRIPTION").
    metadata:
        Additional metadata that may contain usage info (course progress, etc.).
    config:
        Refund policy configuration.
    usage_started_at:
        Optional override for when usage actually started (e.g. enrollment date).
    course_progress:
        Explicit course progress ratio (0.0–1.0).
    subscription_period_days:
        Billing cycle length for subscription pro-rata.
    session_count:
        Number of sessions attended (live sessions).
    total_sessions:
        Total sessions in package (live sessions).
    now:
        Reference timestamp for calculation (defaults to datetime.now).

    Returns
    -------
    tuple[int, str]
        (maximum_refundable_amount_in_cents, calculation_method_description)
    """
    if not config.allow_partial_refunds:
        return original_amount, "full_allowed"

    ref_now = now or datetime.now(transaction_created_at.tzinfo)
    ref_created = usage_started_at or transaction_created_at
    days_elapsed = (ref_now - ref_created).days
    method = "time_based_generic"

    # If within minimum days, full refund allowed
    if days_elapsed < config.pro_rata_min_days and not purpose.startswith("SUBSCRIPTION"):
        return original_amount, "within_min_days"

    # Calculate based on purpose
    if purpose in ("SUBSCRIPTION", "SUBSCRIPTION_RENEWAL"):
        method = "subscription_pro_rata"
        if days_elapsed < config.pro_rata_min_days_subscription:
            hours_elapsed = (ref_now - ref_created).total_seconds() / 3600
            if hours_elapsed <= config.subscription_cooling_off_hours:
                return original_amount, "subscription_cooling_off"
            return 0, "subscription_lock_period"

        billing_cycle_days = subscription_period_days or 30
        unused_days = max(0, billing_cycle_days - days_elapsed)
        pro_rata_ratio = unused_days / billing_cycle_days

    elif purpose in ("COURSE_PURCHASE", "PATH_PURCHASE"):
        method = "course_pro_rata"
        progress = course_progress or 0.0
        if progress == 0.0 and metadata:
            for key in ("progress", "completion_rate"):
                if key in metadata and metadata[key] is not None:
                    try:
                        progress = float(metadata[key])
                        break
                    except (ValueError, TypeError):
                        pass
            if progress == 0 and "lessons_completed" in metadata and "total_lessons" in metadata:
                try:
                    completed = int(metadata["lessons_completed"])
                    total = int(metadata["total_lessons"])
                    if total > 0:
                        progress = completed / total
                except (ValueError, TypeError):
                    pass
        pro_rata_ratio = max(0.0, 1.0 - progress)

    elif purpose in ("LIVE_SESSION_BOOKING", "LIVE_SESSION_PURCHASE"):
        method = "live_session_pro_rata"
        if session_count is not None and total_sessions and total_sessions > 0:
            attended_ratio = session_count / total_sessions
            pro_rata_ratio = max(0.0, 1.0 - attended_ratio)
        else:
            session_start = (metadata or {}).get("session_start")
            if session_start:
                try:
                    session_dt = datetime.fromisoformat(session_start.replace("Z", "+00:00"))
                    if session_dt <= ref_now:
                        return 0, "session_occurred"
                    hours_until = (session_dt - ref_now).total_seconds() / 3600
                    if hours_until > 24:
                        return original_amount, "session_future"
                    pro_rata_ratio = hours_until / 24
                except (ValueError, TypeError):
                    pro_rata_ratio = 0.5
            else:
                pro_rata_ratio = 0.5

    else:
        method = "time_based_linear"
        window = _get_refund_window_days(purpose, config)
        pro_rata_ratio = max(0.0, 1.0 - (days_elapsed / window))

    max_allowed = int(original_amount * config.max_partial_refund_ratio)
    calculated = int(original_amount * pro_rata_ratio)
    result = min(calculated, max_allowed, original_amount)

    return result, method


def validate_partial_refund_amount(
    requested_amount: int,
    original_amount: int,
    pro_rata_amount: int,
    *,
    config: RefundEligibilityConfig = DEFAULT_REFUND_POLICY,
) -> tuple[bool, Optional[str]]:
    """Validate that a requested partial refund amount is within allowed bounds.

    Parameters
    ----------
    requested_amount:
        The amount the user/admin is requesting (in cents).
    original_amount:
        The original transaction amount (in cents).
    pro_rata_amount:
        The calculated pro-rata maximum refund amount (in cents).
    config:
        Refund policy configuration.

    Returns
    -------
    tuple
        (is_valid, error_message)
    """
    if requested_amount <= 0:
        return False, "Refund amount must be positive."

    if requested_amount > original_amount:
        return False, f"Requested amount ({requested_amount}) exceeds original transaction amount ({original_amount})."

    if requested_amount > pro_rata_amount:
        return False, (
            f"Requested amount ({requested_amount}) exceeds calculated pro-rata maximum "
            f"({pro_rata_amount}). Maximum allowed based on usage/time."
        )

    if requested_amount < config.min_refund_amount:
        return False, f"Requested amount below minimum ({config.min_refund_amount})."

    # Also check against max ratio
    max_allowed = int(original_amount * config.max_partial_refund_ratio)
    if requested_amount > max_allowed:
        return False, f"Requested amount exceeds maximum partial refund ratio ({config.max_partial_refund_ratio * 100}%)."

    return True, None


# ---------------------------------------------------------------------------
# Eligibility validation
# ---------------------------------------------------------------------------

def _get_refund_window_days(purpose: str, config: RefundEligibilityConfig) -> int:
    """Return the purpose-specific refund window in days."""
    if purpose in ("COURSE_PURCHASE", "PATH_PURCHASE", "COURSE_BUNDLE", "CERTIFICATE_PURCHASE"):
        return config.max_refund_days_courses
    if purpose in ("SUBSCRIPTION", "SUBSCRIPTION_RENEWAL", "SUBSCRIPTION_UPGRADE"):
        return config.max_refund_days_subscriptions
    return config.max_refund_days


def check_refund_eligibility(
    transaction: Optional[dict],
    existing_refunds: list[dict],
    *,
    config: RefundEligibilityConfig = DEFAULT_REFUND_POLICY,
) -> tuple[bool, Optional[str]]:
    """Determine whether a transaction is eligible for a refund.

    Parameters
    ----------
    transaction:
        The transaction to evaluate. Expected keys:
        - ``"status"`` (str): e.g. ``"COMPLETED"``.
        - ``"created_at"`` (datetime): when the transaction was created.
        - ``"purpose"`` (str): the transaction purpose code.
        - ``"amount"`` (int): amount in DZD cents.
        - ``"id"`` (str): unique transaction identifier.
    existing_refunds:
        All existing refund requests records for the *same* transaction.
        Each record should have a ``"status"`` key.  A refund is considered
        "pending" when ``status == "PENDING"``.
    config:
        The policy config to evaluate against.  Defaults to
        :pydata:`DEFAULT_REFUND_POLICY`.

    Returns
    -------
    tuple
        ``(is_eligible, reason)`` where *reason* is ``None`` when eligible and
        a human-readable string otherwise.
    """
    # 1. Transaction must exist
    if not transaction:
        return False, "Transaction does not exist."

    # 2. Transaction must be completed
    if transaction.get("status") != "COMPLETED":
        return False, "Transaction is not completed."

    # 3. Transaction must be within the purpose-specific refund window
    purpose = transaction.get("purpose", "")
    created_at = transaction.get("created_at")
    if not isinstance(created_at, datetime):
        return False, "Transaction creation time is missing or invalid."

    refund_window = _get_refund_window_days(purpose, config)
    cutoff = datetime.now(created_at.tzinfo) - timedelta(days=refund_window)
    if created_at < cutoff:
        return False, f"Transaction is older than {refund_window} days for its purpose."

    # 4. Purpose must not be non-refundable
    if purpose in config.non_refundable_purposes:
        return False, f"Transactions of purpose '{purpose}' are not refundable."

    # 5. Amount must meet minimum threshold
    amount = transaction.get("amount", 0)
    if not isinstance(amount, int) or amount < config.min_refund_amount:
        return False, f"Transaction amount ({amount}) is below the minimum refundable amount ({config.min_refund_amount})."

    # 6. User must not have exceeded monthly limit
    #    (This requires caller knowledge; see ``validate_refund_request`` for
    #    a convenience wrapper that accepts the count directly.)
    #    We skip here because ``check_refund_eligibility`` focuses on the
    #    transaction itself; the caller can layer the per-user check.

    # 7. No pending refund for this transaction
    for refund in existing_refunds:
        if refund.get("status") == "PENDING":
            return False, "A pending refund request already exists for this transaction."

    return True, None


def validate_refund_request(
    transaction: dict,
    user_refunds_this_month: int,
    existing_refund: Optional[dict],
    *,
    config: RefundEligibilityConfig = DEFAULT_REFUND_POLICY,
) -> tuple[bool, Optional[str]]:
    """Convenience wrapper for full validation of a refund request.

    Parameters
    ----------
    transaction:
        The transaction to validate (same shape as
        :func:`check_refund_eligibility`).
    user_refunds_this_month:
        The number of refund requests the user has already submitted this
        calendar month.
    existing_refund:
        A single existing refund record for the transaction, or ``None``.
    config:
        The policy config to evaluate against.

    Returns
    -------
    tuple
        ``(is_eligible, reason)`` where *reason* is ``None`` when eligible
        and a human-readable string otherwise.
    """
    # Convert single existing refund into list expected by core checker
    existing_refunds = [existing_refund] if existing_refund is not None else []

    # Run transaction-level checks
    eligible, reason = check_refund_eligibility(transaction, existing_refunds, config=config)
    if not eligible:
        return eligible, reason

    # Additional user-level checks
    if user_refunds_this_month >= config.max_refund_requests_per_month:
        return False, f"User has exceeded the maximum of {config.max_refund_requests_per_month} refund requests per month."

    return True, None
