"""
TamWheel Cap Table & Corporate Law Router (Pillar 1).
Implements Law 22-09 SPAS equity management, Nominee portage blocks,
BSA-AIR warrant contracts, option pool expansion, and exit waterfalls.
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.auth import get_current_active_user
from app.services.cap_table import (
    CapTableEngine,
    SecondaryLiquidityEngine,
    DualEntityCapTableMirror,
    ESOPVestingEngine,
)
from app.schemas.cap_table import (
    ShareClassModel,
    ShareClassCreateRequest,
    StakeholderModel,
    StakeholderCreateRequest,
    ShareIssuanceModel,
    ShareIssuanceCreateRequest,
    ConvertibleInstrumentItem,
    CapTableSummaryResponse,
    CapTableSimulateRequest,
    CapTableSimulateResponse,
    WaterfallSimulateRequest,
    WaterfallSimulateResponse,
    NomineePoolRequest,
    NomineePoolResponse,
    NomineeAllocationResponse,
    BsaAirGenerateRequest,
    BsaAirContractResponse,
    LiquidityWindowCreateRequest,
    SellerOrderRequest,
    SellerOrderResult,
    LiquidityAuctionClearResponse,
    HoldCoMirrorSetupRequest,
    HoldCoShareIssuanceRequest,
    CrossBorderMirrorResponse,
    EsopGrantCreateRequest,
    EsopVestingStatusResponse,
    EsopExerciseRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Cap Table & Law 22-09 SPAS Engine"])


# =============================================================================
# 1. CAP TABLE SUMMARY & LEDGER
# =============================================================================

@router.get("/startups/{startup_id}/cap-table", response_model=CapTableSummaryResponse)
async def get_startup_cap_table(
    startup_id: str,
    current_user=Depends(get_current_active_user),
):
    """
    Retrieve comprehensive statutory cap table for an Algerian SPAS startup.
    Returns multi-class share inventory, stakeholder ledger with voting & fully-diluted ownership,
    option pools, and active BSA-AIR convertible warrants.
    """
    try:
        summary = CapTableEngine.get_cap_table_summary(startup_id)
        return summary
    except Exception as exc:
        logger.error("Error retrieving cap table for startup %s: %s", startup_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve cap table: {str(exc)}",
        )


# =============================================================================
# 2. SHARE CLASSES, STAKEHOLDERS & ISSUANCES
# =============================================================================

@router.post("/startups/{startup_id}/cap-table/share-classes", response_model=ShareClassModel, status_code=status.HTTP_201_CREATED)
async def create_share_class(
    startup_id: str,
    req: ShareClassCreateRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Register a new statutory share class (Actions Ordinaires, Actions de Préférence A/B, BSPCE)
    under Law 22-09 Articles 715 bis 133+.
    """
    try:
        new_class = CapTableEngine.add_share_class(startup_id, req)
        return new_class
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post("/startups/{startup_id}/cap-table/stakeholders", response_model=StakeholderModel, status_code=status.HTTP_201_CREATED)
async def create_stakeholder(
    startup_id: str,
    req: StakeholderCreateRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Register a new shareholder, investor, or nominee entity on the startup ledger.
    """
    try:
        stakeholder = CapTableEngine.add_stakeholder(startup_id, req)
        return stakeholder
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post("/startups/{startup_id}/cap-table/issuances", response_model=ShareIssuanceModel, status_code=status.HTTP_201_CREATED)
async def create_share_issuance(
    startup_id: str,
    req: ShareIssuanceCreateRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Execute a statutory share issuance certificate against authorized capital.
    Enforces authorized limits and generates official certificate numbers.
    """
    try:
        issuance = CapTableEngine.issue_shares(startup_id, req)
        return issuance
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post("/startups/{startup_id}/cap-table/convertibles", response_model=ConvertibleInstrumentItem, status_code=status.HTTP_201_CREATED)
async def register_convertible_instrument(
    startup_id: str,
    req: ConvertibleInstrumentItem,
    current_user=Depends(get_current_active_user),
):
    """
    Register an active convertible warrant (BSA-AIR / SAFE) with valuation cap, floor, and discount.
    """
    try:
        item = CapTableEngine.add_convertible_instrument(startup_id, req)
        return item
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


# =============================================================================
# 3. DILUTION & LIQUIDATION WATERFALL SIMULATION
# =============================================================================

@router.post("/startups/{startup_id}/cap-table/simulate-dilution", response_model=CapTableSimulateResponse)
async def simulate_dilution_round(
    startup_id: str,
    req: CapTableSimulateRequest,
):
    """
    Simulate a future financing round with pre- vs post-money pricing, option pool creation
    (pre-round vs post-round), multi-instrument BSA-AIR / SAFE conversion, and Hamilton-Hare
    nominee discretization under Law 22-09.
    """
    try:
        res = CapTableEngine.simulate_dilution(req)
        return res
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dilution simulation failed: {str(exc)}",
        )


@router.post("/startups/{startup_id}/cap-table/simulate-waterfall", response_model=WaterfallSimulateResponse)
async def simulate_liquidation_waterfall(
    startup_id: str,
    req: WaterfallSimulateRequest,
):
    """
    Simulate exit proceeds distribution waterfall across senior debt, preferred share classes
    (seniority-ordered liquidation preferences), non-participating vs participating rights,
    and ordinary residual equity with stakeholder MOIC calculations.
    """
    try:
        res = CapTableEngine.simulate_waterfall(req, startup_id=startup_id)
        return res
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Waterfall simulation failed: {str(exc)}",
        )


# =============================================================================
# 4. NOMINEE SPAS POOLING & BENEFICIAL SUB-LEDGER
# =============================================================================

@router.post("/startups/{startup_id}/cap-table/nominee/pool", response_model=NomineePoolResponse, status_code=status.HTTP_201_CREATED)
async def execute_nominee_crowd_pool(
    startup_id: str,
    req: NomineePoolRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Aggregate thousands of micro-pledges into a single legal line-item for the CNRC register
    under Law 22-09 and Civil Code Article 571 (Convention de Portage).
    Guarantees indivisible shares via Hamilton-Hare largest remainder allocation and returns
    official CNRC Notarial Summary Certificate with SHA-256 fingerprint.
    """
    try:
        req.startupId = startup_id
        res = CapTableEngine.execute_nominee_pooling(req)
        return res
    except Exception as exc:
        logger.error("Nominee pooling failed for startup %s: %s", startup_id, exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Nominee pooling failed: {str(exc)}",
        )


@router.get("/startups/{startup_id}/cap-table/nominee/{issuance_id}/ledger", response_model=NomineeAllocationResponse)
async def get_nominee_beneficial_ledger(
    startup_id: str,
    issuance_id: str,
    current_user=Depends(get_current_active_user),
):
    """
    Retrieve beneficial ownership sub-ledger for a registered Nominee block issuance.
    """
    ledger = CapTableEngine.get_nominee_ledger(issuance_id)
    if not ledger:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Nominee beneficial ledger for issuance {issuance_id} not found.",
        )
    return ledger


# =============================================================================
# 5. BSA-AIR CONTRACT GENERATOR
# =============================================================================

@router.post("/startups/{startup_id}/cap-table/bsa-air/generate-contract", response_model=BsaAirContractResponse)
async def generate_bsa_air_warrant_contract(
    startup_id: str,
    req: BsaAirGenerateRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Generate legally binding Algerian SPAS-compliant BSA-AIR (Accord d'Investissement Rapide)
    contract incorporating valuation tunnel (Cap, Floor, Discount), qualified round triggers,
    MFN clause, and tamper-evident SHA-256 cryptographic seal.
    """
    try:
        contract = CapTableEngine.generate_bsa_air_contract(req)
        return contract
    except Exception as exc:
        logger.error("BSA-AIR contract generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Contract generation failed: {str(exc)}",
        )


# =============================================================================
# 6. SECONDARY LIQUIDITY & UNIFORM-PRICE DUTCH AUCTION ENDPOINTS
# =============================================================================

@router.post("/startups/{startup_id}/secondary/windows", status_code=status.HTTP_201_CREATED)
async def create_secondary_liquidity_window(
    startup_id: str,
    req: LiquidityWindowCreateRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Open a quarterly secondary liquidity window for private SPAS shares.
    Allows employees, early investors, and angels to submit tender sell orders.
    """
    try:
        window = SecondaryLiquidityEngine.create_liquidity_window(startup_id, req)
        return window
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/startups/{startup_id}/secondary/windows/{window_id}/orders", response_model=SellerOrderResult, status_code=status.HTTP_201_CREATED)
async def submit_secondary_seller_order(
    startup_id: str,
    window_id: str,
    req: SellerOrderRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Submit a tender sell order into an active liquidity window.
    Specifies shares offered, reserve price, cost basis, and CIDTA Art. 169 reinvestment status.
    """
    try:
        order_res = SecondaryLiquidityEngine.submit_seller_order(window_id, req)
        return order_res
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/startups/{startup_id}/secondary/windows/{window_id}/clear", response_model=LiquidityAuctionClearResponse)
async def clear_secondary_liquidity_auction(
    startup_id: str,
    window_id: str,
    current_user=Depends(get_current_active_user),
):
    """
    Execute uniform-price Dutch auction clearing for an open secondary liquidity window.
    Determines single clearing price, applies pro-rata rationing if oversubscribed,
    deducts 1.5% platform transaction fee and 5.0% profit carry on realized net gains.
    """
    try:
        clear_res = SecondaryLiquidityEngine.clear_uniform_price_auction(window_id)
        return clear_res
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/startups/{startup_id}/secondary/windows/{window_id}")
async def get_secondary_liquidity_window(
    startup_id: str,
    window_id: str,
    current_user=Depends(get_current_active_user),
):
    """
    Retrieve status, orders, and clearing results for a liquidity window.
    """
    window = SecondaryLiquidityEngine.get_window(window_id)
    if not window:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Window not found")
    return window


# =============================================================================
# 7. DUAL-ENTITY CROSS-BORDER HOLDCO-OPCO MIRROR ENDPOINTS
# =============================================================================

@router.post("/startups/{startup_id}/mirror/setup", response_model=CrossBorderMirrorResponse, status_code=status.HTTP_201_CREATED)
async def setup_cross_border_mirror(
    startup_id: str,
    req: HoldCoMirrorSetupRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Initialize offshore HoldCo mirror (ADGM / Delaware / DIFC) holding 100% of Algerian OpCo SPAS.
    Maps hard-currency diaspora shares to domestic beneficial units at fixed/transparent FX parity.
    """
    try:
        mirror = DualEntityCapTableMirror.setup_mirror(startup_id, req)
        return mirror
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/startups/{startup_id}/mirror/shares", response_model=CrossBorderMirrorResponse, status_code=status.HTTP_201_CREATED)
async def issue_holdco_diaspora_shares(
    startup_id: str,
    req: HoldCoShareIssuanceRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Issue offshore HoldCo shares to a diaspora investor and mirror the beneficial allocation on OpCo.
    """
    try:
        mirror = DualEntityCapTableMirror.issue_holdco_shares(startup_id, req)
        return mirror
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/startups/{startup_id}/mirror/status", response_model=CrossBorderMirrorResponse)
async def get_cross_border_mirror_status(
    startup_id: str,
    current_user=Depends(get_current_active_user),
):
    """
    Retrieve cross-border HoldCo-OpCo cap table synchronization status, FX parity, and diaspora register.
    """
    try:
        mirror = DualEntityCapTableMirror.get_mirror_status(startup_id)
        return mirror
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# =============================================================================
# 8. ESOP / BSPCE VESTING & DOUBLE-TRIGGER ACCELERATION ENDPOINTS
# =============================================================================

@router.post("/startups/{startup_id}/esop/grants", status_code=status.HTTP_201_CREATED)
async def create_esop_grant(
    startup_id: str,
    req: EsopGrantCreateRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Issue an Employee Stock Option Grant (BSPCE equivalent under Law 22-09 SPAS).
    Configured with standard 48-month vesting schedule, 12-month cliff, and acceleration protections.
    """
    try:
        grant = ESOPVestingEngine.create_grant(startup_id, req)
        return grant
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/startups/{startup_id}/esop/grants/{grant_id}/vesting", response_model=EsopVestingStatusResponse)
async def get_esop_vesting_status(
    startup_id: str,
    grant_id: str,
    as_of_date: Optional[str] = Query(None, description="Simulate vesting as of date (YYYY-MM-DD)"),
    current_fmv_dzd: Optional[float] = Query(None, description="Optional fair market value per share"),
    current_user=Depends(get_current_active_user),
):
    """
    Calculate vesting progression, cliff status, exercisable options, and intrinsic value.
    """
    try:
        status_res = ESOPVestingEngine.calculate_vesting(grant_id, as_of_date, current_fmv_dzd)
        return status_res
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/startups/{startup_id}/esop/grants/{grant_id}/accelerate", response_model=EsopVestingStatusResponse)
async def trigger_esop_acceleration(
    startup_id: str,
    grant_id: str,
    is_change_of_control: bool = True,
    is_involuntary_termination: bool = False,
    current_user=Depends(get_current_active_user),
):
    """
    Trigger change-of-control acceleration (single-trigger or double-trigger) on an ESOP grant.
    """
    try:
        status_res = ESOPVestingEngine.apply_acceleration(
            grant_id, is_change_of_control, is_involuntary_termination
        )
        return status_res
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/startups/{startup_id}/esop/grants/{grant_id}/exercise")
async def exercise_esop_options(
    startup_id: str,
    grant_id: str,
    req: EsopExerciseRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Exercise vested options into statutory shares on the startup cap table.
    """
    try:
        res = ESOPVestingEngine.exercise_options(grant_id, req)
        return res
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
