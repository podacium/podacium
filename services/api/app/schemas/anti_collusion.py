"""
TamWheel Sovereign Ethical Agentic Venture OS — Anti-Collusion & Sybil-Resistance Schemas.
Pillar 2 / Phase 4: Wash Trading Detection, Graph Cycles, and Collusion Scoring for Fantasy Leagues.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel


class TelemetryInput(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    user_id: int
    ip_address: str
    device_fingerprint: Optional[str] = None
    user_agent: Optional[str] = None


class CollusionFactorBreakdown(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    cycle_score: float = Field(0.0, description="Directed transaction cycle score (max 35.0)")
    reciprocal_volume_score: float = Field(0.0, description="Bilateral volume concentration & symmetry score (max 30.0)")
    telemetry_overlap_score: float = Field(0.0, description="Shared IP/device fingerprint overlap score (max 25.0)")
    burst_velocity_score: float = Field(0.0, description="Rapid round-trip velocity burst score (max 10.0)")


class DetectedCycle(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    cycle_path: List[int] = Field(..., description="Ordered list of user IDs in cycle: e.g. [A, B, A] or [A, B, C, A]")
    length: int
    startups_involved: List[str]
    total_volume_dzd: int
    cycle_type: str  # RECIPROCAL_PAIR | CIRCULAR_RING


class AccountCollusionScoreResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    user_id: int
    collusion_score: float = Field(..., ge=0.0, le=100.0, description="Composite collusion score in [0.0, 100.0]")
    risk_level: str  # LOW_RISK | MODERATE_SUSPICION | HIGH_COLLUSION_RISK | CONFIRMED_SYBIL_COLLUSION
    is_flagged: bool = Field(False, description="True if collusion_score >= 60.0")
    factors: CollusionFactorBreakdown
    detected_cycles_count: int
    shared_telemetry_accounts: List[int] = Field(default_factory=list)
    audited_at: str


class CollusionAuditReport(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    season_id: Optional[str] = None
    total_analyzed_accounts: int
    flagged_accounts_count: int
    high_risk_accounts: List[AccountCollusionScoreResponse] = Field(default_factory=list)
    detected_circular_rings: List[DetectedCycle] = Field(default_factory=list)
    audit_timestamp: str
