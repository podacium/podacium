from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime


class TrendingItem(BaseModel):
    entity_id: str
    entity_type: str
    title: str
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    score: float
    rank: int
    metadata: Optional[Dict[str, Any]] = None


class TrendingResponse(BaseModel):
    entity_type: str
    items: List[TrendingItem]
    calculated_at: datetime


class CalculateTrendingResponse(BaseModel):
    success: bool
    entity_type: str
    items_count: int
    message: str
