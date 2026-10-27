"""
services/api/app/agent/providers/factory.py
Provider factory and HTTP/2 pooled client lifecycle management.
"""

from typing import Optional, Dict, Any
import httpx

from app.core.config import setting
from app.agent.providers.base import BaseLLMProvider
from app.agent.providers.gemini import GeminiRESTProvider
from app.agent.providers.openai_compatible import OpenAICompatibleProvider


class LLMClientLifecycleManager:
    """Manages pooled HTTP/2 client lifecycle for low-latency reuse across requests."""

    _client: Optional[httpx.AsyncClient] = None

    @classmethod
    def get_client(cls) -> httpx.AsyncClient:
        if cls._client is None or cls._client.is_closed:
            limits = httpx.Limits(
                max_connections=500,
                max_keepalive_connections=100,
                keepalive_expiry=60.0,
            )
            timeouts = httpx.Timeout(connect=5.0, read=120.0, write=5.0, pool=5.0)
            http2_enabled = False
            try:
                import h2  # noqa: F401

                http2_enabled = True
            except ImportError:
                http2_enabled = False
            cls._client = httpx.AsyncClient(
                limits=limits, timeout=timeouts, http2=http2_enabled
            )
        return cls._client

    @classmethod
    async def shutdown(cls):
        if cls._client and not cls._client.is_closed:
            await cls._client.aclose()
            cls._client = None


class LLMProviderFactory:
    """Runtime dependency injector constructing the configured BaseLLMProvider."""

    @staticmethod
    def get_provider(
        provider_type: Optional[str] = None,
        override_config: Optional[Dict[str, Any]] = None,
    ) -> BaseLLMProvider:
        client = LLMClientLifecycleManager.get_client()
        target_provider = (provider_type or setting.LLM_PROVIDER).lower()
        cfg = override_config or {}

        if target_provider == "gemini":
            api_key = (
                cfg.get("api_key") or setting.LLM_API_KEY or setting.GEMINI_API_KEY
            )
            if not api_key:
                raise ValueError(
                    "GEMINI_API_KEY / LLM_API_KEY must be configured for Gemini provider."
                )
            model = cfg.get("model") or setting.LLM_MODEL or setting.GEMINI_MODEL
            fallback_models_raw = cfg.get("fallback_models") or getattr(
                setting, "GEMINI_FALLBACK_MODELS", ""
            )
            fallback_models = (
                [m.strip() for m in fallback_models_raw.split(",") if m.strip()]
                if isinstance(fallback_models_raw, str)
                else (fallback_models_raw or [])
            )
            return GeminiRESTProvider(
                model_name=model,
                api_key=api_key,
                client=client,
                fallback_models=fallback_models,
                timeout_seconds=cfg.get("timeout_seconds")
                or getattr(setting, "LLM_REQUEST_TIMEOUT_SECONDS", 20.0),
            )
        elif target_provider in ("openai_compatible", "sglang", "vllm", "ollama"):
            base_url = cfg.get("base_url") or setting.LLM_BASE_URL
            if not base_url:
                raise ValueError(
                    "LLM_BASE_URL must be specified for OpenAI-compatible providers."
                )
            model = cfg.get("model") or setting.LLM_MODEL
            api_key = cfg.get("api_key") or setting.LLM_API_KEY
            return OpenAICompatibleProvider(
                model_name=model,
                base_url=base_url,
                api_key=api_key,
                client=client,
            )
        raise ValueError(f"Unsupported LLM provider: {target_provider}")
