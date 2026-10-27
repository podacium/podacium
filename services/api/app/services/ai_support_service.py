"""
Podacium AI Support Assistant Service.

Handles multi-turn grounded conversations with Google Gemini 2.5 Flash,
including native Gemini Function Calling (Tools) for live course search,
freelance project search, user learning progress, active contracts, and support tickets.
Provides graceful fallback to the grounded offline rule-based knowledge engine.
"""

import asyncio
import json
import logging
import re
from typing import List, Dict, Optional, AsyncGenerator, Any
import httpx

from app.core.config import setting
from app.core.prisma import prisma
from app.services.support_knowledge import PODACIUM_GROUNDING_PROMPT, match_offline_faq
from app.agent.schemas import ToolDefinition
from app.agent.providers.normalizer import ToolSchemaNormalizer
from app.agent.session.session_service import session_service
from app.agent.token_counter import estimate_token_count

logger = logging.getLogger(__name__)


# =============================================================================
# 1. PII Sanitization (ANPDP Law 18-07 / 25-11 Compliance)
# =============================================================================


def sanitize_pii(text: str) -> str:
    """
    Sanitize sensitive user data before transmission.
    Redacts credit card PANs, CVVs, Algerian phone numbers, and CCP/RIP numbers.
    """
    if not text:
        return ""
    # 16-digit card numbers (EDAHABIA / CIB)
    sanitized = re.sub(r"\b(?:\d[ -]*?){16}\b", "[CARTE_MASQUÉE]", text)
    # 3-digit CVV / CVC
    sanitized = re.sub(
        r"\bcvv\s*[:=]?\s*\d{3}\b", "CVV:[MASQUÉ]", sanitized, flags=re.IGNORECASE
    )
    # Algerian phone numbers (05/06/07 + 8 digits, or +213)
    sanitized = re.sub(r"(?:\b0|\+213)[567]\d{8}\b", "[TÉLÉPHONE_MASQUÉ]", sanitized)
    # CCP / RIP numbers
    sanitized = re.sub(
        r"\b(?:ccp|rip)\s*[:=]?\s*\d{6,20}\b",
        "[CCP_MASQUÉ]",
        sanitized,
        flags=re.IGNORECASE,
    )
    return sanitized


# =============================================================================
# 2. Tool Declarations (Google Gemini Function Calling Schema)
# =============================================================================

GEMINI_TOOLS = [
    {
        "name": "search_courses",
        "description": "Search the public course and module catalog in Podacium by keyword, category, or difficulty level.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {
                    "type": "STRING",
                    "description": "Topic or keyword (e.g. 'Python', 'Full Stack', 'Data Science').",
                },
                "level": {
                    "type": "STRING",
                    "enum": ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
                    "description": "Difficulty level of the course.",
                },
            },
        },
    },
    {
        "name": "search_learning_paths",
        "description": "Search curated career learning paths and professional specialization curricula on Podacium (e.g. Full-Stack Developer, Data Scientist, Machine Learning Engineer).",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {
                    "type": "STRING",
                    "description": "Topic or specialization keyword (e.g. 'Web', 'Data', 'DevOps').",
                },
            },
        },
    },
    {
        "name": "search_freelance_projects",
        "description": "Search open freelance projects and RFPs on Podacium Hub by keyword, required skill, or budget.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {
                    "type": "STRING",
                    "description": "Keyword to match in project title or scope (e.g. 'React', 'Mobile App', 'Design').",
                },
                "budget_min": {
                    "type": "INTEGER",
                    "description": "Minimum budget threshold in Algerian Dinars (DZD).",
                },
            },
        },
    },
    {
        "name": "get_my_learning_progress",
        "description": "Fetch the authenticated user's active course enrollments, completion percentage, and certificates.",
        "parameters": {
            "type": "OBJECT",
            "properties": {},
        },
    },
    {
        "name": "get_my_freelance_contracts",
        "description": "Retrieve freelance contracts for the authenticated user, including milestone deliverables and statuses.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "status": {
                    "type": "STRING",
                    "enum": [
                        "DRAFT",
                        "ACTIVE",
                        "SUBMITTED",
                        "COMPLETED",
                        "DISPUTED",
                        "CANCELLED",
                    ],
                    "description": "Filter by contract status.",
                },
            },
        },
    },
    {
        "name": "get_my_tickets",
        "description": "List customer support tickets submitted by the authenticated user with their current status and priority.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "status": {
                    "type": "STRING",
                    "enum": ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
                    "description": "Filter by ticket status.",
                },
            },
        },
    },
    {
        "name": "create_support_ticket",
        "description": "Open a formal customer support or dispute ticket on behalf of the user when an issue requires human staff intervention.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "subject": {
                    "type": "STRING",
                    "description": "Summary of the issue (min 5 characters).",
                },
                "category": {
                    "type": "STRING",
                    "enum": ["GENERAL", "BILLING", "TECHNICAL", "ACCOUNT", "DISPUTE"],
                    "description": "Department category.",
                },
                "description": {
                    "type": "STRING",
                    "description": "Detailed explanation of the issue or error.",
                },
                "priority": {
                    "type": "STRING",
                    "enum": ["LOW", "NORMAL", "HIGH", "URGENT"],
                    "description": "Severity level (default: NORMAL).",
                },
            },
            "required": ["subject", "category", "description"],
        },
    },
]

SUPPORT_TOOL_DEFINITIONS: List[ToolDefinition] = [
    ToolSchemaNormalizer.from_gemini_declaration(tool) for tool in GEMINI_TOOLS
]


# =============================================================================
# 3. Tool Execution Engine (Safe Scoped Data Access)
# =============================================================================


async def execute_tool(
    name: str, args: Dict[str, Any], current_user: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Safely execute a tool query on behalf of the user.
    Strictly isolates PII, password hashes, tokens, and other users' records.
    """
    try:
        if name == "search_courses":
            query = args.get("query", "").strip()
            level = args.get("level")
            where: Dict[str, Any] = {"status": "PUBLISHED", "deletedAt": None}
            if query:
                where["OR"] = [
                    {"title": {"contains": query, "mode": "insensitive"}},
                    {"description": {"contains": query, "mode": "insensitive"}},
                ]
            if level:
                where["level"] = level.upper()

            modules = await prisma.module.find_many(
                where=where,
                take=5,
                order={"createdAt": "desc"},
            )
            return {
                "count": len(modules),
                "courses": [
                    {
                        "id": m.id,
                        "title": m.title,
                        "description": (m.description or "")[:140],
                        "level": m.level,
                        "duration_minutes": m.durationMinutes,
                        "price": m.price,
                        "url": f"/learn/courses/{m.id}",
                    }
                    for m in modules
                ],
            }

        elif name == "search_learning_paths":
            query = args.get("query", "").strip()
            where_path: Dict[str, Any] = {"deletedAt": None}
            if query:
                where_path["OR"] = [
                    {"title": {"contains": query, "mode": "insensitive"}},
                    {"description": {"contains": query, "mode": "insensitive"}},
                ]

            paths = await prisma.path.find_many(
                where=where_path,
                take=5,
                order={"createdAt": "desc"},
                include={"modules": True},
            )
            return {
                "count": len(paths),
                "paths": [
                    {
                        "id": p.id,
                        "title": p.title,
                        "description": (p.description or "")[:140],
                        "total_lessons": p.totalLessons,
                        "duration_minutes": p.durationMinutes,
                        "modules_count": len(p.modules) if p.modules else 0,
                        "url": f"/learn/paths/{p.id}",
                    }
                    for p in paths
                ],
            }

        elif name == "search_freelance_projects":
            query = args.get("query", "").strip()
            budget_min = args.get("budget_min")
            where_p: Dict[str, Any] = {"status": "OPEN", "deletedAt": None}
            if query:
                where_p["OR"] = [
                    {"title": {"contains": query, "mode": "insensitive"}},
                    {"description": {"contains": query, "mode": "insensitive"}},
                ]
            if budget_min:
                where_p["budget"] = {"gte": int(budget_min)}

            projects = await prisma.project.find_many(
                where=where_p,
                take=5,
                order={"createdAt": "desc"},
            )
            return {
                "count": len(projects),
                "projects": [
                    {
                        "id": p.id,
                        "title": p.title,
                        "budget_dzd": p.budget,
                        "skills": p.skills,
                        "description": (p.description or "")[:140],
                        "url": f"/hub/projects/{p.id}",
                    }
                    for p in projects
                ],
            }

        elif name == "get_my_learning_progress":
            if not current_user:
                return {
                    "authenticated": False,
                    "message": "User is currently not logged in. Advise the user to log in at /auth/login to view their course progress.",
                }
            user_id = (
                current_user.id
                if hasattr(current_user, "id")
                else current_user.get("id")
            )
            enrollments = await prisma.enrollment.find_many(
                where={"userId": user_id, "deletedAt": None},
                include={"module": True, "certificate": True},
                take=10,
            )
            return {
                "authenticated": True,
                "total_enrolled": len(enrollments),
                "courses": [
                    {
                        "course_title": e.module.title if e.module else "Cours",
                        "progress_percent": round(e.progress, 1),
                        "completed": e.completedAt is not None,
                        "certificate_code": e.certificate.certificateId
                        if e.certificate
                        else None,
                        "url": f"/learn/courses/{e.moduleId}" if e.moduleId else None,
                    }
                    for e in enrollments
                ],
            }

        elif name == "get_my_freelance_contracts":
            if not current_user:
                return {
                    "authenticated": False,
                    "message": "User is not logged in. Advise the user to log in at /auth/login to view their active contracts.",
                }
            user_id = (
                current_user.id
                if hasattr(current_user, "id")
                else current_user.get("id")
            )
            where_c: Dict[str, Any] = {
                "OR": [{"clientId": user_id}, {"freelancerId": user_id}],
                "deletedAt": None,
            }
            if args.get("status"):
                where_c["status"] = args["status"].upper()

            contracts = await prisma.contract.find_many(
                where=where_c,
                include={"project": True, "milestones": True},
                take=5,
                order={"createdAt": "desc"},
            )
            return {
                "authenticated": True,
                "count": len(contracts),
                "contracts": [
                    {
                        "id": c.id,
                        "title": c.project.title if c.project else f"Contrat #{c.id}",
                        "status": str(c.status),
                        "amount_dzd": c.amount,
                        "milestone_count": len(c.milestones),
                        "url": f"/hub/contracts/{c.id}",
                    }
                    for c in contracts
                ],
            }

        elif name == "get_my_tickets":
            if not current_user:
                return {
                    "authenticated": False,
                    "message": "User is not logged in. Advise the user to log in at /auth/login to check their support tickets.",
                }
            user_id = (
                current_user.id
                if hasattr(current_user, "id")
                else current_user.get("id")
            )
            where_t: Dict[str, Any] = {"userId": user_id, "deletedAt": None}
            if args.get("status"):
                where_t["status"] = args["status"].upper()

            tickets = await prisma.ticket.find_many(
                where=where_t,
                take=5,
                order={"createdAt": "desc"},
            )
            return {
                "authenticated": True,
                "count": len(tickets),
                "tickets": [
                    {
                        "ticket_number": t.ticketNumber,
                        "subject": t.subject,
                        "status": str(t.status),
                        "priority": str(t.priority),
                        "created_at": t.createdAt.isoformat() if t.createdAt else None,
                    }
                    for t in tickets
                ],
            }

        elif name == "create_support_ticket":
            if not current_user:
                return {
                    "authenticated": False,
                    "success": False,
                    "message": "You must be logged in to create a support ticket. Please log in first at /auth/login.",
                }
            user_id = (
                current_user.id
                if hasattr(current_user, "id")
                else current_user.get("id")
            )
            subject = args.get("subject", "Demande d'assistance").strip()
            category = args.get("category", "GENERAL").upper()
            description = args.get("description", "").strip()
            priority = args.get("priority", "NORMAL").upper()

            from app.generated.prisma import enums as p_enums

            cat_enum = getattr(
                p_enums.TicketCategory, category, p_enums.TicketCategory.GENERAL
            )
            pri_enum = getattr(
                p_enums.TicketPriority, priority, p_enums.TicketPriority.NORMAL
            )

            ticket = await prisma.ticket.create(
                data={
                    "userId": user_id,
                    "subject": subject[:200],
                    "category": cat_enum,
                    "priority": pri_enum,
                    "status": p_enums.TicketStatus.OPEN,
                    "messages": {
                        "create": {
                            "senderId": user_id,
                            "body": sanitize_pii(description),
                        }
                    },
                }
            )
            return {
                "success": True,
                "ticket_number": ticket.ticketNumber,
                "subject": ticket.subject,
                "category": str(ticket.category),
                "message": f"Support ticket #{ticket.ticketNumber} created successfully. Our team will review it within our SLA commitment.",
            }

    except Exception as exc:
        logger.error(f"Error executing AI tool '{name}': {exc}", exc_info=True)
        return {"error": f"Failed to execute {name}: {str(exc)}"}

    return {"error": f"Unknown tool: {name}"}


# =============================================================================
# 4. Core Query Dispatcher & Two-Turn Gemini Execution
# =============================================================================


def build_token_aware_contents(
    history: List[Dict[str, Any]],
    current_message: str,
    max_tokens: int = 6000,
) -> List[Dict[str, Any]]:
    """
    Build Gemini conversation contents using a token-aware sliding window.
    Retains the most recent turns that fit within the token budget rather
    than a hardcoded turn limit.
    """
    current_tokens = estimate_token_count(current_message)
    budget_remaining = max_tokens - current_tokens

    selected_turns: List[Dict[str, Any]] = []
    for turn in reversed(history):
        text = str(turn.get("content", "")).strip()
        if not text:
            continue
        turn_tokens = estimate_token_count(text)
        if budget_remaining - turn_tokens < 0 and selected_turns:
            break
        budget_remaining -= turn_tokens
        role = "user" if turn.get("role") in ("user", "human") else "model"
        selected_turns.append({"role": role, "parts": [{"text": text}]})

    selected_turns.reverse()
    selected_turns.append({"role": "user", "parts": [{"text": current_message}]})
    return selected_turns


async def ask_podacium_ai(
    message: str,
    locale: str = "fr",
    history: Optional[List[Dict[str, str]]] = None,
    current_user: Optional[Any] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate an AI response grounded in Podacium's platform policies and knowledge base,
    executing safe function calling if live catalog or user context is required.
    """
    clean_message = sanitize_pii(message.strip())
    if not clean_message:
        return {
            "reply": "Veuillez poser une question pour que je puisse vous aider.",
            "category": "GENERAL",
            "suggested_ticket": False,
            "engine": "offline_knowledge",
            "session_id": session_id,
        }

    session_synopsis: Optional[str] = None
    if session_id:
        try:
            await session_service.append_turn(
                session_id=session_id,
                role="USER",
                content=clean_message,
                token_count=estimate_token_count(clean_message),
            )
            ctx = await session_service.get_active_context(session_id)
            if ctx.get("summaryState"):
                session_synopsis = ctx["summaryState"]
        except Exception as e:
            logger.warning(f"Could not persist user turn to session {session_id}: {e}")

    gemini_key = (
        getattr(setting, "GEMINI_API_KEY", "")
        or getattr(setting, "LLM_API_KEY", "")
        or ""
    )
    gemini_model = getattr(setting, "GEMINI_MODEL", "gemini-2.5-flash")

    result: Optional[Dict[str, Any]] = None

    # If Gemini API key is configured, query Google Gemini REST API
    if gemini_key:
        try:
            result = await _query_gemini(
                clean_message,
                locale,
                history or [],
                gemini_key,
                gemini_model,
                current_user=current_user,
                system_synopsis=session_synopsis,
            )
        except Exception as e:
            logger.warning(
                f"Gemini API request failed ({e}), falling back to offline knowledge base"
            )

    if not result:
        # Fallback: Offline Grounded Knowledge Base
        result = _query_offline_knowledge(clean_message, locale)

    if session_id and result:
        try:
            await session_service.append_turn(
                session_id=session_id,
                role="ASSISTANT",
                content=result["reply"],
                token_count=estimate_token_count(result["reply"]),
                model=result.get("engine", "unknown"),
            )
            await session_service.compact_context_if_needed(session_id)
        except Exception as e:
            logger.warning(
                f"Could not persist assistant turn to session {session_id}: {e}"
            )

    result["session_id"] = session_id
    return result


async def _query_gemini(
    message: str,
    locale: str,
    history: List[Dict[str, str]],
    api_key: str,
    model: str,
    current_user: Optional[Any] = None,
    system_synopsis: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute Gemini REST API generation with tools and two-turn execution if needed."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    # Build localized system instructions
    lang_name = (
        "Français"
        if locale == "fr"
        else "العربية (Darija)"
        if locale == "ar"
        else "English"
    )
    user_status = "Visiteur Anonyme (Non connecté)"
    if current_user:
        user_name = getattr(current_user, "fullName", "Utilisateur")
        user_role = getattr(current_user, "role", "STUDENT")
        user_status = f"Connecté en tant que {user_name} (Rôle: {user_role})"

    system_text = (
        f"{PODACIUM_GROUNDING_PROMPT}\n\n"
        f"Session Context: {user_status}.\n"
        f"Active User Interface Locale: {locale} ({lang_name}).\n"
        "Respond in the requested language respectfully, accurately, and concisely."
    )
    if system_synopsis:
        system_text = (
            f"{system_text}\n\n"
            f"# Summary of earlier conversation turns:\n{system_synopsis}"
        )

    contents: List[Dict[str, Any]] = build_token_aware_contents(history, message)

    payload: Dict[str, Any] = {
        "system_instruction": {"parts": [{"text": system_text}]},
        "contents": contents,
        "tools": [{"function_declarations": GEMINI_TOOLS}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 800,
        },
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

        candidates = data.get("candidates", [])
        if not candidates or "content" not in candidates[0]:
            raise ValueError("Empty candidate response from Gemini API")

        parts = candidates[0]["content"].get("parts", [])
        if not parts:
            raise ValueError("Empty candidate content parts from Gemini API")

        # Check if Gemini requested a function call
        first_part = parts[0]
        if "functionCall" in first_part:
            fc = first_part["functionCall"]
            tool_name = fc.get("name", "")
            tool_args = fc.get("args", {})
            logger.info(
                f"Gemini invoked functionCall: {tool_name} with args: {tool_args}"
            )

            # Execute the tool safely
            tool_result = await execute_tool(
                tool_name, tool_args, current_user=current_user
            )

            # Append assistant's functionCall and tool's functionResponse to conversation
            contents.append({"role": "model", "parts": [{"functionCall": fc}]})
            contents.append(
                {
                    "role": "function",
                    "parts": [
                        {
                            "functionResponse": {
                                "name": tool_name,
                                "response": tool_result,
                            }
                        }
                    ],
                }
            )

            # Second turn to generate synthesized final answer
            followup_payload = {
                "system_instruction": {"parts": [{"text": system_text}]},
                "contents": contents,
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 800,
                },
            }
            f_resp = await client.post(url, json=followup_payload)
            f_resp.raise_for_status()
            f_data = f_resp.json()
            f_candidates = f_data.get("candidates", [])
            if f_candidates and "content" in f_candidates[0]:
                f_parts = f_candidates[0]["content"].get("parts", [])
                if f_parts and "text" in f_parts[0]:
                    reply_text = f_parts[0]["text"].strip()
                    return {
                        "reply": reply_text,
                        "category": _infer_category(message),
                        "suggested_ticket": False,
                        "engine": "gemini",
                    }

        # Standard text reply
        if "text" in first_part:
            reply_text = first_part["text"].strip()
            suggest_ticket = any(
                word in message.lower()
                for word in [
                    "litige",
                    "arnaque",
                    "débité",
                    "rembourser",
                    "bloqué",
                    "erreur",
                    "dispute",
                ]
            )
            return {
                "reply": reply_text,
                "category": _infer_category(message),
                "suggested_ticket": suggest_ticket,
                "engine": "gemini",
            }

    raise ValueError("Invalid candidate response structure from Gemini API")


# =============================================================================
# 5. Offline Grounded Knowledge Base Fallback
# =============================================================================


def _query_offline_knowledge(message: str, locale: str) -> Dict[str, Any]:
    """Produce grounded answers using rule-based FAQ matcher when Gemini is unavailable."""
    matched = match_offline_faq(message, locale)
    if matched:
        return {
            "reply": matched["reply"],
            "category": matched["category"],
            "suggested_ticket": matched["category"] == "BILLING",
            "engine": "offline_knowledge",
        }

    # Generic localized default guidance
    fallback_messages = {
        "fr": (
            "Je suis l'assistant Podacium. Pour toute question relative aux cours (/learn), aux paiements "
            "EDAHABIA / CIB ou aux projets freelance (/hub), je suis à votre entière disposition. Si vous rencontrez "
            "une difficulté spécifique, vous pouvez également ouvrir directement un ticket de support."
        ),
        "ar": (
            "أهلاً بك! أنا المساعد الذكي لمنصة بوداسيوم. يمكنني إرشادك بخصوص الدورات التعليمية (/learn)، الدفع عبر "
            "البطاقة الذهبية أو CIB، وضمان مشاريع العمل الحر (/hub). لأي استفسار تقني خاص، يمكنك فتح تذكرة دعم مباشرة."
        ),
        "en": (
            "I am the Podacium Assistant. I can help guide you through courses (/learn), EDAHABIA/CIB payments, "
            "and freelance escrow protection (/hub). For account-specific technical issues, feel free to open a support ticket."
        ),
    }

    target_lang = locale if locale in ("fr", "ar", "en") else "fr"
    return {
        "reply": fallback_messages.get(target_lang, fallback_messages["fr"]),
        "category": "GENERAL",
        "suggested_ticket": True,
        "engine": "offline_knowledge",
    }


def _infer_category(text: str) -> str:
    """Classify the user topic for ticket routing."""
    lower = text.lower()
    if any(
        k in lower
        for k in [
            "edahabia",
            "cib",
            "chargily",
            "payer",
            "paiement",
            "facture",
            "remboursement",
            "débité",
            "debit",
            "ccp",
            "carte",
            "taxe",
            "impot",
        ]
    ):
        return "BILLING"
    if any(
        k in lower
        for k in [
            "cours",
            "leçon",
            "quiz",
            "certificat",
            "formation",
            "diplome",
            "video",
            "module",
        ]
    ):
        return "LEARNING"
    if any(
        k in lower
        for k in [
            "freelance",
            "projet",
            "contrat",
            "milestone",
            "litige",
            "escrow",
            "livrable",
            "devis",
        ]
    ):
        return "HUB"
    if any(
        k in lower
        for k in [
            "compte",
            "mot de passe",
            "connexion",
            "login",
            "email",
            "profil",
            "sécurité",
            "2fa",
            "totp",
        ]
    ):
        return "ACCOUNT"
    return "GENERAL"


# =============================================================================
# 6. Streaming SSE Implementation
# =============================================================================


async def stream_podacium_ai(
    message: str,
    locale: str = "fr",
    history: Optional[List[Dict[str, str]]] = None,
    current_user: Optional[Any] = None,
    session_id: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream an AI response token-by-token formatted as Server-Sent Events (SSE).
    """
    clean_message = sanitize_pii(message.strip())
    if not clean_message:
        yield f"data: {json.dumps({'token': 'Veuillez poser une question pour que je puisse vous aider.'})}\n\n"
        yield f"data: {json.dumps({'done': True, 'category': 'GENERAL', 'suggested_ticket': False, 'engine': 'offline_knowledge'})}\n\n"
        return

    session_synopsis: Optional[str] = None
    if session_id:
        try:
            await session_service.append_turn(
                session_id=session_id,
                role="USER",
                content=clean_message,
                token_count=estimate_token_count(clean_message),
            )
            ctx = await session_service.get_active_context(session_id)
            if ctx.get("summaryState"):
                session_synopsis = ctx["summaryState"]
        except Exception as e:
            logger.warning(f"Could not persist user turn to session {session_id}: {e}")

    accumulated_tokens: List[str] = []

    gemini_key = (
        getattr(setting, "GEMINI_API_KEY", "")
        or getattr(setting, "LLM_API_KEY", "")
        or ""
    )
    gemini_model = getattr(setting, "GEMINI_MODEL", "gemini-2.5-flash")

    if gemini_key:
        try:
            async for sse_chunk in _stream_gemini(
                clean_message,
                locale,
                history or [],
                gemini_key,
                gemini_model,
                current_user=current_user,
                system_synopsis=session_synopsis,
            ):
                if '"token":' in sse_chunk:
                    try:
                        raw_payload = sse_chunk.replace("data: ", "").strip()
                        line_data = json.loads(raw_payload)
                        if "token" in line_data:
                            accumulated_tokens.append(line_data["token"])
                    except Exception:
                        pass
                yield sse_chunk

            if session_id and accumulated_tokens:
                full_reply = "".join(accumulated_tokens)
                try:
                    await session_service.append_turn(
                        session_id=session_id,
                        role="ASSISTANT",
                        content=full_reply,
                        token_count=estimate_token_count(full_reply),
                        model="gemini",
                    )
                    await session_service.compact_context_if_needed(session_id)
                except Exception as e:
                    logger.warning(
                        f"Could not persist streamed turn to session {session_id}: {e}"
                    )
            return
        except Exception as e:
            logger.warning(
                f"Gemini streaming failed ({e}), falling back to offline token stream"
            )

    # Offline Grounded Knowledge Streaming (word-by-word with micro-cadence)
    offline_res = _query_offline_knowledge(clean_message, locale)
    words = offline_res["reply"].split(" ")
    for idx, word in enumerate(words):
        suffix = " " if idx < len(words) - 1 else ""
        token = word + suffix
        accumulated_tokens.append(token)
        yield f"data: {json.dumps({'token': token})}\n\n"
        await asyncio.sleep(0.02)

    if session_id and accumulated_tokens:
        full_reply = "".join(accumulated_tokens)
        try:
            await session_service.append_turn(
                session_id=session_id,
                role="ASSISTANT",
                content=full_reply,
                token_count=estimate_token_count(full_reply),
                model=offline_res["engine"],
            )
            await session_service.compact_context_if_needed(session_id)
        except Exception as e:
            logger.warning(
                f"Could not persist offline assistant turn to session {session_id}: {e}"
            )

    yield f"data: {json.dumps({'done': True, 'category': offline_res['category'], 'suggested_ticket': offline_res['suggested_ticket'], 'engine': offline_res['engine']})}\n\n"


async def _stream_gemini(
    message: str,
    locale: str,
    history: List[Dict[str, str]],
    api_key: str,
    model: str,
    current_user: Optional[Any] = None,
    system_synopsis: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Execute streaming call against Gemini REST API with SSE output."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?key={api_key}&alt=sse"

    lang_name = (
        "Français"
        if locale == "fr"
        else "العربية (Darija)"
        if locale == "ar"
        else "English"
    )
    user_status = "Visiteur Anonyme (Non connecté)"
    if current_user:
        user_name = getattr(current_user, "fullName", "Utilisateur")
        user_role = getattr(current_user, "role", "STUDENT")
        user_status = f"Connecté en tant que {user_name} (Rôle: {user_role})"

    system_text = (
        f"{PODACIUM_GROUNDING_PROMPT}\n\n"
        f"Session Context: {user_status}.\n"
        f"Active User Interface Locale: {locale} ({lang_name}).\n"
        "Respond in the requested language respectfully, accurately, and concisely."
    )
    if system_synopsis:
        system_text = (
            f"{system_text}\n\n"
            f"# Summary of earlier conversation turns:\n{system_synopsis}"
        )

    contents: List[Dict[str, Any]] = build_token_aware_contents(history, message)

    payload = {
        "system_instruction": {"parts": [{"text": system_text}]},
        "contents": contents,
        "tools": [{"function_declarations": GEMINI_TOOLS}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 800},
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        async with client.stream("POST", url, json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    raw_data = line[6:].strip()
                    if raw_data:
                        try:
                            parsed = json.loads(raw_data)
                            candidates = parsed.get("candidates", [])
                            if candidates and "content" in candidates[0]:
                                parts = candidates[0]["content"].get("parts", [])
                                for p in parts:
                                    token = p.get("text", "")
                                    if token:
                                        yield f"data: {json.dumps({'token': token})}\n\n"
                        except json.JSONDecodeError:
                            continue

    category = _infer_category(message)
    suggest_ticket = any(
        w in message.lower()
        for w in [
            "litige",
            "arnaque",
            "débité",
            "rembourser",
            "bloqué",
            "erreur",
            "dispute",
        ]
    )
    yield f"data: {json.dumps({'done': True, 'category': category, 'suggested_ticket': suggest_ticket, 'engine': 'gemini'})}\n\n"


# =============================================================================
# 7. Executive Escalation Dossier
# =============================================================================


def generate_escalation_dossier(
    messages: List[Dict[str, str]],
    client_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Synthesize a structured Executive Handoff Dossier from conversation history.
    Complies with ANPDP Law 18-07 / 25-11 by sanitizing user context.
    """
    client_context = client_context or {}
    user_messages = [
        m.get("content", "") for m in messages if m.get("role") in ("user", "human")
    ]
    all_user_text = " ".join(user_messages)

    category = _infer_category(all_user_text) if all_user_text else "GENERAL"
    lower_text = all_user_text.lower()

    is_urgent = any(
        k in lower_text
        for k in [
            "débité",
            "bloqué",
            "arnaque",
            "urgent",
            "problème",
            "erreur",
            "dispute",
            "litige",
            "argent",
        ]
    )
    sentiment = "high_frustration" if is_urgent else "neutral_inquiry"

    first_question = user_messages[0] if user_messages else "Demande d'assistance"
    user_intent = f"{category.lower()}_{first_question[:60].strip()}"

    if category == "BILLING":
        recommended_action = "Vérifier la transaction Chargily / EDAHABIA et confirmer l'état de compensation."
    elif category == "LEARNING":
        recommended_action = "Inspecter la progression du cours et régénérer le certificat Open Badges v3 si besoin."
    elif category == "HUB":
        recommended_action = (
            "Consulter le contrat de jalon et l'état de séquestre (Loi 22-23 ANAE)."
        )
    else:
        recommended_action = (
            "Contacter l'utilisateur pour assistance technique personnalisée."
        )

    page_url = client_context.get("page", "N/A")
    browser = client_context.get("browser", "N/A")

    transcript_lines = []
    for m in messages:
        sender = "Client" if m.get("role") in ("user", "human") else "Assistant IA"
        transcript_lines.append(f"[{sender}]\n{sanitize_pii(m.get('content', ''))}")
    transcript_md = "\n\n".join(transcript_lines)

    formatted_md = (
        f"--- DOSSIER D'ESCALADE SUPPORT IA ---\n"
        f"Catégorie: {category} | Priorité: {'URGENT' if is_urgent else 'NORMALE'}\n"
        f"Sentiment: {sentiment}\n"
        f"Action Recommandée: {recommended_action}\n"
        f"Page: {page_url}\n"
        f"Navigateur: {browser[:100]}\n\n"
        f"--- TRANSCRIPTION INTÉGRALE ---\n"
        f"{transcript_md}\n"
    )

    return {
        "user_intent": user_intent,
        "detected_sentiment": sentiment,
        "summary": first_question[:120],
        "category": category,
        "recommended_action": recommended_action,
        "formatted_markdown": formatted_md,
    }
