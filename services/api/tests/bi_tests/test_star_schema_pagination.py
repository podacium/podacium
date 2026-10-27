"""
Unit tests for StarSchemaEngine server-side pagination pushdown and Arrow IPC serialization.
"""

from unittest.mock import MagicMock, patch
from app.services.bi_services.star_schema_engine import (
    StarSchemaEngine,
    StarSchemaQueryRequest,
)


def test_star_schema_query_request_pagination_defaults():
    req = StarSchemaQueryRequest(
        factFilePath="/storage/facts/sales.parquet",
    )
    assert req.limit == 1000
    assert req.offset == 0
    assert req.orderBy == []


def test_star_schema_query_request_custom_pagination():
    req = StarSchemaQueryRequest(
        factFilePath="/storage/facts/sales.parquet",
        limit=50,
        offset=150,
        orderBy=["fact.amount DESC"],
    )
    assert req.limit == 50
    assert req.offset == 150
    assert req.orderBy == ["fact.amount DESC"]


@patch("app.services.bi_services.star_schema_engine.QueryEngine")
def test_execute_star_query_limit_offset_pushdown(mock_qe):
    mock_con = MagicMock()
    mock_qe.get_connection.return_value = mock_con
    mock_qe._register_dataset_table.side_effect = lambda con, path: "tbl_sales"
    mock_qe._sanitize_identifier.side_effect = lambda s: s

    # Mock DataFrame result
    import pandas as pd

    df = pd.DataFrame([{"amount": 100}, {"amount": 200}])
    mock_cursor = MagicMock()
    mock_cursor.df.return_value = df
    mock_con.query.return_value = mock_cursor

    req = StarSchemaQueryRequest(
        factFilePath="/storage/facts/sales.parquet",
        limit=25,
        offset=50,
        orderBy=["amount DESC"],
    )

    records = StarSchemaEngine.execute_star_query(req)
    assert len(records) == 2
    executed_sql = mock_con.query.call_args[0][0]
    assert "LIMIT 25 OFFSET 50" in executed_sql
    assert 'ORDER BY fact."amount" DESC' in executed_sql


@patch("app.services.bi_services.star_schema_engine.QueryEngine")
def test_execute_paginated_star_query_metadata(mock_qe):
    mock_con = MagicMock()
    mock_qe.get_connection.return_value = mock_con
    mock_qe._register_dataset_table.side_effect = lambda con, path: "tbl_sales"
    mock_qe._sanitize_identifier.side_effect = lambda s: s

    import pandas as pd

    df = pd.DataFrame([{"id": 1, "amount": 100}, {"id": 2, "amount": 200}])
    mock_cursor = MagicMock()
    mock_cursor.df.return_value = df
    mock_con.query.return_value = mock_cursor

    # Mock count query returning 100 total rows
    mock_count_cursor = MagicMock()
    mock_count_cursor.fetchone.return_value = (100,)
    mock_con.query.side_effect = [mock_count_cursor, mock_cursor]

    req = StarSchemaQueryRequest(
        factFilePath="/storage/facts/sales.parquet",
        limit=10,
        offset=20,
    )

    res = StarSchemaEngine.execute_paginated_star_query(req)
    assert res["total"] == 100
    assert res["limit"] == 10
    assert res["offset"] == 20
    assert res["page"] == 3
    assert res["total_pages"] == 10
    assert res["has_more"] is True
    assert len(res["items"]) == 2
