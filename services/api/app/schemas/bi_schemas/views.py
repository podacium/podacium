"""
View schemas for Executive vs Analyst views.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ViewType(str, Enum):
    """Available view types"""
    EXECUTIVE = "executive"
    ANALYST = "analyst"


class ViewRequest(BaseModel):
    """View type request parameter"""
    view: ViewType = Field(ViewType.EXECUTIVE, description="View type: executive or analyst")


class ExecutiveView(BaseModel):
    """Executive view response"""
    executive_summary: str = Field(..., description="Plain language summary")
    confidence_level: str = Field(..., pattern="^(LOW|MEDIUM|HIGH)$")
    risk_level: str = Field(..., pattern="^(LOW|MEDIUM|HIGH)$")
    top_business_insights: List[str] = Field(default_factory=list, max_length=10)
    recommendations: List[str] = Field(default_factory=list, max_length=10)
    warnings_and_limitations: List[str] = Field(default_factory=list, max_length=10)
    has_technical_details: bool = Field(False, description="Whether technical details are available")
    can_view_analyst: bool = Field(False, description="Whether user can view analyst details")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "executive_summary": "Data shows 15% growth trend with medium confidence",
                "confidence_level": "MEDIUM",
                "risk_level": "LOW",
                "top_business_insights": [
                    "Sales increased 15% last quarter",
                    "Region A is top performer"
                ],
                "recommendations": [
                    "Increase marketing in top regions",
                    "Optimize inventory for best-selling products"
                ],
                "warnings_and_limitations": [
                    "Based on 3 months of data",
                    "Some seasonal factors not accounted for"
                ]
            }
        }
    }


class AnalystView(BaseModel):
    """Analyst view response"""
    # Include all technical details
    technical_metrics: Dict[str, Any] = Field(
        default_factory=dict,
        description="Technical metrics and diagnostics"
    )
    quality_breakdown: Dict[str, Any] = Field(
        default_factory=dict,
        description="Detailed quality assessment"
    )
    transformations_log: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Complete preprocessing log"
    )
    profiling_stats: Dict[str, Any] = Field(
        default_factory=dict,
        description="Detailed profiling statistics"
    )
    model_metrics: Optional[Dict[str, Any]] = Field(
        None,
        description="Model performance metrics (if applicable)"
    )
    
    # Also include executive summary for context
    executive_summary: Optional[str] = None
    confidence_level: Optional[str] = None
    risk_level: Optional[str] = None
    
    # Metadata
    dataset_info: Dict[str, Any] = Field(
        default_factory=dict,
        description="Dataset metadata"
    )
    processing_details: Dict[str, Any] = Field(
        default_factory=dict,
        description="Processing pipeline details"
    )
    
    # Add this model_config to disable the protected namespace warning
    model_config = {
        "protected_namespaces": (),  # This disables the warning for this specific model
        "json_schema_extra": {
            "example": {
                "executive_summary": "Data shows 15% growth trend with medium confidence",
                "confidence_level": "MEDIUM",
                "dataset_info": {
                    "row_count": 1000,
                    "column_count": 12,
                    "quality_score": 78.5
                }
            }
        }
    }