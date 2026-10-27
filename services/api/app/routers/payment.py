import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from fastapi.responses import RedirectResponse
from datetime import datetime, timezone
from app.core.config import setting

from app.core.auth import get_current_active_user
from app.schemas.payment import (
    PaymentInitiateRequest,
    PaymentResponse,
    PaymentGateway,
    PaymentStatus,
    TransactionResponse,
    PaymentPurpose,
)
from app.schemas.education import serialize_json_field
from app.services.payment_service import payment_service
from app.services.payment_providers.chargily import chargily_client, ChargilyError
from app.core.prisma import prisma
from app.generated.prisma import Json
from app.tasks.refund_tasks import process_refund
from app.config.refund_policy import (
    validate_refund_request,
    calculate_pro_rata_refund,
    validate_partial_refund_amount,
    DEFAULT_REFUND_POLICY,
    _get_refund_window_days,
)

router = APIRouter(prefix="/payments", tags=["payments"])
logger = logging.getLogger(__name__)


@router.post("/initiate", response_model=PaymentResponse, response_model_by_alias=True)
async def initiate_payment(
    request: PaymentInitiateRequest, current_user=Depends(get_current_active_user)
):
    """Initiate a payment"""
    try:
        # SECURITY (P0-1): the legacy initiate endpoint accepts a client-supplied
        # `amount` and `metadata`. Entitlement-granting purposes must instead go
        # through /api/v1/billing/payments/purchase/*, where the server resolves
        # the price from the database and stamps `price_verified_at` on the
        # transaction. Keeping these purposes here would let a caller buy any
        # course for 1 DZD (the webhook grants access based on that metadata).
        _BLOCKED_LEGACY_PURPOSES = {
            PaymentPurpose.COURSE_PURCHASE,
            PaymentPurpose.PATH_PURCHASE,
            PaymentPurpose.CERTIFICATE_PURCHASE,
            PaymentPurpose.LIVE_SESSION_PURCHASE,
        }
        if request.purpose in _BLOCKED_LEGACY_PURPOSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This payment purpose must be initiated via /api/v1/billing/payments/purchase/* "
                "(server-side price verification)",
            )

        # Ensure user can only initiate for themselves unless admin
        if (
            request.user_id
            and request.user_id != current_user.id
            and current_user.role not in ["ADMIN", "INSTRUCTOR"]
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot initiate payment for other users",
            )

        # Set user_id if not provided (default to current user)
        if not request.user_id and not request.organization_id:
            request.user_id = current_user.id

        # Initiate payment
        payment = await payment_service.initiate_payment(request)

        return payment

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Payment initiation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate payment",
        )


@router.get(
    "/{transaction_id}", response_model=PaymentResponse, response_model_by_alias=True
)
async def get_payment_status(
    transaction_id: int, current_user=Depends(get_current_active_user)
):
    """Get payment status"""
    try:
        payment = await payment_service.get_transaction(transaction_id)

        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found"
            )

        # Check authorization
        if (
            payment.user_id
            and payment.user_id != current_user.id
            and current_user.role not in ["ADMIN", "INSTRUCTOR"]
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this payment",
            )

        if payment.organization_id:
            # Check if user has access to organization
            membership = await prisma.organizationmember.find_first(
                where={
                    "organizationId": payment.organization_id,
                    "userId": current_user.id,
                }
            )
            if not membership and current_user.role not in ["ADMIN"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this payment",
                )

        return payment

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get payment status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payment status",
        )


@router.get(
    "/user/transactions",
    response_model=List[TransactionResponse],
    response_model_by_alias=True,
)
async def get_user_transactions(
    purpose: Optional[str] = None,
    status: Optional[PaymentStatus] = None,
    limit: int = 50,
    offset: int = 0,
    current_user=Depends(get_current_active_user),
):
    """Get transaction history for current user"""
    try:
        where_clause = {"userId": current_user.id}

        if purpose:
            where_clause["purpose"] = purpose

        if status:
            where_clause["status"] = status.value

        transactions = await prisma.transaction.find_many(
            where=where_clause,
            include={"wallet": True},
            order={"createdAt": "desc"},
            take=limit,
            skip=offset,
        )

        return [TransactionResponse.from_orm(tx) for tx in transactions]

    except Exception as e:
        logger.error(f"Failed to get user transactions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get transactions",
        )


@router.get(
    "/organization/{org_id}/transactions",
    response_model=List[TransactionResponse],
    response_model_by_alias=True,
)
async def get_organization_transactions(
    org_id: int,
    purpose: Optional[str] = None,
    status: Optional[PaymentStatus] = None,
    limit: int = 50,
    offset: int = 0,
    current_user=Depends(get_current_active_user),
):
    """Get transaction history for organization"""
    try:
        # Check organization membership or admin access
        membership = await prisma.organizationmember.find_first(
            where={"organizationId": org_id, "userId": current_user.id}
        )

        if not membership and current_user.role not in ["ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view organization transactions",
            )

        where_clause = {"organizationId": org_id}

        if purpose:
            where_clause["purpose"] = purpose

        if status:
            where_clause["status"] = status.value

        transactions = await prisma.transaction.find_many(
            where=where_clause,
            include={"wallet": True},
            order={"createdAt": "desc"},
            take=limit,
            skip=offset,
        )

        return [TransactionResponse.from_orm(tx) for tx in transactions]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get organization transactions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get transactions",
        )


@router.get("/{transaction_id}/refund-info")
async def get_refund_info(
    transaction_id: int,
    current_user=Depends(get_current_active_user),
):
    """Get refund eligibility and pro-rata info for a transaction without submitting a request."""
    try:
        transaction = await prisma.transaction.find_unique(
            where={"id": transaction_id}, include={"user": True}
        )
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")

        if transaction.userId != current_user.id and current_user.role not in ["ADMIN"]:
            raise HTTPException(status_code=403, detail="Not authorized")

        existing_refund = await prisma.transaction.find_first(
            where={"parentTransactionId": transaction_id, "purpose": "REFUND"}
        )

        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        user_refunds_this_month = await prisma.transaction.count(
            where={
                "userId": transaction.userId,
                "purpose": "REFUND",
                "createdAt": {"gte": month_start},
            }
        )

        eligible, fail_reason = validate_refund_request(
            {
                "status": transaction.status,
                "created_at": transaction.createdAt,
                "purpose": transaction.purpose,
                "amount": transaction.amount,
                "id": transaction.id,
            },
            user_refunds_this_month=user_refunds_this_month,
            existing_refund=existing_refund,
        )

        metadata = transaction.metadata or {}
        metadata_dict = metadata if isinstance(metadata, dict) else {}

        pro_rata_amount, calc_method = calculate_pro_rata_refund(
            original_amount=transaction.amount,
            transaction_created_at=transaction.createdAt,
            purpose=transaction.purpose,
            metadata=metadata_dict,
            course_progress=(
                float(metadata_dict["course_progress"])
                if isinstance(metadata_dict.get("course_progress"), (int, float))
                else None
            ),
            subscription_period_days=(
                int(metadata_dict["billing_period_days"])
                if metadata_dict.get("billing_period_days")
                else None
            ),
            usage_started_at=(
                datetime.fromisoformat(
                    metadata_dict["enrolled_at"].replace("Z", "+00:00")
                )
                if isinstance(metadata_dict.get("enrolled_at"), str)
                else None
            ),
        )

        return {
            "eligible": eligible,
            "reason": fail_reason,
            "pro_rata_max_amount": pro_rata_amount,
            "pro_rata_method": calc_method,
            "original_amount": transaction.amount,
            "currency": transaction.currency,
            "purpose": transaction.purpose,
            "has_existing_refund": existing_refund is not None,
            "existing_refund_status": existing_refund.status
            if existing_refund
            else None,
            "refunds_this_month": user_refunds_this_month,
            "max_refunds_per_month": DEFAULT_REFUND_POLICY.max_refund_requests_per_month,
            "window_days": _get_refund_window_days(
                transaction.purpose, DEFAULT_REFUND_POLICY
            ),
            "created_at": transaction.createdAt.isoformat()
            if transaction.createdAt
            else None,
            "time_remaining_days": max(
                0,
                (
                    _get_refund_window_days(transaction.purpose, DEFAULT_REFUND_POLICY)
                    - (now - transaction.createdAt).days
                ),
            ),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get refund info: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get refund info")


@router.post("/{transaction_id}/cancel")
async def cancel_payment(
    transaction_id: int, current_user=Depends(get_current_active_user)
):
    """Cancel a pending payment"""
    try:
        transaction = await prisma.transaction.find_unique(
            where={"id": transaction_id}, include={"user": True}
        )

        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found"
            )

        # Check authorization
        if transaction.userId != current_user.id and current_user.role not in ["ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel this payment",
            )

        if transaction.status != PaymentStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel payment in status: {transaction.status}",
            )

        # If Chargily checkout exists and is still pending, expire it
        if (
            transaction.gateway == PaymentGateway.CHARGILY.value
            and transaction.providerReference
        ):
            try:
                await chargily_client.expire_checkout(transaction.providerReference)
                logger.info(
                    f"Expired Chargily checkout {transaction.providerReference}"
                )
            except ChargilyError as ce:
                logger.warning(
                    f"Failed to expire Chargily checkout "
                    f"{transaction.providerReference}: {ce}"
                )

        # Update status
        await prisma.transaction.update(
            where={"id": transaction_id},
            data={
                "status": PaymentStatus.CANCELLED.value,
                "updatedAt": datetime.now(timezone.utc),
            },
        )

        return {"status": "cancelled", "transaction_id": transaction_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel payment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel payment",
        )


@router.post("/cancel-all-pending")
async def cancel_all_pending_payments(current_user=Depends(get_current_active_user)):
    """Cancel all pending DEPOSIT transactions for the current user.
    Used when the user returns after a failed/cancelled payment to clean up
    stale pending transactions that may have accumulated."""
    try:
        pending_txs = await prisma.transaction.find_many(
            where={
                "userId": current_user.id,
                "status": PaymentStatus.PENDING.value,
                "purpose": "DEPOSIT",
            }
        )

        cancelled_ids = []
        for tx in pending_txs:
            if tx.providerReference:
                try:
                    await chargily_client.expire_checkout(tx.providerReference)
                except ChargilyError:
                    pass

            await prisma.transaction.update(
                where={"id": tx.id},
                data={
                    "status": PaymentStatus.CANCELLED.value,
                    "updatedAt": datetime.now(timezone.utc),
                },
            )
            cancelled_ids.append(tx.id)

        return {
            "status": "completed",
            "cancelled_count": len(cancelled_ids),
            "cancelled_ids": cancelled_ids,
        }

    except Exception as e:
        logger.error(f"Failed to cancel pending payments: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel pending payments",
        )


@router.post("/{transaction_id}/refund")
async def request_refund(
    transaction_id: int,
    reason: str = Query(..., min_length=10, max_length=2000),
    current_user=Depends(get_current_active_user),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    amount: Optional[int] = None,  # Optional partial refund amount in cents
):
    """Request refund for a completed payment. Optional amount for partial/pro-rata refunds."""
    try:
        # Resolve idempotency key — auto-generate if not provided
        resolved_key = (
            idempotency_key
            or f"{transaction_id}-{int(datetime.now(timezone.utc).timestamp())}"
        )

        # Check if a refund with this idempotency key was already processed
        existing_by_key = await prisma.transaction.find_first(
            where={
                "parentTransactionId": transaction_id,
                "purpose": "REFUND",
                "metadata": {"path": ["idempotency_key"], "equals": resolved_key},
            }
        )
        if existing_by_key:
            logger.info(
                f"Idempotent refund request: key={resolved_key}, "
                f"existing refund_id={existing_by_key.id}"
            )
            return {
                "status": "refund_already_requested",
                "refund_id": existing_by_key.id,
                "original_transaction_id": transaction_id,
            }

        transaction = await prisma.transaction.find_unique(
            where={"id": transaction_id}, include={"user": True, "contract": True}
        )

        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found"
            )

        # Check authorization
        if transaction.userId != current_user.id and current_user.role not in ["ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to refund this payment",
            )

        # Check if refund already exists
        existing_refund = await prisma.transaction.find_first(
            where={"parentTransactionId": transaction_id, "purpose": "REFUND"}
        )

        # Count user's refund requests this calendar month
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        user_refunds_this_month = await prisma.transaction.count(
            where={
                "userId": transaction.userId,
                "purpose": "REFUND",
                "createdAt": {"gte": month_start},
            }
        )

        # Check refund eligibility via policy (includes both transaction-level
        # checks and per-user monthly limit)
        eligible, fail_reason = validate_refund_request(
            {
                "status": transaction.status,
                "created_at": transaction.createdAt,
                "purpose": transaction.purpose,
                "amount": transaction.amount,
                "id": transaction.id,
            },
            user_refunds_this_month=user_refunds_this_month,
            existing_refund=existing_refund,
        )
        if not eligible:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=fail_reason,
            )

        # Calculate pro-rata maximum refund amount
        # Get usage data for pro-rata calculation
        usage_started_at = None
        course_progress = None
        subscription_period_days = None
        session_count = None
        total_sessions = None

        # Check metadata for usage info
        metadata = transaction.metadata or {}
        if isinstance(metadata, dict):
            # Course enrollment date
            if "enrolled_at" in metadata:
                try:
                    usage_started_at = datetime.fromisoformat(
                        metadata["enrolled_at"].replace("Z", "+00:00")
                    )
                except Exception:
                    pass
            # Course progress
            if "course_progress" in metadata:
                try:
                    course_progress = float(metadata["course_progress"])
                except Exception:
                    pass
            # Subscription period
            if "billing_period_days" in metadata:
                try:
                    subscription_period_days = int(metadata["billing_period_days"])
                except Exception:
                    pass
            # Live session data
            if "sessions_attended" in metadata and "total_sessions" in metadata:
                try:
                    session_count = int(metadata["sessions_attended"])
                    total_sessions = int(metadata["total_sessions"])
                except Exception:
                    pass

        pro_rata_amount, calc_method = calculate_pro_rata_refund(
            original_amount=transaction.amount,
            transaction_created_at=transaction.createdAt,
            usage_started_at=usage_started_at,
            course_progress=course_progress,
            subscription_period_days=subscription_period_days,
            session_count=session_count,
            total_sessions=total_sessions,
            now=now,
        )

        # Validate requested amount against pro-rata maximum
        refund_amount = amount if amount is not None else transaction.amount
        if amount is not None:
            # Partial refund requested - validate against pro-rata max
            valid, error = validate_partial_refund_amount(
                requested_amount=amount,
                original_amount=transaction.amount,
                pro_rata_amount=pro_rata_amount,
            )
            if not valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error,
                )
        else:
            # Full refund requested - cap at pro-rata if partial refunds are enforced
            refund_amount = min(refund_amount, pro_rata_amount)

        # Ensure minimum refund amount
        from app.config.refund_policy import DEFAULT_REFUND_POLICY

        if refund_amount < DEFAULT_REFUND_POLICY.min_refund_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Refund amount below minimum ({DEFAULT_REFUND_POLICY.min_refund_amount} cents).",
            )

        metadata = {
            "refund_reason": reason,
            "original_transaction_id": transaction_id,
            "requested_by": current_user.id,
            "requested_at": datetime.now(timezone.utc).isoformat(),
            "idempotency_key": resolved_key,
            "pro_rata_max_amount": pro_rata_amount,
            "pro_rata_method": calc_method,
            "is_partial": amount is not None,
        }

        # Create refund request
        refund_tx = await prisma.transaction.create(
            data={
                "parentTransactionId": transaction_id,
                "userId": transaction.userId,
                "organizationId": transaction.organizationId,
                "contractId": transaction.contractId,
                "amount": refund_amount,
                "currency": transaction.currency,
                "purpose": "REFUND",
                "status": PaymentStatus.PENDING.value,
                "provider": transaction.provider,
                "metadata": serialize_json_field(metadata),
            }
        )

        # Dispatch background task to process the refund
        # (credits wallet, marks transactions, sends confirmation email)
        process_refund.delay(refund_tx.id)

        return {
            "status": "refund_requested",
            "refund_id": refund_tx.id,
            "original_transaction_id": transaction_id,
            "refund_amount": refund_amount,
            "pro_rata_max_amount": pro_rata_amount,
            "is_partial": amount is not None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to request refund: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to request refund",
        )


@router.get("/success")
async def payment_success(
    transaction_id: Optional[int] = None, checkout_id: Optional[str] = None
):
    """Payment success callback - redirect to frontend"""
    # Redirect to frontend success page with parameters
    redirect_url = f"{setting.FRONTEND_URL}/payment/success"

    params = []
    if transaction_id:
        params.append(f"transaction_id={transaction_id}")
    if checkout_id:
        params.append(f"checkout_id={checkout_id}")

    if params:
        redirect_url += "?" + "&".join(params)

    return RedirectResponse(url=redirect_url)


@router.get("/failure")
async def payment_failure(
    transaction_id: Optional[int] = None,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
):
    """Payment failure callback - redirect to frontend"""
    # Redirect to frontend failure page with parameters
    redirect_url = f"{setting.FRONTEND_URL}/payment/failure"

    params = []
    if transaction_id:
        params.append(f"transaction_id={transaction_id}")
    if error_code:
        params.append(f"error_code={error_code}")
    if error_message:
        params.append(f"error_message={error_message}")

    if params:
        redirect_url += "?" + "&".join(params)

    return RedirectResponse(url=redirect_url)


@router.get("/checkout/{checkout_id}/status")
async def checkout_status(
    checkout_id: str,
    current_user=Depends(get_current_active_user),
):
    """
    Get checkout status by gateway reference.
    If the transaction is COMPLETED but enrollment is missing,
    triggers enrollment recovery as a fallback for missed webhooks.
    """
    try:
        transaction = await prisma.transaction.find_first(
            where={"providerReference": checkout_id}
        )

        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Checkout not found"
            )

        # 🔒 SECURITY: Verify the transaction belongs to the current user
        # or their organization. Prevents enumeration of other users'
        # transactions and unauthorized enrollment recovery triggering.
        if transaction.userId != current_user.id:
            if transaction.organizationId:
                membership = await prisma.organizationmember.find_first(
                    where={
                        "organizationId": transaction.organizationId,
                        "userId": current_user.id,
                    }
                )
                if not membership and current_user.role not in ["ADMIN"]:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to view this checkout",
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this checkout",
                )

        enrolled = False
        recovery_triggered = False

        # If transaction is completed, check if enrollment exists
        if transaction.status == "COMPLETED" and transaction.userId:
            metadata = transaction.metadata or {}
            course_id = (
                metadata.get("course_id") if isinstance(metadata, dict) else None
            )
            path_id = metadata.get("path_id") if isinstance(metadata, dict) else None

            if course_id:
                existing = await prisma.enrollment.find_first(
                    where={"userId": transaction.userId, "moduleId": course_id}
                )
                enrolled = existing is not None

                # Recovery: webhook was missed, trigger enrollment now
                if not enrolled:
                    try:
                        from app.services.billing_services.education_service import (
                            education_billing_service,
                        )

                        await education_billing_service.grant_entitlements(
                            transaction.id
                        )
                        enrolled = True
                        recovery_triggered = True
                        logger.info(
                            f"Recovery: enrolled user {transaction.userId} for course {course_id} via checkout status poll"
                        )
                    except Exception as re:
                        logger.error(
                            f"Recovery enrollment failed for tx {transaction.id}: {re}"
                        )

            elif path_id:
                existing = await prisma.enrollment.find_first(
                    where={"userId": transaction.userId, "pathId": path_id}
                )
                enrolled = existing is not None

                if not enrolled:
                    try:
                        from app.services.billing_services.education_service import (
                            education_billing_service,
                        )

                        await education_billing_service.grant_entitlements(
                            transaction.id
                        )
                        enrolled = True
                        recovery_triggered = True
                        logger.info(
                            f"Recovery: enrolled user {transaction.userId} for path {path_id} via checkout status poll"
                        )
                    except Exception as re:
                        logger.error(
                            f"Recovery enrollment failed for tx {transaction.id}: {re}"
                        )

        return {
            "checkout_id": checkout_id,
            "transaction_id": transaction.id,
            "status": transaction.status,
            "amount": transaction.amount,
            "currency": transaction.currency,
            "created_at": transaction.createdAt,
            "enrolled": enrolled,
            "recovery_triggered": recovery_triggered,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get checkout status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get checkout status",
        )


# Admin endpoints
@router.get(
    "/admin/transactions",
    response_model=List[TransactionResponse],
    response_model_by_alias=True,
)
async def admin_get_transactions(
    user_id: Optional[int] = None,
    organization_id: Optional[int] = None,
    purpose: Optional[str] = None,
    transaction_status: Optional[PaymentStatus] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0,
    current_user=Depends(get_current_active_user),
):
    """Admin: Get all transactions (requires admin role)"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    try:
        where_clause = {}

        if user_id:
            where_clause["userId"] = user_id

        if organization_id:
            where_clause["organizationId"] = organization_id

        if purpose:
            where_clause["purpose"] = purpose

        if transaction_status:
            where_clause["status"] = transaction_status.value

        if start_date or end_date:
            where_clause["createdAt"] = {}
            if start_date:
                where_clause["createdAt"]["gte"] = start_date
            if end_date:
                where_clause["createdAt"]["lte"] = end_date

        transactions = await prisma.transaction.find_many(
            where=where_clause,
            include={"user": True, "organization": True, "wallet": True},
            order={"createdAt": "desc"},
            take=limit,
            skip=offset,
        )

        return [TransactionResponse.from_orm(tx) for tx in transactions]

    except Exception as e:
        logger.error(f"Admin failed to get transactions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get transactions",
        )


@router.get("/admin/stats")
async def admin_payment_stats(
    period: str = "month",  # day, week, month, year
    current_user=Depends(get_current_active_user),
):
    """Admin: Get payment statistics"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    try:
        from datetime import datetime, timedelta

        # Calculate date range
        now = datetime.now(timezone.utc)
        if period == "day":
            start_date = now - timedelta(days=1)
        elif period == "week":
            start_date = now - timedelta(days=7)
        elif period == "month":
            start_date = now - timedelta(days=30)
        elif period == "year":
            start_date = now - timedelta(days=365)
        else:
            start_date = now - timedelta(days=30)

        # Get transaction counts and amounts
        transactions = await prisma.transaction.find_many(
            where={"createdAt": {"gte": start_date}}
        )

        # Calculate statistics
        total_transactions = len(transactions)
        total_amount = sum(tx.amount for tx in transactions)
        completed_amount = sum(
            tx.amount for tx in transactions if tx.status == "COMPLETED"
        )

        # Count by status
        status_counts = {}
        for tx in transactions:
            status_counts[tx.status] = status_counts.get(tx.status, 0) + 1

        # Count by purpose
        purpose_counts = {}
        for tx in transactions:
            purpose_counts[tx.purpose] = purpose_counts.get(tx.purpose, 0) + 1

        # Count by gateway
        gateway_counts = {}
        for tx in transactions:
            gateway_counts[tx.gateway] = gateway_counts.get(tx.gateway, 0) + 1

        return {
            "period": period,
            "start_date": start_date.isoformat(),
            "end_date": now.isoformat(),
            "total_transactions": total_transactions,
            "total_amount": total_amount,
            "completed_amount": completed_amount,
            "status_counts": status_counts,
            "purpose_counts": purpose_counts,
            "gateway_counts": gateway_counts,
            "average_transaction": total_amount / total_transactions
            if total_transactions > 0
            else 0,
        }

    except Exception as e:
        logger.error(f"Admin failed to get stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payment statistics",
        )


@router.post("/admin/complete/{transaction_id}")
async def admin_complete_transaction(
    transaction_id: int, current_user=Depends(get_current_active_user)
):
    """Admin: Manually complete a transaction (for testing)"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    # 🔒 Block mock completions in production
    if setting.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manual transaction completion is not available in production",
        )

    try:
        # Get transaction
        transaction = await prisma.transaction.find_unique(
            where={"id": transaction_id}, include={"wallet": True}
        )

        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found"
            )

        if transaction.status == "COMPLETED":
            return {
                "message": "Transaction already completed",
                "transaction_id": transaction_id,
            }

        # Start transaction
        async with prisma.tx() as tx:
            # Update transaction status
            await tx.transaction.update(
                where={"id": transaction_id},
                data={"status": "COMPLETED", "updatedAt": datetime.now(timezone.utc)},
            )

            # If this is a deposit, credit the wallet
            if transaction.purpose == "DEPOSIT" and transaction.userId:
                # Get or create user's wallet
                from app.services.wallet_service import wallet_service
                from app.schemas.payment import PaymentPurpose

                wallet = await wallet_service.ensure_user_wallet(transaction.userId)

                # Convert string purpose to PaymentPurpose enum
                purpose_enum = PaymentPurpose(transaction.purpose)

                # Credit wallet
                await wallet_service.credit_wallet(
                    wallet_id=wallet.id,
                    amount=transaction.amount,
                    purpose=purpose_enum,  # Use the enum, not string
                    reference_id=str(transaction.id),
                    description="Admin manual completion",
                )

            # If this is an education purchase, grant entitlements
            elif (
                transaction.purpose in ["COURSE_PURCHASE", "PATH_PURCHASE"]
                and transaction.userId
            ):
                from app.services.billing_services.education_service import (
                    education_billing_service,
                )

                await education_billing_service.grant_entitlements(transaction.id)

        return {
            "success": True,
            "transaction_id": transaction_id,
            "message": "Transaction marked as completed",
            "wallet_credited": transaction.purpose == "DEPOSIT"
            and transaction.userId is not None,
        }

    except Exception as e:
        logger.error(f"Failed to complete transaction: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete transaction",
        )


@router.get("/admin/refunds")
async def admin_list_refunds(
    refund_status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user=Depends(get_current_active_user),
):
    """Admin: List all refund transactions with their original transactions."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    where_clause = {"purpose": "REFUND"}
    if refund_status:
        where_clause["status"] = refund_status

    refunds = await prisma.transaction.find_many(
        where=where_clause,
        include={"user": True, "parentTransaction": True},
        order={"createdAt": "desc"},
        take=limit,
        skip=offset,
    )
    total = await prisma.transaction.count(where=where_clause)

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "refunds": [
            {
                "id": r.id,
                "amount": r.amount,
                "currency": r.currency,
                "status": r.status,
                "reason": (r.metadata or {}).get("refund_reason")
                if isinstance(r.metadata, dict)
                else None,
                "created_at": r.createdAt,
                "user": {
                    "id": r.user.id,
                    "name": r.user.fullName,
                    "email": r.user.email,
                }
                if r.user
                else None,
                "original_transaction": {
                    "id": r.parentTransaction.id,
                    "amount": r.parentTransaction.amount,
                    "purpose": r.parentTransaction.purpose,
                    "status": r.parentTransaction.status,
                    "created_at": r.parentTransaction.createdAt,
                }
                if r.parentTransaction
                else None,
            }
            for r in refunds
        ],
    }


@router.post("/admin/refunds/{refund_id}/approve")
async def admin_approve_refund(
    refund_id: int,
    current_user=Depends(get_current_active_user),
):
    """Admin: Approve a pending refund and dispatch the Celery task."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    try:
        refund_tx = await prisma.transaction.find_unique(where={"id": refund_id})
        if not refund_tx:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Refund not found"
            )
        if refund_tx.purpose != "REFUND":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Not a refund transaction",
            )
        if refund_tx.status != "PENDING":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Refund is not pending (status={refund_tx.status})",
            )

        process_refund.delay(refund_tx.id)

        return {
            "success": True,
            "refund_id": refund_id,
            "message": "Refund approved and dispatched for processing",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to approve refund {refund_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to approve refund",
        )


@router.post("/admin/refunds/{refund_id}/reject")
async def admin_reject_refund(
    refund_id: int,
    reason: str = "Rejected by admin",
    current_user=Depends(get_current_active_user),
):
    """Admin: Reject a pending refund request."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    try:
        refund_tx = await prisma.transaction.find_unique(where={"id": refund_id})
        if not refund_tx:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Refund not found"
            )
        if refund_tx.purpose != "REFUND":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Not a refund transaction",
            )
        if refund_tx.status != "PENDING":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Refund is not pending (status={refund_tx.status})",
            )

        await prisma.transaction.update(
            where={"id": refund_id},
            data={
                "status": "CANCELLED",
                "updatedAt": datetime.now(timezone.utc),
                "metadata": Json(
                    {
                        **(refund_tx.metadata or {}),
                        "rejection_reason": reason,
                        "rejected_by": current_user.id,
                        "rejected_at": datetime.now(timezone.utc).isoformat(),
                    }
                ),
            },
        )

        return {
            "success": True,
            "refund_id": refund_id,
            "message": "Refund rejected",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reject refund {refund_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reject refund",
        )
