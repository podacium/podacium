"""
TamWheel Sovereign Ethical Agentic Venture OS — Continuous Token Bonding Curve AMM Engine.
Pillar 2 / Phase 4: Automated Algorithmic Continuous Pricing for Fantasy Startup Shares.

Architectural Foundations:
1. Continuous Token Bonding Curves:
   - Polynomial Power Curve: P(S) = P_0 + m * S^k
   - Sigmoid Curve: P(S) = L / (1 + e^(-k * (S - S_0)))
   - Continuous Calculus Integration for exact purchase cost and burn refund.
2. Market Microstructure & Execution Safety:
   - Dynamic Slippage Protection: rejects orders exceeding client tolerance.
   - Anti-Front-Running Delay Protection: blocks rapid sandwich/MEV round-trips within cooldown windows.
3. Zero-Sum Virtual Liquidity Pool Invariants:
   - Reserve pool tracking and atomic double-entry settlement via DoubleEntrySimulationLedger.
   - Bank of Algeria Reg 25-02 & COSOB Reg 23-01 zero-fiat isolation.
"""

import math
import logging
import threading
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, Field
from fastapi import HTTPException, status

from app.services.simulation_engine import (
    simulation_ledger,
    DoubleEntrySimulationLedger,
    LedgerLine,
    JournalEntry,
)
from app.schemas.amm import (
    BondingCurveConfig,
    BondingCurveQuoteResponse,
    BondingCurveTradeResponse,
    PoolStateResponse,
)

logger = logging.getLogger(__name__)

# Anti-front-running cooldown parameters
FRONT_RUNNING_COOLDOWN_SECONDS: float = 3.0
DEFAULT_FEE_RATE: float = 0.015  # 1.5% Touiza liquidity protocol fee


class StartupBondingPool:
    """Internal state of an AMM continuous bonding pool for a startup."""

    def __init__(
        self,
        startup_id: str,
        startup_name: str,
        curve_type: str = "POLYNOMIAL",
        p0: float = 100.0,
        slope_m: float = 0.5,
        exponent_k: float = 1.0,
        reserve_ratio: Optional[float] = 0.5,
        sigmoid_l: Optional[float] = 10_000.0,
        sigmoid_s0: Optional[float] = 500.0,
        fee_rate: float = DEFAULT_FEE_RATE,
        initial_supply: int = 0,
    ):
        self.startup_id = startup_id
        self.startup_name = startup_name
        self.curve_type = curve_type.upper()
        self.p0 = p0
        self.slope_m = slope_m
        self.reserve_ratio = reserve_ratio or 0.5

        if self.curve_type == "BANCOR":
            # Bancor continuous pricing: k = (1 / CW) - 1 where CW is reserve ratio
            self.exponent_k = max(0.0, (1.0 / max(0.001, self.reserve_ratio)) - 1.0)
        else:
            self.exponent_k = exponent_k

        self.sigmoid_l = sigmoid_l or 10_000.0
        self.sigmoid_s0 = sigmoid_s0 or 500.0
        self.fee_rate = fee_rate

        self.circulating_supply: int = initial_supply
        self.reserve_balance_dzd: int = 0
        self.total_volume_dzd: int = 0
        self.trades_count: int = 0

    # -------------------------------------------------------------------------
    # Mathematical Price Functions
    # -------------------------------------------------------------------------

    def spot_price(self, supply: Optional[int] = None) -> float:
        """Evaluates the instantaneous spot price at a given circulating supply."""
        s = supply if supply is not None else self.circulating_supply
        s = max(0, s)

        if self.curve_type == "SIGMOID":
            k = self.slope_m
            exponent = -k * (s - self.sigmoid_s0)
            # Bound exponent to prevent numerical overflow
            if exponent > 50:
                return self.p0
            if exponent < -50:
                return self.p0 + self.sigmoid_l
            return self.p0 + (self.sigmoid_l / (1.0 + math.exp(exponent)))
        else:
            # Polynomial Power Curve: P(S) = P_0 + m * S^k
            return self.p0 + self.slope_m * (float(s) ** self.exponent_k)

    def _integral_polynomial(self, s1: float, s2: float) -> float:
        """Integral of (P0 + m * s^k) ds from s1 to s2."""
        k = self.exponent_k
        m = self.slope_m
        p0 = self.p0

        term_p0 = p0 * (s2 - s1)
        term_k = (m / (k + 1.0)) * ((s2 ** (k + 1.0)) - (s1 ** (k + 1.0)))
        return term_p0 + term_k

    @staticmethod
    def _softplus(x: float) -> float:
        """Numerically stable softplus: ln(1 + e^x)."""
        if x > 30.0:
            return x
        if x < -30.0:
            return math.exp(x)
        return math.log(1.0 + math.exp(x))

    def _integral_sigmoid(self, s1: float, s2: float) -> float:
        """Integral of (P0 + L / (1 + e^(-k * (s - s0)))) ds from s1 to s2."""
        k = self.slope_m
        l = self.sigmoid_l
        s0 = self.sigmoid_s0
        p0 = self.p0

        term_p0 = p0 * (s2 - s1)
        u2 = k * (s2 - s0)
        u1 = k * (s1 - s0)
        term_sig = (l / k) * (self._softplus(u2) - self._softplus(u1))
        return term_p0 + term_sig

    def calculate_cost(self, s_start: int, delta_shares: int) -> float:
        """Calculates exact integral purchase cost for delta_shares starting from s_start."""
        s1 = float(max(0, s_start))
        s2 = s1 + float(max(0, delta_shares))

        if self.curve_type == "SIGMOID":
            return self._integral_sigmoid(s1, s2)
        return self._integral_polynomial(s1, s2)

    def calculate_refund(self, s_current: int, delta_shares: int) -> float:
        """Calculates exact integral gross refund for burning delta_shares ending at s_current."""
        s2 = float(max(0, s_current))
        s1 = max(0.0, s2 - float(delta_shares))

        if self.curve_type == "SIGMOID":
            return self._integral_sigmoid(s1, s2)
        return self._integral_polynomial(s1, s2)


class ContinuousBondingCurveEngine:
    """
    Automated Market Maker (AMM) continuous bonding curve engine for TamWheel.
    Provides algorithmic continuous liquidity, slippage protection, and front-running prevention.
    """

    def __init__(self, ledger: Optional[DoubleEntrySimulationLedger] = None):
        self._lock = threading.RLock()
        self.ledger: DoubleEntrySimulationLedger = ledger or simulation_ledger

        self._pools: Dict[str, StartupBondingPool] = {}
        # User share ownership: user_id -> {startup_id: shares_count}
        self._user_shares: Dict[int, Dict[str, int]] = {}

        # Anti-front-running telemetry: (user_id, startup_id) -> last_buy_timestamp
        self._last_user_buy: Dict[Tuple[int, str], datetime] = {}
        self._last_user_trade: Dict[int, datetime] = {}

        self._seed_default_pools()

    def _seed_default_pools(self) -> None:
        """Seeds default bonding pools matching seeded startups."""
        default_configs = [
            ("startup-finflow", "FinFlow Algeria", "POLYNOMIAL", 120.0, 0.4, 1.0),
            ("startup-greenfarm", "GreenFarm AI", "POLYNOMIAL", 100.0, 0.5, 1.0),
            ("startup-solartech", "SolarTech Oran", "POLYNOMIAL", 150.0, 0.6, 1.0),
            ("startup-sihatech", "SihaTech Health", "SIGMOID", 180.0, 0.05, 1.0),
            ("startup-logixpress", "LogiXpress Cargo", "POLYNOMIAL", 90.0, 0.3, 1.0),
            ("startup-edualgerie", "EduDjazair VR", "POLYNOMIAL", 80.0, 0.25, 1.0),
            ("startup-saharasolar", "Sahara Water IoT", "POLYNOMIAL", 110.0, 0.45, 1.0),
        ]
        for sid, sname, ctype, p0, m, k in default_configs:
            self._pools[sid] = StartupBondingPool(
                startup_id=sid,
                startup_name=sname,
                curve_type=ctype,
                p0=p0,
                slope_m=m,
                exponent_k=k,
                initial_supply=50,  # Seeded initial circulating fantasy shares
            )
            # Seed AMM reserve balance for initial supply
            init_reserve = int(self._pools[sid].calculate_cost(0, 50))
            self._pools[sid].reserve_balance_dzd = init_reserve

    def get_or_create_pool(
        self,
        startup_id: str,
        startup_name: Optional[str] = None,
        config: Optional[BondingCurveConfig] = None,
    ) -> StartupBondingPool:
        """Returns existing pool or creates a new bonding pool with custom config."""
        with self._lock:
            if startup_id in self._pools:
                return self._pools[startup_id]

            cfg = config or BondingCurveConfig(startup_id=startup_id)
            pool = StartupBondingPool(
                startup_id=startup_id,
                startup_name=startup_name or f"Startup {startup_id}",
                curve_type=cfg.curve_type,
                p0=cfg.p0,
                slope_m=cfg.slope_m,
                exponent_k=cfg.exponent_k,
                reserve_ratio=getattr(cfg, "reserve_ratio", 0.5),
                sigmoid_l=cfg.sigmoid_l,
                sigmoid_s0=cfg.sigmoid_s0,
                fee_rate=cfg.fee_rate,
                initial_supply=0,
            )
            self._pools[startup_id] = pool
            return pool

    # -------------------------------------------------------------------------
    # Quoting Functions
    # -------------------------------------------------------------------------

    def get_quote(
        self,
        startup_id: str,
        shares_amount: int,
        action: str = "BUY",
    ) -> BondingCurveQuoteResponse:
        """Computes pricing, integral cost, average execution price, and slippage."""
        if shares_amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Shares amount must be at least 1.",
            )

        with self._lock:
            pool = self.get_or_create_pool(startup_id)
            act_upper = action.upper()
            curr_s = pool.circulating_supply
            curr_spot = round(pool.spot_price(curr_s), 2)

            if act_upper == "BUY":
                new_s = curr_s + shares_amount
                new_spot = round(pool.spot_price(new_s), 2)
                raw_cost = pool.calculate_cost(curr_s, shares_amount)
                total_cost = round(raw_cost, 2)
                avg_price = round(total_cost / shares_amount, 2)
                price_impact = round(((new_spot - curr_spot) / max(0.01, curr_spot)) * 100.0, 2)
                slippage = round(((avg_price - curr_spot) / max(0.01, curr_spot)) * 100.0, 2)

                return BondingCurveQuoteResponse(
                    startup_id=startup_id,
                    action="BUY",
                    shares_amount=shares_amount,
                    current_supply=curr_s,
                    new_supply=new_s,
                    current_spot_price=curr_spot,
                    new_spot_price=new_spot,
                    total_cost_or_refund=total_cost,
                    net_refund=None,
                    protocol_fee=0.0,
                    avg_execution_price=avg_price,
                    price_impact_pct=price_impact,
                    slippage_pct=max(0.0, slippage),
                )
            elif act_upper == "SELL":
                if curr_s < shares_amount:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot sell {shares_amount} shares. Pool supply is only {curr_s}.",
                    )
                new_s = curr_s - shares_amount
                new_spot = round(pool.spot_price(new_s), 2)
                raw_refund = pool.calculate_refund(curr_s, shares_amount)
                gross_refund = round(raw_refund, 2)
                fee = round(gross_refund * pool.fee_rate, 2)
                net_refund = round(gross_refund - fee, 2)
                avg_price = round(gross_refund / shares_amount, 2)
                price_impact = round(((curr_spot - new_spot) / max(0.01, curr_spot)) * 100.0, 2)
                slippage = round(((curr_spot - avg_price) / max(0.01, curr_spot)) * 100.0, 2)

                return BondingCurveQuoteResponse(
                    startup_id=startup_id,
                    action="SELL",
                    shares_amount=shares_amount,
                    current_supply=curr_s,
                    new_supply=new_s,
                    current_spot_price=curr_spot,
                    new_spot_price=new_spot,
                    total_cost_or_refund=gross_refund,
                    net_refund=net_refund,
                    protocol_fee=fee,
                    avg_execution_price=avg_price,
                    price_impact_pct=price_impact,
                    slippage_pct=max(0.0, slippage),
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid action '{action}'. Must be 'BUY' or 'SELL'.",
                )

    # -------------------------------------------------------------------------
    # Execution & Double-Entry Invariants
    # -------------------------------------------------------------------------

    def execute_trade(
        self,
        user_id: int,
        startup_id: str,
        action: str,
        shares_amount: int,
        max_slippage_pct: float = 2.5,
        expected_avg_price: Optional[float] = None,
    ) -> BondingCurveTradeResponse:
        """
        Executes an atomic trade on the continuous bonding curve:
        - Validates anti-front-running delay window.
        - Enforces slippage tolerance threshold.
        - Records zero-sum double-entry ledger entries.
        - Updates circulating supply and virtual reserves.
        """
        if shares_amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Trade shares amount must be at least 1.",
            )

        with self._lock:
            pool = self.get_or_create_pool(startup_id)
            act_upper = action.upper()
            now = datetime.now(timezone.utc)

            # 1. Anti-front-running cooldown verification
            last_trade = self._last_user_trade.get(user_id)
            if last_trade and (now - last_trade).total_seconds() < 0.1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Anti-front-running delay: orders throttled to prevent spam and high-frequency manipulation.",
                )

            # Rapid sandwich round-trip protection (buy then immediate sell)
            if act_upper == "SELL":
                last_buy = self._last_user_buy.get((user_id, startup_id))
                if last_buy and (now - last_buy).total_seconds() < FRONT_RUNNING_COOLDOWN_SECONDS:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Anti-front-running delay active: cannot sell shares within "
                            f"{FRONT_RUNNING_COOLDOWN_SECONDS}s of purchase."
                        ),
                    )

            # Ensure user has starter grant credited in ledger
            self.ledger.issue_starter_grant(user_id)

            user_holdings = self._user_shares.setdefault(user_id, {})
            current_user_shares = user_holdings.get(startup_id, 0)

            # 2. Quote and Slippage Protection
            quote = self.get_quote(startup_id, shares_amount, action=act_upper)

            # Slippage check
            if expected_avg_price is not None:
                actual_slippage = abs(quote.avg_execution_price - expected_avg_price) / max(0.01, expected_avg_price) * 100.0
            else:
                actual_slippage = quote.slippage_pct

            if actual_slippage > max_slippage_pct:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Slippage tolerance exceeded: actual slippage {actual_slippage:.2f}% "
                        f"> maximum allowable {max_slippage_pct:.2f}%."
                    ),
                )

            # 3. Execution & Ledger Settlement
            trade_id = f"trade-{user_id}-{startup_id}-{act_upper.lower()}-{int(now.timestamp() * 1000)}"

            if act_upper == "BUY":
                cost_dzd = int(math.ceil(quote.total_cost_or_refund))
                user_balance = self.ledger.get_account_balance(f"USER:{user_id}:VIRTUAL_CASH")
                if user_balance < cost_dzd:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Insufficient virtual cash balance: Need {cost_dzd} DZD, have {user_balance} DZD.",
                    )

                # Double-entry lines: Debit AMM Reserve / Credit User Cash
                lines = [
                    LedgerLine(
                        account=f"AMM:{startup_id}:RESERVE_POOL",
                        debit=cost_dzd,
                        credit=0,
                    ),
                    LedgerLine(
                        account=f"USER:{user_id}:VIRTUAL_CASH",
                        debit=0,
                        credit=cost_dzd,
                    ),
                ]

                entry = self.ledger.record_journal_entry(
                    action="AMM_BONDING_CURVE_BUY",
                    idempotency_key=trade_id,
                    lines=lines,
                    user_id=user_id,
                    campaign_id=startup_id,
                    metadata={"shares": shares_amount, "costDzd": cost_dzd},
                )

                # Update pool & user state
                pool.circulating_supply += shares_amount
                pool.reserve_balance_dzd += cost_dzd
                pool.total_volume_dzd += cost_dzd
                pool.trades_count += 1

                user_holdings[startup_id] = current_user_shares + shares_amount
                self._last_user_buy[(user_id, startup_id)] = now
                self._last_user_trade[user_id] = now

                return BondingCurveTradeResponse(
                    trade_id=trade_id,
                    user_id=user_id,
                    startup_id=startup_id,
                    action="BUY",
                    shares_amount=shares_amount,
                    total_cost_or_refund=cost_dzd,
                    net_refund=None,
                    protocol_fee=0,
                    avg_execution_price=quote.avg_execution_price,
                    slippage_pct=round(actual_slippage, 2),
                    current_spot_price=round(pool.spot_price(), 2),
                    new_supply=pool.circulating_supply,
                    new_user_shares=user_holdings[startup_id],
                    journal_entry_id=entry.entry_id,
                    entry_hash=entry.entry_hash,
                    timestamp=entry.timestamp,
                )

            else:  # SELL
                if current_user_shares < shares_amount:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Insufficient shares: You own {current_user_shares} shares, cannot sell {shares_amount}.",
                    )

                gross_refund_dzd = int(math.floor(quote.total_cost_or_refund))
                protocol_fee_dzd = int(math.ceil(quote.protocol_fee))
                net_refund_dzd = gross_refund_dzd - protocol_fee_dzd

                # Double-entry lines:
                # Credit AMM Reserve (paying refund), Debit User Cash (receiving net), Debit Fee Pool (protocol fee)
                lines = [
                    LedgerLine(
                        account=f"AMM:{startup_id}:RESERVE_POOL",
                        debit=0,
                        credit=gross_refund_dzd,
                    ),
                    LedgerLine(
                        account=f"USER:{user_id}:VIRTUAL_CASH",
                        debit=net_refund_dzd,
                        credit=0,
                    ),
                    LedgerLine(
                        account="SYSTEM:TOUIZA_LIQUIDITY_FEE_POOL",
                        debit=protocol_fee_dzd,
                        credit=0,
                    ),
                ]

                entry = self.ledger.record_journal_entry(
                    action="AMM_BONDING_CURVE_SELL",
                    idempotency_key=trade_id,
                    lines=lines,
                    user_id=user_id,
                    campaign_id=startup_id,
                    metadata={"shares": shares_amount, "netRefundDzd": net_refund_dzd, "feeDzd": protocol_fee_dzd},
                )

                # Update pool & user state
                pool.circulating_supply -= shares_amount
                pool.reserve_balance_dzd = max(0, pool.reserve_balance_dzd - gross_refund_dzd)
                pool.total_volume_dzd += gross_refund_dzd
                pool.trades_count += 1

                user_holdings[startup_id] = current_user_shares - shares_amount
                self._last_user_trade[user_id] = now

                return BondingCurveTradeResponse(
                    trade_id=trade_id,
                    user_id=user_id,
                    startup_id=startup_id,
                    action="SELL",
                    shares_amount=shares_amount,
                    total_cost_or_refund=gross_refund_dzd,
                    net_refund=net_refund_dzd,
                    protocol_fee=protocol_fee_dzd,
                    avg_execution_price=quote.avg_execution_price,
                    slippage_pct=round(actual_slippage, 2),
                    current_spot_price=round(pool.spot_price(), 2),
                    new_supply=pool.circulating_supply,
                    new_user_shares=user_holdings[startup_id],
                    journal_entry_id=entry.entry_id,
                    entry_hash=entry.entry_hash,
                    timestamp=entry.timestamp,
                )

    # -------------------------------------------------------------------------
    # Pool Queries
    # -------------------------------------------------------------------------

    def get_pool_state(self, startup_id: str) -> PoolStateResponse:
        """Retrieves real-time AMM bonding curve pool metrics for a startup."""
        with self._lock:
            pool = self.get_or_create_pool(startup_id)
            return PoolStateResponse(
                startup_id=pool.startup_id,
                startup_name=pool.startup_name,
                curve_type=pool.curve_type,
                circulating_supply=pool.circulating_supply,
                spot_price=round(pool.spot_price(), 2),
                reserve_balance_dzd=pool.reserve_balance_dzd,
                total_volume_dzd=pool.total_volume_dzd,
                trades_count=pool.trades_count,
                p0=pool.p0,
                slope_m=pool.slope_m,
                exponent_k=pool.exponent_k,
                fee_rate=pool.fee_rate,
            )

    def get_user_shares(self, user_id: int, startup_id: str) -> int:
        """Returns the number of shares a user owns in a startup."""
        with self._lock:
            return self._user_shares.get(user_id, {}).get(startup_id, 0)

    def get_all_user_holdings(self, user_id: int) -> Dict[str, int]:
        """Returns all shares owned by a user across all startups."""
        with self._lock:
            return {sid: count for sid, count in self._user_shares.get(user_id, {}).items() if count > 0}

    def get_startup_shareholders(self, startup_id: str) -> Dict[int, int]:
        """Returns a mapping of user_id -> shares_count for a startup (for dividend distribution)."""
        with self._lock:
            holders: Dict[int, int] = {}
            for uid, holdings in self._user_shares.items():
                count = holdings.get(startup_id, 0)
                if count > 0:
                    holders[uid] = count
            return holders


# Global Singleton Instance
bonding_curve_amm = ContinuousBondingCurveEngine()
