"""Load tests for the live-session per-entity rate limits (B5).

/join is capped at 10 requests/min per session, /book at 5 requests/min per
user. Every 429 response must carry a Retry-After header so clients can back
off instead of hammering the token/booking service.
"""

import pytest
from fastapi import Depends, FastAPI, Request
from starlette.testclient import TestClient

from app.core.config import setting
from app.middleware.rate_limit import check_entity_rate_limit

_JOIN_LIMIT = 10
_BOOK_LIMIT = 5


def _build_app() -> FastAPI:
    app = FastAPI()

    async def join_limiter(request: Request):
        await check_entity_rate_limit(
            request,
            f"rl:live_join:{request.path_params['session_id']}",
            _JOIN_LIMIT,
        )

    async def book_limiter(request: Request):
        await check_entity_rate_limit(request, "rl:live_book:user-42", _BOOK_LIMIT)

    @app.post("/sessions/{session_id}/join", dependencies=[Depends(join_limiter)])
    async def join(session_id: str):
        return {"ok": True}

    @app.post("/sessions/{session_id}/book", dependencies=[Depends(book_limiter)])
    async def book(session_id: str):
        return {"ok": True}

    return app


@pytest.fixture()
def rate_limited_app(monkeypatch):
    # Force the in-memory fallback so the load test runs offline (no Redis).
    monkeypatch.setattr(setting, "REDIS_URL", "")
    monkeypatch.setattr(setting, "RATE_LIMIT_ENABLED", True)
    return _build_app()


def test_join_limited_to_10_per_session_with_retry_after(rate_limited_app):
    client = TestClient(rate_limited_app)
    codes = [client.post("/sessions/s1/join").status_code for _ in range(20)]
    assert codes[:10] == [200] * 10
    assert codes[10:] == [429] * 10

    throttled = client.post("/sessions/s1/join")
    assert throttled.status_code == 429
    assert throttled.headers.get("Retry-After"), "429 must carry Retry-After"
    assert throttled.headers["Retry-After"].isdigit()


def test_join_limit_is_per_session(rate_limited_app):
    client = TestClient(rate_limited_app)
    for _ in range(_JOIN_LIMIT):
        assert client.post("/sessions/a/join").status_code == 200
    # A different session starts with a fresh window.
    assert client.post("/sessions/b/join").status_code == 200
    assert client.post("/sessions/a/join").status_code == 429


def test_book_limited_to_5_per_user_with_retry_after(rate_limited_app):
    client = TestClient(rate_limited_app)
    codes = [client.post("/sessions/s1/book").status_code for _ in range(6)]
    assert codes[:5] == [200] * 5
    assert codes[5:] == [429] * 1

    throttled = client.post("/sessions/s1/book")
    assert throttled.status_code == 429
    assert throttled.headers.get("Retry-After")


def test_join_returns_token_response_shape_when_allowed(rate_limited_app):
    client = TestClient(rate_limited_app)
    resp = client.post("/sessions/s1/join")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
