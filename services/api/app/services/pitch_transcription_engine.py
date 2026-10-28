"""
TamWheel Sovereign Ethical Agentic Venture OS — Multilingual Pitch Audio Transcription
& Translation Pipeline Simulator (Phase 4 Expansion).

Simulates streaming audio chunks into synchronized multilingual closed captions:
- Trilingual & Quad-lingual support: Algerian Darija (ar-DZ), Modern Standard Arabic (ar-SA), French (fr-FR), and English (en-US).
- Auto-generated pitch transcript timestamps synced directly to slide deck transitions and presentation clock.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# Standardized startup pitch templates for automatic multilingual synthesis
SLIDE_PITCH_CORPUS: Dict[int, Dict[str, str]] = {
    0: {
        "darija": "السّلام عليكم، TamWheel هي أوّل منصّة تمويل إسلامي تشاركي قانونية 100% في الجزائر.",
        "msa": "السلام عليكم، TamWheel هي المنصة الأولى للتمويل الإسلامي التشاركي المتوافقة مع القانون الجزائري.",
        "french": "Bonjour à tous, TamWheel est la première plateforme d'investissement participatif islamique 100% légale en Algérie.",
        "english": "Welcome everyone, TamWheel is Algeria's first fully compliant Islamic equity crowdfunding and venture OS.",
    },
    1: {
        "darija": "المشكل في بلادنا هو أنّ 85% من المعاملات كاش، والشركات الناشئة ما تلقاش تمويل بنكي بدون ربا.",
        "msa": "المشكلة في بلادنا تكمن في أن 85% من المعاملات نقدية، والشركات الناشئة تفتقر إلى تمويل بنكي خالٍ من الربا.",
        "french": "Le problème majeur est que 85% des transactions sont en espèces, et les startups manquent d'accès aux crédits sans riba.",
        "english": "The core problem is that 85% of transactions are cash-based, and startups lack access to non-usurious bank financing.",
    },
    2: {
        "darija": "الحل نتاعنا: عقود مرابحة ومشاركة متناقصة مع حسابات ضمان escrow مشفّرة ومصادق عليها من اللجنة الشرعية.",
        "msa": "حلنا: عقود مرابحة ومشاركة متناقصة مع محافظ ضمان مشفرة ومصادق عليها من المجلس الشرعي.",
        "french": "Notre solution: contrats de Murabaha et Musharaka dégressive avec séquestre escrow audité par le comité Sharia.",
        "english": "Our solution: Murabaha and Diminishing Musharakah contracts paired with multi-key smart escrow vaults.",
    },
    3: {
        "darija": "حجم السوق: كاين أكثر من 5,000 ستارت-آب حاصلة على علامة 'مشروع مبتكر' تحت المرسوم 20-254.",
        "msa": "حجم السوق: يتواجد أكثر من 5,000 شركة ناشئة ومبتكرة حاصلة على علامة المرسوم التنفيذي 20-254.",
        "french": "Taille de marché: plus de 5,000 startups labellisées selon le décret exécutif 20-254 en Algérie.",
        "english": "Market Size: over 5,000 labeled startups under Executive Decree 20-254 representing our serviceable obtainable market.",
    },
    4: {
        "darija": "الأرقام ديالنا: هامش الربح 68%، ونحقّقو نمو شهري 22% مع كاب طابل شفاف على قانون 22-09.",
        "msa": "مؤشراتنا المالية: هامش ربح إجمالي 68%، ونمو شهري بنسبة 22% مع جدول مساهمين متوافق مع القانون 22-09.",
        "french": "Nos métriques: marge brute de 68%, croissance mensuelle de 22% avec une table de capitalisation Loi 22-09.",
        "english": "Unit economics: 68% gross margin, 22% monthly revenue expansion, backed by Law 22-09 SPAS equity structures.",
    },
    5: {
        "darija": "رانا نطلبو 35 مليون دينار جزائري للتوسع في 58 ولاية وتطوير أدوات الفحص بالذكاء الاصطناعي.",
        "msa": "نطلب استثماراً بقيمة 35 مليون دينار جزائري للتوسع عبر 58 ولاية وتطوير أدوات التحليل الذكية.",
        "french": "Nous levons 35 millions DZD pour accélérer notre déploiement dans les 58 wilayas et enrichir nos outils IA.",
        "english": "We are seeking 35M DZD to expand across all 58 wilayas and deploy autonomous due diligence swarms.",
    },
}


class TranscriptSegment:
    """Represents a speech segment with synchronized multilingual transcriptions."""

    def __init__(
        self,
        segment_id: str,
        room_id: str,
        slide_index: int,
        start_sec: float,
        end_sec: float,
        speaker_name: str,
        speaker_role: str,
        original_language: str,
        original_text: str,
        translations: Dict[str, str],
        confidence_score: float = 0.96,
        created_at: Optional[float] = None,
    ):
        self.segment_id = segment_id
        self.room_id = room_id
        self.slide_index = int(slide_index)
        self.start_sec = round(float(start_sec), 2)
        self.end_sec = round(float(end_sec), 2)
        self.speaker_name = speaker_name
        self.speaker_role = speaker_role
        self.original_language = original_language
        self.original_text = original_text
        self.translations = translations
        self.confidence_score = float(confidence_score)
        self.created_at = created_at or time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "segment_id": self.segment_id,
            "room_id": self.room_id,
            "slide_index": self.slide_index,
            "start_sec": self.start_sec,
            "end_sec": self.end_sec,
            "duration_sec": round(self.end_sec - self.start_sec, 2),
            "speaker_name": self.speaker_name,
            "speaker_role": self.speaker_role,
            "original_language": self.original_language,
            "original_text": self.original_text,
            "translations": self.translations,
            "confidence_score": self.confidence_score,
            "created_at": self.created_at,
        }


class PitchTranscriptionSession:
    """Maintains synchronized multilingual closed caption stream for a live presentation room."""

    def __init__(self, room_id: str):
        self.room_id = room_id
        self.segments: List[TranscriptSegment] = []
        self.start_epoch = time.time()

    def synthesize_multilingual_payload(
        self,
        text: Optional[str],
        slide_index: int,
        primary_lang: str = "ar-DZ",
    ) -> tuple[str, Dict[str, str]]:
        """
        Synthesizes or translates pitch audio transcript across Darija, MSA, French, and English.
        """
        # If corpus has exact match for slide, use standard template if text is not provided
        corpus_entry = SLIDE_PITCH_CORPUS.get(slide_index % len(SLIDE_PITCH_CORPUS))

        if not text and corpus_entry:
            primary_text = corpus_entry.get("darija" if "ar" in primary_lang else "french", corpus_entry["english"])
            translations = {
                "darija": corpus_entry["darija"],
                "msa": corpus_entry["msa"],
                "french": corpus_entry["french"],
                "english": corpus_entry["english"],
            }
            return primary_text, translations

        # If custom text is provided, build coherent translation dictionary
        clean_text = text or f"Slide {slide_index + 1} presentation discussion point."
        translations = {
            "darija": f"{clean_text} (دارجة جزائرية)",
            "msa": f"{clean_text} (العربية الفصحى)",
            "french": f"{clean_text} (Traduction française)",
            "english": f"{clean_text} (English translation)",
        }
        return clean_text, translations

    def ingest_audio_chunk(
        self,
        duration_sec: float,
        speaker_name: str,
        current_slide_index: int,
        presentation_elapsed_sec: Optional[float] = None,
        speaker_role: str = "FOUNDER",
        original_language: str = "ar-DZ",
        raw_text_override: Optional[str] = None,
        confidence: float = 0.96,
    ) -> TranscriptSegment:
        """
        Processes an incoming streaming audio chunk, transcribes and translates it,
        and anchors timestamps directly to presentation elapsed clock and slide index.
        """
        duration = max(0.5, float(duration_sec))
        now_elapsed = presentation_elapsed_sec
        if now_elapsed is None:
            now_elapsed = max(0.0, time.time() - self.start_epoch)

        start_time = max(0.0, now_elapsed - duration)
        end_time = now_elapsed

        primary_text, translations = self.synthesize_multilingual_payload(
            text=raw_text_override,
            slide_index=current_slide_index,
            primary_lang=original_language,
        )

        segment_id = f"seg-{uuid.uuid4().hex[:10]}"
        segment = TranscriptSegment(
            segment_id=segment_id,
            room_id=self.room_id,
            slide_index=current_slide_index,
            start_sec=start_time,
            end_sec=end_time,
            speaker_name=speaker_name,
            speaker_role=speaker_role,
            original_language=original_language,
            original_text=primary_text,
            translations=translations,
            confidence_score=confidence,
        )

        self.segments.append(segment)
        logger.info(
            f"Transcribed audio chunk {segment_id} for slide {current_slide_index} "
            f"[{start_time:.1f}s - {end_time:.1f}s] in room {self.room_id}"
        )
        return segment

    def get_transcript(
        self,
        slide_index: Optional[int] = None,
        language: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves transcript segments, optionally filtered by slide index or formatted for a specific language.
        """
        filtered = self.segments
        if slide_index is not None:
            filtered = [s for s in filtered if s.slide_index == int(slide_index)]

        res = []
        for s in filtered:
            item = s.to_dict()
            if language:
                lang_key = language.lower()
                # support aliases: darija, french, english, msa
                if lang_key in ("fr", "fr-fr"):
                    lang_key = "french"
                elif lang_key in ("en", "en-us"):
                    lang_key = "english"
                elif lang_key in ("ar", "msa", "ar-sa"):
                    lang_key = "msa"
                elif lang_key in ("dz", "darija", "ar-dz"):
                    lang_key = "darija"

                item["displayed_caption"] = s.translations.get(lang_key, s.original_text)
            res.append(item)
        return res

    def export_full_transcript(self) -> Dict[str, Any]:
        """Exports structured transcript organized by slide transitions for Due Diligence Memorandums."""
        by_slide: Dict[int, List[Dict[str, Any]]] = {}
        for s in self.segments:
            by_slide.setdefault(s.slide_index, []).append(s.to_dict())

        total_duration = self.segments[-1].end_sec if self.segments else 0.0

        return {
            "room_id": self.room_id,
            "total_segments": len(self.segments),
            "total_duration_sec": total_duration,
            "languages_supported": ["ar-DZ (Darija)", "ar-SA (MSA)", "fr-FR (French)", "en-US (English)"],
            "slides": by_slide,
        }


class PitchTranscriptionEngine:
    """Singleton service managing streaming pitch transcription sessions across arena rooms."""

    def __init__(self):
        self._sessions: Dict[str, PitchTranscriptionSession] = {}

    def get_or_create_session(self, room_id: str) -> PitchTranscriptionSession:
        if room_id not in self._sessions:
            self._sessions[room_id] = PitchTranscriptionSession(room_id=room_id)
        return self._sessions[room_id]

    def get_session(self, room_id: str) -> Optional[PitchTranscriptionSession]:
        return self._sessions.get(room_id)

    def remove_session(self, room_id: str) -> None:
        self._sessions.pop(room_id, None)


# Global singleton instance
pitch_transcription_engine = PitchTranscriptionEngine()
