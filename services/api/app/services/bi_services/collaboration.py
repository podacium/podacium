"""
Real-Time BI Dashboard Collaboration Service.
Manages distributed spatial pin annotations, live cursors, and presence over Redis Pub/Sub channels.
"""

import asyncio
from datetime import datetime, timezone
import json
import logging
import time
from typing import Any, AsyncGenerator, Dict, List, Optional

from app.core.redis import get_redis

logger = logging.getLogger(__name__)

CURSOR_TTL_SECONDS = 15
PRESENCE_TTL_SECONDS = 60


class DashboardCollaborationService:
    """
    Coordinates real-time collaborative dashboard interaction.
    Broadcasts spatial pin annotations and live cursor positions
    across horizontally scaled API instances using Redis Pub/Sub.
    """

    @classmethod
    def get_channel_name(cls, dashboard_id: int) -> str:
        """Get the Redis Pub/Sub channel for a specific dashboard."""
        return f"dashboard:{dashboard_id}:collab"

    @classmethod
    def get_cursor_key(cls, dashboard_id: int) -> str:
        """Get the Redis hash key for ephemeral cursor states on a dashboard."""
        return f"dashboard:{dashboard_id}:cursors"

    @classmethod
    def get_presence_key(cls, dashboard_id: int) -> str:
        """Get the Redis hash key for collaborator presence on a dashboard."""
        return f"dashboard:{dashboard_id}:presence"

    @classmethod
    async def broadcast_annotation(
        cls,
        event_type: str,
        dashboard_id: int,
        comment_data: Dict[str, Any],
        user_id: Optional[int] = None,
    ) -> None:
        """
        Broadcast spatial dashboard annotation event (create, update, resolve, delete)
        over Redis Pub/Sub to all collaborators viewing this dashboard.
        """
        channel = cls.get_channel_name(dashboard_id)
        payload = {
            "type": event_type,  # "annotation_created", "annotation_updated", "annotation_resolved", "annotation_deleted"
            "dashboard_id": dashboard_id,
            "sender_id": user_id,
            "comment": comment_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # 1. Publish to Redis Pub/Sub for cross-worker broadcast
        try:
            client = await get_redis()
            if client:
                await client.publish(channel, json.dumps(payload))
                logger.debug(
                    f"Broadcasted annotation event '{event_type}' on channel {channel}"
                )
        except Exception as e:
            logger.warning(
                f"Failed to publish annotation event over Redis pub/sub: {e}"
            )

        # 2. Forward to local WebSocket connections for instant local reactivity
        try:
            from app.routers.websocket import manager

            for uid, connections in manager.active_connections.items():
                if uid != user_id:
                    # Notify active collaborators
                    asyncio.create_task(
                        manager.send_to_user(
                            uid,
                            {
                                "type": f"dashboard:{event_type}",
                                "dashboard_id": dashboard_id,
                                "data": comment_data,
                            },
                        )
                    )
        except Exception as e:
            logger.debug(f"Local WS notification skipped or failed: {e}")

    @classmethod
    async def broadcast_live_cursor(
        cls,
        dashboard_id: int,
        user_id: int,
        user_name: str,
        position_x: float,
        position_y: float,
        widget_id: Optional[int] = None,
        avatar_url: Optional[str] = None,
    ) -> None:
        """
        Broadcast live cursor coordinate updates in real-time over Redis Pub/Sub.
        Maintains ephemeral cursor state in Redis with short TTL.
        """
        now = time.time()
        cursor_data = {
            "user_id": user_id,
            "user_name": user_name,
            "avatar_url": avatar_url,
            "position_x": float(position_x),
            "position_y": float(position_y),
            "widget_id": widget_id,
            "updated_at": now,
        }

        channel = cls.get_channel_name(dashboard_id)
        cursor_key = cls.get_cursor_key(dashboard_id)

        try:
            client = await get_redis()
            if client:
                # Save ephemeral state in Redis hash
                await client.hset(cursor_key, str(user_id), json.dumps(cursor_data))
                await client.expire(cursor_key, CURSOR_TTL_SECONDS)

                # Broadcast cursor movement frame to all subscribers
                event_payload = {
                    "type": "cursor_move",
                    "dashboard_id": dashboard_id,
                    "data": cursor_data,
                }
                await client.publish(channel, json.dumps(event_payload))
        except Exception as e:
            logger.debug(f"Redis cursor broadcast failed: {e}")

    @classmethod
    async def broadcast_presence(
        cls,
        dashboard_id: int,
        user_id: int,
        user_name: str,
        status: str = "active",  # "active", "idle", "left"
        avatar_url: Optional[str] = None,
    ) -> None:
        """
        Broadcast presence join/leave/heartbeat for real-time collaborative session.
        """
        now = time.time()
        channel = cls.get_channel_name(dashboard_id)
        presence_key = cls.get_presence_key(dashboard_id)
        cursor_key = cls.get_cursor_key(dashboard_id)

        try:
            client = await get_redis()
            if client:
                if status == "left":
                    await client.hdel(presence_key, str(user_id))
                    await client.hdel(cursor_key, str(user_id))
                else:
                    user_info = {
                        "user_id": user_id,
                        "user_name": user_name,
                        "avatar_url": avatar_url,
                        "status": status,
                        "last_seen": now,
                    }
                    await client.hset(presence_key, str(user_id), json.dumps(user_info))
                    await client.expire(presence_key, PRESENCE_TTL_SECONDS)

                payload = {
                    "type": f"presence_{status}",
                    "dashboard_id": dashboard_id,
                    "user_id": user_id,
                    "user_name": user_name,
                    "avatar_url": avatar_url,
                    "status": status,
                    "timestamp": now,
                }
                await client.publish(channel, json.dumps(payload))
        except Exception as e:
            logger.debug(f"Redis presence broadcast failed: {e}")

    @classmethod
    async def get_active_collaborators(cls, dashboard_id: int) -> List[Dict[str, Any]]:
        """
        Retrieve list of currently connected collaborators and their live cursor positions.
        """
        presence_key = cls.get_presence_key(dashboard_id)
        cursor_key = cls.get_cursor_key(dashboard_id)
        collaborators: List[Dict[str, Any]] = []

        try:
            client = await get_redis()
            if not client:
                return collaborators

            presence_data = await client.hgetall(presence_key)
            cursors_data = await client.hgetall(cursor_key)

            now = time.time()
            for uid_str, p_json in presence_data.items():
                try:
                    user_dict = json.loads(p_json)
                    # Filter out stale presence if older than TTL
                    if now - user_dict.get("last_seen", 0) > PRESENCE_TTL_SECONDS:
                        continue

                    # Attach latest live cursor if available
                    cursor_raw = cursors_data.get(uid_str)
                    if cursor_raw:
                        c_dict = json.loads(cursor_raw)
                        if now - c_dict.get("updated_at", 0) <= CURSOR_TTL_SECONDS:
                            user_dict["cursor"] = c_dict

                    collaborators.append(user_dict)
                except Exception:
                    continue

        except Exception as e:
            logger.warning(f"Failed to fetch active collaborators: {e}")

        return collaborators

    @classmethod
    async def listen_dashboard_collab(
        cls, dashboard_id: int
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Async generator subscribing to dashboard Redis Pub/Sub events in real-time.
        Yields parsed events (annotations, cursor moves, presence updates).
        """
        client = await get_redis()
        if not client:
            return

        channel = cls.get_channel_name(dashboard_id)
        pubsub = client.pubsub()
        await pubsub.subscribe(channel)

        try:
            while True:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0
                )
                if message and message.get("type") in ("message", "pmessage"):
                    raw_data = message.get("data")
                    if isinstance(raw_data, str):
                        try:
                            yield json.loads(raw_data)
                        except json.JSONDecodeError:
                            yield {"raw": raw_data}
                await asyncio.sleep(0.01)
        except asyncio.CancelledError:
            pass
        finally:
            try:
                await pubsub.unsubscribe(channel)
                await pubsub.close()
            except Exception:
                pass
