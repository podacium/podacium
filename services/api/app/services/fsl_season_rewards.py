"""
TamWheel Sovereign Ethical Agentic Venture OS — Season-End Rewards & Touiza Distribution Engine.
Pillar 2 / Phase 4: Tournament Payouts, 58-Wilaya Sovereign Cup, and Simulated Startup Dividends.

Core Modules:
1. Top 100 Individual Analysts Touiza Leaderboard:
   - Rank 1: Gold Touiza Trophy (طويزة ذهبية), Partner Badge, 50,000 DZD Virtual Bonus.
   - Rank 2-10: Silver Touiza Trophy (طويزة فضية), Senior Analyst Badge, 25,000 DZD Virtual Bonus.
   - Rank 11-50: Bronze Touiza Trophy (طويزة برونزية), Analyst Badge, 10,000 DZD Virtual Bonus.
   - Rank 51-100: Touiza Honor Roll (وسام الشرف), Scout Badge, 5,000 DZD Virtual Bonus.
2. 58-Wilaya Sovereign Cup:
   - 1,000,000 DZD Touiza Grand Prize Pool distributed to the highest-scoring Wilaya cohort.
3. Continuous Startup Dividend Payouts:
   - Profitable startups declare virtual dividends per fantasy share based on simulated GMV and unit economics.
   - Automated double-entry distribution crediting backer accounts in DoubleEntrySimulationLedger.
"""

import math
import logging
import threading
from typing import List, Dict, Any, Optional, Set, Tuple
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from fastapi import HTTPException, status

from app.services.simulation_engine import (
    simulation_ledger,
    DoubleEntrySimulationLedger,
    LedgerLine,
    JournalEntry,
)
from app.services.fantasy_league import (
    fantasy_league_engine,
    FantasyStartupLeagueEngine,
)
from app.services.bonding_curve_amm import (
    bonding_curve_amm,
    ContinuousBondingCurveEngine,
)
from app.services.anti_collusion_engine import (
    anti_collusion_engine,
    AntiCollusionWashTradingEngine,
)
from app.services.portfolio_analytics import (
    WILAYA_NAMES_DZ,
    NUM_ALGERIAN_WILAYAS,
)
from app.schemas.season_rewards import (
    AnalystSeasonStanding,
    WilayaCupStanding,
    DividendPayoutReceipt,
    SeasonDistributionReport,
)

logger = logging.getLogger(__name__)

WILAYA_CUP_PRIZE_POOL_DZD: int = 1_000_000  # 1 Million DZD Touiza Grand Prize Pool


class SeasonRewardsEngine:
    """
    Algorithmic season-end payout and dividend distribution engine:
    - Top 100 Analyst Leaderboard Touiza rewards
    - 58-Wilaya Sovereign Cup cohort distribution
    - Simulated startup revenue dividends based on AMM shareholdings
    """

    def __init__(
        self,
        ledger: Optional[DoubleEntrySimulationLedger] = None,
        fantasy_engine: Optional[FantasyStartupLeagueEngine] = None,
        amm_engine: Optional[ContinuousBondingCurveEngine] = None,
        anti_collusion: Optional[AntiCollusionWashTradingEngine] = None,
    ):
        self._lock = threading.RLock()
        self.ledger: DoubleEntrySimulationLedger = ledger or simulation_ledger
        self.fantasy_engine: FantasyStartupLeagueEngine = fantasy_engine or fantasy_league_engine
        self.amm_engine: ContinuousBondingCurveEngine = amm_engine or bonding_curve_amm
        self.anti_collusion: AntiCollusionWashTradingEngine = anti_collusion or anti_collusion_engine

        # Historical distribution tracking
        self._season_reports: Dict[str, SeasonDistributionReport] = {}
        self._dividend_receipts: List[DividendPayoutReceipt] = []

        # Wilaya affiliation for users: user_id -> wilaya_code
        self._user_wilayas: Dict[int, int] = {}

    def set_user_wilaya(self, user_id: int, wilaya_code: int) -> None:
        """Sets or updates the regional Wilaya affiliation for an analyst."""
        with self._lock:
            if 1 <= wilaya_code <= NUM_ALGERIAN_WILAYAS:
                self._user_wilayas[user_id] = wilaya_code

    def get_user_wilaya(self, user_id: int) -> int:
        """Returns the user's registered Wilaya (defaults to Alger [16])."""
        with self._lock:
            return self._user_wilayas.get(user_id, 16)

    # -------------------------------------------------------------------------
    # 1. Top 100 Individual Analysts Touiza Leaderboard
    # -------------------------------------------------------------------------

    @staticmethod
    def get_rank_reward_tier(rank: int) -> Tuple[str, str, int]:
        """Returns (trophy, badge, bonus_dzd) for an individual rank."""
        if rank == 1:
            return "GOLD_TOUIZA", "PARTNER", 50_000
        elif 2 <= rank <= 10:
            return "SILVER_TOUIZA", "SENIOR_ANALYST", 25_000
        elif 11 <= rank <= 50:
            return "BRONZE_TOUIZA", "ANALYST", 10_000
        elif 51 <= rank <= 100:
            return "TOUIZA_HONOR", "SCOUT", 5_000
        else:
            return "PARTICIPANT", "NOVICE", 0

    def evaluate_season_leaderboard(
        self,
        season_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[AnalystSeasonStanding]:
        """Calculates ranked standings, Touiza trophies, and virtual bonuses for season analysts."""
        with self._lock:
            active_season = self.fantasy_engine.get_active_season()
            target_season = season_id or active_season.season_id

            leaderboard = self.fantasy_engine.get_global_leaderboard(
                season_id=target_season,
                limit=limit,
            )

            standings: List[AnalystSeasonStanding] = []
            for item in leaderboard:
                rank = item.get("rank", len(standings) + 1)
                uid = item["userId"]
                pts = float(item.get("points", 0.0))
                trophy, badge, bonus = self.get_rank_reward_tier(rank)

                # Sybil Resistance: Check if analyst is flagged for collusion
                is_flagged = self.anti_collusion.is_account_flagged(uid)
                if is_flagged:
                    standings.append(
                        AnalystSeasonStanding(
                            rank=rank,
                            user_id=uid,
                            user_name=f"Analyst #{uid}",
                            total_points=round(pts, 2),
                            trophy="REVOKED",
                            badge="DISQUALIFIED",
                            reward_dzd=0,
                            is_paid=False,
                            is_disqualified=True,
                            disqualification_reason="Disqualified: Flagged for wash trading and Sybil collusion",
                        )
                    )
                else:
                    standings.append(
                        AnalystSeasonStanding(
                            rank=rank,
                            user_id=uid,
                            user_name=f"Analyst #{uid}",
                            total_points=round(pts, 2),
                            trophy=trophy,
                            badge=badge,
                            reward_dzd=bonus,
                            is_paid=False,
                            is_disqualified=False,
                            disqualification_reason=None,
                        )
                    )

            return standings

    # -------------------------------------------------------------------------
    # 2. 58-Wilaya Sovereign Cup
    # -------------------------------------------------------------------------

    def evaluate_wilaya_cup(
        self,
        season_id: Optional[str] = None,
    ) -> List[WilayaCupStanding]:
        """
        Aggregates fantasy points across all 58 Algerian Wilayas:
        - Evaluates top regional cohort.
        - Calculates proportional distribution of the 1,000,000 DZD Grand Prize Pool.
        """
        with self._lock:
            active_season = self.fantasy_engine.get_active_season()
            target_season = season_id or active_season.season_id

            leaderboard = self.fantasy_engine.get_global_leaderboard(
                season_id=target_season,
                limit=1000,
            )

            wilaya_points: Dict[int, float] = {w: 0.0 for w in range(1, NUM_ALGERIAN_WILAYAS + 1)}
            wilaya_analysts: Dict[int, Set[int]] = {w: set() for w in range(1, NUM_ALGERIAN_WILAYAS + 1)}

            for item in leaderboard:
                uid = item["userId"]
                pts = float(item.get("points", 0.0))
                w = self.get_user_wilaya(uid)
                wilaya_points[w] += pts
                wilaya_analysts[w].add(uid)

            # Sort wilayas by total points
            sorted_wilayas = sorted(
                wilaya_points.items(),
                key=lambda x: x[1],
                reverse=True,
            )

            champion_w, champion_pts = sorted_wilayas[0] if sorted_wilayas else (16, 0.0)

            standings: List[WilayaCupStanding] = []
            for idx, (w_code, total_pts) in enumerate(sorted_wilayas, start=1):
                analysts_count = len(wilaya_analysts[w_code])
                is_champ = (idx == 1 and total_pts > 0)
                prize = WILAYA_CUP_PRIZE_POOL_DZD if is_champ else 0

                standings.append(
                    WilayaCupStanding(
                        rank=idx,
                        wilaya_code=w_code,
                        wilaya_name=WILAYA_NAMES_DZ.get(w_code, f"Wilaya {w_code}"),
                        total_points=round(total_pts, 2),
                        analysts_count=analysts_count,
                        allocated_prize_dzd=prize,
                        is_champion=is_champ,
                    )
                )

            return standings

    # -------------------------------------------------------------------------
    # 3. Simulated Startup Revenue Dividends
    # -------------------------------------------------------------------------

    def declare_and_distribute_dividends(
        self,
        startup_id: str,
        dividend_per_share_dzd: int,
        gmv_milestone_dzd: int,
        description: Optional[str] = None,
    ) -> DividendPayoutReceipt:
        """
        Declares and executes virtual dividend distribution for fantasy shareholders:
        - Queries all users holding shares in the startup's AMM bonding curve pool.
        - Calculates payout per shareholder: shares_count * dividend_per_share_dzd.
        - Records atomic double-entry journal entries crediting user cash balances.
        """
        if dividend_per_share_dzd <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dividend per share must be at least 1 DZD.",
            )

        with self._lock:
            shareholders = self.amm_engine.get_startup_shareholders(startup_id)
            total_shares = sum(shareholders.values())

            if total_shares == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"No circulating shares for startup '{startup_id}'. Cannot distribute dividends.",
                )

            total_payout = total_shares * dividend_per_share_dzd
            pool = self.amm_engine.get_or_create_pool(startup_id)
            startup_name = pool.startup_name

            # Construct zero-sum double-entry lines:
            # Debit each user's virtual cash account (increasing their balance)
            # Credit system dividend pool
            lines: List[LedgerLine] = []
            for uid, count in shareholders.items():
                payout = count * dividend_per_share_dzd
                self.ledger.issue_starter_grant(uid)
                lines.append(
                    LedgerLine(
                        account=f"USER:{uid}:VIRTUAL_CASH",
                        debit=payout,
                        credit=0,
                    )
                )

            lines.append(
                LedgerLine(
                    account=f"SYSTEM:STARTUP:{startup_id}:DIVIDEND_POOL",
                    debit=0,
                    credit=total_payout,
                )
            )

            decl_id = f"div-{startup_id}-{int(datetime.now().timestamp())}"
            entry = self.ledger.record_journal_entry(
                action="FSL_SIMULATED_DIVIDEND_PAYOUT",
                idempotency_key=decl_id,
                lines=lines,
                campaign_id=startup_id,
                metadata={
                    "startupId": startup_id,
                    "dividendPerShareDzd": dividend_per_share_dzd,
                    "gmvMilestoneDzd": gmv_milestone_dzd,
                    "totalShares": total_shares,
                    "totalPayoutDzd": total_payout,
                    "recipientsCount": len(shareholders),
                },
            )

            receipt = DividendPayoutReceipt(
                declaration_id=decl_id,
                startup_id=startup_id,
                startup_name=startup_name,
                dividend_per_share_dzd=dividend_per_share_dzd,
                total_shares_eligible=total_shares,
                total_payout_dzd=total_payout,
                recipients_count=len(shareholders),
                journal_entry_id=entry.entry_id,
                entry_hash=entry.entry_hash,
                declared_at=entry.timestamp,
            )
            self._dividend_receipts.append(receipt)
            return receipt

    # -------------------------------------------------------------------------
    # 4. Comprehensive End-of-Season Touiza Final Distribution
    # -------------------------------------------------------------------------

    def distribute_season_end_rewards(
        self,
        season_id: Optional[str] = None,
    ) -> SeasonDistributionReport:
        """
        Executes complete season-end tournament settlement:
        1. Distributes Top 100 Individual Analysts virtual bonuses.
        2. Distributes 58-Wilaya Sovereign Cup Grand Prize Pool (1,000,000 DZD).
        3. Generates immutable double-entry journal entries for all payouts.
        """
        with self._lock:
            active_season = self.fantasy_engine.get_active_season()
            target_season = season_id or active_season.season_id

            if target_season in self._season_reports:
                return self._season_reports[target_season]

            # 1. Evaluate Individual Leaderboard
            standings = self.evaluate_season_leaderboard(season_id=target_season, limit=100)

            # 2. Evaluate Wilaya Cup
            wilaya_standings = self.evaluate_wilaya_cup(season_id=target_season)
            champ_wilaya = wilaya_standings[0] if wilaya_standings else None
            champ_wilaya_name = champ_wilaya.wilaya_name if champ_wilaya else "None"

            # 3. Double-entry settlement for Top Analysts Bonuses
            total_analysts_rewards = sum(s.reward_dzd for s in standings if s.reward_dzd > 0 and not s.is_disqualified)
            bonus_lines: List[LedgerLine] = []

            for s in standings:
                if s.reward_dzd > 0 and not s.is_disqualified:
                    self.ledger.issue_starter_grant(s.user_id)
                    bonus_lines.append(
                        LedgerLine(
                            account=f"USER:{s.user_id}:VIRTUAL_CASH",
                            debit=s.reward_dzd,
                            credit=0,
                        )
                    )
                    s.is_paid = True

            if bonus_lines:
                bonus_lines.append(
                    LedgerLine(
                        account="SYSTEM:VIRTUAL_TREASURY_RESERVE",
                        debit=0,
                        credit=total_analysts_rewards,
                    )
                )
                entry_analysts = self.ledger.record_journal_entry(
                    action="FSL_SEASON_ANALYSTS_TOUIZA_PAYOUT",
                    idempotency_key=f"season-{target_season}-analysts-touiza",
                    lines=bonus_lines,
                    metadata={"seasonId": target_season, "totalRewards": total_analysts_rewards},
                )
                for s in standings:
                    if s.reward_dzd > 0:
                        s.journal_entry_id = entry_analysts.entry_id

            # 4. Double-entry settlement for Wilaya Cup Grand Prize
            total_wilaya_prize = 0
            if champ_wilaya and champ_wilaya.total_points > 0 and champ_wilaya.analysts_count > 0:
                champ_code = champ_wilaya.wilaya_code
                champ_analysts = [
                    s.user_id for s in standings if self.get_user_wilaya(s.user_id) == champ_code
                ]
                if champ_analysts:
                    per_analyst_prize = WILAYA_CUP_PRIZE_POOL_DZD // len(champ_analysts)
                    wilaya_lines: List[LedgerLine] = []
                    actual_prize_paid = 0

                    for uid in champ_analysts:
                        self.ledger.issue_starter_grant(uid)
                        wilaya_lines.append(
                            LedgerLine(
                                account=f"USER:{uid}:VIRTUAL_CASH",
                                debit=per_analyst_prize,
                                credit=0,
                                wilaya=champ_code,
                            )
                        )
                        actual_prize_paid += per_analyst_prize

                    wilaya_lines.append(
                        LedgerLine(
                            account="SYSTEM:TOUIZA_GRAND_PRIZE_POOL",
                            debit=0,
                            credit=actual_prize_paid,
                            wilaya=champ_code,
                        )
                    )
                    self.ledger.record_journal_entry(
                        action="FSL_WILAYA_CUP_GRAND_PRIZE_PAYOUT",
                        idempotency_key=f"season-{target_season}-wilaya-cup-{champ_code}",
                        lines=wilaya_lines,
                        metadata={
                            "seasonId": target_season,
                            "championWilaya": champ_code,
                            "prizePaid": actual_prize_paid,
                        },
                    )
                    total_wilaya_prize = actual_prize_paid

            # Calculate total dividends distributed this season
            total_divs = sum(r.total_payout_dzd for r in self._dividend_receipts)
            grand_total = total_analysts_rewards + total_wilaya_prize + total_divs

            report = SeasonDistributionReport(
                season_id=target_season,
                season_name=active_season.name,
                total_analysts=len(standings),
                top_analysts_rewards_dzd=total_analysts_rewards,
                wilaya_cup_champion_wilaya=champ_wilaya_name,
                wilaya_cup_prize_pool_dzd=total_wilaya_prize,
                total_dividends_distributed_dzd=total_divs,
                grand_total_distributed_dzd=grand_total,
                top_10_analysts=standings[:10],
                wilaya_standings=wilaya_standings[:10],
                journal_entries_count=len(self.ledger._chain),
                distributed_at=datetime.now(timezone.utc).isoformat(),
            )
            self._season_reports[target_season] = report
            return report

    def get_season_report(self, season_id: str) -> Optional[SeasonDistributionReport]:
        """Returns settlement report for a distributed season."""
        with self._lock:
            return self._season_reports.get(season_id)

    def list_dividend_receipts(self) -> List[DividendPayoutReceipt]:
        """Returns all historical startup dividend declarations."""
        with self._lock:
            return list(self._dividend_receipts)


# Global Singleton Instance
season_rewards_engine = SeasonRewardsEngine()
