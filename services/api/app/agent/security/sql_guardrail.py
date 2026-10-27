"""
services/api/app/agent/security/sql_guardrail.py
Hardened Security Guardrail and Multi-Tenant Query Rewriter for DuckDB.
Guarantees read-only analytical execution, prevents SQL injection and DDL/DML evasion,
and enforces multi-tenant row-level isolation.
"""

from __future__ import annotations
import logging
import re
from typing import Dict, Any, List, Optional
import duckdb

logger = logging.getLogger("podacium.agent.security.sql")


class SecurityAstViolation(ValueError):
    """Raised when an analytical query violates security guardrails."""

    pass


class DuckDbAstSecurityVisitor:
    """
    Security Validator and Multi-Tenant Rewriter using DuckDB native parser.
    """

    FORBIDDEN_KEYWORDS = {
        "insert",
        "update",
        "delete",
        "drop",
        "create",
        "alter",
        "truncate",
        "grant",
        "revoke",
        "copy",
        "export",
        "import",
        "install",
        "load",
        "attach",
        "detach",
        "pragma",
        "checkpoint",
        "call",
        "vacuum",
        "system",
        "getenv",
        "read_file",
        "write_file",
        "read_csv",
        "read_parquet",
        "read_json",
        "read_ndjson",
    }

    @classmethod
    def validate_and_sanitize(
        cls,
        sql: str,
        organization_id: Optional[int] = None,
        max_limit: int = 100,
    ) -> str:
        """Lightweight AST validator checking DDL/DML and appending a safety LIMIT."""
        if not sql or not sql.strip():
            raise SecurityAstViolation("SQL query cannot be empty.")
        if organization_id is not None:
            if not isinstance(organization_id, int) or isinstance(
                organization_id, bool
            ):
                raise SecurityAstViolation("organization_id must be a valid integer.")
            if organization_id <= 0 or organization_id > 2_147_483_647:
                raise SecurityAstViolation(
                    f"organization_id must be a positive integer within valid bounds (1 to 2147483647), got {organization_id}."
                )
        clean_sql = sql.strip().rstrip(";")
        for kw in cls.FORBIDDEN_KEYWORDS:
            if re.search(rf"\b{re.escape(kw)}\b", clean_sql, re.IGNORECASE):
                raise SecurityAstViolation(
                    f"Blocked forbidden SQL keyword/function: '{kw}'"
                )
        con = duckdb.connect(":memory:")
        try:
            statements = con.extract_statements(clean_sql)
            if len(statements) != 1:
                raise SecurityAstViolation(
                    "Multi-statement SQL queries are strictly prohibited."
                )
            stmt = statements[0]
            if stmt.type != duckdb.StatementType.SELECT:
                raise SecurityAstViolation(
                    f"Only SELECT queries permitted, got: {stmt.type}"
                )
        finally:
            con.close()
        if not re.search(r"\blimit\s+\d+\b", clean_sql, re.IGNORECASE):
            clean_sql = f"{clean_sql} LIMIT {max_limit}"
        return clean_sql

    @classmethod
    def validate_and_rewrite(
        cls,
        sql: str,
        organization_id: int,
        read_only_table_name: str,
        file_path: str,
        max_limit: int = 100,
    ) -> str:
        """
        Validates statement safety using DuckDB's native parser and rewires
        logical table references to safe Parquet files with multi-tenant predicate injection.
        """
        if not sql or not sql.strip():
            raise SecurityAstViolation("SQL query cannot be empty.")

        # Enforce positive integer typing and bounds on organization_id
        if not isinstance(organization_id, int) or isinstance(organization_id, bool):
            raise SecurityAstViolation("organization_id must be a valid integer.")
        if organization_id <= 0 or organization_id > 2_147_483_647:
            raise SecurityAstViolation(
                f"organization_id must be a positive integer within valid bounds (1 to 2147483647), got {organization_id}."
            )

        clean_sql = sql.strip().rstrip(";")

        # 1. Quick lexical check for forbidden operations
        tokens = re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]*\b", clean_sql.lower())
        for token in tokens:
            if token in cls.FORBIDDEN_KEYWORDS:
                raise SecurityAstViolation(
                    f"Prohibited operation or function detected: '{token}'"
                )

        # 2. Parse using DuckDB native statement extractor
        con = duckdb.connect(":memory:")
        try:
            stmts = con.extract_statements(clean_sql)
        except Exception as e:
            con.close()
            raise SecurityAstViolation(f"SQL Syntax Error: {e}")

        if len(stmts) == 0:
            con.close()
            raise SecurityAstViolation("No executable SQL statements found.")
        if len(stmts) > 1:
            con.close()
            raise SecurityAstViolation(
                "Multiple statements are prohibited. Only a single SELECT query is permitted."
            )

        stmt = stmts[0]
        if stmt.type != duckdb.StatementType.SELECT:
            con.close()
            raise SecurityAstViolation(
                f"Statement type '{stmt.type.name}' is prohibited. Only SELECT queries are permitted."
            )
        con.close()

        # 3. Table alias replacement: 'dataset' -> read_parquet('{file_path}')
        safe_file_path = file_path.replace("'", "''")
        safe_source = f"read_parquet('{safe_file_path}')"
        rewritten = re.sub(
            rf"\b(?:{re.escape(read_only_table_name)}|dataset)\b",
            safe_source,
            clean_sql,
            flags=re.IGNORECASE,
        )

        # 4. Guard against subquery limit circumvention & enforce safety limit
        effective_limit = max_limit
        offset_clause = ""
        limit_match = re.search(
            r"\s+LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?\s*$", rewritten, re.IGNORECASE
        )
        if limit_match:
            user_limit = int(limit_match.group(1))
            effective_limit = min(max(1, user_limit), max_limit)
            if limit_match.group(2):
                offset_val = max(0, int(limit_match.group(2)))
                offset_clause = f" OFFSET {offset_val:d}"
            # Strip inner limit so multi-tenant filtering is not truncated before evaluation
            rewritten = rewritten[: limit_match.start()].strip()

        # 5. Multi-Tenant Row-Level Isolation Injection
        tenant_wrapped_query = (
            f"SELECT * FROM ({rewritten}) AS _tenant_subquery "
            f"WHERE _tenant_subquery.organization_id = {organization_id:d} "
            f"LIMIT {effective_limit:d}{offset_clause}"
        )

        return tenant_wrapped_query

    @classmethod
    def execute_sandboxed_query(
        cls,
        query: str,
        max_rows: int = 100,
        memory_limit: str = "256MB",
        threads: int = 2,
    ) -> List[Dict[str, Any]]:
        """
        Executes a validated query inside a locked-down in-memory DuckDB sandbox.
        """
        con = duckdb.connect(":memory:")
        try:
            con.execute(f"SET max_memory = '{memory_limit}'")
            con.execute(f"SET threads = {threads}")
            con.execute("SET enable_external_access = false")

            res = con.execute(query).fetchall()
            columns = [desc[0] for desc in con.description]
            rows = [dict(zip(columns, row)) for row in res[:max_rows]]
            return rows
        finally:
            con.close()
