"""
Data preprocessing schemas.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TransformationStep(BaseModel):
    """Single transformation step"""
    step_name: str = Field(..., description="Transformation name")
    columns_affected: List[str] = Field(default_factory=list)
    details: str = Field(..., description="Brief description of transformation")
    record_count_affected: int = Field(0, ge=0)
    before_sample: Optional[List[Any]] = Field(None, max_length=3)
    after_sample: Optional[List[Any]] = Field(None, max_length=3)
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "step_name": "missing_value_imputation",
                "columns_affected": ["price"],
                "details": "Imputed 15 missing values with median: 2450.75",
                "record_count_affected": 15
            }
        }
    }


class PreprocessingRequest(BaseModel):
    """Preprocessing request"""
    dataset_id: str = Field(..., description="Dataset to preprocess")
    
    # Options
    handle_missing: bool = Field(True, description="Handle missing values")
    trim_whitespace: bool = Field(True, description="Trim whitespace from strings")
    normalize_dates: bool = Field(True, description="Normalize date formats")
    convert_numeric: bool = Field(True, description="Convert numeric strings to numbers")
    
    # Missing value handling strategy
    missing_numeric_strategy: str = Field("median", pattern="^(median|mean|mode|constant)$")
    missing_text_strategy: str = Field("constant", pattern="^(constant|mode|empty)$")
    missing_constant_value: str = Field("UNKNOWN", description="Constant value for text imputation")
    
    # Column-specific overrides
    column_strategies: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict,
        description="Custom strategies per column"
    )


class PreprocessingResult(BaseModel):
    """Preprocessing result"""
    success: bool = Field(..., description="Preprocessing completion status")
    
    # Data
    processed_record_count: int = Field(0, ge=0)
    original_record_count: int = Field(0, ge=0)
    
    # Transformations
    transformations_log: List[TransformationStep] = Field(default_factory=list)
    total_transformations: int = Field(0, ge=0)
    
    # Statistics
    missing_values_imputed: int = Field(0, ge=0)
    whitespace_trimmed: int = Field(0, ge=0)
    dates_normalized: int = Field(0, ge=0)
    numeric_conversions: int = Field(0, ge=0)
    
    # Sample data
    sample_processed_records: Optional[List[Dict[str, Any]]] = Field(None, max_length=3)
    
    # Summary
    preprocessing_summary: str = Field(..., description="Plain language summary")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "processed_record_count": 1000,
                "original_record_count": 1000,
                "total_transformations": 145,
                "missing_values_imputed": 45,
                "whitespace_trimmed": 67,
                "dates_normalized": 23,
                "numeric_conversions": 10,
                "preprocessing_summary": "Cleaned 1000 records with 145 transformations"
            }
        }
    }
