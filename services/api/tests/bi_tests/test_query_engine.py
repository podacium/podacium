import pytest
from app.services.bi_services.query_engine import QueryEngine, QueryError


class TestQueryEngine:
    def test_validate_query_happy_path(self):
        QueryEngine._validate_query("SELECT * FROM table")
        QueryEngine._validate_query("select id, name from table where id = 1")

    def test_validate_query_blocks_non_select(self):
        with pytest.raises(QueryError, match="Only SELECT queries are allowed"):
            QueryEngine._validate_query("UPDATE table SET name = 'foo'")

    def test_validate_query_blocks_forbidden_keywords(self):
        with pytest.raises(
            QueryError, match="Multi-statement SQL queries are strictly forbidden"
        ):
            QueryEngine._validate_query("SELECT * FROM table; DROP TABLE users")
        with pytest.raises(QueryError, match="Forbidden keyword detected"):
            QueryEngine._validate_query("SELECT * FROM ATTACH 'secret.db'")

    def test_execute_query_valid(self):
        # We can test against memory without external dependencies.
        res = QueryEngine.execute_query("SELECT 1 as num")
        assert len(res) == 1
        assert res[0]["num"] == 1

    def test_execute_query_with_params(self):
        res = QueryEngine.execute_query("SELECT ? as num", [42])
        assert res[0]["num"] == 42

    def test_execute_query_error_handling(self):
        with pytest.raises(QueryError, match="Query execution failed"):
            QueryEngine.execute_query("SELECT * FROM non_existent_table")

    def test_get_dataset_schema(self, tmp_path):
        import pandas as pd

        df = pd.DataFrame({"id": [1, 2], "val": [10.5, 20.1], "name": ["A", "B"]})
        file_path = str(tmp_path / "test.parquet")
        df.to_parquet(file_path)

        schema = QueryEngine.get_dataset_schema(file_path)
        assert len(schema) == 3
        types = {col["name"]: col["type"] for col in schema}
        # bigints vary but duckdb identifies them as INT usually
        assert types["val"] == "numeric"
        assert types["name"] == "text"

    def test_compute_aggregations(self, tmp_path):
        import pandas as pd

        df = pd.DataFrame({"category": ["A", "A", "B"], "revenue": [20, 30, 10]})
        file_path = str(tmp_path / "test.parquet")
        df.to_parquet(file_path)

        res = QueryEngine.compute_aggregations(
            file_path, group_by="category", agg_col="revenue", agg_func="sum"
        )
        assert len(res) == 2
        # ordered desc by value
        assert res[0]["category"] == "A"
        assert res[0]["value"] == 50.0
        assert res[1]["category"] == "B"
        assert res[1]["value"] == 10.0

    def test_query_dataset_valid(self, tmp_path):
        import pandas as pd

        df = pd.DataFrame({"id": [1, 2]})
        file_path = str(tmp_path / "test.parquet")
        df.to_parquet(file_path)

        res = QueryEngine.query_dataset(file_path)
        assert len(res) == 2
        assert res[0]["id"] == 1

    def test_get_table_expr(self):
        assert QueryEngine._get_table_expr(None) == "read_parquet('/dev/null')"
        assert QueryEngine._get_table_expr("data.csv") == "read_csv_auto('data.csv')"
        assert QueryEngine._get_table_expr("data.json") == "read_json_auto('data.json')"
        assert (
            QueryEngine._get_table_expr("data.parquet")
            == "read_parquet('data.parquet')"
        )
        assert QueryEngine._get_table_expr("data.txt") == "read_parquet('data.txt')"

    def test_validate_query_empty(self):
        assert QueryEngine._validate_query(None) is None
        assert QueryEngine._validate_query("") is None

    def test_query_dataset_with_custom_query(self, tmp_path):
        import pandas as pd

        df = pd.DataFrame({"id": [1, 2, 3]})
        file_path = str(tmp_path / "test.parquet")
        df.to_parquet(file_path)

        res = QueryEngine.query_dataset(
            file_path, query="SELECT id FROM dataset WHERE id > 1"
        )
        assert len(res) == 2
        assert res[0]["id"] == 2

    def test_query_dataset_exceptions(self):
        # Trigger an exception intentionally
        res = QueryEngine.query_dataset("non_existent.parquet")
        assert res == []

        with pytest.raises(QueryError):
            QueryEngine.query_dataset("non_existent.parquet", query="UPDATE something")

    def test_get_dataset_schema_types(self, tmp_path):
        import pandas as pd
        import datetime

        df = pd.DataFrame(
            {"dt": [datetime.date(2023, 1, 1)], "b": [True], "n": [1.5], "s": ["test"]}
        )
        file_path = str(tmp_path / "test_types.parquet")
        df.to_parquet(file_path)

        schema = QueryEngine.get_dataset_schema(file_path)
        types = {c["name"]: c["type"] for c in schema}
        assert types["dt"] == "date"
        assert types["b"] == "boolean"
        assert types["n"] == "numeric"
        assert types["s"] == "text"

    def test_get_dataset_schema_exception(self):
        schema = QueryEngine.get_dataset_schema("non_existent.parquet")
        assert schema == []

    def test_compute_aggregations_metrics(self, tmp_path):
        import pandas as pd

        df = pd.DataFrame({"cat": ["A", "A", "B"], "val": [10, 20, 30]})
        file_path = str(tmp_path / "test.parquet")
        df.to_parquet(file_path)

        # Test with multiple metrics and explicit sort_by
        res = QueryEngine.compute_aggregations(
            file_path,
            group_by="cat",
            metrics=[{"func": "max", "col": "val", "alias": "max_val"}],
            sort_by="cat",
            sort_desc=False,
        )
        assert len(res) == 2
        res_dict = {r["cat"]: r["max_val"] for r in res}
        assert res_dict["A"] == 20
        assert res_dict["B"] == 30

        # Test count(*) without agg_col or metrics
        res2 = QueryEngine.compute_aggregations(file_path, group_by="cat")
        assert len(res2) == 2
        res2_dict = {r["cat"]: r.get("value", r.get("count", 0)) for r in res2}
        assert res2_dict["A"] == 2
        assert res2_dict["B"] == 1

    def test_compute_aggregations_exception(self):
        with pytest.raises(QueryError):
            QueryEngine.compute_aggregations("non_existent.parquet", group_by="cat")

    def test_excel_file_querying(self, tmp_path):
        import pandas as pd

        df = pd.DataFrame({"revenue": [100, 200], "expenses": [40, 60]})
        file_path = str(tmp_path / "test_data.xlsx")
        df.to_excel(file_path, index=False)

        schema = QueryEngine.get_dataset_schema(file_path)
        assert len(schema) == 2
        schema_dict = {col["name"]: col["type"] for col in schema}
        assert schema_dict["revenue"] == "numeric"
        assert schema_dict["expenses"] == "numeric"

        records = QueryEngine.query_dataset(file_path)
        assert len(records) == 2
        assert records[0]["revenue"] == 100
        assert records[1]["expenses"] == 60

    def test_inject_tenant_isolation_subquery_wrapping(self):
        query = (
            "SELECT id, name FROM customers WHERE active = true ORDER BY name LIMIT 10;"
        )
        wrapped = QueryEngine.inject_tenant_isolation(query, organization_id=42)
        assert (
            wrapped
            == "SELECT * FROM (SELECT id, name FROM customers WHERE active = true ORDER BY name LIMIT 10) AS __tenant_scoped_view WHERE organization_id = '42'"
        )

        # None or empty returns original
        assert QueryEngine.inject_tenant_isolation(query, organization_id=None) == query
        assert QueryEngine.inject_tenant_isolation("", organization_id=42) == ""

    def test_rls_temporary_view_union_breakout_prevention(self, tmp_path):
        import pandas as pd

        df = pd.DataFrame(
            {
                "id": [1, 2, 3],
                "wilaya": ["ALGIERS", "ORAN", "ALGIERS"],
                "revenue_dzd": [120000, 95000, 80000],
            }
        )
        file_path = str(tmp_path / "sales.parquet")
        df.to_parquet(file_path)

        policies = [
            {
                "columnName": "wilaya",
                "operator": "=",
                "valuePredicate": "ALGIERS",
            }
        ]

        # 1. Test column projection where filtered column 'wilaya' is NOT projected
        records_proj = QueryEngine.query_dataset(
            file_path,
            query="SELECT revenue_dzd FROM dataset",
            rls_policies=policies,
        )
        assert len(records_proj) == 2
        assert records_proj[0]["revenue_dzd"] == 120000
        assert records_proj[1]["revenue_dzd"] == 80000

        # 2. Test UNION ALL breakout attempt: both branches must be bounded by temporary view
        records_union = QueryEngine.query_dataset(
            file_path,
            query="SELECT wilaya, revenue_dzd FROM dataset WHERE 1=0 UNION ALL SELECT wilaya, revenue_dzd FROM dataset",
            rls_policies=policies,
        )
        assert len(records_union) == 2
        assert all(r["wilaya"] == "ALGIERS" for r in records_union)

    def test_pool_connection_table_unregistration_and_recycling(self, tmp_path):
        import pandas as pd
        from app.services.bi_services.query_engine import BoundedDuckDBPool

        pool = BoundedDuckDBPool(max_size=2, memory_limit="512MB", threads=1)
        con = pool.acquire()

        df = pd.DataFrame({"secret": ["tenant_a_data"]})
        con.register("__ds_99999", df)
        con.execute("CREATE TEMPORARY VIEW scoped_dataset AS SELECT * FROM __ds_99999")
        tables_before = con.execute("SHOW TABLES").fetchall()
        assert len(tables_before) == 2

        # Release back to pool
        pool.release(con)

        # Re-acquire connection and verify it was scrubbed cleanly
        recycled_con = pool.acquire()
        tables_after = recycled_con.execute("SHOW TABLES").fetchall()
        assert len(tables_after) == 0
        pool.release(recycled_con)
