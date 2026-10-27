"""
Unit tests for Apache Arrow IPC streaming router.
"""

from app.routers.bi_routers.arrow_stream import stream_dataset_arrow

def test_arrow_router_import():
    assert callable(stream_dataset_arrow)
