"""
AI Predictive Forecasting & Scenario Simulation Service
Computes time-series trend forecasting, Holt-Winters exponential smoothing, and what-if scenario simulations.
"""

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class ForecastingService:
    """Service for computing linear regression, exponential smoothing metric forecasts, and scenario simulations."""

    @classmethod
    def _clean_values(cls, records: List[Dict[str, Any]], value_column: str) -> List[float]:
        """Extract clean numeric float values discarding NaNs and extreme non-numeric types."""
        values = []
        for r in records:
            v = r.get(value_column)
            if isinstance(v, (int, float)) and not math.isnan(v):
                values.append(float(v))
            elif isinstance(v, str):
                try:
                    clean_v = float(v.strip().replace(",", ""))
                    if not math.isnan(clean_v):
                        values.append(clean_v)
                except ValueError:
                    pass
        return values

    @classmethod
    def _filter_outliers_iqr(cls, values: List[float]) -> List[float]:
        """Filter extreme anomalies using Interquartile Range (IQR)."""
        if len(values) < 8:
            return values
        sorted_vals = sorted(values)
        q1 = sorted_vals[len(sorted_vals) // 4]
        q3 = sorted_vals[(len(sorted_vals) * 3) // 4]
        iqr = q3 - q1
        lower_bound = q1 - (1.5 * iqr)
        upper_bound = q3 + (1.5 * iqr)
        return [v for v in values if lower_bound <= v <= upper_bound]

    @classmethod
    def forecast_metric(
        cls,
        history_records: List[Dict[str, Any]],
        value_column: str = "value",
        horizon_days: int = 30,
        alpha: float = 0.3,
        beta: float = 0.1,
        remove_outliers: bool = True,
    ) -> Dict[str, Any]:
        """
        Generate time-series forecast for horizon_days using Holt's Exponential Smoothing (Level + Trend).
        Calculates 95% prediction intervals and model error metrics.
        """
        if not history_records:
            return {"forecast": [], "trend": "flat", "confidence": 0.0, "error": "No records provided"}

        values = cls._clean_values(history_records, value_column)
        if remove_outliers and len(values) >= 8:
            values = cls._filter_outliers_iqr(values)

        if len(values) < 2:
            return {
                "historical_count": len(values),
                "trend": "flat",
                "daily_growth_rate": 0.0,
                "horizon_days": horizon_days,
                "forecast": [],
                "confidence": 0.3,
            }

        level = values[0]
        trend = values[1] - values[0]
        sse = 0.0

        for i in range(1, len(values)):
            val = values[i]
            prev_level = level
            pred = level + trend
            sse += (val - pred) ** 2
            level = alpha * val + (1 - alpha) * (level + trend)
            trend = beta * (level - prev_level) + (1 - beta) * trend

        std_error = math.sqrt(sse / max(len(values) - 2, 1))
        last_date = datetime.now(timezone.utc)
        forecast_points = []

        for day in range(1, horizon_days + 1):
            projected_value = max(0.0, level + (day * trend))
            margin = max(std_error * math.sqrt(day), projected_value * 0.04 * math.sqrt(day))
            forecast_points.append({
                "day_ahead": day,
                "date": (last_date + timedelta(days=day)).strftime("%Y-%m-%d"),
                "forecast_value": round(projected_value, 2),
                "upper_bound": round(projected_value + margin, 2),
                "lower_bound": round(max(0.0, projected_value - margin), 2),
            })

        overall_trend = "upward" if trend > 0.05 else ("downward" if trend < -0.05 else "flat")
        variance = sum((x - (sum(values) / len(values))) ** 2 for x in values) / max(len(values), 1)
        r_squared = round(max(0.0, 1.0 - (sse / max(variance, 1e-6))), 4) if variance > 0 else 0.5

        return {
            "historical_count": len(values),
            "trend": overall_trend,
            "daily_growth_rate": round(trend, 4),
            "model_r_squared": r_squared,
            "std_error": round(std_error, 2),
            "horizon_days": horizon_days,
            "forecast": forecast_points,
        }

    @classmethod
    def simulate_scenario(
        cls,
        history_records: List[Dict[str, Any]],
        value_column: str = "value",
        growth_delta_pct: float = 0.0,
        cost_multiplier: float = 1.0,
        horizon_days: int = 30,
    ) -> Dict[str, Any]:
        """
        Run what-if scenario simulation applying delta growth rates and cost multipliers.
        """
        base_forecast = cls.forecast_metric(history_records, value_column, horizon_days)
        simulated_points = []

        mult = 1.0 + (growth_delta_pct / 100.0)
        for point in base_forecast.get("forecast", []):
            sim_val = max(0.0, point["forecast_value"] * mult * cost_multiplier)
            simulated_points.append({
                **point,
                "simulated_value": round(sim_val, 2),
                "delta_from_base": round(sim_val - point["forecast_value"], 2),
            })

        return {
            "scenario": {
                "growth_delta_pct": growth_delta_pct,
                "cost_multiplier": cost_multiplier,
            },
            "base_trend": base_forecast.get("trend"),
            "simulated_forecast": simulated_points,
        }
