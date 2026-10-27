"""
Freelance Inspect Deliverable Tool
Analyzes submitted freelance milestone deliverables (ZIP archives or code snippets) for:
- Security vulnerabilities and hardcoded secrets
- Syntax validity (AST parse for Python)
- Contract milestone deliverables adherence (presence of tests, docs, APIs)
- Safe ZIP unpacking with anti-zip-bomb and path-traversal guards
"""

import ast
import base64
import io
import logging
import re
import zipfile
from typing import Dict, List, Optional, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult

logger = logging.getLogger("podacium.agent.tools.freelance.inspect_deliverable")

# Suspicious security patterns in submitted deliverables
VULNERABILITY_PATTERNS = [
    (
        r"(?i)(api[_-]?key|secret|password|bearer|auth[_-]?token)\s*=\s*['\"][A-Za-z0-9_\-\.]{8,}['\"]",
        "Hardcoded credential or API secret",
    ),
    (r"(?i)os\.system\(", "Unsanitized os.system command execution"),
    (
        r"(?i)subprocess\.(Popen|run|call)\(.*shell\s*=\s*True",
        "Dangerous shell=True execution",
    ),
    (r"(?i)eval\(", "Arbitrary code execution via eval()"),
    (
        r"(?i)SELECT\s+.*FROM\s+.*\+\s*['\"]",
        "Potential raw SQL string concatenation vulnerability",
    ),
    (r"(?i)BEGIN\s+RSA\s+PRIVATE\s+KEY", "Leaked private cryptographic key"),
]


class InspectFreelanceDeliverableArgs(BaseModel):
    milestone_id: int = Field(
        ...,
        description="Contract milestone ID associated with the deliverable",
    )
    file_path: Optional[str] = Field(
        default=None,
        description="Server filesystem path to submitted archive",
    )
    file_content_base64: Optional[str] = Field(
        default=None,
        description="Base64-encoded ZIP file or deliverable file content",
    )
    code_snippet: Optional[str] = Field(
        default=None,
        description="Direct code string if inspecting an inline submission",
    )
    expected_deliverables: Optional[List[str]] = Field(
        default=None,
        description="List of expected deliverable requirements (e.g. ['api', 'tests', 'documentation'])",
    )


class InspectFreelanceDeliverableTool(BaseTool):
    name = "inspect_freelance_deliverable"
    description = (
        "Inspect freelance milestone deliverables (ZIP archives or code) for security vulnerabilities, "
        "syntax validity, and contract milestone requirement adherence."
    )
    domain = ToolDomain.FREELANCE
    access_roles = [
        "USER",
        "FREELANCER",
        "CLIENT",
        "BUSINESS",
        "ORGANIZATION_MEMBER",
        "ORGANIZATION_ADMIN",
        "ADMIN",
    ]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = InspectFreelanceDeliverableArgs

    def _scan_text(self, text: str, filename: str) -> List[Dict[str, str]]:
        vulns = []
        for pattern, desc in VULNERABILITY_PATTERNS:
            if re.search(pattern, text):
                vulns.append({"file": filename, "description": desc})
        return vulns

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, InspectFreelanceDeliverableArgs)

        expected = [
            e.lower()
            for e in (
                typed_args.expected_deliverables or ["api", "tests", "documentation"]
            )
        ]
        detected_files: List[str] = []
        vulnerabilities: List[Dict[str, str]] = []
        syntax_errors: List[str] = []
        syntax_valid = True

        # Case 1: ZIP Archive provided via base64 or file
        zip_bytes: Optional[bytes] = None
        if typed_args.file_content_base64:
            try:
                zip_bytes = base64.b64decode(typed_args.file_content_base64)
            except Exception as e:
                return ToolResult(success=False, error=f"Invalid base64 encoding: {e}")
        elif typed_args.file_path:
            try:
                with open(typed_args.file_path, "rb") as f:
                    zip_bytes = f.read()
            except Exception as e:
                return ToolResult(
                    success=False,
                    error=f"Unable to read file at {typed_args.file_path}: {e}",
                )

        if zip_bytes:
            try:
                # Protect against zip bombs: max 50MB uncompressed, max 200 files
                with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
                    total_uncompressed_size = 0
                    file_infos = zf.infolist()

                    if len(file_infos) > 200:
                        return ToolResult(
                            success=False,
                            error="Archive rejected: contains over 200 files (exceeds deliverable safety threshold)",
                        )

                    for info in file_infos:
                        # Path traversal protection
                        if ".." in info.filename or info.filename.startswith("/"):
                            return ToolResult(
                                success=False,
                                error=f"Malicious archive detected: invalid path '{info.filename}'",
                            )

                        total_uncompressed_size += info.file_size
                        if total_uncompressed_size > 50 * 1024 * 1024:
                            return ToolResult(
                                success=False,
                                error="Archive rejected: uncompressed size exceeds 50MB limit",
                            )

                        detected_files.append(info.filename)

                        # Scan text files (up to 512KB per file)
                        if info.file_size < 512 * 1024 and any(
                            info.filename.endswith(ext)
                            for ext in [
                                ".py",
                                ".js",
                                ".ts",
                                ".html",
                                ".json",
                                ".sql",
                                ".env",
                                ".md",
                                ".txt",
                            ]
                        ):
                            try:
                                content = zf.read(info.filename).decode(
                                    "utf-8", errors="ignore"
                                )
                                vulnerabilities.extend(
                                    self._scan_text(content, info.filename)
                                )

                                if info.filename.endswith(".py"):
                                    try:
                                        ast.parse(content)
                                    except SyntaxError as syn_err:
                                        syntax_valid = False
                                        syntax_errors.append(
                                            f"{info.filename}: {syn_err.msg} (line {syn_err.lineno})"
                                        )
                            except Exception:
                                pass

            except zipfile.BadZipFile:
                return ToolResult(
                    success=False, error="Provided file is not a valid ZIP archive"
                )

        # Case 2: Inline code snippet provided
        elif typed_args.code_snippet:
            snippet = typed_args.code_snippet
            detected_files.append("inline_submission.py")
            vulnerabilities.extend(self._scan_text(snippet, "inline_submission.py"))
            try:
                ast.parse(snippet)
            except SyntaxError as syn_err:
                syntax_valid = False
                syntax_errors.append(
                    f"inline_submission.py: {syn_err.msg} (line {syn_err.lineno})"
                )

        else:
            return ToolResult(
                success=False,
                error="Must provide either 'file_content_base64', 'file_path', or 'code_snippet' for inspection.",
            )

        # Adherence calculation
        combined_text = (
            " ".join(detected_files) + " " + (typed_args.code_snippet or "")
        ).lower()
        satisfied_deliverables = []
        for req in expected:
            if req in combined_text or (
                req == "api"
                and any(
                    "api" in f or "router" in f or "endpoint" in f
                    for f in detected_files
                )
            ):
                satisfied_deliverables.append(req)
            elif req == "tests" and (
                any("test" in f or "spec" in f for f in detected_files)
                or "test" in combined_text
            ):
                satisfied_deliverables.append(req)
            elif req == "documentation" and (
                any("readme" in f or "doc" in f or ".md" in f for f in detected_files)
                or "doc" in combined_text
            ):
                satisfied_deliverables.append(req)

        adherence_score = round(len(satisfied_deliverables) / max(len(expected), 1), 2)
        security_score = max(
            0, 100 - len(vulnerabilities) * 25 - (30 if not syntax_valid else 0)
        )
        passed = security_score >= 70 and syntax_valid and adherence_score >= 0.5

        return ToolResult(
            success=True,
            data={
                "milestone_id": typed_args.milestone_id,
                "passed": passed,
                "security_score": security_score,
                "syntax_valid": syntax_valid,
                "syntax_errors": syntax_errors,
                "vulnerabilities_count": len(vulnerabilities),
                "vulnerabilities": vulnerabilities,
                "total_files_analyzed": len(detected_files),
                "expected_requirements": expected,
                "satisfied_requirements": satisfied_deliverables,
                "adherence_score": adherence_score,
                "summary": (
                    f"Deliverable inspected: Security score {security_score}/100, "
                    f"Contract adherence {int(adherence_score * 100)}%."
                ),
                "recommendation": (
                    "Deliverable meets quality and security thresholds. Ready for client sign-off."
                    if passed
                    else "Deliverable requires remediation before milestone escrow release."
                ),
            },
            widget_payload={
                "type": "DELIVERABLE_INSPECTION_CARD",
                "milestone_id": typed_args.milestone_id,
                "passed": passed,
                "security_score": security_score,
                "adherence_score": adherence_score,
            },
            metadata={"inspected": True, "passed": passed},
        )
