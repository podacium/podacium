"""
Unit tests for AgentSaga context manager and backward compensating transactions.
"""

import pytest
from app.agent.saga.coordinator import AgentSaga, SagaStatus


@pytest.mark.asyncio
async def test_agent_saga_successful_flow():
    execution_order = []
    rollback_order = []

    async def step1():
        execution_order.append("step1")
        return {"contract_id": 101}

    async def rb1():
        rollback_order.append("rb1")

    async def step2():
        execution_order.append("step2")
        return {"escrow_locked": True}

    async def rb2():
        rollback_order.append("rb2")

    async with AgentSaga(session_id="test-saga-session") as saga:
        await saga.execute(step="create_draft_contract", action=step1, rollback=rb1)
        await saga.execute(step="lock_escrow_funds", action=step2, rollback=rb2)

    assert execution_order == ["step1", "step2"]
    # No rollback should execute on success
    assert rollback_order == []
    assert saga.status == SagaStatus.COMPLETED


@pytest.mark.asyncio
async def test_agent_saga_lifo_rollback_on_failure():
    execution_order = []
    rollback_order = []

    async def delete_draft_contract():
        rollback_order.append("delete_draft_contract")

    async def unlock_escrow_funds():
        rollback_order.append("unlock_escrow_funds")

    async def notify_contract_failed():
        rollback_order.append("notify_contract_failed")

    async def step1():
        execution_order.append("create_draft_contract")
        return 1

    async def step2():
        execution_order.append("lock_escrow_funds")
        return 2

    async def step3():
        execution_order.append("notify_parties")
        raise RuntimeError("Network failure notifying freelancer")

    with pytest.raises(RuntimeError, match="Network failure notifying freelancer"):
        async with AgentSaga(session_id="test-failing-saga") as saga:
            await saga.execute(
                step="create_draft_contract",
                action=step1,
                rollback=delete_draft_contract,
            )
            await saga.execute(
                step="lock_escrow_funds", action=step2, rollback=unlock_escrow_funds
            )
            await saga.execute(
                step="notify_parties", action=step3, rollback=notify_contract_failed
            )

    assert execution_order == [
        "create_draft_contract",
        "lock_escrow_funds",
        "notify_parties",
    ]
    # Step 3 failed during execution, so only steps 2 and 1 completed and must be rolled back in LIFO order
    assert rollback_order == ["unlock_escrow_funds", "delete_draft_contract"]
    assert saga.status in (SagaStatus.COMPENSATED, SagaStatus.FAILED)


@pytest.mark.asyncio
async def test_agent_saga_disallows_lambda_closures():
    """Verify VULN-W2-07 fix: lambda closures are strictly disallowed."""
    async with AgentSaga(session_id="test-lambda-disallowed") as saga:
        with pytest.raises(
            ValueError, match="Non-serializable lambda closure disallowed"
        ):
            await saga.execute(
                step="bad_step",
                action=lambda: {"ok": True},
                rollback=lambda: True,
            )


@pytest.mark.asyncio
async def test_agent_saga_redis_cluster_rehydration():
    """Verify VULN-W2-07 fix: Worker B rehydrates saga state from Redis across cluster workers."""
    import json
    from unittest.mock import AsyncMock, patch

    redis_store = {}

    mock_redis = AsyncMock()

    async def mock_setex(key, ttl, value):
        redis_store[key] = value
        return True

    async def mock_get(key):
        return redis_store.get(key)

    mock_redis.setex = mock_setex
    mock_redis.get = mock_get

    with patch("app.agent.saga.coordinator.get_redis", return_value=mock_redis):

        async def step_a():
            return {"contract_id": 999}

        async def rollback_step_a():
            return True

        # Worker A executes saga
        async with AgentSaga(
            session_id="sess-worker-a", saga_id="saga-cluster-123"
        ) as saga_a:
            await saga_a.execute(step="step_a", action=step_a, rollback=rollback_step_a)

        # Confirm persisted in Redis
        assert "saga:saga-cluster-123" in redis_store
        persisted = json.loads(redis_store["saga:saga-cluster-123"])
        assert persisted["saga_id"] == "saga-cluster-123"
        assert len(persisted["steps"]) == 1
        assert len(persisted["rollbacks"]) == 1

        # Worker B loads from Redis
        saga_b = await AgentSaga.load_from_redis("saga-cluster-123")
        assert saga_b is not None
        assert saga_b.saga_id == "saga-cluster-123"
        assert len(saga_b._executed_steps) == 1
        assert len(saga_b._registered_rollbacks) == 1
