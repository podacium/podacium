"""
Pillar 7 Test Suite: Algerian Fiscal & Regulatory Integration (ANAE, SATIM, DGI, CNRC).
Tests:
1. Harmonization of CNRC Registry & Algerian Validators (stamped/stripped formats, 9/15/18/20 digit NIS, Modulo-10 NIF).
2. Loi 18-05, Article 169 & 282 sexies CIDTA (26% IBS tax shield).
3. Electronic payment stamp duty exemption (Art. 258 quinquies / LF 2024 Art. 34).
4. G50 quarterly IFU tax breakdown (0.5%) and annual 5,000,000 DZD auto-entrepreneur ceiling tracking.
"""

from app.agent.tools.core.cnrc_registry import VerifyCnrcCompanyRegistryTool
from app.core.algerian_validators import (
    generate_valid_nif,
    validate_algerian_nif_checksum,
    validate_article_imposition,
    validate_cnrc_format,
    validate_nis_format,
)
from app.services.invoice_service import STAMP_DUTY_EXEMPTION_NOTICE
from app.services.invoicing_service import invoicing_service


def test_cnrc_stamped_and_stripped_formats():
    """Verify both stamped (16/00-0123456B22) and stripped (16B0012345) RC formats validate cleanly."""
    tool = VerifyCnrcCompanyRegistryTool()

    # 1. Stamped official formats
    stamped_samples = [
        "16/00-0123456B22",
        "31/00-7890123A20",
        "09/01-12345B21",
        "16000123456B22",  # stripped punctuation variant of stamped
    ]
    for sample in stamped_samples:
        assert validate_cnrc_format(sample) is True, f"Failed for stamped: {sample}"
        res = tool._verify_rc(sample)
        assert res["valid"] is True, f"Tool failed for stamped: {sample}"
        assert res["format"] == "STANDARD_CNRC"
        assert res["wilaya_code"] in ("16", "31", "09")

    # 2. Stripped formats
    stripped_samples = [
        "16B0012345",
        "31A0098765",
        " 16-B/0012345 ",
        "58B0000001",
        "31B0123456-00/21",
    ]
    for sample in stripped_samples:
        assert validate_cnrc_format(sample) is True, f"Failed for stripped: {sample}"
        res = tool._verify_rc(sample)
        assert res["valid"] is True, f"Tool failed for stripped: {sample}"
        assert res["format"] == "LEGACY_CNRC"

    # 3. Invalid formats rejected by both
    invalid_samples = [
        "99B0012345",  # Invalid wilaya > 58
        "00B0012345",  # Invalid wilaya 00
        "16C0012345",  # Invalid entity type (must be A or B)
        "16B001234",  # Too short (6 digits chrono)
        "",
        None,
    ]
    for sample in invalid_samples:
        assert validate_cnrc_format(sample) is False, f"Should be invalid: {sample}"
        if sample:
            res = tool._verify_rc(sample)
            assert res["valid"] is False, f"Tool should reject: {sample}"


def test_nis_harmonization_all_lengths():
    """Verify NIS validation accepts 9-digit, 15-digit, 18-digit, and 20-digit secondary establishments."""
    tool = VerifyCnrcCompanyRegistryTool()

    # 9 digits: Legacy NIS
    assert validate_nis_format("123456789") is True
    res_9 = tool._verify_nis("123456789")
    assert res_9["valid"] is True
    assert res_9["nis_type"] == "LEGACY_9"

    # 15 digits: Standard national statistical identifier
    assert validate_nis_format("002016012345678") is True
    res_15 = tool._verify_nis("002016012345678")
    assert res_15["valid"] is True
    assert res_15["nis_type"] == "STANDARD_15"

    # 18 digits: Regional secondary branch
    assert validate_nis_format("002016012345678001") is True
    res_18 = tool._verify_nis("002016012345678001")
    assert res_18["valid"] is True
    assert res_18["nis_type"] == "SECONDARY_BRANCH_18"

    # 20 digits: Enterprise secondary establishment
    assert validate_nis_format("00201601234567800001") is True
    res_20 = tool._verify_nis("00201601234567800001")
    assert res_20["valid"] is True
    assert res_20["nis_type"] == "SECONDARY_BRANCH_20"

    # Invalid lengths
    for invalid in [
        "123",
        "12345678",
        "1234567890",
        "12345678901234",
        "1234567890123456",
        "123456789012345678901",
    ]:
        assert (
            validate_nis_format(invalid) is False
        ), f"Should be invalid length: {invalid}"
        res_inv = tool._verify_nis(invalid)
        assert res_inv["valid"] is False, f"Tool should reject: {invalid}"


def test_nif_modulo10_checksum_harmonization():
    """Verify standardized Modulo-10 checksum validation across algerian_validators and cnrc_registry."""
    tool = VerifyCnrcCompanyRegistryTool()

    # Generate valid 15-digit NIFs across wilayas
    for wilaya in [16, 31, 25, 9, 1]:
        valid_15 = generate_valid_nif(wilaya=wilaya, year=2022, seq=5678)
        assert len(valid_15) == 15
        assert validate_algerian_nif_checksum(valid_15) is True
        res_tool = tool._verify_nif(valid_15)
        assert res_tool["valid"] is True
        assert res_tool["checksum_match"] is True
        assert res_tool["is_secondary_branch"] is False

        # 20-digit enterprise secondary establishment NIF (15 digits base + 5 digits branch)
        valid_20 = f"{valid_15}00001"
        assert len(valid_20) == 20
        assert validate_algerian_nif_checksum(valid_20) is True
        res_20 = tool._verify_nif(valid_20)
        assert res_20["valid"] is True
        assert res_20["is_secondary_branch"] is True

        # Corrupted check digit
        corrupted = valid_15[:-1] + str((int(valid_15[-1]) + 3) % 10)
        assert validate_algerian_nif_checksum(corrupted) is False
        res_corrupt = tool._verify_nif(corrupted)
        assert res_corrupt["valid"] is False


def test_article_imposition_validation():
    """Validate 11-digit Article d'Imposition."""
    assert validate_article_imposition("16012345678") is True
    assert validate_article_imposition("1601234567") is False  # 10 digits
    assert validate_article_imposition("160123456789") is False  # 12 digits
    assert validate_article_imposition(None) is False


def test_article_169_and_224_ibs_tax_shield_calculation():
    """Verify 26% IBS tax shield under Article 169 & 224 CIDTA."""
    # 100,000 DZD expense -> 26,000 DZD tax shield (26% rate)
    res = invoicing_service.calculate_ibs_tax_shield(100_000.0)
    assert res["eligible"] is True
    assert res["ibs_tax_rate"] == 0.26
    assert res["effective_tax_savings_dzd"] == 26000.0
    assert res["net_effective_cost_dzd"] == 74000.0
    assert "Articles 169 & 224" in res["statutory_basis"]
    assert "Droit de Timbre: 0 DZD (Exonéré" in res["stamp_duty_notice"]


def test_ifu_tax_and_g50_quarterly_breakdown():
    """Verify 0.5% IFU flat tax under LF 2024 Art. 282 sexies CIDTA / Loi 22-23."""
    res_ifu = invoicing_service.calculate_ifu_tax(500_000.0)
    assert res_ifu["ifu_rate"] == 0.005
    assert res_ifu["ifu_tax_due_dzd"] == 2500.0  # 0.5% of 500,000

    # Quarterly breakdown across Q1-Q4
    quarterly_data = {
        1: 300_000.0,
        2: 500_000.0,
        3: 200_000.0,
        4: 600_000.0,
    }
    g50 = invoicing_service.calculate_g50_quarterly_breakdown(quarterly_data)
    assert g50["total_turnover_dzd"] == 1_600_000.0
    assert g50["total_ifu_tax_due_dzd"] == 8000.0  # 0.5% of 1,600,000
    assert len(g50["quarters"]) == 4
    assert g50["quarters"][0]["ifu_tax_due_dzd"] == 1500.0  # 0.5% of 300k
    assert g50["quarters"][1]["ifu_tax_due_dzd"] == 2500.0  # 0.5% of 500k


def test_anae_annual_5m_ceiling_tracking():
    """Verify tracking of annual 5,000,000 DZD auto-entrepreneur turnover ceiling."""
    # Under ceiling: 3,500,000 + 500,000 = 4,000,000 (80% utilization)
    status_ok = invoicing_service.check_anae_turnover_ceiling(
        current_turnover_dzd=3_500_000.0,
        new_invoice_dzd=500_000.0,
    )
    assert status_ok["projected_annual_turnover_dzd"] == 4_000_000.0
    assert status_ok["ceiling_utilization_percent"] == 80.0
    assert status_ok["remaining_headroom_dzd"] == 1_000_000.0
    assert status_ok["is_ceiling_exceeded"] is False
    assert status_ok["warning"] is None

    # Exceeding ceiling: 4_800_000 + 300_000 = 5,100_000 (102% utilization)
    status_exceeded = invoicing_service.check_anae_turnover_ceiling(
        current_turnover_dzd=4_800_000.0,
        new_invoice_dzd=300_000.0,
    )
    assert status_exceeded["projected_annual_turnover_dzd"] == 5_100_000.0
    assert status_exceeded["ceiling_utilization_percent"] == 102.0
    assert status_exceeded["remaining_headroom_dzd"] == 0.0
    assert status_exceeded["is_ceiling_exceeded"] is True
    assert "dépassé" in status_exceeded["warning"]


def test_stamp_duty_exemption_statutory_notice():
    """Verify explicit stamp duty exemption notice for cashless payments (Art. 258 quinquies / LF 2024 Art. 34)."""
    assert "Droit de Timbre: 0 DZD (Exonéré" in STAMP_DUTY_EXEMPTION_NOTICE
    assert "Art. 258 quinquies" in STAMP_DUTY_EXEMPTION_NOTICE
    assert "LF 2024 Art. 34" in STAMP_DUTY_EXEMPTION_NOTICE
    assert (
        "Droit de Timbre: 0 DZD (Exonéré" in invoicing_service.get_stamp_duty_notice()
    )
