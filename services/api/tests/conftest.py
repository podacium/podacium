"""
Shared test fixtures for the Podacium API test suite.

NOTE: Do NOT import app.main at module level — it triggers DB connection.
Use the `app` fixture for integration tests that need the full app.
"""

import os

# Disable the Redis-backed rate-limiting middleware for the test suite.
# Every test shares a single client IP within the same time window, so the
# real limiter throttles batch runs (429) regardless of individual-test
# correctness. Must be set before app.core.config.Settings is instantiated.
os.environ["RATE_LIMIT_ENABLED"] = "false"

# Force in-memory fallbacks for every Redis-backed service (rate limiter,
# account lockout, token blocklist). Without this, tests write attempt/lockout
# state into the local Redis and leak it into later runs (e.g. an account that
# was locked by one run stays locked for the next). Tests that specifically
# exercise those services mock the Redis layer themselves.
os.environ["REDIS_URL"] = ""

# ---------------------------------------------------------------------------
# Shared fake for `app.core.prisma`
#
# Several test modules replace sys.modules["app.core.prisma"] at import time so
# the Prisma client never connects to a database. Whichever module is installed
# LAST wins for the whole pytest process, so the fake MUST expose the full
# public surface (prisma + connect/disconnect/ensure_connection/get_prisma) and
# a rich prisma object. A partial fake here breaks every later suite with
# `ImportError: cannot import name 'ensure_connection' from 'app.core.prisma'
# (unknown location)` — seen in the db_connection middleware and the startup
# background tasks.
#
# The fake is a process-wide SINGLETON installed here, before ANY other app
# import, so (a) the real prisma client is never constructed and (b) every test
# module that calls build_fake_prisma_module() mutates the very object the app
# code is bound to. Use this helper in every module that swaps the module in.
# ---------------------------------------------------------------------------
import sys as _sys
import types as _types
from unittest.mock import AsyncMock as _AsyncMock
from unittest.mock import MagicMock as _MagicMock

_PRISMA_MODELS = (
    "user",
    "usersettings",
    "authtoken",
    "waitlistentry",
    "invitation",
    "organization",
    "organizationmember",
    "organizationinvitation",
    "userskill",
    "skillendorsement",
    "enrollment",
    "module",
    "lesson",
    "course",
    "certificate",
    "quiz",
    "quizattempt",
    "transaction",
    "wallet",
    "livesession",
    "livesessionbooking",
    "livesessioncohost",
    "livesessionparticipant",
    "livesessionwaitlist",
    "file",
    "featurepurchase",
    "subscription",
    "notification",
    "payout",
    "dispute",
    "contract",
    "proposal",
    "portfolio",
    "ticket",
    "ticketmessage",
    "ticketrating",
    "device",
    "messagethread",
    "message",
    "phoneverification",
    "payment",
    "paymentmethod",
    "crispuser",
    "trendingsearch",
    "savedsearch",
    "systemsetting",
    "systemsettingaudit",
    "privacysettings",
    "securitysettings",
    "adminprofile",
    "adminsession",
    "freelancerprofile",
    "businessprofile",
    "project",
    "milestone",
    "escrow",
    "review",
    "bookmark",
    "lessonprogress",
    "moduleprogress",
    "path",
    "pathprogress",
    "aisession",
    "aimessage",
    "aitooltrace",
    "aiactionintent",
    "ailog",
)
_PRISMA_MODEL_METHODS = (
    "find_unique",
    "find_first",
    "find_many",
    "count",
    "create",
    "create_many",
    "update",
    "update_many",
    "upsert",
    "delete",
    "delete_many",
)
# Default return values make "not found" the natural outcome (404/401/registered:
# false), which is what most handler flows assume. Tests that need a found
# record override the method with their own AsyncMock(return_value=...).
_PRISMA_MODEL_DEFAULTS = {
    "find_unique": None,
    "find_first": None,
    "find_many": [],
    "count": 0,
    "create_many": 0,
    "update_many": 0,
    "delete_many": 0,
}

_FAKE_PRISMA_MODULE = None


def build_fake_prisma_module():
    """Return the shared stand-in for `app.core.prisma` (cached singleton).

    The module exposes `prisma` plus the full public function surface
    (connect/disconnect/ensure_connection/get_prisma). Model namespaces expose
    the standard Prisma CRUD methods as AsyncMocks (awaitable, truthy MagicMock
    results by default) so both routers and services work under test. Tests
    that care about a specific return value set it themselves on the returned
    module's ``prisma`` object.
    """
    global _FAKE_PRISMA_MODULE
    if _FAKE_PRISMA_MODULE is not None:
        return _FAKE_PRISMA_MODULE

    prisma = _MagicMock()
    for model in _PRISMA_MODELS:
        ns = _MagicMock()
        for method in _PRISMA_MODEL_METHODS:
            if method in _PRISMA_MODEL_DEFAULTS:
                setattr(
                    ns, method, _AsyncMock(return_value=_PRISMA_MODEL_DEFAULTS[method])
                )
            else:
                setattr(ns, method, _AsyncMock())
        setattr(prisma, model, ns)
    prisma.query_raw = _AsyncMock()
    prisma.execute_raw = _AsyncMock()
    # Transaction entry point is used as `async with prisma.tx() as tx:`, so it
    # must be a sync callable returning an async context manager.
    tx_cm = _MagicMock()
    tx_cm.__aenter__ = _AsyncMock(return_value=prisma)
    tx_cm.__aexit__ = _AsyncMock(return_value=False)
    prisma.tx = _MagicMock(return_value=tx_cm)

    mod = _types.ModuleType("app.core.prisma")
    mod.prisma = prisma
    mod.connect_prisma = _AsyncMock(return_value=True)
    mod.disconnect_prisma = _AsyncMock()
    mod.ensure_connection = _AsyncMock(return_value=True)
    mod.get_prisma = _AsyncMock(return_value=prisma)
    _FAKE_PRISMA_MODULE = mod
    return mod


# Install the fake BEFORE any other app import so the real prisma client is
# never constructed and no background DB-connect task can start.
# Real-database integration tests set PODACIUM_REAL_DB=1 so the genuine
# Prisma client connects to the dedicated test Postgres (podacium_test).
if os.environ.get("PODACIUM_REAL_DB") != "1":
    _sys.modules["app.core.prisma"] = build_fake_prisma_module()

import pytest
from datetime import datetime
from app.core.security import get_password_hash


@pytest.fixture
def test_user():
    """A mock user object for testing."""
    return {
        "id": 1,
        "email": "test@podacium.com",
        "fullName": "Test User",
        "role": "STUDENT",
        "emailVerified": True,
        "phoneVerified": False,
        "isActive": True,
        "isDeactivated": False,
        "deletedAt": None,
        "deactivatedAt": None,
        "passwordHash": get_password_hash("TestPass123!"),
        "profilePictureUrl": None,
        "phoneNumber": None,
        "skills": [],
        "socialLinks": None,
        "onboardingCompleted": False,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }


@pytest.fixture
def admin_user():
    """A mock admin user for testing."""
    return {
        "id": 2,
        "email": "admin@podacium.com",
        "fullName": "Admin User",
        "role": "ADMIN",
        "emailVerified": True,
        "isActive": True,
        "isDeactivated": False,
        "deletedAt": None,
        "deactivatedAt": None,
        "passwordHash": get_password_hash("AdminPass123!"),
    }


@pytest.fixture(autouse=True)
def _reset_fake_prisma_defaults():
    yield
    if _FAKE_PRISMA_MODULE and hasattr(_FAKE_PRISMA_MODULE, "prisma"):
        p = _FAKE_PRISMA_MODULE.prisma
        for model in _PRISMA_MODELS:
            ns = getattr(p, model, None)
            if ns:
                for method, default_val in _PRISMA_MODEL_DEFAULTS.items():
                    m = getattr(ns, method, None)
                    if isinstance(m, _AsyncMock):
                        m.return_value = default_val
                        m.side_effect = None
