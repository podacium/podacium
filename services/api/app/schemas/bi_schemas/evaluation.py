"""
Trust and risk evaluation schemas.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from .common import ConfidenceLevel, RiskLevel


class TrustAssessment(BaseModel):
    """Trust assessment factors"""
    data_quality: Dict[str, float] = Field(
        default_factory=dict,
        description="Data quality metrics"
    )
    data_volume: Dict[str, float] = Field(
        default_factory=dict,
        description="Data volume metrics"
    )
    data_completeness: Dict[str, float] = Field(
        default_factory=dict,
        description="Data completeness metrics"
    )
    methodology: Dict[str, float] = Field(
        default_factory=dict,
        description="Analytical methodology factors"
    )


class EvaluationRequest(BaseModel):
    """Evaluation request"""
    dataset_id: str = Field(..., description="Dataset to evaluate")
    include_stability: bool = Field(True, description="Calculate stability score")
    include_limitations: bool = Field(True, description="Generate limitations list")
    custom_weights: Optional[Dict[str, float]] = Field(
        None,
        description="Custom weights for evaluation factors"
    )


class EvaluationResult(BaseModel):
    """Evaluation result"""
    # Scores
    confidence_score: float = Field(..., ge=0.0, le=100.0)
    confidence_level: ConfidenceLevel = Field(...)
    
    risk_score: float = Field(..., ge=0.0, le=100.0)
    risk_level: RiskLevel = Field(...)
    
    stability_score: float = Field(..., ge=0.0, le=100.0)
    stability_level: ConfidenceLevel = Field(...)
    
    # Assessment
    trust_assessment: TrustAssessment = Field(default_factory=TrustAssessment)
    
    # Limitations
    limitations: List[str] = Field(
        default_factory=list,
        description="Plain language limitations"
    )
    
    # Human-readable
    trust_summary: str = Field(..., description="Plain language trust summary")
    
    # Technical factors
    evaluation_factors: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict,
        description="Detailed factor breakdown"
    )
    
    # Recommendations
    improvement_recommendations: List[str] = Field(
        default_factory=list,
        description="Recommendations to improve trust"
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "confidence_score": 78.5,
                "confidence_level": "MEDIUM",
                "risk_score": 65.0,
                "risk_level": "MEDIUM",
                "stability_score": 82.0,
                "stability_level": "HIGH",
                "trust_summary": "Medium confidence with moderate risk, results are reasonably stable",
                "limitations": [
                    "Analysis based on 3 months of data",
                    "Some missing values in key columns"
                ]
            }
        }
    }
