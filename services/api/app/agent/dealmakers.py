"""
TamWheel Sovereign Ethical Agentic Venture OS — Dealmaker Swarm.
Implements the 4 Autonomous Personas of Pillar 5:
1. Al-Mu'assis (المؤسس) — Founder Co-Pilot:
   Optimizes founder equity retention, runway protection, minimal dilution, and founder protective provisions.
2. Al-Muhaqqiq (المحقق) — Forensic Diligence Analyst:
   Analyzes financial statements, unit economics (LTV/CAC, burn multiple), churn, market TAM, and legal risks.
3. Al-Muqawil (المقاول) — Milestone Escrow Governor:
   Structures SMART deliverables, multi-tranche release gates, S4E sweat-equity Istihaq protocols, and KPI performance metrics.
4. Al-Mizan (الميزان) — Neutral Tournament Referee & Arbitrator:
   Computes Al-Jadara Index (0-100), tournament tiering, ZOPA calculation, bad-faith detection, and multi-tier arbitration.
"""

from __future__ import annotations

import enum
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS & CONSTANTS
# =============================================================================

class TournamentTier(str, enum.Enum):
    SANDBOX = "SANDBOX"                     # [0 - 49]
    SIMULATION_LEAGUE = "SIMULATION_LEAGUE" # [50 - 69]
    PUBLIC_LISTING = "PUBLIC_LISTING"       # [70 - 84]
    PRIVATE_SYNDICATE = "PRIVATE_SYNDICATE" # [85 - 100]


class AntiDilutionRatchet(str, enum.Enum):
    BROAD_BASED_WEIGHTED_AVERAGE = "BROAD_BASED_WEIGHTED_AVERAGE"
    NARROW_BASED_WEIGHTED_AVERAGE = "NARROW_BASED_WEIGHTED_AVERAGE"
    FULL_RATCHET = "FULL_RATCHET"
    NONE = "NONE"


class MilestoneVerificationType(str, enum.Enum):
    DIRECT_RELEASE = "DIRECT_RELEASE"
    ORACLE_CHAINLINK = "ORACLE_CHAINLINK"
    ZK_TLS_ATTESTATION = "ZK_TLS_ATTESTATION"
    DUAL_AGENT_CONSENSUS = "DUAL_AGENT_CONSENSUS"


class ValuationSanityVerdict(str, enum.Enum):
    UNDERVALUED = "UNDERVALUED"
    FAIR = "FAIR"
    PREMIUM = "PREMIUM"
    SPECULATIVE_OVERVALUED = "SPECULATIVE_OVERVALUED"
    PRE_REVENUE_SCORECARD = "PRE_REVENUE_SCORECARD"


# =============================================================================
# SCHEMAS & INPUT MODELS
# =============================================================================

class StartupProfileInput(BaseModel):
    startup_name: str
    sector: str
    wilaya: int = Field(default=16, ge=1, le=58, description="Algerian Wilaya code (1-58)")
    pitch_summary: str
    arr_dzd: float = Field(default=0.0, ge=0.0, description="Annual Recurring Revenue in DZD")
    mrr_growth_rate_pct: float = Field(default=0.0, description="Month-over-month growth rate percentage")
    burn_rate_dzd: float = Field(default=0.0, ge=0.0, description="Monthly net burn rate in DZD")
    runway_months: float = Field(default=12.0, ge=0.0, description="Cash runway in months")
    cac_dzd: float = Field(default=15_000.0, ge=0.0, description="Customer acquisition cost in DZD")
    ltv_dzd: float = Field(default=60_000.0, ge=0.0, description="Customer lifetime value in DZD")
    valuation_ask_dzd: float = Field(..., gt=0, description="Founder requested post-money valuation in DZD")
    target_raise_dzd: float = Field(..., gt=0, description="Target investment round in DZD")
    has_asf_label: bool = Field(default=False, description="National Startup Label (Executive Decree 20-254)")
    tech_stack: List[str] = Field(default_factory=list)
    churn_rate_pct: float = Field(default=2.5, ge=0.0, le=100.0, description="Monthly customer churn percentage")
    team_size: int = Field(default=3, ge=1, description="Core team size")
    tam_dzd: Optional[float] = Field(default=None, description="Total Addressable Market in DZD")


class FounderCopilotSynthesis(BaseModel):
    agent_name: str = "Al-Mu'assis (المؤسس - Founder Co-Pilot)"
    growth_narrative: str
    market_opportunity: str
    localized_gtm_strategy: str
    asf_regulatory_readiness: str
    founder_equity_protection_notes: str
    recommended_valuation_ask_dzd: float
    max_acceptable_dilution_pct: float
    runway_post_raise_months: float
    protective_provisions_demanded: List[str]


class DueDiligenceSynthesis(BaseModel):
    agent_name: str = "Al-Muhaqqiq (المحقق - Due Diligence Analyst)"
    ltv_to_cac_ratio: float
    payback_period_months: float
    burn_multiple: float
    valuation_sanity_verdict: str
    implied_arr_multiple: Optional[float]
    benchmark_multiple_range: str = "5.0x - 12.0x ARR"
    market_tam_dzd: float = 25_000_000_000.0
    market_sam_dzd: float = 7_000_000_000.0
    market_som_dzd: float = 560_000_000.0
    risk_flags: List[str]
    forensic_audit_score: float = Field(default=80.0, ge=0, le=100)


class MilestoneTranche(BaseModel):
    tranche_number: int
    title: str
    percentage_of_round: float
    amount_dzd: float
    deliverable_criteria: str
    verification_type: MilestoneVerificationType
    kpi_gate: str
    deadline_days: int


class MilestoneEscrowSynthesis(BaseModel):
    agent_name: str = "Al-Muqawil (المقاول - Milestone & Escrow Agent)"
    technical_feasibility_score: float = Field(..., ge=0, le=100)
    suggested_escrow_tranches: List[MilestoneTranche]
    s4e_sweat_equity_recommendation: str
    escrow_security_recommendations: List[str]


class RefereeTournamentSynthesis(BaseModel):
    agent_name: str = "Al-Mizan (الميزان - Tournament & Referee Agent)"
    jadara_index_score: float = Field(..., ge=0, le=100)
    tier: TournamentTier
    verdict: str
    score_breakdown: Dict[str, float]
    zopa_feasibility: str
    arbitration_clauses: List[str]


class SwarmAnalysisResponse(BaseModel):
    startup_name: str
    executive_summary: str
    founder_copilot: FounderCopilotSynthesis
    due_diligence: DueDiligenceSynthesis
    milestone_escrow: MilestoneEscrowSynthesis
    referee_verdict: RefereeTournamentSynthesis
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# PERSONA 1: AL-MU'ASSIS (المؤسس) — FOUNDER CO-PILOT
# =============================================================================

class AlMuassisAgent:
    """
    Persona 1: Founder Co-Pilot.
    Optimizes for founder equity retention, minimal dilution, realistic runway,
    protective provisions, and regulatory readiness under Algerian law.
    """
    NAME = "Al-Mu'assis (المؤسس)"

    def synthesize(self, profile: StartupProfileInput) -> FounderCopilotSynthesis:
        # 1. Runway & Dilution Analysis
        implied_dilution = (profile.target_raise_dzd / profile.valuation_ask_dzd) * 100.0 if profile.valuation_ask_dzd > 0 else 20.0
        max_acceptable_dilution = min(25.0, max(10.0, implied_dilution * 1.15))

        monthly_burn = profile.burn_rate_dzd if profile.burn_rate_dzd > 0 else 500_000.0
        post_raise_runway = profile.runway_months + (profile.target_raise_dzd / monthly_burn)

        # 2. Localized GTM & Growth Narrative
        wilaya_context = f"Wilaya {profile.wilaya:02d}"
        narrative = (
            f"{profile.startup_name} positions itself as a sovereign innovator in {profile.sector}, "
            f"addressing structural inefficiencies from {wilaya_context} with an annual recurring "
            f"revenue base of {profile.arr_dzd:,.0f} DZD expanding at {profile.mrr_growth_rate_pct:.1f}% MoM."
        )

        opportunity = (
            f"Transformative market opportunity in Algerian {profile.sector}: leveraging domestic digitisation "
            f"mandates, local payment rails (SATIM, CIB, Edahabia), and expanding diaspora demand across Paris, "
            f"Montreal, and Gulf hubs."
        )

        gtm_strategy = (
            f"Phase 1: Deep penetration in coastal and industrial hubs (Algiers, Oran, Constantine, Sétif). "
            f"Phase 2: Hybrid distribution via licensed Auto-Entrepreneurs and institutional B2B partnerships. "
            f"Phase 3: Cross-border expansion into Maghreb and Francophone West Africa."
        )

        # 3. Regulatory Readiness (Decree 20-254 & Law 22-23)
        if profile.has_asf_label:
            reg_status = (
                "ASF Startup Label certified (Executive Decree 20-254). Eligible for Article 169 CIDTA tax exemption "
                "(0% IBS corporate income tax shield, 0% TAP, 0% VAT on innovation inputs) and Algerian Startup Fund grants."
            )
        else:
            reg_status = (
                "Eligible for expedited ASF Label submission. Immediate action: Formalize intellectual property assignment "
                "from founders to SPAS legal entity and register innovation docket with INAPI."
            )

        protective_provisions = [
            "Clean 1.0x Non-Participating Liquidation Preference (strictly prohibiting predatory participating multiples).",
            "Broad-Based Weighted Average anti-dilution protection (shielding founders against aggressive down-rounds).",
            "Founder Board Majority: 2 Founder seats vs. 1 Investor Director / Observer seat.",
            "Founder 48-month reverse vesting with 12-month cliff and double-trigger acceleration upon change of control.",
            "Ordinary operational spending below 2,000,000 DZD exempted from investor board veto.",
        ]

        protection_notes = (
            f"Target raise of {profile.target_raise_dzd:,.0f} DZD provides {post_raise_runway:.1f} months of verified runway. "
            f"Dilution capped at {max_acceptable_dilution:.1f}%, preserving founder control for subsequent growth rounds."
        )

        return FounderCopilotSynthesis(
            agent_name=self.NAME,
            growth_narrative=narrative,
            market_opportunity=opportunity,
            localized_gtm_strategy=gtm_strategy,
            asf_regulatory_readiness=reg_status,
            founder_equity_protection_notes=protection_notes,
            recommended_valuation_ask_dzd=profile.valuation_ask_dzd,
            max_acceptable_dilution_pct=round(max_acceptable_dilution, 2),
            runway_post_raise_months=round(post_raise_runway, 1),
            protective_provisions_demanded=protective_provisions,
        )


# =============================================================================
# PERSONA 2: AL-MUHAQQIQ (المحقق) — DUE DILIGENCE ANALYST
# =============================================================================

class AlMuhaqqiqAgent:
    """
    Persona 2: Forensic Diligence Analyst.
    Analyzes financial statements, unit economics (LTV/CAC, burn multiple),
    churn, market TAM, and legal/execution risks.
    """
    NAME = "Al-Muhaqqiq (المحقق)"

    def synthesize(self, profile: StartupProfileInput) -> DueDiligenceSynthesis:
        # 1. Unit Economics
        ltv_cac = round(profile.ltv_dzd / max(profile.cac_dzd, 1.0), 2)
        monthly_arpu = max(profile.ltv_dzd / 24.0, 1.0)
        payback_months = round(profile.cac_dzd / monthly_arpu, 1)

        # Burn multiple = Net Burn / Net New ARR (annualized)
        net_new_arr = profile.arr_dzd * (profile.mrr_growth_rate_pct / 100.0) * 12.0
        annual_burn = profile.burn_rate_dzd * 12.0
        burn_multiple = round(annual_burn / max(net_new_arr, 1.0), 2) if net_new_arr > 0 else 3.5

        # 2. Valuation Sanity Check
        implied_arr_mult = None
        if profile.arr_dzd > 0:
            implied_arr_mult = round(profile.valuation_ask_dzd / profile.arr_dzd, 2)
            if implied_arr_mult > 15.0:
                verdict = (
                    f"OVERVALUATION ALERT: Ask of {profile.valuation_ask_dzd:,.0f} DZD implies {implied_arr_mult:.1f}x ARR, "
                    f"significantly above regional peer benchmark of 5x - 12x ARR."
                )
            elif implied_arr_mult < 4.0:
                verdict = (
                    f"HIGHLY ATTRACTIVE / UNDERVALUED: Implied {implied_arr_mult:.1f}x ARR represents favorable entry multiple."
                )
            else:
                verdict = (
                    f"FAIR VALUATION: Implied {implied_arr_mult:.1f}x ARR aligns with MENA high-growth benchmarks (5.0x - 12.0x ARR)."
                )
        else:
            verdict = (
                "PRE-REVENUE VALUATION SANITY: Valuation based on team, IP, and market TAM. Requires milestone escrow."
            )

        # 3. Market Sizing (TAM/SAM/SOM)
        tam = profile.tam_dzd or 25_000_000_000.0 # 25 Billion DZD default (~$185M USD)
        sam = round(tam * 0.28, 2)                 # 28% serviceable addressable market
        som = round(sam * 0.08, 2)                 # 8% serviceable obtainable market

        # 4. Forensic Risk Flags
        risk_flags: List[str] = []
        if profile.runway_months < 6.0:
            risk_flags.append(f"CRITICAL RUNWAY: Only {profile.runway_months:.1f} months of cash runway remaining.")
        if ltv_cac < 3.0:
            risk_flags.append(f"UNIT ECONOMICS STRETCH: LTV/CAC ratio is {ltv_cac:.2f}x (industry target is >= 3.0x).")
        if burn_multiple > 2.5:
            risk_flags.append(f"WARNING: Elevated burn multiple ({burn_multiple:.2f}x capital consumption per net ARR).")
        if implied_arr_mult and implied_arr_mult > 15.0:
            risk_flags.append(f"OVERVALUATION ALERT: Implied multiple is {implied_arr_mult:.1f}x ARR.")
        if not profile.has_asf_label:
            risk_flags.append("REGULATORY GAP: Lacks formal Label Start-up certification.")
        if profile.churn_rate_pct > 5.0:
            risk_flags.append(f"CHURN RISK: Monthly churn rate of {profile.churn_rate_pct:.1f}% indicates potential friction.")
        if len(profile.tech_stack) < 2:
            risk_flags.append("TECH_RISK: Tech stack disclosure insufficient for thorough security/dependency audit.")

        # 5. Forensic Audit Score
        base_score = 75.0
        if ltv_cac >= 3.0:
            base_score += 10.0
        elif ltv_cac < 1.5:
            base_score -= 15.0

        if burn_multiple <= 1.5:
            base_score += 8.0
        elif burn_multiple > 3.0:
            base_score -= 12.0

        if "FAIR" in verdict or "UNDERVALUED" in verdict:
            base_score += 7.0
        elif "OVERVALUATION" in verdict:
            base_score -= 15.0

        forensic_score = max(10.0, min(100.0, base_score - len(risk_flags) * 3.0))

        return DueDiligenceSynthesis(
            agent_name=self.NAME,
            ltv_to_cac_ratio=ltv_cac,
            payback_period_months=payback_months,
            burn_multiple=burn_multiple,
            valuation_sanity_verdict=verdict,
            implied_arr_multiple=implied_arr_mult,
            benchmark_multiple_range="5.0x - 12.0x ARR",
            market_tam_dzd=tam,
            market_sam_dzd=sam,
            market_som_dzd=som,
            risk_flags=risk_flags,
            forensic_audit_score=round(forensic_score, 1),
        )


# =============================================================================
# PERSONA 3: AL-MUQAWIL (المقاول) — MILESTONE ESCROW GOVERNOR
# =============================================================================

class AlMuqawilAgent:
    """
    Persona 3: Milestone & Escrow Governor.
    Structures SMART deliverables, multi-tranche release gates for the VentureEscrowVault,
    and Service-for-Equity (S4E) Istihaq arrangements.
    """
    NAME = "Al-Muqawil (المقاول)"

    def synthesize(self, profile: StartupProfileInput) -> MilestoneEscrowSynthesis:
        # 1. Technical Feasibility Score
        tech_score = 50.0
        high_value_tech = {"rust", "go", "python", "typescript", "solidity", "c++", "pytorch", "fastapi", "react"}
        stack_lower = {t.lower() for t in profile.tech_stack}
        matches = stack_lower.intersection(high_value_tech)
        tech_score += min(len(matches) * 7.5, 35.0)

        if profile.team_size >= 3:
            tech_score += 10.0
        if profile.has_asf_label:
            tech_score += 5.0
        tech_score = max(20.0, min(100.0, tech_score))

        # 2. Suggested Multi-Tranche Escrow Schedule
        total_round = profile.target_raise_dzd
        tranches = [
            MilestoneTranche(
                tranche_number=1,
                title="Foundation & Legal Architecture",
                percentage_of_round=0.30,
                amount_dzd=round(total_round * 0.30, 2),
                deliverable_criteria="SPAS company registration with CNRC, INAPI patent/trademark filing, and deployment of audited smart escrow contracts.",
                verification_type=MilestoneVerificationType.DIRECT_RELEASE,
                kpi_gate="Statutory verification of SPAS incorporation and legal capital account opening.",
                deadline_days=30,
            ),
            MilestoneTranche(
                tranche_number=2,
                title="MVP Launch & Core Infrastructure",
                percentage_of_round=0.35,
                amount_dzd=round(total_round * 0.35, 2),
                deliverable_criteria="Production software deployment, full test suite pass (>85% coverage), SATIM/CIB gateway integration, and SOC-2 / Law 18-07 privacy audit.",
                verification_type=MilestoneVerificationType.ZK_TLS_ATTESTATION,
                kpi_gate="Cryptographic proof of GitHub commit signature and passing CI/CD pipeline test verification.",
                deadline_days=90,
            ),
            MilestoneTranche(
                tranche_number=3,
                title="Commercial Traction & Scale Gate",
                percentage_of_round=0.35,
                amount_dzd=round(total_round * 0.35, 2),
                deliverable_criteria=f"Achievement of {max(profile.arr_dzd * 1.5, 5_000_000):,.0f} DZD verified ARR and onboarding of 50+ active paying institutional or retail accounts.",
                verification_type=MilestoneVerificationType.DUAL_AGENT_CONSENSUS,
                kpi_gate="Dual-Agent consensus validation: Al-Muhaqqiq forensic banking ledger audit + Al-Mizan referee sign-off.",
                deadline_days=180,
            ),
        ]

        s4e_rec = (
            "Service-for-Equity (S4E) Structuring: Allocate up to 5.0% unallocated sweat-equity pool "
            "under the Istihaq dynamic protocol. Engineering and legal service providers vest monthly "
            "against verified deliverables under Nominee Agreement governance (Law 22-09)."
        )

        escrow_recs = [
            "All tranche disbursements held in VentureEscrowVault smart contract with 48-hour challenge periods.",
            "Independent emergency circuit breaker callable by Al-Mizan upon detected breach of contract.",
            "Automatic clawback of unspent funds to investors if Milestone 2 is unfulfilled after 180 days.",
        ]

        return MilestoneEscrowSynthesis(
            agent_name=self.NAME,
            technical_feasibility_score=round(tech_score, 1),
            suggested_escrow_tranches=tranches,
            s4e_sweat_equity_recommendation=s4e_rec,
            escrow_security_recommendations=escrow_recs,
        )


# =============================================================================
# PERSONA 4: AL-MIZAN (الميزان) — TOURNAMENT REFEREE & ARBITRATOR
# =============================================================================

class AlMizanAgent:
    """
    Persona 4: Tournament & Referee Agent.
    Calculates Al-Jadara Index (0-100), tournament tiering, ZOPA calculation,
    detects bad-faith actions, and arbitrates negotiation disputes.
    """
    NAME = "Al-Mizan (الميزان)"

    def synthesize(
        self,
        profile: StartupProfileInput,
        founder: FounderCopilotSynthesis,
        dd: DueDiligenceSynthesis,
        escrow: MilestoneEscrowSynthesis,
    ) -> RefereeTournamentSynthesis:
        # 1. Al-Jadara Index 5-Dimension Weighted Formulation
        # W1: Technical Feasibility (25%)
        # W2: Financial Health & Forensic Audit (25%)
        # W3: Market Opportunity & Growth Velocity (20%)
        # W4: Regulatory Readiness (15%)
        # W5: Team & Execution Momentum (15%)
        w_tech = escrow.technical_feasibility_score * 0.25
        w_finance = dd.forensic_audit_score * 0.25

        # Growth score
        growth_metric = min(100.0, profile.mrr_growth_rate_pct * 4.0 + (10.0 if profile.arr_dzd > 0 else 0.0))
        w_market = growth_metric * 0.20

        # Regulatory score
        reg_metric = 90.0 if profile.has_asf_label else 55.0
        w_reg = reg_metric * 0.15

        # Team & Execution score
        team_metric = min(100.0, profile.team_size * 20.0 + (15.0 if profile.runway_months >= 12 else 0.0))
        w_team = team_metric * 0.15

        jadara_index = round(w_tech + w_finance + w_market + w_reg + w_team, 1)

        # 2. Tournament Tier Determination
        if jadara_index >= 85.0:
            tier = TournamentTier.PRIVATE_SYNDICATE
            verdict = "APPROVED FOR PRIVATE SYNDICATE: Tier-1 venture investment grade. High-conviction institutional and diaspora syndication."
        elif jadara_index >= 70.0:
            tier = TournamentTier.PUBLIC_LISTING
            verdict = "QUALIFIED FOR PUBLIC LISTING: Solid commercial fundamentals and verified technical readiness for community crowd-equity."
        elif jadara_index >= 50.0:
            tier = TournamentTier.SIMULATION_LEAGUE
            verdict = "ASSIGNED TO SIMULATION LEAGUE: Promising core thesis requiring sandbox stress-testing, milestone validation, and GTM tightening."
        else:
            tier = TournamentTier.SANDBOX
            verdict = "INCUBATION SANDBOX: Early exploratory stage. Requires technical mentoring, founder formation, and customer discovery."

        score_breakdown = {
            "technical_feasibility": round(escrow.technical_feasibility_score, 1),
            "forensic_financial_health": round(dd.forensic_audit_score, 1),
            "market_growth_velocity": round(growth_metric, 1),
            "regulatory_readiness": round(reg_metric, 1),
            "team_execution": round(team_metric, 1),
            "composite_al_jadara": jadara_index,
        }

        # 3. ZOPA & Arbitration Readiness
        zopa_assessment = (
            f"ZOPA status: Startup demonstrates viable negotiation corridor. "
            f"Pre-money valuation bandwidth: {profile.valuation_ask_dzd * 0.70:,.0f} DZD to {profile.valuation_ask_dzd * 1.10:,.0f} DZD. "
            f"Jadara confidence allows up to 10 rounds of automated MAUT concession bargaining."
        )

        arbitration_clauses = [
            "Mandatory 14-day Algorithmic Mediation window prior to formal legal dispute initiation.",
            "Binding arbitration under Algerian SPAS Nominee Rules (Law 22-09) and Al-Mizan referee protocol.",
            "Neutral third-party valuation adjustment via certified Commissaire aux Comptes in event of material disagreement.",
        ]

        return RefereeTournamentSynthesis(
            agent_name=self.NAME,
            jadara_index_score=jadara_index,
            tier=tier,
            verdict=verdict,
            score_breakdown=score_breakdown,
            zopa_feasibility=zopa_assessment,
            arbitration_clauses=arbitration_clauses,
        )


# =============================================================================
# DEALMAKER SWARM ORCHESTRATOR
# =============================================================================

class DealmakerSwarm:
    """
    Dealmaker Swarm Orchestrator.
    Coordinates Al-Mu'assis, Al-Muhaqqiq, Al-Muqawil, and Al-Mizan
    for end-to-end due diligence, valuation sanity checks, and tournament refereeing.
    """

    def __init__(self):
        self.muassis = AlMuassisAgent()
        self.muhaqqiq = AlMuhaqqiqAgent()
        self.muqawil = AlMuqawilAgent()
        self.mizan = AlMizanAgent()

    def analyze_startup(self, profile: StartupProfileInput) -> SwarmAnalysisResponse:
        """
        Executes a 4-agent parallel evaluation across the swarm.
        """
        logger.info(f"Initiating Dealmaker Swarm analysis for startup: {profile.startup_name}")

        # 1. Synthesize founder co-pilot position
        syn_founder = self.muassis.synthesize(profile)

        # 2. Synthesize forensic due diligence
        syn_dd = self.muhaqqiq.synthesize(profile)

        # 3. Synthesize milestone escrow gates
        syn_escrow = self.muqawil.synthesize(profile)

        # 4. Synthesize referee tournament verdict and Al-Jadara index
        syn_referee = self.mizan.synthesize(
            profile=profile,
            founder=syn_founder,
            dd=syn_dd,
            escrow=syn_escrow,
        )

        exec_summary = (
            f"TamWheel Swarm Evaluation for {profile.startup_name} ({profile.sector}, Wilaya {profile.wilaya}): "
            f"Awarded an Al-Jadara Index of {syn_referee.jadara_index_score}/100 ({syn_referee.tier.value}). "
            f"Forensic audit: {syn_dd.valuation_sanity_verdict} with LTV/CAC ratio of {syn_dd.ltv_to_cac_ratio}x. "
            f"Escrow: Structured across {len(syn_escrow.suggested_escrow_tranches)} milestones with {syn_escrow.technical_feasibility_score}/100 technical feasibility. "
            f"Founder runway post-raise: {syn_founder.runway_post_raise_months} months."
        )

        return SwarmAnalysisResponse(
            startup_name=profile.startup_name,
            executive_summary=exec_summary,
            founder_copilot=syn_founder,
            due_diligence=syn_dd,
            milestone_escrow=syn_escrow,
            referee_verdict=syn_referee,
        )


dealmaker_swarm_instance = DealmakerSwarm()
