from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional, Dict


class UploadTicketRequest(BaseModel):
    filename: str = Field(..., description="Original filename with extension")
    category: str = Field(
        "attachments",
        description="Category: avatars, attachments, datasets, invoices, courses",
    )
    content_type: str = Field(..., description="Detected MIME content type")
    size: int = Field(..., description="File size in bytes")


class UploadTicketResponse(BaseModel):
    upload_url: str = Field(
        ..., description="Target URL for direct upload or local endpoint"
    )
    file_key: str = Field(..., description="Generated storage key")
    method: str = Field("PUT", description="HTTP method: PUT or POST")
    headers: Optional[Dict[str, str]] = Field(
        None, description="Headers required for upload"
    )
    is_cloud: bool = Field(
        False, description="True if uploading directly to cloud/edge storage"
    )
    category: str = Field("attachments", description="File category")
    expires_in_seconds: int = Field(900, description="Ticket expiry in seconds")
    driver_name: str = Field("local", description="Storage driver handling this file")


class ConfirmUploadRequest(BaseModel):
    file_key: str = Field(..., description="Storage key from upload ticket")
    filename: str = Field(..., description="Original filename")
    category: str = Field("attachments", description="File category")
    size: int = Field(..., description="File size in bytes")
    content_type: str = Field(..., description="MIME content type")


class FileResponse(BaseModel):
    id: int
    filename: str
    url: str
    size: int
    content_type: str
    owner_id: int
    category: str
    created_at: datetime
    is_sovereign: Optional[bool] = Field(
        True, description="True if stored on sovereign national infrastructure"
    )
    driver: Optional[str] = Field("local", description="Storage driver name")

    model_config = ConfigDict(from_attributes=True)
