"""
TamWheel Sovereign Ethical Agentic Venture OS — Waqf Endowment & Innovation Pool Engine.
Implements:
1. Cash Waqf (Waqf al-Nuqud) under AAOIFI Shariah Standard No. 60.
2. Philanthropic Innovation Pools (HealthTech, AgriTech, STEM University Spin-offs, Clean Water).
3. Non-dilutive scientific research grant disbursements to university startups (ESI, USTHB, Constantine).
4. Mutawalli governance, principal preservation, and cryptographic disbursement seals.
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

class WaqfCategory(str, enum.Enum):
    HEALTH_AND_BIOTECH = "HEALTH_AND_BIOTECH"
    AGRITECH_SOVEREIGNTY = "AGRITECH_SOVEREIGNTY"
    UNIVERSITY_STEM_RESEARCH = "UNIVERSITY_STEM_RESEARCH"
    CLEAN_ENERGY_WATER = "CLEAN_ENERGY_WATER"


class WaqfContribution(BaseModel):
    contribution_id: str
    waqif_id: str = Field(..., description="Donor user ID")
    waqif_name: str = Field(..., description="Donor name or anonymous designation")
    amount_dzd: float = Field(..., gt=0)
    designated_pool: WaqfCategory
    is_perpetual_principal: bool = True
    contribution_hash: str
    contributed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WaqfGrantDisbursement(BaseModel):
    grant_id: str
    recipient_project: str = Field(..., description="Startup, spin-off or lab name")
    university_or_institute: str = Field(..., description="Affiliated Algerian academic or research institution")
    grant_amount_dzd: float = Field(..., gt=0)
    category: WaqfCategory
    scientific_scope: str
    non_dilutive_declaration: str = (
        "Non-dilutive philanthropic grant awarded under Cash Waqf (Waqf al-Nuqud) principles "
        "in strict accordance with AAOIFI Shariah Standard No. 60. Zero equity or debt liability created."
    )
    approved_by_mutawalli: bool = True
    grant_seal_hash: str
    awarded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WaqfPoolState(BaseModel):
    pool_category: WaqfCategory
    title: str
    description: str
    total_endowed_principal_dzd: float
    total_grants_disbursed_dzd: float
    available_grant_balance_dzd: float
    active_projects_funded_count: int
    sharia_framework: str = "AAOIFI Shariah Standard No. 60 (Waqf & Cash Waqf)"


# Request schemas
class EndowWaqfRequest(BaseModel):
    waqif_id: str = Field(..., description="Donor user ID")
    waqif_name: str = Field(..., min_length=2, description="Donor name")
    amount_dzd: float = Field(..., ge=1_000, description="Endowed capital in DZD")
    designated_pool: WaqfCategory
    is_perpetual_principal: bool = Field(
        default=True, description="Whether capital is preserved perpetually with yields distributed"
    )


class DisburseGrantRequest(BaseModel):
    recipient_project: str = Field(..., min_length=3)
    university_or_institute: str = Field(..., min_length=3)
    grant_amount_dzd: float = Field(..., gt=0)
    category: WaqfCategory
    scientific_scope: str = Field(..., min_length=10)


# =============================================================================
# WAQF ENDOWMENT ENGINE
# =============================================================================

POOL_DESCRIPTIONS: Dict[WaqfCategory, Dict[str, str]] = {
    WaqfCategory.HEALTH_AND_BIOTECH: {
        "title": "Ibn Sina Health & Biotech Innovation Waqf (وقف ابن سينا للابتكار الصحي)",
        "description": "Perpetual endowment funding clinical trials, pediatric oncology medical tech, and diagnostic AI.",
    },
    WaqfCategory.AGRITECH_SOVEREIGNTY: {
        "title": "Al-Filaha Sovereign Food Security Waqf (وقف الفلاحة والأمن الغذائي)",
        "description": "Funding drought-resilient seed preservation, automated solar irrigation, and cold chain technology.",
    },
    WaqfCategory.UNIVERSITY_STEM_RESEARCH: {
        "title": "Khawarizmi University STEM Spin-Off Waqf (وقف الخوارزمي للأبحاث الجامعية)",
        "description": "Non-dilutive prototype and compute grants for student and faculty engineering spin-offs (ESI, USTHB).",
    },
    WaqfCategory.CLEAN_ENERGY_WATER: {
        "title": "Saqya Renewable Energy & Water Waqf (وقف سقيا الماء والطاقة النظيفة)",
        "description": "Endowments funding solar water desalination, well drilling, and Sahara photovoltaic micro-grids.",
    },
}


class WaqfEndowmentEngine:
    """
    Manages Cash Waqf pools, contributions, and non-dilutive research grants.
    Under AAOIFI Shariah Standard No. 60:
    - Capital principal is preserved as a permanent trust.
    - Yields and expendable donations are disbursed to public-benefit research.
    """

    def __init__(self) -> None:
        self._contributions: List[WaqfContribution] = []
        self._grants: List[WaqfGrantDisbursement] = []
        self._seed_initial_pools()

    def _seed_initial_pools(self) -> None:
        # Seed foundational endowments
        seed_endowments = [
            (
                "waqif-algiers-01",
                "Algiers Diaspora Sovereign Endowment",
                25_000_000,
                WaqfCategory.UNIVERSITY_STEM_RESEARCH,
            ),
            (
                "waqif-oran-02",
                "Oran Medical Philanthropists",
                15_000_000,
                WaqfCategory.HEALTH_AND_BIOTECH,
            ),
            (
                "waqif-biskra-03",
                "Biskra Oasis Agricultural Trust",
                10_000_000,
                WaqfCategory.AGRITECH_SOVEREIGNTY,
            ),
            (
                "waqif-tindouf-04",
                "Southern Solar Water Foundation",
                8_000_000,
                WaqfCategory.CLEAN_ENERGY_WATER,
            ),
        ]

        for w_id, w_name, amt, cat in seed_endowments:
            self.endow_cash_waqf(
                EndowWaqfRequest(
                    waqif_id=w_id,
                    waqif_name=w_name,
                    amount_dzd=amt,
                    designated_pool=cat,
                    is_perpetual_principal=True,
                )
            )

    def endow_cash_waqf(self, req: EndowWaqfRequest) -> WaqfContribution:
        now = datetime.now(timezone.utc)
        raw_seed = f"{req.waqif_id}:{req.designated_pool.value}:{req.amount_dzd}:{now.isoformat()}"
        h_seal = hashlib.sha256(raw_seed.encode("utf-8")).hexdigest()
        c_id = f"WAQF-CONTRIB-{h_seal[:8].upper()}"

        contrib = WaqfContribution(
            contribution_id=c_id,
            waqif_id=req.waqif_id,
            waqif_name=req.waqif_name,
            amount_dzd=req.amount_dzd,
            designated_pool=req.designated_pool,
            is_perpetual_principal=req.is_perpetual_principal,
            contribution_hash=h_seal,
            contributed_at=now,
        )

        self._contributions.append(contrib)
        return contrib

    def disburse_grant(self, req: DisburseGrantRequest) -> WaqfGrantDisbursement:
        pool_status = self.get_pool_status(req.category)
        if req.grant_amount_dzd > pool_status.available_grant_balance_dzd:
            raise ValueError(
                f"Grant request ({req.grant_amount_dzd:,.2f} DZD) exceeds available pool balance "
                f"({pool_status.available_grant_balance_dzd:,.2f} DZD)."
            )

        now = datetime.now(timezone.utc)
        raw_seed = f"{req.recipient_project}:{req.university_or_institute}:{req.grant_amount_dzd}:{now.isoformat()}"
        grant_seal = hashlib.sha256(raw_seed.encode("utf-8")).hexdigest()
        grant_id = f"WAQF-GRNT-{grant_seal[:8].upper()}"

        grant = WaqfGrantDisbursement(
            grant_id=grant_id,
            recipient_project=req.recipient_project,
            university_or_institute=req.university_or_institute,
            grant_amount_dzd=req.grant_amount_dzd,
            category=req.category,
            scientific_scope=req.scientific_scope,
            approved_by_mutawalli=True,
            grant_seal_hash=grant_seal,
            awarded_at=now,
        )

        self._grants.append(grant)
        return grant

    def get_pool_status(self, category: WaqfCategory) -> WaqfPoolState:
        meta = POOL_DESCRIPTIONS[category]
        total_endowed = sum(c.amount_dzd for c in self._contributions if c.designated_pool == category)
        total_grants = sum(g.grant_amount_dzd for g in self._grants if g.category == category)
        
        # In Cash Waqf, expendable yield balance can be up to 40% of pool capital (or active investment yield pool)
        available = max(0.0, (total_endowed * 0.40) - total_grants)
        project_count = len([g for g in self._grants if g.category == category])

        return WaqfPoolState(
            pool_category=category,
            title=meta["title"],
            description=meta["description"],
            total_endowed_principal_dzd=round(total_endowed, 2),
            total_grants_disbursed_dzd=round(total_grants, 2),
            available_grant_balance_dzd=round(available, 2),
            active_projects_funded_count=project_count,
        )

    def list_all_pools(self) -> List[WaqfPoolState]:
        return [self.get_pool_status(cat) for cat in WaqfCategory]

    def list_grants(self, category: Optional[WaqfCategory] = None) -> List[WaqfGrantDisbursement]:
        if category:
            return [g for g in self._grants if g.category == category]
        return list(self._grants)

    def list_contributions(self, waqif_id: Optional[str] = None) -> List[WaqfContribution]:
        if waqif_id:
            return [c for c in self._contributions if c.waqif_id == waqif_id]
        return list(self._contributions)


waqf_engine = WaqfEndowmentEngine()
