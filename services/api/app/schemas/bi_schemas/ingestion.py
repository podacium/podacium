"""
Dataset ingestion schemas.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, field_validator

from .common import DatasetFormat, DatasetStatus


class OrganizationBaseProxy(BaseModel):
    id: int
    name: str
    description: Optional[str] = None


class UploaderProxy(BaseModel):
    id: int
    fullName: str
    email: Optional[str] = None
    profilePictureUrl: Optional[str] = None


class DatasetCreate(BaseModel):
    """Dataset creation request"""

    name: str = Field(..., min_length=1, max_length=200, description="Dataset name")
    description: Optional[str] = Field(None, max_length=1000)
    domain: Optional[str] = Field(
        None, description="Business domain: sales/finance/hr/etc."
    )
    organization_id: Optional[int] = Field(
        None, description="Organization ID (required if user has multiple orgs)"
    )


class DatasetUpload(BaseModel):
    """Dataset upload metadata"""

    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    domain: Optional[str] = None
    organization_id: Optional[int] = None


class DatasetUpdate(BaseModel):
    """Dataset metadata update request"""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    domain: Optional[str] = Field(None)


class JSONIngestionRequest(BaseModel):
    """JSON data ingestion request"""

    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    domain: Optional[str] = None
    organization_id: Optional[int] = None
    records: List[Dict[str, Any]] = Field(..., min_length=1, description="Data records")

    @field_validator("records")
    @classmethod
    def validate_records(cls, v):
        if not v:
            raise ValueError("Records cannot be empty")
        return v


class DatasetMetadata(BaseModel):
    """Dataset metadata response"""

    dataset_id: str = Field(..., description="Unique dataset identifier")
    name: str
    description: Optional[str] = None
    domain: Optional[str] = None
    format: Optional[DatasetFormat] = None
    original_filename: Optional[str] = None

    # Multi-tenancy
    organization_id: Optional[int] = None
    organization: Optional[OrganizationBaseProxy] = None
    uploaded_by: int = Field(..., description="User ID of uploader")
    uploader: Optional[UploaderProxy] = None

    # Stats
    row_count: int = Field(0, ge=0)
    column_count: int = Field(0, ge=0)
    columns: List[Union[str, Dict[str, Any]]] = Field(default_factory=list)
    file_size: Optional[int] = None

    # Status
    status: DatasetStatus = Field(default=DatasetStatus.UPLOADED)
    quality_score: Optional[float] = Field(None, ge=0, le=100)
    quality_metrics: Optional[Dict[str, Any]] = None
    column_metadata: Optional[Dict[str, Any]] = None

    # Timestamps
    created_at: datetime
    updated_at: datetime
    processed_at: Optional[datetime] = None

    # Sample data (for preview)
    sample_records: Optional[List[Dict[str, Any]]] = Field(None, max_length=5)

    model_config = {
        "json_schema_extra": {
            "example": {
                "dataset_id": "cldt4n3v7000008ju0v9u4k5f",
                "name": "Q4 Sales Data",
                "domain": "sales",
                "format": "csv",
                "organization_id": 123,
                "uploaded_by": 456,
                "row_count": 1000,
                "column_count": 15,
                "columns": ["date", "product", "region", "sales"],
                "status": "UPLOADED",
                "created_at": "2024-01-15T10:30:00Z",
            }
        }
    }


class DatasetResponse(BaseModel):
    """Full dataset response"""

    success: bool = True
    dataset: DatasetMetadata
    message: Optional[str] = None


class HistoryEvent(BaseModel):
    action: str
    user_id: Any
    timestamp: str
    details: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class HistoryResponse(BaseModel):
    success: bool = True
    history: List[HistoryEvent]
    message: Optional[str] = None


class DatasetListResponse(BaseModel):
    """Dataset list response"""

    success: bool = True
    datasets: List[DatasetMetadata]
    total: int = Field(0, ge=0)
    page: int = Field(1, ge=1)
    per_page: int = Field(20, ge=1, le=100)
    has_more: bool = False
    message: Optional[str] = None
