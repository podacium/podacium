import logging
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.auth import get_current_active_user
from app.core.prisma import prisma
from app.services.invoice_service import invoice_service

router = APIRouter(prefix="/invoices", tags=["Invoices"])
logger = logging.getLogger(__name__)


class GenerateKitRequest(BaseModel):
    contract_id: int
    milestone_id: int


@router.get("")
async def list_invoices(
    limit: int = 50,
    offset: int = 0,
    current_user=Depends(get_current_active_user),
):
    """List invoices where current user is issuer or recipient."""
    try:
        user_id = current_user.id
        memberships = await prisma.organizationmember.find_many(
            where={"userId": user_id, "deletedAt": None}
        )
        user_org_ids = [m.organizationId for m in memberships]
        if getattr(current_user, "primaryOrganizationId", None):
            user_org_ids.append(current_user.primaryOrganizationId)

        where_clause = {
            "OR": [
                {"issuerId": user_id},
                {"recipientId": user_id},
                {"userId": user_id},
            ]
        }
        if user_org_ids:
            where_clause["OR"].append({"recipientId": {"in": user_org_ids}})
            where_clause["OR"].append({"organizationId": {"in": user_org_ids}})

        invoices = await prisma.invoice.find_many(
            where=where_clause,
            include={"items": True},
            order={"issuedAt": "desc"},
            take=limit,
            skip=offset,
        )
        return {"invoices": invoices}
    except Exception as e:
        logger.error(f"Failed to fetch invoices: {e}")
        raise HTTPException(status_code=500, detail="errors.invoices.failed_to_fetch")


async def _is_invoice_authorized(invoice, current_user) -> bool:
    if getattr(current_user, "role", "") == "ADMIN":
        return True
    if (
        invoice.issuerId == current_user.id
        or getattr(invoice, "userId", None) == current_user.id
        or invoice.recipientId == current_user.id
    ):
        return True
    memberships = await prisma.organizationmember.find_many(
        where={"userId": current_user.id, "deletedAt": None}
    )
    user_org_ids = {m.organizationId for m in memberships}
    if getattr(current_user, "primaryOrganizationId", None):
        user_org_ids.add(current_user.primaryOrganizationId)

    if (
        getattr(invoice, "organizationId", None)
        and invoice.organizationId in user_org_ids
    ):
        return True
    if invoice.recipientId and invoice.recipientId in user_org_ids:
        return True
    return False


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: int,
    current_user=Depends(get_current_active_user),
):
    """Get specific invoice details."""
    invoice = await prisma.invoice.find_unique(
        where={"id": invoice_id},
        include={"items": True},
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="errors.invoices.not_found")

    if not await _is_invoice_authorized(invoice, current_user):
        raise HTTPException(status_code=403, detail="errors.invoices.not_authorized")

    return invoice


@router.get("/{invoice_id}/download")
async def download_invoice_pdf(
    invoice_id: int,
    current_user=Depends(get_current_active_user),
):
    """Download certified PDF for a specific invoice."""
    invoice = await prisma.invoice.find_unique(
        where={"id": invoice_id},
        include={"items": True},
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="errors.invoices.not_found")

    if not await _is_invoice_authorized(invoice, current_user):
        raise HTTPException(status_code=403, detail="errors.invoices.not_authorized")

    pdf_path = await invoice_service.ensure_invoice_pdf(invoice)
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="errors.invoices.file_not_found")

    filename = f"Facture_{invoice.invoiceNumber}.pdf"
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/generate-milestone-kit")
async def generate_milestone_kit(
    req: GenerateKitRequest,
    current_user=Depends(get_current_active_user),
):
    """Generate or retrieve the Triple Document Kit (Contrat, PV Réception, Facture ANAE) for a completed milestone."""
    milestone = await prisma.contractmilestone.find_unique(
        where={"id": req.milestone_id},
        include={"contract": True},
    )
    if not milestone:
        raise HTTPException(
            status_code=404, detail="errors.invoices.milestone_not_found"
        )

    if milestone.contract.id != req.contract_id:
        raise HTTPException(
            status_code=400, detail="errors.invoices.milestone_mismatch"
        )

    contract = milestone.contract
    if (
        current_user.id not in [contract.clientId, contract.freelancerId]
        and current_user.role != "ADMIN"
    ):
        raise HTTPException(
            status_code=403, detail="errors.invoices.contract_not_authorized"
        )

    try:
        kit = await invoice_service.generate_milestone_kit(
            req.contract_id, req.milestone_id
        )
        return kit
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to generate milestone kit: {e}")
        raise HTTPException(status_code=500, detail="errors.invoices.generation_failed")


@router.get("/milestones/{milestone_id}/ip-deed")
async def get_milestone_ip_deed(
    milestone_id: int,
    current_user=Depends(get_current_active_user),
):
    """Retrieve or generate the certified Bilateral IP Assignment Deed (Ordonnance 03-05 & Loi 22-23)."""
    milestone = await prisma.contractmilestone.find_unique(
        where={"id": milestone_id},
        include={"contract": True},
    )
    if not milestone:
        raise HTTPException(
            status_code=404, detail="errors.invoices.milestone_not_found"
        )

    contract = milestone.contract
    if (
        current_user.id not in [contract.clientId, contract.freelancerId]
        and current_user.role != "ADMIN"
    ):
        raise HTTPException(
            status_code=403, detail="errors.invoices.contract_not_authorized"
        )

    from app.services.ip_assignment_service import ip_assignment_service

    deed = await ip_assignment_service.get_ip_deed(contract.id, milestone.id)
    if not deed:
        deed = await ip_assignment_service.generate_ip_deed_on_milestone_release(
            milestone.id
        )
    return deed


@router.get("/milestones/{milestone_id}/ip-deed/download")
async def download_milestone_ip_deed(
    milestone_id: int,
    current_user=Depends(get_current_active_user),
):
    """Download the certified bilingual PDF for the Bilateral IP Assignment Deed."""
    milestone = await prisma.contractmilestone.find_unique(
        where={"id": milestone_id},
        include={"contract": True},
    )
    if not milestone:
        raise HTTPException(
            status_code=404, detail="errors.invoices.milestone_not_found"
        )

    contract = milestone.contract
    if (
        current_user.id not in [contract.clientId, contract.freelancerId]
        and current_user.role != "ADMIN"
    ):
        raise HTTPException(
            status_code=403, detail="errors.invoices.contract_not_authorized"
        )

    from app.services.ip_assignment_service import ip_assignment_service

    deed = await ip_assignment_service.get_ip_deed(contract.id, milestone.id)
    if not deed or not deed.get("pdfPath") or not os.path.exists(deed["pdfPath"]):
        deed = await ip_assignment_service.generate_ip_deed_on_milestone_release(
            milestone.id
        )

    pdf_path = deed["pdfPath"]
    filename = os.path.basename(pdf_path)
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class ReceiptVerifyRequest(BaseModel):
    raw_text: str
    expected_amount: int
    expected_reference: str
    expected_receiver_rip: str | None = None
    max_age_hours: int = 48


@router.post("/receipt-ocr/verify")
async def verify_receipt_ocr(
    req: ReceiptVerifyRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Automated OCR parsing and verification of Algerian BaridiMob / CCP payment slips.
    Checks amount, reference code, beneficiary RIP, timestamp freshness, and anti-replay hashes.
    """
    from app.services.receipt_ocr_service import receipt_ocr_service

    try:
        result = await receipt_ocr_service.verify_receipt(
            raw_text=req.raw_text,
            expected_amount=req.expected_amount,
            expected_reference=req.expected_reference,
            expected_receiver_rip=req.expected_receiver_rip,
            max_age_hours=req.max_age_hours,
        )
        return result
    except Exception as e:
        logger.error(f"Receipt OCR verification failed: {e}")
        raise HTTPException(status_code=500, detail="errors.ocr.verification_failed")


@router.get("/fiscal/g50/{fiscal_year}")
async def get_freelancer_g50_report(
    fiscal_year: int,
    current_user=Depends(get_current_active_user),
):
    """
    Generate ANAE Freelancer G50 Tax Return report for Loi 22-23 / LF 2024 Art. 282 sexies CIDTA.
    Calculates IFU 0.5% and quarterly turnover breakdowns.
    """
    from app.services.fiscal_ledger_service import fiscal_ledger_service

    try:
        report = await fiscal_ledger_service.generate_freelancer_g50_report(
            freelancer_id=current_user.id,
            fiscal_year=fiscal_year,
        )
        return report
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to generate G50 report: {e}")
        raise HTTPException(
            status_code=500, detail="errors.fiscal.g50_generation_failed"
        )


@router.get("/fiscal/tax-deduction-pack/{fiscal_year}")
async def get_client_tax_deduction_pack(
    fiscal_year: int,
    current_user=Depends(get_current_active_user),
):
    """
    Generate Enterprise Corporate Tax Deduction Pack under Article 169 CIDTA (100% IBS deductibility).
    """
    from app.services.fiscal_ledger_service import fiscal_ledger_service

    try:
        pack = await fiscal_ledger_service.generate_client_tax_deduction_pack(
            client_id=current_user.id,
            fiscal_year=fiscal_year,
        )
        return pack
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to generate tax deduction pack: {e}")
        raise HTTPException(
            status_code=500, detail="errors.fiscal.pack_generation_failed"
        )


class DeliverableTokenRequest(BaseModel):
    contract_id: int
    milestone_id: int
    ttl_minutes: int = 60


@router.post("/deliverables/download-token")
async def generate_deliverable_download_token(
    req: DeliverableTokenRequest,
    current_user=Depends(get_current_active_user),
):
    """
    Generate a signed time-limited HMAC token for accessing unlocked milestone deliverables post-PV de Réception.
    """
    from app.services.envelope_encryption_service import envelope_encryption_service

    milestone = await prisma.contractmilestone.find_unique(
        where={"id": req.milestone_id},
        include={"contract": True},
    )
    if not milestone:
        raise HTTPException(
            status_code=404, detail="errors.invoices.milestone_not_found"
        )

    if milestone.contract.id != req.contract_id:
        raise HTTPException(
            status_code=400, detail="errors.invoices.milestone_mismatch"
        )

    contract = milestone.contract
    if (
        current_user.id not in [contract.clientId, contract.freelancerId]
        and current_user.role != "ADMIN"
    ):
        raise HTTPException(
            status_code=403, detail="errors.invoices.contract_not_authorized"
        )

    if (
        not milestone.deliverableKeyReleased
        and milestone.status not in ["APPROVED", "COMPLETED"]
        and current_user.id != contract.freelancerId
    ):
        raise HTTPException(
            status_code=403, detail="errors.security.deliverable_locked_until_pv_signed"
        )

    token = envelope_encryption_service.generate_download_token(
        contract_id=req.contract_id,
        milestone_id=req.milestone_id,
        user_id=current_user.id,
        ttl_minutes=req.ttl_minutes,
    )
    return {
        "token": token,
        "contract_id": req.contract_id,
        "milestone_id": req.milestone_id,
    }


@router.get("/deliverables/download")
async def download_unlocked_deliverable(
    token: str,
    contract_id: int,
    milestone_id: int,
    current_user=Depends(get_current_active_user),
):
    """
    Redeem signed HMAC token to stream decrypted milestone deliverable post-PV de Réception.
    """
    from fastapi.responses import Response
    from app.services.envelope_encryption_service import (
        envelope_encryption_service,
        EncryptedEnvelope,
    )

    is_valid = envelope_encryption_service.verify_download_token(
        token=token,
        expected_contract_id=contract_id,
        expected_milestone_id=milestone_id,
        expected_user_id=current_user.id,
    )
    if not is_valid:
        raise HTTPException(
            status_code=403,
            detail="errors.security.invalid_or_expired_download_token",
        )

    milestone = await prisma.contractmilestone.find_unique(
        where={"id": milestone_id},
        include={"contract": True},
    )
    if not milestone or milestone.contractId != contract_id:
        raise HTTPException(
            status_code=404, detail="errors.invoices.milestone_not_found"
        )

    if (
        not milestone.deliverableKeyReleased
        and milestone.status not in ["APPROVED", "COMPLETED"]
        and current_user.id != milestone.contract.freelancerId
    ):
        raise HTTPException(
            status_code=403,
            detail="errors.security.deliverable_locked_until_pv_signed",
        )

    deliverables = milestone.deliverables
    if not deliverables:
        raise HTTPException(
            status_code=404, detail="errors.invoices.no_deliverable_uploaded"
        )

    if (
        isinstance(deliverables, dict)
        and "ciphertext" in deliverables
        and "wrapped_dek" in deliverables
    ):
        try:
            envelope = EncryptedEnvelope(
                wrapped_dek=deliverables["wrapped_dek"],
                iv=deliverables["iv"],
                ciphertext=deliverables["ciphertext"],
                aad=deliverables["aad"],
                file_size_bytes=deliverables.get(
                    "file_size_bytes", len(deliverables["ciphertext"])
                ),
                sha256_checksum=deliverables.get("sha256_checksum", ""),
            )
            filename = deliverables.get(
                "filename", f"milestone_{milestone_id}_deliverable.bin"
            )
            decrypted_bytes = envelope_encryption_service.decrypt_file_payload(
                envelope=envelope,
                contract_id=contract_id,
                milestone_id=milestone_id,
                filename=filename,
            )
            return Response(
                content=decrypted_bytes,
                media_type="application/octet-stream",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
        except Exception as e:
            logger.error(f"Deliverable decryption failed: {e}")
            raise HTTPException(
                status_code=500, detail="errors.security.decryption_failed"
            )

    return {
        "message": "Deliverable metadata verified",
        "milestone_id": milestone_id,
        "status": "UNLOCKED",
    }


@router.get("/ledger/verify")
async def verify_fiscal_ledger(
    current_user=Depends(get_current_active_user),
):
    """
    Audit & verify cryptographic integrity of the append-only fiscal ledger chain.
    """
    from app.services.fiscal_ledger_service import fiscal_ledger_service

    return fiscal_ledger_service.verify_ledger_integrity()


@router.get("/{invoice_id}/defense-pack")
async def download_invoice_defense_pack(
    invoice_id: int,
    current_user=Depends(get_current_active_user),
):
    """
    Generate and stream signed Tax Defense Pack ZIP bundle under Article 169 CIDTA.
    """
    from fastapi.responses import Response
    from app.services.fiscal_ledger_service import fiscal_ledger_service

    invoice = await prisma.invoice.find_unique(
        where={"id": invoice_id},
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="errors.invoices.not_found")

    if not await _is_invoice_authorized(invoice, current_user):
        raise HTTPException(status_code=403, detail="errors.invoices.not_authorized")

    # Fetch issuer (freelancer) and recipient (client) info
    issuer = await prisma.user.find_unique(
        where={"id": invoice.issuerId}, include={"kyc": True, "freelancerProfile": True}
    )
    recipient = await prisma.user.find_unique(
        where={"id": invoice.recipientId},
        include={
            "primaryOrganization": True,
            "ownedOrganizations": True,
            "memberships": {"include": {"organization": True}},
        },
    )

    freelancer_name = (
        (getattr(issuer, "fullName", None) or issuer.email) if issuer else "Prestataire"
    )
    org_name = None
    if recipient:
        if recipient.primaryOrganization:
            org_name = recipient.primaryOrganization.name
        elif recipient.ownedOrganizations and len(recipient.ownedOrganizations) > 0:
            org_name = recipient.ownedOrganizations[0].name
        elif (
            recipient.memberships
            and len(recipient.memberships) > 0
            and recipient.memberships[0].organization
        ):
            org_name = recipient.memberships[0].organization.name

    client_name = (
        org_name or getattr(recipient, "fullName", None) or "Client Entreprise"
    )
    anae_card = (
        (
            issuer.kyc.anaeCardNumber
            if (issuer and issuer.kyc and issuer.kyc.anaeCardNumber)
            else (
                issuer.freelancerProfile.anaeCardNumber
                if (
                    issuer
                    and issuer.freelancerProfile
                    and issuer.freelancerProfile.anaeCardNumber
                )
                else "NON-RENSEIGNÉ"
            )
        )
        if issuer
        else "NON-RENSEIGNÉ"
    )

    invoice_data = {
        "invoice_number": invoice.invoiceNumber,
        "total_dzd": invoice.totalDzd,
        "date": invoice.createdAt.strftime("%Y-%m-%d") if invoice.createdAt else None,
    }

    zip_bytes = fiscal_ledger_service.generate_tax_defense_bundle(
        invoice_id=invoice.id,
        invoice_data=invoice_data,
        client_name=client_name,
        freelancer_name=freelancer_name,
        anae_card_number=anae_card,
    )

    filename = f"Dossier_Fiscal_{invoice.invoiceNumber}_IBS100.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Platform-Signer": "Podacium-Ed25519",
        },
    )
