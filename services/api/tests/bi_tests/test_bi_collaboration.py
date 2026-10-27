"""
Unit tests for DashboardCollaborationService real-time Redis pub/sub broadcasting.
"""

from unittest.mock import AsyncMock, patch
import pytest

from app.services.bi_services.collaboration import DashboardCollaborationService


@pytest.mark.asyncio
async def test_broadcast_annotation_publishes_to_redis_channel():
    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock(return_value=1)

    with patch(
        "app.services.bi_services.collaboration.get_redis",
        return_value=mock_redis,
    ):
        comment_payload = {
            "id": 10,
            "dashboard_id": 42,
            "content": "Notice spike in Oran warehouse inventory",
            "position_x": 35.5,
            "position_y": 70.0,
        }
        await DashboardCollaborationService.broadcast_annotation(
            event_type="annotation_created",
            dashboard_id=42,
            comment_data=comment_payload,
            user_id=101,
        )

        mock_redis.publish.assert_awaited_once()
        call_args = mock_redis.publish.await_args[0]
        channel = call_args[0]
        raw_payload = call_args[1]

        assert channel == "dashboard:42:collab"
        assert '"annotation_created"' in raw_payload
        assert '"dashboard_id": 42' in raw_payload
        assert '"position_x": 35.5' in raw_payload


@pytest.mark.asyncio
async def test_broadcast_live_cursor_stores_state_and_publishes():
    mock_redis = AsyncMock()
    mock_redis.hset = AsyncMock()
    mock_redis.expire = AsyncMock()
    mock_redis.publish = AsyncMock()

    with patch(
        "app.services.bi_services.collaboration.get_redis",
        return_value=mock_redis,
    ):
        await DashboardCollaborationService.broadcast_live_cursor(
            dashboard_id=42,
            user_id=101,
            user_name="Karim Bennaceur",
            position_x=45.2,
            position_y=68.9,
            widget_id=7,
        )

        mock_redis.hset.assert_awaited_once()
        mock_redis.expire.assert_awaited_once()
        mock_redis.publish.assert_awaited_once()

        pub_args = mock_redis.publish.await_args[0]
        assert pub_args[0] == "dashboard:42:collab"
        assert '"cursor_move"' in pub_args[1]
        assert '"Karim Bennaceur"' in pub_args[1]


@pytest.mark.asyncio
async def test_broadcast_presence_and_active_collaborators():
    mock_redis = AsyncMock()
    mock_redis.hset = AsyncMock()
    mock_redis.expire = AsyncMock()
    mock_redis.publish = AsyncMock()

    with patch(
        "app.services.bi_services.collaboration.get_redis",
        return_value=mock_redis,
    ):
        await DashboardCollaborationService.broadcast_presence(
            dashboard_id=42,
            user_id=101,
            user_name="Karim",
            status="active",
        )

        mock_redis.hset.assert_awaited_once()
        mock_redis.publish.assert_awaited_once()
