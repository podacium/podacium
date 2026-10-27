"""
EdTech Domain Tools Package.
"""

from typing import List
from app.agent.tools.base import BaseTool
from app.agent.tools.edtech.courses import SearchCoursesTool, GetCourseDetailsTool
from app.agent.tools.edtech.progress import GetLearningProgressTool
from app.agent.tools.edtech.enrollment import EnrollCourseTool
from app.agent.tools.edtech.quiz import GetQuizTool, SubmitQuizAnswersTool
from app.agent.tools.edtech.certificate import VerifyCertificateTool
from app.agent.tools.edtech.transcript import GetLessonTranscriptTool
from app.agent.tools.edtech.adaptive_quiz import GenerateAdaptiveQuizTool
from app.agent.tools.edtech.batch_certificates import (
    BatchIssueCertificatesTool,
    BatchEnrollStudentsTool,
    BatchAuditCourseCompletionsTool,
    GenerateArrete1275AssessmentTool,
)

EDTECH_TOOLS: List[BaseTool] = [
    SearchCoursesTool(),
    GetCourseDetailsTool(),
    GetLearningProgressTool(),
    EnrollCourseTool(),
    GetQuizTool(),
    SubmitQuizAnswersTool(),
    VerifyCertificateTool(),
    GetLessonTranscriptTool(),
    GenerateAdaptiveQuizTool(),
    BatchIssueCertificatesTool(),
    BatchEnrollStudentsTool(),
    BatchAuditCourseCompletionsTool(),
    GenerateArrete1275AssessmentTool(),
]

__all__ = [
    "SearchCoursesTool",
    "GetCourseDetailsTool",
    "GetLearningProgressTool",
    "EnrollCourseTool",
    "GetQuizTool",
    "SubmitQuizAnswersTool",
    "VerifyCertificateTool",
    "GetLessonTranscriptTool",
    "GenerateAdaptiveQuizTool",
    "BatchIssueCertificatesTool",
    "BatchEnrollStudentsTool",
    "BatchAuditCourseCompletionsTool",
    "GenerateArrete1275AssessmentTool",
    "EDTECH_TOOLS",
]
