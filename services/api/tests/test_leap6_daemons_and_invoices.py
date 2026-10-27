"""
tests/test_leap6_daemons_and_invoices.py
Unit tests for Leap 6: Proactive Daemon Swarms & Event Triggers.
"""

from unittest.mock import AsyncMock, patch, MagicMock
import pytest
from app.services.invoice_service import InvoiceService
from app.core.celery import celery_app
import app.tasks.celery_beat


@pytest.mark.asyncio
async def test_generate_invoice_missing_transaction():
    with patch(
        "app.core.prisma.prisma.transaction.find_unique", new_callable=AsyncMock
    ) as mock_find:
        mock_find.return_value = None
        with pytest.raises(ValueError, match="errors.transactions.not_found"):
            await InvoiceService.generate_invoice(999999)


@pytest.mark.asyncio
async def test_generate_invoice_creates_certified_platform_invoice():
    mock_tx = MagicMock()
    mock_tx.id = 55
    mock_tx.userId = 12
    mock_tx.organizationId = None
    mock_tx.amount = 50000
    mock_tx.purpose = "COURSE_PURCHASE"
    mock_tx.providerReference = "ch_test_ref_123"
    mock_tx.contractId = None

    with (
        patch(
            "app.core.prisma.prisma.transaction.find_unique", new_callable=AsyncMock
        ) as mock_find_tx,
        patch(
            "app.core.prisma.prisma.invoiceitem.find_first", new_callable=AsyncMock
        ) as mock_find_item,
        patch.object(
            InvoiceService, "create_platform_invoice", new_callable=AsyncMock
        ) as mock_create_inv,
    ):
        mock_find_tx.return_value = mock_tx
        mock_find_item.return_value = None
        mock_create_inv.return_value = {
            "id": 101,
            "invoice_number": "INV-2026-PLT-000101",
            "type": "PLATFORM_FEE",
            "total_dzd": 50000,
            "legal_notice": "Facture émise par Podacium SARL. TVA 19% incluse.",
        }

        result = await InvoiceService.generate_invoice(55)

        assert result["id"] == 101
        assert result["invoice_number"] == "INV-2026-PLT-000101"
        mock_create_inv.assert_called_once()
        call_kwargs = mock_create_inv.call_args.kwargs
        assert call_kwargs["recipient_id"] == 12
        assert call_kwargs["amount_dzd"] == 50000
        assert "TX-55" in call_kwargs["description"]


def test_unified_celery_beat_schedule_contains_pulse_tasks():
    assert app.tasks.celery_beat is not None
    sched = celery_app.conf.beat_schedule
    # Morning Executive Briefing task must be registered
    assert "send-morning-executive-briefing-daily-8am" in sched
    briefing_task = sched["send-morning-executive-briefing-daily-8am"]
    assert (
        briefing_task["task"] == "app.tasks.bi_tasks.send_morning_executive_briefings"
    )
    # Schedule should be 07:00 UTC (08:00 Africa/Algiers)
    assert briefing_task["schedule"].hour == {7}
    assert briefing_task["schedule"].minute == {0}

    # BI Quality scans and cache refreshes must also be present
    assert "run-bi-dataset-quality-scans" in sched
    assert "refresh-bi-metric-caches" in sched


def test_send_morning_executive_briefings_aggregation_logic():
    from app.tasks.bi_tasks import send_morning_executive_briefings

    # Mock invoices
    mock_inv1 = MagicMock(id=1, totalDzd=25000, status="ISSUED", items=[])
    mock_inv2 = MagicMock(id=2, totalDzd=75000, status="ISSUED", items=[])

    # Mock completed transactions
    mock_tx = MagicMock(id=1, amount=60000, status="COMPLETED")

    # Mock admins
    mock_admin = MagicMock(
        id=1, role="ADMIN", phoneNumber="213555123456", isActive=True
    )

    with (
        patch("app.tasks.bi_tasks.connect_prisma", new_callable=AsyncMock),
        patch("app.tasks.bi_tasks.disconnect_prisma", new_callable=AsyncMock),
        patch(
            "app.core.prisma.prisma.invoice.find_many", new_callable=AsyncMock
        ) as mock_find_inv,
        patch(
            "app.core.prisma.prisma.transaction.find_many", new_callable=AsyncMock
        ) as mock_find_tx,
        patch(
            "app.core.prisma.prisma.user.find_many", new_callable=AsyncMock
        ) as mock_find_users,
        patch(
            "app.services.whatsapp_service.WhatsAppService.send_text_message",
            new_callable=AsyncMock,
        ) as mock_send_wa,
        patch(
            "app.services.whatsapp_service.WhatsAppService.close",
            new_callable=AsyncMock,
        ),
    ):
        mock_find_inv.return_value = [mock_inv1, mock_inv2]
        mock_find_tx.return_value = [mock_tx]
        mock_find_users.return_value = [mock_admin]
        mock_send_wa.return_value = True

        # Call underlying async logic
        res = send_morning_executive_briefings()
        assert res["status"] == "completed"
        assert res["metrics"]["compte_411_kridi_dzd"] == 100000
        assert res["metrics"]["pending_invoices_count"] == 2
        assert res["metrics"]["collected_24h_dzd"] == 60000
        assert res["metrics"]["ibs_shield_dzd"] == 26000
        assert res["dispatched_count"] == 1
        mock_send_wa.assert_called_once()
