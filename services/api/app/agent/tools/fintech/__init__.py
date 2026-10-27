"""
FinTech Domain Tools Package.
"""

from typing import List
from app.agent.tools.base import BaseTool
from app.agent.tools.fintech.wallet import GetWalletBalanceTool
from app.agent.tools.fintech.fiscal import (
    CalculateTaxDeductionsTool,
    CheckAnaeTurnoverCeilingTool,
)
from app.agent.tools.fintech.documents import (
    GenerateTripleDocumentKitTool,
    GenerateTaxDefensePackTool,
)
from app.agent.tools.fintech.payout import RequestPayoutWithdrawalTool
from app.agent.tools.fintech.ocr import OcrReceiptScanTool
from app.agent.tools.fintech.vouchers import ApplyPromoVoucherTool
from app.agent.tools.fintech.legal_invoice_pdf import GenerateLegalInvoicePdfTool
from app.agent.tools.fintech.batch_payout import (
    BatchPayoutDisbursementTool,
    BatchValidateIbanRipTool,
    ReconcileChargilyTransactionsTool,
    AuditTaxShieldComplianceTool,
)

FINTECH_TOOLS: List[BaseTool] = [
    GetWalletBalanceTool(),
    CalculateTaxDeductionsTool(),
    CheckAnaeTurnoverCeilingTool(),
    GenerateTripleDocumentKitTool(),
    GenerateTaxDefensePackTool(),
    RequestPayoutWithdrawalTool(),
    OcrReceiptScanTool(),
    ApplyPromoVoucherTool(),
    GenerateLegalInvoicePdfTool(),
    BatchPayoutDisbursementTool(),
    BatchValidateIbanRipTool(),
    ReconcileChargilyTransactionsTool(),
    AuditTaxShieldComplianceTool(),
]

__all__ = [
    "GetWalletBalanceTool",
    "CalculateTaxDeductionsTool",
    "CheckAnaeTurnoverCeilingTool",
    "GenerateTripleDocumentKitTool",
    "GenerateTaxDefensePackTool",
    "RequestPayoutWithdrawalTool",
    "OcrReceiptScanTool",
    "ApplyPromoVoucherTool",
    "GenerateLegalInvoicePdfTool",
    "BatchPayoutDisbursementTool",
    "BatchValidateIbanRipTool",
    "ReconcileChargilyTransactionsTool",
    "AuditTaxShieldComplianceTool",
    "FINTECH_TOOLS",
]
