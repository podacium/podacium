"""Tests for dashboard endpoints using a standalone FastAPI app."""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport

SECTION = "app.routers.dashboard"


def make_mock_user(**overrides):
    base = dict(id=1, email="test@podacium.com", role="STUDENT", profileViewCount=42)
    base.update(overrides)
    obj = MagicMock(spec=[])
    for k, v in base.items():
        setattr(obj, k, v)
    return obj


def mock_prisma():
    mp = MagicMock()
    mp.enrollment.count = AsyncMock(return_value=0)
    mp.enrollment.find_many = AsyncMock(return_value=[])
    mp.lessonprogress.aggregate = AsyncMock()
    mp.lessonprogress.find_many = AsyncMock(return_value=[])
    mp.quizattempt.aggregate = AsyncMock()
    mp.quizattempt.find_many = AsyncMock(return_value=[])
    mp.certificate.count = AsyncMock(return_value=0)
    mp.certificate.find_many = AsyncMock(return_value=[])
    mp.studentprofile.find_unique = AsyncMock()
    mp.module.count = AsyncMock(return_value=0)
    mp.module.find_many = AsyncMock(return_value=[])
    mp.coursereview.find_many = AsyncMock(return_value=[])
    mp.proposal.count = AsyncMock(return_value=0)
    mp.proposal.find_many = AsyncMock(return_value=[])
    mp.contract.count = AsyncMock(return_value=0)
    mp.contract.find_many = AsyncMock(return_value=[])
    mp.freelancerprofile.find_unique = AsyncMock()
    mp.dataset.count = AsyncMock(return_value=0)
    mp.dataset.find_many = AsyncMock(return_value=[])
    mp.mlmodel.count = AsyncMock(return_value=0)
    mp.mlmodel.find_many = AsyncMock(return_value=[])
    mp.dashboard.count = AsyncMock(return_value=0)
    mp.dashboard.find_many = AsyncMock(return_value=[])
    mp.userfollow.count = AsyncMock(return_value=0)
    mp.userfollow.find_many = AsyncMock(return_value=[])
    mp.wallet.find_unique = AsyncMock(return_value=None)
    mp.wallettransaction.find_many = AsyncMock(return_value=[])
    return mp


@pytest.fixture
def app_no_auth():
    from app.routers.dashboard import router

    test_app = FastAPI()
    test_app.include_router(router, prefix="/api/v1")
    return test_app


@pytest.fixture
def app_with_auth(app_no_auth):
    from app.core.auth import get_current_active_user

    app_no_auth.dependency_overrides[get_current_active_user] = lambda: make_mock_user()
    yield app_no_auth
    app_no_auth.dependency_overrides = {}


@pytest.fixture
def client(app_no_auth):
    transport = ASGITransport(app=app_no_auth)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.fixture
def auth_client(app_with_auth):
    transport = ASGITransport(app=app_with_auth)
    return AsyncClient(transport=transport, base_url="http://test")


def make_dashboard_svc():
    from app.schemas.dashboard import (
        DashboardResponse,
        ViewConfig,
        DashboardState,
        DashboardStats,
        RecentActivity,
    )

    svc = MagicMock()
    svc.get_user_dashboard = AsyncMock(
        return_value=DashboardResponse(
            role="STUDENT",
            view_config=ViewConfig(),
            state=DashboardState(
                user_stats=DashboardStats(
                    total_courses=5,
                    completed_courses=2,
                    active_projects=1,
                    completed_projects=3,
                    datasets_count=0,
                    certifications_count=1,
                    total_earnings=0.0,
                    skill_level="Intermediate",
                ),
                recent_activities=[
                    RecentActivity(
                        id=1,
                        type="course",
                        title="Python 101",
                        description="Started course",
                        timestamp=datetime(2025, 1, 1),
                    ),
                ],
            ),
        )
    )
    return svc


class TestMainDashboard:
    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        resp = await client.get("/api/v1/dashboard")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_dashboard(self, auth_client):
        svc = make_dashboard_svc()
        with patch(f"{SECTION}.dashboard_service", svc):
            resp = await auth_client.get("/api/v1/dashboard")
        assert resp.status_code == 200
        assert resp.json()["state"]["user_stats"]["total_courses"] == 5

    @pytest.mark.asyncio
    async def test_value_error(self, auth_client):
        svc = MagicMock()
        svc.get_user_dashboard = AsyncMock(side_effect=ValueError("bad input"))
        with patch(f"{SECTION}.dashboard_service", svc):
            resp = await auth_client.get("/api/v1/dashboard")
        assert resp.status_code == 400


class TestQuickStats:
    @pytest.mark.asyncio
    async def test_returns(self, auth_client):
        svc = make_dashboard_svc()
        with patch(f"{SECTION}.dashboard_service", svc):
            resp = await auth_client.get("/api/v1/dashboard/quick-stats")
        assert resp.status_code == 200
        assert resp.json()["stats"]["skill_level"] == "Intermediate"

    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        resp = await client.get("/api/v1/dashboard/quick-stats")
        assert resp.status_code == 401


class TestActivities:
    @pytest.mark.asyncio
    async def test_returns(self, auth_client):
        svc = make_dashboard_svc()
        with patch(f"{SECTION}.dashboard_service", svc):
            resp = await auth_client.get("/api/v1/dashboard/activities")
        assert resp.status_code == 200
        assert len(resp.json()["activities"]) == 1

    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        assert (await client.get("/api/v1/dashboard/activities")).status_code == 401


class TestLearning:
    @pytest.mark.asyncio
    async def test_stats(self, auth_client):
        mp = mock_prisma()
        mp.lessonprogress.aggregate.return_value = MagicMock(
            _avg=MagicMock(progress=75.0)
        )
        mp.quizattempt.aggregate.return_value = MagicMock(_avg=MagicMock(score=85.0))
        mp.studentprofile.find_unique.return_value = MagicMock(
            spec=["totalLearningHours"], totalLearningHours=120
        )
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/learning")
        assert resp.status_code == 200
        assert resp.json()["total_learning_hours"] == 120

    @pytest.mark.asyncio
    async def test_progress_empty(self, auth_client):
        mp = mock_prisma()
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/learning/progress")
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_progress_with_data(self, auth_client):
        mp = mock_prisma()
        enrollment = MagicMock(
            spec=["module", "progress", "completedAt", "moduleId", "updatedAt"]
        )
        enrollment.module = MagicMock(
            spec=["title", "totalLessons"], title="Python 101", totalLessons=10
        )
        enrollment.progress = 50
        enrollment.completedAt = None
        enrollment.moduleId = 1
        enrollment.updatedAt = datetime(2025, 1, 1)
        mp.enrollment.find_many.return_value = [enrollment]
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/learning/progress")
        assert resp.json()[0]["modules_completed"] == 5

    @pytest.mark.asyncio
    async def test_quiz_performance(self, auth_client):
        mp = mock_prisma()
        attempt = MagicMock(spec=["quiz", "score", "isPassed", "completedAt", "quizId"])
        attempt.quiz = MagicMock(spec=["title"], title="Quiz 1")
        attempt.score = 90
        attempt.isPassed = True
        attempt.completedAt = datetime(2025, 1, 1)
        attempt.quizId = 1
        mp.quizattempt.find_many.return_value = [attempt]
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/learning/quiz-performance")
        assert resp.json()[0]["passed"] is True

    @pytest.mark.asyncio
    async def test_time_spent(self, auth_client):
        mp = mock_prisma()
        progress = MagicMock(spec=["lesson", "isCompleted", "createdAt"])
        progress.lesson = MagicMock(spec=["durationMinutes"], durationMinutes=30)
        progress.isCompleted = True
        progress.createdAt = datetime(2025, 1, 15, tzinfo=timezone.utc)
        mp.lessonprogress.find_many.return_value = [progress]
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/learning/time-spent")
        assert resp.json()["total_minutes"] == 30

    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        for p in (
            "/api/v1/dashboard/learning",
            "/api/v1/dashboard/learning/progress",
            "/api/v1/dashboard/learning/quiz-performance",
            "/api/v1/dashboard/learning/time-spent",
        ):
            assert (await client.get(p)).status_code == 401


class TestTeaching:
    @pytest.mark.asyncio
    async def test_stats(self, auth_client):
        mp = mock_prisma()
        mp.module.count.return_value = 3
        mp.coursereview.find_many.return_value = [
            MagicMock(rating=4),
            MagicMock(rating=5),
        ]
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/teaching")
        assert resp.json()["average_rating"] == 4.5

    @pytest.mark.asyncio
    async def test_students(self, auth_client):
        mp = mock_prisma()
        e = MagicMock(spec=["createdAt", "userId"])
        e.createdAt = datetime(2025, 6, 1, tzinfo=timezone.utc)
        e.userId = 42
        mp.enrollment.find_many.return_value = [e]
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/teaching/students")
        assert resp.json()[0]["new_students"] == 1

    @pytest.mark.asyncio
    async def test_revenue(self, auth_client):
        resp = await auth_client.get("/api/v1/dashboard/teaching/revenue")
        assert resp.json()["total"] == 0

    @pytest.mark.asyncio
    async def test_revenue_with_creator_royalties(self, auth_client):
        mp = mock_prisma()
        mock_wallet = MagicMock(id=10, userId=1)
        tx1 = MagicMock(
            amount=4000,
            createdAt=datetime(2026, 10, 15, tzinfo=timezone.utc),
            metadata={"course_id": "course-101", "course_title": "FastAPI Mastery"},
            description="Royalty for course purchase: FastAPI Mastery",
        )
        tx2 = MagicMock(
            amount=6000,
            createdAt=datetime(2026, 10, 16, tzinfo=timezone.utc),
            metadata={"course_id": "course-102", "course_title": "React 19 Deep Dive"},
            description="Royalty for course purchase: React 19 Deep Dive",
        )
        mp.wallet.find_unique.return_value = mock_wallet
        mp.wallettransaction.find_many.return_value = [tx1, tx2]
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/teaching/revenue")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 10000
        assert len(data["by_course"]) == 2
        assert data["by_course"][0]["amount"] == 6000
        assert data["by_month"][0]["month"] == "2026-10"
        assert data["by_month"][0]["amount"] == 10000

    @pytest.mark.asyncio
    async def test_reviews(self, auth_client):
        mp = mock_prisma()
        mock_user = MagicMock(spec=[])
        mock_user.fullName = "Student A"
        mock_mod = MagicMock(spec=[])
        mock_mod.title = "Python 101"
        r = MagicMock(spec=[])
        r.id = 1
        r.rating = 5
        r.comment = "Great!"
        r.createdAt = datetime(2025, 1, 1)
        r.user = mock_user
        r.module = mock_mod
        mp.coursereview.find_many.return_value = [r]
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/teaching/reviews")
        assert resp.json()["average_rating"] == 5.0

    @pytest.mark.asyncio
    async def test_engagement(self, auth_client):
        mp = mock_prisma()
        e = MagicMock(spec=["completedAt", "progress"])
        e.completedAt = datetime(2025, 1, 1)
        e.progress = 100
        mp.enrollment.find_many.return_value = [e]
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/teaching/engagement")
        assert resp.json()["average_completion_rate"] == 100.0

    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        for p in (
            "/api/v1/dashboard/teaching",
            "/api/v1/dashboard/teaching/students",
            "/api/v1/dashboard/teaching/revenue",
            "/api/v1/dashboard/teaching/reviews",
            "/api/v1/dashboard/teaching/engagement",
        ):
            assert (await client.get(p)).status_code == 401


class TestFreelancing:
    @pytest.mark.asyncio
    async def test_stats(self, auth_client):
        mp = mock_prisma()
        mp.freelancerprofile.find_unique.return_value = MagicMock(
            spec=["completedProjects", "totalEarned"],
            completedProjects=10,
            totalEarned=5000.0,
        )
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/freelancing")
        assert resp.json()["total_earnings"] == 5000.0

    @pytest.mark.asyncio
    async def test_earnings(self, auth_client):
        resp = await auth_client.get("/api/v1/dashboard/freelancing/earnings")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_proposals(self, auth_client):
        mp = mock_prisma()
        mock_proj = MagicMock(spec=[])
        mock_proj.title = "Build a website"
        p = MagicMock(spec=[])
        p.id = 1
        p.project = mock_proj
        p.status = "PENDING"
        p.amount = 1000.0
        p.createdAt = datetime(2025, 1, 1, tzinfo=timezone.utc)
        mp.proposal.find_many.return_value = [p]
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/freelancing/proposals")
        assert resp.json()["recent"][0]["project_title"] == "Build a website"

    @pytest.mark.asyncio
    async def test_projects(self, auth_client):
        mp = mock_prisma()
        c = MagicMock(spec=["status"])
        c.status = "ACTIVE"
        mp.contract.find_many.return_value = [c]
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/freelancing/projects")
        assert resp.json()["active"] == 1

    @pytest.mark.asyncio
    async def test_clients(self, auth_client):
        mp = mock_prisma()
        c = MagicMock(spec=["clientId"])
        c.clientId = 99
        mp.contract.find_many.return_value = [c]
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/freelancing/clients")
        assert resp.json()["total"] == 1

    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        for p in (
            "/api/v1/dashboard/freelancing",
            "/api/v1/dashboard/freelancing/earnings",
            "/api/v1/dashboard/freelancing/proposals",
            "/api/v1/dashboard/freelancing/projects",
            "/api/v1/dashboard/freelancing/clients",
        ):
            assert (await client.get(p)).status_code == 401


class TestBusiness:
    @pytest.mark.asyncio
    async def test_stats(self, auth_client):
        mp = mock_prisma()
        mp.dataset.count.return_value = 2
        mp.mlmodel.count.return_value = 1
        mp.dashboard.count.return_value = 3
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/business")
        assert resp.json()["total_datasets"] == 2

    @pytest.mark.asyncio
    async def test_dashboards(self, auth_client):
        mp = mock_prisma()
        d = MagicMock(
            spec=[
                "id",
                "title",
                "description",
                "isPublic",
                "widgets",
                "createdAt",
                "updatedAt",
            ]
        )
        d.id = 1
        d.title = "Sales Dashboard"
        d.description = "Desc"
        d.isPublic = True
        d.widgets = [MagicMock(), MagicMock()]
        d.createdAt = datetime(2025, 1, 1, tzinfo=timezone.utc)
        d.updatedAt = datetime(2025, 1, 2, tzinfo=timezone.utc)
        mp.dashboard.find_many.return_value = [d]
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/business/dashboards")
        assert resp.json()[0]["widget_count"] == 2

    @pytest.mark.asyncio
    async def test_datasets(self, auth_client):
        mp = mock_prisma()
        ds = MagicMock(
            spec=[
                "id",
                "name",
                "description",
                "format",
                "rowCount",
                "columnCount",
                "processingStatus",
                "createdAt",
            ]
        )
        ds.id = 1
        ds.name = "Users"
        ds.format = "CSV"
        ds.rowCount = 1000
        ds.columnCount = 10
        ds.processingStatus = "COMPLETED"
        ds.createdAt = datetime(2025, 1, 1, tzinfo=timezone.utc)
        mp.dataset.find_many.return_value = [ds]
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/business/datasets")
        assert resp.json()[0]["name"] == "Users"

    @pytest.mark.asyncio
    async def test_ml_models(self, auth_client):
        mp = mock_prisma()
        mock_ds = MagicMock(spec=[])
        mock_ds.name = "Users"
        m = MagicMock(spec=[])
        m.id = 1
        m.name = "Classifier"
        m.type = "classification"
        m.dataset = mock_ds
        m.metrics = {"accuracy": 0.95}
        m.createdAt = datetime(2025, 1, 1, tzinfo=timezone.utc)
        mp.mlmodel.find_many.return_value = [m]
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/business/ml-models")
        assert resp.json()[0]["dataset_name"] == "Users"

    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        for p in (
            "/api/v1/dashboard/business",
            "/api/v1/dashboard/business/dashboards",
            "/api/v1/dashboard/business/datasets",
            "/api/v1/dashboard/business/ml-models",
        ):
            assert (await client.get(p)).status_code == 401


class TestProfile:
    @pytest.mark.asyncio
    async def test_performance(self, auth_client):
        mp = mock_prisma()
        mp.userfollow.count.return_value = 5
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/profile")
        assert resp.json()["total_views"] == 42
        assert resp.json()["total_follows"] == 5

    @pytest.mark.asyncio
    async def test_views(self, auth_client):
        resp = await auth_client.get("/api/v1/dashboard/profile/views")
        assert resp.json()["total"] == 42

    @pytest.mark.asyncio
    async def test_followers(self, auth_client):
        mp = mock_prisma()
        mp.userfollow.count.return_value = 3
        mock_flwr = MagicMock(spec=[])
        mock_flwr.fullName = "Follower One"
        f = MagicMock(spec=[])
        f.id = 1
        f.followerId = 42
        f.follower = mock_flwr
        f.createdAt = datetime(2025, 1, 1, tzinfo=timezone.utc)
        mp.userfollow.find_many.return_value = [f]
        with patch(f"{SECTION}.prisma", mp):
            resp = await auth_client.get("/api/v1/dashboard/profile/followers")
        assert resp.json()["total"] == 3

    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        for p in (
            "/api/v1/dashboard/profile",
            "/api/v1/dashboard/profile/views",
            "/api/v1/dashboard/profile/followers",
        ):
            assert (await client.get(p)).status_code == 401


class TestFinancial:
    @pytest.mark.asyncio
    async def test_overview(self, auth_client):
        resp = await auth_client.get("/api/v1/dashboard/financial")
        assert resp.json()["total_revenue"] == 0

    @pytest.mark.asyncio
    async def test_revenue(self, auth_client):
        resp = await auth_client.get("/api/v1/dashboard/financial/revenue")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_payouts(self, auth_client):
        resp = await auth_client.get("/api/v1/dashboard/financial/payouts")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_tax(self, auth_client):
        resp = await auth_client.get("/api/v1/dashboard/financial/tax")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_requires_auth(self, client):
        for p in (
            "/api/v1/dashboard/financial",
            "/api/v1/dashboard/financial/revenue",
            "/api/v1/dashboard/financial/payouts",
            "/api/v1/dashboard/financial/tax",
        ):
            assert (await client.get(p)).status_code == 401
