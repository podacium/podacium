"""
WhatsApp message parser for Algerian SME data ingestion.

Parses unstructured Arabic, Arabizi, and French text from WhatsApp messages into
structured financial columnar records for the BI engine.
Handles colloquial currency terms:
- 1 Dinar = 20 douro = 100 centimes (1 douro = 0.05 DZD, 1 centime = 0.01 DZD)
- 1 alf / k = 1,000 DZD
- 1 mlyon / melyoun = 10,000 DZD (1,000,000 centimes)
- 1 chkara = 100,000 DZD (10 mlyon)
- 1 myar / milyar = 10,000,000 DZD (1 milliard centimes)

Also extracts:
- Transaction types & categories (vente, achat, depense, revenu, kridi)
- Payment methods (BaridiMob, EDAHABIA, CIB, Cash, Virement)
- 58-Wilaya geography via WilayaEngine
- Counterparties & debt / kridi balances
"""

import logging
import os
import re
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ───────────────────────────────────────────────────────────────────
# Constants
# ───────────────────────────────────────────────────────────────────

CATEGORY_MAP_LOCAL = {
    # Sales / Revenue
    "بعت": "vente",
    "بيعة": "vente",
    "دخل": "revenu",
    "مدخول": "revenu",
    "ربح": "profit",
    "رصيد": "solde",
    "versé": "revenu",
    "verse": "revenu",
    # Purchases / Expenses
    "شريت": "achat",
    "اشتريت": "achat",
    "خلصت": "depense",
    "دفعت": "depense",
    "مصروف": "depense",
    "فاتورة": "facture",
    # Stock / Inventory
    "مخزون": "stock",
    "سلعة": "stock",
    "بضاعة": "stock",
    # Debt / Credit
    "كريدي": "kridi",
    "سلف": "kridi",
    "دين": "kridi",
}

CATEGORY_MAP_FRENCH = {
    "vendu": "vente",
    "vente": "vente",
    "ventes": "vente",
    "recette": "revenu",
    "revenu": "revenu",
    "revenus": "revenu",
    "profit": "profit",
    "gain": "profit",
    "achat": "achat",
    "achats": "achat",
    "acheté": "achat",
    "achete": "achat",
    "dépense": "depense",
    "depense": "depense",
    "payé": "depense",
    "paye": "depense",
    "facture": "facture",
    "stock": "stock",
    "loyer": "depense",
    "salaire": "depense",
    "electricité": "depense",
    "electricite": "depense",
    "eau": "depense",
    "credit": "kridi",
    "crédit": "kridi",
    "dette": "kridi",
}

# Colloquial Denomination Multipliers (Target: DZD)
# Algerian Market Standard: Prices quoted in "mlyon" or "centimes" refer to centimes.
# 1 DZD = 100 Centimes = 20 Douro.
COLLOQUIAL_MULTIPLIERS: List[Tuple[re.Pattern, float, str]] = [
    # 1 Myar / Milyar / ملايير = 10,000,000 DZD (1,000,000,000 centimes)
    (
        re.compile(
            r"(\d+(?:[.,]\d+)?)\s*(?:myar|mlyar|milyar|miliards?|ملايير|مليار)",
            re.IGNORECASE,
        ),
        10_000_000.0,
        "myar",
    ),
    # 1 Chkara / شكارة = 100,000 DZD (10 millions centimes)
    (
        re.compile(
            r"(\d+(?:[.,]\d+)?)\s*(?:chkara|chkaraa|شكارة|شكاير)", re.IGNORECASE
        ),
        100_000.0,
        "chkara",
    ),
    # 1 Mlyon / Melyoun / ملايين = 10,000 DZD (1,000,000 centimes)
    (
        re.compile(
            r"(\d+(?:[.,]\d+)?)\s*(?:mlyon|melyoun|mlayen|millions?|ملايين|مليون)",
            re.IGNORECASE,
        ),
        10_000.0,
        "mlyon",
    ),
    # 1 Alf / K / آلاف = 1,000 DZD
    (
        re.compile(
            r"(\d+(?:[.,]\d+)?)\s*(?:alf|alaf|k\b|mille|آلاف|الاف|الف)", re.IGNORECASE
        ),
        1_000.0,
        "alf",
    ),
    # Centimes / Santim / سنتيم = 0.01 DZD (1/100 Dinar)
    (
        re.compile(
            r"(\d+(?:[.,]\d+)?)\s*(?:centimes?|santim|سنتيم|سنتيمات)", re.IGNORECASE
        ),
        0.01,
        "centimes",
    ),
    # Douro / Dourou / دورو = 0.05 DZD (1/20 Dinar)
    (
        re.compile(r"(\d+(?:[.,]\d+)?)\s*(?:douro|dourou|دوروا|دورو)", re.IGNORECASE),
        0.05,
        "douro",
    ),
]

# Safe, linear numeric matching patterns (ReDoS-immune)
AMOUNT_PATTERNS = [
    # "1500 دج" or "1500 DA" or "1500 DZD"
    r"(\d+(?:[.,]\d+)?)\s*(?:دج|د\.ج|DA|DZD|دينار|dinars?)",
    # "ب 1500" / "à 1500" / "a 1500"
    r"(?:ب|à|a)\s*(\d+(?:[.,]\d+)?)",
    # Standalone number >= 50
    r"(?:^|\s)(\d{2,}(?:\.\d+)?)(?:\s|$)",
]

QUANTITY_PATTERN = r"(\d+)\s*(?:حاجة|حاجات|قطعة|كيلو|كغ|kg|pcs?|pièces?|units?|خبزات?|غاتو|كرطونة|cartons?)"

PAYMENT_METHODS = [
    (
        re.compile(
            r"\b(?:baridimob|baridi\s*mob|بريدي\s*موب|بريديموب)\b", re.IGNORECASE
        ),
        "BARIDIMOB",
    ),
    (
        re.compile(
            r"\b(?:edahabia|dahabia|carte\s*edahabia|ذهبية|الذهبية|بطاقة\s*ذهبية)\b",
            re.IGNORECASE,
        ),
        "EDAHABIA",
    ),
    (re.compile(r"\b(?:cib|carte\s*cib|بطاقة\s*بنكية)\b", re.IGNORECASE), "CIB"),
    (re.compile(r"\b(?:virement|cheque|chèque|صك|تحويل)\b", re.IGNORECASE), "TRANSFER"),
    (re.compile(r"\b(?:especes|cash|كاش|يد\s*بيد|سيولة)\b", re.IGNORECASE), "CASH"),
]


# ───────────────────────────────────────────────────────────────────
# Parser
# ───────────────────────────────────────────────────────────────────


class WhatsAppParser:
    """Parses WhatsApp-style Algerian business messages into structured columnar records."""

    @staticmethod
    def _clean_amount(raw: str) -> float:
        """Convert a raw amount string to float."""
        cleaned = raw.replace(" ", "").replace(",", ".")
        cleaned = cleaned.rstrip(".")
        try:
            return float(cleaned)
        except ValueError:
            return 0.0

    @classmethod
    def _extract_amount_and_denomination(cls, text: str) -> Tuple[float, float, str]:
        """
        Extract numeric value, standard DZD amount, and denomination string.
        Prioritizes colloquial Algerian conversions before standard DZD.
        Returns: (amount_dzd, original_amount, denomination)
        """
        # 1. Check colloquial denomination patterns
        for pattern, mult, denom in COLLOQUIAL_MULTIPLIERS:
            match = pattern.search(text)
            if match:
                raw_num = cls._clean_amount(match.group(1))
                if raw_num > 0:
                    amount_dzd = round(raw_num * mult, 2)
                    return amount_dzd, raw_num, denom

        # Special phrase: "نص مليون" (Half a million centimes = 5,000 DZD)
        if "نص مليون" in text or "demi million" in text.lower():
            return 5000.0, 0.5, "mlyon"
        # Special phrase: "زوج ملايين" (2 million centimes = 20,000 DZD)
        if "زوج ملايين" in text:
            return 20000.0, 2.0, "mlyon"

        # 2. Standard DZD patterns
        for pattern_str in AMOUNT_PATTERNS:
            match = re.search(pattern_str, text, re.IGNORECASE)
            if match:
                raw_val = cls._clean_amount(match.group(1))
                if raw_val > 0:
                    return raw_val, raw_val, "dzd"

        return 0.0, 0.0, "unknown"

    @staticmethod
    def _detect_category(text: str) -> str:
        """Detect transaction category from message text."""
        lower = text.lower()

        # Check local terms
        for term, cat in CATEGORY_MAP_LOCAL.items():
            if term in text:
                return cat

        # Check French terms
        for term, cat in CATEGORY_MAP_FRENCH.items():
            if term in lower:
                return cat

        return "autre"

    @staticmethod
    def _detect_type(category: str) -> str:
        """Determine if this is income, expense, or debt/receivable."""
        if category in {"vente", "revenu", "profit", "solde"}:
            return "revenu"
        if category == "kridi":
            return "kridi"
        return "depense"

    @staticmethod
    def _detect_payment_method(text: str) -> str:
        """Detect payment instrument used."""
        for pattern, method in PAYMENT_METHODS:
            if pattern.search(text):
                return method
        return "CASH"

    @classmethod
    def _detect_wilaya(cls, text: str) -> Optional[Dict[str, Any]]:
        """Resolve Algerian Wilaya from text using WilayaEngine."""
        try:
            from app.services.bi_services.wilaya_engine import WilayaEngine

            record = WilayaEngine.resolve_from_text(text)
            if record:
                return {
                    "code": record.code,
                    "name_fr": record.name_fr,
                    "region": record.region,
                }
        except Exception as e:
            logger.debug(f"Wilaya resolution failed: {e}")
        return None

    @staticmethod
    def _extract_counterparty(text: str) -> Optional[str]:
        """Extract customer or supplier name from context."""
        patterns = [
            r"(?:3and|عند|chez|pour|client|fournisseur|عمي|سي|محل)\s+([A-Za-z\u0600-\u06FF]+(?:\s+[A-Za-z\u0600-\u06FF]+)?)",
            r"(?:من عند|versé par)\s+([A-Za-z\u0600-\u06FF]+(?:\s+[A-Za-z\u0600-\u06FF]+)?)",
        ]
        for pat in patterns:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                cp = match.group(1).strip()
                if len(cp) > 2 and not cp.isdigit():
                    return cp
        return None

    @staticmethod
    def _extract_quantity(text: str) -> Optional[int]:
        """Extract quantity if mentioned."""
        match = re.search(QUANTITY_PATTERN, text, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                return None
        return None

    @staticmethod
    def _extract_description(text: str) -> str:
        """Clean the text into a short description without regex backtracking."""
        words = text.split()
        clean_words = []
        stop_currencies = {
            "دج",
            "د.ج",
            "da",
            "dzd",
            "دينار",
            "dinars",
            "dinar",
            "mlyon",
            "melyoun",
            "mlayen",
            "million",
            "millions",
            "alf",
            "alaf",
            "mille",
            "الف",
            "الاف",
            "آلاف",
            "centimes",
            "centime",
            "santim",
            "سنتيم",
            "سنتيمات",
            "douro",
            "dourou",
            "دورو",
            "دوروا",
            "myar",
            "mlyar",
            "milyar",
            "chkara",
            "شكارة",
        }
        for w in words:
            clean_w = w.lower().strip(".,;:?!()[]")
            if clean_w in stop_currencies or re.match(r"^\d+(?:[.,]\d+)?$", clean_w):
                continue
            clean_words.append(w)
        desc = " ".join(clean_words).strip()
        return desc[:100] if desc else text[:100]

    @classmethod
    def parse_message(
        cls, message: str, msg_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Parse a single WhatsApp message into a structured columnar record.
        """
        text = message.strip()
        if not text:
            return {}

        category = cls._detect_category(text)
        amount_dzd, orig_amount, denomination = cls._extract_amount_and_denomination(
            text
        )
        quantity = cls._extract_quantity(text)
        description = cls._extract_description(text)
        tx_type = cls._detect_type(category)
        payment_method = cls._detect_payment_method(text)
        counterparty = cls._extract_counterparty(text)
        wilaya = cls._detect_wilaya(text)

        is_kridi = category == "kridi" or any(
            w in text.lower()
            for w in ["kridi", "crédit", "credit", "كريدي", "سلف", "دين"]
        )
        is_settlement = any(
            w in text.lower() for w in ["versé", "verse", "خلص", "مدلي", "دفعة"]
        )

        # Extract remaining balance if mentioned (e.g., "باقي 5000")
        remaining_balance = None
        rem_match = re.search(
            r"(?:baqi|restant|باقي)\s*(\d[\d\s.,]*\d|\d+)", text, re.IGNORECASE
        )
        if rem_match:
            remaining_balance = cls._clean_amount(rem_match.group(1))

        record: Dict[str, Any] = {
            "date": msg_date or date.today().isoformat(),
            "description": description,
            "category": category,
            "type": tx_type,
            "amount": amount_dzd,  # Standard DZD (Backward compatible)
            "amount_dzd": amount_dzd,
            "original_amount": orig_amount,
            "denomination": denomination,
            "currency": "DZD",
            "payment_method": payment_method,
            "counterparty": counterparty,
            "is_debt_kridi": is_kridi,
            "is_settlement": is_settlement,
            "remaining_balance_dzd": remaining_balance,
            "wilaya_code": wilaya["code"] if wilaya else None,
            "wilaya_name": wilaya["name_fr"] if wilaya else None,
            "region": wilaya["region"] if wilaya else None,
            "source": "whatsapp",
        }

        if quantity is not None:
            record["quantity"] = quantity

        return record

    @classmethod
    def parse_bulk(cls, raw_text: str) -> List[Dict[str, Any]]:
        """
        Parse a block of WhatsApp messages (one per line) into records.
        Skips empty lines and metadata lines.
        """
        lines = raw_text.strip().split("\n")
        records = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Skip common WhatsApp metadata lines
            if any(
                skip in line.lower()
                for skip in [
                    "image omitted",
                    "audio omitted",
                    "video omitted",
                    "sticker omitted",
                    "document omitted",
                    "messages and calls are end-to-end encrypted",
                    "تم حذف هذه الرسالة",
                ]
            ):
                continue

            # Timestamp extraction: "[23/04/2026, 14:30]" or "23/04/2026, 14:30 -"
            date_match = re.match(
                r"\[?(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})[,\s]+\d{1,2}:\d{2}(?::\d{2})?\]?\s*[-–]?\s*(.*)",
                line,
            )
            if date_match:
                raw_date = date_match.group(1)
                message_body = date_match.group(2)
                sender_match = re.match(r"[^:]+:\s*(.*)", message_body)
                if sender_match:
                    message_body = sender_match.group(1)
                try:
                    parts = re.split(r"[/\-]", raw_date)
                    if len(parts[2]) == 2:
                        parts[2] = "20" + parts[2]
                    parsed_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
                except (ValueError, IndexError):
                    parsed_date = date.today().isoformat()
            else:
                message_body = line
                parsed_date = date.today().isoformat()

            record = cls.parse_message(message_body, parsed_date)
            if record and record.get("amount_dzd", 0.0) > 0:
                records.append(record)

        return records

    @classmethod
    def to_parquet(cls, records: List[Dict[str, Any]], output_path: str) -> str:
        """
        Export parsed structured records to a high-performance columnar Parquet file.
        """
        import pandas as pd

        df = pd.DataFrame(records)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        df.to_parquet(output_path, index=False, engine="pyarrow")
        return output_path
