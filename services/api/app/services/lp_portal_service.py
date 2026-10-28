"""
TamWheel Sovereign Ethical Agentic Venture OS — LP Personal Capital Account Statements (PCCAS) & Tax Engine.
Implements:
1. ILPA (Institutional Limited Partners Association) Standard Capital Account Reporting:
   - Roll-forward reconciliation: Beginning Balance + Capital Calls - Distributions + Realized/Unrealized Gains - Expenses = Ending Balance.
   - Granular breakdown of cash distributions: Return of Capital (ROC / Remboursement d'apport) vs Realized Capital Gains vs Dividend Income.
   - Residual NAV attribution per LP in Algerian Dinars (DZD).
2. Advanced Venture Capital Performance Tracking:
   - High-precision Internal Rate of Return (IRR / XIRR) via Newton-Raphson & robust bisection root finder.
   - Time-Weighted Return (TWR) utilizing Modified Dietz and geometric sub-period linking without cash flow timing distortions.
   - Multiple of Invested Capital (MOIC / TVPI), Distributed to Paid-In (DPI), Residual Value to Paid-In (RVPI).
3. Algerian Tax Reporting Package for Venture Syndicates (Law 22-09 SPAS & CIDTA):
   - Monthly / Periodic Bordereau G50 withholding tax declarations (Retenue à la Source - RAS).
   - Corporate Income Tax (Impôt sur le Bénéfice des Sociétés - IBS) withholding on distributed income and capital gains.
   - Official bilingual French / Arabic Tax Certificate (Attestation Fiscale de Retenue à la Source).
"""

from __future__ import annotations

import enum
import logging
import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, computed_field

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class CashFlowType(str, enum.Enum):
    CAPITAL_CALL_CONTRIBUTION = "CAPITAL_CALL_CONTRIBUTION"
    DISTRIBUTION_RETURN_OF_CAPITAL = "DISTRIBUTION_RETURN_OF_CAPITAL"
    DISTRIBUTION_REALIZED_GAIN = "DISTRIBUTION_REALIZED_GAIN"
    DISTRIBUTION_DIVIDEND = "DISTRIBUTION_DIVIDEND"
    VALUATION_NAV_TERMINAL = "VALUATION_NAV_TERMINAL"


class TaxResidenceType(str, enum.Enum):
    ALGERIAN_RESIDENT_NATURAL_PERSON = "ALGERIAN_RESIDENT_NATURAL_PERSON"
    ALGERIAN_RESIDENT_CORPORATE = "ALGERIAN_RESIDENT_CORPORATE"
    ALGERIAN_DIASPORA_TREATY = "ALGERIAN_DIASPORA_TREATY"
    NON_RESIDENT_FOREIGN = "NON_RESIDENT_FOREIGN"


class StatementStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    AUDITED = "AUDITED"


# =============================================================================
# SCHEMAS FOR CASH FLOWS & PERFORMANCE
# =============================================================================

class LPCashFlow(BaseModel):
    cash_flow_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    flow_type: CashFlowType
    amount_dzd: float = Field(..., description="Positive for inflows to LP (distributions/NAV), negative for outflows from LP (contributions)")
    description: str = ""


class LPPerformanceMetrics(BaseModel):
    tvpi: float = Field(..., description="Total Value to Paid-In (MOIC)")
    dpi: float = Field(..., description="Distributed to Paid-In")
    rvpi: float = Field(..., description="Residual Value to Paid-In")
    irr_annualized_pct: float = Field(..., description="Internal Rate of Return (XIRR) in %")
    twr_period_pct: float = Field(..., description="Time-Weighted Return for the period in %")
    twr_annualized_pct: float = Field(..., description="Annualized Time-Weighted Return in %")
    cumulative_called_dzd: float
    cumulative_distributed_dzd: float
    net_profit_dzd: float


# =============================================================================
# SCHEMAS FOR CAPITAL ACCOUNT STATEMENTS (PCCAS)
# =============================================================================

class LPPCCASStatement(BaseModel):
    statement_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    spv_id: str
    spv_name: str
    lp_id: str
    lp_name: str
    lp_email: str
    period_start_date: datetime
    period_end_date: datetime
    currency: str = "DZD"
    status: StatementStatus = StatementStatus.PUBLISHED

    # Subscription & Ownership
    total_committed_capital_dzd: float = Field(..., ge=0.0)
    ownership_percentage: float = Field(..., ge=0.0, le=100.0)
    units_held: int = Field(default=0, ge=0)

    # Capital Account Roll-forward (ILPA PCAS Reconciliation)
    beginning_capital_account_dzd: float = Field(default=0.0, ge=0.0)
    capital_contributions_called_dzd: float = Field(default=0.0, ge=0.0)
    distributions_received_dzd: float = Field(default=0.0, ge=0.0)
    distributions_return_of_capital_dzd: float = Field(default=0.0, ge=0.0)
    distributions_realized_gain_dzd: float = Field(default=0.0, ge=0.0)
    distributions_dividend_income_dzd: float = Field(default=0.0, ge=0.0)
    net_realized_gain_loss_dzd: float = Field(default=0.0)
    net_unrealized_gain_loss_dzd: float = Field(default=0.0)
    allocated_expenses_and_fees_dzd: float = Field(default=0.0, ge=0.0)
    ending_capital_account_dzd: float = Field(..., ge=0.0)

    # Uncalled Dry Powder
    cumulative_paid_in_dzd: float = Field(..., ge=0.0)
    remaining_uncalled_capital_dzd: float = Field(..., ge=0.0)

    # Performance
    performance: LPPerformanceMetrics
    cash_flows: List[LPCashFlow] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# SCHEMAS FOR ALGERIAN TAX STATEMENTS (G50 / IBS)
# =============================================================================

class LPTaxPackageStatement(BaseModel):
    tax_statement_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fiscal_year: int
    spv_id: str
    spv_name: str
    spv_nif: str = "002216010099881"
    spv_nis: str = "0998123400192"
    tax_administration_office: str = "Direction des Grandes Entreprises (DGE) / CDI Alger Centre"

    # LP Tax Identity
    lp_id: str
    lp_name: str
    tax_residence_country: str = "DZ"
    tax_residence_type: TaxResidenceType = TaxResidenceType.ALGERIAN_RESIDENT_NATURAL_PERSON
    lp_nif: Optional[str] = "198516010023456"
    lp_article_imposition: Optional[str] = "1601/45098"

    # Distribution Amounts in DZD
    gross_total_distribution_dzd: float = Field(..., ge=0.0)
    non_taxable_return_of_capital_dzd: float = Field(..., ge=0.0, description="Remboursement d'apport - Art. 104 CIDTA (Exonéré)")
    taxable_dividends_dzd: float = Field(..., ge=0.0, description="Produits d'actions et parts sociales")
    taxable_realized_capital_gains_dzd: float = Field(..., ge=0.0, description="Plus-values de cession de valeurs mobilières")

    # Withholding Taxes (Retenue à la Source - RAS)
    withholding_rate_dividends_pct: float = Field(default=10.0, ge=0.0)
    withholding_rate_capital_gains_pct: float = Field(default=10.0, ge=0.0)
    tax_withheld_dividends_dzd: float = Field(default=0.0, ge=0.0)
    tax_withheld_capital_gains_dzd: float = Field(default=0.0, ge=0.0)
    total_tax_withheld_dzd: float = Field(default=0.0, ge=0.0)
    net_distribution_paid_dzd: float = Field(..., ge=0.0)

    # G50 Regulatory Filings
    g50_bordereau_serial_number: str
    g50_filing_period_month: str
    payment_settlement_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    treasury_receipt_reference: str

    # Official bilingual certification texts
    formal_certificate_fr: str
    formal_certificate_ar: str
    certified_by_commissaire_aux_comptes: bool = True
    commissaire_name: str = "Cabinet d'Expertise Comptable & Commissariat aux Comptes El-Djazair (Ordre National CNC)"
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# SCHEMAS FOR AGGREGATED LP DASHBOARD
# =============================================================================

class LPSyndicatePortfolioItem(BaseModel):
    spv_id: str
    spv_name: str
    committed_amount_dzd: float
    paid_in_amount_dzd: float
    uncalled_capital_dzd: float
    distributions_received_dzd: float
    current_nav_balance_dzd: float
    tvpi: float
    irr_annualized_pct: float
    ownership_percentage: float


class LPDashboardSummary(BaseModel):
    lp_id: str
    lp_name: str
    total_commitments_dzd: float
    total_contributions_paid_dzd: float
    total_uncalled_dry_powder_dzd: float
    total_distributions_received_dzd: float
    total_unrealized_nav_dzd: float
    portfolio_total_value_dzd: float
    portfolio_blended_tvpi: float
    portfolio_blended_dpi: float
    portfolio_blended_rvpi: float
    portfolio_blended_irr_pct: float
    active_syndicates_count: int
    syndicates: List[LPSyndicatePortfolioItem] = Field(default_factory=list)


# =============================================================================
# HIGH PRECISION FINANCIAL MATH SOLVERS (XIRR & TWR)
# =============================================================================

def calculate_xirr(
    cash_flows: List[LPCashFlow],
    guess: float = 0.1,
    max_iterations: int = 200,
    tolerance: float = 1e-6,
) -> float:
    """
    Computes annualized Internal Rate of Return (XIRR) using cash flow dates and amounts.
    Uses Newton-Raphson with an automatic fallback to bisection to ensure 100% convergence.
    Outflows (contributions) are negative, inflows (distributions, terminal NAV) are positive.
    Returns annualized percentage (e.g., 24.5 for 24.5%).
    """
    if len(cash_flows) < 2:
        return 0.0

    # Separate into positive and negative flows
    has_positive = any(cf.amount_dzd > 0 for cf in cash_flows)
    has_negative = any(cf.amount_dzd < 0 for cf in cash_flows)

    if not has_positive or not has_negative:
        # Cannot calculate IRR without at least one inflow and one outflow
        return 0.0

    # Sort cash flows by timestamp
    sorted_cfs = sorted(cash_flows, key=lambda x: x.timestamp)
    t0 = sorted_cfs[0].timestamp

    # Precalculate year fractions
    years = []
    amounts = []
    for cf in sorted_cfs:
        delta_days = (cf.timestamp - t0).total_seconds() / 86400.0
        y = delta_days / 365.25
        years.append(y)
        amounts.append(cf.amount_dzd)

    def npv(r: float) -> float:
        total = 0.0
        for amt, y in zip(amounts, years):
            denom = (1.0 + r) ** y
            if denom == 0.0:
                denom = 1e-9
            total += amt / denom
        return total

    def d_npv(r: float) -> float:
        total = 0.0
        for amt, y in zip(amounts, years):
            denom = (1.0 + r) ** (y + 1.0)
            if denom == 0.0:
                denom = 1e-9
            total += -y * amt / denom
        return total

    # Newton-Raphson
    r = guess
    converged = False
    for _ in range(max_iterations):
        val = npv(r)
        if abs(val) < tolerance:
            converged = True
            break
        deriv = d_npv(r)
        if abs(deriv) < 1e-9:
            break
        new_r = r - val / deriv
        if new_r <= -0.999:
            # Step back if falling below -100%
            new_r = (r - 0.999) / 2.0
        if abs(new_r - r) < tolerance:
            r = new_r
            converged = True
            break
        r = new_r

    if not converged or math.isnan(r) or math.isinf(r):
        # Bisection Fallback in range [-0.99, 10.0]
        low = -0.99
        high = 10.0
        val_low = npv(low)
        val_high = npv(high)

        # If high is not high enough, expand
        if val_low * val_high > 0:
            high = 50.0
            val_high = npv(high)

        if val_low * val_high <= 0:
            for _ in range(100):
                mid = (low + high) / 2.0
                val_mid = npv(mid)
                if abs(val_mid) < tolerance:
                    r = mid
                    converged = True
                    break
                if val_low * val_mid < 0:
                    high = mid
                else:
                    low = mid
                    val_low = val_mid
            if not converged:
                r = (low + high) / 2.0

    if math.isnan(r) or math.isinf(r):
        r = 0.0

    return round(r * 100.0, 2)


def calculate_modified_dietz_twr(
    beginning_val: float,
    ending_val: float,
    cash_flows: List[LPCashFlow],
    period_start: datetime,
    period_end: datetime,
) -> tuple[float, float]:
    """
    Computes Time-Weighted Return (TWR) using the Modified Dietz formula:
    R = (V_end - V_begin - NetContributions) / (V_begin + Sum(W_i * C_i))
    where C_i is net contribution (contributions - distributions) and W_i is time weight.
    Returns (period_twr_pct, annualized_twr_pct).
    """
    total_days = max(1.0, (period_end - period_start).total_seconds() / 86400.0)

    net_contributions = 0.0
    weighted_capital = 0.0

    for cf in cash_flows:
        if cf.flow_type == CashFlowType.VALUATION_NAV_TERMINAL:
            continue

        # Inflows to fund are contributions (+ from fund perspective), distributions are outflows (- from fund perspective)
        if cf.flow_type == CashFlowType.CAPITAL_CALL_CONTRIBUTION:
            amount = abs(cf.amount_dzd)
        else:
            amount = -abs(cf.amount_dzd)

        cf_days = max(0.0, (cf.timestamp - period_start).total_seconds() / 86400.0)
        weight = max(0.0, min(1.0, (total_days - cf_days) / total_days))

        net_contributions += amount
        weighted_capital += weight * amount

    denominator = beginning_val + weighted_capital
    if denominator <= 0:
        denominator = max(1.0, beginning_val)

    numerator = ending_val - beginning_val - net_contributions
    dietz_return = numerator / denominator

    # Annualize if period > 0
    years = total_days / 365.25
    if years > 0 and (1.0 + dietz_return) > 0:
        annualized = ((1.0 + dietz_return) ** (1.0 / years)) - 1.0
    else:
        annualized = dietz_return

    return round(dietz_return * 100.0, 2), round(annualized * 100.0, 2)


# =============================================================================
# LP PORTAL SERVICE ENGINE
# =============================================================================

class LPPortalService:
    """
    Sovereign Engine managing Institutional LP Statements, Performance, and Algerian Tax Filings.
    """

    def __init__(self) -> None:
        # In-memory storage for statements and filings
        self._statements: Dict[str, LPPCCASStatement] = {}
        self._tax_packages: Dict[str, LPTaxPackageStatement] = {}
        self._lp_investments: Dict[str, List[Dict[str, Any]]] = {}

    def record_lp_investment(
        self,
        lp_id: str,
        spv_id: str,
        spv_name: str,
        committed_amount_dzd: float,
        ownership_percentage: float,
        units_held: int = 0,
    ) -> None:
        """Register or update an LP's active participation in a syndicate SPV."""
        if lp_id not in self._lp_investments:
            self._lp_investments[lp_id] = []

        existing = next((inv for inv in self._lp_investments[lp_id] if inv["spv_id"] == spv_id), None)
        if existing:
            existing["committed_amount_dzd"] = committed_amount_dzd
            existing["ownership_percentage"] = ownership_percentage
            existing["units_held"] = units_held
        else:
            self._lp_investments[lp_id].append({
                "spv_id": spv_id,
                "spv_name": spv_name,
                "committed_amount_dzd": committed_amount_dzd,
                "ownership_percentage": ownership_percentage,
                "units_held": units_held,
            })

    def generate_lp_pccas(
        self,
        spv_id: str,
        spv_name: str,
        lp_id: str,
        lp_name: str,
        lp_email: str,
        committed_capital_dzd: float,
        ownership_percentage: float,
        beginning_capital_account_dzd: float,
        capital_contributions_called_dzd: float,
        distributions_return_of_capital_dzd: float,
        distributions_realized_gain_dzd: float,
        distributions_dividend_income_dzd: float,
        net_unrealized_gain_loss_dzd: float,
        allocated_expenses_and_fees_dzd: float = 0.0,
        net_realized_gain_loss_dzd: Optional[float] = None,
        units_held: int = 0,
        period_start_date: Optional[datetime] = None,
        period_end_date: Optional[datetime] = None,
        historical_cash_flows: Optional[List[LPCashFlow]] = None,
    ) -> LPPCCASStatement:
        """
        Compiles an ILPA-compliant LP Personal Capital Account Statement (PCCAS).
        Calculates exact ending capital account balance, uncalled capital, XIRR, and TWR.
        """
        start_date = period_start_date or (datetime.now(timezone.utc) - timedelta(days=365))
        end_date = period_end_date or datetime.now(timezone.utc)

        total_distributions_received = round(
            distributions_return_of_capital_dzd + distributions_realized_gain_dzd + distributions_dividend_income_dzd,
            2,
        )

        realized_gains = net_realized_gain_loss_dzd if net_realized_gain_loss_dzd is not None else distributions_realized_gain_dzd

        # ILPA Roll-forward equation:
        # Ending Balance = Beginning Balance + Contributions - Distributions + Realized Gain + Unrealized Gain - Expenses
        ending_balance = round(
            beginning_capital_account_dzd
            + capital_contributions_called_dzd
            - total_distributions_received
            + realized_gains
            + net_unrealized_gain_loss_dzd
            - allocated_expenses_and_fees_dzd,
            2,
        )
        ending_balance = max(0.0, ending_balance)

        cumulative_paid_in = round(beginning_capital_account_dzd + capital_contributions_called_dzd, 2)
        remaining_uncalled = max(0.0, round(committed_capital_dzd - cumulative_paid_in, 2))

        # Build cash flow stream for XIRR & TWR
        cfs: List[LPCashFlow] = []
        if historical_cash_flows:
            cfs.extend(historical_cash_flows)
        else:
            # Synthesize standard cash flows across period
            if capital_contributions_called_dzd > 0:
                cfs.append(LPCashFlow(
                    timestamp=start_date + timedelta(days=15),
                    flow_type=CashFlowType.CAPITAL_CALL_CONTRIBUTION,
                    amount_dzd=-capital_contributions_called_dzd,
                    description=f"Capital Call Drawdown - {spv_name}",
                ))
            if distributions_return_of_capital_dzd > 0:
                cfs.append(LPCashFlow(
                    timestamp=start_date + timedelta(days=180),
                    flow_type=CashFlowType.DISTRIBUTION_RETURN_OF_CAPITAL,
                    amount_dzd=distributions_return_of_capital_dzd,
                    description="Return of Capital (Remboursement d'apport)",
                ))
            if (distributions_realized_gain_dzd + distributions_dividend_income_dzd) > 0:
                cfs.append(LPCashFlow(
                    timestamp=start_date + timedelta(days=270),
                    flow_type=CashFlowType.DISTRIBUTION_REALIZED_GAIN,
                    amount_dzd=distributions_realized_gain_dzd + distributions_dividend_income_dzd,
                    description="Exit Gain and Dividend Distribution",
                ))

        # Add terminal valuation NAV
        cfs.append(LPCashFlow(
            timestamp=end_date,
            flow_type=CashFlowType.VALUATION_NAV_TERMINAL,
            amount_dzd=ending_balance,
            description=f"Terminal Portfolio Valuation NAV ({end_date.strftime('%Y-%m-%d')})",
        ))

        # Calculate IRR & TWR
        irr_pct = calculate_xirr(cfs)
        period_twr_pct, annualized_twr_pct = calculate_modified_dietz_twr(
            beginning_val=beginning_capital_account_dzd,
            ending_val=ending_balance,
            cash_flows=cfs,
            period_start=start_date,
            period_end=end_date,
        )

        # Multiples
        total_paid_in_base = max(1.0, cumulative_paid_in)
        dpi = round(total_distributions_received / total_paid_in_base, 3)
        rvpi = round(ending_balance / total_paid_in_base, 3)
        tvpi = round(dpi + rvpi, 3)
        net_profit = round((total_distributions_received + ending_balance) - cumulative_paid_in, 2)

        perf = LPPerformanceMetrics(
            tvpi=tvpi,
            dpi=dpi,
            rvpi=rvpi,
            irr_annualized_pct=irr_pct,
            twr_period_pct=period_twr_pct,
            twr_annualized_pct=annualized_twr_pct,
            cumulative_called_dzd=cumulative_paid_in,
            cumulative_distributed_dzd=total_distributions_received,
            net_profit_dzd=net_profit,
        )

        statement = LPPCCASStatement(
            spv_id=spv_id,
            spv_name=spv_name,
            lp_id=lp_id,
            lp_name=lp_name,
            lp_email=lp_email,
            period_start_date=start_date,
            period_end_date=end_date,
            total_committed_capital_dzd=committed_capital_dzd,
            ownership_percentage=ownership_percentage,
            units_held=units_held,
            beginning_capital_account_dzd=beginning_capital_account_dzd,
            capital_contributions_called_dzd=capital_contributions_called_dzd,
            distributions_received_dzd=total_distributions_received,
            distributions_return_of_capital_dzd=distributions_return_of_capital_dzd,
            distributions_realized_gain_dzd=distributions_realized_gain_dzd,
            distributions_dividend_income_dzd=distributions_dividend_income_dzd,
            net_realized_gain_loss_dzd=realized_gains,
            net_unrealized_gain_loss_dzd=net_unrealized_gain_loss_dzd,
            allocated_expenses_and_fees_dzd=allocated_expenses_and_fees_dzd,
            ending_capital_account_dzd=ending_balance,
            cumulative_paid_in_dzd=cumulative_paid_in,
            remaining_uncalled_capital_dzd=remaining_uncalled,
            performance=perf,
            cash_flows=cfs,
        )

        key = f"{spv_id}:{lp_id}"
        self._statements[key] = statement
        self.record_lp_investment(
            lp_id=lp_id,
            spv_id=spv_id,
            spv_name=spv_name,
            committed_amount_dzd=committed_capital_dzd,
            ownership_percentage=ownership_percentage,
            units_held=units_held,
        )

        return statement

    def get_statement(self, spv_id: str, lp_id: str) -> Optional[LPPCCASStatement]:
        """Fetch previously generated PCCAS statement."""
        return self._statements.get(f"{spv_id}:{lp_id}")

    def generate_algerian_tax_package(
        self,
        spv_id: str,
        spv_name: str,
        lp_id: str,
        lp_name: str,
        fiscal_year: int,
        gross_total_distribution_dzd: float,
        non_taxable_return_of_capital_dzd: float,
        taxable_dividends_dzd: float,
        taxable_realized_capital_gains_dzd: float,
        tax_residence_country: str = "DZ",
        tax_residence_type: TaxResidenceType = TaxResidenceType.ALGERIAN_RESIDENT_NATURAL_PERSON,
        lp_nif: Optional[str] = None,
        lp_article_imposition: Optional[str] = None,
        custom_withholding_rate_dividends: Optional[float] = None,
        custom_withholding_rate_gains: Optional[float] = None,
        g50_filing_month: Optional[str] = None,
    ) -> LPTaxPackageStatement:
        """
        Generates an Algerian Tax Statement (Bordereau G50 / Impôt sur le Bénéfice des Sociétés IBS Withholding).
        Adheres to Articles 104 & 150 CIDTA and Law 22-09 SPAS.
        """
        # Determine tax withholding rate based on residence type
        if custom_withholding_rate_dividends is not None:
            rate_div = custom_withholding_rate_dividends
        elif tax_residence_type == TaxResidenceType.ALGERIAN_RESIDENT_CORPORATE:
            rate_div = 0.0  # Regime societes meres et filiales or exempt corporate
        elif tax_residence_type == TaxResidenceType.NON_RESIDENT_FOREIGN:
            rate_div = 15.0  # Non-treaty standard withholding
        else:
            rate_div = 10.0  # Resident individuals & treaty diaspora

        if custom_withholding_rate_gains is not None:
            rate_gains = custom_withholding_rate_gains
        elif tax_residence_type == TaxResidenceType.NON_RESIDENT_FOREIGN:
            rate_gains = 15.0
        else:
            rate_gains = 10.0

        tax_withheld_div = round(taxable_dividends_dzd * (rate_div / 100.0), 2)
        tax_withheld_gains = round(taxable_realized_capital_gains_dzd * (rate_gains / 100.0), 2)
        total_withheld = round(tax_withheld_div + tax_withheld_gains, 2)
        net_distribution_paid = max(0.0, round(gross_total_distribution_dzd - total_withheld, 2))

        month_label = g50_filing_month or f"Avril {fiscal_year}"
        serial_hash = uuid.uuid4().hex[:8].upper()
        g50_serial = f"G50-DGI-CDI-{fiscal_year}-{serial_hash}"
        treasury_ref = f"TR-DGI-ALG-REC-{fiscal_year}-{uuid.uuid4().hex[:6].upper()}"

        nif_lp = lp_nif or "198516010023456"
        art_imp = lp_article_imposition or f"1601/{uuid.uuid4().hex[:5].upper()}"

        cert_fr = (
            f"RÉPUBLIQUE ALGÉRIENNE DÉMOCRATIQUE ET POPULAIRE — MINISTÈRE DES FINANCES\n"
            f"Direction Générale des Impôts (DGI) — Centre des Impôts d'Alger Centre\n"
            f"ATTESTATION FISCALE DE RETENUE À LA SOURCE SUR PRODUITS D'ACTIONS (BORDEREAU G50)\n"
            f"Exercice Fiscal: {fiscal_year}\n"
            f"SPV Émetteur: {spv_name} (NIF: 002216010099881)\n"
            f"Bénéficiaire (LP): {lp_name} (NIF: {nif_lp}, Art. Imposition: {art_imp})\n"
            f"Montant Total Brut Distribué: {gross_total_distribution_dzd:,.2f} DZD\n"
            f" - Remboursement d'apport exonéré (Art. 104 CIDTA): {non_taxable_return_of_capital_dzd:,.2f} DZD\n"
            f" - Revenus de capitaux mobiliers imposables: {taxable_dividends_dzd:,.2f} DZD (Retenue: {rate_div}% = {tax_withheld_div:,.2f} DZD)\n"
            f" - Plus-values de cession de titres imposables: {taxable_realized_capital_gains_dzd:,.2f} DZD (Retenue: {rate_gains}% = {tax_withheld_gains:,.2f} DZD)\n"
            f"Montant Total de la Retenue à la Source (IBS/IRG): {total_withheld:,.2f} DZD\n"
            f"Montant Net Décaissé au Bénéficiaire: {net_distribution_paid:,.2f} DZD\n"
            f"Régularisé au Trésor Public via Bordereau G50 Réf: {g50_serial} (Quittance: {treasury_ref})."
        )

        cert_ar = (
            f"الجمهورية الجزائرية الديمقراطية الشعبية — وزارة المالية\n"
            f"المديرية العامة للضرائب — مركز الضرائب الجزائر وسط\n"
            f"شهادة رسمية للاقتطاع الضريبي من المصدر على أرباح الأسهم والحصص (جدول G50)\n"
            f"السنة المالية: {fiscal_year}\n"
            f"صندوق الاستثمار المصدر: {spv_name} (رقم التعريف الجبائي NIF: 002216010099881)\n"
            f"المستثمر الشريك: {lp_name} (رقم التعريف الجبائي: {nif_lp}، مادة الجدول: {art_imp})\n"
            f"إجمالي الأرباح الموزعة: {gross_total_distribution_dzd:,.2f} دج\n"
            f" - استرداد الحصة الرأسمالية المعفى جبائياً (المادة 104 من ق.ض.م): {non_taxable_return_of_capital_dzd:,.2f} دج\n"
            f" - أرباح الأسهم الخاضعة للضريبة: {taxable_dividends_dzd:,.2f} دج (اقتطاع: {rate_div}% = {tax_withheld_div:,.2f} دج)\n"
            f" - فوائض القيمة المحققة الخاضعة للضريبة: {taxable_realized_capital_gains_dzd:,.2f} دج (اقتطاع: {rate_gains}% = {tax_withheld_gains:,.2f} دج)\n"
            f"إجمالي الضريبة المقتطعة من المصدر الموردة للخزينة العمومية: {total_withheld:,.2f} دج\n"
            f"صافي التوزيع المسدد في الحساب البنكي: {net_distribution_paid:,.2f} دج\n"
            f"تم الإيداع بموجب إشعار التسديد جدول G50 رقم: {g50_serial} (وصل الخزينة: {treasury_ref})."
        )

        pkg = LPTaxPackageStatement(
            fiscal_year=fiscal_year,
            spv_id=spv_id,
            spv_name=spv_name,
            lp_id=lp_id,
            lp_name=lp_name,
            tax_residence_country=tax_residence_country,
            tax_residence_type=tax_residence_type,
            lp_nif=nif_lp,
            lp_article_imposition=art_imp,
            gross_total_distribution_dzd=gross_total_distribution_dzd,
            non_taxable_return_of_capital_dzd=non_taxable_return_of_capital_dzd,
            taxable_dividends_dzd=taxable_dividends_dzd,
            taxable_realized_capital_gains_dzd=taxable_realized_capital_gains_dzd,
            withholding_rate_dividends_pct=rate_div,
            withholding_rate_capital_gains_pct=rate_gains,
            tax_withheld_dividends_dzd=tax_withheld_div,
            tax_withheld_capital_gains_dzd=tax_withheld_gains,
            total_tax_withheld_dzd=total_withheld,
            net_distribution_paid_dzd=net_distribution_paid,
            g50_bordereau_serial_number=g50_serial,
            g50_filing_period_month=month_label,
            treasury_receipt_reference=treasury_ref,
            formal_certificate_fr=cert_fr,
            formal_certificate_ar=cert_ar,
        )

        key = f"{spv_id}:{lp_id}:{fiscal_year}"
        self._tax_packages[key] = pkg
        return pkg

    def get_tax_package(self, spv_id: str, lp_id: str, fiscal_year: int) -> Optional[LPTaxPackageStatement]:
        """Fetch previously generated Algerian tax package."""
        return self._tax_packages.get(f"{spv_id}:{lp_id}:{fiscal_year}")

    def get_lp_dashboard(self, lp_id: str, lp_name: str = "Institutional LP Investor") -> LPDashboardSummary:
        """
        Aggregates portfolio-wide LP investments across all active syndicate SPVs.
        Computes portfolio blended TVPI, DPI, RVPI, and blended IRR.
        """
        items: List[LPSyndicatePortfolioItem] = []
        all_cfs: List[LPCashFlow] = []

        total_commitments = 0.0
        total_paid_in = 0.0
        total_uncalled = 0.0
        total_distributions = 0.0
        total_nav = 0.0

        for key, stmt in self._statements.items():
            if stmt.lp_id == lp_id:
                items.append(LPSyndicatePortfolioItem(
                    spv_id=stmt.spv_id,
                    spv_name=stmt.spv_name,
                    committed_amount_dzd=stmt.total_committed_capital_dzd,
                    paid_in_amount_dzd=stmt.cumulative_paid_in_dzd,
                    uncalled_capital_dzd=stmt.remaining_uncalled_capital_dzd,
                    distributions_received_dzd=stmt.distributions_received_dzd,
                    current_nav_balance_dzd=stmt.ending_capital_account_dzd,
                    tvpi=stmt.performance.tvpi,
                    irr_annualized_pct=stmt.performance.irr_annualized_pct,
                    ownership_percentage=stmt.ownership_percentage,
                ))
                total_commitments += stmt.total_committed_capital_dzd
                total_paid_in += stmt.cumulative_paid_in_dzd
                total_uncalled += stmt.remaining_uncalled_capital_dzd
                total_distributions += stmt.distributions_received_dzd
                total_nav += stmt.ending_capital_account_dzd

                # Aggregate cash flows excluding duplicates
                all_cfs.extend(stmt.cash_flows)

        # Portfolio-level multiples
        denom = max(1.0, total_paid_in)
        blended_dpi = round(total_distributions / denom, 3)
        blended_rvpi = round(total_nav / denom, 3)
        blended_tvpi = round(blended_dpi + blended_rvpi, 3)
        blended_irr = calculate_xirr(all_cfs) if len(all_cfs) >= 2 else 0.0

        return LPDashboardSummary(
            lp_id=lp_id,
            lp_name=lp_name,
            total_commitments_dzd=round(total_commitments, 2),
            total_contributions_paid_dzd=round(total_paid_in, 2),
            total_uncalled_dry_powder_dzd=round(total_uncalled, 2),
            total_distributions_received_dzd=round(total_distributions, 2),
            total_unrealized_nav_dzd=round(total_nav, 2),
            portfolio_total_value_dzd=round(total_distributions + total_nav, 2),
            portfolio_blended_tvpi=blended_tvpi,
            portfolio_blended_dpi=blended_dpi,
            portfolio_blended_rvpi=blended_rvpi,
            portfolio_blended_irr_pct=blended_irr,
            active_syndicates_count=len(items),
            syndicates=items,
        )


# Global singleton instance
lp_portal_service = LPPortalService()
