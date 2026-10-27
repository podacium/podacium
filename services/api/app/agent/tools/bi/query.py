"""
BI Query Tools: PreviewDatasetSchemaTool, QueryDatasetSqlTool (with DuckDB AST gate and Claim Check offloading).
"""

import json
from typing import Any, Optional, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.security.sql_guardrail import DuckDbAstSecurityVisitor
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.agent.tools.claim_check import offload_to_claim_check
from app.core.prisma import prisma
from app.services.bi_services.query_engine import QueryEngine


class PreviewDatasetSchemaArgs(BaseModel):
    dataset_id: int = Field(description="ID of the dataset to inspect")


class PreviewDatasetSchemaTool(BaseTool):
    name = "preview_dataset_schema"
    description = "Inspect the schema, column types, row count, and preview sample rows of an analytical dataset."
    domain = ToolDomain.BI
    access_roles = ["USER", "ORGANIZATION_MEMBER", "ORGANIZATION_ADMIN", "ADMIN"]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = PreviewDatasetSchemaArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, PreviewDatasetSchemaArgs)

        dataset = await prisma.dataset.find_unique(where={"id": typed_args.dataset_id})
        if not dataset or dataset.deletedAt is not None:
            return ToolResult(
                success=False, error=f"Dataset {typed_args.dataset_id} not found"
            )

        if not context.has_role("ADMIN"):
            if dataset.organizationId is not None:
                if context.organization_id != dataset.organizationId:
                    return ToolResult(
                        success=False, error="Unauthorized access to dataset"
                    )
            else:
                if dataset.userId != context.user_id:
                    return ToolResult(
                        success=False, error="Unauthorized access to dataset"
                    )

        preview = dataset.previewRows
        if isinstance(preview, str):
            try:
                preview = json.loads(preview)
            except Exception:
                pass

        schema_info = dataset.schema_ or dataset.columns

        return ToolResult(
            success=True,
            data={
                "id": dataset.id,
                "name": dataset.name,
                "row_count": dataset.rowCount,
                "column_count": dataset.columnCount,
                "format": dataset.format,
                "schema": schema_info,
                "preview_sample": preview[:5] if isinstance(preview, list) else preview,
            },
            widget_payload={
                "widgetType": "dataset_schema_preview",
                "datasetId": dataset.id,
                "name": dataset.name,
                "rowCount": dataset.rowCount,
                "columnCount": dataset.columnCount,
            },
        )


class QueryDatasetSqlArgs(BaseModel):
    dataset_id: int = Field(description="Target dataset ID to query")
    sql_query: str = Field(
        description="Read-only SELECT SQL query for analytical computation"
    )
    limit: int = Field(default=50, ge=1, le=500, description="Max rows to return")


class QueryDatasetSqlTool(BaseTool):
    name = "query_dataset_sql"
    description = (
        "Execute a safe, read-only SQL aggregation/analytical query against a dataset using DuckDB. "
        "Large results are automatically offloaded to claim check."
    )
    domain = ToolDomain.BI
    access_roles = ["USER", "ORGANIZATION_MEMBER", "ORGANIZATION_ADMIN", "ADMIN"]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = QueryDatasetSqlArgs

    def __init__(self, claim_check_mgr=None):
        super().__init__()
        self.claim_check_mgr = claim_check_mgr

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, QueryDatasetSqlArgs)

        dataset = await prisma.dataset.find_unique(where={"id": typed_args.dataset_id})
        if not dataset or dataset.deletedAt is not None:
            return ToolResult(
                success=False, error=f"Dataset {typed_args.dataset_id} not found"
            )

        if not context.has_role("ADMIN"):
            if dataset.organizationId is not None:
                if context.organization_id != dataset.organizationId:
                    return ToolResult(
                        success=False, error="Unauthorized access to dataset"
                    )
            else:
                if dataset.userId != context.user_id:
                    return ToolResult(
                        success=False, error="Unauthorized access to dataset"
                    )

        if not dataset.filePath:
            return ToolResult(
                success=False, error="Dataset file is not available for querying"
            )

        # 1. AST Security Validation & Sanitization
        sanitized_sql = DuckDbAstSecurityVisitor.validate_and_sanitize(
            typed_args.sql_query,
            organization_id=context.organization_id,
        )

        # 2. Execution via QueryEngine with Row-Level Security enforcement
        try:
            results = await QueryEngine.query_dataset_with_rls(
                dataset.filePath,
                sanitized_sql,
                dataset_id=dataset.id,
                organization_id=context.organization_id,
            )
        except Exception as e:
            return ToolResult(success=False, error=f"SQL execution error: {str(e)}")

        # Limit rows
        limited_results = results[: typed_args.limit]

        # 3. Claim Check Offloading if results are large (> 20 rows or > 2KB)
        claim_check_urn: Optional[str] = None
        data_to_return: Any = limited_results

        if len(results) > 15:
            try:
                urn = await offload_to_claim_check(
                    namespace=f"bi_dataset_{dataset.id}",
                    data={"rows": results, "total_count": len(results)},
                    ttl_seconds=3600,
                )
                claim_check_urn = urn
                data_to_return = {
                    "total_rows": len(results),
                    "returned_sample": limited_results[:10],
                    "claim_check_urn": claim_check_urn,
                    "summary": f"Query returned {len(results)} rows. Full dataset offloaded to claim check {claim_check_urn}.",
                }
            except Exception:
                pass

        return ToolResult(
            success=True,
            data=data_to_return,
            claim_check_urn=claim_check_urn,
            widget_payload={
                "widgetType": "sql_query_result_table",
                "datasetId": dataset.id,
                "datasetName": dataset.name,
                "rowCount": len(results),
                "columns": list(results[0].keys()) if results else [],
                "sampleRows": limited_results[:10],
                "claimCheckUrn": claim_check_urn,
            },
        )
