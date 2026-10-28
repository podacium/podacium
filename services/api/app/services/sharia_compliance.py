"""
TamWheel Sovereign Ethical Agentic Venture OS — Programmatic Sharia Compliance Engine.
Implements:
1. AAOIFI Shariah Standard No. 21 Financial Ratio & Qualitative Sector Screening.
2. Algorithmic Tathir (Financial Purification) for Impermissible / Tainted Revenue.
3. Cryptographically Verified Sharia Compliance Certificate Generation (SHA-256).
"""

from __future__ import annotations

import enum
import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS & CONSTANTS
# =============================================================================

class ShariaVerdict(str, enum.Enum):
    COMPLIANT = "COMPLIANT"
    NON_COMPLIANT = "NON_COMPLIANT"
    QUESTIONABLE = "QUESTIONABLE"


class ProhibitedSector(str, enum.Enum):
    ALCOHOL = "ALCOHOL"
    GAMBLING = "GAMBLING"
    CONVENTIONAL_FINANCE = "CONVENTIONAL_FINANCE"
    PORK = "PORK"
    ADULT_ENTERTAINMENT = "ADULT_ENTERTAINMENT"
    TOBACCO = "TOBACCO"
    WEAPONS = "WEAPONS"
    SPECULATIVE_DERIVATIVES = "SPECULATIVE_DERIVATIVES"


# AAOIFI Standard 21 Benchmarks
AAOIFI_MAX_DEBT_RATIO = 0.33              # Debt / Market Cap (or Total Assets) < 33.0%
AAOIFI_MAX_INTEREST_DEPOSITS_RATIO = 0.33 # Cash + Interest Deposits / Market Cap (or Total Assets) < 33.0%
AAOIFI_MAX_NON_PERMISSIBLE_REVENUE = 0.05 # Tainted Revenue / Total Revenue < 5.0%

# Borderline sensitivity buffer (within 90% of maximum threshold)
QUESTIONABLE_DEBT_RATIO = 0.30            # [30.0% - 33.0%)
QUESTIONABLE_DEPOSITS_RATIO = 0.30        # [30.0% - 33.0%)
QUESTIONABLE_REVENUE_RATIO = 0.045        # [4.5% - 5.0%)

PROHIBITED_SECTOR_KEYWORDS: Dict[ProhibitedSector, List[str]] = {
    ProhibitedSector.ALCOHOL: [
        "alcohol", "brewery", "distillery", "liquor", "wine", "beer", "spirits", "bar", "pub", "خمور", "كحول"
    ],
    ProhibitedSector.GAMBLING: [
        "gambling", "casino", "betting", "lottery", "poker", "maysir", "sportsbook", "قمار", "ميسر", "رهان"
    ],
    ProhibitedSector.CONVENTIONAL_FINANCE: [
        "commercial bank", "interest lender", "riba", "conventional insurance", "payday loan", "usury",
        "mortgage lender", "بنك ربوي", "فائدة ربوية", "تأمين تجاري"
    ],
    ProhibitedSector.PORK: [
        "pork", "swine", "bacon", "ham", "lard", "خنزير", "لحم خنزير"
    ],
    ProhibitedSector.ADULT_ENTERTAINMENT: [
        "pornography", "adult entertainment", "escort", "erotic", "sex industry", "إباحية", "محتوى إباحي"
    ],
    ProhibitedSector.TOBACCO: [
        "tobacco", "cigarette", "vape", "cigar", "nicotine", "cannabis", "تبغ", "سجائر", "شيشة"
    ],
    ProhibitedSector.WEAPONS: [
        "weapons", "munitions", "firearms", "missiles", "arms dealer", "military assault weapons", "أسلحة", "ذخيرة"
    ],
    ProhibitedSector.SPECULATIVE_DERIVATIVES: [
        "binary options", "cfd trading", "speculative derivatives", "spread betting", "high frequency forex",
        "gharar", "مضاربة غير مشروعة", "خيارات ثنائية"
    ],
}


# =============================================================================
# SCHEMAS FOR FINANCIAL STATEMENTS & SCREENING
# =============================================================================

class FinancialStatement(BaseModel):
    total_assets_dzd: float = Field(..., ge=0, description="Total balance sheet assets in DZD")
    market_cap_dzd: Optional[float] = Field(None, ge=0, description="Market cap or fair implied valuation in DZD")
    trailing_12m_assets_dzd: Optional[float] = Field(None, ge=0, description="12-month trailing average assets in DZD (for unlisted private startups)")
    total_debt_dzd: float = Field(0.0, ge=0, description="Total interest-bearing debt in DZD")
    interest_bearing_deposits_dzd: float = Field(0.0, ge=0, description="Cash and interest-bearing deposits in DZD")
    total_revenue_dzd: float = Field(..., ge=0, description="Gross annualized revenue in DZD")
    non_permissible_revenue_dzd: float = Field(0.0, ge=0, description="Revenue derived from non-compliant sources in DZD")
    business_sectors: List[str] = Field(default_factory=list, description="Primary and secondary industry sectors")
    business_description: str = Field(default="", description="Executive summary of operations and products")
    startup_id: Optional[str] = Field(None, description="Unique startup identifier")
    startup_name: Optional[str] = Field(None, description="Startup legal or trade name")


class RatioScreenResult(BaseModel):
    metric_name: str
    ratio: float
    threshold: float
    passed: bool
    denominator_used: str = Field(..., description="Denominator applied: MARKET_CAP, TRAILING_12M_ASSETS, or TOTAL_ASSETS")
    formula: str
    description: str
    remediation_guidance: Optional[str] = None


class TathirAssessment(BaseModel):
    tainted_revenue_dzd: float
    total_revenue_dzd: float
    purification_ratio: float = Field(..., description="Tainted Revenue / Total Revenue fraction (e.g. 0.02)")
    purification_percentage: float = Field(..., description="Purification percentage (e.g. 2.0%)")
    dividend_purification_per_share_dzd: Optional[float] = Field(
        None, description="Exact per-share purification required on declared dividend"
    )
    total_purification_for_payout_dzd: Optional[float] = Field(
        None, description="Total purification deduction required for investor dividend payout in DZD"
    )
    is_purification_mandatory: bool = Field(
        ..., description="True if any tainted revenue exists and must be purified"
    )
    distribution_ruling: str = (
        "Purification funds (Tathir) must be disbursed to registered charitable causes (Sadaqah) "
        "or public benefit initiatives (poverty alleviation, healthcare, educational infrastructure). "
        "No personal financial return or commercial favor may be received."
    )
    tax_deductibility_warning: str = (
        "Under AAOIFI Standard No. 21 Sharia principles, purification amounts (Tathir) disbursed to charitable "
        "causes cannot be claimed as tax deductions, credits, or write-offs, as no worldly financial gain "
        "or fiscal advantage may be derived from cleansing impermissible revenue."
    )
    recommended_recipients: List[str] = Field(
        default_factory=lambda: [
            "Algerian Red Crescent (الهلال الأحمر الجزائري)",
            "Public Health Clinics & Pediatric Cancer Wards",
            "Sovereign Educational Tech & Student Scholarship Endowment",
            "Clean Water & Rural Solar Infrastructure Endowments",
        ]
    )


class ShariaScreeningResult(BaseModel):
    is_compliant: bool
    verdict: ShariaVerdict
    standards_reference: str = "AAOIFI Shariah Standard No. 21 (Financial Papers & Equities)"
    debt_to_market_cap_ratio: float
    interest_bearing_deposits_ratio: float
    non_permissible_revenue_ratio: float
    ratio_screens: List[RatioScreenResult]
    prohibited_sectors_detected: List[str]
    purification_required_dzd: float
    purification_percentage: float
    tathir_assessment: TathirAssessment
    screening_notes: List[str]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ShariaCertificate(BaseModel):
    certificate_id: str
    certificate_audit_hash: str = Field(..., description="SHA-256 cryptographic proof of screening metrics")
    startup_id: str
    startup_name: str
    issued_at: datetime
    expires_at: datetime
    verdict: ShariaVerdict
    standards_reference: str = "AAOIFI Shariah Standard No. 21"
    screening_summary: Dict[str, Any]
    tathir_obligations: TathirAssessment
    auditor_seal: str = "Tamwheel Algorithmic Sharia Supervisory Protocol & Smart Contract Verification Engine"
    canonical_signature: str


# =============================================================================
# SHARIA COMPLIANCE ENGINE
# =============================================================================

class ShariaComplianceEngine:
    """
    Automated AAOIFI Standard No. 21 Programmatic Screening & Tathir Engine.
    Evaluates:
    - Debt Screen: Total Interest-bearing Debt / Market Cap (or 12M Trailing Total Assets) < 33.0%
    - Cash/Deposits Screen: Total Interest-bearing Deposits / Market Cap (or Total Assets) < 33.0%
    - Non-Permissible Revenue: Tainted Revenue / Total Revenue < 5.0%
    - Qualitative Sector Screen: Strict absence of Riba, Maysir, Alcohol, Pork, Pornography, Tobacco, Arms.
    """

    def _determine_denominator(self, statement: FinancialStatement) -> tuple[float, str]:
        """
        Determines the appropriate valuation denominator according to AAOIFI guidelines.
        For listed companies / validated rounds, uses Market Cap.
        For private early-stage startups where Market Cap is absent or zero, uses
        12-Month Trailing Average Assets, or Total Balance Sheet Assets as fallback.
        """
        if statement.market_cap_dzd is not None and statement.market_cap_dzd > 0:
            return statement.market_cap_dzd, "MARKET_CAP"
        if statement.trailing_12m_assets_dzd is not None and statement.trailing_12m_assets_dzd > 0:
            return statement.trailing_12m_assets_dzd, "TRAILING_12M_ASSETS"
        if statement.total_assets_dzd > 0:
            return statement.total_assets_dzd, "TOTAL_ASSETS"
        return 1.0, "FALLBACK_BASE"

    def screen_qualitative_sectors(
        self, sectors: List[str], description: str
    ) -> List[ProhibitedSector]:
        """
        Scans business sectors, tags, and product description against prohibited sectors.
        """
        detected: List[ProhibitedSector] = []
        combined_text = f"{' '.join(sectors)} {description}".lower()

        for sector, keywords in PROHIBITED_SECTOR_KEYWORDS.items():
            for kw in keywords:
                if kw in combined_text:
                    if sector not in detected:
                        detected.append(sector)
                    break
        return detected

    def calculate_tathir(
        self,
        total_revenue_dzd: float,
        non_permissible_revenue_dzd: float,
        dividend_amount_dzd: float = 0.0,
        total_shares: int = 0,
        shares_held: int = 0,
    ) -> TathirAssessment:
        """
        Calculates exact financial purification (Tathir) metrics under AAOIFI Standard 21.
        Purification Ratio = Impure Revenue / Total Revenue.
        Deduction = Dividend * Purification Ratio.
        """
        if total_revenue_dzd <= 0:
            purification_ratio = 0.0
            purification_pct = 0.0
        else:
            purification_ratio = min(1.0, max(0.0, non_permissible_revenue_dzd / total_revenue_dzd))
            purification_pct = purification_ratio * 100.0

        is_mandatory = non_permissible_revenue_dzd > 0.0

        per_share_dzd: Optional[float] = None
        total_payout_dzd: Optional[float] = None

        if dividend_amount_dzd > 0:
            if total_shares > 0:
                div_per_share = dividend_amount_dzd / total_shares
                per_share_dzd = round(div_per_share * purification_ratio, 6)
            
            if shares_held > 0 and per_share_dzd is not None:
                total_payout_dzd = round(per_share_dzd * shares_held, 2)
            else:
                total_payout_dzd = round(dividend_amount_dzd * purification_ratio, 2)

        return TathirAssessment(
            tainted_revenue_dzd=round(non_permissible_revenue_dzd, 2),
            total_revenue_dzd=round(total_revenue_dzd, 2),
            purification_ratio=round(purification_ratio, 6),
            purification_percentage=round(purification_pct, 4),
            dividend_purification_per_share_dzd=per_share_dzd,
            total_purification_for_payout_dzd=total_payout_dzd,
            is_purification_mandatory=is_mandatory,
        )

    def screen_financials(self, stmt: FinancialStatement) -> ShariaScreeningResult:
        """
        Executes full AAOIFI Standard No. 21 qualitative and quantitative screening.
        """
        denominator, denom_type = self._determine_denominator(stmt)
        notes: List[str] = []

        # 1. Qualitative screening
        prohibited_detected = self.screen_qualitative_sectors(
            stmt.business_sectors, stmt.business_description
        )
        has_prohibited = len(prohibited_detected) > 0
        if has_prohibited:
            notes.append(
                f"Prohibited industry sectors detected: {[p.value for p in prohibited_detected]}. "
                "Core business activities must be strictly halal under Sharia Standard No. 21."
            )

        # 2. Ratio screens
        debt_ratio = stmt.total_debt_dzd / denominator
        deposits_ratio = stmt.interest_bearing_deposits_dzd / denominator
        revenue_ratio = (
            (stmt.non_permissible_revenue_dzd / stmt.total_revenue_dzd)
            if stmt.total_revenue_dzd > 0
            else 0.0
        )

        debt_passed = debt_ratio < AAOIFI_MAX_DEBT_RATIO
        deposits_passed = deposits_ratio < AAOIFI_MAX_INTEREST_DEPOSITS_RATIO
        revenue_passed = revenue_ratio < AAOIFI_MAX_NON_PERMISSIBLE_REVENUE

        debt_remediation = None
        if not debt_passed:
            debt_remediation = (
                f"Debt ratio ({debt_ratio:.2%}) exceeds AAOIFI limit (33.0%). "
                "Refinance interest-bearing conventional debt via Mudarabah, Musharakah, or sovereign Sukuk facilities."
            )

        deposits_remediation = None
        if not deposits_passed:
            deposits_remediation = (
                f"Interest-bearing deposits ratio ({deposits_ratio:.2%}) exceeds AAOIFI limit (33.0%). "
                "Transfer cash reserves into non-interest checking or Islamic asset-backed treasury accounts."
            )

        revenue_remediation = None
        if not revenue_passed:
            revenue_remediation = (
                f"Tainted non-operating revenue ratio ({revenue_ratio:.2%}) exceeds permissible ceiling (5.0%). "
                "Liquidate interest-accruing instruments and immediately cleanse non-core revenue channels."
            )

        ratio_screens: List[RatioScreenResult] = [
            RatioScreenResult(
                metric_name="Interest-Bearing Debt Ratio",
                ratio=round(debt_ratio, 4),
                threshold=AAOIFI_MAX_DEBT_RATIO,
                passed=debt_passed,
                denominator_used=denom_type,
                formula=f"Total Debt ({stmt.total_debt_dzd:,.0f} DZD) / {denom_type} ({denominator:,.0f} DZD)",
                description=f"Must be strictly below 33.0% of {denom_type}.",
                remediation_guidance=debt_remediation,
            ),
            RatioScreenResult(
                metric_name="Interest-Bearing Cash & Deposits Ratio",
                ratio=round(deposits_ratio, 4),
                threshold=AAOIFI_MAX_INTEREST_DEPOSITS_RATIO,
                passed=deposits_passed,
                denominator_used=denom_type,
                formula=f"Interest Deposits ({stmt.interest_bearing_deposits_dzd:,.0f} DZD) / {denom_type} ({denominator:,.0f} DZD)",
                description=f"Must be strictly below 33.0% of {denom_type}.",
                remediation_guidance=deposits_remediation,
            ),
            RatioScreenResult(
                metric_name="Impure / Tainted Revenue Ratio",
                ratio=round(revenue_ratio, 4),
                threshold=AAOIFI_MAX_NON_PERMISSIBLE_REVENUE,
                passed=revenue_passed,
                denominator_used="TOTAL_REVENUE",
                formula=f"Non-Permissible Revenue ({stmt.non_permissible_revenue_dzd:,.0f} DZD) / Total Revenue ({stmt.total_revenue_dzd:,.0f} DZD)",
                description="Must be strictly below 5.0% of total revenue. Any impure revenue requires Tathir purification.",
                remediation_guidance=revenue_remediation,
            ),
        ]

        # 3. Calculate Tathir purification
        tathir = self.calculate_tathir(
            total_revenue_dzd=stmt.total_revenue_dzd,
            non_permissible_revenue_dzd=stmt.non_permissible_revenue_dzd,
        )

        if stmt.non_permissible_revenue_dzd > 0:
            notes.append(
                f"Purification required: {stmt.non_permissible_revenue_dzd:,.2f} DZD ({tathir.purification_percentage:.2f}% of revenue) "
                "must be donated to public charitable causes without claiming tax deductions."
            )

        # 4. Synthesize Verdict
        all_ratios_passed = debt_passed and deposits_passed and revenue_passed

        if has_prohibited or not all_ratios_passed:
            verdict = ShariaVerdict.NON_COMPLIANT
            is_compliant = False
        else:
            # Check borderline questionable threshold (within 10% of maximum tolerance)
            is_borderline = (
                debt_ratio >= QUESTIONABLE_DEBT_RATIO
                or deposits_ratio >= QUESTIONABLE_DEPOSITS_RATIO
                or revenue_ratio >= QUESTIONABLE_REVENUE_RATIO
            )
            if is_borderline:
                verdict = ShariaVerdict.QUESTIONABLE
                is_compliant = True # Conditionally permissible with ongoing supervisory review
                notes.append(
                    "Borderline quantitative ratios flagged for quarterly supervisory audit. "
                    "Financial metrics are close to AAOIFI 33%/5% ceilings."
                )
            else:
                verdict = ShariaVerdict.COMPLIANT
                is_compliant = True
                notes.append("Startup meets all AAOIFI Shariah Standard No. 21 qualitative and quantitative criteria.")

        return ShariaScreeningResult(
            is_compliant=is_compliant,
            verdict=verdict,
            debt_to_market_cap_ratio=round(debt_ratio, 4),
            interest_bearing_deposits_ratio=round(deposits_ratio, 4),
            non_permissible_revenue_ratio=round(revenue_ratio, 4),
            ratio_screens=ratio_screens,
            prohibited_sectors_detected=[p.value for p in prohibited_detected],
            purification_required_dzd=tathir.tainted_revenue_dzd,
            purification_percentage=tathir.purification_percentage,
            tathir_assessment=tathir,
            screening_notes=notes,
        )

    def generate_certificate(
        self,
        startup_id: str,
        startup_name: str,
        statement: FinancialStatement,
    ) -> ShariaCertificate:
        """
        Runs comprehensive screening and issues a cryptographically hashed Sharia Compliance Certificate.
        Uses SHA-256 over canonicalized audit metrics.
        """
        statement.startup_id = startup_id
        statement.startup_name = startup_name
        result = self.screen_financials(statement)

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=90) # Standard 90-day quarterly re-audit cycle

        audit_payload = {
            "startup_id": startup_id,
            "startup_name": startup_name,
            "verdict": result.verdict.value,
            "standards_reference": result.standards_reference,
            "debt_to_market_cap_ratio": result.debt_to_market_cap_ratio,
            "interest_bearing_deposits_ratio": result.interest_bearing_deposits_ratio,
            "non_permissible_revenue_ratio": result.non_permissible_revenue_ratio,
            "purification_required_dzd": result.purification_required_dzd,
            "prohibited_sectors_detected": result.prohibited_sectors_detected,
            "issued_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
        }

        canonical_bytes = json.dumps(audit_payload, sort_keys=True).encode("utf-8")
        audit_hash = hashlib.sha256(canonical_bytes).hexdigest()
        cert_id = f"CERT-SHARIA-{startup_id[:8].upper()}-{audit_hash[:10].upper()}"

        hasher = hashlib.sha256()
        hasher.update(f"{cert_id}:{audit_hash}:TAMWHEEL_SOVEREIGN_SHARIA_SEAL".encode("utf-8"))
        canonical_sig = hasher.hexdigest()

        return ShariaCertificate(
            certificate_id=cert_id,
            certificate_audit_hash=audit_hash,
            startup_id=startup_id,
            startup_name=startup_name,
            issued_at=now,
            expires_at=expires_at,
            verdict=result.verdict,
            standards_reference=result.standards_reference,
            screening_summary=audit_payload,
            tathir_obligations=result.tathir_assessment,
            canonical_signature=canonical_sig,
        )


sharia_compliance_engine = ShariaComplianceEngine()
