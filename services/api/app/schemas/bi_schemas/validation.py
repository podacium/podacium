"""
Data validation schemas.
"""

from typing import Any, Dict, List
from pydantic import BaseModel, Field


class ColumnSchema(BaseModel):
    """Inferred column schema"""
    column_name: str
    inferred_type: str = Field(..., description="number/date/text/boolean/unknown")
    null_count: int = Field(0, ge=0)
    null_ratio: float = Field(0.0, ge=0.0, le=1.0)
    sample_values: List[Any] = Field(default_factory=list)
    type_distribution: Dict[str, int] = Field(default_factory=dict)
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "column_name": "sales_amount",
                "inferred_type": "number",
                "null_count": 5,
                "null_ratio": 0.05,
                "sample_values": [1500.5, 2300.0, 1800.75],
                "type_distribution": {"number": 95, "null": 5}
            }
        }
    }


class ValidationRequest(BaseModel):
    """Dataset validation request"""
    dataset_id: str = Field(..., description="Dataset to validate")
    strict_mode: bool = Field(False, description="If true, warnings will block validation")
    validate_types: bool = Field(True, description="Perform type inference and validation")


class ValidationResult(BaseModel):
    """Validation result"""
    valid: bool = Field(..., description="Overall validation status")
    errors: List[str] = Field(default_factory=list, description="Critical errors that invalidate dataset")
    warnings: List[str] = Field(default_factory=list, description="Non-critical warnings")
    
    # Schema information
    inferred_schema: Dict[str, ColumnSchema] = Field(default_factory=dict)
    record_count: int = Field(0, ge=0)
    column_count: int = Field(0, ge=0)
    
    # Statistics
    total_null_count: int = Field(0, ge=0)
    null_ratio: float = Field(0.0, ge=0.0, le=1.0)
    
    # Recommendations
    recommendations: List[str] = Field(default_factory=list)
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "valid": True,
                "errors": [],
                "warnings": ["Column 'notes' has 45% missing values"],
                "record_count": 1000,
                "column_count": 12,
                "total_null_count": 120,
                "null_ratio": 0.1
            }
        }
    }
