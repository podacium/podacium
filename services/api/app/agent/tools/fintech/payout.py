"""
FinTech Payout Tools: RequestPayoutWithdrawalTool.
"""

from typing import Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.security.pii_cleaner import AlgerianComplianceEngine
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.core.prisma import prisma
from app.schemas.payment import PaymentProvider, PayoutRequest
from app.services.payout_service import payout_service
from app.services.wallet_service import wallet_service


class RequestPayoutWithdrawalArgs(BaseModel):
    amount_dzd: int = Field(
        ge=1000, description="Amount to withdraw in DZD (minimum 1,000 DZD)"
    )
    rip_number: str = Field(
        min_length=10,
        max_length=24,
        description="Algerian CCP / Bank RIP account number (20 digits)",
    )
    account_holder_name: str = Field(
        min_length=3, max_length=100, description="Name of the account holder"
    )


class RequestPayoutWithdrawalTool(BaseTool):
    name = "request_payout_withdrawal"
    description = (
        "Request a fund withdrawal from user wallet to an Algerian CCP (Algérie Poste) or bank account "
        "with ISO 7064 Modulo 97 RIP validation (HITL-gated)."
    )
    domain = ToolDomain.FINTECH
    access_roles = [
        "USER",
        "FREELANCER",
        "CLIENT",
        "ORGANIZATION_MEMBER",
        "ORGANIZATION_ADMIN",
        "ADMIN",
    ]
    is_mutating = True
    requires_hitl = True
    args_schema: Type[BaseModel] = RequestPayoutWithdrawalArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, RequestPayoutWithdrawalArgs)

        user_id = context.user_id
        if not user_id:
            return ToolResult(success=False, error="User context required")

        # 1. Modulo 97 RIP validation
        clean_rip = "".join(filter(str.isdigit, typed_args.rip_number))
        if len(clean_rip) != 20:
            return ToolResult(
                success=False,
                error="Invalid Algerian RIP: Account number must be exactly 20 digits.",
            )
        if not AlgerianComplianceEngine.validate_postal_rip(clean_rip):
            return ToolResult(
                success=False,
                error="Invalid Algerian RIP: ISO 7064 Modulo 97 checksum verification failed.",
            )

        # 2. Check wallet & available balance
        wallet = await wallet_service.get_user_wallet(user_id)
        if not wallet:
            return ToolResult(success=False, error="No wallet found for current user")

        avail_balance = await wallet_service.get_available_balance(wallet.id)
        if avail_balance < typed_args.amount_dzd:
            return ToolResult(
                success=False,
                error=f"Insufficient wallet balance. Available: {avail_balance} DZD, Requested: {typed_args.amount_dzd} DZD",
            )

        # 3. Create payout request
        payout_req = PayoutRequest(
            wallet_id=wallet.id,
            amount=typed_args.amount_dzd,
            method=PaymentProvider.BANK_TRANSFER,
            bank_account_details={
                "rip": clean_rip,
                "account_holder": typed_args.account_holder_name,
            },
        )

        try:
            payout_resp = await payout_service.request_payout(payout_req)
        except Exception as e:
            return ToolResult(success=False, error=f"Payout request failed: {str(e)}")

        async def rollback_payout() -> bool:
            try:
                await prisma.payout.update(
                    where={"id": payout_resp.id},
                    data={"status": "CANCELLED"},
                )
                return True
            except Exception:
                return False

        return ToolResult(
            success=True,
            data={
                "payout_id": payout_resp.id,
                "amount": payout_resp.amount,
                "currency": payout_resp.currency,
                "status": str(payout_resp.status),
                "requested_at": payout_resp.requested_at.isoformat()
                if payout_resp.requested_at
                else None,
            },
            widget_payload={
                "widgetType": "payout_receipt_card",
                "payoutId": payout_resp.id,
                "amount": payout_resp.amount,
                "currency": payout_resp.currency,
                "status": str(payout_resp.status),
                "accountHolder": typed_args.account_holder_name,
            },
            compensating_action=rollback_payout,
        )
