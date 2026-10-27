"""
Query Engine Service
Wraps DuckDB for high-performance analytical querying of local data files.
Features thread-local connection isolation, path traversal security, and resource limits.
"""

import logging
import os
import re
import threading
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    import duckdb

from app.services.bi_services.errors import BIError

logger = logging.getLogger(__name__)
_LOG_EXTRA = {"pillar": "bi"}

import queue

# Thread-local storage for thread-safe DuckDB connection reference
_thread_local = threading.local()


class BoundedDuckDBPool:
    """
    Bounded DuckDB in-memory connection pool with memory ceilings, thread limits,
    LRU recycling, and locked sandbox configurations preventing external filesystem access.
    """

    def __init__(self, max_size: int = 8, memory_limit: str = "2GB", threads: int = 4):
        self.max_size = max_size
        self.memory_limit = memory_limit
        self.threads = threads
        self._pool: "queue.LifoQueue[duckdb.DuckDBPyConnection]" = queue.LifoQueue(
            maxsize=max_size
        )
        self._created = 0
        self._lock = threading.Lock()

    def _create_connection(self) -> "duckdb.DuckDBPyConnection":
        import duckdb

        conn = duckdb.connect(
            database=":memory:",
            config={
                "enable_external_access": False,
                "max_memory": self.memory_limit,
                "threads": str(self.threads),
                "lock_configuration": True,
            },
        )
        return conn

    def clean_connection(self, conn: "duckdb.DuckDBPyConnection") -> None:
        """
        Unregister all in-memory dataset tables (__ds_{path_hash}) and drop temporary session views
        during connection recycling to prevent cross-tenant data enumeration and pool contamination.
        """
        try:
            tables = [r[0] for r in conn.execute("SHOW TABLES").fetchall()]
            for tbl in tables:
                try:
                    conn.unregister(tbl)
                except Exception:
                    pass
                try:
                    conn.execute(f'DROP VIEW IF EXISTS "{tbl}"')
                except Exception:
                    pass
                try:
                    conn.execute(f'DROP TABLE IF EXISTS "{tbl}"')
                except Exception:
                    pass
        except Exception as e:
            logger.warning("Error cleaning up DuckDB tables on recycling: %s", e)

    def acquire(self, timeout: float = 10.0) -> "duckdb.DuckDBPyConnection":
        conn: Optional["duckdb.DuckDBPyConnection"] = None
        try:
            conn = self._pool.get_nowait()
        except queue.Empty:
            pass

        if conn is not None:
            self.clean_connection(conn)
            return conn

        with self._lock:
            if self._created < self.max_size:
                self._created += 1
                return self._create_connection()

        try:
            conn = self._pool.get(timeout=timeout)
            self.clean_connection(conn)
            return conn
        except queue.Empty:
            logger.warning(
                "DuckDB connection pool exhausted, provisioning overflow connection"
            )
            return self._create_connection()

    def release(self, conn: Optional["duckdb.DuckDBPyConnection"]) -> None:
        if conn is None:
            return
        try:
            conn.rollback()
        except Exception:
            pass

        self.clean_connection(conn)

        try:
            self._pool.put_nowait(conn)
        except queue.Full:
            try:
                conn.close()
            except Exception:
                pass
            with self._lock:
                self._created = max(0, self._created - 1)


# Global bounded connection pool
_duckdb_pool = BoundedDuckDBPool(max_size=8, memory_limit="2GB", threads=4)


# Referentially resolve monorepo root and API root directories dynamically without hardcoding home paths
# __file__ is services/api/app/services/bi_services/query_engine.py
REPO_ROOT = Path(__file__).resolve().parents[4]
API_ROOT = Path(__file__).resolve().parents[3]
PROJECT_ROOT = REPO_ROOT  # Backward compatibility alias


def get_allowed_data_dirs() -> List[Path]:
    """
    Dynamically determine referential allowed base directories for dataset file access.
    No hardcoded user home paths (e.g. /home/zuikre) are used, making paths portable across VPS deployments.
    Reads allowed directories from:
    1. Codebase structure (REPO_ROOT, API_ROOT, uploads, storage)
    2. Current working directory & OS temp directory
    3. ALLOWED_DATA_DIRS environment variable (colon/comma/semicolon separated)
    4. PODACIUM_DATA_DIR environment variable
    """
    import tempfile

    base_dirs = [
        REPO_ROOT,
        API_ROOT,
        REPO_ROOT / "uploads",
        REPO_ROOT / "storage",
        API_ROOT / "uploads",
        API_ROOT / "storage",
        Path(os.getcwd()).resolve(),
        Path(tempfile.gettempdir()).resolve(),
    ]

    # Environment variable overrides
    env_allowed = os.environ.get("ALLOWED_DATA_DIRS")
    if env_allowed:
        for path_str in re.split(r"[:;,]", env_allowed):
            path_str = path_str.strip()
            if path_str:
                base_dirs.append(Path(path_str).resolve())

    custom_dir = os.environ.get("PODACIUM_DATA_DIR")
    if custom_dir:
        base_dirs.append(Path(custom_dir).resolve())

    # Return deduplicated list of resolved Path objects
    seen = set()
    unique_dirs = []
    for d in base_dirs:
        resolved = d.resolve()
        if resolved not in seen:
            seen.add(resolved)
            unique_dirs.append(resolved)

    return unique_dirs


class QueryError(BIError):
    """Query execution specific errors"""

    pass


class QueryEngine:
    """
    High-performance analytical engine using DuckDB.
    Handles querying of CSV, JSON, and Parquet files directly with thread-safe isolation.
    """

    @classmethod
    def get_connection(cls) -> "duckdb.DuckDBPyConnection":
        """Get or create DuckDB connection with resource limits from the bounded pool."""
        if not hasattr(_thread_local, "connection") or _thread_local.connection is None:
            _thread_local.connection = _duckdb_pool.acquire()
        else:
            try:
                _thread_local.connection.rollback()
            except Exception:
                pass
        return _thread_local.connection

    @classmethod
    def release_connection(
        cls, conn: Optional["duckdb.DuckDBPyConnection"] = None
    ) -> None:
        """Release connection back to the bounded connection pool."""
        target = conn or getattr(_thread_local, "connection", None)
        if target:
            if (
                hasattr(_thread_local, "connection")
                and _thread_local.connection is target
            ):
                _thread_local.connection = None
            _duckdb_pool.release(target)

    @classmethod
    def _sanitize_identifier(cls, name: str) -> str:
        """
        Sanitize a SQL identifier (column name, alias) to prevent injection.
        Only allows alphanumeric, underscore, space, hyphen, and dot characters.
        Raises QueryError if the identifier contains dangerous characters.
        """
        if not name or not isinstance(name, str):
            raise QueryError(
                "Invalid identifier: empty or non-string", "invalid_identifier"
            )
        name = name.strip()
        if len(name) > 128:
            raise QueryError(
                "Identifier too long (max 128 chars)", "invalid_identifier"
            )
        if not re.match(r"^[\w\s\-\.]+$", name, re.UNICODE):
            raise QueryError(
                "Invalid identifier: contains forbidden characters",
                "invalid_identifier",
            )
        upper = name.upper().strip()
        dangerous = {
            "DROP",
            "DELETE",
            "INSERT",
            "UPDATE",
            "CREATE",
            "ALTER",
            "EXEC",
            "UNION",
            "--",
            ";",
        }
        if upper in dangerous or ";" in name or "--" in name:
            raise QueryError("Forbidden identifier value", "invalid_identifier")
        return name

    @classmethod
    def _sanitize_agg_func(cls, func: str) -> str:
        """Validate aggregation function against whitelist."""
        allowed = {
            "sum",
            "count",
            "avg",
            "min",
            "max",
            "median",
            "stddev",
            "variance",
            "corr",
            "quantile_cont",
            "mode",
        }
        if func.lower().strip() not in allowed:
            raise QueryError(
                f"Invalid aggregation function: {func}", "invalid_function"
            )
        return func.lower().strip()

    @classmethod
    def _validate_path_security(cls, file_path: str) -> str:
        """
        Verify that file_path is safely resolved within allowed workspace directories.
        Raises QueryError if traversal or path outside allowed directories is detected.
        """
        if not file_path:
            raise QueryError("File path cannot be empty", "invalid_path")

        normalized = file_path.replace("\\", "/")
        if ".." in normalized or normalized.startswith(
            ("/etc", "/proc", "/sys", "/root", "/var", "/dev")
        ):
            raise QueryError(
                "Invalid or restricted file path traversal", "path_traversal"
            )

        target_path = Path(file_path).resolve()
        allowed_dirs = get_allowed_data_dirs()
        is_allowed = any(
            target_path == allowed_dir or allowed_dir in target_path.parents
            for allowed_dir in allowed_dirs
        )
        if not is_allowed:
            raise QueryError(
                f"Access to path outside allowed data directories is forbidden: {target_path}",
                "path_forbidden",
            )

        if not os.path.isabs(file_path):
            return file_path.replace("'", "")
        return str(target_path).replace("'", "")

    @classmethod
    def _convert_excel_to_parquet(cls, excel_path: str, parquet_path: str) -> bool:
        """
        Convert Excel file to Parquet format atomically using NamedTemporaryFile + os.replace
        to prevent race conditions during concurrent queries.
        """
        import tempfile
        import pandas as pd

        target_dir = os.path.dirname(parquet_path) or "."
        tmp_path = None
        try:
            df = pd.read_excel(excel_path)
            df.columns = [
                str(c).strip().replace(" ", "_").replace("(", "").replace(")", "")
                for c in df.columns
            ]
            with tempfile.NamedTemporaryFile(
                dir=target_dir, delete=False, suffix=".parquet.tmp"
            ) as tmp_file:
                tmp_path = tmp_file.name

            df.to_parquet(tmp_path, index=False)
            os.replace(tmp_path, parquet_path)
            return os.path.exists(parquet_path)
        except Exception as e:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
            logger.warning(
                "Failed auto-converting excel file to parquet: %s",
                str(e),
            )
            return False

    @classmethod
    def _register_dataset_table(
        cls, con: "duckdb.DuckDBPyConnection", file_path: Optional[str]
    ) -> str:
        """
        Safely load an authorized dataset file (parquet, csv, json, excel) and register
        it into DuckDB as an in-memory table.
        This allows analytical queries to execute with enable_external_access=False.
        """
        if not file_path:
            return "read_parquet('/dev/null')"

        file_path_str = cls._validate_path_security(file_path)
        if not os.path.exists(file_path_str):
            return cls._get_table_expr(file_path_str)

        lower_path = file_path_str.lower()
        if lower_path.endswith((".xlsx", ".xls", ".xlsm", ".xlsb", ".ods")):
            parquet_path = os.path.splitext(file_path_str)[0] + ".parquet"
            if not os.path.exists(parquet_path):
                cls._convert_excel_to_parquet(file_path_str, parquet_path)
            if os.path.exists(parquet_path):
                file_path_str = parquet_path
                lower_path = parquet_path.lower()

        path_hash = abs(hash(file_path_str)) % 100000000
        table_name = f"__ds_{path_hash}"

        try:
            existing_tables = [r[0] for r in con.execute("SHOW TABLES").fetchall()]
            if table_name in existing_tables:
                return table_name

            if lower_path.endswith(".parquet"):
                import pyarrow.parquet as pq

                arrow_table = pq.read_table(file_path_str)
                con.register(table_name, arrow_table)
            elif lower_path.endswith(".csv"):
                import pandas as pd

                df = pd.read_csv(file_path_str)
                con.register(table_name, df)
            elif lower_path.endswith(".json"):
                import pandas as pd

                df = pd.read_json(file_path_str)
                con.register(table_name, df)
            else:
                import pyarrow.parquet as pq

                arrow_table = pq.read_table(file_path_str)
                con.register(table_name, arrow_table)
            return table_name
        except Exception as e:
            logger.warning(
                f"Could not register in-memory table for {file_path_str}: {e}"
            )
            return cls._get_table_expr(file_path_str)

    @classmethod
    def _get_table_expr(cls, file_path: str) -> str:
        """Helper to get the correct DuckDB table expression based on extension."""
        if not file_path:
            return "read_parquet('/dev/null')"

        file_path_str = cls._validate_path_security(file_path)
        lower_path = file_path_str.lower()

        # Check binary magic bytes first (e.g. Excel .xlsx uploaded with .csv extension)
        if os.path.exists(file_path_str):
            try:
                with open(file_path_str, "rb") as f:
                    header = f.read(4)
                    if header.startswith(b"PK\x03\x04"):
                        parquet_path = os.path.splitext(file_path_str)[0] + ".parquet"
                        if os.path.exists(
                            parquet_path
                        ) or cls._convert_excel_to_parquet(file_path_str, parquet_path):
                            return f"read_parquet('{parquet_path}')"
            except Exception:
                pass

        if lower_path.endswith(".parquet"):
            return f"read_parquet('{file_path_str}')"
        elif lower_path.endswith(".csv"):
            return f"read_csv_auto('{file_path_str}')"
        elif lower_path.endswith(".json"):
            return f"read_json_auto('{file_path_str}')"
        elif lower_path.endswith((".xlsx", ".xls", ".xlsm", ".xlsb", ".ods")):
            parquet_path = os.path.splitext(file_path_str)[0] + ".parquet"
            if os.path.exists(parquet_path) or (
                os.path.exists(file_path_str)
                and cls._convert_excel_to_parquet(file_path_str, parquet_path)
            ):
                return f"read_parquet('{parquet_path}')"
            return f"read_parquet('{file_path_str}')"
        else:
            return f"read_parquet('{file_path_str}')"

    @classmethod
    def _validate_query(cls, query: str, skip_validation: bool = False):
        """
        Security AST validation to prevent DuckDB exploits.
        Only allows single SELECT / WITH statements and blocks forbidden functions/keywords.
        """
        if not query or skip_validation:
            return

        q = query.strip().upper()

        if ";" in q[:-1]:
            raise QueryError(
                "Multi-statement SQL queries are strictly forbidden", "invalid_query"
            )

        if not q.startswith("SELECT") and not q.startswith("WITH"):
            raise QueryError("Only SELECT queries are allowed", "unauthorized_query")

        forbidden = [
            "INSTALL",
            "LOAD",
            "PRAGMA",
            "ATTACH",
            "DETACH",
            "CREATE",
            "DROP",
            "ALTER",
            "INSERT",
            "UPDATE",
            "DELETE",
            "COPY",
            "SYSTEM",
            "ATTACH_DIRECTORY",
            "PRAGMA_DATABASE_LIST",
            "READ_CSV_AUTO",
            "READ_CSV",
            "READ_PARQUET",
            "READ_JSON_AUTO",
            "READ_JSON",
            "READ_TEXT",
            "READ_BLOB",
            "PARQUET_SCAN",
            "SCAN_PARQUET",
            "GLOB",
            "EXPORT",
            "CHECKPOINT",
            "VACUUM",
        ]

        for word in forbidden:
            if re.search(rf"\b{re.escape(word)}\b", q):
                logger.warning(
                    "Blocked forbidden keyword in query",
                    extra={**_LOG_EXTRA, "keyword": word},
                )
                raise QueryError(
                    f"Forbidden keyword detected: {word}", "unauthorized_query"
                )

    @classmethod
    def inject_tenant_isolation(cls, query: str, organization_id: Optional[Any]) -> str:
        """
        Inject organization_id tenant isolation clause into SELECT queries safely
        using subquery wrapping to prevent bypasses and parser ambiguity.
        """
        if not organization_id or not query:
            return query

        clean_org_id = int(organization_id)
        sanitized_sql = query.strip().rstrip(";")
        return f"SELECT * FROM ({sanitized_sql}) AS __tenant_scoped_view WHERE organization_id = '{clean_org_id}'"

    @classmethod
    def execute_query(
        cls,
        query: str,
        params: Optional[List[Any]] = None,
        skip_validation: bool = False,
    ) -> List[Dict[str, Any]]:
        """Execute SQL query and return dict records."""
        cls._validate_query(query, skip_validation)
        logger.debug(
            "Executing query",
            extra={
                **_LOG_EXTRA,
                "query_length": len(query) if query else 0,
                "has_params": params is not None,
            },
        )
        try:
            con = cls.get_connection()
            if params:
                result = con.execute(query, params).fetchall()
                columns = [desc[0] for desc in con.description]
            else:
                result = con.execute(query).fetchall()
                columns = [desc[0] for desc in con.description]
            return [dict(zip(columns, row)) for row in result]

        except QueryError:
            raise
        except Exception as e:
            logger.exception(
                "Query execution failed: %s",
                str(e),
                extra={**_LOG_EXTRA, "error": str(e)},
            )
            raise QueryError(f"Query execution failed: {str(e)}", "query_failed") from e

    @classmethod
    def execute_internal_query(
        cls, query: str, params: Optional[List[Any]] = None
    ) -> List[Dict[str, Any]]:
        """Execute SQL query for trusted internal services skipping strict keyword checks."""
        return cls.execute_query(query, params, skip_validation=True)

    @classmethod
    def build_rls_predicate(cls, policies: List[Any]) -> Optional[str]:
        """
        Compile active RowLevelPolicy rules into a validated SQL predicate string.
        Supports both Prisma model objects and dictionaries.
        """
        if not policies:
            return None

        allowed_ops = {"=", "!=", "<>", "IN", "LIKE", "ILIKE", ">", "<", ">=", "<="}
        where_clauses = []
        for p in policies:
            col = (
                p.get("columnName")
                if isinstance(p, dict)
                else getattr(p, "columnName", None)
            )
            op = (
                p.get("operator")
                if isinstance(p, dict)
                else getattr(p, "operator", "=")
            )
            val = (
                p.get("valuePredicate")
                if isinstance(p, dict)
                else getattr(p, "valuePredicate", "")
            )
            if not col:
                continue
            safe_col = cls._sanitize_identifier(str(col))
            safe_op = str(op or "=").strip().upper()
            if safe_op not in allowed_ops:
                safe_op = "="
            escaped_val = str(val).replace("'", "''")
            if safe_op == "IN":
                items = [
                    "'" + item.strip().strip("'\"").replace("'", "''") + "'"
                    for item in str(val).split(",")
                    if item.strip()
                ]
                if items:
                    where_clauses.append(f'"{safe_col}" IN ({", ".join(items)})')
            else:
                where_clauses.append(f"\"{safe_col}\" {safe_op} '{escaped_val}'")

        if not where_clauses:
            return None
        return " AND ".join(where_clauses)

    @classmethod
    def create_rls_temporary_view(
        cls,
        con: "duckdb.DuckDBPyConnection",
        source_table: str,
        policies: List[Any],
        view_name: str = "scoped_dataset",
    ) -> str:
        """
        Create a secure temporary session view evaluated by DuckDB optimizer,
        preventing subquery breakout (e.g. UNION ALL injection).
        """
        predicate = cls.build_rls_predicate(policies)
        if not predicate:
            view_sql = f'CREATE OR REPLACE TEMPORARY VIEW "{view_name}" AS SELECT * FROM "{source_table}"'
        else:
            view_sql = f'CREATE OR REPLACE TEMPORARY VIEW "{view_name}" AS SELECT * FROM "{source_table}" WHERE {predicate}'
        con.execute(view_sql)
        return view_name

    @classmethod
    def build_rls_wrapped_sql(
        cls,
        sql: str,
        policies: List[Any],
        con: Optional["duckdb.DuckDBPyConnection"] = None,
        table_name: Optional[str] = None,
    ) -> str:
        """
        Compile active RowLevelPolicy rules into a secure temporary session view or scoped query.
        Evaluated by DuckDB optimizer to prevent UNION ALL subquery breakout.
        """
        if not policies or not sql:
            return sql

        predicate = cls.build_rls_predicate(policies)
        if not predicate:
            return sql

        if con is not None and table_name is not None:
            cls.create_rls_temporary_view(
                con, table_name, policies, view_name="scoped_dataset"
            )
            rewritten = re.sub(
                r"\bdataset\b", "scoped_dataset", sql, flags=re.IGNORECASE
            )
            rewritten = re.sub(
                rf"\b{re.escape(table_name)}\b", "scoped_dataset", rewritten
            )
            return rewritten

        sanitized_sql = sql.strip().rstrip(";")
        if re.search(r"\bdataset\b", sanitized_sql, flags=re.IGNORECASE):
            cte_scoped = (
                f"WITH scoped_dataset AS (SELECT * FROM dataset WHERE {predicate}) "
            )
            rewritten_sql = re.sub(
                r"\bdataset\b", "scoped_dataset", sanitized_sql, flags=re.IGNORECASE
            )
            return f"{cte_scoped}{rewritten_sql}"

        return (
            f"WITH scoped_dataset AS (SELECT * FROM ({sanitized_sql}) WHERE {predicate}) "
            f"SELECT * FROM scoped_dataset"
        )

    @classmethod
    async def fetch_rls_policies(
        cls,
        dataset_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        role: Optional[str] = None,
    ) -> List[Any]:
        """Fetch active Row-Level Security policies for a dataset and organization."""
        if not dataset_id or not organization_id:
            return []
        try:
            from app.core.prisma import prisma

            where_filter: Dict[str, Any] = {
                "datasetId": int(dataset_id),
                "organizationId": int(organization_id),
                "isActive": True,
            }
            if role:
                where_filter["role"] = role
            return await prisma.rowlevelpolicy.find_many(where=where_filter)
        except Exception as e:
            logger.warning(
                f"Could not fetch RLS policies for dataset {dataset_id}: {e}"
            )
            return []

    @classmethod
    async def execute_query_with_rls(
        cls,
        query: str,
        dataset_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        role: Optional[str] = None,
        params: Optional[List[Any]] = None,
        skip_validation: bool = False,
    ) -> List[Dict[str, Any]]:
        """Execute query with active Row-Level Security policy injection."""
        policies = await cls.fetch_rls_policies(
            dataset_id=dataset_id,
            organization_id=organization_id,
            role=role,
        )
        if policies:
            con = cls.get_connection()
            tables = [
                r[0]
                for r in con.execute("SHOW TABLES").fetchall()
                if not r[0].startswith("scoped_")
            ]
            if tables:
                view_name = "scoped_dataset"
                cls.create_rls_temporary_view(
                    con, tables[0], policies, view_name=view_name
                )
                sql = re.sub(r"\bdataset\b", view_name, query, flags=re.IGNORECASE)
                for tbl in tables:
                    sql = re.sub(rf"\b{re.escape(tbl)}\b", view_name, sql)
            else:
                sql = cls.build_rls_wrapped_sql(query, policies)
        else:
            sql = query
        return cls.execute_query(sql, params=params, skip_validation=skip_validation)

    @classmethod
    async def query_dataset_with_rls(
        cls,
        file_path: str,
        query: Optional[str] = None,
        dataset_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        role: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Asynchronously query a dataset file with automatic Row-Level Security enforcement."""
        policies = await cls.fetch_rls_policies(
            dataset_id=dataset_id,
            organization_id=organization_id,
            role=role,
        )
        return cls.query_dataset(
            file_path=file_path,
            query=query,
            dataset_id=dataset_id,
            organization_id=organization_id,
            role=role,
            rls_policies=policies,
        )

    @classmethod
    def query_dataset(
        cls,
        file_path: str,
        query: Optional[str] = None,
        dataset_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        role: Optional[str] = None,
        rls_policies: Optional[List[Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Query a specific dataset file safely with optional Row-Level Security enforcement."""
        if query:
            cls._validate_query(query)

        con = None
        table_name = None
        created_view_name = None
        try:
            con = cls.get_connection()
            table_name = cls._register_dataset_table(con, file_path)
            table_expr = cls._get_table_expr(file_path)
            logger.info(
                "Querying dataset",
                extra={
                    **_LOG_EXTRA,
                    "file_path": file_path,
                    "has_custom_query": query is not None,
                    "dataset_id": dataset_id,
                    "organization_id": organization_id,
                },
            )

            target_source = table_name
            if rls_policies:
                created_view_name = f"scoped_dataset_{abs(hash(file_path)) % 1000000}"
                cls.create_rls_temporary_view(
                    con,
                    source_table=table_name,
                    policies=rls_policies,
                    view_name=created_view_name,
                )
                try:
                    con.execute(
                        f'CREATE OR REPLACE TEMPORARY VIEW scoped_dataset AS SELECT * FROM "{created_view_name}"'
                    )
                except Exception:
                    pass
                target_source = created_view_name

            if not query:
                sql = f'SELECT * FROM "{target_source}" LIMIT 100'
            else:
                sql = re.sub(r"\bdataset\b", target_source, query, flags=re.IGNORECASE)
                if table_expr != table_name and table_expr in sql:
                    sql = sql.replace(table_expr, target_source)
                if table_name != target_source and table_name in sql:
                    sql = sql.replace(table_name, target_source)

            result_df = con.query(sql).df()
            records = result_df.to_dict(orient="records")
            cleaned_records = []
            import math
            import pandas as pd

            for row in records:
                cleaned_row: Dict[str, Any] = {}
                for k, v in row.items():
                    if pd.isna(v) or (
                        isinstance(v, float) and (math.isnan(v) or math.isinf(v))
                    ):
                        cleaned_row[k] = None
                    else:
                        cleaned_row[k] = v
                cleaned_records.append(cleaned_row)
            return cleaned_records

        except Exception as e:
            if "Only SELECT" in str(e) or "Forbidden keyword" in str(e):
                raise
            logger.exception(
                "query_dataset failed: %s",
                str(e),
                extra={**_LOG_EXTRA, "file_path": file_path, "error": str(e)},
            )
            return []
        finally:
            if con is not None:
                if created_view_name:
                    try:
                        con.execute(f'DROP VIEW IF EXISTS "{created_view_name}"')
                        con.execute("DROP VIEW IF EXISTS scoped_dataset")
                    except Exception:
                        pass
                if table_name:
                    try:
                        con.unregister(table_name)
                    except Exception:
                        pass

    @classmethod
    def get_dataset_schema(cls, file_path: str) -> List[Dict[str, str]]:
        """
        Get column names and deterministic types from Parquet/CSV.
        Maps DuckDB types to: numeric, text, date, boolean, categorical.
        """
        con = None
        table_name = None
        try:
            con = cls.get_connection()
            table_name = cls._register_dataset_table(con, file_path)
            logger.debug(
                "Getting dataset schema", extra={**_LOG_EXTRA, "file_path": file_path}
            )

            sql = f"DESCRIBE SELECT * FROM {table_name}"
            result = con.query(sql).fetchall()

            mapped_schema = []
            for r in result:
                col_name = r[0]
                duck_type = str(r[1]).upper()
                internal_type = "text"

                if any(
                    t in duck_type
                    for t in ["INT", "DOUBLE", "DECIMAL", "FLOAT", "NUMERIC", "REAL"]
                ):
                    internal_type = "numeric"
                elif any(t in duck_type for t in ["DATE", "TIMESTAMP", "TIME"]):
                    internal_type = "date"
                elif "BOOL" in duck_type:
                    internal_type = "boolean"
                else:
                    try:
                        safe_col = col_name.replace('"', '""')
                        chk_sql = f'SELECT COUNT(*) as tot, COUNT(TRY_CAST(TRIM("{safe_col}") AS DOUBLE)) as num_cnt FROM {table_name} WHERE "{safe_col}" IS NOT NULL AND TRIM("{safe_col}") != \'\''
                        chk = con.query(chk_sql).fetchone()
                        if chk and chk[0] > 0 and (chk[1] / chk[0]) >= 0.9:
                            internal_type = "numeric"
                            duck_type = "INTEGER"
                    except Exception:
                        pass

                mapped_schema.append(
                    {"name": col_name, "type": internal_type, "native_type": duck_type}
                )

            return mapped_schema

        except Exception as e:
            logger.exception(
                "get_dataset_schema failed: %s",
                str(e),
                extra={**_LOG_EXTRA, "file_path": file_path, "error": str(e)},
            )
            return []
        finally:
            if con is not None and table_name:
                try:
                    con.unregister(table_name)
                except Exception:
                    pass

    @classmethod
    def compute_aggregations(
        cls,
        file_path: str,
        group_by: str,
        agg_col: Optional[str] = None,
        agg_func: str = "count",
        metrics: Optional[List[Dict[str, str]]] = None,
        filters: Optional[Dict[str, Any]] = None,
        sort_by: Optional[str] = None,
        sort_desc: bool = True,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Advanced aggregation for BI widgets supporting single or multi-metric queries.
        """
        con = None
        table_name = None
        try:
            con = cls.get_connection()
            table_name = cls._register_dataset_table(con, file_path)
            group_by = cls._sanitize_identifier(group_by)
            agg_func = cls._sanitize_agg_func(agg_func)

            select_parts = [f'"{group_by}"']

            if metrics:
                for m in metrics:
                    func = cls._sanitize_agg_func(m.get("func", "sum"))
                    col = cls._sanitize_identifier(m.get("col", ""))
                    alias = cls._sanitize_identifier(m.get("alias", f"{func}_{col}"))
                    select_parts.append(f'{func}("{col}") as "{alias}"')
            elif agg_col:
                agg_col = cls._sanitize_identifier(agg_col)
                select_parts.append(f'{agg_func}("{agg_col}") as value')
            else:
                select_parts.append("count(*) as value")

            select_clause = ", ".join(select_parts)

            where_clauses = []
            if filters and isinstance(filters, dict):
                for col, val in filters.items():
                    safe_col = cls._sanitize_identifier(col)
                    if isinstance(val, str):
                        escaped_val = val.replace("'", "''")
                        where_clauses.append(f"\"{safe_col}\" = '{escaped_val}'")
                    elif isinstance(val, (int, float)):
                        where_clauses.append(f'"{safe_col}" = {val}')
                    elif isinstance(val, list) and val:
                        formatted_vals = []
                        for v in val:
                            if isinstance(v, str):
                                escaped_v = v.replace("'", "''")
                                formatted_vals.append(f"'{escaped_v}'")
                            elif isinstance(v, (int, float)):
                                formatted_vals.append(str(v))
                        if formatted_vals:
                            where_clauses.append(
                                f'"{safe_col}" IN ({", ".join(formatted_vals)})'
                            )

            where_sql = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            sql = f'SELECT {select_clause} FROM {table_name}{where_sql} GROUP BY "{group_by}"'

            if sort_by:
                sort_by = cls._sanitize_identifier(sort_by)
                sql += f" ORDER BY \"{sort_by}\" {'DESC' if sort_desc else 'ASC'}"
            elif agg_col:
                sql += f" ORDER BY \"value\" {'DESC' if sort_desc else 'ASC'}"
            elif metrics:
                first_metric = metrics[0]
                alias = first_metric.get(
                    "alias", f"{first_metric.get('func')}_{first_metric.get('col')}"
                )
                sql += f" ORDER BY \"{alias}\" {'DESC' if sort_desc else 'ASC'}"

            limit = min(max(int(limit), 1), 10000)
            sql += f" LIMIT {limit}"

            import pandas as pd

            df = con.query(sql).df()
            df = df.where(pd.notnull(df), None)
            return df.to_dict(orient="records")
        except Exception as e:
            logger.exception(
                "Advanced aggregation failed: %s",
                str(e),
                extra={**_LOG_EXTRA, "group_by": group_by, "error": str(e)},
            )
            raise QueryError(f"Advanced aggregation failed: {str(e)}") from e
        finally:
            if con is not None and table_name:
                try:
                    con.unregister(table_name)
                except Exception:
                    pass
