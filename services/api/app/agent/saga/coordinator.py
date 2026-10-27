"""
services/api/app/agent/saga/coordinator.py
Production-grade AgentSaga Context Manager & Compensating Transaction Coordinator.
Implements distributed Saga orchestrations for autonomous multi-step tool calls
with LIFO backward compensating actions, Redis persistence, and zero orphaned states.
"""

import inspect
import json
import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field

from app.agent.context import AgentSecurityContext
from app.agent.saga.orchestrator import AgentSagaOrchestrator
from app.agent.tools.base import BaseTool, ToolResult
from app.core.redis import get_redis

logger = logging.getLogger("podacium.agent.saga")


class SagaStatus(str, Enum):
    INITIALIZED = "INITIALIZED"
    RUNNING = "RUNNING"
    SUSPENDED_HITL = "SUSPENDED_HITL"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    COMPENSATING = "COMPENSATING"
    COMPENSATED = "COMPENSATED"
    COMPENSATION_FAILED = "COMPENSATION_FAILED"


class CompensatorStep(BaseModel):
    model_config = ConfigDict(extra="ignore")

    step_name: str
    step_index: int
    tool_name: Optional[str] = None
    handler_name: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    executed_at_iso: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


SAGA_COMPENSATOR_REGISTRY: Dict[str, Callable[..., Any]] = {}


def register_saga_compensator(name_or_fn: Union[str, Callable[..., Any]]) -> Any:
    """Decorator or helper to register a named saga compensator function across cluster workers."""
    if callable(name_or_fn):
        fn_name = getattr(name_or_fn, "__name__", str(name_or_fn))
        SAGA_COMPENSATOR_REGISTRY[fn_name] = name_or_fn
        return name_or_fn

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        SAGA_COMPENSATOR_REGISTRY[name_or_fn] = fn
        return fn

    return decorator


class AgentSaga:
    """
    Agentic Saga context manager and transaction coordinator.
    Ensures that any failure during multi-step tool calls unwinds all executed
    actions in strictly reverse (LIFO) order with zero partial state corruption.

    Example:
        async with AgentSaga(session_id=session_id) as saga:
            await saga.execute(step="create_draft_contract", action=create_fn, rollback=delete_draft_contract)
            await saga.execute(step="lock_escrow_funds", action=lock_fn, rollback=unlock_escrow_funds)
            await saga.execute(step="notify_parties", action=notify_fn, rollback=notify_contract_failed)
    """

    REDIS_TTL_SECONDS = 86400  # 24 hours

    def __init__(
        self,
        session_id: str,
        user_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        saga_id: Optional[str] = None,
        auto_rollback_on_exit: bool = True,
    ):
        self.saga_id: str = saga_id or f"saga_{uuid.uuid4().hex[:12]}"
        self.session_id: str = session_id
        self.user_id: Optional[int] = user_id
        self.organization_id: Optional[int] = organization_id
        self.auto_rollback_on_exit: bool = auto_rollback_on_exit
        self.status: SagaStatus = SagaStatus.INITIALIZED
        self.error: Optional[str] = None
        self._orchestrator = AgentSagaOrchestrator(saga_id=self.saga_id)
        self._registered_rollbacks: List[Dict[str, Any]] = []
        self._executed_steps: List[Dict[str, Any]] = []

    async def __aenter__(self) -> "AgentSaga":
        self.status = SagaStatus.RUNNING
        await self._persist_state()
        logger.info(
            f"[AgentSaga {self.saga_id}] Started transaction for session {self.session_id}"
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> bool:
        if exc_type is not None:
            self.status = SagaStatus.FAILED
            self.error = str(exc_val)
            logger.error(
                f"[AgentSaga {self.saga_id}] Transaction failed due to {exc_type.__name__}: {exc_val}. "
                "Initiating backward compensating actions in LIFO order."
            )
            if self.auto_rollback_on_exit:
                await self.rollback_all()
            return False  # Re-raise exception to caller

        if self.status == SagaStatus.RUNNING:
            self.status = SagaStatus.COMPLETED
            await self._persist_state()
            logger.info(
                f"[AgentSaga {self.saga_id}] Transaction completed successfully."
            )

        return True

    async def execute(
        self,
        step: Union[str, Callable[..., Any]],
        rollback: Optional[Callable[..., Any]] = None,
        action: Optional[Callable[..., Any]] = None,
        **kwargs: Any,
    ) -> Any:
        """
        Executes a discrete step within the saga and registers its rollback handler.
        If the action raises an exception, all previous steps are rolled back in LIFO order.
        """
        step_name = (
            step
            if isinstance(step, str)
            else getattr(step, "__name__", "anonymous_step")
        )
        step_fn = action or (step if callable(step) else None)
        step_idx = len(self._executed_steps)

        logger.info(
            f"[AgentSaga {self.saga_id}] Executing step {step_idx}: '{step_name}'"
        )
        if step_fn is not None and getattr(step_fn, "__name__", "") == "<lambda>":
            raise ValueError(
                f"Non-serializable lambda closure disallowed for saga step '{step_name}'. "
                "Use a named function, declarative handler, or BaseTool for distributed sagas."
            )

        try:
            result = None
            if step_fn is not None:
                if inspect.iscoroutinefunction(step_fn):
                    result = await step_fn(**kwargs)
                else:
                    result = step_fn(**kwargs)

            # Register backward compensating rollback
            if rollback is not None:
                if (
                    callable(rollback)
                    and getattr(rollback, "__name__", "") == "<lambda>"
                ):
                    raise ValueError(
                        f"Non-serializable lambda closure disallowed for saga step '{step_name}'. "
                        "Use a named function, declarative handler, or BaseTool for distributed sagas."
                    )
                handler_name = (
                    rollback
                    if isinstance(rollback, str)
                    else getattr(rollback, "__name__", str(rollback))
                )
                if callable(rollback) and handler_name:
                    SAGA_COMPENSATOR_REGISTRY[handler_name] = rollback

                payload_data = (
                    result
                    if isinstance(result, dict)
                    else {"result": result}
                    if result is not None
                    else {}
                )
                self._registered_rollbacks.append(
                    {
                        "step_name": step_name,
                        "step_index": step_idx,
                        "rollback": rollback,
                        "handler_name": handler_name,
                        "payload": payload_data,
                        "result": result,
                    }
                )

            self._executed_steps.append(
                {
                    "step_name": step_name,
                    "step_index": step_idx,
                    "status": "COMPLETED",
                    "result": result
                    if isinstance(
                        result, (dict, list, str, int, float, bool, type(None))
                    )
                    else str(result),
                }
            )
            await self._persist_state()
            return result

        except Exception as step_err:
            self.status = SagaStatus.FAILED
            self.error = f"Step '{step_name}' failed: {step_err}"
            logger.error(
                f"[AgentSaga {self.saga_id}] Step '{step_name}' raised {type(step_err).__name__}: {step_err}. "
                "Triggering automated LIFO compensation.",
                exc_info=True,
            )
            await self.rollback_all()
            raise

    async def execute_tool_in_saga(
        self,
        tool: BaseTool,
        args: Any,
        context: AgentSecurityContext,
    ) -> ToolResult:
        """
        Executes a registered BaseTool within the distributed saga orchestrator.
        """
        res = await self._orchestrator.execute_tool_in_saga(tool, args, context)
        step_idx = len(self._executed_steps)
        self._executed_steps.append(
            {
                "step_name": tool.name,
                "step_index": step_idx,
                "status": "COMPLETED" if res.success else "FAILED",
                "result": res.data if res.success else {"error": res.error},
            }
        )
        await self._persist_state()
        return res

    async def rollback_all(
        self,
        context: Optional[AgentSecurityContext] = None,
    ) -> List[bool]:
        """
        Executes all recorded rollback handlers in reverse order (LIFO).
        """
        self.status = SagaStatus.COMPENSATING
        await self._persist_state()
        logger.info(
            f"[AgentSaga {self.saga_id}] Unwinding {len(self._registered_rollbacks)} "
            "registered compensating actions in reverse order (LIFO)."
        )

        results: List[bool] = []
        # Unwind manually registered function rollbacks in reverse order
        while self._registered_rollbacks:
            item = self._registered_rollbacks.pop()
            step_name = item["step_name"]
            rb = item.get("rollback")
            handler_name = item.get("handler_name")
            payload = item.get("payload") or {}

            logger.info(
                f"[AgentSaga {self.saga_id}] Compensating step '{step_name}'..."
            )
            try:
                rb_res = None
                if callable(rb):
                    if inspect.iscoroutinefunction(rb):
                        rb_res = await rb()
                    else:
                        rb_res = rb()
                elif handler_name and handler_name in SAGA_COMPENSATOR_REGISTRY:
                    handler = SAGA_COMPENSATOR_REGISTRY[handler_name]
                    if inspect.iscoroutinefunction(handler):
                        try:
                            rb_res = await handler(**payload)
                        except TypeError:
                            rb_res = await handler()
                    else:
                        try:
                            rb_res = handler(**payload)
                        except TypeError:
                            rb_res = handler()
                else:
                    from app.agent.tools.registry import tool_registry

                    tool = tool_registry.get_tool(step_name) or (
                        tool_registry.get_tool(handler_name) if handler_name else None
                    )
                    if tool:
                        sec_context = context or AgentSecurityContext(
                            user_id=self.user_id,
                            organization_id=self.organization_id,
                            session_id=self.session_id,
                        )
                        rb_res = await tool.rollback(
                            context=sec_context, payload=payload
                        )
                    else:
                        logger.warning(
                            f"[AgentSaga {self.saga_id}] No rollback handler found for step '{step_name}', marking compensated."
                        )
                        rb_res = True

                results.append(bool(rb_res) if rb_res is not None else True)
            except Exception as rb_exc:
                logger.error(
                    f"[AgentSaga {self.saga_id}] Failed compensating step '{step_name}': {rb_exc}",
                    exc_info=True,
                )
                results.append(False)

        # Also trigger orchestrator level rollbacks if any tool-based steps ran
        tool_rb_results = await self._orchestrator.rollback_all(context=context)
        results.extend(tool_rb_results)

        self.status = (
            SagaStatus.COMPENSATED
            if all(results) or not results
            else SagaStatus.COMPENSATION_FAILED
        )
        await self._persist_state()
        return results

    async def _persist_state(self) -> None:
        """Persists hot saga state to Redis for distributed resilience."""
        redis = await get_redis()
        if not redis:
            return
        try:
            rollbacks_data = [
                {
                    "step_name": item["step_name"],
                    "step_index": item["step_index"],
                    "handler_name": item.get("handler_name")
                    or getattr(item.get("rollback"), "__name__", None),
                    "payload": item.get("payload")
                    or (
                        item.get("result")
                        if isinstance(item.get("result"), dict)
                        else {}
                    ),
                }
                for item in self._registered_rollbacks
            ]
            steps_data = [
                {
                    "step_name": s["step_name"],
                    "step_index": s["step_index"],
                    "status": s.get("status"),
                    "result": s.get("result")
                    if isinstance(
                        s.get("result"), (dict, list, str, int, float, bool, type(None))
                    )
                    else str(s.get("result")),
                }
                for s in self._executed_steps
            ]
            payload = json.dumps(
                {
                    "saga_id": self.saga_id,
                    "session_id": self.session_id,
                    "user_id": self.user_id,
                    "organization_id": self.organization_id,
                    "status": self.status.value,
                    "error": self.error,
                    "steps": steps_data,
                    "rollbacks": rollbacks_data,
                    "step_count": len(self._executed_steps),
                    "rollback_count": len(self._registered_rollbacks),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            await redis.setex(f"saga:{self.saga_id}", self.REDIS_TTL_SECONDS, payload)
            await redis.setex(
                f"session:{self.session_id}:active_saga",
                self.REDIS_TTL_SECONDS,
                self.saga_id,
            )
        except Exception as e:
            logger.warning(
                f"[AgentSaga {self.saga_id}] Failed persisting state to Redis: {e}"
            )

    @classmethod
    async def load_from_redis(cls, saga_id: str) -> Optional["AgentSaga"]:
        """Loads and rehydrates an AgentSaga instance from Redis."""
        redis = await get_redis()
        if not redis:
            return None
        try:
            raw = await redis.get(f"saga:{saga_id}")
            if not raw:
                return None
            data = json.loads(raw if isinstance(raw, str) else raw.decode("utf-8"))
            saga = cls(
                session_id=data.get("session_id", "restored_session"),
                user_id=data.get("user_id"),
                organization_id=data.get("organization_id"),
                saga_id=data.get("saga_id", saga_id),
            )
            saga.status = SagaStatus(data.get("status", SagaStatus.INITIALIZED.value))
            saga.error = data.get("error")
            saga._executed_steps = data.get("steps", [])
            saga._registered_rollbacks = data.get("rollbacks", [])
            return saga
        except Exception as e:
            logger.warning(f"Failed to load saga {saga_id} from Redis: {e}")
            return None
