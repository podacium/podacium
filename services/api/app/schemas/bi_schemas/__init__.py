"""
BI Schema Package
Contains all Pydantic schemas for the BI module.
"""

from .common import *
from .ingestion import *
from .validation import *
from .quality import *
from .preprocessing import *
from .analytics import *
from .evaluation import *
from .decision import *
from .views import *
from .connector import *
from .collaboration import *


__all__ = [
    # Common
    "BaseModel",
    "BaseResponse",
    "ErrorResponse",
    "PaginationParams",
    "UserContext",
    "OrganizationContext",
    
    # Ingestion
    "DatasetCreate",
    "DatasetUpload",
    "JSONIngestionRequest",
    "HistoryEvent",
    "HistoryResponse",
    "DatasetMetadata",
    "DatasetResponse",
    "DatasetListResponse",
    
    # Validation
    "ValidationRequest",
    "ValidationResult",
    "ColumnSchema",
    
    # Quality
    "QualityAssessmentRequest",
    "QualityResult",
    "QualityBreakdown",
    
    # Preprocessing
    "PreprocessingRequest",
    "PreprocessingResult",
    "TransformationStep",
    
    # Analytics
    "AnalyticsRequest",
    "AnalyticsResult",
    "ColumnAnalytics",
    "BusinessInsight",
    "TrendAnalysis",
    
    # Evaluation
    "EvaluationRequest",
    "EvaluationResult",
    "TrustAssessment",
    
    # Decision
    "DecisionRequest",
    "DecisionResult",
    "Recommendation",
    "ImpactAssessment",
    
    # Views
    "ViewType",
    "ExecutiveView",
    "AnalystView",
    "ViewRequest",

    # Connector & Governance
    "DataConnectorCreate",
    "DataConnectorResponse",
    "DataConnectorListResponse",
    "SemanticModelCreate",
    "SemanticModelResponse",
    "SemanticModelListResponse",
    "RowLevelPolicyCreate",
    "RowLevelPolicyResponse",
    "RowLevelPolicyListResponse",
]
