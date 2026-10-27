"""
services/api/app/agent/providers/openai_compatible.py
OpenAI-compatible engine adapter for SGLang, vLLM, Ollama, and FastChat.
"""

import json
import uuid
from typing import AsyncGenerator, Dict, Any, Optional
import httpx

from app.agent.providers.base import BaseLLMProvider
from app.agent.schemas import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    StreamingChunk,
    ChatMessage,
    Role,
    ToolCall,
    FunctionCall,
    UsageMetadata,
)
from app.agent.exceptions import LLMProviderException


class OpenAICompatibleProvider(BaseLLMProvider):
    """Adapter for self-hosted sovereign engines exposing standard OpenAI /v1 endpoints."""

    def __init__(
        self,
        model_name: str,
        base_url: str,
        api_key: Optional[str],
        client: httpx.AsyncClient,
    ):
        super().__init__(model_name=model_name, client=client)
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key or "EMPTY"

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_payload(self, request: ChatCompletionRequest) -> Dict[str, Any]:
        messages = []
        for m in request.messages:
            msg: Dict[str, Any] = {"role": m.role.value, "content": m.content or ""}
            if m.tool_calls:
                msg["tool_calls"] = [tc.model_dump() for tc in m.tool_calls]
            if m.tool_call_id:
                msg["tool_call_id"] = m.tool_call_id
            if m.name:
                msg["name"] = m.name
            messages.append(msg)

        payload: Dict[str, Any] = {
            "model": self.model_name,
            "messages": messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens or 2048,
        }
        if request.tools:
            payload["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.parameters,
                    },
                }
                for t in request.tools
            ]
        return payload

    async def complete(self, request: ChatCompletionRequest) -> ChatCompletionResponse:
        url = f"{self.base_url}/chat/completions"
        payload = self._build_payload(request)
        payload["stream"] = False

        resp = await self.client.post(
            url, json=payload, headers=self._headers(), timeout=60.0
        )
        resp.raise_for_status()
        data = resp.json()

        choices = data.get("choices", [])
        if not choices:
            raise LLMProviderException(
                "OpenAI-compatible engine returned zero choices.",
                provider="openai_compatible",
            )

        choice = choices[0]
        msg = choice.get("message", {})
        tool_calls = None
        if "tool_calls" in msg and msg["tool_calls"]:
            tool_calls = [
                ToolCall(
                    id=tc["id"],
                    type="function",
                    function=FunctionCall(
                        name=tc["function"]["name"],
                        arguments=(
                            json.loads(tc["function"]["arguments"])
                            if isinstance(tc["function"]["arguments"], str)
                            else tc["function"]["arguments"]
                        ),
                    ),
                )
                for tc in msg["tool_calls"]
            ]

        u = data.get("usage", {})
        return ChatCompletionResponse(
            id=data.get("id", str(uuid.uuid4())),
            model=data.get("model", self.model_name),
            message=ChatMessage(
                role=Role(msg.get("role", "assistant")),
                content=msg.get("content"),
                tool_calls=tool_calls,
            ),
            finish_reason=choice.get("finish_reason", "stop"),
            usage=UsageMetadata(
                prompt_tokens=u.get("prompt_tokens", 0),
                completion_tokens=u.get("completion_tokens", 0),
                total_tokens=u.get("total_tokens", 0),
            ),
        )

    async def stream(
        self, request: ChatCompletionRequest
    ) -> AsyncGenerator[StreamingChunk, None]:
        url = f"{self.base_url}/chat/completions"
        payload = self._build_payload(request)
        payload["stream"] = True

        async with self.client.stream(
            "POST", url, json=payload, headers=self._headers(), timeout=120.0
        ) as resp:
            resp.raise_for_status()
            buffer = ""
            async for raw_bytes in resp.aiter_bytes():
                buffer += raw_bytes.decode("utf-8", errors="replace")
                lines = buffer.split("\n")
                buffer = lines.pop()

                for line in lines:
                    line = line.strip()
                    if not line.startswith("data:"):
                        continue
                    data_str = line[5:].strip()
                    if data_str == "[DONE]":
                        break

                    try:
                        chunk_json = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    choice = chunk_json.get("choices", [{}])[0]
                    delta = choice.get("delta", {})

                    raw_tool_calls = delta.get("tool_calls")
                    parsed_tool_calls = None
                    if raw_tool_calls:
                        parsed_tool_calls = []
                        for tc in raw_tool_calls:
                            fn = tc.get("function", {})
                            args_raw = fn.get("arguments", "{}")
                            if isinstance(args_raw, str):
                                try:
                                    args_obj = json.loads(args_raw)
                                except Exception:
                                    args_obj = {"raw": args_raw}
                            else:
                                args_obj = args_raw or {}
                            parsed_tool_calls.append(
                                ToolCall(
                                    id=tc.get("id", str(uuid.uuid4())),
                                    type="function",
                                    function=FunctionCall(
                                        name=fn.get("name", ""),
                                        arguments=args_obj,
                                    ),
                                )
                            )

                    yield StreamingChunk(
                        id=chunk_json.get("id", str(uuid.uuid4())),
                        delta_content=delta.get("content"),
                        delta_tool_calls=parsed_tool_calls,
                        finish_reason=choice.get("finish_reason"),
                    )
