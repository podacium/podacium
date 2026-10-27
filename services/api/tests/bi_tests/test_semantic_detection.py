from app.services.bi_services.analytics_service import AnalyticsService


def test_detect_gender():
    values = ["Male", "Female", "M", "F", "homme", "femme", "ذكر", "أنثى"]
    hint = AnalyticsService._generate_semantic_hints(values, column_name="sex")
    assert hint == "gender"


def test_detect_algerian_commune():
    values = ["Bab El Oued", "Hydra", "Sidi M'Hamed", "El Biar", "Kouba"]
    hint = AnalyticsService._generate_semantic_hints(values, column_name="commune_name")
    assert hint == "commune"


def test_detect_geo_coordinates():
    lat_values = ["36.7538", "36.7325", "35.6987", "36.9000"]
    lon_values = ["3.0588", "3.0875", "3.1000", "2.9800"]

    lat_hint = AnalyticsService._generate_semantic_hints(lat_values, column_name="lat")
    lon_hint = AnalyticsService._generate_semantic_hints(lon_values, column_name="lon")

    assert lat_hint == "latitude"
    assert lon_hint == "longitude"


def test_detect_credit_card():
    values = ["4532015112830366", "5412751234567890", "4000123456789010"]
    hint = AnalyticsService._generate_semantic_hints(values, column_name="card_num")
    assert hint == "credit_card"


def test_detect_mac_address():
    values = ["00:1B:44:11:3A:B7", "00-1A-2B-3C-4D-5E", "A0:B1:C2:D3:E4:F5"]
    hint = AnalyticsService._generate_semantic_hints(values, column_name="hw_mac")
    assert hint == "mac_address"


def test_detect_duration():
    values = ["01:30:00", "02:15:30", "00:45:00"]
    hint = AnalyticsService._generate_semantic_hints(values, column_name="elapsed_time")
    assert hint == "duration"


def test_detect_dates():
    values_iso = ["2026-09-09T19:50:00Z", "2026-01-15T08:30:00Z"]
    values_slash = ["15/09/2026", "20/12/2025"]

    hint_iso = AnalyticsService._generate_semantic_hints(
        values_iso, column_name="created_at"
    )
    hint_slash = AnalyticsService._generate_semantic_hints(
        values_slash, column_name="date_val"
    )

    assert hint_iso == "datetime"
    assert hint_slash == "datetime"
