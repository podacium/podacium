"""
Celery Async Worker Task Queue for Outbound Webhook Delivery conforming to Standard Webhooks Spec,
Exponential Backoff (10s, 60s, 15m, 1h, 6h) with Full Jitter, Circuit Breakers, and DLQ.
"""

from __future__ import annotations

import json
import logging
import random
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from celery import shared_task

from app.core.async_bridge import run_async_in_worker
from app.core.prisma import prisma
from app.core.webhook_crypto import build_standard_headers
from app.core.wasm_sandbox import WasmPayloadTransformer
from app.generated.prisma import Json

logger = logging.getLogger(__name__)

# Standard 5-tier exponential backoff progression (seconds): 10s, 60s, 15m, 1h, 6h
BACKOFF_DELAYS = [10, 60, 900, 3600, 21600]
CIRCUIT_BREAKER_THRESHOLD = 10
CIRCUIT_BREAKER_COOLDOWN_SECONDS = 1800  # 30 minutes

wasm_transformer = WasmPayloadTransformer()


def is_transient_failure(status_code: Optional[int]) -> bool:
    """Determine whether an HTTP status code is transient and eligible for retry."""
    if status_code is None:
        return True  # Network drops, DNS timeouts, connection resets
    if status_code in (408, 429):
        return True
    if 500 <= status_code <= 599:
        return True
    return False


async def _execute_webhook_delivery(
    task_instance: Any,
    endpoint_id: int,
    payload: Dict[str, Any],
    event_type: str,
    msg_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Internal async delivery execution running within persistent event loop."""
    if not msg_id:
        msg_id = f"msg_{uuid.uuid4().hex}"

    ep = await prisma.webhookendpoint.find_unique(where={"id": endpoint_id})
    if not ep or not ep.active:
        logger.info(
            f"Skipping webhook dispatch: endpoint {endpoint_id} inactive or missing"
        )
        return {"status": "SKIPPED", "reason": "ENDPOINT_INACTIVE"}

    now_utc = datetime.now(timezone.utc)

    # 1. Circuit Breaker Evaluation
    if ep.circuitState == "OPEN":
        last_failure_utc = None
        if ep.lastFailureAt:
            last_failure_utc = (
                ep.lastFailureAt
                if ep.lastFailureAt.tzinfo
                else ep.lastFailureAt.replace(tzinfo=timezone.utc)
            )

        elapsed = (
            (now_utc - last_failure_utc).total_seconds() if last_failure_utc else 0
        )

        if elapsed >= CIRCUIT_BREAKER_COOLDOWN_SECONDS:
            logger.info(
                f"Circuit cooldown elapsed ({elapsed:.0f}s) for endpoint {ep.id}. Promoting to HALF_OPEN probe."
            )
            await prisma.webhookendpoint.update(
                where={"id": ep.id},
                data={"circuitState": "HALF_OPEN"},
            )
        else:
            # Circuit still OPEN: Quarantine payload directly to Dead-Letter Queue
            logger.warning(
                f"Endpoint {ep.id} circuit breaker is OPEN. Quarantining event {msg_id} to DLQ."
            )
            await prisma.webhookdeadletter.create(
                data={
                    "webhookEndpointId": ep.id,
                    "eventType": event_type,
                    "payload": Json(payload),
                    "failureReason": f"Circuit breaker OPEN ({int(CIRCUIT_BREAKER_COOLDOWN_SECONDS - elapsed)}s remaining in cooldown)",
                    "retryCount": task_instance.request.retries,
                }
            )
            return {"status": "CIRCUIT_OPEN", "quarantined": True, "msg_id": msg_id}

    # 2. Optional Wasm Sandboxed Payload Transformation
    effective_payload = payload
    if getattr(ep, "transformActive", False) and getattr(ep, "transformWasm", None):
        try:
            transformed, duration_ms, engine = wasm_transformer.execute_transform(
                wasm_bytes=ep.transformWasm,
                payload=payload,
                timeout_ms=50,
            )
            effective_payload = transformed
            logger.info(
                f"Payload transformed via {engine} in {duration_ms}ms for endpoint {ep.id}"
            )
        except Exception as e:
            logger.warning(
                f"Transformation failed on endpoint {ep.id}: {e}. Proceeding with raw payload."
            )

    # 3. Standard Webhooks Headers & Cryptographic Signing
    timestamp = int(time.time())
    raw_payload_bytes = json.dumps(effective_payload, separators=(",", ":")).encode(
        "utf-8"
    )
    headers = build_standard_headers(
        msg_id=msg_id,
        timestamp=timestamp,
        payload_bytes=raw_payload_bytes,
        secret=ep.secret,
        previous_secret=ep.previousSecret,
    )

    status_str = "SUCCESS"
    status_code = None
    resp_body = None
    duration_ms = 0
    success = False
    start_time = time.time()

    # 4. Asynchronous HTTP Transmission (Non-blocking httpx)
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            res = await client.post(ep.url, content=raw_payload_bytes, headers=headers)
            duration_ms = int((time.time() - start_time) * 1000)
            status_code = res.status_code
            resp_body = res.text[:500]
            if 200 <= res.status_code < 300:
                success = True
            else:
                status_str = "FAILED"
    except Exception as exc:
        duration_ms = int((time.time() - start_time) * 1000)
        status_str = "FAILED"
        resp_body = f"Connection error: {str(exc)}"

    # 5. Record Delivery History
    await prisma.webhookdelivery.create(
        data={
            "webhookEndpointId": ep.id,
            "eventId": msg_id,
            "eventType": event_type,
            "payload": Json(effective_payload),
            "responseStatusCode": status_code,
            "responseBody": resp_body,
            "durationMs": duration_ms,
            "attemptNumber": task_instance.request.retries + 1,
            "status": status_str,
        }
    )

    # 6. Success Resolution & Circuit Breaker Reset
    if success:
        if ep.circuitState != "CLOSED" or ep.failureCount > 0:
            await prisma.webhookendpoint.update(
                where={"id": ep.id},
                data={"failureCount": 0, "circuitState": "CLOSED"},
            )
        return {"status": "SUCCESS", "status_code": status_code, "msg_id": msg_id}

    # 7. Failure Handling & Circuit Breaker Transition
    new_failures = ep.failureCount + 1
    tripped = new_failures >= CIRCUIT_BREAKER_THRESHOLD
    new_state = "OPEN" if tripped else ep.circuitState

    await prisma.webhookendpoint.update(
        where={"id": ep.id},
        data={
            "failureCount": new_failures,
            "circuitState": new_state,
            "lastFailureAt": now_utc,
        },
    )

    # 8. Retry Progression vs. Quarantine to DLQ
    can_retry = is_transient_failure(status_code)
    max_retries = len(BACKOFF_DELAYS)

    if tripped or not can_retry or task_instance.request.retries >= max_retries - 1:
        if tripped:
            reason = (
                f"Circuit breaker tripped to OPEN ({new_failures} consecutive failures). "
                f"Last error HTTP {status_code}: {resp_body}"
            )
        elif not can_retry:
            reason = f"Permanent error HTTP {status_code}: {resp_body}"
        else:
            reason = f"Max retries exhausted ({task_instance.request.retries + 1} attempts). Last error: {resp_body}"

        await prisma.webhookdeadletter.create(
            data={
                "webhookEndpointId": ep.id,
                "eventType": event_type,
                "payload": Json(effective_payload),
                "failureReason": reason,
                "retryCount": task_instance.request.retries + 1,
            }
        )
        logger.error(f"Webhook {msg_id} quarantined to DLQ. Reason: {reason}")
        return {"status": "QUARANTINED_TO_DLQ", "reason": reason, "msg_id": msg_id}

    # 9. Schedule Exponential Backoff with Full Randomized Jitter
    base_delay = BACKOFF_DELAYS[
        min(task_instance.request.retries, len(BACKOFF_DELAYS) - 1)
    ]
    jitter = random.uniform(0.85, 1.15)
    retry_delay = int(base_delay * jitter)
    logger.warning(
        f"Webhook {msg_id} failed (attempt {task_instance.request.retries + 1}/{max_retries}). "
        f"Retrying in {retry_delay}s (base {base_delay}s)."
    )
    raise task_instance.retry(exc=Exception(resp_body), countdown=retry_delay)


@shared_task(bind=True, max_retries=5, default_retry_delay=10)
def dispatch_webhook_async(
    self,
    endpoint_id: int,
    payload: Dict[str, Any],
    event_type: str,
    msg_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Dispatch webhook payload asynchronously with Standard Webhooks headers,
    exponential backoff & randomized jitter, safely bridging to persistent event loop.
    """
    return run_async_in_worker(
        _execute_webhook_delivery(self, endpoint_id, payload, event_type, msg_id=msg_id)
    )


@shared_task
def replay_dlq_batch_task(
    endpoint_id: int, dead_letter_ids: Optional[List[int]] = None
) -> Dict[str, Any]:
    """
    Replay quarantined Dead-Letter Queue events asynchronously back through dispatch queue.
    """

    async def _replay():
        query_where: Dict[str, Any] = {"webhookEndpointId": endpoint_id}
        if dead_letter_ids:
            query_where["id"] = {"in": dead_letter_ids}

        letters = await prisma.webhookdeadletter.find_many(
            where=query_where,
            take=100,
            order={"createdAt": "asc"},
        )

        replayed_count = 0
        for letter in letters:
            dispatch_webhook_async.delay(
                endpoint_id=letter.webhookEndpointId,
                payload=letter.payload,  # type: ignore[arg-type]
                event_type=letter.eventType,
            )
            await prisma.webhookdeadletter.delete(where={"id": letter.id})
            replayed_count += 1

        return {"status": "SUCCESS", "replayed": replayed_count}

    return run_async_in_worker(_replay())
