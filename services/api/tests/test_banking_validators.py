"""
Unit tests for Algerian Banking & CCP MOD-97 validators under Bank of Algeria Reg 25-02.
"""

from app.core.algerian_validators import (
    verify_algerian_rip_checksum as core_verify_rip,
    verify_ccp_cle as core_verify_ccp_cle,
    validate_algerian_nif_checksum,
    generate_valid_nif,
)
from app.core.banking_validators import validate_algerian_rib, validate_ccp_account
from app.services.algerian_shield_service import (
    inspect_and_mask_disintermediation,
    normalize_algerian_text_with_spans,
    verify_algerian_rip_checksum,
    verify_ccp_cle,
)


def test_valid_algerian_rib():
    """Test standard valid Algerian 20-digit RIB checksum under Instruction 06-2004."""
    # Bank 002 (BEA), Branch 00123, Account 1234567890
    bank = "002"
    branch = "00123"
    account = "1234567890"
    base = int(bank + branch + account)
    remainder = (base * 100) % 97
    key = (97 - remainder) % 97
    if key == 0:
        key = 97
    valid_rib = f"{bank}{branch}{account}{key:02d}"

    is_valid, err, details = validate_algerian_rib(valid_rib)
    assert is_valid is True
    assert err is None
    assert details["bank_code"] == "002"
    assert details["branch_code"] == "00123"


def test_invalid_algerian_rib_checksum():
    """Test modified checksum key is rejected."""
    bad_rib = "00200123123456789000"  # Wrong key
    is_valid, err, _ = validate_algerian_rib(bad_rib)
    assert is_valid is False
    assert "Invalid RIB MOD-97 checksum" in err


def test_invalid_rib_length():
    """Test short or long RIB is rejected."""
    short_rib = "0020012312345"
    is_valid, err, _ = validate_algerian_rib(short_rib)
    assert is_valid is False
    assert "20 digits" in err


def test_valid_ccp_account():
    """Test Algérie Poste CCP validation."""
    account = "1234567"
    remainder = (int(account) * 100) % 97
    key = (97 - remainder) % 97
    if key == 0:
        key = 97
    is_valid, err = validate_ccp_account(account, f"{key:02d}")
    assert is_valid is True
    assert err is None


def test_validate_ccp_account_rejects_inverted_key():
    """Test validate_ccp_account strictly rejects the inverted direct modulo (VULN-W2-05)."""
    # Account 63 -> expected is 05 or 5
    # Flawed direct modulo was account % 97 = 63 or remainder = 92
    assert validate_ccp_account("63", "05")[0] is True
    assert validate_ccp_account("63", "5")[0] is True
    assert validate_ccp_account("63", "63")[0] is False
    assert validate_ccp_account("63", "92")[0] is False

    # Account 12345678 -> expected key is 88
    # A single digit key "8" must be rejected since expected >= 10
    assert validate_ccp_account("12345678", "88")[0] is True
    assert validate_ccp_account("12345678", "8")[0] is False


def test_verify_ccp_cle_valid_and_single_digit():
    """Test verify_ccp_cle for standard and single-digit keys (with '05' and '5')."""
    for fn in (verify_ccp_cle, core_verify_ccp_cle):
        # Account 63 -> (63 * 100) % 97 = 92 -> expected_cle = 97 - 92 = 5
        assert fn("63", "05") is True
        assert fn("63", "5") is True
        assert fn("63", "005") is False
        assert fn("63", "50") is False
        # Erroneous direct modulo: 63 % 97 = 63 must be False
        assert fn("63", "63") is False

        # Account 12345678 -> (12345678 * 100) % 97 = 9 -> expected_cle = 97 - 9 = 88
        assert fn("12345678", "88") is True
        assert fn("12345678", "088") is False
        assert fn("12345678", "87") is False
        # Single digit when expected >= 10 must be False
        assert fn("12345678", "8") is False


def test_verify_ccp_cle_zero_remainder():
    """Test verify_ccp_cle when remainder is zero (expected_cle = 97)."""
    for fn in (verify_ccp_cle, core_verify_ccp_cle):
        # Account 97 -> (97 * 100) % 97 = 0 -> expected_cle = 97
        assert fn("97", "97") is True
        assert fn("97", "00") is False
        assert fn("97", "0") is False


def test_verify_ccp_cle_leading_zeros():
    """Test verify_ccp_cle handling of leading zeros in account numbers."""
    for fn in (verify_ccp_cle, core_verify_ccp_cle):
        assert fn("0063", "05") is True
        assert fn("0063", "5") is True
        assert fn("00012345678", "88") is True
        assert fn("0012 345-678", "88") is True


def test_verify_ccp_cle_malformed_inputs():
    """Test verify_ccp_cle strictly rejects non-digit or malformed inputs."""
    for fn in (verify_ccp_cle, core_verify_ccp_cle):
        assert fn("63", "") is False
        assert fn("63", "   ") is False
        assert fn("63", "xyz") is False
        assert fn("63", "05a") is False
        assert fn("63", "-5") is False
        assert fn("63", "+5") is False
        assert fn("63", "98") is False
        assert fn("63", "99") is False
        assert fn("xyz", "05") is False
        assert fn("0", "97") is False
        assert fn("-63", "05") is False
        assert fn(None, "05") is False
        assert fn("63", None) is False


def test_baridimob_rip_modulo97_instruction_06_2004():
    """Verify BaridiMob RIP Modulo-97 validation strictly conforms to Bank of Algeria Instruction 06-2004."""
    # Bank 007 (Algérie Poste), Branch 99999, 10-digit account
    account_part = "007999990012345678"
    remainder = (int(account_part) * 100) % 97
    expected_key = 97 - remainder if remainder != 0 else 97
    valid_rip = f"{account_part}{expected_key:02d}"

    for fn in (verify_algerian_rip_checksum, core_verify_rip):
        assert fn(valid_rip) is True
        # Wrong key
        wrong_key = (expected_key + 1) % 97 or 97
        assert fn(f"{account_part}{wrong_key:02d}") is False
        # Short / long
        assert fn(valid_rip[:19]) is False
        assert fn(valid_rip + "1") is False
        # Non-007 prefix (e.g. 002 BEA is not an Algérie Poste RIP)
        assert fn("002" + valid_rip[3:]) is False
        assert fn(None) is False


def test_algerian_shield_carrier_regexes():
    """Test Algerian Shield 3-pass detection of Mobilis (06), Djezzy (07), Ooredoo (05), Landlines."""
    # Mobilis 06
    masked, flagged, flags = inspect_and_mask_disintermediation(
        "Contactez-moi sur 06 55 44 33 22 pour le contrat"
    )
    assert flagged is True
    assert "ALGERIAN_PHONE_NUMBER" in flags
    assert "[NUMÉRO DE TÉLÉPHONE MASQUÉ]" in masked

    # Djezzy 07
    masked, flagged, flags = inspect_and_mask_disintermediation(
        "Mon num Djezzy: 07-70-11-22-33 merci"
    )
    assert flagged is True
    assert "ALGERIAN_PHONE_NUMBER" in flags
    assert "07-70-11-22-33" not in masked

    # Ooredoo 05
    masked, flagged, flags = inspect_and_mask_disintermediation(
        "Appelez sur 05.50.99.88.77 direct"
    )
    assert flagged is True
    assert "ALGERIAN_PHONE_NUMBER" in flags
    assert "05.50.99.88.77" not in masked

    # Country code +213 format
    masked, flagged, flags = inspect_and_mask_disintermediation(
        "+213 (0) 661 23 45 67 whatsapp"
    )
    assert flagged is True
    assert "ALGERIAN_PHONE_NUMBER" in flags
    assert "[NUMÉRO DE TÉLÉPHONE MASQUÉ]" in masked


def test_algerian_shield_arabizi_and_spans():
    """Test Arabizi phonetics and bidirectional character span reconstruction."""
    raw_text = "Nemro ta3i: sefr setta khamsa reb3a tlata zouj wa7ed tmanya tes3a sefr"
    norm, map_s, map_e = normalize_algerian_text_with_spans(raw_text)
    assert len(norm) == len(map_s) == len(map_e)

    # 3-pass inspection masks the phonetic phone number
    masked, flagged, flags = inspect_and_mask_disintermediation(raw_text)
    assert flagged is True
    assert "ALGERIAN_PHONE_NUMBER" in flags
    assert "[NUMÉRO DE TÉLÉPHONE MASQUÉ]" in masked


def test_algerian_nif_20_digit_enterprise_branch_validation():
    """Verify support for 20-digit enterprise secondary establishment (branch) NIFs.
    Validates the 15-digit base checksum while allowing the 5-digit branch suffix.
    """
    for wilaya in (16, 31, 25, 9, 1):
        # 1. 15-digit valid base NIF
        valid_15 = generate_valid_nif(
            wilaya=wilaya, year=2023, seq=4321, is_secondary_branch=False
        )
        assert len(valid_15) == 15
        assert validate_algerian_nif_checksum(valid_15) is True

        # 2. 20-digit enterprise secondary establishment (branch) NIF with 5-digit suffix
        valid_20_branch_1 = f"{valid_15}00001"
        valid_20_branch_2 = f"{valid_15}99999"
        assert len(valid_20_branch_1) == 20
        assert len(valid_20_branch_2) == 20
        assert validate_algerian_nif_checksum(valid_20_branch_1) is True
        assert validate_algerian_nif_checksum(valid_20_branch_2) is True

        # 3. 20-digit NIF with corrupted 15-digit base check digit must fail
        corrupted_check = str((int(valid_15[14]) + 5) % 10)
        corrupted_20 = valid_15[:14] + corrupted_check + "00001"
        assert validate_algerian_nif_checksum(corrupted_20) is False

    # 4. Invalid lengths (not 15 and not 20)
    assert validate_algerian_nif_checksum(valid_15 + "0") is False  # 16 digits
    assert validate_algerian_nif_checksum(valid_15 + "0000") is False  # 19 digits
    assert validate_algerian_nif_checksum(valid_15 + "000001") is False  # 21 digits
    assert validate_algerian_nif_checksum(None) is False
    assert validate_algerian_nif_checksum("") is False
