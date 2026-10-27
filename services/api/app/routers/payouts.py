import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone

from app.core.auth import get_current_active_user
from app.schemas.payment import PayoutRequest, PayoutResponse, PaymentProvider
from app.services.payout_service import payout_service
from app.core.prisma import prisma
from app.generated.prisma import Json

router = APIRouter(prefix="/payouts", tags=["payouts"])
logger = logging.getLogger(__name__)


@router.post("/request", response_model=PayoutResponse)
async def request_payout(
    request: PayoutRequest, current_user=Depends(get_current_active_user)
):
    """Request a payout from wallet"""
    try:
        # Verify wallet belongs to user
        wallet = await prisma.wallet.find_unique(
            where={"id": request.wallet_id},
            include={"user": True, "organization": True},
        )

        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found"
            )

        # Check authorization
        if (
            wallet.userId
            and wallet.userId != current_user.id
            and current_user.role not in ["ADMIN"]
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to request payout from this wallet",
            )

        if wallet.organizationId:
            # Check organization membership with appropriate role
            membership = await prisma.organizationmember.find_first(
                where={
                    "organizationId": wallet.organizationId,
                    "userId": current_user.id,
                    "role": {"in": ["OWNER", "ADMIN", "FINANCE"]},
                }
            )
            if not membership and current_user.role not in ["ADMIN"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to request payout from organization wallet",
                )

        # Request payout
        payout = await payout_service.request_payout(request)

        return payout

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to request payout: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to request payout",
        )


@router.get("/me", response_model=List[PayoutResponse])
async def get_my_payouts(
    limit: int = 50, offset: int = 0, current_user=Depends(get_current_active_user)
):
    """Get current user's payout history"""
    try:
        payouts = await payout_service.get_user_payouts(current_user.id, limit, offset)

        return payouts

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get user payouts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payouts",
        )


@router.get("/wallet/{wallet_id}", response_model=List[PayoutResponse])
async def get_wallet_payouts(
    wallet_id: int,
    limit: int = 50,
    offset: int = 0,
    current_user=Depends(get_current_active_user),
):
    """Get payout history for specific wallet"""
    try:
        wallet = await prisma.wallet.find_unique(where={"id": wallet_id})

        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found"
            )

        # Check authorization
        if (
            wallet.userId
            and wallet.userId != current_user.id
            and current_user.role not in ["ADMIN"]
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view payouts for this wallet",
            )

        if wallet.organizationId:
            membership = await prisma.organizationmember.find_first(
                where={
                    "organizationId": wallet.organizationId,
                    "userId": current_user.id,
                }
            )
            if not membership and current_user.role not in ["ADMIN"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view payouts for this wallet",
                )

        payouts = await payout_service.get_wallet_payouts(wallet_id, limit, offset)

        return payouts

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get wallet payouts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payouts",
        )


@router.get("/organization/{org_id}", response_model=List[PayoutResponse])
async def get_organization_payouts(
    org_id: int,
    limit: int = 50,
    offset: int = 0,
    current_user=Depends(get_current_active_user),
):
    """Get organization payout history"""
    try:
        # Check organization membership or admin access
        membership = await prisma.organizationmember.find_first(
            where={"organizationId": org_id, "userId": current_user.id}
        )

        if not membership and current_user.role not in ["ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view organization payouts",
            )

        payouts = await payout_service.get_organization_payouts(org_id, limit, offset)

        return payouts

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get organization payouts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payouts",
        )


@router.get("/{payout_id}", response_model=PayoutResponse)
async def get_payout(payout_id: int, current_user=Depends(get_current_active_user)):
    """Get payout by ID"""
    try:
        payout = await payout_service.get_payout(payout_id)

        if not payout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Payout not found"
            )

        # Get wallet to check authorization
        wallet = await prisma.wallet.find_unique(
            where={"id": payout.wallet_id}, include={"user": True, "organization": True}
        )

        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found"
            )

        # Check authorization
        if (
            wallet.userId
            and wallet.userId != current_user.id
            and current_user.role not in ["ADMIN"]
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this payout",
            )

        if wallet.organizationId:
            membership = await prisma.organizationmember.find_first(
                where={
                    "organizationId": wallet.organizationId,
                    "userId": current_user.id,
                }
            )
            if not membership and current_user.role not in ["ADMIN"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this payout",
                )

        return payout

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get payout: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payout",
        )


@router.get("/stats/me")
async def get_my_payout_stats(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user=Depends(get_current_active_user),
):
    """Get payout statistics for current user"""
    try:
        # Get user's wallets
        wallets = await prisma.wallet.find_many(where={"userId": current_user.id})
        wallet_ids = [wallet.id for wallet in wallets]

        if not wallet_ids:
            return {"total_payouts": 0, "total_amount": 0, "total_fees": 0}

        # Get stats for each wallet and combine
        all_stats = []
        for wallet_id in wallet_ids:
            stats = await payout_service.get_payout_stats(
                wallet_id, start_date, end_date
            )
            all_stats.append(stats)

        # Combine stats
        total_payouts = sum(s["total_payouts"] for s in all_stats)
        total_amount = sum(s["total_amount"] for s in all_stats)
        total_fees = sum(s["total_fees"] for s in all_stats)

        return {
            "user_id": current_user.id,
            "total_payouts": total_payouts,
            "total_amount": total_amount,
            "total_fees": total_fees,
            "net_amount": total_amount - total_fees,
            "period": {
                "start": start_date.isoformat() if start_date else None,
                "end": end_date.isoformat() if end_date else None,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get payout stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payout statistics",
        )


# Admin endpoints
@router.get("/admin/all", response_model=List[PayoutResponse])
async def admin_get_all_payouts(
    wallet_id: Optional[int] = None,
    status: Optional[str] = None,
    method: Optional[PaymentProvider] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0,
    current_user=Depends(get_current_active_user),
):
    """Admin: Get all payouts (requires admin role)"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    try:
        where_clause = {}

        if wallet_id:
            where_clause["walletId"] = wallet_id

        if status:
            where_clause["status"] = status

        if method:
            where_clause["method"] = method.value

        if start_date or end_date:
            where_clause["requestedAt"] = {}
            if start_date:
                where_clause["requestedAt"]["gte"] = start_date
            if end_date:
                where_clause["requestedAt"]["lte"] = end_date

        payouts = await prisma.payout.find_many(
            where=where_clause,
            include={"wallet": {"include": {"user": True, "organization": True}}},
            order={"requestedAt": "desc"},
            take=limit,
            skip=offset,
        )

        return [PayoutResponse.from_orm(payout) for payout in payouts]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin failed to get payouts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payouts",
        )


@router.post("/admin/{payout_id}/process")
async def admin_process_payout(
    payout_id: int,
    processor_notes: Optional[str] = None,
    current_user=Depends(get_current_active_user),
):
    """Admin: Mark payout as processing"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    try:
        payout = await payout_service.process_payout(payout_id, processor_notes)

        # Log admin action
        await prisma.auditlog.create(
            data={
                "actorId": current_user.id,
                "eventType": "PAYOUT_PROCESSING_STARTED",
                "entityType": "Payout",
                "entityId": str(payout_id),
                "metadata": Json(
                    {"status": "PROCESSING", "processor_notes": processor_notes}
                ),
                "createdAt": datetime.now(timezone.utc),
            }
        )

        return {
            "success": True,
            "payout_id": payout_id,
            "status": payout.status,
            "processed_at": payout.processed_at,
            "message": "Payout marked as processing",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin failed to process payout: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process payout",
        )


@router.post("/admin/{payout_id}/complete")
async def admin_complete_payout(
    payout_id: int,
    external_reference: Optional[str] = None,
    current_user=Depends(get_current_active_user),
):
    """Admin: Mark payout as completed enforcing Maker-Checker dual control"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    try:
        from app.services.wallet_service import wallet_service

        payout = await wallet_service.approve_withdrawal(
            payout_id=payout_id,
            admin_id=current_user.id,
            admin_notes=external_reference,
        )

        # Log admin action in AuditTrailService
        from app.services.audit_trail_service import AuditTrailService

        await AuditTrailService.log_action(
            actor_id=current_user.id,
            action="PAYOUT_COMPLETED",
            domain="FINANCE",
            resource_type="Payout",
            resource_id=str(payout_id),
            metadata={
                "status": "COMPLETED",
                "external_reference": external_reference,
                "amount": payout.get("amount"),
            },
        )

        return {
            "success": True,
            "payout_id": payout_id,
            "status": payout.get("status", "COMPLETED"),
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "external_reference": external_reference,
            "message": "Payout marked as completed",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin failed to complete payout: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete payout",
        )


@router.post("/admin/{payout_id}/fail")
async def admin_fail_payout(
    payout_id: int, failure_reason: str, current_user=Depends(get_current_active_user)
):
    """Admin: Mark payout as failed"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    try:
        payout = await payout_service.fail_payout(payout_id, failure_reason)

        # Log admin action
        await prisma.auditlog.create(
            data={
                "actorId": current_user.id,
                "eventType": "PAYOUT_FAILED",
                "entityType": "Payout",
                "entityId": str(payout_id),
                "metadata": Json(
                    {"status": "FAILED", "failure_reason": failure_reason}
                ),
                "createdAt": datetime.now(timezone.utc),
            }
        )

        return {
            "success": True,
            "payout_id": payout_id,
            "status": payout.status,
            "failure_reason": failure_reason,
            "message": "Payout marked as failed",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin failed to mark payout as failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark payout as failed",
        )


@router.get("/admin/stats")
async def admin_payout_stats(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user=Depends(get_current_active_user),
):
    """Admin: Get overall payout statistics"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    try:
        stats = await payout_service.get_payout_stats(
            wallet_id=None, start_date=start_date, end_date=end_date
        )

        return stats

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin failed to get payout stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payout statistics",
        )


@router.post("/admin/process-pending")
async def admin_process_pending_payouts(current_user=Depends(get_current_active_user)):
    """Admin: Manually trigger pending payout processing"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    try:
        # Process pending payouts
        await payout_service.process_pending_payouts()

        return {"success": True, "message": "Pending payouts processing triggered"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin failed to process pending payouts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process pending payouts",
        )
