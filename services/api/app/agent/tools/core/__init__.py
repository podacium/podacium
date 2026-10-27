"""
Core Domain Tools Package.
"""

from typing import List
from app.agent.tools.base import BaseTool
from app.agent.tools.core.profile import (
    GetMyProfileTool,
    UpdateProfileSettingsTool,
)
from app.agent.tools.core.faq import SearchKnowledgeFaqTool
from app.agent.tools.core.support import (
    GetMyTicketsTool,
    CreateSupportTicketTool,
    RequestHumanHandoverTool,
)
from app.agent.tools.core.mail import SendCorporateMailTool
from app.agent.tools.core.kyc import VerifyKycStatusTool
from app.agent.tools.core.cnrc_registry import VerifyCnrcCompanyRegistryTool
from app.agent.tools.core.whatsapp_notification import SendWhatsappNotificationTool
from app.agent.tools.core.batch_core import (
    BatchSendNotificationsTool,
    BatchAuditUserKycTool,
    ExportAuditTrailTool,
)

CORE_TOOLS: List[BaseTool] = [
    GetMyProfileTool(),
    UpdateProfileSettingsTool(),
    SearchKnowledgeFaqTool(),
    GetMyTicketsTool(),
    CreateSupportTicketTool(),
    SendCorporateMailTool(),
    VerifyKycStatusTool(),
    RequestHumanHandoverTool(),
    VerifyCnrcCompanyRegistryTool(),
    SendWhatsappNotificationTool(),
    BatchSendNotificationsTool(),
    BatchAuditUserKycTool(),
    ExportAuditTrailTool(),
]

__all__ = [
    "GetMyProfileTool",
    "UpdateProfileSettingsTool",
    "SearchKnowledgeFaqTool",
    "GetMyTicketsTool",
    "CreateSupportTicketTool",
    "SendCorporateMailTool",
    "VerifyKycStatusTool",
    "RequestHumanHandoverTool",
    "VerifyCnrcCompanyRegistryTool",
    "SendWhatsappNotificationTool",
    "BatchSendNotificationsTool",
    "BatchAuditUserKycTool",
    "ExportAuditTrailTool",
    "CORE_TOOLS",
]
