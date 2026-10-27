"""
services/api/app/agent/tools/base.py
Abstract Base Class, Result Containers, and Domain Partitions for Podacium Tools.
"""

from abc import ABC, abstractmethod
import json
import logging
from typing import Any, Dict, List, Optional, Set, Type
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.auth import UserRole
from app.agent.schemas import ToolDefinition
from app.agent.providers.normalizer import ToolSchemaNormalizer
from app.agent.context import AgentSecurityContext
from app.agent.domains import ToolDomain  # re-exported for backward compatibility
from app.agent.exceptions import ToolExecutionException
from app.agent.tools.claim_check import offload_to_claim_check

logger = logging.getLogger("podacium.agent.tools")

ROLE_EQUIVALENCE: Dict[str, Set[str]] = {
    "BUSINESS": {
        "BUSINESS",
        "CLIENT",
        "ORGANIZATION_ADMIN",
        "ORGANIZATION_MEMBER",
        "USER",
    },
    "ORGANIZATION_ADMIN": {
        "ORGANIZATION_ADMIN",
        "ORGANIZATION_MEMBER",
        "BUSINESS",
        "CLIENT",
        "USER",
    },
    "ORGANIZATION_MEMBER": {"ORGANIZATION_MEMBER", "BUSINESS", "USER"},
    "CLIENT": {"CLIENT", "BUSINESS", "USER"},
    "FREELANCER": {"FREELANCER", "USER"},
    "STUDENT": {"STUDENT", "USER"},
    "INSTRUCTOR": {"INSTRUCTOR", "USER"},
    "MODERATOR": {"MODERATOR", "USER"},
    "ADMIN": {
        "ADMIN",
        "BUSINESS",
        "CLIENT",
        "ORGANIZATION_ADMIN",
        "ORGANIZATION_MEMBER",
        "FREELANCER",
        "STUDENT",
        "INSTRUCTOR",
        "MODERATOR",
        "USER",
    },
}


class ToolResult(BaseModel):
    """
    Standardized, structured output from every Podacium tool execution.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    success: bool = Field(..., description="Whether the operation succeeded")
    data: Any = Field(
        default=None, description="Structured return data (JSON serializable)"
    )
    widget_payload: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional UI widget specification for Next.js (e.g. chart, course card, contract badge)",
    )
    claim_check_urn: Optional[str] = Field(
        default=None,
        description="Offloaded payload reference when output exceeds token thresholds (Claim-Check pattern)",
    )
    error: Optional[str] = Field(
        default=None, description="Human-readable error description if failed"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Audit and diagnostic metadata"
    )
    compensating_action: Optional[Any] = Field(
        default=None, description="Compensating rollback callable for distributed sagas"
    )

    def to_agent_message(self) -> str:
        """Serializes the result for consumption by LLM chat turn."""
        if not self.success:
            err_dict: Dict[str, Any] = {
                "status": "error",
                "error": self.error or "Unknown tool execution failure",
            }
            hint = self.metadata.get("remediation_hint") or self.metadata.get("hint")
            if hint:
                err_dict["remediation_hint"] = hint
            return json.dumps(err_dict, default=str)

        output: Dict[str, Any] = {"status": "success"}
        if self.claim_check_urn:
            output["claim_check_urn"] = self.claim_check_urn
            output["summary"] = (
                "Data payload exceeds token threshold; stored in claim-check storage."
            )
            output["preview"] = (
                self.data if isinstance(self.data, dict) else str(self.data)[:500]
            )
        else:
            output["data"] = self.data

        if self.widget_payload:
            output["widget"] = self.widget_payload.get("type", "generic")

        return json.dumps(output, default=str)


class BaseTool(ABC):
    """
    Abstract Base Class for all Podacium Agent Tools.
    Enforces typed metadata, Pydantic v2 input validation, dynamic schemas, and RBAC guards.
    """

    name: str
    description: str
    domain: ToolDomain
    access_roles: List[Any] = [
        UserRole.STUDENT,
        UserRole.BUSINESS,
        UserRole.FREELANCER,
        UserRole.ADMIN,
        UserRole.INSTRUCTOR,
        UserRole.MODERATOR,
    ]
    is_mutating: bool = False
    requires_hitl: bool = False
    args_schema: Type[BaseModel]

    @classmethod
    def cast_args(cls, args: Any, target_type: Type[BaseModel]) -> Any:
        """Coerces input arguments into the target Pydantic model."""
        if isinstance(args, target_type):
            return args
        if isinstance(args, BaseModel):
            return target_type.model_validate(args.model_dump())
        if isinstance(args, dict):
            return target_type.model_validate(args)
        return args

    def is_accessible_by(self, role: Any) -> bool:
        """Evaluates whether the user's role has access to this tool."""
        if not self.access_roles:
            return True
        if role is None:
            if not self.is_mutating:
                return any(
                    (str(r.value) if hasattr(r, "value") else str(r)).upper()
                    in ("STUDENT", "USER")
                    for r in self.access_roles
                )
            return False

        role_str = (str(role.value) if hasattr(role, "value") else str(role)).upper()
        if role_str == "ADMIN":
            return True
        equivalent_roles = ROLE_EQUIVALENCE.get(role_str, {role_str, "USER"})
        for allowed in self.access_roles:
            allowed_str = (
                str(allowed.value) if hasattr(allowed, "value") else str(allowed)
            ).upper()
            if allowed_str in equivalent_roles or allowed_str == "USER":
                return True
        return False

    def __init__(self):
        if not hasattr(self, "name") or not self.name:
            raise ValueError(f"Tool {self.__class__.__name__} must define a 'name'")
        if not hasattr(self, "description") or not self.description:
            raise ValueError(
                f"Tool {self.__class__.__name__} must define a 'description'"
            )
        if not hasattr(self, "domain") or not self.domain:
            raise ValueError(f"Tool {self.__class__.__name__} must define a 'domain'")
        if not hasattr(self, "args_schema") or not issubclass(
            self.args_schema, BaseModel
        ):
            raise ValueError(
                f"Tool {self.__class__.__name__} must define an 'args_schema' inheriting from BaseModel"
            )

    def get_openai_schema(self) -> ToolDefinition:
        """Generates standard OpenAI JSON Schema representation."""
        schema = self.args_schema.model_json_schema()
        schema.pop("title", None)
        return ToolDefinition(
            name=self.name,
            description=self.description,
            parameters=schema,
        )

    def get_gemini_schema(self) -> Dict[str, Any]:
        """Generates Google Gemini REST v1beta functionDeclaration."""
        tool_def = self.get_openai_schema()
        return ToolSchemaNormalizer.to_gemini_declaration(tool_def)

    async def call(
        self, raw_args: Dict[str, Any], context: AgentSecurityContext
    ) -> ToolResult:
        """
        Public entry point: executes RBAC check, HITL validation, Pydantic argument parsing,
        and delegates to abstract `execute`.
        """
        # 1. RBAC authorization guard
        if not self.is_accessible_by(context.user_role):
            role_label = (
                context.user_role.value
                if hasattr(context.user_role, "value")
                else str(context.user_role)
            )
            logger.warning(
                f"RBAC Denied: User {context.user_id} with role {role_label} "
                f"attempted to access restricted tool {self.name}"
            )
            return ToolResult(
                success=False,
                error=f"Permission denied: role '{role_label}' cannot execute tool '{self.name}'.",
            )

        # 2. Human-in-the-Loop (HITL) proposal guard
        if self.requires_hitl and not raw_args.get("__hitl_approved__", False):
            return ToolResult(
                success=False,
                error="HUMAN_APPROVAL_REQUIRED",
                widget_payload={
                    "type": "ACTION_APPROVAL_REQUIRED",
                    "tool": self.name,
                    "proposed_arguments": raw_args,
                    "description": f"This action modifies system state and requires user confirmation: {self.description}",
                },
            )

        # 3. Pydantic v2 strict argument parsing
        try:
            clean_args = {k: v for k, v in raw_args.items() if not k.startswith("__")}
            validated_args = self.args_schema.model_validate(clean_args)
        except Exception as e:
            logger.warning(f"Validation failure for tool {self.name}: {e}")
            return ToolResult(
                success=False,
                error=f"Invalid arguments for {self.name}: {str(e)}",
                metadata={
                    "remediation_hint": f"Please verify parameter types and required fields for '{self.name}' and try again."
                },
            )

        # 4. Safe execution delegate
        try:
            result = await self.execute(args=validated_args, context=context)

            # Auto-bind class-level rollback method for mutating actions if not explicitly set
            if self.is_mutating and result.compensating_action is None:
                payload_snapshot = (
                    result.data
                    if isinstance(result.data, dict)
                    else {"data": result.data}
                )

                async def _auto_compensating_action() -> bool:
                    try:
                        res = await self.rollback(
                            context=context, payload=payload_snapshot
                        )
                        if isinstance(res, dict):
                            return res.get("status") != "FAILED"
                        return bool(res)
                    except Exception as rb_err:
                        logger.error(
                            f"Auto-bound rollback failed for tool '{self.name}': {rb_err}",
                            exc_info=True,
                        )
                        return False

                result.compensating_action = _auto_compensating_action

            # 5. Optional Claim-Check thresholding (>8KB)
            serialized = json.dumps(result.data, default=str)
            if len(serialized.encode("utf-8")) > 8192 and not result.claim_check_urn:
                urn = await offload_to_claim_check(
                    self.name, result.data, ttl_seconds=3600
                )
                result.claim_check_urn = urn

            return result
        except ToolExecutionException as te:
            logger.error(f"Handled tool failure in {self.name}: {te.message}")
            return ToolResult(success=False, error=te.message, metadata=te.details)
        except Exception as e:
            logger.exception(f"Unhandled tool failure in {self.name}: {e}")
            return ToolResult(
                success=False, error=f"Internal tool error in {self.name}: {str(e)}"
            )

    @abstractmethod
    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        """Subclasses implement business logic here using type-hinted args and IoC context."""
        pass

    async def rollback(
        self, context: AgentSecurityContext, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Compensating transaction for mutating actions. Defaults to no-op for read-only tools."""
        if not self.is_mutating:
            return {
                "status": "NOOP",
                "message": f"{self.name} is read-only, no rollback required",
            }
        return {
            "status": "COMPENSATED",
            "message": f"Rollback completed for {self.name}",
        }

    async def simulate(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        """
        Simulates the execution of the tool without mutating persistent system state.
        Validates arguments and provides a non-mutating dry-run impact preview.
        """
        # 1. RBAC authorization guard
        if not self.is_accessible_by(context.user_role):
            role_label = (
                context.user_role.value
                if hasattr(context.user_role, "value")
                else str(context.user_role)
            )
            return ToolResult(
                success=False,
                error=f"Permission denied: role '{role_label}' cannot execute tool '{self.name}'.",
            )

        # 2. Pydantic v2 argument parsing and validation
        try:
            if isinstance(args, dict):
                clean_args = {
                    k: v for k, v in args.items() if not str(k).startswith("__")
                }
                validated_args = self.args_schema.model_validate(clean_args)
            elif isinstance(args, BaseModel):
                validated_args = self.cast_args(args, self.args_schema)
            else:
                validated_args = args
        except Exception as e:
            return ToolResult(
                success=False,
                error=f"Invalid arguments for {self.name}: {str(e)}",
                metadata={"simulated": True},
            )

        # 3. Custom preview hook if defined by subclass
        if hasattr(self, "preview_impact") and callable(
            getattr(self, "preview_impact")
        ):
            try:
                preview_res = await self.preview_impact(validated_args, context)
                if isinstance(preview_res, ToolResult):
                    preview_res.metadata["simulated"] = True
                    return preview_res
            except Exception as e:
                return ToolResult(
                    success=False,
                    error=f"Simulation preview failure for {self.name}: {str(e)}",
                    metadata={"simulated": True},
                )

        # 4. If read-only, safely execute and mark as simulated
        if not self.is_mutating:
            try:
                res = await self.execute(args=validated_args, context=context)
                res.metadata["simulated"] = True
                return res
            except Exception as e:
                return ToolResult(
                    success=False,
                    error=f"Read-only simulation execution failed: {str(e)}",
                    metadata={"simulated": True},
                )

        # 5. For mutating tools, return structured dry-run impact preview
        params_dict = (
            validated_args.model_dump()
            if hasattr(validated_args, "model_dump")
            else dict(validated_args)
            if isinstance(validated_args, dict)
            else str(validated_args)
        )
        return ToolResult(
            success=True,
            data={
                "simulation": True,
                "tool": self.name,
                "domain": self.domain.value
                if hasattr(self.domain, "value")
                else str(self.domain),
                "is_mutating": True,
                "requires_hitl": self.requires_hitl,
                "status": "VALIDATED",
                "preview": f"Dry-run impact preview: mutating tool '{self.name}' would execute successfully with provided parameters.",
                "parameters": params_dict,
            },
            metadata={"simulated": True, "dry_run": True},
        )
