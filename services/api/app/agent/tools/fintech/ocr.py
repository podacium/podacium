import os
import tempfile
from pathlib import Path
from typing import List, Optional, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.core.config import setting
from app.services.receipt_ocr_service import ReceiptOCRService


def _get_allowed_upload_dirs() -> List[Path]:
    base_dirs = [
        Path(setting.UPLOAD_DIR or "uploads").resolve(),
        Path(__file__).resolve().parents[4] / "uploads",
        Path(__file__).resolve().parents[4] / "storage",
        Path(__file__).resolve().parents[3] / "uploads",
        Path(__file__).resolve().parents[3] / "storage",
        Path(os.getcwd()).resolve(),
        Path(tempfile.gettempdir()).resolve(),
    ]
    env_allowed = os.environ.get("ALLOWED_DATA_DIRS")
    if env_allowed:
        import re

        for path_str in re.split(r"[:;,]", env_allowed):
            path_str = path_str.strip()
            if path_str:
                base_dirs.append(Path(path_str).resolve())
    return [d.resolve() for d in base_dirs]


class OcrReceiptScanArgs(BaseModel):
    receipt_text: Optional[str] = Field(
        default=None, description="Raw extracted OCR text from a payment receipt"
    )
    receipt_image_path: Optional[str] = Field(
        default=None, description="Local file path of uploaded receipt image"
    )


class OcrReceiptScanTool(BaseTool):
    name = "ocr_receipt_scan"
    description = (
        "Extract, parse, and verify payment receipt fields (amount, transaction ID, date, postal stamp) "
        "from BaridiMob, CCP, or EDAHABIA receipts."
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
    args_schema: Type[BaseModel] = OcrReceiptScanArgs

    def __init__(self):
        super().__init__()
        self.ocr_service = ReceiptOCRService()

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, OcrReceiptScanArgs)

        raw_text = typed_args.receipt_text or ""
        if not raw_text and typed_args.receipt_image_path:
            path_str = typed_args.receipt_image_path.replace("\\", "/")
            if ".." in path_str or path_str.startswith(
                ("/etc", "/proc", "/sys", "/root", "/var")
            ):
                return ToolResult(
                    success=False,
                    error="Invalid or restricted receipt image path traversal",
                )

            target_path = Path(typed_args.receipt_image_path).resolve()
            allowed_dirs = _get_allowed_upload_dirs()
            is_allowed = any(
                target_path == allowed_dir or allowed_dir in target_path.parents
                for allowed_dir in allowed_dirs
            )
            if not is_allowed:
                return ToolResult(
                    success=False,
                    error=f"Receipt image path {typed_args.receipt_image_path} is outside allowed directories",
                )

            try:
                with open(target_path, "rb") as f:
                    img_bytes = f.read()
                raw_text = self.ocr_service.extract_text_from_image(img_bytes)
            except Exception as e:
                return ToolResult(
                    success=False, error=f"Could not read receipt image: {str(e)}"
                )

        if not raw_text:
            return ToolResult(
                success=False,
                error="Either receipt_text or receipt_image_path must be provided",
            )

        parsed = self.ocr_service.parse_receipt_text(raw_text)
        parsed_dict = parsed.model_dump()

        return ToolResult(
            success=True,
            data=parsed_dict,
            widget_payload={
                "widgetType": "receipt_scan_card",
                "extractedAmount": parsed_dict.get("amount"),
                "date": str(parsed_dict.get("date")),
                "transactionId": parsed_dict.get("transaction_id"),
                "confidenceScore": parsed_dict.get("confidence_score"),
            },
        )
