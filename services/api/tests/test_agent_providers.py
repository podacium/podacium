"""
services/api/tests/test_agent_providers.py
Unit tests for the Model-Agnostic LLM Provider Abstraction layer.
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock
import httpx

from app.agent.schemas import (
    ChatMessage,
    Role,
    ToolDefinition,
    ChatCompletionRequest,
)
from app.agent.providers.normalizer import ToolSchemaNormalizer
from app.agent.providers.circuit_breaker import CircuitBreaker, CircuitState
from app.agent.providers.gemini import GeminiRESTProvider
from app.agent.providers.openai_compatible import OpenAICompatibleProvider
from app.agent.providers.fallback_router import ResilientFallbackRouter
from app.agent.providers.factory import LLMProviderFactory


class TestToolSchemaNormalizer:
    """Tests for ToolSchemaNormalizer bidirectional transformations."""

    def test_to_gemini_declaration_converts_types_and_strips_forbidden_keys(self):
        tool = ToolDefinition(
            name="search_courses",
            description="Search the Podacium course catalog",
            parameters={
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "title": "SearchCoursesParams",
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search keyword",
                        "title": "QueryTitle",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max results",
                        "default": 10,
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Filter tags",
                    },
                },
                "required": ["query", "non_existent_key"],
                "additionalProperties": False,
            },
        )

        gemini_decl = ToolSchemaNormalizer.to_gemini_declaration(tool)

        assert gemini_decl["name"] == "search_courses"
        assert gemini_decl["description"] == "Search the Podacium course catalog"
        params = gemini_decl["parameters"]

        # Check types are uppercase
        assert params["type"] == "OBJECT"
        assert params["properties"]["query"]["type"] == "STRING"
        assert params["properties"]["limit"]["type"] == "INTEGER"
        assert params["properties"]["tags"]["type"] == "ARRAY"
        assert params["properties"]["tags"]["items"]["type"] == "STRING"

        # Check forbidden keys are stripped
        assert "$schema" not in params
        assert "title" not in params
        assert "title" not in params["properties"]["query"]
        assert "default" not in params["properties"]["limit"]
        assert "additionalProperties" not in params

        # Check non_existent_key was pruned from required list
        assert params["required"] == ["query"]

    def test_from_gemini_declaration_converts_types_to_lowercase(self):
        decl = {
            "name": "get_wallet_balance",
            "description": "Get current DZD balance",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "currency": {"type": "STRING"},
                    "account_id": {"type": "INTEGER"},
                },
                "required": ["currency"],
            },
        }

        tool = ToolSchemaNormalizer.from_gemini_declaration(decl)
        assert tool.name == "get_wallet_balance"
        assert tool.parameters["type"] == "object"
        assert tool.parameters["properties"]["currency"]["type"] == "string"
        assert tool.parameters["properties"]["account_id"]["type"] == "integer"


class TestCircuitBreaker:
    """Tests for CircuitBreaker failure state machine."""

    @pytest.mark.asyncio
    async def test_circuit_trips_open_after_threshold_and_recovers(self):
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout_seconds=0.05)

        assert cb.state == CircuitState.CLOSED
        assert await cb.can_execute() is True

        # First failure
        await cb.record_failure()
        assert cb.state == CircuitState.CLOSED
        assert await cb.can_execute() is True

        # Second failure -> Trips OPEN
        await cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert await cb.can_execute() is False

        # Wait for recovery timeout
        import asyncio

        await asyncio.sleep(0.06)

        # First request after timeout probes in HALF_OPEN
        assert await cb.can_execute() is True
        assert cb.state == CircuitState.HALF_OPEN

        # Second concurrent request in HALF_OPEN is throttled (rejected)
        assert await cb.can_execute() is False

        # Success resets to CLOSED
        await cb.record_success()
        assert cb.state == CircuitState.CLOSED
        assert cb.failure_count == 0


class TestGeminiRESTProvider:
    """Tests for GeminiRESTProvider complete and streaming methods."""

    @pytest.mark.asyncio
    async def test_complete_successful_response(self):
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": "Marhaban bikoum fi Podacium!"}],
                        "role": "model",
                    },
                    "finishReason": "STOP",
                }
            ],
            "usageMetadata": {
                "promptTokenCount": 12,
                "candidatesTokenCount": 8,
                "totalTokenCount": 20,
            },
        }

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.post.return_value = mock_response

        provider = GeminiRESTProvider(
            model_name="gemini-3.8-flash",
            api_key="test-api-key",
            client=mock_client,
        )

        request = ChatCompletionRequest(
            messages=[ChatMessage(role=Role.USER, content="Salam")],
        )

        response = await provider.complete(request)
        assert response.model == "gemini-3.8-flash"
        assert response.message.content == "Marhaban bikoum fi Podacium!"
        assert response.usage.prompt_tokens == 12
        assert response.usage.completion_tokens == 8

    @pytest.mark.asyncio
    async def test_complete_with_function_call(self):
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "functionCall": {
                                    "name": "search_courses",
                                    "args": {"query": "Next.js"},
                                }
                            }
                        ],
                        "role": "model",
                    },
                    "finishReason": "STOP",
                }
            ],
            "usageMetadata": {"promptTokenCount": 15, "candidatesTokenCount": 10},
        }

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.post.return_value = mock_response

        provider = GeminiRESTProvider(
            model_name="gemini-3.8-flash",
            api_key="test-api-key",
            client=mock_client,
        )

        request = ChatCompletionRequest(
            messages=[ChatMessage(role=Role.USER, content="Trouve un cours Next.js")],
        )

        response = await provider.complete(request)
        assert response.finish_reason == "tool_calls"
        assert response.message.tool_calls is not None
        assert len(response.message.tool_calls) == 1
        assert response.message.tool_calls[0].function.name == "search_courses"
        assert response.message.tool_calls[0].function.arguments == {"query": "Next.js"}

    @pytest.mark.asyncio
    async def test_complete_failover_on_503(self):
        resp_503 = MagicMock(spec=httpx.Response)
        resp_503.status_code = 503
        resp_503.text = '{"error": {"code": 503, "message": "High demand"}}'
        error_503 = httpx.HTTPStatusError(
            "503 Service Unavailable", request=MagicMock(), response=resp_503
        )
        resp_503.raise_for_status.side_effect = error_503

        resp_200 = MagicMock(spec=httpx.Response)
        resp_200.status_code = 200
        resp_200.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": "Réponse via modèle de secours"}],
                        "role": "model",
                    },
                    "finishReason": "STOP",
                }
            ],
            "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 5},
        }

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.post.side_effect = [resp_503, resp_200]

        provider = GeminiRESTProvider(
            model_name="gemini-3.5-flash-lite",
            api_key="test-api-key",
            client=mock_client,
            fallback_models=["gemini-3.8-flash"],
            max_retries=0,
        )

        request = ChatCompletionRequest(
            messages=[ChatMessage(role=Role.USER, content="Hello")],
        )

        response = await provider.complete(request)
        assert response.model == "gemini-3.8-flash"
        assert response.message.content == "Réponse via modèle de secours"
        assert mock_client.post.call_count == 2

    @pytest.mark.asyncio
    async def test_stream_failover_on_503(self):
        resp_503 = MagicMock(spec=httpx.Response)
        resp_503.status_code = 503
        error_503 = httpx.HTTPStatusError(
            "503 Service Unavailable", request=MagicMock(), response=resp_503
        )
        resp_503.raise_for_status.side_effect = error_503
        resp_503.aread = AsyncMock(return_value=b'{"error": "high demand"}')

        class MockStreamContext:
            def __init__(self, response):
                self.response = response

            async def __aenter__(self):
                return self.response

            async def __aexit__(self, exc_type, exc_val, exc_tb):
                pass

        resp_200 = MagicMock()
        resp_200.status_code = 200
        resp_200.raise_for_status = MagicMock()
        chunk_data = json.dumps(
            {
                "candidates": [
                    {
                        "content": {"parts": [{"text": "Streamed token"}]},
                        "finishReason": "STOP",
                    }
                ]
            }
        )

        async def mock_aiter_bytes():
            yield f"data: {chunk_data}\n\n".encode("utf-8")

        resp_200.aiter_bytes = mock_aiter_bytes

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.stream.side_effect = [
            MockStreamContext(resp_503),
            MockStreamContext(resp_200),
        ]

        provider = GeminiRESTProvider(
            model_name="gemini-3.5-flash-lite",
            api_key="test-api-key",
            client=mock_client,
            fallback_models=["gemini-3.8-flash"],
            max_retries=0,
        )

        request = ChatCompletionRequest(
            messages=[ChatMessage(role=Role.USER, content="Hello")],
        )

        chunks = []
        async for chunk in provider.stream(request):
            chunks.append(chunk)

        assert len(chunks) == 1
        assert chunks[0].delta_content == "Streamed token"
        assert mock_client.stream.call_count == 2


class TestOpenAICompatibleProvider:
    """Tests for OpenAICompatibleProvider targeting SGLang/vLLM endpoints."""

    @pytest.mark.asyncio
    async def test_complete_openai_format(self):
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "chatcmpl-test1234",
            "model": "Qwen/Qwen2.5-14B-Instruct",
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "Podacium est une plateforme edtech et freelance.",
                        "tool_calls": None,
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 18,
                "completion_tokens": 12,
                "total_tokens": 30,
            },
        }

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.post.return_value = mock_response

        provider = OpenAICompatibleProvider(
            model_name="Qwen/Qwen2.5-14B-Instruct",
            base_url="http://127.0.0.1:30000/v1",
            api_key="test-token",
            client=mock_client,
        )

        request = ChatCompletionRequest(
            messages=[ChatMessage(role=Role.USER, content="Qu'est-ce que Podacium ?")],
        )

        response = await provider.complete(request)
        assert response.id == "chatcmpl-test1234"
        assert response.model == "Qwen/Qwen2.5-14B-Instruct"
        assert (
            response.message.content
            == "Podacium est une plateforme edtech et freelance."
        )
        assert response.usage.total_tokens == 30


class TestResilientFallbackRouter:
    """Tests for cascading fallback routing between primary provider and offline FAQ."""

    @pytest.mark.asyncio
    async def test_fallback_to_offline_faq_when_primary_fails(self):
        failing_provider = AsyncMock(spec=GeminiRESTProvider)
        failing_provider.model_name = "gemini-primary"
        failing_provider.complete.side_effect = httpx.ConnectError("Connection refused")

        offline_faq = {
            "edahabia": "Vous pouvez payer vos formations directement par carte EDAHABIA ou CIB via Chargily Pay."
        }

        router = ResilientFallbackRouter(
            providers=[failing_provider],
            offline_faq_fallback=offline_faq,
            max_retries=1,
            base_backoff=0.01,
        )

        request = ChatCompletionRequest(
            messages=[
                ChatMessage(role=Role.USER, content="Puis-je payer avec EDAHABIA ?")
            ],
        )

        response = await router.complete(request)
        assert response.id == "offline-faq-fallback"
        assert response.model == "offline-deterministic"
        assert "EDAHABIA ou CIB" in response.message.content


class TestLLMProviderFactory:
    """Tests for LLMProviderFactory instantiation."""

    def test_factory_creates_gemini_provider(self):
        provider = LLMProviderFactory.get_provider(
            provider_type="gemini",
            override_config={"api_key": "dummy-key", "model": "gemini-2.5-flash"},
        )
        assert isinstance(provider, GeminiRESTProvider)
        assert provider.model_name == "gemini-2.5-flash"

    def test_factory_creates_openai_compatible_provider(self):
        provider = LLMProviderFactory.get_provider(
            provider_type="openai_compatible",
            override_config={
                "base_url": "http://127.0.0.1:30000/v1",
                "api_key": "test-key",
                "model": "Qwen/Qwen2.5-14B",
            },
        )
        assert isinstance(provider, OpenAICompatibleProvider)
        assert provider.model_name == "Qwen/Qwen2.5-14B"

    def test_factory_raises_on_unsupported_provider(self):
        with pytest.raises(ValueError, match="Unsupported LLM provider"):
            LLMProviderFactory.get_provider(provider_type="unsupported-engine")
