"""
TamWheel Sovereign Ethical Agentic Venture OS — Season-End Rewards & Touiza Schemas.
Pillar 2 / Phase 4: Season-End Tournament Distribution, 58-Wilaya Cup, and Simulated Dividends.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel


class AnalystSeasonStanding(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    rank: int
    user_id: int
    user_name: Optional[str] = "Anonymous Analyst"
    total_points: float
    trophy: str  # GOLD_TOUIZA | SILVER_TOUIZA | BRONZE_TOUIZA | TOUIZA_HONOR | PARTICIPANT
    badge: str
    reward_dzd: int
    is_paid: bool = False
    is_disqualified: bool = False
    disqualification_reason: Optional[str] = None
    journal_entry_id: Optional[str] = None


class WilayaCupStanding(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    rank: int
    wilaya_code: int
    wilaya_name: str
    total_points: float
    analysts_count: int
    allocated_prize_dzd: int
    is_champion: bool = False


class DividendDeclarationRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    startup_id: str = Field(..., description="Startup declaring virtual dividends")
    dividend_per_share_dzd: int = Field(..., ge=1, description="Dividend per fantasy share held in DZD")
    gmv_milestone_dzd: int = Field(..., ge=100000, description="Achieved simulated GMV milestone")
    description: Optional[str] = Field(None, description="Optional dividend distribution note")


class DividendPayoutReceipt(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    declaration_id: str
    startup_id: str
    startup_name: str
    dividend_per_share_dzd: int
    total_shares_eligible: int
    total_payout_dzd: int
    recipients_count: int
    journal_entry_id: str
    entry_hash: str
    declared_at: str


class SeasonDistributionReport(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    season_id: str
    season_name: str
    total_analysts: int
    top_analysts_rewards_dzd: int
    wilaya_cup_champion_wilaya: str
    wilaya_cup_prize_pool_dzd: int
    total_dividends_distributed_dzd: int
    grand_total_distributed_dzd: int
    top_10_analysts: List[AnalystSeasonStanding]
    wilaya_standings: List[WilayaCupStanding]
    journal_entries_count: int
    distributed_at: str
