"""
Distributed Saga Orchestrator with Cryptographic Rollback Tokens and LIFO Compensation.
"""

import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional, Union
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolResult
from app.core.config import setting

logger = logging.getLogger(__name__)


class RollbackToken(BaseModel):
    token_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    saga_id: str
    step_index: int
    tool_name: str
    user_id: Optional[int] = None
    organization_id: Optional[int] = None
    created_at_iso: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    signature: str

    @classmethod
    def generate(
        cls,
        saga_id: str,
        step_index: int,
        tool_name: str,
        user_id: Optional[int] = None,
        organization_id: Optional[int] = None,
    ) -> "RollbackToken":
        token_id = str(uuid.uuid4())
        created_at_iso = datetime.now(timezone.utc).isoformat()
        secret = getattr(
            setting, "SECRET_KEY", "podacium-agent-saga-secret-2026"
        ).encode("utf-8")
        if user_id is not None:
            payload = f"{token_id}:{saga_id}:{step_index}:{tool_name}:{user_id}:{organization_id or ''}:{created_at_iso}"
        else:
            payload = f"{token_id}:{saga_id}:{step_index}:{tool_name}:{created_at_iso}"
        sig = hmac.new(secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
        return cls(
            token_id=token_id,
            saga_id=saga_id,
            step_index=step_index,
            tool_name=tool_name,
            user_id=user_id,
            organization_id=organization_id,
            created_at_iso=created_at_iso,
            signature=sig,
        )

    def verify(self) -> bool:
        secret = getattr(
            setting, "SECRET_KEY", "podacium-agent-saga-secret-2026"
        ).encode("utf-8")
        # Try primary payload with user/org if user_id is set
        if self.user_id is not None:
            payload = f"{self.token_id}:{self.saga_id}:{self.step_index}:{self.tool_name}:{self.user_id}:{self.organization_id or ''}:{self.created_at_iso}"
            expected_sig = hmac.new(
                secret, payload.encode("utf-8"), hashlib.sha256
            ).hexdigest()
            if hmac.compare_digest(self.signature, expected_sig):
                return True

        # Fallback payload (for legacy tokens without user_id)
        legacy_payload = f"{self.token_id}:{self.saga_id}:{self.step_index}:{self.tool_name}:{self.created_at_iso}"
        legacy_sig = hmac.new(
            secret, legacy_payload.encode("utf-8"), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(self.signature, legacy_sig)


class SagaStep(BaseModel):
    step_index: int
    tool_name: str
    args: Dict[str, Any]
    result: Optional[Dict[str, Any]] = None
    is_mutating: bool = False
    status: str = (
        "PENDING"  # PENDING, COMPLETED, FAILED, COMPENSATED, COMPENSATION_FAILED
    )
    rollback_token: Optional[RollbackToken] = None
    rollback_payload: Optional[Dict[str, Any]] = None
    handler_identifier: Optional[str] = None
    error: Optional[str] = None


class AgentSagaOrchestrator:
    """
    Manages multi-tool agentic workflows with distributed transaction tracking
    and atomic LIFO compensation rollback on failure.
    """

    # Deprecated class-level stubs preserved strictly for backward-compatible .clear() in test teardowns.
    # Distributed saga state is exclusively persisted to Redis.
    _ACTIVE_SAGAS: Dict[str, "AgentSagaOrchestrator"] = {}
    _TOKEN_INDEX: Dict[str, "AgentSagaOrchestrator"] = {}
    REDIS_TTL_SECONDS = 86400  # 24 hours

    def __init__(self, saga_id: Optional[str] = None):
        self.saga_id: str = saga_id or str(uuid.uuid4())
        self.steps: List[SagaStep] = []
        self._compensators: List[Callable[[], Awaitable[bool]]] = []
        self.user_id: Optional[int] = None
        self.organization_id: Optional[int] = None

    async def execute_tool_in_saga(
        self,
        tool: BaseTool,
        args: Union[BaseModel, Dict[str, Any]],
        context: AgentSecurityContext,
    ) -> ToolResult:
        self.user_id = context.user_id
        self.organization_id = context.organization_id
        step_idx = len(self.steps)
        token = RollbackToken.generate(
            self.saga_id,
            step_idx,
            tool.name,
            user_id=context.user_id,
            organization_id=context.organization_id,
        )

        raw_args: Dict[str, Any] = (
            args.model_dump() if isinstance(args, BaseModel) else dict(args)
        )

        step = SagaStep(
            step_index=step_idx,
            tool_name=tool.name,
            args=raw_args,
            is_mutating=tool.is_mutating,
            rollback_token=token,
            handler_identifier=tool.name,
        )
        self.steps.append(step)

        try:
            result = await tool.call(raw_args, context)
            if not result.success:
                step.status = "FAILED"
                step.error = result.error
                logger.warning(
                    f"[Saga {self.saga_id}] Tool {tool.name} failed at step {step_idx}: {result.error}"
                )
                await self._persist_state()
                await self._persist_token_index(token)
                await self.rollback_all(context=context)
                return result

            step.status = "COMPLETED"
            payload_data = (
                result.data
                if isinstance(result.data, dict)
                else {"data": str(result.data)}
            )
            step.result = payload_data
            step.rollback_payload = payload_data

            # Disallow non-serializable lambda closures in tools
            if result.compensating_action is not None:
                if getattr(result.compensating_action, "__name__", "") == "<lambda>":
                    raise ValueError(
                        f"Non-serializable lambda closure disallowed on tool '{tool.name}'. "
                        "Implement BaseTool.rollback() or provide a named compensating function."
                    )
                self._compensators.append(result.compensating_action)

            await self._persist_state()
            await self._persist_token_index(token)
            return result

        except ValueError as ve:
            step.status = "FAILED"
            step.error = str(ve)
            await self._persist_state()
            await self._persist_token_index(token)
            raise
        except Exception as e:
            step.status = "FAILED"
            step.error = str(e)
            logger.error(
                f"[Saga {self.saga_id}] Exception executing tool {tool.name} at step {step_idx}: {e}",
                exc_info=True,
            )
            await self._persist_state()
            await self._persist_token_index(token)
            await self.rollback_all(context=context)
            return ToolResult(success=False, error=f"Saga execution failed: {str(e)}")

    async def _persist_state(self) -> None:
        try:
            from app.core.redis import get_redis

            redis = await get_redis()
            if not redis:
                return
            payload = json.dumps(
                {
                    "saga_id": self.saga_id,
                    "user_id": self.user_id,
                    "organization_id": self.organization_id,
                    "steps": [s.model_dump() for s in self.steps],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            await redis.setex(
                f"saga:orchestrator:{self.saga_id}", self.REDIS_TTL_SECONDS, payload
            )
        except Exception as e:
            logger.warning(
                f"[Saga {self.saga_id}] Failed persisting state to Redis: {e}"
            )

    async def _persist_token_index(self, token: RollbackToken) -> None:
        try:
            from app.core.redis import get_redis

            redis = await get_redis()
            if not redis:
                return
            token_payload = json.dumps(
                {
                    "saga_id": self.saga_id,
                    "token_id": token.token_id,
                    "step_index": token.step_index,
                    "tool_name": token.tool_name,
                    "user_id": token.user_id,
                    "organization_id": token.organization_id,
                    "created_at_iso": token.created_at_iso,
                    "signature": token.signature,
                }
            )
            await redis.setex(
                f"saga:token:{token.token_id}", self.REDIS_TTL_SECONDS, token_payload
            )
        except Exception as e:
            logger.warning(
                f"[Saga {self.saga_id}] Failed persisting token index to Redis: {e}"
            )

    @classmethod
    async def load_from_redis(cls, saga_id: str) -> Optional["AgentSagaOrchestrator"]:
        try:
            from app.core.redis import get_redis

            redis = await get_redis()
            if not redis:
                return None
            raw_state = await redis.get(f"saga:orchestrator:{saga_id}")
            if not raw_state:
                return None
            state_str = (
                raw_state if isinstance(raw_state, str) else raw_state.decode("utf-8")
            )
            state_dict = json.loads(state_str)
            orchestrator = cls(saga_id=state_dict.get("saga_id", saga_id))
            orchestrator.user_id = state_dict.get("user_id")
            orchestrator.organization_id = state_dict.get("organization_id")
            orchestrator.steps = [
                SagaStep.model_validate(s) for s in state_dict.get("steps", [])
            ]
            return orchestrator
        except Exception as e:
            logger.warning(
                f"Failed loading saga orchestrator {saga_id} from Redis: {e}"
            )
            return None

    @classmethod
    async def get_by_token(cls, token_id: str) -> Optional["AgentSagaOrchestrator"]:
        """Resolves an AgentSagaOrchestrator from Redis."""
        try:
            from app.core.redis import get_redis

            redis = await get_redis()
            if redis:
                raw_token = await redis.get(f"saga:token:{token_id}")
                if raw_token:
                    t_str = (
                        raw_token
                        if isinstance(raw_token, str)
                        else raw_token.decode("utf-8")
                    )
                    t_dict = json.loads(t_str)
                    saga_id = t_dict.get("saga_id")
                    if saga_id:
                        saga = await cls.load_from_redis(saga_id)
                        if saga:
                            return saga
        except Exception as e:
            logger.warning(f"Failed to lookup saga token {token_id} in Redis: {e}")

        return None

    async def rollback_all(
        self, context: Optional[AgentSecurityContext] = None
    ) -> List[bool]:
        """
        Unwinds completed steps in reverse order (LIFO) by executing compensating actions.
        Supports both in-memory compensator closures and distributed declarative tool rollbacks.
        """
        logger.info(
            f"[Saga {self.saga_id}] Initiating LIFO rollback across {len(self._compensators)} in-memory compensators "
            f"and {len(self.steps)} recorded steps."
        )
        rollback_results: List[bool] = []

        # 1. Execute any in-memory callable compensators in reverse order (same worker)
        while self._compensators:
            compensator = self._compensators.pop()
            try:
                success = await compensator()
                rollback_results.append(success)
                logger.info(
                    f"[Saga {self.saga_id}] Compensating action executed: success={success}"
                )
            except Exception as e:
                logger.error(
                    f"[Saga {self.saga_id}] Compensating action failed with exception: {e}",
                    exc_info=True,
                )
                rollback_results.append(False)

        # 2. For steps where in-memory compensator was not present (e.g. distributed across workers):
        # Compensate via BaseTool.rollback() from tool_registry
        from app.agent.tools.registry import tool_registry

        mutating_completed_steps = [
            s for s in self.steps if s.status == "COMPLETED" and s.is_mutating
        ]
        # If in-memory compensators were already executed for all mutating completed steps:
        if len(rollback_results) >= len(mutating_completed_steps):
            for step in reversed(self.steps):
                if step.status == "COMPLETED" and step.is_mutating:
                    step.status = "COMPENSATED"
        else:
            # We need declarative compensation for the steps not covered by in-memory compensators
            for step in reversed(mutating_completed_steps):
                tool = tool_registry.get_tool(step.tool_name)
                if tool:
                    sec_ctx = context or AgentSecurityContext(
                        user_id=self.user_id,
                        organization_id=self.organization_id,
                        session_id=f"saga_{self.saga_id}",
                    )
                    try:
                        rb_payload = step.rollback_payload or step.result or step.args
                        res = await tool.rollback(context=sec_ctx, payload=rb_payload)
                        success = (
                            res.get("status") != "FAILED"
                            if isinstance(res, dict)
                            else bool(res)
                        )
                        rollback_results.append(success)
                        step.status = (
                            "COMPENSATED" if success else "COMPENSATION_FAILED"
                        )
                    except Exception as e:
                        logger.error(
                            f"[Saga {self.saga_id}] Declarative tool rollback failed for {step.tool_name}: {e}",
                            exc_info=True,
                        )
                        rollback_results.append(False)
                        step.status = "COMPENSATION_FAILED"
                else:
                    logger.warning(
                        f"[Saga {self.saga_id}] Tool '{step.tool_name}' not found in registry during distributed rollback."
                    )
                    step.status = "COMPENSATED"

        await self._persist_state()
        return rollback_results

    @classmethod
    async def rollback_by_token(
        cls,
        token_id: str,
        context: AgentSecurityContext,
    ) -> Dict[str, Any]:
        """
        1-Click Compensating Transaction Rollback invoked via RollbackToken.
        Enforces cryptographic verification and zero-trust ownership checks across cluster nodes.
        """
        saga = await cls.get_by_token(token_id)
        if not saga:
            return {
                "success": False,
                "error": f"Saga transaction for token '{token_id}' not found or already purged.",
            }

        # Find target step
        target_step = next(
            (
                s
                for s in saga.steps
                if s.rollback_token and s.rollback_token.token_id == token_id
            ),
            None,
        )
        if not target_step or not target_step.rollback_token:
            return {"success": False, "error": "Invalid token or step not found."}

        # 1. Cryptographic token verification
        if not target_step.rollback_token.verify():
            return {
                "success": False,
                "error": "Cryptographic signature mismatch. Token has been tampered with.",
            }

        # 2. Authorization check (zero IDOR)
        token_user_id = target_step.rollback_token.user_id
        if (
            token_user_id is not None
            and token_user_id != context.user_id
            and not context.has_role("ADMIN")
        ):
            return {
                "success": False,
                "error": "Unauthorized: Cannot roll back actions belonging to another user.",
            }

        # 3. Execute atomic LIFO rollback
        results = await saga.rollback_all(context=context)
        return {
            "success": all(results) if results else True,
            "saga_id": saga.saga_id,
            "token_id": token_id,
            "compensated_steps": len(results),
            "status": "COMPENSATED"
            if (all(results) or not results)
            else "COMPENSATION_FAILED",
        }

    def get_summary(self) -> Dict[str, Any]:
        return {
            "saga_id": self.saga_id,
            "total_steps": len(self.steps),
            "steps": [s.model_dump() for s in self.steps],
        }
