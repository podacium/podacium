"""
TamWheel Sovereign Ethical Agentic Venture OS — Viral Growth & Brag Engine (K=1.48).
Section 13.4 & 14: High-Status Viral Loops, Multiplayer Growth, and Collective Wilaya Milestone Grants.

Core Components:
1. Dynamic Visual Brag Cards Generator:
   - High-status visual share cards formatted in:
     - 1.91:1 Landscape (1200x628) for LinkedIn & Twitter/X.
     - 9:16 Vertical (1080x1920) for Instagram Stories, TikTok & WhatsApp Status.
   - Four Card Flavors: FOUNDING_BACKER, INVESTMENT_THESIS, FANTASY_CHAMPION, WILAYA_PATRIOT.
   - Authentic localized share texts in Algerian Darija, Standard Arabic, French, and English.
   - Deep-link QR code payload and metadata.
2. Viral Coefficient K = 1.48 Mathematical Growth Model:
   - K = K_thesis (0.42) + K_squad (0.58) + K_fantasy (0.36) + K_wilaya (0.12) = 1.48.
   - Compound organic network expansion projection (K > 1.0).
3. VIP 48-Hour Early Allocation Window Tracker:
   - Priority 48-hour allocation window unlocks when a user refers >= 3 verified analysts.
4. Real-Time Wilaya Collective Milestone Grant Triggers:
   - Community milestone triggers (e.g. "If 50 backers from Sétif back X, unlock 500k DZD non-dilutive grant").
"""

import math
import hashlib
import logging
import threading
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from fastapi import HTTPException, status

from app.services.portfolio_analytics import (
    WILAYA_NAMES_DZ,
    NUM_ALGERIAN_WILAYAS,
)

logger = logging.getLogger(__name__)

# =============================================================================
# K-FACTOR MATHEMATICAL CONSTANTS
# =============================================================================

K_THESIS: float = 0.42     # High-conviction thesis brag cards (LinkedIn / Twitter)
K_SQUAD: float = 0.58      # Multiplayer diligence squads & syndicates (3-25 members)
K_FANTASY: float = 0.36    # Fantasy startup league mini-leagues (University, Regional)
K_WILAYA: float = 0.12     # Collective Wilaya milestones & regional pride challenges
K_TOTAL: float = round(K_THESIS + K_SQUAD + K_FANTASY + K_WILAYA, 2)  # 1.48

VIP_REFERRALS_THRESHOLD: int = 3
VIP_EARLY_ACCESS_HOURS: int = 48


# =============================================================================
# DATA MODELS
# =============================================================================

class BragCardMetadata(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    card_id: str
    card_type: str  # FOUNDING_BACKER | INVESTMENT_THESIS | FANTASY_CHAMPION | WILAYA_PATRIOT
    aspect_ratio: str  # 1.91:1 | 9:16
    dimensions: Dict[str, int]
    title: str
    headline: str
    subheadline: str
    user_name: str
    user_tier: str
    wilaya_code: int
    wilaya_name: str
    theme_colors: Dict[str, str]
    share_texts: Dict[str, str]  # darija, arabic, french, english
    deep_link_url: str
    qr_code_payload: str
    generated_at: str


class ViralKFactorModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    k_total: float
    is_exponential_growth: bool
    components: Dict[str, Dict[str, Any]]
    projections: List[Dict[str, Any]]
    interpretation: str


class VipStatusResult(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    user_id: int
    referral_code: str
    total_referrals: int
    verified_analysts_count: int
    threshold_required: int = VIP_REFERRALS_THRESHOLD
    is_vip_unlocked: bool
    early_access_hours: int = VIP_EARLY_ACCESS_HOURS
    share_url: str
    message: str


class WilayaMilestone(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    milestone_id: str
    startup_id: str
    startup_name: str
    wilaya_code: int
    wilaya_name: str
    target_backers_count: int
    current_backers_count: int
    grant_amount_dzd: int
    sponsor_name: str
    status: str  # ACTIVE | UNLOCKED
    progress_pct: float
    unlocked_at: Optional[str] = None
    created_at: str


# =============================================================================
# VIRAL GROWTH ENGINE IMPLEMENTATION
# =============================================================================

class ViralGrowthEngine:
    """
    Core engine powering TamWheel's consumer FinTech viral loops:
    - Brag Cards with authentic Algerian vernacular localization
    - Mathematical K = 1.48 organic growth compounding
    - VIP 48-Hour Early Access Allocations
    - Wilaya Collective Milestone Grant Triggers
    """

    def __init__(self):
        self._lock = threading.RLock()

        # Referral graph: referrer_id -> set of referee user_ids
        self._referrals: Dict[int, Set[int]] = {}
        # Verified analyst IDs (referees who completed financial literacy or pledged)
        self._verified_referees: Set[int] = set()

        # Wilaya collective milestones registry: milestone_id -> dict
        self._milestones: Dict[str, Dict[str, Any]] = {}
        # Milestone backers: milestone_id -> set of user_ids
        self._milestone_backers: Dict[str, Set[int]] = {}

        self._seed_default_milestones()

    def _seed_default_milestones(self) -> None:
        """Seeds initial collective Wilaya milestone grant challenges."""
        default_items = [
            {
                "milestone_id": "ms-setif-greenfarm",
                "startup_id": "startup-greenfarm",
                "startup_name": "GreenFarm AI",
                "wilaya_code": 19,
                "wilaya_name": "Sétif",
                "target_backers_count": 50,
                "grant_amount_dzd": 500_000,
                "sponsor_name": "Sétif High-Plateaus Angel Syndicate",
            },
            {
                "milestone_id": "ms-oran-solartech",
                "startup_id": "startup-solartech",
                "startup_name": "SolarTech Oran",
                "wilaya_code": 31,
                "wilaya_name": "Oran",
                "target_backers_count": 40,
                "grant_amount_dzd": 600_000,
                "sponsor_name": "Western Innovation Foundation (Oran)",
            },
            {
                "milestone_id": "ms-ghardaia-saharasolar",
                "startup_id": "startup-saharasolar",
                "startup_name": "Sahara Water IoT",
                "wilaya_code": 47,
                "wilaya_name": "Ghardaïa",
                "target_backers_count": 25,
                "grant_amount_dzd": 750_000,
                "sponsor_name": "Mzab Valley Sovereign Water Endowment",
            },
        ]
        for m in default_items:
            m_id = m["milestone_id"]
            self._milestones[m_id] = {
                **m,
                "status": "ACTIVE",
                "unlocked_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self._milestone_backers[m_id] = set()

    # -------------------------------------------------------------------------
    # Visual Brag Cards Generator
    # -------------------------------------------------------------------------

    @staticmethod
    def generate_referral_code(user_id: int) -> str:
        """Deterministically generates a shareable user referral code."""
        digest = hashlib.sha256(f"tamwheel-salt:{user_id}".encode()).hexdigest()[:6].upper()
        return f"TAM-{user_id}-{digest}"

    def generate_brag_card(
        self,
        user_id: int,
        user_name: str,
        card_type: str = "FOUNDING_BACKER",
        aspect_ratio: str = "1.91:1",
        startup_name: str = "GreenFarm AI",
        startup_id: str = "startup-greenfarm",
        wilaya_code: int = 16,
        user_tier: str = "SCOUT",
        amount_dzd: int = 10_000,
        fantasy_rank: int = 4,
        fantasy_sp: int = 850,
    ) -> BragCardMetadata:
        """
        Generates high-status visual brag card metadata with authentic multilingual copy.
        Supported aspect ratios:
        - 1.91:1 (1200 x 628) for LinkedIn & Twitter/X.
        - 9:16 (1080 x 1920) for Instagram Stories, TikTok & WhatsApp Status.
        """
        valid_ratios = {"1.91:1", "9:16"}
        if aspect_ratio not in valid_ratios:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid aspect ratio '{aspect_ratio}'. Valid ratios: {list(valid_ratios)}",
            )

        valid_types = {"FOUNDING_BACKER", "INVESTMENT_THESIS", "FANTASY_CHAMPION", "WILAYA_PATRIOT"}
        card_upper = card_type.upper()
        if card_upper not in valid_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid card type '{card_type}'. Valid types: {list(valid_types)}",
            )

        wilaya_name = WILAYA_NAMES_DZ.get(wilaya_code, "Alger")
        ref_code = self.generate_referral_code(user_id)
        card_id = f"card-{user_id}-{card_upper.lower()}-{hashlib.md5(f'{datetime.now()}'.encode()).hexdigest()[:8]}"

        # Dimensions
        if aspect_ratio == "1.91:1":
            dims = {"width": 1200, "height": 628}
        else:
            dims = {"width": 1080, "height": 1920}

        # Theme palettes
        theme_palettes = {
            "FOUNDING_BACKER": {"primary": "#0A192F", "accent": "#FFD700", "badge": "#10B981"},  # Navy + Gold + Emerald
            "INVESTMENT_THESIS": {"primary": "#1E1B4B", "accent": "#38BDF8", "badge": "#818CF8"},  # Deep Indigo + Cyan
            "FANTASY_CHAMPION": {"primary": "#0F172A", "accent": "#F59E0B", "badge": "#EF4444"},  # Slate + Amber + Coral
            "WILAYA_PATRIOT": {"primary": "#064E3B", "accent": "#34D399", "badge": "#FBBF24"},  # Algerian Green + Mint + Gold
        }
        theme = theme_palettes[card_upper]

        # Multilingual vernacular copy
        if card_upper == "FOUNDING_BACKER":
            headline = f"مساهم مؤسس في {startup_name}"
            subheadline = f"مستثمر افتراضي معتمد • ولاية {wilaya_name} • {amount_dzd:,} دج".replace(",", ".")
            texts = {
                "darija": f"درت رهان على مستقبل {startup_name} في ولاية {wilaya_name} مع تمويل! فكرة واعرة بزاف 🚀🇩🇿 استثمر قبلي وادخل للشلة!",
                "arabic": f"فخور بكوني مساهماً مؤسساً في {startup_name} (ولاية {wilaya_name}) عبر منصة تمويل. انضم إلى فريقي الاستثماري!",
                "french": f"Fier d'être investisseur fondateur de {startup_name} ({wilaya_name}) sur TamWheel. Soutenons nos pépites algériennes !",
                "english": f"Proud to back {startup_name} ({wilaya_name}) on TamWheel Sovereign Venture OS. Join my syndicate!",
            }
        elif card_upper == "INVESTMENT_THESIS":
            headline = f"أطروحة استثمارية: {startup_name}"
            subheadline = f"مستوى المحلل: {user_tier} • قناعة عالية في قطاع التكنولوجيا"
            texts = {
                "darija": f"هادي أطروحتي الاستثمارية على {startup_name}. الأرقام تحكي وحدها والنمو متفجر! واش رايك في التحليل؟ 💡🇩🇿",
                "arabic": f"نشرت أطروحتي الاستثمارية المدققة حول شركة {startup_name} عبر تمويل. اطلع على تقرير الفحص النافي للجهالة.",
                "french": f"Découvrez ma thèse d'investissement sur {startup_name} via TamWheel. Données vérifiées et analyse d'impact.",
                "english": f"Check out my verified investment thesis on {startup_name} via TamWheel. High-growth sovereign startup potential.",
            }
        elif card_upper == "FANTASY_CHAMPION":
            headline = f"المرتبة #{fantasy_rank} في دوري الستارت أب الخيالي"
            subheadline = f"رصيد النقاط: {fantasy_sp} SP • الدوري الجزائري للمؤسسات الناشئة"
            texts = {
                "darija": f"جبت المرتبة #{fantasy_rank} في دوري تمويل للستارت أب برصيد {fantasy_sp} نقطة! شكون يقدر يفوتني هذا الأسبوع؟ 🏆🇩🇿",
                "arabic": f"حققت المرتبة #{fantasy_rank} في دوري الستارت أب الخيالي برصيد {fantasy_sp} نقطة. تحداني وأنشئ تشكيلتك الخماسية!",
                "french": f"Classé #{fantasy_rank} dans la Fantasy Startup League de TamWheel avec {fantasy_sp} SP ! Qui relève le défi ?",
                "english": f"Ranked #{fantasy_rank} in TamWheel Fantasy Startup League with {fantasy_sp} SP! Assemble your 5-startup dream team.",
            }
        else:  # WILAYA_PATRIOT
            headline = f"سفير الابتكار بولاية {wilaya_name}"
            subheadline = f"دعم رأس المال المحلي في ولاية {wilaya_name} ({wilaya_code}) • فخر محلي"
            texts = {
                "darija": f"ناس {wilaya_name} حاضرين بقوة في تمويل! رانا ندعمو ولاد بلادنا والمشاريع اللي تخدم الولاية 🇩🇿💪",
                "arabic": f"أقود الدعم الاستثماري للشركات الناشئة في ولاية {wilaya_name}. معاً نبني الاقتصاد السيادي.",
                "french": f"Mobilisons le capital et l'énergie de la Wilaya de {wilaya_name} pour nos startups locales sur TamWheel !",
                "english": f"Championing local venture innovation in Wilaya {wilaya_name} on TamWheel. Local pride meets sovereign scale.",
            }

        deep_link = f"https://tamwheel.dz/ref/{ref_code}?campaign={startup_id}&card={card_upper.lower()}&v=1"

        return BragCardMetadata(
            card_id=card_id,
            card_type=card_upper,
            aspect_ratio=aspect_ratio,
            dimensions=dims,
            title=f"TamWheel Brag Card — {card_upper}",
            headline=headline,
            subheadline=subheadline,
            user_name=user_name,
            user_tier=user_tier,
            wilaya_code=wilaya_code,
            wilaya_name=wilaya_name,
            theme_colors=theme,
            share_texts=texts,
            deep_link_url=deep_link,
            qr_code_payload=deep_link,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    # -------------------------------------------------------------------------
    # K = 1.48 Growth Model & Simulations
    # -------------------------------------------------------------------------

    @staticmethod
    def calculate_k_factor_model(initial_users: int = 1000, cycles: int = 5) -> ViralKFactorModel:
        """
        Computes the viral coefficient K = 1.48 mathematical model and exponential projection.
        K = K_thesis (0.42) + K_squad (0.58) + K_fantasy (0.36) + K_wilaya (0.12) = 1.48.
        Formula for cumulative users after t cycles:
        N_t = N_0 * (K^(t+1) - 1) / (K - 1)
        """
        k = K_TOTAL
        components = {
            "thesisBragCards": {
                "kValue": K_THESIS,
                "sharePct": round((K_THESIS / k) * 100.0, 1),
                "channel": "LinkedIn, Twitter/X, Professional Diaspora",
                "mechanic": "High-status diligence thesis and investment brag cards",
            },
            "multiplayerSquads": {
                "kValue": K_SQUAD,
                "sharePct": round((K_SQUAD / k) * 100.0, 1),
                "channel": "WhatsApp Groups, Peer Syndicates, Family & Friends",
                "mechanic": "Collaborative diligence canvas & consensus pooled allocations",
            },
            "fantasyStartupLeague": {
                "kValue": K_FANTASY,
                "sharePct": round((K_FANTASY / k) * 100.0, 1),
                "channel": "University Circles (ESI, USTHB), Discord, Telegram",
                "mechanic": "Weekly pitch broadcast gameweek bragging & private mini-leagues",
            },
            "wilayaCollectiveMilestones": {
                "kValue": K_WILAYA,
                "sharePct": round((K_WILAYA / k) * 100.0, 1),
                "channel": "Local Wilaya Chambers of Commerce, Regional Tech Groups",
                "mechanic": "Collective backer threshold unlock for matching grants",
            },
        }

        # Calculate cycle projections
        projections = []
        cumulative_users = initial_users
        current_cycle_new_users = initial_users

        projections.append({
            "cycle": 0,
            "newUsers": initial_users,
            "cumulativeUsers": initial_users,
            "viralMultiplier": 1.0,
        })

        for cycle in range(1, cycles + 1):
            current_cycle_new_users = int(current_cycle_new_users * k)
            cumulative_users += current_cycle_new_users
            projections.append({
                "cycle": cycle,
                "newUsers": current_cycle_new_users,
                "cumulativeUsers": cumulative_users,
                "viralMultiplier": round(cumulative_users / max(1, initial_users), 2),
            })

        interpretation = (
            f"TamWheel achieves a composite viral coefficient K = {k:.2f} > 1.0. "
            "Because K exceeds the critical percolation threshold of 1.0, the platform experiences self-sustaining "
            "exponential organic expansion without requiring paid marketing expenditure."
        )

        return ViralKFactorModel(
            k_total=k,
            is_exponential_growth=(k > 1.0),
            components=components,
            projections=projections,
            interpretation=interpretation,
        )

    # -------------------------------------------------------------------------
    # VIP 48-Hour Early Allocation Window Tracker
    # -------------------------------------------------------------------------

    def record_referral(self, referrer_id: int, referee_id: int, is_verified: bool = True) -> Dict[str, Any]:
        """Records a successful user referral, checking eligibility for VIP early access."""
        if referrer_id == referee_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Self-referrals are strictly prohibited.",
            )

        with self._lock:
            ref_set = self._referrals.setdefault(referrer_id, set())
            ref_set.add(referee_id)
            if is_verified:
                self._verified_referees.add(referee_id)

            verified_count = sum(1 for uid in ref_set if uid in self._verified_referees)
            is_vip = verified_count >= VIP_REFERRALS_THRESHOLD

            return {
                "success": True,
                "referrerId": referrer_id,
                "refereeId": referee_id,
                "totalReferrals": len(ref_set),
                "verifiedAnalystsCount": verified_count,
                "isVipUnlocked": is_vip,
                "message": (
                    f"Referral verified! {verified_count}/{VIP_REFERRALS_THRESHOLD} required for 48h VIP allocation window."
                ),
            }

    def get_vip_status(self, user_id: int) -> VipStatusResult:
        """Returns the user's referral progress and 48-hour VIP window unlock state."""
        with self._lock:
            ref_set = self._referrals.get(user_id, set())
            verified_count = sum(1 for uid in ref_set if uid in self._verified_referees)
            is_vip = verified_count >= VIP_REFERRALS_THRESHOLD
            ref_code = self.generate_referral_code(user_id)
            share_url = f"https://tamwheel.dz/join?ref={ref_code}"

            if is_vip:
                msg = "VIP 48-Hour Early Access Window Unlocked! You receive first-look access to private deal rooms."
            else:
                remaining = VIP_REFERRALS_THRESHOLD - verified_count
                msg = f"Refer {remaining} more active analyst(s) to unlock the VIP 48-Hour Early Access Window."

            return VipStatusResult(
                user_id=user_id,
                referral_code=ref_code,
                total_referrals=len(ref_set),
                verified_analysts_count=verified_count,
                threshold_required=VIP_REFERRALS_THRESHOLD,
                is_vip_unlocked=is_vip,
                early_access_hours=VIP_EARLY_ACCESS_HOURS,
                share_url=share_url,
                message=msg,
            )

    def can_access_campaign_early(
        self, user_id: int, campaign_launch_at_iso: str, current_time: Optional[datetime] = None
    ) -> bool:
        """
        Determines if user can commit to a campaign:
        - If campaign is already live: accessible to everyone.
        - If campaign launch is within 48 hours: accessible ONLY if user has VIP status.
        - If campaign launch is > 48 hours away: inaccessible to all.
        """
        now = current_time or datetime.now(timezone.utc)
        launch_dt = datetime.fromisoformat(campaign_launch_at_iso.replace("Z", "+00:00"))

        # Already publicly launched
        if now >= launch_dt:
            return True

        # Within the 48-hour pre-launch window
        window_start = launch_dt - timedelta(hours=VIP_EARLY_ACCESS_HOURS)
        if now >= window_start:
            vip_res = self.get_vip_status(user_id)
            return vip_res.is_vip_unlocked

        return False

    # -------------------------------------------------------------------------
    # Real-Time Wilaya Collective Milestone Grant Triggers
    # -------------------------------------------------------------------------

    def create_wilaya_milestone(
        self,
        startup_id: str,
        startup_name: str,
        wilaya_code: int,
        target_backers_count: int,
        grant_amount_dzd: int,
        sponsor_name: str,
    ) -> WilayaMilestone:
        """Creates a new collective Wilaya milestone challenge."""
        with self._lock:
            wilaya_name = WILAYA_NAMES_DZ.get(wilaya_code, f"Wilaya {wilaya_code}")
            m_id = f"ms-{wilaya_code}-{startup_id}-{hashlib.md5(str(datetime.now()).encode()).hexdigest()[:6]}"

            m_dict = {
                "milestone_id": m_id,
                "startup_id": startup_id,
                "startup_name": startup_name,
                "wilaya_code": wilaya_code,
                "wilaya_name": wilaya_name,
                "target_backers_count": target_backers_count,
                "grant_amount_dzd": grant_amount_dzd,
                "sponsor_name": sponsor_name,
                "status": "ACTIVE",
                "unlocked_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self._milestones[m_id] = m_dict
            self._milestone_backers[m_id] = set()

            return WilayaMilestone(
                milestone_id=m_id,
                startup_id=startup_id,
                startup_name=startup_name,
                wilaya_code=wilaya_code,
                wilaya_name=wilaya_name,
                target_backers_count=target_backers_count,
                current_backers_count=0,
                grant_amount_dzd=grant_amount_dzd,
                sponsor_name=sponsor_name,
                status="ACTIVE",
                progress_pct=0.0,
                unlocked_at=None,
                created_at=m_dict["created_at"],
            )

    def record_wilaya_backing(
        self, milestone_id: str, user_id: int
    ) -> Dict[str, Any]:
        """
        Records a backer contribution towards a Wilaya milestone.
        If threshold is reached, automatically triggers grant unlock!
        """
        with self._lock:
            m = self._milestones.get(milestone_id)
            if not m:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Milestone '{milestone_id}' not found.",
                )

            backers = self._milestone_backers.setdefault(milestone_id, set())
            backers.add(user_id)
            current_count = len(backers)
            target = m["target_backers_count"]
            progress = min(100.0, round((current_count / max(1, target)) * 100.0, 1))

            just_unlocked = False
            if current_count >= target and m["status"] == "ACTIVE":
                m["status"] = "UNLOCKED"
                m["unlocked_at"] = datetime.now(timezone.utc).isoformat()
                just_unlocked = True
                logger.info(
                    f"🎉 WILAYA MILESTONE UNLOCKED! {m['startup_name']} in Wilaya {m['wilaya_code']} "
                    f"unlocked {m['grant_amount_dzd']} DZD matching grant from {m['sponsor_name']}!"
                )

            return {
                "success": True,
                "milestoneId": milestone_id,
                "startupName": m["startup_name"],
                "wilayaCode": m["wilaya_code"],
                "currentBackersCount": current_count,
                "targetBackersCount": target,
                "progressPct": progress,
                "status": m["status"],
                "justUnlocked": just_unlocked,
                "grantAmountDzd": m["grant_amount_dzd"],
                "sponsorName": m["sponsor_name"],
                "unlockedAt": m["unlocked_at"],
            }

    def list_wilaya_milestones(self, wilaya_code: Optional[int] = None) -> List[WilayaMilestone]:
        """Lists active and unlocked Wilaya collective milestones."""
        with self._lock:
            res: List[WilayaMilestone] = []
            for m_id, m in self._milestones.items():
                if wilaya_code is not None and m["wilaya_code"] != wilaya_code:
                    continue

                backers = self._milestone_backers.get(m_id, set())
                count = len(backers)
                target = m["target_backers_count"]
                progress = min(100.0, round((count / max(1, target)) * 100.0, 1))

                wilaya_code_val = m["wilaya_code"]
                wilaya_name_val = m.get("wilaya_name") or WILAYA_NAMES_DZ.get(wilaya_code_val, f"Wilaya {wilaya_code_val}")

                res.append(
                    WilayaMilestone(
                        milestone_id=m_id,
                        startup_id=m["startup_id"],
                        startup_name=m["startup_name"],
                        wilaya_code=wilaya_code_val,
                        wilaya_name=wilaya_name_val,
                        target_backers_count=target,
                        current_backers_count=count,
                        grant_amount_dzd=m["grant_amount_dzd"],
                        sponsor_name=m["sponsor_name"],
                        status=m["status"],
                        progress_pct=progress,
                        unlocked_at=m.get("unlocked_at"),
                        created_at=m["created_at"],
                    )
                )
            return res


# Global Singleton Instance
viral_growth_engine = ViralGrowthEngine()
