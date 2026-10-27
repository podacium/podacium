import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import get_current_active_user, get_current_admin_user
from app.services.dlg_parser_service import dlg_parser_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing/fintech", tags=["FinTech & Accounting"])


class BinLookupRequest(BaseModel):
    card_number: str = Field(
        ...,
        min_length=4,
        max_length=19,
        description="Card number or initial 4-8 digits (BIN)",
    )


class BaridiMobOrderRequest(BaseModel):
    amount_dzd: int = Field(
        ..., gt=0, description="Amount in DZD (integer centimes/dinars)"
    )
    client_id: int = Field(..., description="Client user ID")
    contract_or_order_ref: Optional[str] = Field(
        None, description="Optional contract or order reference"
    )
    corporate_rip: Optional[str] = Field(
        "00799999000123456789", description="Corporate CCP/RIP account"
    )


class Mt940ParseRequest(BaseModel):
    raw_text: str = Field(
        ..., min_length=10, description="SWIFT MT940 raw statement text"
    )


class Camt053ParseRequest(BaseModel):
    xml_content: str = Field(
        ..., min_length=10, description="ISO 20022 CAMT.053 XML string"
    )


class ScfEntryItem(BaseModel):
    date: str
    account: str
    libelle: str
    debit: float = 0.0
    credit: float = 0.0
    piece_ref: Optional[str] = None


class ScfJournalRequest(BaseModel):
    entries: List[ScfEntryItem]
    journal_code: str = "OD"


class TaxDefensePackRequest(BaseModel):
    enterprise_name: str = Field(..., min_length=2)
    nif: str = Field(
        ..., min_length=9, max_length=20, description="Numéro d'Identification Fiscale"
    )
    nis: str = Field(
        ...,
        min_length=5,
        max_length=20,
        description="Numéro d'Identification Statistique",
    )
    training_title: str = Field(..., min_length=3)
    amount_dzd: int = Field(..., gt=0)
    hours_completed: int = Field(..., gt=0)
    participants_count: int = Field(..., gt=0)
    contract_or_invoice_ref: str = Field(..., min_length=3)


class TaxDefensePackVerifyRequest(BaseModel):
    pack: Dict[str, Any]


@router.post("/bin-lookup")
async def lookup_bin(
    payload: BinLookupRequest,
    current_user: Any = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    Detects card payment network (EDAHABIA vs CIB) from Bank Identification Number (BIN).
    """
    network = dlg_parser_service.detect_card_network(payload.card_number)
    return {
        "network": network,
        "is_supported": network in ["EDAHABIA", "CIB"],
        "routing": {
            "clearing_house": "Algérie Poste"
            if network == "EDAHABIA"
            else "SATIM GIE Monétique",
            "settlement_rail": "Chargily EDAHABIA"
            if network == "EDAHABIA"
            else "Chargily CIB",
        },
    }


@router.post("/baridimob/order")
async def create_baridimob_order(
    payload: BaridiMobOrderRequest,
    current_user: Any = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    Generates an immutable BaridiMob concierge payment order code and postal slip instruction.
    """
    return dlg_parser_service.generate_baridimob_concierge_order(
        amount_dzd=payload.amount_dzd,
        client_id=payload.client_id,
        contract_or_order_ref=payload.contract_or_order_ref,
        corporate_rip=payload.corporate_rip or "00799999000123456789",
    )


@router.post("/reconciliation/mt940")
async def parse_mt940(
    payload: Mt940ParseRequest,
    admin_user: Any = Depends(get_current_admin_user),
) -> Dict[str, Any]:
    """
    Parses a SWIFT MT940 bank statement for automated financial reconciliation.
    Admin only.
    """
    try:
        return dlg_parser_service.parse_mt940_statement(payload.raw_text)
    except Exception as e:
        logger.error(f"MT940 parsing failed: {e}")
        raise HTTPException(
            status_code=400, detail=f"Failed to parse MT940 statement: {str(e)}"
        )


@router.post("/reconciliation/camt053")
async def parse_camt053(
    payload: Camt053ParseRequest,
    admin_user: Any = Depends(get_current_admin_user),
) -> Dict[str, Any]:
    """
    Parses an ISO 20022 CAMT.053 XML statement for automated financial reconciliation.
    Admin only.
    """
    try:
        return dlg_parser_service.parse_camt053_statement(payload.xml_content)
    except Exception as e:
        logger.error(f"CAMT.053 parsing failed: {e}")
        raise HTTPException(
            status_code=400, detail=f"Failed to parse CAMT.053 statement: {str(e)}"
        )


@router.post("/accounting/scf-journal")
async def export_scf_journal(
    payload: ScfJournalRequest,
    admin_user: Any = Depends(get_current_admin_user),
) -> Dict[str, Any]:
    """
    Exports journal entries formatted for DLG PC Compta conforming to Algerian SCF.
    Admin only.
    """
    raw_entries = [entry.model_dump() for entry in payload.entries]
    csv_content = dlg_parser_service.export_dlg_scf_journal(
        entries=raw_entries,
        journal_code=payload.journal_code,
    )
    return {
        "csv_content": csv_content,
        "entry_count": len(payload.entries),
        "journal_code": payload.journal_code,
    }


@router.post("/tax/defense-pack")
async def create_tax_defense_pack(
    payload: TaxDefensePackRequest,
    current_user: Any = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    Generates an Ed25519-signed Tax Defense Pack under Article 169 & 224 CIDTA,
    proving 100% IBS (26%) corporate tax deductibility for enterprise training contracts.
    """
    return dlg_parser_service.generate_article169_tax_defense_pack(
        enterprise_name=payload.enterprise_name,
        nif=payload.nif,
        nis=payload.nis,
        training_title=payload.training_title,
        amount_dzd=payload.amount_dzd,
        hours_completed=payload.hours_completed,
        participants_count=payload.participants_count,
        contract_or_invoice_ref=payload.contract_or_invoice_ref,
    )


@router.post("/tax/defense-pack/verify")
async def verify_tax_defense_pack(
    payload: TaxDefensePackVerifyRequest,
) -> Dict[str, Any]:
    """
    Cryptographically verifies the Ed25519 signature of an Article 169 CIDTA Tax Defense Pack.
    Public endpoint for enterprise auditors and tax inspectors.
    """
    is_valid = dlg_parser_service.verify_article169_tax_defense_pack(payload.pack)
    return {
        "valid": is_valid,
        "message": (
            "Signature Ed25519 authentifiée. Document fiscal conforme à l'Article 169 du CIDTA."
            if is_valid
            else "Signature Ed25519 invalide ou altérée."
        ),
    }


# =============================================================================
# TIGERBEETLE-GRADE TWO-PHASE TRANSFERS & DOUBLE-ENTRY LEDGER ENDPOINTS
# =============================================================================


class TransferPrepareRequest(BaseModel):
    source_wallet_id: int = Field(..., description="Source wallet ID")
    destination_wallet_id: int = Field(..., description="Destination wallet ID")
    amount: int = Field(..., gt=0, description="Transfer amount in DZD/PodaPoints")
    purpose: str = Field("TRANSFER", description="Transfer purpose classification")
    reference_id: Optional[str] = Field(
        None, description="Optional external or idempotency reference ID"
    )
    description: Optional[str] = Field(None, description="Transfer memo/description")


class TransferCommitRequest(BaseModel):
    transfer_id: str = Field(
        ..., min_length=5, description="Two-phase transfer ID (e.g., TB2P-...)"
    )


class TransferRollbackRequest(BaseModel):
    transfer_id: str = Field(..., min_length=5, description="Two-phase transfer ID")
    reason: Optional[str] = Field(None, description="Reason for voiding the transfer")


@router.post("/transfers/prepare")
async def prepare_two_phase_transfer(
    payload: TransferPrepareRequest,
    current_user: Any = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    TigerBeetle Phase 1 (PREPARE): Atomically reserves debits_pending in the source wallet.
    Funds remain locked until committed or rolled back.
    """
    from app.services.wallet_service import wallet_service

    if payload.source_wallet_id == payload.destination_wallet_id:
        raise HTTPException(
            status_code=400, detail="Cannot transfer to the same wallet"
        )

    source_wallet = await wallet_service.get_wallet(payload.source_wallet_id)
    if not source_wallet:
        raise HTTPException(status_code=404, detail="Source wallet not found")

    if current_user.role != "ADMIN" and source_wallet.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to transfer from this wallet"
        )

    return await wallet_service.prepare_transfer(
        source_wallet_id=payload.source_wallet_id,
        destination_wallet_id=payload.destination_wallet_id,
        amount=payload.amount,
        purpose=payload.purpose,
        reference_id=payload.reference_id,
        description=payload.description,
    )


@router.post("/transfers/commit")
async def commit_two_phase_transfer(
    payload: TransferCommitRequest,
    current_user: Any = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    TigerBeetle Phase 2 (COMMIT / POST): Atomically debits source posted balance and credits
    destination posted balance. Protected against TOCTOU double-posting via pessimistic locks.
    """
    from app.services.wallet_service import wallet_service
    from app.core.prisma import prisma

    hold_tx = await prisma.wallettransaction.find_first(
        where={"referenceId": payload.transfer_id, "type": "HOLD"}
    )
    if not hold_tx:
        raise HTTPException(
            status_code=404, detail="Two-phase transfer record not found"
        )

    source_wallet = await wallet_service.get_wallet(hold_tx.walletId)
    if current_user.role != "ADMIN" and (
        not source_wallet or source_wallet.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=403, detail="Not authorized to commit this transfer"
        )

    return await wallet_service.post_transfer(transfer_id=payload.transfer_id)


@router.post("/transfers/rollback")
async def rollback_two_phase_transfer(
    payload: TransferRollbackRequest,
    current_user: Any = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    TigerBeetle Phase 2 (ROLLBACK / VOID): Releases reserved funds back to the source wallet's
    spendable available balance.
    """
    from app.services.wallet_service import wallet_service
    from app.core.prisma import prisma

    hold_tx = await prisma.wallettransaction.find_first(
        where={"referenceId": payload.transfer_id, "type": "HOLD"}
    )
    if not hold_tx:
        raise HTTPException(
            status_code=404, detail="Two-phase transfer record not found"
        )

    source_wallet = await wallet_service.get_wallet(hold_tx.walletId)
    if current_user.role != "ADMIN" and (
        not source_wallet or source_wallet.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=403, detail="Not authorized to rollback this transfer"
        )

    return await wallet_service.void_transfer(
        transfer_id=payload.transfer_id,
        reason=payload.reason,
    )


@router.get("/ledger/audit/{wallet_id}")
async def audit_wallet_ledger(
    wallet_id: int,
    current_user: Any = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    Performs institutional double-entry trial balance audit on a wallet.
    Verifies running balance continuity, sum of debits/credits conservation, and available balance invariant.
    """
    from app.services.wallet_service import wallet_service

    wallet = await wallet_service.get_wallet(wallet_id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    if current_user.role != "ADMIN" and wallet.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to audit this wallet"
        )

    return await wallet_service.audit_wallet_ledger(wallet_id=wallet_id)
