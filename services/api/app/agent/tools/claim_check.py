"""
services/api/app/agent/tools/claim_check.py
High-Volume Payload Claim Check Manager with Dual-Tier Storage (Redis L1 + Parquet L2)
and Sandboxed In-Memory DuckDB Analytical Querying.
"""

from __future__ import annotations
import json
import logging
import os
import uuid
from typing import Dict, Any, List
import duckdb
import pyarrow as pa
import pyarrow.parquet as pq

from app.core.redis import get_redis

logger = logging.getLogger("podacium.agent.claim_check")

STORAGE_CLAIMS_DIR = os.path.join(os.getcwd(), "storage", "claims")
os.makedirs(STORAGE_CLAIMS_DIR, exist_ok=True)


class ClaimCheckManager:
    TTL_EPHEMERAL_SECONDS: int = 3600
    TOKEN_SAFETY_THRESHOLD_BYTES: int = 8192
    TOKEN_SAFETY_THRESHOLD_ROWS: int = 50

    @classmethod
    async def process_tool_output(
        cls,
        tool_name: str,
        records: Any,
        session_id: str,
        namespace: str = "generic",
    ) -> Dict[str, Any]:
        """
        Inspects payload size. If large, offloads raw payload to Redis L1 & Parquet L2,
        returning a compact Claim Check URN envelope with statistical summaries.
        """
        if (
            not isinstance(records, list)
            or len(records) == 0
            or not isinstance(records[0], dict)
        ):
            # For non-list or primitive data, evaluate direct serialization size
            raw_serialized = json.dumps(records, default=str)
            if len(raw_serialized.encode("utf-8")) < cls.TOKEN_SAFETY_THRESHOLD_BYTES:
                return {"data": records, "$claim_check": False}

            # Offload large raw object
            item_id = str(uuid.uuid4())
            urn = f"urn:podacium:claim-check:{namespace}:{item_id}"
            redis = await get_redis()
            if redis:
                await redis.set(
                    f"claim:{item_id}", raw_serialized, ex=cls.TTL_EPHEMERAL_SECONDS
                )

            return {
                "$claim_check": True,
                "urn": urn,
                "byte_size": len(raw_serialized.encode("utf-8")),
                "summary": f"Large object output from {tool_name} ({len(raw_serialized)} characters) stored in claim vault.",
            }

        # Tabular data handling (list of dicts)
        raw_serialized = json.dumps(records, default=str)
        byte_size = len(raw_serialized.encode("utf-8"))

        if (
            byte_size < cls.TOKEN_SAFETY_THRESHOLD_BYTES
            and len(records) <= cls.TOKEN_SAFETY_THRESHOLD_ROWS
        ):
            return {"data": records, "$claim_check": False}

        dataset_id = str(uuid.uuid4())
        urn = f"urn:podacium:claim-check:{namespace}:{dataset_id}"

        # 1. Convert to Arrow Table and compute summary statistics
        try:
            arrow_table = pa.Table.from_pylist(records)
            summary_stats = cls._compute_statistics(arrow_table)
            schema_fields = [f"{f.name}:{f.type}" for f in arrow_table.schema]
        except Exception as e:
            logger.warning(
                f"Arrow serialization failed for claim check, falling back to raw: {e}"
            )
            arrow_table = None
            summary_stats = {"count": len(records)}
            schema_fields = list(records[0].keys()) if records else []

        # 2. Redis L1 Ephemeral Storage
        redis = await get_redis()
        if redis:
            await redis.set(
                f"claim:{dataset_id}",
                raw_serialized,
                ex=cls.TTL_EPHEMERAL_SECONDS,
            )

        # 3. Persistent Parquet L2 Storage
        file_path = os.path.join(STORAGE_CLAIMS_DIR, f"{dataset_id}.parquet")
        if arrow_table is not None:
            pq.write_table(arrow_table, file_path)

        logger.info(
            f"Claim Check issued: {urn} ({len(records)} rows, {byte_size} bytes)"
        )

        return {
            "$claim_check": True,
            "urn": urn,
            "storage_path": file_path if arrow_table else None,
            "row_count": len(records),
            "byte_size": byte_size,
            "schema": schema_fields,
            "statistics": summary_stats,
            "sample_records": records[:3],
            "query_instruction": f"To query or filter this dataset, invoke query_claim_check with urn='{urn}' and SQL.",
        }

    @staticmethod
    def _compute_statistics(arrow_table: pa.Table) -> Dict[str, Any]:
        """Computes statistical summaries using an in-memory DuckDB sandbox."""
        con = duckdb.connect(":memory:")
        con.execute("SET enable_external_access = false")
        con.execute("SET max_memory = '128MB'")
        con.execute("SET threads = 1")
        con.register("dataset", arrow_table)

        stats: Dict[str, Any] = {}
        for col_name in arrow_table.column_names:
            col_type = str(arrow_table.schema.field(col_name).type).lower()
            if any(t in col_type for t in ("int", "float", "double", "decimal")):
                try:
                    res = con.execute(
                        f'SELECT MIN("{col_name}"), MAX("{col_name}"), AVG("{col_name}"), SUM("{col_name}") FROM dataset'
                    ).fetchone()
                    if res:
                        stats[col_name] = {
                            "min": res[0],
                            "max": res[1],
                            "avg": float(res[2]) if res[2] is not None else 0.0,
                            "sum": float(res[3]) if res[3] is not None else 0.0,
                        }
                except Exception:
                    pass
            else:
                try:
                    top_rows = con.execute(
                        f'SELECT "{col_name}", COUNT(*) as c FROM dataset WHERE "{col_name}" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 3'
                    ).fetchall()
                    stats[col_name] = {"top_distinct": [r[0] for r in top_rows]}
                except Exception:
                    pass
        con.close()
        return stats

    @classmethod
    async def query_claim_dataset(
        cls, urn: str, sql_expression: str
    ) -> List[Dict[str, Any]]:
        """Sandboxed analytical query on an offloaded Parquet dataset."""
        dataset_id = urn.split(":")[-1]
        file_path = os.path.join(STORAGE_CLAIMS_DIR, f"{dataset_id}.parquet")

        if not os.path.exists(file_path):
            # Attempt to pull from Redis L1
            redis = await get_redis()
            if redis:
                cached = await redis.get(f"claim:{dataset_id}")
                if cached:
                    records = json.loads(cached)
                    arrow_table = pa.Table.from_pylist(records)
                    pq.write_table(arrow_table, file_path)

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Claim check dataset {urn} expired or not found.")

        con = duckdb.connect(":memory:")
        con.execute("SET max_memory = '256MB'")
        con.execute("SET threads = 2")

        arrow_table = pq.read_table(file_path)
        con.register("dataset", arrow_table)
        con.execute("SET enable_external_access = false")

        safe_query = sql_expression

        # Ensure single SELECT
        stmts = con.extract_statements(safe_query)
        if len(stmts) != 1 or stmts[0].type != duckdb.StatementType.SELECT:
            con.close()
            raise PermissionError(
                "Only single read-only SELECT queries are permitted on claim check data."
            )

        result = con.execute(safe_query).fetchall()
        columns = [desc[0] for desc in con.description]
        con.close()
        return [dict(zip(columns, row)) for row in result]

    @classmethod
    def cleanup_expired_claims(cls, max_age_seconds: int = 7200) -> int:
        """Prunes old Parquet files from storage/claims/ older than max_age_seconds."""
        import time

        if not os.path.exists(STORAGE_CLAIMS_DIR):
            return 0

        now = time.time()
        pruned_count = 0
        for fname in os.listdir(STORAGE_CLAIMS_DIR):
            if fname.endswith(".parquet"):
                full_path = os.path.join(STORAGE_CLAIMS_DIR, fname)
                try:
                    if (now - os.path.getmtime(full_path)) > max_age_seconds:
                        os.remove(full_path)
                        pruned_count += 1
                except Exception as e:
                    logger.warning(
                        f"Failed to remove expired claim file {full_path}: {e}"
                    )

        logger.info(f"Cleaned up {pruned_count} expired claim files.")
        return pruned_count


async def offload_to_claim_check(
    namespace: str, data: Any, ttl_seconds: int = 3600
) -> str:
    """Helper to store arbitrary oversized data and return a compact URN."""
    item_id = str(uuid.uuid4())
    urn = f"urn:podacium:claim-check:{namespace}:{item_id}"
    serialized = json.dumps(data, default=str)
    redis = await get_redis()
    if redis:
        await redis.set(f"claim:{item_id}", serialized, ex=ttl_seconds)
    return urn
