"""
PostgreSQL External Database Connector
Executes queries against external PostgreSQL databases for BI dataset ingestion.
"""

import logging
from typing import Any, Dict, List
from app.services.connectors.base_connector import BaseConnector

logger = logging.getLogger(__name__)

class PostgresConnector(BaseConnector):
    """Connector for PostgreSQL databases."""

    def __init__(self, host: str, port: int, database: str, user: str, password: str, ssl: bool = False):
        self.host = host
        self.port = port
        self.database = database
        self.user = user
        self.password = password
        self.ssl = ssl

    def _get_connection_string(self) -> str:
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"

    async def test_connection(self) -> bool:
        try:
            import duckdb
            con = duckdb.connect(database=":memory:")
            con.execute(f"ATTACH '{self._get_connection_string()}' AS postgres_db (TYPE POSTGRES);")
            con.execute("DETACH postgres_db;")
            return True
        except Exception as e:
            logger.warning(f"PostgreSQL connection test failed: {e}")
            return False

    async def list_tables(self) -> List[str]:
        try:
            import duckdb
            con = duckdb.connect(database=":memory:")
            con.execute(f"ATTACH '{self._get_connection_string()}' AS postgres_db (TYPE POSTGRES);")
            res = con.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';").fetchall()
            con.execute("DETACH postgres_db;")
            return [r[0] for r in res]
        except Exception as e:
            logger.error(f"Failed to list PostgreSQL tables: {e}")
            return []

    async def fetch_schema(self, table_name: str) -> List[Dict[str, Any]]:
        try:
            import duckdb
            con = duckdb.connect(database=":memory:")
            con.execute(f"ATTACH '{self._get_connection_string()}' AS postgres_db (TYPE POSTGRES);")
            res = con.execute(f"DESCRIBE SELECT * FROM postgres_db.{table_name} LIMIT 1;").fetchall()
            con.execute("DETACH postgres_db;")
            return [{"column_name": r[0], "data_type": r[1]} for r in res]
        except Exception as e:
            logger.error(f"Failed to fetch PostgreSQL table schema for {table_name}: {e}")
            return []

    async def execute_query(self, query: str, limit: int = 1000) -> List[Dict[str, Any]]:
        try:
            import duckdb
            import pandas as pd
            con = duckdb.connect(database=":memory:")
            con.execute(f"ATTACH '{self._get_connection_string()}' AS postgres_db (TYPE POSTGRES);")
            df = con.query(f"SELECT * FROM ({query}) LIMIT {limit}").df()
            df = df.where(pd.notnull(df), None)
            con.execute("DETACH postgres_db;")
            return df.to_dict(orient="records")
        except Exception as e:
            logger.error(f"PostgreSQL query execution failed: {e}")
            raise RuntimeError(f"PostgreSQL query execution failed: {e}") from e
