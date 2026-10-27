"""
Star-Schema Join Engine Service
Executes high-performance relational joins between fact tables and dimension datasets using DuckDB.
"""

import logging
import math
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.services.bi_services.errors import BIError
from app.services.bi_services.query_engine import QueryEngine

logger = logging.getLogger(__name__)


class JoinClause(BaseModel):
    dimensionFilePath: str = Field(
        ..., description="Path to dimension dataset (Parquet/CSV)"
    )
    dimensionAlias: str = Field(
        ..., description="Alias for dimension table e.g. 'dim_customer'"
    )
    joinType: str = Field("INNER", description="Join type: INNER, LEFT, RIGHT, FULL")
    factColumn: str = Field(..., description="Column on fact table e.g. 'customer_id'")
    dimensionColumn: str = Field(..., description="Column on dimension table e.g. 'id'")


class StarSchemaQueryRequest(BaseModel):
    factFilePath: str = Field(..., description="Path to primary fact dataset")
    joins: List[JoinClause] = Field(
        default_factory=list, description="Dimension join definitions"
    )
    selectColumns: List[str] = Field(
        default_factory=list, description="Columns/expressions to select"
    )
    groupBy: List[str] = Field(default_factory=list, description="Group by columns")
    filters: Optional[Dict[str, Any]] = Field(
        None, description="Where filter key-value conditions"
    )
    limit: int = Field(1000, ge=1, le=100000, description="Max rows to return")
    offset: int = Field(
        0,
        ge=0,
        description="Number of rows to skip for server-side pagination pushdown",
    )
    orderBy: List[str] = Field(
        default_factory=list,
        description="Optional list of column expressions for ordering e.g. ['fact.amount DESC']",
    )


class StarSchemaEngine:
    """Service for building and executing multi-table star-schema analytical queries."""

    @classmethod
    def infer_join_candidates(
        cls, fact_file_path: str, dimension_file_path: str
    ) -> List[Dict[str, str]]:
        """
        Scan schemas of fact and dimension datasets to suggest likely FK joins (e.g., customer_id -> id).
        """
        try:
            fact_schema = QueryEngine.get_dataset_schema(fact_file_path)
            dim_schema = QueryEngine.get_dataset_schema(dimension_file_path)
            fact_cols = {col["name"].lower(): col["name"] for col in fact_schema}
            dim_cols = {col["name"].lower(): col["name"] for col in dim_schema}

            candidates = []
            for f_lower, f_actual in fact_cols.items():
                if f_lower in dim_cols:
                    candidates.append(
                        {
                            "fact_column": f_actual,
                            "dimension_column": dim_cols[f_lower],
                            "match_type": "exact",
                        }
                    )
                elif f_lower.endswith("_id") and f_lower[:-3] in dim_cols:
                    candidates.append(
                        {
                            "fact_column": f_actual,
                            "dimension_column": dim_cols[f_lower[:-3]],
                            "match_type": "suffix",
                        }
                    )
                elif (
                    f_lower == "id"
                    and f"{dim_cols.get('name', 'table')}_id" in fact_cols
                ):
                    candidates.append(
                        {
                            "fact_column": fact_cols[
                                f"{dim_cols.get('name', 'table')}_id"
                            ],
                            "dimension_column": f_actual,
                            "match_type": "id_prefix",
                        }
                    )

            return candidates
        except Exception as e:
            logger.warning(f"Failed to infer join candidates: {e}")
            return []

    @classmethod
    def execute_star_query(
        cls, request: StarSchemaQueryRequest, organization_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Build and run DuckDB query joining fact dataset with dimension tables.
        Uses parameterized bindings to prevent AST escape and registers tables
        for secure execution under locked external access.
        """
        con = QueryEngine.get_connection()
        fact_table = QueryEngine._register_dataset_table(con, request.factFilePath)

        from_sql = f"FROM {fact_table} AS fact"
        join_sqls = []

        for idx, j in enumerate(request.joins):
            dim_table = QueryEngine._register_dataset_table(con, j.dimensionFilePath)
            alias = QueryEngine._sanitize_identifier(j.dimensionAlias or f"dim_{idx}")
            fact_col = QueryEngine._sanitize_identifier(j.factColumn)
            dim_col = QueryEngine._sanitize_identifier(j.dimensionColumn)
            join_type = (
                j.joinType.upper()
                if j.joinType.upper() in ["INNER", "LEFT", "RIGHT", "FULL"]
                else "LEFT"
            )

            join_sqls.append(
                f'{join_type} JOIN {dim_table} AS {alias} ON fact."{fact_col}" = {alias}."{dim_col}"'
            )

        join_block = " ".join(join_sqls)

        if request.selectColumns:
            formatted_selects = []
            for col in request.selectColumns:
                col_str = str(col).strip()
                agg_match = re.match(
                    r"^(SUM|COUNT|AVG|MIN|MAX)\s*\(\s*([\w\.\*]+)\s*\)(?:\s+(?:AS\s+)?([\w]+))?$",
                    col_str,
                    re.IGNORECASE,
                )
                if agg_match:
                    func = agg_match.group(1).upper()
                    inner = agg_match.group(2).strip()
                    alias = agg_match.group(3)
                    if inner == "*":
                        clean_inner = "*"
                    elif "." in inner:
                        tbl, c = inner.split(".", 1)
                        clean_inner = f'{QueryEngine._sanitize_identifier(tbl)}."{QueryEngine._sanitize_identifier(c)}"'
                    else:
                        clean_inner = (
                            f'fact."{QueryEngine._sanitize_identifier(inner)}"'
                        )
                    expr = f"{func}({clean_inner})"
                    if alias:
                        expr += f' AS "{QueryEngine._sanitize_identifier(alias)}"'
                    formatted_selects.append(expr)
                elif "." in col_str:
                    tbl, c = col_str.split(".", 1)
                    s_tbl = QueryEngine._sanitize_identifier(tbl)
                    s_c = QueryEngine._sanitize_identifier(c)
                    formatted_selects.append(f'{s_tbl}."{s_c}"')
                else:
                    s_c = QueryEngine._sanitize_identifier(col_str)
                    formatted_selects.append(f'fact."{s_c}"')
            select_sql = ", ".join(formatted_selects)
        else:
            select_sql = "fact.*"

        sql = f"SELECT {select_sql} {from_sql} {join_block}"

        params: List[Any] = []
        where_clauses: List[str] = []
        if organization_id:
            where_clauses.append("fact.organization_id = ?")
            params.append(int(organization_id))

        if request.filters:
            for col, val in request.filters.items():
                if "." in col:
                    tbl, c = col.split(".", 1)
                    s_col = f'{QueryEngine._sanitize_identifier(tbl)}."{QueryEngine._sanitize_identifier(c)}"'
                else:
                    s_col = f'fact."{QueryEngine._sanitize_identifier(col)}"'

                if isinstance(val, bool):
                    where_clauses.append(f"{s_col} = ?")
                    params.append(val)
                elif isinstance(val, (int, float)):
                    if not math.isfinite(val):
                        raise ValueError("Non-finite numeric filter value not allowed")
                    where_clauses.append(f"{s_col} = ?")
                    params.append(val)
                elif isinstance(val, str):
                    where_clauses.append(f"{s_col} = ?")
                    params.append(val)
                elif isinstance(val, list) and val:
                    placeholders = ", ".join(["?" for _ in val])
                    where_clauses.append(f"{s_col} IN ({placeholders})")
                    params.extend(val)

        if where_clauses:
            sql += " WHERE " + " AND ".join(where_clauses)

        if request.groupBy:
            group_cols = []
            for g in request.groupBy:
                if "." in g:
                    tbl, c = g.split(".", 1)
                    group_cols.append(
                        f'{QueryEngine._sanitize_identifier(tbl)}."{QueryEngine._sanitize_identifier(c)}"'
                    )
                else:
                    group_cols.append(f'fact."{QueryEngine._sanitize_identifier(g)}"')
            sql += " GROUP BY " + ", ".join(group_cols)

        if request.orderBy:
            order_clauses = []
            for item in request.orderBy:
                raw_parts = item.strip().split()
                if not raw_parts:
                    continue
                col_ref = raw_parts[0]
                direction = (
                    "DESC"
                    if len(raw_parts) > 1 and raw_parts[1].upper() == "DESC"
                    else "ASC"
                )
                if "." in col_ref:
                    tbl, c = col_ref.split(".", 1)
                    order_clauses.append(
                        f'{QueryEngine._sanitize_identifier(tbl)}."{QueryEngine._sanitize_identifier(c)}" {direction}'
                    )
                else:
                    order_clauses.append(
                        f'fact."{QueryEngine._sanitize_identifier(col_ref)}" {direction}'
                    )
            if order_clauses:
                sql += " ORDER BY " + ", ".join(order_clauses)

        limit_val = min(max(request.limit, 1), 100000)
        offset_val = max(getattr(request, "offset", 0) or 0, 0)
        sql += f" LIMIT {limit_val} OFFSET {offset_val}"

        try:
            import pandas as pd

            logger.info(f"Executing Star-Schema Query: {sql[:200]}")
            if params:
                result_df = con.execute(sql, params).df()
            else:
                result_df = con.query(sql).df()
            result_df = result_df.where(pd.notnull(result_df), None)
            return result_df.to_dict(orient="records")
        except Exception as e:
            logger.exception(f"Star-Schema Query execution failed: {e}")
            raise BIError(
                f"Star-schema query failed: {str(e)}", "star_query_failed"
            ) from e

    @classmethod
    def execute_paginated_star_query(
        cls, request: StarSchemaQueryRequest, organization_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Execute star-schema query with server-side limit and offset pushdown,
        returning total row count, page metadata, and paginated records.
        Prevents unbounded memory consumption and browser DOM bloat on drill-through.
        """
        con = QueryEngine.get_connection()
        fact_table = QueryEngine._register_dataset_table(con, request.factFilePath)

        from_sql = f"FROM {fact_table} AS fact"
        join_sqls = []

        for idx, j in enumerate(request.joins):
            dim_table = QueryEngine._register_dataset_table(con, j.dimensionFilePath)
            alias = QueryEngine._sanitize_identifier(j.dimensionAlias or f"dim_{idx}")
            fact_col = QueryEngine._sanitize_identifier(j.factColumn)
            dim_col = QueryEngine._sanitize_identifier(j.dimensionColumn)
            join_type = (
                j.joinType.upper()
                if j.joinType.upper() in ["INNER", "LEFT", "RIGHT", "FULL"]
                else "LEFT"
            )
            join_sqls.append(
                f'{join_type} JOIN {dim_table} AS {alias} ON fact."{fact_col}" = {alias}."{dim_col}"'
            )

        join_block = " ".join(join_sqls)

        params: List[Any] = []
        where_clauses: List[str] = []
        if organization_id:
            where_clauses.append("fact.organization_id = ?")
            params.append(int(organization_id))

        if request.filters:
            for col, val in request.filters.items():
                if "." in col:
                    tbl, c = col.split(".", 1)
                    s_col = f'{QueryEngine._sanitize_identifier(tbl)}."{QueryEngine._sanitize_identifier(c)}"'
                else:
                    s_col = f'fact."{QueryEngine._sanitize_identifier(col)}"'

                if isinstance(val, bool):
                    where_clauses.append(f"{s_col} = ?")
                    params.append(val)
                elif isinstance(val, (int, float)):
                    if not math.isfinite(val):
                        raise ValueError("Non-finite numeric filter value not allowed")
                    where_clauses.append(f"{s_col} = ?")
                    params.append(val)
                elif isinstance(val, str):
                    where_clauses.append(f"{s_col} = ?")
                    params.append(val)
                elif isinstance(val, list) and val:
                    placeholders = ", ".join(["?" for _ in val])
                    where_clauses.append(f"{s_col} IN ({placeholders})")
                    params.extend(val)

        where_sql = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        # Server-side COUNT(*) pushdown
        group_cols = []
        if request.groupBy:
            for g in request.groupBy:
                if "." in g:
                    tbl, c = g.split(".", 1)
                    group_cols.append(
                        f'{QueryEngine._sanitize_identifier(tbl)}."{QueryEngine._sanitize_identifier(c)}"'
                    )
                else:
                    group_cols.append(f'fact."{QueryEngine._sanitize_identifier(g)}"')

        if group_cols:
            count_sql = f"SELECT COUNT(*) FROM (SELECT 1 {from_sql} {join_block}{where_sql} GROUP BY {', '.join(group_cols)}) AS _subq"
        else:
            count_sql = f"SELECT COUNT(*) {from_sql} {join_block}{where_sql}"

        total_count = 0
        try:
            if params:
                count_res = con.execute(count_sql, params).fetchone()
            else:
                count_res = con.query(count_sql).fetchone()
            total_count = int(count_res[0]) if count_res else 0
        except Exception as e:
            logger.warning(f"Failed to calculate exact star count: {e}")

        # Fetch the exact page slice
        items = cls.execute_star_query(request, organization_id=organization_id)
        limit_val = min(max(request.limit, 1), 100000)
        offset_val = max(getattr(request, "offset", 0) or 0, 0)
        current_page = (offset_val // limit_val) + 1 if limit_val > 0 else 1
        total_pages = (
            math.ceil(total_count / limit_val)
            if limit_val > 0 and total_count > 0
            else 1
        )

        return {
            "items": items,
            "total": total_count,
            "limit": limit_val,
            "offset": offset_val,
            "page": current_page,
            "total_pages": total_pages,
            "has_more": (offset_val + len(items)) < total_count,
        }

    @classmethod
    def execute_drill_through(
        cls,
        fact_file_path: str,
        dimension_joins: Optional[List[JoinClause]] = None,
        filters: Optional[Dict[str, Any]] = None,
        select_columns: Optional[List[str]] = None,
        limit: int = 50,
        offset: int = 0,
        order_by: Optional[List[str]] = None,
        organization_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Specialized drill-through invocation returning paginated granular underlying rows.
        """
        req = StarSchemaQueryRequest(
            factFilePath=fact_file_path,
            joins=dimension_joins or [],
            selectColumns=select_columns or [],
            filters=filters,
            limit=limit,
            offset=offset,
            orderBy=order_by or [],
        )
        return cls.execute_paginated_star_query(req, organization_id=organization_id)

    @classmethod
    def execute_star_query_arrow(
        cls, request: StarSchemaQueryRequest, organization_id: Optional[int] = None
    ) -> bytes:
        """
        Execute star query and stream result as zero-copy Apache Arrow IPC binary stream.
        """
        import io

        try:
            import pyarrow.ipc as ipc
        except ImportError as exc:
            raise BIError(
                "Apache Arrow IPC support requires pyarrow installed on the server",
                "pyarrow_missing",
            ) from exc

        con = QueryEngine.get_connection()
        fact_table = QueryEngine._register_dataset_table(con, request.factFilePath)

        from_sql = f"FROM {fact_table} AS fact"
        join_sqls = []

        for idx, j in enumerate(request.joins):
            dim_table = QueryEngine._register_dataset_table(con, j.dimensionFilePath)
            alias = QueryEngine._sanitize_identifier(j.dimensionAlias or f"dim_{idx}")
            fact_col = QueryEngine._sanitize_identifier(j.factColumn)
            dim_col = QueryEngine._sanitize_identifier(j.dimensionColumn)
            join_type = (
                j.joinType.upper()
                if j.joinType.upper() in ["INNER", "LEFT", "RIGHT", "FULL"]
                else "LEFT"
            )
            join_sqls.append(
                f'{join_type} JOIN {dim_table} AS {alias} ON fact."{fact_col}" = {alias}."{dim_col}"'
            )

        join_block = " ".join(join_sqls)

        if request.selectColumns:
            formatted_selects = []
            for col in request.selectColumns:
                col_str = str(col).strip()
                agg_match = re.match(
                    r"^(SUM|COUNT|AVG|MIN|MAX)\s*\(\s*([\w\.\*]+)\s*\)(?:\s+(?:AS\s+)?([\w]+))?$",
                    col_str,
                    re.IGNORECASE,
                )
                if agg_match:
                    func = agg_match.group(1).upper()
                    inner = agg_match.group(2).strip()
                    alias = agg_match.group(3)
                    clean_inner = (
                        "*"
                        if inner == "*"
                        else (
                            f'{QueryEngine._sanitize_identifier(inner.split(".", 1)[0])}."{QueryEngine._sanitize_identifier(inner.split(".", 1)[1])}"'
                            if "." in inner
                            else f'fact."{QueryEngine._sanitize_identifier(inner)}"'
                        )
                    )
                    expr = f"{func}({clean_inner})"
                    if alias:
                        expr += f' AS "{QueryEngine._sanitize_identifier(alias)}"'
                    formatted_selects.append(expr)
                elif "." in col_str:
                    tbl, c = col_str.split(".", 1)
                    formatted_selects.append(
                        f'{QueryEngine._sanitize_identifier(tbl)}."{QueryEngine._sanitize_identifier(c)}"'
                    )
                else:
                    formatted_selects.append(
                        f'fact."{QueryEngine._sanitize_identifier(col_str)}"'
                    )
            select_sql = ", ".join(formatted_selects)
        else:
            select_sql = "fact.*"

        sql = f"SELECT {select_sql} {from_sql} {join_block}"

        params: List[Any] = []
        where_clauses: List[str] = []
        if organization_id:
            where_clauses.append("fact.organization_id = ?")
            params.append(int(organization_id))

        if request.filters:
            for col, val in request.filters.items():
                if "." in col:
                    tbl, c = col.split(".", 1)
                    s_col = f'{QueryEngine._sanitize_identifier(tbl)}."{QueryEngine._sanitize_identifier(c)}"'
                else:
                    s_col = f'fact."{QueryEngine._sanitize_identifier(col)}"'

                if isinstance(val, bool):
                    where_clauses.append(f"{s_col} = ?")
                    params.append(val)
                elif isinstance(val, (int, float)):
                    if not math.isfinite(val):
                        raise ValueError("Non-finite numeric filter value not allowed")
                    where_clauses.append(f"{s_col} = ?")
                    params.append(val)
                elif isinstance(val, str):
                    where_clauses.append(f"{s_col} = ?")
                    params.append(val)
                elif isinstance(val, list) and val:
                    placeholders = ", ".join(["?" for _ in val])
                    where_clauses.append(f"{s_col} IN ({placeholders})")
                    params.extend(val)

        if where_clauses:
            sql += " WHERE " + " AND ".join(where_clauses)

        if request.groupBy:
            group_cols = []
            for g in request.groupBy:
                if "." in g:
                    tbl, c = g.split(".", 1)
                    group_cols.append(
                        f'{QueryEngine._sanitize_identifier(tbl)}."{QueryEngine._sanitize_identifier(c)}"'
                    )
                else:
                    group_cols.append(f'fact."{QueryEngine._sanitize_identifier(g)}"')
            sql += " GROUP BY " + ", ".join(group_cols)

        if request.orderBy:
            order_clauses = []
            for item in request.orderBy:
                raw_parts = item.strip().split()
                if not raw_parts:
                    continue
                col_ref = raw_parts[0]
                direction = (
                    "DESC"
                    if len(raw_parts) > 1 and raw_parts[1].upper() == "DESC"
                    else "ASC"
                )
                if "." in col_ref:
                    tbl, c = col_ref.split(".", 1)
                    order_clauses.append(
                        f'{QueryEngine._sanitize_identifier(tbl)}."{QueryEngine._sanitize_identifier(c)}" {direction}'
                    )
                else:
                    order_clauses.append(
                        f'fact."{QueryEngine._sanitize_identifier(col_ref)}" {direction}'
                    )
            if order_clauses:
                sql += " ORDER BY " + ", ".join(order_clauses)

        limit_val = min(max(request.limit, 1), 100000)
        offset_val = max(getattr(request, "offset", 0) or 0, 0)
        sql += f" LIMIT {limit_val} OFFSET {offset_val}"

        try:
            if params:
                arrow_table = con.execute(sql, params).arrow()
            else:
                arrow_table = con.query(sql).arrow()

            sink = io.BytesIO()
            writer = ipc.new_stream(sink, arrow_table.schema)
            for batch in arrow_table.to_batches():
                writer.write_batch(batch)
            writer.close()
            return sink.getvalue()
        except Exception as e:
            logger.exception(f"Arrow IPC Star-Schema Query execution failed: {e}")
            raise BIError(
                f"Arrow IPC star-schema query failed: {str(e)}",
                "star_arrow_query_failed",
            ) from e
