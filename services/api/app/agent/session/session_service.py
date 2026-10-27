"""
services/api/app/agent/session/session_service.py
Principal Session & Persistence Engine for Podacium Agentic AI.
Implements dual-tier Redis L1 + PostgreSQL L2 persistence,
distributed locking, sliding-window compaction, and SHA-256 chained audit logs.
"""

import json
import uuid
import hashlib
import logging
from typing import Optional, List, Dict, Any, Callable, Awaitable

from app.core.config import setting
from app.core.prisma import prisma
from app.core.redis import get_redis
from app.agent.token_counter import estimate_token_count

logger = logging.getLogger("podacium.ai.session")


class AnonymousSession:
    """Ephemeral session representation for anonymous visitors."""

    def __init__(
        self,
        session_id: str,
        agent_type: str = "GENERAL_ASSISTANT",
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.id = session_id
        self.userId = 0
        self.organizationId = None
        self.agentType = agent_type
        self.status = "ACTIVE"
        self.title = "Visiteur Anonyme"
        self.model = "gemini-2.5-flash"
        self.systemPromptOverride = None
        self.totalTokens = 0
        self.contextTokens = 0
        self.summaryState = None
        self.compactedUntilSequence = 0
        self.metadata = json.dumps(metadata or {"source": "web_chat"})
        self.deletedAt = None


class AnonymousMessage:
    """Ephemeral message representation for anonymous turns."""

    def __init__(self, id: str, sequence: int, token_count: int = 0):
        self.id = id
        self.sequence = sequence
        self.tokenCount = token_count


class AiSessionService:
    """Dual-tier Redis L1 + PostgreSQL L2 Agent Session Manager."""

    @staticmethod
    def _cache_key(session_id: str) -> str:
        return f"ai:sess:{session_id}:context"

    @staticmethod
    def _lock_key(session_id: str) -> str:
        return f"ai:lock:sess:{session_id}"

    # ─────────────────────────────────────────────────────────────────────────
    # DISTRIBUTED CONCURRENCY LOCKS (SET NX EX)
    # ─────────────────────────────────────────────────────────────────────────

    async def acquire_session_lock(
        self, session_id: str, ttl_seconds: int = 30
    ) -> Optional[str]:
        """Acquires a distributed lock for a session to prevent concurrent generation."""
        redis = await get_redis()
        if not redis:
            return str(uuid.uuid4())

        lock_token = str(uuid.uuid4())
        try:
            acquired = await redis.set(
                self._lock_key(session_id), lock_token, nx=True, ex=ttl_seconds
            )
            return lock_token if acquired else None
        except Exception as e:
            logger.warning(f"Error acquiring session lock in Redis: {e}")
            return lock_token

    async def release_session_lock(self, session_id: str, lock_token: str) -> bool:
        """Releases the distributed lock safely using an atomic Lua script."""
        redis = await get_redis()
        if not redis or not lock_token:
            return True

        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        try:
            keys = [self._lock_key(session_id)]
            args = [lock_token]
            res = await redis.eval(lua_script, len(keys), *keys, *args)  # type: ignore[misc,arg-type]
            return bool(res)
        except Exception as e:
            logger.warning(f"Error releasing session lock in Redis: {e}")
            return False

    # ─────────────────────────────────────────────────────────────────────────
    # SESSION LIFECYCLE (L1 Cache Hit <1ms, L2 Postgres <5ms)
    # ─────────────────────────────────────────────────────────────────────────

    async def get_or_create_session(
        self,
        user_id: int,
        agent_type: str = "GENERAL_ASSISTANT",
        session_id: Optional[str] = None,
        organization_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """Retrieves an existing session or creates a new one."""
        # 1. Anonymous visitor session
        if user_id <= 0:
            if not session_id or not session_id.startswith("anon_"):
                sid = f"anon_{session_id}" if session_id else f"anon_{uuid.uuid4().hex}"
            else:
                sid = session_id
            return AnonymousSession(
                session_id=sid, agent_type=agent_type, metadata=metadata
            )

        # 2. Existing authenticated user session
        if session_id:
            try:
                session = await prisma.aisession.find_unique(where={"id": session_id})
                if session and session.userId == user_id and session.deletedAt is None:
                    return session
            except Exception as e:
                logger.warning(f"Error finding session {session_id}: {e}")

        # 3. Create new database session
        meta = json.dumps(metadata or {"source": "web_chat"})
        create_data: Dict[str, Any] = {
            "user": {"connect": {"id": user_id}},
            "agentType": agent_type,
            "status": "ACTIVE",
            "metadata": meta,
        }
        if organization_id:
            create_data["organization"] = {"connect": {"id": organization_id}}
        if session_id:
            create_data["id"] = session_id

        try:
            return await prisma.aisession.create(data=create_data)
        except Exception as e:
            logger.warning(
                f"Prisma relation connect create failed, trying scalar fallback: {e}"
            )
            try:
                return await prisma.aisession.create(
                    data={
                        "userId": user_id,
                        "organizationId": organization_id,
                        "agentType": agent_type,
                        "status": "ACTIVE",
                        "metadata": meta,
                    }
                )
            except Exception:
                sid = session_id or f"sess_{uuid.uuid4().hex}"
                return AnonymousSession(
                    session_id=sid, agent_type=agent_type, metadata=metadata
                )

    async def get_active_context(self, session_id: str) -> Dict[str, Any]:
        """
        Retrieves the active context window.
        L1 Hit: Returns in <1ms from Redis.
        L2 Hit: Queries uncompacted messages via indexed scan in <2ms, populates L1.
        """
        redis = await get_redis()
        cache_key = self._cache_key(session_id)

        # 1. Try Redis L1
        if redis:
            try:
                cached = await redis.get(cache_key)
                if cached:
                    await redis.expire(cache_key, setting.AI_SESSION_CACHE_TTL_SECONDS)
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"Redis L1 context fetch error: {e}")

        # If anonymous session without Redis cache, return clean initial payload
        if session_id.startswith("anon_"):
            return {
                "sessionId": session_id,
                "agentType": "GENERAL_ASSISTANT",
                "summaryState": None,
                "compactedUntilSequence": 0,
                "contextTokens": 0,
                "messages": [],
            }

        # 2. Fetch from PostgreSQL L2
        session = await prisma.aisession.find_unique(where={"id": session_id})
        if not session:
            return {
                "sessionId": session_id,
                "agentType": "GENERAL_ASSISTANT",
                "summaryState": None,
                "compactedUntilSequence": 0,
                "contextTokens": 0,
                "messages": [],
            }

        # Selective query using composite index (sessionId, isCompacted, sequence ASC)
        uncompacted_messages = await prisma.aimessage.find_many(
            where={
                "sessionId": session_id,
                "isCompacted": False,
            },
            order={"sequence": "asc"},
        )

        context_payload = {
            "sessionId": session_id,
            "agentType": session.agentType,
            "summaryState": session.summaryState,
            "compactedUntilSequence": session.compactedUntilSequence,
            "contextTokens": session.contextTokens,
            "messages": [
                {
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "sequence": m.sequence,
                    "tokenCount": m.tokenCount,
                }
                for m in uncompacted_messages
            ],
        }

        # 3. Backfill Redis L1
        if redis:
            try:
                await redis.setex(
                    cache_key,
                    setting.AI_SESSION_CACHE_TTL_SECONDS,
                    json.dumps(context_payload),
                )
            except Exception as e:
                logger.warning(f"Redis L1 context set error: {e}")

        return context_payload

    # ─────────────────────────────────────────────────────────────────────────
    # MESSAGE & TRACE PERSISTENCE
    # ─────────────────────────────────────────────────────────────────────────

    async def append_turn(
        self,
        session_id: str,
        role: str,
        content: str,
        token_count: int = 0,
        tool_traces: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
    ) -> Any:
        """Appends a new turn, updates sequence numbers, and records tool traces."""
        role_map = {
            "user": "USER",
            "assistant": "ASSISTANT",
            "system": "SYSTEM",
            "tool": "TOOL",
            "USER": "USER",
            "ASSISTANT": "ASSISTANT",
            "SYSTEM": "SYSTEM",
            "TOOL": "TOOL",
        }
        role_enum = role_map.get(role, "USER")

        if session_id.startswith("anon_"):
            redis = await get_redis()
            context = await self.get_active_context(session_id)
            messages = context.get("messages", [])
            next_seq = len(messages) + 1
            new_msg = {
                "id": f"msg_anon_{next_seq}",
                "role": role_enum,
                "content": content,
                "sequence": next_seq,
                "tokenCount": token_count,
            }
            messages.append(new_msg)
            context["messages"] = messages
            context["contextTokens"] = context.get("contextTokens", 0) + token_count
            if redis:
                try:
                    await redis.setex(
                        self._cache_key(session_id),
                        setting.AI_SESSION_CACHE_TTL_SECONDS,
                        json.dumps(context),
                    )
                except Exception as e:
                    logger.warning(f"Failed to cache anonymous turn in Redis: {e}")
            return AnonymousMessage(
                id=str(new_msg["id"]), sequence=next_seq, token_count=token_count
            )

        next_seq = 1
        try:
            async with prisma.tx() as tx:
                # Lock the session row to serialize concurrent turns and eliminate P2002 collisions
                await tx.query_raw(
                    'SELECT id FROM "AiSession" WHERE id = $1 FOR UPDATE',
                    session_id,
                )
                last_msg = await tx.aimessage.find_first(
                    where={"sessionId": session_id},
                    order={"sequence": "desc"},
                )
                next_seq = (
                    (last_msg.sequence + 1)
                    if (last_msg and getattr(last_msg, "sequence", None) is not None)
                    else 1
                )

                message = await tx.aimessage.create(
                    data={
                        "session": {"connect": {"id": session_id}},
                        "role": role_enum,
                        "content": content,
                        "sequence": next_seq,
                        "tokenCount": token_count,
                        "model": model,
                    }
                )

                if tool_traces:
                    for trace in tool_traces:
                        trace_status = trace.get("status", "SUCCESS")
                        if isinstance(trace_status, str):
                            trace_status = trace_status.upper()
                        if trace_status not in (
                            "PENDING",
                            "SUCCESS",
                            "FAILED",
                            "ROLLED_BACK",
                        ):
                            trace_status = "SUCCESS"

                        await tx.aitooltrace.create(
                            data={
                                "session": {"connect": {"id": session_id}},
                                "message": {"connect": {"id": message.id}},
                                "toolName": trace["toolName"],
                                "toolCallId": trace.get("toolCallId"),
                                "inputArgs": json.dumps(trace.get("inputArgs", {})),
                                "outputResult": json.dumps(trace.get("outputResult")),
                                "errorMessage": trace.get("errorMessage"),
                                "status": trace_status,
                                "durationMs": trace.get("durationMs", 0),
                            }
                        )

                # Update session context token count & total tokens
                await tx.aisession.update(
                    where={"id": session_id},
                    data={
                        "contextTokens": {"increment": token_count},
                        "totalTokens": {"increment": token_count},
                    },
                )

            # Invalidate Redis L1 context cache
            redis = await get_redis()
            if redis:
                try:
                    await redis.delete(self._cache_key(session_id))
                except Exception as e:
                    logger.warning(f"Error invalidating Redis cache: {e}")

            return message
        except Exception as e:
            logger.warning(
                f"Prisma message persistence failed for {session_id}, falling back: {e}"
            )
            return AnonymousMessage(
                id=f"msg_fallback_{next_seq}",
                sequence=next_seq,
                token_count=token_count,
            )

    # ─────────────────────────────────────────────────────────────────────────
    # SLIDING WINDOW CONTEXT COMPACTION
    # ─────────────────────────────────────────────────────────────────────────

    async def compact_context_if_needed(
        self,
        session_id: str,
        summarizer_func: Optional[Callable[[str, str], Awaitable[str]]] = None,
    ) -> bool:
        """
        Checks if contextTokens > AI_CONTEXT_TOKEN_THRESHOLD.
        If exceeded, compacts older messages into summaryState, marking them isCompacted = True.
        """
        if session_id.startswith("anon_"):
            return False

        session = await prisma.aisession.find_unique(where={"id": session_id})
        if not session or session.contextTokens < setting.AI_CONTEXT_TOKEN_THRESHOLD:
            return False

        uncompacted = await prisma.aimessage.find_many(
            where={"sessionId": session_id, "isCompacted": False},
            order={"sequence": "asc"},
        )

        keep_turns = setting.AI_CONTEXT_KEEP_RECENT_TURNS
        if len(uncompacted) <= keep_turns:
            return False

        to_compact = uncompacted[:-keep_turns]
        transcript_slice = "\n".join(f"{m.role}: {m.content}" for m in to_compact)
        existing_summary = session.summaryState or "No prior summary."

        if summarizer_func:
            try:
                new_summary = await summarizer_func(existing_summary, transcript_slice)
            except Exception as e:
                logger.error(
                    f"Summarizer failed, falling back to structured synopsis: {e}"
                )
                new_summary = self._build_structured_synopsis(
                    existing_summary, to_compact
                )
        else:
            new_summary = self._build_structured_synopsis(existing_summary, to_compact)

        compacted_ids = [m.id for m in to_compact]
        freed_tokens = sum(m.tokenCount for m in to_compact)
        last_seq = to_compact[-1].sequence
        summary_token_count = estimate_token_count(new_summary)
        net_token_reduction = max(0, freed_tokens - summary_token_count)

        async with prisma.tx() as tx:
            await tx.aimessage.update_many(
                where={"id": {"in": compacted_ids}},
                data={"isCompacted": True},
            )
            await tx.aisession.update(
                where={"id": session_id},
                data={
                    "summaryState": new_summary,
                    "compactedUntilSequence": last_seq,
                    "contextTokens": {"decrement": net_token_reduction},
                },
            )

        redis = await get_redis()
        if redis:
            try:
                await redis.delete(self._cache_key(session_id))
            except Exception as e:
                logger.warning(f"Error invalidating cache after compaction: {e}")

        logger.info(
            f"Compacted session {session_id}: freed {freed_tokens} tokens across {len(to_compact)} messages."
        )
        return True

    @staticmethod
    def _build_structured_synopsis(existing_summary: str, to_compact: List[Any]) -> str:
        bullets = []
        for m in to_compact:
            content = getattr(m, "content", "") or ""
            role = getattr(m, "role", "USER")
            content_line = content.strip().split("\n")[0][:140]
            if not content_line:
                continue
            if role in ("USER", "HUMAN"):
                bullets.append(f"- User inquired: {content_line}")
            elif role in ("ASSISTANT", "MODEL"):
                bullets.append(f"- Assistant responded: {content_line}")
            elif role == "TOOL":
                bullets.append(f"- Tool executed: {content_line}")
        synopsis_chunk = "\n".join(bullets)
        if existing_summary and existing_summary != "No prior summary.":
            return f"{existing_summary}\n{synopsis_chunk}"
        return f"# Summary of earlier conversation turns:\n{synopsis_chunk}"

    # ─────────────────────────────────────────────────────────────────────────
    # IMMUTABLE AUDIT LOGGING & FLYWHEEL (SHA-256 HASH CHAINED)
    # ─────────────────────────────────────────────────────────────────────────

    async def write_audit_log(
        self,
        user_id: int,
        event_type: str,
        session_id: Optional[str] = None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        latency_ms: int = 0,
        model: str = "gemini-2.5-flash",
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Any:
        """
        Appends an immutable audit log record with SHA-256 cryptographic chaining.
        Matches Podacium's EmailAuditLog tamper-evident design.
        """
        if user_id <= 0:
            logger.info(
                f"[ANON_AUDIT] {event_type} session={session_id} latency={latency_ms}ms"
            )
            return None
        details_json = json.dumps(details or {}, sort_keys=True)
        last_log = await prisma.ailog.find_first(
            where={"userId": user_id},
            order={"id": "desc"},
        )
        previous_hash = (
            last_log.entryHash
            if last_log
            else "GENESIS_BLOCK_00000000000000000000000000000000"
        )
        payload_to_hash = (
            f"{previous_hash}|{user_id}|{session_id}|{event_type}|"
            f"{prompt_tokens}|{completion_tokens}|{latency_ms}|{details_json}"
        )
        entry_hash = hashlib.sha256(payload_to_hash.encode("utf-8")).hexdigest()

        return await prisma.ailog.create(
            data={
                "sessionId": session_id,
                "userId": user_id,
                "eventType": event_type,
                "promptTokens": prompt_tokens,
                "completionTokens": completion_tokens,
                "latencyMs": latency_ms,
                "model": model,
                "ipAddress": ip_address,
                "userAgent": user_agent,
                "details": details_json,
                "previousHash": previous_hash,
                "entryHash": entry_hash,
            }
        )


session_service = AiSessionService()
