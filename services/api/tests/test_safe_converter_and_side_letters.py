"""
Exhaustive Pytest Suite for Advanced SAFE / Convertible Note Converter & Institutional Side Letter Registry.
Tests:
- SafeConversionEngine: YC Post-Money SAFE, Pre-Money SAFE, Convertible Promissory Notes with compounding/simple interest.
- Valuation Cap, Discount Rate, Valuation Floor, MFN clause elections.
- Equity Financing, Liquidity Event, and Dissolution scenarios.
- Exact integer share distribution via Hamilton-Hare largest remainder method.
- SideLetterEngine: Covenants tracking (Information, Pro-Rata, Observer, MFN, Sharia), Law 22-09 SPAS conflict audits.
- Formal CNRC shareholder register and capital modification export.
- FastAPI HTTP router endpoints under /api/v1/safes and /api/v1/side-letters.
"""

from datetime import datetime, timezone, timedelta
from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.auth import get_current_active_user
from app.services.safe_conversion_engine import SafeConversionEngine
from app.services.side_letter_engine import SideLetterEngine
from app.schemas.safe_conversion import (
    SafeType,
    InterestType,
    ConversionScenario,
    SafeInstrumentModel,
    PricedRoundTerms,
    SafeConversionSimulationRequest,
)
from app.schemas.side_letter import (
    CovenantType,
    SideLetterCovenant,
    SideLetterCreateRequest,
    MfnElectionRequest,
)


class MockUser:
    def __init__(self, user_id=1, email="admin@tamwheel.dz", role="ADMIN"):
        self.id = user_id
        self.email = email
        self.role = role


@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[get_current_active_user] = lambda: MockUser()
    yield
    app.dependency_overrides.clear()


# =========================================================================
# 1. SafeConversionEngine Unit Tests
# =========================================================================

def test_convertible_note_interest_accrual_simple_and_compound():
    engine = SafeConversionEngine()
    principal = Decimal("10000000.00")  # 10M DZD
    annual_rate = Decimal("0.08")  # 8%
    issuance_date = datetime(2025, 1, 1, tzinfo=timezone.utc)
    conversion_date = datetime(2026, 1, 1, tzinfo=timezone.utc)  # ~1 year

    # 1. Simple interest (~800,000 DZD)
    simple_interest = engine.calculate_accrued_interest(
        principal=principal,
        annual_rate=annual_rate,
        interest_type=InterestType.SIMPLE,
        issuance_date=issuance_date,
        conversion_date=conversion_date,
    )
    assert Decimal("795000.00") <= simple_interest <= Decimal("805000.00")

    # 2. Compounding interest over 2 years
    conversion_2y = datetime(2027, 1, 1, tzinfo=timezone.utc)
    compound_interest = engine.calculate_accrued_interest(
        principal=principal,
        annual_rate=annual_rate,
        interest_type=InterestType.COMPOUND,
        issuance_date=issuance_date,
        conversion_date=conversion_2y,
    )
    # (1.08)^2 - 1 = 0.1664 -> ~1,664,000 DZD
    assert Decimal("1650000.00") <= compound_interest <= Decimal("1675000.00")


def test_mfn_clause_election_adopts_best_terms():
    engine = SafeConversionEngine()
    instruments = [
        SafeInstrumentModel(
            id="safe_early_mfn",
            investor_id="inv_1",
            investor_name="Angel Investor 1 (Early)",
            safe_type=SafeType.POST_MONEY_SAFE,
            principal_dzd=Decimal("5000000.00"),
            valuation_cap_dzd=Decimal("80000000.00"),  # 80M cap
            discount_rate=Decimal("0.10"),  # 10% discount
            has_mfn_clause=True,
        ),
        SafeInstrumentModel(
            id="safe_later_sweet",
            investor_id="inv_2",
            investor_name="Syndicate Lead (Later)",
            safe_type=SafeType.POST_MONEY_SAFE,
            principal_dzd=Decimal("15000000.00"),
            valuation_cap_dzd=Decimal("50000000.00"),  # 50M cap (lower/better)
            discount_rate=Decimal("0.25"),  # 25% discount (higher/better)
            has_mfn_clause=False,
        ),
    ]

    adjusted = engine.apply_mfn_clauses(instruments)
    early = next(i for i in adjusted if i.id == "safe_early_mfn")
    assert early.valuation_cap_dzd == Decimal("50000000.00")
    assert early.discount_rate == Decimal("0.25")


def test_hamilton_hare_integer_share_conservation():
    engine = SafeConversionEngine()
    unrounded = [
        ("inst_a", 100.4),
        ("inst_b", 200.35),
        ("inst_c", 300.25),
    ]
    # Sum = 601.0 -> target 601 integer shares
    allocated = engine.allocate_integer_shares_hamilton_hare(unrounded)

    total_int_shares = sum(shares for _, shares, _ in allocated)
    assert total_int_shares == 601

    alloc_map = {inst_id: shares for inst_id, shares, _ in allocated}
    # inst_a has highest remainder (0.4) -> gets 100 + 1 = 101
    assert alloc_map["inst_a"] == 101
    assert alloc_map["inst_b"] == 200
    assert alloc_map["inst_c"] == 300


def test_simulate_priced_round_equity_financing():
    engine = SafeConversionEngine()
    startup_id = "startup_seed_001"
    pre_shares = 10000  # 10,000 common shares held by founders

    instruments = [
        # Note converting at cap (50M cap / 10,000 = 5,000 DZD per share)
        SafeInstrumentModel(
            id="safe_cap",
            investor_id="inv_angel",
            investor_name="Seed Angel",
            safe_type=SafeType.PRE_MONEY_SAFE,
            principal_dzd=Decimal("10000000.00"),  # 10M DZD
            valuation_cap_dzd=Decimal("50000000.00"),  # 50M cap
            discount_rate=Decimal("0.20"),
            has_mfn_clause=False,
        ),
        # Note converting at discount (Round price 8,000 DZD * 0.8 = 6,400 DZD)
        SafeInstrumentModel(
            id="safe_discount",
            investor_id="inv_scout",
            investor_name="Venture Scout",
            safe_type=SafeType.PRE_MONEY_SAFE,
            principal_dzd=Decimal("6400000.00"),
            valuation_cap_dzd=Decimal("120000000.00"),  # High cap (120M) -> discount wins
            discount_rate=Decimal("0.20"),
            has_mfn_clause=False,
        ),
    ]

    round_terms = PricedRoundTerms(
        round_name="Series Seed",
        pre_money_valuation_dzd=Decimal("80000000.00"),  # 80M
        new_capital_invested_dzd=Decimal("24000000.00"),  # 24M
        new_share_price_dzd=Decimal("8000.00"),  # 8,000 DZD/share
    )

    req = SafeConversionSimulationRequest(
        startup_id=startup_id,
        existing_pre_round_shares=pre_shares,
        instruments=instruments,
        scenario=ConversionScenario.EQUITY_FINANCING,
        round_terms=round_terms,
    )

    res = engine.simulate_conversion(req)
    assert res.conservation_verified is True
    assert res.total_new_shares_from_priced_round == 3000  # 24M / 8000 = 3,000 shares
    assert len(res.safe_conversions) == 2

    cap_item = next(c for c in res.safe_conversions if c.safe_id == "safe_cap")
    assert cap_item.conversion_mechanism_chosen == "PRE_MONEY_CAP"
    assert cap_item.integer_shares_issued == 2000  # 10M / 5000 = 2,000 shares

    disc_item = next(c for c in res.safe_conversions if c.safe_id == "safe_discount")
    assert disc_item.conversion_mechanism_chosen == "DISCOUNT_PRICE"
    assert disc_item.integer_shares_issued == 1000  # 6.4M / 6400 = 1,000 shares

    # Total post shares = 10,000 + 2,000 + 1,000 + 3,000 = 16,000
    assert res.total_post_shares == 16000
    assert len(res.cap_table_before_vs_after) == 4


def test_simulate_liquidity_event_optimal_election():
    engine = SafeConversionEngine()
    startup_id = "startup_exit_001"
    pre_shares = 10000

    instruments = [
        SafeInstrumentModel(
            id="safe_super_exit",
            investor_id="inv_vc",
            investor_name="Early VC",
            safe_type=SafeType.POST_MONEY_SAFE,
            principal_dzd=Decimal("10000000.00"),  # 10M
            valuation_cap_dzd=Decimal("50000000.00"),  # 50M cap (20% ownership)
            discount_rate=Decimal("0.20"),
        )
    ]

    # Massive exit at 500,000,000 DZD (500M)
    # Equity value = 500M * (10M / 50M) = 100M DZD > 10M cash payout
    req_high = SafeConversionSimulationRequest(
        startup_id=startup_id,
        existing_pre_round_shares=pre_shares,
        instruments=instruments,
        scenario=ConversionScenario.LIQUIDITY_EVENT,
        liquidity_event_valuation_dzd=Decimal("500000000.00"),
    )
    res_high = engine.simulate_conversion(req_high)
    conv_high = res_high.safe_conversions[0]
    assert conv_high.conversion_mechanism_chosen == "LIQUIDITY_EQUITY_CONVERSION"
    assert conv_high.integer_shares_issued == 2000


# =========================================================================
# 2. SideLetterEngine Unit Tests
# =========================================================================

def test_side_letter_covenant_creation_and_audit():
    engine = SideLetterEngine()
    startup_id = "startup_sl_001"

    covenants = [
        SideLetterCovenant(
            covenant_type=CovenantType.INFORMATION_RIGHTS,
            description="Major Investor quarterly financial statements within 45 days and annual within 90 days.",
            threshold_shares_required=500,
            reporting_frequency_days=45,
        ),
        SideLetterCovenant(
            covenant_type=CovenantType.BOARD_OBSERVER,
            description="Right to appoint one non-voting observer to the board of directors.",
            specific_terms={"has_confidentiality_undertaking": True},
        ),
        SideLetterCovenant(
            covenant_type=CovenantType.SHARIA_COMPLIANCE,
            description="Startup must refrain from interest-bearing debt and non-halal business activities.",
            specific_terms={"allows_conventional_interest": False},
        ),
    ]

    req = SideLetterCreateRequest(
        investor_id="inv_casbah_capital",
        investor_name="Casbah Capital",
        covenants=covenants,
        legal_signatories=["Founding CEO", "Managing Partner - Casbah Capital"],
    )

    letter = engine.create_side_letter(startup_id, req)
    assert letter.id.startswith("sl_")
    assert letter.investor_name == "Casbah Capital"
    assert len(letter.covenants) == 3

    # Audit for statutory SPAS conflicts
    audit = engine.audit_statuts_conflicts(startup_id)
    assert audit.has_conflicts is False


def test_side_letter_statuts_conflict_detection():
    engine = SideLetterEngine()
    startup_id = "startup_sl_002"

    # Covenant with illegal inalienability lockup duration (15 years > 10 years statutory max under Art. 715 bis 61)
    illegal_covenants = [
        SideLetterCovenant(
            covenant_type=CovenantType.RESTRICTED_TRANSFERS,
            description="Founder inalienability lockup for 15 years.",
            specific_terms={"lockup_years": 15},
        )
    ]

    req = SideLetterCreateRequest(
        investor_id="inv_aggressive",
        investor_name="Aggressive Fund",
        covenants=illegal_covenants,
        legal_signatories=["CEO", "Partner"],
    )

    engine.create_side_letter(startup_id, req)
    audit = engine.audit_statuts_conflicts(startup_id)
    assert audit.has_conflicts is True
    assert audit.conflicts_count == 1
    assert "violates Law 22-09 Art. 715 bis 61" in audit.flagged_covenants[0]["conflicts"][0]


def test_side_letter_mfn_covenant_adoption():
    engine = SideLetterEngine()
    startup_id = "startup_sl_003"

    # Letter 1 has MFN clause
    req1 = SideLetterCreateRequest(
        investor_id="inv_first",
        investor_name="First Angel",
        covenants=[
            SideLetterCovenant(
                covenant_type=CovenantType.MOST_FAVORED_NATION,
                description="Automatic MFN election for any more favorable side letter terms.",
            )
        ],
        legal_signatories=["CEO", "First Angel"],
    )
    sl_first = engine.create_side_letter(startup_id, req1)

    # Letter 2 has Pro-Rata and Information Rights
    req2 = SideLetterCreateRequest(
        investor_id="inv_second",
        investor_name="Second Institutional VC",
        covenants=[
            SideLetterCovenant(
                covenant_type=CovenantType.PRO_RATA_RIGHTS,
                description="Super pro-rata participation rights in Series A.",
            ),
            SideLetterCovenant(
                covenant_type=CovenantType.INFORMATION_RIGHTS,
                description="Monthly detailed KPI reporting.",
            ),
        ],
        legal_signatories=["CEO", "Lead Partner"],
    )
    sl_second = engine.create_side_letter(startup_id, req2)

    # First angel elects to adopt Pro-Rata Rights from Letter 2
    elect_req = MfnElectionRequest(
        source_side_letter_id=sl_first.id,
        target_side_letter_id=sl_second.id,
        adopted_covenant_types=[CovenantType.PRO_RATA_RIGHTS],
    )

    res = engine.elect_mfn_covenants(startup_id, elect_req)
    assert res.updated_covenants_count == 2
    assert "PRO_RATA_RIGHTS" in res.new_terms_summary

    updated_first = engine.get_side_letter(startup_id, sl_first.id)
    assert any(c.covenant_type == CovenantType.PRO_RATA_RIGHTS for c in updated_first.covenants)


def test_cnrc_shareholder_filing_export():
    safe_engine = SafeConversionEngine()
    sl_engine = SideLetterEngine()
    startup_id = "startup_cnrc_001"

    # Run conversion
    instruments = [
        SafeInstrumentModel(
            id="safe_cnrc_1",
            investor_id="inv_diaspora",
            investor_name="Diaspora Angel",
            safe_type=SafeType.POST_MONEY_SAFE,
            principal_dzd=Decimal("5000000.00"),
            valuation_cap_dzd=Decimal("50000000.00"),
        )
    ]
    round_terms = PricedRoundTerms(
        pre_money_valuation_dzd=Decimal("50000000.00"),
        new_capital_invested_dzd=Decimal("10000000.00"),
        new_share_price_dzd=Decimal("5000.00"),
    )
    sim_res = safe_engine.simulate_conversion(
        SafeConversionSimulationRequest(
            startup_id=startup_id,
            existing_pre_round_shares=10000,
            instruments=instruments,
            round_terms=round_terms,
        )
    )

    # Export CNRC filing manifest
    filing = sl_engine.export_cnrc_filing_manifest(
        startup_id=startup_id,
        company_legal_name="TamWheel Technologies SPAS",
        rc_number="16/00-1234567B26",
        nif_number="002616010012345",
        nominal_value_dzd=Decimal("1000.00"),
        conversion_simulation=sim_res,
        founder_name="Meriem Al-Husseini",
        founder_nin="199816010012345678",
    )

    assert filing.commercial_register_num == "16/00-1234567B26"
    assert filing.capital_social_initial_dzd == Decimal("10000000.00")  # 10,000 * 1,000 DZD
    assert filing.augmentation_capital_dzd > Decimal("0")
    assert len(filing.shareholders_register) == 2
    assert "PROCES-VERBAL DE DÉPÔT" in filing.notarial_pv_extract_text
    assert len(filing.filing_hash_sha256) == 64


# =========================================================================
# 3. FastAPI HTTP Router Integration Tests
# =========================================================================

@pytest.mark.asyncio
async def test_router_safes_simulate_endpoint():
    transport = ASGITransport(app=app)
    csrf_token = "test_csrf_token_safes"

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.cookies.set("csrf_token", csrf_token)
        headers = {"x-csrf-token": csrf_token}

        payload = {
            "startup_id": "startup_api_safe_001",
            "existing_pre_round_shares": 10000,
            "instruments": [
                {
                    "id": "safe_api_1",
                    "investor_id": "inv_1",
                    "investor_name": "API Angel",
                    "safe_type": "PRE_MONEY_SAFE",
                    "principal_dzd": "5000000.00",
                    "valuation_cap_dzd": "50000000.00",
                    "discount_rate": "0.20",
                    "interest_rate_annual": "0.0",
                    "interest_type": "NONE",
                    "has_mfn_clause": False,
                }
            ],
            "scenario": "EQUITY_FINANCING",
            "round_terms": {
                "round_name": "Series Seed",
                "pre_money_valuation_dzd": "60000000.00",
                "new_capital_invested_dzd": "15000000.00",
                "new_share_price_dzd": "6000.00",
            },
        }

        res = await client.post("/api/v1/safes/simulate", json=payload, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["conservation_verified"] is True
        assert len(data["safe_conversions"]) == 1
        assert data["total_post_shares"] > 10000


@pytest.mark.asyncio
async def test_router_safes_calculate_interest_and_hamilton_hare():
    transport = ASGITransport(app=app)
    csrf_token = "test_csrf_token_calc"

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.cookies.set("csrf_token", csrf_token)
        headers = {"x-csrf-token": csrf_token}

        # 1. Interest calculation
        int_payload = {
            "principal_dzd": "10000000.00",
            "annual_interest_rate": "0.08",
            "interest_type": "SIMPLE",
            "issuance_date": "2025-01-01T00:00:00Z",
            "conversion_date": "2026-01-01T00:00:00Z",
        }
        res_int = await client.post("/api/v1/safes/calculate-interest", json=int_payload, headers=headers)
        assert res_int.status_code == 200
        int_data = res_int.json()
        assert float(int_data["accrued_interest_dzd"]) > 750000.0

        # 2. Hamilton-Hare integer allocation
        hh_payload = {
            "allocations": [
                ["safe_1", 10.45],
                ["safe_2", 20.35],
                ["safe_3", 30.20],
            ]
        }
        res_hh = await client.post("/api/v1/safes/hamilton-hare-allocation", json=hh_payload, headers=headers)
        assert res_hh.status_code == 200
        hh_data = res_hh.json()
        assert hh_data["total_integer_shares"] == 61


@pytest.mark.asyncio
async def test_router_side_letters_endpoints_and_cnrc_export():
    transport = ASGITransport(app=app)
    csrf_token = "test_csrf_token_sl"
    startup_id = "startup_api_sl_001"

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.cookies.set("csrf_token", csrf_token)
        headers = {"x-csrf-token": csrf_token}

        # 1. Create side letter
        sl_payload = {
            "investor_id": "inv_api_lead",
            "investor_name": "API Lead Fund",
            "covenants": [
                {
                    "covenant_type": "INFORMATION_RIGHTS",
                    "description": "Quarterly P&L within 45 days.",
                    "reporting_frequency_days": 45,
                },
                {
                    "covenant_type": "MOST_FAVORED_NATION",
                    "description": "Standard MFN entitlement.",
                },
            ],
            "legal_signatories": ["CEO", "Managing Director"],
        }
        res_create = await client.post(
            f"/api/v1/side-letters/startups/{startup_id}",
            json=sl_payload,
            headers=headers,
        )
        assert res_create.status_code == 201
        created_sl = res_create.json()
        sl_id = created_sl["id"]

        # 2. List and get side letters
        res_list = await client.get(f"/api/v1/side-letters/startups/{startup_id}")
        assert res_list.status_code == 200
        assert len(res_list.json()) >= 1

        res_get = await client.get(f"/api/v1/side-letters/startups/{startup_id}/{sl_id}")
        assert res_get.status_code == 200
        assert res_get.json()["id"] == sl_id

        # 3. Audit conflicts
        res_audit = await client.get(f"/api/v1/side-letters/startups/{startup_id}/audit/conflicts")
        assert res_audit.status_code == 200
        assert "has_conflicts" in res_audit.json()

        # 4. Export CNRC filing manifest
        cnrc_payload = {
            "company_legal_name": "TamWheel FinTech SPAS",
            "commercial_register_num": "16/00-9876543B26",
            "tax_id_num": "002616019999999",
            "nominal_value_dzd": "1000.00",
            "founder_name": "Karim Bouzid",
            "founder_nin": "199016010012345678",
            "conversion_simulation_request": {
                "startup_id": startup_id,
                "existing_pre_round_shares": 10000,
                "instruments": [
                    {
                        "id": "safe_cnrc",
                        "investor_id": "inv_1",
                        "investor_name": "Institutional Seed Fund",
                        "safe_type": "POST_MONEY_SAFE",
                        "principal_dzd": "10000000.00",
                        "valuation_cap_dzd": "50000000.00",
                    }
                ],
                "scenario": "EQUITY_FINANCING",
                "round_terms": {
                    "round_name": "Seed",
                    "pre_money_valuation_dzd": "50000000.00",
                    "new_capital_invested_dzd": "10000000.00",
                    "new_share_price_dzd": "5000.00",
                },
            },
        }

        res_cnrc = await client.post(
            f"/api/v1/side-letters/startups/{startup_id}/export-cnrc",
            json=cnrc_payload,
            headers=headers,
        )
        assert res_cnrc.status_code == 200
        cnrc_data = res_cnrc.json()
        assert cnrc_data["commercial_register_num"] == "16/00-9876543B26"
        assert len(cnrc_data["filing_hash_sha256"]) == 64
        assert "PROCES-VERBAL" in cnrc_data["notarial_pv_extract_text"]
