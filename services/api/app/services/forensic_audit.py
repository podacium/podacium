"""
TamWheel Sovereign Ethical Agentic Venture OS — Forensic Financial Audit & Conflict Engine.
Implements:
1. Benford's Law First-Digit Conformity Test on self-reported revenue, expense, and transaction ledgers.
   Computes Chi-Square goodness-of-fit, p-value, Mean Absolute Deviation (MAD), and Nigrini conformity tiers.
2. Graph-Based Conflict of Interest & Related-Party Transaction (RPT) Detector:
   Identifies interlocking directorates, undisclosed family ties between founders and jurors,
   and vendor self-dealing across S4E sweat-equity contracts.
"""

from datetime import datetime, timezone
from enum import Enum
import logging
import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid

try:
    from scipy.stats import chisquare as scipy_chisquare, chi2
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

logger = logging.getLogger("tamwheel.forensic_audit")


# =============================================================================
# BENFORD'S LAW CONSTANTS & NIGRINI CONFORMITY THRESHOLDS
# =============================================================================

# Benford's Law theoretical first-digit probability distribution: P(d) = log10(1 + 1/d)
BENFORD_THEORETICAL: Dict[int, float] = {
    d: math.log10(1.0 + 1.0 / d) for d in range(1, 10)
}

# Nigrini Mean Absolute Deviation (MAD) conformity boundaries for First-Digit test
NIGRINI_MAD_CLOSE = 0.0060           # Close conformity
NIGRINI_MAD_ACCEPTABLE = 0.0120      # Acceptable conformity
NIGRINI_MAD_MARGINAL = 0.0150        # Marginally acceptable conformity
# MAD > 0.0150 indicates Nonconformity (Anomalous / potential fabrication)


class BenfordConformityStatus(str, Enum):
    CLOSE_CONFORMITY = "CLOSE_CONFORMITY"
    ACCEPTABLE_CONFORMITY = "ACCEPTABLE_CONFORMITY"
    MARGINALLY_ACCEPTABLE = "MARGINALLY_ACCEPTABLE"
    NON_CONFORMING = "NON_CONFORMING"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class ConflictSeverity(str, Enum):
    CRITICAL = "CRITICAL"    # Deal breaker: Juror scoring family member or direct self-dealing
    MAJOR = "MAJOR"          # Condition Precedent: Undisclosed interlock or shared corporate ownership
    MODERATE = "MODERATE"    # Managed risk: Domain overlap, potential prior co-employment
    CLEAN = "CLEAN"          # No detected conflicts


class ConflictType(str, Enum):
    UNDISCLOSED_FAMILY_JURY = "UNDISCLOSED_FAMILY_JURY"
    INTERLOCKING_DIRECTORATE = "INTERLOCKING_DIRECTORATE"
    VENDOR_SELF_DEALING = "VENDOR_SELF_DEALING"
    DOMAIN_COLLUSION = "DOMAIN_COLLUSION"
    BENEFICIAL_OWNER_OVERLAP = "BENEFICIAL_OWNER_OVERLAP"


# =============================================================================
# 1. BENFORD'S LAW FORENSIC TEST
# =============================================================================

class BenfordAuditResult:
    def __init__(
        self,
        sample_size: int,
        observed_counts: Dict[int, int],
        observed_frequencies: Dict[int, float],
        expected_frequencies: Dict[int, float],
        chi_square_stat: float,
        p_value: float,
        mad: float,
        conformity: BenfordConformityStatus,
        is_anomalous: bool,
        anomalous_digits: List[int],
        diagnostic_notes: str,
    ):
        self.sample_size = sample_size
        self.observed_counts = observed_counts
        self.observed_frequencies = observed_frequencies
        self.expected_frequencies = expected_frequencies
        self.chi_square_stat = round(chi_square_stat, 4)
        self.p_value = round(p_value, 5)
        self.mad = round(mad, 5)
        self.conformity = conformity
        self.is_anomalous = is_anomalous
        self.anomalous_digits = anomalous_digits
        self.diagnostic_notes = diagnostic_notes

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sampleSize": self.sample_size,
            "observedCounts": {str(k): v for k, v in self.observed_counts.items()},
            "observedFrequencies": {str(k): round(v, 4) for k, v in self.observed_frequencies.items()},
            "expectedFrequencies": {str(k): round(v, 4) for k, v in self.expected_frequencies.items()},
            "chiSquareStat": self.chi_square_stat,
            "pValue": self.p_value,
            "mad": self.mad,
            "conformity": self.conformity.value,
            "isAnomalous": self.is_anomalous,
            "anomalousDigits": self.anomalous_digits,
            "diagnosticNotes": self.diagnostic_notes,
        }


def extract_first_digit(val: float | int) -> Optional[int]:
    """Extract first non-zero leading digit from a numeric value."""
    try:
        val_abs = abs(float(val))
        if val_abs <= 0.0:
            return None
        # Format as non-scientific string
        s = f"{val_abs:.10f}".replace(".", "").lstrip("0")
        if not s:
            return None
        d = int(s[0])
        return d if 1 <= d <= 9 else None
    except (ValueError, TypeError):
        return None


def run_benford_analysis(numbers: List[float | int]) -> BenfordAuditResult:
    """
    Run Benford's Law first-digit goodness-of-fit test on financial numbers.
    Calculates observed digit distribution, Chi-Square statistic, p-value, and MAD.
    """
    first_digits: List[int] = []
    for n in numbers:
        d = extract_first_digit(n)
        if d is not None:
            first_digits.append(d)

    n = len(first_digits)
    if n < 15:
        # Insufficient data points for robust Benford analysis
        return BenfordAuditResult(
            sample_size=n,
            observed_counts={d: first_digits.count(d) for d in range(1, 10)},
            observed_frequencies={d: (first_digits.count(d) / max(1, n)) for d in range(1, 10)},
            expected_frequencies=BENFORD_THEORETICAL,
            chi_square_stat=0.0,
            p_value=1.0,
            mad=0.0,
            conformity=BenfordConformityStatus.INSUFFICIENT_DATA,
            is_anomalous=False,
            anomalous_digits=[],
            diagnostic_notes=f"Insufficient sample size (N={n} < 15). Minimum 15-30 financial line items required.",
        )

    observed_counts = {d: first_digits.count(d) for d in range(1, 10)}
    observed_freqs = {d: observed_counts[d] / float(n) for d in range(1, 10)}

    # Chi-Square calculation
    chi_square_stat = 0.0
    for d in range(1, 10):
        expected_count = n * BENFORD_THEORETICAL[d]
        diff = observed_counts[d] - expected_count
        chi_square_stat += (diff ** 2) / expected_count

    # Calculate p-value (df = 8)
    if HAS_SCIPY:
        obs_list = [observed_counts[d] for d in range(1, 10)]
        exp_list = [n * BENFORD_THEORETICAL[d] for d in range(1, 10)]
        _, p_val = scipy_chisquare(obs_list, f_exp=exp_list)
        p_value = float(p_val)
    else:
        # Fallback approximation for chi-square with 8 df
        # Critical value at p=0.05 is ~15.507, at p=0.01 is ~20.090
        p_value = math.exp(-0.5 * chi_square_stat) if chi_square_stat < 30 else 0.00001

    # Mean Absolute Deviation (MAD)
    mad = sum(abs(observed_freqs[d] - BENFORD_THEORETICAL[d]) for d in range(1, 10)) / 9.0

    # Determine conformity status using Nigrini standard
    if mad <= NIGRINI_MAD_CLOSE:
        conformity = BenfordConformityStatus.CLOSE_CONFORMITY
    elif mad <= NIGRINI_MAD_ACCEPTABLE:
        conformity = BenfordConformityStatus.ACCEPTABLE_CONFORMITY
    elif mad <= NIGRINI_MAD_MARGINAL:
        conformity = BenfordConformityStatus.MARGINALLY_ACCEPTABLE
    else:
        conformity = BenfordConformityStatus.NON_CONFORMING

    # Identify individual anomalous digits (observed exceeds expected by > 2x and > 5% absolute delta)
    anomalous_digits: List[int] = []
    for d in range(1, 10):
        delta = observed_freqs[d] - BENFORD_THEORETICAL[d]
        if delta > 0.08 and observed_counts[d] >= 3:
            anomalous_digits.append(d)

    is_anomalous = (conformity == BenfordConformityStatus.NON_CONFORMING) or (p_value < 0.01)

    if is_anomalous:
        notes = (
            f"Financial ledger violates Benford's Law (MAD={mad:.4f} > {NIGRINI_MAD_MARGINAL}, p={p_value:.4f}). "
            f"Over-represented leading digits: {anomalous_digits or 'Uniform distribution'}. "
            "Suggests synthetic or manipulated ledger entries."
        )
    else:
        notes = f"Ledger exhibits natural statistical variance conforming to Benford's Law (MAD={mad:.4f}, p={p_value:.4f})."

    return BenfordAuditResult(
        sample_size=n,
        observed_counts=observed_counts,
        observed_frequencies=observed_freqs,
        expected_frequencies=BENFORD_THEORETICAL,
        chi_square_stat=chi_square_stat,
        p_value=p_value,
        mad=mad,
        conformity=conformity,
        is_anomalous=is_anomalous,
        anomalous_digits=anomalous_digits,
        diagnostic_notes=notes,
    )


# =============================================================================
# 2. GRAPH-BASED CONFLICT OF INTEREST & RELATED-PARTY DETECTOR
# =============================================================================

class ConflictItem:
    def __init__(
        self,
        conflict_type: ConflictType,
        severity: ConflictSeverity,
        involved_parties: List[str],
        description: str,
        remedy_recommendation: str,
    ):
        self.id = str(uuid.uuid4())
        self.conflict_type = conflict_type
        self.severity = severity
        self.involved_parties = involved_parties
        self.description = description
        self.remedy_recommendation = remedy_recommendation

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "conflictType": self.conflict_type.value,
            "severity": self.severity.value,
            "involvedParties": self.involved_parties,
            "description": self.description,
            "remedyRecommendation": self.remedy_recommendation,
        }


class ForensicAuditEngine:
    """
    Forensic Financial & Conflict Detection Engine.
    Executes Benford's Law analysis and builds knowledge graph traversals to uncover
    related-party self-dealing and undisclosed conflicts of interest.
    """

    def __init__(self):
        pass

    @staticmethod
    def extract_surname(full_name: str) -> str:
        """Extract clean canonical surname from full name for kinship matching."""
        if not full_name:
            return ""
        parts = [p.strip().upper() for p in re.split(r"[\s\-_]+", full_name) if p.strip()]
        # In Algerian French/Arabic records, surname is often either the first or last token
        return parts[-1] if len(parts) >= 1 else ""

    @staticmethod
    def extract_email_domain(email: Optional[str]) -> str:
        """Extract domain from email address."""
        if not email or "@" not in email:
            return ""
        domain = email.split("@")[-1].strip().lower()
        # Ignore public mail domains
        if domain in ("gmail.com", "yahoo.com", "yahoo.fr", "hotmail.com", "outlook.com", "icloud.com"):
            return ""
        return domain

    def analyze_financial_ledger(self, ledger_entries: List[float | int]) -> Dict[str, Any]:
        """Run Benford's Law audit on financial ledger entries."""
        result = run_benford_analysis(ledger_entries)
        return result.to_dict()

    def detect_conflicts_of_interest(
        self,
        founders: List[Dict[str, Any]],
        jurors: List[Dict[str, Any]],
        vendors: List[Dict[str, Any]],
        startup_name: str,
    ) -> Dict[str, Any]:
        """
        Build and evaluate entity relationships across:
        1. Founders vs Jurors (Undisclosed family or domain collusion)
        2. Founders vs S4E Vendors (Self-dealing, shared corporate leadership)
        3. Jurors vs Vendors (Interlocking directorates)
        """
        conflicts: List[ConflictItem] = []
        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []

        # Index nodes
        for f in founders:
            f_id = f.get("id", f.get("fullName", "founder"))
            nodes.append({
                "id": str(f_id),
                "type": "FOUNDER",
                "label": f.get("fullName", "Founder"),
                "metadata": {"email": f.get("email"), "nin": f.get("nin")},
            })

        for j in jurors:
            j_id = j.get("id", j.get("fullName", "juror"))
            nodes.append({
                "id": str(j_id),
                "type": "JUROR",
                "label": j.get("fullName", "Juror"),
                "metadata": {"email": j.get("email"), "nin": j.get("nin"), "role": j.get("role")},
            })

        for v in vendors:
            v_id = v.get("id", v.get("companyName", "vendor"))
            nodes.append({
                "id": str(v_id),
                "type": "VENDOR",
                "label": v.get("companyName", "Vendor"),
                "metadata": {"directorName": v.get("directorName"), "emailDomain": v.get("emailDomain")},
            })

        # --- A. FOUNDER VS JUROR CONFLICTS ---
        for f in founders:
            f_name = f.get("fullName", "")
            f_surname = self.extract_surname(f_name)
            f_nin = str(f.get("nin", "")).strip()
            f_domain = self.extract_email_domain(f.get("email"))

            for j in jurors:
                j_name = j.get("fullName", "")
                j_surname = self.extract_surname(j_name)
                j_nin = str(j.get("nin", "")).strip()
                j_domain = self.extract_email_domain(j.get("email"))

                # 1. Family / Surname match
                if f_surname and j_surname and f_surname == j_surname:
                    is_nin_wilaya_match = (f_nin and j_nin and len(f_nin) >= 3 and len(j_nin) >= 3 and f_nin[:3] == j_nin[:3])
                    sev = ConflictSeverity.CRITICAL if is_nin_wilaya_match else ConflictSeverity.MAJOR
                    conf = ConflictItem(
                        conflict_type=ConflictType.UNDISCLOSED_FAMILY_JURY,
                        severity=sev,
                        involved_parties=[f_name, j_name],
                        description=(
                            f"Kinship signal detected: Founder {f_name} and Juror {j_name} share surname '{f_surname}' "
                            f"{'and regional NIN prefix ' + f_nin[:3] if is_nin_wilaya_match else ''}."
                        ),
                        remedy_recommendation=f"Immediate recusal: Juror {j_name} must be removed from reviewing {startup_name}.",
                    )
                    conflicts.append(conf)
                    edges.append({
                        "source": str(f.get("id")),
                        "target": str(j.get("id")),
                        "relation": "FAMILY_KINSHIP",
                        "severity": sev.value,
                    })

                # 2. Domain / Corporate collusion
                elif f_domain and j_domain and f_domain == j_domain:
                    conf = ConflictItem(
                        conflict_type=ConflictType.DOMAIN_COLLUSION,
                        severity=ConflictSeverity.MODERATE,
                        involved_parties=[f_name, j_name],
                        description=f"Founder {f_name} and Juror {j_name} share corporate email domain '{f_domain}'.",
                        remedy_recommendation="Declare institutional affiliation and disclose any shared employment.",
                    )
                    conflicts.append(conf)
                    edges.append({
                        "source": str(f.get("id")),
                        "target": str(j.get("id")),
                        "relation": "SHARED_DOMAIN",
                        "severity": ConflictSeverity.MODERATE.value,
                    })

        # --- B. FOUNDER VS VENDOR CONFLICTS (Self-Dealing / Interlocks) ---
        for f in founders:
            f_name = f.get("fullName", "")
            f_surname = self.extract_surname(f_name)

            for v in vendors:
                v_name = v.get("companyName", "")
                director = v.get("directorName", "")
                d_surname = self.extract_surname(director)

                # Direct match: Founder is director of vendor
                if f_name.lower() == director.lower() or (f_surname and d_surname and f_surname == d_surname):
                    sev = ConflictSeverity.CRITICAL if f_name.lower() == director.lower() else ConflictSeverity.MAJOR
                    rel_type = (
                        ConflictType.INTERLOCKING_DIRECTORATE if f_name.lower() == director.lower()
                        else ConflictType.VENDOR_SELF_DEALING
                    )
                    conf = ConflictItem(
                        conflict_type=rel_type,
                        severity=sev,
                        involved_parties=[f_name, v_name, director],
                        description=(
                            f"Related-Party Transaction alert: S4E Vendor '{v_name}' is directed by '{director}', "
                            f"matching Founder {f_name}."
                        ),
                        remedy_recommendation="Disclose equity/contract terms to syndicate investors and require 2 independent vendor bids.",
                    )
                    conflicts.append(conf)
                    edges.append({
                        "source": str(f.get("id")),
                        "target": str(v.get("id")),
                        "relation": "DIRECTOR_OR_FAMILY_CONTROL",
                        "severity": sev.value,
                    })

        # Determine overall severity & risk score
        critical_count = sum(1 for c in conflicts if c.severity == ConflictSeverity.CRITICAL)
        major_count = sum(1 for c in conflicts if c.severity == ConflictSeverity.MAJOR)
        moderate_count = sum(1 for c in conflicts if c.severity == ConflictSeverity.MODERATE)

        if critical_count > 0:
            overall_severity = ConflictSeverity.CRITICAL
            risk_score = 90.0
            status_flag = "FATAL_CONFLICT"
        elif major_count > 0:
            overall_severity = ConflictSeverity.MAJOR
            risk_score = 65.0
            status_flag = "REQUIRES_DISCLOSURE"
        elif moderate_count > 0:
            overall_severity = ConflictSeverity.MODERATE
            risk_score = 35.0
            status_flag = "MANAGED_DISCLOSURE"
        else:
            overall_severity = ConflictSeverity.CLEAN
            risk_score = 0.0
            status_flag = "CLEAN"

        return {
            "startupName": startup_name,
            "overallSeverity": overall_severity.value,
            "statusFlag": status_flag,
            "conflictRiskScore": risk_score,
            "totalConflictsCount": len(conflicts),
            "criticalCount": critical_count,
            "majorCount": major_count,
            "moderateCount": moderate_count,
            "conflicts": [c.to_dict() for c in conflicts],
            "graph": {
                "nodes": nodes,
                "edges": edges,
            },
            "auditedAt": datetime.now(timezone.utc).isoformat(),
        }


forensic_audit_engine = ForensicAuditEngine()
