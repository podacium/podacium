# ADR-002: WebSocket for Real-Time Communication

## Status
Accepted

## Context
The messaging system and notification center were polling-based, causing unnecessary load and delayed delivery. Users expect instant message delivery in a freelancing platform where contract negotiations happen in real-time.

## Decision
Implement WebSocket endpoint at `/ws` with:
- JWT authentication via query parameter or cookie
- ConnectionManager pattern for per-user connection tracking
- Typing indicators, read receipts, and instant message delivery
- Automatic reconnection on the frontend with exponential backoff

## Alternatives Considered
- **Server-Sent Events (SSE)**: Simpler but unidirectional. Can't send typing indicators from client.
- **Long polling**: Higher latency, more server load.
- **Third-party (Pusher/Ably)**: Adds vendor dependency and cost for a feature we can build.

## Consequences
- **Positive**: Instant message delivery, typing indicators, presence detection.
- **Positive**: Reduced server load (no polling every 3-5 seconds).
- **Negative**: Requires sticky sessions or Redis pub/sub for multi-instance deployments.
- **Negative**: WebSocket connections consume server memory (~50KB per connection).

## Implementation
- Backend: `services/api/app/routers/websocket.py`
- Frontend: `apps/web/src/hooks/useWebSocket.ts`
