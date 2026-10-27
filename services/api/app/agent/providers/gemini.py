"""
services/api/app/agent/providers/gemini.py
High-performance Google Gemini REST API v1beta Provider Adapter.
"""

import asyncio
import json
import logging
import random
import uuid
from typing import AsyncGenerator, Dict, Any, List, Optional
import httpx

logger = logging.getLogger(__name__)

from app.agent.providers.base import BaseLLMProvider
from app.agent.providers.normalizer import ToolSchemaNormalizer
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


class GeminiRESTProvider(BaseLLMProvider):
    """Native REST adapter for Google Gemini models via v1beta endpoint."""

    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(
        self,
        model_name: str,
        api_key: str,
        client: httpx.AsyncClient,
        fallback_models: Optional[List[str]] = None,
        max_retries: int = 1,
        timeout_seconds: float = 20.0,
    ):
        super().__init__(model_name=model_name, client=client)
        self.api_key = api_key
        if fallback_models is None:
            self.fallback_models = [
                m
                for m in ["gemini-3.5-flash-lite", "gemini-3.8-flash"]
                if m != model_name
            ]
        else:
            self.fallback_models = [m for m in fallback_models if m != model_name]
        self.max_retries = max_retries
        self.timeout_seconds = timeout_seconds

    def _build_payload(self, request: ChatCompletionRequest) -> Dict[str, Any]:
        contents: List[Dict[str, Any]] = []
        system_instructions: List[str] = []

        for m in request.messages:
            if m.role == Role.SYSTEM:
                if m.content:
                    system_instructions.append(m.content)
            elif m.role == Role.USER:
                contents.append({"role": "user", "parts": [{"text": m.content or ""}]})
            elif m.role == Role.ASSISTANT:
                if m.raw_parts:
                    contents.append({"role": "model", "parts": m.raw_parts})
                else:
                    parts: List[Dict[str, Any]] = []
                    if m.content:
                        parts.append({"text": m.content})
                    if m.tool_calls:
                        for tc in m.tool_calls:
                            fc_part: Dict[str, Any] = {
                                "functionCall": {
                                    "name": tc.function.name,
                                    "args": tc.function.arguments,
                                }
                            }
                            if tc.thought_signature:
                                fc_part["thoughtSignature"] = tc.thought_signature
                            parts.append(fc_part)
                    contents.append({"role": "model", "parts": parts})
            elif m.role == Role.TOOL:
                try:
                    response_obj = json.loads(m.content) if m.content else {}
                except Exception:
                    response_obj = {"result": m.content}
                if not isinstance(response_obj, dict):
                    response_obj = {"result": response_obj}
                fn_part = {
                    "functionResponse": {
                        "name": m.name or "unknown_function",
                        "response": response_obj,
                    }
                }
                if (
                    contents
                    and contents[-1]["role"] == "user"
                    and any("functionResponse" in p for p in contents[-1]["parts"])
                ):
                    contents[-1]["parts"].append(fn_part)
                else:
                    contents.append(
                        {
                            "role": "user",
                            "parts": [fn_part],
                        }
                    )

        payload: Dict[str, Any] = {"contents": contents}

        if system_instructions:
            payload["systemInstruction"] = {
                "parts": [{"text": "\n\n".join(system_instructions)}]
            }

        generation_config: Dict[str, Any] = {
            "temperature": request.temperature,
            "maxOutputTokens": request.max_tokens or 2048,
        }
        if request.top_p:
            generation_config["topP"] = request.top_p
        if request.stop:
            generation_config["stopSequences"] = request.stop
        payload["generationConfig"] = generation_config

        if request.tools:
            function_declarations = [
                ToolSchemaNormalizer.to_gemini_declaration(tool)
                for tool in request.tools
            ]
            payload["tools"] = [{"functionDeclarations": function_declarations}]

        return payload

    async def _execute_complete_for_model(
        self, model_name: str, payload: Dict[str, Any]
    ) -> ChatCompletionResponse:
        url = f"{self.BASE_URL}/{model_name}:generateContent"
        headers = {"x-goog-api-key": self.api_key}
        resp = await self.client.post(
            url, json=payload, headers=headers, timeout=self.timeout_seconds
        )
        status_code = getattr(resp, "status_code", 200)
        if isinstance(status_code, int) and status_code >= 400:
            error_body = getattr(resp, "text", "")
            logger.warning(
                f"Gemini API ({model_name}) returned error {status_code}: {error_body}"
            )
            resp.raise_for_status()
        data = resp.json()

        candidates = data.get("candidates", [])
        if not candidates:
            raise LLMProviderException(
                f"Gemini ({model_name}) returned zero candidates.", provider="gemini"
            )

        candidate = candidates[0]
        content_obj = candidate.get("content", {})
        parts = content_obj.get("parts", [])

        text_parts = [p.get("text", "") for p in parts if "text" in p]
        full_text = "".join(text_parts)

        tool_calls: List[ToolCall] = []
        for p in parts:
            if "functionCall" in p:
                fc = p["functionCall"]
                sig = (
                    p.get("thoughtSignature")
                    or p.get("thought_signature")
                    or fc.get("thoughtSignature")
                    or fc.get("thought_signature")
                )
                tool_calls.append(
                    ToolCall(
                        id=fc.get("id") or str(uuid.uuid4()),
                        type="function",
                        function=FunctionCall(
                            name=fc["name"], arguments=fc.get("args", {})
                        ),
                        thought_signature=sig,
                    )
                )

        usage_data = data.get("usageMetadata", {})
        usage = UsageMetadata(
            prompt_tokens=usage_data.get("promptTokenCount", 0),
            completion_tokens=usage_data.get("candidatesTokenCount", 0),
            total_tokens=usage_data.get("totalTokenCount", 0),
        )

        return ChatCompletionResponse(
            id=str(uuid.uuid4()),
            model=model_name,
            message=ChatMessage(
                role=Role.ASSISTANT,
                content=full_text if full_text else None,
                tool_calls=tool_calls if tool_calls else None,
                raw_parts=parts if parts else None,
            ),
            finish_reason="tool_calls"
            if tool_calls
            else candidate.get("finishReason", "stop").lower(),
            usage=usage,
        )

    async def complete(self, request: ChatCompletionRequest) -> ChatCompletionResponse:
        payload = self._build_payload(request)
        candidate_models = [self.model_name] + [
            m for m in self.fallback_models if m != self.model_name
        ]

        last_exception: Optional[Exception] = None
        for idx, model in enumerate(candidate_models):
            for attempt in range(self.max_retries + 1):
                try:
                    return await self._execute_complete_for_model(model, payload)
                except httpx.HTTPStatusError as e:
                    last_exception = e
                    status = (
                        e.response.status_code
                        if hasattr(e, "response") and e.response is not None
                        else 500
                    )
                    if status in (503, 429, 502, 504):
                        if attempt < self.max_retries:
                            backoff = 0.5 * (2**attempt) + random.uniform(0.05, 0.2)
                            logger.warning(
                                f"Gemini model {model} returned {status} (attempt {attempt + 1}/{self.max_retries + 1}). Retrying in {backoff:.2f}s..."
                            )
                            await asyncio.sleep(backoff)
                            continue
                        else:
                            next_model = (
                                candidate_models[idx + 1]
                                if idx + 1 < len(candidate_models)
                                else None
                            )
                            if next_model:
                                logger.warning(
                                    f"Gemini model {model} unavailable ({status}). Failing over to fallback model {next_model}..."
                                )
                                break
                    raise
                except (httpx.ConnectError, httpx.TimeoutException) as net_err:
                    last_exception = net_err
                    if attempt < self.max_retries:
                        backoff = 0.5 * (2**attempt)
                        logger.warning(
                            f"Gemini network error on {model} ({net_err}). Retrying in {backoff:.2f}s..."
                        )
                        await asyncio.sleep(backoff)
                        continue
                    else:
                        next_model = (
                            candidate_models[idx + 1]
                            if idx + 1 < len(candidate_models)
                            else None
                        )
                        if next_model:
                            logger.warning(
                                f"Gemini network error on {model}. Failing over to fallback model {next_model}..."
                            )
                            break
                        raise
                except Exception as ex:
                    last_exception = ex
                    raise

        if last_exception:
            raise last_exception
        raise LLMProviderException(
            "All Gemini candidate models failed.", provider="gemini"
        )

    async def stream(
        self, request: ChatCompletionRequest
    ) -> AsyncGenerator[StreamingChunk, None]:
        payload = self._build_payload(request)
        candidate_models = [self.model_name] + [
            m for m in self.fallback_models if m != self.model_name
        ]

        last_exception: Optional[Exception] = None
        for idx, model in enumerate(candidate_models):
            for attempt in range(self.max_retries + 1):
                url = f"{self.BASE_URL}/{model}:streamGenerateContent?alt=sse"
                headers = {"x-goog-api-key": self.api_key}
                chunk_emitted = False

                try:
                    async with self.client.stream(
                        "POST",
                        url,
                        json=payload,
                        headers=headers,
                        timeout=self.timeout_seconds,
                    ) as resp:
                        status_code = getattr(resp, "status_code", 200)
                        if isinstance(status_code, int) and status_code >= 400:
                            error_body = ""
                            try:
                                error_bytes = await resp.aread()
                                error_body = error_bytes.decode(
                                    "utf-8", errors="replace"
                                )
                            except Exception:
                                pass
                            logger.warning(
                                f"Gemini stream API ({model}) returned {status_code}: {error_body}"
                            )
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
                                if not data_str or data_str == "[DONE]":
                                    continue

                                try:
                                    chunk_json = json.loads(data_str)
                                except json.JSONDecodeError:
                                    continue

                                candidates = chunk_json.get("candidates", [])
                                if not candidates:
                                    continue
                                candidate = candidates[0]
                                parts = candidate.get("content", {}).get("parts", [])

                                delta_text = "".join(
                                    [p.get("text", "") for p in parts if "text" in p]
                                )
                                tool_calls: List[ToolCall] = []
                                for p in parts:
                                    if "functionCall" in p:
                                        fc = p["functionCall"]
                                        sig = (
                                            p.get("thoughtSignature")
                                            or p.get("thought_signature")
                                            or fc.get("thoughtSignature")
                                            or fc.get("thought_signature")
                                        )
                                        tool_calls.append(
                                            ToolCall(
                                                id=fc.get("id") or str(uuid.uuid4()),
                                                type="function",
                                                function=FunctionCall(
                                                    name=fc["name"],
                                                    arguments=fc.get("args", {}),
                                                ),
                                                thought_signature=sig,
                                            )
                                        )

                                usage_meta = None
                                if "usageMetadata" in chunk_json:
                                    u = chunk_json["usageMetadata"]
                                    usage_meta = UsageMetadata(
                                        prompt_tokens=u.get("promptTokenCount", 0),
                                        completion_tokens=u.get(
                                            "candidatesTokenCount", 0
                                        ),
                                        total_tokens=u.get("totalTokenCount", 0),
                                    )

                                chunk_emitted = True
                                yield StreamingChunk(
                                    id=str(uuid.uuid4()),
                                    delta_content=delta_text if delta_text else None,
                                    delta_tool_calls=tool_calls if tool_calls else None,
                                    finish_reason=candidate.get("finishReason"),
                                    usage=usage_meta,
                                    raw_parts=parts if parts else None,
                                )

                    # Stream finished normally
                    return
                except httpx.HTTPStatusError as e:
                    last_exception = e
                    status = (
                        e.response.status_code
                        if hasattr(e, "response") and e.response is not None
                        else 500
                    )
                    if not chunk_emitted and status in (503, 429, 502, 504):
                        if attempt < self.max_retries:
                            backoff = 0.5 * (2**attempt) + random.uniform(0.05, 0.2)
                            logger.warning(
                                f"Gemini stream on {model} returned {status} (attempt {attempt + 1}). Retrying in {backoff:.2f}s..."
                            )
                            await asyncio.sleep(backoff)
                            continue
                        else:
                            next_model = (
                                candidate_models[idx + 1]
                                if idx + 1 < len(candidate_models)
                                else None
                            )
                            if next_model:
                                logger.warning(
                                    f"Gemini stream on {model} unavailable ({status}). Failing over to fallback model {next_model}..."
                                )
                                break
                    raise
                except (httpx.ConnectError, httpx.TimeoutException) as net_err:
                    last_exception = net_err
                    if not chunk_emitted:
                        if attempt < self.max_retries:
                            backoff = 0.5 * (2**attempt)
                            logger.warning(
                                f"Gemini stream network error on {model}. Retrying in {backoff:.2f}s..."
                            )
                            await asyncio.sleep(backoff)
                            continue
                        else:
                            next_model = (
                                candidate_models[idx + 1]
                                if idx + 1 < len(candidate_models)
                                else None
                            )
                            if next_model:
                                logger.warning(
                                    f"Gemini stream network error on {model}. Failing over to fallback model {next_model}..."
                                )
                                break
                    raise

        if last_exception:
            raise last_exception
