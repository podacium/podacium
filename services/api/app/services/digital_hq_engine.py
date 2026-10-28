"""
TamWheel Sovereign Ethical Agentic Venture OS — Founder Digital HQ (2.5D Isometric RPG Engine).
Pillar 6 / Phase 3 Expansion: Enterprise gamification of startup data rooms.
Implements 5-tier evolving digital HQ (Garage -> Sovereign Tower),
XP progression formula T(L) = 1000 * L^2, verifiable telemetry triggers,
and interactive isometric room inspectors (Server Room, Legal Safe, War Room, Finance Dept).
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# XP Triggers per Blueprint Section 20.5
XP_REWARDS = {
    "FINANCIAL_RECONCILIATION": 250,
    "RESOLVE_COMMUNITY_AMA": 50,
    "PATENT_RECEIPT": 1500,
    "MILESTONE_CLOSE": 2000,
    "KYC_VERIFIED": 500,
    "PITCH_VIDEO_POSTED": 300,
}

# 5 Digital HQ Tiers based on T(L) = 1000 * L^2
TIER_CONFIG = [
    {
        "tierLevel": 1,
        "tierNameAr": "المقر المبدئي (Garage)",
        "tierNameEn": "Garage Inception",
        "xpRequired": 1000,
        "visualSkin": "ISOMETRIC_GARAGE",
        "unlockedPlatformPerks": [
            "Public Startup Directory Listing",
            "Basic Pitch Deck Uploader",
            "Community AMA Forum",
        ],
        "hardRequirements": [],
    },
    {
        "tierLevel": 2,
        "tierNameAr": "حاضنة النماذج (Prototype Lab)",
        "tierNameEn": "Prototype Lab",
        "xpRequired": 4000,
        "visualSkin": "MODERN_INCUBATOR",
        "unlockedPlatformPerks": [
            "S4E Bounty Board Posting",
            "Startup Reels 60s Video Feed",
            "Automated GitHub Telemetry Sync",
        ],
        "hardRequirements": ["LIVE_DEMO_OR_BETA_REVIEWS"],
    },
    {
        "tierLevel": 3,
        "tierNameAr": "الجناح المعتمد (Labeled Suite)",
        "tierNameEn": "Labeled Commission Suite",
        "xpRequired": 9000,
        "visualSkin": "LABELED_COMMISSION_SUITE",
        "unlockedPlatformPerks": [
            "Official Startup Label Seal on Profile",
            "VDR Tier 2 Diligence Access",
            "Public Crowdfunding Campaign Eligibility",
        ],
        "hardRequirements": ["EXECUTIVE_DECREE_20_254_LABEL"],
    },
    {
        "tierLevel": 4,
        "tierNameAr": "مقر النمو التجاري (Traction Floor)",
        "tierNameEn": "Traction Floor",
        "xpRequired": 16000,
        "visualSkin": "EXPANSION_FLOOR",
        "unlockedPlatformPerks": [
            "Algeria Startup Fund Fast-Track Intro",
            "Private Syndicate Deal Room",
            "25% Platform Fee Discount",
        ],
        "hardRequirements": ["VERIFIED_GMV_OVER_1M_DZD"],
    },
    {
        "tierLevel": 5,
        "tierNameAr": "برج السيادة الاقتصادية (Sovereign Tower)",
        "tierNameEn": "Sovereign Tower",
        "xpRequired": 25000,
        "visualSkin": "SOVEREIGN_SKYSCRAPER",
        "unlockedPlatformPerks": [
            "ADGM/Delaware Cross-Border Feeder SPV Deployment",
            "50% Platform Fee Discount",
            "Televised Grand Tournament Showcase",
        ],
        "hardRequirements": ["EXPORT_CERTIFICATE_OR_HOLDCO"],
    },
]


class StartupHqState:
    """State container for a startup's Digital HQ RPG progression."""

    def __init__(self, startup_id: str, startup_name: str):
        self.startup_id = startup_id
        self.startup_name = startup_name
        self.total_xp: int = 1000  # Default initial XP for created startup
        self.xp_history: List[Dict[str, Any]] = [
            {
                "trigger": "FOUNDER_INCEPTION",
                "xp_awarded": 1000,
                "timestamp": time.time(),
                "proof": "Platform Onboarding Initial Inception",
            }
        ]
        self.has_startup_label: bool = False
        self.verified_gmv_dzd: int = 0
        self.has_export_cert: bool = False

        # Room telemetry custom state
        self.code_velocity_commits_week: int = 18
        self.api_uptime_pct: float = 99.95
        self.tech_stack: List[str] = ["Python", "FastAPI", "React", "PostgreSQL", "LiveKit"]
        self.cnrc_number: str = "16/00-1234567B22"
        self.inapi_patent_status: str = "PENDING_EXAMINATION"
        self.pitch_video_url: str = f"/static/videos/{startup_id}/pitch_60s.mp4"
        self.arr_dzd: int = 3_600_000
        self.burn_rate_dzd: int = 400_000
        self.runway_months: float = 14.5

    def add_xp(
        self,
        trigger: str,
        custom_xp: Optional[int] = None,
        proof: Optional[str] = None,
        now: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Awards verifiable XP and checks for level progression."""
        if now is None:
            now = time.time()
        xp_awarded = custom_xp if custom_xp is not None else XP_REWARDS.get(trigger, 100)
        self.total_xp += xp_awarded

        event = {
            "trigger": trigger,
            "xp_awarded": xp_awarded,
            "timestamp": now,
            "proof": proof or f"Verified event: {trigger}",
        }
        self.xp_history.append(event)
        logger.info(f"Digital HQ [{self.startup_id}] +{xp_awarded} XP from {trigger}. Total={self.total_xp}")
        return event

    def compute_tier(self) -> Dict[str, Any]:
        """
        Calculates current level (1 to 5), active perks, next level distance,
        and gating requirements.
        """
        current_tier = TIER_CONFIG[0]
        next_tier = TIER_CONFIG[1]

        for i, tier in enumerate(TIER_CONFIG):
            if self.total_xp >= tier["xpRequired"]:
                # Check hard requirements if applicable
                reqs_met = True
                if "EXECUTIVE_DECREE_20_254_LABEL" in tier["hardRequirements"] and not self.has_startup_label:
                    reqs_met = False
                if "VERIFIED_GMV_OVER_1M_DZD" in tier["hardRequirements"] and self.verified_gmv_dzd < 1_000_000:
                    reqs_met = False
                if "EXPORT_CERTIFICATE_OR_HOLDCO" in tier["hardRequirements"] and not self.has_export_cert:
                    reqs_met = False

                if reqs_met:
                    current_tier = tier
                    next_tier = TIER_CONFIG[i + 1] if i + 1 < len(TIER_CONFIG) else None

        current_lvl = current_tier["tierLevel"]
        next_threshold = next_tier["xpRequired"] if next_tier else current_tier["xpRequired"]
        xp_needed = max(0, next_threshold - self.total_xp) if next_tier else 0
        progress_pct = 100.0 if not next_tier else min(100.0, round((self.total_xp / next_threshold) * 100.0, 1))

        return {
            "startupId": self.startup_id,
            "startupName": self.startup_name,
            "tierLevel": current_lvl,
            "tierNameAr": current_tier["tierNameAr"],
            "tierNameEn": current_tier["tierNameEn"],
            "visualSkin": current_tier["visualSkin"],
            "totalXp": self.total_xp,
            "nextTierThreshold": next_threshold,
            "xpNeededForNextTier": xp_needed,
            "progressPct": progress_pct,
            "unlockedPlatformPerks": current_tier["unlockedPlatformPerks"],
            "unlockedPerkCount": len(current_tier["unlockedPlatformPerks"]),
        }

    def get_room_inspector(self, room_name: str) -> Dict[str, Any]:
        """
        Returns telemetry inspector payloads for:
        - server_room: Code velocity, uptime, tech stack, API latency.
        - legal_safe: NDA VDR, CNRC registration, INAPI patent status.
        - war_room: 60-second video pitch, strategy milestones.
        - finance_dept: ARR, burn rate, runway, GMV, unit economics.
        """
        key = room_name.lower().replace(" ", "_")

        if key in ("server_room", "server"):
            return {
                "room": "Server Room (غرفة السيرفرات)",
                "description": "Code velocity, cloud telemetry, and technical reliability metrics",
                "codeVelocityCommitsPerWeek": self.code_velocity_commits_week,
                "apiUptimePct": self.api_uptime_pct,
                "techStack": self.tech_stack,
                "apiLatencyMs": 42,
                "gitTelemetryStatus": "SYNCED_HEALTHY",
            }
        elif key in ("legal_safe", "legal"):
            return {
                "room": "Legal Safe (الخزنة القانونية)",
                "description": "Commercial registration, intellectual property, and NDA-gated VDR",
                "cnrcNumber": self.cnrc_number,
                "inapiPatentStatus": self.inapi_patent_status,
                "vdrNdaRequired": True,
                "statutesRegistered": True,
                "hasStartupLabel": self.has_startup_label,
                "decree20254Compliant": self.has_startup_label,
            }
        elif key in ("war_room", "war"):
            return {
                "room": "War Room (غرفة العمليات)",
                "description": "Strategic roadmap, investor deck, and founder 60s pitch video",
                "pitchVideoUrl": self.pitch_video_url,
                "pitchVideoDurationSec": 60,
                "strategyMilestones": [
                    "Q1: MVP Launch across Oran and Algiers",
                    "Q2: COSOB Participatory Round Closure",
                    "Q3: AgTech IoT Deployment in Biskra & El Oued",
                ],
                "activePitchArena": True,
            }
        elif key in ("finance_dept", "finance", "finance_department"):
            return {
                "room": "Finance Department (القسم المالي)",
                "description": "Unit economics, capital runway, and verified financial ledger",
                "arrDzd": self.arr_dzd,
                "mrrDzd": int(self.arr_dzd / 12),
                "burnRateDzd": self.burn_rate_dzd,
                "runwayMonths": self.runway_months,
                "verifiedGmvDzd": self.verified_gmv_dzd,
                "cacDzd": 1450,
                "ltvDzd": 6200,
                "ltvCacRatio": 4.28,
            }
        else:
            raise ValueError(f"Unknown isometric room '{room_name}'")


class DigitalHQEngine:
    """Singleton service managing startup RPG Digital HQs."""

    def __init__(self):
        self._hqs: Dict[str, StartupHqState] = {}

    def get_or_create_hq(self, startup_id: str, startup_name: Optional[str] = None) -> StartupHqState:
        if startup_id not in self._hqs:
            self._hqs[startup_id] = StartupHqState(
                startup_id=startup_id,
                startup_name=startup_name or f"Startup-{startup_id[:6]}",
            )
        return self._hqs[startup_id]

    def record_xp_event(
        self,
        startup_id: str,
        trigger: str,
        custom_xp: Optional[int] = None,
        proof: Optional[str] = None,
    ) -> Dict[str, Any]:
        hq = self.get_or_create_hq(startup_id)
        return hq.add_xp(trigger, custom_xp, proof)

    def get_hq_profile(self, startup_id: str) -> Dict[str, Any]:
        hq = self.get_or_create_hq(startup_id)
        tier_info = hq.compute_tier()
        return {
            **tier_info,
            "rooms": ["server_room", "legal_safe", "war_room", "finance_dept"],
            "recentXpEvents": hq.xp_history[-5:],
        }


# Global singleton instance
digital_hq_engine = DigitalHQEngine()
