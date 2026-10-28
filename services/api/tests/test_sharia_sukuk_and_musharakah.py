"""
TamWheel Sovereign Ethical Agentic Venture OS — Diminishing Musharakah, Micro-Sukuk & Tathir Routing Tests.
Tests:
1. AAOIFI Standard No. 12 & 9 Diminishing Musharakah (Musharakah Mutanaqisah) buyout & sliding-scale rental schedules.
2. Voluntary Early Buyout concession calculations (Da' wa Ta'ajjal).
3. AAOIFI Standard No. 17 Fractional Micro-Sukuk Al-Istithmar revenue-share issuance, distributions & Mudarib hurdle caps.
4. Tathir charity routing to accredited Algerian public interest institutions & non-tax-deductible receipt seals.
5. FastAPI REST API endpoints under /api/v1/sharia.
"""

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.musharakah_engine import (
    musharakah_engine,
    AssetCategory,
    PaymentFrequency,
    MusharakahScheduleRequest,
    EarlyBuyoutCalculationRequest,
)
from app.services.sukuk_engine import (
    sukuk_engine,
    SukukContractType,
    SukukStatus,
    IssueSukukRequest,
    RecordDistributionRequest,
)
from app.services.tathir_routing import (
    tathir_routing_service,
    CharitySector,
    TathirDisbursementRequest,
)


@pytest.fixture
def client():
    c = TestClient(app)
    token = "test_csrf_token_value_32_chars_123"
    c.cookies.set("csrf_token", token)
    c.headers.update({"x-csrf-token": token})
    return c


# =============================================================================
# 1. MUSHARAKAH MUTANAQISAH (DIMINISHING PARTNERSHIP) TESTS
# =============================================================================

class TestMusharakahMutanaqisahEngine:
    """Rigorous tests for AAOIFI Standard No. 12 asset buyout and rental amortization."""

    def test_complete_buyout_schedule_progression(self):
        req = MusharakahScheduleRequest(
            venture_id="ven-khayra-001",
            venture_name="KhayraTech Date Processing",
            asset_category=AssetCategory.AGRITECH_HARDWARE,
            asset_description="Industrial cryogenic date pitting and vacuum packaging line in Biskra.",
            total_asset_cost_dzd=12_000_000,
            investor_contribution_dzd=9_000_000,  # 75% investor
            founder_contribution_dzd=3_000_000,   # 25% founder
            annual_rental_yield_pct=12.0,         # 1.0% per month
            tenor_months=12,
            payment_frequency=PaymentFrequency.MONTHLY,
        )
        res = musharakah_engine.calculate_schedule(req)

        assert res.total_periods == 12
        assert res.initial_investor_share_pct == 75.0
        assert res.initial_founder_share_pct == 25.0
        assert len(res.tranches) == 12

        # Check principal amortization
        assert res.total_principal_paid_dzd == 9_000_000.0
        # Final tranche ends with 0% investor, 100% founder ownership
        final_tranche = res.tranches[-1]
        assert final_tranche.investor_ownership_pct_end == 0.0
        assert final_tranche.founder_ownership_pct_end == 100.0
        assert final_tranche.remaining_investor_principal_dzd == 0.0

        # Verify sliding-scale rental reduction (Rent in Period 1 > Rent in Period 2 > ... > Period 12)
        rentals = [t.rental_payment_dzd for t in res.tranches]
        assert rentals[0] > rentals[1] > rentals[-1]
        # Period 1 rent: 9,000,000 * 1% = 90,000 DZD
        assert rentals[0] == 90_000.0
        # Period 12 rent: remaining principal before final payment is 750,000 -> rent is 7,500 DZD
        assert rentals[-1] == 7_500.0

        # Check cryptographic seal
        assert res.schedule_id.startswith("MM-SCHED-VEN-KH")
        assert len(res.schedule_audit_hash) == 64

    def test_early_buyout_with_voluntary_concession(self):
        req = MusharakahScheduleRequest(
            venture_id="ven-solar-002",
            venture_name="Adrar Green Solar",
            asset_category=AssetCategory.SOLAR_RENEWABLE_ENERGY,
            asset_description="50kW off-grid solar photovoltaic pumping array.",
            total_asset_cost_dzd=6_000_000,
            investor_contribution_dzd=6_000_000,  # 100% investor financed
            annual_rental_yield_pct=10.0,
            tenor_months=12,
            payment_frequency=PaymentFrequency.MONTHLY,
        )
        sched = musharakah_engine.calculate_schedule(req)

        # Early buyout at period 6 (halfway through tenor)
        early_req = EarlyBuyoutCalculationRequest(
            schedule_response=sched,
            current_period_completed=6,
            early_buyout_discount_pct=5.0,  # 5% voluntary early payment concession
        )
        early_res = musharakah_engine.calculate_early_buyout(early_req)

        assert early_res.current_period_completed == 6
        assert early_res.current_investor_share_pct == 50.0
        assert early_res.remaining_nominal_principal_dzd == 3_000_000.0
        # 5% concession on 3M = 150,000 DZD
        assert early_res.voluntary_concession_dzd == 150_000.0
        assert early_res.lump_sum_buyout_amount_dzd == 2_850_000.0
        assert early_res.rental_savings_dzd > 0
        assert early_res.immediate_title_transfer_unlocked is True


# =============================================================================
# 2. MICRO-SUKUK REVENUE SHARE ENGINE TESTS
# =============================================================================

class TestMicroSukukRevenueShareEngine:
    """Rigorous tests for AAOIFI Standard No. 17 Fractional Sukuk Al-Istithmar."""

    def test_sukuk_issuance_and_revenue_distribution_flow(self):
        issue_req = IssueSukukRequest(
            startup_id="start-gpu-001",
            startup_name="Algiers Cloud AI",
            sukuk_name="Micro-Sukuk Al-Istithmar Series A (AI GPU Compute)",
            purpose="Acquisition of H100 GPU compute clusters for domestic AI inference hosting.",
            contract_type=SukukContractType.SUKUK_AL_ISTITHMAR,
            total_issuance_amount_dzd=10_000_000,
            par_value_per_certificate_dzd=10_000, # 1,000 certificates
            revenue_share_pct=5.0,                # 5.0% gross monthly revenue
            target_annual_irr_pct=16.0,
            hurdle_cap_annual_irr_pct=24.0,       # Cap at 24% annual yield
            tenor_months=24,
        )
        sukuk = sukuk_engine.issue_sukuk(issue_req)

        assert sukuk.sukuk_id.startswith("SKK-START-")
        assert sukuk.total_certificates == 1_000
        assert sukuk.status == SukukStatus.ACTIVE
        assert len(sukuk.issuance_seal_hash) == 64

        # Record Period 1 Distribution
        dist_req_1 = RecordDistributionRequest(
            period_number=1,
            period_label="2026-M01",
            verified_gross_revenue_dzd=3_000_000,  # 3M revenue * 5% = 150,000 DZD pool
        )
        dist_1 = sukuk_engine.record_distribution(sukuk.sukuk_id, dist_req_1)

        assert dist_1.total_distributable_dzd == 150_000.0
        # 150,000 / 1,000 certificates = 150 DZD per certificate
        assert dist_1.distribution_per_certificate_dzd == 150.0
        assert dist_1.mudarib_incentive_bonus_dzd == 0.0 # Under hurdle cap
        assert len(dist_1.distribution_audit_hash) == 64

        # Record Period 2 with revenue exceeding hurdle cap (24% annual = 2% monthly = 200,000 max pool)
        dist_req_2 = RecordDistributionRequest(
            period_number=2,
            period_label="2026-M02",
            verified_gross_revenue_dzd=6_000_000,  # 6M revenue * 5% = 300,000 potential pool
        )
        dist_2 = sukuk_engine.record_distribution(sukuk.sukuk_id, dist_req_2)

        # Capped at 200,000 DZD (2% of 10M) for certificate holders
        assert dist_2.total_distributable_dzd == 200_000.0
        assert dist_2.distribution_per_certificate_dzd == 200.0
        # Excess 100,000 flows to founder as Mudarib performance incentive
        assert dist_2.mudarib_incentive_bonus_dzd == 100_000.0

        # Verify cumulative updates on parent Sukuk
        updated_sukuk = sukuk_engine.get_sukuk(sukuk.sukuk_id)
        assert updated_sukuk.distributions_count == 2
        assert updated_sukuk.total_distributions_paid_dzd == 350_000.0


# =============================================================================
# 3. TATHIR CHARITY ROUTING TESTS
# =============================================================================

class TestTathirCharityRoutingService:
    """Rigorous tests for automated charity disbursement and non-tax-deductibility certification."""

    def test_accredited_charity_registry(self):
        charities = tathir_routing_service.get_accredited_charities()
        assert len(charities) >= 5
        ids = [c.charity_id for c in charities]
        assert "CHARITY-CRA-001" in ids
        assert "CHARITY-FOREM-002" in ids
        assert "CHARITY-TECH-ENDOW-004" in ids

    def test_disburse_purification_success_and_receipt_issuance(self):
        req = TathirDisbursementRequest(
            donor_id="user-investor-007",
            donor_name="Lyes Khelil",
            charity_id="CHARITY-CRA-001",
            amount_dzd=125_000,
            source_description="Incidental treasury deposit interest from Q3 2026 dividend distribution.",
            confirm_non_tax_deductible=True,
        )
        receipt = tathir_routing_service.disburse_purification(req)

        assert receipt.receipt_id.startswith("RCPT-TATHIR-")
        assert receipt.amount_dzd == 125_000.0
        assert receipt.charity_id == "CHARITY-CRA-001"
        assert receipt.sector == CharitySector.DISASTER_HUMANITARIAN_RELIEF
        assert len(receipt.receipt_verification_hash) == 64
        assert "strictly to charitable public interest without tax benefit" in receipt.non_tax_deductibility_declaration

        # Verify receipt lookup
        looked_up = tathir_routing_service.get_receipt(receipt.receipt_id)
        assert looked_up is not None
        assert looked_up.receipt_id == receipt.receipt_id

    def test_disburse_purification_fails_without_tax_declaration(self):
        req = TathirDisbursementRequest(
            donor_id="user-investor-007",
            donor_name="Lyes Khelil",
            charity_id="CHARITY-FOREM-002",
            amount_dzd=50_000,
            source_description="Tainted revenue purification",
            confirm_non_tax_deductible=False, # Should trigger validation error
        )
        with pytest.raises(ValueError, match="Sharia compliance requires explicit confirmation"):
            tathir_routing_service.disburse_purification(req)


# =============================================================================
# 4. FASTAPI ENDPOINT INTEGRATION TESTS
# =============================================================================

class TestShariaSukukAndMusharakahEndpoints:
    """Integration test suite for newly mounted Sharia endpoints in FastAPI."""

    def test_api_musharakah_schedule_endpoint(self, client):
        payload = {
            "venture_id": "ven-cold-003",
            "venture_name": "Sétif Cold Chain",
            "asset_category": "COLD_STORAGE_LOGISTICS",
            "asset_description": "Solar refrigeration unit for potato storage.",
            "total_asset_cost_dzd": 8000000,
            "investor_contribution_dzd": 6000000,
            "founder_contribution_dzd": 2000000,
            "annual_rental_yield_pct": 14.0,
            "tenor_months": 6,
            "payment_frequency": "MONTHLY",
        }
        res = client.post("/api/v1/sharia/musharakah/schedule", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["total_periods"] == 6
        assert data["total_principal_paid_dzd"] == 6000000.0
        assert len(data["tranches"]) == 6

    def test_api_musharakah_early_buyout_endpoint(self, client):
        # 1. Generate schedule
        sched_payload = {
            "venture_id": "ven-cold-004",
            "venture_name": "Oran Agri Logistics",
            "asset_category": "COLD_STORAGE_LOGISTICS",
            "asset_description": "Cold storage warehouse facility.",
            "total_asset_cost_dzd": 10000000,
            "investor_contribution_dzd": 10000000,
            "annual_rental_yield_pct": 12.0,
            "tenor_months": 12,
            "payment_frequency": "MONTHLY",
        }
        res_sched = client.post("/api/v1/sharia/musharakah/schedule", json=sched_payload)
        assert res_sched.status_code == 200
        sched_data = res_sched.json()

        # 2. Call early buyout endpoint
        early_payload = {
            "schedule_response": sched_data,
            "current_period_completed": 4,
            "early_buyout_discount_pct": 3.0,
        }
        res_early = client.post("/api/v1/sharia/musharakah/early-buyout", json=early_payload)
        assert res_early.status_code == 200
        data = res_early.json()
        assert data["current_period_completed"] == 4
        assert data["remaining_nominal_principal_dzd"] > 0
        assert data["immediate_title_transfer_unlocked"] is True

    def test_api_sukuk_issue_and_distribute_endpoints(self, client):
        # 1. Issue Sukuk
        issue_payload = {
            "startup_id": "start-med-005",
            "startup_name": "Constantine Biotech",
            "sukuk_name": "Biotech Diagnostic Lab Sukuk",
            "purpose": "Procurement of PCR diagnostic machines for regional medical laboratories.",
            "contract_type": "SUKUK_AL_ISTITHMAR",
            "total_issuance_amount_dzd": 5000000,
            "par_value_per_certificate_dzd": 10000,
            "revenue_share_pct": 6.0,
            "target_annual_irr_pct": 18.0,
            "tenor_months": 12,
        }
        res_issue = client.post("/api/v1/sharia/sukuk/issue", json=issue_payload)
        assert res_issue.status_code == 201
        sukuk_data = res_issue.json()
        sukuk_id = sukuk_data["sukuk_id"]

        # 2. List Sukuk
        res_list = client.get("/api/v1/sharia/sukuk")
        assert res_list.status_code == 200
        assert any(s["sukuk_id"] == sukuk_id for s in res_list.json())

        # 3. Distribute Revenue
        dist_payload = {
            "period_number": 1,
            "period_label": "2026-M01",
            "verified_gross_revenue_dzd": 2000000,
        }
        res_dist = client.post(f"/api/v1/sharia/sukuk/{sukuk_id}/distribute", json=dist_payload)
        assert res_dist.status_code == 200
        dist_data = res_dist.json()
        assert dist_data["total_distributable_dzd"] == 120000.0 # 2M * 6%
        assert dist_data["distribution_per_certificate_dzd"] == 240.0 # 120,000 / 500

    def test_api_tathir_charities_and_disburse_endpoints(self, client):
        # 1. List charities
        res_charities = client.get("/api/v1/sharia/tathir/charities")
        assert res_charities.status_code == 200
        charities = res_charities.json()
        assert len(charities) >= 5

        # 2. Disburse purification
        disburse_payload = {
            "donor_id": "founder-amina-01",
            "donor_name": "Amina B.",
            "charity_id": "CHARITY-FOREM-002",
            "amount_dzd": 75000,
            "source_description": "Cleanse of bank interest from business operating account.",
            "confirm_non_tax_deductible": True,
        }
        res_disb = client.post("/api/v1/sharia/tathir/disburse", json=disburse_payload)
        assert res_disb.status_code == 200
        rcpt = res_disb.json()
        rcpt_id = rcpt["receipt_id"]
        assert rcpt["amount_dzd"] == 75000.0

        # 3. Fetch receipt
        res_rcpt = client.get(f"/api/v1/sharia/tathir/receipts/{rcpt_id}")
        assert res_rcpt.status_code == 200
        assert res_rcpt.json()["receipt_id"] == rcpt_id
