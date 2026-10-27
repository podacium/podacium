"""
Podacium Semantic Layer (PSL)
Provides declarative metric definitions, dimensional metadata, and secure AST SQL compilation.
"""

import logging
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field

from app.services.bi_services.query_engine import QueryEngine

logger = logging.getLogger(__name__)


class Dimension(BaseModel):
    name: str = Field(..., description="Unique dimension key e.g. 'wilaya'")
    column: str = Field(..., description="Physical SQL column e.g. 'customer_wilaya'")
    type: str = Field("string", description="Data type: string, number, date, boolean")
    label: str = Field(..., description="Display label e.g. 'Wilaya'")
    description: Optional[str] = Field(None, description="Optional description")


class Measure(BaseModel):
    name: str = Field(..., description="Unique measure key e.g. 'total_revenue'")
    expression: str = Field(
        ..., description="SQL aggregate expression e.g. 'SUM(amount)'"
    )
    label: str = Field(..., description="Display label e.g. 'Total Revenue'")
    format: Optional[str] = Field(
        "currency", description="Format: currency, percentage, number, integer"
    )
    description: Optional[str] = Field(None, description="Optional description")


class FilterCondition(BaseModel):
    dimension: str = Field(..., description="Target dimension name")
    operator: str = Field(
        "eq", description="Operator: eq, ne, gt, gte, lt, lte, in, like, between"
    )
    value: Any = Field(..., description="Filter comparison value or list of values")


class SortItem(BaseModel):
    field: str = Field(..., description="Dimension or measure name to sort by")
    direction: str = Field("ASC", description="Sort direction: ASC or DESC")


class MetricASTQuery(BaseModel):
    datasetPath: str = Field(..., description="Path to underlying Parquet dataset")
    dimensions: List[str] = Field(
        default_factory=list, description="Requested dimension names"
    )
    measures: List[str] = Field(
        default_factory=list, description="Requested measure names"
    )
    filters: Optional[Union[Dict[str, Any], List[FilterCondition]]] = Field(
        None, description="Filter conditions"
    )
    sorts: Optional[List[SortItem]] = Field(None, description="Sort ordering list")
    limit: int = Field(100, ge=1, le=10000)


class SemanticSchema(BaseModel):
    name: str = Field(..., description="Schema identifier")
    description: Optional[str] = Field(None)
    dimensions: List[Dimension] = Field(default_factory=list)
    measures: List[Measure] = Field(default_factory=list)


class PodaciumSemanticEngine:
    """Compiles metric AST requests into validated, secure DuckDB SQL queries."""

    @classmethod
    def _sanitize_col(cls, col_name: str) -> str:
        """Sanitize column/dimension name for safe SQL rendering."""
        clean = col_name.replace('"', "")
        return f'"{clean}"'

    @classmethod
    def compile_metric_query(
        cls,
        schema: SemanticSchema,
        request: MetricASTQuery,
        organization_id: Optional[int] = None,
        table_name: Optional[str] = None,
    ) -> str:
        """
        Compile MetricASTQuery into deterministic SQL with optional RLS tenant isolation.
        """
        dim_map = {d.name: d for d in schema.dimensions}
        meas_map = {m.name: m for m in schema.measures}

        select_parts = []
        group_parts = []

        for d_name in request.dimensions:
            if d_name in dim_map:
                dim = dim_map[d_name]
                col_expr = cls._sanitize_col(dim.column)
                select_parts.append(f'{col_expr} AS "{dim.name}"')
                group_parts.append(col_expr)

        for m_name in request.measures:
            if m_name in meas_map:
                meas = meas_map[m_name]
                select_parts.append(f'{meas.expression} AS "{meas.name}"')

        if not select_parts:
            select_parts = ["*"]

        select_sql = ", ".join(select_parts)
        from_table = table_name or f"read_parquet('{request.datasetPath}')"
        from_sql = f"FROM {from_table}"

        where_clauses = []
        if organization_id:
            where_clauses.append(f"organization_id = {int(organization_id)}")

        if request.filters:
            if isinstance(request.filters, dict):
                for k, v in request.filters.items():
                    if k in dim_map:
                        dim = dim_map[k]
                        col_name = cls._sanitize_col(dim.column)
                        if isinstance(v, str):
                            escaped = v.replace("'", "''")
                            where_clauses.append(f"{col_name} = '{escaped}'")
                        elif isinstance(v, (int, float)):
                            where_clauses.append(f"{col_name} = {v}")
            elif isinstance(request.filters, list):
                for f in request.filters:
                    if f.dimension in dim_map:
                        dim = dim_map[f.dimension]
                        col_name = cls._sanitize_col(dim.column)
                        op = f.operator.lower()
                        val = f.value

                        if op == "eq":
                            if isinstance(val, str):
                                escaped = val.replace("'", "''")
                                where_clauses.append(f"{col_name} = '{escaped}'")
                            else:
                                where_clauses.append(f"{col_name} = {val}")
                        elif op == "ne":
                            if isinstance(val, str):
                                escaped = val.replace("'", "''")
                                where_clauses.append(f"{col_name} != '{escaped}'")
                            else:
                                where_clauses.append(f"{col_name} != {val}")
                        elif op in ["gt", "gte", "lt", "lte"]:
                            sql_op = {"gt": ">", "gte": ">=", "lt": "<", "lte": "<="}[
                                op
                            ]
                            if isinstance(val, (int, float)):
                                where_clauses.append(f"{col_name} {sql_op} {val}")
                        elif op == "like" and isinstance(val, str):
                            escaped = val.replace("'", "''")
                            where_clauses.append(f"{col_name} LIKE '%{escaped}%'")
                        elif op == "in" and isinstance(val, list) and val:
                            formatted = []
                            for v in val:
                                if isinstance(v, str):
                                    v_escaped = str(v).replace("'", "''")
                                    formatted.append(f"'{v_escaped}'")
                                elif isinstance(v, (int, float)):
                                    formatted.append(str(v))
                            if formatted:
                                where_clauses.append(
                                    f"{col_name} IN ({', '.join(formatted)})"
                                )

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        sql = f"SELECT {select_sql} {from_sql} {where_sql}".strip()

        if group_parts:
            sql += " GROUP BY " + ", ".join(group_parts)

        if request.sorts:
            sort_clauses = []
            for s in request.sorts:
                direction = "DESC" if s.direction.upper() == "DESC" else "ASC"
                if s.field in dim_map or s.field in meas_map:
                    sort_clauses.append(f'"{s.field}" {direction}')
            if sort_clauses:
                sql += " ORDER BY " + ", ".join(sort_clauses)

        limit_val = min(max(request.limit, 1), 10000)
        sql += f" LIMIT {limit_val}"

        return sql

    @classmethod
    def execute_metric_query(
        cls,
        schema: SemanticSchema,
        request: MetricASTQuery,
        organization_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Compile and execute MetricASTQuery securely via in-memory registered table.
        """
        safe_path = QueryEngine._validate_path_security(request.datasetPath)
        con = QueryEngine.get_connection()
        try:
            table_name = QueryEngine._register_dataset_table(con, safe_path)
            sql = cls.compile_metric_query(
                schema, request, organization_id=organization_id, table_name=table_name
            )
            result = con.execute(sql).fetchall()
            columns = [desc[0] for desc in con.description]
            return [dict(zip(columns, row)) for row in result]
        finally:
            QueryEngine.release_connection(con)

    @classmethod
    async def create_semantic_model(
        cls,
        name: str,
        dataset_id: int,
        organization_id: int,
        description: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
        dimensions: Optional[List[Dict[str, Any]]] = None,
        measures: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Persist a new SemanticModel record in Prisma DB."""
        from app.core.prisma import prisma
        from app.generated.prisma import Json

        record = await prisma.semanticmodel.create(
            data={
                "name": name,
                "description": description,
                "datasetId": dataset_id,
                "organizationId": organization_id,
                "config": Json(config or {}),
                "dimensions": Json(dimensions or []),
                "measures": Json(measures or []),
            }
        )
        return record.model_dump()

    @classmethod
    async def list_semantic_models(
        cls, organization_id: int, dataset_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Fetch semantic models for an organization from Prisma DB."""
        from app.core.prisma import prisma

        where: Dict[str, Any] = {"organizationId": organization_id}
        if dataset_id:
            where["datasetId"] = dataset_id

        records = await prisma.semanticmodel.find_many(
            where=where,
            order={"createdAt": "desc"},
        )
        return [r.model_dump() for r in records]

    @classmethod
    async def get_semantic_model(
        cls, model_id: int, organization_id: int
    ) -> Optional[Dict[str, Any]]:
        """Retrieve a specific SemanticModel by ID."""
        from app.core.prisma import prisma

        record = await prisma.semanticmodel.find_unique(where={"id": model_id})
        if record and record.organizationId == organization_id:
            return record.model_dump()
        return None

    @classmethod
    async def delete_semantic_model(cls, model_id: int, organization_id: int) -> bool:
        """Delete a SemanticModel record from Prisma DB."""
        from app.core.prisma import prisma

        record = await prisma.semanticmodel.find_unique(where={"id": model_id})
        if record and record.organizationId == organization_id:
            await prisma.semanticmodel.delete(where={"id": model_id})
            return True
        return False


SemanticLayer = PodaciumSemanticEngine
