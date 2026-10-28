"""
TamWheel Sovereign Ethical Agentic Venture OS — Simulation League & Double-Entry Ledger Router.
Pillar 2: The Anti-PSP Simulation League & Zero-Fiat Sandbox Endpoints.

Implements:
1. `GET /simulation/wallet`: User virtual wallet, balance, active positions, portfolio value, and ROI%.
2. `POST /simulation/grant`: Claim or verify the mandatory 50,000 DZD virtual starter grant.
3. `POST /simulation/pledge`: Atomic pledge with idempotency key, min ticket (5,000 DZD), and SHA-256 state chain recording.
4. `GET /simulation/ledger`: User double-entry journal entries and debit/credit statement.
5. `GET /simulation/ledger/verify`: Cryptographic verification of the SHA-256 state chain from genesis to head.
6. `GET /simulation/leaderboard`: Dynamic ROI and portfolio valuation leaderboard.
7. `GET /simulation/regulatory-status`: Bank of Algeria Regulation 25-02 & COSOB Regulation 23-01 sandbox compliance disclosures.
"""

import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.auth import get_current_active_user, get_current_user_optional
from app.services.simulation_engine import (
    simulation_engine,
    simulation_ledger,
    INITIAL_SIMULATION_GRANT_DZD,
    DEFAULT_MIN_TICKET_DZD,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/simulation", tags=["Simulation League & Double-Entry Ledger"])


# =============================================================================
# REQUEST & RESPONSE SCHEMAS
# =============================================================================

class VirtualPledgeCommitRequest(BaseModel):
    campaignId: str = Field(..., description="Target Campaign UUID")
    amountDzd: int = Field(..., ge=DEFAULT_MIN_TICKET_DZD, description="Commitment amount in DZD (>= 5,000 DZD)")
    equitySharePct: Optional[float] = Field(None, ge=0.0, le=100.0, description="Implied nominee equity share %")
    idempotencyKey: Optional[str] = Field(None, description="Client-provided idempotency key for race prevention")


class VirtualPledgeCommitResponse(BaseModel):
    pledgeId: str
    campaignId: str
    userId: int
    amountDzd: int
    equitySharePct: Optional[float]
    journalEntryId: str
    entryHash: str
    availableBalanceDzd: int
    status: str = "COMMITTED"
    createdAt: str


class StarterGrantClaimResponse(BaseModel):
    userId: int
    amountDzd: int
    journalEntryId: str
    entryHash: str
    status: str
    message: str


class LedgerVerifyResponse(BaseModel):
    isValid: bool
    entriesChecked: int
    genesisHash: str
    headHash: str
    status: str
    auditedAt: Optional[str] = None
    reason: Optional[str] = None


class RegulatoryStatusResponse(BaseModel):
    legalStatus: str
    centralBankFramework: str
    securitiesFramework: str
    fiatConversionAllowed: bool
    custodyMode: str
    disclaimerEn: str
    disclaimerAr: str


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/wallet", summary="Get user simulation wallet and portfolio")
async def get_simulation_wallet(
    current_user: Any = Depends(get_current_active_user),
):
    """
    Retrieve user's simulation wallet balance, active pledges, calculated venture ROI,
    analyst badge, and double-entry ledger account statement.
    """
    return await simulation_engine.get_user_simulation_wallet(current_user.id)


@router.post(
    "/grant",
    response_model=StarterGrantClaimResponse,
    summary="Claim or verify 50,000 DZD virtual starter grant",
)
async def claim_starter_grant(
    current_user: Any = Depends(get_current_active_user),
):
    """
    Awards or verifies the mandatory 50,000 DZD virtual starter grant for the user.
    Recorded in the immutable double-entry ledger with a balanced debit/credit entry.
    """
    entry = await simulation_engine.grant_starter_balance(current_user.id)
    return StarterGrantClaimResponse(
        userId=current_user.id,
        amountDzd=INITIAL_SIMULATION_GRANT_DZD,
        journalEntryId=entry.entry_id,
        entryHash=entry.entry_hash,
        status="PROVISIONED",
        message="50,000 DZD virtual starter grant verified in simulation ledger.",
    )


@router.post(
    "/pledge",
    response_model=VirtualPledgeCommitResponse,
    summary="Execute atomic virtual pledge with idempotency",
)
async def execute_virtual_pledge(
    pledge_in: VirtualPledgeCommitRequest,
    current_user: Any = Depends(get_current_active_user),
):
    """
    Executes an atomic investment commitment in the TamWheel Simulation League.
    Governed by COSOB Regulation 23-01 CIP & Bank of Algeria Reg 25-02:
    - Minimum ticket verification (>= 5,000 DZD)
    - Double-entry ledger transfer (Debit Campaign Escrow / Credit User Cash)
    - Cryptographic SHA-256 state chain verification
    - Idempotency key tracking preventing race conditions and double-spending
    """
    pledge = await simulation_engine.execute_virtual_pledge(
        campaign_id=pledge_in.campaignId,
        user_id=current_user.id,
        amount_dzd=pledge_in.amountDzd,
        equity_share_pct=pledge_in.equitySharePct,
        idempotency_key=pledge_in.idempotencyKey,
    )

    remaining_bal = await simulation_engine.get_user_virtual_balance(current_user.id)

    # Fetch corresponding ledger entry
    entries = simulation_ledger.get_user_entries(current_user.id)
    last_entry = entries[-1] if entries else None

    return VirtualPledgeCommitResponse(
        pledgeId=getattr(pledge, "id", "pledge-sim"),
        campaignId=getattr(pledge, "campaignId", pledge_in.campaignId),
        userId=current_user.id,
        amountDzd=getattr(pledge, "amountDzd", pledge_in.amountDzd),
        equitySharePct=getattr(pledge, "equitySharePct", pledge_in.equitySharePct),
        journalEntryId=last_entry.entry_id if last_entry else "JE-PENDING",
        entryHash=last_entry.entry_hash if last_entry else "0" * 64,
        availableBalanceDzd=remaining_bal,
        status="COMMITTED",
        createdAt=last_entry.timestamp if last_entry else "N/A",
    )


@router.get("/ledger", summary="Get double-entry journal entries")
async def get_ledger_entries(
    limit: int = Query(50, ge=1, le=200),
    current_user: Any = Depends(get_current_active_user),
):
    """
    Retrieves immutable double-entry journal entries from the simulation ledger.
    Regular users see their own transactions; admins see system-wide entries.
    """
    is_admin = getattr(current_user, "role", None) in ("ADMIN", "SUPERADMIN")
    if is_admin:
        entries = simulation_ledger.get_all_entries(limit=limit)
    else:
        entries = simulation_ledger.get_user_entries(current_user.id)

    return {
        "userId": current_user.id,
        "entriesCount": len(entries),
        "entries": [getattr(e, "model_dump", e.dict)() for e in entries[-limit:]],
    }


@router.get(
    "/ledger/verify",
    response_model=LedgerVerifyResponse,
    summary="Verify cryptographic SHA-256 state chain",
)
async def verify_ledger_chain():
    """
    Performs full cryptographic audit of the virtual ledger from genesis to head.
    Verifies that hash links and zero-sum invariants are 100% untampered.
    """
    res = simulation_ledger.verify_state_chain()
    return LedgerVerifyResponse(**res)


@router.get("/leaderboard", summary="Get simulation league dynamic leaderboard")
async def get_simulation_leaderboard(
    limit: int = Query(50, ge=1, le=100),
    weekly: bool = Query(False, description="Filter for 7-day velocity"),
):
    """
    Returns dynamically ranked simulation managers based on venture portfolio value,
    realized ROI%, and analyst credentials (Novice, Scout, Analyst, Partner).
    """
    return await simulation_engine.get_leaderboard(limit=limit, weekly=weekly)


@router.get(
    "/regulatory-status",
    response_model=RegulatoryStatusResponse,
    summary="Zero-fiat regulatory compliance status",
)
async def get_regulatory_status():
    """
    Returns legal & regulatory sandbox disclosures under Bank of Algeria Regulation 25-02
    (Non-PSP Zero-Custody Sandbox) and COSOB Regulation 23-01 CIP Crowdfunding rules.
    """
    return RegulatoryStatusResponse(
        legalStatus="AUTHORIZED_REGULATORY_SANDBOX",
        centralBankFramework="Bank of Algeria Regulation 25-02 & Instruction 03-25",
        securitiesFramework="COSOB Regulation 23-01 (Conseiller en Investissement Participatif)",
        fiatConversionAllowed=False,
        custodyMode="ZERO_CUSTODY_VIRTUAL_SIMULATION",
        disclaimerEn=(
            "TamWheel Simulation League operates strictly as an educational and skill-based venture discovery "
            "platform. Virtual Dinars (DZD Sim) have zero fiat redeemability and cannot be converted into cash. "
            "Complies with Bank of Algeria Law 23-09 Articles 110-118 and Penal Code Articles 165-167."
        ),
        disclaimerAr=(
            "يعمل دوري تمويل الافتراضي كمنصة تعليمية لاكتشاف المؤسسات الناشئة قائمة على المهارة والتحليل المالي. "
            "الدينار الافتراضي مخصص للمحاكاة فقط ولا يمكن تحويله إلى أموال حقيقية، وفقاً لتعليمات بنك الجزائر وقانون العقوبات."
        ),
    )
