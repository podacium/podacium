import datetime, pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.core.security import get_password_hash, create_access_token_for_user, create_refresh_token_for_user

class MockUser:
    def __init__(self, **kw): [setattr(self,k,v) for k,v in kw.items()]

u = MockUser(id=1, email="alice@podacium.com", fullName="Alice", role="STUDENT",
    emailVerified=True, isActive=True, isDeactivated=False, deletedAt=None,
    deactivatedAt=None, onboardingCompleted=False, passwordHash=get_password_hash("StrongP@ss1"),
    createdAt=datetime.datetime.now(datetime.timezone.utc), updatedAt=datetime.datetime.now(datetime.timezone.utc), lastLoginAt=None)

@pytest.fixture(autouse=True)
def mock_all():
    for p in [patch('app.services.auth_service.prisma'), patch('app.routers.auth.prisma'),
              patch('app.services.totp_service.prisma'), patch('app.services.email_otp_service.prisma')]:
        p.start()
    yield
    for p in [patch('app.services.auth_service.prisma'), patch('app.routers.auth.prisma'),
              patch('app.services.totp_service.prisma'), patch('app.services.email_otp_service.prisma')]:
        pass

async def _client():
    from app.main import app
    from httpx import AsyncClient, ASGITransport
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

@pytest.mark.asyncio
async def test_login_with_all_deps_patched():
    from app.routers.auth import prisma as rp
    rp.user = MagicMock()
    rp.user.find_unique = AsyncMock(return_value=u)
    rp.user.update = AsyncMock(return_value=u)
    async with await _client() as c:
        r = await c.post("/api/v1/auth/login", json={"email":"alice@podacium.com","password":"StrongP@ss1"})
        print("STATUS", r.status_code, r.text[:80])
        for h in r.headers.get_list("set-cookie"):
            print("SC:", h.split(";")[0])
        print("JAR:", {x.name for x in c.cookies.jar})
