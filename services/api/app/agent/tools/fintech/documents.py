"""
FinTech Document Tools: GenerateTripleDocumentKitTool, GenerateTaxDefensePackTool.
"""

from typing import Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.core.prisma import prisma
from app.services.fiscal_ledger_service import FiscalLedgerService
from app.services.invoice_service import InvoiceService


class GenerateTripleDocumentKitArgs(BaseModel):
    contract_id: int = Field(description="Contract ID")
    milestone_id: int = Field(
        description="Milestone ID for which to issue the Triple Document Kit"
    )


class GenerateTripleDocumentKitTool(BaseTool):
    name = "generate_triple_document_kit"
    description = (
        "Generate the official Algerian Triple Document Kit (Facture Proforma, Bon de Commande, "
        "and Facture Définitive) with ANAE tax registration for a milestone (HITL-gated)."
    )
    domain = ToolDomain.FINTECH
    access_roles = [
        "USER",
        "CLIENT",
        "FREELANCER",
        "ORGANIZATION_MEMBER",
        "ORGANIZATION_ADMIN",
        "ADMIN",
    ]
    is_mutating = True
    requires_hitl = True
    args_schema: Type[BaseModel] = GenerateTripleDocumentKitArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, GenerateTripleDocumentKitArgs)

        contract = await prisma.contract.find_unique(
            where={"id": typed_args.contract_id}
        )
        if not contract:
            return ToolResult(
                success=False, error=f"Contract {typed_args.contract_id} not found"
            )

        # Security check
        if context.user_id not in (
            contract.clientId,
            contract.freelancerId,
        ) and not context.has_role("ADMIN"):
            return ToolResult(
                success=False,
                error="Unauthorized to generate documents for this contract",
            )

        try:
            kit = await InvoiceService.generate_milestone_kit(
                contract_id=typed_args.contract_id,
                milestone_id=typed_args.milestone_id,
            )
        except Exception as e:
            return ToolResult(
                success=False, error=f"Failed to generate Triple Document Kit: {str(e)}"
            )

        async def rollback_document_kit() -> bool:
            try:
                # Void generated invoices
                inv_id = kit.get("anae_invoice", {}).get("id")
                if inv_id:
                    await prisma.invoice.update(
                        where={"id": inv_id},
                        data={"status": "VOID"},
                    )
                return True
            except Exception:
                return False

        return ToolResult(
            success=True,
            data=kit,
            widget_payload={
                "widgetType": "triple_document_kit_card",
                "contractId": typed_args.contract_id,
                "milestoneId": typed_args.milestone_id,
                "kit": kit,
            },
            compensating_action=rollback_document_kit,
        )


class GenerateTaxDefensePackArgs(BaseModel):
    fiscal_year: int = Field(
        default=2024, ge=2023, le=2030, description="Fiscal tax year"
    )


class GenerateTaxDefensePackTool(BaseTool):
    name = "generate_tax_defense_pack"
    description = (
        "Generate a verified G50 / Article 169 CIDTA Tax Defense Pack with cryptographic Ed25519 "
        "audit trail hashes for tax inspection defense."
    )
    domain = ToolDomain.FINTECH
    access_roles = [
        "USER",
        "CLIENT",
        "FREELANCER",
        "ORGANIZATION_MEMBER",
        "ORGANIZATION_ADMIN",
        "ADMIN",
    ]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = GenerateTaxDefensePackArgs

    def __init__(self):
        super().__init__()
        self.fiscal_service = FiscalLedgerService()

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, GenerateTaxDefensePackArgs)

        user_id = context.user_id
        if not user_id:
            return ToolResult(success=False, error="User context required")

        try:
            pack = await self.fiscal_service.generate_client_tax_deduction_pack(
                client_id=user_id,
                fiscal_year=typed_args.fiscal_year,
            )
            data = pack.model_dump()
        except Exception as e:
            return ToolResult(
                success=False, error=f"Tax pack generation failed: {str(e)}"
            )

        return ToolResult(
            success=True,
            data=data,
            widget_payload={
                "widgetType": "tax_defense_pack_card",
                "fiscalYear": typed_args.fiscal_year,
                "totalExpensesDzd": data.get("total_expenses_dzd", 0),
                "taxShieldDzd": data.get("tax_shield_dzd", 0),
                "invoiceCount": len(data.get("invoices", [])),
            },
        )
