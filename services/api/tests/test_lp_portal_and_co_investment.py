"""
TamWheel Sovereign Ethical Agentic Venture OS — LP Portal & Co-Investment Engine Pytest Suite.
Tests:
1. ILPA Standard LP Personal Capital Account Statement (PCCAS) Roll-Forward Math.
2. Distribution Breakdown: Return of Capital (Remboursement d'apport) vs Realized Gain vs Dividends.
3. High-Precision Performance Solvers:
   - XIRR (Newton-Raphson & Bisection root finder).
   - Time-Weighted Return (TWR) using Modified Dietz linking without cash-flow distortion.
   - Multiples: TVPI, DPI, RVPI.
4. Algerian Tax Package Reporting:
   - Law 22-09 SPAS & CIDTA Articles 104 & 150 withholding taxes (IBS / Retenue à la Source).
   - Bordereau G50 declaration serial and Treasury quittance reference.
   - Bilingual French & Arabic official certification statements.
5. Syndicate Side-Car Co-Investment Engine:
   - Multi-tier fee economics: Tier 1 Anchor (0/0 no fee, no carry), Tier 2 Strategic (1/10), Tier 3 Standard (2/20).
   - Capacity prioritization & pro-rata allocations.
   - Dynamic water-filling excess capacity re-allocation.
   - Greenshoe oversubscription expansion up to hard cap.
   - Multi-stage closing milestones (Initial Close -> Interim Close -> Final Close -> Deployment Authorization).
6. End-to-End FastAPI REST API Endpoints under `/api/v1/syndicates/lp-portal` and `/api/v1/syndicates/co-investments`.
"""

from datetime import datetime, timedelta, timezone
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.lp_portal_service import (
    LPPortalService,
    lp_portal_service,
    CashFlowType,
    TaxResidenceType,
    LPCashFlow,
    calculate_xirr,
    calculate_modified_dietz_twr,
)
from app.services.co_investment_engine import (
    CoInvestmentEngine,
    co_investment_engine,
    CoInvestmentMilestone,
    CoInvestmentFeeTier,
    RequestStatus,
)


@pytest.fixture
def client():
    c = TestClient(app)
    token = "test_csrf_token_value_32_chars_123"
    c.cookies.set("csrf_token", token)
    c.headers.update({"x-csrf-token": token})
    return c


# =============================================================================
# 1. LP PCCAS ENGINE & MATHEMATICAL RECONCILIATION TESTS
# =============================================================================

class TestLPPortalService:
    def test_pccas_capital_account_reconciliation_math(self):
        service = LPPortalService()
        spv_id = "spv-djazair-fintech-01"
        lp_id = "lp-boumediene-01"

        # Subscription: 20M DZD commitment, 20% SPV ownership
        # In period: Beginning balance 5M, Capital call 5M, Distributions 3M (1.5M ROC, 1M gain, 0.5M div)
        # Realized gain 1M, Unrealized appreciation +4M, Expenses 0.2M
        stmt = service.generate_lp_pccas(
            spv_id=spv_id,
            spv_name="SPAS Djazair Fintech Syndicate I",
            lp_id=lp_id,
            lp_name="Karim Boumediene (Algiers Angel)",
            lp_email="karim@boumediene-capital.dz",
            committed_capital_dzd=20_000_000.0,
            ownership_percentage=20.0,
            units_held=20_000,
            beginning_capital_account_dzd=5_000_000.0,
            capital_contributions_called_dzd=5_000_000.0,
            distributions_return_of_capital_dzd=1_500_000.0,
            distributions_realized_gain_dzd=1_000_000.0,
            distributions_dividend_income_dzd=500_000.0,
            net_unrealized_gain_loss_dzd=4_000_000.0,
            allocated_expenses_and_fees_dzd=200_000.0,
            net_realized_gain_loss_dzd=1_000_000.0,
        )

        assert stmt.spv_id == spv_id
        assert stmt.lp_id == lp_id
        assert stmt.total_committed_capital_dzd == 20_000_000.0
        assert stmt.distributions_received_dzd == 3_000_000.0

        # ILPA PCAS Reconciliation:
        # Ending = 5,000,000 (beg) + 5,000,000 (calls) - 3,000,000 (dist) + 1,000,000 (gain) + 4,000,000 (unrealized) - 200,000 (exp)
        # = 11,800,000.0 DZD
        expected_ending = 11_800_000.0
        assert stmt.ending_capital_account_dzd == expected_ending

        # Cumulative paid in = 5M + 5M = 10M DZD
        assert stmt.cumulative_paid_in_dzd == 10_000_000.0
        # Uncalled dry powder = 20M - 10M = 10M DZD
        assert stmt.remaining_uncalled_capital_dzd == 10_000_000.0

        # Performance Multiples:
        # DPI = 3M / 10M = 0.300
        # RVPI = 11.8M / 10M = 1.180
        # TVPI = DPI + RVPI = 1.480
        assert stmt.performance.dpi == 0.3
        assert stmt.performance.rvpi == 1.18
        assert stmt.performance.tvpi == 1.48
        assert stmt.performance.net_profit_dzd == round((3_000_000.0 + 11_800_000.0) - 10_000_000.0, 2)
        assert stmt.performance.irr_annualized_pct > 0.0

    def test_xirr_and_modified_dietz_twr_precision(self):
        t0 = datetime(2025, 1, 1, tzinfo=timezone.utc)
        t1 = t0 + timedelta(days=90)   # Day 90: capital call 10M
        t2 = t0 + timedelta(days=200)  # Day 200: distribution 4M
        t3 = t0 + timedelta(days=365)  # Day 365: terminal NAV 12M

        cfs = [
            LPCashFlow(timestamp=t0, flow_type=CashFlowType.CAPITAL_CALL_CONTRIBUTION, amount_dzd=-10_000_000.0),
            LPCashFlow(timestamp=t2, flow_type=CashFlowType.DISTRIBUTION_RETURN_OF_CAPITAL, amount_dzd=4_000_000.0),
            LPCashFlow(timestamp=t3, flow_type=CashFlowType.VALUATION_NAV_TERMINAL, amount_dzd=12_000_000.0),
        ]

        irr = calculate_xirr(cfs)
        # 10M invested, 4M returned at day 200, 12M NAV at day 365 -> Total value 16M on 10M -> IRR should be substantial positive (>50%)
        assert irr > 50.0

        # TWR calculation over 1 year
        period_twr, ann_twr = calculate_modified_dietz_twr(
            beginning_val=10_000_000.0,
            ending_val=12_000_000.0,
            cash_flows=[
                LPCashFlow(timestamp=t2, flow_type=CashFlowType.DISTRIBUTION_RETURN_OF_CAPITAL, amount_dzd=-4_000_000.0),
            ],
            period_start=t0,
            period_end=t3,
        )
        assert isinstance(period_twr, float)
        assert isinstance(ann_twr, float)

    def test_algerian_tax_package_g50_and_withholding_rules(self):
        service = LPPortalService()
        spv_id = "spv-oran-biotech-02"
        lp_id = "lp-diaspora-paris-01"

        # Gross distribution: 10M DZD
        # Breakdown: 4M ROC (tax-exempt), 2M dividends (10% RAS), 4M realized capital gains (10% RAS)
        pkg = service.generate_algerian_tax_package(
            spv_id=spv_id,
            spv_name="SPAS Oran HealthTech Seed Fund",
            lp_id=lp_id,
            lp_name="Dr. Amina Benali (Diaspora France)",
            fiscal_year=2025,
            gross_total_distribution_dzd=10_000_000.0,
            non_taxable_return_of_capital_dzd=4_000_000.0,
            taxable_dividends_dzd=2_000_000.0,
            taxable_realized_capital_gains_dzd=4_000_000.0,
            tax_residence_country="FR",
            tax_residence_type=TaxResidenceType.ALGERIAN_DIASPORA_TREATY,
            lp_nif="197816010099881",
            lp_article_imposition="1601/77889",
        )

        assert pkg.fiscal_year == 2025
        assert pkg.gross_total_distribution_dzd == 10_000_000.0
        assert pkg.non_taxable_return_of_capital_dzd == 4_000_000.0
        assert pkg.taxable_dividends_dzd == 2_000_000.0
        assert pkg.taxable_realized_capital_gains_dzd == 4_000_000.0

        # Withholding rate: 10%
        # Tax on dividends = 2M * 10% = 200,000 DZD
        assert pkg.tax_withheld_dividends_dzd == 200_000.0
        # Tax on capital gains = 4M * 10% = 400,000 DZD
        assert pkg.tax_withheld_capital_gains_dzd == 400_000.0
        # Total tax withheld = 600,000 DZD
        assert pkg.total_tax_withheld_dzd == 600_000.0
        # Net paid = 10M - 600k = 9,400,000 DZD
        assert pkg.net_distribution_paid_dzd == 9_400_000.0

        # Regulatory references
        assert "G50-DGI-CDI-2025-" in pkg.g50_bordereau_serial_number
        assert "TR-DGI-ALG-REC-2025-" in pkg.treasury_receipt_reference
        assert "Art. 104 CIDTA" in pkg.formal_certificate_fr
        assert "جدول G50" in pkg.formal_certificate_ar
        assert "الجمهورية الجزائرية الديمقراطية الشعبية" in pkg.formal_certificate_ar

    def test_lp_portfolio_dashboard_aggregation(self):
        service = LPPortalService()
        lp_id = "lp-institutional-badis"

        # Generate statements in two different syndicates
        service.generate_lp_pccas(
            spv_id="spv-alpha",
            spv_name="SPAS Alpha AI",
            lp_id=lp_id,
            lp_name="Badis Investment Group",
            lp_email="badis@inv-group.dz",
            committed_capital_dzd=30_000_000.0,
            ownership_percentage=15.0,
            beginning_capital_account_dzd=10_000_000.0,
            capital_contributions_called_dzd=5_000_000.0,
            distributions_return_of_capital_dzd=2_000_000.0,
            distributions_realized_gain_dzd=3_000_000.0,
            distributions_dividend_income_dzd=0.0,
            net_unrealized_gain_loss_dzd=6_000_000.0,
        )

        service.generate_lp_pccas(
            spv_id="spv-beta",
            spv_name="SPAS Beta Cleantech",
            lp_id=lp_id,
            lp_name="Badis Investment Group",
            lp_email="badis@inv-group.dz",
            committed_capital_dzd=20_000_000.0,
            ownership_percentage=10.0,
            beginning_capital_account_dzd=8_000_000.0,
            capital_contributions_called_dzd=2_000_000.0,
            distributions_return_of_capital_dzd=1_000_000.0,
            distributions_realized_gain_dzd=1_000_000.0,
            distributions_dividend_income_dzd=0.0,
            net_unrealized_gain_loss_dzd=2_000_000.0,
        )

        dash = service.get_lp_dashboard(lp_id=lp_id, lp_name="Badis Investment Group")
        assert dash.lp_id == lp_id
        assert dash.active_syndicates_count == 2
        assert dash.total_commitments_dzd == 50_000_000.0
        assert dash.total_contributions_paid_dzd == 25_000_000.0  # (10+5) + (8+2) = 25M
        assert dash.total_uncalled_dry_powder_dzd == 25_000_000.0
        assert dash.total_distributions_received_dzd == 7_000_000.0  # 5M + 2M
        assert dash.portfolio_blended_tvpi > 1.0


# =============================================================================
# 2. SYNDICATE CO-INVESTMENT ENGINE & ALLOCATION TESTS
# =============================================================================

class TestCoInvestmentEngine:
    def test_fee_tier_prioritization(self):
        engine = CoInvestmentEngine()
        deal = engine.create_co_investment_deal(
            spv_id="spv-main-01",
            deal_name="Side-Car Co-Investment: Yassir Series C Extension",
            target_startup_id="startup-yassir-01",
            target_startup_name="Yassir Inc DZ",
            total_co_investment_capacity_dzd=50_000_000.0,
            soft_cap_dzd=30_000_000.0,
            hard_cap_dzd=60_000_000.0,
            initial_close_target_dzd=20_000_000.0,
            minimum_ticket_dzd=2_000_000.0,
        )

        # LP 1: Commitment in main SPV = 15M DZD -> Tier 1 Anchor (0% Fee, 0% Carry)
        req1 = engine.submit_co_investment_request(
            deal_id=deal.deal_id,
            lp_id="lp-anchor-01",
            lp_name="Cevital Ventures",
            lp_email="vc@cevital.com",
            main_spv_commitment_dzd=15_000_000.0,
            requested_amount_dzd=20_000_000.0,
        )
        assert req1.fee_tier == CoInvestmentFeeTier.TIER_1_ANCHOR
        assert req1.management_fee_rate_pct == 0.0
        assert req1.carry_rate_pct == 0.0

        # LP 2: Commitment in main SPV = 6M DZD -> Tier 2 Strategic (1% Fee, 10% Carry)
        req2 = engine.submit_co_investment_request(
            deal_id=deal.deal_id,
            lp_id="lp-strategic-02",
            lp_name="Condor Capital",
            lp_email="invest@condor.dz",
            main_spv_commitment_dzd=6_000_000.0,
            requested_amount_dzd=15_000_000.0,
        )
        assert req2.fee_tier == CoInvestmentFeeTier.TIER_2_STRATEGIC
        assert req2.management_fee_rate_pct == 1.0
        assert req2.carry_rate_pct == 10.0

        # LP 3: Commitment in main SPV = 2M DZD -> Tier 3 Standard (2% Fee, 20% Carry)
        req3 = engine.submit_co_investment_request(
            deal_id=deal.deal_id,
            lp_id="lp-standard-03",
            lp_name="Tassili Angel Fund",
            lp_email="info@tassili-angels.dz",
            main_spv_commitment_dzd=2_000_000.0,
            requested_amount_dzd=5_000_000.0,
        )
        assert req3.fee_tier == CoInvestmentFeeTier.TIER_3_STANDARD
        assert req3.management_fee_rate_pct == 2.0
        assert req3.carry_rate_pct == 20.0

    def test_unsubscribed_and_exact_allocation(self):
        engine = CoInvestmentEngine()
        deal = engine.create_co_investment_deal(
            spv_id="spv-main-02",
            deal_name="Side-Car Co-Investment: Maystro Delivery",
            target_startup_id="startup-maystro-01",
            target_startup_name="Maystro Delivery SPA",
            total_co_investment_capacity_dzd=30_000_000.0,
            soft_cap_dzd=20_000_000.0,
            hard_cap_dzd=35_000_000.0,
            initial_close_target_dzd=15_000_000.0,
            minimum_ticket_dzd=1_000_000.0,
        )

        engine.submit_co_investment_request(
            deal_id=deal.deal_id,
            lp_id="lp-1",
            lp_name="LP One",
            lp_email="one@dz.com",
            main_spv_commitment_dzd=10_000_000.0,
            requested_amount_dzd=10_000_000.0,
        )
        engine.submit_co_investment_request(
            deal_id=deal.deal_id,
            lp_id="lp-2",
            lp_name="LP Two",
            lp_email="two@dz.com",
            main_spv_commitment_dzd=10_000_000.0,
            requested_amount_dzd=10_000_000.0,
        )

        # Total requested = 20M <= Capacity 30M -> 100% filled
        res = engine.run_allocation(deal_id=deal.deal_id)
        assert not res.is_oversubscribed
        assert res.total_allocated_dzd == 20_000_000.0
        assert all(alloc.status == RequestStatus.ALLOCATED for alloc in res.allocations)
        assert all(alloc.allocated_amount_dzd == alloc.requested_amount_dzd for alloc in res.allocations)
        # 20M >= initial close target 15M and >= soft cap 20M -> Interim Close
        assert res.resulting_milestone == CoInvestmentMilestone.INTERIM_CLOSE

    def test_oversubscribed_pro_rata_and_excess_capacity_reallocation(self):
        engine = CoInvestmentEngine()
        # Co-investment capacity = 30M DZD
        deal = engine.create_co_investment_deal(
            spv_id="spv-main-03",
            deal_name="Side-Car Co-Investment: TemTem Mobility",
            target_startup_id="startup-temtem-01",
            target_startup_name="TemTem Mobility",
            total_co_investment_capacity_dzd=30_000_000.0,
            soft_cap_dzd=20_000_000.0,
            hard_cap_dzd=40_000_000.0,
            initial_close_target_dzd=15_000_000.0,
            minimum_ticket_dzd=1_000_000.0,
        )

        # Main SPV commitments:
        # LP A: 30M DZD (60% of 50M total main commitments) -> Entitlement = 60% of 30M = 18M DZD
        # LP B: 15M DZD (30% of 50M total main commitments) -> Entitlement = 30% of 30M = 9M DZD
        # LP C: 5M DZD  (10% of 50M total main commitments) -> Entitlement = 10% of 30M = 3M DZD
        # Total requested:
        # LP A requests 25M (needs more than 18M entitlement)
        # LP B requests only 5M (needs LESS than 9M entitlement -> 4M excess available!)
        # LP C requests 10M (needs more than 3M entitlement)
        engine.submit_co_investment_request(
            deal_id=deal.deal_id,
            lp_id="lp-A",
            lp_name="LP Alpha",
            lp_email="a@alpha.dz",
            main_spv_commitment_dzd=30_000_000.0,
            requested_amount_dzd=25_000_000.0,
        )
        engine.submit_co_investment_request(
            deal_id=deal.deal_id,
            lp_id="lp-B",
            lp_name="LP Beta",
            lp_email="b@beta.dz",
            main_spv_commitment_dzd=15_000_000.0,
            requested_amount_dzd=5_000_000.0,
        )
        engine.submit_co_investment_request(
            deal_id=deal.deal_id,
            lp_id="lp-C",
            lp_name="LP Gamma",
            lp_email="c@gamma.dz",
            main_spv_commitment_dzd=5_000_000.0,
            requested_amount_dzd=10_000_000.0,
        )

        # Total requested = 40M DZD > Capacity 30M DZD
        res = engine.run_allocation(deal_id=deal.deal_id, allow_greenshoe=False)
        assert res.is_oversubscribed
        assert res.total_allocated_dzd == 30_000_000.0

        alloc_dict = {a.lp_id: a for a in res.allocations}

        # LP B requested 5M, which is less than their 9M entitlement -> must be 100% filled!
        assert alloc_dict["lp-B"].allocated_amount_dzd == 5_000_000.0
        assert alloc_dict["lp-B"].status == RequestStatus.ALLOCATED

        # 4M excess was re-allocated between LP A and LP C weighted by main commitments (30M vs 5M):
        # LP A has higher commitment, gets the lion's share of the 4M excess!
        assert alloc_dict["lp-A"].allocated_amount_dzd > 18_000_000.0
        assert alloc_dict["lp-C"].allocated_amount_dzd > 3_000_000.0
        assert alloc_dict["lp-A"].status == RequestStatus.SCALED_BACK
        assert alloc_dict["lp-C"].status == RequestStatus.SCALED_BACK

        assert round(
            alloc_dict["lp-A"].allocated_amount_dzd +
            alloc_dict["lp-B"].allocated_amount_dzd +
            alloc_dict["lp-C"].allocated_amount_dzd,
            2
        ) == 30_000_000.0

    def test_greenshoe_expansion_and_milestones(self):
        engine = CoInvestmentEngine()
        deal = engine.create_co_investment_deal(
            spv_id="spv-main-04",
            deal_name="Side-Car Co-Investment: FarmAI Agritech",
            target_startup_id="startup-farmai-01",
            target_startup_name="FarmAI Algeria",
            total_co_investment_capacity_dzd=20_000_000.0,
            soft_cap_dzd=15_000_000.0,
            hard_cap_dzd=25_000_000.0,
            initial_close_target_dzd=10_000_000.0,
            minimum_ticket_dzd=1_000_000.0,
        )

        engine.submit_co_investment_request(
            deal_id=deal.deal_id,
            lp_id="lp-agro-01",
            lp_name="Agro Investors Algiers",
            lp_email="agro@algiers.dz",
            main_spv_commitment_dzd=20_000_000.0,
            requested_amount_dzd=24_000_000.0,
        )

        # Run allocation with greenshoe enabled:
        # Requested 24M > 20M capacity, but <= 25M hard cap -> greenshoe absorbs it!
        res = engine.run_allocation(deal_id=deal.deal_id, allow_greenshoe=True)
        assert res.greenshoe_used
        assert res.total_allocated_dzd == 24_000_000.0
        assert deal.greenshoe_activated

        # Advance milestone manually to FINAL_CLOSE
        updated_deal = engine.advance_closing_milestone(
            deal_id=deal.deal_id,
            target_milestone=CoInvestmentMilestone.FINAL_CLOSE,
            authorization_notes="Investment committee approved final close & capital call deployment.",
        )
        assert updated_deal.milestone_status == CoInvestmentMilestone.FINAL_CLOSE
        last_event = updated_deal.milestone_history[-1]
        assert last_event.deployment_authorized
        assert "Investment committee approved" in last_event.notes


# =============================================================================
# 3. END-TO-END FASTAPI REST APIS TEST
# =============================================================================

class TestSyndicateLPEndpointsE2E:
    def test_lp_portal_api_e2e(self, client: TestClient):
        spv_id = f"spv-api-test-{datetime.now().timestamp()}"
        lp_id = "lp-api-investor-01"

        # 1. POST /api/v1/syndicates/lp-portal/pccas/generate
        payload_pccas = {
            "spv_id": spv_id,
            "spv_name": "SPAS E2E Innovation Fund",
            "lp_id": lp_id,
            "lp_name": "Nabil Meziane",
            "lp_email": "nabil@meziane-holdings.dz",
            "committed_capital_dzd": 25_000_000.0,
            "ownership_percentage": 25.0,
            "units_held": 25_000,
            "beginning_capital_account_dzd": 10_000_000.0,
            "capital_contributions_called_dzd": 5_000_000.0,
            "distributions_return_of_capital_dzd": 2_000_000.0,
            "distributions_realized_gain_dzd": 1_000_000.0,
            "distributions_dividend_income_dzd": 500_000.0,
            "net_unrealized_gain_loss_dzd": 3_500_000.0,
            "allocated_expenses_and_fees_dzd": 150_000.0,
        }
        resp = client.post("/api/v1/syndicates/lp-portal/pccas/generate", json=payload_pccas)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["spv_id"] == spv_id
        assert data["lp_id"] == lp_id
        assert data["ending_capital_account_dzd"] > 0
        assert data["performance"]["tvpi"] > 0

        # 2. GET /api/v1/syndicates/lp-portal/pccas/{spv_id}/{lp_id}
        resp_get = client.get(f"/api/v1/syndicates/lp-portal/pccas/{spv_id}/{lp_id}")
        assert resp_get.status_code == 200
        assert resp_get.json()["lp_id"] == lp_id

        # 3. POST /api/v1/syndicates/lp-portal/performance/calculate
        payload_perf = {
            "beginning_balance_dzd": 10_000_000.0,
            "ending_balance_dzd": 15_000_000.0,
            "period_start_date": "2025-01-01T00:00:00Z",
            "period_end_date": "2025-12-31T23:59:59Z",
            "cash_flows": [
                {
                    "timestamp": "2025-03-01T00:00:00Z",
                    "flow_type": "CAPITAL_CALL_CONTRIBUTION",
                    "amount_dzd": -2_000_000.0,
                },
                {
                    "timestamp": "2025-09-01T00:00:00Z",
                    "flow_type": "DISTRIBUTION_RETURN_OF_CAPITAL",
                    "amount_dzd": 1_000_000.0,
                },
            ],
        }
        resp_perf = client.post("/api/v1/syndicates/lp-portal/performance/calculate", json=payload_perf)
        assert resp_perf.status_code == 200
        perf_data = resp_perf.json()
        assert "irr_annualized_pct" in perf_data
        assert "twr_period_pct" in perf_data
        assert "tvpi" in perf_data

        # 4. POST /api/v1/syndicates/lp-portal/tax-package/generate
        payload_tax = {
            "spv_id": spv_id,
            "spv_name": "SPAS E2E Innovation Fund",
            "lp_id": lp_id,
            "lp_name": "Nabil Meziane",
            "fiscal_year": 2025,
            "gross_total_distribution_dzd": 3_500_000.0,
            "non_taxable_return_of_capital_dzd": 2_000_000.0,
            "taxable_dividends_dzd": 500_000.0,
            "taxable_realized_capital_gains_dzd": 1_000_000.0,
            "tax_residence_country": "DZ",
            "tax_residence_type": "ALGERIAN_RESIDENT_NATURAL_PERSON",
        }
        resp_tax = client.post("/api/v1/syndicates/lp-portal/tax-package/generate", json=payload_tax)
        assert resp_tax.status_code == 200
        tax_data = resp_tax.json()
        assert tax_data["fiscal_year"] == 2025
        # 10% on 500k = 50k, 10% on 1M = 100k -> Total withheld = 150k
        assert tax_data["total_tax_withheld_dzd"] == 150_000.0
        assert tax_data["net_distribution_paid_dzd"] == 3_350_000.0
        assert "G50-" in tax_data["g50_bordereau_serial_number"]

        # 5. GET /api/v1/syndicates/lp-portal/tax-package/{spv_id}/{lp_id}/{fiscal_year}
        resp_tax_get = client.get(f"/api/v1/syndicates/lp-portal/tax-package/{spv_id}/{lp_id}/2025")
        assert resp_tax_get.status_code == 200

        # 6. GET /api/v1/syndicates/lp-portal/dashboard/{lp_id}
        resp_dash = client.get(f"/api/v1/syndicates/lp-portal/dashboard/{lp_id}")
        assert resp_dash.status_code == 200
        dash_data = resp_dash.json()
        assert dash_data["lp_id"] == lp_id
        assert dash_data["active_syndicates_count"] >= 1

    def test_co_investments_api_e2e(self, client: TestClient):
        # 1. POST /api/v1/syndicates/co-investments/deals
        payload_deal = {
            "spv_id": "spv-lead-api-01",
            "deal_name": "API E2E Co-Investment Side-Car: Djezzy Pay",
            "target_startup_id": "startup-djezzy-pay",
            "target_startup_name": "Djezzy Pay Algeria",
            "total_co_investment_capacity_dzd": 40_000_000.0,
            "soft_cap_dzd": 25_000_000.0,
            "hard_cap_dzd": 50_000_000.0,
            "initial_close_target_dzd": 15_000_000.0,
            "minimum_ticket_dzd": 1_000_000.0,
        }
        resp_deal = client.post("/api/v1/syndicates/co-investments/deals", json=payload_deal)
        assert resp_deal.status_code == 200
        deal_data = resp_deal.json()
        deal_id = deal_data["deal_id"]

        # 2. GET /api/v1/syndicates/co-investments/deals/{deal_id}
        resp_get_deal = client.get(f"/api/v1/syndicates/co-investments/deals/{deal_id}")
        assert resp_get_deal.status_code == 200
        assert resp_get_deal.json()["deal_id"] == deal_id

        # 3. POST /api/v1/syndicates/co-investments/deals/{deal_id}/requests
        # Anchor LP request: commitment 12M DZD in main SPV -> Tier 1 (0% fee, 0% carry)
        payload_req1 = {
            "lp_id": "lp-anchor-api-01",
            "lp_name": "Sonatrach Innovation Capital",
            "lp_email": "vc@sonatrach.dz",
            "main_spv_commitment_dzd": 12_000_000.0,
            "requested_amount_dzd": 15_000_000.0,
        }
        resp_req1 = client.post(f"/api/v1/syndicates/co-investments/deals/{deal_id}/requests", json=payload_req1)
        assert resp_req1.status_code == 200
        req1_data = resp_req1.json()
        assert req1_data["fee_tier"] == "TIER_1_ANCHOR"
        assert req1_data["management_fee_rate_pct"] == 0.0

        # Standard LP request
        payload_req2 = {
            "lp_id": "lp-standard-api-02",
            "lp_name": "Oran Angel Group",
            "lp_email": "oran@angel.dz",
            "main_spv_commitment_dzd": 3_000_000.0,
            "requested_amount_dzd": 10_000_000.0,
        }
        resp_req2 = client.post(f"/api/v1/syndicates/co-investments/deals/{deal_id}/requests", json=payload_req2)
        assert resp_req2.status_code == 200

        # 4. POST /api/v1/syndicates/co-investments/deals/{deal_id}/allocate
        resp_alloc = client.post(f"/api/v1/syndicates/co-investments/deals/{deal_id}/allocate", json={"allow_greenshoe": False})
        assert resp_alloc.status_code == 200
        alloc_data = resp_alloc.json()
        assert alloc_data["total_allocated_dzd"] == 25_000_000.0

        # 5. POST /api/v1/syndicates/co-investments/deals/{deal_id}/milestones/advance
        payload_ms = {
            "target_milestone": "INITIAL_CLOSE",
            "authorization_notes": "First closing milestone reached, deployment unlocked.",
        }
        resp_ms = client.post(f"/api/v1/syndicates/co-investments/deals/{deal_id}/milestones/advance", json=payload_ms)
        assert resp_ms.status_code == 200
        assert resp_ms.json()["milestone_status"] == "INITIAL_CLOSE"

        # 6. GET /api/v1/syndicates/co-investments/deals/{deal_id}/allocations
        resp_allocs = client.get(f"/api/v1/syndicates/co-investments/deals/{deal_id}/allocations")
        assert resp_allocs.status_code == 200
        assert len(resp_allocs.json()) == 2

        # 7. GET /api/v1/syndicates/co-investments/lp/lp-anchor-api-01/allocations
        resp_lp_allocs = client.get("/api/v1/syndicates/co-investments/lp/lp-anchor-api-01/allocations")
        assert resp_lp_allocs.status_code == 200
        assert len(resp_lp_allocs.json()) >= 1
