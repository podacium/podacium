"""
TamWheel Sovereign Ethical Agentic Venture OS — Sybil Resistance & Anti-Collusion Wash Trading Detection Engine.
Pillar 2 / Phase 4: Graph Cycle Detection, Reciprocal Bilateral Wash Trading, and Telemetry Cluster Auditing.

Market Microstructure & Game Theory Principles:
1. Directed Transaction Multigraph:
   - Tracks directed transfers: Seller -> Buyer (shares flow) / Buyer -> Seller (virtual cash flow).
   - Detects reciprocal 2-cycles (A <-> B ping-pong trading to inflate volumes or rank).
   - Detects circular N-cycles (A -> B -> C -> A Sybil rings).
2. Bilateral Concentration & Reciprocity Symmetry:
   - Evaluates whether an account concentrates an unnatural fraction of trading volume with single counterparties.
   - Evaluates wash-trading symmetry: when bidirectional volume balances out to near-zero net transfer.
3. Telemetry Overlap & Sybil Cluster Detection:
   - Correlates client IP addresses, user agents, and device fingerprints.
   - Flags accounts trading directly with entities sharing identical device or network telemetry.
4. Composite Collusion Score in [0.0, 100.0]:
   - Cycle Score (0 - 35)
   - Bilateral Concentration & Reciprocity Score (0 - 30)
   - Telemetry Overlap Score (0 - 25)
   - Velocity Burst Score (0 - 10)
"""

import math
import logging
import threading
from typing import Dict, List, Set, Tuple, Optional, Any
from datetime import datetime, timezone, timedelta
from collections import defaultdict, deque

from app.schemas.anti_collusion import (
    TelemetryInput,
    CollusionFactorBreakdown,
    DetectedCycle,
    AccountCollusionScoreResponse,
    CollusionAuditReport,
)

logger = logging.getLogger(__name__)


class TradeRecord:
    def __init__(
        self,
        trade_id: str,
        buyer_id: int,
        seller_id: int,
        startup_id: str,
        shares: int,
        volume_dzd: int,
        timestamp: datetime,
    ):
        self.trade_id = trade_id
        self.buyer_id = buyer_id
        self.seller_id = seller_id
        self.startup_id = startup_id
        self.shares = shares
        self.volume_dzd = volume_dzd
        self.timestamp = timestamp


class AntiCollusionWashTradingEngine:
    """
    Sybil resistance and algorithmic anti-collusion wash trading engine.
    Analyzes transaction graph cycles, bilateral volume concentration,
    and client telemetry to score collusion risks.
    """

    def __init__(self):
        self._lock = threading.RLock()
        # Directed multigraph: seller -> {buyer -> list of TradeRecord}
        # In financial wash trading, shares flow from seller to buyer
        self._outgoing_trades: Dict[int, Dict[int, List[TradeRecord]]] = defaultdict(lambda: defaultdict(list))
        self._incoming_trades: Dict[int, Dict[int, List[TradeRecord]]] = defaultdict(lambda: defaultdict(list))
        self._all_trades: List[TradeRecord] = []
        self._all_users: Set[int] = set()

        # Telemetry stores
        self._user_ips: Dict[int, Set[str]] = defaultdict(set)
        self._user_fingerprints: Dict[int, Set[str]] = defaultdict(set)
        self._user_agents: Dict[int, Set[str]] = defaultdict(set)
        self._ip_to_users: Dict[str, Set[int]] = defaultdict(set)
        self._fingerprint_to_users: Dict[str, Set[int]] = defaultdict(set)

        # Disqualified or manually flagged users
        self._manually_flagged: Set[int] = set()

    def reset(self) -> None:
        """Resets all internal telemetry and graph state (primarily for test isolation)."""
        with self._lock:
            self._outgoing_trades.clear()
            self._incoming_trades.clear()
            self._all_trades.clear()
            self._all_users.clear()
            self._user_ips.clear()
            self._user_fingerprints.clear()
            self._user_agents.clear()
            self._ip_to_users.clear()
            self._fingerprint_to_users.clear()
            self._manually_flagged.clear()

    # -------------------------------------------------------------------------
    # Telemetry Ingestion
    # -------------------------------------------------------------------------

    def record_telemetry(
        self,
        user_id: int,
        ip_address: str,
        device_fingerprint: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> None:
        """Ingests client network and hardware telemetry for Sybil cluster detection."""
        with self._lock:
            self._all_users.add(user_id)
            if ip_address:
                clean_ip = ip_address.strip()
                self._user_ips[user_id].add(clean_ip)
                self._ip_to_users[clean_ip].add(user_id)
            if device_fingerprint:
                clean_fp = device_fingerprint.strip()
                self._user_fingerprints[user_id].add(clean_fp)
                self._fingerprint_to_users[clean_fp].add(user_id)
            if user_agent:
                self._user_agents[user_id].add(user_agent.strip())

    # -------------------------------------------------------------------------
    # Trade Ingestion
    # -------------------------------------------------------------------------

    def record_trade(
        self,
        buyer_id: int,
        seller_id: int,
        startup_id: str,
        shares: int,
        volume_dzd: int,
        trade_id: Optional[str] = None,
        timestamp: Optional[datetime] = None,
    ) -> TradeRecord:
        """
        Records a secondary venture share trade in the transaction graph.
        Seller transfers shares to Buyer in exchange for virtual DZD.
        """
        with self._lock:
            ts = timestamp or datetime.now(timezone.utc)
            tid = trade_id or f"ac-trade-{seller_id}-{buyer_id}-{int(ts.timestamp() * 1000)}"
            rec = TradeRecord(
                trade_id=tid,
                buyer_id=buyer_id,
                seller_id=seller_id,
                startup_id=startup_id,
                shares=shares,
                volume_dzd=volume_dzd,
                timestamp=ts,
            )

            self._outgoing_trades[seller_id][buyer_id].append(rec)
            self._incoming_trades[buyer_id][seller_id].append(rec)
            self._all_trades.append(rec)
            self._all_users.add(buyer_id)
            self._all_users.add(seller_id)
            return rec

    # -------------------------------------------------------------------------
    # Cycle Detection (Reciprocal Pairs & Circular Rings)
    # -------------------------------------------------------------------------

    def find_cycles_for_user(self, user_id: int, max_depth: int = 5) -> List[DetectedCycle]:
        """
        Detects directed transaction cycles involving user_id (seller -> buyer):
        - Length 2: A -> B and B -> A (reciprocal wash trade)
        - Length 3..N: A -> B -> C -> A (circular Sybil ring)
        """
        with self._lock:
            if user_id not in self._all_users:
                return []

            cycles: List[DetectedCycle] = []
            visited_paths: Set[Tuple[int, ...]] = set()

            # DFS search for paths starting at user_id and returning to user_id
            def dfs(curr: int, path: List[int], visited: Set[int]):
                if len(path) > max_depth:
                    return

                for nxt, trades in self._outgoing_trades.get(curr, {}).items():
                    if not trades:
                        continue
                    if nxt == user_id and len(path) >= 2:
                        # Found a cycle returning to user_id
                        cycle_tuple = tuple(path + [user_id])
                        if cycle_tuple not in visited_paths:
                            visited_paths.add(cycle_tuple)
                            # Collect volume and startups involved
                            cycle_vol = 0
                            startups = set()
                            for i in range(len(path)):
                                u = path[i]
                                v = path[i + 1] if i + 1 < len(path) else user_id
                                for tr in self._outgoing_trades.get(u, {}).get(v, []):
                                    cycle_vol += tr.volume_dzd
                                    startups.add(tr.startup_id)

                            ctype = "RECIPROCAL_PAIR" if len(path) == 2 else "CIRCULAR_RING"
                            cycles.append(
                                DetectedCycle(
                                    cycle_path=list(cycle_tuple),
                                    length=len(path),
                                    startups_involved=sorted(list(startups)),
                                    total_volume_dzd=cycle_vol,
                                    cycle_type=ctype,
                                )
                            )
                    elif nxt not in visited and len(path) < max_depth:
                        visited.add(nxt)
                        dfs(nxt, path + [nxt], visited)
                        visited.remove(nxt)

            dfs(user_id, [user_id], {user_id})
            return cycles

    # -------------------------------------------------------------------------
    # Factor Score Computations
    # -------------------------------------------------------------------------

    def compute_cycle_score(self, user_id: int) -> Tuple[float, List[DetectedCycle]]:
        """
        Computes cycle score in [0.0, 35.0]:
        - Reciprocal pairs (A <-> B) grant base 15.0 pts + volume scaling.
        - Circular rings (A -> B -> C -> A) grant base 20.0 pts + volume scaling.
        """
        cycles = self.find_cycles_for_user(user_id)
        if not cycles:
            return 0.0, []

        score = 0.0
        for cyc in cycles:
            if cyc.cycle_type == "RECIPROCAL_PAIR":
                # Reciprocal pair wash trading
                base = 15.0
                vol_bonus = min(10.0, (cyc.total_volume_dzd / 100_000.0) * 5.0)
                score += base + vol_bonus
            else:
                # Ring collusion
                base = 20.0
                vol_bonus = min(15.0, (cyc.total_volume_dzd / 100_000.0) * 7.5)
                score += base + vol_bonus

        return min(35.0, round(score, 2)), cycles

    def compute_reciprocal_volume_score(self, user_id: int) -> float:
        """
        Computes bilateral volume concentration and symmetry score in [0.0, 30.0].
        High score if an account does a dominant share of trading with a single counterparty,
        especially when buy/sell volumes are highly symmetrical (wash trading).
        """
        # Calculate total trading volume for user_id
        user_out = self._outgoing_trades.get(user_id, {})
        user_in = self._incoming_trades.get(user_id, {})

        counterparties: Set[int] = set(user_out.keys()) | set(user_in.keys())
        if not counterparties:
            return 0.0

        total_vol = 0
        pair_volumes: Dict[int, Tuple[int, int]] = {}  # cp -> (sold_vol, bought_vol)

        for cp in counterparties:
            sold = sum(t.volume_dzd for t in user_out.get(cp, []))
            bought = sum(t.volume_dzd for t in user_in.get(cp, []))
            pair_volumes[cp] = (sold, bought)
            total_vol += (sold + bought)

        if total_vol == 0:
            return 0.0

        # Maximum concentration ratio with any single counterparty
        max_concentration = 0.0
        max_symmetry_penalty = 0.0

        for cp, (sold, bought) in pair_volumes.items():
            pair_total = sold + bought
            ratio = pair_total / total_vol
            if ratio > max_concentration:
                max_concentration = ratio

            # Symmetry: 1 - (|sold - bought| / pair_total)
            # If sold == bought, symmetry is 1.0 (pure wash trading ping-pong)
            if pair_total > 0 and (sold > 0 and bought > 0):
                symmetry = 1.0 - (abs(sold - bought) / pair_total)
                symmetry_component = symmetry * ratio
                if symmetry_component > max_symmetry_penalty:
                    max_symmetry_penalty = symmetry_component

        # Concentration score: up to 18 pts
        conc_score = 0.0
        if max_concentration >= 0.8:
            conc_score = 18.0
        elif max_concentration >= 0.5:
            conc_score = 12.0
        elif max_concentration >= 0.3:
            conc_score = 5.0

        # Symmetry score: up to 12 pts
        sym_score = min(12.0, max_symmetry_penalty * 12.0)

        return min(30.0, round(conc_score + sym_score, 2))

    def compute_telemetry_score(self, user_id: int) -> Tuple[float, List[int]]:
        """
        Computes telemetry overlap score in [0.0, 25.0]:
        - If user_id shares an IP address or device fingerprint with direct trade counterparties -> 25.0 pts (CRITICAL SYBIL).
        - If user_id shares telemetry with other accounts on the platform -> 10.0 - 15.0 pts.
        """
        user_ips = self._user_ips.get(user_id, set())
        user_fps = self._user_fingerprints.get(user_id, set())

        if not user_ips and not user_fps:
            return 0.0, []

        shared_accounts: Set[int] = set()

        for ip in user_ips:
            for other_uid in self._ip_to_users.get(ip, set()):
                if other_uid != user_id:
                    shared_accounts.add(other_uid)

        for fp in user_fps:
            for other_uid in self._fingerprint_to_users.get(fp, set()):
                if other_uid != user_id:
                    shared_accounts.add(other_uid)

        if not shared_accounts:
            return 0.0, []

        # Check if user traded directly with ANY of the shared telemetry accounts
        counterparties: Set[int] = set(self._outgoing_trades.get(user_id, {}).keys()) | set(
            self._incoming_trades.get(user_id, {}).keys()
        )
        colluding_counterparties = shared_accounts.intersection(counterparties)

        if colluding_counterparties:
            # Direct trades between identical IP/fingerprint devices -> Maximum telemetry penalty
            return 25.0, sorted(list(shared_accounts))
        else:
            # Shared device/network but not directly traded yet (Sybil multi-accounting risk)
            score = min(15.0, len(shared_accounts) * 5.0)
            return round(score, 2), sorted(list(shared_accounts))

    def compute_burst_velocity_score(self, user_id: int) -> float:
        """
        Computes velocity burst score in [0.0, 10.0]:
        High score for rapid repeated trades between same accounts in tight time windows (< 60s).
        """
        user_trades = [t for t in self._all_trades if t.buyer_id == user_id or t.seller_id == user_id]
        if len(user_trades) < 2:
            return 0.0

        user_trades_sorted = sorted(user_trades, key=lambda t: t.timestamp)
        burst_count = 0

        for i in range(len(user_trades_sorted) - 1):
            t1 = user_trades_sorted[i]
            t2 = user_trades_sorted[i + 1]
            # If counterparty is the same
            cp1 = t1.buyer_id if t1.seller_id == user_id else t1.seller_id
            cp2 = t2.buyer_id if t2.seller_id == user_id else t2.seller_id

            if cp1 == cp2:
                diff_sec = abs((t2.timestamp - t1.timestamp).total_seconds())
                if diff_sec <= 60.0:
                    burst_count += 1

        if burst_count >= 5:
            return 10.0
        elif burst_count >= 2:
            return 6.0
        elif burst_count == 1:
            return 3.0
        return 0.0

    # -------------------------------------------------------------------------
    # Composite Collusion Score & Auditing
    # -------------------------------------------------------------------------

    def evaluate_collusion_score(self, user_id: int) -> AccountCollusionScoreResponse:
        """
        Computes overall composite collusion score [0.0, 100.0] and risk tier.
        Score >= 60.0 flags the account as high collusion risk.
        """
        with self._lock:
            cycle_score, cycles = self.compute_cycle_score(user_id)
            recip_score = self.compute_reciprocal_volume_score(user_id)
            telemetry_score, shared_uids = self.compute_telemetry_score(user_id)
            velocity_score = self.compute_burst_velocity_score(user_id)

            total_score = min(
                100.0,
                round(cycle_score + recip_score + telemetry_score + velocity_score, 2)
            )

            # Assign Risk Level
            if total_score >= 85.0:
                risk_level = "CONFIRMED_SYBIL_COLLUSION"
            elif total_score >= 60.0:
                risk_level = "HIGH_COLLUSION_RISK"
            elif total_score >= 25.0:
                risk_level = "MODERATE_SUSPICION"
            else:
                risk_level = "LOW_RISK"

            is_flagged = (total_score >= 60.0) or (user_id in self._manually_flagged)

            return AccountCollusionScoreResponse(
                user_id=user_id,
                collusion_score=total_score,
                risk_level=risk_level,
                is_flagged=is_flagged,
                factors=CollusionFactorBreakdown(
                    cycle_score=cycle_score,
                    reciprocal_volume_score=recip_score,
                    telemetry_overlap_score=telemetry_score,
                    burst_velocity_score=velocity_score,
                ),
                detected_cycles_count=len(cycles),
                shared_telemetry_accounts=shared_uids,
                audited_at=datetime.now(timezone.utc).isoformat(),
            )

    def is_account_flagged(self, user_id: int) -> bool:
        """Quick boolean check if user is flagged for collusion / Sybil wash trading."""
        with self._lock:
            if user_id in self._manually_flagged:
                return True
            res = self.evaluate_collusion_score(user_id)
            return res.is_flagged

    def flag_account_manually(self, user_id: int) -> None:
        """Manually flags an account for administrator sanctions or fraud investigation."""
        with self._lock:
            self._manually_flagged.add(user_id)

    def generate_audit_report(self, season_id: Optional[str] = None) -> CollusionAuditReport:
        """
        Conducts a comprehensive audit across all known trading accounts.
        Returns all detected circular rings and high-risk accounts.
        """
        with self._lock:
            high_risk: List[AccountCollusionScoreResponse] = []
            all_cycles: List[DetectedCycle] = []
            seen_cycle_tuples: Set[Tuple[int, ...]] = set()

            for uid in sorted(list(self._all_users)):
                score_res = self.evaluate_collusion_score(uid)
                if score_res.is_flagged:
                    high_risk.append(score_res)

                cycles = self.find_cycles_for_user(uid)
                for cyc in cycles:
                    cyc_tup = tuple(cyc.cycle_path)
                    if cyc_tup not in seen_cycle_tuples:
                        seen_cycle_tuples.add(cyc_tup)
                        all_cycles.append(cyc)

            return CollusionAuditReport(
                season_id=season_id,
                total_analyzed_accounts=len(self._all_users),
                flagged_accounts_count=len(high_risk),
                high_risk_accounts=high_risk,
                detected_circular_rings=all_cycles,
                audit_timestamp=datetime.now(timezone.utc).isoformat(),
            )


# Global Singleton Instance
anti_collusion_engine = AntiCollusionWashTradingEngine()
