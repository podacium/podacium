"""
TamWheel Sovereign Ethical Agentic Venture OS — Micro-Sukuk Revenue Share Engine.
Implements:
1. AAOIFI Shariah Standard No. 17 (Investment Sukuk) & Standard No. 13 (Mudarabah).
2. Fractional Micro-Sukuk Al-Istithmar / Al-Musharakah issuance tied to monthly gross revenue.
3. Cryptographic issuance seals and periodic revenue distribution ledger entries.
4. Mudarib incentive bonus (Ju'ala) capping mechanisms above hurdle rate.
"""

from __future__ import annotations

import enum
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS & MODELS
# =============================================================================

class SukukContractType(str, enum.Enum):
    SUKUK_AL_ISTITHMAR = "SUKUK_AL_ISTITHMAR"       # Investment Agency / Mudarabah venture growth
    SUKUK_AL_MUSHARAKAH = "SUKUK_AL_MUSHARAKAH"     # Enterprise revenue-sharing partnership
    SUKUK_AL_IJARAH = "SUKUK_AL_IJARAH"             # Usufruct / Asset-backed revenue streaming


class SukukStatus(str, enum.Enum):
    OFFERING = "OFFERING"
    ACTIVE = "ACTIVE"
    MATURED = "MATURED"
    DEFAULTED = "DEFAULTED"


class SukukDistributionEntry(BaseModel):
    distribution_id: str
    period_number: int
    period_label: str = Field(..., description="e.g. '2026-M10' or 'Q3-2026'")
    verified_gross_revenue_dzd: float
    revenue_share_pct: float
    total_distributable_dzd: float
    distribution_per_certificate_dzd: float
    mudarib_incentive_bonus_dzd: float = Field(0.0, description="Incentive performance bonus to founder above hurdle")
    distribution_audit_hash: str
    distributed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class IssueSukukRequest(BaseModel):
    startup_id: str = Field(..., description="Unique startup or enterprise ID")
    startup_name: str = Field(..., description="Startup name")
    sukuk_name: str = Field(..., min_length=5, description="Official title of the Sukuk issuance")
    purpose: str = Field(..., min_length=15, description="Clear statement of underlying asset deployment")
    contract_type: SukukContractType = Field(default=SukukContractType.SUKUK_AL_ISTITHMAR)
    total_issuance_amount_dzd: float = Field(..., ge=100_000, description="Total capital raise via Sukuk in DZD")
    par_value_per_certificate_dzd: float = Field(default=10_000, ge=1_000, description="Face value per token certificate")
    revenue_share_pct: float = Field(..., ge=0.5, le=25.0, description="Monthly gross revenue sharing fraction (e.g. 4.0%)")
    target_annual_irr_pct: float = Field(..., ge=5.0, le=40.0, description="Target annual expected yield hurdle")
    hurdle_cap_annual_irr_pct: Optional[float] = Field(
        None, ge=10.0, le=60.0, description="Cap beyond which excess revenue flows to founder as Mudarib incentive"
    )
    tenor_months: int = Field(..., ge=6, le=60, description="Issuance duration in months")


class SukukIssuance(BaseModel):
    sukuk_id: str
    issuance_seal_hash: str
    startup_id: str
    startup_name: str
    sukuk_name: str
    purpose: str
    contract_type: SukukContractType
    total_issuance_amount_dzd: float
    par_value_per_certificate_dzd: float
    total_certificates: int
    revenue_share_pct: float
    target_annual_irr_pct: float
    hurdle_cap_annual_irr_pct: Optional[float]
    tenor_months: int
    status: SukukStatus = SukukStatus.ACTIVE
    total_distributions_paid_dzd: float = 0.0
    distributions_count: int = 0
    distributions_history: List[SukukDistributionEntry] = Field(default_factory=list)
    sharia_supervisory_seal: str = "Tamwheel Sovereign Sharia Protocol — AAOIFI Standard No. 17 Compliant"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RecordDistributionRequest(BaseModel):
    period_number: int = Field(..., ge=1)
    period_label: str = Field(..., min_length=3)
    verified_gross_revenue_dzd: float = Field(..., ge=0, description="Audited or telemetry-verified monthly gross revenue")


# =============================================================================
# MICRO-SUKUK REVENUE SHARE ENGINE
# =============================================================================

class MicroSukukRevenueShareEngine:
    """
    Manages fractional Islamic Sukuk certificates tied directly to commercial revenue streams.
    Under AAOIFI Standard No. 17:
    - Capital providers bear enterprise risk.
    - No guaranteed principal or fixed interest coupons.
    - Yield streams directly as a percentage of verified revenue.
    """

    def __init__(self) -> None:
        self._issuances: Dict[str, SukukIssuance] = {}

    def issue_sukuk(self, req: IssueSukukRequest) -> SukukIssuance:
        total_certificates = int(req.total_issuance_amount_dzd / req.par_value_per_certificate_dzd)
        if total_certificates <= 0:
            raise ValueError("Total certificates must be greater than zero.")

        now = datetime.now(timezone.utc)
        raw_seed = f"{req.startup_id}:{req.sukuk_name}:{req.total_issuance_amount_dzd}:{now.isoformat()}"
        seal_hash = hashlib.sha256(raw_seed.encode("utf-8")).hexdigest()
        sukuk_id = f"SKK-{req.startup_id[:6].upper()}-{seal_hash[:8].upper()}"

        issuance = SukukIssuance(
            sukuk_id=sukuk_id,
            issuance_seal_hash=seal_hash,
            startup_id=req.startup_id,
            startup_name=req.startup_name,
            sukuk_name=req.sukuk_name,
            purpose=req.purpose,
            contract_type=req.contract_type,
            total_issuance_amount_dzd=req.total_issuance_amount_dzd,
            par_value_per_certificate_dzd=req.par_value_per_certificate_dzd,
            total_certificates=total_certificates,
            revenue_share_pct=req.revenue_share_pct,
            target_annual_irr_pct=req.target_annual_irr_pct,
            hurdle_cap_annual_irr_pct=req.hurdle_cap_annual_irr_pct,
            tenor_months=req.tenor_months,
            status=SukukStatus.ACTIVE,
        )

        self._issuances[sukuk_id] = issuance
        return issuance

    def record_distribution(self, sukuk_id: str, req: RecordDistributionRequest) -> SukukDistributionEntry:
        issuance = self._issuances.get(sukuk_id)
        if not issuance:
            raise KeyError(f"Sukuk issuance '{sukuk_id}' not found.")

        if issuance.status != SukukStatus.ACTIVE:
            raise ValueError(f"Cannot distribute revenue on Sukuk in state '{issuance.status.value}'.")

        # Gross revenue share calculation
        raw_share = issuance.revenue_share_pct / 100.0
        potential_pool = req.verified_gross_revenue_dzd * raw_share

        mudarib_bonus = 0.0
        # Check hurdle cap if specified (monthly equivalent)
        if issuance.hurdle_cap_annual_irr_pct is not None:
            monthly_cap_rate = (issuance.hurdle_cap_annual_irr_pct / 100.0) / 12.0
            max_monthly_pool = issuance.total_issuance_amount_dzd * monthly_cap_rate
            if potential_pool > max_monthly_pool:
                mudarib_bonus = potential_pool - max_monthly_pool
                distributable_pool = max_monthly_pool
            else:
                distributable_pool = potential_pool
        else:
            distributable_pool = potential_pool

        per_cert = distributable_pool / issuance.total_certificates

        now = datetime.now(timezone.utc)
        dist_raw = f"{sukuk_id}:{req.period_number}:{distributable_pool}:{now.isoformat()}"
        dist_hash = hashlib.sha256(dist_raw.encode("utf-8")).hexdigest()
        dist_id = f"DIST-{sukuk_id[:8]}-P{req.period_number}-{dist_hash[:6]}"

        entry = SukukDistributionEntry(
            distribution_id=dist_id,
            period_number=req.period_number,
            period_label=req.period_label,
            verified_gross_revenue_dzd=round(req.verified_gross_revenue_dzd, 2),
            revenue_share_pct=issuance.revenue_share_pct,
            total_distributable_dzd=round(distributable_pool, 2),
            distribution_per_certificate_dzd=round(per_cert, 4),
            mudarib_incentive_bonus_dzd=round(mudarib_bonus, 2),
            distribution_audit_hash=dist_hash,
            distributed_at=now,
        )

        issuance.distributions_history.append(entry)
        issuance.total_distributions_paid_dzd += entry.total_distributable_dzd
        issuance.distributions_count += 1

        if issuance.distributions_count >= issuance.tenor_months:
            issuance.status = SukukStatus.MATURED

        return entry

    def get_sukuk(self, sukuk_id: str) -> Optional[SukukIssuance]:
        return self._issuances.get(sukuk_id)

    def list_sukuk(self, startup_id: Optional[str] = None) -> List[SukukIssuance]:
        results = list(self._issuances.values())
        if startup_id:
            results = [s for s in results if s.startup_id == startup_id]
        return results


sukuk_engine = MicroSukukRevenueShareEngine()
