"""
tests/test_leap9_consensus_board.py
Unit tests for Leap 9: C-Suite Multi-Agent Consensus Board.
"""

import pytest
from app.agent.consensus.board import (
    ConsensusBoard,
    DAFFinancialAuditor,
    PedagogyArchitect,
    DevRelMatcher,
    ConsensusStatus,
)


@pytest.mark.asyncio
async def test_daf_financial_auditor_eligible_article_169():
    auditor = DAFFinancialAuditor()
    proposal = {
        "amount_dzd": 100000,
        "type": "FREELANCE",
        "has_anae_card": True,
        "is_org_client": True,
        "freelancer_ytd_revenue_dzd": 1500000,
    }
    vote = await auditor.evaluate(proposal)
    assert vote.approved is True
    assert vote.score >= 0.8
    assert vote.metadata["ibs_shield_dzd"] == 26000.0
    assert vote.metadata["is_article_169_eligible"] is True
    assert "Compte 6186" in vote.metadata["scf_account"]


@pytest.mark.asyncio
async def test_daf_financial_auditor_ceiling_breach_veto():
    auditor = DAFFinancialAuditor()
    proposal = {
        "amount_dzd": 800000,
        "type": "FREELANCE",
        "freelancer_ytd_revenue_dzd": 4500000,  # 4.5M + 800K = 5.3M > 5M ceiling
    }
    vote = await auditor.evaluate(proposal)
    assert vote.approved is False
    assert any("ANAE_CEILING_BREACH" in flag for flag in vote.risk_flags)


@pytest.mark.asyncio
async def test_pedagogy_architect_arrete_1275():
    architect = PedagogyArchitect()
    proposal = {
        "bloom_level": "CREATE",
        "is_arrete_1275": True,
        "has_innovation_component": True,
        "has_business_model": True,
        "has_incubator_mentor": True,
        "prerequisites": ["python", "data_structures"],
        "student_mastered_skills": ["python", "data_structures"],
    }
    vote = await architect.evaluate(proposal)
    assert vote.approved is True
    assert vote.metadata["arrete_1275_compliant"] is True
    assert len(vote.risk_flags) == 0


@pytest.mark.asyncio
async def test_devrel_matcher_escrow_underfunded():
    matcher = DevRelMatcher()
    proposal = {
        "amount_dzd": 250000,
        "client_wallet_balance_dzd": 50000,  # Underfunded
        "required_stack": ["react", "fastapi"],
        "freelancer_skills": ["react", "fastapi"],
    }
    vote = await matcher.evaluate(proposal)
    assert vote.approved is False
    assert vote.metadata["escrow_risk"] == "HIGH"
    assert any("ESCROW_UNDERFUNDED" in flag for flag in vote.risk_flags)


@pytest.mark.asyncio
async def test_consensus_board_parallel_evaluation_approved():
    board = ConsensusBoard()
    proposal = {
        "amount_dzd": 120000,
        "type": "FREELANCE",
        "has_anae_card": True,
        "is_org_client": True,
        "freelancer_ytd_revenue_dzd": 800000,
        "bloom_level": "APPLY",
        "prerequisites": ["react"],
        "student_mastered_skills": ["react"],
        "required_stack": ["react", "typescript"],
        "freelancer_skills": ["react", "typescript"],
        "client_wallet_balance_dzd": 150000,
        "duration_days": 14,
    }

    decision = await board.evaluate(proposal)
    assert decision.decision == ConsensusStatus.APPROVED
    assert decision.composite_score >= 0.70
    assert len(decision.votes) == 3
    assert len(decision.dissenting_opinions) == 0


@pytest.mark.asyncio
async def test_consensus_board_critical_veto_rejects():
    board = ConsensusBoard()
    proposal = {
        "amount_dzd": 1000000,
        "freelancer_ytd_revenue_dzd": 4500000,  # Breaches 5M ceiling
    }
    decision = await board.evaluate(proposal)
    assert decision.decision == ConsensusStatus.REJECTED
    assert len(decision.risk_flags) > 0
