"""
Tests for Layer 13 Developer Platform:
- Webhook worker event loop safety & Standard Webhooks headers
- API key rotation grace expiration verification & scope enforcement
- Concurrent audit log write serialization and hash chain integrity
- Sandboxed Wasm transformation runner execution
"""

import asyncio
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.core.async_bridge import async_to_sync, run_async_in_worker
from app.core.scopes import check_scope_match, scopes_to_bitmask, validate_scopes
from app.core.wasm_sandbox import WasmPayloadTransformer
from app.core.webhook_crypto import (
    build_standard_headers,
    generate_standard_secret,
    verify_standard_signature,
)
from app.services.api_key_service import ApiKeyService
from app.services.audit_trail_service import AuditTrailService


# ─────────────────────────────────────────────────────────────────────────────
# 1. Async Bridge & Event Loop Safety (CRITICAL-DEV-01)
# ─────────────────────────────────────────────────────────────────────────────


def test_async_bridge_persistent_loop_execution():
    """Verify that multiple sequential async tasks run without 'Event loop is closed'."""

    async def sample_coroutine(val: int) -> int:
        await asyncio.sleep(0.01)
        return val * 2

    # Multiple executions sequentially from synchronous context
    res1 = run_async_in_worker(sample_coroutine(5))
    assert res1 == 10

    res2 = run_async_in_worker(sample_coroutine(12))
    assert res2 == 24

    # Using async_to_sync wrapper
    sync_fn = async_to_sync(sample_coroutine)
    assert sync_fn(21) == 42


def test_webhook_celery_task_execution_safety():
    """Verify dispatch_webhook_async executes via bridge without loop crashes."""
    from app.tasks.webhook_tasks import dispatch_webhook_async

    with (
        patch("app.tasks.webhook_tasks.prisma") as mock_prisma,
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_endpoint = MagicMock(
            id=101,
            userId=1,
            active=True,
            circuitState="CLOSED",
            failureCount=0,
            url="https://example.com/webhook",
            secret="whsec_dGVzdHNlY3JldDEyMzQ1Njc4OWFiY2RlZjEyMzQ1Ng==",
            previousSecret=None,
            transformActive=False,
            transformWasm=None,
        )
        mock_prisma.webhookendpoint.find_unique = AsyncMock(return_value=mock_endpoint)
        mock_prisma.webhookdelivery.create = AsyncMock()
        mock_prisma.webhookendpoint.update = AsyncMock()

        mock_resp = MagicMock(status_code=200, text="OK")
        mock_post.return_value = mock_resp

        res = dispatch_webhook_async(
            endpoint_id=101, payload={"event": "test"}, event_type="test.event"
        )
        assert res["status"] == "SUCCESS"
        assert res["status_code"] == 200


# ─────────────────────────────────────────────────────────────────────────────
# 2. API Key Rotation Grace Period & Scopes (CRITICAL-DEV-02)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_api_key_grace_period_rejection():
    """Verify that API keys past their graceExpiresAt are strictly rejected."""
    service = ApiKeyService()
    now_utc = datetime.now(timezone.utc)

    # 1. Key within grace window -> Valid
    unexpired_grace_key = MagicMock(
        id=1,
        userId=42,
        keyHash=service.compute_key_hash("sk_live_podacium_validgracekey1234567890"),
        revokedAt=None,
        expiresAt=None,
        graceExpiresAt=now_utc + timedelta(days=2),
        scopes=["read:courses"],
        environment="production",
    )

    with (
        patch.object(
            service.db.apikey, "find_unique", new_callable=AsyncMock
        ) as mock_find,
        patch.object(
            service.db.apikey, "update", new_callable=AsyncMock
        ) as mock_update,
    ):
        mock_find.return_value = unexpired_grace_key
        user_id = await service.verify_api_key(
            "sk_live_podacium_validgracekey1234567890"
        )
        assert user_id == 42

        # Reset mock before testing expired key
        mock_update.reset_mock()

        # 2. Key past grace window -> Strictly Rejected & auto-revoked
        expired_grace_key = MagicMock(
            id=2,
            userId=42,
            keyHash=service.compute_key_hash(
                "sk_live_podacium_expiredgracekey123456789"
            ),
            revokedAt=None,
            expiresAt=None,
            graceExpiresAt=now_utc - timedelta(hours=1),  # Expired 1 hour ago
            scopes=["read:courses"],
            environment="production",
        )
        mock_find.return_value = expired_grace_key

        rejected_user_id = await service.verify_api_key(
            "sk_live_podacium_expiredgracekey123456789"
        )
        assert rejected_user_id is None
        # Verify auto-revoke was triggered
        mock_update.assert_called_once()


def test_scope_validation_and_bitmask():
    """Verify scope validation, bitmask computation, and hierarchical matching."""
    assert (
        validate_scopes(["read:courses", "write:milestones", "manage:webhooks"]) is True
    )
    assert validate_scopes(["invalid:fake:scope"]) is False

    # Bitmask conversion
    mask = scopes_to_bitmask(["read:courses", "write:milestones"])
    assert mask > 0

    # Hierarchical matching
    assert check_scope_match(["*"], "write:invoices") is True
    assert check_scope_match(["read:courses"], "read:courses") is True
    assert check_scope_match(["read:courses"], "education:courses:read") is True
    assert check_scope_match(["read:*"], "read:invoices") is True
    assert check_scope_match(["read:courses"], "write:invoices") is False


# ─────────────────────────────────────────────────────────────────────────────
# 3. Standard Webhooks Specification Compliance
# ─────────────────────────────────────────────────────────────────────────────


def test_standard_webhooks_headers_and_signature_verification():
    """Verify outbound webhook headers match Standard Webhooks spec and pass verification."""
    secret = generate_standard_secret()
    msg_id = "msg_2tQabcdef123456"
    timestamp = int(time.time())
    payload = b'{"event":"course.completed","student_id":99}'

    headers = build_standard_headers(
        msg_id=msg_id,
        timestamp=timestamp,
        payload_bytes=payload,
        secret=secret,
    )

    assert headers["webhook-id"] == msg_id
    assert headers["webhook-timestamp"] == str(timestamp)
    assert headers["webhook-signature"].startswith("v1,")
    assert "X-Podacium-Signature" in headers

    # Verify signature
    is_valid = verify_standard_signature(
        secret=secret,
        msg_id=msg_id,
        timestamp=timestamp,
        payload_bytes=payload,
        signature_header=headers["webhook-signature"],
    )
    assert is_valid is True

    # Tampered payload fails verification
    tampered_valid = verify_standard_signature(
        secret=secret,
        msg_id=msg_id,
        timestamp=timestamp,
        payload_bytes=b'{"event":"course.completed","student_id":100}',
        signature_header=headers["webhook-signature"],
    )
    assert tampered_valid is False


# ─────────────────────────────────────────────────────────────────────────────
# 4. Concurrent Audit Log Hash Chain Verification (HIGH-DEV-03)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_concurrent_audit_log_serialization():
    """Verify that concurrent audit log requests are serialized without broken links."""
    mock_records = []
    current_seq = 0

    async def mock_find_first(**kwargs):
        if not mock_records:
            return None
        return mock_records[-1]

    async def mock_create(**kwargs):
        nonlocal current_seq
        current_seq += 1
        d = kwargs.get("data", kwargs)
        rec = MagicMock(
            id=current_seq,
            sequenceNumber=d["sequenceNumber"],
            sha256Hash=d["sha256Hash"],
            previousHash=d["previousHash"],
        )
        mock_records.append(rec)
        return rec

    with (
        patch("app.services.audit_trail_service.prisma") as mock_prisma,
        patch("app.core.redis.get_redis", new_callable=AsyncMock) as mock_get_redis,
    ):
        mock_prisma.adminaudittrail.find_first = AsyncMock(side_effect=mock_find_first)
        mock_prisma.adminaudittrail.create = AsyncMock(side_effect=mock_create)
        mock_get_redis.return_value = None  # Tests in-process lock serialization

        # Dispatch 5 concurrent log_action tasks
        tasks = [
            AuditTrailService.log_action(
                action=f"TEST_ACTION_{i}",
                domain="SYSTEM",
                resource_type="USER",
                resource_id=i,
            )
            for i in range(1, 6)
        ]
        results = await asyncio.gather(*tasks)

        assert len(results) == 5
        # Verify sequence numbers are strictly incrementing: 1, 2, 3, 4, 5
        seqs = [int(r.sequenceNumber) for r in mock_records]
        assert seqs == [1, 2, 3, 4, 5]

        # Verify hash chain continuity: each record's previousHash matches previous sha256Hash
        for i in range(1, len(mock_records)):
            assert mock_records[i].previousHash == mock_records[i - 1].sha256Hash


# ─────────────────────────────────────────────────────────────────────────────
# 5. Sandboxed Wasm Transformation Execution
# ─────────────────────────────────────────────────────────────────────────────


def test_wasm_sandboxed_transformation_fallback():
    """Verify safe in-process transformation runner with 50ms bounds."""
    transformer = WasmPayloadTransformer()
    payload = {"event": "payment.received", "amount_dzd": 12000, "wilaya": 16}

    # Declarative rule mapping test
    rule_wasm = b'{"rename_keys": {"amount_dzd": "revenue_dzd"}, "add_metadata": {"currency": "DZD"}}'
    transformed, duration_ms, engine = transformer.execute_transform(
        wasm_bytes=rule_wasm,
        payload=payload,
        timeout_ms=50,
    )

    assert transformed["revenue_dzd"] == 12000
    assert transformed["currency"] == "DZD"
    assert duration_ms <= 50


# ─────────────────────────────────────────────────────────────────────────────
# 6. Advanced Resilience & Security Suites
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_api_key_rate_limiter_sliding_window():
    """Verify API key rate limiter enforces quotas and computes reset windows."""
    from app.core.api_key_rate_limiter import ApiKeyRateLimiter

    limiter = ApiKeyRateLimiter(default_limit=5)
    mock_redis = AsyncMock()

    # Sequence of increments: 1, 2, 3, 4, 5 (allowed), 6 (rejected)
    mock_redis.incr = AsyncMock(side_effect=[1, 2, 3, 4, 5, 6])
    mock_redis.expire = AsyncMock()

    with patch("app.core.api_key_rate_limiter.get_redis", return_value=mock_redis):
        # Calls 1-5 within limit
        for expected_count in range(1, 6):
            allowed, limit, remaining, reset_epoch = await limiter.check_rate_limit(
                key_id=99, limit=5
            )
            assert allowed is True
            assert limit == 5
            assert remaining == 5 - expected_count
            assert reset_epoch > int(time.time())

        # Call 6 exceeds limit
        allowed, limit, remaining, reset_epoch = await limiter.check_rate_limit(
            key_id=99, limit=5
        )
        assert allowed is False
        assert remaining == 0


def test_dual_secret_signature_verification_and_request_validator():
    """Verify Standard Webhooks dual-secret rotation and high-level request validator."""
    from app.core.webhook_crypto import (
        build_standard_headers,
        verify_standard_request,
    )

    primary_sec = generate_standard_secret()
    old_sec = generate_standard_secret()
    msg_id = "msg_test_rotation_8812"
    now_ts = int(time.time())
    payload_bytes = b'{"event":"milestone.delivered","contract_id":"ctr_77"}'

    # Outgoing headers signed with dual secrets during rotation window
    headers = build_standard_headers(
        msg_id=msg_id,
        timestamp=now_ts,
        payload_bytes=payload_bytes,
        secret=primary_sec,
        previous_secret=old_sec,
    )

    # 1. Verification succeeds using primary secret alone
    assert verify_standard_request(headers, payload_bytes, primary_sec) is True

    # 2. Verification succeeds using old secret alone (client hasn't updated yet)
    assert verify_standard_request(headers, payload_bytes, old_sec) is True

    # 3. Verification succeeds when passing both secrets as list
    assert (
        verify_standard_request(headers, payload_bytes, [primary_sec, old_sec]) is True
    )

    # 4. Fails with third unrecognized secret
    unrelated_sec = generate_standard_secret()
    assert verify_standard_request(headers, payload_bytes, unrelated_sec) is False


def test_execute_wasm_workflow_pipeline_simulation():
    """Verify execution of full visual DAG workflow with topological sort & Wasm transform."""
    from app.core.wasm_sandbox import execute_wasm_workflow_pipeline

    nodes = [
        {
            "id": "trigger_node",
            "type": "trigger",
            "name": "Contract Event",
            "trigger_type": "contract.created",
        },
        {
            "id": "wasm_step",
            "type": "action",
            "action_type": "wasm_transform",
            "name": "Tax Shield Formatter",
            "config": {
                "transformScript": '{"add_metadata": {"tax_shield_code": "ART_169_CIDTA"}}'
            },
        },
        {
            "id": "webhook_step",
            "type": "action",
            "action_type": "execute_webhook",
            "name": "Post to Merchant",
            "config": {"url": "https://api.merchant.dz/webhooks"},
        },
    ]

    edges = [
        {"id": "e1", "source": "trigger_node", "target": "wasm_step"},
        {"id": "e2", "source": "wasm_step", "target": "webhook_step"},
    ]

    initial_payload = {"contract_id": "ctr_990", "amount_dzd": 750000}

    # Linear DAG simulation
    result = execute_wasm_workflow_pipeline(nodes, edges, initial_payload)

    assert result["has_cycle"] is False
    assert result["topological_order"] == ["trigger_node", "wasm_step", "webhook_step"]
    assert "trigger_node" in result["step_results"]
    assert "wasm_step" in result["step_results"]
    assert "webhook_step" in result["step_results"]

    # Verify Wasm transformation output flowed into subsequent step
    final_output = result["step_results"]["webhook_step"]["output"]
    assert final_output["tax_shield_code"] == "ART_169_CIDTA"
    assert final_output["_standard_webhooks_v1"] is True

    # Cyclic DAG detection
    cyclic_edges = [
        {"id": "e1", "source": "trigger_node", "target": "wasm_step"},
        {"id": "e2", "source": "wasm_step", "target": "trigger_node"},
    ]
    cyclic_result = execute_wasm_workflow_pipeline(nodes, cyclic_edges, initial_payload)
    assert cyclic_result["has_cycle"] is True
    assert len(cyclic_result["topological_order"]) == 0


def test_webhook_circuit_breaker_trip_quarantines_to_dlq():
    """Verify that on 10th consecutive failure, circuit breaker trips to OPEN and immediately quarantines to DLQ."""
    from app.tasks.webhook_tasks import dispatch_webhook_async

    with (
        patch("app.tasks.webhook_tasks.prisma") as mock_prisma,
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_endpoint = MagicMock(
            id=102,
            userId=1,
            active=True,
            circuitState="CLOSED",
            failureCount=9,  # Next failure will reach threshold 10
            url="https://example.com/webhook",
            secret="whsec_dGVzdHNlY3JldDEyMzQ1Njc4OWFiY2RlZjEyMzQ1Ng==",
            previousSecret=None,
            transformActive=False,
            transformWasm=None,
        )
        mock_prisma.webhookendpoint.find_unique = AsyncMock(return_value=mock_endpoint)
        mock_prisma.webhookdelivery.create = AsyncMock()
        mock_prisma.webhookendpoint.update = AsyncMock()
        mock_prisma.webhookdeadletter.create = AsyncMock()

        mock_resp = MagicMock(status_code=500, text="Internal Server Error")
        mock_post.return_value = mock_resp

        res = dispatch_webhook_async(
            endpoint_id=102, payload={"event": "test"}, event_type="test.event"
        )

        assert res["status"] == "QUARANTINED_TO_DLQ"
        assert "Circuit breaker tripped to OPEN" in res["reason"]

        # Endpoint updated to OPEN state with failureCount = 10
        mock_prisma.webhookendpoint.update.assert_awaited_once()
        update_args = mock_prisma.webhookendpoint.update.call_args[1]
        assert update_args["data"]["circuitState"] == "OPEN"
        assert update_args["data"]["failureCount"] == 10

        # Quarantined in webhookdeadletter
        mock_prisma.webhookdeadletter.create.assert_awaited_once()


def test_wasm_memory_ceiling_enforcement():
    """Verify strict 16MB memory ceiling enforcement in Wasm sandbox."""
    from app.core.wasm_sandbox import SandboxExecutionError, WasmPayloadTransformer

    transformer = WasmPayloadTransformer()

    # Oversized Wasm binary (>16MB)
    oversized_wasm = b"x" * (16 * 1024 * 1024 + 1)
    with pytest.raises(SandboxExecutionError, match="exceeds 16MB"):
        transformer.execute_transform(
            wasm_bytes=oversized_wasm,
            payload={"test": "data"},
            timeout_ms=50,
        )

    # Oversized payload (>16MB)
    oversized_payload = {"huge": "a" * (16 * 1024 * 1024 + 1)}
    with pytest.raises(SandboxExecutionError, match="exceeds 16MB"):
        transformer.execute_transform(
            wasm_bytes=b'{"pick_keys": ["huge"]}',
            payload=oversized_payload,
            timeout_ms=50,
        )


def test_wasm_timeout_cutoff_enforcement():
    """Verify strict 50ms cycle cutoff halts long-running or infinite loops."""
    from app.core.wasm_sandbox import SandboxTimeoutError, WasmPayloadTransformer

    transformer = WasmPayloadTransformer()
    infinite_loop_wasm = b'{"infinite_loop": true}'

    with pytest.raises(SandboxTimeoutError, match="exceeded execution deadline"):
        transformer.execute_transform(
            wasm_bytes=infinite_loop_wasm,
            payload={"event": "loop.test"},
            timeout_ms=50,
        )
