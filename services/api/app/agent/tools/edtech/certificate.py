"""
services/api/app/agent/tools/edtech/certificate.py
Tool 7: Verify certificate digital signature and recipient authenticity.
"""

from typing import Any
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.auth import UserRole

from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.agent.context import AgentSecurityContext
from app.services.certificate_service import certificate_service


class VerifyCertificateArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    certificate_id: str = Field(
        ...,
        min_length=5,
        max_length=100,
        description="Certificate public UUID or Podacium credential ID",
    )


class VerifyCertificateTool(BaseTool):
    name = "verify_certificate"
    description = "Publicly verify a Podacium certificate's cryptographic digital signature and legitimacy."
    domain = ToolDomain.EDTECH
    access_roles = [
        UserRole.STUDENT,
        UserRole.BUSINESS,
        UserRole.FREELANCER,
        UserRole.ADMIN,
        UserRole.INSTRUCTOR,
        UserRole.MODERATOR,
    ]
    args_schema = VerifyCertificateArgs

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: VerifyCertificateArgs = args
        verified = await certificate_service.verify_certificate(
            typed_args.certificate_id.strip()
        )

        if not verified or not verified.get("isValid"):
            return ToolResult(
                success=False,
                error=f"Certificate '{typed_args.certificate_id}' is invalid, revoked, or signature does not match.",
                widget_payload={
                    "type": "CertificateInvalid",
                    "certificate_id": typed_args.certificate_id,
                },
            )

        return ToolResult(
            success=True,
            data=verified,
            widget_payload={"type": "VerifiedCertificateCard", "certificate": verified},
        )
