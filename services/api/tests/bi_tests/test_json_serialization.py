import json
import numpy as np
import pandas as pd
from app.services.bi_services.analytics_service import AnalyticsService


def test_make_json_serializable_nan_inf():
    payload = {
        "normal_float": 42.5,
        "nan_float": float("nan"),
        "inf_float": float("inf"),
        "neginf_float": float("-inf"),
        "np_nan": np.nan,
        "np_inf": np.inf,
        "pd_na": pd.NA,
        "nested": {"val": float("nan"), "arr": [1.0, float("inf"), np.nan, "hello"]},
    }

    sanitized = AnalyticsService._make_json_serializable(payload)

    # Should serialize cleanly with standard json.dumps without raising ValueError
    serialized_str = json.dumps(sanitized)
    deserialized = json.loads(serialized_str)

    assert deserialized["normal_float"] == 42.5
    assert deserialized["nan_float"] is None
    assert deserialized["inf_float"] is None
    assert deserialized["neginf_float"] is None
    assert deserialized["np_nan"] is None
    assert deserialized["np_inf"] is None
    assert deserialized["pd_na"] is None
    assert deserialized["nested"]["val"] is None
    assert deserialized["nested"]["arr"] == [1.0, None, None, "hello"]
