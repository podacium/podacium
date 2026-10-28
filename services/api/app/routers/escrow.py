"""
TamWheel Sovereign Ethical Agentic Venture OS — Smart Escrow Vault Router.
Exposes endpoints for:
1. Creating milestone smart escrow vaults (`POST /escrow/vaults`)
2. Fetching escrow vault status and tranches (`GET /escrow/vaults/{vault_id}`)
3. Submitting founder milestone proof (Key 1) (`POST /escrow/vaults/{vault_id}/tranches/{tranche_id}/proof`)
4. Submitting independent auditor review (Key 2) (`POST /escrow/vaults/{vault_id}/tranches/{tranche_id}/audit`)
5. Platform referee sign-off & tranche release (Key 3) (`POST /escrow/vaults/{vault_id}/tranches/{tranche_id}/release`)
6. Triggering automated pro-rata refund upon breach/dispute (`POST /escrow/vaults/{vault_id}/tranches/{tranche_id}/refund`)
"""

from __future__ import annotations

import logging
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user_optional
from app.services.smart_escrow_vault import (
    smart_escrow_engine,
    EscrowVault,
    EscrowTranche,
    CreateVaultRequest,
    SubmitProofRequest,
    AuditorReviewRequest,
    RefereeReleaseRequest,
    RefundTriggerRequest,
    ProRataRefundReceipt,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/escrow", tags=["Smart Escrow Vaults & Multi-Key Release"])


@router.post(
    "/vaults",
    response_model=EscrowVault,
    status_code=status.HTTP_201_CREATED,
    summary="Create milestone-gated smart escrow vault",
    description="Initializes multi-key escrow vault with milestone tranches and investor pledge distributions.",
)
async def create_escrow_vault(
    req: CreateVaultRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> EscrowVault:
    try:
        return smart_escrow_engine.create_vault(req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating escrow vault: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/vaults",
    response_model=List[EscrowVault],
    summary="List all smart escrow vaults",
    description="Retrieve all active and completed smart escrow vaults.",
)
async def list_escrow_vaults(
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> List[EscrowVault]:
    return smart_escrow_engine.list_vaults()


@router.get(
    "/vaults/{vault_id}",
    response_model=EscrowVault,
    summary="Get single escrow vault details",
    description="Inspect vault balance, investor shares, and milestone tranche verification states.",
)
async def get_escrow_vault(
    vault_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> EscrowVault:
    vault = smart_escrow_engine.get_vault(vault_id)
    if not vault:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Escrow vault '{vault_id}' not found.")
    return vault


@router.post(
    "/vaults/{vault_id}/tranches/{tranche_id}/proof",
    response_model=EscrowTranche,
    summary="Submit founder milestone proof (Key 1)",
    description="Founder submits deliverable description and cryptographic hash/link to transition tranche to SUBMITTED.",
)
async def submit_tranche_proof(
    vault_id: str,
    tranche_id: str,
    req: SubmitProofRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> EscrowTranche:
    try:
        return smart_escrow_engine.submit_founder_proof(vault_id, tranche_id, req)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/vaults/{vault_id}/tranches/{tranche_id}/audit",
    response_model=EscrowTranche,
    summary="Submit independent auditor review (Key 2)",
    description="Auditor verifies proof against acceptance criteria. Approval (score >= 70) transitions to AUDITED.",
)
async def audit_tranche_deliverable(
    vault_id: str,
    tranche_id: str,
    req: AuditorReviewRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> EscrowTranche:
    try:
        return smart_escrow_engine.verify_auditor(vault_id, tranche_id, req)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/vaults/{vault_id}/tranches/{tranche_id}/release",
    response_model=EscrowTranche,
    summary="Platform referee sign-off & funds release (Key 3)",
    description="Platform referee provides final compliance sign-off, mints multi-key cryptographic seal, and unlocks tranche funds.",
)
async def release_tranche_funds(
    vault_id: str,
    tranche_id: str,
    req: RefereeReleaseRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> EscrowTranche:
    try:
        return smart_escrow_engine.release_by_referee(vault_id, tranche_id, req)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/vaults/{vault_id}/tranches/{tranche_id}/refund",
    response_model=ProRataRefundReceipt,
    summary="Trigger automated pro-rata investor refund",
    description="Executed upon milestone failure, dispute deadlock, or campaign breach. Distributes locked capital pro-rata to investors.",
)
async def refund_tranche_pro_rata(
    vault_id: str,
    tranche_id: str,
    req: RefundTriggerRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> ProRataRefundReceipt:
    try:
        return smart_escrow_engine.trigger_pro_rata_refund(vault_id, tranche_id, req)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
