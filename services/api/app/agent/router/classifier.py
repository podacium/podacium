"""
Intent Classifier: Fast, Typo-Tolerant, Multi-Domain Intent Router for Hierarchical Tool Selection.

Supports trilingual routing (Arabic / Algerian Darija incl. Arabizi, French, English) through:
  1. Orthographic normalization (Unicode NFKD, diacritics/harakat/tatweel stripping, Alef/Teh
     Marbuta/Alef Maksura unification, elongation collapsing).
  2. Exact matching (word-boundary prefix matching for Latin script, in-token matching for Arabic
     so that clitics such as "بالدروس" or "كورساتي" still match).
  3. Fuzzy matching (length-scaled Damerau-Levenshtein / OSA distance) to absorb typos such as
     "دروش" -> "دروس" or "deshbord" -> "dashboard".
  4. Multi-domain co-routing: a significant secondary domain is reported so the supervisor can
     blend tools for cross-domain requests (e.g. hiring a freelancer to build a BI dashboard).

The keyword index is normalized once at import time; classification is pure CPU and sub-millisecond
to a few milliseconds per message.
"""

import re
import unicodedata
from typing import Dict, List, Optional, Set, Tuple

from pydantic import BaseModel, Field

from app.agent.domains import ToolDomain

_ARABIC_CHAR_RE = re.compile(r"[\u0600-\u06FF]")
_TOKEN_RE = re.compile(r"[\w']+")
_ARABIC_PROCLITICS = ("و", "ف", "ب", "ك", "ل")

# Fuzzy matching guards (tuned to avoid false positives on short words).
_FUZZY_MIN_KEYWORD_LEN = 4
_FUZZY_LONG_KEYWORD_LEN = 8


def normalize_multilingual_text(text: str) -> str:
    """
    Normalizes Arabic, French, and English text for matching:
    - Unicode NFKD + removal of combining marks (strips French accents and Arabic harakat/hamza
      seats, e.g. "é" -> "e", "أ" -> "ا", "ؤ" -> "و")
    - Strips Tatweel (Kashida)
    - Unifies Alef variants, Teh Marbuta (ة -> ه) and Alef Maksura (ى -> ي)
    - Collapses character elongation (e.g. "كورسسس" -> "كورس", "coursss" -> "cours")
    """
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.replace("\u0640", "")
    text = re.sub(r"[إأآٱ]", "ا", text)
    text = text.replace("ة", "ه").replace("ى", "ي")
    text = re.sub(r"(.)\1{2,}", r"\1", text)
    text = re.sub(r"\s+", " ", text)
    return text.lower().strip()


def strip_arabic_prefixes(word: str) -> str:
    """
    Removes common Arabic proclitics (ال, لل and one of و/ف/ب/ك/ل) from a USER token.
    Never applied to dictionary keywords, whose first letter is often part of the root (e.g. "كورس").
    """
    if not word or not _ARABIC_CHAR_RE.search(word):
        return word
    if word[0] in _ARABIC_PROCLITICS and len(word) > 4:
        word = word[1:]
    if word.startswith("ال") and len(word) > 4:
        word = word[2:]
    elif word.startswith("لل") and len(word) > 4:
        word = word[2:]
    return word


def damerau_levenshtein(s1: str, s2: str, max_distance: int = 2) -> int:
    """
    Optimal String Alignment (restricted Damerau-Levenshtein) distance: insertions, deletions,
    substitutions and adjacent transpositions. Returns ``max_distance + 1`` as soon as the
    distance is known to exceed ``max_distance`` (early exit keeps matching cheap).
    """
    if s1 == s2:
        return 0
    len1, len2 = len(s1), len(s2)
    if abs(len1 - len2) > max_distance:
        return max_distance + 1

    prev_prev: List[int] = []
    prev = list(range(len2 + 1))
    for i in range(1, len1 + 1):
        curr = [i] + [0] * len2
        row_min = curr[0]
        for j in range(1, len2 + 1):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
            if i > 1 and j > 1 and s1[i - 1] == s2[j - 2] and s1[i - 2] == s2[j - 1]:
                curr[j] = min(curr[j], prev_prev[j - 2] + 1)
            row_min = min(row_min, curr[j])
        if row_min > max_distance:
            return max_distance + 1
        prev_prev, prev = prev, curr
    return prev[len2]


class IntentClassificationResult(BaseModel):
    primary_domain: ToolDomain
    secondary_domain: Optional[ToolDomain] = None
    confidence: float
    detected_keywords: List[str]
    suggested_tool_names: List[str] = Field(default_factory=list)


DOMAIN_KEYWORDS: Dict[ToolDomain, Dict[str, int]] = {
    ToolDomain.EDTECH: {
        # Arabizi / Latin-script Darija
        "kours": 4,
        "formasion": 4,
        "dourous": 4,
        "drous": 4,
        "t3allem": 4,
        "nt3allem": 4,
        "ta3lim": 4,
        "n9ra": 4,
        "na9ra": 4,
        "9raya": 4,
        "chahada": 5,
        "tasjil": 6,
        "nsajel": 6,
        # English
        "course": 4,
        "courses": 4,
        "formation": 4,
        "learn": 3,
        "learning": 3,
        "quiz": 5,
        "quizzes": 5,
        "lesson": 4,
        "lessons": 4,
        "certificate": 5,
        "certificates": 5,
        "transcript": 4,
        "enroll": 6,
        "enrolled": 5,
        "enrolling": 6,
        "enrollment": 6,
        "register": 5,
        "registration": 5,
        "sign up": 5,
        "student": 3,
        "students": 3,
        "curriculum": 4,
        "syllabus": 4,
        "qcm": 5,
        "python": 5,
        "excel": 5,
        # French
        "cours": 4,
        "formations": 4,
        "certificat": 5,
        "certificats": 5,
        "arrété 1275": 5,
        "arrete 1275": 5,
        "inscription": 6,
        "inscrire": 6,
        "m'inscrire": 6,
        "m'enregistrer": 5,
        "étudiant": 3,
        "etudiant": 3,
        "leçon": 4,
        "leçons": 4,
        "tutoriel": 3,
        # Arabic & Algerian Darija
        "دورة": 5,
        "دورات": 5,
        "كورس": 5,
        "كورسات": 5,
        "درس": 4,
        "دروس": 4,
        "تكوين": 5,
        "تكوينات": 5,
        "تعلم": 4,
        "تسجيل": 6,
        "التسجيل": 6,
        "سجل": 5,
        "سجلني": 6,
        "تسجل": 5,
        "سجل في": 6,
        "انخراط": 5,
        "التحاق": 5,
        "بايثون": 5,
        "بيثون": 5,
        "إكسل": 5,
        "اكسل": 5,
        "شهادة": 5,
        "شهادات": 5,
        "امتحان": 5,
        "اختبار": 5,
        "كويز": 5,
        "طالب": 3,
        "طلبة": 3,
        "مسار": 4,
        "مسارات": 4,
        "فيديو": 3,
        "قائمة الدورات": 6,
    },
    ToolDomain.FREELANCE: {
        # Arabizi / Latin-script Darija
        "khedma": 3,
        "khdma": 3,
        "mostakil": 5,
        "brojet": 5,
        # English
        "project": 4,
        "projects": 4,
        "freelance": 5,
        "freelancer": 5,
        "freelancers": 5,
        "proposal": 5,
        "proposals": 5,
        "contract": 5,
        "contracts": 5,
        "milestone": 5,
        "milestones": 5,
        "deliverable": 4,
        "deliverables": 4,
        "escrow": 5,
        "bid": 4,
        "bids": 4,
        "gig": 4,
        # French
        "projet": 4,
        "projets": 4,
        "freelanceur": 5,
        "proposition": 5,
        "offre": 3,
        "contrat": 5,
        "contrats": 5,
        "jalon": 5,
        "jalons": 5,
        "livrable": 4,
        "livrables": 4,
        "sequestre": 5,
        "séquestre": 5,
        # Arabic & Algerian Darija
        "مشروع": 5,
        "مشاريع": 5,
        "بروجي": 5,
        "عمل حر": 5,
        "مستقل": 5,
        "مستقلين": 5,
        "عرض": 4,
        "عروض": 4,
        "صفقة": 4,
        "صفقات": 4,
        "عقد": 5,
        "عقود": 5,
        "تسليم": 4,
        "مرحلة": 4,
        "ضمان": 5,
        "بريستاتار": 5,
        "خدمة": 3,
    },
    ToolDomain.BI: {
        # Arabizi / Latin-script Darija & business vocabulary
        "dachboard": 5,
        "statistique": 4,
        "statistiques": 4,
        "stats": 4,
        "ventes": 3,
        "chiffre d'affaires": 4,
        "rapport": 3,
        "مبيعات": 4,
        "احصائيات": 4,
        "تقرير": 3,
        # English
        "dashboard": 5,
        "dashboards": 5,
        "chart": 4,
        "charts": 4,
        "kpi": 5,
        "kpis": 5,
        "dataset": 5,
        "datasets": 5,
        "data": 3,
        "sql": 5,
        "duckdb": 5,
        "pc compta": 5,
        "dlg": 5,
        "scf": 5,
        "analytics": 4,
        "visualization": 4,
        "table": 3,
        # French
        "tableau de bord": 5,
        "tableaux de bord": 5,
        "graphique": 4,
        "graphiques": 4,
        "données": 3,
        "donnees": 3,
        "journal": 4,
        # Arabic & Algerian Darija
        "بيانات": 5,
        "داتا": 4,
        "تحليل": 5,
        "تحليلات": 5,
        "لوحة قيادة": 5,
        "لوحة تحكم": 5,
        "مخطط": 4,
        "رسم بياني": 4,
        "مؤشر": 4,
        "مؤشرات": 4,
        "إكسل": 4,
        "محاسبة": 4,
    },
    ToolDomain.FINTECH: {
        # Arabizi / Latin-script Darija
        "flous": 4,
        "drahem": 3,
        "rasid": 4,
        "فلوس": 4,
        "دراهم": 3,
        # English
        "wallet": 5,
        "balance": 4,
        "dzd": 4,
        "dinars": 3,
        "baridimob": 5,
        "ccp": 5,
        "rip": 5,
        "edahabia": 5,
        "cib": 5,
        "payout": 5,
        "withdrawal": 5,
        "tax": 4,
        "taxes": 4,
        "anae": 5,
        "article 169": 5,
        "cidta": 5,
        "receipt": 4,
        "voucher": 4,
        "promo": 4,
        "invoice": 4,
        # French
        "solde": 4,
        "da": 3,
        "retrait": 4,
        "impôt": 4,
        "impot": 4,
        "ifu": 5,
        "facture": 4,
        "reçu": 4,
        "déduction": 5,
        # Arabic & Algerian Darija
        "محفظة": 5,
        "رصيد": 4,
        "دينار": 3,
        "دج": 3,
        "بريدي موب": 5,
        "ذهبية": 5,
        "البطاقة الذهبية": 5,
        "سحب": 4,
        "دفع": 4,
        "ضريبة": 4,
        "ضرائب": 4,
        "فاتورة": 4,
        "خصم ضريبي": 5,
        "كوبون": 4,
    },
    ToolDomain.CORE: {
        # Account & support vocabulary
        "compte": 3,
        "password": 4,
        "mot de passe": 4,
        "كلمة السر": 4,
        "mochkil": 3,
        "مشكل": 3,
        # English
        "profile": 4,
        "ticket": 5,
        "support": 5,
        "contact": 5,
        "contacts": 5,
        "customer service": 5,
        "help": 3,
        "mail": 4,
        "email": 4,
        "human": 4,
        "agent": 3,
        "kyc": 5,
        "faq": 4,
        "founder": 3,
        "founders": 3,
        # French
        "profil": 4,
        "aide": 3,
        "contacter": 5,
        "service client": 5,
        "humain": 4,
        "fondateur": 3,
        # Arabic & Algerian Darija
        "حساب": 4,
        "حسابي": 4,
        "تذكرة": 5,
        "مساعدة": 4,
        "دعم": 4,
        "عون": 4,
        "اتصال": 5,
        "تواصل": 5,
        "اتصل": 5,
        "خدمة العملاء": 5,
        "مؤسس": 3,
    },
}


class _KeywordEntry:
    """Pre-normalized keyword with its matching strategy (built once at import time)."""

    __slots__ = (
        "domain",
        "keyword",
        "norm",
        "weight",
        "is_arabic",
        "is_phrase",
        "pattern",
    )

    def __init__(self, domain: ToolDomain, keyword: str, norm: str, weight: int):
        self.domain = domain
        self.keyword = keyword
        self.norm = norm
        self.weight = weight
        self.is_arabic = bool(_ARABIC_CHAR_RE.search(norm))
        self.is_phrase = " " in norm
        # Latin script: word-boundary prefix match ("course" matches "courses", but "da"
        # does not match inside "dashboard").
        self.pattern = None if self.is_arabic else re.compile(rf"\b{re.escape(norm)}")


def _build_keyword_index() -> List[_KeywordEntry]:
    index: Dict[Tuple[ToolDomain, str], _KeywordEntry] = {}
    for domain, keywords in DOMAIN_KEYWORDS.items():
        for keyword, weight in keywords.items():
            norm = normalize_multilingual_text(keyword)
            if not norm:
                continue
            key = (domain, norm)
            # Spelling variants that normalize identically (e.g. "إكسل"/"اكسل") count once.
            if key not in index or index[key].weight < weight:
                index[key] = _KeywordEntry(domain, keyword, norm, weight)
    return list(index.values())


_KEYWORD_INDEX: List[_KeywordEntry] = _build_keyword_index()


def _max_fuzzy_distance(keyword_len: int) -> int:
    if keyword_len < _FUZZY_MIN_KEYWORD_LEN:
        return 0
    return 2 if keyword_len >= _FUZZY_LONG_KEYWORD_LEN else 1


class IntentClassifier:
    """
    Fast, typo-tolerant, multi-domain intent classifier.
    Handles dialectal spelling, Arabizi, clitics and keyboard slips
    (e.g. "دروش" -> "دروس", "deshbord" -> "dashboard") and reports a secondary
    domain for cross-domain requests.
    """

    SECONDARY_MIN_SCORE = 3
    SECONDARY_MIN_RATIO = 0.35

    @staticmethod
    def _exact_match(entry: _KeywordEntry, text: str, token_variants: Set[str]) -> bool:
        if entry.pattern is not None:
            return bool(entry.pattern.search(text))
        if entry.is_phrase:
            return entry.norm in text
        if len(entry.norm) <= 2:
            # Very short Arabic keywords (e.g. "دج") must be standalone tokens.
            return entry.norm in token_variants
        # Arabic: in-token match tolerates attached clitics/suffixes ("بالدروس", "حسابي").
        return any(entry.norm in tok for tok in token_variants)

    @staticmethod
    def _fuzzy_match(entry: _KeywordEntry, token_variants: Set[str]) -> Optional[str]:
        if entry.is_phrase:
            return None
        max_dist = _max_fuzzy_distance(len(entry.norm))
        if max_dist == 0:
            return None
        for tok in token_variants:
            if (
                len(tok) < _FUZZY_MIN_KEYWORD_LEN
                or abs(len(tok) - len(entry.norm)) > max_dist
            ):
                continue
            # Typos rarely hit the first letter; requiring it sharply cuts false positives.
            if tok[0] != entry.norm[0]:
                continue
            if damerau_levenshtein(tok, entry.norm, max_dist) <= max_dist:
                return tok
        return None

    @classmethod
    def classify(cls, user_text: str) -> IntentClassificationResult:
        clean_text = normalize_multilingual_text(user_text)
        if not clean_text:
            return cls._core_fallback()

        tokens = _TOKEN_RE.findall(clean_text)
        token_variants: Set[str] = set(tokens)
        token_variants.update(strip_arabic_prefixes(t) for t in tokens)

        domain_scores: Dict[ToolDomain, int] = {d: 0 for d in ToolDomain}
        matched_words: List[str] = []
        exact_consumed_tokens: Set[str] = set()
        exact_matched_keywords: Set[str] = set()

        for entry in _KEYWORD_INDEX:
            if cls._exact_match(entry, clean_text, token_variants):
                domain_scores[entry.domain] += entry.weight
                matched_words.append(entry.keyword)
                exact_matched_keywords.add(entry.keyword)
                if entry.is_phrase:
                    for part in entry.norm.split():
                        exact_consumed_tokens.add(part)
                else:
                    exact_consumed_tokens.add(entry.norm)
                    for tok in token_variants:
                        if entry.norm == tok or (entry.is_arabic and entry.norm in tok):
                            exact_consumed_tokens.add(tok)

        # For fuzzy typo matching, only evaluate tokens that did not exact-match a keyword.
        # This prevents correctly-spelled words (e.g. "contact") from being mistakenly
        # hijacked as a typo for another domain (e.g. "contract").
        fuzzy_candidate_tokens = {
            tok for tok in token_variants if tok not in exact_consumed_tokens
        }

        if fuzzy_candidate_tokens:
            for entry in _KEYWORD_INDEX:
                if entry.keyword in exact_matched_keywords:
                    continue
                typo = cls._fuzzy_match(entry, fuzzy_candidate_tokens)
                if typo is not None:
                    # Fuzzy evidence is slightly weaker than an exact hit.
                    domain_scores[entry.domain] += max(1, entry.weight - 1)
                    matched_words.append(f"{entry.keyword}~{typo}")

        ranked = sorted(domain_scores.items(), key=lambda x: x[1], reverse=True)
        top_domain, top_score = ranked[0]
        second_domain, second_score = ranked[1]

        if top_score == 0:
            return cls._core_fallback()

        total_score = sum(domain_scores.values())
        confidence = min(0.98, max(0.60, top_score / total_score))

        secondary: Optional[ToolDomain] = None
        if (
            second_score >= cls.SECONDARY_MIN_SCORE
            and second_score >= top_score * cls.SECONDARY_MIN_RATIO
        ):
            secondary = second_domain

        return IntentClassificationResult(
            primary_domain=top_domain,
            secondary_domain=secondary,
            confidence=round(confidence, 2),
            detected_keywords=sorted(set(matched_words)),
            suggested_tool_names=[],
        )

    @staticmethod
    def _core_fallback() -> IntentClassificationResult:
        return IntentClassificationResult(
            primary_domain=ToolDomain.CORE,
            confidence=0.5,
            detected_keywords=[],
            suggested_tool_names=["search_knowledge_faq", "get_my_profile"],
        )
