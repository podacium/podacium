"""
Analytics Core Service
Implements the 10 core BI analytics for Podacium using high-performance DuckDB queries.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List
from app.services.bi_services.query_engine import QueryEngine
from app.services.bi_services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)
_LOG_EXTRA = {"pillar": "bi"}


class AnalyticsCore:
    """
    Core engine for advanced business intelligence analytics.
    Each method implements one of the top 10 core analytics.
    """

    @classmethod
    def run_all_analytics(cls, file_path: str, schema: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Runs all 10 analytics types and returns a consolidated report."""
        logger.info("Starting full analytics run", extra={**_LOG_EXTRA, "file_path": file_path, "schema_cols": len(schema)})
        
        # Identify column types
        numeric_cols = [c["name"] for c in schema if c["type"] == "numeric"]
        date_cols = [c["name"] for c in schema if c["type"] == "date"]
        categorical_cols = [c["name"] for c in schema if c["type"] == "text" or c["type"] == "categorical"]
        
        # Find likely "target" columns (e.g., revenue, sales, profit)
        likely_targets = [c for c in numeric_cols if any(hint in c.lower() for hint in ["revenue", "sales", "profit", "amount", "total", "price"])]
        target_col = likely_targets[0] if likely_targets else (numeric_cols[0] if numeric_cols else None)
        
        # Find likely date column
        date_col = date_cols[0] if date_cols else None
        
        results = {
            "trend": cls.run_trend_analysis(file_path, date_col, target_col) if date_col and target_col else None,
            "comparative": cls.run_comparative_analysis(file_path, date_col, target_col) if date_col and target_col else None,
            "segmentation": cls.run_segmentation_analysis(file_path, categorical_cols[:2], target_col) if categorical_cols and target_col else None,
            "root_cause": cls.run_root_cause_analysis(file_path, numeric_cols, target_col) if numeric_cols and target_col else None,
            "what_if": cls.run_what_if_analysis(file_path, target_col) if target_col else None,
            "forecasting": cls.run_forecasting_analysis(file_path, date_col, target_col) if date_col and target_col else None,
            "correlation": cls.run_correlation_analysis(file_path, numeric_cols) if len(numeric_cols) > 1 else None,
            "anomaly": cls.run_anomaly_detection(file_path, target_col) if target_col else None,
            "funnel": cls.run_funnel_analysis(file_path, categorical_cols) if categorical_cols else None,
            "profitability": cls.run_profitability_analysis(file_path, numeric_cols) if len(numeric_cols) > 1 else None,
        }
        
        # Synthesize Global Executive Summary
        summary_key = "standard"
        if results["trend"] and results["trend"].get("trajectory") == "UPWARD":
            summary_key = "positive_growth"
        elif results["anomaly"] and results["anomaly"].get("count", 0) > 5:
            summary_key = "risk_detected"
            
        count_query = f"SELECT COUNT(*) as c FROM '{file_path}'"
        res = QueryEngine.execute_internal_query(count_query)
        row_count = res[0]["c"] if res else 0
        completeness = AnalyticsService._calculate_completeness_duckdb(file_path, [c["name"] for c in schema], row_count)
        sample_factor = min(1.0, row_count / 100.0)
        confidence_score = round(completeness * 0.8 + (sample_factor * 20))

        results["summary"] = {
            "key": summary_key,
            "params": {
                "target": target_col,
                "dimension": (categorical_cols[0] if categorical_cols else "N/A"),
                "score": confidence_score
            }
        }
        
        # Add metadata for frontend
        results["metadata"] = {
            "target_column": target_col,
            "date_column": date_col,
            "numeric_count": len(numeric_cols),
            "categorical_count": len(categorical_cols),
            "analyzed_at": datetime.now().isoformat()
        }
        logger.info(
            "Full analytics run completed",
            extra={**_LOG_EXTRA, "summary_key": summary_key, "target_col": target_col, "analyses_run": sum(1 for v in results.values() if v is not None and v != "metadata" and v != "summary")}
        )
        
        return AnalyticsService._make_json_serializable(results)

    @classmethod
    def run_trend_analysis(cls, file_path: str, date_col: str, value_col: str) -> Dict[str, Any]:
        """1. Trend Analysis: Longitudinal patterns and growth."""
        logger.debug("Running trend analysis", extra={**_LOG_EXTRA, "date_col": date_col, "value_col": value_col})
        table_expr = QueryEngine._get_table_expr(file_path)
        # Aggregate by month
        query = f"""
            SELECT 
                date_trunc('month', CAST("{date_col}" AS TIMESTAMP)) as period,
                SUM("{value_col}") as total_value,
                AVG("{value_col}") as avg_value,
                COUNT(*) as count
            FROM {table_expr}
            GROUP BY period
            ORDER BY period ASC
        """
        data = QueryEngine.execute_internal_query(query)
        
        if len(data) < 2:
            return {"status": "insufficient_data"}
            
        # Calculate growth rates
        for i in range(1, len(data)):
            prev = data[i-1]["total_value"]
            curr = data[i]["total_value"]
            if prev and prev != 0:
                data[i]["growth"] = ((curr - prev) / prev) * 100
            else:
                data[i]["growth"] = 0
                
        # Calculate overall trajectory
        first = data[0]["total_value"]
        last = data[-1]["total_value"]
        overall_growth = ((last - first) / first * 100) if first and first != 0 else 0
        
        trajectory = "UPWARD" if overall_growth > 5 else "DOWNWARD" if overall_growth < -5 else "STABLE"
        
        return {
            "type": "Trend Analysis",
            "period": "Monthly",
            "trajectory": trajectory,
            "overall_growth_pct": round(overall_growth, 2),
            "data_points": data,
            "insight": {
                "key": "trajectory",
                "params": {
                    "trajectory": trajectory,
                    "growth": round(overall_growth, 1),
                    "months": len(data)
                }
            }
        }

    @classmethod
    def run_comparative_analysis(cls, file_path: str, date_col: str, value_col: str) -> Dict[str, Any]:
        """2. Comparative Analysis: Period-over-period comparisons."""
        table_expr = QueryEngine._get_table_expr(file_path)
        
        # Use DuckDB to get current vs previous month/year
        query = f"""
            WITH monthly_data AS (
                SELECT 
                    date_trunc('month', CAST("{date_col}" AS TIMESTAMP)) as period,
                    SUM("{value_col}") as total
                FROM {table_expr}
                GROUP BY period
            )
            SELECT 
                period,
                total,
                LAG(total, 1) OVER (ORDER BY period) as prev_month_total,
                LAG(total, 12) OVER (ORDER BY period) as prev_year_total
            FROM monthly_data
            ORDER BY period DESC
            LIMIT 1
        """
        res = QueryEngine.execute_internal_query(query)
        if not res:
            return {"status": "no_data"}
            
        latest = res[0]
        curr = latest["total"]
        mom_growth = ((curr - latest["prev_month_total"]) / latest["prev_month_total"] * 100) if latest.get("prev_month_total") else None
        yoy_growth = ((curr - latest["prev_year_total"]) / latest["prev_year_total"] * 100) if latest.get("prev_year_total") else None
        
        return {
            "type": "Comparative Analysis (PoP)",
            "latest_period": str(latest["period"]),
            "current_value": curr,
            "mom_growth_pct": round(mom_growth, 2) if mom_growth is not None else None,
            "yoy_growth_pct": round(yoy_growth, 2) if yoy_growth is not None else None,
            "insight": {
                "key": "pop",
                "params": {
                    "mom": round(mom_growth, 1),
                    "yoy": round(yoy_growth, 1)
                }
            } if mom_growth is not None and yoy_growth is not None else {"key": "insufficient"}
        }

    @classmethod
    def run_segmentation_analysis(cls, file_path: str, dims: List[str], value_col: str) -> Dict[str, Any]:
        """3. Segmentation & Cohort Analysis: Grouping by dimensions."""
        table_expr = QueryEngine._get_table_expr(file_path)
        
        segments = []
        for dim in dims:
            query = f"""
                SELECT 
                    "{dim}" as segment,
                    SUM("{value_col}") as total,
                    COUNT(*) as count,
                    AVG("{value_col}") as average
                FROM {table_expr}
                GROUP BY "{dim}"
                ORDER BY total DESC
                LIMIT 10
            """
            data = QueryEngine.execute_internal_query(query)
            segments.append({
                "dimension": dim,
                "data": data
            })
            
        return {
            "type": "Segmentation Analysis",
            "segments": segments,
            "insight": {
                "key": "primary",
                "params": {
                    "dimension": dims[0]
                }
            }
        }

    @classmethod
    def run_root_cause_analysis(cls, file_path: str, numeric_cols: List[str], target_col: str) -> Dict[str, Any]:
        """4. Root Cause Analysis: Impact drivers."""
        table_expr = QueryEngine._get_table_expr(file_path)
        target_col = QueryEngine._sanitize_identifier(target_col)
        
        impacts = []
        for col in numeric_cols:
            col = QueryEngine._sanitize_identifier(col)
            if col == target_col: continue
            
            # Simple correlation as impact proxy
            query = f"SELECT corr(\"{col}\", \"{target_col}\") as correlation FROM {table_expr}"
            res = QueryEngine.execute_internal_query(query)
            if res and res[0]["correlation"] is not None:
                impacts.append({
                    "driver": col,
                    "impact_score": abs(res[0]["correlation"]),
                    "direction": "POSITIVE" if res[0]["correlation"] > 0 else "NEGATIVE"
                })
        
        impacts.sort(key=lambda x: x["impact_score"], reverse=True)
        top_driver = impacts[0]["driver"] if impacts else "N/A"
        
        return {
            "type": "Root Cause Analysis",
            "drivers": impacts[:5],
            "top_driver": top_driver,
            "insight": {
                "key": "primary",
                "params": {
                    "driver": top_driver,
                    "target": target_col
                }
            }
        }

    @classmethod
    def run_what_if_analysis(cls, file_path: str, value_col: str) -> Dict[str, Any]:
        """5. What-if Analysis: Scenario modeling."""
        table_expr = QueryEngine._get_table_expr(file_path)
        value_col = QueryEngine._sanitize_identifier(value_col)
        
        query = f"SELECT SUM(\"{value_col}\") as current_total FROM {table_expr}"
        res = QueryEngine.execute_internal_query(query)
        current = res[0]["current_total"] or 0
        
        scenarios = [
            {"label": "Conservative (+5%)", "multiplier": 1.05},
            {"label": "Moderate (+15%)", "multiplier": 1.15},
            {"label": "Optimistic (+30%)", "multiplier": 1.30},
            {"label": "Risk Scenario (-10%)", "multiplier": 0.90},
        ]
        
        for s in scenarios:
            s["projected_value"] = current * s["multiplier"]
            s["delta"] = s["projected_value"] - current
            
        return {
            "type": "What-if Analysis",
            "base_value": current,
            "scenarios": scenarios,
            "insight": {
                "key": "optimistic",
                "params": {
                    "column": value_col,
                    "value": f"{scenarios[2]['projected_value']:,.0f}" # We use string for formatted currency in params if needed, or just value
                }
            }
        }

    @classmethod
    def run_forecasting_analysis(cls, file_path: str, date_col: str, value_col: str) -> Dict[str, Any]:
        """6. Forecasting & Predictive Analysis: Future projections."""
        table_expr = QueryEngine._get_table_expr(file_path)
        
        # Simple linear projection based on last 6 months
        query = f"""
            WITH latest_months AS (
                SELECT 
                    date_trunc('month', CAST("{date_col}" AS TIMESTAMP)) as period,
                    SUM("{value_col}") as total
                FROM {table_expr}
                GROUP BY period
                ORDER BY period DESC
                LIMIT 6
            )
            SELECT AVG(total) as avg_recent, count(*) as count FROM latest_months
        """
        res = QueryEngine.execute_internal_query(query)
        if not res or res[0]["count"] < 3:
            return {"status": "insufficient_history"}
            
        query_trend = f"""
            WITH monthly AS (
                SELECT date_trunc('month', CAST("{date_col}" AS TIMESTAMP)) as period, SUM("{value_col}") as total FROM {table_expr} GROUP BY period ORDER BY period DESC LIMIT 6
            )
            SELECT total FROM monthly ORDER BY period ASC
        """
        trend_res = QueryEngine.execute_internal_query(query_trend)
        totals = [r["total"] for r in trend_res if r["total"]]
        if len(totals) >= 2 and totals[0]:
            growth_rate = ((totals[-1] - totals[0]) / totals[0]) / len(totals)
        else:
            growth_rate = 0.02

        avg = res[0]["avg_recent"]
        future = [
            {"period": "next_month", "prediction": avg * (1 + growth_rate)},
            {"period": "three_months", "prediction": avg * (1 + growth_rate * 3)},
            {"period": "six_months", "prediction": avg * (1 + growth_rate * 6)},
        ]
        
        return {
            "type": "Predictive Forecasting",
            "method": "Linear Extrapolation",
            "confidence": "MODERATE",
            "projections": future,
            "insight": {
                "key": "projected",
                "params": {
                    "column": value_col,
                    "value": f"{future[1]['prediction']:,.0f}"
                }
            }
        }

    @classmethod
    def run_correlation_analysis(cls, file_path: str, numeric_cols: List[str]) -> Dict[str, Any]:
        """7. Correlation & Regression Analysis: Multi-variable relationships."""
        table_expr = QueryEngine._get_table_expr(file_path)
        
        matrix = []
        cols_to_use = numeric_cols[:5] # Limit for UI
        for i, col1 in enumerate(cols_to_use):
            col1 = QueryEngine._sanitize_identifier(col1)
            row = {"variable": col1}
            for col2 in cols_to_use:
                col2 = QueryEngine._sanitize_identifier(col2)
                if col1 == col2:
                    row[col2] = 1.0
                else:
                    query = f"SELECT corr(\"{col1}\", \"{col2}\") as r FROM {table_expr}"
                    res = QueryEngine.execute_internal_query(query)
                    row[col2] = round(res[0]["r"], 3) if res and res[0]["r"] is not None else 0
            matrix.append(row)
            
        return {
            "type": "Correlation Analysis",
            "matrix": matrix,
            "insight": {"key": "strongest"}
        }

    @classmethod
    def run_anomaly_detection(cls, file_path: str, value_col: str) -> Dict[str, Any]:
        """8. Fraud & Anomaly Detection: Outlier identification."""
        table_expr = QueryEngine._get_table_expr(file_path)
        
        # Calculate Z-scores
        query = f"""
            WITH stats AS (
                SELECT AVG("{value_col}") as mu, STDDEV("{value_col}") as sigma FROM {table_expr}
            )
            SELECT 
                *, 
                (("{value_col}" - mu) / sigma) as z_score 
            FROM {table_expr}, stats
            WHERE ABS(("{value_col}" - mu) / sigma) > 3
            ORDER BY ABS(z_score) DESC
            LIMIT 20
        """
        anomalies = QueryEngine.execute_internal_query(query)
        
        return {
            "type": "Anomaly Detection",
            "count": len(anomalies),
            "severity": "HIGH" if len(anomalies) > 10 else "LOW",
            "top_anomalies": anomalies[:5],
            "insight": {
                "key": "detected",
                "params": {
                    "count": len(anomalies),
                    "column": value_col
                }
            }
        }

    @classmethod
    def run_funnel_analysis(cls, file_path: str, categorical_cols: List[str]) -> Dict[str, Any]:
        """9. Funnel & Conversion Analysis: Step-by-step conversion."""
        table_expr = QueryEngine._get_table_expr(file_path)
        
        # Search for status/stage columns
        stage_col = next((c for c in categorical_cols if any(hint in c.lower() for hint in ["status", "stage", "step", "phase"])), None)
        if not stage_col:
            return {
                "type": "Funnel Analysis",
                "stage_column": None,
                "stages": [],
                "insight": {"key": "no_stage"}
            }
            
        query = f"""
            SELECT 
                "{stage_col}" as stage, 
                COUNT(*) as volume
            FROM {table_expr}
            GROUP BY stage
            ORDER BY volume DESC
        """
        data = QueryEngine.execute_internal_query(query)
        
        # Calculate conversion from first stage
        base = data[0]["volume"] if data else 1
        for d in data:
            d["conversion_pct"] = (d["volume"] / base) * 100
            
        return {
            "type": "Funnel Analysis",
            "stage_column": stage_col,
            "stages": data,
            "insight": {
                "key": "conversion",
                "params": {
                    "stage": data[-1]['stage'] if data else "N/A",
                    "conversion": round(data[-1]['volume']/base*100, 1) if data else 0
                }
            }
        }
        

    @classmethod
    def run_profitability_analysis(cls, file_path: str, numeric_cols: List[str]) -> Dict[str, Any]:
        """10. Profitability & ROI Analysis: Margin and return analysis."""
        table_expr = QueryEngine._get_table_expr(file_path)
        
        revenue_col = next((c for c in numeric_cols if any(hint in c.lower() for hint in ["revenue", "sales", "income"])), None)
        cost_col = next((c for c in numeric_cols if any(hint in c.lower() for hint in ["cost", "expense", "spend"])), None)
        
        if not revenue_col:
            return {
                "type": "Profitability Analysis",
                "metrics": {
                    "total_revenue": 0,
                    "total_cost": 0,
                    "gross_margin_pct": 0,
                    "roi": 0
                },
                "insight": {"key": "missing"}
            }
            
        if cost_col:
            query = f"""
                SELECT 
                    SUM("{revenue_col}") as total_rev,
                    SUM("{cost_col}") as total_cost,
                    (SUM("{revenue_col}") - SUM("{cost_col}")) / NULLIF(SUM("{revenue_col}"), 0) * 100 as margin_pct,
                    SUM("{revenue_col}") / NULLIF(SUM("{cost_col}"), 0) as roi
                FROM {table_expr}
            """
        else:
            query = f"SELECT SUM(\"{revenue_col}\") as total_rev, 0 as total_cost, 100 as margin_pct FROM {table_expr}"
            
        res = QueryEngine.execute_internal_query(query)
        stats = res[0]
        
        return {
            "type": "Profitability Analysis",
            "metrics": {
                "total_revenue": stats["total_rev"] or 0,
                "total_cost": stats["total_cost"] or 0,
                "gross_margin_pct": round(stats["margin_pct"] or 0, 2),
                "roi": round(stats.get("roi", 0) or 0, 2),
                "total_revenue_formatted": f"{stats['total_rev'] or 0:,.0f} DZD",
                "total_cost_formatted": f"{stats['total_cost'] or 0:,.0f} DZD"
            },
            "insight": {
                "key": "summary",
                "params": {
                    "margin": round(stats['margin_pct'] or 0, 1),
                    "revenue": f"{stats['total_rev'] or 0:,.0f} DZD"
                }
            }
        }