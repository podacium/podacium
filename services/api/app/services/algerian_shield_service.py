"""
Algerian Shield Service — Anti-Disintermediation & Contact Leak Defense Engine

Tailored specifically for Algerian telecom, banking (BaridiMob/CCP), and Arabizi slang.
Features:
- Mathematical Modulo-97 verification for Algérie Poste BaridiMob 20-digit RIPs.
- Algérie Poste CCP Clé calculation formula verification.
- Carrier-level phone regex (Mobilis 06, Djezzy 07, Ooredoo 05, Landlines 021-049, +213 / 00213).
- Zero-width character stripping, Arabic Tashkeel removal, and Unicode NFKC normalization.
- Number-word substitutions across Standard Arabic, French, Kabyle/Tamazight, and Algerian Darja/Arabizi.
- Bidirectional character span mapping for in-place raw text masking.
- Comprehensive detection for external messaging handles (WhatsApp, Telegram, Viber, Instagram, etc.).
"""

import re
import unicodedata
from typing import Tuple, List, Dict, Set, Optional


# ─── 1. Zero-Width, Invisible Characters & Arabic Tashkeel ────────────────────
ZERO_WIDTH_CHARS = re.compile(
    r"[\u200B\u200C\u200D\u200E\u200F\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064\u180E]"
)
ARABIC_TASHKEEL = re.compile(r"[\u064B-\u065F\u0670]")

EASTERN_TO_ASCII = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")

# ─── 2. Number Words in 4 Languages (French, Arabic, Darja/Arabizi, Kabyle) ───
NUMBER_WORDS: Dict[str, str] = {
    # French
    "zero": "0",
    "zéro": "0",
    "ziro": "0",
    "zirou": "0",
    "un": "1",
    "une": "1",
    "deux": "2",
    "deu": "2",
    "trois": "3",
    "quatre": "4",
    "katr": "4",
    "katre": "4",
    "cinq": "5",
    "cink": "5",
    "six": "6",
    "sept": "7",
    "set": "7",
    "sep": "7",
    "huit": "8",
    "wit": "8",
    "neuf": "9",
    "dix": "10",
    "onze": "11",
    "douze": "12",
    "treize": "13",
    "quatorze": "14",
    "quinze": "15",
    "seize": "16",
    "vingt": "20",
    "trente": "30",
    "quarante": "40",
    "cinquante": "50",
    "soixante": "60",
    # Standard & Dialectal Arabic
    "صفر": "0",
    "سفرا": "0",
    "زيرو": "0",
    "واحد": "1",
    "وحدة": "1",
    "اثنين": "2",
    "إثنين": "2",
    "ثنين": "2",
    "تنين": "2",
    "زوج": "2",
    "زوز": "2",
    "ثلاثة": "3",
    "تلاتة": "3",
    "تلاثة": "3",
    "اربعة": "4",
    "أربعة": "4",
    "ربعة": "4",
    "خمسة": "5",
    "خمس": "5",
    "ستة": "6",
    "ست": "6",
    "سبعة": "7",
    "سبع": "7",
    "ثمانية": "8",
    "تمانية": "8",
    "تمنية": "8",
    "تسعة": "9",
    "تسع": "9",
    "عشرة": "10",
    "عشر": "10",
    # Algerian Darja / Arabizi
    "sefr": "0",
    "sefra": "0",
    "sfr": "0",
    "sifra": "0",
    "wahed": "1",
    "wahad": "1",
    "wa7ed": "1",
    "wa7d": "1",
    "wehed": "1",
    "wehd": "1",
    "wahid": "1",
    "wahda": "1",
    "zouj": "2",
    "zoudj": "2",
    "zwaj": "2",
    "zouz": "2",
    "tnayn": "2",
    "tnin": "2",
    "tlata": "3",
    "tlatha": "3",
    "tleta": "3",
    "thlatha": "3",
    "rab3a": "4",
    "rab3ah": "4",
    "rabaa": "4",
    "rb3a": "4",
    "reb3a": "4",
    "arba3a": "4",
    "khamsa": "5",
    "khamsah": "5",
    "5amsa": "5",
    "5msa": "5",
    "xamsa": "5",
    "khemsa": "5",
    "setta": "6",
    "settah": "6",
    "sta": "6",
    "sitta": "6",
    "sett": "6",
    "sab3a": "7",
    "sab3ah": "7",
    "seb3a": "7",
    "seba3": "7",
    "sabaa": "7",
    "sb3a": "7",
    "tmanya": "8",
    "tmenya": "8",
    "tmenia": "8",
    "thmenya": "8",
    "temnya": "8",
    "tes3a": "9",
    "tes3ah": "9",
    "tesaa": "9",
    "ts3a": "9",
    "tis3a": "9",
    "3achra": "10",
    "aachra": "10",
    "achra": "10",
    # Kabyle / Tamazight
    "ilem": "0",
    "ulac": "0",
    "yiwen": "1",
    "yiwet": "1",
    "iwen": "1",
    "sin": "2",
    "snat": "2",
    "krad": "3",
    "kkoz": "4",
    "kkuẓ": "4",
    "semmus": "5",
    "sdis": "6",
    "sa": "7",
    "tam": "8",
    "tamet": "8",
    "tza": "9",
    "mraw": "10",
    "semraw": "20",
    "kradmraw": "30",
    "twinas": "100",
    "agim": "1000",
    # Dialectal Tens
    "3echrin": "20",
    "3chrin": "20",
    "echrin": "20",
    "tlatin": "30",
    "tlethin": "30",
    "thlathin": "30",
    "reb3in": "40",
    "rab3in": "40",
    "khamsin": "50",
    "5amsin": "50",
    "settin": "60",
    "sittin": "60",
    "seb3in": "70",
    "sab3in": "70",
    "tmanin": "80",
    "tmenin": "80",
    "tes3in": "90",
    "tis3in": "90",
    "mya": "100",
    "miya": "100",
    "meya": "100",
    "alef": "1000",
}

# ─── 3. Telecommunication & Banking Regex Patterns ───────────────────────────
# Algerian phone numbers: handles 05, 06, 07, +213, 00213, landlines 021-049
# Tolerates spaces, dashes, dots, slashes, commas, colons, pipes, and asterisks
ALGERIAN_PHONE_PATTERN = re.compile(
    r"""(?xi)
    (?:
        (?:(?:\+|00)[\s\-_./,:*|~]*213[\s\-_./,:*|~]*(?:\(0\)[\s\-_./,:*|~]*)?|0)
        [\s\-_./,:*|~]*
        (?:
            [567][\s\-_./,:*|~]*(?:\d[\s\-_./,:*|~]*){8}
            |
            (?:2[13-79]|3[1-8]|4[13-9])[\s\-_./,:*|~]*(?:\d[\s\-_./,:*|~]*){7}
        )
    )
    """
)

# BaridiMob RIP: 20 digits, starting with 007 or RIP keyword
BARIDIMOB_RIP_PATTERN = re.compile(
    r"""(?xi)
    \b(?:RIP[\s.:-]*)?007[\s\-_./,:*|~]*(?:\d[\s\-_./,:*|~]*){17}\b
    |
    \bRIP[\s.:-]*(?:\d[\s\-_./,:*|~]*){20}\b
    |
    \b007[\s\-_./,:*|~]*99999[\s\-_./,:*|~]*(?:\d[\s\-_./,:*|~]*){12}\b
    """
)

# Edahabia 16-Digit Card Pattern (Algérie Poste 6280, SATIM 5035, 5359, 6037)
EDAHABIA_CARD_PATTERN = re.compile(
    r"""(?xi)
    \b(?:6280|5035|5359|6037)[\s\-_./,:*|~]*(?:\d[\s\-_./,:*|~]*){12}\b
    """
)

# Traditional CCP with Clé Pattern
CCP_CLE_PATTERN = re.compile(
    r"""(?xi)
    \b(?:CCP|Compte|Baridi|Poste)?[\s.:-]*
    (\d{5,10})
    [\s\-_./:,*|~]*(?:cle|clé|cl[eé]|k|مفتاح|c)[\s.:=-]*
    (\d{2})\b
    """
)

# Email pattern with whitespace padding / obfuscation tolerance (supports @, [at], arobase, dot, point)
EMAIL_PATTERN = re.compile(
    r"""(?xi)
    [a-zA-Z0-9_.+-]+
    [\s\-_./]*
    (?:@|\[at\]|\(at\)|\barobase\b|\bat\b)
    [\s\-_./]*
    [a-zA-Z0-9-]+
    [\s\-_./]*
    (?:\.|\bdot\b|\[dot\]|\(dot\)|\bpoint\b)
    [\s\-_./]*
    [a-zA-Z]{2,}
    """
)

# Social Media / External Communication Handles & Slang Prompts
SOCIAL_CHANNELS_PATTERN = re.compile(
    r"""(?xi)
    (?:https?:\/\/)?(?:www\.)?(?:
        wa\.me|t\.me|telegram\.me|api\.whatsapp\.com|viber\.com|
        instagram\.com|instagr\.am|fb\.me|facebook\.com|discord\.gg|
        linkedin\.com\/in
    )\/[a-zA-Z0-9_\+\-\.\/]+
    |
    \b(?:
        wats?app|watss?ap|wassap|whapp|wsp|wotsp|
        telegram|telegrame|tiligram|tlg|
        viber|vaiber|vyber|
        insta(?:gram)?|snap(?:chat)?|fb|face(?:book)?|linkedin|
        واتساب|الواتس|تيليجرام|تيليغرام|فايبر|انستغرام|فيسبوك|
        coulini|bipini|3ayyetli|3ayetli|nemro|nemra|num(?:ero)?|nmr|
        contacti|appel|khallasni|kridi|floci|flous|drahem|tilifun|tlfn
    )\b[\s:=@+*_-]*([a-zA-Z0-9_.+]{3,35})?
    """
)


def verify_algerian_rip_checksum(rip_digits_str: Optional[str]) -> bool:
    """Validate 20-digit Algérie Poste RIP checksum using Modulo 97 under Bank of Algeria Instruction 06-2004."""
    if not rip_digits_str:
        return False
    digits = re.sub(r"\D", "", str(rip_digits_str))
    if len(digits) != 20 or not digits.startswith("007"):
        return False

    account_part = digits[:18]  # 007 + 99999 + 10 digits
    key_part = int(digits[18:20])

    remainder = (int(account_part) * 100) % 97
    expected_key = 97 - remainder if remainder != 0 else 97

    return key_part == expected_key


def verify_ccp_cle(
    account_digits_str: Optional[str], cle_digits_str: Optional[str]
) -> bool:
    """Validate traditional Algerian CCP account and 2-digit Clé according to Bank of Algeria Instruction 06-2004 & Algérie Poste MOD-97.

    Algorithm:
      remainder = (account * 100) % 97
      expected_cle = 97 - remainder if remainder != 0 else 97

    Supports both 2-digit formatted keys (e.g., '05') and single-digit keys (e.g., '5')
    for expected keys < 10. Malformed, non-numeric, or out-of-range keys are strictly rejected.
    """
    try:
        if account_digits_str is None or cle_digits_str is None:
            return False

        raw_account = str(account_digits_str).strip()
        raw_cle = str(cle_digits_str).strip()

        if raw_account.startswith(("-", "+")) or raw_cle.startswith(("-", "+")):
            return False

        clean_account = re.sub(r"[\s\-_]", "", raw_account)
        clean_cle = raw_cle

        if not clean_account.isdigit() or not clean_cle.isdigit():
            return False

        if len(clean_cle) not in (1, 2):
            return False

        account = int(clean_account)
        if account <= 0:
            return False

        remainder = (account * 100) % 97
        expected_cle = 97 - remainder if remainder != 0 else 97

        expected_cle_2digit = f"{expected_cle:02d}"
        expected_cle_1digit = str(expected_cle)

        return clean_cle in (expected_cle_2digit, expected_cle_1digit)
    except (ValueError, ZeroDivisionError, TypeError):
        return False


def normalize_algerian_text_with_spans(
    raw_text: str,
) -> Tuple[str, List[int], List[int]]:
    """
    Multi-phase normalization exposing hidden contact data while preserving
    bidirectional index maps [start_idx, end_idx] into the raw original string.
    """
    if not raw_text:
        return "", [], []

    tokens = list(re.finditer(r"[a-zA-Z0-9_\u0621-\u064A]+|\S+|\s+", raw_text))
    norm_chars: List[str] = []
    map_start: List[int] = []
    map_end: List[int] = []

    for tok in tokens:
        word = tok.group(0)
        # Strip zero-width chars and Arabic diacritics
        cleaned = ZERO_WIDTH_CHARS.sub("", word)
        cleaned = ARABIC_TASHKEEL.sub("", cleaned)
        cleaned = unicodedata.normalize("NFKC", cleaned)
        cleaned = cleaned.translate(EASTERN_TO_ASCII)

        norm = NUMBER_WORDS.get(cleaned.lower(), cleaned)
        orig_s = tok.start()
        orig_e = tok.end() - 1

        for i, c in enumerate(norm):
            norm_chars.append(c)
            if len(norm) == 1:
                map_start.append(orig_s)
                map_end.append(orig_e)
            else:
                interp_s = (
                    orig_s
                    if i == 0
                    else orig_s + int((orig_e - orig_s) * (i / max(1, len(norm) - 1)))
                )
                interp_e = (
                    orig_e
                    if i == len(norm) - 1
                    else orig_s + int((orig_e - orig_s) * ((i + 1) / max(1, len(norm))))
                )
                map_start.append(interp_s)
                map_end.append(interp_e)

    return "".join(norm_chars), map_start, map_end


def normalize_algerian_text(raw_text: str) -> str:
    """Backward-compatible helper returning normalized string."""
    norm_text, _, _ = normalize_algerian_text_with_spans(raw_text)
    return norm_text


def _merge_and_apply_replacements(
    content: str, replacements: List[Tuple[int, int, str]]
) -> str:
    """Merge overlapping text slices and replace from right to left."""
    if not replacements:
        return content

    # Sort ascending by start index
    replacements = sorted(replacements, key=lambda x: (x[0], -x[1]))
    merged: List[List] = []
    for s, e, mask in replacements:
        if s < 0 or e <= s:
            continue
        if not merged:
            merged.append([s, e, mask])
        else:
            if s <= merged[-1][1]:
                # Overlap: extend existing slice
                merged[-1][1] = max(merged[-1][1], e)
            else:
                merged.append([s, e, mask])

    # Replace from end to start to preserve slice indices
    res = content
    for s, e, mask in reversed(merged):
        res = res[:s] + mask + res[e:]
    return res


def inspect_and_mask_disintermediation(content: str) -> Tuple[str, bool, List[str]]:
    """
    Scans, detects, and masks disintermediation vectors across Algerian telecom,
    banking, and off-platform channels. Natively tolerates interspersed spaces,
    dots, dashes, and zero-width chars directly on the raw content string, as
    well as phonetic Arabizi/Kabyle spellings via bidirectional index mapping.

    Returns:
        (sanitized_content, is_flagged, list_of_detected_flags)
    """
    if not content or not content.strip():
        return content, False, []

    flags: Set[str] = set()
    raw_replacements: List[Tuple[int, int, str]] = []

    # ── Pass 1: Direct matches against raw content ────────────────────────────
    for m in ALGERIAN_PHONE_PATTERN.finditer(content):
        flags.add("ALGERIAN_PHONE_NUMBER")
        raw_replacements.append((m.start(), m.end(), "[NUMÉRO DE TÉLÉPHONE MASQUÉ]"))

    for m in BARIDIMOB_RIP_PATTERN.finditer(content):
        flags.add("BARIDIMOB_RIP")
        raw_replacements.append((m.start(), m.end(), "[RIP BARIDIMOB MASQUÉ]"))

    for m in EDAHABIA_CARD_PATTERN.finditer(content):
        flags.add("EDAHABIA_CARD")
        raw_replacements.append((m.start(), m.end(), "[CARTE EDAHABIA MASQUÉE]"))

    for m in CCP_CLE_PATTERN.finditer(content):
        flags.add("CCP_ACCOUNT_KEY")
        raw_replacements.append((m.start(), m.end(), "[COMPTE CCP MASQUÉ]"))

    for m in EMAIL_PATTERN.finditer(content):
        flags.add("EMAIL_ADDRESS")
        raw_replacements.append((m.start(), m.end(), "[EMAIL MASQUÉ]"))

    for m in SOCIAL_CHANNELS_PATTERN.finditer(content):
        flags.add("OFF_PLATFORM_CHANNEL_LEAK")
        raw_replacements.append((m.start(), m.end(), "[CANAL EXTERNE MASQUÉ]"))

    # ── Pass 2: Matches against normalized text with bidirectional span mapping
    norm_text, map_s, map_e = normalize_algerian_text_with_spans(content)
    if norm_text and map_s and map_e:

        def _get_raw_span(match: re.Match) -> Optional[Tuple[int, int]]:
            s_idx = match.start()
            e_idx = match.end() - 1
            if 0 <= s_idx < len(map_s) and 0 <= e_idx < len(map_e):
                raw_start = map_s[s_idx]
                raw_end = map_e[e_idx] + 1
                if raw_end > raw_start:
                    return raw_start, raw_end
            return None

        for m in ALGERIAN_PHONE_PATTERN.finditer(norm_text):
            flags.add("ALGERIAN_PHONE_NUMBER")
            span = _get_raw_span(m)
            if span:
                raw_replacements.append(
                    (span[0], span[1], "[NUMÉRO DE TÉLÉPHONE MASQUÉ]")
                )

        for m in BARIDIMOB_RIP_PATTERN.finditer(norm_text):
            flags.add("BARIDIMOB_RIP")
            span = _get_raw_span(m)
            if span:
                raw_replacements.append((span[0], span[1], "[RIP BARIDIMOB MASQUÉ]"))

        for m in EDAHABIA_CARD_PATTERN.finditer(norm_text):
            flags.add("EDAHABIA_CARD")
            span = _get_raw_span(m)
            if span:
                raw_replacements.append((span[0], span[1], "[CARTE EDAHABIA MASQUÉE]"))

        for m in CCP_CLE_PATTERN.finditer(norm_text):
            flags.add("CCP_ACCOUNT_KEY")
            span = _get_raw_span(m)
            if span:
                raw_replacements.append((span[0], span[1], "[COMPTE CCP MASQUÉ]"))

        for m in EMAIL_PATTERN.finditer(norm_text):
            flags.add("EMAIL_ADDRESS")
            span = _get_raw_span(m)
            if span:
                raw_replacements.append((span[0], span[1], "[EMAIL MASQUÉ]"))

        for m in SOCIAL_CHANNELS_PATTERN.finditer(norm_text):
            flags.add("OFF_PLATFORM_CHANNEL_LEAK")
            span = _get_raw_span(m)
            if span:
                raw_replacements.append((span[0], span[1], "[CANAL EXTERNE MASQUÉ]"))

    sanitized = _merge_and_apply_replacements(content, raw_replacements)

    # ── Pass 3: Final sweep to guarantee no remnant escaped ───────────────────
    if ALGERIAN_PHONE_PATTERN.search(sanitized):
        flags.add("ALGERIAN_PHONE_NUMBER")
        sanitized = ALGERIAN_PHONE_PATTERN.sub(
            "[NUMÉRO DE TÉLÉPHONE MASQUÉ]", sanitized
        )

    if BARIDIMOB_RIP_PATTERN.search(sanitized):
        flags.add("BARIDIMOB_RIP")
        sanitized = BARIDIMOB_RIP_PATTERN.sub("[RIP BARIDIMOB MASQUÉ]", sanitized)

    if EDAHABIA_CARD_PATTERN.search(sanitized):
        flags.add("EDAHABIA_CARD")
        sanitized = EDAHABIA_CARD_PATTERN.sub("[CARTE EDAHABIA MASQUÉE]", sanitized)

    if CCP_CLE_PATTERN.search(sanitized):
        flags.add("CCP_ACCOUNT_KEY")
        sanitized = CCP_CLE_PATTERN.sub("[COMPTE CCP MASQUÉ]", sanitized)

    if EMAIL_PATTERN.search(sanitized):
        flags.add("EMAIL_ADDRESS")
        sanitized = EMAIL_PATTERN.sub("[EMAIL MASQUÉ]", sanitized)

    if SOCIAL_CHANNELS_PATTERN.search(sanitized):
        flags.add("OFF_PLATFORM_CHANNEL_LEAK")
        sanitized = SOCIAL_CHANNELS_PATTERN.sub("[CANAL EXTERNE MASQUÉ]", sanitized)

    is_flagged = len(flags) > 0
    return sanitized, is_flagged, sorted(list(flags))
