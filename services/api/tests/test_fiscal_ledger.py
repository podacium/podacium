"""
Unit tests for ANAE Fiscal Ledger, Cryptographic Hash Chain & G50 Tax Defense Packs.
"""

import io
import json
import zipfile
from app.services.fiscal_ledger_service import (
    FiscalLedgerService,
    ANAE_ANNUAL_TURNOVER_CEILING_DZD,
    IFU_TAX_RATE_PERCENT,
    IFU_TAX_RATE_DECIMAL,
)


def test_ifu_tax_calculation_constants():
    assert IFU_TAX_RATE_PERCENT == 0.5
    assert IFU_TAX_RATE_DECIMAL == 0.005
    assert ANAE_ANNUAL_TURNOVER_CEILING_DZD == 5_000_000

    # 1,000,000 DZD annual turnover -> 5,000 DZD IFU tax
    turnover = 1_000_000
    tax_due = round(turnover * IFU_TAX_RATE_DECIMAL)
    assert tax_due == 5000


def test_hash_chain_append_and_integrity():
    ledger = FiscalLedgerService()

    # 1. Initially empty ledger is valid
    res_empty = ledger.verify_ledger_integrity()
    assert res_empty["is_valid"] is True
    assert res_empty["block_count"] == 0

    # 2. Append blocks
    b0 = ledger.append_invoice_block(
        invoice_id=101,
        invoice_number="INV-2026-001",
        issuer_id=1,
        recipient_id=2,
        subtotal_dzd=50000,
        tax_dzd=0,
        total_dzd=50000,
    )
    assert b0.block_index == 0
    assert b0.previous_block_hash == "0" * 64
    assert len(b0.block_hash) == 64

    b1 = ledger.append_invoice_block(
        invoice_id=102,
        invoice_number="INV-2026-002",
        issuer_id=1,
        recipient_id=3,
        subtotal_dzd=120000,
        tax_dzd=0,
        total_dzd=120000,
    )
    assert b1.block_index == 1
    assert b1.previous_block_hash == b0.block_hash

    # 3. Verify ledger integrity passes
    res = ledger.verify_ledger_integrity()
    assert res["is_valid"] is True
    assert res["block_count"] == 2
    assert res["head_block_hash"] == b1.block_hash


def test_hash_chain_tamper_detection():
    ledger = FiscalLedgerService()
    ledger.append_invoice_block(1, "INV-1", 10, 20, 10000, 0, 10000)
    ledger.append_invoice_block(2, "INV-2", 10, 21, 20000, 0, 20000)

    # Tamper with block 0 total amount
    ledger._ledger_chain[0].total_dzd = 99999

    res = ledger.verify_ledger_integrity()
    assert res["is_valid"] is False
    assert (
        "Tampered block hash" in res["error"]
        or "Broken block hash link" in res["error"]
    )


def test_ed25519_signature_verification():
    ledger = FiscalLedgerService()
    data_hash = "a" * 64
    sig = ledger.sign_hash(data_hash)
    assert ledger.verify_signature(data_hash, sig) is True
    assert ledger.verify_signature("b" * 64, sig) is False


def test_tax_defense_bundle_generation():
    ledger = FiscalLedgerService()
    invoice_data = {
        "invoice_number": "INV-2026-DZ-99",
        "total_dzd": 85000,
        "date": "2026-09-16",
    }
    zip_bytes = ledger.generate_tax_defense_bundle(
        invoice_id=99,
        invoice_data=invoice_data,
        client_name="SARL Tech Algeria",
        freelancer_name="Karim Mansouri",
        anae_card_number="162400129845",
    )
    assert len(zip_bytes) > 0

    # Inspect zip contents
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        file_list = zf.namelist()
        assert "Contrat_Prestation_Signe.pdf" in file_list
        assert "PV_Reception_Definitive.pdf" in file_list
        assert "Facture_ANAE_Fiscale.pdf" in file_list
        assert "Bordereau_Reglement_Certifie.pdf" in file_list
        assert "Memorandum_Fiscal_Art169_CIDTA.pdf" in file_list
        assert "CRYPTO_MANIFEST.json" in file_list

        manifest_data = json.loads(zf.read("CRYPTO_MANIFEST.json").decode("utf-8"))
        assert manifest_data["platform"] == "Podacium"
        assert manifest_data["invoice_number"] == "INV-2026-DZ-99"
        assert manifest_data["amount_dzd"] == 85000
        assert "signature" in manifest_data
        assert "platform_ed25519_public_key" in manifest_data


def test_zero_sum_invariant_enforcement():
    import pytest

    ledger = FiscalLedgerService()

    # Legitimate balanced entry: total = subtotal + tax
    block = ledger.append_invoice_block(
        invoice_id=201,
        invoice_number="INV-2026-BALANCED",
        issuer_id=10,
        recipient_id=20,
        subtotal_dzd=100_000,
        tax_dzd=19_000,
        total_dzd=119_000,
    )
    assert block.total_dzd == block.subtotal_dzd + block.tax_dzd

    # Unbalanced entry must raise ValueError: Debits - Credits != 0
    with pytest.raises(ValueError, match="Zero-sum invariant"):
        ledger.append_invoice_block(
            invoice_id=202,
            invoice_number="INV-2026-UNBALANCED",
            issuer_id=10,
            recipient_id=20,
            subtotal_dzd=100_000,
            tax_dzd=19_000,
            total_dzd=120_000,  # 120_000 != 100_000 + 19_000
        )


def test_zero_sum_journal_entry_creation():
    import pytest

    ledger = FiscalLedgerService()

    # Balanced Algerian SCF Journal Entry
    entry = ledger.create_journal_entry(
        entry_id="JE-2026-001",
        date="2026-10-17",
        reference="FAC-2026-001",
        description="Facture Prestation BI Sonatrach",
        lines=[
            {
                "account_code": "411000",
                "account_name": "Clients",
                "debit_centimes": 119_000,
                "credit_centimes": 0,
            },
            {
                "account_code": "706000",
                "account_name": "Prestations de services",
                "debit_centimes": 0,
                "credit_centimes": 100_000,
            },
            {
                "account_code": "445700",
                "account_name": "TVA collectée",
                "debit_centimes": 0,
                "credit_centimes": 19_000,
            },
        ],
    )
    assert entry.is_balanced is True
    assert entry.total_debit == 119_000
    assert entry.total_credit == 119_000

    # Unbalanced Journal Entry must raise ValueError
    with pytest.raises(ValueError, match="Zero-sum invariant"):
        ledger.create_journal_entry(
            entry_id="JE-2026-002",
            date="2026-10-17",
            reference="FAC-2026-002",
            description="Unbalanced entry",
            lines=[
                {
                    "account_code": "411000",
                    "account_name": "Clients",
                    "debit_centimes": 100_000,
                    "credit_centimes": 0,
                },
                {
                    "account_code": "706000",
                    "account_name": "Prestations de services",
                    "debit_centimes": 0,
                    "credit_centimes": 90_000,
                },
            ],
        )


def test_integer_centimes_validation():
    import pytest

    ledger = FiscalLedgerService()

    # Float values must be strictly rejected
    with pytest.raises(TypeError, match="must be an integer"):
        ledger.append_invoice_block(
            invoice_id=203,
            invoice_number="INV-2026-FLOAT",
            issuer_id=10,
            recipient_id=20,
            subtotal_dzd=100.50,  # float
            tax_dzd=0,
            total_dzd=100.50,
        )
