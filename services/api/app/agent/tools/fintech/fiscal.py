"""
FinTech Fiscal Tools: CalculateTaxDeductionsTool, CheckAnaeTurnoverCeilingTool.
"""

from datetime import datetime, timezone
from typing import Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.core.prisma import prisma
from app.services.fiscal_ledger_service import (
    ANAE_ANNUAL_TURNOVER_CEILING_DZD,
    IFU_TAX_RATE_DECIMAL,
    IFU_TAX_RATE_PERCENT,
)


class CalculateTaxDeductionsArgs(BaseModel):
    expense_amount_dzd: int = Field(
        gt=0, description="Gross training or freelance expense in DZD"
    )
    corporate_ibs_rate: float = Field(
        default=0.26,
        ge=0.10,
        le=0.35,
        description="Corporate income tax rate (default 26% for Algerian SMEs/Enterprises)",
    )


class CalculateTaxDeductionsTool(BaseTool):
    name = "calculate_tax_deductions"
    description = (
        "Calculate corporate tax deductions and net cost under Algerian CIDTA Articles 169 & 224 "
        "(100% deductible operating expense against 26% IBS tax shield, booked to SCF Compte 6181/6186)."
    )
    domain = ToolDomain.FINTECH
    access_roles = [
        "USER",
        "CLIENT",
        "ORGANIZATION_MEMBER",
        "ORGANIZATION_ADMIN",
        "ADMIN",
    ]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = CalculateTaxDeductionsArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, CalculateTaxDeductionsArgs)

        gross_amount = typed_args.expense_amount_dzd
        ibs_rate = typed_args.corporate_ibs_rate
        tax_shield_savings = int(gross_amount * ibs_rate)
        effective_net_cost = gross_amount - tax_shield_savings

        data = {
            "gross_expense_dzd": gross_amount,
            "ibs_tax_rate": f"{int(ibs_rate * 100)}%",
            "tax_shield_savings_dzd": tax_shield_savings,
            "effective_net_cost_dzd": effective_net_cost,
            "scf_accounting_code": "Compte 6181 (Documentation et formation) / 6186 (Études et recherches)",
            "legal_basis": "Articles 169 & 224 du Code des Impôts Directs et Taxes Assimilées (CIDTA)",
            "deductibility_status": "100% DÉDUCTIBLE DU RÉSULTAT FISCAL IMPOSABLE",
        }

        return ToolResult(
            success=True,
            data=data,
            widget_payload={
                "widgetType": "tax_deduction_shield_card",
                "grossExpenseDzd": gross_amount,
                "taxShieldSavingsDzd": tax_shield_savings,
                "effectiveNetCostDzd": effective_net_cost,
                "scfCode": "6181 / 6186",
            },
        )


class CheckAnaeTurnoverCeilingArgs(BaseModel):
    fiscal_year: int = Field(
        default=2024, ge=2023, le=2030, description="Fiscal tax year to evaluate"
    )


class CheckAnaeTurnoverCeilingTool(BaseTool):
    name = "check_anae_turnover_ceiling"
    description = (
        "Check an ANAE auto-entrepreneur's annual turnover against the 5,000,000 DZD statutory ceiling "
        "under Algerian Law 22-23 and calculate the 0.5% IFU flat tax liability."
    )
    domain = ToolDomain.FINTECH
    access_roles = ["USER", "FREELANCER", "ADMIN"]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = CheckAnaeTurnoverCeilingArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, CheckAnaeTurnoverCeilingArgs)

        user_id = context.user_id
        if not user_id:
            return ToolResult(success=False, error="User context required")

        start_date = datetime(typed_args.fiscal_year, 1, 1, tzinfo=timezone.utc)
        end_date = datetime(
            typed_args.fiscal_year, 12, 31, 23, 59, 59, tzinfo=timezone.utc
        )

        invoices = await prisma.invoice.find_many(
            where={
                "issuerId": user_id,
                "status": "PAID",
                "createdAt": {"gte": start_date, "lte": end_date},
            }
        )

        annual_turnover_dzd = sum(inv.totalAmount for inv in invoices)
        remaining_ceiling_dzd = max(
            0, ANAE_ANNUAL_TURNOVER_CEILING_DZD - annual_turnover_dzd
        )
        is_ceiling_exceeded = annual_turnover_dzd > ANAE_ANNUAL_TURNOVER_CEILING_DZD
        ifu_tax_liability_dzd = int(annual_turnover_dzd * IFU_TAX_RATE_DECIMAL)

        data = {
            "fiscal_year": typed_args.fiscal_year,
            "statutory_ceiling_dzd": ANAE_ANNUAL_TURNOVER_CEILING_DZD,
            "annual_turnover_dzd": annual_turnover_dzd,
            "remaining_ceiling_dzd": remaining_ceiling_dzd,
            "percentage_utilized": round(
                (annual_turnover_dzd / ANAE_ANNUAL_TURNOVER_CEILING_DZD) * 100, 2
            ),
            "is_ceiling_exceeded": is_ceiling_exceeded,
            "ifu_tax_rate": f"{IFU_TAX_RATE_PERCENT}%",
            "ifu_tax_liability_dzd": ifu_tax_liability_dzd,
            "legal_basis": "Loi 22-23 & LF 2024 Art. 282 sexies CIDTA",
        }

        return ToolResult(
            success=True,
            data=data,
            widget_payload={
                "widgetType": "anae_turnover_ceiling_card",
                "fiscalYear": typed_args.fiscal_year,
                "annualTurnoverDzd": annual_turnover_dzd,
                "statutoryCeilingDzd": ANAE_ANNUAL_TURNOVER_CEILING_DZD,
                "percentageUtilized": data["percentage_utilized"],
                "ifuTaxLiabilityDzd": ifu_tax_liability_dzd,
                "isCeilingExceeded": is_ceiling_exceeded,
            },
        )
