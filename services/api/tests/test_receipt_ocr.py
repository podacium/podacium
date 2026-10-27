"""
Unit tests for BaridiMob & CCP Receipt OCR / Verification Engine.
"""

import pytest
from app.services.receipt_ocr_service import receipt_ocr_service


def test_amount_normalization():
    assert receipt_ocr_service.normalize_amount("50 000,00 DZD") == 50000
    assert receipt_ocr_service.normalize_amount("50.000,00 DA") == 50000
    assert receipt_ocr_service.normalize_amount("12500 DZD") == 12500
    assert receipt_ocr_service.normalize_amount("35 000 DA") == 35000
    assert receipt_ocr_service.normalize_amount("100 000,00 دج") == 100000


def test_parse_baridimob_slip():
    sample_text = """
    Algérie Poste - BaridiMob
    Numéro d'opération: BM2026091600129
    Référence: PODA-CTR102-MS2
    Montant: 45 000,00 DZD
    Vers RIP: 007 99999 0012345678 90
    Date: 2026-09-16 14:30:00
    Statut: Succès
    """
    parsed = receipt_ocr_service.parse_receipt_text(sample_text)
    assert parsed.transaction_id == "BM2026091600129"
    assert parsed.reference_code == "PODA-CTR102-MS2"
    assert parsed.amount_dzd == 45000
    assert parsed.receiver_rip == "00799999001234567890"
    assert parsed.fingerprint is not None


@pytest.mark.asyncio
async def test_verify_receipt_valid():
    sample_text = """
    BaridiMob Virement effectué
    ID: BM9988776655
    Réf: PODA-CTR42-MS1
    Montant: 20 000,00 DZD
    Destinataire: 00799999001122334455
    """
    res = await receipt_ocr_service.verify_receipt(
        raw_text=sample_text,
        expected_amount=20000,
        expected_reference="PODA-CTR42-MS1",
        expected_receiver_rip="00799999001122334455",
    )
    assert res.is_valid is True
    assert res.status == "VALID"


@pytest.mark.asyncio
async def test_verify_receipt_amount_mismatch():
    sample_text = """
    BaridiMob
    ID: BM9988776655
    Montant: 15 000,00 DZD
    """
    res = await receipt_ocr_service.verify_receipt(
        raw_text=sample_text,
        expected_amount=20000,
        expected_reference="PODA-CTR42-MS1",
    )
    assert res.is_valid is False
    assert res.status == "AMOUNT_MISMATCH"
    assert res.error_code == "errors.ocr.amount_mismatch"
