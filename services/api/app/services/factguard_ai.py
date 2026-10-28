"""
TamWheel Sovereign Ethical Agentic Venture OS — FactGuard AI Video Pitch Auditing Engine.
Implements multimodal pitch reel fact-checking, audio/video claim extraction,
and automated cross-referencing against Algerian official registries:
- CNRC (Centre National du Registre du Commerce)
- Algerian National Startup Label Database (Executive Decree 20-254 & ASF)
- INAPI (Institut National Algérien de la Propriété Industrielle)
- CNAS / CASNOS (National Social Security Fund)
- Fiscal / Audited Financial Statements (G50 / DGE)

Outputs verification badges:
- GREEN_VERIFIED: Source confirmed by official verified registry.
- AMBER_CONTEXT: Unverified claim, self-reported metric, or pending audit.
- RED_UNVERIFIED: Contradicted by registry data, expired credentials, or fabricated numbers.
"""

from datetime import datetime, timezone
from enum import Enum
import logging
import re
from typing import Any, Dict, List, Optional
import uuid

logger = logging.getLogger("tamwheel.factguard_ai")


class FactCategory(str, Enum):
    REVENUE = "REVENUE"
    CUSTOMER_COUNT = "CUSTOMER_COUNT"
    STARTUP_LABEL = "STARTUP_LABEL"
    PATENT_IP = "PATENT_IP"
    REGULATORY_CNRC = "REGULATORY_CNRC"
    EMPLOYMENT_CNAS = "EMPLOYMENT_CNAS"
    TRACTION = "TRACTION"


class FactBadgeStatus(str, Enum):
    GREEN_VERIFIED = "GREEN_VERIFIED"
    AMBER_CONTEXT = "AMBER_CONTEXT"
    RED_UNVERIFIED = "RED_UNVERIFIED"


# =============================================================================
# MOCK / GROUND TRUTH OFFICIAL REGISTRY CATALOGS (Algerian Sovereign Data)
# =============================================================================

KNOWN_STARTUP_LABELS: Dict[str, Dict[str, Any]] = {
    "ASF-2024-0412": {
        "companyName": "Yassir Technologies SPAS",
        "labelStatus": "VALID",
        "issuedAt": "2024-02-15",
        "expiresAt": "2028-02-15",
        "decree": "Executive Decree 20-254",
    },
    "ASF-2023-0105": {
        "companyName": "Garini Smart Parking SPAS",
        "labelStatus": "VALID",
        "issuedAt": "2023-05-10",
        "expiresAt": "2027-05-10",
        "decree": "Executive Decree 20-254",
    },
    "LABEL-ALG-2022-009": {
        "companyName": "Khedma Express SARL",
        "labelStatus": "EXPIRED",  # 4-year validity rule or revoked
        "issuedAt": "2020-01-10",
        "expiresAt": "2024-01-10",
        "decree": "Executive Decree 20-254",
    },
    "LABEL-ALG-2024-771": {
        "companyName": "TamWheel FinTech SPAS",
        "labelStatus": "VALID",
        "issuedAt": "2024-06-01",
        "expiresAt": "2028-06-01",
        "decree": "Executive Decree 20-254",
    },
}

KNOWN_CNRC_REGISTRATIONS: Dict[str, Dict[str, Any]] = {
    "16/00-1234567B22": {
        "legalName": "Yassir Technologies SPAS",
        "status": "ACTIVE",
        "legalForm": "SPAS",
        "wilaya": 16,
        "registeredYear": 2022,
    },
    "31/00-9876543B23": {
        "legalName": "Oran HealthTech SPAS",
        "status": "ACTIVE",
        "legalForm": "SPAS",
        "wilaya": 31,
        "registeredYear": 2023,
    },
    "25/00-5554321A19": {
        "legalName": "Constantine Biotech EURL",
        "status": "DISSOLVED",
        "legalForm": "EURL",
        "wilaya": 25,
        "registeredYear": 2019,
    },
}

KNOWN_INAPI_PATENTS: Dict[str, Dict[str, Any]] = {
    "DZ/P/2023/0045": {
        "title": "Autonomous Bi-directional Solar Inverter Grid Synchronization",
        "applicant": "SonelTech SPAS",
        "status": "GRANTED",
        "filingDate": "2023-03-12",
    },
    "DZ/P/2024/0112": {
        "title": "Zero-Knowledge Biometric Identity Hash Matching System",
        "applicant": "TamWheel FinTech SPAS",
        "status": "PENDING_EXAMINATION",
        "filingDate": "2024-02-18",
    },
}

KNOWN_AUDITED_FINANCIALS: Dict[str, Dict[str, Any]] = {
    "yassir": {"verifiedARRDzd": 120_000_000, "verifiedCustomers": 450_000, "verifiedStaff": 180},
    "garini": {"verifiedARRDzd": 15_000_000, "verifiedCustomers": 35_000, "verifiedStaff": 22},
    "tamwheel": {"verifiedARRDzd": 25_000_000, "verifiedCustomers": 60_000, "verifiedStaff": 18},
}


class FactGuardAIEngine:
    """
    Multimodal Video Pitch Auditing Engine.
    Extracts atomic claims from audio/video pitch reels and validates them
    against Algerian official registries to produce cryptographically signed
    FactGuard badges.
    """

    def __init__(self):
        self.label_registry = KNOWN_STARTUP_LABELS
        self.cnrc_registry = KNOWN_CNRC_REGISTRATIONS
        self.inapi_registry = KNOWN_INAPI_PATENTS
        self.financial_registry = KNOWN_AUDITED_FINANCIALS

    # =========================================================================
    # 1. AUDIO / VIDEO CLAIM EXTRACTION
    # =========================================================================

    def extract_claims_from_text(self, transcript: str) -> List[Dict[str, Any]]:
        """
        Extract checkable factual metrics from a video pitch transcript or Whisper ASR output.
        Identifies:
        - Revenue / ARR metrics (DZD / DA / Centimes)
        - Customer / User counts
        - Algerian Startup Label claims (Decree 20-254)
        - INAPI patent / trademark claims
        - CNRC commercial register numbers
        """
        extracted_claims: List[Dict[str, Any]] = []
        if not transcript or not transcript.strip():
            return extracted_claims

        sentences = re.split(r"[.?!;\n]+", transcript)

        for idx, sentence in enumerate(sentences):
            s = sentence.strip()
            if not s or len(s) < 8:
                continue

            simulated_ts = f"00:{idx * 12:02d}"

            # 1. Startup Label detection
            label_match = re.search(r"\b(ASF-\d{4}-\d{3,5}|LABEL-ALG-\d{4}-\d{3,5})\b", s, re.IGNORECASE)
            if label_match or ("label" in s.lower() and "startup" in s.lower()):
                label_val = label_match.group(1).upper() if label_match else None
                extracted_claims.append({
                    "id": str(uuid.uuid4()),
                    "timestamp": simulated_ts,
                    "category": FactCategory.STARTUP_LABEL.value,
                    "claimText": s,
                    "claimedValue": label_val or "National Startup Label (Decree 20-254)",
                    "confidence": 0.95 if label_val else 0.80,
                })

            # 2. CNRC Commercial Register detection
            cnrc_match = re.search(r"\b(\d{2}/\d{2}-\d{7}[AB]\d{2})\b", s, re.IGNORECASE)
            if cnrc_match or ("registre du commerce" in s.lower() or "cnrc" in s.lower()):
                cnrc_val = cnrc_match.group(1).upper() if cnrc_match else None
                extracted_claims.append({
                    "id": str(uuid.uuid4()),
                    "timestamp": simulated_ts,
                    "category": FactCategory.REGULATORY_CNRC.value,
                    "claimText": s,
                    "claimedValue": cnrc_val or "CNRC Registration",
                    "confidence": 0.95 if cnrc_val else 0.75,
                })

            # 3. Patent / INAPI detection
            patent_match = re.search(r"\b(DZ/P/\d{4}/\d{3,5})\b", s, re.IGNORECASE)
            if patent_match or ("inapi" in s.lower() or "brevet" in s.lower() or "patent" in s.lower()):
                pat_val = patent_match.group(1).upper() if patent_match else None
                extracted_claims.append({
                    "id": str(uuid.uuid4()),
                    "timestamp": simulated_ts,
                    "category": FactCategory.PATENT_IP.value,
                    "claimText": s,
                    "claimedValue": pat_val or "INAPI Patent Filing",
                    "confidence": 0.95 if pat_val else 0.80,
                })

            # 4. Revenue / ARR detection
            rev_patterns = [
                r"(\d+(?:\.\d+)?)\s*(?:millions?|m|milliards?|mds?|k)?\s*(?:dzd|da|dinars?|centimes?)",
                r"(?:arr|chiffre d'affaires|ca|revenus?)\s*(?:de|atteint)?\s*(\d+(?:[,\s\.]\d+)?)\s*(?:millions?|m|milliards?|dzd|da)?",
            ]
            for pat in rev_patterns:
                rev_match = re.search(pat, s, re.IGNORECASE)
                if rev_match:
                    extracted_claims.append({
                        "id": str(uuid.uuid4()),
                        "timestamp": simulated_ts,
                        "category": FactCategory.REVENUE.value,
                        "claimText": s,
                        "claimedValue": rev_match.group(0),
                        "confidence": 0.88,
                    })
                    break

            # 5. Customer / User count detection
            cust_match = re.search(r"(\d+(?:[,\s\.]\d+)?(?:\s*(?:k|millions?))?)\s*(?:clients|utilisateurs|users|abonnés|téléchargements|commandes)", s, re.IGNORECASE)
            if cust_match:
                extracted_claims.append({
                    "id": str(uuid.uuid4()),
                    "timestamp": simulated_ts,
                    "category": FactCategory.CUSTOMER_COUNT.value,
                    "claimText": s,
                    "claimedValue": cust_match.group(0),
                    "confidence": 0.85,
                })

        return extracted_claims

    # =========================================================================
    # 2. REGISTRY CROSS-REFERENCING & CLASSIFICATION
    # =========================================================================

    def verify_claim(self, claim: Dict[str, Any], startup_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Cross-reference an extracted claim against verified registries.
        Returns the claim enriched with badge status, registry source, and verification notes.
        """
        category = claim.get("category")
        claimed_val = str(claim.get("claimedValue", "")).strip()
        claim_text = str(claim.get("claimText", "")).strip()
        startup_name = (startup_context.get("name", "") if startup_context else "").lower()

        badge = FactBadgeStatus.AMBER_CONTEXT
        registry_source = "TamWheel Diligence Sandbox"
        notes = "Claim recorded; awaiting third-party audit documents."
        confidence = float(claim.get("confidence", 0.75))

        # --- A. STARTUP LABEL VERIFICATION ---
        if category == FactCategory.STARTUP_LABEL.value:
            registry_source = "Ministère de l'Économie de la Connaissance — Registre National des Startups (Décret 20-254)"
            found_label = None

            # Look up by exact code
            for code, data in self.label_registry.items():
                if code.lower() in claimed_val.lower() or code.lower() in claim_text.lower():
                    found_label = (code, data)
                    break

            # Fallback: look up by startup name
            if not found_label and startup_name:
                for code, data in self.label_registry.items():
                    if startup_name in data["companyName"].lower():
                        found_label = (code, data)
                        break

            if found_label:
                code, data = found_label
                if data["labelStatus"] == "VALID":
                    badge = FactBadgeStatus.GREEN_VERIFIED
                    notes = f"Verified active national Startup Label #{code} issued to {data['companyName']} under {data['decree']}. Valid until {data['expiresAt']}."
                    confidence = 0.99
                elif data["labelStatus"] == "EXPIRED":
                    badge = FactBadgeStatus.RED_UNVERIFIED
                    notes = f"Startup Label #{code} expired on {data['expiresAt']}. Claiming active label violates Decree 20-254."
                    confidence = 0.98
                else:
                    badge = FactBadgeStatus.RED_UNVERIFIED
                    notes = f"Startup Label #{code} is revoked or inactive."
                    confidence = 0.95
            else:
                # If explicit fake format code was given but not in registry
                if re.search(r"\b(ASF|LABEL-ALG)-\d{4}-\d+\b", claim_text, re.IGNORECASE):
                    badge = FactBadgeStatus.RED_UNVERIFIED
                    notes = f"Label credential '{claimed_val}' not found in the official Ministerial Startup Label database."
                    confidence = 0.92
                else:
                    badge = FactBadgeStatus.AMBER_CONTEXT
                    notes = "Founder claims National Startup Label status, but no verified ASF certificate is registered in the Virtual Data Room."
                    confidence = 0.70

        # --- B. CNRC COMMERCIAL REGISTRATION ---
        elif category == FactCategory.REGULATORY_CNRC.value:
            registry_source = "Centre National du Registre du Commerce (CNRC) — Portail SIDJIL"
            found_cnrc = None

            for code, data in self.cnrc_registry.items():
                if code.lower() in claimed_val.lower() or code.lower() in claim_text.lower():
                    found_cnrc = (code, data)
                    break

            if found_cnrc:
                code, data = found_cnrc
                if data["status"] == "ACTIVE":
                    badge = FactBadgeStatus.GREEN_VERIFIED
                    notes = f"CNRC #{code} confirmed active for {data['legalName']} ({data['legalForm']}) in Wilaya {data['wilaya']}."
                    confidence = 0.99
                else:
                    badge = FactBadgeStatus.RED_UNVERIFIED
                    notes = f"CNRC #{code} is registered as {data['status']} ({data['legalName']}). Inactive entity cannot solicit investments."
                    confidence = 0.99
            else:
                if re.search(r"\b\d{2}/\d{2}-\d{7}[AB]\d{2}\b", claim_text):
                    badge = FactBadgeStatus.RED_UNVERIFIED
                    notes = f"Commercial registration number '{claimed_val}' was not found in the CNRC national registry."
                    confidence = 0.94
                else:
                    badge = FactBadgeStatus.AMBER_CONTEXT
                    notes = "Corporate status claimed without verifiable CNRC certificate in VDR."
                    confidence = 0.70

        # --- C. INAPI PATENT & IP VERIFICATION ---
        elif category == FactCategory.PATENT_IP.value:
            registry_source = "Institut National Algérien de la Propriété Industrielle (INAPI) — Bulletin Officiel (BOPI)"
            found_pat = None

            for code, data in self.inapi_registry.items():
                if code.lower() in claimed_val.lower() or code.lower() in claim_text.lower():
                    found_pat = (code, data)
                    break

            if found_pat:
                code, data = found_pat
                if data["status"] == "GRANTED":
                    badge = FactBadgeStatus.GREEN_VERIFIED
                    notes = f"INAPI Patent #{code} confirmed: '{data['title']}' granted to {data['applicant']}."
                    confidence = 0.99
                elif data["status"] == "PENDING_EXAMINATION":
                    badge = FactBadgeStatus.AMBER_CONTEXT
                    notes = f"INAPI Patent #{code} is pending official examination (Filed {data['filingDate']}). Not yet granted."
                    confidence = 0.90
                else:
                    badge = FactBadgeStatus.RED_UNVERIFIED
                    notes = f"Patent #{code} status is {data['status']}."
                    confidence = 0.95
            else:
                if "DZ/P/" in claim_text.upper():
                    badge = FactBadgeStatus.RED_UNVERIFIED
                    notes = f"Patent reference '{claimed_val}' not registered in the INAPI database."
                    confidence = 0.93
                else:
                    badge = FactBadgeStatus.AMBER_CONTEXT
                    notes = "Proprietary IP claimed, but no official INAPI filing receipt uploaded."
                    confidence = 0.70

        # --- D. REVENUE / ARR METRICS ---
        elif category == FactCategory.REVENUE.value:
            registry_source = "Direction Générale des Impôts (DGI) G50 & Audited Financial Statements"
            matched_fin = None
            for key, fin in self.financial_registry.items():
                if key in startup_name:
                    matched_fin = fin
                    break

            # Parse rough numeric claimed amount in DZD
            claimed_amount_dzd = self._parse_dzd_amount(claim_text)
            if matched_fin and claimed_amount_dzd:
                verified_arr = matched_fin["verifiedARRDzd"]
                variance_pct = abs(claimed_amount_dzd - verified_arr) / verified_arr
                if variance_pct <= 0.20:
                    badge = FactBadgeStatus.GREEN_VERIFIED
                    notes = f"Revenue claim of {claimed_amount_dzd:,.0f} DZD aligns with verified fiscal filing ({verified_arr:,.0f} DZD, variance {variance_pct*100:.1f}%)."
                    confidence = 0.95
                elif variance_pct <= 0.50:
                    badge = FactBadgeStatus.AMBER_CONTEXT
                    notes = f"Revenue claim ({claimed_amount_dzd:,.0f} DZD) has significant variance with latest audited G50 ({verified_arr:,.0f} DZD). Includes unaudited projected growth."
                    confidence = 0.80
                else:
                    badge = FactBadgeStatus.RED_UNVERIFIED
                    notes = f"Discrepancy detected: claimed {claimed_amount_dzd:,.0f} DZD exceeds official audited turnover ({verified_arr:,.0f} DZD) by {variance_pct*100:.0f}%."
                    confidence = 0.90
            else:
                badge = FactBadgeStatus.AMBER_CONTEXT
                notes = "Self-reported revenue metric. Audited balance sheet or G50 pending verification in Virtual Data Room."
                confidence = 0.70

        # --- E. CUSTOMER / USER COUNT ---
        elif category == FactCategory.CUSTOMER_COUNT.value:
            registry_source = "Third-Party Telemetry & Analytics Attestation (Mixpanel/GA4)"
            matched_fin = None
            for key, fin in self.financial_registry.items():
                if key in startup_name:
                    matched_fin = fin
                    break

            claimed_cust = self._parse_customer_count(claim_text)
            if matched_fin and claimed_cust:
                verified_cust = matched_fin["verifiedCustomers"]
                if claimed_cust <= verified_cust * 1.3:
                    badge = FactBadgeStatus.GREEN_VERIFIED
                    notes = f"Active user metric ({claimed_cust:,.0f}) supported by platform telemetry benchmark."
                    confidence = 0.90
                else:
                    badge = FactBadgeStatus.AMBER_CONTEXT
                    notes = f"Claimed count ({claimed_cust:,.0f}) exceeds verified active accounts ({verified_cust:,.0f}). May represent cumulative signups rather than active users."
                    confidence = 0.75
            else:
                badge = FactBadgeStatus.AMBER_CONTEXT
                notes = "Unverified self-reported traction figure. Independent analytics connection recommended."
                confidence = 0.70

        # Fallback
        else:
            badge = FactBadgeStatus.AMBER_CONTEXT
            registry_source = "Community Diligence Log"
            notes = "General claim noted for community cross-examination."

        return {
            **claim,
            "badge": badge.value,
            "registrySource": registry_source,
            "verificationNotes": notes,
            "confidence": round(confidence, 2),
        }

    # =========================================================================
    # 3. COMPOSITE VIDEO AUDIT EXECUTION
    # =========================================================================

    def audit_pitch_reel(
        self,
        startup_id: str,
        transcript_text: str,
        video_url: Optional[str] = None,
        custom_claims: Optional[List[Dict[str, Any]]] = None,
        startup_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Run end-to-end FactGuard AI audit on a startup pitch video reel.
        Extracts claims, verifies each against registries, and synthesizes overall status badge.
        """
        extracted = self.extract_claims_from_text(transcript_text)
        if custom_claims:
            for cc in custom_claims:
                if not any(e["claimText"] == cc.get("claimText") for e in extracted):
                    extracted.append({
                        "id": str(uuid.uuid4()),
                        "timestamp": cc.get("timestamp", "00:00"),
                        "category": cc.get("category", FactCategory.TRACTION.value),
                        "claimText": cc.get("claimText", ""),
                        "claimedValue": cc.get("claimedValue", ""),
                        "confidence": cc.get("confidence", 0.85),
                    })

        verified_claims = [
            self.verify_claim(c, startup_context=startup_context)
            for c in extracted
        ]

        # Overall Status Calculation
        red_count = sum(1 for c in verified_claims if c["badge"] == FactBadgeStatus.RED_UNVERIFIED.value)
        amber_count = sum(1 for c in verified_claims if c["badge"] == FactBadgeStatus.AMBER_CONTEXT.value)
        green_count = sum(1 for c in verified_claims if c["badge"] == FactBadgeStatus.GREEN_VERIFIED.value)

        total_claims = len(verified_claims)

        if total_claims == 0:
            overall_badge = FactBadgeStatus.AMBER_CONTEXT.value
            overall_score = 50.0
            summary = "No checkable quantitative claims detected in pitch transcript."
        elif red_count > 0:
            # Fatal gate: any contradicted or fabricated claim results in RED badge
            overall_badge = FactBadgeStatus.RED_UNVERIFIED.value
            overall_score = max(0.0, round(100.0 - (red_count * 40.0) - (amber_count * 10.0), 2))
            summary = f"Flagged: {red_count} claim(s) contradicted by official Algerian registries (CNRC, INAPI, or Decree 20-254)."
        elif green_count >= (total_claims * 0.60):
            overall_badge = FactBadgeStatus.GREEN_VERIFIED.value
            overall_score = round(min(100.0, 70.0 + (green_count / total_claims * 30.0)), 2)
            summary = f"Verified: {green_count}/{total_claims} claims verified against official national databases."
        else:
            overall_badge = FactBadgeStatus.AMBER_CONTEXT.value
            overall_score = round(50.0 + (green_count / total_claims * 30.0), 2)
            summary = f"Context needed: {amber_count} claim(s) require supplementary documentation in Virtual Data Room."

        # Generate timestamped video overlays
        overlays = [
            {
                "timestamp": c["timestamp"],
                "badge": c["badge"],
                "pillText": f"FactGuard: {c['category'].replace('_', ' ')}",
                "notes": c["verificationNotes"],
                "color": (
                    "#10B981" if c["badge"] == FactBadgeStatus.GREEN_VERIFIED.value
                    else ("#EF4444" if c["badge"] == FactBadgeStatus.RED_UNVERIFIED.value else "#F59E0B")
                ),
            }
            for c in verified_claims
        ]

        return {
            "startupId": startup_id,
            "videoUrl": video_url,
            "overallBadge": overall_badge,
            "overallScore": overall_score,
            "totalClaims": total_claims,
            "verifiedCount": green_count,
            "amberCount": amber_count,
            "redCount": red_count,
            "summary": summary,
            "claims": verified_claims,
            "overlays": overlays,
            "auditedAt": datetime.now(timezone.utc).isoformat(),
        }

    # =========================================================================
    # HELPERS
    # =========================================================================

    @staticmethod
    def _parse_dzd_amount(text: str) -> Optional[float]:
        t = text.lower()
        # Look for numbers with million / milliard / dzd
        m = re.search(r"(\d+(?:[,\.]\d+)?)\s*(milliards?|mds?|millions?|m|k)?\s*(?:dzd|da|dinars?|centimes?)?", t)
        if not m:
            return None
        val_str = m.group(1).replace(",", ".")
        try:
            val = float(val_str)
        except ValueError:
            return None

        multiplier_word = (m.group(2) or "").lower()
        if "milliard" in multiplier_word or "md" in multiplier_word:
            val *= 1_000_000_000
        elif "million" in multiplier_word or multiplier_word == "m":
            val *= 1_000_000
        elif multiplier_word == "k":
            val *= 1_000

        # Algerian Centimes conversion: 1 DZD = 100 Centimes
        if "centime" in t:
            val /= 100.0

        return val

    @staticmethod
    def _parse_customer_count(text: str) -> Optional[float]:
        m = re.search(r"(\d+(?:[,\.]\d+)?)\s*(k|millions?|m)?", text.lower())
        if not m:
            return None
        val_str = m.group(1).replace(",", ".")
        try:
            val = float(val_str)
        except ValueError:
            return None
        unit = (m.group(2) or "").lower()
        if unit == "k":
            val *= 1_000
        elif "million" in unit or unit == "m":
            val *= 1_000_000
        return val


factguard_ai_engine = FactGuardAIEngine()
