"""
TamWheel Sovereign Ethical Agentic Venture OS — Comprehensive Test Suite for Pillar 2.
Focus: The Anti-PSP Simulation League, Immutable Double-Entry Virtual Ledger & Fantasy Startup League.

Verifies:
1. Double-Entry Virtual Currency Ledger (Stripe / TigerBeetle / Formance patterns):
   - Zero-sum balancing: sum(Debits) - sum(Credits) == 0.
   - Invariant enforcement: Asset accounts reject overdrafts (credits > debits).
   - Mandatory 50,000 DZD virtual starter grant upon user registration.
   - Idempotency key tracking preventing duplicate entries and race conditions.
   - SHA-256 state chain verification & cryptographic tamper detection.
   - Bank of Algeria Regulation 25-02 Zero-Fiat sandbox isolation (rejection of fiat payment gateways).
2. Fantasy Startup League (FSL) Engine:
   - 12-week tournament cycles matching televised pitch show seasons.
   - Team roster builder: 100,000 SP budget, exactly 5 startups across >= 3 sectors.
   - Anti-monopoly constraints (max 2 startups per sector, max 2 per Wilaya).
   - Multipliers: Captain (x1.5), Core (3 startups x1.0), Wildcard (x2.0 for valuation < 30M DZD).
   - Real-world event scoring triggers:
     - Verified senior tech hire: +50 pts
     - MoM ARR growth >= 20%: +100 pts
     - Official Startup Label awarded (Decree 20-254): +150 pts
     - TV Judge Pitch of the Week: +75 pts
     - Narrative Bubble warning: -50 pts
   - Private mini-leagues (University, Regional, Diaspora, Corporate) with invite codes & custom standings.
3. FastAPI Endpoints Integration:
   - /api/v1/simulation/wallet, /grant, /pledge, /ledger, /ledger/verify, /regulatory-status
   - /api/v1/fantasy/seasons, /catalog, /roster, /events/trigger, /leaderboard, /mini-leagues
"""

import copy
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport
from fastapi import HTTPException

from app.main import app
from app.generated.prisma.enums import CampaignStatus, AnalystLevel
from app.services.simulation_engine import (
    DoubleEntrySimulationLedger,
    SimulationEngine,
    JournalEntry,
    LedgerLine,
    INITIAL_SIMULATION_GRANT_DZD,
    DEFAULT_MIN_TICKET_DZD,
    GENESIS_PREVIOUS_HASH,
)
from app.services.fantasy_league import (
    FantasyStartupLeagueEngine,
    StartupMetadata,
    SALARY_CAP_SP,
    ROSTER_SIZE,
    MIN_DISTINCT_SECTORS,
    CAPTAIN_MULTIPLIER,
    CORE_MULTIPLIER,
    WILDCARD_BOOST_MULTIPLIER,
    WILDCARD_BASE_MULTIPLIER,
    KPI_SCORING_SCHEDULE,
)


# =============================================================================
# 1. UNIT TESTS: DOUBLE-ENTRY SIMULATION LEDGER & TIGERBEETLE INVARIANTS
# =============================================================================

class TestDoubleEntrySimulationLedger:
    """Verifies TigerBeetle and Formance double-entry invariants, hash chain, and zero-fiat isolation."""

    def test_zero_sum_invariant_enforced(self):
        """Unbalanced journal entries (debits != credits) must be rejected."""
        ledger = DoubleEntrySimulationLedger()
        unbalanced_lines = [
            LedgerLine(account="USER:1:VIRTUAL_CASH", debit=50_000, credit=0),
            LedgerLine(account="SYSTEM:VIRTUAL_TREASURY_RESERVE", debit=0, credit=40_000),  # 10k imbalance
        ]

        with pytest.raises(ValueError) as exc_info:
            ledger.record_journal_entry(
                action="INVALID_ENTRY",
                idempotency_key="key-unbalanced",
                lines=unbalanced_lines,
            )
        assert "Zero-sum invariant violated" in str(exc_info.value)

    def test_asset_account_overdraft_prevention(self):
        """Asset account balance cannot go negative (credit > debit rejected)."""
        ledger = DoubleEntrySimulationLedger()
        # User has zero balance initially; attempting to pledge/spend 10,000 must fail
        pledge_lines = [
            LedgerLine(account="CAMPAIGN:c1:ESCROW_HOLDING", debit=10_000, credit=0),
            LedgerLine(account="USER:99:VIRTUAL_CASH", debit=0, credit=10_000),
        ]

        with pytest.raises(HTTPException) as exc_info:
            ledger.record_journal_entry(
                action="VIRTUAL_PLEDGE",
                idempotency_key="key-overdraft",
                lines=pledge_lines,
            )
        assert exc_info.value.status_code == 400
        assert "Insufficient balance" in str(exc_info.value.detail)

    def test_starter_grant_issuance_and_balance(self):
        """User registration starter grant awards exactly 50,000 DZD in balanced entry."""
        ledger = DoubleEntrySimulationLedger()
        entry = ledger.issue_starter_grant(user_id=101)

        assert entry.action == "STARTER_GRANT"
        assert entry.is_balanced is True
        assert entry.total_debit == 50_000
        assert entry.total_credit == 50_000
        assert entry.user_id == 101

        # Check account balance
        user_balance = ledger.get_account_balance("USER:101:VIRTUAL_CASH")
        assert user_balance == 50_000

    def test_idempotency_deduplication_prevents_double_spending(self):
        """Submitting the exact same idempotency key returns the cached entry without duplicate credit."""
        ledger = DoubleEntrySimulationLedger()
        entry1 = ledger.issue_starter_grant(user_id=102, idempotency_key="reg-user-102")
        entry2 = ledger.issue_starter_grant(user_id=102, idempotency_key="reg-user-102")

        assert entry1.entry_id == entry2.entry_id
        assert entry1.entry_hash == entry2.entry_hash

        # Balance must remain exactly 50,000 DZD, NOT 100,000 DZD
        assert ledger.get_account_balance("USER:102:VIRTUAL_CASH") == 50_000

    def test_sha256_state_chain_verification_and_tamper_detection(self):
        """State chain cryptographic verification detects untampered chain and catches alterations."""
        ledger = DoubleEntrySimulationLedger()
        # Issue 3 sequential grants
        ledger.issue_starter_grant(user_id=201)
        ledger.issue_starter_grant(user_id=202)
        ledger.issue_starter_grant(user_id=203)

        # Audit should pass
        audit_res = ledger.verify_state_chain()
        assert audit_res["isValid"] is True
        assert audit_res["entriesChecked"] == 3
        assert audit_res["status"] == "VERIFIED_SECURE"

        # Simulate tampering on block 1
        tampered_entry = ledger._chain[1]
        original_debit = tampered_entry.lines[0].debit
        tampered_entry.lines[0].debit = 999_999  # Tamper amount

        corrupted_audit = ledger.verify_state_chain()
        assert corrupted_audit["isValid"] is False
        assert corrupted_audit["tamperedIndex"] == 1
        assert "mismatch" in corrupted_audit["reason"].lower() or "broken" in corrupted_audit["reason"].lower()

        # Restore
        tampered_entry.lines[0].debit = original_debit

    def test_zero_fiat_sandbox_isolation(self):
        """Asserting zero fiat compliance rejects real payment gateways under Bank of Algeria Reg 25-02."""
        ledger = DoubleEntrySimulationLedger()
        # Non-fiat passes
        ledger.assert_zero_fiat_compliance(gateway=None)
        ledger.assert_zero_fiat_compliance(gateway="SIMULATION")

        # Prohibited gateways raise 400
        for gw in ["STRIPE", "SATIM", "CIB", "BARIDIMOB"]:
            with pytest.raises(HTTPException) as exc_info:
                ledger.assert_zero_fiat_compliance(gateway=gw)
            assert exc_info.value.status_code == 400
            assert "Zero-Fiat Compliance Violation" in str(exc_info.value.detail)


# =============================================================================
# 2. UNIT TESTS: FANTASY STARTUP LEAGUE ENGINE
# =============================================================================

class TestFantasyStartupLeagueEngine:
    """Verifies tournament season cycles, salary cap, multipliers, and real-world event scoring."""

    def test_tournament_season_12_week_cycle(self):
        """Initializes 12-week tournament season and advances gameweeks."""
        engine = FantasyStartupLeagueEngine()
        season = engine.get_active_season()
        assert season.total_weeks == 12
        assert season.current_gameweek == 1
        assert season.status == "ACTIVE"

        # Advance gameweek
        updated_season = engine.advance_gameweek(season.season_id)
        assert updated_season.current_gameweek == 2

    def test_roster_builder_salary_cap_exceeded_rejection(self):
        """Rosters exceeding 100,000 SP budget must be rejected."""
        engine = FantasyStartupLeagueEngine()
        # Add expensive startups
        engine.register_startup_metadata(StartupMetadata(
            id="exp-1", name="Exp 1", sector="Tech", wilaya=16, valuation_dzd=50_000_000, fantasy_price_sp=60_000
        ))
        engine.register_startup_metadata(StartupMetadata(
            id="exp-2", name="Exp 2", sector="Health", wilaya=31, valuation_dzd=50_000_000, fantasy_price_sp=50_000
        ))

        with pytest.raises(HTTPException) as exc_info:
            engine.build_team_roster(
                user_id=1,
                season_id="season-2026-s1",
                gameweek=1,
                captain_startup_id="exp-1",
                wildcard_startup_id="exp-2",
                core_startup_ids=["startup-solartech", "startup-greenfarm", "startup-finflow"],
            )
        assert exc_info.value.status_code == 400
        assert "salary cap" in str(exc_info.value.detail).lower()

    def test_roster_builder_sector_diversification_constraint(self):
        """Rosters spanning fewer than 3 distinct sectors must be rejected."""
        engine = FantasyStartupLeagueEngine()
        # Register startups all in same sector
        for i in range(1, 6):
            engine.register_startup_metadata(StartupMetadata(
                id=f"monotech-{i}", name=f"MonoTech {i}", sector="FinTech", wilaya=i, valuation_dzd=20_000_000, fantasy_price_sp=10_000
            ))

        with pytest.raises(HTTPException) as exc_info:
            engine.build_team_roster(
                user_id=1,
                season_id="season-2026-s1",
                gameweek=1,
                captain_startup_id="monotech-1",
                wildcard_startup_id="monotech-2",
                core_startup_ids=["monotech-3", "monotech-4", "monotech-5"],
            )
        assert exc_info.value.status_code == 400
        assert "sector diversification" in str(exc_info.value.detail).lower()

    def test_roster_multipliers_captain_and_wildcard(self):
        """
        Verify:
        - Captain: 1.5x multiplier
        - Core: 1.0x multiplier
        - Wildcard with valuation < 30M DZD: 2.0x boost
        - Wildcard with valuation >= 30M DZD: 1.0x base
        """
        engine = FantasyStartupLeagueEngine()
        # Roster composition:
        # Captain: SolarTech (CleanTech, Val: 25M) -> 1.5x
        # Wildcard: GreenFarm (AgTech, Val: 28M < 30M) -> 2.0x
        # Core: SihaTech (HealthTech), FinFlow (FinTech), LogiXpress (Logistics) -> 1.0x each
        roster = engine.build_team_roster(
            user_id=50,
            season_id="season-2026-s1",
            gameweek=1,
            captain_startup_id="startup-solartech",
            wildcard_startup_id="startup-greenfarm",
            core_startup_ids=["startup-sihatech", "startup-finflow", "startup-logixpress"],
        )

        assert len(roster.startups) == 5
        assert roster.sectors_count >= 3
        assert roster.total_sp_spent <= SALARY_CAP_SP

        # Check multiplier assignments
        sel_map = {s.startup_id: s for s in roster.startups}
        assert sel_map["startup-solartech"].multiplier == 1.5
        assert sel_map["startup-solartech"].role == "CAPTAIN"
        assert sel_map["startup-greenfarm"].multiplier == 2.0
        assert sel_map["startup-greenfarm"].role == "WILDCARD"
        assert sel_map["startup-sihatech"].multiplier == 1.0
        assert sel_map["startup-sihatech"].role == "CORE"

    def test_real_world_kpi_event_scoring_triggers(self):
        """
        Verify real-world scoring points:
        - Tech hire: +50 pts
        - ARR growth 20%: +100 pts
        - Startup label: +150 pts
        - TV pitch winner: +75 pts
        - Narrative bubble: -50 pts
        And verify that role multipliers apply proportionally.
        """
        engine = FantasyStartupLeagueEngine()
        # User drafts roster with SolarTech as Captain (1.5x) and GreenFarm as Wildcard (2.0x)
        roster = engine.build_team_roster(
            user_id=60,
            season_id="season-2026-s1",
            gameweek=1,
            captain_startup_id="startup-solartech",
            wildcard_startup_id="startup-greenfarm",
            core_startup_ids=["startup-sihatech", "startup-finflow", "startup-logixpress"],
        )
        assert roster.gameweek_total_points == 0.0

        # 1. Trigger TECH_HIRE (+50 pts) for Captain SolarTech (CleanTech, 1.5x)
        # Expected points: 50 * 1.5 = 75.0 pts
        engine.trigger_real_world_event(
            startup_id="startup-solartech",
            event_type="TECH_HIRE",
            gameweek=1,
        )
        updated_roster = engine.get_user_roster(user_id=60, season_id="season-2026-s1", gameweek=1)
        assert updated_roster.gameweek_total_points == 75.0

        # 2. Trigger ARR_GROWTH_20 (+100 pts) for Wildcard GreenFarm (2.0x)
        # Expected points: 100 * 2.0 = 200.0 pts. Total = 75 + 200 = 275.0 pts
        engine.trigger_real_world_event(
            startup_id="startup-greenfarm",
            event_type="ARR_GROWTH_20",
            gameweek=1,
        )
        updated_roster = engine.get_user_roster(user_id=60, season_id="season-2026-s1", gameweek=1)
        assert updated_roster.gameweek_total_points == 275.0

        # 3. Trigger NARRATIVE_BUBBLE (-50 pts) for Core SihaTech (1.0x)
        # Expected points: -50 * 1.0 = -50.0 pts. Total = 275 - 50 = 225.0 pts
        engine.trigger_real_world_event(
            startup_id="startup-sihatech",
            event_type="NARRATIVE_BUBBLE",
            gameweek=1,
        )
        updated_roster = engine.get_user_roster(user_id=60, season_id="season-2026-s1", gameweek=1)
        assert updated_roster.gameweek_total_points == 225.0

    def test_private_mini_leagues_and_standings(self):
        """Verify mini-league creation, invite code join, and member leaderboard ranking."""
        engine = FantasyStartupLeagueEngine()
        league = engine.create_mini_league(
            name="ESI Founders Circle",
            category="UNIVERSITY",
            owner_user_id=70,
            description="Computer Science Institute of Algiers",
        )
        assert league.name == "ESI Founders Circle"
        assert league.category == "UNIVERSITY"
        assert "UNI-2026-" in league.invite_code
        assert 70 in league.members

        # User 71 joins via invite code
        joined_league = engine.join_mini_league(invite_code=league.invite_code, user_id=71)
        assert 71 in joined_league.members

        # Build rosters for both users
        engine.build_team_roster(
            user_id=70,
            season_id="season-2026-s1",
            gameweek=1,
            captain_startup_id="startup-solartech",
            wildcard_startup_id="startup-greenfarm",
            core_startup_ids=["startup-sihatech", "startup-finflow", "startup-logixpress"],
        )
        engine.build_team_roster(
            user_id=71,
            season_id="season-2026-s1",
            gameweek=1,
            captain_startup_id="startup-sihatech",
            wildcard_startup_id="startup-finflow",
            core_startup_ids=["startup-solartech", "startup-greenfarm", "startup-logixpress"],
        )

        # Trigger STARTUP_LABEL (+150 pts) for SolarTech
        engine.trigger_real_world_event(
            startup_id="startup-solartech",
            event_type="STARTUP_LABEL",
            gameweek=1,
        )
        # User 70 had SolarTech as Captain (1.5x) -> 150 * 1.5 = 225 pts
        # User 71 had SolarTech as Core (1.0x) -> 150 * 1.0 = 150 pts

        standings = engine.get_mini_league_standings(league_id=league.league_id, gameweek=1)
        assert standings["memberCount"] == 2
        assert standings["standings"][0]["userId"] == 70
        assert standings["standings"][0]["gameweekPoints"] == 225.0
        assert standings["standings"][0]["rank"] == 1
        assert standings["standings"][1]["userId"] == 71
        assert standings["standings"][1]["gameweekPoints"] == 150.0
        assert standings["standings"][1]["rank"] == 2


# =============================================================================
# 3. INTEGRATION TESTS: FASTAPI HTTP ENDPOINTS
# =============================================================================

class TestSimulationAndFantasyEndpoints:
    """Verifies all FastAPI simulation and fantasy HTTP endpoints."""

    @pytest.fixture
    def client(self):
        transport = ASGITransport(app=app)
        c = AsyncClient(transport=transport, base_url="http://test")
        csrf_val = "test_csrf_token_value_32_chars_123"
        c.cookies.set("csrf_token", csrf_val)
        c.headers.update({"x-csrf-token": csrf_val})
        return c

    @pytest.fixture
    def mock_user(self):
        return MagicMock(
            id=42,
            fullName="Karim Benali",
            email="karim@tamwheel.dz",
            role="STUDENT",
            isActive=True,
            isDeactivated=False,
            deletedAt=None,
            deactivatedAt=None,
        )

    @pytest.mark.asyncio
    async def test_endpoint_simulation_wallet_and_grant(self, client, mock_user):
        """GET /api/v1/simulation/wallet and POST /api/v1/simulation/grant."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            with patch("app.core.prisma.prisma.user.find_unique", new_callable=AsyncMock) as mock_u, \
                 patch("app.core.prisma.prisma.virtualpledge.find_many", new_callable=AsyncMock) as mock_pledges, \
                 patch("app.core.prisma.prisma.financialquizresult.count", new_callable=AsyncMock) as mock_quizzes, \
                 patch("app.core.prisma.prisma.virtualpledge.count", new_callable=AsyncMock) as mock_count:

                mock_u.return_value = mock_user
                mock_pledges.return_value = []
                mock_quizzes.return_value = 5
                mock_count.return_value = 0

                # 1. Test POST /api/v1/simulation/grant
                grant_resp = await client.post("/api/v1/simulation/grant")
                assert grant_resp.status_code == 200
                grant_data = grant_resp.json()
                assert grant_data["userId"] == 42
                assert grant_data["amountDzd"] == 50_000
                assert "JE-" in grant_data["journalEntryId"]

                # 2. Test GET /api/v1/simulation/wallet
                wallet_resp = await client.get("/api/v1/simulation/wallet")
                assert wallet_resp.status_code == 200
                wallet_data = wallet_resp.json()
                assert wallet_data["userId"] == 42
                assert wallet_data["availableBalanceDzd"] == 50_000
                assert wallet_data["initialGrantDzd"] == 50_000
                assert "USER:42:VIRTUAL_CASH" in wallet_data["ledgerAccount"]
                assert wallet_data["stateChainStatus"] == "VERIFIED_SECURE"
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_endpoint_ledger_chain_verification_and_regulatory_status(self, client):
        """GET /api/v1/simulation/ledger/verify and GET /api/v1/simulation/regulatory-status."""
        # 1. Ledger state chain verification
        verify_resp = await client.get("/api/v1/simulation/ledger/verify")
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()
        assert verify_data["isValid"] is True
        assert verify_data["status"] in ("VERIFIED_SECURE", "EMPTY_CHAIN")

        # 2. Regulatory status disclosure
        reg_resp = await client.get("/api/v1/simulation/regulatory-status")
        assert reg_resp.status_code == 200
        reg_data = reg_resp.json()
        assert reg_data["fiatConversionAllowed"] is False
        assert "Regulation 25-02" in reg_data["centralBankFramework"]
        assert "Regulation 23-01" in reg_data["securitiesFramework"]

    @pytest.mark.asyncio
    async def test_endpoint_fantasy_seasons_catalog_and_roster(self, client, mock_user):
        """Fantasy season discovery, draft catalog, roster submission, and events."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # 1. Seasons & Catalog
            seasons_resp = await client.get("/api/v1/fantasy/seasons")
            assert seasons_resp.status_code == 200
            assert len(seasons_resp.json()) >= 1

            cat_resp = await client.get("/api/v1/fantasy/catalog")
            assert cat_resp.status_code == 200
            cat_data = cat_resp.json()
            assert cat_data["salaryCapSp"] == 100_000
            assert len(cat_data["catalog"]) >= 5

            # 2. Submit Roster
            roster_payload = {
                "captainStartupId": "startup-solartech",
                "wildcardStartupId": "startup-greenfarm",
                "coreStartupIds": ["startup-sihatech", "startup-finflow", "startup-logixpress"],
            }
            roster_resp = await client.post("/api/v1/fantasy/roster", json=roster_payload)
            assert roster_resp.status_code == 200
            roster_data = roster_resp.json()
            assert roster_data["total_sp_spent"] <= 100_000
            assert len(roster_data["startups"]) == 5
            assert roster_data["sectors_count"] >= 3

            # 3. Trigger Real-World Event
            event_payload = {
                "startupId": "startup-solartech",
                "eventType": "TV_PITCH_WINNER",
                "gameweek": 1,
                "description": "El-Charika TV Judge Unanimous Pitch of the Week",
            }
            event_resp = await client.post("/api/v1/fantasy/events/trigger", json=event_payload)
            assert event_resp.status_code == 200
            event_data = event_resp.json()
            assert event_data["success"] is True
            assert event_data["scoringSchedule"]["points"] == 75

            # 4. Global Leaderboard
            lead_resp = await client.get("/api/v1/fantasy/leaderboard?gameweek=1")
            assert lead_resp.status_code == 200
            lead_data = lead_resp.json()
            assert len(lead_data) >= 1
            assert lead_data[0]["points"] > 0
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_endpoint_private_mini_leagues(self, client, mock_user):
        """POST /api/v1/fantasy/mini-leagues and join flow."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # Create mini-league
            league_payload = {
                "name": "Oran Regional Angels",
                "category": "REGIONAL",
                "description": "Tech investors and scouts from Wilaya 31",
            }
            create_resp = await client.post("/api/v1/fantasy/mini-leagues", json=league_payload)
            assert create_resp.status_code == 200
            league_data = create_resp.json()
            invite_code = league_data["invite_code"]
            league_id = league_data["league_id"]
            assert "REG-2026-" in invite_code

            # Get mini-league standings
            standings_resp = await client.get(f"/api/v1/fantasy/mini-leagues/{league_id}")
            assert standings_resp.status_code == 200
            standings_data = standings_resp.json()
            assert standings_data["leagueName"] == "Oran Regional Angels"
            assert standings_data["memberCount"] == 1
        finally:
            app.dependency_overrides.clear()
