"""
FinTech Promo Voucher Tools: ApplyPromoVoucherTool.
"""

from typing import Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.core.prisma import prisma
from app.services.promo_code_service import promo_code_service


class ApplyPromoVoucherArgs(BaseModel):
    promo_code: str = Field(
        min_length=3, max_length=50, description="Voucher or promotion code"
    )
    order_amount_dzd: int = Field(
        gt=0, description="Original total order amount in DZD"
    )


class ApplyPromoVoucherTool(BaseTool):
    name = "apply_promo_voucher"
    description = "Validate and apply a promotional voucher discount to a course or subscription purchase."
    domain = ToolDomain.FINTECH
    access_roles = [
        "USER",
        "STUDENT",
        "CLIENT",
        "ORGANIZATION_MEMBER",
        "ORGANIZATION_ADMIN",
        "ADMIN",
    ]
    is_mutating = True
    requires_hitl = False
    args_schema: Type[BaseModel] = ApplyPromoVoucherArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, ApplyPromoVoucherArgs)

        user_id = context.user_id
        if not user_id:
            return ToolResult(success=False, error="User context required")

        try:
            result = await promo_code_service.validate_and_apply(
                code=typed_args.promo_code.strip().upper(),
                user_id=user_id,
                amount=typed_args.order_amount_dzd,
            )
        except Exception as e:
            return ToolResult(
                success=False, error=f"Invalid or expired promo voucher: {str(e)}"
            )

        async def rollback_voucher() -> bool:
            try:
                promo = await prisma.promocode.find_first(
                    where={"code": typed_args.promo_code.strip().upper()}
                )
                if promo and promo.redemptionCount > 0:
                    await prisma.promocode.update(
                        where={"id": promo.id},
                        data={"redemptionCount": promo.redemptionCount - 1},
                    )
                return True
            except Exception:
                return False

        savings = result.original_amount - result.discounted_amount

        return ToolResult(
            success=True,
            data={
                "code": result.code,
                "original_amount": result.original_amount,
                "discount_savings": savings,
                "final_amount": result.discounted_amount,
                "discount_type": result.discount_type,
            },
            widget_payload={
                "widgetType": "voucher_applied_card",
                "code": result.code,
                "originalAmount": result.original_amount,
                "discountSavings": savings,
                "finalAmount": result.discounted_amount,
            },
            compensating_action=rollback_voucher,
        )
