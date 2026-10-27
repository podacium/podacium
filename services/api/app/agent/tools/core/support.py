"""
Core Support Tools: GetMyTicketsTool, CreateSupportTicketTool, RequestHumanHandoverTool.
"""

from datetime import datetime, timezone
from typing import Optional, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.core.prisma import prisma
from app.generated.prisma.enums import TicketCategory, TicketPriority, TicketStatus


class GetMyTicketsArgs(BaseModel):
    limit: int = Field(default=10, ge=1, le=50, description="Max tickets to retrieve")


class GetMyTicketsTool(BaseTool):
    name = "get_my_tickets"
    description = "Retrieve the authenticated user's submitted customer support tickets and resolution statuses."
    domain = ToolDomain.CORE
    access_roles = [
        "USER",
        "STUDENT",
        "INSTRUCTOR",
        "FREELANCER",
        "CLIENT",
        "ORGANIZATION_MEMBER",
        "ORGANIZATION_ADMIN",
        "ADMIN",
    ]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = GetMyTicketsArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, GetMyTicketsArgs)

        user_id = context.user_id
        if not user_id:
            return ToolResult(success=False, error="User context required")

        tickets = await prisma.ticket.find_many(
            where={"userId": user_id},
            take=typed_args.limit,
            order={"createdAt": "desc"},
        )

        ticket_list = [
            {
                "id": t.id,
                "ticket_number": t.ticketNumber,
                "subject": t.subject,
                "status": str(t.status),
                "priority": str(t.priority),
                "category": str(t.category),
                "created_at": t.createdAt.isoformat() if t.createdAt else None,
            }
            for t in tickets
        ]

        return ToolResult(
            success=True,
            data=ticket_list,
            widget_payload={
                "widgetType": "support_tickets_list",
                "ticketCount": len(ticket_list),
                "tickets": ticket_list,
            },
        )


class CreateSupportTicketArgs(BaseModel):
    subject: str = Field(
        min_length=5, max_length=150, description="Clear description of the issue"
    )
    category: str = Field(
        default="GENERAL",
        description="Category: GENERAL, BILLING, TECHNICAL, ACCOUNT, COURSE_CONTENT, FREELANCING, BUG_REPORT",
    )
    priority: str = Field(
        default="NORMAL", description="Priority: LOW, NORMAL, HIGH, URGENT"
    )
    description_text: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Additional context or reproduction details",
    )


class CreateSupportTicketTool(BaseTool):
    name = "create_support_ticket"
    description = "Open a formal support ticket for technical bugs, billing issues, or administrative assistance."
    domain = ToolDomain.CORE
    access_roles = [
        "USER",
        "STUDENT",
        "INSTRUCTOR",
        "FREELANCER",
        "CLIENT",
        "ORGANIZATION_MEMBER",
        "ORGANIZATION_ADMIN",
        "ADMIN",
    ]
    is_mutating = True
    requires_hitl = False
    args_schema: Type[BaseModel] = CreateSupportTicketArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, CreateSupportTicketArgs)

        user_id = context.user_id
        if not user_id:
            return ToolResult(success=False, error="User context required")

        try:
            cat = TicketCategory(typed_args.category.upper())
        except Exception:
            cat = TicketCategory.GENERAL

        try:
            prio = TicketPriority(typed_args.priority.upper())
        except Exception:
            prio = TicketPriority.NORMAL

        ticket = await prisma.ticket.create(
            data={
                "userId": user_id,
                "subject": typed_args.subject,
                "category": cat,
                "priority": prio,
                "status": TicketStatus.OPEN,
                "metadata": {"initial_description": typed_args.description_text}
                if typed_args.description_text
                else {},
                "tags": ["agent-created"],
            }
        )

        async def rollback_ticket() -> bool:
            try:
                await prisma.ticket.update(
                    where={"id": ticket.id},
                    data={
                        "status": TicketStatus.CLOSED,
                        "closedAt": datetime.now(timezone.utc),
                    },
                )
                return True
            except Exception:
                return False

        return ToolResult(
            success=True,
            data={
                "ticket_id": ticket.id,
                "ticket_number": ticket.ticketNumber,
                "subject": ticket.subject,
                "status": str(ticket.status),
                "priority": str(ticket.priority),
            },
            widget_payload={
                "widgetType": "support_ticket_created_card",
                "ticketId": ticket.id,
                "ticketNumber": ticket.ticketNumber,
                "subject": ticket.subject,
            },
            compensating_action=rollback_ticket,
        )


class RequestHumanHandoverArgs(BaseModel):
    reason: str = Field(
        min_length=5,
        max_length=300,
        description="Reason human agent intervention is requested",
    )


class RequestHumanHandoverTool(BaseTool):
    name = "request_human_handover"
    description = (
        "Escalate the current interaction to a human support agent with high priority, "
        "logging the session trace for expedited manual resolution."
    )
    domain = ToolDomain.CORE
    access_roles = [
        "USER",
        "STUDENT",
        "INSTRUCTOR",
        "FREELANCER",
        "CLIENT",
        "ORGANIZATION_MEMBER",
        "ORGANIZATION_ADMIN",
        "ADMIN",
    ]
    is_mutating = True
    requires_hitl = False
    args_schema: Type[BaseModel] = RequestHumanHandoverArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, RequestHumanHandoverArgs)

        user_id = context.user_id
        if not user_id:
            return ToolResult(success=False, error="User context required")

        # Create URGENT handover ticket
        ticket = await prisma.ticket.create(
            data={
                "userId": user_id,
                "subject": f"[HUMAN HANDOVER REQUEST] {typed_args.reason[:80]}",
                "category": TicketCategory.GENERAL,
                "priority": TicketPriority.URGENT,
                "status": TicketStatus.OPEN,
                "metadata": {
                    "handover_reason": typed_args.reason,
                    "escalated_from_agent": True,
                },
                "tags": ["human-handover", "urgent"],
            }
        )

        async def rollback_handover() -> bool:
            try:
                await prisma.ticket.update(
                    where={"id": ticket.id},
                    data={"status": TicketStatus.CLOSED},
                )
                return True
            except Exception:
                return False

        return ToolResult(
            success=True,
            data={
                "escalated": True,
                "ticket_number": ticket.ticketNumber,
                "sla": "Within 2 business hours (Priority Escalation)",
                "status": "QUEUED_FOR_AGENT",
            },
            widget_payload={
                "widgetType": "human_handover_card",
                "ticketNumber": ticket.ticketNumber,
                "status": "QUEUED_FOR_AGENT",
                "sla": "Within 2 business hours",
                "reason": typed_args.reason,
            },
            compensating_action=rollback_handover,
        )
