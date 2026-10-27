"""
Decision intelligence schemas.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from .common import PriorityLevel


class Recommendation(BaseModel):
    """Actionable recommendation"""
    text: str = Field(..., max_length=500, description="Recommendation text")
    category: str = Field(..., description="DATA_QUALITY/SALES_OPTIMIZATION/etc.")
    priority: PriorityLevel = Field("MEDIUM")
    effort: str = Field("MEDIUM", pattern="^(LOW|MEDIUM|HIGH)$", description="Implementation effort")
    expected_benefit: str = Field("MEDIUM", pattern="^(LOW|MEDIUM|HIGH)$")
    implementation_steps: Optional[List[str]] = Field(None, max_length=5)
    metrics_to_track: Optional[List[str]] = Field(None, max_length=5)
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "Focus marketing efforts on top-performing regions",
                "category": "MARKETING_OPTIMIZATION",
                "priority": "HIGH",
                "effort": "MEDIUM",
                "expected_benefit": "HIGH",
                "implementation_steps": ["Identify top regions", "Allocate budget", "Track results"],
                "metrics_to_track": ["ROI", "Conversion rate", "Customer acquisition cost"]
            }
        }
    }


class ImpactAssessment(BaseModel):
    """Expected impact assessment"""
    level: str = Field(..., pattern="^(LOW|MEDIUM|HIGH)$")
    description: str = Field(..., max_length=500)
    score: float = Field(..., ge=0.0, le=100.0)
    factors: List[str] = Field(default_factory=list)
    timeframe: Optional[str] = Field(None, description="Expected timeframe for impact")
    dependencies: Optional[List[str]] = Field(None, description="Dependencies for achieving impact")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "level": "HIGH",
                "description": "Significant revenue growth potential from optimization",
                "score": 78.5,
                "factors": ["Strong market position", "Clear growth trends"],
                "timeframe": "3-6 months",
                "dependencies": ["Budget allocation", "Team execution"]
            }
        }
    }


class DecisionRequest(BaseModel):
    """Decision intelligence request"""
    dataset_id: str = Field(..., description="Dataset for decision intelligence")
    include_warnings: bool = Field(True, description="Include warnings and limitations")
    max_recommendations: int = Field(10, ge=1, le=50, description="Maximum number of recommendations")
    domain_context: Optional[str] = Field(None, description="Business domain context")


class DecisionResult(BaseModel):
    """Decision intelligence result"""
    # Recommendations
    recommendations: List[Recommendation] = Field(default_factory=list)
    recommendation_count: int = Field(0, ge=0)
    
    # Impact assessment
    expected_impact: ImpactAssessment = Field(...)
    
    # Explanation
    explanation: str = Field(..., max_length=2000, description="Plain language explanation")
    
    # Warnings
    warnings: List[str] = Field(default_factory=list, description="Important warnings")
    
    # Context
    context: Dict[str, Any] = Field(
        default_factory=dict,
        description="Decision context (confidence, risk, domain, etc.)"
    )
    
    # Summary
    decision_summary: str = Field(..., description="Executive decision summary")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "recommendation_count": 5,
                "explanation": "Based on data analysis with 78% confidence, we recommend the following actions...",
                "decision_summary": "5 actionable recommendations with high expected impact"
            }
        }
    }
