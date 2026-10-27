"""
Common schemas for BI module.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict


class BaseModel(BaseModel):
    """Base model with common configuration"""
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        use_enum_values=True,
        arbitrary_types_allowed=True,
    )


class BaseResponse(BaseModel):
    """Base response schema"""
    success: bool = True
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ErrorResponse(BaseResponse):
    """Error response schema"""
    success: bool = False
    error_type: str
    errors: Optional[List[Dict[str, Any]]] = None
    details: Optional[str] = None


class PaginationParams(BaseModel):
    """Pagination parameters"""
    page: int = Field(1, ge=1, description="Page number")
    per_page: int = Field(20, ge=1, le=100, description="Items per page")
    order_by: Optional[str] = None
    order_dir: Optional[str] = Field("desc", pattern="^(asc|desc)$")

class UserContext(BaseModel):
    """User context for BI operations"""
    user_id: int
    email: Optional[str] = None
    role: Optional[str] = None
    organization_id: Optional[int] = None


class OrganizationContext(BaseModel):
    """Organization context for BI operations"""
    organization_id: int
    name: Optional[str] = None


class DatasetFormat(str, Enum):
    """Dataset file formats"""
    CSV = "csv"
    JSON = "json"
    EXCEL = "excel"
    PARQUET = "parquet"


class DatasetStatus(str, Enum):
    """Dataset processing status"""
    UPLOADED = "UPLOADED"
    VALIDATED = "VALIDATED"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"
    ARCHIVED = "ARCHIVED"


class ProcessingStatus(str, Enum):
    """Pipeline processing status"""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class QualityLevel(str, Enum):
    """Data quality levels"""
    EXCELLENT = "EXCELLENT"
    ACCEPTABLE = "ACCEPTABLE"
    POOR = "POOR"


class ConfidenceLevel(str, Enum):
    """Confidence levels"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RiskLevel(str, Enum):
    """Risk levels"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class PriorityLevel(str, Enum):
    """Priority levels"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class FileMetadata(BaseModel):
    """File metadata"""
    filename: str
    content_type: Optional[str] = None
    size: int = Field(ge=0, description="File size in bytes")
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
