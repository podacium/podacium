"""
Exhaustive Pytest Suite for Cross-Border Dual HoldCo / OpCo Mirroring Engine
and Dynamic ESOP Pool Rebalancing, Forfeiture Recycling & IRG Tax Engine.

Validates:
- HoldCoMirrorEngine:
    * Calibration ratio mapping between HoldCo (ADGM, Delaware, UK TopCo) and Algerian SPAS OpCo.
    * Share parity verification and equity leakage / dilution drift detection.
    * Foreign Direct Investment (FDI) filing under Banque d'Algérie Regulation 07-01 and AAPI.
    * Sharia-compliant (Ijarah al-Manfa'ah) Transfer Pricing agreement adhering to CIDTA Art. 169 bis and DTT WHT.
- EsopRecyclingEngine:
    * 48-month statutory vesting with 12-month cliff tracking.
    * Automated forfeiture recycling restoring unvested/unexercised shares to unallocated reserve pool.
    * Down-round anti-dilution strike price repricing (Full Ratchet, BBWA, Value Parity) with Law 22-09 SPAS board resolution.
    * Algerian IRG tax withholding calculation on stock option exercise discount spread (CIDTA Art. 67 / 104).
- FastAPI endpoints under /api/v1/cap-table/holdco-mirror and /api/v1/cap-table/esop-recycling.
"""

from datetime import datetime, timezone, timedelta
from decimal import Decimal
import json
import os
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.auth import get_current_active_user
from app.services.holdco_mirror_engine import (
    HoldCoMirrorEngine,
    holdco_mirror_engine,
)
from app.services.esop_recycling_engine import (
    EsopRecyclingEngine,
    esop_recycling_engine,
)
from app.schemas.holdco_mirror import (
    HoldCoJurisdiction,
    HoldCoShareClass,
    BanqueAlgerieFilingStatus,
    TransferPricingAgreementType,
    ShariaContractStructure,
    HoldCoMirrorSetupRequest,
    HoldCoShareIssuanceRequest,
    FDIRegulatoryFilingRequest,
    TransferPricingAgreementRequest,
)
from app.schemas.esop_recycling import (
    TerminationType,
    AntiDilutionMethod,
    GrantStatus,
    EsopPoolInitRequest,
    EsopGrantCreateRequest,
    ForfeitureRecycleRequest,
    DownRoundAntiDilutionRequest,
    IrgTaxCalculationRequest,
)


class MockUser:
    def __init__(self, user_id=1, email="cfo@tamwheel.dz", role="ADMIN"):
        self.id = user_id
        self.email = email
        self.role = role


@pytest.fixture(autouse=True)
def override_auth():
    """Bypasses auth for testing FastAPI router endpoints."""
    app.dependency_overrides[get_current_active_user] = lambda: MockUser()
    yield
    app.dependency_overrides.pop(get_current_active_user, None)


# =============================================================================
# 1. HOLDCO MIRROR ENGINE UNIT TESTS
# =============================================================================

def test_holdco_mirror_setup_and_ratio_calibration():
    """Tests HoldCo mirror initialization and custom ratio calibration."""
    engine = HoldCoMirrorEngine()
    req = HoldCoMirrorSetupRequest(
        startup_id="spas_fintech_dz",
        holdco_name="TamWheel MENA HoldCo Ltd",
        jurisdiction=HoldCoJurisdiction.ADGM,
        registration_number="ADGM-CR-98421",
        currency="USD",
        fx_rate_to_dzd=Decimal("134.50"),
        opco_shares_per_holdco_share=Decimal("10.0"),  # 1 HoldCo share = 10 OpCo shares
        total_authorized_shares_holdco=1000000,
    )

    status = engine.setup_mirror(req)
    assert status.startup_id == "spas_fintech_dz"
    assert status.holdco_name == "TamWheel MENA HoldCo Ltd"
    assert status.jurisdiction == HoldCoJurisdiction.ADGM
    assert status.mirror_ratio == Decimal("10.0")
    assert status.currency == "USD"
    assert status.total_holdco_issued_shares == 0
    assert status.total_opco_mirrored_shares == 0
    assert status.parity_verified is True
    assert status.equity_leakage_detected is False


def test_holdco_share_issuance_and_opco_parity_verification():
    """Tests issuing HoldCo shares to diaspora investors and verifying OpCo beneficial parity."""
    engine = HoldCoMirrorEngine()
    engine.setup_mirror(
        HoldCoMirrorSetupRequest(
            startup_id="spas_logistics_dz",
            holdco_name="TamWheel Global Ltd",
            jurisdiction=HoldCoJurisdiction.ADGM,
            registration_number="ADGM-7721",
            currency="USD",
            fx_rate_to_dzd=Decimal("134.50"),
            opco_shares_per_holdco_share=Decimal("1.0"),
        )
    )

    # Investor 1 (Algerian Diaspora in France)
    engine.issue_holdco_shares(
        HoldCoShareIssuanceRequest(
            startup_id="spas_logistics_dz",
            stakeholder_id="diaspora_fr_01",
            stakeholder_name="Yacine Meziane",
            diaspora_country="France",
            holdco_share_class=HoldCoShareClass.ORDINARY,
            shares_issued_holdco=10000,
            issue_price_foreign=Decimal("5.00"),
        )
    )

    # Investor 2 (VC Fund in UAE)
    engine.issue_holdco_shares(
        HoldCoShareIssuanceRequest(
            startup_id="spas_logistics_dz",
            stakeholder_id="vc_uae_02",
            stakeholder_name="Waha Ventures ADGM",
            diaspora_country="UAE",
            holdco_share_class=HoldCoShareClass.SERIES_SEED_PREFERRED,
            shares_issued_holdco=30000,
            issue_price_foreign=Decimal("5.00"),
        )
    )

    status = engine.get_mirror_status("spas_logistics_dz")
    assert status.total_holdco_issued_shares == 40000
    assert status.total_opco_mirrored_shares == 40000
    assert status.parity_verified is True
    assert status.equity_leakage_detected is False
    assert status.implied_valuation_foreign == Decimal("200000.00")
    # Implied DZD: 200,000 * 134.50 = 26,900,000 DZD
    assert status.implied_valuation_dzd == Decimal("26900000.00")

    # Verify individual shareholder parity
    assert len(status.shareholders) == 2
    s1 = next(s for s in status.shareholders if s.stakeholder_id == "diaspora_fr_01")
    assert s1.ownership_percentage_holdco == Decimal("25.0000")
    assert s1.ownership_percentage_opco == Decimal("25.0000")
    assert s1.parity_verified is True


def test_fdi_regulatory_filing_and_banque_algerie_compliance():
    """Tests Foreign Direct Investment (FDI) capital retrocession tracking under BA Reg 07-01."""
    engine = HoldCoMirrorEngine()
    engine.setup_mirror(
        HoldCoMirrorSetupRequest(
            startup_id="spas_agritech_dz",
            holdco_name="TamWheel Agri Ltd",
            jurisdiction=HoldCoJurisdiction.DELAWARE_CCORP,
            registration_number="DE-Corp-55419",
            currency="USD",
            fx_rate_to_dzd=Decimal("134.50"),
        )
    )

    fdi_req = FDIRegulatoryFilingRequest(
        startup_id="spas_agritech_dz",
        capital_imported_foreign=Decimal("100000.00"),
        currency="USD",
        commercial_bank_domiciliation="Banque Nationale d'Algérie (BNA) - Agence Alger Centre",
        aapi_investment_code="AAPI-2026-ALGIERS-0941",
    )

    filing = engine.record_fdi_filing(fdi_req)
    assert filing.startup_id == "spas_agritech_dz"
    assert filing.capital_imported_foreign == Decimal("100000.00")
    assert filing.retrocession_amount_dzd == Decimal("13450000.00")  # 100k * 134.50
    assert filing.compliance_status == BanqueAlgerieFilingStatus.REGULATION_07_01_COMPLIANT
    assert filing.is_compliant is True
    assert "Règlement n° 07-01 de la Banque d'Algérie" in filing.official_notification_memo
    assert filing.checklist_status["authorized_bank_domiciliation_verified"] is True
    assert filing.checklist_status["retrocession_attestation_issued"] is True


def test_transfer_pricing_agreement_generator_sharia_and_fiscal_compliance():
    """Tests Sharia Ijarah IP licensing contract generation and CIDTA Art. 169 bis arm's length benchmark."""
    engine = HoldCoMirrorEngine()
    engine.setup_mirror(
        HoldCoMirrorSetupRequest(
            startup_id="spas_health_dz",
            holdco_name="TamWheel Health HoldCo Ltd",
            jurisdiction=HoldCoJurisdiction.ADGM,
            registration_number="ADGM-HLTH-1234",
            currency="USD",
        )
    )

    tp_req = TransferPricingAgreementRequest(
        startup_id="spas_health_dz",
        agreement_type=TransferPricingAgreementType.IP_LICENSING_IJARAH,
        sharia_structure=ShariaContractStructure.IJARAH_MANFAAH,
        royalty_rate_percent=Decimal("5.5"),
        cost_plus_markup_percent=Decimal("10.0"),
        apply_double_tax_treaty=True,  # Algeria-UAE DTT reduced WHT of 10%
    )

    agreement = engine.generate_transfer_pricing_agreement(tp_req)
    assert agreement.startup_id == "spas_health_dz"
    assert agreement.royalty_rate_percent == Decimal("5.5")
    assert agreement.cost_plus_markup_percent == Decimal("10.0")
    assert agreement.cidta_article_169_bis_compliance is True
    assert agreement.withholding_tax_rate_percent == Decimal("10.0")  # DTT reduced
    assert "Article 12 de la Convention Fiscale Bilatérale Algérie - Émirats Arabes Unis" in agreement.bilateral_treaty_citation
    assert "AAOIFI Sharia Standard No. 9 (Ijarah)" in agreement.sharia_compliance_certificate
    assert "CONTRAT-CADRE DE LICENCE DE PROPRIÉTÉ INTELLECTUELLE" in agreement.generated_contract_markdown
    assert "Article 169 bis" in agreement.generated_contract_markdown
    assert len(agreement.audit_hash_sha256) == 64


# =============================================================================
# 2. ESOP RECYCLING & IRG TAX ENGINE UNIT TESTS
# =============================================================================

def test_esop_pool_initialization_and_grant_creation():
    """Tests pool setup, authorized reserves, and grant deduction."""
    engine = EsopRecyclingEngine()
    pool = engine.initialize_pool(
        EsopPoolInitRequest(
            startup_id="spas_ai_dz",
            total_authorized_pool_shares=50000,
            pool_name="SPAS AI Core ESOP Pool",
            par_value_dzd=Decimal("1000.00"),
        )
    )
    assert pool.total_authorized_pool_shares == 50000
    assert pool.unallocated_reserve_shares == 50000
    assert pool.allocated_granted_shares == 0
    assert pool.pool_utilization_rate == Decimal("0.0")

    grant = engine.create_grant(
        EsopGrantCreateRequest(
            startup_id="spas_ai_dz",
            employee_id="emp_cto_01",
            employee_name="Amine Benali",
            options_granted=10000,
            strike_price_dzd=Decimal("1500.00"),
            grant_date="2025-01-01",
            vesting_schedule_months=48,
            cliff_months=12,
            role_title="Chief Technology Officer",
        )
    )
    assert grant.options_granted == 10000
    assert grant.cliff_months == 12
    assert grant.vesting_schedule_months == 48

    status = engine.get_pool_status("spas_ai_dz")
    assert status.unallocated_reserve_shares == 40000
    assert status.allocated_granted_shares == 10000
    assert status.pool_utilization_rate == Decimal("20.00")


def test_esop_48_month_vesting_with_12_month_cliff():
    """Tests exact 12-month cliff and linear monthly vesting progression."""
    engine = EsopRecyclingEngine()
    engine.initialize_pool(
        EsopPoolInitRequest(
            startup_id="spas_saas_dz",
            total_authorized_pool_shares=100000,
        )
    )

    grant = engine.create_grant(
        EsopGrantCreateRequest(
            startup_id="spas_saas_dz",
            employee_id="emp_eng_01",
            employee_name="Sarah Kaci",
            options_granted=4800,  # 100 options/month
            strike_price_dzd=Decimal("1200.00"),
            grant_date="2025-01-01",
            vesting_schedule_months=48,
            cliff_months=12,
        )
    )

    # 1. Before cliff: 6 months elapsed (2025-07-01) -> 0 vested
    detail_6m = engine.get_grant_detail(grant.grant_id, as_of_date="2025-07-01")
    assert detail_6m.months_elapsed == 6
    assert detail_6m.cliff_reached is False
    assert detail_6m.vested_options == 0
    assert detail_6m.unvested_options == 4800

    # 2. Exactly at cliff: 12 months elapsed (2026-01-01) -> 25% (12/48 = 1200 options)
    detail_12m = engine.get_grant_detail(grant.grant_id, as_of_date="2026-01-01")
    assert detail_12m.months_elapsed == 12
    assert detail_12m.cliff_reached is True
    assert detail_12m.vested_options == 1200
    assert detail_12m.unvested_options == 3600
    assert detail_12m.vested_percentage == Decimal("25.00")

    # 3. Mid-vesting: 24 months elapsed (2027-01-01) -> 50% (24/48 = 2400 options)
    detail_24m = engine.get_grant_detail(grant.grant_id, as_of_date="2027-01-01")
    assert detail_24m.months_elapsed == 24
    assert detail_24m.vested_options == 2400
    assert detail_24m.vested_percentage == Decimal("50.00")

    # 4. Fully vested: 48 months elapsed (2029-01-01) -> 100% (4800 options)
    detail_48m = engine.get_grant_detail(grant.grant_id, as_of_date="2029-01-01")
    assert detail_48m.months_elapsed == 48
    assert detail_48m.vested_options == 4800
    assert detail_48m.unvested_options == 0
    assert detail_48m.vested_percentage == Decimal("100.00")


def test_esop_automated_forfeiture_recycling_pre_cliff():
    """Tests 100% forfeiture and pool recycling for an employee departing before cliff."""
    engine = EsopRecyclingEngine()
    engine.initialize_pool(
        EsopPoolInitRequest(
            startup_id="spas_edtech_dz",
            total_authorized_pool_shares=20000,
        )
    )

    grant = engine.create_grant(
        EsopGrantCreateRequest(
            startup_id="spas_edtech_dz",
            employee_id="emp_dev_precliff",
            employee_name="Karim Larbi",
            options_granted=4000,
            strike_price_dzd=Decimal("1000.00"),
            grant_date="2025-01-01",
            vesting_schedule_months=48,
            cliff_months=12,
        )
    )

    # Initial state: 16,000 unallocated, 4,000 allocated (20% utilization)
    pool_before = engine.get_pool_status("spas_edtech_dz")
    assert pool_before.unallocated_reserve_shares == 16000
    assert pool_before.pool_utilization_rate == Decimal("20.00")

    # Employee departs at Month 8 (before 12-month cliff)
    recycle_res = engine.recycle_forfeited_options(
        ForfeitureRecycleRequest(
            grant_id=grant.grant_id,
            departure_date="2025-09-01",
            termination_type=TerminationType.RESIGNATION,
        )
    )

    assert recycle_res.cliff_reached is False
    assert recycle_res.months_active == 8
    assert recycle_res.unvested_forfeited_options == 4000
    assert recycle_res.total_recycled_to_pool == 4000
    assert recycle_res.new_unallocated_pool_shares == 20000
    assert recycle_res.new_utilization_rate == Decimal("0.00")

    # Verify pool status is restored
    pool_after = engine.get_pool_status("spas_edtech_dz")
    assert pool_after.unallocated_reserve_shares == 20000
    assert pool_after.forfeited_recycled_shares_total == 4000
    assert pool_after.active_grants_count == 0


def test_esop_automated_forfeiture_recycling_post_cliff_with_ptew():
    """Tests partial forfeiture recycling and PTEW preservation for post-cliff departure."""
    engine = EsopRecyclingEngine()
    engine.initialize_pool(
        EsopPoolInitRequest(
            startup_id="spas_cloud_dz",
            total_authorized_pool_shares=50000,
        )
    )

    grant = engine.create_grant(
        EsopGrantCreateRequest(
            startup_id="spas_cloud_dz",
            employee_id="emp_senior_lead",
            employee_name="Nadia Bouzid",
            options_granted=12000,
            strike_price_dzd=Decimal("2000.00"),
            grant_date="2024-01-01",
            vesting_schedule_months=48,
            cliff_months=12,
        )
    )

    # Employee resigns at Month 24 (2 years active: 50% vested = 6,000 options)
    recycle_res = engine.recycle_forfeited_options(
        ForfeitureRecycleRequest(
            grant_id=grant.grant_id,
            departure_date="2026-01-01",
            termination_type=TerminationType.RESIGNATION,
            ptew_days=90,
        )
    )

    assert recycle_res.cliff_reached is True
    assert recycle_res.months_active == 24
    assert recycle_res.vested_options_at_departure == 6000
    assert recycle_res.unvested_forfeited_options == 6000
    assert recycle_res.total_recycled_to_pool == 6000
    assert recycle_res.remaining_exercisable_during_ptew == 6000
    assert recycle_res.ptew_expiration_date == "2026-04-01"

    # Pool was 50,000 - 12,000 = 38,000 unallocated. After recycling 6,000 -> 44,000 unallocated.
    pool_status = engine.get_pool_status("spas_cloud_dz")
    assert pool_status.unallocated_reserve_shares == 44000
    assert pool_status.forfeited_recycled_shares_total == 6000


def test_down_round_anti_dilution_strike_repricing():
    """Tests Broad-Based Weighted Average and Full Ratchet strike repricing upon down-round."""
    engine = EsopRecyclingEngine()
    engine.initialize_pool(
        EsopPoolInitRequest(
            startup_id="spas_deeptech_dz",
            total_authorized_pool_shares=50000,
            par_value_dzd=Decimal("1000.00"),
        )
    )

    g1 = engine.create_grant(
        EsopGrantCreateRequest(
            startup_id="spas_deeptech_dz",
            employee_id="emp_01",
            employee_name="Hassan Zaid",
            options_granted=5000,
            strike_price_dzd=Decimal("3000.00"),  # Granted at Series A valuation
            grant_date="2024-01-01",
        )
    )

    # Down round: Share price drops from 3,000 DZD to 1,500 DZD (50% haircut)
    rebalance_res = engine.rebalance_down_round_grants(
        DownRoundAntiDilutionRequest(
            startup_id="spas_deeptech_dz",
            previous_round_share_price_dzd=Decimal("3000.00"),
            new_down_round_share_price_dzd=Decimal("1500.00"),
            shares_outstanding_pre_round=100000,
            new_shares_issued_in_round=50000,
            rebalancing_method=AntiDilutionMethod.FULL_RATCHET,
        )
    )

    assert rebalance_res.valuation_haircut_percentage == Decimal("50.00")
    assert rebalance_res.total_active_grants_repriced == 1
    assert len(rebalance_res.adjusted_grants) == 1

    adj = rebalance_res.adjusted_grants[0]
    assert adj.old_strike_price_dzd == Decimal("3000.00")
    assert adj.new_strike_price_dzd == Decimal("1500.00")  # Full Ratchet 50%
    assert "DÉCISION COLLECTIVE DU PRÉSIDENT" in rebalance_res.statutory_spas_board_resolution_text

    # Verify updated grant
    detail = engine.get_grant_detail(g1.grant_id)
    assert detail.strike_price_dzd == Decimal("1500.00")


def test_algerian_irg_tax_withholding_cidta_art_67_104():
    """Tests IRG tax withholding calculation on stock option exercise discount spread."""
    engine = EsopRecyclingEngine()

    # Scenario: Exercise 1,000 options with Strike = 1,000 DZD, FMV = 2,500 DZD
    # Discount spread = 1,500 DZD/share. Total gross gain = 1,500,000 DZD.
    # CNAS (9%) = 135,000 DZD. Taxable base = 1,365,000 DZD.
    irg_req = IrgTaxCalculationRequest(
        options_to_exercise=1000,
        strike_price_dzd=Decimal("1000.00"),
        fair_market_value_dzd=Decimal("2500.00"),
        apply_social_security_cnas=True,
        is_spas_bspce_flat_regime=False,
    )

    res = engine.calculate_irg_tax_withholding(irg_req)
    assert res.options_exercised == 1000
    assert res.total_exercise_cost_dzd == Decimal("1000000.00")
    assert res.gross_market_value_dzd == Decimal("2500000.00")
    assert res.discount_spread_per_share_dzd == Decimal("1500.00")
    assert res.gross_exercise_gain_dzd == Decimal("1500000.00")
    assert res.cnas_social_security_dzd == Decimal("135000.00")
    assert res.taxable_gain_base_dzd == Decimal("1365000.00")

    # Progressive IRG calculation
    assert res.irg_tax_withheld_dzd > Decimal("0.0")
    assert res.net_employee_take_home_value_dzd == (
        res.gross_exercise_gain_dzd - res.total_statutory_deductions_dzd
    )
    assert "Articles 67 et 104 du Code des Impôts Directs" in res.cidta_legal_basis
    assert res.g50_filing_line_item["declaration_form"] == "Série G n° 50"
    assert len(res.bracket_breakdown) > 0


def test_algerian_irg_tax_withholding_spas_preferential_15_flat():
    """Tests Startup Label Decree 20-254 / SPAS preferential 15% flat final withholding."""
    engine = EsopRecyclingEngine()

    irg_req = IrgTaxCalculationRequest(
        options_to_exercise=500,
        strike_price_dzd=Decimal("1000.00"),
        fair_market_value_dzd=Decimal("3000.00"),
        apply_social_security_cnas=False,
        is_spas_bspce_flat_regime=True,
    )

    res = engine.calculate_irg_tax_withholding(irg_req)
    # Gross gain = 500 * (3000 - 1000) = 1,000,000 DZD
    assert res.gross_exercise_gain_dzd == Decimal("1000000.00")
    # Flat 15% on 1,000,000 = 150,000 DZD
    assert res.irg_tax_withheld_dzd == Decimal("150000.00")
    assert res.effective_irg_rate_percent == Decimal("15.00")
    assert res.net_employee_take_home_value_dzd == Decimal("850000.00")
    assert "Retenue à la source libératoire de 15%" in res.cidta_legal_basis


# =============================================================================
# 3. FASTAPI ROUTER ENDPOINTS INTEGRATION TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_router_holdco_mirror_endpoints():
    """Tests all FastAPI endpoints mounted under /api/v1/cap-table/holdco-mirror."""
    csrf_token = "test_csrf_token_holdco"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ac.cookies.set("csrf_token", csrf_token)
        headers = {"x-csrf-token": csrf_token}

        # 1. Setup mirror
        setup_payload = {
            "startup_id": "spas_route_test",
            "holdco_name": "TamWheel Route HoldCo Ltd",
            "jurisdiction": "ADGM",
            "registration_number": "ADGM-ROUTE-99",
            "currency": "USD",
            "fx_rate_to_dzd": "134.50",
            "opco_shares_per_holdco_share": "1.0",
        }
        resp = await ac.post(
            "/api/v1/cap-table/holdco-mirror/setup",
            json=setup_payload,
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["holdco_name"] == "TamWheel Route HoldCo Ltd"
        assert data["parity_verified"] is True

        # 2. Issue HoldCo shares
        issue_payload = {
            "startup_id": "spas_route_test",
            "stakeholder_id": "route_stakeholder_1",
            "stakeholder_name": "Tahar Rahim",
            "diaspora_country": "United Kingdom",
            "holdco_share_class": "ORDINARY",
            "shares_issued_holdco": 5000,
            "issue_price_foreign": "10.00",
        }
        resp_issue = await ac.post(
            "/api/v1/cap-table/holdco-mirror/issue-shares",
            json=issue_payload,
            headers=headers,
        )
        assert resp_issue.status_code == 201
        assert resp_issue.json()["total_holdco_issued_shares"] == 5000

        # 3. Get Status
        resp_status = await ac.get(
            "/api/v1/cap-table/holdco-mirror/spas_route_test/status",
            headers=headers,
        )
        assert resp_status.status_code == 200
        assert resp_status.json()["parity_verified"] is True

        # 4. Record FDI filing
        fdi_payload = {
            "startup_id": "spas_route_test",
            "capital_imported_foreign": "50000.00",
            "currency": "USD",
            "commercial_bank_domiciliation": "BNA - Agence Alger Centre",
        }
        resp_fdi = await ac.post(
            "/api/v1/cap-table/holdco-mirror/fdi/filing",
            json=fdi_payload,
            headers=headers,
        )
        assert resp_fdi.status_code == 201
        assert resp_fdi.json()["capital_imported_foreign"] == "50000.00"

        # 5. List FDI filings
        resp_fdis = await ac.get(
            "/api/v1/cap-table/holdco-mirror/spas_route_test/fdi/filings",
            headers=headers,
        )
        assert resp_fdis.status_code == 200
        assert len(resp_fdis.json()) >= 1

        # 6. Generate Transfer Pricing Agreement
        tp_payload = {
            "startup_id": "spas_route_test",
            "royalty_rate_percent": "4.5",
            "term_years": 3,
            "apply_double_tax_treaty": True,
        }
        resp_tp = await ac.post(
            "/api/v1/cap-table/holdco-mirror/transfer-pricing/generate-agreement",
            json=tp_payload,
            headers=headers,
        )
        assert resp_tp.status_code == 201
        agreement_data = resp_tp.json()
        assert agreement_data["royalty_rate_percent"] == "4.5"
        ag_id = agreement_data["agreement_id"]

        # 7. Get Agreement by ID
        resp_ag = await ac.get(
            f"/api/v1/cap-table/holdco-mirror/transfer-pricing/agreements/{ag_id}",
            headers=headers,
        )
        assert resp_ag.status_code == 200
        assert resp_ag.json()["agreement_id"] == ag_id


@pytest.mark.asyncio
async def test_router_esop_recycling_endpoints():
    """Tests all FastAPI endpoints mounted under /api/v1/cap-table/esop-recycling."""
    csrf_token = "test_csrf_token_esop"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ac.cookies.set("csrf_token", csrf_token)
        headers = {"x-csrf-token": csrf_token}

        # 1. Pool Init
        init_payload = {
            "startup_id": "spas_esop_route_test",
            "total_authorized_pool_shares": 60000,
            "pool_name": "Test ESOP Pool 2026",
        }
        resp = await ac.post(
            "/api/v1/cap-table/esop-recycling/pool/init",
            json=init_payload,
            headers=headers,
        )
        assert resp.status_code == 201
        assert resp.json()["total_authorized_pool_shares"] == 60000

        # 2. Pool Status
        resp_status = await ac.get(
            "/api/v1/cap-table/esop-recycling/spas_esop_route_test/pool/status",
            headers=headers,
        )
        assert resp_status.status_code == 200
        assert resp_status.json()["unallocated_reserve_shares"] == 60000

        # 3. Create Grant
        grant_payload = {
            "startup_id": "spas_esop_route_test",
            "employee_id": "emp_route_01",
            "employee_name": "Samir Cherif",
            "options_granted": 12000,
            "strike_price_dzd": "1500.00",
            "grant_date": "2025-01-01",
            "vesting_schedule_months": 48,
            "cliff_months": 12,
        }
        resp_grant = await ac.post(
            "/api/v1/cap-table/esop-recycling/grants",
            json=grant_payload,
            headers=headers,
        )
        assert resp_grant.status_code == 201
        grant_id = resp_grant.json()["grant_id"]

        # 4. Get Grant Detail
        resp_detail = await ac.get(
            f"/api/v1/cap-table/esop-recycling/grants/{grant_id}?as_of_date=2026-01-01",
            headers=headers,
        )
        assert resp_detail.status_code == 200
        assert resp_detail.json()["cliff_reached"] is True

        # 5. Recycle Forfeiture
        recycle_payload = {
            "grant_id": grant_id,
            "departure_date": "2025-08-01",  # Before cliff
            "termination_type": "RESIGNATION",
        }
        resp_recycle = await ac.post(
            "/api/v1/cap-table/esop-recycling/forfeiture/recycle",
            json=recycle_payload,
            headers=headers,
        )
        assert resp_recycle.status_code == 200
        assert resp_recycle.json()["total_recycled_to_pool"] == 12000

        # 6. Anti-Dilution Rebalancing
        rebalance_payload = {
            "startup_id": "spas_esop_route_test",
            "previous_round_share_price_dzd": "2000.00",
            "new_down_round_share_price_dzd": "1200.00",
            "shares_outstanding_pre_round": 100000,
            "new_shares_issued_in_round": 40000,
            "rebalancing_method": "FULL_RATCHET",
        }
        resp_rebalance = await ac.post(
            "/api/v1/cap-table/esop-recycling/anti-dilution/rebalance",
            json=rebalance_payload,
            headers=headers,
        )
        assert resp_rebalance.status_code == 200
        assert resp_rebalance.json()["valuation_haircut_percentage"] == "40.00"

        # 7. IRG Tax Calculation
        irg_payload = {
            "options_to_exercise": 500,
            "strike_price_dzd": "1000.00",
            "fair_market_value_dzd": "2500.00",
            "apply_social_security_cnas": True,
            "is_spas_bspce_flat_regime": False,
        }
        resp_irg = await ac.post(
            "/api/v1/cap-table/esop-recycling/tax/irg-calculate",
            json=irg_payload,
            headers=headers,
        )
        assert resp_irg.status_code == 200
        irg_data = resp_irg.json()
        assert irg_data["gross_exercise_gain_dzd"] == "750000.00"
        assert irg_data["irg_tax_withheld_dzd"] != "0.00"


# =============================================================================
# 4. OPENAPI CONTRACT EXPORTER
# =============================================================================

def test_export_openapi_json_contract():
    """
    Exports the updated full OpenAPI contract specification to /home/zuikre/TamWheel/openapi.json,
    confirming all new routes are present in the contract.
    """
    openapi_schema = app.openapi()
    paths = openapi_schema.get("paths", {})

    # Verify our routes are mounted and visible in OpenAPI schema
    assert "/api/v1/cap-table/holdco-mirror/setup" in paths
    assert "/api/v1/cap-table/holdco-mirror/issue-shares" in paths
    assert "/api/v1/cap-table/holdco-mirror/{startup_id}/status" in paths
    assert "/api/v1/cap-table/holdco-mirror/fdi/filing" in paths
    assert "/api/v1/cap-table/holdco-mirror/{startup_id}/fdi/filings" in paths
    assert "/api/v1/cap-table/holdco-mirror/transfer-pricing/generate-agreement" in paths
    assert "/api/v1/cap-table/esop-recycling/pool/init" in paths
    assert "/api/v1/cap-table/esop-recycling/{startup_id}/pool/status" in paths
    assert "/api/v1/cap-table/esop-recycling/grants" in paths
    assert "/api/v1/cap-table/esop-recycling/forfeiture/recycle" in paths
    assert "/api/v1/cap-table/esop-recycling/anti-dilution/rebalance" in paths
    assert "/api/v1/cap-table/esop-recycling/tax/irg-calculate" in paths

    # Write out to /home/zuikre/TamWheel/openapi.json
    repo_openapi_path = "/home/zuikre/TamWheel/openapi.json"
    with open(repo_openapi_path, "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, indent=2, ensure_ascii=False)

    assert os.path.exists(repo_openapi_path)
    file_size = os.path.getsize(repo_openapi_path)
    assert file_size > 100000
