"""
services/api/app/agent/context.py
Zero-Trust Agent Security Context and Inversion of Control (IoC) Injection.
Guarantees caller identity is cryptographically bound from verified JWT sessions,
preventing IDOR and prompt-injection privilege escalation.
"""

from typing import Any, Optional, Set
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import UserRole


class AgentSecurityContext(BaseModel):
    """
    Immutable identity and authorization boundary passed into every tool execution.
    Prevents Prompt-Injection Privilege Escalation and IDOR.
    """

    model_config = ConfigDict(frozen=True, arbitrary_types_allowed=True)

    user_id: int = Field(..., description="Authenticated User ID (Prisma User.id)")
    organization_id: Optional[int] = Field(
        default=None, description="Primary or target Organization ID"
    )
    user_role: UserRole = Field(
        ...,
        description="Active platform role: STUDENT, BUSINESS, FREELANCER, ADMIN, etc.",
    )
    session_id: str = Field(
        default="hitl-session", description="AiSession UUID for trace tracking"
    )
    request_id: str = Field(
        default="req_internal", description="HTTP Request ID for distributed tracing"
    )
    ip_address: Optional[str] = Field(
        default=None, description="Client IP address for audit logs"
    )
    user_agent: Optional[str] = Field(default=None, description="Client User Agent")
    permissions: Set[str] = Field(
        default_factory=set, description="Granted ABAC permission scopes"
    )
    mfa_verified: bool = Field(
        default=False, description="Whether 2FA / WebAuthn is verified for session"
    )
    step_up_token: Optional[str] = Field(
        default=None, description="Cryptographic token for high-risk operations"
    )

    @property
    def role(self) -> UserRole:
        return self.user_role

    def has_role(self, role: Any) -> bool:
        if self.user_role == UserRole.ADMIN:
            return True
        role_str = str(role.value) if hasattr(role, "value") else str(role)
        return self.user_role.value == role_str or role_str == "USER"

    def has_permission(self, permission: str) -> bool:
        """Evaluates role hierarchy and ABAC permission sets."""
        if self.user_role == UserRole.ADMIN:
            return True
        return permission in self.permissions

    def is_staff(self) -> bool:
        """Determines if the caller belongs to internal operational staff."""
        return self.user_role in (
            UserRole.ADMIN,
            UserRole.INSTRUCTOR,
            UserRole.MODERATOR,
        )

    @classmethod
    def from_user(
        cls,
        user: Optional[Any],
        session_id: str = "hitl-session",
        request_origin: str = "direct",
    ) -> "AgentSecurityContext":
        if user is None:
            return cls(
                user_id=0,
                organization_id=None,
                user_role=UserRole.STUDENT,
                session_id=session_id,
                request_id=f"req_{request_origin}",
            )
        role_val = getattr(user, "role", UserRole.STUDENT)
        if isinstance(role_val, str):
            try:
                role_val = UserRole(role_val)
            except Exception:
                role_val = UserRole.STUDENT
        return cls(
            user_id=getattr(user, "id", 0),
            organization_id=getattr(user, "primaryOrganizationId", None)
            or getattr(user, "organization_id", None),
            user_role=role_val,
            session_id=session_id,
            request_id=f"req_{request_origin}",
        )
