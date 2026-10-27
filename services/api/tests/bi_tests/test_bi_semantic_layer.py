"""
Unit Tests for Podacium Semantic Layer Engine
"""

from app.services.bi_services.semantic import (
    Dimension,
    Measure,
    MetricASTQuery,
    SemanticSchema,
    PodaciumSemanticEngine,
)

def test_semantic_engine_compilation():
    schema = SemanticSchema(
        name="sales_schema",
        dimensions=[
            Dimension(name="wilaya", column="customer_wilaya", label="Wilaya"),
        ],
        measures=[
            Measure(name="revenue", expression="SUM(amount)", label="Revenue"),
        ],
    )
    
    query = MetricASTQuery(
        datasetPath="/storage/datasets/sales.parquet",
        dimensions=["wilaya"],
        measures=["revenue"],
        filters={"wilaya": "Algiers"},
        limit=50,
    )
    
    sql = PodaciumSemanticEngine.compile_metric_query(schema, query, organization_id=42)
    
    assert "SELECT \"customer_wilaya\" AS \"wilaya\", SUM(amount) AS \"revenue\"" in sql
    assert "FROM read_parquet('/storage/datasets/sales.parquet')" in sql
    assert "WHERE organization_id = 42" in sql
    assert "\"customer_wilaya\" = 'Algiers'" in sql
    assert "GROUP BY \"customer_wilaya\"" in sql
    assert "LIMIT 50" in sql
