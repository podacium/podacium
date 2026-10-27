"""
Base Database Connector Interface
Abstract base class for external relational database connectors (PostgreSQL, MySQL, SQLite).
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List

class BaseConnector(ABC):
    """Abstract interface for external database connections."""

    @abstractmethod
    async def test_connection(self) -> bool:
        """Test database connection credentials."""
        pass

    @abstractmethod
    async def list_tables(self) -> List[str]:
        """List accessible tables in the remote database."""
        pass

    @abstractmethod
    async def fetch_schema(self, table_name: str) -> List[Dict[str, Any]]:
        """Fetch column names and data types for a given table."""
        pass

    @abstractmethod
    async def execute_query(self, query: str, limit: int = 1000) -> List[Dict[str, Any]]:
        """Execute SELECT query against the remote database and return record dictionaries."""
        pass
