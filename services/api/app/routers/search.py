"""
Search router — PostgreSQL full-text search across modules, projects, and users.

Uses tsvector/tsquery for ranked, weighted search results.

NOTE: All three search queries use prisma.query_raw() because PostgreSQL's
native full-text search (ts_rank / to_tsquery / search_vector @@) is a
database-specific feature that Prisma's query builder cannot express.
Parameters are properly bound ($1, $2, $3) to prevent injection, and every
user-supplied value is sanitised before reaching SQL.
"""

import logging
import re
from typing import Optional, List

from fastapi import APIRouter, Query, HTTPException, status
from pydantic import BaseModel

from app.core.prisma import prisma

router = APIRouter(prefix="/api/v1/search", tags=["search"])
logger = logging.getLogger(__name__)


# =============================================================================
# SCHEMAS
# =============================================================================


class SearchResultItem(BaseModel):
    id: str
    type: str  # "module", "project", "user"
    title: str
    description: Optional[str] = None
    relevance: float = 0.0
    metadata: dict = {}


class SearchResponse(BaseModel):
    query: str
    total: int
    results: List[SearchResultItem]


# =============================================================================
# ENDPOINTS
# =============================================================================


@router.get("", response_model=SearchResponse)
@router.get("/", response_model=SearchResponse, include_in_schema=False)
async def search(
    q: str = Query(..., min_length=2, max_length=200, description="Search query"),
    type: Optional[str] = Query(
        None, description="Filter by type: module, project, user"
    ),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
):
    """
    Full-text search across modules, projects, and users.

    Uses PostgreSQL tsvector with weighted ranking, with graceful fallback
    to insensitive substring/contains search if tsvector is unpopulated.
    """
    # Sanitize query for tsquery (escape special characters)
    sanitized_query = _sanitize_for_tsquery(q)

    results: List[SearchResultItem] = []

    try:
        if type is None or type == "module":
            modules = await _search_modules(sanitized_query, q, limit, offset)
            results.extend(modules)

        if type is None or type == "project":
            projects = await _search_projects(sanitized_query, q, limit, offset)
            results.extend(projects)

        if type is None or type == "user":
            users = await _search_users(sanitized_query, q, limit, offset)
            results.extend(users)

    except Exception as e:
        logger.error(f"Search failed: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Search temporarily unavailable",
        )

    # Sort by relevance (highest first)
    results.sort(key=lambda r: r.relevance, reverse=True)

    # Apply limit after combining
    results = results[:limit]

    return SearchResponse(query=q, total=len(results), results=results)


# =============================================================================
# SEARCH HELPERS
# =============================================================================

_TSQUERY_SAFE_RE = re.compile(r"^[\w\-:*& ]+$")
"""Regex that a sanitised tsquery output must match — blocks SQL keywords and unexpected syntax."""


def _sanitize_for_tsquery(query: str) -> str:
    """
    Convert user input to a safe tsquery string.

    THREE layers of defence:
      1. Char-level whitelist (alphanumeric, space, dash only).
      2. Term limits (max 10 terms, 60 chars each).
      3. Output regex — only allows ``word:* & word:*`` pattern.
    """
    # Layer 1: character-level whitelist
    cleaned = "".join(c for c in query if c.isalnum() or c.isspace() or c == "-")

    # Layer 2: term limits
    words = cleaned.split()
    if not words:
        return ""
    words = [w[:60] for w in words[:10]]

    # Build tsquery: word1:* & word2:* & ...
    result = " & ".join(f"{word}:*" for word in words)

    # Layer 3: output regex validation (defense in depth)
    if not _TSQUERY_SAFE_RE.match(result):
        logger.warning(f"Sanitised tsquery failed regex validation: {result!r}")
        return ""

    return result


async def _search_modules(
    query: str, raw_query: str, limit: int, offset: int
) -> List[SearchResultItem]:
    """Search modules using full-text search with fallback to Prisma query."""
    results: List[SearchResultItem] = []
    # 1. Full-text search when sanitized query is present
    if query:
        try:
            sql = """
                SELECT id, title, description, level, "durationMinutes",
                       ts_rank("search_vector", to_tsquery('simple', $1)) as rank
                FROM "Module"
                WHERE "search_vector" IS NOT NULL
                  AND "search_vector" @@ to_tsquery('simple', $1)
                  AND "deletedAt" IS NULL
                ORDER BY rank DESC
                LIMIT $2 OFFSET $3
            """
            rows = await prisma.query_raw(sql, query, limit, offset)
            for row in rows:
                results.append(
                    SearchResultItem(
                        id=str(row["id"]),
                        type="module",
                        title=row["title"],
                        description=row.get("description"),
                        relevance=float(row.get("rank", 0)),
                        metadata={
                            "level": row.get("level"),
                            "durationMinutes": row.get("durationMinutes"),
                        },
                    )
                )
        except Exception as e:
            logger.warning(f"Full-text search on Module failed, falling back: {e}")

    # 2. Fallback to insensitive substring/tag search if tsvector yielded no results
    if not results and raw_query.strip():
        try:
            clean_q = raw_query.strip()
            terms = [w.strip() for w in clean_q.split() if len(w.strip()) >= 2]
            or_conditions: list[dict] = [
                {"title": {"contains": clean_q, "mode": "insensitive"}},
                {"description": {"contains": clean_q, "mode": "insensitive"}},
                {"skills": {"has": clean_q}},
                {"tags": {"has": clean_q}},
            ]
            for term in terms:
                or_conditions.extend(
                    [
                        {"title": {"contains": term, "mode": "insensitive"}},
                        {"description": {"contains": term, "mode": "insensitive"}},
                        {"skills": {"has": term}},
                        {"tags": {"has": term}},
                    ]
                )

            modules = await prisma.module.find_many(
                where={
                    "deletedAt": None,
                    "OR": or_conditions,
                },
                take=limit,
                skip=offset,
                order={"createdAt": "desc"},
            )
            q_lower = clean_q.lower()
            for m in modules:
                rel = 1.0 if q_lower in (m.title or "").lower() else 0.5
                results.append(
                    SearchResultItem(
                        id=str(m.id),
                        type="module",
                        title=m.title,
                        description=m.description,
                        relevance=rel,
                        metadata={
                            "level": m.level,
                            "durationMinutes": m.durationMinutes,
                        },
                    )
                )
        except Exception as e:
            logger.warning(f"Fallback search on Module failed: {e}")

    return results


async def _search_projects(
    query: str, raw_query: str, limit: int, offset: int
) -> List[SearchResultItem]:
    """Search projects using full-text search with fallback to Prisma query."""
    results: List[SearchResultItem] = []
    if query:
        try:
            sql = """
                SELECT id, title, description, status, "budget",
                       featured, "featuredBoost", "featureExpiresAt",
                       ts_rank("search_vector", to_tsquery('simple', $1)) +
                       CASE
                         WHEN featured = true AND "featureExpiresAt" > NOW()
                         THEN GREATEST("featuredBoost" * 0.3, 0)
                         ELSE 0
                       END as rank
                FROM "Project"
                WHERE "search_vector" IS NOT NULL
                  AND "search_vector" @@ to_tsquery('simple', $1)
                  AND "deletedAt" IS NULL
                  AND status = 'OPEN'
                ORDER BY rank DESC
                LIMIT $2 OFFSET $3
            """
            rows = await prisma.query_raw(sql, query, limit, offset)
            for row in rows:
                results.append(
                    SearchResultItem(
                        id=str(row["id"]),
                        type="project",
                        title=row["title"],
                        description=row.get("description"),
                        relevance=float(row.get("rank", 0)),
                        metadata={
                            "status": row.get("status"),
                            "budget": row.get("budget"),
                            "featured": row.get("featured"),
                            "featuredBoost": float(row.get("featuredBoost") or 0),
                            "featureExpiresAt": (
                                row.get("featureExpiresAt").isoformat()
                                if row.get("featureExpiresAt")
                                else None
                            ),
                        },
                    )
                )
        except Exception as e:
            logger.warning(f"Full-text search on Project failed, falling back: {e}")

    if not results and raw_query.strip():
        try:
            clean_q = raw_query.strip()
            terms = [w.strip() for w in clean_q.split() if len(w.strip()) >= 2]
            or_conditions: list[dict] = [
                {"title": {"contains": clean_q, "mode": "insensitive"}},
                {"description": {"contains": clean_q, "mode": "insensitive"}},
                {"skills": {"has": clean_q}},
            ]
            for term in terms:
                or_conditions.extend(
                    [
                        {"title": {"contains": term, "mode": "insensitive"}},
                        {"description": {"contains": term, "mode": "insensitive"}},
                        {"skills": {"has": term}},
                    ]
                )

            projects = await prisma.project.find_many(
                where={
                    "deletedAt": None,
                    "status": "OPEN",
                    "OR": or_conditions,
                },
                take=limit,
                skip=offset,
                order={"createdAt": "desc"},
            )
            q_lower = clean_q.lower()
            for p in projects:
                rel = 1.0 if q_lower in (p.title or "").lower() else 0.5
                results.append(
                    SearchResultItem(
                        id=str(p.id),
                        type="project",
                        title=p.title,
                        description=p.description,
                        relevance=rel,
                        metadata={
                            "status": p.status,
                            "budget": p.budget,
                            "featured": p.featured,
                            "featuredBoost": float(p.featuredBoost or 0),
                            "featureExpiresAt": (
                                p.featureExpiresAt.isoformat()
                                if p.featureExpiresAt
                                else None
                            ),
                        },
                    )
                )
        except Exception as e:
            logger.warning(f"Fallback search on Project failed: {e}")

    return results


async def _search_users(
    query: str, raw_query: str, limit: int, offset: int
) -> List[SearchResultItem]:
    """Search users (freelancers) using full-text search with fallback to Prisma query."""
    results: List[SearchResultItem] = []
    if query:
        try:
            sql = """
                SELECT id, "fullName", bio, role, skills,
                       ts_rank("search_vector", to_tsquery('simple', $1)) as rank
                FROM "User"
                WHERE "search_vector" IS NOT NULL
                  AND "search_vector" @@ to_tsquery('simple', $1)
                  AND "deletedAt" IS NULL
                  AND "isActive" = true
                ORDER BY rank DESC
                LIMIT $2 OFFSET $3
            """
            rows = await prisma.query_raw(sql, query, limit, offset)
            for row in rows:
                results.append(
                    SearchResultItem(
                        id=str(row["id"]),
                        type="user",
                        title=row["fullName"],
                        description=row.get("bio"),
                        relevance=float(row.get("rank", 0)),
                        metadata={
                            "role": row.get("role"),
                            "skills": row.get("skills", []),
                        },
                    )
                )
        except Exception as e:
            logger.warning(f"Full-text search on User failed, falling back: {e}")

    if not results and raw_query.strip():
        try:
            clean_q = raw_query.strip()
            terms = [w.strip() for w in clean_q.split() if len(w.strip()) >= 2]
            or_conditions: list[dict] = [
                {"fullName": {"contains": clean_q, "mode": "insensitive"}},
                {"bio": {"contains": clean_q, "mode": "insensitive"}},
                {"skills": {"has": clean_q}},
            ]
            for term in terms:
                or_conditions.extend(
                    [
                        {"fullName": {"contains": term, "mode": "insensitive"}},
                        {"bio": {"contains": term, "mode": "insensitive"}},
                        {"skills": {"has": term}},
                    ]
                )

            users = await prisma.user.find_many(
                where={
                    "deletedAt": None,
                    "isActive": True,
                    "OR": or_conditions,
                },
                take=limit,
                skip=offset,
                order={"createdAt": "desc"},
            )
            q_lower = clean_q.lower()
            for u in users:
                rel = 1.0 if q_lower in (u.fullName or "").lower() else 0.5
                results.append(
                    SearchResultItem(
                        id=str(u.id),
                        type="user",
                        title=u.fullName,
                        description=u.bio,
                        relevance=rel,
                        metadata={
                            "role": u.role,
                            "skills": u.skills or [],
                        },
                    )
                )
        except Exception as e:
            logger.warning(f"Fallback search on User failed: {e}")

    return results
