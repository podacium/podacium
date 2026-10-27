"""
services/api/app/agent/exceptions.py
Domain exceptions for the Podacium Agentic AI engine.
"""

from typing import Optional, Dict, Any


class AgentException(Exception):
    """Base exception for all agentic AI operations."""

    def __init__(
        self,
        message: str,
        code: str = "AGENT_ERROR",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}


class LLMProviderException(AgentException):
    """Raised when an LLM provider encounters an unrecoverable API error or invalid response."""

    def __init__(
        self,
        message: str,
        provider: str = "unknown",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message, code="LLM_PROVIDER_ERROR", details=details)
        self.provider = provider


class CircuitBreakerOpenException(LLMProviderException):
    """Raised when an execution attempt is made against a provider with an OPEN circuit breaker."""

    def __init__(self, provider: str):
        super().__init__(
            message=f"Circuit breaker for provider '{provider}' is OPEN. Requests temporarily halted.",
            provider=provider,
            details={"state": "OPEN"},
        )


class ToolExecutionException(AgentException):
    """Raised when a deterministic tool execution encounters a runtime failure."""

    def __init__(
        self, tool_name: str, message: str, details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, code="TOOL_EXECUTION_ERROR", details=details)
        self.tool_name = tool_name


class ContextCompactionException(AgentException):
    """Raised when session context compaction fails."""

    def __init__(self, session_id: str, message: str):
        super().__init__(
            message, code="CONTEXT_COMPACTION_ERROR", details={"sessionId": session_id}
        )
        self.session_id = session_id
