"""
TamWheel Sovereign Ethical Agentic Venture OS — Pitch Deck Diligence & Exaggeration Auditor.
Implements:
1. Slide-by-slide Archetype Auditing (Problem, Solution, TAM/SAM/SOM, Moat, Traction, Team, Financials).
2. TAM/SAM/SOM Inflation Detector calibrated to Algerian ONS (Office National des Statistiques) economic ceilings.
3. Moat Plausibility & Defensibility Rating (evaluating INAPI IP, Network Effects vs Buzzwords).
4. Claim Provenance Index (measuring verification ratio of factual claims with primary documents).
5. Comprehensive Deck Integrity Score [0.0, 100.0] with prescriptive recommendations.
"""

from datetime import datetime, timezone
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from app.schemas.deck_audit import (
    SlideArchetype,
    MarketInflationStatus,
    MoatDefensibilityTier,
    EvidenceStatus,
    DeckClaim,
    DeckSlide,
    TAMAnalysis,
    MoatAnalysis,
    SlideAuditResult,
    DeckAuditRequest,
    DeckAuditResponse,
    TAMCheckRequest,
    TAMCheckResponse,
)

logger = logging.getLogger("tamwheel.deck_audit")

# =============================================================================
# ALGERIAN & REGIONAL ECONOMIC BENCHMARKS (ONS / WORLD BANK 2025-2026)
# =============================================================================
ALGERIA_NATIONAL_GDP_USD = 250_000_000_000.0      # ~250 Billion USD
ALGERIA_HOUSEHOLD_CONSUMPTION_USD = 90_000_000_000.0

# Official Sector TAM Ceilings (USD) for Algerian Domestic Market
ONS_SECTOR_TAM_BENCHMARKS_USD: Dict[str, float] = {
    "AGRITECH": 28_000_000_000.0,      # Gross agricultural output ~28B USD
    "E-COMMERCE": 3_500_000_000.0,     # Addressable domestic retail e-commerce
    "FINTECH": 10_000_000_000.0,       # Digital payments, P2P, remittances & micro-credit
    "HEALTHTECH": 5_500_000_000.0,     # Total pharmaceutical & healthcare spend
    "LOGISTICS": 8_000_000_000.0,      # Freight, courier & cold-chain transport
    "SAAS": 500_000_000.0,             # Algerian B2B enterprise software & cloud
    "EDTECH": 1_500_000_000.0,         # Tutoring, vocational & corporate training
    "ENERGY_CLEANTECH": 15_000_000_000.0, # Domestic solar, energy efficiency & off-grid
}
DEFAULT_SECTOR_BENCHMARK_USD = 5_000_000_000.0

# Common Moat Buzzwords indicating hype over defensibility
BUZZWORD_PATTERNS = [
    r"first[- ]mover advantage",
    r"no direct competitors?",
    r"no competition",
    r"revolutionary (ai|technology|platform)",
    r"superior (ui|ux|design)",
    r"viral organic growth",
    r"unstoppable (team|growth)",
    r"proprietary secret sauce",
    r"disruptive (magic|power)",
]


class PitchDeckAuditor:
    """
    Automated Pitch Deck Slide Diligence & Exaggeration Auditor.
    Identifies unrealistic market sizing, unverified traction claims,
    buzzword-driven moats, and financial projection fallacies.
    """

    def __init__(self):
        logger.info("Initializing TamWheel Pitch Deck Diligence & Exaggeration Auditor")

    def audit_deck(self, req: DeckAuditRequest) -> DeckAuditResponse:
        """
        Perform a full slide-by-slide audit on an investor pitch deck.
        """
        slide_results: List[SlideAuditResult] = []
        tam_analysis: Optional[TAMAnalysis] = None
        moat_analysis: Optional[MoatAnalysis] = None

        all_claims: List[DeckClaim] = []

        for slide in req.slides:
            # Collect claims
            all_claims.extend(slide.claims)

            # Route by slide archetype
            if slide.archetype == SlideArchetype.TAM_SAM_SOM:
                tam_analysis, slide_res = self._audit_tam_slide(slide, req.sector, req.targetMarketGeo)
                slide_results.append(slide_res)
            elif slide.archetype == SlideArchetype.MOAT:
                moat_analysis, slide_res = self._audit_moat_slide(slide)
                slide_results.append(slide_res)
            elif slide.archetype == SlideArchetype.TRACTION:
                slide_res = self._audit_traction_slide(slide)
                slide_results.append(slide_res)
            elif slide.archetype == SlideArchetype.FINANCIAL_PROJECTIONS:
                slide_res = self._audit_financials_slide(slide)
                slide_results.append(slide_res)
            elif slide.archetype == SlideArchetype.TEAM:
                slide_res = self._audit_team_slide(slide)
                slide_results.append(slide_res)
            elif slide.archetype in (SlideArchetype.PROBLEM, SlideArchetype.SOLUTION):
                slide_res = self._audit_core_concept_slide(slide)
                slide_results.append(slide_res)
            else:
                slide_res = self._audit_generic_slide(slide)
                slide_results.append(slide_res)

        # Calculate Claim Provenance Index
        provenance_index, verified_ratio = self.calculate_provenance_index(all_claims)

        # Overall Deck Integrity Score
        slide_scores = [s.integrityScore for s in slide_results]
        avg_slide_score = sum(slide_scores) / max(len(slide_scores), 1)

        # Blend slide score (50%), provenance index (30%), moat score (10%), tam score (10%)
        tam_penalty = 100.0
        if tam_analysis:
            if tam_analysis.inflationStatus == MarketInflationStatus.IMPOSSIBLE_METRIC:
                tam_penalty = 15.0
            elif tam_analysis.inflationStatus == MarketInflationStatus.EXTREMELY_INFLATED:
                tam_penalty = 40.0
            elif tam_analysis.inflationStatus == MarketInflationStatus.MODERATELY_STRETCHED:
                tam_penalty = 70.0

        moat_score_val = moat_analysis.score if moat_analysis else 60.0

        overall_integrity = (
            0.50 * avg_slide_score +
            0.30 * provenance_index +
            0.10 * moat_score_val +
            0.10 * tam_penalty
        )
        overall_integrity = round(min(100.0, max(0.0, overall_integrity)), 1)

        summary = (
            f"Pitch deck audit complete for '{req.deckTitle}'. "
            f"Overall Integrity Score: {overall_integrity}/100. "
            f"Claim Provenance Index: {provenance_index:.1f}% ({verified_ratio*100:.0f}% verified claims). "
            f"Audited {len(req.slides)} slides. "
        )
        if tam_analysis and tam_analysis.inflationStatus != MarketInflationStatus.PLAUSIBLE:
            summary += f"Market sizing flagged as {tam_analysis.inflationStatus.value} ({tam_analysis.inflationFactor:.1f}x benchmark). "
        if moat_analysis and moat_analysis.moatTier == MoatDefensibilityTier.BUZZWORD_ILLUSION:
            summary += "Moat identified as buzzword-driven illusion without structural defensibility."

        return DeckAuditResponse(
            startupId=req.startupId,
            deckTitle=req.deckTitle,
            overallIntegrityScore=overall_integrity,
            provenanceIndex=round(provenance_index, 1),
            verifiedClaimsRatio=round(verified_ratio, 2),
            tamAnalysis=tam_analysis,
            moatAnalysis=moat_analysis,
            slideResults=slide_results,
            summary=summary,
        )

    # =========================================================================
    # 1. TAM / SAM / SOM INFLATION AUDITOR
    # =========================================================================

    def evaluate_tam(
        self,
        sector: str,
        claimed_tam: float,
        claimed_sam: float,
        claimed_som: float,
        target_geo: Optional[str] = "ALGERIA",
    ) -> TAMAnalysis:
        """
        Evaluate claimed TAM/SAM/SOM market sizes against official ONS and regional benchmarks.
        """
        sector_key = sector.upper().replace(" ", "_").replace("-", "_")
        benchmark_tam = ONS_SECTOR_TAM_BENCHMARKS_USD.get(sector_key, DEFAULT_SECTOR_BENCHMARK_USD)

        # If international / MENA, scale benchmark by 3.5x
        if target_geo and target_geo.upper() in ("MENA", "GLOBAL"):
            benchmark_tam *= 3.5

        # Check for absolute ceiling against National GDP
        if claimed_tam > ALGERIA_NATIONAL_GDP_USD and (not target_geo or target_geo.upper() == "ALGERIA"):
            inflation_factor = claimed_tam / benchmark_tam
            status = MarketInflationStatus.IMPOSSIBLE_METRIC
            critique = (
                f"Claimed TAM (${claimed_tam:,.0f} USD) exceeds the entire GDP of Algeria "
                f"(${ALGERIA_NATIONAL_GDP_USD:,.0f} USD). Economically impossible for a single startup."
            )
        else:
            inflation_factor = claimed_tam / max(benchmark_tam, 1.0)

            if inflation_factor > 5.0:
                status = MarketInflationStatus.IMPOSSIBLE_METRIC
                critique = (
                    f"Claimed TAM is {inflation_factor:.1f}x higher than official ONS economic ceiling "
                    f"for {sector} (${benchmark_tam:,.0f} USD). Severe top-down market sizing fallacy."
                )
            elif inflation_factor > 2.5:
                status = MarketInflationStatus.EXTREMELY_INFLATED
                critique = (
                    f"Claimed TAM is {inflation_factor:.1f}x higher than plausible domestic sector volume. "
                    "Likely conflates global industry statistics with Algerian addressable demand."
                )
            elif inflation_factor > 1.25:
                status = MarketInflationStatus.MODERATELY_STRETCHED
                critique = (
                    f"Claimed TAM is slightly optimistic ({inflation_factor:.1f}x benchmark). "
                    "Ensure SAM/SOM calculations account for local purchasing power and banking digitization."
                )
            else:
                status = MarketInflationStatus.PLAUSIBLE
                critique = (
                    f"Market sizing is well-grounded within official sector boundaries (${benchmark_tam:,.0f} USD). "
                    "Demonstrates solid bottom-up unit economics."
                )

        # Check SOM logic: SOM should be realistic percentage of SAM (e.g. 1-10%)
        if claimed_sam > 0 and (claimed_som / claimed_sam) > 0.50:
            critique += " Red Flag: Claimed SOM assumes over 50% immediate market capture of SAM, which is highly unrealistic."

        return TAMAnalysis(
            claimedTamUsd=claimed_tam,
            claimedSamUsd=claimed_sam,
            claimedSomUsd=claimed_som,
            benchmarkReference="Office National des Statistiques (ONS) & World Bank Enterprise Survey",
            benchmarkTamUsd=benchmark_tam,
            inflationFactor=round(inflation_factor, 2),
            inflationStatus=status,
            critique=critique,
        )

    def _audit_tam_slide(
        self,
        slide: DeckSlide,
        sector: str,
        target_geo: Optional[str],
    ) -> Tuple[TAMAnalysis, SlideAuditResult]:
        metrics = slide.metrics
        claimed_tam = float(metrics.get("tam", metrics.get("TAM", 10_000_000_000.0)))
        claimed_sam = float(metrics.get("sam", metrics.get("SAM", claimed_tam * 0.3)))
        claimed_som = float(metrics.get("som", metrics.get("SOM", claimed_sam * 0.1)))

        tam_analysis = self.evaluate_tam(
            sector=sector,
            claimed_tam=claimed_tam,
            claimed_sam=claimed_sam,
            claimed_som=claimed_som,
            target_geo=target_geo,
        )

        red_flags: List[str] = []
        strengths: List[str] = []

        if tam_analysis.inflationStatus == MarketInflationStatus.IMPOSSIBLE_METRIC:
            integrity = 20.0
            red_flags.append(f"Impossible TAM: {tam_analysis.critique}")
            rec = "Rebuild market slide using bottom-up sizing (# of customers x annual ACV) rather than broad global reports."
        elif tam_analysis.inflationStatus == MarketInflationStatus.EXTREMELY_INFLATED:
            integrity = 45.0
            red_flags.append("Severely inflated TAM vs ONS sectoral statistics.")
            rec = "Narrow TAM to addressable Algerian market and provide verifiable sources for SAM/SOM."
        elif tam_analysis.inflationStatus == MarketInflationStatus.MODERATELY_STRETCHED:
            integrity = 75.0
            strengths.append("Structured TAM/SAM/SOM breakdown present.")
            red_flags.append("Slightly optimistic addressable conversion assumptions.")
            rec = "Refine SOM by Wilaya or tier-1 merchant concentration."
        else:
            integrity = 95.0
            strengths.append("Plausible, conservative market sizing grounded in verified economic benchmarks.")
            rec = "Maintain conservative SOM projections to build angel investor trust."

        res = SlideAuditResult(
            slideNumber=slide.slideNumber,
            title=slide.title,
            archetype=slide.archetype,
            integrityScore=integrity,
            redFlags=red_flags,
            strengths=strengths,
            recommendation=rec,
        )
        return tam_analysis, res

    # =========================================================================
    # 2. MOAT PLAUSIBILITY & DEFICIT AUDITOR
    # =========================================================================

    def evaluate_moat(self, slide_content: str, claims: List[DeckClaim]) -> MoatAnalysis:
        """
        Evaluate startup defensibility against structural vectors vs buzzword illusion.
        """
        content_lower = slide_content.lower()

        # 1. Detect Buzzwords
        detected_buzzwords: List[str] = []
        for pattern in BUZZWORD_PATTERNS:
            match = re.search(pattern, content_lower)
            if match:
                detected_buzzwords.append(match.group(0))

        # 2. Evaluate 4 Structural Dimensions (0-100 each)
        dim_scores: Dict[str, float] = {
            "techAndIp": 20.0,
            "networkEffects": 20.0,
            "regulatoryMoat": 20.0,
            "switchingCosts": 20.0,
        }

        # IP / Tech check
        has_patent_claim = any(c.evidenceType == "INAPI_PATENT" and c.status == EvidenceStatus.EVIDENCE_VERIFIED for c in claims)
        if has_patent_claim or "inapi" in content_lower or "brevet" in content_lower or "patent" in content_lower:
            dim_scores["techAndIp"] = 85.0 if has_patent_claim else 55.0

        # Network effects check
        if "network effect" in content_lower or "marketplace liquidity" in content_lower or "viral loop" in content_lower:
            dim_scores["networkEffects"] = 70.0

        # Regulatory moat check (Decree 20-254 Startup Label / Central bank license)
        if "label startup" in content_lower or "décret 20-254" in content_lower or "cosob" in content_lower or "banque d'algérie" in content_lower:
            dim_scores["regulatoryMoat"] = 85.0

        # Switching costs check
        if "erp integration" in content_lower or "api lock-in" in content_lower or "switching cost" in content_lower:
            dim_scores["switchingCosts"] = 75.0

        # Base composite score: in early-stage ventures, moats are anchored around
        # distinct vectors (e.g. registered INAPI patents or official Decree 20-254 Startup Label)
        sorted_dims = sorted(dim_scores.values(), reverse=True)
        if sorted_dims[0] >= 80.0 and sorted_dims[1] >= 80.0:
            base_score = 90.0
        elif sorted_dims[0] >= 80.0:
            base_score = 80.0 + 0.15 * sorted_dims[1]
        elif sorted_dims[0] >= 65.0:
            base_score = 65.0 + 0.15 * sorted_dims[1]
        else:
            base_score = sum(dim_scores.values()) / 4.0

        # Buzzword penalty: deduct 15 points per buzzword if no verifiable IP or regulatory moat
        buzzword_penalty = len(detected_buzzwords) * 15.0
        if dim_scores["techAndIp"] > 70.0 or dim_scores["regulatoryMoat"] > 70.0:
            buzzword_penalty *= 0.3  # Reduced penalty if real moat exists

        final_moat_score = max(5.0, min(100.0, base_score - buzzword_penalty))
        final_moat_score = round(final_moat_score, 1)

        if final_moat_score >= 80.0:
            moat_tier = MoatDefensibilityTier.GENUINE_DEFENSIBLE_MOAT
            critique = "Genuine defensible moat backed by verified INAPI IP, regulatory status (Decree 20-254), or high switching costs."
        elif final_moat_score >= 50.0:
            moat_tier = MoatDefensibilityTier.MODERATE_DEFENSIBILITY
            critique = "Moderate defensibility. Some structural barriers, but vulnerable to fast-following incumbents."
        elif final_moat_score >= 25.0:
            moat_tier = MoatDefensibilityTier.WEAK_MOAT
            critique = "Weak moat. Relies largely on execution speed rather than structural barriers to entry."
        else:
            moat_tier = MoatDefensibilityTier.BUZZWORD_ILLUSION
            critique = (
                "Buzzword illusion. Slide uses generic claims ('first-mover advantage', 'best UX', 'revolutionary AI') "
                "without verifiable proprietary technology or regulatory defense."
            )

        return MoatAnalysis(
            moatTier=moat_tier,
            score=final_moat_score,
            dimensions=dim_scores,
            buzzwordsDetected=detected_buzzwords,
            critique=critique,
        )

    def _audit_moat_slide(self, slide: DeckSlide) -> Tuple[MoatAnalysis, SlideAuditResult]:
        moat_analysis = self.evaluate_moat(slide.content, slide.claims)

        red_flags: List[str] = []
        strengths: List[str] = []

        if moat_analysis.moatTier == MoatDefensibilityTier.BUZZWORD_ILLUSION:
            integrity = 25.0
            red_flags.append(f"Buzzword Moat: {moat_analysis.critique}")
            if moat_analysis.buzzwordsDetected:
                red_flags.append(f"Identified hype phrases: {', '.join(moat_analysis.buzzwordsDetected)}")
            rec = "Eliminate empty claims. Detail concrete IP registrations at INAPI or exclusive commercial agreements."
        elif moat_analysis.moatTier == MoatDefensibilityTier.WEAK_MOAT:
            integrity = 50.0
            red_flags.append("Limited defensibility against well-capitalized domestic incumbents.")
            rec = "Highlight technical architecture barriers or long-term customer lock-in mechanisms."
        elif moat_analysis.moatTier == MoatDefensibilityTier.MODERATE_DEFENSIBILITY:
            integrity = 75.0
            strengths.append("Clear identification of switching costs or market positioning.")
            rec = "Formalize IP applications at INAPI to harden defensibility."
        else:
            integrity = 95.0
            strengths.append("Exceptional defensibility: verified IP and regulatory protections.")
            rec = "Quantify cost and time required for a competitor to replicate your moat."

        res = SlideAuditResult(
            slideNumber=slide.slideNumber,
            title=slide.title,
            archetype=slide.archetype,
            integrityScore=integrity,
            redFlags=red_flags,
            strengths=strengths,
            recommendation=rec,
        )
        return moat_analysis, res

    # =========================================================================
    # 3. CLAIM PROVENANCE INDEX
    # =========================================================================

    def calculate_provenance_index(self, claims: List[DeckClaim]) -> Tuple[float, float]:
        """
        Calculate the percentage of founder claims backed by verifiable primary documentation.
        Returns: (provenance_index_score_0_100, verified_claims_ratio_0_1)
        """
        if not claims:
            return 70.0, 0.7  # Default neutral score if no discrete claims parsed

        total_weight = 0.0
        verified_count = 0

        for c in claims:
            if c.status == EvidenceStatus.EVIDENCE_VERIFIED:
                total_weight += 1.0
                verified_count += 1
            elif c.status == EvidenceStatus.EVIDENCE_PARTIAL:
                total_weight += 0.5
            else:  # UNVERIFIED
                total_weight += 0.0

        provenance_score = (total_weight / len(claims)) * 100.0
        verified_ratio = verified_count / len(claims)

        return round(provenance_score, 1), round(verified_ratio, 2)

    # =========================================================================
    # 4. SLIDE ARCHETYPE SPECIALIZED AUDITORS
    # =========================================================================

    def _audit_traction_slide(self, slide: DeckSlide) -> SlideAuditResult:
        red_flags: List[str] = []
        strengths: List[str] = []

        unsubstantiated = [c for c in slide.claims if c.status == EvidenceStatus.EVIDENCE_UNSUBSTANTIATED]
        verified = [c for c in slide.claims if c.status == EvidenceStatus.EVIDENCE_VERIFIED]

        if unsubstantiated:
            red_flags.append(f"{len(unsubstantiated)} traction claims lack verifiable contracts or bank receipts.")
        if verified:
            strengths.append(f"{len(verified)} claims verified with primary documentation.")

        metrics = slide.metrics
        arr = metrics.get("arr", metrics.get("ARR", 0))
        users = metrics.get("users", metrics.get("activeUsers", 0))

        if arr > 50_000_000.0 and len(verified) == 0:
            red_flags.append("High revenue claimed (>50M DZD) without corresponding G50 or bank ledger proof.")
            integrity = 35.0
        elif verified:
            integrity = min(95.0, 60.0 + len(verified) * 15.0)
        else:
            integrity = 55.0

        rec = "Attach audited bank transaction excerpts or signed customer purchase orders in due diligence data room."
        return SlideAuditResult(
            slideNumber=slide.slideNumber,
            title=slide.title,
            archetype=slide.archetype,
            integrityScore=integrity,
            redFlags=red_flags,
            strengths=strengths,
            recommendation=rec,
        )

    def _audit_financials_slide(self, slide: DeckSlide) -> SlideAuditResult:
        red_flags: List[str] = []
        strengths: List[str] = []

        content = slide.content.lower()
        if "hockey stick" in content or "10x revenue in year 2" in content:
            red_flags.append("Unsubstantiated hockey-stick revenue trajectory.")
            integrity = 40.0
        elif "margin > 90%" in content and "saas" not in content:
            red_flags.append("Unrealistically high gross margins claimed for non-pure software business.")
            integrity = 45.0
        else:
            strengths.append("Financial projections follow structured forward multi-year layout.")
            integrity = 75.0

        rec = "Provide clear cost of customer acquisition (CAC) and customer lifetime value (LTV) unit economics."
        return SlideAuditResult(
            slideNumber=slide.slideNumber,
            title=slide.title,
            archetype=slide.archetype,
            integrityScore=integrity,
            redFlags=red_flags,
            strengths=strengths,
            recommendation=rec,
        )

    def _audit_team_slide(self, slide: DeckSlide) -> SlideAuditResult:
        red_flags: List[str] = []
        strengths: List[str] = []

        content = slide.content.lower()
        if "ex-google" in content or "polytechnique" in content or "usthb" in content:
            strengths.append("Recognized technical engineering pedigree.")

        # Check for advisor padding
        if "advisors" in content and "founder" not in content:
            red_flags.append("Team slide heavily padded with non-operational advisors.")
            integrity = 50.0
        else:
            integrity = 80.0

        rec = "Specify full-time equity commitment vs part-time advisory roles for all key members."
        return SlideAuditResult(
            slideNumber=slide.slideNumber,
            title=slide.title,
            archetype=slide.archetype,
            integrityScore=integrity,
            redFlags=red_flags,
            strengths=strengths,
            recommendation=rec,
        )

    def _audit_core_concept_slide(self, slide: DeckSlide) -> SlideAuditResult:
        return SlideAuditResult(
            slideNumber=slide.slideNumber,
            title=slide.title,
            archetype=slide.archetype,
            integrityScore=85.0,
            redFlags=[],
            strengths=["Clear articulation of problem statement and customer pain point."],
            recommendation="Quantify the cost of the problem in Algerian Dinars per target enterprise.",
        )

    def _audit_generic_slide(self, slide: DeckSlide) -> SlideAuditResult:
        return SlideAuditResult(
            slideNumber=slide.slideNumber,
            title=slide.title,
            archetype=slide.archetype,
            integrityScore=75.0,
            redFlags=[],
            strengths=["Contextually coherent content."],
            recommendation="Ensure slide directly supports fundraising narrative.",
        )


# Global singleton instance
deck_auditor = PitchDeckAuditor()
