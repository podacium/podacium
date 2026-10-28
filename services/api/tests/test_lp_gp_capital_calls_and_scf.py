"""
Comprehensive Test Suite for:
1. Institutional LP/GP Capital Call & Drawdown Engine (ILPA standards).
2. Algerian 20-digit RIB & SWIFT/IBAN Notice Generation with Automated Reminders.
3. Sharia-Compliant Delinquent LP Default Protocol (Waqf penalty + haircut unit transfers).
4. Syndicate SPV Algerian Système Comptable Financier (SCF) Financial Statements & NAV.
5. Fast-path REST API Endpoints under `/api/v1/syndicates/capital-calls` and `/api/v1/syndicates/financial-statements`.
"""

from datetime import datetime, timedelta, timezone
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.capital_call_engine import (
    CapitalCallEngine,
    capital_call_engine,
    CommitmentStatus,
    CallNoticeStatus,
    LPPaymentStatus,
    DefaultRemedyType,
)
from app.services.spv_accounting_engine import (
    SPVAccountingEngine,
    spv_accounting_engine,
    PortfolioInvestment,
    FiscalYearStatus,
)


@pytest.fixture
def client():
    c = TestClient(app)
    token = "test_csrf_token_value_32_chars_123"
    c.cookies.set("csrf_token", token)
    c.headers.update({"x-csrf-token": token})
    return c


# =============================================================================
# CAPITAL CALL ENGINE TESTS
# =============================================================================

class TestCapitalCallEngine:
    def test_lp_commitments_and_dry_powder(self):
        engine = CapitalCallEngine()
        spv_id = "spv-el-djazair-seed-01"

        # Register 3 LPs: 2 domestic, 1 diaspora
        lp1 = engine.register_lp_commitment(
            spv_id=spv_id,
            lp_id="lp-oran-01",
            lp_name="Reda Mansouri (Oran Family Office)",
            lp_email="reda@oran-fo.dz",
            committed_amount_dzd=30_000_000.0,
            units_allocated=30_000,
        )
        lp2 = engine.register_lp_commitment(
            spv_id=spv_id,
            lp_id="lp-algiers-02",
            lp_name="Karim Benali",
            lp_email="karim@benali.dz",
            committed_amount_dzd=50_000_000.0,
            units_allocated=50_000,
        )
        lp3 = engine.register_lp_commitment(
            spv_id=spv_id,
            lp_id="lp-paris-03",
            lp_name="Yacine K. (Diaspora Paris)",
            lp_email="yacine@diaspora.fr",
            committed_amount_dzd=20_000_000.0,
            is_diaspora=True,
            residence_country="FR",
            units_allocated=20_000,
        )

        assert lp1.uncalled_dry_powder_dzd == 30_000_000.0
        assert lp2.uncalled_dry_powder_dzd == 50_000_000.0
        assert lp3.uncalled_dry_powder_dzd == 20_000_000.0

        summary = engine.get_spv_commitment_summary(spv_id)
        assert summary["total_lps_count"] == 3
        assert summary["total_committed_dzd"] == 100_000_000.0
        assert summary["uncalled_dry_powder_dzd"] == 100_000_000.0
        assert summary["overall_called_pct"] == 0.0

    def test_tranche_capital_call_pro_rata_allocation_and_banking_details(self):
        engine = CapitalCallEngine()
        spv_id = "spv-fintech-hub"

        engine.register_lp_commitment(
            spv_id=spv_id,
            lp_id="lp-01",
            lp_name="LP Alpha",
            lp_email="alpha@fund.dz",
            committed_amount_dzd=60_000_000.0,
        )
        engine.register_lp_commitment(
            spv_id=spv_id,
            lp_id="lp-02",
            lp_name="LP Beta (Diaspora Montreal)",
            lp_email="beta@fund.ca",
            committed_amount_dzd=40_000_000.0,
            is_diaspora=True,
            residence_country="CA",
        )

        # Issue 25% initial drawdown (25M DZD out of 100M DZD)
        notice = engine.create_capital_call_notice(
            spv_id=spv_id,
            spv_name="TamWheel FinTech SPAS",
            total_call_amount_dzd=25_000_000.0,
            tranche_title="Initial Drawdown Tranche A (25% Initial Deployment)",
            purpose_description="Core investment in Sirat POS Payment Terminals Series Seed",
            tranche_number=1,
            domestic_rib="00100012312345678904",
            swift_bic="BNPADZALXXX",
            iban="DZ5000100012312345678904",
        )

        assert notice.status == CallNoticeStatus.ISSUED
        assert notice.total_call_amount_dzd == 25_000_000.0
        assert len(notice.lp_items) == 2

        # Check pro-rata quotas (60% to Alpha, 40% to Beta)
        alpha_item = next(i for i in notice.lp_items if i.lp_id == "lp-01")
        beta_item = next(i for i in notice.lp_items if i.lp_id == "lp-02")

        assert alpha_item.pro_rata_share_pct == 60.0
        assert alpha_item.call_amount_dzd == 15_000_000.0  # 60% of 25M
        assert alpha_item.payment_status == LPPaymentStatus.PENDING

        assert beta_item.pro_rata_share_pct == 40.0
        assert beta_item.call_amount_dzd == 10_000_000.0  # 40% of 25M
        assert beta_item.is_diaspora is True

        # Check Domestic & Diaspora Banking Instructions
        assert notice.bank_details_domestic.rib_20_digit == "00100012312345678904"
        assert len(notice.bank_details_domestic.rib_20_digit) == 20
        assert notice.bank_details_international.swift_bic == "BNPADZALXXX"
        assert notice.bank_details_international.iban.startswith("DZ")

        # Check Reminder Schedule (3 reminders scheduled)
        assert len(notice.reminder_schedule) == 3
        assert notice.reminder_schedule[0].day_number == 3
        assert notice.reminder_schedule[1].day_number == 7

        # Check updated uncalled dry powder on commitments
        summary = engine.get_spv_commitment_summary(spv_id)
        assert summary["total_called_dzd"] == 25_000_000.0
        assert summary["uncalled_dry_powder_dzd"] == 75_000_000.0
        assert summary["overall_called_pct"] == 25.0

    def test_lp_wire_settlement_recording(self):
        engine = CapitalCallEngine()
        spv_id = "spv-health"

        engine.register_lp_commitment(
            spv_id=spv_id,
            lp_id="lp-01",
            lp_name="LP Alpha",
            lp_email="alpha@health.dz",
            committed_amount_dzd=10_000_000.0,
        )

        notice = engine.create_capital_call_notice(
            spv_id=spv_id,
            spv_name="HealthTech SPV",
            total_call_amount_dzd=5_000_000.0,
            tranche_title="Tranche 1",
            purpose_description="R&D expansion",
        )

        assert notice.collection_rate_pct == 0.0

        # Record full settlement
        engine.record_lp_payment(
            notice_id=notice.notice_id,
            lp_id="lp-01",
            amount_paid_dzd=5_000_000.0,
            payment_reference="WIRE-BNA-DZ-20261028-987",
        )

        updated_notice = engine.get_notice(notice.notice_id)
        assert updated_notice.status == CallNoticeStatus.FULLY_PAID
        assert updated_notice.total_collected_dzd == 5_000_000.0
        assert updated_notice.collection_rate_pct == 100.0

    def test_delinquent_lp_sharia_default_penalty_and_haircut_cure(self):
        engine = CapitalCallEngine()
        spv_id = "spv-agritech"

        engine.register_lp_commitment(
            spv_id=spv_id,
            lp_id="lp-defaulting",
            lp_name="Defaulting LP Sétif",
            lp_email="delinquent@setif.dz",
            committed_amount_dzd=10_000_000.0,
            units_allocated=10_000,
        )
        engine.register_lp_commitment(
            spv_id=spv_id,
            lp_id="lp-curing",
            lp_name="Solid LP Algiers",
            lp_email="solid@algiers.dz",
            committed_amount_dzd=20_000_000.0,
            units_allocated=20_000,
        )

        notice = engine.create_capital_call_notice(
            spv_id=spv_id,
            spv_name="AgriTech SPAS",
            total_call_amount_dzd=6_000_000.0,
            tranche_title="Tranche 1",
            purpose_description="Greenhouse IoT scaling",
            due_date_business_days=10,
            grace_period_days=5,
        )

        # Curing LP pays their pro-rata quota (4,000,000 DZD)
        engine.record_lp_payment(
            notice_id=notice.notice_id,
            lp_id="lp-curing",
            amount_paid_dzd=4_000_000.0,
            payment_reference="WIRE-BEA-CURE-001",
        )

        # Simulate 25 days passing (well beyond due date + 5-day grace period)
        future_time = notice.due_date + timedelta(days=12)

        delinquents = engine.evaluate_and_flag_delinquencies(
            notice_id=notice.notice_id,
            current_time=future_time,
            annualized_penalty_rate_pct=8.0,
        )

        assert len(delinquents) == 1
        d_item = delinquents[0]
        assert d_item.lp_id == "lp-defaulting"
        assert d_item.payment_status == LPPaymentStatus.DEFAULTED
        assert d_item.days_overdue == 12
        assert d_item.default_penalty_dzd > 0.0

        # CRITICAL SHARIA AUDIT: Late payment penalty is irrevocably routed to Waqf/Charity
        assert "وقف" in d_item.penalty_charity_destination or "Waqf" in d_item.penalty_charity_destination

        # Check voting rights suspension
        comm_def = next(c for c in engine.get_commitments(spv_id) if c.lp_id == "lp-defaulting")
        assert comm_def.voting_rights_active is False
        assert comm_def.status == CommitmentStatus.DEFAULTED

        # Execute step-in cure by Solid LP with 30% haircut discount
        resolution = engine.resolve_delinquent_lp_secondary_haircut(
            notice_id=notice.notice_id,
            delinquent_lp_id="lp-defaulting",
            curing_lp_contributions={"lp-curing": 2_000_000.0},
            haircut_discount_pct=30.0,
        )

        assert resolution.remedy_type == DefaultRemedyType.HAIRCUT_SECONDARY_TRANSFER
        assert resolution.haircut_percentage == 30.0
        assert resolution.shortfall_amount_dzd == 2_000_000.0
        # 10,000 units held * (1 - 0.30) = 7,000 units transferred
        assert resolution.units_transferred == 7_000

        # Check unit balances post-cure
        comm_cure = next(c for c in engine.get_commitments(spv_id) if c.lp_id == "lp-curing")
        assert comm_def.units_held == 3_000
        assert comm_cure.units_held == 27_000  # 20k original + 7k transferred


# =============================================================================
# SPV ACCOUNTING ENGINE (SCF) TESTS
# =============================================================================

class TestSPVAccountingEngine:
    def test_scf_balance_sheet_income_statement_and_nav_metrics(self):
        engine = SPVAccountingEngine()
        spv_id = "spv-algeria-venture-1"

        portfolio = [
            PortfolioInvestment(
                startup_id="startup-sirat",
                startup_name="Sirat Logistics SPAS",
                equity_shares_count=50_000,
                acquisition_cost_dzd=40_000_000.0,
                current_fair_value_dzd=70_000_000.0,  # 75% unrealized gain
                cumulative_impairment_dzd=0.0,
                ownership_percentage=15.0,
            ),
            PortfolioInvestment(
                startup_id="startup-bioalgerie",
                startup_name="BioAlgerie Health SPAS",
                equity_shares_count=20_000,
                acquisition_cost_dzd=20_000_000.0,
                current_fair_value_dzd=15_000_000.0,
                cumulative_impairment_dzd=5_000_000.0,  # 5M DZD impairment
                ownership_percentage=10.0,
            ),
        ]

        # Compile FY2026 financial report
        report = engine.compile_financial_statements(
            spv_id=spv_id,
            spv_name="TamWheel Innovation Fund I SPAS",
            fiscal_year=2026,
            total_spv_units=100_000,
            paid_in_capital_dzd=70_000_000.0,
            bank_escrow_cash_dzd=10_000_000.0,
            portfolio_investments=portfolio,
            called_capital_receivable_dzd=2_000_000.0,
            management_fees_expense_dzd=1_400_000.0,  # 2% management fee
            audit_and_legal_expense_dzd=600_000.0,    # Audit / Law 22-09 SPAS fees
            carried_interest_provision_dzd=3_000_000.0,
            realized_dividends_dzd=2_500_000.0,
            cumulative_distributions_paid_dzd=5_000_000.0,
        )

        assert report.fiscal_year == 2026
        assert report.status == FiscalYearStatus.AUDITED
        assert "SPAS" in report.legal_form

        # 1. Income Statement Verification
        # Total Produits: 2.5M dividends
        # Total Charges: 1.4M mgmt + 0.6M audit + 5.0M impairment = 7.0M
        # Net result = 2.5M - 7.0M = -4.5M DZD
        assert report.income_statement.total_produits_financiers_dzd == 2_500_000.0
        assert report.income_statement.total_charges_exercice_dzd == 7_000_000.0
        assert report.income_statement.resultat_net_exercice_dzd == -4_500_000.0

        # 2. Balance Sheet Verification
        # Class 1 Equity: 70M paid-in - 4.5M net result = 65.5M DZD
        # Class 1 Non-current Liabilities: 3M carried interest provision
        assert report.balance_sheet.class_1_equity.total_capitaux_propres_dzd == 65_500_000.0
        assert report.balance_sheet.class_1_equity.total_passif_non_courant_dzd == 3_000_000.0

        # Class 2 Net Non-current assets: (40M + 20M) cost - 5M impairment = 55M DZD
        assert report.balance_sheet.class_2_non_current_assets.total_actif_non_courant_net_dzd == 55_000_000.0

        # Class 4 Receivables: 2M DZD
        assert report.balance_sheet.class_4_third_parties.total_creances_courantes_dzd == 2_000_000.0

        # Class 5 Cash & Escrow: 10M DZD
        assert report.balance_sheet.class_5_financial.total_tresorerie_dzd == 10_000_000.0

        # Total Actif Net: 55M + 2M + 10M = 67M DZD
        assert report.balance_sheet.total_actif_net_dzd == 67_000_000.0

        # 3. NAV Computations
        # SCF Book NAV: Total Assets (67M) - Total Liabilities (3M carried interest) = 64M DZD
        assert report.net_asset_value_scf_dzd == 64_000_000.0
        # NAV / unit: 64M / 100,000 units = 640.00 DZD
        assert report.nav_per_unit_dzd == 640.00

        # Fair Value NAV: Portfolio Fair Value (70M + 15M = 85M) + Cash (10M) + Receivables (2M) - Liabilities (3M)
        # = 85M + 12M - 3M = 94M DZD
        assert report.fair_value_nav_dzd == 94_000_000.0
        # Fair Value NAV / unit: 94M / 100,000 units = 940.00 DZD
        assert report.fair_value_nav_per_unit_dzd == 940.00

        # 4. Institutional VC Performance Multiples
        # TVPI = (Distributions 5M + FV NAV 94M) / Paid-in 70M = 99M / 70M = 1.414x
        assert report.tvpi == 1.414
        assert report.dpi == round(5_000_000.0 / 70_000_000.0, 3)  # 0.071
        assert report.rvpi == round(94_000_000.0 / 70_000_000.0, 3) # 1.343


# =============================================================================
# REST API ENDPOINT TESTS
# =============================================================================

class TestSyndicateCapitalCallsAndSCFEndpoints:
    def test_capital_calls_api_e2e(self, client):
        spv_id = "spv-api-test-01"

        # 1. Register LP Commitment
        res = client.post(
            "/api/v1/syndicates/capital-calls/commitments",
            json={
                "spv_id": spv_id,
                "lp_id": "lp-api-01",
                "lp_name": "Dr. Djamel Mokhtar",
                "lp_email": "djamel@mokhtar.dz",
                "committed_amount_dzd": 40_000_000.0,
                "units_allocated": 40_000,
            },
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["committed_amount_dzd"] == 40_000_000.0
        assert data["uncalled_dry_powder_dzd"] == 40_000_000.0

        # 2. Get Commitments Summary
        res = client.get(f"/api/v1/syndicates/capital-calls/commitments/{spv_id}")
        assert res.status_code == 200
        summary = res.json()["summary"]
        assert summary["total_committed_dzd"] == 40_000_000.0

        # 3. Create Capital Call Notice
        res = client.post(
            "/api/v1/syndicates/capital-calls/notices",
            json={
                "spv_id": spv_id,
                "spv_name": "Oran Health Ventures SPAS",
                "total_call_amount_dzd": 10_000_000.0,
                "tranche_title": "Tranche 1 Drawdown",
                "purpose_description": "Initial medical clinic roll-out",
                "domestic_rib": "00100012312345678904",
            },
        )
        assert res.status_code == 200, res.text
        notice = res.json()
        notice_id = notice["notice_id"]
        assert notice["total_call_amount_dzd"] == 10_000_000.0
        assert len(notice["lp_items"]) == 1

        # 4. Get Notice Details
        res = client.get(f"/api/v1/syndicates/capital-calls/notices/{notice_id}")
        assert res.status_code == 200
        assert res.json()["notice_id"] == notice_id

        # 5. Record Wire Payment
        res = client.post(
            f"/api/v1/syndicates/capital-calls/notices/{notice_id}/payments",
            json={
                "lp_id": "lp-api-01",
                "amount_paid_dzd": 10_000_000.0,
                "payment_reference": "WIRE-BNA-ALGER-2026-001",
            },
        )
        assert res.status_code == 200
        assert res.json()["status"] == "FULLY_PAID"

    def test_financial_statements_api_e2e(self, client):
        # 1. Compile Financial Statements
        res = client.post(
            "/api/v1/syndicates/financial-statements/compile",
            json={
                "spv_id": "spv-api-fin-01",
                "spv_name": "Mitidja CleanTech SPAS",
                "fiscal_year": 2026,
                "total_spv_units": 50_000,
                "paid_in_capital_dzd": 50_000_000.0,
                "bank_escrow_cash_dzd": 15_000_000.0,
                "portfolio_investments": [
                    {
                        "startup_id": "startup-solar",
                        "startup_name": "Mitidja Solar Robotics",
                        "equity_shares_count": 25_000,
                        "acquisition_cost_dzd": 35_000_000.0,
                        "current_fair_value_dzd": 60_000_000.0,
                        "cumulative_impairment_dzd": 0.0,
                        "ownership_percentage": 20.0,
                    }
                ],
                "called_capital_receivable_dzd": 0.0,
                "management_fees_expense_dzd": 1_000_000.0,
                "audit_and_legal_expense_dzd": 500_000.0,
                "carried_interest_provision_dzd": 2_000_000.0,
                "cumulative_distributions_paid_dzd": 0.0,
            },
        )
        assert res.status_code == 200, res.text
        report = res.json()
        report_id = report["report_id"]
        assert report["fiscal_year"] == 2026
        assert report["total_spv_units"] == 50_000
        assert report["fair_value_nav_dzd"] > 0
        assert report["fair_value_nav_per_unit_dzd"] > 0
        assert report["tvpi"] > 1.0

        # 2. Get Certified Report
        res = client.get(f"/api/v1/syndicates/financial-statements/{report_id}")
        assert res.status_code == 200
        assert res.json()["report_id"] == report_id

        # 3. List Reports by SPV
        res = client.get("/api/v1/syndicates/financial-statements/spv/spv-api-fin-01")
        assert res.status_code == 200
        assert len(res.json()) >= 1
