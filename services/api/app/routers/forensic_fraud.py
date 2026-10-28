"""
TamWheel Sovereign Ethical Agentic Venture OS — Forensic Fraud & Corporate Accounting Router.
Exposes endpoints for:
1. Full forensic audit cross-checking G50 tax declarations, CNAS social slips, transaction loops, and cash runway
2. Focused circular transaction & phantom supplier detection
3. Monthly bank ledger balance & net burn rate cash reconciliation
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.prisma import prisma
from app.services.forensic_fraud_detector import forensic_fraud_detector
from app.schemas.forensic_fraud import (
    ForensicAuditRequest,
    ForensicAuditResponse,
    CircularCheckRequest,
    CircularCheckResponse,
    CashReconciliationRequest,
    CashReconciliationResponse,
    CircularLoopResult,
)

logger = logging.getLogger("tamwheel.routers.forensic_fraud")

router = APIRouter(tags=["forensics", "fraud-detection"])


@router.post(
    "/forensics/fraud/audit",
    response_model=ForensicAuditResponse,
    summary="Conduct comprehensive forensic accounting audit",
)
async def conduct_forensic_fraud_audit(request: ForensicAuditRequest):
    """
    Perform deep corporate forensic accounting audit:
    - Cross-check declared revenue vs statutory Algerian G50 VAT / TAP turnover
    - Cross-check declared payroll and headcount vs CNAS social security filings (34.5% rule)
    - Detect circular transaction round-tripping cycles and unverified phantom suppliers
    - Reconcile bank statement ledger mathematical integrity against claimed runway
    - Compute composite Fraud Risk Score [0.0, 100.0] and prioritized red-flag matrix
    """
    try:
        return forensic_fraud_detector.audit_startup(request)
    except Exception as e:
        logger.error(f"Forensic fraud audit failed for startup {request.startupId}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Forensic corporate audit failed: {str(e)}",
        )


@router.post(
    "/forensics/fraud/circular-check",
    response_model=CircularCheckResponse,
    summary="Detect circular round-tripping transaction cycles",
)
async def check_circular_transactions(request: CircularCheckRequest):
    """
    Analyze directed transaction graph for closed round-tripping cycles (A -> B -> C -> A)
    and unverified phantom suppliers with missing or invalid tax IDs (NIF).
    """
    try:
        score, loops, phantoms, _ = forensic_fraud_detector.detect_circular_transactions(
            transactions=request.transactions,
            target_entity=request.targetEntity,
        )
        return CircularCheckResponse(
            cyclesFound=len(loops),
            circularLoops=loops,
            phantomSuppliers=phantoms,
            circularRiskScore=round(score, 1),
        )
    except Exception as e:
        logger.error(f"Circular transaction detection failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Circular transaction check failed: {str(e)}",
        )


@router.post(
    "/forensics/fraud/reconcile-cash",
    response_model=CashReconciliationResponse,
    summary="Reconcile bank statement cash burn and runway",
)
async def reconcile_cash_statements(request: CashReconciliationRequest):
    """
    Verify bank statement monthly continuity and calculate true net burn rate vs claimed runway.
    """
    try:
        score, flags, actual_burn, actual_runway, delta = forensic_fraud_detector.reconcile_cash_burn(
            statements=request.bankStatements,
            claimed_burn=request.claimedMonthlyBurnDzd,
            claimed_runway=request.claimedRunwayMonths,
        )

        ledger_discrepancy_sum = sum(
            abs(s.closingBalanceDzd - (s.openingBalanceDzd + s.totalDepositsDzd - s.totalWithdrawalsDzd))
            for s in request.bankStatements
        )

        is_reconciled = (score < 25.0) and (ledger_discrepancy_sum < 100.0)

        return CashReconciliationResponse(
            isReconciled=is_reconciled,
            reconciliationScore=round(score, 1),
            actualAverageMonthlyBurnDzd=round(actual_burn, 2),
            calculatedRunwayMonths=round(actual_runway, 1),
            claimedVsCalculatedRunwayDeltaMonths=round(delta, 1),
            ledgerDiscrepancyTotalDzd=round(ledger_discrepancy_sum, 2),
            redFlags=flags,
        )
    except Exception as e:
        logger.error(f"Cash reconciliation failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cash reconciliation failed: {str(e)}",
        )
