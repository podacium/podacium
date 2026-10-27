"""
Data quality assessment schemas.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from .common import QualityLevel


class QualityBreakdown(BaseModel):
    """Quality score breakdown"""

    completeness: Dict[str, float] = Field(
        default_factory=dict, description="Completeness metrics"
    )
    duplicates: Dict[str, float] = Field(
        default_factory=dict, description="Duplicate detection metrics"
    )
    outliers: Dict[str, float] = Field(
        default_factory=dict, description="Outlier detection metrics"
    )
    consistency: Dict[str, float] = Field(
        default_factory=dict, description="Data consistency metrics"
    )


class QualityAssessmentRequest(BaseModel):
    """Quality assessment request"""

    dataset_id: Optional[str] = Field(None, description="Dataset to assess")
    include_outliers: bool = Field(True, description="Calculate outlier ratio")
    include_duplicates: bool = Field(True, description="Calculate duplicate ratio")
    outlier_threshold: float = Field(
        3.0, ge=1.0, le=10.0, description="Z-score threshold for outliers"
    )


class QualityResult(BaseModel):
    """Quality assessment result"""

    quality_score: float = Field(
        ..., ge=0.0, le=100.0, description="Overall quality score (0-100)"
    )
    quality_level: QualityLevel = Field(..., description="Quality level classification")

    # Component scores
    completeness_score: float = Field(..., ge=0.0, le=100.0)
    duplicate_ratio: float = Field(..., ge=0.0, le=100.0)
    outlier_ratio: float = Field(..., ge=0.0, le=100.0)

    # Breakdown
    breakdown: QualityBreakdown = Field(default_factory=QualityBreakdown)

    # Human-readable and i18n
    human_summary: str = Field(..., description="Plain language quality summary")
    summary_keys: List[Dict[str, Any]] = Field(
        default_factory=list, description="Array of i18n translation objects"
    )
    warnings: List[Any] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    recommendation_keys: List[Dict[str, Any]] = Field(
        default_factory=list, description="Array of i18n translation objects"
    )

    # Technical details
    column_quality: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict, description="Quality metrics per column"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "quality_score": 78.5,
                "quality_level": "ACCEPTABLE",
                "completeness_score": 85.0,
                "duplicate_ratio": 2.5,
                "outlier_ratio": 8.2,
                "human_summary": "Good data quality with some outliers and minimal duplicates.",
                "warnings": ["Column 'price' has 12% outliers"],
                "recommendations": ["Review outliers in 'price' column"],
            }
        }
    }
