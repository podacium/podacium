"""LiveKit Cloud service — room management, JWT tokens, webhook verification."""

import logging
from datetime import timedelta
from typing import Optional

from livekit.api import (
    LiveKitAPI,
    AccessToken,
    VideoGrants,
    TokenVerifier,
    WebhookReceiver,
    WebhookEvent,
    Room,
    CreateRoomRequest,
    DeleteRoomRequest,
    ListRoomsRequest,
)
from livekit.protocol.egress import (
    RoomCompositeEgressRequest,
    EncodedFileOutput,
    ListEgressRequest,
    StopEgressRequest,
    EgressInfo,
)

from app.core.config import setting

logger = logging.getLogger(__name__)


def _get_livekit_url() -> str:
    url = setting.LIVEKIT_URL
    if not url:
        raise RuntimeError("LIVEKIT_URL is not configured")
    return url


def _get_api_key() -> str:
    key = setting.LIVEKIT_API_KEY
    if not key:
        raise RuntimeError("LIVEKIT_API_KEY is not configured")
    return key


def _get_api_secret() -> str:
    secret = setting.LIVEKIT_API_SECRET
    if not secret:
        raise RuntimeError("LIVEKIT_API_SECRET is not configured")
    return secret


def create_access_token(
    identity: str,
    room_name: str,
    ttl_minutes: int = 15,
    role: str = "PARTICIPANT",
) -> str:
    token = AccessToken(_get_api_key(), _get_api_secret())
    token.with_identity(identity)
    token.with_ttl(timedelta(minutes=ttl_minutes))

    # Role-based grants: only hosts/co-hosts/admins may publish media. Plain
    # participants get a receive-only token so they can never broadcast to the
    # room, and the now-unused roomLocked flag is gone.
    can_publish = role in ("HOST", "CO_HOST", "ADMIN")
    token.with_grants(
        VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=can_publish,
            can_subscribe=True,
            can_publish_data=True,
        )
    )
    return token.to_jwt()


def create_recording_token(
    identity: str, room_name: str, ttl_minutes: int = 120
) -> str:
    token = AccessToken(_get_api_key(), _get_api_secret())
    token.with_identity(identity)
    token.with_ttl(timedelta(minutes=ttl_minutes))
    token.with_grants(
        VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            recorder=True,
        )
    )
    return token.to_jwt()


async def create_room(
    room_name: str, max_participants: int = 100, metadata: Optional[str] = None
) -> Optional[Room]:
    api = LiveKitAPI(_get_livekit_url(), _get_api_key(), _get_api_secret())
    try:
        room = await api.room.create_room(
            CreateRoomRequest(
                name=room_name,
                max_participants=max_participants,
                metadata=metadata or "",
                empty_timeout=300,
            )
        )
        return room
    except Exception as e:
        logger.error(f"Failed to create LiveKit room '{room_name}': {e}")
        return None
    finally:
        await api.aclose()


async def close_room(room_name: str) -> bool:
    api = LiveKitAPI(_get_livekit_url(), _get_api_key(), _get_api_secret())
    try:
        res = await api.room.list_rooms(ListRoomsRequest(names=[room_name]))
        rooms = getattr(res, "rooms", [])
        for room in rooms:
            await api.room.delete_room(DeleteRoomRequest(room=room.name))
            return True
        return False
    except Exception as e:
        logger.error(f"Failed to close LiveKit room '{room_name}': {e}")
        return False
    finally:
        await api.aclose()


async def get_room(room_name: str) -> Optional[Room]:
    api = LiveKitAPI(_get_livekit_url(), _get_api_key(), _get_api_secret())
    try:
        res = await api.room.list_rooms(ListRoomsRequest(names=[room_name]))
        rooms = getattr(res, "rooms", [])
        return rooms[0] if len(rooms) > 0 else None
    except Exception as e:
        logger.error(f"Failed to get LiveKit room '{room_name}': {e}")
        return None
    finally:
        await api.aclose()


async def list_rooms() -> list[Room]:
    """List all currently active LiveKit rooms (B7 metrics / ops)."""
    api = LiveKitAPI(_get_livekit_url(), _get_api_key(), _get_api_secret())
    try:
        res = await api.room.list_rooms(ListRoomsRequest())
        rooms = getattr(res, "rooms", [])
        return list(rooms)
    except Exception as e:
        logger.error(f"Failed to list LiveKit rooms: {e}")
        return []
    finally:
        await api.aclose()


async def count_active_rooms() -> int:
    """Number of currently active LiveKit rooms; feeds the livekit_rooms_active gauge.

    Never raises: if LiveKit is unreachable we publish 0 so the metric stays
    defined and the reconcile flow (which may run without LiveKit configured in
    tests) is never blocked.
    """
    from app.middleware.metrics import LIVEKIT_ROOMS_ACTIVE

    try:
        count = len(await list_rooms())
        LIVEKIT_ROOMS_ACTIVE.set(count)
        return count
    except Exception:  # noqa: BLE001
        LIVEKIT_ROOMS_ACTIVE.set(0)
        return 0


async def update_room_metadata(room_name: str, metadata: str) -> bool:
    api = LiveKitAPI(_get_livekit_url(), _get_api_key(), _get_api_secret())
    try:
        from livekit.api import UpdateRoomMetadataRequest

        await api.room.update_room_metadata(
            UpdateRoomMetadataRequest(room=room_name, metadata=metadata)
        )
        return True
    except Exception as e:
        logger.error(f"Failed to update LiveKit room metadata '{room_name}': {e}")
        return False
    finally:
        await api.aclose()


def verify_webhook(auth_header: str, body: bytes) -> Optional[WebhookEvent]:
    verifier = TokenVerifier(_get_api_key(), _get_api_secret())
    receiver = WebhookReceiver(verifier)
    try:
        body_str = body.decode("utf-8") if isinstance(body, bytes) else body
        event = receiver.receive(body_str, auth_header)
        return event
    except Exception as e:
        logger.error(f"Webhook verification failed: {e}")
        return None


async def start_room_recording(
    room_name: str,
    output_path: Optional[str] = None,
    layout: str = "grid",
) -> Optional[EgressInfo]:
    api = LiveKitAPI(_get_livekit_url(), _get_api_key(), _get_api_secret())
    try:
        req = RoomCompositeEgressRequest(
            room_name=room_name,
            layout=layout,
            file=EncodedFileOutput(
                filepath=output_path or f"{room_name}/{room_name}_recording",
            ),
        )
        egress = await api.egress.start_room_composite_egress(req)
        logger.info(
            f"Started recording for room '{room_name}', egress_id={egress.egress_id}, layout={layout}"
        )
        return egress
    except Exception as e:
        logger.error(f"Failed to start recording for room '{room_name}': {e}")
        return None
    finally:
        await api.aclose()


async def stop_room_recording(room_name: str) -> bool:
    api = LiveKitAPI(_get_livekit_url(), _get_api_key(), _get_api_secret())
    try:
        egresses = await api.egress.list_egress(
            ListEgressRequest(room_name=room_name, active=True)
        )
        for item in egresses.items:
            await api.egress.stop_egress(StopEgressRequest(egress_id=item.egress_id))
            logger.info(
                f"Stopped recording egress_id={item.egress_id} for room '{room_name}'"
            )
        return True
    except Exception as e:
        logger.error(f"Failed to stop recording for room '{room_name}': {e}")
        return False
    finally:
        await api.aclose()


async def remove_participant(room_name: str, identity: str) -> bool:
    """Evict a participant immediately from a LiveKit room."""
    api = LiveKitAPI(_get_livekit_url(), _get_api_key(), _get_api_secret())
    try:
        from livekit.api import RoomParticipantIdentity

        await api.room.remove_participant(
            RoomParticipantIdentity(room=room_name, identity=identity)
        )
        logger.info(f"Removed participant '{identity}' from room '{room_name}'")
        return True
    except Exception as e:
        logger.error(
            f"Failed to remove participant '{identity}' from room '{room_name}': {e}"
        )
        return False
    finally:
        await api.aclose()


async def list_room_participants(room_name: str) -> list:
    """Fetch real-time participants and tracks from LiveKit RoomService."""
    api = LiveKitAPI(_get_livekit_url(), _get_api_key(), _get_api_secret())
    try:
        from livekit.api import ListParticipantsRequest

        res = await api.room.list_participants(ListParticipantsRequest(room=room_name))
        return list(res.participants)
    except Exception as e:
        logger.error(f"Failed to query participants for room '{room_name}': {e}")
        return []
    finally:
        await api.aclose()
