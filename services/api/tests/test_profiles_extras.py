"""Tests for profiles_extras endpoints using a standalone FastAPI app."""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport


SCOPE = "app.routers.profiles_extras"


def make_mock_user(**overrides):
    base = dict(
        id=1,
        email="test@podacium.com",
        fullName="Test User",
        username="testuser",
        role="STUDENT",
        emailVerified=True,
        phoneVerified=False,
        isActive=True,
        isDeactivated=False,
        bio="Hello",
        headline="Dev",
        tagline=None,
        pronouns=None,
        displayName=None,
        coverImageUrl=None,
        socialLinks=None,
        availability=None,
        profilePictureUrl=None,
        country=None,
        city=None,
        skills=[],
        profileViewCount=0,
        deletedAt=None,
        deactivatedAt=None,
        bio_visibility="public",
        headline_visibility="public",
        tagline_visibility="public",
        pronouns_visibility="public",
        cover_image_visibility="public",
        location_visibility="public",
        social_links_visibility="public",
        availability_visibility="public",
        timezone_visibility="public",
        profile_view_count_visibility="public",
        last_active_visibility="public",
        followers_visibility="public",
        following_visibility="public",
        badges_visibility="public",
        skills_visibility="public",
        activity_feed_visibility="public",
        username_history_visibility="public",
    )
    base.update(overrides)
    obj = MagicMock(spec=[])
    for k, v in base.items():
        setattr(obj, k, v)
    return obj


def mock_prisma():
    mp = MagicMock()
    mp.user.find_unique = AsyncMock()
    mp.user.update = AsyncMock()
    mp.privacysettings.find_unique = AsyncMock()
    mp.privacysettings.upsert = AsyncMock()
    mp.freelancerprofile.find_unique = AsyncMock()
    mp.freelancerprofile.update = AsyncMock()
    mp.studentprofile.find_unique = AsyncMock()
    mp.instructorprofile.find_unique = AsyncMock()
    mp.instructorprofile.update = AsyncMock()
    mp.usernameredirect.find_many = AsyncMock(return_value=[])
    mp.certificate.find_many = AsyncMock(return_value=[])
    mp.enrollment.find_many = AsyncMock(return_value=[])
    mp.enrollment.count = AsyncMock(return_value=0)
    mp.project.find_many = AsyncMock(return_value=[])
    mp.proposal.find_many = AsyncMock(return_value=[])
    return mp


@pytest.fixture
def app_with_auth():
    from app.routers.profiles_extras import router

    test_app = FastAPI()
    test_app.include_router(router)
    yield test_app


@pytest.fixture
def client(app_with_auth):
    transport = ASGITransport(app=app_with_auth)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.fixture
def client_auth(app_with_auth):
    from app.core.auth import get_current_user

    app_with_auth.dependency_overrides[get_current_user] = lambda: make_mock_user()
    transport = ASGITransport(app=app_with_auth)
    yield AsyncClient(transport=transport, base_url="http://test")
    app_with_auth.dependency_overrides = {}


# ── PRIVACY SECTIONS ─────────────────────────────────────────────


class TestPrivacySections:
    @pytest.mark.asyncio
    async def test_get_requires_auth(self, client):
        resp = await client.get("/profiles/me/privacy/sections")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_get_returns_visibility_fields(self, client_auth):
        mp = mock_prisma()
        privacy_mock = MagicMock(showBio="PUBLIC")
        mp.privacysettings.find_unique.return_value = privacy_mock
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.get("/profiles/me/privacy/sections")
        assert resp.status_code == 200
        assert resp.json()["bio_visibility"] == "public"

    @pytest.mark.asyncio
    async def test_get_404(self, client_auth):
        mp = mock_prisma()
        mp.privacysettings.find_unique.return_value = None
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.get("/profiles/me/privacy/sections")
        assert resp.status_code == 200
        assert resp.json()["bio_visibility"] == "public"

    @pytest.mark.asyncio
    async def test_patch_section(self, client_auth):
        mp = mock_prisma()
        privacy_mock = MagicMock(showBio="PRIVATE")
        mp.privacysettings.find_unique.return_value = privacy_mock
        mp.privacysettings.upsert.return_value = privacy_mock
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.patch(
                "/profiles/me/privacy/sections",
                json={"bio_visibility": "private"},
            )
        assert resp.status_code == 200
        assert resp.json()["bio_visibility"] == "private"

    @pytest.mark.asyncio
    async def test_patch_invalid_value(self, client_auth):
        mp = mock_prisma()
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.patch(
                "/profiles/me/privacy/sections",
                json={"bio_visibility": "invalid"},
            )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_patch_empty_body(self, client_auth):
        mp = mock_prisma()
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.patch(
                "/profiles/me/privacy/sections",
                json={},
            )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_patch_requires_auth(self, client):
        resp = await client.patch(
            "/profiles/me/privacy/sections", json={"bio_visibility": "private"}
        )
        assert resp.status_code == 401


class TestProfileEdit:
    @pytest.mark.asyncio
    async def test_put_updates_bio(self, client_auth):
        mp = mock_prisma()
        mp.user.update.return_value = make_mock_user(bio="New bio")
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.put("/profiles/me", json={"bio": "New bio"})
        assert resp.status_code == 200
        assert resp.json()["bio"] == "New bio"

    @pytest.mark.asyncio
    async def test_put_empty_body(self, client_auth):
        mp = mock_prisma()
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.put("/profiles/me", json={})
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_put_requires_auth(self, client):
        resp = await client.put("/profiles/me", json={"bio": "test"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_patch_is_alias(self, client_auth):
        mp = mock_prisma()
        mp.user.update.return_value = make_mock_user(headline="CTO")
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.patch("/profiles/me", json={"headline": "CTO"})
        assert resp.status_code == 200
        assert resp.json()["headline"] == "CTO"


def make_fp_mock(**overrides):
    fp = MagicMock(spec=[])
    fp.id = 1
    fp.userId = 1
    fp.tier = "basic"
    fp.metadata = {}
    fp.totalEarned = 0.0
    fp.completedProjects = 0
    fp.isVerified = False
    fp.isPremium = False
    fp.skillPassportVerified = False
    fp.createdAt = datetime(2025, 1, 1, tzinfo=timezone.utc)
    for k, v in overrides.items():
        setattr(fp, k, v)
    return fp


class TestFreelancerProfile:
    @pytest.mark.asyncio
    async def test_get(self, client):
        mp = mock_prisma()
        mp.freelancerprofile.find_unique.return_value = make_fp_mock()
        with (
            patch(f"{SCOPE}.prisma", mp),
            patch(
                f"{SCOPE}.profile_service.resolve_profile",
                new_callable=AsyncMock,
                return_value=make_mock_user(),
            ),
        ):
            resp = await client.get("/profiles/testuser/freelancer")
        assert resp.status_code == 200
        assert resp.json()["user_id"] == 1

    @pytest.mark.asyncio
    async def test_get_404_user(self, client):
        with patch(
            f"{SCOPE}.profile_service.resolve_profile",
            new_callable=AsyncMock,
            return_value=None,
        ):
            resp = await client.get("/profiles/nobody/freelancer")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_404_fp(self, client):
        mp = mock_prisma()
        mp.freelancerprofile.find_unique.return_value = None
        with (
            patch(f"{SCOPE}.prisma", mp),
            patch(
                f"{SCOPE}.profile_service.resolve_profile",
                new_callable=AsyncMock,
                return_value=make_mock_user(),
            ),
        ):
            resp = await client.get("/profiles/testuser/freelancer")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_no_freelancer(self, client_auth):
        mp = mock_prisma()
        mp.freelancerprofile.find_unique.return_value = None
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.put(
                "/profiles/me/freelancer", json={"headline": "Expert"}
            )
        assert resp.status_code == 404


class TestProfileCompletion:
    @pytest.mark.asyncio
    async def test_returns_fields(self, client_auth):
        mp = mock_prisma()
        mp.user.find_unique.return_value = make_mock_user()
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.get("/profiles/me/completion")
        assert resp.status_code == 200
        assert "completion_pct" in resp.json()

    @pytest.mark.asyncio
    async def test_404(self, client_auth):
        mp = mock_prisma()
        mp.user.find_unique.return_value = None
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.get("/profiles/me/completion")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        resp = await client.get("/profiles/me/completion")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_full_score(self, client_auth):
        mp = mock_prisma()
        mp.user.find_unique.return_value = make_mock_user(
            fullName="Full",
            bio="Bio",
            headline="Dev",
            profilePictureUrl="/img.png",
            socialLinks={"gh": "x"},
            country="US",
            city="NYC",
            skills=["Python"],
            username="full",
            coverImageUrl="/c.png",
            pronouns="they",
            tagline="short",
        )
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.get("/profiles/me/completion")
        assert resp.json()["completion_pct"] == 95.0

    @pytest.mark.asyncio
    async def test_zero_score(self, client_auth):
        mp = mock_prisma()
        mp.user.find_unique.return_value = make_mock_user(
            fullName=None,
            bio=None,
            headline=None,
            profilePictureUrl=None,
            socialLinks=None,
            country=None,
            city=None,
            skills=None,
            username=None,
            coverImageUrl=None,
            pronouns=None,
            tagline=None,
        )
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.get("/profiles/me/completion")
        assert resp.json()["completion_pct"] == 0.0


class TestBadges:
    @pytest.mark.asyncio
    async def test_badges(self, client):
        mp = mock_prisma()
        mp.studentprofile.find_unique.return_value = MagicMock(
            badges=[{"type": "gold", "name": "Gold"}]
        )
        mp.freelancerprofile.find_unique.return_value = MagicMock(
            skillPassportVerified=True, isPremium=True
        )
        mp.enrollment.count.return_value = 10
        with (
            patch(f"{SCOPE}.prisma", mp),
            patch(
                f"{SCOPE}.profile_service.resolve_profile",
                new_callable=AsyncMock,
                return_value=make_mock_user(emailVerified=True, phoneVerified=True),
            ),
        ):
            resp = await client.get("/profiles/testuser/badges")
        assert resp.status_code == 200
        assert len(resp.json()["computed_badges"]) >= 3

    @pytest.mark.asyncio
    async def test_badges_404(self, client):
        with patch(
            f"{SCOPE}.profile_service.resolve_profile",
            new_callable=AsyncMock,
            return_value=None,
        ):
            resp = await client.get("/profiles/nobody/badges")
        assert resp.status_code == 404


class TestActivity:
    @pytest.mark.asyncio
    async def test_returns_list(self, client):
        mp = mock_prisma()
        with (
            patch(f"{SCOPE}.prisma", mp),
            patch(
                f"{SCOPE}.profile_service.resolve_profile",
                new_callable=AsyncMock,
                return_value=make_mock_user(),
            ),
        ):
            resp = await client.get("/profiles/testuser/activity")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_returns_404(self, client):
        with patch(
            f"{SCOPE}.profile_service.resolve_profile",
            new_callable=AsyncMock,
            return_value=None,
        ):
            resp = await client.get("/profiles/nobody/activity")
        assert resp.status_code == 404


class TestUsernameHistory:
    @pytest.mark.asyncio
    async def test_empty(self, client_auth):
        mp = mock_prisma()
        mp.usernameredirect.find_many.return_value = []
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.get("/profiles/me/username/history")
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        resp = await client.get("/profiles/me/username/history")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_with_entries(self, client_auth):
        mp = mock_prisma()
        redirect = MagicMock()
        redirect.oldUsername = "oldname"
        redirect.changedAt = datetime(2025, 1, 1, tzinfo=timezone.utc)
        redirect.expiresAt = datetime(2025, 4, 1, tzinfo=timezone.utc)
        mp.usernameredirect.find_many.return_value = [redirect]
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.get("/profiles/me/username/history")
        assert resp.json()[0]["old_username"] == "oldname"


class TestInstructorCredentials:
    @pytest.mark.asyncio
    async def test_add(self, client_auth):
        mp = mock_prisma()
        mp.instructorprofile.find_unique.return_value = MagicMock(
            userId=1, credentials=[{"id": 1, "name": "PhD"}]
        )
        mp.instructorprofile.update.return_value = None
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.post(
                "/profiles/me/instructor/credentials",
                json={"type": "degree", "title": "MSc"},
            )
        assert resp.status_code == 200
        assert resp.json()["title"] == "MSc"

    @pytest.mark.asyncio
    async def test_add_no_instructor(self, client_auth):
        mp = mock_prisma()
        mp.instructorprofile.find_unique.return_value = None
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.post(
                "/profiles/me/instructor/credentials",
                json={"type": "degree", "title": "MSc"},
            )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete(self, client_auth):
        mp = mock_prisma()
        mp.instructorprofile.find_unique.return_value = MagicMock(
            userId=1, credentials=[{"id": 1, "name": "PhD"}]
        )
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.delete("/profiles/me/instructor/credentials/1")
        assert resp.status_code == 200
        assert resp.json()["credential_id"] == 1

    @pytest.mark.asyncio
    async def test_delete_not_found(self, client_auth):
        mp = mock_prisma()
        mp.instructorprofile.find_unique.return_value = MagicMock(
            userId=1, credentials=[{"id": 1, "name": "PhD"}]
        )
        with patch(f"{SCOPE}.prisma", mp):
            resp = await client_auth.delete("/profiles/me/instructor/credentials/99")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        assert (
            await client.post(
                "/profiles/me/instructor/credentials", json={"name": "MSc"}
            )
        ).status_code == 401
        assert (
            await client.delete("/profiles/me/instructor/credentials/1")
        ).status_code == 401
