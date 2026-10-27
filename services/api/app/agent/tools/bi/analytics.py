"""
BI Analytics Tools: GetDatasetKpisTool.
"""

from typing import Any, Dict, List, Optional, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.core.prisma import prisma
from app.services.bi_services.query_engine import QueryEngine


class GetDatasetKpisArgs(BaseModel):
    dataset_id: int = Field(description="ID of the dataset")
    metric_columns: Optional[List[str]] = Field(
        default=None, description="Optional list of numeric columns to compute KPIs for"
    )


class GetDatasetKpisTool(BaseTool):
    name = "get_dataset_kpis"
    description = "Compute summary statistical KPIs (total, average, min, max, count) on dataset columns."
    domain = ToolDomain.BI
    access_roles = ["USER", "ORGANIZATION_MEMBER", "ORGANIZATION_ADMIN", "ADMIN"]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = GetDatasetKpisArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, GetDatasetKpisArgs)

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

        kpis: Dict[str, Any] = {
            "total_rows": dataset.rowCount or 0,
            "total_columns": dataset.columnCount or 0,
            "quality_score": dataset.qualityScore,
            "column_metrics": {},
        }

        if dataset.filePath and typed_args.metric_columns:
            valid_cols = []
            select_clauses = []
            for i, col in enumerate(typed_args.metric_columns[:5]):
                try:
                    clean_col = QueryEngine._sanitize_identifier(col)
                    select_clauses.append(
                        f"COUNT({clean_col}) as cnt_{i}, "
                        f"AVG({clean_col}) as avg_val_{i}, "
                        f"MIN({clean_col}) as min_val_{i}, "
                        f"MAX({clean_col}) as max_val_{i}"
                    )
                    valid_cols.append((i, col))
                except Exception:
                    pass

            if select_clauses:
                try:
                    query = f"SELECT {', '.join(select_clauses)} FROM dataset"
                    rows = QueryEngine.query_dataset(dataset.filePath, query)
                    if rows:
                        row = rows[0]
                        for i, col in valid_cols:
                            kpis["column_metrics"][col] = {
                                "cnt": row.get(f"cnt_{i}"),
                                "avg_val": row.get(f"avg_val_{i}"),
                                "min_val": row.get(f"min_val_{i}"),
                                "max_val": row.get(f"max_val_{i}"),
                            }
                except Exception:
                    pass

        return ToolResult(
            success=True,
            data=kpis,
            widget_payload={
                "widgetType": "dataset_kpi_summary_card",
                "datasetId": dataset.id,
                "datasetName": dataset.name,
                "kpis": kpis,
            },
        )
