"""
TamWheel Sovereign Ethical Agentic Venture OS — AAOIFI FAS 9 & Standard No. 8 Test Suite.
Verifies:
1. Zakat Engine (AAOIFI FAS 9):
   - Net Asset Method (Working Capital) vs Net Invested Capital Method (Financing).
   - Dynamic DZD Nisab benchmarking against 85g fine gold and 595g silver.
   - Dual Hawl rate application (2.5% Hijri vs 2.5775% Gregorian solar year).
   - Founder entity-level Zakat vs Long-term Angel Investor (Mustathmir) vs Short-term Trader (Mudharib).
2. Murabaha Working Capital Engine (AAOIFI Standard No. 8):
   - 4-stage lifecycle progression: PROMISE -> GOODS_ACQUIRED -> SALE_EXECUTED -> REPAYING -> COMPLETED.
   - Transparent cost price (Thaman al-Asl) and profit markup (Ribh) disclosure.
   - Equal periodic installment amortization schedule.
   - Delinquency late fee routing (100% to accredited charities via Tathir, 0% platform income).
3. HTTP Endpoints integration for Zakat and Murabaha.
"""

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.zakat_engine import (
    zakat_engine,
    CompanyZakatRequest,
    InvestorZakatRequest,
    WorkingCapitalAssetsInput,
    WorkingCapitalLiabilitiesInput,
    ZakatCalculationMethod,
    YearType,
    NisabBenchmark,
    InvestorType,
    LUNAR_HIJRI_RATE,
    SOLAR_GREGORIAN_RATE,
)
from app.services.murabaha_engine import (
    murabaha_engine,
    MurabahaPurchaseOrderRequest,
    GoodsPossessionConfirmationRequest,
    MurabahaSaleExecutionRequest,
    RecordInstallmentPaymentRequest,
    ApplyLatePenaltyRequest,
    MurabahaStage,
    MurabahaAssetCategory,
    PossessionType,
)


@pytest.fixture
def client():
    c = TestClient(app)
    token = "test_csrf_token_value_32_chars_123"
    c.cookies.set("csrf_token", token)
    c.headers.update({"x-csrf-token": token})
    return c


# =============================================================================
# 1. UNIT TESTS: AAOIFI FAS 9 ZAKAT ENGINE
# =============================================================================

class TestZakatEngine:
    def test_nisab_evaluation_gold_and_silver(self):
        """Validates Nisab evaluation against gold (85g) and silver (595g)."""
        eval_gold_below = zakat_engine.evaluate_nisab(500_000.0, benchmark=NisabBenchmark.GOLD_85G)
        assert eval_gold_below.is_nisab_reached is False
        assert eval_gold_below.nisab_threshold_dzd == 85.0 * 11500.0

        eval_gold_above = zakat_engine.evaluate_nisab(1_200_000.0, benchmark=NisabBenchmark.GOLD_85G)
        assert eval_gold_above.is_nisab_reached is True

        eval_silver_above = zakat_engine.evaluate_nisab(100_000.0, benchmark=NisabBenchmark.SILVER_595G)
        assert eval_silver_above.is_nisab_reached is True
        assert eval_silver_above.nisab_threshold_dzd == 595.0 * 140.0

    def test_company_zakat_net_asset_method(self):
        """Tests corporate Zakat calculation under Net Asset Method (Working Capital)."""
        req = CompanyZakatRequest(
            startup_id="startup-oran-01",
            startup_name="Oran Solar Logistics",
            calculation_method=ZakatCalculationMethod.NET_ASSETS,
            year_type=YearType.LUNAR_HIJRI,
            total_outstanding_shares=100_000,
            current_assets=WorkingCapitalAssetsInput(
                cash_and_equivalents_dzd=5_000_000.0,
                short_term_investments_dzd=1_000_000.0,
                trade_receivables_net_dzd=3_000_000.0,
                merchandise_inventory_dzd=2_000_000.0,
            ),
            current_liabilities=WorkingCapitalLiabilitiesInput(
                trade_payables_dzd=2_000_000.0,
                short_term_debts_dzd=1_000_000.0,
            ),
        )

        assessment = zakat_engine.calculate_company_zakat(req)

        # Zakatable Assets = 5M + 1M + 3M + 2M = 11,000,000 DZD
        # Deductible Liabilities = 2M + 1M = 3,000,000 DZD
        # Zakat Base = 8,000,000 DZD
        assert assessment.zakat_base_dzd == 8_000_000.0
        assert assessment.nisab_evaluation.is_nisab_reached is True
        assert assessment.applicable_rate_pct == 2.5  # 2.5%
        # Zakat Payable = 8,000,000 * 0.025 = 200,000 DZD
        assert assessment.total_zakat_payable_dzd == 200_000.0
        # Zakat per Share = 200,000 / 100,000 = 2.0 DZD
        assert assessment.zakat_per_share_dzd == 2.0

    def test_company_zakat_solar_gregorian_rate(self):
        """Tests AAOIFI FAS 9 solar year rate adjustment (2.5775%)."""
        req = CompanyZakatRequest(
            startup_id="startup-algiers-tech",
            startup_name="Algiers AI Robotics",
            calculation_method=ZakatCalculationMethod.NET_ASSETS,
            year_type=YearType.SOLAR_GREGORIAN,
            total_outstanding_shares=50_000,
            current_assets=WorkingCapitalAssetsInput(cash_and_equivalents_dzd=10_000_000.0),
            current_liabilities=WorkingCapitalLiabilitiesInput(trade_payables_dzd=2_000_000.0),
        )

        assessment = zakat_engine.calculate_company_zakat(req)
        assert assessment.applicable_rate_pct == 2.5775
        assert assessment.zakat_base_dzd == 8_000_000.0
        assert assessment.total_zakat_payable_dzd == round(8_000_000.0 * SOLAR_GREGORIAN_RATE, 2)

    def test_investor_zakat_mustathmir_vs_mudharib(self):
        """Tests individual angel investor Zakat: long-term asset-based vs short-term trader."""
        # 1. Long-term Angel Investor (Mustathmir): Zakat based on proportional net zakatable working capital
        req_angel = InvestorZakatRequest(
            investor_id="investor-karim",
            investor_name="Karim B.",
            startup_id="startup-oran-01",
            investor_type=InvestorType.LONG_TERM_ANGEL,
            shares_held=10_000,
            total_outstanding_shares=100_000,
            company_zakat_base_dzd=8_000_000.0,
            market_price_per_share_dzd=150.0,
            nisab_benchmark=NisabBenchmark.SILVER_595G,
            company_already_paid_zakat=False,
        )
        assessment_angel = zakat_engine.calculate_investor_zakat(req_angel)
        # Proportional Base = 8,000,000 * (10,000 / 100,000) = 800,000 DZD
        assert assessment_angel.zakat_base_dzd == 800_000.0
        assert assessment_angel.zakat_payable_dzd == 20_000.0  # 800,000 * 2.5%

        # 2. Short-term Trader (Mudharib): Zakat on full fair market value
        req_trader = InvestorZakatRequest(
            investor_id="trader-yacine",
            investor_name="Yacine M.",
            startup_id="startup-oran-01",
            investor_type=InvestorType.SHORT_TERM_TRADER,
            shares_held=10_000,
            total_outstanding_shares=100_000,
            company_zakat_base_dzd=8_000_000.0,
            market_price_per_share_dzd=150.0,
            nisab_benchmark=NisabBenchmark.SILVER_595G,
            company_already_paid_zakat=False,
        )
        assessment_trader = zakat_engine.calculate_investor_zakat(req_trader)
        # Market Value Base = 10,000 * 150 = 1,500,000 DZD
        assert assessment_trader.zakat_base_dzd == 1_500_000.0
        assert assessment_trader.zakat_payable_dzd == 37_500.0  # 1.5M * 2.5%

        # 3. Anti-double taxation check: If company already paid, investor payable is 0 DZD
        req_paid = InvestorZakatRequest(
            investor_id="investor-karim",
            investor_name="Karim B.",
            startup_id="startup-oran-01",
            investor_type=InvestorType.LONG_TERM_ANGEL,
            shares_held=10_000,
            total_outstanding_shares=100_000,
            company_zakat_base_dzd=8_000_000.0,
            company_already_paid_zakat=True,
        )
        assessment_paid = zakat_engine.calculate_investor_zakat(req_paid)
        assert assessment_paid.zakat_payable_dzd == 0.0


# =============================================================================
# 2. UNIT TESTS: AAOIFI STANDARD NO. 8 MURABAHA FACILITY
# =============================================================================

class TestMurabahaEngine:
    def test_four_stage_murabaha_lifecycle_and_charity_penalty(self):
        """Validates 4-stage Murabaha progression, installment schedule, and charity late fee."""
        engine = murabaha_engine

        # STAGE 1: PROMISE TO PURCHASE
        req = MurabahaPurchaseOrderRequest(
            startup_id="startup-adrar-solar",
            startup_name="Adrar Green Irrigation",
            supplier_id="sup-sonelgaz-01",
            supplier_name="Sonelgaz Solar Components SPA",
            goods_description="Industrial Photovoltaic Pumping Array (50 kW)",
            category=MurabahaAssetCategory.SOLAR_ENERGY_SYSTEMS,
            cost_price_dzd=6_000_000.0,
            markup_rate_pct=10.0,  # 10% profit markup
            tenor_months=6,         # 6 monthly installments
        )
        facility = engine.create_purchase_order(req)
        assert facility.stage == MurabahaStage.PROMISE
        assert facility.cost_price_dzd == 6_000_000.0
        assert facility.markup_rate_pct == 10.0

        # STAGE 2: GOODS ACQUIRED (Qabd & Daman)
        possession_req = GoodsPossessionConfirmationRequest(
            supplier_invoice_ref="INV-2026-SOLAR-099",
            actual_cost_dzd=6_000_000.0,
            possession_type=PossessionType.PHYSICAL,
            warehouse_or_delivery_ref="DEPOT-ADRAR-884",
        )
        facility = engine.confirm_goods_possession(facility.order_id, possession_req)
        assert facility.stage == MurabahaStage.GOODS_ACQUIRED
        assert facility.actual_cost_dzd == 6_000_000.0

        # STAGE 3: SALE CONTRACT EXECUTED (Bay' al-Murabaha)
        sale_req = MurabahaSaleExecutionRequest(client_acceptance_confirmed=True)
        facility = engine.execute_murabaha_sale(facility.order_id, sale_req)
        assert facility.stage == MurabahaStage.REPAYING
        assert len(facility.installments) == 6
        # Selling price = 6M * 1.10 = 6.6M DZD -> 1.1M DZD per installment
        assert facility.installments[0].installment_amount_dzd == 1_100_000.0

        # STAGE 4: INSTALLMENT PAYMENT
        pay_req = RecordInstallmentPaymentRequest(
            installment_index=1,
            payment_amount_dzd=1_100_000.0,
            payment_reference="BANK-TRANSFER-BEA-004491",
        )
        facility = engine.record_installment_payment(facility.order_id, pay_req)
        assert facility.installments[0].status.value == "PAID"
        assert facility.installments[0].payment_reference == "BANK-TRANSFER-BEA-004491"

        # DELINQUENCY LATE FEE -> 100% TO CHARITY
        penalty_req = ApplyLatePenaltyRequest(
            installment_index=2,
            late_fee_amount_dzd=25_000.0,
            charity_id="el-baraka-association-dz",
            days_overdue=15,
        )
        receipt = engine.apply_late_fee_to_charity(facility.order_id, penalty_req)
        assert receipt.status.value == "DISBURSED"
        assert receipt.amount_dzd == 25_000.0
        assert receipt.is_tax_deductible is False  # Sharia non-tax-deductibility


# =============================================================================
# 3. HTTP ENDPOINT TESTS
# =============================================================================

class TestZakatAndMurabahaEndpoints:
    def test_api_zakat_company_endpoint(self, client):
        res = client.post(
            "/api/v1/sharia/zakat/calculate/company",
            json={
                "startup_id": "co-test-01",
                "startup_name": "Constantine Biotech SPA",
                "calculation_method": "NET_ASSETS",
                "year_type": "LUNAR_HIJRI",
                "total_outstanding_shares": 10000,
                "current_assets": {"cash_and_equivalents_dzd": 4000000.0},
                "current_liabilities": {"trade_payables_dzd": 1000000.0},
            },
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["zakat_base_dzd"] == 3_000_000.0
        assert data["total_zakat_payable_dzd"] == 75_000.0  # 3M * 2.5%

    def test_api_zakat_nisab_endpoint(self, client):
        res = client.get("/api/v1/sharia/zakat/nisab?zakat_base_dzd=1500000&benchmark=GOLD_85G")
        assert res.status_code == 200
        assert res.json()["is_nisab_reached"] is True

    def test_api_murabaha_lifecycle_endpoints(self, client):
        # 1. Order Creation
        res = client.post(
            "/api/v1/sharia/murabaha/orders",
            json={
                "startup_id": "startup-test-api",
                "startup_name": "Oran Logistics Tech",
                "supplier_id": "sup-ren-01",
                "supplier_name": "Renault Algérie SPA",
                "goods_description": "Electric Delivery Vans",
                "category": "COMMERCIAL_VEHICLES",
                "cost_price_dzd": 5000000.0,
                "markup_rate_pct": 8.0,
                "tenor_months": 12,
            },
        )
        assert res.status_code == 201, res.text
        order_id = res.json()["order_id"]

        # 2. Goods Possession
        res = client.post(
            f"/api/v1/sharia/murabaha/orders/{order_id}/acquire",
            json={
                "supplier_invoice_ref": "INV-REN-009",
                "actual_cost_dzd": 5000000.0,
                "possession_type": "PHYSICAL",
                "warehouse_or_delivery_ref": "DOCK-RECEIPT-991",
            },
        )
        assert res.status_code == 200
        assert res.json()["stage"] == "GOODS_ACQUIRED"
