from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class WebhookEndpointCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(
        ..., min_length=1, max_length=100, description="Webhook endpoint name"
    )
    url: str = Field(..., description="Target HTTPS payload delivery URL")
    events: List[str] = Field(..., min_length=1, description="Subscribed event types")


class WebhookEndpointResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    user_id: int
    name: str
    url: str
    events: List[str]
    active: bool
    failure_count: int
    circuit_state: str = "CLOSED"
    created_at: datetime
    updated_at: datetime


class WebhookEndpointCreatedResponse(WebhookEndpointResponse):
    secret: str = Field(
        ..., description="Standard Webhooks HMAC signing secret (whsec_...)"
    )


class WebhookEndpointListResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    endpoints: List[WebhookEndpointResponse]


class WebhookDeliveryResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    webhook_endpoint_id: int
    event_id: str
    event_type: str
    payload: Dict[str, Any]
    response_status_code: Optional[int] = None
    response_body: Optional[str] = None
    duration_ms: Optional[int] = None
    attempt_number: int
    status: str
    delivered_at: datetime


class WebhookDeliveryListResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    deliveries: List[WebhookDeliveryResponse]


class WebhookTestRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    event_type: Optional[str] = "course.completed"


class WebhookDeadLetterResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    webhook_endpoint_id: int
    event_type: str
    payload: Dict[str, Any]
    failure_reason: str
    retry_count: int
    created_at: datetime


class WebhookReplayRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    dead_letter_ids: Optional[List[int]] = Field(
        None, description="Optional specific DLQ IDs to replay"
    )


class WebhookTestTransformRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    payload: Dict[str, Any] = Field(..., description="Sample payload to transform")
    wasm_base64: Optional[str] = Field(
        None, description="Base64-encoded Wasm binary or JSON transformation rule"
    )


class WebhookTestTransformResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    transformed_payload: Dict[str, Any]
    duration_ms: int
    engine: str


class WorkflowSimulateNode(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    type: str = Field(..., description="trigger | action | logic")
    name: Optional[str] = None
    action_type: Optional[str] = None
    trigger_type: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class WorkflowSimulateEdge(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    source: str
    target: str


class WorkflowSimulateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nodes: List[WorkflowSimulateNode]
    edges: List[WorkflowSimulateEdge]
    initial_payload: Optional[Dict[str, Any]] = None


class WorkflowSimulateResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    has_cycle: bool
    topological_order: List[str]
    step_results: Dict[str, Any]
    total_duration_ms: int
    logs: List[str]
