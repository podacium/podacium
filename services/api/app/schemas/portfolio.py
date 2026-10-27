from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any
from datetime import datetime


class PortfolioLink(BaseModel):
    url: str
    label: str


class PortfolioCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    media_urls: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    links: Optional[List[PortfolioLink]] = None


class PortfolioUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    media_urls: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    links: Optional[List[PortfolioLink]] = None


class PortfolioResponse(BaseModel):
    id: int
    userId: int
    title: str
    description: Optional[str] = None
    mediaUrls: List[str] = []
    tags: List[str] = []
    links: Optional[Any] = None
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PortfolioListResponse(BaseModel):
    items: List[PortfolioResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
