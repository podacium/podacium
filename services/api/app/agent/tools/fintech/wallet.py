"""
FinTech Wallet Tools: GetWalletBalanceTool.
"""

from typing import Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.services.wallet_service import wallet_service


class GetWalletBalanceArgs(BaseModel):
    include_recent_transactions: bool = Field(
        default=True, description="Whether to include recent transactions in response"
    )


class GetWalletBalanceTool(BaseTool):
    name = "get_wallet_balance"
    description = (
        "Retrieve current wallet balance in DZD, escrow holds, and transaction history."
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
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = GetWalletBalanceArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, GetWalletBalanceArgs)

        wallet_resp = None
        if context.organization_id:
            wallet_resp = await wallet_service.get_organization_wallet(
                context.organization_id
            )
        if not wallet_resp and context.user_id:
            wallet_resp = await wallet_service.get_user_wallet(context.user_id)

        if not wallet_resp:
            return ToolResult(
                success=True,
                data={
                    "balance": 0,
                    "currency": "DZD",
                    "escrow_balance": 0,
                    "is_locked": False,
                    "transactions": [],
                },
                widget_payload={
                    "widgetType": "wallet_balance_card",
                    "balance": 0,
                    "currency": "DZD",
                    "escrowBalance": 0,
                },
            )

        transactions_data = []
        if typed_args.include_recent_transactions:
            try:
                txs = await wallet_service.get_wallet_transactions(
                    wallet_resp.id, limit=5
                )
                transactions_data = [
                    {
                        "id": t.id,
                        "amount": t.amount,
                        "purpose": str(t.purpose),
                        "status": str(t.status),
                        "created_at": t.created_at.isoformat()
                        if t.created_at
                        else None,
                    }
                    for t in txs
                ]
            except Exception:
                pass

        available_balance = await wallet_service.get_available_balance(wallet_resp.id)

        return ToolResult(
            success=True,
            data={
                "wallet_id": wallet_resp.id,
                "balance": available_balance,
                "currency": wallet_resp.currency,
                "poda_points": wallet_resp.poda_points,
                "is_active": wallet_resp.is_active,
                "recent_transactions": transactions_data,
            },
            widget_payload={
                "widgetType": "wallet_balance_card",
                "walletId": wallet_resp.id,
                "balance": available_balance,
                "currency": wallet_resp.currency,
                "podaPoints": wallet_resp.poda_points,
                "recentTransactions": transactions_data,
            },
        )
