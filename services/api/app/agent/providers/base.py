"""
services/api/app/agent/providers/base.py
Abstract Base Class for LLM Providers.
"""

from abc import ABC, abstractmethod
from typing import AsyncGenerator
import httpx

from app.agent.schemas import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    StreamingChunk,
)


class BaseLLMProvider(ABC):
    """Abstract interface defining required LLM vendor adapter methods."""

    def __init__(self, model_name: str, client: httpx.AsyncClient):
        self.model_name = model_name
        self.client = client

    @abstractmethod
    async def complete(self, request: ChatCompletionRequest) -> ChatCompletionResponse:
        """Executes a synchronous / non-streaming chat completion."""
        pass

    @abstractmethod
    def stream(
        self, request: ChatCompletionRequest
    ) -> AsyncGenerator[StreamingChunk, None]:
        """Streams response tokens and incremental tool calls."""
        raise NotImplementedError
