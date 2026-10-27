"""
BI DLG/SCF Parser Tools: ParseDlgAccountingFileTool.
"""

from typing import Any, Optional, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.agent.tools.claim_check import offload_to_claim_check
from app.services.bi_services.query_engine import QueryEngine
from app.services.dlg_parser_service import DLGParserService


class ParseDlgAccountingFileArgs(BaseModel):
    file_content_text: Optional[str] = Field(
        default=None, description="Raw text of the DLG/PC Compta export"
    )
    file_path: Optional[str] = Field(
        default=None, description="Server file path of the uploaded DLG journal"
    )


class ParseDlgAccountingFileTool(BaseTool):
    name = "parse_dlg_accounting_file"
    description = (
        "Parse an Algerian PC Compta / DLG journal export, normalize Windows-1256 encodings, "
        "and map transactions to Algerian SCF (Système Comptable Financier) accounts (Compte 70, 60, 411, etc.)."
    )
    domain = ToolDomain.BI
    access_roles = ["USER", "ORGANIZATION_MEMBER", "ORGANIZATION_ADMIN", "ADMIN"]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = ParseDlgAccountingFileArgs

    def __init__(self, claim_check_mgr=None):
        super().__init__()
        self.claim_check_mgr = claim_check_mgr
        self.parser_service = DLGParserService()

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, ParseDlgAccountingFileArgs)

        raw_bytes: bytes = b""
        if typed_args.file_content_text:
            raw_bytes = typed_args.file_content_text.encode("utf-8")
        elif typed_args.file_path:
            try:
                safe_path = QueryEngine._validate_path_security(typed_args.file_path)
                with open(safe_path, "rb") as f:
                    raw_bytes = f.read()
            except Exception as e:
                return ToolResult(
                    success=False,
                    error=f"Could not read file at {typed_args.file_path}: {str(e)}",
                )
        else:
            return ToolResult(
                success=False,
                error="Either file_content_text or file_path must be provided",
            )

        try:
            parse_result = self.parser_service.parse_dlg_journal(raw_bytes)
        except Exception as e:
            return ToolResult(success=False, error=f"DLG parsing failed: {str(e)}")

        entries_dict = [entry.model_dump() for entry in parse_result.entries]
        claim_check_urn: Optional[str] = None
        entries_to_return: Any = entries_dict

        if len(entries_dict) > 15:
            try:
                urn = await offload_to_claim_check(
                    namespace=f"bi_dlg_user_{context.user_id}",
                    data={
                        "entries": entries_dict,
                        "total_lines": parse_result.total_lines,
                    },
                    ttl_seconds=3600,
                )
                claim_check_urn = urn
                entries_to_return = entries_dict[:10]
            except Exception:
                pass

        summary_data = {
            "total_lines": parse_result.total_lines,
            "parsed_count": parse_result.parsed_count,
            "total_debit": parse_result.total_debit,
            "total_credit": parse_result.total_credit,
            "is_balanced": parse_result.is_balanced,
            "scf_breakdown": parse_result.scf_summary,
            "entries_sample": entries_to_return,
            "claim_check_urn": claim_check_urn,
        }

        return ToolResult(
            success=True,
            data=summary_data,
            claim_check_urn=claim_check_urn,
            widget_payload={
                "widgetType": "dlg_accounting_summary_card",
                "totalLines": parse_result.total_lines,
                "totalDebit": parse_result.total_debit,
                "totalCredit": parse_result.total_credit,
                "isBalanced": parse_result.is_balanced,
                "scfBreakdown": parse_result.scf_summary,
            },
        )
