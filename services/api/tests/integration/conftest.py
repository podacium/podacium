"""
Real PostgreSQL integration test layer (P0).

These tests exercise wallet accounting, escrow, contracts, milestones and
payouts against a genuine PostgreSQL instance with the real Prisma client.
They are NOT part of the default mock-based suite; run them explicitly with:

    PODACIUM_REAL_DB=1 DATABASE_URL=postgresql://podacium:localdev_only@localhost:5432/podacium_test \\
        podacium/bin/pytest tests/integration -v --tb=short

The root conftest skips installing the Prisma MagicMock when
PODACIUM_REAL_DB=1, so `app.core.prisma` resolves to the real client bound to
the test database.
"""
import os

import pytest

if os.environ.get("PODACIUM_REAL_DB") != "1":
    pytest.skip(
        "Real-DB integration tests require PODACIUM_REAL_DB=1 "
        "(see tests/integration/conftest.py)",
        allow_module_level=True,
    )


@pytest.fixture(autouse=True)
async def _clean_db():
    """Truncate all public tables before each test for deterministic isolation.

    Function-scoped and runs on the same event loop as the test.
    """
    from app.core.prisma import prisma

    if prisma.is_connected():
        await prisma.disconnect()
    await prisma.connect()
    tables = await prisma.query_raw(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    )
    if tables:
        names = ", ".join(f'"{t["tablename"]}"' for t in tables)
        await prisma.execute_raw(f"TRUNCATE TABLE {names} RESTART IDENTITY CASCADE")
    yield


@pytest.fixture()
async def prisma():
    """Real Prisma client connected to the test database.

    pytest-asyncio creates a fresh event loop per test, so the client must be
    disconnected and reconnected inside each test's own loop.
    """
    from app.core.prisma import prisma

    if prisma.is_connected():
        await prisma.disconnect()
    await prisma.connect()
    yield prisma
    if prisma.is_connected():
        await prisma.disconnect()


@pytest.fixture()
async def make_user(prisma):
    """Create a User row and return its id (avoids FK errors on Wallet/Booking)."""
    from app.generated.prisma import enums

    async def _make(email: str = "u@podacium.com") -> int:
        user = await prisma.user.create(
            data={
                "email": f"{email}",
                "fullName": "Integration User",
                "role": enums.UserRole.STUDENT,
                "acceptedTerms": True,
            }
        )
        return user.id

    return _make