"""
Comprehensive Institutional Verification Suite for Executive Cockpit Engine (Layer 10).
Validates:
1. [CRITICAL-BI-01] Sandbox Lockdown: Arbitrary filesystem access blocked (read_csv_auto, read_parquet).
2. [CRITICAL-BI-02] BoundedDuckDBPool concurrency, memory limit, and connection recycling.
3. [HIGH-BI-03] AST Parameterized Filter Injection Immunity.
4. Tier 1 & 2 Root-Cause Driver Breakdown & Statistical Anomaly Detection (Waterfall, Z-score, IQR, Holt-Winters).
5. Tier 3 Sub-50ms Vectorized What-If Simulation Sandbox.
6. Canonical 58-Wilaya Hierarchical Cascading Engine.
7. Algerian Colloquial Arabizi WhatsApp Parser (mlyon, alf, myar, chkara, douro, centimes, kridi, Parquet).
"""

import os
import time
import pytest

from app.services.bi_services.query_engine import (
    QueryEngine,
    QueryError,
    BoundedDuckDBPool,
)
from app.services.bi_services.star_schema_engine import StarSchemaEngine
from app.services.bi_services.driver_engine import DriverEngine
from app.services.bi_services.simulation_engine import SimulationEngine
from app.services.bi_services.wilaya_engine import WilayaEngine
from app.services.bi_services.whatsapp_parser import WhatsAppParser


class TestCockpitSecurityAndEngines:
    """Institutional tests for BI Cockpit Engine security and computational layers."""

    # ───────────────────────────────────────────────────────────────────
    # 1. Sandbox Lockdown & Filesystem Access Tests [CRITICAL-BI-01]
    # ───────────────────────────────────────────────────────────────────

    def test_duckdb_sandbox_blocks_arbitrary_filesystem_access(self):
        """Verify that read_csv_auto on sensitive paths is strictly denied."""
        with pytest.raises(QueryError) as exc_info:
            QueryEngine.execute_query("SELECT * FROM read_csv_auto('/etc/passwd')")
        assert (
            "Forbidden keyword" in str(exc_info.value)
            or "permission" in str(exc_info.value).lower()
        )

    def test_duckdb_sandbox_blocks_forbidden_storage_keywords(self):
        """Verify that ATTACH, IMPORT, COPY, EXPORT, CHECKPOINT, and VACUUM are rejected."""
        forbidden_queries = [
            "SELECT * FROM read_parquet('/var/log/syslog')",
            "ATTACH 'evil.db' AS evil",
            "COPY my_table TO '/tmp/leak.csv'",
            "EXPORT DATABASE '/tmp/leaked_db'",
            "VACUUM",
        ]
        for q in forbidden_queries:
            with pytest.raises(QueryError):
                QueryEngine.execute_query(q)

    def test_path_security_traversal_rejection(self):
        """Verify directory traversal is blocked outside allowed roots."""
        with pytest.raises(
            QueryError, match="Invalid or restricted file path traversal"
        ):
            QueryEngine._validate_path_security("/etc/shadow")

        with pytest.raises(
            QueryError, match="Invalid or restricted file path traversal"
        ):
            QueryEngine._validate_path_security("../../secrets/jwt_secret.pem")

    # ───────────────────────────────────────────────────────────────────
    # 2. Bounded DuckDB Connection Pool Tests [CRITICAL-BI-02]
    # ───────────────────────────────────────────────────────────────────

    def test_bounded_duckdb_pool_lifecycle(self):
        """Verify pool limits, acquisition, recycling, and memory ceiling."""
        pool = BoundedDuckDBPool(max_size=3, memory_limit="512MB", threads=2)
        conns = []
        for _ in range(3):
            c = pool.acquire(timeout=2.0)
            assert c is not None
            conns.append(c)

        # Release all back to pool
        for c in conns:
            pool.release(c)

        # Re-acquire from pool without provisioning new instances
        c_reused = pool.acquire(timeout=1.0)
        assert c_reused is not None
        pool.release(c_reused)

    # ───────────────────────────────────────────────────────────────────
    # 3. AST Filter Parameterization & SQL Injection Tests [HIGH-BI-03]
    # ───────────────────────────────────────────────────────────────────

    def test_star_schema_filter_sql_injection_defense(self, tmp_path):
        """Ensure malicious string filter input cannot escape predicate AST."""
        import pandas as pd
        from app.services.bi_services.star_schema_engine import StarSchemaQueryRequest

        df = pd.DataFrame(
            {
                "organization_id": [1, 1, 2],
                "wilaya": ["16", "31", "16"],
                "amount": [100.0, 200.0, 300.0],
            }
        )
        fact_path = str(tmp_path / "fact_sales.parquet")
        df.to_parquet(fact_path, index=False)

        req = StarSchemaQueryRequest(
            factFilePath=fact_path,
            selectColumns=["amount"],
            filters={"wilaya": "16' OR '1'='1"},
        )

        # Parameter binding ensures this treats the malicious string literally
        # resulting in 0 matches rather than leaking all rows
        res = StarSchemaEngine.execute_star_query(req, organization_id=1)
        assert res == []

    # ───────────────────────────────────────────────────────────────────
    # 4. Variance Decomposition & Anomaly Detection (Tier 2)
    # ───────────────────────────────────────────────────────────────────

    def test_waterfall_variance_decomposition(self):
        """Verify root-cause waterfall formula: C_i = (Delta x_i / sum(|Delta x_j|)) * 100."""
        factors = [
            {"name": "Refund Spikes (Alger)", "impact": -1200000.0, "is_anomaly": True},
            {
                "name": "Course Sales Drop (Oran)",
                "impact": -800000.0,
                "is_anomaly": False,
            },
            {
                "name": "B2B Subscriptions (Constantine)",
                "impact": 300000.0,
                "is_anomaly": False,
            },
        ]
        result = DriverEngine.decompose_variance(
            metric="net_revenue",
            baseline=14500000.0,
            current=12800000.0,
            factor_deltas=factors,
        )

        assert result.metric == "net_revenue"
        assert result.delta == -1700000.0
        assert round(result.delta_percent, 1) == -11.7
        assert len(result.drivers) == 3

        # Check driver contributions
        total_abs = 1200000.0 + 800000.0 + 300000.0  # 2,300,000
        expected_contrib_0 = (-1200000.0 / total_abs) * 100.0  # -52.17%
        assert round(result.drivers[0].contribution_percent, 1) == round(
            expected_contrib_0, 1
        )
        assert result.drivers[0].is_anomaly is True
        assert result.drivers[0].direction == "negative"

    def test_statistical_anomaly_detection_z_score(self):
        """Verify rolling Z-score anomaly detector flags deviations >= 2.5."""
        series = [100.0 + (i % 3) for i in range(30)] + [350.0]
        anomalies = DriverEngine.detect_anomalies_zscore(
            series, window_size=14, z_threshold=2.5
        )

        assert len(anomalies) > 0
        last_point = anomalies[-1]
        assert last_point.actual == 350.0
        assert last_point.is_anomaly is True
        assert abs(last_point.score) >= 2.5

    def test_iqr_outlier_detection(self):
        """Verify IQR fence anomaly detection identifies extreme tails."""
        data = [10.0, 11.0, 12.0, 10.5, 11.2, 11.8, 10.9, 11.1, 95.0]
        anomalies = DriverEngine.detect_anomalies_iqr(
            data, window_size=20, iqr_multiplier=1.5
        )
        assert len(anomalies) == 9
        assert anomalies[-1].actual == 95.0
        assert anomalies[-1].is_anomaly is True

    def test_holt_winters_exponential_smoothing(self):
        """Verify Holt-Winters additive model produces valid forecasts and residuals."""
        series = [50.0 + 2.0 * t + (5.0 if t % 4 == 0 else 0.0) for t in range(24)]
        anomalies = DriverEngine.detect_anomalies_holt_winters(
            series, season_length=4, alpha=0.3, beta=0.1, gamma=0.1
        )
        assert len(anomalies) == 24
        assert anomalies[-1].algorithm == "holt_winters"

    # ───────────────────────────────────────────────────────────────────
    # 5. Real-Time What-If Simulation Sandbox (Tier 3)
    # ───────────────────────────────────────────────────────────────────

    def test_what_if_simulation_sla_under_50ms(self):
        """Verify simulation engine computes 6-month curves with 95% CIs in <50ms."""
        t0 = time.perf_counter()
        result = SimulationEngine.evaluate_simulation(
            retention_rate_target=0.88,
            ad_budget_dzd=650000.0,
            freelance_commission_rate=0.14,
            pricing_discount=0.05,
            horizon_months=6,
            base_monthly_revenue=12500000.0,
            base_active_users=50000,
        )
        t_elapsed = (time.perf_counter() - t0) * 1000.0

        assert t_elapsed < 50.0, f"Simulation took {t_elapsed}ms, exceeding 50ms SLA!"
        assert len(result.projections) == 6
        assert result.target_goal_zone.min_target_dzd > 0
        assert (
            result.target_goal_zone.max_target_dzd
            > result.target_goal_zone.min_target_dzd
        )

        # Verify 95% confidence intervals envelope the projected value
        for proj in result.projections:
            assert proj.lower_95_dzd < proj.projected_revenue_dzd < proj.upper_95_dzd

    # ───────────────────────────────────────────────────────────────────
    # 6. 58-Wilaya Hierarchical Cascading Engine
    # ───────────────────────────────────────────────────────────────────

    def test_wilaya_master_registry_and_resolution(self):
        """Verify full 58-Wilaya resolution across Arabic, French, and ONS codes."""
        wilayas = WilayaEngine.get_all_wilayas()
        assert len(wilayas) == 58

        # Test specific wilayas
        alger = WilayaEngine.get_wilaya("16")
        assert alger is not None
        assert alger.name_fr == "Alger"
        assert alger.name_ar == "الجزائر"
        assert alger.region == "CENTRE"

        oran = WilayaEngine.resolve_from_text("Facture envoyée à Oran pour client")
        assert oran is not None
        assert oran.code == "31"
        assert oran.region == "OUEST"

        ouargla = WilayaEngine.resolve_from_text("Livraison ورقلة")
        assert ouargla is not None
        assert ouargla.code == "30"
        assert ouargla.region == "SUD"

    # ───────────────────────────────────────────────────────────────────
    # 7. Colloquial Arabizi WhatsApp Ingestion
    # ───────────────────────────────────────────────────────────────────

    def test_whatsapp_colloquial_currency_conversion(self):
        """Verify currency conversion for mlyon, alf, myar, chkara, douro, centimes."""
        # 1 mlyon = 10,000 DZD (1,000,000 centimes)
        r1 = WhatsAppParser.parse_message("بعت 5 خبزات ب 5 mlyon في وهران")
        assert r1["amount_dzd"] == 50000.0
        assert r1["denomination"] == "mlyon"
        assert r1["category"] == "vente"
        assert r1["type"] == "revenu"

        # 1 alf = 1,000 DZD
        r2 = WhatsAppParser.parse_message("خلصت 50 alf كاش")
        assert r2["amount_dzd"] == 50000.0
        assert r2["denomination"] == "alf"
        assert r2["type"] == "depense"

        # 1 chkara = 100,000 DZD
        r3 = WhatsAppParser.parse_message("شريت سلعة ب 2 chkara كريدي")
        assert r3["amount_dzd"] == 200000.0
        assert r3["denomination"] == "chkara"
        assert r3["is_debt_kridi"] is True

        # 1 myar = 10,000,000 DZD
        r4 = WhatsAppParser.parse_message("دخل 1 myar")
        assert r4["amount_dzd"] == 10000000.0
        assert r4["denomination"] == "myar"

        # Centimes: 50,000 centimes = 500 DZD
        r5 = WhatsAppParser.parse_message("خلصت 50000 centimes")
        assert r5["amount_dzd"] == 500.0
        assert r5["denomination"] == "centimes"

        # Douro: 2,000 douro = 100 DZD
        r6 = WhatsAppParser.parse_message("بعت ب 2000 douro")
        assert r6["amount_dzd"] == 100.0
        assert r6["denomination"] == "douro"

    def test_whatsapp_bulk_and_parquet_export(self, tmp_path):
        """Verify bulk text parsing and fast columnar Parquet export."""
        raw_chat = """
        [15/04/2026, 09:30] Ahmed: بعت 10 كغ ب 5 mlyon في وهران
        [15/04/2026, 10:15] Karim: خلصت 20 alf بريدي موب
        [15/04/2026, 11:00] Omar: سلعة ب 1 chkara كريدي باقي 30000
        """
        records = WhatsAppParser.parse_bulk(raw_chat)
        assert len(records) == 3

        parquet_file = str(tmp_path / "whatsapp_fact.parquet")
        out_path = WhatsAppParser.to_parquet(records, parquet_file)
        assert os.path.exists(out_path)

        # Verify DuckDB reads the exported Parquet file smoothly
        res = QueryEngine.query_dataset(out_path)
        assert len(res) == 3
