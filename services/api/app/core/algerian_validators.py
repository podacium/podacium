"""
Algerian Regulatory & Statutory Fiscal Validators (Loi 22-23, CIDTA Art. 169/224, Code de Commerce).
Validates CNRC (Registre du Commerce), NIF (15-digit Luhn/Modulo-10 checksum), NIS, and Article d'Imposition.
"""

import re
from typing import Any, Dict, Optional

ALGERIAN_REGEX = {
    # CNRC: 2-digit Wilaya (01-69), A (Physique) or B (Morale), 7-digit sequential
    "CNRC": r"^[0-6][0-9][AB][0-9]{7}$",
    # Stamped CNRC: Wilaya/Antenne-Numéro/Forme/Année (e.g. 16/00-0123456B22)
    "CNRC_STAMPED": r"^[0-6][0-9]/[0-9]{2}-[0-9]{5,8}[AB][0-9]{2}$",
    # NIF: Exactly 15 digits (or 20 digits for secondary branch)
    "NIF": r"^[0-6][0-9][0-9]{2}(19[7-9][0-9]|20[0-2][0-9])[0-9]{7}$",
    "NIF_20": r"^[0-6][0-9][0-9]{2}(19[7-9][0-9]|20[0-2][0-9])[0-9]{7}[0-9]{5}$",
    # NIS: 9 digits (legacy), 15 digits (standard), 18 digits (regional branch), or 20 digits (secondary establishment)
    "NIS": r"^\d{9}$|^\d{15}$|^\d{18}$|^\d{20}$",
    # Article d'Imposition: Exactly 11 digits
    "ARTICLE_IMPOSITION": r"^\d{11}$",
}


def clean_fiscal_identifier(value: Optional[str]) -> str:
    """Strip whitespace, dashes, and slashes from statutory fiscal IDs."""
    if not value:
        return ""
    return re.sub(r"[\s/-]", "", str(value)).strip()


def parse_cnrc_details(rc_str: Optional[str]) -> Optional[Dict[str, Any]]:
    """
    Parse and validate Algerian Trade Register (CNRC) number.
    Handles:
    - Stamped format with punctuation: e.g. '16/00-0123456B22', '16/00-12345B20', '31/00-7890123A21'
    - Stamped format without punctuation: e.g. '16000123456B22'
    - Stripped format: e.g. '16B0012345', '31A0098765' (Wilaya 01-69 + A/B + 7 digits)
    - Separated stripped format: e.g. ' 16-B/0012345 ', '16/B/0012345', '16-B-0012345'
    - Alternate format with year: e.g. '31B0123456-00/21'
    """
    if not rc_str:
        return None

    raw = str(rc_str).strip().upper()

    # 1. Stamped format with punctuation: 16/00-0123456B22 or 31/00-7890123A20
    m_stamped = re.match(
        r"^([0-6][0-9])[/.\s-]([0-9]{2})[/.\s-]([0-9]{5,8})([AB])([0-9]{2})$",
        raw,
    )
    if m_stamped:
        wilaya, antenne, chrono, legal_type, year = m_stamped.groups()
        w_int = int(wilaya)
        if 1 <= w_int <= 69:
            return {
                "valid": True,
                "format": "STANDARD_CNRC",
                "wilaya_code": wilaya,
                "antenne": antenne,
                "chrono_number": chrono,
                "legal_type": legal_type,
                "legal_structure": (
                    "Personne Morale (Société)"
                    if legal_type == "B"
                    else "Personne Physique"
                ),
                "registration_year": f"20{year}" if len(year) == 2 else year,
            }

    # 2. Stripped format with punctuation between tokens: e.g. ' 16-B/0012345 ', '31B0123456-00/21'
    m_alt = re.match(
        r"^([0-6][0-9])[-/\s]*([AB])[-/\s]*([0-9]{7})(?:[-/\s]*([0-9]{2}))?(?:[-/\s]*([0-9]{2}))?$",
        raw,
    )
    if m_alt:
        wilaya, legal_type, chrono, opt1, opt2 = m_alt.groups()
        w_int = int(wilaya)
        if 1 <= w_int <= 69:
            year_val = opt2 or opt1
            return {
                "valid": True,
                "format": "LEGACY_CNRC",
                "wilaya_code": wilaya,
                "antenne": "00",
                "chrono_number": chrono,
                "legal_type": legal_type,
                "legal_structure": (
                    "Personne Morale (Société)"
                    if legal_type == "B"
                    else "Personne Physique"
                ),
                "registration_year": f"20{year_val}" if year_val else "Non spécifié",
            }

    # 3. Clean all punctuation and check stripped or stamped representations
    clean = clean_fiscal_identifier(raw).upper()

    # 3a. Clean stamped format: e.g. 16000123456B22
    m_clean_stamped = re.match(
        r"^([0-6][0-9])([0-9]{2})([0-9]{5,8})([AB])([0-9]{2})$",
        clean,
    )
    if m_clean_stamped:
        wilaya, antenne, chrono, legal_type, year = m_clean_stamped.groups()
        w_int = int(wilaya)
        if 1 <= w_int <= 69:
            return {
                "valid": True,
                "format": "STANDARD_CNRC",
                "wilaya_code": wilaya,
                "antenne": antenne,
                "chrono_number": chrono,
                "legal_type": legal_type,
                "legal_structure": (
                    "Personne Morale (Société)"
                    if legal_type == "B"
                    else "Personne Physique"
                ),
                "registration_year": f"20{year}",
            }

    # 3b. Clean standard stripped: 10 chars -> 2 wilaya + 1 letter + 7 digits
    m_clean_stripped = re.match(
        r"^([0-6][0-9])([AB])([0-9]{7})$",
        clean,
    )
    if m_clean_stripped:
        wilaya, legal_type, chrono = m_clean_stripped.groups()
        w_int = int(wilaya)
        if 1 <= w_int <= 69:
            return {
                "valid": True,
                "format": "LEGACY_CNRC",
                "wilaya_code": wilaya,
                "antenne": "00",
                "chrono_number": chrono,
                "legal_type": legal_type,
                "legal_structure": (
                    "Personne Morale (Société)"
                    if legal_type == "B"
                    else "Personne Physique"
                ),
                "registration_year": "Non spécifié",
            }

    return None


def validate_cnrc_format(rc_str: Optional[str]) -> bool:
    """
    Validate Algerian Trade Register (CNRC) format.
    Accepts:
    - Stamped format: e.g. 16/00-0123456B22 or 16/00-12345B20 (Wilaya/Antenne-Chrono+LegalType+Year)
    - Stripped format: e.g. 16B0012345 (Algiers Corporate) or 31A0098765 (Oran Sole Trader)
    - Formatted variants with spaces, hyphens, and slashes.
    """
    return parse_cnrc_details(rc_str) is not None


def calculate_nif_modulo10_checksum(digits_14: Any) -> int:
    """
    Calculate Algerian NIF Modulo-10 check digit for the first 14 digits.
    Alternating weights: 2 for even index (0, 2, 4...), 1 for odd index (1, 3, 5...).
    Formula: (10 - (sum % 10)) % 10.
    """
    if isinstance(digits_14, str):
        digits = [int(d) for d in digits_14[:14] if d.isdigit()]
    else:
        digits = list(digits_14)[:14]
    total = sum(d * (2 if i % 2 == 0 else 1) for i, d in enumerate(digits))
    return (10 - (total % 10)) % 10


def validate_algerian_nif_checksum(nif_str: Optional[str]) -> bool:
    """
    Validate Algerian 15-digit NIF (Numéro d'Identification Fiscale).
    Supports 15-digit base NIF or 20-digit enterprise secondary establishment NIF.
    Checks:
    - Exactly 15 or 20 numeric digits.
    - Wilaya prefix in 01-69.
    - Modulo-10 checksum on base 15 digits: last digit of base must match (10 - sum % 10) % 10.
    """
    if not nif_str:
        return False
    clean = "".join(filter(str.isdigit, str(nif_str)))
    if len(clean) not in (15, 20):
        return False
    base_nif = clean[:15]
    wilaya = int(base_nif[:2])
    if not (1 <= wilaya <= 69):
        return False
    expected_check = calculate_nif_modulo10_checksum(base_nif[:14])
    return int(base_nif[14]) == expected_check


def generate_valid_nif(
    wilaya: int = 16,
    year: int = 2020,
    seq: int = 1234,
    is_secondary_branch: bool = False,
) -> str:
    """Utility generator for testing valid NIF strings (15 digits or 20 digits)."""
    prefix = f"{wilaya:02d}{0:02d}{year}{seq:07d}"[:14]
    check = calculate_nif_modulo10_checksum(prefix)
    base_nif = f"{prefix}{check}"
    if is_secondary_branch:
        return f"{base_nif}00001"
    return base_nif


def validate_article_imposition(ai_str: Optional[str]) -> bool:
    """Validate Algerian 11-digit Article d'Imposition."""
    if not ai_str:
        return False
    clean = "".join(filter(str.isdigit, str(ai_str)))
    return len(clean) == 11


def validate_nis_format(nis_str: Optional[str]) -> bool:
    """
    Validate Algerian NIS (Numéro d'Identification Statistique).
    Valid lengths:
    - 9 digits: Legacy NIS
    - 15 digits: Standard national statistical identifier
    - 18 digits: Regional secondary branch establishment
    - 20 digits: Enterprise secondary establishment
    """
    if not nis_str:
        return False
    clean = "".join(filter(str.isdigit, str(nis_str)))
    return len(clean) in (9, 15, 18, 20)


def verify_algerian_rip_checksum(rip_digits_str: Optional[str]) -> bool:
    """
    Validate 20-digit Algérie Poste / Bank of Algeria RIP checksum using Modulo 97
    under Bank of Algeria Instruction 06-2004.

    Structure:
      - Code Banque / Etablissement: 3 digits ('007' for Algérie Poste)
      - Code Guichet: 5 digits ('99999' for Algérie Poste)
      - Numéro de Compte: 10 digits
      - Clé RIP: 2 digits

    Formula:
      remainder = (int(account_part) * 100) % 97
      expected_key = 97 - remainder if remainder != 0 else 97
    """
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
    """
    Validate traditional Algerian Algérie Poste CCP account and 2-digit Clé
    according to Bank of Algeria Instruction 06-2004 & Algérie Poste MOD-97.

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
