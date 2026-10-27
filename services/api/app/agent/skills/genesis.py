"""
services/api/app/agent/skills/genesis.py
Autonomous Self-Evolving Skill Genesis Engine (Leap 10).

Dynamic Tool Generation with Strict AST Security Validation:
1. AST parsing and static security policy enforcement (forbidding unsafe builtins, system calls, and blacklisted imports).
2. Restricted runtime compilation and execution sandbox.
3. Hot-loading and registration into Podacium's singleton `tool_registry`.
4. Life-cycle management: dynamic versioning, registration auditing, and rollback support.
"""

from __future__ import annotations

import ast
import inspect
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from pydantic import BaseModel, Field

from app.agent.tools.base import BaseTool, ToolResult, ToolDomain
from app.agent.context import AgentSecurityContext
from app.schemas.auth import UserRole

logger = logging.getLogger("podacium.agent.skills.genesis")


class SecurityViolationException(Exception):
    """Raised when dynamically generated tool code violates AST security policies."""

    pass


class DynamicToolMetadata(BaseModel):
    name: str
    description: str
    domain: str
    class_name: str
    source_code: str
    registered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    author_agent: str = "SkillGenesisEngine"


# =============================================================================
# 1. AST SECURITY VALIDATOR
# =============================================================================


class ASTSecurityValidator(ast.NodeVisitor):
    """
    Static AST security auditor for dynamically generated tool code.
    Enforces a strict sandbox policy:
    - Blocks unsafe system modules (os, sys, subprocess, shutil, socket, ctypes, etc.).
    - Blocks dangerous builtins (eval, exec, __import__, compile, open, globals, locals).
    - Blocks dunder attribute escapes (__class__, __subclasses__, __bases__, __globals__, etc.).
    - Ensures adherence to Podacium BaseTool structural contract.
    """

    FORBIDDEN_MODULES: Set[str] = {
        "os",
        "sys",
        "subprocess",
        "shutil",
        "socket",
        "pty",
        "posix",
        "resource",
        "ctypes",
        "builtins",
        "importlib",
        "pickle",
        "signal",
        "threading",
        "multiprocessing",
        "gc",
        "inspect",
        "code",
        "pdb",
        "pip",
        "site",
        "_thread",
    }

    FORBIDDEN_CALLS: Set[str] = {
        "eval",
        "exec",
        "__import__",
        "compile",
        "open",
        "globals",
        "locals",
        "exit",
        "quit",
        "breakpoint",
        "input",
        "memoryview",
    }

    FORBIDDEN_ATTRIBUTES: Set[str] = {
        "__class__",
        "__subclasses__",
        "__bases__",
        "__base__",
        "__mro__",
        "__dict__",
        "__globals__",
        "__code__",
        "__closure__",
        "__builtins__",
        "__loader__",
        "__spec__",
    }

    def __init__(self):
        self.violations: List[str] = []
        self.has_basetool_subclass: bool = False
        self.has_args_schema: bool = False
        self.has_execute_method: bool = False
        self.discovered_tool_class: Optional[str] = None
        self.discovered_schema_class: Optional[str] = None

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            base_mod = alias.name.split(".")[0]
            if base_mod in self.FORBIDDEN_MODULES:
                self.violations.append(
                    f"FORBIDDEN_IMPORT: Import of unsafe module '{alias.name}' is prohibited."
                )
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module:
            base_mod = node.module.split(".")[0]
            if base_mod in self.FORBIDDEN_MODULES:
                self.violations.append(
                    f"FORBIDDEN_IMPORT_FROM: Import from unsafe module '{node.module}' is prohibited."
                )
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        # Check call by name (e.g. eval(...))
        if isinstance(node.func, ast.Name):
            if node.func.id in self.FORBIDDEN_CALLS:
                self.violations.append(
                    f"FORBIDDEN_CALL: Invocation of unsafe builtin function '{node.func.id}()' is prohibited."
                )
        # Check call on attributes (e.g. obj.__subclasses__())
        elif isinstance(node.func, ast.Attribute):
            if (
                node.func.attr in self.FORBIDDEN_CALLS
                or node.func.attr in self.FORBIDDEN_ATTRIBUTES
            ):
                self.violations.append(
                    f"FORBIDDEN_METHOD_CALL: Invocation of protected attribute '{node.func.attr}' is prohibited."
                )
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if node.attr in self.FORBIDDEN_ATTRIBUTES:
            self.violations.append(
                f"FORBIDDEN_ATTRIBUTE: Access to private/dunder attribute '{node.attr}' is prohibited."
            )
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        # Check base classes
        for base in node.bases:
            base_name = getattr(base, "id", None) or getattr(base, "attr", None)
            if base_name in ("BaseTool", "app.agent.tools.base.BaseTool"):
                self.has_basetool_subclass = True
                self.discovered_tool_class = node.name
            elif base_name in ("BaseModel", "pydantic.BaseModel"):
                self.has_args_schema = True
                self.discovered_schema_class = node.name

        # Check methods in class
        for item in node.body:
            if isinstance(item, ast.AsyncFunctionDef) and item.name == "execute":
                self.has_execute_method = True

        self.generic_visit(node)

    def validate(self, tree: ast.AST) -> Tuple[bool, List[str]]:
        self.visit(tree)

        if not self.has_basetool_subclass:
            self.violations.append(
                "MISSING_BASE_TOOL: Dynamically generated code must define a class inheriting from 'BaseTool'."
            )
        if not self.has_execute_method:
            self.violations.append(
                "MISSING_EXECUTE_METHOD: Tool class must implement 'async def execute(self, args, context)'."
            )

        is_safe = len(self.violations) == 0
        return is_safe, self.violations


# =============================================================================
# 2. SKILL GENESIS ENGINE
# =============================================================================


class SkillGenesisEngine:
    """
    Autonomous tool synthesis and dynamic hot-loading engine.
    Safely validates candidate Python AST, compiles bytecode in a sandbox,
    and hot-loads verified tools into `tool_registry`.
    """

    def __init__(self, registry: Optional[Any] = None):
        self._registry = registry
        self._dynamic_tools: Dict[str, DynamicToolMetadata] = {}

    @property
    def registry(self) -> Any:
        if self._registry is None:
            from app.agent.tools.registry import tool_registry

            self._registry = tool_registry
        return self._registry

    def validate_code_security(
        self, code_str: str
    ) -> Tuple[bool, List[str], Optional[str]]:
        """
        Parses candidate Python code into an AST and executes strict security auditing.
        Returns: (is_safe, list_of_violations, discovered_tool_class_name).
        """
        try:
            tree = ast.parse(code_str, filename="<skill_genesis_ast>")
        except SyntaxError as syn_err:
            return False, [f"SYNTAX_ERROR: {str(syn_err)}"], None

        validator = ASTSecurityValidator()
        is_safe, violations = validator.validate(tree)
        return is_safe, violations, validator.discovered_tool_class

    def compile_and_instantiate(self, code_str: str) -> BaseTool:
        """
        Validates AST, compiles code, executes within restricted globals,
        and returns an initialized BaseTool instance.
        """
        is_safe, violations, class_name = self.validate_code_security(code_str)
        if not is_safe or not class_name:
            err_msg = f"Security audit failed with {len(violations)} violations: {'; '.join(violations)}"
            logger.error(err_msg)
            raise SecurityViolationException(err_msg)

        # Restricted execution globals: all normal builtins except forbidden calls
        import builtins

        safe_builtins = {
            k: v
            for k, v in vars(builtins).items()
            if k not in ASTSecurityValidator.FORBIDDEN_CALLS
        }

        def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
            base_mod = name.split(".")[0]
            if base_mod in ASTSecurityValidator.FORBIDDEN_MODULES:
                raise SecurityViolationException(
                    f"Import of forbidden module '{name}' blocked."
                )
            return __import__(name, globals, locals, fromlist, level)

        safe_builtins["__import__"] = safe_import

        exec_scope: Dict[str, Any] = {
            "__name__": "__main__",
            "__doc__": None,
            "__package__": None,
            "__builtins__": safe_builtins,
            "BaseTool": BaseTool,
            "BaseModel": BaseModel,
            "Field": Field,
            "ToolResult": ToolResult,
            "ToolDomain": ToolDomain,
            "AgentSecurityContext": AgentSecurityContext,
            "UserRole": UserRole,
            "datetime": datetime,
            "timezone": timezone,
            "Optional": Optional,
            "Dict": Dict,
            "List": List,
            "Any": Any,
        }

        try:
            compiled_code = compile(
                code_str, filename=f"<dynamic_skill_{class_name}>", mode="exec"
            )
            exec(compiled_code, exec_scope)
        except Exception as exec_err:
            logger.exception(
                "Failed to compile and execute dynamic tool bytecode: %s", exec_err
            )
            raise ValueError(f"Bytecode execution error: {exec_err}") from exec_err

        tool_class = exec_scope.get(class_name)
        if (
            not tool_class
            or not inspect.isclass(tool_class)
            or not issubclass(tool_class, BaseTool)
        ):
            raise ValueError(
                f"Target class '{class_name}' is not a valid BaseTool subclass."
            )

        try:
            tool_instance: BaseTool = tool_class()
        except Exception as init_err:
            raise ValueError(
                f"Failed to instantiate tool class '{class_name}': {init_err}"
            ) from init_err

        return tool_instance

    def hot_load_tool(
        self, tool_instance: BaseTool, source_code: str = ""
    ) -> DynamicToolMetadata:
        """
        Hot-loads an instantiated and verified dynamic tool into the global singleton `tool_registry`.
        """
        self.registry.register(tool_instance)

        meta = DynamicToolMetadata(
            name=tool_instance.name,
            description=tool_instance.description,
            domain=tool_instance.domain.value
            if hasattr(tool_instance.domain, "value")
            else str(tool_instance.domain),
            class_name=tool_instance.__class__.__name__,
            source_code=source_code,
            is_active=True,
        )
        self._dynamic_tools[tool_instance.name] = meta
        logger.info(
            "Dynamically generated skill '%s' (%s) successfully hot-loaded into tool_registry.",
            tool_instance.name,
            meta.domain,
        )
        return meta

    def validate_and_load(self, code_str: str) -> BaseTool:
        """
        End-to-end pipeline: security audit -> compilation -> instantiation -> hot-loading.
        """
        tool_instance = self.compile_and_instantiate(code_str)
        self.hot_load_tool(tool_instance, source_code=code_str)
        return tool_instance

    def unregister_dynamic_tool(self, name: str) -> bool:
        """
        Rollback/un-register a dynamically hot-loaded tool from tool_registry.
        """
        tool = self.registry.get_tool(name)
        if not tool:
            return False

        # Remove from global name map
        self.registry._tools_by_name.pop(name, None)
        # Remove from domain map
        if tool.domain in self.registry._tools_by_domain:
            self.registry._tools_by_domain[tool.domain].pop(name, None)

        if name in self._dynamic_tools:
            self._dynamic_tools[name].is_active = False

        logger.info(
            "Dynamic skill '%s' unregistered successfully from tool_registry.", name
        )
        return True

    def list_dynamic_tools(self) -> List[DynamicToolMetadata]:
        """Returns all dynamically registered tools and their audit status."""
        return list(self._dynamic_tools.values())

    @staticmethod
    def generate_tool_scaffold(
        tool_name: str,
        class_name: str,
        description: str,
        domain: ToolDomain,
        parameter_definitions: Dict[str, str],
        execution_body: str,
    ) -> str:
        """
        Synthesizes compliant Python code string for a new BaseTool subclass.
        """
        param_fields = []
        for p_name, p_type in parameter_definitions.items():
            param_fields.append(
                f"    {p_name}: {p_type} = Field(..., description='Input parameter {p_name}')"
            )

        fields_code = "\n".join(param_fields) if param_fields else "    pass"
        domain_val = domain.value if hasattr(domain, "value") else str(domain)

        return f"""from app.agent.tools.base import BaseTool, ToolResult, ToolDomain
from app.agent.context import AgentSecurityContext
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

class {class_name}Args(BaseModel):
{fields_code}

class {class_name}(BaseTool):
    name: str = "{tool_name}"
    description: str = "{description}"
    domain: ToolDomain = ToolDomain.{domain_val}
    args_schema: type[BaseModel] = {class_name}Args
    is_mutating: bool = False
    requires_hitl: bool = False

    async def execute(self, args: {class_name}Args, context: AgentSecurityContext) -> ToolResult:
{execution_body}
"""


# Global singleton genesis engine instance
skill_genesis_engine = SkillGenesisEngine()
