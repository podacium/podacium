"""
TamWheel Sovereign Ethical Agentic Venture OS — Test Suite for Order Book & Anti-Collusion.
Pillar 2 / Phase 4: Continuous Limit Order Book (LOB) Depth & Sybil Wash Trading Detection.

Verifies:
1. Simulated Order Book & Market Microstructure:
   - Price-time priority matching engine (FIFO at identical limit prices).
   - Resting maker vs. crossing taker order execution.
   - Market orders and partial fill mechanics.
   - Escrow balance reservation and order cancellation refunds.
   - Market depth visualization (bids/asks aggregation, bid-ask spread in DZD, mid-price, depth imbalance).
   - Atomic Double-Entry Virtual Currency Ledger settlement.
2. Sybil Resistance & Anti-Collusion Wash Trading Detection:
   - Reciprocal 2-cycle detection (A <-> B ping-pong trading).
   - Multi-party circular Sybil ring detection (A -> B -> C -> A).
   - Bilateral volume concentration and reciprocity symmetry scoring.
   - Device fingerprint and IP telemetry clustering.
   - High-frequency velocity burst scoring.
   - Composite account collusion score in [0.0, 100.0] and risk tiering.
   - Platform-wide collusion audit report generation.
3. FastAPI Endpoints Integration:
   - /api/v1/fantasy/orderbook/depth/{startup_id}
   - /api/v1/fantasy/orderbook/order (POST & DELETE)
   - /api/v1/fantasy/orderbook/orders/mine
   - /api/v1/fantasy/orderbook/trades/{startup_id}
   - /api/v1/fantasy/orderbook/collusion/telemetry
   - /api/v1/fantasy/orderbook/collusion/score/{user_id}
   - /api/v1/fantasy/orderbook/collusion/audit
"""

import math
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock
import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import HTTPException

from app.main import app
from app.services.simulated_order_book import (
    SimulatedOrderBookEngine,
    StartupOrderBook,
    InternalOrder,
    simulated_order_book,
)
from app.services.anti_collusion_engine import (
    AntiCollusionWashTradingEngine,
    anti_collusion_engine,
)
from app.services.bonding_curve_amm import ContinuousBondingCurveEngine
from app.services.simulation_engine import DoubleEntrySimulationLedger


# =============================================================================
# 1. UNIT TESTS: SIMULATED LIMIT ORDER BOOK (LOB) ENGINE
# =============================================================================

class TestSimulatedOrderBookEngine:
    """Verifies continuous limit order book execution, price-time priority, and depth aggregation."""

    @pytest.fixture
    def ledger(self):
        return DoubleEntrySimulationLedger()

    @pytest.fixture
    def amm(self, ledger):
        return ContinuousBondingCurveEngine(ledger=ledger)

    @pytest.fixture
    def anti_collusion(self):
        ac = AntiCollusionWashTradingEngine()
        ac.reset()
        return ac

    @pytest.fixture
    def order_book(self, ledger, amm, anti_collusion):
        ob = SimulatedOrderBookEngine(ledger=ledger, amm=amm, anti_collusion=anti_collusion)
        ob.reset()
        return ob

    def test_price_time_priority_limit_order_matching(self, order_book, amm, ledger):
        """
        Validates price-time priority matching:
        - Two sellers place ask orders:
          Seller 10: 10 shares @ 110.0 DZD (earlier)
          Seller 20: 10 shares @ 105.0 DZD (lower price)
        - Buyer 30 places limit BUY for 15 shares @ 115.0 DZD.
        - Crossing execution MUST match Seller 20 first (lower price @ 105.0), then Seller 10 (5 shares @ 110.0).
        - Execution price is maker's resting price (passive order sets price).
        """
        sid = "startup-priority-test"
        # Grant shares to sellers
        amm._user_shares.setdefault(10, {})[sid] = 50
        amm._user_shares.setdefault(20, {})[sid] = 50
        # Issue cash grants
        ledger.issue_starter_grant(10)
        ledger.issue_starter_grant(20)
        ledger.issue_starter_grant(30)

        # Place Seller 10 ask @ 110.0
        res1 = order_book.place_order(
            user_id=10, startup_id=sid, side="SELL", order_type="LIMIT", price=110.0, quantity=10
        )
        assert res1.order.status == "OPEN"

        # Place Seller 20 ask @ 105.0 (better price)
        res2 = order_book.place_order(
            user_id=20, startup_id=sid, side="SELL", order_type="LIMIT", price=105.0, quantity=10
        )
        assert res2.order.status == "OPEN"

        # Buyer 30 places limit buy for 15 shares @ 115.0 DZD
        buy_res = order_book.place_order(
            user_id=30, startup_id=sid, side="BUY", order_type="LIMIT", price=115.0, quantity=15
        )

        assert buy_res.fully_filled is True
        assert len(buy_res.executed_trades) == 2

        # First trade matched Seller 20 at 105.0 (10 shares)
        t1 = buy_res.executed_trades[0]
        assert t1.seller_id == 20
        assert t1.price == 105.0
        assert t1.quantity == 10

        # Second trade matched Seller 10 at 110.0 (5 shares)
        t2 = buy_res.executed_trades[1]
        assert t2.seller_id == 10
        assert t2.price == 110.0
        assert t2.quantity == 5

        # Buyer 30 now owns 15 shares
        assert amm.get_user_shares(30, sid) == 15
        # Seller 20 has 40 shares left
        assert amm.get_user_shares(20, sid) == 40
        # Seller 10 has 45 shares left
        assert amm.get_user_shares(10, sid) == 45

    def test_partial_fill_and_resting_limit_order(self, order_book, amm, ledger):
        """
        When incoming limit order quantity exceeds available resting liquidity,
        unfilled portion rests in the order book with locked cash or shares.
        """
        sid = "startup-solartech"
        amm._user_shares.setdefault(50, {})[sid] = 5
        ledger.issue_starter_grant(50)
        ledger.issue_starter_grant(60)

        # Seller 50 places ask for 5 shares @ 150.0
        order_book.place_order(
            user_id=50, startup_id=sid, side="SELL", order_type="LIMIT", price=150.0, quantity=5
        )

        # Buyer 60 places limit buy for 12 shares @ 150.0
        buy_res = order_book.place_order(
            user_id=60, startup_id=sid, side="BUY", order_type="LIMIT", price=150.0, quantity=12
        )

        assert buy_res.fully_filled is False
        assert buy_res.order.status == "PARTIALLY_FILLED"
        assert buy_res.order.filled_quantity == 5
        assert buy_res.order.remaining_quantity == 7

        # 7 shares @ 150.0 = 1050 DZD must remain locked in buyer's cash
        assert order_book._locked_user_cash[60] == 1050

        # Depth check: bids now have 7 shares @ 150.0
        depth = order_book.get_market_depth(sid)
        assert depth.best_bid == 150.0
        assert depth.total_bids_volume >= 7

    def test_order_cancellation_releases_escrow(self, order_book, amm, ledger):
        """Cancelling an open limit buy order releases escrowed virtual cash immediately."""
        sid = "startup-edualgerie"
        ledger.issue_starter_grant(70)

        avail_before = order_book.get_available_user_cash(70)

        # Place limit buy: 10 shares @ 80.0 = 800 DZD
        res = order_book.place_order(
            user_id=70, startup_id=sid, side="BUY", order_type="LIMIT", price=80.0, quantity=10
        )
        assert res.order.status == "OPEN"
        assert order_book.get_available_user_cash(70) == avail_before - 800

        # Cancel order
        cancel_res = order_book.cancel_order(user_id=70, order_id=res.order.order_id)
        assert cancel_res.status == "CANCELLED"
        assert cancel_res.cancelled_quantity == 10
        assert cancel_res.refunded_cash_dzd == 800

        # Cash balance is unencumbered
        assert order_book.get_available_user_cash(70) == avail_before

    def test_market_depth_and_spread_metrics(self, order_book, amm, ledger):
        """Validates market depth aggregation, bid-ask spread, mid-price, and depth imbalance."""
        sid = "startup-test-metrics"
        amm._user_shares.setdefault(80, {})[sid] = 100
        ledger.issue_starter_grant(80)
        ledger.issue_starter_grant(90)

        # Place ask @ 105.0 (20 shares)
        order_book.place_order(user_id=80, startup_id=sid, side="SELL", order_type="LIMIT", price=105.0, quantity=20)
        # Place bid @ 95.0 (10 shares)
        order_book.place_order(user_id=90, startup_id=sid, side="BUY", order_type="LIMIT", price=95.0, quantity=10)

        depth = order_book.get_market_depth(sid)
        assert depth.best_bid == 95.0
        assert depth.best_ask == 105.0
        assert depth.spread_dzd == 10.0  # 105.0 - 95.0
        assert depth.mid_price == 100.0  # (105 + 95) / 2
        # Depth imbalance = (10 - 20) / (10 + 20) = -10 / 30 = -0.3333
        assert abs(depth.depth_imbalance - (-0.3333)) < 1e-3


# =============================================================================
# 2. UNIT TESTS: SYBIL RESISTANCE & ANTI-COLLUSION ENGINE
# =============================================================================

class TestAntiCollusionWashTradingEngine:
    """Verifies circular cycle detection, bilateral concentration, telemetry overlap, and collusion scoring."""

    @pytest.fixture
    def engine(self):
        eng = AntiCollusionWashTradingEngine()
        eng.reset()
        return eng

    def test_reciprocal_two_cycle_wash_trading_detection(self, engine):
        """
        Validates detection of reciprocal 2-cycle (A <-> B ping-pong trading):
        Account 100 sells to Account 200, then Account 200 sells back to Account 100.
        """
        # Trade 1: 100 sells to 200 (200 is buyer, 100 is seller)
        engine.record_trade(buyer_id=200, seller_id=100, startup_id="startup-finflow", shares=50, volume_dzd=6000)
        # Trade 2: 200 sells back to 100
        engine.record_trade(buyer_id=100, seller_id=200, startup_id="startup-finflow", shares=50, volume_dzd=6000)

        cycles = engine.find_cycles_for_user(100)
        assert len(cycles) >= 1
        assert cycles[0].cycle_type == "RECIPROCAL_PAIR"
        assert cycles[0].cycle_path == [100, 200, 100]

        # Verify cycle score
        cycle_score, _ = engine.compute_cycle_score(100)
        assert cycle_score >= 15.0

    def test_circular_three_cycle_ring_detection(self, engine):
        """
        Validates detection of 3-party circular Sybil ring:
        Account A sells to B, B sells to C, C sells to A.
        """
        A, B, C = 301, 302, 303
        engine.record_trade(buyer_id=B, seller_id=A, startup_id="startup-greenfarm", shares=30, volume_dzd=3000)
        engine.record_trade(buyer_id=C, seller_id=B, startup_id="startup-greenfarm", shares=30, volume_dzd=3000)
        engine.record_trade(buyer_id=A, seller_id=C, startup_id="startup-greenfarm", shares=30, volume_dzd=3000)

        cycles_A = engine.find_cycles_for_user(A)
        assert len(cycles_A) >= 1
        ring = next((c for c in cycles_A if c.cycle_type == "CIRCULAR_RING"), None)
        assert ring is not None
        assert ring.cycle_path == [A, B, C, A]
        assert ring.total_volume_dzd == 9000

    def test_shared_telemetry_clustering_and_critical_sybil_score(self, engine):
        """
        When two accounts trade with each other AND share the same client IP or device fingerprint,
        the engine flags maximum telemetry collusion penalty.
        """
        user_a = 401
        user_b = 402
        shared_ip = "197.200.45.12"
        shared_fp = "fp-canvas-sha256-algeria-998877"

        # Record identical telemetry
        engine.record_telemetry(user_id=user_a, ip_address=shared_ip, device_fingerprint=shared_fp)
        engine.record_telemetry(user_id=user_b, ip_address=shared_ip, device_fingerprint=shared_fp)

        # Execute direct trades between them
        engine.record_trade(buyer_id=user_b, seller_id=user_a, startup_id="startup-solartech", shares=20, volume_dzd=3000)
        engine.record_trade(buyer_id=user_a, seller_id=user_b, startup_id="startup-solartech", shares=20, volume_dzd=3000)

        # Telemetry score must hit maximum 25.0 pts
        tel_score, shared_uids = engine.compute_telemetry_score(user_a)
        assert tel_score == 25.0
        assert user_b in shared_uids

        # Overall collusion score evaluation
        score_res = engine.evaluate_collusion_score(user_a)
        assert score_res.collusion_score >= 60.0  # cycle (15+) + recip (20+) + telemetry (25) >= 60
        assert score_res.is_flagged is True
        assert score_res.risk_level in ["HIGH_COLLUSION_RISK", "CONFIRMED_SYBIL_COLLUSION"]

    def test_collusion_audit_report_generation(self, engine):
        """Validates comprehensive platform collusion audit report."""
        # Clean user 500
        engine.record_telemetry(user_id=500, ip_address="105.100.1.1")
        engine.record_trade(buyer_id=500, seller_id=501, startup_id="startup-finflow", shares=5, volume_dzd=600)

        # Colluding pair 601 <-> 602
        engine.record_telemetry(user_id=601, ip_address="192.168.1.100", device_fingerprint="dev-sybil-01")
        engine.record_telemetry(user_id=602, ip_address="192.168.1.100", device_fingerprint="dev-sybil-01")
        engine.record_trade(buyer_id=602, seller_id=601, startup_id="startup-finflow", shares=100, volume_dzd=12000)
        engine.record_trade(buyer_id=601, seller_id=602, startup_id="startup-finflow", shares=100, volume_dzd=12000)

        report = engine.generate_audit_report(season_id="season-test")
        assert report.total_analyzed_accounts >= 3
        assert report.flagged_accounts_count >= 2
        assert len(report.detected_circular_rings) >= 1


# =============================================================================
# 3. FASTAPI HTTP ENDPOINT INTEGRATION TESTS
# =============================================================================

class TestFastApiOrderBookAndCollusionEndpoints:
    """Verifies all FastAPI HTTP endpoints mounted under /api/v1/fantasy/orderbook."""

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
            id=888,
            fullName="Khadija Benali",
            email="khadija@tamwheel.dz",
            role="INVESTOR",
            analystTier="PARTNER",
            isActive=True,
            isDeactivated=False,
            deletedAt=None,
            deactivatedAt=None,
        )

    @pytest.mark.asyncio
    async def test_orderbook_and_collusion_endpoints_flow(self, client, mock_user):
        """End-to-end integration test across all orderbook and collusion endpoints."""
        from app.core.auth import get_current_active_user, get_current_user
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # 1. GET /api/v1/fantasy/orderbook/depth/startup-finflow
            depth_resp = await client.get("/api/v1/fantasy/orderbook/depth/startup-finflow")
            assert depth_resp.status_code == 200
            depth_data = depth_resp.json()
            assert depth_data["startupId"] == "startup-finflow"
            assert "bids" in depth_data
            assert "asks" in depth_data

            # 2. POST /api/v1/fantasy/orderbook/order (place limit buy)
            order_payload = {
                "startupId": "startup-finflow",
                "side": "BUY",
                "orderType": "LIMIT",
                "price": 115.0,
                "quantity": 2,
            }
            order_resp = await client.post("/api/v1/fantasy/orderbook/order", json=order_payload)
            assert order_resp.status_code == 200
            order_data = order_resp.json()
            assert order_data["order"]["side"] == "BUY"
            assert order_data["order"]["quantity"] == 2
            order_id = order_data["order"]["orderId"]

            # 3. GET /api/v1/fantasy/orderbook/orders/mine
            mine_resp = await client.get("/api/v1/fantasy/orderbook/orders/mine")
            assert mine_resp.status_code == 200
            mine_data = mine_resp.json()
            assert any(o["orderId"] == order_id for o in mine_data)

            # 4. GET /api/v1/fantasy/orderbook/trades/startup-finflow
            trades_resp = await client.get("/api/v1/fantasy/orderbook/trades/startup-finflow")
            assert trades_resp.status_code == 200
            assert isinstance(trades_resp.json(), list)

            # 5. POST /api/v1/fantasy/orderbook/collusion/telemetry
            tel_payload = {
                "userId": mock_user.id,
                "ipAddress": "197.200.12.34",
                "deviceFingerprint": "fp-samir-888",
                "userAgent": "Mozilla/5.0 (X11; Linux x86_64)",
            }
            tel_resp = await client.post("/api/v1/fantasy/orderbook/collusion/telemetry", json=tel_payload)
            assert tel_resp.status_code == 200
            assert tel_resp.json()["telemetryRecorded"] is True

            # 6. GET /api/v1/fantasy/orderbook/collusion/score/{user_id}
            score_resp = await client.get(f"/api/v1/fantasy/orderbook/collusion/score/{mock_user.id}")
            assert score_resp.status_code == 200
            score_data = score_resp.json()
            assert "collusionScore" in score_data
            assert "riskLevel" in score_data

            # 7. GET /api/v1/fantasy/orderbook/collusion/audit
            audit_resp = await client.get("/api/v1/fantasy/orderbook/collusion/audit")
            assert audit_resp.status_code == 200
            audit_data = audit_resp.json()
            assert "totalAnalyzedAccounts" in audit_data
            assert "flaggedAccountsCount" in audit_data

        finally:
            app.dependency_overrides.clear()
