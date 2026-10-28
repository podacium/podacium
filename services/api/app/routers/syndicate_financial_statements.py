"""
TamWheel Sovereign Ethical Agentic Venture OS — Syndicate SCF Financial Statements Router.
Exposes endpoints for:
1. Compiling Algerian SCF-compliant Balance Sheets and Income Statements (Classes 1, 2, 4, 5).
2. Authoritative Net Asset Value (NAV / Valeur Liquidative) per unit computation.
3. VC performance metrics (TVPI, DPI, RVPI) under ILPA and Law 22-09 SPAS standards.
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_optional
from app.services.spv_accounting_engine import (
    spv_accounting_engine,
    SPVFinancialReport,
    PortfolioInvestment,
    FiscalYearStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/syndicates/financial-statements", tags=["Syndicate SCF Financial Statements"])


# =============================================================================
# REQUEST SCHEMAS
# =============================================================================

class CompileFinancialStatementsRequest(BaseModel):
    spv_id: str
    spv_name: str
    fiscal_year: int
    total_spv_units: int = Field(..., gt=0)
    paid_in_capital_dzd: float = Field(..., ge=0)
    bank_escrow_cash_dzd: float = Field(default=0.0, ge=0)
    portfolio_investments: List[PortfolioInvestment] = Field(default_factory=list)
    called_capital_receivable_dzd: float = Field(default=0.0, ge=0)
    management_fees_expense_dzd: float = Field(default=0.0, ge=0)
    audit_and_legal_expense_dzd: float = Field(default=0.0, ge=0)
    carried_interest_provision_dzd: float = Field(default=0.0, ge=0)
    realized_dividends_dzd: float = Field(default=0.0, ge=0)
    realized_exit_capital_gains_dzd: float = Field(default=0.0, ge=0)
    cumulative_distributions_paid_dzd: float = Field(default=0.0, ge=0)
    statutory_reserves_dzd: float = Field(default=0.0, ge=0)
    retained_earnings_dzd: float = 0.0
    accounts_payable_audit_dzd: float = Field(default=0.0, ge=0)


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post(
    "/compile",
    response_model=SPVFinancialReport,
    summary="Compile Algerian SCF Financial Statements & NAV",
    description="Generates compliant Balance Sheet (Classes 1, 2, 4, 5), Income Statement, and NAV per unit for Syndicate SPVs under Law 22-09 SPAS & Law 07-11 SCF.",
)
async def compile_financial_statements(
    req: CompileFinancialStatementsRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SPVFinancialReport:
    try:
        return spv_accounting_engine.compile_financial_statements(
            spv_id=req.spv_id,
            spv_name=req.spv_name,
            fiscal_year=req.fiscal_year,
            total_spv_units=req.total_spv_units,
            paid_in_capital_dzd=req.paid_in_capital_dzd,
            bank_escrow_cash_dzd=req.bank_escrow_cash_dzd,
            portfolio_investments=req.portfolio_investments,
            called_capital_receivable_dzd=req.called_capital_receivable_dzd,
            management_fees_expense_dzd=req.management_fees_expense_dzd,
            audit_and_legal_expense_dzd=req.audit_and_legal_expense_dzd,
            carried_interest_provision_dzd=req.carried_interest_provision_dzd,
            realized_dividends_dzd=req.realized_dividends_dzd,
            realized_exit_capital_gains_dzd=req.realized_exit_capital_gains_dzd,
            cumulative_distributions_paid_dzd=req.cumulative_distributions_paid_dzd,
            statutory_reserves_dzd=req.statutory_reserves_dzd,
            retained_earnings_dzd=req.retained_earnings_dzd,
            accounts_payable_audit_dzd=req.accounts_payable_audit_dzd,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error compiling financial statements: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/{report_id}",
    response_model=SPVFinancialReport,
    summary="Get certified SCF financial report",
)
async def get_financial_report(
    report_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SPVFinancialReport:
    report = spv_accounting_engine.get_report(report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Report '{report_id}' not found.")
    return report


@router.get(
    "/spv/{spv_id}",
    response_model=List[SPVFinancialReport],
    summary="List all financial reports for an SPV",
)
async def list_spv_financial_reports(
    spv_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> List[SPVFinancialReport]:
    return spv_accounting_engine.get_reports_by_spv(spv_id)
