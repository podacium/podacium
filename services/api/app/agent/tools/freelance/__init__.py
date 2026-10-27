"""
Freelance Domain Tools Package.
"""

from typing import List
from app.agent.tools.base import BaseTool
from app.agent.tools.freelance.search import SearchFreelanceProjectsTool
from app.agent.tools.freelance.profile import GetFreelancerProfileTool
from app.agent.tools.freelance.proposals import (
    SubmitProposalTool,
    CompareProjectProposalsTool,
)
from app.agent.tools.freelance.contracts import (
    AcceptProposalTool,
    GetContractsTool,
)
from app.agent.tools.freelance.milestones import (
    SubmitMilestoneDeliveryTool,
    ApproveMilestoneAndReleaseTool,
)
from app.agent.tools.freelance.inspect_deliverable import (
    InspectFreelanceDeliverableTool,
)
from app.agent.tools.freelance.batch_milestones import (
    BatchCreateMilestonesTool,
    BatchReleaseEscrowTool,
    BatchEvaluateProposalsTool,
    GenerateContractAmendmentTool,
)

FREELANCE_TOOLS: List[BaseTool] = [
    SearchFreelanceProjectsTool(),
    GetFreelancerProfileTool(),
    SubmitProposalTool(),
    CompareProjectProposalsTool(),
    AcceptProposalTool(),
    GetContractsTool(),
    SubmitMilestoneDeliveryTool(),
    ApproveMilestoneAndReleaseTool(),
    InspectFreelanceDeliverableTool(),
    BatchCreateMilestonesTool(),
    BatchReleaseEscrowTool(),
    BatchEvaluateProposalsTool(),
    GenerateContractAmendmentTool(),
]

__all__ = [
    "SearchFreelanceProjectsTool",
    "GetFreelancerProfileTool",
    "SubmitProposalTool",
    "CompareProjectProposalsTool",
    "AcceptProposalTool",
    "GetContractsTool",
    "SubmitMilestoneDeliveryTool",
    "ApproveMilestoneAndReleaseTool",
    "InspectFreelanceDeliverableTool",
    "BatchCreateMilestonesTool",
    "BatchReleaseEscrowTool",
    "BatchEvaluateProposalsTool",
    "GenerateContractAmendmentTool",
    "FREELANCE_TOOLS",
]
