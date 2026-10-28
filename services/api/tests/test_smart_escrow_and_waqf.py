"""
TamWheel Sovereign Ethical Agentic Venture OS — Smart Escrow Vault & Waqf Innovation Tests.
Tests:
1. Multi-Key Smart Escrow Vault Tranche lifecycle (Key 1 -> Key 2 -> Key 3 -> RELEASED).
2. Dispute Deadlock & Automated Pro-Rata Investor Refund Execution.
3. Sharia Supervisory Board (SSB) Fatwa Registry & Annual Compliance Audit under AAOIFI Governance Standards.
4. Cash Waqf (Waqf al-Nuqud) innovation pools & non-dilutive scientific spin-off grants under AAOIFI Standard No. 60.
5. FastAPI REST API endpoints under /api/v1/escrow and /api/v1/waqf.
"""

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.smart_escrow_vault import (
    smart_escrow_engine,
    TrancheStatus,
    CreateVaultRequest,
    CreateVaultTrancheItem,
    CreateVaultInvestorItem,
    SubmitProofRequest,
    AuditorReviewRequest,
    RefereeReleaseRequest,
    RefundTriggerRequest,
)
from app.services.sharia_fatwa import (
    sharia_fatwa_service,
    FatwaType,
    RegisterFatwaRequest,
    ScholarCredential,
)
from app.services.waqf_engine import (
    waqf_engine,
    WaqfCategory,
    EndowWaqfRequest,
    DisburseGrantRequest,
)


@pytest.fixture
def client():
    c = TestClient(app)
    token = "test_csrf_token_value_32_chars_123"
    c.cookies.set("csrf_token", token)
    c.headers.update({"x-csrf-token": token})
    return c


# =============================================================================
# 1. SMART ESCROW VAULT & MULTI-KEY RELEASE TESTS
# =============================================================================

class TestSmartEscrowVaultEngine:
    """Test suite for multi-key escrow vault, tranche audits, and automated pro-rata refunds."""

    def test_vault_creation_validation(self):
        # 1. Valid vault creation
        req = CreateVaultRequest(
            campaign_id="camp-ouargla-01",
            startup_id="start-solar-01",
            startup_name="Ouargla Desert Solar",
            total_raised_dzd=10_000_000,
            tranches=[
                CreateVaultTrancheItem(
                    tranche_number=1,
                    title="Phase 1: Inverters & Batteries",
                    deliverable_criteria="Procurement and delivery of 100kW storage inverters",
                    percentage_of_total=0.40,
                    deadline_days=30,
                    kpi_gate="Delivery receipt verified by CNRC customs broker",
                ),
                CreateVaultTrancheItem(
                    tranche_number=2,
                    title="Phase 2: Grid Commissioning",
                    deliverable_criteria="Grid connection and telemetry streaming",
                    percentage_of_total=0.60,
                    deadline_days=90,
                    kpi_gate="Active power generation streaming to Sonelgaz grid",
                ),
            ],
            investors=[
                CreateVaultInvestorItem(investor_id="inv-karim", investor_name="Karim B.", amount_dzd=6_000_000),
                CreateVaultInvestorItem(investor_id="inv-amina", investor_name="Amina S.", amount_dzd=4_000_000),
            ],
        )
        vault = smart_escrow_engine.create_vault(req)

        assert vault.vault_id.startswith("VAULT-CAMP-O")
        assert vault.total_raised_dzd == 10_000_000.0
        assert vault.total_locked_dzd == 10_000_000.0
        assert len(vault.tranches) == 2
        assert len(vault.investors) == 2
        assert vault.investors[0].share_pct == 0.60
        assert vault.investors[1].share_pct == 0.40
        assert len(vault.vault_seal_hash) == 64

        # 2. Invalid tranche percentages (<1.0)
        invalid_tranches_req = req.model_copy(deep=True)
        invalid_tranches_req.tranches[0].percentage_of_total = 0.20 # sums to 0.80 != 1.0
        with pytest.raises(ValueError, match="Tranche percentages must sum to 100%"):
            smart_escrow_engine.create_vault(invalid_tranches_req)

        # 3. Mismatched pledges vs total raised
        invalid_pledges_req = req.model_copy(deep=True)
        invalid_pledges_req.investors[0].amount_dzd = 1_000_000 # sums to 5M != 10M
        with pytest.raises(ValueError, match="must match total raised"):
            smart_escrow_engine.create_vault(invalid_pledges_req)

    def test_multi_key_tranche_progression_to_release(self):
        # Setup vault
        req = CreateVaultRequest(
            campaign_id="camp-algiers-02",
            startup_id="start-biotech-02",
            startup_name="Algiers Gene Diagnostics",
            total_raised_dzd=5_000_000,
            tranches=[
                CreateVaultTrancheItem(
                    tranche_number=1,
                    title="Tranche 1: Reagents Setup",
                    deliverable_criteria="Lab ISO 15189 accreditation filing",
                    percentage_of_total=1.0,
                    deadline_days=45,
                    kpi_gate="Accreditation dossier accepted",
                )
            ],
            investors=[
                CreateVaultInvestorItem(investor_id="inv-diaspora-1", investor_name="Lyes D.", amount_dzd=5_000_000)
            ],
        )
        vault = smart_escrow_engine.create_vault(req)
        t_id = vault.tranches[0].tranche_id

        # 1. Initially PENDING_PROOF
        assert vault.tranches[0].status == TrancheStatus.PENDING_PROOF

        # 2. Key 1: Founder Proof Submission
        tranche = smart_escrow_engine.submit_founder_proof(
            vault.vault_id,
            t_id,
            SubmitProofRequest(
                proof_description="ISO 15189 dossier submitted with filing receipt #DZ-LAB-2026",
                proof_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            ),
        )
        assert tranche.status == TrancheStatus.SUBMITTED
        assert tranche.founder_proof.key_1_signed is True

        # Cannot release prematurely by referee without Key 2 audit
        with pytest.raises(ValueError, match="Tranche must be verified and approved by auditor"):
            smart_escrow_engine.release_by_referee(
                vault.vault_id, t_id, RefereeReleaseRequest(referee_id="REF-01")
            )

        # 3. Key 2: Independent Auditor Review
        tranche = smart_escrow_engine.verify_auditor(
            vault.vault_id,
            t_id,
            AuditorReviewRequest(
                auditor_id="AUD-DR-HASSAN",
                auditor_name="Dr. Hassan M.",
                technical_score=94.0,
                spec_compliance_score=90.0,
                approved=True,
                audit_notes="Dossier satisfies all Algerian Ministry of Health regulatory criteria.",
            ),
        )
        assert tranche.status == TrancheStatus.AUDITED
        assert tranche.auditor_review.key_2_signed is True
        assert tranche.auditor_review.composite_score == 92.0

        # 4. Key 3: Platform Referee Sign-off & Funds Release
        tranche = smart_escrow_engine.release_by_referee(
            vault.vault_id,
            t_id,
            RefereeReleaseRequest(
                referee_id="REF-AL-MIZAN-001",
                referee_name="Al-Mizan Compliance Referee",
                compliance_notes="Verified multi-key consensus criteria satisfied.",
            ),
        )
        assert tranche.status == TrancheStatus.RELEASED
        assert tranche.referee_approval.key_3_signed is True
        assert len(tranche.tranche_seal_hash) == 64

        # Verify vault financial state
        updated_vault = smart_escrow_engine.get_vault(vault.vault_id)
        assert updated_vault.total_locked_dzd == 0.0
        assert updated_vault.total_released_dzd == 5_000_000.0

    def test_dispute_deadlock_automated_pro_rata_refund(self):
        req = CreateVaultRequest(
            campaign_id="camp-setif-03",
            startup_id="start-iot-03",
            startup_name="Setif IoT Smart Grid",
            total_raised_dzd=8_000_000,
            tranches=[
                CreateVaultTrancheItem(
                    tranche_number=1,
                    title="Hardware Gateway Prototyping",
                    deliverable_criteria="Firmware source code with OTA encryption",
                    percentage_of_total=1.0,
                    deadline_days=60,
                    kpi_gate="Firmware audit passed",
                )
            ],
            investors=[
                CreateVaultInvestorItem(investor_id="inv-samir", investor_name="Samir K.", amount_dzd=6_000_000), # 75%
                CreateVaultInvestorItem(investor_id="inv-nadia", investor_name="Nadia T.", amount_dzd=2_000_000), # 25%
            ],
        )
        vault = smart_escrow_engine.create_vault(req)
        t_id = vault.tranches[0].tranche_id

        # Founder failed to meet acceptance criteria, dispute triggered
        refund_receipt = smart_escrow_engine.trigger_pro_rata_refund(
            vault.vault_id,
            t_id,
            RefundTriggerRequest(reason="Founder failed to deliver firmware within statutory 60-day window."),
        )

        assert refund_receipt.refund_id.startswith("REFUND-TRNCH-")
        assert refund_receipt.total_refunded_amount_dzd == 8_000_000.0
        assert len(refund_receipt.investor_refunds) == 2

        # Check exact pro-rata splits: 75% = 6M, 25% = 2M
        inv_samir_refund = next(r for r in refund_receipt.investor_refunds if r.investor_id == "inv-samir")
        assert inv_samir_refund.refund_amount_dzd == 6_000_000.0
        assert inv_samir_refund.pro_rata_share_pct == 75.0

        inv_nadia_refund = next(r for r in refund_receipt.investor_refunds if r.investor_id == "inv-nadia")
        assert inv_nadia_refund.refund_amount_dzd == 2_000_000.0
        assert inv_nadia_refund.pro_rata_share_pct == 25.0

        # Check vault state
        updated_vault = smart_escrow_engine.get_vault(vault.vault_id)
        assert updated_vault.total_locked_dzd == 0.0
        assert updated_vault.total_refunded_dzd == 8_000_000.0


# =============================================================================
# 2. SHARIA FATWA AUDIT REGISTRY TESTS
# =============================================================================

class TestShariaFatwaAuditService:
    """Test suite for immutable Fatwa registry and annual Sharia audit reports."""

    def test_seeded_fatwas_available(self):
        fatwas = sharia_fatwa_service.list_fatwas()
        assert len(fatwas) >= 3
        titles = [f.fatwa_title for f in fatwas]
        assert any("Mudarabah" in t for t in titles)
        assert any("Tathir" in t for t in titles)
        assert any("Micro-Sukuk" in t for t in titles)

    def test_register_new_fatwa_and_hash_seal(self):
        new_fatwa = sharia_fatwa_service.register_fatwa(
            RegisterFatwaRequest(
                fatwa_title="Fatwa No. 04/2026: Halal AI Algorithm Licensing and Open Weights Governance",
                fatwa_type=FatwaType.PRODUCT_APPROVAL,
                standards_grounding=["AAOIFI Shariah Standard No. 42 (Financial Rights & Usufruct)"],
                pronouncement_arabic="إجازة تداول واستغلال النماذج والخوارزميات البرمجية كأصول معنوية مشروعة.",
                pronouncement_english="Permissibility of commercializing AI weights and algorithms as legitimate usufruct assets.",
                scholars_signoff=[
                    ScholarCredential(
                        scholar_id="SCHOLAR-DZ-TEST",
                        name="Sheikh Ahmad",
                        title="Member of Islamic Council",
                        institution="National Board",
                    )
                ],
            )
        )
        assert new_fatwa.fatwa_id.startswith("FATWA-PRODUCT_")
        assert len(new_fatwa.cryptographic_audit_hash) == 64

    def test_generate_annual_sharia_audit_report(self):
        report = sharia_fatwa_service.generate_annual_audit_report(
            fiscal_year=2026,
            total_startups_screened=50,
            compliant_startups_count=45,
            non_compliant_startups_count=5,
            total_purification_routed_dzd=2_500_000,
        )
        assert report.report_id.startswith("SSB-AUDIT-2026-")
        assert report.fiscal_year == 2026
        assert report.total_startups_screened == 50
        assert len(report.report_audit_seal) == 64
        assert "AAOIFI Governance Standard No. 1" in report.governance_standards_applied[0]


# =============================================================================
# 3. WAQF INNOVATION POOL & SCIENTIFIC GRANTS TESTS
# =============================================================================

class TestWaqfEndowmentEngine:
    """Test suite for Cash Waqf pools and non-dilutive scientific research grants."""

    def test_initial_waqf_pools_funded(self):
        pools = waqf_engine.list_all_pools()
        assert len(pools) == 4
        categories = [p.pool_category for p in pools]
        assert WaqfCategory.UNIVERSITY_STEM_RESEARCH in categories
        assert WaqfCategory.HEALTH_AND_BIOTECH in categories
        assert WaqfCategory.AGRITECH_SOVEREIGNTY in categories
        assert WaqfCategory.CLEAN_ENERGY_WATER in categories

        # Check total endowed balance
        stem_pool = next(p for p in pools if p.pool_category == WaqfCategory.UNIVERSITY_STEM_RESEARCH)
        assert stem_pool.total_endowed_principal_dzd >= 25_000_000.0
        assert stem_pool.available_grant_balance_dzd > 0.0

    def test_endow_cash_waqf_contribution(self):
        contrib = waqf_engine.endow_cash_waqf(
            EndowWaqfRequest(
                waqif_id="donor-malek-01",
                waqif_name="Malek Bennabi Memorial Fund",
                amount_dzd=5_000_000,
                designated_pool=WaqfCategory.UNIVERSITY_STEM_RESEARCH,
                is_perpetual_principal=True,
            )
        )
        assert contrib.contribution_id.startswith("WAQF-CONTRIB-")
        assert contrib.amount_dzd == 5_000_000.0
        assert len(contrib.contribution_hash) == 64

    def test_disburse_non_dilutive_stem_grant(self):
        grant = waqf_engine.disburse_grant(
            DisburseGrantRequest(
                recipient_project="ESI DeepVision Lab",
                university_or_institute="Higher National School of Computer Science (ESI Algiers)",
                grant_amount_dzd=1_500_000,
                category=WaqfCategory.UNIVERSITY_STEM_RESEARCH,
                scientific_scope="Compute credits for multi-spectral satellite imagery detection of Saharan desertification.",
            )
        )
        assert grant.grant_id.startswith("WAQF-GRNT-")
        assert grant.grant_amount_dzd == 1_500_000.0
        assert "Non-dilutive philanthropic grant" in grant.non_dilutive_declaration
        assert grant.approved_by_mutawalli is True
        assert len(grant.grant_seal_hash) == 64


# =============================================================================
# 4. FASTAPI ENDPOINT INTEGRATION TESTS (/api/v1/escrow & /api/v1/waqf)
# =============================================================================

class TestEscrowAndWaqfEndpoints:
    """Integration test suite for escrow and waqf REST APIs."""

    def test_api_escrow_vault_lifecycle_endpoint(self, client):
        # 1. Create Vault
        create_payload = {
            "campaign_id": "camp-oran-api-01",
            "startup_id": "start-med-api",
            "startup_name": "Oran Robotic Surgery",
            "total_raised_dzd": 6000000,
            "tranches": [
                {
                    "tranche_number": 1,
                    "title": "Sterile Lab Prototype",
                    "deliverable_criteria": "Robotic arm actuator benchmark",
                    "percentage_of_total": 1.0,
                    "deadline_days": 45,
                    "kpi_gate": "Latency < 5ms",
                    "verification_type": "MULTI_KEY_AUDIT",
                }
            ],
            "investors": [
                {"investor_id": "inv-1", "investor_name": "Dr. Amine", "amount_dzd": 6000000}
            ],
        }
        res = client.post("/api/v1/escrow/vaults", json=create_payload)
        assert res.status_code == 201
        vault = res.json()
        v_id = vault["vault_id"]
        t_id = vault["tranches"][0]["tranche_id"]

        # 2. Key 1: Submit Proof
        proof_payload = {
            "proof_description": "Robotic actuator benchmark test video and calibration metrics",
            "proof_hash": "abcdef1234567890abcdef1234567890abcdef12",
        }
        res_proof = client.post(f"/api/v1/escrow/vaults/{v_id}/tranches/{t_id}/proof", json=proof_payload)
        assert res_proof.status_code == 200
        assert res_proof.json()["status"] == "SUBMITTED"

        # 3. Key 2: Audit Review
        audit_payload = {
            "auditor_id": "AUD-BIO-01",
            "auditor_name": "Ing. Farid",
            "technical_score": 92,
            "spec_compliance_score": 90,
            "approved": True,
            "audit_notes": "Meets 5ms latency spec perfectly.",
        }
        res_audit = client.post(f"/api/v1/escrow/vaults/{v_id}/tranches/{t_id}/audit", json=audit_payload)
        assert res_audit.status_code == 200
        assert res_audit.json()["status"] == "AUDITED"

        # 4. Key 3: Referee Release
        release_payload = {
            "referee_id": "REF-MIZAN-GLOBAL",
            "referee_name": "Al-Mizan Lead Referee",
            "compliance_notes": "All multi-key requirements fulfilled.",
        }
        res_release = client.post(f"/api/v1/escrow/vaults/{v_id}/tranches/{t_id}/release", json=release_payload)
        assert res_release.status_code == 200
        assert res_release.json()["status"] == "RELEASED"

    def test_api_waqf_pools_and_grants_endpoints(self, client):
        # 1. List pools
        res_pools = client.get("/api/v1/waqf/pools")
        assert res_pools.status_code == 200
        assert len(res_pools.json()) >= 4

        # 2. Endow Waqf
        endow_payload = {
            "waqif_id": "donor-algiers-angel",
            "waqif_name": "Yassine Meddah",
            "amount_dzd": 2000000,
            "designated_pool": "HEALTH_AND_BIOTECH",
            "is_perpetual_principal": True,
        }
        res_endow = client.post("/api/v1/waqf/endow", json=endow_payload)
        assert res_endow.status_code == 201
        assert res_endow.json()["amount_dzd"] == 2000000.0

        # 3. Disburse Grant
        grant_payload = {
            "recipient_project": "USTHB BioSensor AI",
            "university_or_institute": "USTHB Bab Ezzouar",
            "grant_amount_dzd": 800000,
            "category": "HEALTH_AND_BIOTECH",
            "scientific_scope": "Electrochemical glucose detection strips for diabetes management.",
        }
        res_grant = client.post("/api/v1/waqf/grants", json=grant_payload)
        assert res_grant.status_code == 201
        assert res_grant.json()["grant_amount_dzd"] == 800000.0

        # 4. List grants
        res_grants = client.get("/api/v1/waqf/grants")
        assert res_grants.status_code == 200
        assert len(res_grants.json()) >= 1

    def test_api_sharia_fatwa_endpoints(self, client):
        # 1. List fatwas
        res_fatwas = client.get("/api/v1/waqf/fatwas")
        assert res_fatwas.status_code == 200
        assert len(res_fatwas.json()) >= 3

        # 2. Annual audit report
        res_report = client.get("/api/v1/waqf/fatwas/annual-audit?fiscal_year=2026")
        assert res_report.status_code == 200
        assert res_report.json()["fiscal_year"] == 2026
        assert len(res_report.json()["report_audit_seal"]) == 64
