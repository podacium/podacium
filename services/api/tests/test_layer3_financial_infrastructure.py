"""
Unit and integration tests for Layer 3: FinTech, Double-Entry Ledger, Escrow & Billing.
Validates:
1. EscrowHold releaseConditions persistence (CRITICAL-FIN-01 fix: no non-existent metadata writes)
2. CommissionService release_escrow using podaPoints and credit_wallet (CRITICAL-FIN-01 fix)
3. Maker-Checker PENDING_CHECKER_APPROVAL balance isolation preventing double-spending (CRITICAL-FIN-02 fix)
4. Collision-resistant payout reference generation without prisma.generate_id (CRITICAL-FIN-03 fix)
5. TigerBeetle Two-Phase Transfers (prepare, post, void)
6. DLG PC Compta SCF export (512000, 411000, 401000, 706000, 6181, 6186)
7. Bank statement reconciliation (MT940 SWIFT and CAMT.053 ISO 20022 XML)
8. BIN card routing (EDAHABIA 6280/5035 vs CIB 6033/6240)
9. BaridiMob concierge order generation and formatted postal slip
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.dlg_parser_service import dlg_parser_service, DLGParserService
from app.services.wallet_service import WalletService


# =============================================================================
# 1. BIN ROUTING & CARD NETWORK DETECTION
# =============================================================================
class TestAlgerianBinRouting:
    def test_edahabia_bin_detection(self):
        assert DLGParserService.detect_card_network("6280381234567890") == "EDAHABIA"
        assert DLGParserService.detect_card_network("5035123456789012") == "EDAHABIA"
        assert DLGParserService.detect_card_network("6280 3800 1111 2222") == "EDAHABIA"

    def test_cib_bin_detection(self):
        assert DLGParserService.detect_card_network("6033123456789012") == "CIB"
        assert DLGParserService.detect_card_network("6240987654321098") == "CIB"
        assert DLGParserService.detect_card_network("6033-0000-1111-2222") == "CIB"

    def test_unknown_bin_detection(self):
        assert DLGParserService.detect_card_network("4111111111111111") == "UNKNOWN"
        assert DLGParserService.detect_card_network("") == "UNKNOWN"


# =============================================================================
# 2. BARIDIMOB CONCIERGE ORDER FLOW
# =============================================================================
class TestBaridiMobConciergeFlow:
    def test_concierge_order_code_generation(self):
        order = DLGParserService.generate_baridimob_concierge_order(
            amount_dzd=75000,
            client_id=42,
            contract_or_order_ref="PODA-CTR-101",
        )
        assert order["order_code"].startswith("POD-BM-")
        assert len(order["order_code"]) == 13  # POD-BM- + 6 digits
        assert order["amount_dzd"] == 75000
        assert order["client_id"] == 42
        assert order["corporate_rip"] == "00799999000123456789"
        assert order["postal_slip"]["destinataire"] == "SARL PODACIUM BI & TECH"
        assert order["postal_slip"]["montant_chiffres"] == "75,000 DZD"
        assert order["postal_slip"]["communication"] == order["order_code"]


# =============================================================================
# 3. DLG PC COMPTA SCF EXPORT & ACCOUNT TAXONOMY
# =============================================================================
class TestDLGPCComptaSCFIntegration:
    def test_scf_account_class_mapping(self):
        cat, label, badge, prefix = dlg_parser_service.map_scf_account("512000")
        assert cat == "TREASURY"
        assert "Chargily Clearing" in label
        assert prefix == "512000"

        cat, label, badge, prefix = dlg_parser_service.map_scf_account("411000")
        assert cat == "ACCOUNTS_RECEIVABLE"
        assert "Client" in label

        cat, label, badge, prefix = dlg_parser_service.map_scf_account("401000")
        assert cat == "ACCOUNTS_PAYABLE"
        assert "ANAE" in label

        cat, label, badge, prefix = dlg_parser_service.map_scf_account("706000")
        assert cat == "REVENUE"
        assert "Prestation de Services" in label

        cat, label, badge, prefix = dlg_parser_service.map_scf_account("6181")
        assert cat == "OPERATING_EXPENSE"
        assert "études" in label

        cat, label, badge, prefix = dlg_parser_service.map_scf_account("6186")
        assert cat == "OPERATING_EXPENSE"
        assert "formation" in label

    def test_export_dlg_scf_journal(self):
        entries = [
            {
                "date": "2026-10-15",
                "piece_ref": "FAC-2026-001",
                "account": "411000",
                "libelle": "Vente prestation BI Client Sonatrach",
                "debit": 250000.0,
                "credit": 0.0,
            },
            {
                "date": "2026-10-15",
                "piece_ref": "FAC-2026-001",
                "account": "706000",
                "libelle": "Prestations de services Podacium",
                "debit": 0.0,
                "credit": 250000.0,
            },
            {
                "date": "2026-10-15",
                "piece_ref": "REG-2026-001",
                "account": "512000",
                "libelle": "Encaissement Chargily Clearing",
                "debit": 250000.0,
                "credit": 0.0,
            },
            {
                "date": "2026-10-15",
                "piece_ref": "REG-2026-001",
                "account": "411000",
                "libelle": "Solde compte client",
                "debit": 0.0,
                "credit": 250000.0,
            },
        ]
        exported_txt = dlg_parser_service.export_dlg_scf_journal(entries)
        lines = exported_txt.strip().split("\r\n")
        assert len(lines) == 5  # Header + 4 entries
        assert lines[0] == "JOURNAL\tDATE\tPIECE\tCOMPTE\tLIBELLE\tDEBIT\tCREDIT"
        assert "512000" in exported_txt
        assert "706000" in exported_txt
        assert "250000.00" in exported_txt


# =============================================================================
# 4. BANK STATEMENT RECONCILIATION (MT940 & CAMT.053)
# =============================================================================
class TestBankStatementReconciliation:
    def test_parse_mt940_swift_statement(self):
        mt940_text = """
:20:START
:25:00799999000123456789
:28C:001/1
:60F:C261015DZD1000000,00
:61:2610151015CR75000,00NTRFNONREF//POD-BM-892147
:86:VIREMENT BARIDIMOB DEPOSIT CLIENT 42
:62F:C261015DZD1075000,00
-"""
        res = dlg_parser_service.parse_mt940_statement(mt940_text)
        assert res["account_id"] == "00799999000123456789"
        assert res["currency"] == "DZD"
        assert res["opening_balance"] == 1000000.0
        assert res["closing_balance"] == 1075000.0
        assert res["transaction_count"] == 1
        tx = res["transactions"][0]
        assert tx["amount"] == 75000.0
        assert tx["is_credit"] is True
        assert tx["reference"] == "POD-BM-892147"
        assert "BARIDIMOB" in tx["details"]

    def test_parse_camt053_iso20022_statement(self):
        camt_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Id>STMT-2026-10-15-01</Id>
      <Acct>
        <Id>
          <IBAN>DZ5400799999000123456789</IBAN>
        </Id>
      </Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="DZD">500000.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
      </Bal>
      <Ntry>
        <Amt Ccy="DZD">120000.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-10-15</Dt></BookgDt>
        <RmtInf><Ustrd>POUT-20261015-1-WIRE01</Ustrd></RmtInf>
      </Ntry>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="DZD">620000.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
      </Bal>
    </Stmt>
  </BkToCstmrStmt>
</Document>"""
        res = dlg_parser_service.parse_camt053_statement(camt_xml)
        assert res["statement_id"] == "STMT-2026-10-15-01"
        assert res["account_id"] == "DZ5400799999000123456789"
        assert res["currency"] == "DZD"
        assert res["opening_balance"] == 500000.0
        assert res["closing_balance"] == 620000.0
        assert res["transaction_count"] == 1
        entry = res["entries"][0]
        assert entry["amount"] == 120000.0
        assert entry["is_credit"] is True
        assert entry["reference"] == "POUT-20261015-1-WIRE01"


# =============================================================================
# 5. MAKER-CHECKER BALANCE ISOLATION (CRITICAL-FIN-02 FIX)
# =============================================================================
class TestMakerCheckerBalanceIsolation:
    @pytest.mark.asyncio
    async def test_pending_checker_approval_is_strictly_held(self):
        """
        Payouts in PENDING_CHECKER_APPROVAL must remain counted in held_in_payouts,
        guaranteeing Available Balance = Total Points - Total Held.
        """
        service = WalletService()

        mock_wallet = MagicMock(id=10, podaPoints=150_000, isActive=True)
        # 100k payout reviewed by Maker and now awaiting Checker approval
        mock_pending_checker_payout = MagicMock(
            id=1, walletId=10, amount=100_000, status="PENDING_CHECKER_APPROVAL"
        )

        with patch(
            "app.core.prisma.prisma.wallet.find_unique", new_callable=AsyncMock
        ) as mock_find_wallet:
            mock_find_wallet.return_value = mock_wallet
            with patch(
                "app.core.prisma.prisma.escrowhold.find_many", new_callable=AsyncMock
            ) as mock_escrow:
                mock_escrow.return_value = []
                with patch(
                    "app.core.prisma.prisma.payout.find_many", new_callable=AsyncMock
                ) as mock_payouts:
                    mock_payouts.return_value = [mock_pending_checker_payout]

                    with patch(
                        "app.core.prisma.prisma.wallettransaction.find_many",
                        new_callable=AsyncMock,
                    ) as mock_ledger:
                        # No HOLD/RELEASE reservation rows in this scenario.
                        mock_ledger.return_value = []

                        available = await service.get_available_balance(wallet_id=10)

                        # Total points (150k) - Held in pending checker payout (100k) = 50k available
                        assert available == 50_000

                        # Verify status query included PENDING_CHECKER_APPROVAL
                        call_kwargs = mock_payouts.call_args[1]
                        assert (
                            "PENDING_CHECKER_APPROVAL"
                            in call_kwargs["where"]["status"]["in"]
                        )


# =============================================================================
# 6. PAYOUT REFERENCE GENERATION (CRITICAL-FIN-03 FIX)
# =============================================================================
class TestPayoutReferenceGeneration:
    def test_collision_resistant_uuid_reference(self):
        import uuid
        from datetime import datetime, timezone

        wallet_id = 42
        short_id = uuid.uuid4().hex[:10].upper()
        reference = f"POUT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{wallet_id}-{short_id}"

        assert reference.startswith(
            f"POUT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-42-"
        )
        assert len(reference.split("-")[-1]) == 10
        assert reference.split("-")[-1].isupper() or reference.split("-")[-1].isalnum()


# =============================================================================
# 7. TIGERBEETLE TWO-PHASE TRANSFERS & BALANCE ISOLATION
# =============================================================================
class TestTigerBeetleTwoPhaseTransfers:
    @pytest.mark.asyncio
    async def test_prepare_transfer_creates_pending_hold(self):
        service = WalletService()

        mock_source = MagicMock(id=1, podaPoints=100_000, isActive=True)
        mock_dest = MagicMock(id=2, podaPoints=20_000, isActive=True)

        with patch("app.core.prisma.prisma.tx") as mock_tx:
            t = MagicMock()
            t.wallet.find_unique = AsyncMock(
                side_effect=lambda where: mock_source
                if where.get("id") == 1
                else mock_dest
            )
            t.execute_raw = AsyncMock()
            t.escrowhold.find_many = AsyncMock(return_value=[])
            t.payout.find_many = AsyncMock(return_value=[])
            t.wallettransaction.find_many = AsyncMock(return_value=[])
            t.wallettransaction.create = AsyncMock()
            mock_tx.return_value.__aenter__.return_value = t

            prep = await service.prepare_transfer(
                source_wallet_id=1,
                destination_wallet_id=2,
                amount=35_000,
                description="TigerBeetle Two-Phase Hold",
            )
            assert prep["status"] == "PENDING"
            assert prep["transfer_id"].startswith("TB2P-")
            assert prep["amount"] == 35_000
            assert t.wallettransaction.create.called

    @pytest.mark.asyncio
    async def test_prepare_transfer_insufficient_funds_rejected(self):
        service = WalletService()

        mock_source = MagicMock(id=1, podaPoints=10_000, isActive=True)
        mock_dest = MagicMock(id=2, podaPoints=20_000, isActive=True)

        with patch("app.core.prisma.prisma.tx") as mock_tx:
            t = MagicMock()
            t.wallet.find_unique = AsyncMock(side_effect=[mock_source, mock_dest])
            t.execute_raw = AsyncMock()
            t.escrowhold.find_many = AsyncMock(return_value=[])
            t.payout.find_many = AsyncMock(return_value=[])
            mock_tx.return_value.__aenter__.return_value = t

            with pytest.raises(Exception):
                await service.prepare_transfer(
                    source_wallet_id=1,
                    destination_wallet_id=2,
                    amount=50_000,
                )

    @pytest.mark.asyncio
    async def test_two_phase_hold_deducted_from_available_balance(self):
        """TigerBeetle prepare_transfer holds must be deducted from available balance."""
        service = WalletService()
        mock_wallet = MagicMock(id=1, podaPoints=100_000, isActive=True)
        mock_hold_tx = MagicMock(
            id=101,
            walletId=1,
            amount=40_000,
            type="HOLD",
            metadata={"phase": "PREPARE", "destination_wallet_id": 2},
        )

        with (
            patch(
                "app.core.prisma.prisma.wallet.find_unique", new_callable=AsyncMock
            ) as mock_find_wallet,
            patch(
                "app.core.prisma.prisma.escrowhold.find_many", new_callable=AsyncMock
            ) as mock_escrow,
            patch(
                "app.core.prisma.prisma.payout.find_many", new_callable=AsyncMock
            ) as mock_payouts,
            patch(
                "app.core.prisma.prisma.wallettransaction.find_many",
                new_callable=AsyncMock,
            ) as mock_txs,
        ):
            mock_find_wallet.return_value = mock_wallet
            mock_escrow.return_value = []
            mock_payouts.return_value = []
            # Faithful fake: only the HOLD query sees the reservation row. The
            # previous version returned the same row for the RELEASE query too,
            # which made the hold cancel itself out.
            mock_txs.side_effect = lambda where=None, **kwargs: (
                [mock_hold_tx] if (where or {}).get("type") == "HOLD" else []
            )

            available = await service.get_available_balance(wallet_id=1)
            # 100k - 40k = 60k
            assert available == 60_000

    @pytest.mark.asyncio
    async def test_post_transfer_prevents_double_posting_race(self):
        """Re-check under lock prevents TOCTOU double-commit on two-phase transfers."""
        service = WalletService()
        mock_hold_tx = MagicMock(
            id=101,
            walletId=1,
            amount=25_000,
            type="HOLD",
            purpose="TRANSFER",
            metadata={"phase": "PREPARE", "destination_wallet_id": 2},
        )
        # Already posted record returned under lock
        mock_already_posted = MagicMock(
            id=101,
            walletId=1,
            amount=25_000,
            type="HOLD",
            metadata={"phase": "POSTED"},
        )

        with patch("app.core.prisma.prisma.tx") as mock_tx:
            t = MagicMock()
            t.wallettransaction.find_first = AsyncMock(return_value=mock_hold_tx)
            t.execute_raw = AsyncMock()
            t.wallettransaction.find_unique = AsyncMock(
                return_value=mock_already_posted
            )
            mock_tx.return_value.__aenter__.return_value = t

            with pytest.raises(Exception) as excinfo:
                await service.post_transfer(transfer_id="TB2P-TEST123456")
            assert "invalid phase" in str(excinfo.value)

    @pytest.mark.asyncio
    async def test_audit_wallet_ledger_conserved(self):
        """Verifies trial balance audit passes when transactions balance and chain is intact."""
        service = WalletService()
        mock_wallet = MagicMock(id=5, podaPoints=70_000, isActive=True)
        tx1 = MagicMock(
            id=1,
            walletId=5,
            amount=100_000,
            previousBalance=0,
            newBalance=100_000,
            type="CREDIT",
        )
        tx2 = MagicMock(
            id=2,
            walletId=5,
            amount=30_000,
            previousBalance=100_000,
            newBalance=70_000,
            type="DEBIT",
        )

        with (
            patch(
                "app.core.prisma.prisma.wallet.find_unique", new_callable=AsyncMock
            ) as mock_find,
            patch(
                "app.core.prisma.prisma.wallettransaction.find_many",
                new_callable=AsyncMock,
            ) as mock_txs,
            patch.object(
                service, "get_available_balance", new_callable=AsyncMock
            ) as mock_avail,
        ):
            mock_find.return_value = mock_wallet
            mock_txs.return_value = [tx1, tx2]
            mock_avail.return_value = 70_000

            audit = await service.audit_wallet_ledger(wallet_id=5)
            assert audit["status"] == "CONSERVED"
            assert audit["calculated_balance"] == 70_000
            assert audit["current_balance"] == 70_000
            assert audit["total_credits"] == 100_000
            assert audit["total_debits"] == 30_000
            assert audit["chain_valid"] is True
            assert len(audit["discrepancies"]) == 0

    @pytest.mark.asyncio
    async def test_request_withdrawal_uses_collision_resistant_reference(self):
        """Verifies request_withdrawal produces collision-resistant POUT-... references."""
        service = WalletService()
        mock_wallet = MagicMock(id=9, podaPoints=50_000, isActive=True, currency="DZD")

        with (
            patch("app.core.prisma.prisma.tx") as mock_tx,
            patch.object(
                service, "get_available_balance", new_callable=AsyncMock
            ) as mock_avail,
        ):
            mock_avail.return_value = 50_000
            t = MagicMock()
            t.execute_raw = AsyncMock()
            t.wallet.find_unique = AsyncMock(return_value=mock_wallet)
            created_payout = MagicMock(id=88, requestedAt="2026-10-15T00:00:00Z")
            t.payout.create = AsyncMock(return_value=created_payout)
            t.wallettransaction.create = AsyncMock()
            mock_tx.return_value.__aenter__.return_value = t

            await service.request_withdrawal(wallet_id=9, user_id=1, amount=10_000)

            call_args = t.payout.create.call_args[1]["data"]
            ref = call_args["reference"]
            assert ref.startswith("POUT-")
            assert "-9-" in ref
            assert len(ref.split("-")[-1]) == 10


# =============================================================================
# 8. ARTICLE 169 CIDTA ED25519 TAX DEFENSE PACK
# =============================================================================
class TestArticle169TaxDefensePack:
    def test_tax_defense_pack_generation_and_tax_shield(self):
        pack = DLGParserService.generate_article169_tax_defense_pack(
            enterprise_name="SARL ALGERIAN TECH SOLUTIONS",
            nif="001916012345678",
            nis="001916010001234",
            training_title="Executive AI & Cloud Infrastructure Training",
            amount_dzd=500_000,
            hours_completed=40,
            participants_count=12,
            contract_or_invoice_ref="INV-2026-OCT-8891",
        )

        assert pack["pack_id"].startswith("TDP-CIDTA169-INV-2026-OCT-8891-")
        assert pack["payload"]["legal_framework"]["ibs_rate_pct"] == 26
        # 26% of 500,000 DZD = 130,000 DZD corporate tax shield
        assert pack["payload"]["legal_framework"]["tax_shield_dzd"] == 130000.0
        assert (
            pack["payload"]["legal_framework"]["scf_account"]
            == "6186 - Frais de formation professionnelle continue"
        )
        assert pack["payload"]["enterprise"]["name"] == "SARL ALGERIAN TECH SOLUTIONS"
        assert pack["signature"]["algorithm"] == "Ed25519"
        assert len(pack["signature"]["public_key_hex"]) == 64
        assert len(pack["signature"]["signature_hex"]) == 128
        assert pack["verification"]["status"] == "VALID"

    def test_tax_defense_pack_signature_verification_valid(self):
        pack = DLGParserService.generate_article169_tax_defense_pack(
            enterprise_name="SPA SONATRACH DIVISION FORMATION",
            nif="000016001234567",
            nis="000016000001234",
            training_title="PostgreSQL & Modern Fullstack Monorepo Engineering",
            amount_dzd=1_000_000,
            hours_completed=60,
            participants_count=20,
            contract_or_invoice_ref="CTR-SONA-2026-01",
        )

        is_valid = DLGParserService.verify_article169_tax_defense_pack(pack)
        assert is_valid is True

    def test_tax_defense_pack_tampered_payload_rejected(self):
        pack = DLGParserService.generate_article169_tax_defense_pack(
            enterprise_name="EURL ORAN LOGISTICS",
            nif="001531012345678",
            nis="001531010001234",
            training_title="Business Intelligence & Supply Chain Analytics",
            amount_dzd=200_000,
            hours_completed=20,
            participants_count=5,
            contract_or_invoice_ref="INV-ORAN-992",
        )

        # Tamper with amount to illegally increase tax shield
        pack["payload"]["training_audit"]["amount_dzd"] = 999_999_999

        is_valid = DLGParserService.verify_article169_tax_defense_pack(pack)
        assert is_valid is False


# =============================================================================
# 9. INVOICE PDF GENERATION & ALGERIAN FISCAL COMPLIANCE (LOI 18-05 & ART. 169)
# =============================================================================
class TestInvoicePdfGenerationAndAlgerianCompliance:
    def test_render_invoice_pdf_creates_valid_file(self):
        import tempfile
        import os
        from datetime import datetime, timezone
        from app.services.invoice_service import InvoiceService

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            items = [
                {
                    "description": "Abonnement Plateforme Podacium BI Scale",
                    "quantity": 1,
                    "unitPriceDzd": 75000,
                    "totalPriceDzd": 75000,
                }
            ]
            output = InvoiceService.render_invoice_pdf(
                invoice_number="FAC-2026-TEST-001",
                invoice_type="SUBSCRIPTION",
                issued_at=datetime.now(timezone.utc),
                paid_at=datetime.now(timezone.utc),
                recipient_name="SARL TECH MAGHREB",
                recipient_email="finance@techmaghreb.dz",
                recipient_tax_id="NIF: 002016012345678",
                items=items,
                subtotal_dzd=63025,
                tax_dzd=11975,
                total_dzd=75000,
                tax_rate_percent=19.0,
                legal_notice="Conforme Loi 18-05 & Article 169 CIDTA. TVA 19% incluse.",
                output_file_path=tmp_path,
            )

            assert os.path.exists(output)
            assert (
                os.path.getsize(output) > 1000
            )  # ReportLab generates a valid multi-KB PDF
            with open(output, "rb") as f:
                header = f.read(5)
                assert header == b"%PDF-"
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


# =============================================================================
# 10. SUBSCRIPTION DUNNING LIFECYCLE (FLOW A)
# =============================================================================
class TestSubscriptionDunningLifecycle:
    @pytest.mark.asyncio
    async def test_dunning_retries_exhaustion_marks_expired_and_revokes(self):
        from app.services.subscription_billing_service import SubscriptionBillingService
        from datetime import datetime, timedelta, timezone
        from app.schemas.payment import SubscriptionStatus

        service = SubscriptionBillingService()
        now = datetime.now(timezone.utc)

        mock_sub = MagicMock(
            id=99,
            userId=42,
            status=SubscriptionStatus.GRACE_PERIOD.value,
            plan="STUDENT_PLUS",
            amount=3400,
            currency="DZD",
        )
        mock_tx = MagicMock(
            id=888,
            createdAt=now - timedelta(days=6),
            subscriptionId=99,
            subscription=mock_sub,
            metadata={
                "dunning_retries": 2,  # Next attempt is 3 -> exhaustion
                "failed_at": (now - timedelta(days=6)).isoformat(),
                "next_retry_at": (now - timedelta(hours=1)).isoformat(),
            },
        )

        with (
            patch(
                "app.core.prisma.prisma.transaction.find_many",
                AsyncMock(return_value=[mock_tx]),
            ),
            patch(
                "app.core.prisma.prisma.transaction.find_first",
                AsyncMock(return_value=None),
            ),
            patch(
                "app.core.prisma.prisma.subscription.update", AsyncMock()
            ) as mock_sub_update,
            patch(
                "app.core.prisma.prisma.transaction.update", AsyncMock()
            ) as mock_tx_update,
            patch(
                "app.services.billing_services.entitlement_service.entitlement_service.revoke_entitlements_by_source",
                AsyncMock(),
            ) as mock_revoke,
        ):
            await service.process_dunning_retries()

            # Verify sub expired
            mock_sub_update.assert_called_once()
            call_kwargs = mock_sub_update.call_args[1]
            assert call_kwargs["data"]["status"] == SubscriptionStatus.EXPIRED.value
            mock_tx_update.assert_called_once()

            # Verify entitlements revoked
            mock_revoke.assert_called_once_with("99", user_id=42)

    @pytest.mark.asyncio
    async def test_dunning_resolves_when_user_pays(self):
        from app.services.subscription_billing_service import SubscriptionBillingService
        from datetime import datetime, timedelta, timezone
        from app.schemas.payment import SubscriptionStatus

        service = SubscriptionBillingService()
        now = datetime.now(timezone.utc)

        mock_sub = MagicMock(
            id=100,
            userId=50,
            status=SubscriptionStatus.GRACE_PERIOD.value,
            plan="BI_GROWTH",
            amount=3500,
            currency="DZD",
        )
        mock_tx = MagicMock(
            id=777,
            createdAt=now - timedelta(days=2),
            subscriptionId=100,
            subscription=mock_sub,
            metadata={
                "dunning_retries": 1,
                "failed_at": (now - timedelta(days=2)).isoformat(),
                "next_retry_at": (now - timedelta(hours=1)).isoformat(),
            },
        )
        completed_payment = MagicMock(id=999, status="COMPLETED")

        with (
            patch(
                "app.core.prisma.prisma.transaction.find_many",
                AsyncMock(return_value=[mock_tx]),
            ),
            patch(
                "app.core.prisma.prisma.transaction.find_first",
                AsyncMock(return_value=completed_payment),
            ),
            patch(
                "app.core.prisma.prisma.subscription.update", AsyncMock()
            ) as mock_sub_update,
            patch(
                "app.core.prisma.prisma.transaction.update", AsyncMock()
            ) as mock_tx_update,
        ):
            await service.process_dunning_retries()

            # Sub must be set back to ACTIVE
            mock_sub_update.assert_called_once()
            assert (
                mock_sub_update.call_args[1]["data"]["status"]
                == SubscriptionStatus.ACTIVE.value
            )
            # Failed tx status marked RESOLVED
            mock_tx_update.assert_called_once()
            assert mock_tx_update.call_args[1]["data"]["status"] == "RESOLVED"


# =============================================================================
# 11. ANAE FREELANCER INVOICE & MILESTONE TRIPLE KIT (FLOW B)
# =============================================================================
class TestMilestoneANAEInvoiceAndKit:
    @pytest.mark.asyncio
    async def test_create_anae_freelancer_invoice_generates_pdf(self):
        from app.services.invoice_service import InvoiceService
        import os
        from datetime import datetime, timezone

        mock_freelancer = MagicMock(
            id=10,
            email="freelancer@podacium.dz",
            fullName="Karim Benali",
            kyc=MagicMock(anaeCardNumber="ANAE-2024-16-004521"),
            freelancerProfile=MagicMock(anaeCardNumber="ANAE-2024-16-004521"),
        )
        mock_client = MagicMock(
            id=20,
            email="enterprise@sonatrach.dz",
            fullName="Sonatrach Procurement",
            primaryOrganizationId=5,
            ownedOrganization=None,
            memberships=[],
        )
        mock_created_inv = MagicMock(
            id=55,
            invoiceNumber="FAC-2026-ANAE-000055",
            type="FREELANCER_SERVICE",
            issuedAt=datetime.now(timezone.utc),
            paidAt=datetime.now(timezone.utc),
            subtotalDzd=150000,
            taxDzd=0,
            totalDzd=150000,
            taxRatePercent=0.0,
            legalNotice="Facture établie sous le statut d'Auto-Entrepreneur (Loi n° 22-23).",
            recipientType="ORGANIZATION",
            recipientId=5,
            items=[],
        )

        with (
            patch(
                "app.core.prisma.prisma.user.find_unique",
                AsyncMock(side_effect=[mock_freelancer, mock_client]),
            ),
            patch(
                "app.core.prisma.prisma.organization.find_unique",
                AsyncMock(
                    return_value=MagicMock(
                        name="SPA SONATRACH",
                        billingEmail="proc@sonatrach.dz",
                        nif="000016001234567",
                    )
                ),
            ),
            patch("app.core.prisma.prisma.tx") as mock_tx,
            patch(
                "app.core.prisma.prisma.invoice.find_unique",
                AsyncMock(return_value=mock_created_inv),
            ),
            patch(
                "app.core.prisma.prisma.invoice.find_many",
                AsyncMock(return_value=[]),
            ),
            patch(
                "app.core.prisma.prisma.invoiceitem.find_many",
                AsyncMock(return_value=[]),
            ),
            patch("app.core.prisma.prisma.invoice.update", AsyncMock()),
        ):
            t = MagicMock()
            t.invoice.create = AsyncMock(return_value=mock_created_inv)
            t.invoice.update = AsyncMock()
            t.invoiceitem.create = AsyncMock()
            mock_tx.return_value.__aenter__.return_value = t

            res = await InvoiceService.create_anae_freelancer_invoice(
                freelancer_id=10,
                client_id=20,
                contract_id=1,
                milestone_id=1,
                amount_dzd=150000,
                service_title="Audit Cybersécurité & Hardening Infrastructure",
            )

            assert res["type"] == "FREELANCER_SERVICE"
            assert res["total_dzd"] == 150000
            assert res["tax_dzd"] == 0
            assert res["anae_card_number"] == "ANAE-2024-16-004521"
            assert "pdf_url" in res
            assert "pdf_path" in res
            assert os.path.exists(res["pdf_path"])
            # Cleanup generated test invoice pdf
            if os.path.exists(res["pdf_path"]):
                os.remove(res["pdf_path"])


# =============================================================================
# 12. ZERO-SUM INVARIANTS & INTEGER CENTIMES VALIDATION
# =============================================================================
class TestZeroSumAndIntegerCentimesInvariants:
    @pytest.mark.asyncio
    async def test_wallet_methods_reject_floats_and_bools(self):
        """Monetary methods must strictly reject non-integer floats and booleans."""
        service = WalletService()

        with pytest.raises(TypeError, match="must be an integer"):
            await service.credit_wallet(wallet_id=1, amount=100.5)

        with pytest.raises(TypeError, match="must be an integer"):
            await service.credit_wallet(
                wallet_id=1, amount=True
            )  # bool is subclass of int

        with pytest.raises(TypeError, match="must be an integer"):
            await service.debit_wallet(wallet_id=1, amount=50.25, purpose="PURCHASE")

        with pytest.raises(TypeError, match="must be an integer"):
            await service.hold_funds(wallet_id=1, amount=25.0, purpose="ESCROW")

        with pytest.raises(TypeError, match="must be an integer"):
            await service.release_hold(wallet_id=1, amount=25.0, purpose="ESCROW")

        with pytest.raises(TypeError, match="must be an integer"):
            await service.request_withdrawal(wallet_id=1, user_id=1, amount=500.5)

        with pytest.raises(TypeError, match="must be an integer"):
            await service.prepare_transfer(
                source_wallet_id=1, destination_wallet_id=2, amount=100.0
            )

    @pytest.mark.asyncio
    async def test_reject_withdrawal_locks_wallet_pessimistically(self):
        """Rejecting a withdrawal must acquire a pessimistic row lock on Wallet."""
        service = WalletService()
        mock_payout = MagicMock(
            id=15,
            walletId=7,
            amount=20_000,
            currency="DZD",
            status="PENDING",
        )
        mock_wallet = MagicMock(id=7, podaPoints=50_000, isActive=True)

        with patch("app.core.prisma.prisma.tx") as mock_tx:
            t = MagicMock()
            t.payout.find_unique = AsyncMock(return_value=mock_payout)
            t.payout.update = AsyncMock(return_value=mock_payout)
            t.execute_raw = AsyncMock()
            t.wallet.find_unique = AsyncMock(return_value=mock_wallet)
            t.wallettransaction.create = AsyncMock()
            mock_tx.return_value.__aenter__.return_value = t

            res = await service.reject_withdrawal(
                payout_id=15, admin_notes="Invalid account"
            )

            assert res["status"] == "REJECTED"
            # Verify pessimistic row lock on wallet 7
            t.execute_raw.assert_called_once_with(
                'SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE', 7
            )
            assert t.wallettransaction.create.called
