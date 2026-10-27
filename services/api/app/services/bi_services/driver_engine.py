"""
Driver Analysis and Anomaly Decomposition Engine.
Implements Tier 2 (Analysis & Driver Layer) of the Executive Cockpit:
- Automated Root-Cause Driver Breakdown & Waterfall Attribution
- Statistical Anomaly Detection (Rolling Z-score, IQR Fences, Holt-Winters Exponential Smoothing)
- Multi-Factor Variance Decomposition (Price, Volume, Cross-elasticity, Shapley allocation)
"""

import logging
from typing import Any, Dict, List, Optional
import numpy as np
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class DriverImpact(BaseModel):
    name: str = Field(..., description="Driver description or dimensional slice")
    impact: float = Field(..., description="Absolute impact in metric units (delta)")
    direction: str = Field(..., description="'positive' or 'negative'")
    is_anomaly: bool = Field(
        False, description="Whether this driver triggered an anomaly condition"
    )
    contribution_percent: Optional[float] = Field(
        None, description="Percentage contribution to total deviation"
    )
    dimension: Optional[str] = None
    baseline_value: Optional[float] = None
    current_value: Optional[float] = None


class WaterfallDecomposition(BaseModel):
    metric: str
    baseline: float
    current: float
    delta: float
    delta_percent: float
    drivers: List[DriverImpact]
    unexplained_residual: float = 0.0


class AnomalyPoint(BaseModel):
    index: int
    actual: float
    expected: float
    lower_bound: float
    upper_bound: float
    score: float
    is_anomaly: bool
    algorithm: str


class DriverEngine:
    """
    Institutional-grade Variance Decomposition and Anomaly Detection Engine.
    """

    @classmethod
    def decompose_variance(
        cls,
        metric: str,
        baseline: float,
        current: float,
        factor_deltas: List[Dict[str, Any]],
        z_threshold: float = 2.5,
    ) -> WaterfallDecomposition:
        """
        Compute root-cause driver contribution for horizontal waterfall charts:
        C_i = (Delta x_i / sum(|Delta x_j|)) * 100
        """
        delta = current - baseline
        delta_pct = (delta / baseline * 100.0) if baseline != 0 else 0.0

        if not factor_deltas:
            return WaterfallDecomposition(
                metric=metric,
                baseline=round(baseline, 2),
                current=round(current, 2),
                delta=round(delta, 2),
                delta_percent=round(delta_pct, 2),
                drivers=[],
                unexplained_residual=round(delta, 2),
            )

        # Sum of absolute driver impacts for normalization
        total_abs_impact = sum(abs(float(f.get("impact", 0.0))) for f in factor_deltas)
        if total_abs_impact == 0:
            total_abs_impact = 1e-9

        # Identify statistical outlier drivers using IQR or Z-score across impacts
        impact_values = [float(f.get("impact", 0.0)) for f in factor_deltas]
        mean_impact = float(np.mean(impact_values))
        std_impact = float(np.std(impact_values)) if len(impact_values) > 1 else 1.0
        std_impact_safe = max(std_impact, 1e-6)

        drivers: List[DriverImpact] = []
        assigned_delta = 0.0

        for f in factor_deltas:
            raw_impact = float(f.get("impact", 0.0))
            assigned_delta += raw_impact
            direction = "positive" if raw_impact >= 0 else "negative"

            # Check anomaly flag or calculate via Z-score
            z_score = abs(raw_impact - mean_impact) / std_impact_safe
            is_anom = bool(f.get("is_anomaly", z_score >= z_threshold))

            # Contribution formula: C_i = (Delta x_i / sum(|Delta x_j|)) * 100
            contrib = (raw_impact / total_abs_impact) * 100.0

            drivers.append(
                DriverImpact(
                    name=str(f.get("name", "Unknown Driver")),
                    impact=round(raw_impact, 2),
                    direction=direction,
                    is_anomaly=is_anom,
                    contribution_percent=round(contrib, 2),
                    dimension=f.get("dimension"),
                    baseline_value=f.get("baseline_value"),
                    current_value=f.get("current_value"),
                )
            )

        # Sort drivers by absolute impact magnitude descending
        drivers.sort(key=lambda d: abs(d.impact), reverse=True)
        unexplained = delta - assigned_delta

        return WaterfallDecomposition(
            metric=metric,
            baseline=round(baseline, 2),
            current=round(current, 2),
            delta=round(delta, 2),
            delta_percent=round(delta_pct, 2),
            drivers=drivers,
            unexplained_residual=round(unexplained, 2),
        )

    @classmethod
    def decompose_price_volume(
        cls,
        p0: float,
        q0: float,
        p1: float,
        q1: float,
    ) -> Dict[str, Any]:
        """
        Exact multi-factor revenue variance decomposition:
        Delta R = Delta P * Q0 + P0 * Delta Q + Delta P * Delta Q
        Shapley allocation:
        E_P = Delta P * (Q0 + Q1) / 2
        E_Q = Delta Q * (P0 + P1) / 2
        """
        delta_p = p1 - p0
        delta_q = q1 - q0
        r0 = p0 * q0
        r1 = p1 * q1
        delta_r = r1 - r0

        price_effect = delta_p * q0
        volume_effect = p0 * delta_q
        cross_effect = delta_p * delta_q

        shapley_price = delta_p * ((q0 + q1) / 2.0)
        shapley_volume = delta_q * ((p0 + p1) / 2.0)

        return {
            "r0": round(r0, 2),
            "r1": round(r1, 2),
            "delta_r": round(delta_r, 2),
            "price_effect": round(price_effect, 2),
            "volume_effect": round(volume_effect, 2),
            "cross_effect": round(cross_effect, 2),
            "shapley_price": round(shapley_price, 2),
            "shapley_volume": round(shapley_volume, 2),
        }

    @classmethod
    def detect_anomalies_zscore(
        cls,
        series: List[float],
        window_size: int = 14,
        z_threshold: float = 2.5,
    ) -> List[AnomalyPoint]:
        """
        Rolling window Z-score anomaly detection over transactional time-series.
        Flags |Z| >= z_threshold against rolling baselines.
        """
        results: List[AnomalyPoint] = []
        n = len(series)
        if n == 0:
            return results

        for i in range(n):
            start = max(0, i - window_size)
            window = series[start:i] if i > 0 else [series[0]]

            if len(window) < 3:
                val = series[i]
                results.append(
                    AnomalyPoint(
                        index=i,
                        actual=val,
                        expected=val,
                        lower_bound=val,
                        upper_bound=val,
                        score=0.0,
                        is_anomaly=False,
                        algorithm="z_score",
                    )
                )
                continue

            mu = float(np.mean(window))
            sigma = float(np.std(window, ddof=1)) if len(window) > 1 else 0.0
            sigma_safe = max(sigma, 1e-6)

            val = series[i]
            z = (val - mu) / sigma_safe
            is_anom = abs(z) >= z_threshold

            results.append(
                AnomalyPoint(
                    index=i,
                    actual=round(val, 2),
                    expected=round(mu, 2),
                    lower_bound=round(mu - z_threshold * sigma, 2),
                    upper_bound=round(mu + z_threshold * sigma, 2),
                    score=round(z, 2),
                    is_anomaly=is_anom,
                    algorithm="z_score",
                )
            )

        return results

    @classmethod
    def detect_anomalies_iqr(
        cls,
        series: List[float],
        window_size: int = 20,
        iqr_multiplier: float = 1.5,
    ) -> List[AnomalyPoint]:
        """
        Interquartile Range (IQR) fence boundaries for non-parametric outlier detection.
        Lower Inner = Q1 - 1.5 * IQR, Upper Inner = Q3 + 1.5 * IQR.
        """
        results: List[AnomalyPoint] = []
        n = len(series)
        if n == 0:
            return results

        for i in range(n):
            start = max(0, i - window_size)
            window = series[start:i] if i > 0 else [series[0]]

            if len(window) < 5:
                val = series[i]
                results.append(
                    AnomalyPoint(
                        index=i,
                        actual=val,
                        expected=val,
                        lower_bound=val,
                        upper_bound=val,
                        score=0.0,
                        is_anomaly=False,
                        algorithm="iqr",
                    )
                )
                continue

            q1 = float(np.percentile(window, 25))
            q3 = float(np.percentile(window, 75))
            median = float(np.median(window))
            iqr = q3 - q1
            iqr_safe = max(iqr, 1e-6)

            lower_bound = q1 - (iqr_multiplier * iqr)
            upper_bound = q3 + (iqr_multiplier * iqr)

            val = series[i]
            is_anom = val < lower_bound or val > upper_bound
            score = (
                (val - q3) / iqr_safe
                if val > q3
                else ((q1 - val) / iqr_safe if val < q1 else 0.0)
            )

            results.append(
                AnomalyPoint(
                    index=i,
                    actual=round(val, 2),
                    expected=round(median, 2),
                    lower_bound=round(lower_bound, 2),
                    upper_bound=round(upper_bound, 2),
                    score=round(score, 2),
                    is_anomaly=is_anom,
                    algorithm="iqr",
                )
            )

        return results

    @classmethod
    def detect_anomalies_holt_winters(
        cls,
        series: List[float],
        season_length: int = 7,
        alpha: float = 0.2,
        beta: float = 0.05,
        gamma: float = 0.1,
        k: float = 2.5,
    ) -> List[AnomalyPoint]:
        """
        Holt-Winters Additive Triple Exponential Smoothing with dynamic MAD bounds.
        """
        n = len(series)
        if n < 2 * season_length:
            return cls.detect_anomalies_zscore(series, window_size=season_length * 2)

        m = season_length
        level = sum(series[:m]) / m
        trend = sum((series[m + i] - series[i]) / m for i in range(m)) / m

        seasonals = [series[i] - level for i in range(m)]
        norm = sum(seasonals) / m
        seasonals = [s - norm for s in seasonals]

        mad = 0.0
        results: List[AnomalyPoint] = []

        for t in range(n):
            expected = level + trend + seasonals[t % m]
            actual = series[t]
            residual = actual - expected

            mad = 0.1 * abs(residual) + 0.9 * mad
            spread = max(k * 1.25 * mad, 1e-4)
            lower_bound = expected - spread
            upper_bound = expected + spread

            is_anom = actual < lower_bound or actual > upper_bound
            score = residual / spread

            results.append(
                AnomalyPoint(
                    index=t,
                    actual=round(actual, 2),
                    expected=round(expected, 2),
                    lower_bound=round(lower_bound, 2),
                    upper_bound=round(upper_bound, 2),
                    score=round(score, 2),
                    is_anomaly=is_anom,
                    algorithm="holt_winters",
                )
            )

            damp = 0.2 if is_anom else 1.0
            prev_level = level
            level = (alpha * damp) * (actual - seasonals[t % m]) + (
                1 - alpha * damp
            ) * (prev_level + trend)
            trend = (beta * damp) * (level - prev_level) + (1 - beta * damp) * trend
            seasonals[t % m] = (gamma * damp) * (actual - level) + (
                1 - gamma * damp
            ) * seasonals[t % m]

        return results
