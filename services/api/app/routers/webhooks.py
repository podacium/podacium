from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.schemas.webhooks import (
    WebhookEndpointCreate,
    WebhookEndpointCreatedResponse,
    WebhookEndpointListResponse,
    WebhookDeliveryListResponse,
    WebhookDeliveryResponse,
    WebhookTestRequest,
    WebhookReplayRequest,
    WebhookTestTransformRequest,
    WebhookTestTransformResponse,
    WorkflowSimulateRequest,
    WorkflowSimulateResponse,
)
from app.services.webhook_service import webhook_service
from app.core.wasm_sandbox import execute_wasm_workflow_pipeline

router = APIRouter(prefix="/dev-webhooks", tags=["Developer Webhooks"])


@router.post("", response_model=WebhookEndpointCreatedResponse, status_code=201)
async def create_webhook(
    request: WebhookEndpointCreate, current_user=Depends(get_current_user)
):
    """Register a new outbound webhook endpoint with HMAC secret."""
    return await webhook_service.create_webhook_endpoint(current_user.id, request)


@router.get("", response_model=WebhookEndpointListResponse)
async def list_webhooks(current_user=Depends(get_current_user)):
    """List registered webhooks for current user."""
    return await webhook_service.list_webhook_endpoints(current_user.id)


@router.delete("/{endpoint_id}")
async def delete_webhook(endpoint_id: int, current_user=Depends(get_current_user)):
    """Delete a webhook endpoint and delivery logs."""
    success = await webhook_service.delete_webhook_endpoint(
        current_user.id, endpoint_id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook endpoint not found",
        )
    return {"success": True, "message": "Webhook endpoint deleted"}


@router.get("/{endpoint_id}/deliveries", response_model=WebhookDeliveryListResponse)
async def list_webhook_deliveries(
    endpoint_id: int, current_user=Depends(get_current_user)
):
    """List historical delivery attempts for a webhook endpoint."""
    return await webhook_service.list_deliveries(current_user.id, endpoint_id)


@router.post("/{endpoint_id}/test", response_model=WebhookDeliveryResponse)
async def test_webhook_delivery(
    endpoint_id: int,
    body: Optional[WebhookTestRequest] = None,
    current_user=Depends(get_current_user),
):
    """Dispatch a test webhook payload to verify HMAC signature delivery."""
    evt_type = body.event_type if body and body.event_type else "course.completed"
    res = await webhook_service.trigger_test_webhook(
        current_user.id, endpoint_id, evt_type
    )
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook endpoint not found",
        )
    return res


@router.post("/{endpoint_id}/reset-circuit")
async def reset_circuit(endpoint_id: int, current_user=Depends(get_current_user)):
    """Reset open circuit breaker state back to CLOSED."""
    res = await webhook_service.reset_circuit_breaker(current_user.id, endpoint_id)
    if not res:
        raise HTTPException(status_code=404, detail="Webhook endpoint not found")
    return {"status": "ok", "circuit_state": "CLOSED"}


@router.post("/deliveries/{delivery_id}/resend", response_model=WebhookDeliveryResponse)
async def resend_delivery(delivery_id: int, current_user=Depends(get_current_user)):
    """Re-trigger delivery of a historical webhook event payload."""
    try:
        return await webhook_service.resend_delivery(current_user.id, delivery_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{endpoint_id}/rotate-secret")
async def rotate_secret(endpoint_id: int, current_user=Depends(get_current_user)):
    """Zero-downtime secret rotation by moving current secret to previousSecret."""
    new_secret = await webhook_service.rotate_signing_secret(
        current_user.id, endpoint_id
    )
    if not new_secret:
        raise HTTPException(status_code=404, detail="Webhook endpoint not found")
    return {"status": "ok", "new_secret": new_secret}


@router.get("/{endpoint_id}/dead-letters")
async def get_dead_letters(endpoint_id: int, current_user=Depends(get_current_user)):
    """List dead letter quarantined webhook events."""
    dead_letters = await webhook_service.list_dead_letters(current_user.id, endpoint_id)
    return {"dead_letters": dead_letters}


@router.post("/{endpoint_id}/dead-letters/replay")
async def replay_dead_letters(
    endpoint_id: int,
    body: Optional[WebhookReplayRequest] = None,
    current_user=Depends(get_current_user),
):
    """Replay quarantined dead-letter payloads back into the Celery dispatch task queue."""
    letter_ids = body.dead_letter_ids if body else None
    try:
        task_id = await webhook_service.replay_dead_letters(
            current_user.id, endpoint_id, letter_ids
        )
        return {
            "status": "ok",
            "task_id": str(task_id),
            "message": "DLQ replay dispatched",
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/test-transform", response_model=WebhookTestTransformResponse)
async def test_wasm_transform(
    body: WebhookTestTransformRequest,
    current_user=Depends(get_current_user),
):
    """Execute a test Wasm or JSON transformation script within isolated 50ms sandbox."""
    res = await webhook_service.test_transformation(
        payload=body.payload,
        wasm_base64=body.wasm_base64,
    )
    return WebhookTestTransformResponse(
        transformed_payload=res["transformed_payload"],
        duration_ms=res["duration_ms"],
        engine=res["engine"],
    )


@router.post("/workflows/simulate", response_model=WorkflowSimulateResponse)
async def simulate_workflow_pipeline(
    body: WorkflowSimulateRequest,
    current_user=Depends(get_current_user),
):
    """
    Simulate and dry-run a full multi-step visual DAG workflow with topological sort
    and sandboxed Wasm / Extism payload transformations.
    """
    nodes_dicts = [n.model_dump() for n in body.nodes]
    edges_dicts = [e.model_dump() for e in body.edges]

    result = execute_wasm_workflow_pipeline(
        nodes=nodes_dicts,
        edges=edges_dicts,
        initial_payload=body.initial_payload,
    )

    return WorkflowSimulateResponse(
        has_cycle=result["has_cycle"],
        topological_order=result["topological_order"],
        step_results=result["step_results"],
        total_duration_ms=result["total_duration_ms"],
        logs=result["logs"],
    )
