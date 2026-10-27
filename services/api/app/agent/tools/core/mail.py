"""
Core Mail Tools: SendCorporateMailTool.
"""

from typing import List, Optional, Type
from pydantic import BaseModel, EmailStr, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.schemas.mail import ComposeEmailRequest
from app.services.mail_suite_service import mail_suite_service
from app.core.prisma import prisma


class SendCorporateMailArgs(BaseModel):
    to_addresses: List[EmailStr] = Field(
        min_length=1, description="Recipient email addresses"
    )
    subject: str = Field(min_length=2, max_length=200, description="Email subject line")
    body_text: str = Field(min_length=5, description="Plaintext email message content")
    account_id: Optional[str] = Field(
        default=None, description="Optional corporate mail account UUID"
    )


class SendCorporateMailTool(BaseTool):
    name = "send_corporate_mail"
    description = (
        "Send an official corporate email through Podacium MailSuite (HITL-gated). "
        "Strictly requires user confirmation before sending external correspondence."
    )
    domain = ToolDomain.CORE
    access_roles = ["ORGANIZATION_ADMIN", "ADMIN"]
    is_mutating = True
    requires_hitl = True
    args_schema: Type[BaseModel] = SendCorporateMailArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, SendCorporateMailArgs)

        user_id = context.user_id
        if not user_id:
            return ToolResult(success=False, error="User context required")

        account_id = typed_args.account_id
        if not account_id:
            accessible_accounts = await mail_suite_service.list_accessible_accounts(
                user_id
            )
            if context.organization_id:
                org_accounts = await prisma.mailaccount.find_many(
                    where={
                        "organizationId": context.organization_id,
                        "deletedAt": None,
                    }
                )
                org_account_ids = {a.accountId for a in org_accounts}
                accessible_accounts = [
                    a for a in accessible_accounts if a.account_id in org_account_ids
                ]

            if not accessible_accounts:
                return ToolResult(
                    success=False,
                    error="No configured corporate email account found for your user/organization.",
                )
            account_id = accessible_accounts[0].account_id
        elif context.organization_id:
            # Prevent cross-org email transmission if account_id explicitly provided
            acc = await prisma.mailaccount.find_first(
                where={
                    "accountId": account_id,
                    "organizationId": context.organization_id,
                    "deletedAt": None,
                }
            )
            if not acc:
                return ToolResult(
                    success=False,
                    error="Unauthorized access: corporate email account does not belong to your organization.",
                )

        # The agent path must enforce the same mailbox permissions as the HTTP
        # router; previously it only checked organization membership.
        if not await mail_suite_service.check_account_permission(
            account_id, user_id, required="send"
        ):
            return ToolResult(
                success=False,
                error=(
                    "Unauthorized access: you do not have send permission for "
                    "this corporate email account."
                ),
            )

        compose_req = ComposeEmailRequest(
            account_id=account_id,
            to_addresses=typed_args.to_addresses,
            subject=typed_args.subject,
            body_text=typed_args.body_text,
        )

        try:
            sent_msg = await mail_suite_service.send_email(
                data=compose_req,
                current_admin_id=user_id,
            )
        except Exception as e:
            return ToolResult(
                success=False, error=f"Failed to dispatch email: {str(e)}"
            )

        return ToolResult(
            success=True,
            data={
                "message_id": sent_msg.message_id,
                "to": [str(x) for x in typed_args.to_addresses],
                "subject": typed_args.subject,
                "status": "SENT",
            },
            widget_payload={
                "widgetType": "corporate_mail_sent_card",
                "messageId": sent_msg.message_id,
                "to": [str(x) for x in typed_args.to_addresses],
                "subject": typed_args.subject,
            },
        )
