"""
Phase 5 Expansion Unit Tests
Tests for StarSchemaEngine and ForecastingService
"""

import pytest
from app.services.bi_services.forecasting_service import ForecastingService

def test_forecasting_service_trend():
    history = [
        {"value": 100},
        {"value": 110},
        {"value": 120},
        {"value": 130},
        {"value": 140},
    ]
    res = ForecastingService.forecast_metric(history, value_column="value", horizon_days=7)
    assert res["historical_count"] == 5
    assert res["trend"] == "upward"
    assert len(res["forecast"]) == 7
    assert res["forecast"][0]["forecast_value"] > 140

def test_forecasting_service_empty():
    res = ForecastingService.forecast_metric([])
    assert res["forecast"] == []
    assert res["trend"] == "flat"
