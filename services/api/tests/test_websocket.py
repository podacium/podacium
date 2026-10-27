"""
Tests for WebSocket connection manager and Redis Pub/Sub backplane.

Covers:
- ConnectionManager: connect, disconnect, send_to_user, is_online, get_online_count
- Distributed messaging via send_to_user_distributed
- RedisPubSub: publish, listen loop instance dedup, graceful fallback
- Dead connection cleanup during send
- Authentication helper (token validation)
"""

import pytest
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.routers.websocket import (
    ConnectionManager,
    RedisPubSub,
    INSTANCE_ID,
    authenticate_websocket,
)


# ─── ConnectionManager Unit Tests ─────────────────────────────────────────────


class TestConnectionManager:
    """Unit tests for the in-memory ConnectionManager."""

    def setup_method(self):
        self.manager = ConnectionManager()

    @pytest.mark.asyncio
    async def test_connect_adds_websocket(self):
        """Connecting a WebSocket registers it for the user."""
        ws = AsyncMock()
        await self.manager.connect(ws, 1)

        assert 1 in self.manager.active_connections
        assert ws in self.manager.active_connections[1]
        ws.accept.assert_called_once()

    @pytest.mark.asyncio
    async def test_connect_multiple_sockets_same_user(self):
        """Multiple WebSocket connections for the same user are tracked."""
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        await self.manager.connect(ws1, 1)
        await self.manager.connect(ws2, 1)

        assert len(self.manager.active_connections[1]) == 2

    def test_disconnect_removes_websocket(self):
        """Disconnecting removes the WebSocket from the user's set."""
        ws = MagicMock()
        self.manager.active_connections[1] = {ws}

        self.manager.disconnect(ws, 1)

        assert 1 not in self.manager.active_connections

    def test_disconnect_keeps_other_connections(self):
        """Disconnecting one socket keeps other sockets for the same user."""
        ws1 = MagicMock()
        ws2 = MagicMock()
        self.manager.active_connections[1] = {ws1, ws2}

        self.manager.disconnect(ws1, 1)

        assert 1 in self.manager.active_connections
        assert ws2 in self.manager.active_connections[1]
        assert ws1 not in self.manager.active_connections[1]

    def test_disconnect_nonexistent_user_safe(self):
        """Disconnecting a user that was never connected does not crash."""
        ws = MagicMock()
        self.manager.disconnect(ws, 999)  # Should not raise

    @pytest.mark.asyncio
    async def test_send_to_user_delivers_message(self):
        """send_to_user delivers JSON to all local connections."""
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        self.manager.active_connections[1] = {ws1, ws2}

        msg = {"type": "test", "data": "hello"}
        await self.manager.send_to_user(1, msg)

        ws1.send_json.assert_called_once_with(msg)
        ws2.send_json.assert_called_once_with(msg)

    @pytest.mark.asyncio
    async def test_send_to_user_no_connections(self):
        """send_to_user to a user with no connections does not crash."""
        msg = {"type": "test"}
        await self.manager.send_to_user(999, msg)  # Should not raise

    @pytest.mark.asyncio
    async def test_send_to_user_cleans_dead_connections(self):
        """Dead connections (that raise on send) are cleaned up."""
        ws_alive = AsyncMock()
        ws_dead = AsyncMock()
        ws_dead.send_json.side_effect = RuntimeError("connection closed")

        self.manager.active_connections[1] = {ws_alive, ws_dead}

        await self.manager.send_to_user(1, {"type": "test"})

        # Dead connection removed, alive connection kept
        assert ws_dead not in self.manager.active_connections[1]
        assert ws_alive in self.manager.active_connections[1]

    def test_is_online_true(self):
        """is_online returns True when user has active connections."""
        ws = MagicMock()
        self.manager.active_connections[1] = {ws}

        assert self.manager.is_online(1) is True

    def test_is_online_false(self):
        """is_online returns False when user has no connections."""
        assert self.manager.is_online(999) is False

    def test_is_online_empty_set(self):
        """is_online returns False when user's connection set is empty."""
        self.manager.active_connections[1] = set()

        assert self.manager.is_online(1) is False

    def test_get_online_count(self):
        """get_online_count returns number of users with connections."""
        self.manager.active_connections[1] = {MagicMock()}
        self.manager.active_connections[2] = {MagicMock()}
        self.manager.active_connections[3] = {MagicMock(), MagicMock()}

        assert self.manager.get_online_count() == 3


# ─── Distributed Messaging Tests ─────────────────────────────────────────────


class TestDistributedMessaging:
    """Tests for send_to_user_distributed (local + Redis Pub/Sub)."""

    def setup_method(self):
        self.manager = ConnectionManager()

    @pytest.mark.asyncio
    async def test_distributed_send_local_and_publish(self):
        """send_to_user_distributed delivers locally and publishes to Redis."""
        ws = AsyncMock()
        self.manager.active_connections[1] = {ws}

        mock_pubsub = MagicMock()
        mock_pubsub.available = True
        mock_pubsub.publish = AsyncMock()

        msg = {"type": "notification", "data": {"id": 1}}

        with patch("app.routers.websocket.redis_pubsub", mock_pubsub):
            await self.manager.send_to_user_distributed(1, msg)

        # Local delivery
        ws.send_json.assert_called_once_with(msg)

        # Redis publish
        mock_pubsub.publish.assert_called_once()
        call_args = mock_pubsub.publish.call_args
        assert call_args[0][0] in [f"ws:user:{1}", "ws_distributed"]
        payload = call_args[0][1]
        assert payload["user_id"] == 1
        assert payload["message"] == msg
        assert payload["sender_instance_id"] == INSTANCE_ID

    @pytest.mark.asyncio
    async def test_distributed_send_no_redis(self):
        """When Redis is unavailable, only local delivery happens."""
        ws = AsyncMock()
        self.manager.active_connections[1] = {ws}

        mock_pubsub = MagicMock()
        mock_pubsub.available = False

        msg = {"type": "test"}

        with patch("app.routers.websocket.redis_pubsub", mock_pubsub):
            await self.manager.send_to_user_distributed(1, msg)

        ws.send_json.assert_called_once_with(msg)
        mock_pubsub.publish.assert_not_called()

    @pytest.mark.asyncio
    async def test_broadcast_to_users(self):
        """broadcast_to_users sends to each user in the list."""
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        self.manager.active_connections[1] = {ws1}
        self.manager.active_connections[2] = {ws2}

        mock_pubsub = MagicMock()
        mock_pubsub.available = False

        msg = {"type": "broadcast"}

        with patch("app.routers.websocket.redis_pubsub", mock_pubsub):
            await self.manager.broadcast_to_users([1, 2], msg)

        ws1.send_json.assert_called_once_with(msg)
        ws2.send_json.assert_called_once_with(msg)


# ─── RedisPubSub Unit Tests ──────────────────────────────────────────────────


class TestRedisPubSub:
    """Unit tests for the RedisPubSub adapter."""

    def test_available_false_initially(self):
        """Redis is not available before connect()."""
        pubsub = RedisPubSub()
        assert pubsub.available is False

    @pytest.mark.asyncio
    async def test_publish_no_redis(self):
        """Publishing when Redis is unavailable is a no-op."""
        pubsub = RedisPubSub()
        # Should not raise
        await pubsub.publish("channel", {"test": True})

    @pytest.mark.asyncio
    async def test_publish_with_redis(self):
        """Publishing serializes to JSON and pushes to Redis."""
        pubsub = RedisPubSub()
        mock_redis = AsyncMock()
        pubsub._redis = mock_redis

        msg = {"user_id": 1, "message": {"type": "test"}}
        await pubsub.publish("ws_distributed", msg)

        mock_redis.publish.assert_called_once_with("ws_distributed", json.dumps(msg))

    @pytest.mark.asyncio
    async def test_publish_redis_error_swallowed(self):
        """Redis publish errors are logged but don't crash."""
        pubsub = RedisPubSub()
        mock_redis = AsyncMock()
        mock_redis.publish.side_effect = ConnectionError("redis down")
        pubsub._redis = mock_redis

        # Should not raise
        await pubsub.publish("channel", {"test": True})

    @pytest.mark.asyncio
    async def test_connect_no_redis_url(self):
        """connect() with empty REDIS_URL leaves Redis unavailable."""
        pubsub = RedisPubSub()

        with patch("app.routers.websocket.setting") as mock_setting:
            mock_setting.REDIS_URL = ""
            await pubsub.connect()

        assert pubsub.available is False


# ─── Authentication Tests ─────────────────────────────────────────────────────


class TestWebSocketAuth:
    """Tests for authenticate_websocket."""

    @pytest.mark.asyncio
    async def test_no_token_returns_none(self):
        """No token provided → returns None."""
        ws = MagicMock()
        ws.cookies = {}

        result = await authenticate_websocket(ws)
        assert result is None

    @pytest.mark.asyncio
    async def test_invalid_token_returns_none(self):
        """Invalid JWT → returns None."""
        ws = MagicMock()
        ws.cookies = {"access_token": "bad-token"}

        with patch("app.routers.websocket.verify_token", return_value=None):
            result = await authenticate_websocket(ws)

        assert result is None

    @pytest.mark.asyncio
    async def test_wrong_token_type_returns_none(self):
        """Token with type != 'access' → returns None."""
        ws = MagicMock()
        ws.cookies = {"access_token": "refresh-token"}

        with patch(
            "app.routers.websocket.verify_token",
            return_value={"sub": "1", "type": "refresh"},
        ):
            result = await authenticate_websocket(ws)

        assert result is None

    @pytest.mark.asyncio
    async def test_valid_token_active_user(self):
        """Valid access token for active user → returns user_id."""
        ws = MagicMock()
        ws.cookies = {"access_token": "valid-token"}

        mock_user = MagicMock()
        mock_user.id = 42
        mock_user.deletedAt = None
        mock_user.isActive = True

        with (
            patch(
                "app.routers.websocket.verify_token",
                return_value={"sub": "42", "type": "access"},
            ),
            patch("app.routers.websocket.prisma") as mock_prisma,
        ):
            mock_prisma.user.find_unique = AsyncMock(return_value=mock_user)
            result = await authenticate_websocket(ws)

        assert result == 42

    @pytest.mark.asyncio
    async def test_valid_token_deleted_user(self):
        """Valid token for deleted user → returns None."""
        ws = MagicMock()
        ws.cookies = {"access_token": "valid-token"}

        mock_user = MagicMock()
        mock_user.id = 42
        mock_user.deletedAt = datetime.now(timezone.utc)
        mock_user.isActive = True

        with (
            patch(
                "app.routers.websocket.verify_token",
                return_value={"sub": "42", "type": "access"},
            ),
            patch("app.routers.websocket.prisma") as mock_prisma,
        ):
            mock_prisma.user.find_unique = AsyncMock(return_value=mock_user)
            result = await authenticate_websocket(ws)

        assert result is None

    @pytest.mark.asyncio
    async def test_valid_token_inactive_user(self):
        """Valid token for inactive user → returns None."""
        ws = MagicMock()
        ws.cookies = {"access_token": "valid-token"}

        mock_user = MagicMock()
        mock_user.id = 42
        mock_user.deletedAt = None
        mock_user.isActive = False

        with (
            patch(
                "app.routers.websocket.verify_token",
                return_value={"sub": "42", "type": "access"},
            ),
            patch("app.routers.websocket.prisma") as mock_prisma,
        ):
            mock_prisma.user.find_unique = AsyncMock(return_value=mock_user)
            result = await authenticate_websocket(ws)

        assert result is None

    @pytest.mark.asyncio
    async def test_cookie_fallback(self):
        """Token from cookie is used when query param is absent."""
        ws = MagicMock()
        ws.cookies = {"access_token": "cookie-token"}

        mock_user = MagicMock()
        mock_user.id = 7
        mock_user.deletedAt = None
        mock_user.isActive = True

        with (
            patch(
                "app.routers.websocket.verify_token",
                return_value={"sub": "7", "type": "access"},
            ) as mock_verify,
            patch("app.routers.websocket.prisma") as mock_prisma,
        ):
            mock_prisma.user.find_unique = AsyncMock(return_value=mock_user)
            result = await authenticate_websocket(ws)

        mock_verify.assert_called_once_with("cookie-token")
        assert result == 7


# ─── WebSocket Endpoint Error Handling Tests ─────────────────────────────────


class TestWebSocketEndpointDisconnects:
    """Unit tests ensuring abrupt drops and no-close-frame errors are caught cleanly."""

    @pytest.mark.asyncio
    async def test_abrupt_disconnect_no_close_frame_logged_cleanly(self):
        """When an unhandled 'no close frame' exception is raised, it is handled without error."""
        from app.routers.websocket import websocket_endpoint
        from unittest.mock import AsyncMock

        ws = MagicMock()
        ws.receive_json = AsyncMock(
            side_effect=Exception("no close frame received or sent")
        )
        ws.send_json = AsyncMock()

        with (
            patch("app.routers.websocket.redis_pubsub.connect", new_callable=AsyncMock),
            patch(
                "app.routers.websocket.authenticate_websocket",
                new_callable=AsyncMock,
                return_value=1,
            ),
            patch("app.routers.websocket.manager.connect", new_callable=AsyncMock),
            patch("app.routers.websocket.manager.disconnect") as mock_disconnect,
            patch("app.routers.websocket.logger") as mock_logger,
        ):
            await websocket_endpoint(ws)

            mock_disconnect.assert_called_once_with(ws, 1)
            # Should log at debug level, NOT error
            mock_logger.error.assert_not_called()
            mock_logger.debug.assert_called()

    @pytest.mark.asyncio
    async def test_abrupt_connection_reset_logged_cleanly(self):
        """ConnectionResetError is caught and logged at debug level."""
        from app.routers.websocket import websocket_endpoint

        ws = MagicMock()
        ws.receive_json = AsyncMock(
            side_effect=ConnectionResetError("Connection reset by peer")
        )
        ws.send_json = AsyncMock()

        with (
            patch("app.routers.websocket.redis_pubsub.connect", new_callable=AsyncMock),
            patch(
                "app.routers.websocket.authenticate_websocket",
                new_callable=AsyncMock,
                return_value=1,
            ),
            patch("app.routers.websocket.manager.connect", new_callable=AsyncMock),
            patch("app.routers.websocket.manager.disconnect") as mock_disconnect,
            patch("app.routers.websocket.logger") as mock_logger,
        ):
            await websocket_endpoint(ws)

            mock_disconnect.assert_called_once_with(ws, 1)
            mock_logger.error.assert_not_called()
            mock_logger.debug.assert_called()
