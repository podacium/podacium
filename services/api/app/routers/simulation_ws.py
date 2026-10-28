"""
TamWheel Sovereign Ethical Agentic Venture OS — Real-Time Multiplayer Simulation & Pitch Arena WebSocket Router.
Pillar 6: Realtime Multiplayer Watch Party & Live Pitch Arena WebSockets.
- Synchronized video/room playback clock (delta < 250ms broadcast state).
- Live reaction emoji stream: 🚀 (Moon), 🧐 (Skeptical), 💡 (Genius), 🚩 (Red Flag), 🇩🇿 (Local Pride).
- Real-time rolling sentiment radar: Computes instant crowd sentiment percentage [0-100%];
  triggers "Hype Alarm" if sentiment drops < 35% during pitch.
- Pitch Arena Stage state machine:
  LOBBY -> PITCH_ACTIVE (3 min) -> GRILLING_ACTIVE (5 min) -> FLASH_ALLOCATION (60 sec) -> CLOSED.
- 60-second Flash Allocation broadcast window: Pushes live simulated pledges into the crowd ticker in real-time.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from websockets.exceptions import ConnectionClosed

from app.core.security import verify_token
from app.services.arena_service import (
    ArenaStage,
    ArenaSession,
    arena_service,
    REACTION_CONFIG,
    MAX_DRIFT_TOLERANCE_MS,
    HYPE_ALARM_THRESHOLD_PCT,
)
from app.services.stage_queue_manager import (
    stage_queue_manager,
    SpeakerRole,
)
from app.services.slide_synchronizer import (
    slide_deck_synchronizer,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["simulation_websocket", "pitch_arena_websocket"])


# =============================================================================
# SIMULATION MULTIPLAYER CONNECTION MANAGER
# =============================================================================

class SimulationConnectionManager:
    """
    Manages active WebSocket connections subscribed to real-time venture simulation events,
    interactive watch parties, and live pitch arenas.
    """

    def __init__(self):
        # connection -> set of subscribed rooms (e.g. "global", "startup:<id>", "arena:<id>", "league")
        self.connection_rooms: Dict[WebSocket, Set[str]] = {}
        # room -> set of active WebSockets
        self.room_subscribers: Dict[str, Set[WebSocket]] = {
            "global": set(),
        }
        # connection -> metadata dict (client_id, user_id, username, connected_at)
        self.connection_meta: Dict[WebSocket, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def connect(
        self,
        websocket: WebSocket,
        client_id: str,
        user_id: Optional[int] = None,
        username: Optional[str] = None,
    ):
        await websocket.accept()
        async with self._lock:
            self.connection_rooms[websocket] = {"global"}
            self.room_subscribers.setdefault("global", set()).add(websocket)
            self.connection_meta[websocket] = {
                "client_id": client_id,
                "user_id": user_id,
                "username": username or f"Backer-{client_id[:6]}",
                "connected_at": time.time(),
            }
        logger.info(f"Arena/Simulation WS connected: client={client_id}, user={user_id}")

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            rooms = self.connection_rooms.pop(websocket, set())
            for room in rooms:
                if room in self.room_subscribers:
                    self.room_subscribers[room].discard(websocket)
                    if not self.room_subscribers[room] and room != "global":
                        del self.room_subscribers[room]
            meta = self.connection_meta.pop(websocket, {})
        logger.info(f"Arena/Simulation WS disconnected: client={meta.get('client_id')}")

    async def subscribe_room(self, websocket: WebSocket, room: str):
        async with self._lock:
            if websocket in self.connection_rooms:
                self.connection_rooms[websocket].add(room)
                self.room_subscribers.setdefault(room, set()).add(websocket)

    async def unsubscribe_room(self, websocket: WebSocket, room: str):
        async with self._lock:
            if websocket in self.connection_rooms:
                self.connection_rooms[websocket].discard(room)
            if room in self.room_subscribers:
                self.room_subscribers[room].discard(websocket)

    async def broadcast_to_room(self, room: str, message: Dict[str, Any]):
        """
        Broadcasts JSON event payload to all clients subscribed to `room`.
        """
        async with self._lock:
            targets = list(self.room_subscribers.get(room, set()))

        if not targets:
            return

        payload = json.dumps(message)
        dead_sockets: List[WebSocket] = []

        async def _safe_send(ws: WebSocket):
            try:
                await asyncio.wait_for(ws.send_text(payload), timeout=2.0)
            except (WebSocketDisconnect, ConnectionClosed, asyncio.TimeoutError, Exception):
                dead_sockets.append(ws)

        await asyncio.gather(*[_safe_send(ws) for ws in targets], return_exceptions=True)

        for ws in dead_sockets:
            await self.disconnect(ws)

    # -------------------------------------------------------------------------
    # DOMAIN BROADCAST HELPERS
    # -------------------------------------------------------------------------

    async def broadcast_pledge(
        self,
        startup_id: str,
        startup_name: str,
        backer_name: str,
        amount_dzd: int,
        equity_share_pct: Optional[float] = None,
        new_hype_score: Optional[float] = None,
    ):
        event = {
            "type": "simulation:pledge_alert",
            "startup_id": startup_id,
            "startup_name": startup_name,
            "backer_name": backer_name,
            "amount_dzd": amount_dzd,
            "equity_share_pct": equity_share_pct,
            "new_hype_score": new_hype_score,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await self.broadcast_to_room(f"startup:{startup_id}", event)
        await self.broadcast_to_room(f"arena:{startup_id}", event)
        await self.broadcast_to_room("global", event)

    async def broadcast_hype_score(
        self,
        startup_id: str,
        old_score: float,
        new_score: float,
        reason: str = "Live audience sentiment shift",
    ):
        event = {
            "type": "simulation:hype_shift",
            "startup_id": startup_id,
            "old_score": round(old_score, 2),
            "new_score": round(new_score, 2),
            "delta": round(new_score - old_score, 2),
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await self.broadcast_to_room(f"startup:{startup_id}", event)
        await self.broadcast_to_room(f"arena:{startup_id}", event)
        await self.broadcast_to_room("global", event)

    async def broadcast_leaderboard_update(
        self,
        leaderboard_entries: List[Dict[str, Any]],
        cycle: str = "Weekly Season 1",
    ):
        event = {
            "type": "simulation:leaderboard_update",
            "cycle": cycle,
            "entries": leaderboard_entries,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await self.broadcast_to_room("global", event)
        await self.broadcast_to_room("league", event)

    async def broadcast_reaction(
        self,
        startup_id: str,
        user_name: str,
        emoji: str,
        audience_sentiment_score: float,
    ):
        event = {
            "type": "simulation:sentiment_reaction",
            "startup_id": startup_id,
            "user_name": user_name,
            "emoji": emoji,
            "audience_sentiment_score": round(audience_sentiment_score, 2),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await self.broadcast_to_room(f"startup:{startup_id}", event)
        await self.broadcast_to_room(f"arena:{startup_id}", event)


simulation_manager = SimulationConnectionManager()


# =============================================================================
# UNIFIED WEBSOCKET DISPATCHER (SIMULATION & ARENA)
# =============================================================================

async def handle_arena_socket(
    websocket: WebSocket,
    token: Optional[str] = None,
    startup_param: Optional[str] = None,
):
    """
    Core WebSocket message processing loop handling watch party sync,
    reaction streams, rolling sentiment radar, and flash allocations.
    """
    user_id: Optional[int] = None
    username: Optional[str] = None

    if token:
        try:
            payload = verify_token(token)
            if payload and "sub" in payload:
                user_id = int(payload["sub"])
                username = payload.get("email", f"User-{user_id}")
        except Exception:
            pass

    client_id = str(uuid.uuid4())
    await simulation_manager.connect(websocket, client_id, user_id, username)

    # Auto-subscribe to room if provided
    initial_rooms = ["global"]
    if startup_param:
        room_name = f"startup:{startup_param}"
        await simulation_manager.subscribe_room(websocket, room_name)
        initial_rooms.append(room_name)

    # Initial welcome handshake with synchronized clock base
    now_epoch = time.time()
    await websocket.send_text(
        json.dumps({
            "type": "simulation:welcome",
            "client_id": client_id,
            "user_id": user_id,
            "channels": initial_rooms,
            "server_timestamp": now_epoch,
            "max_drift_tolerance_ms": MAX_DRIFT_TOLERANCE_MS,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    )

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"error": "Invalid JSON format"}))
                continue

            action = data.get("action")
            meta = simulation_manager.connection_meta.get(websocket, {})
            sender_name = meta.get("username", username or "Anonymous Scout")

            # 1. PING / NTP-STYLE CLOCK SYNC (< 250ms drift)
            if action in ("ping", "sync_clock"):
                client_time = data.get("client_time", 0.0)
                server_time = time.time()
                await websocket.send_text(json.dumps({
                    "type": "pong" if action == "ping" else "arena:clock_sync_ack",
                    "client_time": client_time,
                    "server_timestamp": server_time,
                    "max_drift_tolerance_ms": MAX_DRIFT_TOLERANCE_MS,
                    "timestamp": server_time,
                }))

            # 2. ROOM SUBSCRIPTION
            elif action == "subscribe":
                room = data.get("room")
                if room:
                    await simulation_manager.subscribe_room(websocket, room)
                    # Send current room arena state if available
                    session = arena_service.get_room(room)
                    resp: Dict[str, Any] = {"type": "subscribed", "room": room}
                    if session:
                        resp["arena_state"] = session.get_clock_sync_payload()
                    await websocket.send_text(json.dumps(resp))

            elif action == "unsubscribe":
                room = data.get("room")
                if room:
                    await simulation_manager.unsubscribe_room(websocket, room)
                    await websocket.send_text(json.dumps({
                        "type": "unsubscribed",
                        "room": room,
                    }))

            # 3. VIDEO PLAYBACK CLOCK SYNCHRONIZATION
            elif action == "sync_video":
                room = data.get("room", f"startup:{data.get('startup_id', 'default')}")
                session = arena_service.get_or_create_room(room, startup_id=data.get("startup_id"))
                position = float(data.get("position_sec", 0.0))
                playback_state = data.get("playback_state", "PLAYING")
                rate = float(data.get("playback_rate", 1.0))

                sync_payload = session.update_video_state(position, playback_state, rate)
                await simulation_manager.broadcast_to_room(room, sync_payload)

            # 4. ARENA STAGE STATE MACHINE (LOBBY -> PITCH -> GRILLING -> FLASH -> CLOSED)
            elif action in ("advance_stage", "set_stage"):
                room = data.get("room", f"startup:{data.get('startup_id', 'default')}")
                session = arena_service.get_or_create_room(room, startup_id=data.get("startup_id"))

                if action == "set_stage":
                    target_stage = ArenaStage(data.get("stage", "LOBBY"))
                    transition_payload = session.set_stage(target_stage)
                else:
                    transition_payload = session.advance_stage()

                await simulation_manager.broadcast_to_room(room, transition_payload)
                await simulation_manager.broadcast_to_room(
                    room,
                    session.get_clock_sync_payload()
                )

            # 5. LIVE REACTION EMOJI STREAM & ROLLING SENTIMENT RADAR
            elif action == "reaction":
                startup_id = data.get("startup_id")
                emoji = data.get("emoji", "🚀")
                room = data.get("room", f"startup:{startup_id}") if startup_id else "global"

                session = arena_service.get_or_create_room(room, startup_id=startup_id)
                rx_event, alarm_event = session.add_reaction(emoji, sender_name)

                # Broadcast live reaction to room and startup channel
                await simulation_manager.broadcast_to_room(room, rx_event)
                if startup_id and room != f"startup:{startup_id}":
                    await simulation_manager.broadcast_to_room(f"startup:{startup_id}", rx_event)

                # Legacy event format support
                await simulation_manager.broadcast_reaction(
                    startup_id=startup_id or "global",
                    user_name=sender_name,
                    emoji=emoji,
                    audience_sentiment_score=rx_event["audience_sentiment_score"],
                )

                # If Hype Alarm was triggered (sentiment < 35%), broadcast alert
                if alarm_event:
                    await simulation_manager.broadcast_to_room(room, alarm_event)
                    await simulation_manager.broadcast_to_room("global", alarm_event)

            # 6. 60-SECOND FLASH ALLOCATION WINDOW
            elif action in ("pledge", "flash_pledge"):
                startup_id = data.get("startup_id")
                amount = int(data.get("amount_dzd", 5000))
                equity_pct = data.get("equity_share_pct")
                wilaya = data.get("wilaya")
                room = data.get("room", f"startup:{startup_id}") if startup_id else "global"

                session = arena_service.get_or_create_room(room, startup_id=startup_id)
                pledge_event = session.record_flash_pledge(
                    backer_name=sender_name,
                    amount_dzd=amount,
                    equity_share_pct=equity_pct,
                    wilaya=wilaya,
                )

                # Broadcast flash pledge into room & global ticker
                await simulation_manager.broadcast_to_room(room, pledge_event)
                await simulation_manager.broadcast_to_room("global", pledge_event)

                # Update simulation ledger alert
                if startup_id:
                    await simulation_manager.broadcast_pledge(
                        startup_id=startup_id,
                        startup_name=session.startup_name,
                        backer_name=sender_name,
                        amount_dzd=amount,
                        equity_share_pct=equity_pct,
                        new_hype_score=session.current_sentiment_score,
                    )

            # 7. LIVE STAGE SPEAKER QUEUE & ARBITRATION (HOT-SEAT)
            elif action == "raise_hand":
                room = data.get("room", f"startup:{data.get('startup_id', 'default')}")
                hand_event = stage_queue_manager.raise_hand(
                    room_id=room,
                    user_id=user_id or int(time.time() % 100000),
                    username=sender_name,
                    avatar_url=data.get("avatar_url"),
                    wilaya=data.get("wilaya"),
                )
                await simulation_manager.broadcast_to_room(room, hand_event)

            elif action == "lower_hand":
                room = data.get("room", f"startup:{data.get('startup_id', 'default')}")
                lower_event = stage_queue_manager.lower_hand(
                    room_id=room,
                    user_id=int(data.get("user_id", user_id or 0)),
                )
                await simulation_manager.broadcast_to_room(room, lower_event)

            elif action == "approve_speaker":
                room = data.get("room", f"startup:{data.get('startup_id', 'default')}")
                target_uid = int(data.get("target_user_id", 0))
                duration = int(data.get("duration_sec", 180))
                approve_event = stage_queue_manager.approve_speaker(
                    room_id=room,
                    user_id=target_uid,
                    moderator_id=user_id or 1,
                    duration_sec=duration,
                )
                await simulation_manager.broadcast_to_room(room, approve_event)

            elif action == "deny_speaker":
                room = data.get("room", f"startup:{data.get('startup_id', 'default')}")
                target_uid = int(data.get("target_user_id", 0))
                deny_event = stage_queue_manager.deny_speaker(
                    room_id=room,
                    user_id=target_uid,
                    moderator_id=user_id or 1,
                    reason=data.get("reason", "Queue turn denied by moderator"),
                )
                await simulation_manager.broadcast_to_room(room, deny_event)

            elif action == "demote_speaker":
                room = data.get("room", f"startup:{data.get('startup_id', 'default')}")
                target_uid = int(data.get("target_user_id", 0))
                demote_event = stage_queue_manager.demote_speaker(
                    room_id=room,
                    user_id=target_uid,
                    moderator_id=user_id or 1,
                    reason=data.get("reason", "Hot-seat turn completed"),
                )
                await simulation_manager.broadcast_to_room(room, demote_event)

            elif action == "get_stage_queue":
                room = data.get("room", f"startup:{data.get('startup_id', 'default')}")
                queue_state = stage_queue_manager.get_stage_state(room)
                await websocket.send_text(json.dumps(queue_state))

            elif action == "request_webrtc_token":
                room = data.get("room", f"startup:{data.get('startup_id', 'default')}")
                req_role = data.get("role", "AUDIENCE")
                token_str = stage_queue_manager.provision_webrtc_token(
                    room_id=room,
                    user_id=user_id or 999,
                    username=sender_name,
                    role=getattr(SpeakerRole, req_role.upper(), SpeakerRole.AUDIENCE),
                )
                await websocket.send_text(json.dumps({
                    "type": "stage:webrtc_token",
                    "room_id": room,
                    "token": token_str,
                    "role": req_role,
                }))

            # 8. DUAL-TRACK PITCH DECK SLIDE CASTING & POINTER
            elif action == "slide_change":
                room = data.get("room", f"startup:{data.get('startup_id', 'default')}")
                deck_session = slide_deck_synchronizer.get_or_create_session(
                    room_id=room,
                    deck_id=data.get("deck_id"),
                    total_slides=int(data.get("total_slides", 12)),
                )
                slide_idx = int(data.get("slide_index", 0))
                slide_evt = deck_session.set_slide(slide_idx, presenter_name=sender_name)
                await simulation_manager.broadcast_to_room(room, slide_evt)

            elif action == "slide_pointer":
                room = data.get("room", f"startup:{data.get('startup_id', 'default')}")
                deck_session = slide_deck_synchronizer.get_or_create_session(room_id=room)
                x = float(data.get("x", 0.5))
                y = float(data.get("y", 0.5))
                active = bool(data.get("active", True))
                color = data.get("color")
                ptr_evt = deck_session.update_pointer(x, y, active=active, color=color)
                await simulation_manager.broadcast_to_room(room, ptr_evt)

            elif action == "slide_annotate":
                room = data.get("room", f"startup:{data.get('startup_id', 'default')}")
                deck_session = slide_deck_synchronizer.get_or_create_session(room_id=room)
                annotation = data.get("annotation", {})
                slide_idx = data.get("slide_index")
                ann_evt = deck_session.add_annotation(annotation, slide_index=slide_idx)
                await simulation_manager.broadcast_to_room(room, ann_evt)

            elif action == "slide_clear_annotations":
                room = data.get("room", f"startup:{data.get('startup_id', 'default')}")
                deck_session = slide_deck_synchronizer.get_or_create_session(room_id=room)
                slide_idx = data.get("slide_index")
                clr_evt = deck_session.clear_annotations(slide_index=slide_idx)
                await simulation_manager.broadcast_to_room(room, clr_evt)

            elif action == "get_slide_state":
                room = data.get("room", f"startup:{data.get('startup_id', 'default')}")
                deck_session = slide_deck_synchronizer.get_or_create_session(room_id=room)
                await websocket.send_text(json.dumps(deck_session.get_state()))

            else:
                await websocket.send_text(json.dumps({
                    "warning": f"Unknown action '{action}'",
                }))

    except (WebSocketDisconnect, ConnectionClosed):
        await simulation_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error in arena websocket loop: {e}")
        await simulation_manager.disconnect(websocket)


# =============================================================================
# ROUTE ENDPOINTS
# =============================================================================

@router.websocket("/ws/simulation")
@router.websocket("/api/v1/ws/simulation")
async def simulation_websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    await handle_arena_socket(websocket, token=token)


@router.websocket("/ws/arena")
@router.websocket("/api/v1/ws/arena")
async def arena_websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    startup_id: Optional[str] = Query(None),
):
    await handle_arena_socket(websocket, token=token, startup_param=startup_id)
