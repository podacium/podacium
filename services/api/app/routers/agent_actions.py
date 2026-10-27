"""
HITL Safety Gate Controller: Execution of Confirmed AI Agent Actions.
Endpoint: POST /api/v1/agent/execute-confirmed-action
"""

import asyncio
import hashlib
import hmac
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.token_counter import estimate_token_count
from app.agent.providers.factory import LLMProviderFactory
from app.agent.router.classifier import IntentClassifier
from app.agent.router.supervisor import AgentSupervisor
from app.agent.saga.orchestrator import AgentSagaOrchestrator
from app.agent.schemas import ChatCompletionRequest, ChatMessage, Role, ToolCall
from app.agent.security.pii_cleaner import AlgerianComplianceEngine
from app.agent.session.session_service import session_service
from app.agent.tools.base import ToolDomain
from app.agent.tools.registry import tool_registry
from app.core.auth import get_current_user, security_optional
from app.core.config import setting
from app.core.prisma import prisma
from app.core.redis import get_redis
from app.generated.prisma.enums import AiIntentStatus
from app.schemas.auth import UserResponse, UserRole
from app.services.support_knowledge import PODACIUM_GROUNDING_PROMPT, match_offline_faq

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/agent", tags=["Agent Actions"])


class ExecuteConfirmedActionRequest(BaseModel):
    intent_id: str = Field(description="UUID of the proposed AiActionIntent")
    token: str = Field(
        description="Cryptographic HMAC token authenticating the action confirmation"
    )
    idempotency_key: str = Field(
        description="Client idempotency key to prevent double-execution"
    )


class ExecuteConfirmedActionResponse(BaseModel):
    success: bool
    intent_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


def verify_action_token(
    intent_id: str,
    tool_name: str,
    user_id: int,
    token: str,
    args: Optional[Dict[str, Any]] = None,
) -> bool:
    if not token or "." not in token:
        return False
    try:
        expires_at_str, sig = token.split(".", 1)
        expires_at = int(expires_at_str)
    except (ValueError, AttributeError):
        return False

    if time.time() > expires_at:
        return False

    secret = getattr(setting, "SECRET_KEY", "podacium-agent-hitl-secret-2026").encode(
        "utf-8"
    )
    args_canonical = json.dumps(args or {}, sort_keys=True, default=str)
    args_digest = hashlib.sha256(args_canonical.encode("utf-8")).hexdigest()
    payload = f"{expires_at}:{user_id}:{intent_id}:{tool_name}:{args_digest}"
    expected = hmac.new(secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if hmac.compare_digest(sig, expected):
        return True

    return False


_IN_MEMORY_NONCES: Dict[str, Any] = {}


def _store_hitl_nonce_sync(intent_id: str, ttl_seconds: int = 300) -> None:
    _IN_MEMORY_NONCES[intent_id] = ("PENDING", time.time() + ttl_seconds)


def _consume_hitl_nonce_sync(intent_id: str) -> Optional[str]:
    item = _IN_MEMORY_NONCES.pop(intent_id, None)
    if not item:
        return None
    val, exp = item
    if time.time() > exp:
        return None
    return val


def generate_action_token(
    intent_id: str,
    tool_name: str,
    user_id: int,
    args: Optional[Dict[str, Any]] = None,
    expires_at: Optional[int] = None,
    ttl_seconds: int = 300,
) -> str:
    secret = getattr(setting, "SECRET_KEY", "podacium-agent-hitl-secret-2026").encode(
        "utf-8"
    )
    if expires_at is None:
        expires_at = int(time.time()) + ttl_seconds
    args_canonical = json.dumps(args or {}, sort_keys=True, default=str)
    args_digest = hashlib.sha256(args_canonical.encode("utf-8")).hexdigest()
    payload = f"{expires_at}:{user_id}:{intent_id}:{tool_name}:{args_digest}"
    sig = hmac.new(secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()

    # Pre-register single-use nonce
    _store_hitl_nonce_sync(intent_id, ttl_seconds)
    try:
        loop = asyncio.get_running_loop()
        if loop and loop.is_running():

            async def _init_nonce() -> None:
                r = await get_redis()
                if r:
                    await r.set(f"hitl:nonce:{intent_id}", "PENDING", ex=ttl_seconds)

            loop.create_task(_init_nonce())
    except (RuntimeError, Exception):
        pass

    return f"{expires_at}.{sig}"


def get_hitl_confirmation_message(tool_name: str, locale: str) -> str:
    loc = (locale or "fr").lower()
    if loc.startswith("ar"):
        return (
            f"هذه العملية ({tool_name}) ستقوم بتعديل البيانات أو حجز الموارد. "
            "تم إنشاء طلب تأكيد أدناه، يرجى مراجعة المعلمات وتأكيد الإجراء."
        )
    elif loc.startswith("en"):
        return (
            f"This operation ({tool_name}) modifies data or allocates resources. "
            "A confirmation request has been generated below. Please review the parameters and confirm the action."
        )
    elif loc.startswith("kab"):
        return (
            f"Tigawt-agi ({tool_name}) tbeddel isefka neɣ tseqdac tiɣbula. "
            "Asuter n usentem yettwaxdem ddaw-a. Ttxil-k ssenqed imsewlyen sakin sentez tigawt."
        )
    else:
        return (
            f"Cette opération ({tool_name}) modifie des données ou engage des ressources. "
            "Une demande de confirmation a été générée ci-dessous. Veuillez vérifier les paramètres et valider l'action."
        )


@router.post(
    "/execute-confirmed-action",
    response_model=ExecuteConfirmedActionResponse,
    summary="Execute a Human-in-the-Loop confirmed AI agent action",
)
async def execute_confirmed_action(
    req: ExecuteConfirmedActionRequest,
    current_user: UserResponse = Depends(get_current_user),
) -> ExecuteConfirmedActionResponse:
    redis = await get_redis()
    lock_key = f"lock:agent:action:{req.intent_id}"
    lock_token = str(uuid.uuid4())
    lock_acquired = False
    nonce_status: Optional[str] = None

    # 1. Distributed Lock / Idempotency Check & Atomic Single-Use Nonce Check
    if redis is not None:
        is_locked = await redis.set(lock_key, lock_token, nx=True, ex=30)
        if not is_locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Action confirmation is currently being processed or already executed.",
            )
        lock_acquired = True

        # Atomic single-use nonce check via GETDEL
        nonce_key = f"hitl:nonce:{req.intent_id}"
        try:
            raw_nonce_status = await redis.getdel(nonce_key)
        except Exception:
            lua_getdel = """
            local val = redis.call('get', KEYS[1])
            if val then redis.call('del', KEYS[1]) end
            return val
            """
            eval_call: Any = redis.eval(lua_getdel, 1, nonce_key)  # type: ignore[arg-type]
            if asyncio.iscoroutine(eval_call) or hasattr(eval_call, "__await__"):
                raw_nonce_status = await eval_call
            else:
                raw_nonce_status = eval_call

        if isinstance(raw_nonce_status, bytes):
            nonce_status = raw_nonce_status.decode("utf-8")
        else:
            nonce_status = raw_nonce_status
    else:
        # In-memory single-use nonce consumption when Redis is unconfigured
        nonce_status = _consume_hitl_nonce_sync(req.intent_id)

    if not nonce_status or nonce_status != "PENDING":
        try:
            from app.services.audit_trail_service import AuditTrailService

            await AuditTrailService.log_action(
                action="AGENT_HITL_REPLAY_BLOCKED",
                domain="SECURITY",
                resource_type="AiActionIntent",
                resource_id=req.intent_id,
                status="BLOCKED",
                severity="CRITICAL",
                actor_id=current_user.id,
                impersonator_id=getattr(current_user, "impersonator_id", None),
                metadata={
                    "reason": "Action token has already been executed or has expired",
                    "intent_id": req.intent_id,
                    "idempotency_key": req.idempotency_key,
                },
            )
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Action token has already been executed or has expired",
        )

    try:
        # 2. Fetch Proposed Intent
        intent = await prisma.aiactionintent.find_unique(where={"id": req.intent_id})
        tool_name = None
        payload_data = None
        intent_status_val = None
        intent_session_id = None
        intent_id = req.intent_id

        if not intent:
            redis = await get_redis()
            cached = await redis.get(f"ai_intent:{req.intent_id}") if redis else None
            if cached:
                c_dict = json.loads(cached)
                tool_name = c_dict.get("intentType")
                payload_data = c_dict.get("payload")
                intent_status_val = c_dict.get("status", "PROPOSED")
                intent_session_id = c_dict.get("sessionId")
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Action intent {req.intent_id} not found.",
                )
        else:
            tool_name = intent.intentType
            payload_data = intent.payload
            raw_status = getattr(intent, "status", None)
            intent_status_val = (
                raw_status.value
                if (raw_status is not None and hasattr(raw_status, "value"))
                else str(raw_status)
            )
            intent_session_id = intent.sessionId

        is_proposed = (
            intent_status_val in ("PROPOSED", "AiIntentStatus.PROPOSED")
            or getattr(intent, "status", None) == AiIntentStatus.PROPOSED
        )
        if not is_proposed:
            is_executed = (
                intent_status_val in ("EXECUTED", "AiIntentStatus.EXECUTED")
                or getattr(intent, "status", None) == AiIntentStatus.EXECUTED
            )
            rejection_reason = (
                getattr(intent, "rejectionReason", None) if intent else None
            )
            error_detail = (
                rejection_reason
                or f"Action intent is already in status {intent_status_val}"
            )
            return ExecuteConfirmedActionResponse(
                success=is_executed,
                intent_id=intent_id,
                status=str(intent_status_val),
                error=error_detail,
            )

        # 3. Parse Proposed Arguments for Verification and Execution
        payload_data = intent.payload if intent else payload_data
        payload_dict: Dict[str, Any] = {}
        if isinstance(payload_data, str):
            try:
                payload_dict = json.loads(payload_data)
            except Exception:
                payload_dict = {}
        elif isinstance(payload_data, dict):
            payload_dict = payload_data

        # 4. Cryptographic Token Verification (HMAC + Expiration + Argument Tamper Protection)
        if not tool_name or not verify_action_token(
            intent_id, tool_name, current_user.id, req.token, args=payload_dict
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or forged action confirmation token signature.",
            )

        # 5. Resolve Tool
        tool = tool_registry.get_tool(tool_name)
        if not tool:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target tool '{tool_name}' not registered in tool catalog.",
            )

        # 6. Build Zero-Trust Security Context
        context = AgentSecurityContext.from_user(
            current_user,
            session_id=intent_session_id or "default_session",
            request_origin="hitl_confirmation",
        )

        # 7. Post-LLM Detokenization of PII before tool invocation
        detokenized_payload = await AlgerianComplianceEngine.post_llm_detokenize(
            payload_dict, intent_session_id or context.session_id
        )

        # 8. Execute Tool via tool.call with __hitl_approved__ flag
        raw_call_args = dict(detokenized_payload)
        raw_call_args["__hitl_approved__"] = True
        result = await tool.call(raw_call_args, context)
        now_dt = datetime.now(timezone.utc)

        if result.success:
            if intent:
                await prisma.aiactionintent.update(
                    where={"id": intent.id},
                    data={
                        "status": AiIntentStatus.EXECUTED,
                        "confirmedByUserId": current_user.id,
                        "confirmedAt": now_dt,
                        "executedAt": now_dt,
                    },
                )
            elif redis:
                try:
                    await redis.setex(
                        f"ai_intent:{intent_id}",
                        300,
                        json.dumps(
                            {
                                "id": intent_id,
                                "sessionId": intent_session_id,
                                "intentType": tool_name,
                                "payload": payload_dict,
                                "status": "EXECUTED",
                                "confirmedByUserId": current_user.id,
                                "executedAt": now_dt.isoformat(),
                            }
                        ),
                    )
                except Exception:
                    pass

            # Record executed action in AuditTrailService with impersonator_id and intent ID
            try:
                from app.services.audit_trail_service import AuditTrailService

                await AuditTrailService.log_action(
                    action=f"AGENT_HITL_ACTION_{tool_name.upper()}",
                    domain="SYSTEM",
                    resource_type="AiActionIntent",
                    resource_id=intent_id,
                    status="SUCCESS",
                    severity="INFO",
                    actor_id=current_user.id,
                    impersonator_id=getattr(current_user, "impersonator_id", None),
                    session_id=intent_session_id,
                    metadata={
                        "tool_name": tool_name,
                        "intent_id": intent_id,
                        "idempotency_key": req.idempotency_key,
                        "execution_success": True,
                    },
                )
            except Exception as audit_err:
                logger.warning(
                    f"Failed to record audit trail for intent {intent_id}: {audit_err}"
                )

            return ExecuteConfirmedActionResponse(
                success=True,
                intent_id=intent_id,
                status="EXECUTED",
                result=result.data
                if isinstance(result.data, dict)
                else {"data": result.data},
            )
        else:
            if intent:
                await prisma.aiactionintent.update(
                    where={"id": intent.id},
                    data={
                        "status": AiIntentStatus.REJECTED,
                        "confirmedByUserId": current_user.id,
                        "confirmedAt": now_dt,
                        "rejectionReason": result.error,
                    },
                )
            elif redis:
                try:
                    await redis.setex(
                        f"ai_intent:{intent_id}",
                        300,
                        json.dumps(
                            {
                                "id": intent_id,
                                "sessionId": intent_session_id,
                                "intentType": tool_name,
                                "payload": payload_dict,
                                "status": "REJECTED",
                                "rejectionReason": result.error,
                            }
                        ),
                    )
                except Exception:
                    pass
            return ExecuteConfirmedActionResponse(
                success=False,
                intent_id=intent_id,
                status="FAILED",
                error=result.error,
            )

    finally:
        if redis is not None and lock_acquired:
            # Atomic release using Lua script to prevent lock stealing
            release_lua = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
            """
            try:
                await redis.eval(release_lua, 1, lock_key, lock_token)  # type: ignore[misc,arg-type]
            except Exception as e:
                logger.warning(f"Failed to safely release Redis lock {lock_key}: {e}")


@router.post(
    "/actions/confirm",
    response_model=ExecuteConfirmedActionResponse,
    summary="Confirm and execute an action (Alias for /execute-confirmed-action)",
)
async def confirm_action_alias(
    req: ExecuteConfirmedActionRequest,
    current_user: UserResponse = Depends(get_current_user),
) -> ExecuteConfirmedActionResponse:
    return await execute_confirmed_action(req=req, current_user=current_user)


async def get_agent_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
) -> Optional[Any]:
    """Extract authenticated user if present and valid; otherwise gracefully return None."""
    if not credentials and not (
        request
        and (
            request.cookies.get("__Host-access_token")
            or request.cookies.get("access_token")
        )
    ):
        return None
    try:
        return await get_current_user(request, credentials=credentials)
    except Exception:
        return None


class AgentChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="User question, command, or instruction",
    )
    session_id: Optional[str] = Field(
        default=None, description="Active persistent AiSession ID (UUID)"
    )
    locale: str = Field(
        default="fr",
        max_length=10,
        description="Active UI locale ('fr', 'ar', 'en', 'kab')",
    )


class AgentChatResponse(BaseModel):
    session_id: str
    reply: str
    domain: str
    tools_executed: List[str] = Field(default_factory=list)
    action_confirmation: Optional[Dict[str, Any]] = None
    widgets: List[Dict[str, Any]] = Field(default_factory=list)
    engine: str = "agent_supervisor"


async def _run_agent_turn(
    message: str,
    locale: str,
    session_id: Optional[str],
    current_user: Optional[Any],
) -> Dict[str, Any]:
    raw_message = message.strip()
    if not raw_message:
        return {
            "session_id": session_id or "new_session",
            "reply": "Veuillez poser une question pour que je puisse vous aider.",
            "domain": "CORE",
            "tools_executed": [],
            "action_confirmation": None,
            "widgets": [],
            "engine": "offline_knowledge",
        }

    user_id = getattr(current_user, "id", 0) if current_user else 0
    user_role = (
        getattr(current_user, "role", UserRole.STUDENT)
        if current_user
        else UserRole.STUDENT
    )
    org_id = (
        getattr(current_user, "primaryOrganizationId", None) if current_user else None
    )

    # 1. Session Lifecycle (L1 Cache <1ms, L2 Postgres <5ms)
    session = await session_service.get_or_create_session(
        user_id=user_id,
        agent_type="GENERAL_ASSISTANT",
        session_id=session_id,
        organization_id=org_id,
    )
    active_session_id = str(session.id)
    lock_token = await session_service.acquire_session_lock(active_session_id)

    try:
        # 2. Pre-LLM Boundary: Law 18-07 / 25-11 PII redaction & tokenization
        clean_message, _ = await AlgerianComplianceEngine.pre_llm_redact(
            raw_message, active_session_id
        )

        # Append user turn to session history
        await session_service.append_turn(
            session_id=active_session_id,
            role="user",
            content=clean_message,
            token_count=estimate_token_count(clean_message),
        )

        # 3. Build Zero-Trust IoC Security Context
        context = AgentSecurityContext.from_user(
            current_user,
            session_id=active_session_id,
            request_origin="agent_chat",
        )

        # 4. Intent Classification with Conversational History Context
        active_ctx = await session_service.get_active_context(active_session_id)
        recent_msgs = active_ctx.get("messages", [])
        recent_history_text = " ".join(
            [m.get("content", "") for m in recent_msgs[-3:] if m.get("content")]
        )
        classification = IntentClassifier.classify(clean_message)
        if (
            classification.primary_domain == ToolDomain.CORE
            or classification.confidence <= 0.65
        ) and recent_history_text:
            contextual_classification = IntentClassifier.classify(
                f"{recent_history_text} {clean_message}"
            )
            if contextual_classification.primary_domain != ToolDomain.CORE:
                classification = contextual_classification

        primary_domain = classification.primary_domain

        # 5. Domain-Scoped Tool Planning via AgentSupervisor (Prefix Caching Preservation)
        supervisor = AgentSupervisor()
        planned_tools = supervisor.plan_tools(
            query=f"{recent_history_text} {clean_message}".strip(),
            context=context,
            max_tools=8,
        )
        tool_definitions = [t.get_openai_schema() for t in planned_tools]

        # 6. Build Grounded System Instructions
        lang_name = (
            "Français"
            if locale == "fr"
            else "العربية (Darija)"
            if locale == "ar"
            else "English"
        )
        user_name = (
            getattr(current_user, "fullName", "Utilisateur")
            if current_user
            else "Visiteur Anonyme"
        )
        role_label = user_role.value if hasattr(user_role, "value") else str(user_role)
        system_text = (
            f"{PODACIUM_GROUNDING_PROMPT}\n\n"
            f"Caller Identity: {user_name} (Role: {role_label}).\n"
            f"Active Domain: {primary_domain.value}.\n"
            f"User Locale: {locale} ({lang_name}).\n"
            f"CRITICAL INSTRUCTIONS:\n"
            f"1. You MUST respond in the user's language/locale ({lang_name}). If the user writes in Arabic, respond fluently and naturally in Arabic or Algerian Darija.\n"
            f"2. When the user asks to enroll in, register for, or join a course, invoke the 'enroll_course' tool so that the user can confirm their enrollment. Never say you cannot enroll them if the 'enroll_course' tool is available.\n"
            f"3. Always invoke available tools when the user's intent requires retrieving data, calculating metrics, or proposing actions.\n"
            f"4. Synthesize tool results into clear, concise, and helpful natural language responses."
        )

        # 7. Build Conversation Context
        chat_messages: List[ChatMessage] = [
            ChatMessage(role=Role.SYSTEM, content=system_text)
        ]
        if active_ctx.get("summaryState"):
            chat_messages.append(
                ChatMessage(
                    role=Role.SYSTEM,
                    content=f"Contexte antérieur résumé: {active_ctx['summaryState']}",
                )
            )

        for m in active_ctx.get("messages", []):
            m_role = (
                Role.USER if m["role"].lower() in ("user", "human") else Role.ASSISTANT
            )
            chat_messages.append(ChatMessage(role=m_role, content=m["content"]))

        # 8. Obtain LLM Provider
        provider = None
        try:
            provider = LLMProviderFactory.get_provider()
        except Exception as prov_err:
            logger.warning(
                f"Provider initialization failed ({prov_err}). Falling back to offline knowledge base."
            )

        if not provider:
            offline_matched = match_offline_faq(clean_message, locale) or {
                "reply": "Je suis l'assistant Podacium. Pour explorer nos cours, formations ou services freelance, n'hésitez pas à me solliciter.",
                "category": primary_domain.value,
            }
            reply_text = offline_matched["reply"]
            await session_service.append_turn(
                session_id=active_session_id,
                role="assistant",
                content=reply_text,
                token_count=estimate_token_count(reply_text),
                model="offline_knowledge",
            )
            return {
                "session_id": active_session_id,
                "reply": reply_text,
                "domain": primary_domain.value,
                "tools_executed": [],
                "action_confirmation": None,
                "widgets": [],
                "engine": "offline_knowledge",
            }

        # 9. Multi-Turn Tool Execution Loop (up to 5 turns)
        tools_executed: List[str] = []
        widgets: List[Dict[str, Any]] = []
        action_confirmation: Optional[Dict[str, Any]] = None
        final_reply = ""
        called_signatures: set = set()
        saga = AgentSagaOrchestrator(saga_id=f"saga_{active_session_id[:8]}")

        for _ in range(5):
            req_completion = ChatCompletionRequest(
                messages=chat_messages,
                tools=tool_definitions if tool_definitions else None,
                temperature=0.2,
                max_tokens=1024,
            )
            try:
                resp = await provider.complete(req_completion)
            except Exception as e:
                logger.error(f"LLM provider completion failed ({e})", exc_info=True)
                if tools_executed or widgets:
                    if locale == "ar":
                        final_reply = f"تم استرجاع النتائج بنجاح للعمليات: {', '.join(tools_executed)}."
                    elif locale == "en":
                        final_reply = f"Here are the retrieved results for: {', '.join(tools_executed)}."
                    else:
                        final_reply = f"Voici les résultats obtenus pour : {', '.join(tools_executed)}."
                else:
                    offline_matched = match_offline_faq(clean_message, locale) or {
                        "reply": "أنا مساعد بوداسيوم الذكي، يسعدني مساعدتك في استكشاف الدورات والمسارات والخدمات."
                        if locale == "ar"
                        else "Je suis l'assistant Podacium. Pour explorer nos cours, formations ou services freelance, n'hésitez pas à me solliciter.",
                        "category": primary_domain.value,
                    }
                    final_reply = offline_matched["reply"]
                break

            assistant_turn = resp.message

            # If no tool calls, model gave final synthesized answer
            if not assistant_turn.tool_calls:
                final_reply = assistant_turn.content or ""
                break

            # Model requested tool calls
            chat_messages.append(assistant_turn)
            has_hitl_halt = False

            for tc in assistant_turn.tool_calls:
                t_name = tc.function.name
                t_args = tc.function.arguments or {}

                # Cycle detection guard
                sig = f"{t_name}:{json.dumps(t_args, sort_keys=True, default=str)}"
                if sig in called_signatures:
                    logger.warning(
                        f"Cycle detected for tool {t_name} with args {t_args}. Halting tool recursion."
                    )
                    chat_messages.append(
                        ChatMessage(
                            role=Role.TOOL,
                            content=json.dumps(
                                {
                                    "status": "error",
                                    "error": f"Tool '{t_name}' was already invoked with identical arguments in this turn. Please conclude and synthesize your response to the user.",
                                }
                            ),
                            name=t_name,
                            tool_call_id=tc.id,
                        )
                    )
                    continue
                called_signatures.add(sig)

                tool = tool_registry.get_tool(t_name)

                if not tool:
                    err_payload = json.dumps(
                        {"status": "error", "error": f"Tool '{t_name}' not found."}
                    )
                    chat_messages.append(
                        ChatMessage(
                            role=Role.TOOL,
                            content=err_payload,
                            name=t_name,
                            tool_call_id=tc.id,
                        )
                    )
                    continue

                # HITL Safety Gate Check
                if tool.requires_hitl:
                    # Run pre-flight dry-run simulation first
                    sim_result = await tool.simulate(t_args, context)
                    if not sim_result.success:
                        tools_executed.append(tool.name)
                        if sim_result.widget_payload:
                            widgets.append(sim_result.widget_payload)
                        chat_messages.append(
                            ChatMessage(
                                role=Role.TOOL,
                                content=sim_result.to_agent_message(),
                                name=tool.name,
                                tool_call_id=tc.id,
                            )
                        )
                        continue

                    intent_id = f"intent_{uuid.uuid4().hex}"
                    intent = None
                    if not active_session_id.startswith("anon_"):
                        try:
                            intent = await prisma.aiactionintent.create(
                                data={
                                    "session": {"connect": {"id": active_session_id}},
                                    "intentType": t_name,
                                    "payload": json.dumps(t_args),
                                    "status": AiIntentStatus.PROPOSED,
                                    "riskScore": 0.85 if tool.is_mutating else 0.5,
                                }
                            )
                            intent_id = intent.id
                        except Exception as e:
                            logger.warning(
                                f"Failed to persist action intent to DB: {e}"
                            )

                    if not intent:
                        redis = await get_redis()
                        if redis:
                            try:
                                await redis.setex(
                                    f"ai_intent:{intent_id}",
                                    300,
                                    json.dumps(
                                        {
                                            "id": intent_id,
                                            "sessionId": active_session_id,
                                            "intentType": t_name,
                                            "payload": t_args,
                                            "status": "PROPOSED",
                                        }
                                    ),
                                )
                            except Exception as e:
                                logger.warning(
                                    f"Failed to cache action intent in Redis: {e}"
                                )

                    redis = await get_redis()
                    if redis:
                        try:
                            await redis.set(
                                f"hitl:nonce:{intent_id}", "PENDING", ex=300
                            )
                        except Exception as e:
                            logger.warning(f"Failed to set hitl nonce in Redis: {e}")

                    expires_at_unix = int(time.time()) + 300
                    token = generate_action_token(
                        intent_id=intent_id,
                        tool_name=tool.name,
                        user_id=user_id,
                        args=t_args,
                        expires_at=expires_at_unix,
                    )
                    sim_preview = (
                        sim_result.data.get("preview")
                        if (sim_result and isinstance(sim_result.data, dict))
                        else None
                    )
                    previous_params = (
                        sim_result.data.get("previous")
                        if (sim_result and isinstance(sim_result.data, dict))
                        else {}
                    )
                    parameter_diff = {
                        k: {
                            "proposed": v,
                            "previous": previous_params.get(k)
                            if isinstance(previous_params, dict)
                            else None,
                        }
                        for k, v in t_args.items()
                    }
                    action_confirmation = {
                        "widgetType": "action_confirmation_card",
                        "intent_id": intent_id,
                        "token": token,
                        "tool_name": tool.name,
                        "parameters": t_args,
                        "prepared_params": t_args,
                        "parameter_diff": parameter_diff,
                        "description": tool.description,
                        "summary": sim_preview or tool.description,
                        "is_mutating": tool.is_mutating,
                        "risk_score": 0.85 if tool.is_mutating else 0.5,
                        "expires_at_unix": expires_at_unix,
                    }
                    final_reply = get_hitl_confirmation_message(tool.name, locale)
                    has_hitl_halt = True
                    break

                # Autonomous Execution with Zero-Trust Detokenization
                detok_args = await AlgerianComplianceEngine.post_llm_detokenize(
                    t_args, active_session_id
                )
                tool_res = await supervisor.execute_tool(
                    tool_name=tool.name,
                    raw_args=detok_args,
                    context=context,
                    saga=saga if tool.is_mutating else None,
                )
                tools_executed.append(tool.name)
                if tool_res.widget_payload:
                    widgets.append(tool_res.widget_payload)

                chat_messages.append(
                    ChatMessage(
                        role=Role.TOOL,
                        content=tool_res.to_agent_message(),
                        name=tool.name,
                        tool_call_id=tc.id,
                    )
                )

            if has_hitl_halt:
                break

        if not final_reply:
            if tools_executed:
                final_reply = f"L'opération s'est terminée avec succès. Outils exécutés : {', '.join(tools_executed)}."
            else:
                final_reply = "Traitement terminé avec succès."

        # 10. Persist Assistant Response in Session L1 + L2
        await session_service.append_turn(
            session_id=active_session_id,
            role="assistant",
            content=final_reply,
            token_count=estimate_token_count(final_reply),
            model=provider.model_name,
        )
        await session_service.compact_context_if_needed(active_session_id)

        return {
            "session_id": active_session_id,
            "reply": final_reply,
            "domain": primary_domain.value,
            "tools_executed": tools_executed,
            "action_confirmation": action_confirmation,
            "widgets": widgets,
            "engine": "agent_supervisor",
        }

    finally:
        if lock_token:
            await session_service.release_session_lock(active_session_id, lock_token)


async def _stream_agent_turn(
    message: str,
    locale: str,
    session_id: Optional[str],
    current_user: Optional[Any],
) -> AsyncGenerator[str, None]:
    overall_start = time.monotonic()
    raw_message = message.strip()
    if not raw_message:
        reply_text = "Veuillez poser une question pour que je puisse vous aider."
        for w in reply_text.split(" "):
            yield f"data: {json.dumps({'token': w + ' '})}\n\n"
        done_payload = {
            "done": True,
            "session_id": session_id or "new_session",
            "domain": "CORE",
            "tools_executed": [],
            "engine": "offline_knowledge",
        }
        yield f"data: {json.dumps(done_payload)}\n\n"
        return

    user_id = getattr(current_user, "id", 0) if current_user else 0
    user_role = (
        getattr(current_user, "role", UserRole.STUDENT)
        if current_user
        else UserRole.STUDENT
    )
    org_id = (
        getattr(current_user, "primaryOrganizationId", None) if current_user else None
    )

    # 1. Session Lifecycle
    t0 = time.monotonic()
    session = await session_service.get_or_create_session(
        user_id=user_id,
        agent_type="GENERAL_ASSISTANT",
        session_id=session_id,
        organization_id=org_id,
    )
    active_session_id = str(session.id)
    lock_token = await session_service.acquire_session_lock(active_session_id)
    logger.info(
        f"[AgentStream] session+lock took {time.monotonic()-t0:.2f}s",
        extra={"request_id": getattr(current_user, "request_id", "unknown")},
    )

    try:
        # 2. Pre-LLM Boundary: PII redaction
        t1 = time.monotonic()
        clean_message, _ = await AlgerianComplianceEngine.pre_llm_redact(
            raw_message, active_session_id
        )
        logger.info(
            f"[AgentStream] PII redaction took {time.monotonic()-t1:.2f}s",
            extra={"request_id": getattr(current_user, "request_id", "unknown")},
        )

        await session_service.append_turn(
            session_id=active_session_id,
            role="user",
            content=clean_message,
            token_count=estimate_token_count(clean_message),
        )

        # 3. Security Context
        context = AgentSecurityContext.from_user(
            current_user,
            session_id=active_session_id,
            request_origin="agent_chat",
        )

        # 4. Intent Classification with Conversational History Context
        t2 = time.monotonic()
        active_ctx = await session_service.get_active_context(active_session_id)
        recent_msgs = active_ctx.get("messages", [])
        recent_history_text = " ".join(
            [m.get("content", "") for m in recent_msgs[-3:] if m.get("content")]
        )
        classification = IntentClassifier.classify(clean_message)
        if (
            classification.primary_domain == ToolDomain.CORE
            or classification.confidence <= 0.65
        ) and recent_history_text:
            contextual_classification = IntentClassifier.classify(
                f"{recent_history_text} {clean_message}"
            )
            if contextual_classification.primary_domain != ToolDomain.CORE:
                classification = contextual_classification

        primary_domain = classification.primary_domain
        logger.info(
            f"[AgentStream] classification+context took {time.monotonic()-t2:.2f}s",
            extra={"request_id": getattr(current_user, "request_id", "unknown")},
        )

        # 5. Domain-Scoped Tool Planning
        supervisor = AgentSupervisor()
        planned_tools = supervisor.plan_tools(
            query=f"{recent_history_text} {clean_message}".strip(),
            context=context,
            max_tools=8,
        )
        tool_definitions = [t.get_openai_schema() for t in planned_tools]

        # 6. System Instructions
        lang_name = (
            "Français"
            if locale == "fr"
            else "العربية (Darija)"
            if locale == "ar"
            else "English"
        )
        user_name = (
            getattr(current_user, "fullName", "Utilisateur")
            if current_user
            else "Visiteur Anonyme"
        )
        role_label = user_role.value if hasattr(user_role, "value") else str(user_role)
        system_text = (
            f"{PODACIUM_GROUNDING_PROMPT}\n\n"
            f"Caller Identity: {user_name} (Role: {role_label}).\n"
            f"Active Domain: {primary_domain.value}.\n"
            f"User Locale: {locale} ({lang_name}).\n"
            f"CRITICAL INSTRUCTIONS:\n"
            f"1. You MUST respond in the user's language/locale ({lang_name}). If the user writes in Arabic, respond fluently and naturally in Arabic or Algerian Darija.\n"
            f"2. When the user asks to enroll in, register for, or join a course, invoke the 'enroll_course' tool so that the user can confirm their enrollment. Never say you cannot enroll them if the 'enroll_course' tool is available.\n"
            f"3. Always invoke available tools when the user's intent requires retrieving data, calculating metrics, or proposing actions.\n"
            f"4. Synthesize tool results into clear, concise, and helpful natural language responses."
        )

        # 7. Conversation Context
        chat_messages: List[ChatMessage] = [
            ChatMessage(role=Role.SYSTEM, content=system_text)
        ]
        if active_ctx.get("summaryState"):
            chat_messages.append(
                ChatMessage(
                    role=Role.SYSTEM,
                    content=f"Contexte antérieur résumé: {active_ctx['summaryState']}",
                )
            )

        for m in active_ctx.get("messages", []):
            m_role = (
                Role.USER if m["role"].lower() in ("user", "human") else Role.ASSISTANT
            )
            chat_messages.append(ChatMessage(role=m_role, content=m["content"]))

        # 8. Obtain LLM Provider
        provider = None
        try:
            provider = LLMProviderFactory.get_provider()
        except Exception as prov_err:
            logger.warning(
                f"Provider initialization failed ({prov_err}). Falling back to offline knowledge base."
            )

        if not provider:
            offline_matched = match_offline_faq(clean_message, locale) or {
                "reply": "Je suis l'assistant Podacium. Pour explorer nos cours, formations ou services freelance, n'hésitez pas à me solliciter.",
                "category": primary_domain.value,
            }
            reply_text = offline_matched["reply"]
            await session_service.append_turn(
                session_id=active_session_id,
                role="assistant",
                content=reply_text,
                token_count=estimate_token_count(reply_text),
                model="offline_knowledge",
            )
            for w in reply_text.split(" "):
                yield f"data: {json.dumps({'token': w + ' '})}\n\n"
            done_payload = {
                "done": True,
                "session_id": active_session_id,
                "domain": primary_domain.value,
                "tools_executed": [],
                "engine": "offline_knowledge",
            }
            yield f"data: {json.dumps(done_payload)}\n\n"
            return

        # 9. Multi-Turn Tool Execution & Streaming Loop
        tools_executed: List[str] = []
        widgets: List[Dict[str, Any]] = []
        action_confirmation: Optional[Dict[str, Any]] = None
        final_reply = ""
        called_signatures: set = set()
        saga = AgentSagaOrchestrator(saga_id=f"saga_{active_session_id[:8]}")

        for turn_idx in range(5):
            req_completion = ChatCompletionRequest(
                messages=chat_messages,
                tools=tool_definitions if tool_definitions else None,
                temperature=0.2,
                max_tokens=1024,
            )

            # Try streaming from provider if available
            streamed_chunks = []
            stream_success = False
            try:
                if hasattr(provider, "stream") and callable(provider.stream):
                    stream_iter = provider.stream(req_completion)
                    if hasattr(stream_iter, "__aiter__"):
                        t_stream = time.monotonic()
                        async for chunk in stream_iter:
                            streamed_chunks.append(chunk)
                            if chunk.delta_content:
                                final_reply += chunk.delta_content
                                yield f"data: {json.dumps({'token': chunk.delta_content})}\n\n"
                        logger.info(
                            f"[AgentStream] turn {turn_idx} streaming took {time.monotonic()-t_stream:.2f}s, chunks={len(streamed_chunks)}",
                            extra={
                                "request_id": getattr(
                                    current_user, "request_id", "unknown"
                                )
                            },
                        )
                        stream_success = len(streamed_chunks) > 0
            except Exception as stream_err:
                logger.warning(
                    f"LLM streaming failed ({stream_err}), falling back to completion."
                )
                stream_success = False

            if not stream_success:
                t_complete = time.monotonic()
                try:
                    resp = await provider.complete(req_completion)
                    logger.info(
                        f"[AgentStream] turn {turn_idx} completion took {time.monotonic()-t_complete:.2f}s",
                        extra={
                            "request_id": getattr(current_user, "request_id", "unknown")
                        },
                    )
                except Exception as e:
                    logger.error(f"LLM provider completion failed ({e})", exc_info=True)
                    if tools_executed or widgets:
                        if locale == "ar":
                            final_reply = f"تم استرجاع النتائج بنجاح للعمليات: {', '.join(tools_executed)}."
                        elif locale == "en":
                            final_reply = f"Here are the retrieved results for: {', '.join(tools_executed)}."
                        else:
                            final_reply = f"Voici les résultats obtenus pour : {', '.join(tools_executed)}."
                    else:
                        offline_matched = match_offline_faq(clean_message, locale) or {
                            "reply": "أنا مساعد بوداسيوم الذكي، يسعدني مساعدتك في استكشاف الدورات والمسارات والخدمات."
                            if locale == "ar"
                            else "Je suis l'assistant Podacium. Pour explorer nos cours, formations ou services freelance, n'hésitez pas à me solliciter.",
                            "category": primary_domain.value,
                        }
                        final_reply = offline_matched["reply"]
                    for w in final_reply.split(" "):
                        yield f"data: {json.dumps({'token': w + ' '})}\n\n"
                    break

                assistant_turn = resp.message

                # If no tool calls, model gave final synthesized answer -> stream tokens out
                if not assistant_turn.tool_calls:
                    final_reply = assistant_turn.content or ""
                    words = final_reply.split(" ")
                    for idx, w in enumerate(words):
                        token = w + (" " if idx < len(words) - 1 else "")
                        yield f"data: {json.dumps({'token': token})}\n\n"
                    break

                # Model requested tool calls
                chat_messages.append(assistant_turn)
                tool_calls_to_run = assistant_turn.tool_calls
            else:
                # Reconstruct tool calls if any from streamed chunks
                accumulated_tool_calls: List[ToolCall] = []
                accumulated_raw_parts: List[Dict[str, Any]] = []
                for c in streamed_chunks:
                    if c.delta_tool_calls:
                        accumulated_tool_calls.extend(c.delta_tool_calls)
                    if c.raw_parts:
                        accumulated_raw_parts.extend(c.raw_parts)

                if not accumulated_tool_calls:
                    # Successfully streamed final text tokens directly to client!
                    break

                chat_messages.append(
                    ChatMessage(
                        role=Role.ASSISTANT,
                        content=final_reply if final_reply else None,
                        tool_calls=accumulated_tool_calls,
                        raw_parts=accumulated_raw_parts
                        if accumulated_raw_parts
                        else None,
                    )
                )
                tool_calls_to_run = accumulated_tool_calls

            has_hitl_halt = False
            for tc in tool_calls_to_run:
                t_name = tc.function.name
                t_args = tc.function.arguments or {}

                sig = f"{t_name}:{json.dumps(t_args, sort_keys=True, default=str)}"
                if sig in called_signatures:
                    logger.warning(
                        f"Cycle detected for tool {t_name}. Halting recursion."
                    )
                    chat_messages.append(
                        ChatMessage(
                            role=Role.TOOL,
                            content=json.dumps(
                                {
                                    "status": "error",
                                    "error": f"Tool '{t_name}' was already invoked with identical arguments.",
                                }
                            ),
                            name=t_name,
                            tool_call_id=tc.id,
                        )
                    )
                    continue
                called_signatures.add(sig)

                tool = tool_registry.get_tool(t_name)
                if not tool:
                    chat_messages.append(
                        ChatMessage(
                            role=Role.TOOL,
                            content=json.dumps(
                                {
                                    "status": "error",
                                    "error": f"Tool '{t_name}' not found.",
                                }
                            ),
                            name=t_name,
                            tool_call_id=tc.id,
                        )
                    )
                    continue

                if tool.requires_hitl:
                    # Run pre-flight dry-run simulation first
                    sim_result = await tool.simulate(t_args, context)
                    if not sim_result.success:
                        tools_executed.append(tool.name)
                        if sim_result.widget_payload:
                            yield f"data: {json.dumps({'widget': sim_result.widget_payload})}\n\n"
                        chat_messages.append(
                            ChatMessage(
                                role=Role.TOOL,
                                content=sim_result.to_agent_message(),
                                name=tool.name,
                                tool_call_id=tc.id,
                            )
                        )
                        continue

                    intent_id = f"intent_{uuid.uuid4().hex}"
                    intent = None
                    if not active_session_id.startswith("anon_"):
                        try:
                            intent = await prisma.aiactionintent.create(
                                data={
                                    "session": {"connect": {"id": active_session_id}},
                                    "intentType": t_name,
                                    "payload": json.dumps(t_args),
                                    "status": AiIntentStatus.PROPOSED,
                                    "riskScore": 0.85 if tool.is_mutating else 0.5,
                                }
                            )
                            intent_id = intent.id
                        except Exception as e:
                            logger.warning(
                                f"Failed to persist action intent to DB: {e}"
                            )

                    if not intent:
                        redis = await get_redis()
                        if redis:
                            try:
                                await redis.setex(
                                    f"ai_intent:{intent_id}",
                                    300,
                                    json.dumps(
                                        {
                                            "id": intent_id,
                                            "sessionId": active_session_id,
                                            "intentType": t_name,
                                            "payload": t_args,
                                            "status": "PROPOSED",
                                        }
                                    ),
                                )
                            except Exception as e:
                                logger.warning(f"Failed to cache action intent: {e}")

                    redis = await get_redis()
                    if redis:
                        try:
                            await redis.set(
                                f"hitl:nonce:{intent_id}", "PENDING", ex=300
                            )
                        except Exception as e:
                            logger.warning(f"Failed to set hitl nonce in Redis: {e}")

                    expires_at_unix = int(time.time()) + 300
                    token = generate_action_token(
                        intent_id=intent_id,
                        tool_name=tool.name,
                        user_id=user_id,
                        args=t_args,
                        expires_at=expires_at_unix,
                    )
                    sim_preview = (
                        sim_result.data.get("preview")
                        if (sim_result and isinstance(sim_result.data, dict))
                        else None
                    )
                    previous_params = (
                        sim_result.data.get("previous")
                        if (sim_result and isinstance(sim_result.data, dict))
                        else {}
                    )
                    parameter_diff = {
                        k: {
                            "proposed": v,
                            "previous": previous_params.get(k)
                            if isinstance(previous_params, dict)
                            else None,
                        }
                        for k, v in t_args.items()
                    }
                    action_confirmation = {
                        "widgetType": "action_confirmation_card",
                        "intent_id": intent_id,
                        "token": token,
                        "tool_name": tool.name,
                        "parameters": t_args,
                        "prepared_params": t_args,
                        "parameter_diff": parameter_diff,
                        "description": tool.description,
                        "summary": sim_preview or tool.description,
                        "is_mutating": tool.is_mutating,
                        "risk_score": 0.85 if tool.is_mutating else 0.5,
                        "expires_at_unix": expires_at_unix,
                    }
                    yield f"data: {json.dumps({'action_confirmation': action_confirmation})}\n\n"
                    final_reply = get_hitl_confirmation_message(tool.name, locale)
                    for w in final_reply.split(" "):
                        yield f"data: {json.dumps({'token': w + ' '})}\n\n"
                    has_hitl_halt = True
                    break

                # Autonomous tool execution
                detok_args = await AlgerianComplianceEngine.post_llm_detokenize(
                    t_args, active_session_id
                )
                yield f"data: {json.dumps({'tool_call': {'name': tool.name}})}\n\n"
                t_tool = time.monotonic()
                tool_res = await supervisor.execute_tool(
                    tool_name=tool.name,
                    raw_args=detok_args,
                    context=context,
                    saga=saga if tool.is_mutating else None,
                )
                logger.info(
                    f"[AgentStream] turn {turn_idx} tool {tool.name} took {time.monotonic()-t_tool:.2f}s",
                    extra={
                        "request_id": getattr(current_user, "request_id", "unknown")
                    },
                )
                tools_executed.append(tool.name)
                if tool_res.widget_payload:
                    widgets.append(tool_res.widget_payload)
                    yield f"data: {json.dumps({'widget': tool_res.widget_payload})}\n\n"

                chat_messages.append(
                    ChatMessage(
                        role=Role.TOOL,
                        content=tool_res.to_agent_message(),
                        name=tool.name,
                        tool_call_id=tc.id,
                    )
                )

            if has_hitl_halt:
                break

        if not final_reply:
            if tools_executed:
                final_reply = f"L'opération s'est terminée avec succès. Outils exécutés : {', '.join(tools_executed)}."
            else:
                final_reply = "Traitement terminé avec succès."
            for w in final_reply.split(" "):
                yield f"data: {json.dumps({'token': w + ' '})}\n\n"

        # 10. Persist Assistant Response in Session
        t_persist = time.monotonic()
        await session_service.append_turn(
            session_id=active_session_id,
            role="assistant",
            content=final_reply,
            token_count=estimate_token_count(final_reply),
            model=getattr(provider, "model_name", "agent_supervisor"),
        )
        await session_service.compact_context_if_needed(active_session_id)
        logger.info(
            f"[AgentStream] persist took {time.monotonic()-t_persist:.2f}s",
            extra={"request_id": getattr(current_user, "request_id", "unknown")},
        )

        done_payload = {
            "done": True,
            "session_id": active_session_id,
            "domain": primary_domain.value,
            "tools_executed": tools_executed,
            "engine": "agent_supervisor",
        }
        yield f"data: {json.dumps(done_payload)}\n\n"

        logger.info(
            f"[AgentStream] TOTAL turn took {time.monotonic()-overall_start:.2f}s",
            extra={"request_id": getattr(current_user, "request_id", "unknown")},
        )

    finally:
        if lock_token:
            await session_service.release_session_lock(active_session_id, lock_token)


@router.post(
    "/chat",
    response_model=AgentChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Multi-Turn Agentic Chat across EdTech, Freelancing, BI & FinTech",
)
async def chat_with_agent(
    req: AgentChatRequest,
    current_user: Optional[Any] = Depends(get_agent_user_optional),
) -> AgentChatResponse:
    clean_msg = req.message.strip()
    if not clean_msg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty",
        )

    res = await _run_agent_turn(
        message=clean_msg,
        locale=req.locale,
        session_id=req.session_id,
        current_user=current_user,
    )
    return AgentChatResponse(**res)


@router.post(
    "/chat/stream",
    status_code=status.HTTP_200_OK,
    summary="Stream Multi-Turn Agentic Chat Response with Widgets and HITL (SSE)",
)
async def stream_chat_with_agent(
    req: AgentChatRequest,
    current_user: Optional[Any] = Depends(get_agent_user_optional),
) -> StreamingResponse:
    clean_msg = req.message.strip()
    if not clean_msg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty",
        )

    return StreamingResponse(
        _stream_agent_turn(
            message=clean_msg,
            locale=req.locale,
            session_id=req.session_id,
            current_user=current_user,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


class RollbackSagaRequest(BaseModel):
    token_id: str = Field(description="UUID of the RollbackToken")


@router.post(
    "/saga/rollback",
    status_code=status.HTTP_200_OK,
    summary="1-Click Atomic Compensating Transaction Rollback via RollbackToken",
)
async def rollback_saga_action(
    req: RollbackSagaRequest,
    current_user: Optional[Any] = Depends(get_agent_user_optional),
) -> Dict[str, Any]:
    context = AgentSecurityContext.from_user(
        user=current_user,
        session_id="rollback-session",
        request_origin="api_rollback",
    )
    result = await AgentSagaOrchestrator.rollback_by_token(
        token_id=req.token_id,
        context=context,
    )
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Rollback failed"),
        )
    return result
