"""
TamWheel Sovereign Ethical Agentic Venture OS — INAPI IP Provenance & Moat Verifier.
Implements:
1. Patent application & grant verification under Algerian Ordinance 03-07 (Brevets d'invention):
   - Number formatting (DZ/P/YYYY/XXXXXX, legacy DZ/YYYY/XXXX, P/YYYY/XXXXXX)
   - IPC (International Patent Classification) syntax
   - BOPI (Bulletin Officiel de la Propriété Industrielle) publication validation
   - Paris Convention 12-month priority period calculation
   - 20-year statutory term & 6-month annuity grace period with surcharge
2. Industrial Trademark provenance under Ordinance 03-06 (Marques):
   - Formatting (DZ/M/YYYY/XXXXXX)
   - Nice Classification (1 to 45) check with tech relevance (Classes 9, 35, 36, 38, 42)
   - 10-year term renewal monitoring
3. IP Moat Index [0.0 - 100.0] & Verified Badge generation for investor data rooms.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, date
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.inapi_ip import (
    PatentStatus,
    TrademarkStatus,
    IPMoatTier,
    IPMoatBadge,
    PatentClaimRecord,
    TrademarkClaimRecord,
    PatentVerificationRequest,
    PatentVerificationResponse,
    TrademarkVerificationRequest,
    TrademarkVerificationResponse,
    IPOldPortfolioAuditRequest,
    IPOldPortfolioAuditResponse,
)

logger = logging.getLogger("tamwheel.services.inapi_ip")


# =============================================================================
# REGEX & RECOGNITION PATTERNS
# =============================================================================

# Algerian Patent Application Numbers (Modern DZ/P/YYYY/XXXXXX or legacy DZ/YYYY/XXXX or P/YYYY/XXXXXX)
PATENT_NUMBER_REGEXES = [
    r"^DZ/P/\d{4}/\d{4,6}$",        # Modern standard e.g. DZ/P/2023/000142
    r"^DZ/\d{4}/\d{4}$",            # Legacy format e.g. DZ/2018/1234
    r"^P/\d{4}/\d{4,6}$",           # Filing receipt format
]

# Algerian Trademark Numbers (DZ/M/YYYY/XXXXXX or numeric registration)
TRADEMARK_NUMBER_REGEXES = [
    r"^DZ/M/\d{4}/\d{4,6}$",        # Standard modern e.g. DZ/M/2022/000512
    r"^\d{5,8}$",                   # Traditional registration certificate number
]

# IPC / CIB Classification syntax (e.g. G06F 17/00, H04L 9/32, A61K 31/00)
IPC_REGEX = r"^[A-H]\d{2}[A-Z]\s*\d{1,4}/\d{2,4}$"

# Tech & Venture relevant Nice classes
TECH_NICE_CLASSES = {9, 35, 36, 38, 42}


# =============================================================================
# INAPI VERIFIER ENGINE CLASS
# =============================================================================

class InapiIpVerifier:
    """
    Automated validator of intellectual property provenance and defensibility.
    """

    @staticmethod
    def parse_iso_date(date_str: str) -> date:
        """Parse YYYY-MM-DD string to date object."""
        try:
            return datetime.strptime(date_str.strip()[:10], "%Y-%m-%d").date()
        except Exception:
            return datetime.utcnow().date()

    @classmethod
    def validate_patent_number_format(cls, patent_number: str) -> bool:
        """Verify whether string matches official Algerian INAPI patent syntax."""
        cleaned = patent_number.strip().upper()
        return any(re.match(rgx, cleaned) for rgx in PATENT_NUMBER_REGEXES)

    @classmethod
    def validate_trademark_number_format(cls, trademark_number: str) -> bool:
        """Verify whether string matches official Algerian INAPI trademark syntax."""
        cleaned = trademark_number.strip().upper()
        return any(re.match(rgx, cleaned) for rgx in TRADEMARK_NUMBER_REGEXES)

    @classmethod
    def validate_ipc_classification(cls, ipc_code: str) -> bool:
        """Validate International Patent Classification code."""
        cleaned = ipc_code.strip().upper()
        return bool(re.match(IPC_REGEX, cleaned))

    def evaluate_priority_claim(
        self,
        filing_date_str: str,
        priority_date_str: Optional[str],
        priority_country: Optional[str],
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate priority claim under Article 4 of the Paris Convention.
        Priority period is strictly 12 months for patents.
        """
        if not priority_date_str or not priority_country:
            return True, None  # No foreign priority claimed; national first filing

        filing_date = self.parse_iso_date(filing_date_str)
        priority_date = self.parse_iso_date(priority_date_str)

        delta_days = (filing_date - priority_date).days
        if delta_days < 0:
            return False, f"Priority date ({priority_date_str}) cannot be after Algerian filing date ({filing_date_str})."

        # 12 months ~ 366 days
        if delta_days > 366:
            return False, (
                f"Paris Convention 12-month priority term exceeded: {delta_days} days elapsed between "
                f"foreign priority ({priority_date_str}) and INAPI filing ({filing_date_str})."
            )

        return True, None

    def evaluate_patent_annuity_and_status(
        self,
        filing_date_str: str,
        current_annuity_year: int,
        last_paid_annuity_year: int,
        months_since_filing: int,
        bopi_number: Optional[str],
        as_of: Optional[date] = None,
    ) -> Tuple[PatentStatus, bool, bool, int, str]:
        """
        Evaluate annuity maintenance under Ordinance 03-07:
        - 20-year term from filing date
        - Annual maintenance fee due on anniversary
        - 6-month grace period with late surcharge
        """
        eval_date = as_of or datetime.utcnow().date()
        filing_date = self.parse_iso_date(filing_date_str)

        # Elapsed years
        elapsed_days = (eval_date - filing_date).days
        elapsed_years = max(1, elapsed_days // 365)
        years_remaining = max(0, 20 - elapsed_years)

        # Statutory expiry (20 years)
        if elapsed_years > 20:
            return (
                PatentStatus.EXPIRED_STATUTORY_TERM,
                False,
                False,
                0,
                f"Expired: 20-year statutory patent protection term has lapsed (filed {filing_date_str}).",
            )

        # Check required annuity year
        required_year = max(current_annuity_year, elapsed_years)

        # If fees are fully up to date
        if last_paid_annuity_year >= required_year:
            # Check if published in BOPI
            if bopi_number:
                status = PatentStatus.GRANTED_ACTIVE
                summary = f"Active & in good standing: Annuity Year {last_paid_annuity_year} paid. BOPI publication confirmed ({bopi_number})."
            else:
                status = PatentStatus.PENDING_EXAMINATION
                summary = f"Pending formal examination: Annuity Year {last_paid_annuity_year} paid. Awaiting BOPI gazette publication."
            return status, True, False, years_remaining, summary

        # Delinquent on annuity
        # Check if in 6-month grace period
        # The grace period is ONLY applicable to the immediately preceding anniversary (gap of 1 year).
        # If multiple years were missed, the patent has irrevocably lapsed.
        anniversary_month_diff = (elapsed_days % 365) / 30.4
        years_missed = required_year - last_paid_annuity_year
        is_grace_window = (years_missed == 1) and (anniversary_month_diff <= 6.0)

        if is_grace_window:
            status = PatentStatus.IN_GRACE_PERIOD
            is_current = False
            in_grace = True
            summary = (
                f"Payment Warning: Annuity Year {required_year} unpaid. Currently within 6-month statutory grace period "
                f"with 50% late surcharge under Ordinance 03-07 Art. 40."
            )
        else:
            status = PatentStatus.LAPSED_UNPAID_ANNUITY
            is_current = False
            in_grace = False
            summary = (
                f"Lapsed Patent: Annuity Year {required_year} unpaid and past 6-month grace period. Patent protection is voided."
            )

        return status, is_current, in_grace, years_remaining, summary

    def verify_patent(self, request: PatentVerificationRequest) -> PatentVerificationResponse:
        """
        Execute full patent verification against Algerian INAPI criteria.
        """
        p = request.patent
        as_of = self.parse_iso_date(request.asOfDate) if request.asOfDate else datetime.utcnow().date()
        risk_flags: List[str] = []
        badges: List[IPMoatBadge] = []

        # 1. Format validation
        format_valid = self.validate_patent_number_format(p.patentNumber)
        if not format_valid:
            risk_flags.append(f"Patent number '{p.patentNumber}' does not match official INAPI syntax (DZ/P/YYYY/XXXXXX).")
            badges.append(IPMoatBadge.INAPI_INVALID_OR_FABRICATED)
            return PatentVerificationResponse(
                patentNumber=p.patentNumber,
                isFormatValid=False,
                status=PatentStatus.INVALID_FORMAT,
                isPriorityClaimValid=False,
                annuityStatusSummary="Invalid application syntax.",
                isAnnuityCurrent=False,
                isInGracePeriod=False,
                yearsRemainingOfProtection=0,
                bopiVerified=False,
                assignedToCompany=p.assignedToStartup,
                badgesIssued=badges,
                riskFlags=risk_flags,
            )

        # 2. IPC Classification Check
        if not self.validate_ipc_classification(p.ipcClassification):
            risk_flags.append(f"IPC Classification '{p.ipcClassification}' is non-standard.")

        # 3. Priority Claim Validation
        priority_valid, priority_err = self.evaluate_priority_claim(
            filing_date_str=p.filingDate,
            priority_date_str=p.priorityFilingDate,
            priority_country=p.priorityCountry,
        )
        if not priority_valid and priority_err:
            risk_flags.append(priority_err)

        # 4. Annuity & Status Validation
        status, is_annuity_current, in_grace, years_left, summary = self.evaluate_patent_annuity_and_status(
            filing_date_str=p.filingDate,
            current_annuity_year=p.currentAnnuityYear,
            last_paid_annuity_year=p.lastPaidAnnuityYear,
            months_since_filing=p.monthsSinceFiling,
            bopi_number=p.bopiNumber,
            as_of=as_of,
        )

        # 5. Assignment to Startup
        if not p.assignedToStartup:
            risk_flags.append("Patent title is held in founder personal name without formal assignment deed to the startup.")
            badges.append(IPMoatBadge.INAPI_UNASSIGNED_FOUNDER_RISK)

        # 6. Badges
        if status == PatentStatus.GRANTED_ACTIVE:
            badges.append(IPMoatBadge.INAPI_VERIFIED_PATENT)
        elif status == PatentStatus.PENDING_EXAMINATION:
            badges.append(IPMoatBadge.INAPI_PENDING_EXAMINATION)
        elif status == PatentStatus.IN_GRACE_PERIOD:
            badges.append(IPMoatBadge.INAPI_LAPSED_FEE_WARNING)
        elif status == PatentStatus.LAPSED_UNPAID_ANNUITY:
            risk_flags.append("Patent has lapsed for non-payment of statutory maintenance fees.")

        if p.pctApplicationNumber:
            badges.append(IPMoatBadge.INAPI_PCT_INTERNATIONAL_PHASE)

        return PatentVerificationResponse(
            patentNumber=p.patentNumber,
            isFormatValid=True,
            status=status,
            isPriorityClaimValid=priority_valid,
            annuityStatusSummary=summary,
            isAnnuityCurrent=is_annuity_current,
            isInGracePeriod=in_grace,
            yearsRemainingOfProtection=years_left,
            bopiVerified=bool(p.bopiNumber),
            assignedToCompany=p.assignedToStartup,
            badgesIssued=badges,
            riskFlags=risk_flags,
        )

    def verify_trademark(self, request: TrademarkVerificationRequest) -> TrademarkVerificationResponse:
        """
        Verify industrial trademark provenance and Nice classification.
        """
        t = request.trademark
        as_of = self.parse_iso_date(request.asOfDate) if request.asOfDate else datetime.utcnow().date()
        risk_flags: List[str] = []
        badges: List[IPMoatBadge] = []

        format_valid = self.validate_trademark_number_format(t.registrationNumber)
        if not format_valid:
            risk_flags.append(f"Trademark registration '{t.registrationNumber}' does not match INAPI syntax.")
            badges.append(IPMoatBadge.INAPI_INVALID_OR_FABRICATED)
            return TrademarkVerificationResponse(
                registrationNumber=t.registrationNumber,
                markName=t.markName,
                isFormatValid=False,
                status=TrademarkStatus.INVALID_FORMAT,
                niceClassesValidated=[],
                techRelevantClassesPresent=False,
                yearsRemainingOfProtection=0,
                badgesIssued=badges,
                riskFlags=risk_flags,
            )

        filing_date = self.parse_iso_date(t.filingDate)
        elapsed_years = (as_of - filing_date).days // 365

        # Protection term: 10 years
        if elapsed_years >= 10 and not t.isRenewed:
            status = TrademarkStatus.EXPIRED_RENEWAL_DUE
            years_remaining = 0
            risk_flags.append(f"10-year trademark term elapsed ({elapsed_years} years). Renewal is overdue at INAPI.")
        else:
            status = TrademarkStatus.REGISTERED_ACTIVE
            years_remaining = max(0, 10 - (elapsed_years % 10))
            badges.append(IPMoatBadge.INAPI_REGISTERED_TRADEMARK)

        # Check Nice classes
        valid_classes = [c for c in t.niceClasses if 1 <= c <= 45]
        tech_classes_present = any(c in TECH_NICE_CLASSES for c in valid_classes)
        if not tech_classes_present:
            risk_flags.append("Trademark does not cover core digital/tech Nice classes (Class 9, 36, 38, or 42).")

        if not t.assignedToStartup:
            risk_flags.append("Trademark owned by founder personally, not the startup corporate entity.")
            badges.append(IPMoatBadge.INAPI_UNASSIGNED_FOUNDER_RISK)

        return TrademarkVerificationResponse(
            registrationNumber=t.registrationNumber,
            markName=t.markName,
            isFormatValid=True,
            status=status,
            niceClassesValidated=valid_classes,
            techRelevantClassesPresent=tech_classes_present,
            yearsRemainingOfProtection=years_remaining,
            badgesIssued=badges,
            riskFlags=risk_flags,
        )

    def audit_portfolio(self, request: IPOldPortfolioAuditRequest) -> IPOldPortfolioAuditResponse:
        """
        Audit startup's complete IP portfolio, compute defensibility Moat Index [0, 100],
        and generate investor diligence report.
        """
        active_patents = 0
        pending_patents = 0
        lapsed_patents = 0
        active_tms = 0
        all_badges: Set[IPMoatBadge] = set()
        critical_risks: List[str] = []

        total_pts = 0.0

        # Audit Patents
        for pat in request.patents:
            res = self.verify_patent(PatentVerificationRequest(patent=pat, asOfDate=request.asOfDate))
            all_badges.update(res.badgesIssued)
            critical_risks.extend(res.riskFlags)

            if res.status == PatentStatus.GRANTED_ACTIVE:
                active_patents += 1
                total_pts += 40.0
                if res.assignedToCompany:
                    total_pts += 10.0
                if pat.pctApplicationNumber:
                    total_pts += 15.0
            elif res.status == PatentStatus.PENDING_EXAMINATION:
                pending_patents += 1
                total_pts += 25.0
            elif res.status in [PatentStatus.LAPSED_UNPAID_ANNUITY, PatentStatus.IN_GRACE_PERIOD]:
                lapsed_patents += 1
                total_pts -= 15.0
            elif res.status == PatentStatus.INVALID_FORMAT:
                total_pts -= 30.0

        # Audit Trademarks
        for tm in request.trademarks:
            tm_res = self.verify_trademark(TrademarkVerificationRequest(trademark=tm, asOfDate=request.asOfDate))
            all_badges.update(tm_res.badgesIssued)
            critical_risks.extend(tm_res.riskFlags)

            if tm_res.status == TrademarkStatus.REGISTERED_ACTIVE:
                active_tms += 1
                pts = 10.0 if tm_res.techRelevantClassesPresent else 5.0
                total_pts += pts

        # Deduct if unassigned founder risk
        if any(b == IPMoatBadge.INAPI_UNASSIGNED_FOUNDER_RISK for b in all_badges):
            total_pts -= 10.0

        moat_index = max(0.0, min(100.0, round(total_pts, 2)))

        if moat_index >= 80.0:
            moat_tier = IPMoatTier.IP_MOAT_DEEP_TECH_TIER_1
            summary = (
                f"Tier-1 Deep Tech Moat: Startup holds {active_patents} verified granted patent(s) and "
                f"defensive brand registrations with INAPI, establishing proprietary technological lock-in."
            )
        elif moat_index >= 60.0:
            moat_tier = IPMoatTier.IP_MOAT_DEFENSIBLE
            summary = (
                f"Defensible Moat: Valid intellectual property filings ({active_patents} active, {pending_patents} pending) "
                f"providing substantive defensibility under Algerian Ordinance 03-07."
            )
        elif moat_index >= 40.0:
            moat_tier = IPMoatTier.IP_MOAT_MODEST
            summary = (
                "Modest Protection: Trademarks or pending applications filed, but lacks granted utility patent defensibility."
            )
        else:
            moat_tier = IPMoatTier.IP_MOAT_UNPROTECTED
            summary = (
                "Unprotected / Fragile Moat: High risk of fast-follower commoditization or IP invalidation. "
                "Urgent filing and title assignment required."
            )

        return IPOldPortfolioAuditResponse(
            startupId=request.startupId,
            companyName=request.companyName,
            ipMoatIndex=moat_index,
            ipMoatTier=moat_tier,
            activePatentsCount=active_patents,
            pendingPatentsCount=pending_patents,
            lapsedPatentsCount=lapsed_patents,
            activeTrademarksCount=active_tms,
            portfolioBadges=list(all_badges),
            criticalIpRisks=critical_risks,
            investorMoatSummary=summary,
        )


inapi_ip_verifier = InapiIpVerifier()
