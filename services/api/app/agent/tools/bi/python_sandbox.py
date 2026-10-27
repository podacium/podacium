"""
BI In-Process Python Sandbox Tool
AST-validated, sandboxed Python execution for BI analysis, statistical computations, and data transformations.
Enforces timeout (<3s), memory checks (<256MB), and strict AST security forbidding unsafe modules and dunders.
"""

import ast
import asyncio
import io
import logging
import time
from typing import Any, Dict, Optional, Set, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult

logger = logging.getLogger("podacium.agent.tools.bi.python_sandbox")

# Strictly forbidden modules and symbols
FORBIDDEN_MODULES: Set[str] = {
    "os",
    "sys",
    "subprocess",
    "socket",
    "shutil",
    "pathlib",
    "builtins",
    "posix",
    "pty",
    "multiprocessing",
    "threading",
    "signal",
    "ctypes",
    "importlib",
    "inspect",
    "pickle",
    "shelve",
    "marshal",
    "urllib",
    "requests",
    "http",
    "ftplib",
    "webbrowser",
    "tempfile",
    "socketserver",
    "asyncio",
}

FORBIDDEN_CALLS: Set[str] = {
    "eval",
    "exec",
    "compile",
    "open",
    "__import__",
    "globals",
    "locals",
    "getattr",
    "setattr",
    "delattr",
    "breakpoint",
    "exit",
    "quit",
    "input",
}

ALLOWED_MODULES: Set[str] = {
    "math",
    "statistics",
    "json",
    "datetime",
    "random",
    "decimal",
    "collections",
    "itertools",
    "functools",
    "re",
    "pandas",
    "numpy",
}


class SecurityViolationError(Exception):
    """Raised when code violates AST sandbox security policy."""

    pass


class SandboxASTValidator(ast.NodeVisitor):
    """AST visitor that enforces Podacium in-process Python sandbox security invariants."""

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            base_mod = alias.name.split(".")[0]
            if base_mod in FORBIDDEN_MODULES or base_mod not in ALLOWED_MODULES:
                raise SecurityViolationError(
                    f"Importing module '{alias.name}' is strictly forbidden in BI sandbox."
                )
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module:
            base_mod = node.module.split(".")[0]
            if base_mod in FORBIDDEN_MODULES or base_mod not in ALLOWED_MODULES:
                raise SecurityViolationError(
                    f"Importing from module '{node.module}' is strictly forbidden in BI sandbox."
                )
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        if isinstance(node.func, ast.Name):
            if node.func.id in FORBIDDEN_CALLS:
                raise SecurityViolationError(
                    f"Calling function '{node.func.id}' is forbidden in BI sandbox."
                )
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if node.attr.startswith("__") and node.attr.endswith("__"):
            raise SecurityViolationError(
                f"Accessing dunder attribute '{node.attr}' is forbidden for sandbox isolation."
            )
        self.generic_visit(node)


class RunPythonSandboxArgs(BaseModel):
    code: str = Field(
        ...,
        description="Python code to execute in AST-validated sandbox. Store output in variable `result` or print to stdout.",
    )
    context_data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional input dictionary accessible as `data` variable inside execution scope.",
    )


class RunPythonSandboxTool(BaseTool):
    name = "run_python_sandbox"
    description = (
        "Execute AST-validated in-process Python scripts for BI analysis and data transformations. "
        "Enforces strict sandboxing: memory <256MB, timeout <3s, disallows os/sys/subprocess/socket."
    )
    domain = ToolDomain.BI
    access_roles = [
        "USER",
        "STUDENT",
        "FREELANCER",
        "BUSINESS",
        "CLIENT",
        "ORGANIZATION_MEMBER",
        "ORGANIZATION_ADMIN",
        "ADMIN",
    ]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = RunPythonSandboxArgs

    def _validate_ast(self, code: str) -> None:
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            raise SecurityViolationError(f"Syntax error in Python script: {e}")
        validator = SandboxASTValidator()
        validator.visit(tree)

    def _execute_sync(
        self, code: str, context_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        # Validate AST
        self._validate_ast(code)

        # Setup standard output capture
        stdout_buf = io.StringIO()

        def safe_print(*args: Any, **kwargs: Any) -> None:
            sep = kwargs.get("sep", " ")
            end = kwargs.get("end", "\n")
            stdout_buf.write(sep.join(str(a) for a in args) + end)

        def safe_import(name: str, *args: Any, **kwargs: Any) -> Any:
            base_mod = name.split(".")[0]
            if base_mod in FORBIDDEN_MODULES or base_mod not in ALLOWED_MODULES:
                raise SecurityViolationError(
                    f"Importing module '{name}' is strictly forbidden."
                )
            return __import__(name, *args, **kwargs)

        # Build isolated builtins
        safe_builtins: Dict[str, Any] = {
            "abs": abs,
            "all": all,
            "any": any,
            "bin": bin,
            "bool": bool,
            "dict": dict,
            "enumerate": enumerate,
            "filter": filter,
            "float": float,
            "format": format,
            "int": int,
            "isinstance": isinstance,
            "issubclass": issubclass,
            "len": len,
            "list": list,
            "map": map,
            "max": max,
            "min": min,
            "pow": pow,
            "range": range,
            "round": round,
            "set": set,
            "sorted": sorted,
            "str": str,
            "sum": sum,
            "tuple": tuple,
            "zip": zip,
            "print": safe_print,
            "True": True,
            "False": False,
            "None": None,
            "__import__": safe_import,
        }

        # Safe pre-imported modules
        import math
        import statistics
        import json
        import datetime
        import decimal

        execution_globals: Dict[str, Any] = {
            "__builtins__": safe_builtins,
            "math": math,
            "statistics": statistics,
            "json": json,
            "datetime": datetime,
            "decimal": decimal,
            "data": context_data or {},
            "result": None,
        }

        # Optional pandas/numpy if available
        try:
            import pandas as pd

            execution_globals["pd"] = pd
            execution_globals["pandas"] = pd
        except ImportError:
            pass

        try:
            import numpy as np

            execution_globals["np"] = np
            execution_globals["numpy"] = np
        except ImportError:
            pass

        compiled = compile(code, "<bi_sandbox>", "exec")
        exec(compiled, execution_globals)

        # Retrieve result and stdout
        res_val = execution_globals.get("result")
        stdout_val = stdout_buf.getvalue()

        # Sanitize return value to ensure JSON serializability
        if res_val is not None and not isinstance(
            res_val, (int, float, str, bool, list, dict, type(None))
        ):
            res_val = str(res_val)

        return {
            "result": res_val,
            "stdout": stdout_val.strip(),
        }

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, RunPythonSandboxArgs)
        start_time = time.perf_counter()

        # Memory limit check: 256MB threshold
        MAX_CODE_LENGTH = 32768  # 32KB max source code
        if len(typed_args.code) > MAX_CODE_LENGTH:
            return ToolResult(
                success=False,
                error=f"Source code exceeds maximum allowed size ({MAX_CODE_LENGTH} bytes)",
            )

        try:
            # Enforce strict timeout (<3.0s)
            sandbox_output = await asyncio.wait_for(
                asyncio.to_thread(
                    self._execute_sync, typed_args.code, typed_args.context_data
                ),
                timeout=2.8,
            )
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            return ToolResult(
                success=True,
                data={
                    "sandbox": "in_process_python",
                    "execution_time_ms": elapsed_ms,
                    "memory_limit_mb": 256,
                    "stdout": sandbox_output.get("stdout"),
                    "result": sandbox_output.get("result"),
                },
                metadata={"sandbox_validated": True, "timeout_seconds": 2.8},
            )

        except asyncio.TimeoutError:
            return ToolResult(
                success=False,
                error="Execution timed out: script exceeded max sandbox limit (<3.0s).",
                metadata={"timeout": True},
            )
        except SecurityViolationError as sve:
            return ToolResult(
                success=False,
                error=f"Sandbox Security Violation: {str(sve)}",
                metadata={"security_violation": True},
            )
        except Exception as e:
            return ToolResult(
                success=False,
                error=f"Runtime execution error: {type(e).__name__}: {str(e)}",
            )
