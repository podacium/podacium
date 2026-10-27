"""
services/api/app/agent/consensus/board.py
C-Suite Multi-Agent Consensus Board (Leap 9).

Tri-agent parallel consensus mechanism:
1. DAFFinancialAuditor: Evaluates Article 169 CIDTA tax deductions, 26% IBS shield, 5M DZD ANAE ceiling, SCF accounts (6181/6186).
2. PedagogyArchitect: Evaluates curriculum Bloom taxonomy, prerequisite mastery, Arrêté 1275 startup criteria.
3. DevRelMatcher: Evaluates freelancer tech stack match, escrow risk, milestone timelines.
4. ConsensusBoard: Runs tri-agent parallel evaluation, synthesizes voting scores, and issues consensus decisions.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger("podacium.agent.consensus")

# Statutory ANAE Annual Ceiling (Loi 22-23 / Art. 282 sexies CIDTA)
ANAE_ANNUAL_CEILING_DZD = 5_000_000
# Corporate Income Tax (IBS) Shield Rate in Algeria
IBS_TAX_RATE = 0.26


class AuditorRole(str, Enum):
    DAF_FINANCIAL = "DAF_FINANCIAL_AUDITOR"
    PEDAGOGY = "PEDAGOGY_ARCHITECT"
    DEVREL = "DEVREL_MATCHER"


class ConsensusStatus(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    REQUIRES_HUMAN_REVIEW = "REQUIRES_HUMAN_REVIEW"


class AuditorVote(BaseModel):
    auditor_name: str
    role: AuditorRole
    score: float = Field(
        ..., ge=0.0, le=1.0, description="Confidence/Approval score between 0.0 and 1.0"
    )
    approved: bool
    weight: float = 1.0
    rationale: str
    risk_flags: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ConsensusDecision(BaseModel):
    decision: ConsensusStatus
    composite_score: float = Field(..., ge=0.0, le=1.0)
    is_unanimous: bool
    votes: Dict[str, AuditorVote]
    consensus_summary: str
    recommendations: List[str]
    dissenting_opinions: List[str]
    risk_flags: List[str]
    evaluated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# 1. DAF FINANCIAL AUDITOR
# =============================================================================


class DAFFinancialAuditor:
    """
    Directeur Administratif et Financier (DAF) Agent.
    Specializes in Algerian tax shields (Art. 169 CIDTA, 26% IBS deduction),
    5M DZD ANAE revenue ceiling under Loi 22-23, and SCF accounts (6181, 6186, 411, 401).
    """

    def __init__(self, weight: float = 0.35):
        self.name = "DAF Financial Auditor"
        self.role = AuditorRole.DAF_FINANCIAL
        self.weight = weight

    async def evaluate(self, proposal: Dict[str, Any]) -> AuditorVote:
        amount_dzd = float(
            proposal.get("amount_dzd", 0) or proposal.get("budget_dzd", 0)
        )
        proposal_type = str(proposal.get("type", "FREELANCE")).upper()
        freelancer_ytd_revenue = float(proposal.get("freelancer_ytd_revenue_dzd", 0))
        has_anae_card = bool(proposal.get("has_anae_card", True))
        is_org_client = bool(proposal.get("is_org_client", True))

        risk_flags: List[str] = []
        recommendations: List[str] = []
        score = 1.0

        # 1. Evaluate SCF Account Mapping
        if proposal_type in ("COURSE", "TRAINING", "EDTECH", "CURRICULUM"):
            scf_account = "Compte 6181 (Documentation, formation et colloques)"
            tax_category = "EXPENSE_TRAINING"
        elif proposal_type in ("FREELANCE", "CONTRACT", "MILESTONE"):
            scf_account = "Compte 6186 (Rémunérations d'intermédiaires et honoraires)"
            tax_category = "EXPENSE_HONORAIRES_FREELANCE"
        else:
            scf_account = "Compte 618 (Services extérieurs divers)"
            tax_category = "EXPENSE_GENERAL"

        # 2. Evaluate 5,000,000 DZD ANAE Statutory Ceiling (Loi 22-23)
        projected_freelancer_revenue = freelancer_ytd_revenue + amount_dzd
        if projected_freelancer_revenue > ANAE_ANNUAL_CEILING_DZD:
            overage = projected_freelancer_revenue - ANAE_ANNUAL_CEILING_DZD
            risk_flags.append(
                f"ANAE_CEILING_BREACH: Projected annual revenue ({projected_freelancer_revenue:,.0f} DZD) "
                f"exceeds 5,000,000 DZD statutory ceiling by {overage:,.0f} DZD under Loi 22-23."
            )
            score -= 0.50
            recommendations.append(
                "Transition contractor to SARL or EURL commercial registration."
            )

        # 3. Evaluate Article 169 CIDTA Tax Deductibility & 26% IBS Shield
        if is_org_client:
            if has_anae_card:
                ibs_shield_dzd = round(amount_dzd * IBS_TAX_RATE, 2)
                deductible_status = "100% Tax-Deductible under Article 169 CIDTA"
            else:
                ibs_shield_dzd = 0.0
                deductible_status = "Non-deductible / High Fiscal Audit Risk"
                risk_flags.append(
                    "MISSING_ANAE_STATUS: Freelancer lacks certified ANAE card; corporate tax deductibility void."
                )
                score -= 0.35
                recommendations.append(
                    "Require verified ANAE card upload prior to contract validation."
                )
        else:
            ibs_shield_dzd = 0.0
            deductible_status = "B2C Transaction - Personal Expense"

        # 4. Check Negative or Zero Amount Anomalies
        if amount_dzd <= 0:
            risk_flags.append(
                "ZERO_OR_NEGATIVE_AMOUNT: Financial transaction must have positive amount."
            )
            score = 0.0

        approved = score >= 0.65 and not any(
            "ANAE_CEILING_BREACH" in flag for flag in risk_flags
        )

        rationale = (
            f"Financial Audit: Mapped to {scf_account}. "
            f"Tax Status: {deductible_status}. "
            f"Calculated 26% IBS Tax Shield: {ibs_shield_dzd:,.0f} DZD. "
            f"Projected ANAE Annual Utilization: {projected_freelancer_revenue:,.0f} / 5,000,000 DZD "
            f"({(projected_freelancer_revenue / ANAE_ANNUAL_CEILING_DZD * 100):.1f}%)."
        )

        return AuditorVote(
            auditor_name=self.name,
            role=self.role,
            score=max(0.0, min(1.0, score)),
            approved=approved,
            weight=self.weight,
            rationale=rationale,
            risk_flags=risk_flags,
            recommendations=recommendations,
            metadata={
                "scf_account": scf_account,
                "tax_category": tax_category,
                "ibs_shield_dzd": ibs_shield_dzd,
                "is_article_169_eligible": has_anae_card and is_org_client,
                "anae_annual_ceiling_dzd": ANAE_ANNUAL_CEILING_DZD,
                "projected_revenue_dzd": projected_freelancer_revenue,
            },
        )


# =============================================================================
# 2. PEDAGOGY ARCHITECT
# =============================================================================


class PedagogyArchitect:
    """
    Pedagogy Architect Agent.
    Evaluates learning objectives under Bloom's Revised Taxonomy,
    verifies prerequisite mastery chains, and validates Arrêté 1275 startup criteria.
    """

    BLOOM_HIERARCHY = {
        "REMEMBER": 0.30,
        "UNDERSTAND": 0.45,
        "APPLY": 0.65,
        "ANALYZE": 0.80,
        "EVALUATE": 0.90,
        "CREATE": 1.00,
    }

    def __init__(self, weight: float = 0.35):
        self.name = "Pedagogy Architect"
        self.role = AuditorRole.PEDAGOGY
        self.weight = weight

    async def evaluate(self, proposal: Dict[str, Any]) -> AuditorVote:
        bloom_level = str(proposal.get("bloom_level", "APPLY")).upper()
        target_skills = proposal.get("target_skills", []) or []
        prerequisites = proposal.get("prerequisites", []) or []
        student_mastered = proposal.get("student_mastered_skills", []) or []
        is_startup_thesis = bool(proposal.get("is_arrete_1275", False))

        risk_flags: List[str] = []
        recommendations: List[str] = []
        score = 0.85

        # 1. Bloom's Taxonomy Cognitive Depth
        bloom_score = self.BLOOM_HIERARCHY.get(bloom_level, 0.60)
        if bloom_level in ("REMEMBER", "UNDERSTAND") and not is_startup_thesis:
            recommendations.append(
                "Upgrade assessments to include applied labs (Bloom 'APPLY' or 'CREATE')."
            )

        # 2. Prerequisite Mastery Gap Analysis
        unmastered = [p for p in prerequisites if p not in student_mastered]
        if unmastered:
            gap_ratio = len(unmastered) / max(1, len(prerequisites))
            score -= gap_ratio * 0.40
            risk_flags.append(
                f"PREREQUISITE_DEFICIT: Missing required foundational skills: {', '.join(unmastered)}"
            )
            recommendations.append(
                f"Complete remediation modules for: {', '.join(unmastered)}."
            )

        # 3. Arrêté 1275 ("Un diplôme - une startup / un brevet") Evaluation
        arrete_1275_compliant = False
        if is_startup_thesis:
            has_innovation = bool(proposal.get("has_innovation_component", True))
            has_business_model = bool(proposal.get("has_business_model", True))
            has_incubator_mentor = bool(proposal.get("has_incubator_mentor", True))

            if has_innovation and has_business_model and has_incubator_mentor:
                arrete_1275_compliant = True
                score = min(1.0, score + 0.15)
            else:
                arrete_1275_compliant = False
                missing_criteria = []
                if not has_innovation:
                    missing_criteria.append(
                        "Innovative technological core / patentability"
                    )
                if not has_business_model:
                    missing_criteria.append("Validated Algerian market business model")
                if not has_incubator_mentor:
                    missing_criteria.append("Assigned university incubator mentor")
                risk_flags.append(
                    f"ARRETE_1275_NON_COMPLIANT: Missing decree criteria: {'; '.join(missing_criteria)}"
                )
                score -= 0.30

        approved = score >= 0.60

        rationale = (
            f"Pedagogical Assessment: Cognitive level '{bloom_level}' (Base index: {bloom_score:.2f}). "
            f"Prerequisite satisfaction: {len(prerequisites) - len(unmastered)}/{len(prerequisites)} satisfied. "
            f"Arrêté 1275 Status: {'COMPLIANT' if arrete_1275_compliant else ('N/A' if not is_startup_thesis else 'INCOMPLETE')}."
        )

        return AuditorVote(
            auditor_name=self.name,
            role=self.role,
            score=max(0.0, min(1.0, score)),
            approved=approved,
            weight=self.weight,
            rationale=rationale,
            risk_flags=risk_flags,
            recommendations=recommendations,
            metadata={
                "bloom_level": bloom_level,
                "bloom_index": bloom_score,
                "target_skills": target_skills,
                "unmastered_prerequisites": unmastered,
                "arrete_1275_compliant": arrete_1275_compliant,
            },
        )


# =============================================================================
# 3. DEVREL MATCHER
# =============================================================================


class DevRelMatcher:
    """
    Developer Relations & Technical Matcher Agent.
    Evaluates freelancer-to-contract stack compatibility, escrow funding risks,
    and realistic milestone delivery timelines.
    """

    def __init__(self, weight: float = 0.30):
        self.name = "DevRel Matcher"
        self.role = AuditorRole.DEVREL
        self.weight = weight

    async def evaluate(self, proposal: Dict[str, Any]) -> AuditorVote:
        required_stack = [s.lower() for s in (proposal.get("required_stack", []) or [])]
        freelancer_skills = [
            s.lower() for s in (proposal.get("freelancer_skills", []) or [])
        ]
        milestone_amount = float(
            proposal.get("amount_dzd", 0) or proposal.get("milestone_amount_dzd", 0)
        )
        client_wallet_balance = float(
            proposal.get("client_wallet_balance_dzd", milestone_amount)
        )
        milestone_days = int(proposal.get("duration_days", 14))

        risk_flags: List[str] = []
        recommendations: List[str] = []
        score = 0.90

        # 1. Tech Stack Matching
        if required_stack:
            matched = [s for s in required_stack if s in freelancer_skills]
            match_rate = len(matched) / len(required_stack)
            if match_rate < 0.60:
                missing_tech = [s for s in required_stack if s not in freelancer_skills]
                risk_flags.append(
                    f"TECH_STACK_MISMATCH: Candidate lacks required core stack: {', '.join(missing_tech)}"
                )
                score -= 0.50 * (1.0 - match_rate)
                recommendations.append(
                    f"Assign technical mentor or pair programmer for {', '.join(missing_tech)}."
                )
        else:
            match_rate = 1.0

        # 2. Escrow Risk Evaluation
        if client_wallet_balance < milestone_amount:
            shortfall = milestone_amount - client_wallet_balance
            risk_flags.append(
                f"ESCROW_UNDERFUNDED: Wallet balance ({client_wallet_balance:,.0f} DZD) "
                f"cannot cover milestone ({milestone_amount:,.0f} DZD). Shortfall: {shortfall:,.0f} DZD."
            )
            score -= 0.40
            recommendations.append(
                "Require client to fund escrow via EDAHABIA/CIB before milestone commencement."
            )
            escrow_risk = "HIGH"
        elif milestone_amount > 300_000:
            risk_flags.append(
                "LARGE_MILESTONE_RISK: Single milestone exceeds 300,000 DZD threshold."
            )
            recommendations.append(
                "Split large milestone into incremental 2-week sub-milestones."
            )
            escrow_risk = "MEDIUM"
        else:
            escrow_risk = "LOW"

        # 3. Milestone Timeline Realism
        if milestone_days < 5 and len(required_stack) > 3:
            risk_flags.append(
                "UNREALISTIC_TIMELINE: Complex multi-tier deliverables allocated < 5 days."
            )
            score -= 0.20
            recommendations.append(
                "Extend milestone timeline to at least 10 business days."
            )

        approved = score >= 0.65 and escrow_risk != "HIGH"

        rationale = (
            f"DevRel Technical Match: Stack fit {match_rate * 100:.1f}%. "
            f"Escrow Risk: {escrow_risk}. "
            f"Timeline: {milestone_days} days."
        )

        return AuditorVote(
            auditor_name=self.name,
            role=self.role,
            score=max(0.0, min(1.0, score)),
            approved=approved,
            weight=self.weight,
            rationale=rationale,
            risk_flags=risk_flags,
            recommendations=recommendations,
            metadata={
                "tech_match_rate": match_rate,
                "escrow_risk": escrow_risk,
                "milestone_days": milestone_days,
            },
        )


# =============================================================================
# 4. CONSENSUS BOARD ORCHESTRATOR
# =============================================================================


class ConsensusBoard:
    """
    Tri-agent parallel consensus engine synthesizing DAF, Pedagogy, and DevRel audits.
    Computes composite score and produces binding governance decisions.
    """

    def __init__(
        self,
        daf_auditor: Optional[DAFFinancialAuditor] = None,
        pedagogy_architect: Optional[PedagogyArchitect] = None,
        devrel_matcher: Optional[DevRelMatcher] = None,
        approval_threshold: float = 0.70,
    ):
        self.daf = daf_auditor or DAFFinancialAuditor(weight=0.35)
        self.pedagogy = pedagogy_architect or PedagogyArchitect(weight=0.35)
        self.devrel = devrel_matcher or DevRelMatcher(weight=0.30)
        self.approval_threshold = approval_threshold

    async def evaluate(self, proposal: Dict[str, Any]) -> ConsensusDecision:
        """
        Executes parallel tri-agent evaluation, weights scores, synthesizes votes,
        and outputs unanimous or consensus decisions.
        """
        # Run tri-agent evaluations in parallel
        daf_vote, ped_vote, dev_vote = await asyncio.gather(
            self.daf.evaluate(proposal),
            self.pedagogy.evaluate(proposal),
            self.devrel.evaluate(proposal),
        )

        votes: Dict[str, AuditorVote] = {
            self.daf.role.value: daf_vote,
            self.pedagogy.role.value: ped_vote,
            self.devrel.role.value: dev_vote,
        }

        # Calculate weighted composite score
        total_weight = daf_vote.weight + ped_vote.weight + dev_vote.weight
        composite_score = (
            (daf_vote.score * daf_vote.weight)
            + (ped_vote.score * ped_vote.weight)
            + (dev_vote.score * dev_vote.weight)
        ) / total_weight

        # Check for unanimity & collect risk flags
        all_approved = daf_vote.approved and ped_vote.approved and dev_vote.approved
        is_unanimous = all_approved or (
            not daf_vote.approved and not ped_vote.approved and not dev_vote.approved
        )

        all_risk_flags: List[str] = []
        all_recommendations: List[str] = []
        dissenting_opinions: List[str] = []

        for vote in votes.values():
            all_risk_flags.extend(vote.risk_flags)
            all_recommendations.extend(vote.recommendations)
            if not vote.approved:
                dissenting_opinions.append(
                    f"[{vote.auditor_name}] Dissent: {vote.rationale}"
                )

        # Critical veto triggers (e.g., hard tax ceiling breach or zero/negative escrow balance)
        has_critical_veto = any(
            "ANAE_CEILING_BREACH" in flag
            or "ZERO_OR_NEGATIVE_AMOUNT" in flag
            or "ESCROW_UNDERFUNDED" in flag
            for flag in all_risk_flags
        )

        # Determine consensus decision
        if has_critical_veto or composite_score < 0.50:
            decision = ConsensusStatus.REJECTED
        elif composite_score >= self.approval_threshold and all_approved:
            decision = ConsensusStatus.APPROVED
        else:
            decision = ConsensusStatus.REQUIRES_HUMAN_REVIEW

        summary = (
            f"Consensus Decision: {decision.value} (Composite Score: {composite_score:.2f} / 1.00). "
            f"DAF: {'APPROVED' if daf_vote.approved else 'REJECTED'} ({daf_vote.score:.2f}), "
            f"Pedagogy: {'APPROVED' if ped_vote.approved else 'REJECTED'} ({ped_vote.score:.2f}), "
            f"DevRel: {'APPROVED' if dev_vote.approved else 'REJECTED'} ({dev_vote.score:.2f})."
        )

        return ConsensusDecision(
            decision=decision,
            composite_score=round(composite_score, 3),
            is_unanimous=is_unanimous,
            votes=votes,
            consensus_summary=summary,
            recommendations=list(dict.fromkeys(all_recommendations)),  # Deduplicate
            dissenting_opinions=dissenting_opinions,
            risk_flags=all_risk_flags,
        )


# Global singleton instance
consensus_board = ConsensusBoard()
