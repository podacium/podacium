from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from app.core.prisma import prisma
from app.core.wasm_sandbox import WasmPayloadTransformer
from app.core.webhook_crypto import build_standard_headers, generate_standard_secret
from app.generated.prisma import Json
from app.schemas.webhooks import (
    WebhookDeliveryListResponse,
    WebhookDeliveryResponse,
    WebhookEndpointCreate,
    WebhookEndpointCreatedResponse,
    WebhookEndpointListResponse,
    WebhookEndpointResponse,
)

logger = logging.getLogger(__name__)

wasm_transformer = WasmPayloadTransformer()


class WebhookService:
    def __init__(self) -> None:
        self.db = prisma

    def _verify_bank_signature(
        self, body: bytes, signature: str, secret: str, gateway: str = "SATIM"
    ) -> bool:
        """
        Verify Algerian bank gateway webhook signature using HMAC-SHA256.
        All Algerian bank gateways (SATIM, CIB, Edahabia) use HMAC-SHA256
        signature verification with the webhook secret as the key.
        """
        if not signature or not secret:
            logger.warning(
                f"Missing signature or secret for {gateway} webhook verification"
            )
            return False

        try:
            expected_hex = hmac.new(
                secret.encode("utf-8"), body, hashlib.sha256
            ).hexdigest()
            if hmac.compare_digest(expected_hex, signature):
                return True

            expected_b64 = base64.b64encode(
                hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
            ).decode("ascii")
            if hmac.compare_digest(expected_b64, signature):
                return True

            logger.warning(f"Signature mismatch for {gateway} webhook")
            return False
        except Exception as e:
            logger.error(f"Bank signature verification failed for {gateway}: {e}")
            return False

    async def create_webhook_endpoint(
        self, user_id: int, request: WebhookEndpointCreate
    ) -> WebhookEndpointCreatedResponse:
        """Register a new outbound webhook endpoint with a Standard Webhooks secret."""
        signing_secret = generate_standard_secret()
        record = await self.db.webhookendpoint.create(
            data={
                "userId": user_id,
                "name": request.name,
                "url": str(request.url),
                "secret": signing_secret,
                "events": request.events,
                "active": True,
            }
        )
        return WebhookEndpointCreatedResponse(
            id=record.id,
            user_id=record.userId,
            name=record.name,
            url=record.url,
            events=record.events,
            active=record.active,
            failure_count=record.failureCount,
            circuit_state=record.circuitState,
            created_at=record.createdAt,
            updated_at=record.updatedAt,
            secret=signing_secret,
        )

    async def list_webhook_endpoints(self, user_id: int) -> WebhookEndpointListResponse:
        """List registered webhooks for a user."""
        records = await self.db.webhookendpoint.find_many(
            where={"userId": user_id},
            order={"createdAt": "desc"},
        )
        endpoints = [
            WebhookEndpointResponse(
                id=r.id,
                user_id=r.userId,
                name=r.name,
                url=r.url,
                events=r.events,
                active=r.active,
                failure_count=r.failureCount,
                circuit_state=r.circuitState,
                created_at=r.createdAt,
                updated_at=r.updatedAt,
            )
            for r in records
        ]
        return WebhookEndpointListResponse(endpoints=endpoints)

    async def delete_webhook_endpoint(self, user_id: int, endpoint_id: int) -> bool:
        """Delete a webhook endpoint and its delivery logs."""
        try:
            ep = await self.db.webhookendpoint.find_unique(where={"id": endpoint_id})
            if not ep or ep.userId != user_id:
                return False

            await self.db.webhookendpoint.delete(where={"id": endpoint_id})
            return True
        except Exception as e:
            logger.error(f"Error deleting webhook endpoint {endpoint_id}: {e}")
            return False

    async def list_deliveries(
        self, user_id: int, endpoint_id: int
    ) -> WebhookDeliveryListResponse:
        """List delivery history for a webhook endpoint."""
        ep = await self.db.webhookendpoint.find_unique(where={"id": endpoint_id})
        if not ep or ep.userId != user_id:
            return WebhookDeliveryListResponse(deliveries=[])

        records = await self.db.webhookdelivery.find_many(
            where={"webhookEndpointId": endpoint_id},
            order={"deliveredAt": "desc"},
            take=50,
        )

        deliveries = []
        for r in records:
            payload_dict = r.payload if isinstance(r.payload, dict) else {}
            deliveries.append(
                WebhookDeliveryResponse(
                    id=r.id,
                    webhook_endpoint_id=r.webhookEndpointId,
                    event_id=r.eventId,
                    event_type=r.eventType,
                    payload=payload_dict,
                    response_status_code=r.responseStatusCode,
                    response_body=r.responseBody,
                    duration_ms=r.durationMs,
                    attempt_number=r.attemptNumber,
                    status=r.status,
                    delivered_at=r.deliveredAt,
                )
            )
        return WebhookDeliveryListResponse(deliveries=deliveries)

    async def trigger_test_webhook(
        self, user_id: int, endpoint_id: int, event_type: str = "course.completed"
    ) -> Optional[WebhookDeliveryResponse]:
        """Dispatch an instant test webhook payload conforming to Standard Webhooks spec."""
        ep = await self.db.webhookendpoint.find_unique(where={"id": endpoint_id})
        if not ep or ep.userId != user_id:
            return None

        event_id = f"msg_{uuid.uuid4().hex}"
        timestamp = int(time.time())

        sample_payloads = {
            "course.completed": {
                "event": "course.completed",
                "student_id": user_id,
                "course_id": 104,
                "course_name": "Advanced Time-Series Forecasting & BI",
                "certificate_hash": f"cert_{uuid.uuid4().hex[:12]}",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
            "contract.milestone_paid": {
                "event": "contract.milestone_paid",
                "contract_id": 4091,
                "milestone_id": 2,
                "amount_dzd": 45000.00,
                "freelancer_id": user_id,
                "paid_at": datetime.now(timezone.utc).isoformat(),
            },
            "dataset.ingested": {
                "event": "dataset.ingested",
                "dataset_id": "ds_8812",
                "rows_added": 1250,
                "total_rows": 45200,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        }

        payload_body = sample_payloads.get(
            event_type, sample_payloads["course.completed"]
        )
        raw_body = json.dumps(payload_body, separators=(",", ":")).encode("utf-8")

        headers = build_standard_headers(
            msg_id=event_id,
            timestamp=timestamp,
            payload_bytes=raw_body,
            secret=ep.secret,
            previous_secret=ep.previousSecret,
        )

        status_str = "SUCCESS"
        status_code = None
        resp_body = None
        duration_ms = 0

        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                res = await client.post(ep.url, content=raw_body, headers=headers)
                duration_ms = int((time.time() - start_time) * 1000)
                status_code = res.status_code
                resp_body = res.text[:500]
                if res.status_code >= 400:
                    status_str = "FAILED"
        except Exception as err:
            duration_ms = int((time.time() - start_time) * 1000)
            status_str = "FAILED"
            resp_body = f"Delivery connection error: {str(err)}"

        delivery_rec = await self.db.webhookdelivery.create(
            data={
                "webhookEndpointId": ep.id,
                "eventId": event_id,
                "eventType": event_type,
                "payload": Json(payload_body),
                "responseStatusCode": status_code,
                "responseBody": resp_body,
                "durationMs": duration_ms,
                "attemptNumber": 1,
                "status": status_str,
            }
        )

        return WebhookDeliveryResponse(
            id=delivery_rec.id,
            webhook_endpoint_id=delivery_rec.webhookEndpointId,
            event_id=delivery_rec.eventId,
            event_type=delivery_rec.eventType,
            payload=payload_body,
            response_status_code=delivery_rec.responseStatusCode,
            response_body=delivery_rec.responseBody,
            duration_ms=delivery_rec.durationMs,
            attempt_number=delivery_rec.attemptNumber,
            status=delivery_rec.status,
            delivered_at=delivery_rec.deliveredAt,
        )

    async def rotate_signing_secret(
        self, user_id: int, endpoint_id: int
    ) -> Optional[str]:
        """Zero-downtime secret rotation by moving current secret to previousSecret."""
        ep = await self.db.webhookendpoint.find_first(
            where={"id": endpoint_id, "userId": user_id}
        )
        if not ep:
            return None

        new_secret = generate_standard_secret()
        await self.db.webhookendpoint.update(
            where={"id": endpoint_id},
            data={
                "previousSecret": ep.secret,
                "secret": new_secret,
            },
        )
        return new_secret

    async def list_dead_letters(self, user_id: int, endpoint_id: int) -> List[Any]:
        """List dead letter quarantined webhook deliveries for an endpoint."""
        ep = await self.db.webhookendpoint.find_first(
            where={"id": endpoint_id, "userId": user_id}
        )
        if not ep:
            return []
        records = await self.db.webhookdeadletter.find_many(
            where={"webhookEndpointId": endpoint_id},
            order={"createdAt": "desc"},
        )
        return records

    async def reset_circuit_breaker(self, user_id: int, endpoint_id: int) -> bool:
        """Reset open circuit breaker state back to CLOSED."""
        ep = await self.db.webhookendpoint.find_first(
            where={"id": endpoint_id, "userId": user_id}
        )
        if not ep:
            return False
        await self.db.webhookendpoint.update(
            where={"id": endpoint_id},
            data={"circuitState": "CLOSED", "failureCount": 0},
        )
        return True

    async def resend_delivery(
        self, user_id: int, delivery_id: int
    ) -> WebhookDeliveryResponse:
        """Re-trigger delivery of a historical webhook event payload."""
        deliv = await self.db.webhookdelivery.find_unique(
            where={"id": delivery_id},
            include={"endpoint": True},
        )
        if not deliv or deliv.endpoint.userId != user_id:
            raise ValueError("Delivery record not found")

        # Re-dispatch payload preserving original eventType
        ep = deliv.endpoint
        event_id = f"msg_{uuid.uuid4().hex}"
        timestamp = int(time.time())

        payload_dict = deliv.payload if isinstance(deliv.payload, dict) else {}
        raw_body = json.dumps(payload_dict, separators=(",", ":")).encode("utf-8")

        headers = build_standard_headers(
            msg_id=event_id,
            timestamp=timestamp,
            payload_bytes=raw_body,
            secret=ep.secret,
            previous_secret=ep.previousSecret,
        )

        status_str = "SUCCESS"
        status_code = None
        resp_body = None
        duration_ms = 0
        start_time = time.time()

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                res = await client.post(ep.url, content=raw_body, headers=headers)
                duration_ms = int((time.time() - start_time) * 1000)
                status_code = res.status_code
                resp_body = res.text[:500]
                if res.status_code >= 400:
                    status_str = "FAILED"
        except Exception as err:
            duration_ms = int((time.time() - start_time) * 1000)
            status_str = "FAILED"
            resp_body = f"Delivery connection error: {str(err)}"

        new_deliv = await self.db.webhookdelivery.create(
            data={
                "webhookEndpointId": ep.id,
                "eventId": event_id,
                "eventType": deliv.eventType,
                "payload": Json(payload_dict),
                "responseStatusCode": status_code,
                "responseBody": resp_body,
                "durationMs": duration_ms,
                "attemptNumber": 1,
                "status": status_str,
            }
        )

        return WebhookDeliveryResponse(
            id=new_deliv.id,
            webhook_endpoint_id=new_deliv.webhookEndpointId,
            event_id=new_deliv.eventId,
            event_type=new_deliv.eventType,
            payload=payload_dict,
            response_status_code=new_deliv.responseStatusCode,
            response_body=new_deliv.responseBody,
            duration_ms=new_deliv.durationMs,
            attempt_number=new_deliv.attemptNumber,
            status=new_deliv.status,
            delivered_at=new_deliv.deliveredAt,
        )

    async def replay_dead_letters(
        self, user_id: int, endpoint_id: int, letter_ids: Optional[List[int]] = None
    ) -> str:
        """Trigger asynchronous replay of Dead-Letter Queue payloads."""
        ep = await self.db.webhookendpoint.find_first(
            where={"id": endpoint_id, "userId": user_id}
        )
        if not ep:
            raise ValueError("Endpoint not found")

        # Automatically reset circuit if it was OPEN
        if ep.circuitState == "OPEN":
            await self.reset_circuit_breaker(user_id, endpoint_id)

        from app.tasks.webhook_tasks import replay_dlq_batch_task

        task = replay_dlq_batch_task.delay(endpoint_id, letter_ids)
        return str(task.id)

    async def test_transformation(
        self, payload: Dict[str, Any], wasm_base64: Optional[str] = None
    ) -> Dict[str, Any]:
        """Test Wasm/JSON payload transformation within isolated 50ms sandbox."""
        if not wasm_base64:
            return {
                "transformed_payload": payload,
                "duration_ms": 0,
                "engine": "identity_passthrough",
            }

        try:
            wasm_bytes = base64.b64decode(wasm_base64)
        except Exception:
            wasm_bytes = wasm_base64.encode("utf-8")

        transformed, duration_ms, engine = wasm_transformer.execute_transform(
            wasm_bytes=wasm_bytes,
            payload=payload,
            timeout_ms=50,
        )

        return {
            "transformed_payload": transformed,
            "duration_ms": duration_ms,
            "engine": engine,
        }


webhook_service = WebhookService()
