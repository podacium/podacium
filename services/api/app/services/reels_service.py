"""
TamWheel Sovereign Ethical Agentic Venture OS — Startup Reels & Swipe-to-Diligence Service.
Pillar 6 / Phase 3 Expansion: 9:16 vertical pitch video discovery feed,
swipe-to-diligence data drawer payloads, and 15-second audio AMA recording queue.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

MAX_AUDIO_AMA_DURATION_SEC = 15.0


class AudioAmaQuestion:
    def __init__(
        self,
        ama_id: str,
        reel_id: str,
        startup_id: str,
        user_id: int,
        username: str,
        audio_url: str,
        duration_sec: float,
        question_text: Optional[str] = None,
        created_at: Optional[float] = None,
    ):
        self.ama_id = ama_id
        self.reel_id = reel_id
        self.startup_id = startup_id
        self.user_id = user_id
        self.username = username
        self.audio_url = audio_url
        self.duration_sec = min(MAX_AUDIO_AMA_DURATION_SEC, float(duration_sec))
        self.question_text = question_text or "15s Voice Question"
        self.created_at = created_at or time.time()
        self.answered: bool = False
        self.answer_audio_url: Optional[str] = None
        self.answer_text: Optional[str] = None
        self.answered_at: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "amaId": self.ama_id,
            "reelId": self.reel_id,
            "startupId": self.startup_id,
            "userId": self.user_id,
            "username": self.username,
            "audioUrl": self.audio_url,
            "durationSec": self.duration_sec,
            "questionText": self.question_text,
            "createdAt": self.created_at,
            "answered": self.answered,
            "answerAudioUrl": self.answer_audio_url,
            "answerText": self.answer_text,
            "answeredAt": self.answered_at,
        }


class ReelItem:
    def __init__(
        self,
        reel_id: str,
        startup_id: str,
        startup_name: str,
        founder_name: str,
        video_url: str,
        thumbnail_url: str,
        caption: str,
        wilaya: int = 16,
        sector: str = "FinTech",
        duration_sec: int = 60,
        factguard_status: str = "GREEN_VERIFIED",
    ):
        self.reel_id = reel_id
        self.startup_id = startup_id
        self.startup_name = startup_name
        self.founder_name = founder_name
        self.video_url = video_url
        self.thumbnail_url = thumbnail_url
        self.caption = caption
        self.wilaya = wilaya
        self.sector = sector
        self.duration_sec = duration_sec
        self.factguard_status = factguard_status
        self.views_count = 1420
        self.likes_count = 385

        # Diligence Drawer Payload
        self.diligence_data: Dict[str, Any] = {
            "arrDzd": 4_200_000,
            "mrrDzd": 350_000,
            "burnRateDzd": 420_000,
            "runwayMonths": 15.2,
            "hasStartupLabel": True,
            "labelDecree": "Decree 20-254 Certified",
            "teamSize": 8,
            "openBountiesCount": 3,
            "shariaComplianceStatus": "COMPLIANT_AAOIFI",
            "capTableSummary": {
                "foundersEquityPct": 82.5,
                "advisorsEquityPct": 2.5,
                "optionPoolPct": 10.0,
                "publicCrowdTargetPct": 5.0,
            },
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "reelId": self.reel_id,
            "startupId": self.startup_id,
            "startupName": self.startup_name,
            "founderName": self.founder_name,
            "videoUrl": self.video_url,
            "thumbnailUrl": self.thumbnail_url,
            "caption": self.caption,
            "wilaya": self.wilaya,
            "sector": self.sector,
            "durationSec": self.duration_sec,
            "factguardStatus": self.factguard_status,
            "viewsCount": self.views_count,
            "likesCount": self.likes_count,
            "diligenceDrawer": self.diligence_data,
        }


class StartupReelsService:
    """Singleton service managing 9:16 vertical reels discovery and 15s audio AMAs."""

    def __init__(self):
        self._reels: Dict[str, ReelItem] = {}
        self._amas: Dict[str, AudioAmaQuestion] = {}
        self._seed_default_reels()

    def _seed_default_reels(self):
        """Pre-seeds high-conviction Algerian startup reels."""
        defaults = [
            ReelItem(
                reel_id="reel-solar-01",
                startup_id="startup-solar-oran",
                startup_name="SolarTech Oran",
                founder_name="Youcef Benali",
                video_url="/static/reels/solar_tech_60s.mp4",
                thumbnail_url="/static/reels/solar_tech_thumb.webp",
                caption="نظام ذكي لتبريد الألواح الشمسية في مزارع وهران وعين تموشنت ☀️🇩🇿",
                wilaya=31,
                sector="AgTech",
            ),
            ReelItem(
                reel_id="reel-pay-02",
                startup_id="startup-pay-algiers",
                startup_name="BaridiPay API",
                founder_name="Meriem Hadj",
                video_url="/static/reels/baridi_pay_60s.mp4",
                thumbnail_url="/static/reels/baridi_pay_thumb.webp",
                caption="أسرع بوابة ربط مع بريدي موب والبطاقة الذهبية للمتاجر الإلكترونية 💳⚡",
                wilaya=16,
                sector="FinTech",
            ),
            ReelItem(
                reel_id="reel-agri-03",
                startup_id="startup-agri-biskra",
                startup_name="Sahara Drip AI",
                founder_name="Abdelkader Saidi",
                video_url="/static/reels/sahara_drip_60s.mp4",
                thumbnail_url="/static/reels/sahara_drip_thumb.webp",
                caption="توفير 45% من مياه السقي في بيوت الدروع ببسكرة عبر الذكاء الاصطناعي 🌴💧",
                wilaya=7,
                sector="DeepTech",
            ),
        ]
        for r in defaults:
            self._reels[r.reel_id] = r

    def list_reels(self, limit: int = 10) -> List[Dict[str, Any]]:
        return [r.to_dict() for r in list(self._reels.values())[:limit]]

    def get_reel(self, reel_id: str) -> Optional[Dict[str, Any]]:
        r = self._reels.get(reel_id)
        return r.to_dict() if r else None

    def get_diligence_drawer(self, reel_id: str) -> Optional[Dict[str, Any]]:
        r = self._reels.get(reel_id)
        if not r:
            return None
        return {
            "reelId": r.reel_id,
            "startupId": r.startup_id,
            "startupName": r.startup_name,
            **r.diligence_data,
        }

    def submit_audio_ama(
        self,
        reel_id: str,
        user_id: int,
        username: str,
        audio_url: str,
        duration_sec: float,
        question_text: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Submits a 15-second voice question directly to the founder's AMA queue."""
        if duration_sec > MAX_AUDIO_AMA_DURATION_SEC:
            raise ValueError(f"Audio question exceeds 15-second maximum limit ({duration_sec}s submitted)")

        reel = self._reels.get(reel_id)
        startup_id = reel.startup_id if reel else f"startup-{reel_id}"

        ama_id = f"ama-{uuid.uuid4().hex[:8]}"
        ama = AudioAmaQuestion(
            ama_id=ama_id,
            reel_id=reel_id,
            startup_id=startup_id,
            user_id=user_id,
            username=username,
            audio_url=audio_url,
            duration_sec=duration_sec,
            question_text=question_text,
        )
        self._amas[ama_id] = ama
        logger.info(f"Audio AMA submitted: id={ama_id} for reel={reel_id} by user={username}")
        return ama.to_dict()

    def answer_audio_ama(
        self,
        ama_id: str,
        founder_id: int,
        answer_audio_url: Optional[str] = None,
        answer_text: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Founder answers a queued audio AMA question."""
        ama = self._amas.get(ama_id)
        if not ama:
            raise ValueError(f"Audio AMA '{ama_id}' not found")

        ama.answered = True
        ama.answer_audio_url = answer_audio_url
        ama.answer_text = answer_text or "Founder voice response attached"
        ama.answered_at = time.time()

        return ama.to_dict()

    def list_reel_amas(self, reel_id: str) -> List[Dict[str, Any]]:
        return [ama.to_dict() for ama in self._amas.values() if ama.reel_id == reel_id]


# Global singleton instance
startup_reels_service = StartupReelsService()
