"""
Facture Proforma & Bank Wire Clearing Service (Loi 22-23, CIDTA Art. 169/224).
Handles proforma generation for Algerian B2B transactions and bank wire (virement bancaire) reconciliation.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status

from app.core.prisma import prisma
from app.services.audit_trail_service import AuditTrailService

logger = logging.getLogger("podacium.proforma")

PODACIUM_CORPORATE_IDENTITY = {
    "legalName": "SARL PODACIUM BI & TECH",
    "tradeName": "Podacium OS",
    "address": "04 Rue Didouche Mourad, Alger Centre, 16000 Alger",
    "rcNumber": "16B0123456",
    "rcWilayaCode": "16",
    "nifNumber": "002016012345678",
    "nisNumber": "002016012345678",
    "articleImposition": "16012345678",
    "bankName": "Banque Extérieure d'Algérie (BEA)",
    "bankAgency": "Agence 004 - Alger Centre",
    "bankRip": "004 00123 4567890123 45",
    "currency": "DZD",
}


class ProformaService:
    @staticmethod
    async def generate_proforma(
        organization_id: int,
        requester_id: int,
        items: List[Dict[str, Any]],
        notes: Optional[str] = None,
        article_169_eligible: bool = True,
    ) -> Dict[str, Any]:
        """
        Generate a formal Facture Proforma for B2B bank wire purchase.
        """
        org = await prisma.organization.find_unique(where={"id": organization_id})
        if not org or org.deletedAt:
            raise HTTPException(status_code=404, detail="Organization not found")

        now = datetime.now(timezone.utc)
        proforma_ref = (
            f"PF-{now.year}-{organization_id:04d}-{int(now.timestamp()) % 100000:05d}"
        )

        subtotal_dzd = sum(
            float(item.get("unitPriceDzd", 0)) * int(item.get("quantity", 1))
            for item in items
        )
        # Article 169 CIDTA enables deduction / tax optimization for technological investments
        tva_rate = 0.0 if article_169_eligible else 0.19
        tva_dzd = subtotal_dzd * tva_rate
        total_dzd = subtotal_dzd + tva_dzd

        proforma_data = {
            "proformaReference": proforma_ref,
            "organizationId": organization_id,
            "organizationName": org.name,
            "orgRc": getattr(org, "rcNumber", None),
            "orgNif": getattr(org, "nifNumber", None),
            "orgNis": getattr(org, "nisNumber", None),
            "orgArticleImposition": getattr(org, "articleImposition", None),
            "seller": PODACIUM_CORPORATE_IDENTITY,
            "items": items,
            "subtotalDzd": subtotal_dzd,
            "tvaRate": tva_rate,
            "tvaDzd": tva_dzd,
            "totalDzd": total_dzd,
            "article169Eligible": article_169_eligible,
            "taxExemptionClause": (
                "Éligible au bouclier fiscal formation & recherche/développement "
                "(Art. 169 & 224 du CIDTA - Déductibilité intégrale de l'IBS à 26%)."
                if article_169_eligible
                else None
            ),
            "bankWireInstructions": {
                "bank": PODACIUM_CORPORATE_IDENTITY["bankName"],
                "agency": PODACIUM_CORPORATE_IDENTITY["bankAgency"],
                "rip": PODACIUM_CORPORATE_IDENTITY["bankRip"],
                "beneficiary": PODACIUM_CORPORATE_IDENTITY["legalName"],
                "paymentReference": proforma_ref,
            },
            "status": "ISSUED",
            "issuedAt": now.isoformat(),
            "notes": notes,
        }

        # Persist as pending Invoice record with recipientType='ORGANIZATION'
        invoice = await prisma.invoice.create(
            data={
                "organizationId": organization_id,
                "amount": total_dzd,
                "currency": "DZD",
                "status": "PENDING",
                "recipientType": "ORGANIZATION",
                "paymentMethod": "BANK_TRANSFER",
                "description": f"Facture Proforma {proforma_ref} - {org.name}",
            }
        )

        proforma_data["invoiceId"] = invoice.id

        await AuditTrailService.log_action(
            actor_id=requester_id,
            action="PROFORMA_GENERATED",
            domain="BILLING",
            resource_type="Invoice",
            resource_id=invoice.id,
            metadata={"proformaReference": proforma_ref, "totalDzd": total_dzd},
        )

        return proforma_data

    @staticmethod
    async def clear_bank_wire_payment(
        invoice_id: int,
        approver_id: int,
        bank_transfer_ref: str,
        slip_storage_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Finance DAF confirms receipt of bank wire funds (Bordereau de versement).
        Releases corporate credit and transitions invoice to PAID.
        """
        now = datetime.now(timezone.utc)
        async with prisma.tx() as tx:
            invoice = await tx.invoice.find_unique(where={"id": invoice_id})
            if not invoice:
                raise HTTPException(status_code=404, detail="Invoice not found")

            if invoice.status == "PAID":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invoice has already been marked as PAID.",
                )

            updated_invoice = await tx.invoice.update(
                where={"id": invoice_id},
                data={
                    "status": "PAID",
                    "paidAt": now,
                },
            )

            # Record cleared transaction
            if invoice.organizationId:
                await tx.biauditlog.create(
                    data={
                        "organizationId": invoice.organizationId,
                        "userId": approver_id,
                        "eventType": "BANK_WIRE_CLEARED",
                        "eventDetails": (
                            f"Bank wire ref {bank_transfer_ref} cleared for invoice #{invoice_id} "
                            f"amount: {invoice.amount} DZD"
                        ),
                    }
                )

        await AuditTrailService.log_action(
            actor_id=approver_id,
            action="BANK_WIRE_CLEARED",
            domain="BILLING",
            resource_type="Invoice",
            resource_id=invoice_id,
            metadata={
                "bankTransferRef": bank_transfer_ref,
                "slipStorageKey": slip_storage_key,
                "amountDzd": invoice.amount,
            },
        )

        return {
            "success": True,
            "invoiceId": updated_invoice.id,
            "status": "PAID",
            "paidAt": now.isoformat(),
            "bankTransferRef": bank_transfer_ref,
        }
