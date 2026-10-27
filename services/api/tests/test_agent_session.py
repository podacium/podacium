"""
services/api/tests/test_agent_session.py
Unit tests for the Agentic AI Dual-Tier Session Service & Compaction Engine.
"""

import json
import hashlib
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.agent.session.session_service import AiSessionService


class TestAiSessionService:
    """Tests for AiSessionService lifecycle, locking, caching, and compaction."""

    @pytest.mark.asyncio
    async def test_session_distributed_lock_acquire_and_release(self):
        service = AiSessionService()
        mock_redis = AsyncMock()
        mock_redis.set.return_value = True
        mock_redis.eval.return_value = 1

        with patch(
            "app.agent.session.session_service.get_redis", return_value=mock_redis
        ):
            token = await service.acquire_session_lock("sess-123", ttl_seconds=15)
            assert token is not None
            mock_redis.set.assert_called_once_with(
                "ai:lock:sess:sess-123", token, nx=True, ex=15
            )

            released = await service.release_session_lock("sess-123", token)
            assert released is True
            mock_redis.eval.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_active_context_l1_cache_hit(self):
        service = AiSessionService()
        cached_payload = {
            "sessionId": "sess-456",
            "agentType": "SUPPORT_AGENT",
            "summaryState": "User asked about courses.",
            "compactedUntilSequence": 2,
            "contextTokens": 150,
            "messages": [
                {
                    "id": "msg-1",
                    "role": "USER",
                    "content": "Salam",
                    "sequence": 3,
                    "tokenCount": 5,
                }
            ],
        }

        mock_redis = AsyncMock()
        mock_redis.get.return_value = json.dumps(cached_payload)

        with patch(
            "app.agent.session.session_service.get_redis", return_value=mock_redis
        ):
            context = await service.get_active_context("sess-456")
            assert context["sessionId"] == "sess-456"
            assert len(context["messages"]) == 1
            assert context["summaryState"] == "User asked about courses."
            mock_redis.get.assert_called_once_with("ai:sess:sess-456:context")
            mock_redis.expire.assert_called_once()

    @pytest.mark.asyncio
    async def test_append_turn_computes_sequence_and_invalidates_l1_cache(self):
        service = AiSessionService()

        mock_redis = AsyncMock()
        mock_prisma = MagicMock()
        mock_tx = AsyncMock()
        mock_created_msg = MagicMock(id="msg-new", sequence=5)
        mock_tx.query_raw = AsyncMock(return_value=[{"id": "sess-789"}])
        mock_tx.aimessage.find_first = AsyncMock(return_value=MagicMock(sequence=4))
        mock_tx.aimessage.create = AsyncMock(return_value=mock_created_msg)
        mock_tx.aitooltrace.create = AsyncMock()
        mock_tx.aisession.update = AsyncMock()

        # Mock prisma.tx() context manager
        mock_prisma.tx.return_value.__aenter__ = AsyncMock(return_value=mock_tx)
        mock_prisma.tx.return_value.__aexit__ = AsyncMock(return_value=None)

        tool_traces = [
            {
                "toolName": "search_courses",
                "toolCallId": "call-1",
                "inputArgs": {"query": "Python"},
                "outputResult": {"count": 2},
                "status": "SUCCESS",
                "durationMs": 45,
            }
        ]

        with (
            patch("app.agent.session.session_service.prisma", mock_prisma),
            patch(
                "app.agent.session.session_service.get_redis", return_value=mock_redis
            ),
        ):
            msg = await service.append_turn(
                session_id="sess-789",
                role="ASSISTANT",
                content="Here are the courses found.",
                token_count=35,
                tool_traces=tool_traces,
                model="gemini-2.5-flash",
            )

            assert msg.id == "msg-new"
            mock_tx.query_raw.assert_called_once_with(
                'SELECT id FROM "AiSession" WHERE id = $1 FOR UPDATE',
                "sess-789",
            )
            mock_tx.aimessage.create.assert_called_once()
            call_kwargs = mock_tx.aimessage.create.call_args.kwargs["data"]
            assert call_kwargs["sequence"] == 5
            assert call_kwargs["role"] == "ASSISTANT"

            mock_tx.aitooltrace.create.assert_called_once()
            mock_redis.delete.assert_called_once_with("ai:sess:sess-789:context")

    @pytest.mark.asyncio
    async def test_sliding_window_compaction_triggers_when_threshold_exceeded(self):
        service = AiSessionService()

        mock_session = MagicMock(
            id="sess-compact",
            contextTokens=5000,  # Exceeds default threshold 4000
            summaryState="Old summary.",
            compactedUntilSequence=2,
        )

        # 10 uncompacted messages (keep_recent_turns is 6, so older 4 get compacted)
        uncompacted = [
            MagicMock(
                id=f"msg-{i}",
                role="USER" if i % 2 == 1 else "ASSISTANT",
                content=f"Text {i}",
                sequence=i,
                tokenCount=500,
            )
            for i in range(1, 11)
        ]

        mock_prisma = MagicMock()
        mock_prisma.aisession.find_unique = AsyncMock(return_value=mock_session)
        mock_prisma.aimessage.find_many = AsyncMock(return_value=uncompacted)

        mock_tx = AsyncMock()
        mock_tx.aimessage.update_many = AsyncMock()
        mock_tx.aisession.update = AsyncMock()
        mock_prisma.tx.return_value.__aenter__ = AsyncMock(return_value=mock_tx)
        mock_prisma.tx.return_value.__aexit__ = AsyncMock(return_value=None)

        mock_redis = AsyncMock()

        async def mock_summarizer(old_sum: str, slice_txt: str) -> str:
            return f"Updated Summary: {old_sum} + {len(slice_txt)} chars"

        with (
            patch("app.agent.session.session_service.prisma", mock_prisma),
            patch(
                "app.agent.session.session_service.get_redis", return_value=mock_redis
            ),
            patch(
                "app.agent.session.session_service.setting.AI_CONTEXT_TOKEN_THRESHOLD",
                4000,
            ),
            patch(
                "app.agent.session.session_service.setting.AI_CONTEXT_KEEP_RECENT_TURNS",
                6,
            ),
        ):
            compacted = await service.compact_context_if_needed(
                "sess-compact", summarizer_func=mock_summarizer
            )
            assert compacted is True

            # Assert 4 messages were marked as compacted
            mock_tx.aimessage.update_many.assert_called_once()
            update_call = mock_tx.aimessage.update_many.call_args.kwargs
            compacted_ids = update_call["where"]["id"]["in"]
            assert len(compacted_ids) == 4
            assert compacted_ids == ["msg-1", "msg-2", "msg-3", "msg-4"]

            # Assert session was updated with new summary and decremented tokens
            mock_tx.aisession.update.assert_called_once()
            sess_update = mock_tx.aisession.update.call_args.kwargs["data"]
            assert "Updated Summary:" in sess_update["summaryState"]
            from app.agent.token_counter import estimate_token_count

            summary_tokens = estimate_token_count(sess_update["summaryState"])
            assert sess_update["contextTokens"]["decrement"] == 2000 - summary_tokens

    @pytest.mark.asyncio
    async def test_write_audit_log_sha256_hash_chaining(self):
        service = AiSessionService()

        mock_last_log = MagicMock(entryHash="PREVIOUS_BLOCK_HASH_ABCDEF123456")
        mock_prisma = MagicMock()
        mock_prisma.ailog.find_first = AsyncMock(return_value=mock_last_log)
        mock_prisma.ailog.create = AsyncMock(
            side_effect=lambda **kwargs: MagicMock(**kwargs["data"])
        )

        with patch("app.agent.session.session_service.prisma", mock_prisma):
            log_entry = await service.write_audit_log(
                user_id=42,
                event_type="TOOL_INVOCATION",
                session_id="sess-audit-1",
                prompt_tokens=100,
                completion_tokens=50,
                latency_ms=210,
                details={"action": "enroll_course", "course_id": 99},
            )

            assert log_entry.userId == 42
            assert log_entry.previousHash == "PREVIOUS_BLOCK_HASH_ABCDEF123456"

            # Verify cryptographic chaining
            expected_details = json.dumps(
                {"action": "enroll_course", "course_id": 99}, sort_keys=True
            )
            expected_payload = f"PREVIOUS_BLOCK_HASH_ABCDEF123456|42|sess-audit-1|TOOL_INVOCATION|100|50|210|{expected_details}"
            expected_hash = hashlib.sha256(expected_payload.encode("utf-8")).hexdigest()

            assert log_entry.entryHash == expected_hash
