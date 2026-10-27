"""
services/api/app/agent/providers/fallback_router.py
Resilient Fallback Router with circuit breakers and deterministic offline rules.
"""

import logging
import asyncio
from typing import List, Dict, Optional, AsyncGenerator
import httpx

from app.agent.providers.base import BaseLLMProvider
from app.agent.providers.circuit_breaker import CircuitBreaker, calculate_jitter_backoff
from app.agent.schemas import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    StreamingChunk,
    ChatMessage,
    Role,
    UsageMetadata,
)
from app.agent.exceptions import LLMProviderException

logger = logging.getLogger("podacium.ai.router")


class ResilientFallbackRouter:
    """
    Routes chat completion requests through a cascade of providers
    with circuit breaking, full-jitter retries, and offline rule fallback.
    """

    def __init__(
        self,
        providers: List[BaseLLMProvider],
        offline_faq_fallback: Optional[Dict[str, str]] = None,
        max_retries: int = 3,
        base_backoff: float = 0.5,
        max_backoff: float = 8.0,
    ):
        self.providers = providers
        self.offline_faq = offline_faq_fallback or {}
        self.max_retries = max_retries
        self.base_backoff = base_backoff
        self.max_backoff = max_backoff
        self.circuit_breakers = {p.model_name: CircuitBreaker() for p in providers}

    async def complete(self, request: ChatCompletionRequest) -> ChatCompletionResponse:
        last_exception: Optional[Exception] = None

        for provider in self.providers:
            cb = self.circuit_breakers[provider.model_name]
            if not await cb.can_execute():
                logger.warning(
                    f"Circuit breaker for provider {provider.model_name} is OPEN. Skipping."
                )
                continue

            for attempt in range(self.max_retries):
                try:
                    res = await provider.complete(request)
                    await cb.record_success()
                    return res
                except httpx.HTTPStatusError as e:
                    status = e.response.status_code
                    if status == 429:
                        retry_after_hdr = e.response.headers.get("retry-after")
                        ra = float(retry_after_hdr) if retry_after_hdr else None
                        await asyncio.sleep(
                            calculate_jitter_backoff(
                                attempt, self.base_backoff, self.max_backoff, ra
                            )
                        )
                    elif status in (500, 502, 503, 504):
                        await cb.record_failure()
                        await asyncio.sleep(
                            calculate_jitter_backoff(
                                attempt, self.base_backoff, self.max_backoff
                            )
                        )
                    else:
                        await cb.record_failure()
                        last_exception = e
                        break
                except (httpx.TimeoutException, httpx.NetworkError) as e:
                    await cb.record_failure()
                    await asyncio.sleep(
                        calculate_jitter_backoff(
                            attempt, self.base_backoff, self.max_backoff
                        )
                    )
                    last_exception = e
                except Exception as e:
                    await cb.record_failure()
                    last_exception = e
                    break

        # Final Tier: Deterministic Offline Rule-based FAQ Fallback
        if request.messages:
            last_prompt = (request.messages[-1].content or "").lower().strip()
            for key, canned_response in self.offline_faq.items():
                if key.lower() in last_prompt:
                    return ChatCompletionResponse(
                        id="offline-faq-fallback",
                        model="offline-deterministic",
                        message=ChatMessage(
                            role=Role.ASSISTANT, content=canned_response
                        ),
                        finish_reason="stop",
                        usage=UsageMetadata(),
                    )

        raise LLMProviderException(
            f"All providers in fallback chain exhausted. Last error: {str(last_exception)}",
            provider="fallback_router",
        )

    async def stream(
        self, request: ChatCompletionRequest
    ) -> AsyncGenerator[StreamingChunk, None]:
        """Stream from the first available provider whose circuit breaker is not OPEN."""
        for provider in self.providers:
            cb = self.circuit_breakers[provider.model_name]
            if not await cb.can_execute():
                continue

            try:
                async for chunk in provider.stream(request):
                    yield chunk
                await cb.record_success()
                return
            except Exception as e:
                logger.warning(
                    f"Streaming failed on provider {provider.model_name}: {e}"
                )
                await cb.record_failure()

        # If all providers fail, yield offline fallback chunk
        if request.messages:
            last_prompt = (request.messages[-1].content or "").lower().strip()
            for key, canned_response in self.offline_faq.items():
                if key.lower() in last_prompt:
                    yield StreamingChunk(
                        id="offline-faq-stream",
                        delta_content=canned_response,
                        finish_reason="stop",
                    )
                    return

        yield StreamingChunk(
            id="error-chunk",
            delta_content="Le service d'assistance est momentanément indisponible. Veuillez réessayer dans quelques instants.",
            finish_reason="error",
        )
