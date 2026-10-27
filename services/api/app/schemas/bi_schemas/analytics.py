"""
Analytics schemas.
"""

from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class ColumnStatistics(BaseModel):
    """Column statistics"""

    count: int = Field(0, ge=0)
    mean: Optional[float] = None
    median: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    std_dev: Optional[float] = None
    sum: Optional[float] = None
    unique_count: Optional[int] = None
    null_count: int = Field(0, ge=0)

    # For categorical columns
    top_categories: Optional[List[Dict[str, Any]]] = None
    value_counts: Optional[Dict[str, int]] = None


class ColumnAnalytics(BaseModel):
    """Analytics for a single column"""

    column_name: str
    column_type: str = Field(..., description="numeric/categorical/date/text/unknown")
    statistics: ColumnStatistics = Field(default_factory=ColumnStatistics)

    # Insights
    has_outliers: bool = False
    outlier_count: Optional[int] = None
    is_skewed: Optional[bool] = None
    skewness: Optional[float] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "column_name": "sales",
                "column_type": "numeric",
                "statistics": {
                    "count": 1000,
                    "mean": 2450.75,
                    "min": 500.0,
                    "max": 8500.0,
                    "std_dev": 1250.25,
                },
                "has_outliers": True,
                "outlier_count": 23,
            }
        }
    }


class TrendAnalysis(BaseModel):
    """Trend analysis result"""

    trend_detected: bool = Field(False)
    trend_direction: Optional[str] = Field(
        None, pattern="^(INCREASING|DECREASING|STABLE)$"
    )
    trend_strength: Optional[str] = Field(None, pattern="^(WEAK|MODERATE|STRONG)$")
    percentage_change: Optional[float] = None
    first_period_avg: Optional[float] = None
    last_period_avg: Optional[float] = None
    data_points: Optional[int] = None
    time_range: Optional[Dict[str, str]] = None
    reason: Optional[str] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "trend_detected": True,
                "trend_direction": "INCREASING",
                "trend_strength": "MODERATE",
                "percentage_change": 15.5,
                "data_points": 365,
            }
        }
    }


class BusinessInsight(BaseModel):
    """Business insight"""

    title: str = Field(..., max_length=200)
    description: str = Field(..., max_length=1000)
    type: str = Field(..., description="trend/anomaly/summary/correlation/dominance")
    category: Optional[str] = Field(None, description="sales/finance/hr/etc.")
    importance: str = Field("MEDIUM", pattern="^(HIGH|MEDIUM|LOW)$")
    confidence_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    impact_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    supporting_data: Optional[Dict[str, Any]] = None
    params: Optional[Dict[str, Any]] = Field(
        None, description="Parameters for i18n interpolation"
    )
    recommendation: Optional[str] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "title": "Sales Trend Analysis",
                "description": "Sales increased by 15.5% over the last quarter",
                "type": "trend",
                "category": "sales",
                "importance": "HIGH",
                "confidence_score": 85.0,
            }
        }
    }


class DriverAttributionSchema(BaseModel):
    """Driver attribution breakdown for root cause analysis"""

    dimension: str
    impactPercentage: float
    direction: str = Field("positive", pattern="^(positive|negative)$")
    formattedDelta: str


class StructuredAiInsightSchema(BaseModel):
    """Rich enterprise AI insight schema matching frontend AiInsightCard"""

    id: str
    category: str = Field("anomaly", pattern="^(anomaly|trend|forecast|performance)$")
    urgency: str = Field("info", pattern="^(critical|warning|opportunity|info)$")
    title: str
    narrativeDiagnostic: str
    metricLabel: str
    currentValue: float
    baselineValue: float
    baselineLabel: str
    percentageChange: float
    isPositiveOutcome: bool = True
    confidenceScore: float = Field(0.95, ge=0.0, le=1.0)
    generatedAt: str = "Just now"
    modelName: str = "AutoML Driver Analysis"
    drivers: List[DriverAttributionSchema] = Field(default_factory=list)
    sparklineData: List[float] = Field(default_factory=list)
    recommendedAction: Optional[Dict[str, Any]] = None


class AnalyticsRequest(BaseModel):
    """Analytics request"""

    dataset_id: str = Field(..., description="Dataset to analyze")
    include_trends: bool = Field(True, description="Perform trend analysis")
    date_column: Optional[str] = Field(
        None, description="Column to use as date for trends"
    )
    value_column: Optional[str] = Field(
        None, description="Column to use as value for trends"
    )
    custom_analytics: Optional[Dict[str, Any]] = Field(
        None, description="Custom analytics configuration"
    )


class AnalyticsResult(BaseModel):
    """Analytics result"""

    # Overall summary
    executive_summary: Union[str, Dict[str, Any]] = Field(
        ..., description="Plain language summary or i18n object"
    )

    # Business insights
    business_insights: List[BusinessInsight] = Field(default_factory=list)
    insight_count: int = Field(0, ge=0)

    # Trend analysis
    trend_analysis: Optional[TrendAnalysis] = None

    # Column analytics
    column_analytics: Dict[str, ColumnAnalytics] = Field(default_factory=dict)

    # Visualization Data
    distributions: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)
    correlations: List[Dict[str, Any]] = Field(default_factory=list)

    # Technical/internal data (for analyst view)
    internal_technical: Dict[str, Any] = Field(
        default_factory=dict, description="Technical details for analysts"
    )

    # Metadata
    record_count: int = Field(0, ge=0)
    column_count: int = Field(0, ge=0)
    analytics_duration: Optional[float] = Field(
        None, description="Processing time in seconds"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "executive_summary": "Analyzed 1,000 sales records showing 15.5% growth trend",
                "insight_count": 8,
                "record_count": 1000,
                "column_count": 12,
            }
        }
    }
