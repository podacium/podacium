"""
TamWheel Sovereign Ethical Agentic Venture OS — AAOIFI FAS 9 Zakat Engine.
Implements:
1. AAOIFI Financial Accounting Standard No. 9 (FAS 9): Zakat.
2. AAOIFI Shariah Standard No. 35: Zakah.
3. Dual accounting methods:
   - Net Asset Method (Working Capital Method / طريقة الموجودات الصافية)
   - Net Invested Capital Method (Financing Method / طريقة رأس المال المستثمر)
4. Calibration of Nisab in Algerian Dinars (DZD) against fine Gold (85g) and Silver (595g) spot rates.
5. Hawl tracking: Hijri lunar year (2.5000%) vs. Gregorian solar year (2.5775% under AAOIFI FAS 9 9/2).
6. Dual treatment for equity holders:
   - Operating company / Founder: Entity-level zakat base.
   - Long-term Angel / Growth Investor (Mustathmir): Proportional zakatable net assets per share.
   - Short-term Trader (Mudharib / Trading shares): Full fair market value per share.
7. Verification and reconciliation audit reports with cryptographic hash seals.
"""

from __future__ import annotations

import enum
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# CONSTANTS & NORMATIVE BENCHMARKS
# =============================================================================

LUNAR_HIJRI_RATE: float = 0.025         # 2.5% for 354-day lunar year
SOLAR_GREGORIAN_RATE: float = 0.025775  # 2.5775% for 365.25-day solar year per AAOIFI FAS 9 (9/2)

GOLD_NISAB_GRAMS: float = 85.0          # 85 grams fine gold (24k)
SILVER_NISAB_GRAMS: float = 595.0       # 595 grams pure silver

DEFAULT_GOLD_PRICE_PER_GRAM_DZD: float = 11500.0  # Spot benchmark in Algeria (DZD/g)
DEFAULT_SILVER_PRICE_PER_GRAM_DZD: float = 140.0   # Spot benchmark in Algeria (DZD/g)


# =============================================================================
# ENUMS
# =============================================================================

class ZakatCalculationMethod(str, enum.Enum):
    NET_ASSETS = "NET_ASSETS"
    NET_INVESTED_CAPITAL = "NET_INVESTED_CAPITAL"
    RECONCILED_DUAL = "RECONCILED_DUAL"


class YearType(str, enum.Enum):
    LUNAR_HIJRI = "LUNAR_HIJRI"
    SOLAR_GREGORIAN = "SOLAR_GREGORIAN"


class NisabBenchmark(str, enum.Enum):
    GOLD_85G = "GOLD_85G"
    SILVER_595G = "SILVER_595G"


class InvestorType(str, enum.Enum):
    FOUNDER_OPERATOR = "FOUNDER_OPERATOR"
    LONG_TERM_ANGEL = "LONG_TERM_ANGEL"
    SHORT_TERM_TRADER = "SHORT_TERM_TRADER"


# =============================================================================
# COMPONENT INPUT SCHEMAS
# =============================================================================

class WorkingCapitalAssetsInput(BaseModel):
    """
    Current zakatable assets under the Net Assets / Working Capital Method.
    Excludes fixed assets, prepayments, and non-commercial infrastructure.
    """
    cash_and_equivalents_dzd: float = Field(0.0, ge=0, description="Cash in bank & vault in DZD")
    short_term_investments_dzd: float = Field(0.0, ge=0, description="Liquid marketable securities / tokens held for trade")
    trade_receivables_net_dzd: float = Field(0.0, ge=0, description="Gross receivables minus doubtful debt allowance")
    merchandise_inventory_dzd: float = Field(0.0, ge=0, description="Finished goods / commercial stock at selling market value")
    work_in_progress_dzd: float = Field(0.0, ge=0, description="Raw materials & WIP intended for sale at cost")
    other_zakatable_current_assets_dzd: float = Field(0.0, ge=0, description="Other liquid commercial assets")

    @property
    def total(self) -> float:
        return (
            self.cash_and_equivalents_dzd
            + self.short_term_investments_dzd
            + self.trade_receivables_net_dzd
            + self.merchandise_inventory_dzd
            + self.work_in_progress_dzd
            + self.other_zakatable_current_assets_dzd
        )


class WorkingCapitalLiabilitiesInput(BaseModel):
    """
    Deductible short-term liabilities due within the current zakat year.
    Excludes equity and long-term liabilities not falling due within the year.
    """
    trade_payables_dzd: float = Field(0.0, ge=0, description="Suppliers & vendor accounts payable")
    short_term_debts_dzd: float = Field(0.0, ge=0, description="Commercial short-term debt principal due within 1 year")
    accrued_operating_expenses_dzd: float = Field(0.0, ge=0, description="Accrued wages, rent, and operational bills due")
    other_deductible_short_term_liabilities_dzd: float = Field(0.0, ge=0, description="Other short-term operational liabilities")

    @property
    def total(self) -> float:
        return (
            self.trade_payables_dzd
            + self.short_term_debts_dzd
            + self.accrued_operating_expenses_dzd
            + self.other_deductible_short_term_liabilities_dzd
        )


class InvestedCapitalComponentsInput(BaseModel):
    """
    Balance sheet items for Net Invested Capital Method (Financing Method).
    Zakat Base = (Paid-up Capital + Reserves + Retained Earnings + Net Income + Long-Term Liabilities)
                 - (Net Fixed Assets + Long-Term Investments + Accumulated Losses)
    """
    paid_up_capital_dzd: float = Field(0.0, ge=0, description="Issued and paid-up share capital")
    reserves_dzd: float = Field(0.0, ge=0, description="Statutory, general, and contingency reserves")
    retained_earnings_dzd: float = Field(0.0, description="Cumulative undistributed profits (can be negative if losses)")
    net_income_dzd: float = Field(0.0, description="Net profit for the current fiscal period")
    long_term_liabilities_dzd: float = Field(0.0, ge=0, description="Long-term financing and non-current liabilities")
    net_fixed_assets_dzd: float = Field(0.0, ge=0, description="Net property, plant, equipment, and amortized software/IP")
    long_term_investments_dzd: float = Field(0.0, ge=0, description="Strategic non-trading shareholdings and fixed assets")
    accumulated_losses_dzd: float = Field(0.0, ge=0, description="Cumulative balance sheet losses")

    @property
    def total_sources(self) -> float:
        return (
            self.paid_up_capital_dzd
            + self.reserves_dzd
            + self.retained_earnings_dzd
            + self.net_income_dzd
            + self.long_term_liabilities_dzd
        )

    @property
    def total_deductions(self) -> float:
        return (
            self.net_fixed_assets_dzd
            + self.long_term_investments_dzd
            + self.accumulated_losses_dzd
        )


class CompanyZakatRequest(BaseModel):
    startup_id: str = Field(..., description="Unique startup ID")
    startup_name: str = Field(..., description="Startup name")
    calculation_method: ZakatCalculationMethod = Field(
        default=ZakatCalculationMethod.NET_ASSETS,
        description="FAS 9 calculation method: NET_ASSETS, NET_INVESTED_CAPITAL, or RECONCILED_DUAL",
    )
    year_type: YearType = Field(default=YearType.LUNAR_HIJRI, description="LUNAR_HIJRI (2.5%) or SOLAR_GREGORIAN (2.5775%)")
    nisab_benchmark: NisabBenchmark = Field(default=NisabBenchmark.GOLD_85G, description="GOLD_85G or SILVER_595G")
    gold_price_per_gram_dzd: Optional[float] = Field(None, gt=0, description="Custom 24k gold spot price in DZD/g")
    silver_price_per_gram_dzd: Optional[float] = Field(None, gt=0, description="Custom silver spot price in DZD/g")
    hawl_completed: bool = Field(True, description="Whether the 1-year Hawl period has completed")
    total_outstanding_shares: int = Field(1_000_000, gt=0, description="Total issued shares")
    current_assets: Optional[WorkingCapitalAssetsInput] = None
    current_liabilities: Optional[WorkingCapitalLiabilitiesInput] = None
    invested_capital: Optional[InvestedCapitalComponentsInput] = None


class InvestorZakatRequest(BaseModel):
    investor_id: str = Field(..., description="Unique investor ID")
    investor_name: str = Field(..., description="Investor full name")
    startup_id: str = Field(..., description="Startup venture ID")
    investor_type: InvestorType = Field(
        ...,
        description="LONG_TERM_ANGEL (proportional net assets) vs SHORT_TERM_TRADER (market cap) vs FOUNDER_OPERATOR",
    )
    shares_held: int = Field(..., gt=0, description="Number of shares held by investor")
    total_outstanding_shares: int = Field(..., gt=0, description="Total outstanding company shares")
    company_zakat_base_dzd: float = Field(0.0, ge=0, description="Total company zakatable base in DZD")
    market_price_per_share_dzd: float = Field(0.0, ge=0, description="Current market / valuation price per share in DZD")
    year_type: YearType = Field(default=YearType.LUNAR_HIJRI, description="LUNAR_HIJRI (2.5%) or SOLAR_GREGORIAN (2.5775%)")
    nisab_benchmark: NisabBenchmark = Field(default=NisabBenchmark.GOLD_85G, description="GOLD_85G or SILVER_595G")
    gold_price_per_gram_dzd: Optional[float] = Field(None, gt=0)
    silver_price_per_gram_dzd: Optional[float] = Field(None, gt=0)
    hawl_completed: bool = Field(True, description="Whether the 1-year Hawl has elapsed")
    company_already_paid_zakat: bool = Field(
        False,
        description="If True, company discharged Zakat at source; avoids double taxation (Thina' al-Zakat)",
    )


# =============================================================================
# OUTPUT SCHEMAS
# =============================================================================

class NisabEvaluation(BaseModel):
    benchmark: NisabBenchmark
    price_per_gram_dzd: float
    grams_standard: float
    nisab_threshold_dzd: float
    is_nisab_reached: bool


class CompanyZakatAssessment(BaseModel):
    assessment_id: str
    startup_id: str
    startup_name: str
    calculation_method: ZakatCalculationMethod
    year_type: YearType
    applicable_rate_pct: float
    total_zakatable_assets_dzd: float
    total_deductible_liabilities_dzd: float
    zakat_base_dzd: float
    reconciled_invested_capital_base_dzd: Optional[float] = None
    reconciliation_variance_dzd: Optional[float] = None
    reconciled_match: Optional[bool] = None
    nisab_evaluation: NisabEvaluation
    hawl_completed: bool
    zakat_due_dzd: float
    total_zakat_payable_dzd: float = 0.0
    total_outstanding_shares: int
    zakat_per_share_dzd: float
    standard_citation: str = "AAOIFI FAS 9 (Zakat) & AAOIFI Shariah Standard No. 35 (Zakah)"
    cryptographic_seal: str
    assessed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InvestorZakatAssessment(BaseModel):
    assessment_id: str
    investor_id: str
    investor_name: str
    startup_id: str
    investor_type: InvestorType
    shares_held: int
    total_outstanding_shares: int
    shareholding_pct: float
    valuation_basis: str
    investor_zakat_base_dzd: float
    zakat_base_dzd: float = 0.0
    year_type: YearType
    applicable_rate_pct: float
    nisab_evaluation: NisabEvaluation
    hawl_completed: bool
    company_already_paid_zakat: bool
    zakat_due_dzd: float
    zakat_payable_dzd: float = 0.0
    sharia_rationale: str
    cryptographic_seal: str
    assessed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# ENGINE IMPLEMENTATION
# =============================================================================

class ZakatEngine:
    """
    Algorithmic Zakat calculation engine adhering strictly to:
    - AAOIFI Financial Accounting Standard No. 9 (FAS 9).
    - AAOIFI Shariah Standard No. 35 (Zakah).
    Supports Net Asset (Working Capital) Method, Net Invested Capital Method,
    dual reconciliation, Nisab calibration in DZD, and specialized investor treatments.
    """

    def evaluate_nisab(
        self,
        zakat_base_dzd: float,
        benchmark: NisabBenchmark = NisabBenchmark.GOLD_85G,
        custom_gold_price: Optional[float] = None,
        custom_silver_price: Optional[float] = None,
    ) -> NisabEvaluation:
        """Calculate Nisab threshold in DZD and evaluate whether Zakat base reaches Nisab."""
        gold_price = custom_gold_price or DEFAULT_GOLD_PRICE_PER_GRAM_DZD
        silver_price = custom_silver_price or DEFAULT_SILVER_PRICE_PER_GRAM_DZD

        if benchmark == NisabBenchmark.GOLD_85G:
            grams = GOLD_NISAB_GRAMS
            price_per_gram = gold_price
        else:
            grams = SILVER_NISAB_GRAMS
            price_per_gram = silver_price

        nisab_threshold = round(grams * price_per_gram, 2)
        is_reached = zakat_base_dzd >= nisab_threshold

        return NisabEvaluation(
            benchmark=benchmark,
            price_per_gram_dzd=price_per_gram,
            grams_standard=grams,
            nisab_threshold_dzd=nisab_threshold,
            is_nisab_reached=is_reached,
        )

    def get_rate(self, year_type: YearType) -> float:
        """Returns statutory zakat rate: 2.5% for Lunar vs 2.5775% for Solar (AAOIFI FAS 9 9/2)."""
        return SOLAR_GREGORIAN_RATE if year_type == YearType.SOLAR_GREGORIAN else LUNAR_HIJRI_RATE

    def calculate_company_zakat(self, req: CompanyZakatRequest) -> CompanyZakatAssessment:
        """
        Calculates company zakat base, applies Nisab & Hawl tests, and returns certified assessment.
        """
        assets = req.current_assets or WorkingCapitalAssetsInput()
        liabilities = req.current_liabilities or WorkingCapitalLiabilitiesInput()
        invested = req.invested_capital or InvestedCapitalComponentsInput()

        # Method 1: Net Asset (Working Capital) Method
        net_assets_base = round(max(0.0, assets.total - liabilities.total), 2)

        # Method 2: Net Invested Capital (Financing) Method
        invested_capital_base = round(max(0.0, invested.total_sources - invested.total_deductions), 2)

        reconciled_invested_base: Optional[float] = None
        variance_dzd: Optional[float] = None
        reconciled_match: Optional[bool] = None

        if req.calculation_method == ZakatCalculationMethod.NET_ASSETS:
            zakat_base = net_assets_base
            total_zakatable_assets = assets.total
            total_deductible_liab = liabilities.total
            if req.invested_capital is not None:
                reconciled_invested_base = invested_capital_base
                variance_dzd = round(abs(net_assets_base - invested_capital_base), 2)
                reconciled_match = variance_dzd < 1.0  # allow minor penny rounding

        elif req.calculation_method == ZakatCalculationMethod.NET_INVESTED_CAPITAL:
            zakat_base = invested_capital_base
            total_zakatable_assets = invested.total_sources
            total_deductible_liab = invested.total_deductions
            if req.current_assets is not None or req.current_liabilities is not None:
                variance_dzd = round(abs(invested_capital_base - net_assets_base), 2)
                reconciled_match = variance_dzd < 1.0

        else:  # RECONCILED_DUAL
            total_zakatable_assets = assets.total
            total_deductible_liab = liabilities.total
            reconciled_invested_base = invested_capital_base
            variance_dzd = round(abs(net_assets_base - invested_capital_base), 2)
            reconciled_match = variance_dzd < 1.0
            # Under dual reconciliation, adopt net assets base while auditing variance
            zakat_base = net_assets_base

        nisab_eval = self.evaluate_nisab(
            zakat_base_dzd=zakat_base,
            benchmark=req.nisab_benchmark,
            custom_gold_price=req.gold_price_per_gram_dzd,
            custom_silver_price=req.silver_price_per_gram_dzd,
        )

        rate = self.get_rate(req.year_type)
        rate_pct = round(rate * 100, 4)

        if req.hawl_completed and nisab_eval.is_nisab_reached:
            zakat_due = round(zakat_base * rate, 2)
        else:
            zakat_due = 0.0

        zakat_per_share = round(zakat_due / req.total_outstanding_shares, 6) if req.total_outstanding_shares > 0 else 0.0

        assessment_id = f"ZAKAT-CORP-{hashlib.sha256(f'{req.startup_id}:{datetime.now(timezone.utc).isoformat()}'.encode()).hexdigest()[:12].upper()}"

        seal_payload = {
            "assessment_id": assessment_id,
            "startup_id": req.startup_id,
            "method": req.calculation_method.value,
            "year_type": req.year_type.value,
            "zakat_base_dzd": zakat_base,
            "zakat_due_dzd": zakat_due,
            "rate_pct": rate_pct,
            "nisab_reached": nisab_eval.is_nisab_reached,
        }
        cryptographic_seal = hashlib.sha256(json.dumps(seal_payload, sort_keys=True).encode()).hexdigest()

        return CompanyZakatAssessment(
            assessment_id=assessment_id,
            startup_id=req.startup_id,
            startup_name=req.startup_name,
            calculation_method=req.calculation_method,
            year_type=req.year_type,
            applicable_rate_pct=rate_pct,
            total_zakatable_assets_dzd=round(total_zakatable_assets, 2),
            total_deductible_liabilities_dzd=round(total_deductible_liab, 2),
            zakat_base_dzd=zakat_base,
            reconciled_invested_capital_base_dzd=reconciled_invested_base,
            reconciliation_variance_dzd=variance_dzd,
            reconciled_match=reconciled_match,
            nisab_evaluation=nisab_eval,
            hawl_completed=req.hawl_completed,
            zakat_due_dzd=zakat_due,
            total_zakat_payable_dzd=zakat_due,
            total_outstanding_shares=req.total_outstanding_shares,
            zakat_per_share_dzd=zakat_per_share,
            cryptographic_seal=cryptographic_seal,
        )

    def calculate_investor_zakat(self, req: InvestorZakatRequest) -> InvestorZakatAssessment:
        """
        Calculates zakat obligation for equity holders based on investor type:
        - LONG_TERM_ANGEL: proportional share of company zakatable net assets.
        - SHORT_TERM_TRADER: fair market value of shares.
        - FOUNDER_OPERATOR: proportional company zakatable base.
        Enforces AAOIFI Standard No. 35 anti-double taxation rules if company paid at source.
        """
        shareholding_pct = round((req.shares_held / req.total_outstanding_shares) * 100, 4)
        rate = self.get_rate(req.year_type)
        rate_pct = round(rate * 100, 4)

        if req.investor_type in (InvestorType.LONG_TERM_ANGEL, InvestorType.FOUNDER_OPERATOR):
            valuation_basis = "PROPORTIONAL_NET_ZAKATABLE_ASSETS"
            proportional_base = req.company_zakat_base_dzd * (req.shares_held / req.total_outstanding_shares)
            investor_zakat_base = round(proportional_base, 2)
        else:  # SHORT_TERM_TRADER
            valuation_basis = "FULL_MARKET_CAPITALIZATION"
            market_base = req.shares_held * req.market_price_per_share_dzd
            investor_zakat_base = round(market_base, 2)

        nisab_eval = self.evaluate_nisab(
            zakat_base_dzd=investor_zakat_base,
            benchmark=req.nisab_benchmark,
            custom_gold_price=req.gold_price_per_gram_dzd,
            custom_silver_price=req.silver_price_per_gram_dzd,
        )

        if req.company_already_paid_zakat and req.investor_type in (InvestorType.LONG_TERM_ANGEL, InvestorType.FOUNDER_OPERATOR):
            zakat_due = 0.0
            sharia_rationale = (
                "Long-term growth investor (Mustathmir). Under AAOIFI Shariah Standard No. 35, equity held for dividend yields "
                "and long-term capital appreciation is subject to Zakat exclusively on proportional net zakatable assets. "
                "Because the portfolio company has already discharged Zakat at source on its net assets, the investor's "
                "obligation is zero to prevent prohibited double taxation (Thina' al-Zakat)."
            )
        elif not req.hawl_completed:
            zakat_due = 0.0
            sharia_rationale = "Hawl requirement not completed (1 full year has not elapsed since acquisition). Zakat is not yet mandatory."
        elif not nisab_eval.is_nisab_reached:
            zakat_due = 0.0
            sharia_rationale = f"Zakatable base ({investor_zakat_base:,.2f} DZD) is below the Nisab threshold ({nisab_eval.nisab_threshold_dzd:,.2f} DZD). Zakat is not due (Doon al-Nisab)."
        else:
            zakat_due = round(investor_zakat_base * rate, 2)
            if req.investor_type in (InvestorType.LONG_TERM_ANGEL, InvestorType.FOUNDER_OPERATOR):
                sharia_rationale = (
                    "Long-term growth investor (Mustathmir). Per AAOIFI Shariah Standard No. 35, Zakat is computed strictly "
                    "on the proportional share of the company's zakatable net working capital assets, excluding fixed assets "
                    "and speculative market valuation markup."
                )
            else:
                sharia_rationale = (
                    "Active trader / Speculator (Mudharib). Shares acquired with the intent of short-term resale for capital gains "
                    "are classified as trading merchandise (Urud al-Tijarah). Under AAOIFI Standard No. 35, Zakat is obligatorily "
                    "due on full fair market value at the valuation date."
                )

        assessment_id = f"ZAKAT-INV-{hashlib.sha256(f'{req.investor_id}:{req.startup_id}:{datetime.now(timezone.utc).isoformat()}'.encode()).hexdigest()[:12].upper()}"

        seal_payload = {
            "assessment_id": assessment_id,
            "investor_id": req.investor_id,
            "startup_id": req.startup_id,
            "investor_type": req.investor_type.value,
            "shares_held": req.shares_held,
            "zakat_base_dzd": investor_zakat_base,
            "zakat_due_dzd": zakat_due,
            "company_paid": req.company_already_paid_zakat,
        }
        cryptographic_seal = hashlib.sha256(json.dumps(seal_payload, sort_keys=True).encode()).hexdigest()

        return InvestorZakatAssessment(
            assessment_id=assessment_id,
            investor_id=req.investor_id,
            investor_name=req.investor_name,
            startup_id=req.startup_id,
            investor_type=req.investor_type,
            shares_held=req.shares_held,
            total_outstanding_shares=req.total_outstanding_shares,
            shareholding_pct=shareholding_pct,
            valuation_basis=valuation_basis,
            investor_zakat_base_dzd=investor_zakat_base,
            zakat_base_dzd=investor_zakat_base,
            year_type=req.year_type,
            applicable_rate_pct=rate_pct,
            nisab_evaluation=nisab_eval,
            hawl_completed=req.hawl_completed,
            company_already_paid_zakat=req.company_already_paid_zakat,
            zakat_due_dzd=zakat_due,
            zakat_payable_dzd=zakat_due,
            sharia_rationale=sharia_rationale,
            cryptographic_seal=cryptographic_seal,
        )


zakat_engine = ZakatEngine()
