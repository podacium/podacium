"""
TamWheel Sovereign Ethical Agentic Venture OS — Syndicate LP Portal & PCCAS Router.
Exposes endpoints for:
1. ILPA-Standard LP Personal Capital Account Statements (PCCAS).
2. Real-time Venture Performance Metrics (XIRR, Time-Weighted Return TWR, TVPI/DPI/RVPI).
3. Algerian Tax Reporting Package (Bordereau G50 / Impôt sur le Bénéfice des Sociétés IBS Withholding).
4. Aggregated LP Investor Dashboard across multi-syndicate portfolios.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_optional
from app.services.lp_portal_service import (
    lp_portal_service,
    LPPCCASStatement,
    LPTaxPackageStatement,
    LPDashboardSummary,
    LPPerformanceMetrics,
    LPCashFlow,
    CashFlowType,
    TaxResidenceType,
    calculate_xirr,
    calculate_modified_dietz_twr,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/syndicates/lp-portal", tags=["Syndicate LP Portal & PCCAS"])


# =============================================================================
# REQUEST SCHEMAS
# =============================================================================

class GeneratePCCASRequest(BaseModel):
    spv_id: str
    spv_name: str
    lp_id: str
    lp_name: str
    lp_email: str
    committed_capital_dzd: float = Field(..., gt=0.0)
    ownership_percentage: float = Field(..., ge=0.0, le=100.0)
    beginning_capital_account_dzd: float = Field(default=0.0, ge=0.0)
    capital_contributions_called_dzd: float = Field(default=0.0, ge=0.0)
    distributions_return_of_capital_dzd: float = Field(default=0.0, ge=0.0)
    distributions_realized_gain_dzd: float = Field(default=0.0, ge=0.0)
    distributions_dividend_income_dzd: float = Field(default=0.0, ge=0.0)
    net_unrealized_gain_loss_dzd: float = Field(default=0.0)
    allocated_expenses_and_fees_dzd: float = Field(default=0.0, ge=0.0)
    net_realized_gain_loss_dzd: Optional[float] = None
    units_held: int = Field(default=0, ge=0)
    period_start_date: Optional[datetime] = None
    period_end_date: Optional[datetime] = None
    historical_cash_flows: Optional[List[LPCashFlow]] = None


class CalculatePerformanceRequest(BaseModel):
    beginning_balance_dzd: float = Field(default=0.0, ge=0.0)
    ending_balance_dzd: float = Field(..., ge=0.0)
    period_start_date: datetime
    period_end_date: datetime
    cash_flows: List[LPCashFlow] = Field(default_factory=list)


class GenerateTaxPackageRequest(BaseModel):
    spv_id: str
    spv_name: str
    lp_id: str
    lp_name: str
    fiscal_year: int = Field(..., ge=2020, le=2035)
    gross_total_distribution_dzd: float = Field(..., ge=0.0)
    non_taxable_return_of_capital_dzd: float = Field(..., ge=0.0)
    taxable_dividends_dzd: float = Field(..., ge=0.0)
    taxable_realized_capital_gains_dzd: float = Field(..., ge=0.0)
    tax_residence_country: str = "DZ"
    tax_residence_type: TaxResidenceType = TaxResidenceType.ALGERIAN_RESIDENT_NATURAL_PERSON
    lp_nif: Optional[str] = None
    lp_article_imposition: Optional[str] = None
    custom_withholding_rate_dividends: Optional[float] = None
    custom_withholding_rate_gains: Optional[float] = None
    g50_filing_month: Optional[str] = None


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post(
    "/pccas/generate",
    response_model=LPPCCASStatement,
    summary="Generate ILPA LP Capital Account Statement (PCCAS)",
    description="Calculates ending capital account balance, real-time XIRR, Time-Weighted Return (TWR), and roll-forward reconciliation under ILPA guidelines.",
)
def generate_pccas(
    body: GeneratePCCASRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> LPPCCASStatement:
    try:
        statement = lp_portal_service.generate_lp_pccas(
            spv_id=body.spv_id,
            spv_name=body.spv_name,
            lp_id=body.lp_id,
            lp_name=body.lp_name,
            lp_email=body.lp_email,
            committed_capital_dzd=body.committed_capital_dzd,
            ownership_percentage=body.ownership_percentage,
            beginning_capital_account_dzd=body.beginning_capital_account_dzd,
            capital_contributions_called_dzd=body.capital_contributions_called_dzd,
            distributions_return_of_capital_dzd=body.distributions_return_of_capital_dzd,
            distributions_realized_gain_dzd=body.distributions_realized_gain_dzd,
            distributions_dividend_income_dzd=body.distributions_dividend_income_dzd,
            net_unrealized_gain_loss_dzd=body.net_unrealized_gain_loss_dzd,
            allocated_expenses_and_fees_dzd=body.allocated_expenses_and_fees_dzd,
            net_realized_gain_loss_dzd=body.net_realized_gain_loss_dzd,
            units_held=body.units_held,
            period_start_date=body.period_start_date,
            period_end_date=body.period_end_date,
            historical_cash_flows=body.historical_cash_flows,
        )
        return statement
    except Exception as exc:
        logger.error(f"Failed to generate PCCAS: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"PCCAS generation failed: {str(exc)}",
        )


@router.get(
    "/pccas/{spv_id}/{lp_id}",
    response_model=LPPCCASStatement,
    summary="Get LP Capital Account Statement",
    description="Retrieves previously generated ILPA PCCAS statement for an LP in a syndicate SPV.",
)
def get_pccas(
    spv_id: str,
    lp_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> LPPCCASStatement:
    stmt = lp_portal_service.get_statement(spv_id=spv_id, lp_id=lp_id)
    if not stmt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No PCCAS statement found for LP '{lp_id}' in SPV '{spv_id}'.",
        )
    return stmt


@router.post(
    "/performance/calculate",
    response_model=LPPerformanceMetrics,
    summary="Calculate Venture Investment Performance (IRR & TWR)",
    description="Computes exact XIRR using Newton-Raphson/bisection and Time-Weighted Return (TWR) using Modified Dietz linking for custom cash flow series.",
)
def calculate_performance(
    body: CalculatePerformanceRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> LPPerformanceMetrics:
    # Ensure terminal NAV is in cash flows
    cfs = list(body.cash_flows)
    has_terminal = any(cf.flow_type == CashFlowType.VALUATION_NAV_TERMINAL for cf in cfs)
    if not has_terminal:
        cfs.append(LPCashFlow(
            timestamp=body.period_end_date,
            flow_type=CashFlowType.VALUATION_NAV_TERMINAL,
            amount_dzd=body.ending_balance_dzd,
            description="Terminal Portfolio NAV",
        ))

    irr_pct = calculate_xirr(cfs)
    period_twr_pct, annualized_twr_pct = calculate_modified_dietz_twr(
        beginning_val=body.beginning_balance_dzd,
        ending_val=body.ending_balance_dzd,
        cash_flows=cfs,
        period_start=body.period_start_date,
        period_end=body.period_end_date,
    )

    total_contributions = sum(abs(cf.amount_dzd) for cf in cfs if cf.flow_type == CashFlowType.CAPITAL_CALL_CONTRIBUTION)
    total_distributions = sum(abs(cf.amount_dzd) for cf in cfs if cf.flow_type in [
        CashFlowType.DISTRIBUTION_RETURN_OF_CAPITAL,
        CashFlowType.DISTRIBUTION_REALIZED_GAIN,
        CashFlowType.DISTRIBUTION_DIVIDEND,
    ])

    denom = max(1.0, total_contributions)
    dpi = round(total_distributions / denom, 3)
    rvpi = round(body.ending_balance_dzd / denom, 3)
    tvpi = round(dpi + rvpi, 3)

    return LPPerformanceMetrics(
        tvpi=tvpi,
        dpi=dpi,
        rvpi=rvpi,
        irr_annualized_pct=irr_pct,
        twr_period_pct=period_twr_pct,
        twr_annualized_pct=annualized_twr_pct,
        cumulative_called_dzd=round(total_contributions, 2),
        cumulative_distributed_dzd=round(total_distributions, 2),
        net_profit_dzd=round((total_distributions + body.ending_balance_dzd) - total_contributions, 2),
    )


@router.post(
    "/tax-package/generate",
    response_model=LPTaxPackageStatement,
    summary="Generate Algerian Tax Statement (Bordereau G50 / IBS)",
    description="Generates compliant Algerian tax reporting with breakdown of tax-exempt return of capital, taxable dividends, capital gains, and Retenue à la Source (RAS) under Law 22-09 SPAS & CIDTA.",
)
def generate_tax_package(
    body: GenerateTaxPackageRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> LPTaxPackageStatement:
    try:
        pkg = lp_portal_service.generate_algerian_tax_package(
            spv_id=body.spv_id,
            spv_name=body.spv_name,
            lp_id=body.lp_id,
            lp_name=body.lp_name,
            fiscal_year=body.fiscal_year,
            gross_total_distribution_dzd=body.gross_total_distribution_dzd,
            non_taxable_return_of_capital_dzd=body.non_taxable_return_of_capital_dzd,
            taxable_dividends_dzd=body.taxable_dividends_dzd,
            taxable_realized_capital_gains_dzd=body.taxable_realized_capital_gains_dzd,
            tax_residence_country=body.tax_residence_country,
            tax_residence_type=body.tax_residence_type,
            lp_nif=body.lp_nif,
            lp_article_imposition=body.lp_article_imposition,
            custom_withholding_rate_dividends=body.custom_withholding_rate_dividends,
            custom_withholding_rate_gains=body.custom_withholding_rate_gains,
            g50_filing_month=body.g50_filing_month,
        )
        return pkg
    except Exception as exc:
        logger.error(f"Failed to generate tax package: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tax package generation failed: {str(exc)}",
        )


@router.get(
    "/tax-package/{spv_id}/{lp_id}/{fiscal_year}",
    response_model=LPTaxPackageStatement,
    summary="Get Algerian Tax Package",
    description="Retrieves certified Bordereau G50 tax certificate and withholding report for an LP and fiscal year.",
)
def get_tax_package(
    spv_id: str,
    lp_id: str,
    fiscal_year: int,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> LPTaxPackageStatement:
    pkg = lp_portal_service.get_tax_package(spv_id=spv_id, lp_id=lp_id, fiscal_year=fiscal_year)
    if not pkg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No tax package found for LP '{lp_id}' in SPV '{spv_id}' for FY{fiscal_year}.",
        )
    return pkg


@router.get(
    "/dashboard/{lp_id}",
    response_model=LPDashboardSummary,
    summary="Get Aggregated LP Investor Dashboard",
    description="Aggregates portfolio-level dry powder, paid-in capital, distributions, NAV, blended TVPI/DPI/RVPI, and blended IRR across all syndicates.",
)
def get_lp_dashboard(
    lp_id: str,
    lp_name: str = "Institutional LP Investor",
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> LPDashboardSummary:
    return lp_portal_service.get_lp_dashboard(lp_id=lp_id, lp_name=lp_name)
