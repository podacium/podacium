import pytest
from app.core.config import setting, FinancialMode
from app.schemas.payment import PaymentInitiateRequest, PaymentPurpose, PaymentGateway
from app.services.bi_services.preprocessing_service import parse_dzd_number
from app.services.invoice_service import InvoiceService
import re


def test_financial_mode_default_non_custodial():
    assert setting.FINANCIAL_MODE == FinancialMode.NON_CUSTODIAL


def test_parse_dzd_number_formats():
    # French / Algerian comma decimal
    assert parse_dzd_number("1.250,50") == 1250.5
    assert parse_dzd_number("1 250,50") == 1250.5
    assert parse_dzd_number("1250,50") == 1250.5
    assert parse_dzd_number("1250,5") == 1250.5

    # Anglo dot decimal
    assert parse_dzd_number("1,250.50") == 1250.5
    assert parse_dzd_number("1 250.50") == 1250.5
    assert parse_dzd_number("1250.50") == 1250.5

    # With currency suffixes
    assert parse_dzd_number("5 000 DZD") == 5000
    assert parse_dzd_number("5000 DA") == 5000
    assert parse_dzd_number("5000 دج") == 5000

    # Integers
    assert parse_dzd_number("25000") == 25000
    assert parse_dzd_number("25 000") == 25000


def test_messaging_moderation_regex():
    phone_pattern = r"(?:\+213|00213|0)[5-7]\d{1}[0-9\s\.\-]{6,8}\d"
    rip_pattern = r"\b007\d{17}\b|\b\d{20}\b"
    links_pattern = r"(?:https?:\/\/)?(?:www\.)?(?:wa\.me|t\.me|telegram\.me|api\.whatsapp\.com)\/[a-zA-Z0-9_\+\-]+"

    # Algerian mobile numbers
    assert re.search(phone_pattern, "Contactez moi sur 0550123456 svp")
    assert re.search(phone_pattern, "Mon numéro: +213661234567")
    assert re.search(phone_pattern, "Appelez 0770 12 34 56")

    # BaridiMob RIP (20 digits starting with 007)
    assert re.search(rip_pattern, "Voici mon RIP BaridiMob: 00799999000123456789")

    # Messaging links
    assert re.search(links_pattern, "Écrivez moi sur https://wa.me/213550123456")
    assert re.search(links_pattern, "Telegram: t.me/freelance_dz")


def test_invoice_number_generation():
    num_plt = InvoiceService.generate_invoice_number("PLT", 42)
    assert "PLT" in num_plt
    assert "000042" in num_plt

    num_anae = InvoiceService.generate_invoice_number("ANAE", 105)
    assert "ANAE" in num_anae
    assert "000105" in num_anae


@pytest.mark.asyncio
async def test_payment_service_blocks_escrow_in_non_custodial_mode():
    from app.services.payment_service import PaymentService
    from fastapi import HTTPException

    svc = PaymentService()
    req = PaymentInitiateRequest(
        user_id=1,
        amount=10000,
        currency="DZD",
        gateway=PaymentGateway.MOCK,
        purpose=PaymentPurpose.CONTRACT_ESCROW,
        success_url="https://podacium.com/success",
        failure_url="https://podacium.com/failure",
    )

    with pytest.raises(HTTPException) as exc_info:
        await svc.initiate_payment(req)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "errors.billing.custodial_escrow_disabled"
