"""
TamWheel Sovereign Ethical Agentic Venture OS — Merkle-CRDT Offline State Channels Router.
Pillar 2 / Section 22: Offline-First Mobile Financial Synchronization for Low-Connectivity Wilayas
(Adrar, Tindouf, Tamanrasset, In Salah, Illizi, etc.).

Endpoints:
1. `POST /offline/voucher`: Generate an Ed25519-signed offline investment voucher.
2. `POST /offline/merkle-root`: Calculate binary Merkle root hash for a batch of vouchers.
3. `POST /offline/merkle-proof`: Generate Merkle inclusion proof for a voucher within a batch.
4. `POST /offline/reconcile`: Reconcile and settle offline vouchers onto the double-entry ledger.
5. `GET /offline/status`: Retrieve user's offline state channel sync status and sequence nonces.
"""

import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.auth import get_current_active_user
from app.services.offline_crdt import (
    merkle_crdt_offline_engine,
    OfflineVoucher,
    MerkleProof,
    OfflineReconciliationResult,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/offline", tags=["Offline Merkle-CRDT State Channels"])


# =============================================================================
# REQUEST SCHEMAS
# =============================================================================

class VoucherCreateRequest(BaseModel):
    campaignId: str = Field(..., description="Target Campaign UUID")
    amountDzd: int = Field(..., ge=1000, description="Virtual commitment in DZD (Sim)")
    wilaya: Optional[int] = Field(16, ge=1, le=58, description="Origin Algerian Wilaya (1-58)")


class MerkleRootRequest(BaseModel):
    vouchers: List[OfflineVoucher] = Field(..., min_length=1, description="List of offline vouchers")


class MerkleProofRequest(BaseModel):
    vouchers: List[OfflineVoucher] = Field(..., min_length=1, description="List of offline vouchers")
    targetVoucherId: str = Field(..., description="Voucher ID to prove inclusion for")


class ReconcileBatchRequest(BaseModel):
    vouchers: List[OfflineVoucher] = Field(..., min_length=1, description="List of offline vouchers to reconcile")
    claimedMerkleRoot: Optional[str] = Field(None, description="Optional client-computed Merkle root for verification")


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post(
    "/voucher",
    response_model=OfflineVoucher,
    summary="Generate an Ed25519-signed offline investment voucher",
)
async def generate_offline_voucher(
    req: VoucherCreateRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Creates and cryptographically signs a local offline voucher for the user:
    - Binds user ID, target campaign, DZD simulation commitment, and origin Wilaya.
    - Increments strictly monotonic sequence nonce to prevent replay attacks.
    - Signs payload with Ed25519 high-speed elliptic curve cryptography.
    """
    return merkle_crdt_offline_engine.create_offline_voucher(
        user_id=current_user.id,
        campaign_id=req.campaignId,
        amount_dzd=req.amountDzd,
        wilaya=req.wilaya or 16,
    )


@router.post(
    "/merkle-root",
    summary="Calculate binary Merkle root hash for a batch of offline vouchers",
)
async def compute_merkle_root(
    req: MerkleRootRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Constructs a binary Merkle tree over the provided vouchers and returns the root digest.
    Enables O(1) state channel consistency verification between disconnected nodes.
    """
    tree = merkle_crdt_offline_engine.build_merkle_tree(req.vouchers)
    return {
        "merkleRoot": tree.root,
        "leafCount": len(req.vouchers),
        "treeDepth": len(tree.levels),
    }


@router.post(
    "/merkle-proof",
    response_model=MerkleProof,
    summary="Generate Merkle inclusion proof for a voucher",
)
async def get_merkle_proof(
    req: MerkleProofRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Generates an O(log N) Merkle audit path proving a voucher is contained in the batch.
    """
    return merkle_crdt_offline_engine.generate_merkle_proof(
        vouchers=req.vouchers,
        target_voucher_id=req.targetVoucherId,
    )


@router.post(
    "/reconcile",
    response_model=OfflineReconciliationResult,
    summary="Reconcile and settle offline vouchers onto the sovereign ledger",
)
async def reconcile_offline_batch(
    req: ReconcileBatchRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Reconciles an offline batch of vouchers when mobile connectivity is restored:
    1. Cryptographic Merkle Root Verification
    2. Ed25519 Digital Signature Verification
    3. Monotonic Nonce & Replay Attack Prevention
    4. Overdraft & Balance Validation
    5. Atomic Journal Entry Settlement onto Double-Entry Simulation Ledger
    """
    return merkle_crdt_offline_engine.reconcile_offline_batch(
        user_id=current_user.id,
        vouchers=req.vouchers,
        claimed_merkle_root=req.claimedMerkleRoot,
    )


@router.get(
    "/status",
    summary="Get user offline state channel sync status",
)
async def get_offline_channel_status(
    current_user: Any = Depends(get_current_active_user),
):
    """
    Returns the user's latest settled sequence nonce, count of processed offline vouchers,
    and available virtual cash balance for offline allocation.
    """
    return merkle_crdt_offline_engine.get_sync_status(current_user.id)
