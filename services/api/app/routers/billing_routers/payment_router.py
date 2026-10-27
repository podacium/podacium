import logging
import json
from datetime import datetime, timezone
import os
from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import FileResponse

from pydantic import BaseModel
from typing import Optional, Any

from app.core.auth import get_current_active_user
from app.core.prisma import prisma
from app.services.billing_services.billing_core_service import billing_core_service
from app.services.subscription_billing_service import subscription_service
from app.schemas.billing_schemas.base import (
    PaymentPurpose,
    CheckoutInitiate,
    SubscriptionPlan,
)

router = APIRouter(prefix="/billing/payments", tags=["Billing Payments"])
logger = logging.getLogger(__name__)

# Standalone certificate purchase price (DZD). Configurable via admin panel later.
CERTIFICATE_PRICE = 1500

# ---------------------------------------------------------------------------
# Request models — amount is accepted for backwards-compat but IGNORED.
# The server always resolves the authoritative price from the database.
# ---------------------------------------------------------------------------


class CoursePurchaseRequest(BaseModel):
    course_id: str
    amount: Optional[int] = None  # IGNORED — server looks up real price
    success_url: str
    failure_url: str
    promo_code: Optional[str] = None
    skip_wallet: bool = False


class ValidatePromoRequest(BaseModel):
    code: str
    expected_amount: int
    plan_type: Optional[str] = None
    product_id: Optional[str] = None


class PathPurchaseRequest(BaseModel):
    path_id: str
    amount: Optional[int] = None  # IGNORED — server looks up real price
    success_url: str
    failure_url: str
    promo_code: Optional[str] = None
    skip_wallet: bool = False


class LiveSessionPurchaseRequest(BaseModel):
    session_id: str
    amount: Optional[int] = None  # IGNORED — server looks up real price
    success_url: str
    failure_url: str
    promo_code: Optional[str] = None
    skip_wallet: bool = False


class CertificatePurchaseRequest(BaseModel):
    module_id: str
    success_url: str
    failure_url: str
    skip_wallet: bool = False


class SubscriptionRequest(BaseModel):
    plan: SubscriptionPlan
    billing_cycle: str = "monthly"
    amount: Optional[int] = None  # IGNORED — server uses canonical prices
    success_url: str
    failure_url: str
    promo_code: Optional[str] = None
    skip_wallet: bool = False


# Replaced by async _resolve_subscription_price() below which reads from
# the SubscriptionTierConfig DB table (single source of truth).


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_price_json(price_data: Any) -> dict:
    """Safely parse a Prisma Json? price field into a dict."""
    if not price_data:
        return {}
    try:
        if isinstance(price_data, str):
            return json.loads(price_data)
        if isinstance(price_data, dict):
            return price_data
    except Exception:
        pass
    return {}


def _extract_effective_price(price_dict: dict) -> int:
    """
    Return the effective price in DZD from a price dict.

    Price JSON structure (from seed data):
        {"original": 5000, "discounted": 5000}
    OR legacy:
        {"amount": 5000}  /  {"price": 5000}

    Priority: discounted (if > 0) → original → amount → price → 0
    """
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


async def _resolve_module_price(module_id: str) -> int:
    """
    Look up a Module by ID and return its authoritative price in DZD.
    Raises 404 if module not found, 400 if course is free.
    """
    module = await prisma.module.find_unique(where={"id": module_id})
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.billing.course_not_found",
        )

    price_dict = _parse_price_json(module.price)
    price_dzd = _extract_effective_price(price_dict)

    if price_dzd <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="errors.billing.course_is_free",
        )

    return price_dzd


async def _resolve_path_price(path_id: str) -> int:
    """
    Look up a Path by ID and return its authoritative price in DZD.
    Raises 404 if path not found, 400 if path is free.

    If path.price is NULL in the DB, computes price dynamically from
    the path's modules (80% of module sum) — same logic as education_service.
    """
    path = await prisma.path.find_unique(where={"id": path_id})
    if not path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.billing.path_not_found",
        )

    price_dict = _parse_price_json(path.price)
    price_dzd = _extract_effective_price(price_dict)

    # If no explicit price, compute from modules
    if price_dzd <= 0:
        modules = await prisma.pathmodule.find_many(
            where={"pathId": path_id},
            include={"module": True},
        )
        module_sum = 0
        for pm in modules:
            if pm.module:
                m_price = _parse_price_json(pm.module.price)
                m_effective = _extract_effective_price(m_price)
                module_sum += m_effective

        if module_sum > 0:
            price_dzd = int(module_sum * 0.8)

    if price_dzd <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="errors.billing.path_is_free",
        )

    return price_dzd


async def _resolve_subscription_price(
    plan: SubscriptionPlan, billing_cycle: str
) -> int:
    """
    Return the canonical subscription price in DZD from DB config.
    Raises 400 if the plan/cycle combination is unknown or free.
    """
    price = await subscription_service.get_plan_price(plan, billing_cycle)
    if price <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="errors.billing.plan_is_free",
        )
    return price


async def _try_wallet_payment(
    user_id: int,
    amount: int,
    transaction_id: int,
    purpose: PaymentPurpose,
    description: str,
) -> bool:
    """
    If the user's wallet has sufficient available balance, debit it and mark
    the transaction COMPLETED. Returns True if wallet was used, False if
    wallet balance was insufficient (caller should fall back to Chargily).
    """
    from app.services.wallet_service import wallet_service

    wallet = await wallet_service.get_user_wallet(user_id)
    if not wallet:
        return False
    raw_points = getattr(wallet, "podaPoints", None)
    if not isinstance(raw_points, (int, float)):
        raw_points = getattr(wallet, "poda_points", 0)
    available = int(raw_points) if isinstance(raw_points, (int, float)) else 0
    if available < amount:
        return False

    await wallet_service.debit_wallet(
        wallet_id=wallet.id,
        amount=amount,
        purpose=purpose,
        reference_id=str(transaction_id),
        description=description,
    )
    await prisma.transaction.update(
        where={"id": transaction_id},
        data={"status": "COMPLETED", "updatedAt": datetime.now(timezone.utc)},
    )
    # Grant entitlements according to what the transaction actually purchased
    # (mirrors the webhook's purpose-based dispatch chain). Live session
    # purchases must go through live_session_billing_service.grant_access so a
    # booking is created; sending them to education grants nothing and silently
    # swallows paid access.
    if purpose == PaymentPurpose.LIVE_SESSION_PURCHASE:
        from app.services.billing_services.live_session_billing_service import (
            live_session_billing_service,
        )

        await live_session_billing_service.grant_access(transaction_id)
    elif purpose in (
        PaymentPurpose.COURSE_PURCHASE,
        PaymentPurpose.PATH_PURCHASE,
        PaymentPurpose.STUDENT_SUBSCRIPTION,
        PaymentPurpose.BI_SUBSCRIPTION,
    ):
        from app.services.billing_services.education_service import (
            education_billing_service,
        )

        await education_billing_service.grant_entitlements(transaction_id)
    return True


async def _check_idempotency(key: Optional[str], user_id: int):
    """Check if this request has already been processed."""
    if not key:
        return None
    existing = await prisma.idempotencykey.find_first(
        where={"key": key, "userId": user_id}
    )
    if existing and existing.responseCode == 200:
        return existing.responseBody
    return None


async def _reserve_idempotency(key: Optional[str], user_id: int) -> bool:
    """
    Atomically claim an idempotency key BEFORE processing the payment.

    Uses `create_many(skip_duplicates=True)` (unique on `key`) so two racing
    requests carrying the same key can never both proceed: only the first wins
    the claim, the second gets False and the route returns 409. This closes the
    double-click / concurrent double-charge race (audit P1). The placeholder is
    later overwritten by `_save_idempotency` (upsert) once processing finishes.
    """
    if not key:
        return True  # no key supplied → caller still processes (legacy clients)
    try:
        from datetime import datetime, timedelta, timezone
        from app.generated.prisma import Json

        created = await prisma.idempotencykey.create_many(
            data=[
                {
                    "key": key,
                    "userId": user_id,
                    "lastRunAt": datetime.now(timezone.utc),
                    "responseCode": 202,  # placeholder: in-flight
                    "responseBody": Json({"status": "in_progress"}),
                    "expiresAt": datetime.now(timezone.utc) + timedelta(minutes=2),
                }
            ],
            skip_duplicates=True,
        )
        return created > 0
    except Exception as e:
        # Fall back to processing without a reservation (legacy behavior) rather
        # than blocking legitimate purchases if the write fails.
        logger.warning(
            f"Idempotency reservation failed ({e}) — proceeding without reservation"
        )
        return True


async def _save_idempotency(
    key: Optional[str], user_id: int, transaction_id: int, response: dict
):
    """Save idempotency key after successful processing (upsert — also
    overwrites the in-flight placeholder created by `_reserve_idempotency`)."""
    if not key:
        return
    try:
        from datetime import datetime, timedelta, timezone
        from app.generated.prisma import Json

        now = datetime.now(timezone.utc)
        json_body = Json(
            response if isinstance(response, dict) else {"response": str(response)}
        )
        await prisma.idempotencykey.upsert(
            where={"key": key},
            data={
                "create": {
                    "key": key,
                    "user": {"connect": {"id": user_id}},
                    "transaction": {"connect": {"id": transaction_id}},
                    "lastRunAt": now,
                    "responseCode": 200,
                    "responseBody": json_body,
                    "expiresAt": now + timedelta(hours=24),
                },
                "update": {
                    "user": {"connect": {"id": user_id}},
                    "transaction": {"connect": {"id": transaction_id}},
                    "lastRunAt": now,
                    "responseCode": 200,
                    "responseBody": json_body,
                    "expiresAt": now + timedelta(hours=24),
                },
            },
        )
    except Exception as e:
        logger.error(f"Failed to save idempotency key {key}: {e}")


async def _apply_promo_code(
    promo_code: Optional[str],
    user_id: int,
    amount: int,
    plan_type: Optional[str] = None,
    product_id: Optional[str] = None,
) -> tuple[int, Optional[dict]]:
    """
    If a promo_code is supplied, validate it and return the discounted price
    plus metadata to record on the transaction. Returns (discounted_amount,
    promo_metadata_or_None).
    """
    if not promo_code:
        return amount, None

    from app.services.promo_code_service import promo_code_service, PromoCodeError

    try:
        result = await promo_code_service.validate_and_apply(
            code=promo_code,
            user_id=user_id,
            amount=amount,
            plan_type=plan_type,
            product_id=product_id,
        )
        if result and result.discounted_amount < amount:
            logger.info(
                f"Promo code {promo_code} applied: {amount} -> {result.discounted_amount} DZD"
            )
            return result.discounted_amount, {
                "promo_code": result.code,
                "promo_discount_type": result.discount_type,
                "promo_discount_value": result.discount_value,
                "promo_original_amount": result.original_amount,
            }
    except PromoCodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message,
        )

    return amount, None


@router.post("/validate-promo")
async def validate_promo_code(
    req: ValidatePromoRequest,
    current_user=Depends(get_current_active_user),
):
    """Validate a promo code and return the discounted amount without applying it."""
    from app.services.promo_code_service import promo_code_service, PromoCodeError

    try:
        result = await promo_code_service.validate_only(
            code=req.code,
            user_id=current_user.id,
            amount=req.expected_amount,
            plan_type=req.plan_type,
            product_id=req.product_id,
        )
        return {
            "valid": True,
            "code": result.code,
            "original_amount": result.original_amount,
            "discounted_amount": result.discounted_amount,
            "discount_type": result.discount_type,
            "discount_value": result.discount_value,
            "description": result.description,
        }
    except PromoCodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": e.code, "message": e.message},
        )


# ---------------------------------------------------------------------------
# Purchase endpoints — price is ALWAYS resolved server-side
# ---------------------------------------------------------------------------


@router.post("/purchase/course")
async def purchase_course(
    req: CoursePurchaseRequest,
    current_user=Depends(get_current_active_user),
    x_idempotency_key: Optional[str] = Header(None),
):
    """Initiates a course purchase flow. Price is looked up server-side."""
    # Idempotency check
    cached = await _check_idempotency(x_idempotency_key, current_user.id)
    if cached:
        return cached
    if not await _reserve_idempotency(x_idempotency_key, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="errors.billing.request_in_progress",
        )

    # --- SERVER-SIDE PRICE RESOLUTION (never trust client) ---
    price_dzd = await _resolve_module_price(req.course_id)

    if req.amount is not None and req.amount != price_dzd:
        logger.warning(
            f"Client sent amount={req.amount} for course {req.course_id}, "
            f"but server price is {price_dzd} DZD. Using server price."
        )

    # Apply promo code if provided
    effective_price, promo_meta = await _apply_promo_code(
        req.promo_code,
        current_user.id,
        price_dzd,
        product_id=req.course_id,
    )

    # Check for duplicate enrollment
    existing = await prisma.enrollment.find_first(
        where={"userId": current_user.id, "moduleId": req.course_id}
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="errors.billing.already_enrolled",
        )

    metadata = {"course_id": req.course_id}
    if promo_meta:
        metadata.update(promo_meta)

    try:
        transaction = await billing_core_service.create_transaction(
            amount=effective_price,
            purpose=PaymentPurpose.COURSE_PURCHASE,
            user_id=current_user.id,
            metadata=metadata,
        )

        # Try wallet payment first (unless user opted out)
        wallet_ok = (
            False
            if req.skip_wallet
            else await _try_wallet_payment(
                user_id=current_user.id,
                amount=effective_price,
                transaction_id=transaction.id,
                purpose=PaymentPurpose.COURSE_PURCHASE,
                description=f"Course purchase: {req.course_id}",
            )
        )
        if wallet_ok:
            response = {
                "success": True,
                "paidWithWallet": True,
                "paid_with_wallet": True,
                "checkoutUrl": None,
                "checkout_url": None,
                "data": {
                    "paidWithWallet": True,
                    "paid_with_wallet": True,
                    "checkoutUrl": None,
                    "checkout_url": None,
                    "transactionId": transaction.id,
                    "transaction_id": transaction.id,
                    "amount": effective_price,
                },
            }
            await _save_idempotency(
                x_idempotency_key, current_user.id, transaction.id, response
            )
            return response

        # Fall back to Chargily checkout
        checkout = await billing_core_service.initiate_chargily_checkout(
            transaction_id=transaction.id,
            request=CheckoutInitiate(
                amount=effective_price,
                purpose=PaymentPurpose.COURSE_PURCHASE,
                success_url=req.success_url,
                failure_url=req.failure_url,
                metadata=metadata,
            ),
        )

        response = {
            "success": True,
            "checkoutUrl": checkout.checkout_url,
            "checkout_url": checkout.checkout_url,
            "paidWithWallet": False,
            "paid_with_wallet": False,
            "data": {
                "checkoutUrl": checkout.checkout_url,
                "checkout_url": checkout.checkout_url,
                "paidWithWallet": False,
                "paid_with_wallet": False,
                "transactionId": transaction.id,
                "transaction_id": transaction.id,
            },
        }
        await _save_idempotency(
            x_idempotency_key, current_user.id, transaction.id, response
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to purchase course: {e}")
        raise HTTPException(status_code=500, detail="errors.billing.purchase_failed")


@router.post("/purchase/live-session")
async def purchase_live_session(
    req: LiveSessionPurchaseRequest,
    current_user=Depends(get_current_active_user),
    x_idempotency_key: Optional[str] = Header(None),
):
    """Initiates a live session booking. Price is looked up server-side."""
    cached = await _check_idempotency(x_idempotency_key, current_user.id)
    if cached:
        return cached
    if not await _reserve_idempotency(x_idempotency_key, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="errors.billing.request_in_progress",
        )

    session = await prisma.livesession.find_unique(where={"id": req.session_id})
    if not session or session.deletedAt:
        raise HTTPException(status_code=404, detail="errors.live_session.not_found")
    if session.status == "CANCELLED":
        raise HTTPException(status_code=410, detail="errors.live_session.cancelled")
    if session.ownerId == current_user.id:
        raise HTTPException(status_code=400, detail="errors.live_session.own_session")
    if not session.approvedAt:
        raise HTTPException(status_code=403, detail="errors.live_session.not_approved")

    existing_booking = await prisma.livesessionbooking.find_unique(
        where={
            "liveSessionId_userId": {
                "liveSessionId": req.session_id,
                "userId": current_user.id,
            }
        }
    )
    if existing_booking and existing_booking.deletedAt is None:
        raise HTTPException(
            status_code=409, detail="errors.live_session.already_booked"
        )

    booking_count = await prisma.livesessionbooking.count(
        where={"liveSessionId": req.session_id, "deletedAt": None}
    )
    if session.maxParticipants and booking_count >= session.maxParticipants:
        raise HTTPException(status_code=409, detail="errors.live_session.session_full")

    price_dzd = session.priceAmount or 0
    if price_dzd == 0:
        raise HTTPException(status_code=400, detail="errors.live_session.free_session")

    # Apply promo code if provided
    effective_price, promo_meta = await _apply_promo_code(
        req.promo_code,
        current_user.id,
        price_dzd,
        product_id=req.session_id,
    )

    metadata = {"live_session_id": req.session_id, "session_title": session.title}
    if promo_meta:
        metadata.update(promo_meta)

    try:
        transaction = await billing_core_service.create_transaction(
            amount=effective_price,
            purpose=PaymentPurpose.LIVE_SESSION_PURCHASE,
            user_id=current_user.id,
            metadata=metadata,
        )

        wallet_ok = (
            False
            if req.skip_wallet
            else await _try_wallet_payment(
                user_id=current_user.id,
                amount=effective_price,
                transaction_id=transaction.id,
                purpose=PaymentPurpose.LIVE_SESSION_PURCHASE,
                description=f"Live session: {req.session_id}",
            )
        )
        if wallet_ok:
            response = {
                "success": True,
                "paidWithWallet": True,
                "paid_with_wallet": True,
                "checkoutUrl": None,
                "checkout_url": None,
                "data": {
                    "paidWithWallet": True,
                    "paid_with_wallet": True,
                    "checkoutUrl": None,
                    "checkout_url": None,
                    "transactionId": transaction.id,
                    "transaction_id": transaction.id,
                    "amount": effective_price,
                },
            }
            await _save_idempotency(
                x_idempotency_key, current_user.id, transaction.id, response
            )
            return response

        checkout = await billing_core_service.initiate_chargily_checkout(
            transaction_id=transaction.id,
            request=CheckoutInitiate(
                amount=effective_price,
                purpose=PaymentPurpose.LIVE_SESSION_PURCHASE,
                success_url=req.success_url,
                failure_url=req.failure_url,
                metadata=metadata,
            ),
        )

        response = {
            "success": True,
            "checkoutUrl": checkout.checkout_url,
            "checkout_url": checkout.checkout_url,
            "paidWithWallet": False,
            "paid_with_wallet": False,
            "data": {
                "checkoutUrl": checkout.checkout_url,
                "checkout_url": checkout.checkout_url,
                "paidWithWallet": False,
                "paid_with_wallet": False,
                "transactionId": transaction.id,
                "transaction_id": transaction.id,
            },
        }
        await _save_idempotency(
            x_idempotency_key, current_user.id, transaction.id, response
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to purchase live session: {e}")
        raise HTTPException(status_code=500, detail="errors.billing.purchase_failed")


@router.post("/purchase/certificate")
async def purchase_certificate(
    req: CertificatePurchaseRequest,
    current_user=Depends(get_current_active_user),
    x_idempotency_key: Optional[str] = Header(None),
):
    """Purchase a standalone certificate for a completed course."""
    cached = await _check_idempotency(x_idempotency_key, current_user.id)
    if cached:
        return cached
    if not await _reserve_idempotency(x_idempotency_key, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="errors.billing.request_in_progress",
        )

    price_dzd = CERTIFICATE_PRICE

    # Verify the module exists and user has completed it
    module = await prisma.module.find_unique(where={"id": req.module_id})
    if not module:
        raise HTTPException(status_code=404, detail="errors.billing.module_not_found")

    enrollment = await prisma.enrollment.find_first(
        where={"userId": current_user.id, "moduleId": req.module_id}
    )
    if not enrollment:
        raise HTTPException(status_code=400, detail="errors.billing.not_enrolled")

    # Check if user already has a certificate for this module
    existing_cert = await prisma.certificate.find_first(
        where={
            "userId": current_user.id,
            "moduleId": req.module_id,
            "revokedAt": None,
            "deletedAt": None,
        }
    )
    if existing_cert:
        raise HTTPException(
            status_code=409, detail="errors.billing.certificate_already_exists"
        )

    metadata = {"module_id": req.module_id, "purpose": "certificate_purchase"}

    try:
        transaction = await billing_core_service.create_transaction(
            amount=price_dzd,
            purpose=PaymentPurpose.CERTIFICATE_PURCHASE,
            user_id=current_user.id,
            metadata=metadata,
        )

        wallet_ok = (
            False
            if req.skip_wallet
            else await _try_wallet_payment(
                user_id=current_user.id,
                amount=price_dzd,
                transaction_id=transaction.id,
                purpose=PaymentPurpose.CERTIFICATE_PURCHASE,
                description=f"Certificate purchase: {req.module_id}",
            )
        )
        if wallet_ok:
            response = {
                "success": True,
                "paidWithWallet": True,
                "paid_with_wallet": True,
                "checkoutUrl": None,
                "checkout_url": None,
                "data": {
                    "paidWithWallet": True,
                    "paid_with_wallet": True,
                    "checkoutUrl": None,
                    "checkout_url": None,
                    "transactionId": transaction.id,
                    "transaction_id": transaction.id,
                    "amount": price_dzd,
                },
            }
            await _save_idempotency(
                x_idempotency_key, current_user.id, transaction.id, response
            )
            return response

        checkout = await billing_core_service.initiate_chargily_checkout(
            transaction_id=transaction.id,
            request=CheckoutInitiate(
                amount=price_dzd,
                purpose=PaymentPurpose.CERTIFICATE_PURCHASE,
                success_url=req.success_url,
                failure_url=req.failure_url,
                metadata=metadata,
            ),
        )

        response = {
            "success": True,
            "checkoutUrl": checkout.checkout_url,
            "checkout_url": checkout.checkout_url,
            "paidWithWallet": False,
            "paid_with_wallet": False,
            "data": {
                "checkoutUrl": checkout.checkout_url,
                "checkout_url": checkout.checkout_url,
                "paidWithWallet": False,
                "paid_with_wallet": False,
                "transactionId": transaction.id,
                "transaction_id": transaction.id,
            },
        }
        await _save_idempotency(
            x_idempotency_key, current_user.id, transaction.id, response
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to purchase certificate: {e}")
        raise HTTPException(status_code=500, detail="errors.billing.purchase_failed")


@router.post("/purchase/path")
async def purchase_path(
    req: PathPurchaseRequest,
    current_user=Depends(get_current_active_user),
    x_idempotency_key: Optional[str] = Header(None),
):
    """Initiates a path purchase flow. Price is looked up server-side."""
    cached = await _check_idempotency(x_idempotency_key, current_user.id)
    if cached:
        return cached
    if not await _reserve_idempotency(x_idempotency_key, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="errors.billing.request_in_progress",
        )

    # --- SERVER-SIDE PRICE RESOLUTION (never trust client) ---
    price_dzd = await _resolve_path_price(req.path_id)

    if req.amount is not None and req.amount != price_dzd:
        logger.warning(
            f"Client sent amount={req.amount} for path {req.path_id}, "
            f"but server price is {price_dzd} DZD. Using server price."
        )

    # Apply promo code if provided
    effective_price, promo_meta = await _apply_promo_code(
        req.promo_code,
        current_user.id,
        price_dzd,
        product_id=req.path_id,
    )

    # Check for duplicate enrollment
    existing = await prisma.enrollment.find_first(
        where={"userId": current_user.id, "pathId": req.path_id}
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="errors.billing.already_enrolled",
        )

    metadata = {"path_id": req.path_id}
    if promo_meta:
        metadata.update(promo_meta)

    try:
        transaction = await billing_core_service.create_transaction(
            amount=effective_price,
            purpose=PaymentPurpose.PATH_PURCHASE,
            user_id=current_user.id,
            metadata=metadata,
        )

        wallet_ok = (
            False
            if req.skip_wallet
            else await _try_wallet_payment(
                user_id=current_user.id,
                amount=effective_price,
                transaction_id=transaction.id,
                purpose=PaymentPurpose.PATH_PURCHASE,
                description=f"Path purchase: {req.path_id}",
            )
        )
        if wallet_ok:
            response = {
                "success": True,
                "paidWithWallet": True,
                "paid_with_wallet": True,
                "checkoutUrl": None,
                "checkout_url": None,
                "data": {
                    "paidWithWallet": True,
                    "paid_with_wallet": True,
                    "checkoutUrl": None,
                    "checkout_url": None,
                    "transactionId": transaction.id,
                    "transaction_id": transaction.id,
                    "amount": effective_price,
                },
            }
            await _save_idempotency(
                x_idempotency_key, current_user.id, transaction.id, response
            )
            return response

        checkout = await billing_core_service.initiate_chargily_checkout(
            transaction_id=transaction.id,
            request=CheckoutInitiate(
                amount=effective_price,
                purpose=PaymentPurpose.PATH_PURCHASE,
                success_url=req.success_url,
                failure_url=req.failure_url,
                metadata=metadata,
            ),
        )

        response = {
            "success": True,
            "checkoutUrl": checkout.checkout_url,
            "checkout_url": checkout.checkout_url,
            "paidWithWallet": False,
            "paid_with_wallet": False,
            "data": {
                "checkoutUrl": checkout.checkout_url,
                "checkout_url": checkout.checkout_url,
                "paidWithWallet": False,
                "paid_with_wallet": False,
                "transactionId": transaction.id,
                "transaction_id": transaction.id,
            },
        }
        await _save_idempotency(
            x_idempotency_key, current_user.id, transaction.id, response
        )
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Path purchase failed: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}") from e


@router.post("/subscribe")
async def subscribe(
    req: SubscriptionRequest,
    current_user=Depends(get_current_active_user),
    x_idempotency_key: Optional[str] = Header(None),
):
    """Initiates a subscription flow. Price is resolved server-side."""
    cached = await _check_idempotency(x_idempotency_key, current_user.id)
    if cached:
        return cached
    if not await _reserve_idempotency(x_idempotency_key, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="errors.billing.request_in_progress",
        )

    # --- SERVER-SIDE PRICE RESOLUTION (never trust client) ---
    price_dzd = await _resolve_subscription_price(req.plan, req.billing_cycle)

    if req.amount is not None and req.amount != price_dzd:
        logger.warning(
            f"Client sent amount={req.amount} for plan {req.plan.value}/{req.billing_cycle}, "
            f"but server price is {price_dzd} DZD. Using server price."
        )

    # Apply promo code if provided
    effective_price, promo_meta = await _apply_promo_code(
        req.promo_code,
        current_user.id,
        price_dzd,
        plan_type=req.plan.value,
    )

    # Check for existing active subscription for this pillar (one per pillar rule)
    target_pillar_plans = []
    if "STUDENT" in req.plan.value:
        target_pillar_plans = ["STUDENT_STARTER", "STUDENT_PLUS", "STUDENT_PRO"]
    elif "BI" in req.plan.value:
        target_pillar_plans = ["BI_GROWTH", "BI_SCALE", "BI_ELITE"]

    if target_pillar_plans:
        existing_sub = await prisma.subscription.find_first(
            where={
                "userId": current_user.id,
                "status": "ACTIVE",
                "plan": {"in": target_pillar_plans},
            }
        )
        if existing_sub:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="errors.billing.subscription_already_active_for_pillar",
            )

    purpose = (
        PaymentPurpose.STUDENT_SUBSCRIPTION
        if "STUDENT" in req.plan.value
        else PaymentPurpose.BI_SUBSCRIPTION
    )

    metadata = {"plan": req.plan.value, "billing_cycle": req.billing_cycle}
    if promo_meta:
        metadata.update(promo_meta)

    try:
        transaction = await billing_core_service.create_transaction(
            amount=effective_price,
            purpose=purpose,
            user_id=current_user.id,
            metadata=metadata,
        )

        # ── Try wallet payment first (unless user opted out) ──
        wallet_ok = (
            False
            if req.skip_wallet
            else await _try_wallet_payment(
                user_id=current_user.id,
                amount=effective_price,
                transaction_id=transaction.id,
                purpose=purpose,
                description=f"Subscription: {req.plan.value} ({req.billing_cycle})",
            )
        )
        if wallet_ok:
            response = {
                "success": True,
                "data": {
                    "paidWithWallet": True,
                    "transactionId": transaction.id,
                    "amount": effective_price,
                },
            }
            await _save_idempotency(
                x_idempotency_key, current_user.id, transaction.id, response
            )
            return response

        # ── Fall back to Chargily checkout ──
        checkout = await billing_core_service.initiate_chargily_checkout(
            transaction_id=transaction.id,
            request=CheckoutInitiate(
                amount=effective_price,
                purpose=purpose,
                success_url=req.success_url,
                failure_url=req.failure_url,
                metadata=metadata,
            ),
        )

        response = {
            "success": True,
            "data": {
                "checkoutUrl": checkout.checkout_url,
                "transactionId": transaction.id,
            },
        }
        await _save_idempotency(
            x_idempotency_key, current_user.id, transaction.id, response
        )
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Subscription checkout failed: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}") from e


class WalletTopUpRequest(BaseModel):
    amount: int  # Required — server validates minimum
    success_url: str
    failure_url: str


@router.post("/wallet/topup")
async def wallet_topup(
    req: WalletTopUpRequest,
    current_user=Depends(get_current_active_user),
    x_idempotency_key: Optional[str] = Header(None),
):
    """
    Initiates a wallet top-up via Chargily checkout.
    Server validates minimum amount.
    Auto-creates wallet if it doesn't exist.
    """
    # Idempotency check
    cached = await _check_idempotency(x_idempotency_key, current_user.id)
    if cached:
        return cached
    if not await _reserve_idempotency(x_idempotency_key, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="errors.billing.request_in_progress",
        )

    # Minimum top-up validation
    MIN_TOPUP = 1000
    if req.amount < MIN_TOPUP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="errors.billing.minimum_topup_not_met",
        )

    # Ensure wallet exists (auto-create)
    from app.services.wallet_service import wallet_service

    await wallet_service.ensure_user_wallet(current_user.id)

    # Create transaction with wallet linked
    transaction = await billing_core_service.create_transaction(
        amount=req.amount,
        purpose=PaymentPurpose.DEPOSIT,
        user_id=current_user.id,
        metadata={"type": "wallet_topup"},
    )

    # Initiate Chargily checkout
    checkout = await billing_core_service.initiate_chargily_checkout(
        transaction_id=transaction.id,
        request=CheckoutInitiate(
            amount=req.amount,
            purpose=PaymentPurpose.DEPOSIT,
            success_url=req.success_url,
            failure_url=req.failure_url,
            metadata={"type": "wallet_topup"},
        ),
    )

    response = {
        "success": True,
        "data": {"checkoutUrl": checkout.checkout_url, "transactionId": transaction.id},
    }
    await _save_idempotency(
        x_idempotency_key, current_user.id, transaction.id, response
    )
    return response


class VerifyCheckoutRequest(BaseModel):
    checkout_id: str


@router.post("/verify-checkout")
async def verify_checkout(
    req: VerifyCheckoutRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Verify and finalize a Chargily checkout after redirect.
    Used as a fallback when webhooks haven't fired (e.g. test mode).
    Calls Chargily API to check status, then finalizes the transaction.
    """
    from app.services.payment_providers.chargily import chargily_client
    from app.routers.billing_routers.webhook_router import finalize_payment_success
    from app.schemas.billing_schemas.base import PaymentStatus

    # Fetch checkout status from Chargily
    try:
        checkout = await chargily_client.get_checkout(req.checkout_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to verify checkout: {str(e)}",
        )

    status = checkout.get("status")
    if status != "paid":
        return {
            "status": status,
            "finalized": False,
            "message": f"Checkout is {status}, not yet paid",
        }

    # Find transaction by provider reference
    transaction = await prisma.transaction.find_first(
        where={"providerReference": req.checkout_id}
    )

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found for this checkout",
        )

    # Verify ownership
    if transaction.userId != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to verify this checkout",
        )

    # Skip if already finalized
    if transaction.status in [
        PaymentStatus.COMPLETED.value,
        PaymentStatus.FAILED.value,
    ]:
        return {
            "status": transaction.status,
            "finalized": True,
            "already_finalized": True,
            "transaction_id": transaction.id,
        }

    # Finalize the payment (same logic as webhook handler)
    try:
        await finalize_payment_success(transaction, checkout)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to finalize payment for checkout {req.checkout_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to finalize payment",
        )

    # Return updated wallet info
    from app.services.wallet_service import wallet_service

    wallet = await wallet_service.ensure_user_wallet(current_user.id)

    return {
        "status": "completed",
        "finalized": True,
        "transaction_id": transaction.id,
        "wallet_balance": wallet.poda_points,
    }


@router.post("/freelancing/release-escrow/{contract_id}")
async def release_escrow(
    contract_id: int, current_user=Depends(get_current_active_user)
):
    """
    Manually release escrow (Admin or Client).
    Triggers commission calculation and freelancer payout.
    """
    # Authorization check: only admin or the client of the contract
    from app.core.prisma import prisma

    contract = await prisma.contract.find_unique(where={"id": contract_id})
    if not contract:
        raise HTTPException(status_code=404, detail="errors.billing.contract_not_found")

    if current_user.role != "ADMIN" and contract.clientId != current_user.id:
        raise HTTPException(
            status_code=403, detail="errors.billing.not_authorized_release_escrow"
        )

    from app.services.billing_services.commission_service import commission_service
    from app.services.feature_gate import FeatureModeError

    try:
        await commission_service.release_escrow(contract_id)
    except FeatureModeError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {"status": "escrow_released", "contract_id": contract_id}


@router.get("/invoices/{transaction_id}/download")
async def download_invoice(
    transaction_id: int, current_user=Depends(get_current_active_user)
):
    """
    Generate and download invoice for a transaction.
    """
    # Authorization check
    from app.core.prisma import prisma

    transaction = await prisma.transaction.find_unique(
        where={"id": transaction_id}, include={"user": True, "organization": True}
    )

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Check if user owns the transaction or is admin
    is_owner = False
    if transaction.userId == current_user.id:
        is_owner = True
    elif (
        transaction.organization and transaction.organization.ownerId == current_user.id
    ):
        is_owner = True

    if not is_owner and current_user.role != "ADMIN":
        raise HTTPException(
            status_code=403, detail="Not authorized to access this invoice"
        )

    from app.core.config import setting as app_settings
    from app.services.invoice_service import invoice_service

    invoice_data = await invoice_service.generate_invoice(transaction_id)
    file_path = invoice_data.get("pdf_path")
    if not file_path or not os.path.exists(file_path):
        rel_path = invoice_data.get("pdf_url", "")
        if rel_path.startswith("/static/"):
            rel_path = rel_path.replace("/static/", "", 1)
        file_path = os.path.join(app_settings.UPLOAD_DIR, rel_path)

    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Invoice file not found on disk")

    inv_num = invoice_data.get("invoice_number", transaction_id)
    filename = f"Facture_{inv_num}.pdf"
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
