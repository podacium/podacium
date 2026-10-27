"""
Unit and integration tests for Distributed Sagas, Cryptographic Rollback Tokens, and LIFO Compensation.
"""

import pytest
from pydantic import BaseModel
from typing import Any

from app.agent.context import AgentSecurityContext
from app.agent.saga.orchestrator import AgentSagaOrchestrator, RollbackToken
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.schemas.auth import UserRole


class DummyArgs(BaseModel):
    value: int = 1


class MockStepTool(BaseTool):
    name = "mock_step_tool"
    description = "Mock tool for testing saga execution"
    domain = ToolDomain.CORE
    is_mutating = True
    args_schema = DummyArgs

    def __init__(self, should_fail: bool = False, rollback_tracker: list = None):
        super().__init__()
        self.should_fail = should_fail
        self.rollback_tracker = rollback_tracker if rollback_tracker is not None else []

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        if self.should_fail:
            return ToolResult(success=False, error="Simulated tool step failure")

        async def compensate() -> bool:
            self.rollback_tracker.append(self.name)
            return True

        return ToolResult(
            success=True,
            data={"executed": True},
            compensating_action=compensate,
        )


def test_rollback_token_generation_and_tamper_detection():
    token = RollbackToken.generate(
        saga_id="saga-123", step_index=1, tool_name="enroll_course"
    )
    assert token.verify() is True

    # Tamper with tool name
    tampered_token = RollbackToken(
        token_id=token.token_id,
        saga_id=token.saga_id,
        step_index=token.step_index,
        tool_name="hacked_tool_name",
        created_at_iso=token.created_at_iso,
        signature=token.signature,
    )
    assert tampered_token.verify() is False


@pytest.mark.asyncio
async def test_saga_orchestrator_lifo_rollback():
    rollback_log = []

    tool1 = MockStepTool(should_fail=False, rollback_tracker=rollback_log)
    tool1.name = "step_1_charge_wallet"

    tool2 = MockStepTool(should_fail=False, rollback_tracker=rollback_log)
    tool2.name = "step_2_create_enrollment"

    tool3 = MockStepTool(should_fail=True, rollback_tracker=rollback_log)
    tool3.name = "step_3_failing_action"

    context = AgentSecurityContext(
        user_id=1,
        user_role=UserRole.STUDENT,
        session_id="saga-test-sess",
    )

    orchestrator = AgentSagaOrchestrator()

    # Step 1 succeeds
    r1 = await orchestrator.execute_tool_in_saga(tool1, DummyArgs(), context)
    assert r1.success is True

    # Step 2 succeeds
    r2 = await orchestrator.execute_tool_in_saga(tool2, DummyArgs(), context)
    assert r2.success is True

    # Step 3 fails -> Triggers automatic LIFO rollback
    r3 = await orchestrator.execute_tool_in_saga(tool3, DummyArgs(), context)
    assert r3.success is False

    # Check that compensations executed in reverse order (LIFO: step_2 then step_1)
    assert rollback_log == ["step_2_create_enrollment", "step_1_charge_wallet"]

    # Check saga step statuses
    summary = orchestrator.get_summary()
    assert summary["total_steps"] == 3
    assert summary["steps"][0]["status"] == "COMPENSATED"
    assert summary["steps"][1]["status"] == "COMPENSATED"
    assert summary["steps"][2]["status"] == "FAILED"


@pytest.mark.asyncio
async def test_auto_bind_compensating_action_on_mutating_tool():
    class MutatingToolWithRollback(BaseTool):
        name = "mutating_tool_with_rollback"
        description = "Mutating tool without explicit compensating_action"
        domain = ToolDomain.CORE
        is_mutating = True
        args_schema = DummyArgs

        def __init__(self):
            super().__init__()
            self.rolled_back = False

        async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
            # Does not set compensating_action
            return ToolResult(success=True, data={"key": "saved"})

        async def rollback(self, context: AgentSecurityContext, payload: dict) -> dict:
            self.rolled_back = True
            return {"status": "COMPENSATED", "message": "Rolled back successfully"}

    tool = MutatingToolWithRollback()
    context = AgentSecurityContext(
        user_id=1,
        user_role=UserRole.STUDENT,
        session_id="saga-test-sess",
    )

    result = await tool.call({"value": 10}, context)
    assert result.success is True
    # Auto-bound closure must be present
    assert result.compensating_action is not None
    assert callable(result.compensating_action)

    # Executing the closure must invoke rollback()
    success = await result.compensating_action()
    assert success is True
    assert tool.rolled_back is True


@pytest.mark.asyncio
async def test_orchestrator_disallows_lambda_compensating_action():
    """Verify VULN-W2-07 fix: AgentSagaOrchestrator rejects lambda closures."""

    class LambdaClosureTool(BaseTool):
        name = "lambda_closure_tool"
        description = "Tool with lambda compensating_action"
        domain = ToolDomain.CORE
        is_mutating = True
        args_schema = DummyArgs

        async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
            return ToolResult(
                success=True,
                data={"done": True},
                compensating_action=lambda: True,
            )

    tool = LambdaClosureTool()
    context = AgentSecurityContext(
        user_id=1, user_role=UserRole.STUDENT, session_id="test-sess"
    )
    orchestrator = AgentSagaOrchestrator()

    with pytest.raises(ValueError, match="Non-serializable lambda closure disallowed"):
        await orchestrator.execute_tool_in_saga(tool, DummyArgs(), context)


@pytest.mark.asyncio
async def test_orchestrator_cross_worker_rollback_via_redis():
    """Verify VULN-W2-07 fix: Worker B rolls back saga via Redis token without in-memory state."""
    from unittest.mock import AsyncMock, patch
    from app.agent.tools.registry import tool_registry

    redis_data = {}
    mock_redis = AsyncMock()

    async def mock_setex(key, ttl, value):
        redis_data[key] = value
        return True

    async def mock_get(key):
        return redis_data.get(key)

    mock_redis.setex = mock_setex
    mock_redis.get = mock_get

    class DistributedMutatingTool(BaseTool):
        name = "distributed_mutating_tool"
        description = "Mutating tool registered in registry for cross-worker rollback"
        domain = ToolDomain.CORE
        is_mutating = True
        args_schema = DummyArgs

        def __init__(self):
            super().__init__()
            self.compensated = False

        async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
            return ToolResult(success=True, data={"step": "applied"})

        async def rollback(self, context: AgentSecurityContext, payload: dict) -> dict:
            self.compensated = True
            return {"status": "COMPENSATED"}

    dist_tool = DistributedMutatingTool()
    tool_registry.register(dist_tool)

    with patch("app.core.redis.get_redis", return_value=mock_redis):
        context = AgentSecurityContext(
            user_id=50, user_role=UserRole.STUDENT, session_id="dist-sess"
        )

        # Worker A creates and executes step
        worker_a_orchestrator = AgentSagaOrchestrator(saga_id="saga-dist-999")
        res = await worker_a_orchestrator.execute_tool_in_saga(
            dist_tool, DummyArgs(), context
        )
        assert res.success is True
        token = worker_a_orchestrator.steps[0].rollback_token
        assert token is not None

        # Verify Redis keys were set by Worker A
        assert f"saga:token:{token.token_id}" in redis_data
        assert "saga:orchestrator:saga-dist-999" in redis_data

        # Simulate Worker B: memory state is wiped clean
        AgentSagaOrchestrator._ACTIVE_SAGAS.clear()
        AgentSagaOrchestrator._TOKEN_INDEX.clear()

        # Worker B receives rollback_by_token
        rollback_resp = await AgentSagaOrchestrator.rollback_by_token(
            token.token_id, context
        )
        assert rollback_resp["success"] is True
        assert rollback_resp["status"] == "COMPENSATED"
        assert dist_tool.compensated is True
