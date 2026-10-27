"""
Tests for DuckDB AST SQL Security Guardrail and Algerian Compliance Engine (PII Cleaner).
"""

import pytest
from app.agent.security.sql_guardrail import DuckDbAstSecurityVisitor
from app.agent.security.pii_cleaner import AlgerianComplianceEngine


def test_sql_guardrail_allows_safe_select():
    sql = "SELECT id, name, count(*) FROM dataset GROUP BY id, name"
    clean_sql = DuckDbAstSecurityVisitor.validate_and_sanitize(sql, organization_id=42)
    assert "SELECT" in clean_sql
    assert "LIMIT" in clean_sql


def test_sql_guardrail_blocks_ddl_and_dml():
    bad_queries = [
        "DROP TABLE users;",
        "DELETE FROM dataset WHERE 1=1;",
        "INSERT INTO dataset VALUES (1, 'hack');",
        "UPDATE dataset SET name = 'owned';",
        "ALTER TABLE dataset ADD COLUMN leaked text;",
        "ATTACH 'db.duckdb';",
        "COPY dataset TO '/tmp/leak.csv';",
    ]
    for q in bad_queries:
        with pytest.raises(ValueError) as excinfo:
            DuckDbAstSecurityVisitor.validate_and_sanitize(q)
        assert (
            "forbidden" in str(excinfo.value).lower()
            or "read-only" in str(excinfo.value).lower()
            or "blocked" in str(excinfo.value).lower()
        )


def test_sql_guardrail_blocks_system_functions():
    with pytest.raises(ValueError):
        DuckDbAstSecurityVisitor.validate_and_sanitize("SELECT read_csv('/etc/passwd')")


def test_postal_rip_validation():
    # Valid RIP: 00799999000123456740 (where 40 is valid mod 97 check digits)
    # Let's test valid calculation:
    # 007 99999 0001234567 -> num = 7999990001234567 * 100 % 97 = remainder, key = 97 - remainder
    base_num = int("007999990001234567" + "00")
    key = 97 - (base_num % 97)
    key_str = f"{key:02d}"
    valid_rip = f"007999990001234567{key_str}"

    assert AlgerianComplianceEngine.validate_postal_rip(valid_rip) is True
    # Tampered key should fail
    bad_key_str = f"{(key + 1) % 97:02d}"
    assert (
        AlgerianComplianceEngine.validate_postal_rip(f"007999990001234567{bad_key_str}")
        is False
    )


def test_edahabia_luhn_validation():
    # Valid test Luhn card: 6035781234567895
    # Let's test known Luhn or compute one
    assert AlgerianComplianceEngine.validate_edahabia_card("123") is False
    assert AlgerianComplianceEngine.validate_edahabia_card("6035780000000001") is False


def test_pii_redaction_and_detokenization():
    engine = AlgerianComplianceEngine()
    sample_text = (
        "Bonjour, voici mon numéro NIF: 123456789012345 et ma carte EDAHABIA 6035781234567890. "
        "Mon compte CCP RIP est 00799999000123456789."
    )

    clean_text, mapping = engine.redact_text(sample_text)
    assert "123456789012345" not in clean_text
    assert "6035781234567890" not in clean_text
    assert "<PII:NIF:" in clean_text
    assert "<PII:EDAHABIA:" in clean_text
    assert len(mapping) >= 2

    # Restore
    restored = engine.detokenize_text(clean_text, mapping)
    assert "123456789012345" in restored
    assert "6035781234567890" in restored


def test_sql_guardrail_multitenant_bounds_and_limit_protection():
    # Valid positive organization_id
    rewritten = DuckDbAstSecurityVisitor.validate_and_rewrite(
        sql="SELECT id, title FROM dataset WHERE active = true LIMIT 25",
        organization_id=101,
        read_only_table_name="dataset",
        file_path="/tmp/datasets/data.parquet",
    )
    assert "WHERE _tenant_subquery.organization_id = 101" in rewritten
    assert "LIMIT 25" in rewritten
    # Ensure inner query does NOT retain LIMIT 25 (preventing premature truncation before tenant filter)
    assert (
        "FROM (SELECT id, title FROM read_parquet('/tmp/datasets/data.parquet') WHERE active = true)"
        in rewritten
    )

    # Rejects non-positive or invalid types
    with pytest.raises(ValueError):
        DuckDbAstSecurityVisitor.validate_and_rewrite(
            sql="SELECT * FROM dataset",
            organization_id=-5,
            read_only_table_name="dataset",
            file_path="/tmp/datasets/data.parquet",
        )

    with pytest.raises(ValueError):
        DuckDbAstSecurityVisitor.validate_and_rewrite(
            sql="SELECT * FROM dataset",
            organization_id=True,  # boolean should be rejected
            read_only_table_name="dataset",
            file_path="/tmp/datasets/data.parquet",
        )

    with pytest.raises(ValueError):
        DuckDbAstSecurityVisitor.validate_and_rewrite(
            sql="SELECT * FROM dataset",
            organization_id=999_999_999_999,  # exceeds bounds
            read_only_table_name="dataset",
            file_path="/tmp/datasets/data.parquet",
        )
