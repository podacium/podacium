"""ASGI middleware to strip trailing slashes from API request paths.

Prevents 404s when clients send requests like /api/profiles/me/ instead of
/api/profiles/me. Applied after path-based routing decisions but before
route matching so FastAPI sees the canonical (no trailing slash) path.
"""

import logging
from starlette.types import ASGIApp, Scope, Receive, Send

logger = logging.getLogger(__name__)


class TrailingSlashMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] in ("http", "websocket"):
            path = scope.get("path", "")
            if len(path) > 1 and path.endswith("/"):
                scope["path"] = path.rstrip("/")
                logger.debug("TrailingSlashMiddleware: %s -> %s", path, scope["path"])
        await self.app(scope, receive, send)
