"""
Pydantic Schemas for BI Connectors, Semantic Models, and Row-Level Policies.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DataConnectorCreate(BaseModel):
    name: str = Field(..., description="Connector display name")
    engine: str = Field(
        "postgres", description="Database engine type (postgres, mysql, snowflake)"
    )
    host: str = Field(..., description="Target database hostname or IP")
    port: int = Field(5432, description="Target port number")
    databaseName: str = Field(..., description="Database name")
    username: str = Field(..., description="Database username")
    password: str = Field(..., description="Database password")
    ssl: bool = Field(False, description="Whether SSL is enabled")
    organizationId: Optional[int] = Field(None, description="Organization ID")


class DataConnectorResponse(BaseModel):
    id: int
    name: str
    engine: str
    host: str
    port: int
    databaseName: str
    ssl: bool
    organizationId: int
    createdById: int
    createdAt: datetime
    updatedAt: datetime


class DataConnectorListResponse(BaseModel):
    connectors: List[DataConnectorResponse]
    count: int


class SemanticModelCreate(BaseModel):
    name: str = Field(..., description="Semantic model name")
    description: Optional[str] = Field(None, description="Model description")
    datasetId: int = Field(..., description="Associated Dataset ID")
    organizationId: Optional[int] = Field(None, description="Organization ID")
    config: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Model configuration"
    )
    dimensions: Optional[List[Dict[str, Any]]] = Field(
        default_factory=list, description="Defined dimensions"
    )
    measures: Optional[List[Dict[str, Any]]] = Field(
        default_factory=list, description="Defined measures"
    )


class SemanticModelResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    datasetId: int
    organizationId: int
    config: Optional[Dict[str, Any]]
    dimensions: Optional[List[Dict[str, Any]]]
    measures: Optional[List[Dict[str, Any]]]
    createdAt: datetime
    updatedAt: datetime


class SemanticModelListResponse(BaseModel):
    models: List[SemanticModelResponse]
    count: int


class RowLevelPolicyCreate(BaseModel):
    id: Optional[int] = Field(
        None, description="Optional existing policy ID for updates"
    )
    name: str = Field(..., description="Policy name")
    datasetId: int = Field(..., description="Target dataset ID")
    organizationId: Optional[int] = Field(None, description="Organization ID")
    role: str = Field("VIEWER", description="Role to which policy applies")
    userAttribute: Optional[str] = Field(
        None, description="User attribute predicate key"
    )
    columnName: str = Field(..., description="Dataset column name")
    operator: str = Field("eq", description="Comparison operator (eq, ne, in, gt, lt)")
    valuePredicate: str = Field(..., description="Value or attribute placeholder")
    isActive: bool = Field(True, description="Whether policy is active")


class RowLevelPolicyResponse(BaseModel):
    id: int
    name: str
    datasetId: int
    organizationId: int
    role: str
    userAttribute: Optional[str]
    columnName: str
    operator: str
    valuePredicate: str
    isActive: bool
    createdAt: datetime
    updatedAt: datetime


class RowLevelPolicyListResponse(BaseModel):
    policies: List[RowLevelPolicyResponse]
    count: int
