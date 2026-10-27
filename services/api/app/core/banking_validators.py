# services/api/app/core/banking_validators.py
"""
Algerian Banking & Payment System Validation Engine.
Compliant with Bank of Algeria Regulation 25-02 and Algérie Poste standards.
Implements MOD-97 checksum verification for 20-digit Algerian RIB and CCP accounts.
"""

import re
from typing import Dict, Optional, Tuple


def validate_algerian_rib(
    rib: str,
) -> Tuple[bool, Optional[str], Optional[Dict[str, str]]]:
    """
    Validate a 20-digit Algerian Relevé d'Identité Bancaire (RIB).
    Structure:
      - Bank Code (Code Banque): 3 digits
      - Agency / Branch Code (Code Guichet): 5 digits
      - Account Number (Numéro de Compte): 10 digits
      - Key (Clé RIB): 2 digits

    Algorithm:
      Key = 97 - ((Bank * 10^17 + Agency * 10^12 + Account * 10^2) mod 97)
    """
    clean_rib = re.sub(r"[\s\-_]", "", str(rib).strip())

    if not clean_rib.isdigit():
        return False, "RIB must contain only numeric digits", None

    if len(clean_rib) != 20:
        return False, f"RIB must be exactly 20 digits, got {len(clean_rib)}", None

    bank_code = clean_rib[0:3]
    branch_code = clean_rib[3:8]
    account_number = clean_rib[8:18]
    provided_key = int(clean_rib[18:20])

    # Convert alphanumeric account characters if any (standard mapping) to digits
    # For numeric-only RIB:
    account_base = int(bank_code + branch_code + account_number)
    remainder = (account_base * 100) % 97
    expected_key = (97 - remainder) % 97
    if expected_key == 0:
        expected_key = 97

    if provided_key != expected_key:
        return (
            False,
            f"Invalid RIB MOD-97 checksum key (expected {expected_key:02d}, got {provided_key:02d})",
            None,
        )

    details = {
        "bank_code": bank_code,
        "branch_code": branch_code,
        "account_number": account_number,
        "key": f"{provided_key:02d}",
        "formatted": f"{bank_code} {branch_code} {account_number} {provided_key:02d}",
    }
    return True, None, details


def validate_ccp_account(
    account_number: str, cle_ccp: str
) -> Tuple[bool, Optional[str]]:
    """
    Validate Algérie Poste CCP Account and 2-digit Key (Clé CCP)
    according to Bank of Algeria Instruction 06-2004 & Algérie Poste MOD-97.

    Algorithm:
      remainder = (account * 100) % 97
      expected_cle = 97 - remainder if remainder != 0 else 97

    Supports both 2-digit zero-padded keys (e.g. '05') and single-digit keys
    (e.g. '5') for expected keys < 10. Malformed or inverted keys are rejected.
    """
    clean_account = re.sub(r"[\s\-_]", "", str(account_number).strip())
    clean_key = str(cle_ccp).strip()

    if clean_account.startswith(("-", "+")) or clean_key.startswith(("-", "+")):
        return False, "CCP account and key must be positive numeric digits"

    if not clean_account.isdigit() or not clean_key.isdigit():
        return False, "CCP account number and key must be numeric"

    if len(clean_key) not in (1, 2):
        return False, "CCP Key must be 1 or 2 digits"

    account_int = int(clean_account)
    if account_int <= 0:
        return False, "CCP account number must be greater than zero"

    remainder = (account_int * 100) % 97
    expected_key = 97 - remainder if remainder != 0 else 97

    expected_2digit = f"{expected_key:02d}"
    expected_1digit = str(expected_key)

    if clean_key not in (expected_2digit, expected_1digit):
        return (
            False,
            f"Invalid CCP key checksum for account {clean_account} (expected {expected_2digit}, got {clean_key})",
        )

    return True, None
