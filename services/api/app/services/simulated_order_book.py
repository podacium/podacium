"""
TamWheel Sovereign Ethical Agentic Venture OS — Continuous Simulated Limit Order Book (LOB) & Market Depth Engine.
Pillar 2 / Phase 4: Secondary Market Trading for Fantasy Startup Shares with Price-Time Priority.

Market Microstructure Foundations:
1. Continuous Double Auction & Limit Order Book (LOB):
   - Price-time priority matching engine (FIFO at identical price levels).
   - Bids ordered descending by price; Asks ordered ascending by price.
   - Supports LIMIT and MARKET orders with partial fill execution.
2. Market Depth & Visualization:
   - Bid/Ask volume levels aggregated by discrete price points.
   - Real-time Bid-Ask spread calculation in DZD (Sim).
   - Order book depth imbalance ratio in [-1.0, 1.0].
3. Atomic Double-Entry Virtual Settlement:
   - Synchronized with DoubleEntrySimulationLedger and ContinuousBondingCurveEngine shareholdings.
   - Automatic trade feed into AntiCollusionWashTradingEngine for real-time wash trading detection.
"""

import math
import logging
import threading
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from fastapi import HTTPException, status

from app.services.simulation_engine import (
    simulation_ledger,
    DoubleEntrySimulationLedger,
    LedgerLine,
    JournalEntry,
)
from app.services.bonding_curve_amm import (
    bonding_curve_amm,
    ContinuousBondingCurveEngine,
)
from app.services.anti_collusion_engine import (
    anti_collusion_engine,
    AntiCollusionWashTradingEngine,
)
from app.schemas.orderbook import (
    CreateOrderRequest,
    OrderResponse,
    OrderMatchTrade,
    OrderPlacementResult,
    MarketDepthLevel,
    MarketDepthResponse,
    CancelOrderResponse,
)

logger = logging.getLogger(__name__)

MAKER_TAKER_FEE_RATE: float = 0.005  # 0.5% Touiza protocol transaction fee


class InternalOrder:
    def __init__(
        self,
        order_id: str,
        user_id: int,
        startup_id: str,
        side: str,  # "BUY" | "SELL"
        order_type: str,  # "LIMIT" | "MARKET"
        price: Optional[float],
        quantity: int,
        created_at: Optional[datetime] = None,
    ):
        self.order_id = order_id
        self.user_id = user_id
        self.startup_id = startup_id
        self.side = side.upper()
        self.order_type = order_type.upper()
        self.price = round(price, 2) if price is not None else None
        self.quantity = quantity
        self.filled_quantity: int = 0
        self.remaining_quantity: int = quantity
        self.status = "OPEN"
        self.created_at = created_at or datetime.now(timezone.utc)
        self.updated_at = self.created_at
        # Locked cash or shares for escrow
        self.locked_cash_dzd: int = 0
        self.locked_shares: int = 0

    def to_response(self) -> OrderResponse:
        return OrderResponse(
            order_id=self.order_id,
            user_id=self.user_id,
            startup_id=self.startup_id,
            side=self.side,
            order_type=self.order_type,
            price=self.price,
            quantity=self.quantity,
            filled_quantity=self.filled_quantity,
            remaining_quantity=self.remaining_quantity,
            status=self.status,
            created_at=self.created_at.isoformat(),
            updated_at=self.updated_at.isoformat(),
        )


class StartupOrderBook:
    """Single startup venture limit order book with price-time priority."""

    def __init__(self, startup_id: str, startup_name: str):
        self.startup_id = startup_id
        self.startup_name = startup_name
        self.bids: List[InternalOrder] = []  # sorted descending by price, then FIFO
        self.asks: List[InternalOrder] = []  # sorted ascending by price, then FIFO
        self.order_map: Dict[str, InternalOrder] = {}
        self.trade_history: List[OrderMatchTrade] = []
        self.last_trade_price: Optional[float] = None
        self.total_volume_dzd: int = 0
        self.trades_count: int = 0

    def sort_bids(self) -> None:
        """Sorts bids: highest price first, then earliest created_at (price-time priority)."""
        self.bids.sort(key=lambda o: (-o.price if o.price is not None else 0.0, o.created_at))

    def sort_asks(self) -> None:
        """Sorts asks: lowest price first, then earliest created_at (price-time priority)."""
        self.asks.sort(key=lambda o: (o.price if o.price is not None else float("inf"), o.created_at))


class SimulatedOrderBookEngine:
    """
    Continuous secondary market order book engine for fantasy venture shares.
    Provides limit/market order matching, price-time priority, double-entry settlement,
    and market depth aggregation.
    """

    def __init__(
        self,
        ledger: Optional[DoubleEntrySimulationLedger] = None,
        amm: Optional[ContinuousBondingCurveEngine] = None,
        anti_collusion: Optional[AntiCollusionWashTradingEngine] = None,
    ):
        self._lock = threading.RLock()
        self.ledger: DoubleEntrySimulationLedger = ledger or simulation_ledger
        self.amm: ContinuousBondingCurveEngine = amm or bonding_curve_amm
        self.anti_collusion: AntiCollusionWashTradingEngine = anti_collusion or anti_collusion_engine

        self._books: Dict[str, StartupOrderBook] = {}
        # Track locked assets in open orders:
        # user_id -> startup_id -> locked_shares
        self._locked_user_shares: Dict[int, Dict[str, int]] = {}
        # user_id -> locked_cash_dzd
        self._locked_user_cash: Dict[int, int] = {}

        self._seed_default_liquidity()

    def _seed_default_liquidity(self) -> None:
        """Seeds initial resting bids and asks for seeded startups."""
        seed_startups = [
            ("startup-finflow", "FinFlow Algeria", 120.0),
            ("startup-greenfarm", "GreenFarm AI", 100.0),
            ("startup-solartech", "SolarTech Oran", 150.0),
            ("startup-sihatech", "SihaTech Health", 180.0),
        ]
        # Market maker system user ID: 99999
        mm_user_id = 99999
        # Credit MM user cash in ledger
        self.ledger.issue_starter_grant(mm_user_id)
        # Give MM initial shares
        for sid, sname, base_p in seed_startups:
            book = self.get_or_create_book(sid, sname)
            self.amm._user_shares.setdefault(mm_user_id, {})[sid] = 500

            # Resting asks (liquidity providers selling)
            for step, delta in enumerate([1.0, 2.5, 5.0, 10.0]):
                ask_p = round(base_p + delta, 2)
                ask_o = InternalOrder(
                    order_id=f"seed-ask-{sid}-{step}",
                    user_id=mm_user_id,
                    startup_id=sid,
                    side="SELL",
                    order_type="LIMIT",
                    price=ask_p,
                    quantity=10,
                )
                book.asks.append(ask_o)
                book.order_map[ask_o.order_id] = ask_o

            # Resting bids (liquidity providers buying)
            for step, delta in enumerate([1.0, 2.5, 5.0, 10.0]):
                bid_p = round(max(1.0, base_p - delta), 2)
                bid_o = InternalOrder(
                    order_id=f"seed-bid-{sid}-{step}",
                    user_id=mm_user_id,
                    startup_id=sid,
                    side="BUY",
                    order_type="LIMIT",
                    price=bid_p,
                    quantity=10,
                )
                book.bids.append(bid_o)
                book.order_map[bid_o.order_id] = bid_o

            book.sort_bids()
            book.sort_asks()

    def reset(self) -> None:
        """Resets order books and locked balances (for testing)."""
        with self._lock:
            self._books.clear()
            self._locked_user_shares.clear()
            self._locked_user_cash.clear()
            self._seed_default_liquidity()

    def get_or_create_book(self, startup_id: str, startup_name: Optional[str] = None) -> StartupOrderBook:
        """Retrieves or instantiates an order book for a startup."""
        with self._lock:
            if startup_id in self._books:
                return self._books[startup_id]

            name = startup_name
            if not name:
                pool = self.amm._pools.get(startup_id)
                name = pool.startup_name if pool else f"Startup {startup_id}"

            book = StartupOrderBook(startup_id=startup_id, startup_name=name)
            self._books[startup_id] = book
            return book

    # -------------------------------------------------------------------------
    # Balance & Share Verification
    # -------------------------------------------------------------------------

    def get_available_user_cash(self, user_id: int) -> int:
        """Virtual cash balance minus cash locked in open limit buy orders."""
        self.ledger.issue_starter_grant(user_id)
        total_balance = self.ledger.get_account_balance(f"USER:{user_id}:VIRTUAL_CASH")
        locked = self._locked_user_cash.get(user_id, 0)
        return max(0, total_balance - locked)

    def get_available_user_shares(self, user_id: int, startup_id: str) -> int:
        """Owned startup shares minus shares locked in open limit sell orders."""
        total_shares = self.amm.get_user_shares(user_id, startup_id)
        locked = self._locked_user_shares.get(user_id, {}).get(startup_id, 0)
        return max(0, total_shares - locked)

    # -------------------------------------------------------------------------
    # Order Placement & Matching Engine
    # -------------------------------------------------------------------------

    def place_order(
        self,
        user_id: int,
        startup_id: str,
        side: str,
        order_type: str = "LIMIT",
        price: Optional[float] = None,
        quantity: int = 1,
    ) -> OrderPlacementResult:
        """
        Submits and matches a limit or market order against the continuous order book:
        - Strict price-time priority.
        - Atomic settlement via DoubleEntrySimulationLedger.
        - Feeds completed trades into AntiCollusionWashTradingEngine.
        """
        if quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order quantity must be at least 1.",
            )

        act_side = side.upper()
        act_type = order_type.upper()

        if act_type == "LIMIT":
            if price is None or price <= 0.0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Limit orders require a positive price in DZD.",
                )
        elif act_type == "MARKET":
            pass
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid order type '{order_type}'. Must be 'LIMIT' or 'MARKET'.",
            )

        with self._lock:
            book = self.get_or_create_book(startup_id)
            now = datetime.now(timezone.utc)
            order_id = f"ord-{user_id}-{startup_id}-{act_side.lower()}-{int(now.timestamp() * 1000)}"

            # 1. Validation & Escrow Reservation
            avail_cash = self.get_available_user_cash(user_id)
            avail_shares = self.get_available_user_shares(user_id, startup_id)

            if act_side == "BUY":
                if act_type == "LIMIT":
                    required_cash = int(math.ceil(price * quantity))
                    if avail_cash < required_cash:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=(
                                f"Insufficient virtual cash balance for limit buy: "
                                f"Need {required_cash} DZD, available {avail_cash} DZD."
                            ),
                        )
                else:  # MARKET BUY
                    if not book.asks:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Cannot execute market buy: No available asks in order book for {startup_id}.",
                        )
            else:  # SELL
                if avail_shares < quantity:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Insufficient fantasy shares for sell order: "
                            f"You have {avail_shares} unencumbered shares, cannot sell {quantity}."
                        ),
                    )

            # Create internal order representation
            incoming = InternalOrder(
                order_id=order_id,
                user_id=user_id,
                startup_id=startup_id,
                side=act_side,
                order_type=act_type,
                price=price,
                quantity=quantity,
                created_at=now,
            )

            executed_trades: List[OrderMatchTrade] = []
            net_cash_delta = 0

            # 2. Matching Engine Execution
            if act_side == "BUY":
                book.sort_asks()
                remaining = quantity

                i = 0
                while i < len(book.asks) and remaining > 0:
                    maker = book.asks[i]
                    if maker.user_id == user_id:
                        # Prevent self-trading with own resting order
                        i += 1
                        continue

                    # Price limit check
                    if act_type == "LIMIT" and maker.price > price:
                        # Best ask exceeds buyer's limit price; cannot match
                        break

                    # Match price is maker's resting price (passive order sets price)
                    match_price = maker.price
                    match_qty = min(remaining, maker.remaining_quantity)
                    trade_cost = int(math.ceil(match_price * match_qty))
                    fee_dzd = int(math.ceil(trade_cost * MAKER_TAKER_FEE_RATE))

                    # Execute atomic settlement
                    trade = self._settle_match(
                        buyer_id=user_id,
                        seller_id=maker.user_id,
                        startup_id=startup_id,
                        price=match_price,
                        quantity=match_qty,
                        total_dzd=trade_cost,
                        fee_dzd=fee_dzd,
                        maker_order_id=maker.order_id,
                        taker_order_id=incoming.order_id,
                        timestamp=now,
                    )
                    executed_trades.append(trade)
                    net_cash_delta -= trade_cost

                    # Update maker
                    maker.filled_quantity += match_qty
                    maker.remaining_quantity -= match_qty
                    maker.locked_shares = max(0, maker.locked_shares - match_qty)
                    maker.updated_at = now
                    if maker.remaining_quantity == 0:
                        maker.status = "FILLED"
                        book.asks.pop(i)
                    else:
                        maker.status = "PARTIALLY_FILLED"
                        i += 1

                    # Update taker
                    remaining -= match_qty
                    incoming.filled_quantity += match_qty
                    incoming.remaining_quantity = remaining

                # If limit order has unfilled quantity, rest on the order book
                if remaining > 0:
                    if act_type == "LIMIT":
                        incoming.status = "PARTIALLY_FILLED" if incoming.filled_quantity > 0 else "OPEN"
                        # Lock cash for resting quantity
                        locked_amt = int(math.ceil(price * remaining))
                        incoming.locked_cash_dzd = locked_amt
                        self._locked_user_cash[user_id] = self._locked_user_cash.get(user_id, 0) + locked_amt
                        book.bids.append(incoming)
                        book.order_map[incoming.order_id] = incoming
                        book.sort_bids()
                    else:
                        # Market orders cancel remaining
                        incoming.status = "FILLED" if incoming.filled_quantity > 0 else "CANCELLED"
                else:
                    incoming.status = "FILLED"

            else:  # act_side == "SELL"
                book.sort_bids()
                remaining = quantity

                i = 0
                while i < len(book.bids) and remaining > 0:
                    maker = book.bids[i]
                    if maker.user_id == user_id:
                        # Prevent self-trading
                        i += 1
                        continue

                    # Price limit check
                    if act_type == "LIMIT" and maker.price < price:
                        # Best bid is lower than seller's limit price; cannot match
                        break

                    match_price = maker.price
                    match_qty = min(remaining, maker.remaining_quantity)
                    trade_gross = int(math.floor(match_price * match_qty))
                    fee_dzd = int(math.ceil(trade_gross * MAKER_TAKER_FEE_RATE))

                    # Unlock matched maker cash
                    maker_locked_portion = int(math.ceil(maker.price * match_qty))
                    self._locked_user_cash[maker.user_id] = max(
                        0, self._locked_user_cash.get(maker.user_id, 0) - maker_locked_portion
                    )

                    # Execute atomic settlement
                    trade = self._settle_match(
                        buyer_id=maker.user_id,
                        seller_id=user_id,
                        startup_id=startup_id,
                        price=match_price,
                        quantity=match_qty,
                        total_dzd=trade_gross,
                        fee_dzd=fee_dzd,
                        maker_order_id=maker.order_id,
                        taker_order_id=incoming.order_id,
                        timestamp=now,
                    )
                    executed_trades.append(trade)
                    net_cash_delta += (trade_gross - fee_dzd)

                    # Update maker
                    maker.filled_quantity += match_qty
                    maker.remaining_quantity -= match_qty
                    maker.locked_cash_dzd = max(0, maker.locked_cash_dzd - maker_locked_portion)
                    maker.updated_at = now
                    if maker.remaining_quantity == 0:
                        maker.status = "FILLED"
                        book.bids.pop(i)
                    else:
                        maker.status = "PARTIALLY_FILLED"
                        i += 1

                    # Update taker
                    remaining -= match_qty
                    incoming.filled_quantity += match_qty
                    incoming.remaining_quantity = remaining

                # If limit order has unfilled quantity, rest on the order book
                if remaining > 0:
                    if act_type == "LIMIT":
                        incoming.status = "PARTIALLY_FILLED" if incoming.filled_quantity > 0 else "OPEN"
                        incoming.locked_shares = remaining
                        user_locks = self._locked_user_shares.setdefault(user_id, {})
                        user_locks[startup_id] = user_locks.get(startup_id, 0) + remaining
                        book.asks.append(incoming)
                        book.order_map[incoming.order_id] = incoming
                        book.sort_asks()
                    else:
                        incoming.status = "FILLED" if incoming.filled_quantity > 0 else "CANCELLED"
                else:
                    incoming.status = "FILLED"

            return OrderPlacementResult(
                order=incoming.to_response(),
                executed_trades=executed_trades,
                fully_filled=(incoming.status == "FILLED"),
                net_cash_spent_or_received=net_cash_delta,
            )

    def _settle_match(
        self,
        buyer_id: int,
        seller_id: int,
        startup_id: str,
        price: float,
        quantity: int,
        total_dzd: int,
        fee_dzd: int,
        maker_order_id: str,
        taker_order_id: str,
        timestamp: datetime,
    ) -> OrderMatchTrade:
        """Settles matched trade atomically in DoubleEntrySimulationLedger and AMM share balance."""
        net_seller_dzd = total_dzd - fee_dzd
        trade_id = f"match-{seller_id}-{buyer_id}-{int(timestamp.timestamp() * 1000)}"

        # Double-entry ledger lines:
        # Credit Buyer Cash (paying total_dzd)
        # Debit Seller Cash (receiving net_seller_dzd)
        # Debit Touiza Fee Pool (protocol fee)
        # Sum debits = net + fee = total_dzd = Sum credits
        lines = [
            LedgerLine(
                account=f"USER:{buyer_id}:VIRTUAL_CASH",
                debit=0,
                credit=total_dzd,
            ),
            LedgerLine(
                account=f"USER:{seller_id}:VIRTUAL_CASH",
                debit=net_seller_dzd,
                credit=0,
            ),
            LedgerLine(
                account="SYSTEM:TOUIZA_LIQUIDITY_FEE_POOL",
                debit=fee_dzd,
                credit=0,
            ),
        ]

        entry = self.ledger.record_journal_entry(
            action="ORDERBOOK_SECONDARY_TRADE_MATCH",
            idempotency_key=trade_id,
            lines=lines,
            user_id=buyer_id,
            campaign_id=startup_id,
            metadata={
                "buyerId": buyer_id,
                "sellerId": seller_id,
                "startupId": startup_id,
                "shares": quantity,
                "price": price,
                "totalDzd": total_dzd,
                "feeDzd": fee_dzd,
                "makerOrderId": maker_order_id,
                "takerOrderId": taker_order_id,
            },
        )

        # Update share ownership in bonding_curve_amm
        seller_shares = self.amm._user_shares.setdefault(seller_id, {})
        buyer_shares = self.amm._user_shares.setdefault(buyer_id, {})

        seller_shares[startup_id] = max(0, seller_shares.get(startup_id, 0) - quantity)
        buyer_shares[startup_id] = buyer_shares.get(startup_id, 0) + quantity

        # Update order book stats
        book = self.get_or_create_book(startup_id)
        book.last_trade_price = price
        book.total_volume_dzd += total_dzd
        book.trades_count += 1

        trade_obj = OrderMatchTrade(
            trade_id=trade_id,
            maker_order_id=maker_order_id,
            taker_order_id=taker_order_id,
            buyer_id=buyer_id,
            seller_id=seller_id,
            startup_id=startup_id,
            price=price,
            quantity=quantity,
            total_dzd=total_dzd,
            fee_dzd=fee_dzd,
            timestamp=timestamp.isoformat(),
            journal_entry_id=entry.entry_id,
        )
        book.trade_history.append(trade_obj)

        # Feed trade into AntiCollusionWashTradingEngine
        self.anti_collusion.record_trade(
            buyer_id=buyer_id,
            seller_id=seller_id,
            startup_id=startup_id,
            shares=quantity,
            volume_dzd=total_dzd,
            trade_id=trade_id,
            timestamp=timestamp,
        )

        return trade_obj

    # -------------------------------------------------------------------------
    # Order Cancellation
    # -------------------------------------------------------------------------

    def cancel_order(self, user_id: int, order_id: str) -> CancelOrderResponse:
        """Cancels an open or partially filled order and releases escrowed funds/shares."""
        with self._lock:
            for sid, book in self._books.items():
                if order_id in book.order_map:
                    order = book.order_map[order_id]
                    if order.user_id != user_id:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Cannot cancel an order placed by another user.",
                        )
                    if order.status not in ["OPEN", "PARTIALLY_FILLED"]:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Cannot cancel order in '{order.status}' status.",
                        )

                    refunded_cash = order.locked_cash_dzd
                    refunded_shares = order.locked_shares
                    cancelled_qty = order.remaining_quantity

                    # Release locks
                    if order.side == "BUY":
                        self._locked_user_cash[user_id] = max(
                            0, self._locked_user_cash.get(user_id, 0) - refunded_cash
                        )
                        order.locked_cash_dzd = 0
                        if order in book.bids:
                            book.bids.remove(order)
                    else:
                        user_locks = self._locked_user_shares.setdefault(user_id, {})
                        user_locks[sid] = max(0, user_locks.get(sid, 0) - refunded_shares)
                        order.locked_shares = 0
                        if order in book.asks:
                            book.asks.remove(order)

                    order.status = "CANCELLED"
                    order.updated_at = datetime.now(timezone.utc)

                    return CancelOrderResponse(
                        order_id=order.order_id,
                        startup_id=order.startup_id,
                        status="CANCELLED",
                        cancelled_quantity=cancelled_qty,
                        refunded_cash_dzd=refunded_cash,
                        refunded_shares=refunded_shares,
                    )

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order '{order_id}' not found.",
            )

    # -------------------------------------------------------------------------
    # Market Depth Visualization
    # -------------------------------------------------------------------------

    def get_market_depth(self, startup_id: str, depth_levels: int = 15) -> MarketDepthResponse:
        """
        Generates real-time market depth visualization payload:
        - Bids aggregated by price descending
        - Asks aggregated by price ascending
        - Bid-ask spread, mid price, and depth imbalance
        """
        with self._lock:
            book = self.get_or_create_book(startup_id)
            book.sort_bids()
            book.sort_asks()

            # Aggregate bids
            bid_dict: Dict[float, Tuple[int, int]] = {}  # price -> (volume, count)
            for b in book.bids:
                if b.status in ["OPEN", "PARTIALLY_FILLED"] and b.price is not None:
                    vol, cnt = bid_dict.get(b.price, (0, 0))
                    bid_dict[b.price] = (vol + b.remaining_quantity, cnt + 1)

            aggregated_bids = [
                MarketDepthLevel(price=p, volume=vol, orders_count=cnt)
                for p, (vol, cnt) in sorted(bid_dict.items(), key=lambda x: -x[0])
            ][:depth_levels]

            # Aggregate asks
            ask_dict: Dict[float, Tuple[int, int]] = {}  # price -> (volume, count)
            for a in book.asks:
                if a.status in ["OPEN", "PARTIALLY_FILLED"] and a.price is not None:
                    vol, cnt = ask_dict.get(a.price, (0, 0))
                    ask_dict[a.price] = (vol + a.remaining_quantity, cnt + 1)

            aggregated_asks = [
                MarketDepthLevel(price=p, volume=vol, orders_count=cnt)
                for p, (vol, cnt) in sorted(ask_dict.items(), key=lambda x: x[0])
            ][:depth_levels]

            best_bid = aggregated_bids[0].price if aggregated_bids else None
            best_ask = aggregated_asks[0].price if aggregated_asks else None

            spread_dzd = None
            mid_price = None
            if best_bid is not None and best_ask is not None:
                spread_dzd = round(max(0.0, best_ask - best_bid), 2)
                mid_price = round((best_bid + best_ask) / 2.0, 2)

            total_bid_vol = sum(b.volume for b in aggregated_bids)
            total_ask_vol = sum(a.volume for a in aggregated_asks)

            # Depth imbalance in [-1.0, 1.0]: (BidVol - AskVol) / (BidVol + AskVol)
            if (total_bid_vol + total_ask_vol) > 0:
                imbalance = round((total_bid_vol - total_ask_vol) / (total_bid_vol + total_ask_vol), 4)
            else:
                imbalance = 0.0

            return MarketDepthResponse(
                startup_id=startup_id,
                startup_name=book.startup_name,
                bids=aggregated_bids,
                asks=aggregated_asks,
                best_bid=best_bid,
                best_ask=best_ask,
                spread_dzd=spread_dzd,
                mid_price=mid_price,
                depth_imbalance=imbalance,
                last_trade_price=book.last_trade_price,
                total_bids_volume=total_bid_vol,
                total_asks_volume=total_ask_vol,
                total_volume_dzd=book.total_volume_dzd,
                trades_count=book.trades_count,
                timestamp=datetime.now(timezone.utc).isoformat(),
            )

    def get_user_orders(
        self,
        user_id: int,
        startup_id: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> List[OrderResponse]:
        """Lists user orders across books."""
        with self._lock:
            results: List[OrderResponse] = []
            for sid, book in self._books.items():
                if startup_id and sid != startup_id:
                    continue
                for order in book.order_map.values():
                    if order.user_id == user_id:
                        if status_filter and order.status != status_filter.upper():
                            continue
                        results.append(order.to_response())
            return sorted(results, key=lambda o: o.created_at, reverse=True)

    def get_recent_trades(self, startup_id: str, limit: int = 50) -> List[OrderMatchTrade]:
        """Returns recent matched trades on startup order book."""
        with self._lock:
            book = self.get_or_create_book(startup_id)
            return list(reversed(book.trade_history[-limit:]))


# Global Singleton Instance
simulated_order_book = SimulatedOrderBookEngine()
