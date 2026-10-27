"""
TamWheel Sovereign Ethical Agentic Venture OS — Real-Time Multiplayer Simulation WebSocket Router.
Broadcasts live pledge alerts, hype score shifts, sentiment reactions, and leaderboard updates.
Supports multiplayer rooms: global feed, startup-specific watch parties, and tournament leagues.
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

logger = logging.getLogger(__name__)

router = APIRouter(tags=["simulation_websocket"])


# =============================================================================
# SIMULATION MULTIPLAYER CONNECTION MANAGER
# =============================================================================

class SimulationConnectionManager:
    """
    Manages active WebSocket connections subscribed to real-time venture simulation events.
    """

    def __init__(self):
        # connection -> set of subscribed rooms (e.g. "global", "startup:<id>", "league")
        self.connection_rooms: Dict[WebSocket, Set[str]] = {}
        # room -> set of active WebSockets
        self.room_subscribers: Dict[str, Set[WebSocket]] = {
            "global": set(),
        }
        # connection -> metadata dict (client_id, user_id, username)
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
        logger.info(f"Simulation WS connected: client={client_id}, user={user_id}")

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            rooms = self.connection_rooms.pop(websocket, set())
            for room in rooms:
                if room in self.room_subscribers:
                    self.room_subscribers[room].discard(websocket)
                    if not self.room_subscribers[room] and room != "global":
                        del self.room_subscribers[room]
            meta = self.connection_meta.pop(websocket, {})
        logger.info(f"Simulation WS disconnected: client={meta.get('client_id')}")

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


simulation_manager = SimulationConnectionManager()


# =============================================================================
# WEBSOCKET ROUTE
# =============================================================================

@router.websocket("/ws/simulation")
@router.websocket("/api/v1/ws/simulation")
async def simulation_websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """
    Real-time multiplayer WebSocket for TamWheel Venture Simulation & Live Pitch Watch Parties.
    Supports anonymous retail observers and authenticated backers.
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
            # Allow fallback to guest connection for read-only simulation stream
            pass

    client_id = str(uuid.uuid4())
    await simulation_manager.connect(websocket, client_id, user_id, username)

    # Send initial welcome handshake
    await websocket.send_text(
        json.dumps({
            "type": "simulation:welcome",
            "client_id": client_id,
            "user_id": user_id,
            "channels": ["global"],
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

            if action == "ping":
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "timestamp": time.time(),
                }))

            elif action == "subscribe":
                room = data.get("room")
                if room:
                    await simulation_manager.subscribe_room(websocket, room)
                    await websocket.send_text(json.dumps({
                        "type": "subscribed",
                        "room": room,
                    }))

            elif action == "unsubscribe":
                room = data.get("room")
                if room:
                    await simulation_manager.unsubscribe_room(websocket, room)
                    await websocket.send_text(json.dumps({
                        "type": "unsubscribed",
                        "room": room,
                    }))

            elif action == "reaction":
                startup_id = data.get("startup_id")
                emoji = data.get("emoji", "🚀")
                if startup_id:
                    meta = simulation_manager.connection_meta.get(websocket, {})
                    sender_name = meta.get("username", "Anonymous Scout")
                    # Broadcast emoji to the room
                    await simulation_manager.broadcast_reaction(
                        startup_id=startup_id,
                        user_name=sender_name,
                        emoji=emoji,
                        audience_sentiment_score=88.5,
                    )

            else:
                await websocket.send_text(json.dumps({
                    "warning": f"Unknown action '{action}'",
                }))

    except (WebSocketDisconnect, ConnectionClosed):
        await simulation_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error in simulation websocket loop: {e}")
        await simulation_manager.disconnect(websocket)
