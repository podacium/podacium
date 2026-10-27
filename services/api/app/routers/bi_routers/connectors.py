"""
External Database Connectors Router
Provides endpoints to test connections, fetch schemas, and query external databases (PostgreSQL, MySQL).
"""

import ipaddress
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user, verify_organization_access
from app.core.prisma import prisma
from app.schemas.bi_schemas.connector import (
    DataConnectorCreate,
    DataConnectorResponse,
    DataConnectorListResponse,
    SemanticModelCreate,
    SemanticModelResponse,
    SemanticModelListResponse,
    RowLevelPolicyCreate,
    RowLevelPolicyResponse,
    RowLevelPolicyListResponse,
)
from app.services.connectors.postgres_connector import PostgresConnector
from app.services.bi_services.query_engine import QueryEngine, QueryError
from app.services.bi_services.semantic.semantic_layer import SemanticLayer
from app.services.bi_services.cls_masking_service import CLSMaskingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/connectors", tags=["BI Database Connectors"])

RESTRICTED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"}


def validate_connector_host(host: str) -> str:
    """Validate database connector target host against SSRF and internal network probing."""
    cleaned_host = host.strip().lower()
    if cleaned_host in RESTRICTED_HOSTS or cleaned_host.endswith(
        (".internal", ".local")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Forbidden connector target host address",
        )
    try:
        ip = ipaddress.ip_address(cleaned_host)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Connector target host cannot be a private/internal IP address",
            )
    except ValueError:
        pass
    return host


class DatabaseConnectionRequest(BaseModel):
    engine: str = Field(
        "postgres", description="Database engine type (postgres, mysql)"
    )
    host: str = Field(..., description="Database host IP or hostname")
    port: int = Field(5432, description="Database port")
    database: str = Field(..., description="Database name")
    username: str = Field(..., description="Database username")
    password: str = Field(..., description="Database password")
    ssl: bool = Field(False, description="Use SSL connection")
    organizationId: Optional[int] = Field(None, description="Organization ID")


class SchemaFetchRequest(DatabaseConnectionRequest):
    tableName: str = Field(..., description="Target table name")


class ConnectorQueryRequest(DatabaseConnectionRequest):
    query: str = Field(..., description="SELECT query to execute")
    limit: int = Field(1000, ge=1, le=5000, description="Max rows to return")


@router.post("/test")
async def test_connection(
    request: DatabaseConnectionRequest,
    current_user=Depends(get_current_user),
):
    """Test connection credentials to an external database."""
    await verify_organization_access(request.organizationId, current_user)
    validate_connector_host(request.host)

    if request.engine.lower() in ["postgres", "postgresql"]:
        connector = PostgresConnector(
            host=request.host,
            port=request.port,
            database=request.database,
            user=request.username,
            password=request.password,
            ssl=request.ssl,
        )
        is_connected = await connector.test_connection()
        if not is_connected:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to connect to external PostgreSQL database",
            )
        return {"success": True, "message": "Connection test successful"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported database engine: {request.engine}",
        )


@router.post("/tables")
async def list_tables(
    request: DatabaseConnectionRequest,
    current_user=Depends(get_current_user),
):
    """List accessible tables in an external database."""
    await verify_organization_access(request.organizationId, current_user)
    validate_connector_host(request.host)

    connector = PostgresConnector(
        host=request.host,
        port=request.port,
        database=request.database,
        user=request.username,
        password=request.password,
        ssl=request.ssl,
    )
    tables = await connector.list_tables()
    return {"success": True, "tables": tables, "count": len(tables)}


@router.post("/schema")
async def fetch_schema(
    request: SchemaFetchRequest,
    current_user=Depends(get_current_user),
):
    """Fetch column schema for a given table in an external database."""
    await verify_organization_access(request.organizationId, current_user)
    validate_connector_host(request.host)

    connector = PostgresConnector(
        host=request.host,
        port=request.port,
        database=request.database,
        user=request.username,
        password=request.password,
        ssl=request.ssl,
    )
    columns = await connector.fetch_schema(request.tableName)
    return {"success": True, "table": request.tableName, "columns": columns}


@router.post("/query")
async def execute_connector_query(
    request: ConnectorQueryRequest,
    current_user=Depends(get_current_user),
):
    """Execute a query against an external database."""
    org_id = await verify_organization_access(request.organizationId, current_user)
    validate_connector_host(request.host)

    try:
        QueryEngine._validate_query(request.query)
    except QueryError as qe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid connector query: {str(qe)}",
        )

    from app.services.bi_services.audit_service import BIAuditService

    await BIAuditService.log_action(
        user_id=current_user.id,
        organization_id=org_id,
        action="EXECUTE_EXTERNAL_QUERY",
        resource_type="database",
        resource_id=request.database,
        details={
            "host": request.host,
            "engine": request.engine,
            "query_len": len(request.query),
        },
    )

    connector = PostgresConnector(
        host=request.host,
        port=request.port,
        database=request.database,
        user=request.username,
        password=request.password,
        ssl=request.ssl,
    )
    records = await connector.execute_query(request.query, limit=request.limit)
    return {"success": True, "count": len(records), "records": records}


@router.post("/save", response_model=DataConnectorResponse)
async def save_connector(
    request: DataConnectorCreate,
    current_user=Depends(get_current_user),
):
    """Save an external database connector securely to Prisma DB."""
    org_id = await verify_organization_access(request.organizationId, current_user)
    validate_connector_host(request.host)

    connector = await prisma.dataconnector.create(
        data={
            "name": request.name,
            "engine": request.engine,
            "encryptedHost": request.host,
            "port": request.port,
            "databaseName": request.databaseName,
            "encryptedUsername": request.username,
            "encryptedPassword": request.password,
            "ssl": request.ssl,
            "organizationId": org_id,
            "createdById": current_user.id,
        }
    )
    return DataConnectorResponse(
        id=connector.id,
        name=connector.name,
        engine=connector.engine,
        host=connector.encryptedHost,
        port=connector.port,
        databaseName=connector.databaseName,
        ssl=connector.ssl,
        organizationId=connector.organizationId,
        createdById=connector.createdById,
        createdAt=connector.createdAt,
        updatedAt=connector.updatedAt,
    )


@router.get("", response_model=DataConnectorListResponse)
async def list_saved_connectors(
    organizationId: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
):
    """List saved database connectors for an organization."""
    org_id = await verify_organization_access(organizationId, current_user)
    connectors = await prisma.dataconnector.find_many(
        where={"organizationId": org_id},
        order={"createdAt": "desc"},
    )
    results = [
        DataConnectorResponse(
            id=c.id,
            name=c.name,
            engine=c.engine,
            host=c.encryptedHost,
            port=c.port,
            databaseName=c.databaseName,
            ssl=c.ssl,
            organizationId=c.organizationId,
            createdById=c.createdById,
            createdAt=c.createdAt,
            updatedAt=c.updatedAt,
        )
        for c in connectors
    ]
    return DataConnectorListResponse(connectors=results, count=len(results))


# ---------------------------------------------------------------------------
# Semantic Models Endpoints
# ---------------------------------------------------------------------------


@router.post("/semantic-models/save", response_model=SemanticModelResponse)
async def save_semantic_model(
    request: SemanticModelCreate,
    current_user=Depends(get_current_user),
):
    """Save a semantic model definition (dimensions, measures, AST config)."""
    org_id = await verify_organization_access(request.organizationId, current_user)
    model_data = await SemanticLayer.create_semantic_model(
        name=request.name,
        dataset_id=request.datasetId,
        organization_id=org_id,
        description=request.description,
        config=request.config,
        dimensions=request.dimensions,
        measures=request.measures,
    )
    return SemanticModelResponse(**model_data)


@router.get("/semantic-models", response_model=SemanticModelListResponse)
async def list_semantic_models(
    organizationId: Optional[int] = Query(None),
    datasetId: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
):
    """List semantic models for an organization or dataset."""
    org_id = await verify_organization_access(organizationId, current_user)
    models_data = await SemanticLayer.list_semantic_models(
        organization_id=org_id, dataset_id=datasetId
    )
    results = [SemanticModelResponse(**m) for m in models_data]
    return SemanticModelListResponse(models=results, count=len(results))


@router.delete("/semantic-models/{model_id}")
async def delete_semantic_model(
    model_id: int,
    organizationId: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
):
    """Delete a semantic model by ID."""
    org_id = await verify_organization_access(organizationId, current_user)
    deleted = await SemanticLayer.delete_semantic_model(model_id, org_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semantic model not found or access denied",
        )
    return {"success": True, "message": f"Semantic model {model_id} deleted"}


# ---------------------------------------------------------------------------
# Row-Level Security Policies Endpoints
# ---------------------------------------------------------------------------


@router.post("/rls-policies/save", response_model=RowLevelPolicyResponse)
async def save_row_level_policy(
    request: RowLevelPolicyCreate,
    current_user=Depends(get_current_user),
):
    """Create and persist a row-level security policy predicate."""
    org_id = await verify_organization_access(request.organizationId, current_user)
    policy_data = await CLSMaskingService.save_row_level_policy(
        name=request.name,
        dataset_id=request.datasetId,
        organization_id=org_id,
        role=request.role,
        user_attribute=request.userAttribute,
        column_name=request.columnName,
        operator=request.operator,
        value_predicate=request.valuePredicate,
        is_active=request.isActive,
        policy_id=request.id,
    )
    return RowLevelPolicyResponse(**policy_data)


@router.get("/rls-policies", response_model=RowLevelPolicyListResponse)
async def list_row_level_policies(
    organizationId: Optional[int] = Query(None),
    datasetId: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
):
    """List row-level security policies for an organization or dataset."""
    org_id = await verify_organization_access(organizationId, current_user)
    policies_data = await CLSMaskingService.list_row_level_policies(
        organization_id=org_id, dataset_id=datasetId
    )
    results = [RowLevelPolicyResponse(**p) for p in policies_data]
    return RowLevelPolicyListResponse(policies=results, count=len(results))


@router.delete("/rls-policies/{policy_id}")
async def delete_row_level_policy(
    policy_id: int,
    organizationId: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
):
    """Delete a row-level security policy by ID."""
    org_id = await verify_organization_access(organizationId, current_user)
    deleted = await CLSMaskingService.delete_row_level_policy(policy_id, org_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Row-level policy not found or access denied",
        )
    return {"success": True, "message": f"Row-level policy {policy_id} deleted"}
