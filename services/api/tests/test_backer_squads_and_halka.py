"""
Comprehensive Test Suite for:
1. Backer Squads (الشلل الاستثمارية) Engine & Collaborative Diligence Canvas.
2. "Halka" Family Syndicates (حلقة العائلة) Engine & Amin Multi-Signature Governance.
3. Fast-path REST API endpoints for `/squads` and `/halka`.
"""

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.backer_squads import (
    BackerSquadsEngine,
    backer_squads_engine,
    SquadRole,
    RiskCategory,
    RiskSeverity,
    VoteChoice,
    VoteState,
)
from app.services.halka_syndicate import (
    HalkaFamilySyndicateEngine,
    halka_syndicate_engine,
    FamilyRole,
    ProposalApprovalState,
)


@pytest.fixture
def client():
    c = TestClient(app)
    token = "test_csrf_token_value_32_chars_123"
    c.cookies.set("csrf_token", token)
    c.headers.update({"x-csrf-token": token})
    return c


# =============================================================================
# BACKER SQUADS ENGINE TESTS
# =============================================================================

class TestBackerSquadsEngine:
    def test_squad_creation_and_member_limits(self):
        engine = BackerSquadsEngine()
        squad = engine.create_squad(
            name="Oran Tech Backers",
            description="Investment syndicate targeting Oran logistics startups",
            leader_id="leader-01",
            leader_name="Karim B.",
            leader_email="karim@oran.dz",
            wilaya=31,
            initial_pool_deposit_dzd=500_000.0,
        )

        assert squad.name == "Oran Tech Backers"
        assert squad.wilaya == 31
        assert squad.member_count == 1
        assert squad.members[0].role == SquadRole.LEADER
        assert squad.total_pool_dzd == 500_000.0

        # Add up to 24 additional members (total 25 = max capacity)
        for i in range(2, 26):
            engine.add_member(
                squad_id=squad.squad_id,
                user_id=f"user-{i:02d}",
                name=f"Member {i}",
                email=f"member{i}@oran.dz",
                role=SquadRole.BACKER,
                wilaya=31,
            )

        updated_squad = engine.get_squad(squad.squad_id)
        assert updated_squad.member_count == 25

        # Attempting to add the 26th member must raise ValueError
        with pytest.raises(ValueError, match="Squad capacity limit reached"):
            engine.add_member(
                squad_id=squad.squad_id,
                user_id="user-26",
                name="Member 26",
                email="member26@oran.dz",
            )

    def test_deposit_funds(self):
        engine = BackerSquadsEngine()
        squad = engine.create_squad(
            name="Algiers FinTech Syndicate",
            description="Focus on payments and POS infrastructure",
            leader_id="lead-01",
            leader_name="Sofiane M.",
            leader_email="sofiane@algiers.dz",
            wilaya=16,
            initial_pool_deposit_dzd=1_000_000.0,
        )

        updated = engine.deposit_funds(squad.squad_id, 2_500_000.0)
        assert updated.total_pool_dzd == 3_500_000.0

    def test_collaborative_diligence_canvas(self):
        engine = BackerSquadsEngine()
        squad = engine.create_squad(
            name="HealthTech Squad",
            description="Biotech and clinical lab software",
            leader_id="lead-doc",
            leader_name="Dr. Amina",
            leader_email="amina@health.dz",
            wilaya=16,
        )

        canvas = engine.get_or_create_canvas(squad.squad_id, "startup-labcare-99")
        assert canvas.startup_id == "startup-labcare-99"

        # Add Sticky Note
        note = engine.add_sticky_note(
            squad_id=squad.squad_id,
            canvas_id=canvas.canvas_id,
            author_id="lead-doc",
            author_name="Dr. Amina",
            content="Ministry of Health accreditation was confirmed on 2026-03-12.",
            color="#A7F3D0",
            pos_x=120.5,
            pos_y=340.0,
        )
        assert note.content.startswith("Ministry of Health")
        assert len(canvas.sticky_notes) == 1

        # Add Risk Pin
        pin = engine.add_risk_pin(
            squad_id=squad.squad_id,
            canvas_id=canvas.canvas_id,
            author_id="investigator-01",
            author_name="Yacine C.",
            category=RiskCategory.REGULATORY,
            severity=RiskSeverity.HIGH,
            claim_reference="Claim #3: Medical device CE / Algerian Saidal standard compliance",
            risk_summary="Reagents supplier contract has a 90-day currency fluctuation clause.",
            mitigation_suggested="Hedge raw reagent inventory via local distributor in Blida.",
        )
        assert pin.category == RiskCategory.REGULATORY
        assert pin.severity == RiskSeverity.HIGH
        assert len(canvas.risk_pins) == 1

        # Submit Conviction Votes
        engine.submit_conviction_vote(
            squad_id=squad.squad_id,
            canvas_id=canvas.canvas_id,
            member_id="lead-doc",
            member_name="Dr. Amina",
            conviction_score=85.0,
            thesis_summary="Huge underserved market in peripheral Wilayas for digital pathology.",
        )
        engine.submit_conviction_vote(
            squad_id=squad.squad_id,
            canvas_id=canvas.canvas_id,
            member_id="investigator-01",
            member_name="Yacine C.",
            conviction_score=75.0,
            thesis_summary="Solid unit economics, regulatory risk is manageable.",
        )

        assert canvas.conviction_score_average == 80.0

        # Diaspora-to-Wilaya Anchoring Pair
        pair = engine.create_diaspora_anchoring_pair(
            squad_id=squad.squad_id,
            canvas_id=canvas.canvas_id,
            diaspora_member_id="diaspora-paris-01",
            diaspora_member_name="Mehdi K. (Paris)",
            diaspora_city="Paris",
            wilaya_member_id="local-setif-01",
            wilaya_member_name="Billel K. (Sétif)",
            local_wilaya=19,
            verification_notes="Billel conducted on-site visit to the clinic in El Eulma; confirmed equipment is operational.",
        )
        assert pair.diaspora_city == "Paris"
        assert pair.local_wilaya == 19
        assert pair.verified_on_ground is True
        assert len(canvas.diaspora_pairs) == 1

    def test_consensus_voting_state_machine_and_synergy_xp(self):
        engine = BackerSquadsEngine()
        squad = engine.create_squad(
            name="AgriTech Investors Squad",
            description="Smart irrigation in Biskra and El Oued",
            leader_id="leader-01",
            leader_name="Nasser B.",
            leader_email="nasser@agri.dz",
            wilaya=7,
            initial_pool_deposit_dzd=10_000_000.0,
        )

        # Add 3 members (total 4 members)
        for i in range(2, 5):
            engine.add_member(
                squad_id=squad.squad_id,
                user_id=f"member-0{i}",
                name=f"Member {i}",
                email=f"m{i}@agri.dz",
            )

        # Propose pooled allocation with 60% consensus threshold
        vote = engine.propose_pooled_allocation(
            squad_id=squad.squad_id,
            startup_id="startup-nakheel-tech",
            startup_name="Nakheel Tech IoT",
            allocation_amount_dzd=3_000_000.0,
            consensus_threshold_pct=60.0,
        )

        assert vote.state == VoteState.ACTIVE
        assert vote.required_votes_count == 3  # 60% of 4 = 2.4 -> ceil 3 votes

        # Member 1 votes YES
        vote = engine.cast_vote(squad.squad_id, vote.vote_id, "leader-01", VoteChoice.YES)
        assert vote.state == VoteState.ACTIVE
        assert vote.yes_votes == 1

        # Member 2 votes YES
        vote = engine.cast_vote(squad.squad_id, vote.vote_id, "member-02", VoteChoice.YES)
        assert vote.state == VoteState.ACTIVE
        assert vote.yes_votes == 2

        # Member 3 votes YES -> Hits 3 required votes -> transitions to PASSED with +15% Synergy XP!
        vote = engine.cast_vote(squad.squad_id, vote.vote_id, "member-03", VoteChoice.YES)
        assert vote.state == VoteState.PASSED
        assert vote.yes_votes == 3
        assert vote.synergy_bonus_awarded is True
        assert vote.synergy_bonus_xp_multiplier == 1.15
        assert vote.earned_xp_total == 1150.0  # 1000 base * 1.15

        # Check squad pool was deducted
        updated_squad = engine.get_squad(squad.squad_id)
        assert updated_squad.total_pool_dzd == 7_000_000.0


# =============================================================================
# HALKA FAMILY SYNDICATE ENGINE TESTS
# =============================================================================

class TestHalkaSyndicateEngine:
    def test_halka_creation_and_member_roles(self):
        engine = HalkaFamilySyndicateEngine()
        halka = engine.create_halka(
            family_name="Benali Family Holdings",
            wilaya=19,  # Sétif
            amin_id="amin-el-hadj",
            amin_name="El-Hadj Lakhdar Benali",
            amin_relation="Elder Patriarch (العم الأكبر)",
            initial_vault_deposit_dzd=5_000_000.0,
        )

        assert halka.family_name == "Benali Family Holdings"
        assert halka.wilaya == 19
        assert halka.designated_amin_id == "amin-el-hadj"
        assert halka.member_count == 1
        assert halka.members[0].role == FamilyRole.AMIN
        assert halka.members[0].is_amin is True
        assert halka.total_vault_balance_dzd == 5_000_000.0

        # Add Youth Diligence Researcher
        engine.add_family_member(
            halka_id=halka.halka_id,
            member_id="youth-walid",
            full_name="Walid Benali",
            kinship_relation="Nephew / Tech Engineer (ابن الأخ)",
            role=FamilyRole.RESEARCHER_YOUTH,
            pledge_dzd=500_000.0,
        )

        # Add Family Contributor
        engine.add_family_member(
            halka_id=halka.halka_id,
            member_id="contrib-fatima",
            full_name="Fatima Benali",
            kinship_relation="Aunt (العمة)",
            role=FamilyRole.FAMILY_CONTRIBUTOR,
            pledge_dzd=1_500_000.0,
        )

        assert halka.member_count == 3
        assert halka.total_vault_balance_dzd == 7_000_000.0

    def test_proposal_exceeding_vault_balance_raises(self):
        engine = HalkaFamilySyndicateEngine()
        halka = engine.create_halka(
            family_name="Mansouri Kinship",
            wilaya=16,
            amin_id="amin-mansouri",
            amin_name="Ammi Mustapha Mansouri",
            initial_vault_deposit_dzd=1_000_000.0,
        )

        with pytest.raises(ValueError, match="exceeds Halka vault balance"):
            engine.create_proposal(
                halka_id=halka.halka_id,
                startup_id="startup-x",
                startup_name="SuperApp DZ",
                investment_amount_dzd=2_000_000.0,
                proposer_id="amin-mansouri",
                proposer_name="Ammi Mustapha Mansouri",
                diligence_summary="High growth consumer app",
            )

    def test_multisig_approval_flow_and_haptic_khatm_ceremony(self):
        engine = HalkaFamilySyndicateEngine()
        halka = engine.create_halka(
            family_name="Zitouni Family Syndicate",
            wilaya=25,  # Constantine
            amin_id="amin-zitouni",
            amin_name="Cheikh Abdelkader Zitouni",
            amin_relation="Elder Patriarch",
            initial_vault_deposit_dzd=10_000_000.0,
        )

        # Add family members
        engine.add_family_member(
            halka_id=halka.halka_id,
            member_id="shabab-samy",
            full_name="Samy Zitouni",
            kinship_relation="Cousin / Lead Analyst",
            role=FamilyRole.RESEARCHER_YOUTH,
            pledge_dzd=1_000_000.0,
        )
        engine.add_family_member(
            halka_id=halka.halka_id,
            member_id="cousin-lynda",
            full_name="Lynda Zitouni",
            kinship_relation="Cousin",
            role=FamilyRole.FAMILY_CONTRIBUTOR,
            pledge_dzd=1_000_000.0,
        )

        # Create proposal requiring 2 co-signatures
        proposal = engine.create_proposal(
            halka_id=halka.halka_id,
            startup_id="startup-sirat-logistics",
            startup_name="Sirat Cold Chain Logistics",
            investment_amount_dzd=4_000_000.0,
            proposer_id="shabab-samy",
            proposer_name="Samy Zitouni",
            diligence_summary="Refrigerated pharma delivery hub in Constantine with 3 signed enterprise contracts.",
            required_co_signatures=2,
        )

        # Proposer auto-signs (1 co-signature so far)
        assert proposal.state == ProposalApprovalState.PENDING_CO_SIGNATURES
        assert len(proposal.co_signatures_collected) == 1

        # Lynda co-signs -> Reaches 2 co-signatures -> Escalates to Amin!
        proposal = engine.co_sign_proposal(proposal.proposal_id, "cousin-lynda")
        assert proposal.state == ProposalApprovalState.PENDING_AMIN_APPROVAL
        assert len(proposal.co_signatures_collected) == 2

        # Non-amin attempts to sign -> Fails
        with pytest.raises(ValueError, match="Only designated Amin"):
            engine.amin_decision(proposal.proposal_id, "shabab-samy", approve=True)

        # Amin grants final approval -> Executes Haptic Khatm ceremony
        proposal = engine.amin_decision(
            proposal_id=proposal.proposal_id,
            amin_id="amin-zitouni",
            approve=True,
            signature_token="AMIN-ZITOUNI-BARAKA-2026",
        )

        assert proposal.state == ProposalApprovalState.EXECUTED_WITH_KHATM
        assert proposal.amin_signature == "AMIN-ZITOUNI-BARAKA-2026"
        assert proposal.khatm_ceremony is not None
        assert proposal.khatm_ceremony.acoustic_tone_frequency_hz == 432.0
        assert proposal.khatm_ceremony.tactile_haptic_pulse_ms == 80
        assert proposal.khatm_ceremony.cooling_off_window_hours == 72
        assert proposal.khatm_ceremony.digital_wax_seal_hash.startswith("0x")

        # Vault balance deducted
        assert halka.total_vault_balance_dzd == 8_000_000.0  # 12M initial + pledges - 4M investment

    def test_amin_veto_protects_nif(self):
        engine = HalkaFamilySyndicateEngine()
        halka = engine.create_halka(
            family_name="Derridj Family Syndicate",
            wilaya=16,
            amin_id="amin-derridj",
            amin_name="El-Hadj Derridj",
            initial_vault_deposit_dzd=3_000_000.0,
        )

        proposal = engine.create_proposal(
            halka_id=halka.halka_id,
            startup_id="startup-shady-crypto",
            startup_name="High Risk FX Algorithmic Bot",
            investment_amount_dzd=1_000_000.0,
            proposer_id="amin-derridj",
            proposer_name="El-Hadj Derridj",
            diligence_summary="Speculative FX arbitrage bot",
            required_co_signatures=1,  # Instantly escalates to Amin
        )
        assert proposal.state == ProposalApprovalState.PENDING_AMIN_APPROVAL

        # Amin decides to VETO to prevent Hchouma
        vetoed = engine.amin_decision(
            proposal_id=proposal.proposal_id,
            amin_id="amin-derridj",
            approve=False,
            rejection_reason="Excessive gharar and high capital impairment risk. Preserving family honor.",
        )

        assert vetoed.state == ProposalApprovalState.REJECTED_BY_AMIN
        assert "Preserving family honor" in vetoed.amin_rejection_reason
        assert halka.total_vault_balance_dzd == 3_000_000.0  # Vault untouched


# =============================================================================
# REST API ENDPOINT TESTS
# =============================================================================

class TestSquadsAndHalkaEndpoints:
    def test_squad_endpoints_e2e(self, client):
        # 1. Create Squad
        res = client.post(
            "/api/v1/squads/create",
            json={
                "name": "Annaba Tech Angels",
                "description": "Eastern coastal tech hub backers",
                "leader_id": "annaba-lead-01",
                "leader_name": "Tariq H.",
                "leader_email": "tariq@annaba.dz",
                "wilaya": 23,
                "initial_pool_deposit_dzd": 1_000_000.0,
            },
        )
        assert res.status_code == 200, res.text
        squad_data = res.json()
        squad_id = squad_data["squad_id"]
        assert squad_data["name"] == "Annaba Tech Angels"

        # 2. Get Squad
        res = client.get(f"/api/v1/squads/{squad_id}")
        assert res.status_code == 200
        assert res.json()["squad_id"] == squad_id

        # 3. Add Squad Member
        res = client.post(
            f"/api/v1/squads/{squad_id}/members",
            json={
                "user_id": "member-nadia",
                "name": "Nadia S.",
                "email": "nadia@annaba.dz",
                "role": "INVESTIGATOR",
                "wilaya": 23,
            },
        )
        assert res.status_code == 200
        assert res.json()["member_count"] == 2

        # 4. Canvas Sticky Note
        res = client.post(
            f"/api/v1/squads/{squad_id}/canvas/startup-marina-cloud/sticky-notes",
            json={
                "author_id": "member-nadia",
                "author_name": "Nadia S.",
                "content": "Port of Annaba pilot phase complete.",
                "color": "#FEF08A",
            },
        )
        assert res.status_code == 200
        canvas_data = res.json()
        canvas_id = canvas_data["canvas_id"]
        assert len(canvas_data["sticky_notes"]) == 1

        # 5. Canvas Risk Pin
        res = client.post(
            f"/api/v1/squads/{squad_id}/canvas/{canvas_id}/risk-pins",
            json={
                "author_id": "member-nadia",
                "author_name": "Nadia S.",
                "category": "TECHNICAL",
                "severity": "MEDIUM",
                "claim_reference": "Database high availability across wilayas",
                "risk_summary": "Latency on local fiber switches",
                "mitigation_suggested": "Deploy edge cache in Constantine datacenter",
            },
        )
        assert res.status_code == 200
        assert len(res.json()["risk_pins"]) == 1

        # 6. Conviction Vote
        res = client.post(
            f"/api/v1/squads/{squad_id}/canvas/{canvas_id}/conviction-votes",
            json={
                "member_id": "member-nadia",
                "member_name": "Nadia S.",
                "conviction_score": 90.0,
                "thesis_summary": "High commercial moat in maritime transport.",
            },
        )
        assert res.status_code == 200
        assert res.json()["conviction_score_average"] == 90.0

        # 7. Diaspora Anchoring Pair
        res = client.post(
            f"/api/v1/squads/{squad_id}/canvas/{canvas_id}/diaspora-pairs",
            json={
                "diaspora_member_id": "diaspora-montreal-01",
                "diaspora_member_name": "Farid M. (Montreal)",
                "diaspora_city": "Montreal",
                "wilaya_member_id": "annaba-lead-01",
                "wilaya_member_name": "Tariq H. (Annaba)",
                "local_wilaya": 23,
                "verification_notes": "Tariq audited local server racks at port depot.",
            },
        )
        assert res.status_code == 200
        assert len(res.json()["diaspora_pairs"]) == 1

        # 8. Propose Pooled Allocation
        res = client.post(
            f"/api/v1/squads/{squad_id}/proposals",
            json={
                "startup_id": "startup-marina-cloud",
                "startup_name": "Marina Cloud DZ",
                "allocation_amount_dzd": 400_000.0,
                "consensus_threshold_pct": 50.0,
            },
        )
        assert res.status_code == 200
        vote_data = res.json()
        vote_id = vote_data["vote_id"]

        # 9. Cast Vote
        res = client.post(
            f"/api/v1/squads/{squad_id}/votes/{vote_id}/cast",
            json={
                "member_id": "annaba-lead-01",
                "choice": "YES",
            },
        )
        assert res.status_code == 200
        assert res.json()["yes_votes"] == 1

    def test_halka_endpoints_e2e(self, client):
        # 1. Create Halka
        res = client.post(
            "/api/v1/halka/create",
            json={
                "family_name": "Saadi Kinship Syndicate",
                "wilaya": 9,  # Blida
                "amin_id": "amin-hadj-saadi",
                "amin_name": "El-Hadj Rabah Saadi",
                "amin_relation": "Patriarch (العم الأكبر)",
                "initial_vault_deposit_dzd": 6_000_000.0,
            },
        )
        assert res.status_code == 200, res.text
        halka_data = res.json()
        halka_id = halka_data["halka_id"]
        assert halka_data["family_name"] == "Saadi Kinship Syndicate"

        # 2. Get Halka
        res = client.get(f"/api/v1/halka/{halka_id}")
        assert res.status_code == 200
        assert res.json()["halka_id"] == halka_id

        # 3. Add Member
        res = client.post(
            f"/api/v1/halka/{halka_id}/members",
            json={
                "member_id": "shabab-aniss",
                "full_name": "Aniss Saadi",
                "kinship_relation": "Son (الابن)",
                "role": "RESEARCHER_YOUTH",
                "pledge_dzd": 500_000.0,
            },
        )
        assert res.status_code == 200
        assert res.json()["member_count"] == 2

        # 4. Create Proposal
        res = client.post(
            f"/api/v1/halka/{halka_id}/proposals",
            json={
                "startup_id": "startup-mitidja-agritech",
                "startup_name": "Mitidja Citrus Robotics",
                "investment_amount_dzd": 2_000_000.0,
                "proposer_id": "shabab-aniss",
                "proposer_name": "Aniss Saadi",
                "diligence_summary": "Automated harvesting robotics in Blida plain.",
                "required_co_signatures": 1,  # Proposer auto-co-signs, escalating to Amin immediately
            },
        )
        assert res.status_code == 200
        proposal_data = res.json()
        proposal_id = proposal_data["proposal_id"]
        assert proposal_data["state"] == "PENDING_AMIN_APPROVAL"

        # 5. Amin Decision Gate
        res = client.post(
            f"/api/v1/halka/proposals/{proposal_id}/amin-decision",
            json={
                "amin_id": "amin-hadj-saadi",
                "approve": True,
                "signature_token": "AMIN-SAADI-BARAKA-2026",
            },
        )
        assert res.status_code == 200
        decision_data = res.json()
        assert decision_data["state"] == "EXECUTED_WITH_KHATM"
        assert decision_data["khatm_ceremony"]["acoustic_tone_frequency_hz"] == 432.0
        assert decision_data["khatm_ceremony"]["tactile_haptic_pulse_ms"] == 80
        assert decision_data["khatm_ceremony"]["cooling_off_window_hours"] == 72
