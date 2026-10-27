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
        p.stop()

async def _client():
    from app.main import app
    from httpx import AsyncClient, ASGITransport
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

@pytest.mark.asyncio
async def test_seq_full():
    from app.routers.auth import prisma as rp
    from app.services.auth_service import prisma as sp
    from app.services.totp_service import prisma as tp
    tp.securitysettings = MagicMock()
    tp.securitysettings.find_unique = AsyncMock(return_value=None)
    sp.user = MagicMock()
    sp.user.find_first = AsyncMock(return_value=None)
    sp.user.create = AsyncMock(return_value=u)
    sp.usersettings = MagicMock(); sp.usersettings.create = AsyncMock(return_value=None)
    sp.authtoken = MagicMock(); sp.authtoken.create = AsyncMock(return_value=None)
    async with await _client() as c:
        r = await c.post("/api/v1/auth/register", json={"email":"alice@podacium.com","password":"StrongP@ss1","fullName":"Alice","acceptedTerms":True,"locale":"en"})
        print("REGISTER", r.status_code)
    fake_tokens = {"tokens": {"access_token": create_access_token_for_user(1), "refresh_token": create_refresh_token_for_user(1)}, "user_id": 1}
    with patch('app.routers.auth.auth_service.verify_email', new=AsyncMock(return_value=fake_tokens)):
        async with await _client() as c:
            r = await c.post("/api/v1/auth/verify-email", json={"token":"valid"})
            print("VERIFY", r.status_code)
    rp.user = MagicMock()
    rp.user.find_unique = AsyncMock(return_value=u)
    rp.user.update = AsyncMock(return_value=u)
    async with await _client() as c:
        r = await c.post("/api/v1/auth/login", json={"email":"alice@podacium.com","password":"StrongP@ss1"})
        print("LOGIN", r.status_code)
        print("SC:", [h.split(";")[0] for h in r.headers.get_list("set-cookie")])
        print("JAR:", {x.name for x in c.cookies.jar})
