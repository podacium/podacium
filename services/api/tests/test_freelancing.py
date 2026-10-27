"""
Tests for freelancing service.
Tests actual business logic with mocked Prisma client.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.services.freelancing_service import FreelanceService
from app.schemas.freelancing import (
    ProjectCreate, ProposalCreate,
    DisputeCreate,
)


@pytest.fixture
def mock_prisma():
    with patch('app.services.freelancing_service.prisma') as mock:
        yield mock


@pytest.fixture
def mock_cache():
    with patch('app.services.freelancing_service.cache') as mock:
        mock.get.return_value = None
        yield mock


@pytest.fixture
def mock_feature_service():
    with patch('app.services.freelancing_service.feature_service') as mock:
        mock.consume_project_post = AsyncMock()
        yield mock


# ======================
# PROJECT TESTS
# ======================

class TestCreateProject:
    """Test project creation business logic."""

    async def test_creates_project_successfully(self, mock_prisma, mock_cache, mock_feature_service):
        with patch.object(FreelanceService, '_can_act_as_client', new_callable=AsyncMock, return_value=True):
            mock_prisma.project.create = AsyncMock(return_value=MagicMock(
                id=1, title="Build a website", description="Need a site",
                ownerId=42, skills=["react"], status="OPEN",
                createdAt=datetime.now(timezone.utc), updatedAt=datetime.now(timezone.utc),
            ))
            mock_prisma.user.find_unique = AsyncMock(return_value=MagicMock(
                id=42, fullName="Test User", profilePictureUrl=None,
                country="ALGERIA", city="ALGIERS", phoneVerified=True,
            ))

            result = await FreelanceService.create_project(
                ProjectCreate(title="Build a website", description="Need a site", skills=["react"]),
                client_id=42,
            )

            assert result["title"] == "Build a website"
            assert result["status"] == "OPEN"
            assert result["owner"]["id"] == 42
            mock_feature_service.consume_project_post.assert_awaited_once_with(42)

    async def test_rejects_non_client_role(self, mock_prisma, mock_cache, mock_feature_service):
        with patch.object(FreelanceService, '_can_act_as_client', new_callable=AsyncMock, return_value=False):
            with pytest.raises(ValueError, match="ne peut pas publier"):
                await FreelanceService.create_project(
                    ProjectCreate(title="Test", description="Test", skills=[]),
                    client_id=1,
                )

    async def test_rejects_empty_title(self, mock_prisma, mock_cache, mock_feature_service):
        with pytest.raises(Exception):
            await FreelanceService.create_project(
                ProjectCreate(title="", description="Test", skills=[]),
                client_id=1,
            )


# ======================
# PROPOSAL TESTS
# ======================

class TestSubmitProposal:
    """Test proposal submission business logic."""

    async def test_submits_proposal_successfully(self, mock_prisma, mock_cache):
        with patch.object(FreelanceService, '_can_act_as_freelancer', new_callable=AsyncMock, return_value=True):
            mock_project = MagicMock(id=1, status="OPEN", ownerId=99)
            mock_prisma.project.find_unique = AsyncMock(return_value=mock_project)
            mock_prisma.proposal.find_first = AsyncMock(return_value=None)

            mock_proposal = MagicMock(
                id=5, projectId=1, freelancerId=42, message="I can do this",
                amount=50000, status="PENDING",
                createdAt=datetime.now(timezone.utc),
            )
            mock_tx = MagicMock()
            mock_tx.proposal.find_first = AsyncMock(return_value=None)
            mock_tx.proposal.create = AsyncMock(return_value=mock_proposal)
            mock_prisma.tx = MagicMock(return_value=MagicMock(
                __aenter__=AsyncMock(return_value=mock_tx),
                __aexit__=AsyncMock(return_value=None),
            ))

            result = await FreelanceService.submit_proposal(
                project_id=1,
                proposal_data=ProposalCreate(message="I can do this", amount=50000),
                freelancer_id=42,
            )

            assert result["status"] == "PENDING"
            assert result["freelancerId"] == 42

    async def test_rejects_own_project(self, mock_prisma, mock_cache):
        with patch.object(FreelanceService, '_can_act_as_freelancer', new_callable=AsyncMock, return_value=True):
            mock_project = MagicMock(id=1, status="OPEN", ownerId=42)
            mock_prisma.project.find_unique = AsyncMock(return_value=mock_project)

            with pytest.raises(ValueError, match="proposer à votre propre projet"):
                await FreelanceService.submit_proposal(
                    project_id=1,
                    proposal_data=ProposalCreate(message="I can do this", amount=1000),
                    freelancer_id=42,
                )

    async def test_rejects_duplicate_proposal(self, mock_prisma, mock_cache):
        with patch.object(FreelanceService, '_can_act_as_freelancer', new_callable=AsyncMock, return_value=True):
            mock_project = MagicMock(id=1, status="OPEN", ownerId=99)
            mock_prisma.project.find_unique = AsyncMock(return_value=mock_project)
            mock_prisma.proposal.find_first = AsyncMock(return_value=MagicMock(id=1))

            with pytest.raises(ValueError, match="déjà soumis"):
                await FreelanceService.submit_proposal(
                    project_id=1,
                    proposal_data=ProposalCreate(message="I can do this", amount=1000),
                    freelancer_id=42,
                )


# ======================
# CONTRACT TESTS
# ======================

class TestAcceptProposal:
    """Test proposal acceptance business logic."""

    async def test_accepts_proposal(self, mock_prisma, mock_cache):
        mock_project = MagicMock(id=1, title="Test Project", ownerId=42)
        mock_proposal = MagicMock(
            id=1, projectId=1, freelancerId=99, amount=50000,
            status="PENDING", project=mock_project,
        )
        mock_prisma.proposal.find_unique = AsyncMock(return_value=mock_proposal)

        mock_contract = MagicMock(
            id=10, projectId=1, freelancerId=99, clientId=42,
            status="ACTIVE", terms="Test terms", amount=50000,
            startDate=datetime.now(timezone.utc), endDate=None,
            createdAt=datetime.now(timezone.utc),
        )
        mock_tx = MagicMock()
        mock_tx.execute_raw = AsyncMock(return_value=[{"id": 1}])  # row lock acquired
        mock_tx.contract.find_first = AsyncMock(return_value=None)  # no active contract yet
        mock_tx.proposal.find_unique = AsyncMock(return_value=MagicMock(status="PENDING"))
        mock_tx.proposal.update = AsyncMock()
        mock_tx.proposal.update_many = AsyncMock()
        mock_tx.project.update = AsyncMock()
        mock_tx.contract.create = AsyncMock(return_value=mock_contract)
        mock_prisma.tx = MagicMock(return_value=MagicMock(
            __aenter__=AsyncMock(return_value=mock_tx),
            __aexit__=AsyncMock(return_value=None),
        ))
        mock_prisma.proposal.find_many = AsyncMock(return_value=[])

        result = await FreelanceService.accept_proposal(proposal_id=1, client_id=42)

        assert result["status"] == "ACTIVE"
        assert result["amount"] == 50000

    async def test_rejects_already_accepted_proposal(self, mock_prisma, mock_cache):
        mock_proposal = MagicMock(
            id=1, status="ACCEPTED",
            project=MagicMock(id=1, title="Test", ownerId=42),
        )
        mock_prisma.proposal.find_unique = AsyncMock(return_value=mock_proposal)

        with pytest.raises(ValueError, match="n'est pas en attente"):
            await FreelanceService.accept_proposal(proposal_id=1, client_id=42)


# ======================
# REVIEW TESTS
# ======================

class TestReviewEligibility:
    """Test review eligibility business logic."""

    async def test_freelancer_can_review_client(self, mock_prisma, mock_cache):
        contract = MagicMock(
            id=1, clientId=42, freelancerId=99, status="COMPLETED",
            updatedAt=datetime.now(timezone.utc),
            deliveries=[MagicMock()],
        )
        mock_prisma.contract.find_unique = AsyncMock(return_value=contract)
        mock_prisma.contractreview.find_unique = AsyncMock(return_value=None)

        result = await FreelanceService.get_review_eligibility(user_id=99, contract_id=1)

        assert result["is_eligible"] is True
        assert result["role"] == "FREELANCER"
        assert result["target_id"] == 42

    async def test_client_can_review_freelancer(self, mock_prisma, mock_cache):
        contract = MagicMock(
            id=1, clientId=42, freelancerId=99, status="COMPLETED",
            updatedAt=datetime.now(timezone.utc),
            deliveries=[MagicMock()],
        )
        mock_prisma.contract.find_unique = AsyncMock(return_value=contract)
        mock_prisma.contractreview.find_unique = AsyncMock(return_value=None)

        result = await FreelanceService.get_review_eligibility(user_id=42, contract_id=1)

        assert result["is_eligible"] is True
        assert result["role"] == "CLIENT"
        assert result["target_id"] == 99

    async def test_rejects_non_party(self, mock_prisma, mock_cache):
        contract = MagicMock(
            id=1, clientId=42, freelancerId=99, status="COMPLETED",
        )
        mock_prisma.contract.find_unique = AsyncMock(return_value=contract)

        with pytest.raises(ValueError, match="Accès refusé"):
            await FreelanceService.get_review_eligibility(user_id=1, contract_id=1)

    async def test_rejects_non_completed_contract(self, mock_prisma, mock_cache):
        contract = MagicMock(
            id=1, clientId=42, freelancerId=99, status="ACTIVE",
        )
        mock_prisma.contract.find_unique = AsyncMock(return_value=contract)
        mock_prisma.contractreview.find_unique = AsyncMock(return_value=None)

        result = await FreelanceService.get_review_eligibility(user_id=42, contract_id=1)

        assert result["is_eligible"] is False

    async def test_rejects_duplicate_review(self, mock_prisma, mock_cache):
        contract = MagicMock(
            id=1, clientId=42, freelancerId=99, status="COMPLETED",
            updatedAt=datetime.now(timezone.utc),
            deliveries=[MagicMock()],
        )
        mock_prisma.contract.find_unique = AsyncMock(return_value=contract)
        mock_prisma.contractreview.find_unique = AsyncMock(return_value=MagicMock(id=1))

        result = await FreelanceService.get_review_eligibility(user_id=42, contract_id=1)

        assert result["is_eligible"] is False


# ======================
# RATING SUMMARY TESTS
# ======================

class TestFreelancerRatingSummary:
    """Test freelancer rating summary computation."""

    async def test_computes_rating_summary(self, mock_prisma, mock_cache):
        mock_prisma.user.find_unique = AsyncMock(return_value=MagicMock(id=1))

        mock_review_1 = MagicMock(overallRating=5)
        mock_review_2 = MagicMock(overallRating=4)
        mock_review_3 = MagicMock(overallRating=5)
        mock_prisma.contractreview.find_many = AsyncMock(
            return_value=[mock_review_1, mock_review_2, mock_review_3]
        )
        mock_prisma.contract.count = AsyncMock(return_value=5)

        result = await FreelanceService.get_freelancer_rating_summary(user_id=1)

        assert result["totalReviews"] == 3
        assert result["averageRating"] == round((5 + 4 + 5) / 3, 2)
        assert result["ratingDistribution"][5] == 2
        assert result["ratingDistribution"][4] == 1
        assert result["responseRate"] == round(5 / 3 * 100, 1)

    async def test_handles_no_reviews(self, mock_prisma, mock_cache):
        mock_prisma.user.find_unique = AsyncMock(return_value=MagicMock(id=1))
        mock_prisma.contractreview.find_many = AsyncMock(return_value=[])
        mock_prisma.contract.count = AsyncMock(return_value=0)

        result = await FreelanceService.get_freelancer_rating_summary(user_id=1)

        assert result["totalReviews"] == 0
        assert result["averageRating"] == 0.0
        assert result["responseRate"] == 100.0


# ======================
# DISPUTE TESTS
# ======================

class TestCreateDispute:
    """Test dispute creation business logic."""

    async def test_allows_dispute_on_active_contract(self, mock_prisma, mock_cache):
        contract = MagicMock(id=1, clientId=42, freelancerId=99, status="ACTIVE")
        mock_prisma.contract.find_unique = AsyncMock(return_value=contract)
        mock_prisma.dispute.find_first = AsyncMock(return_value=None)

        mock_dispute = MagicMock(
            id=1, contractId=1, creatorId=42, reason="NON_DELIVERY",
            status="OPEN", description="No delivery",
            createdAt=datetime.now(timezone.utc), updatedAt=datetime.now(timezone.utc),
            metadata={},
        )

        mock_tx = MagicMock()
        mock_tx.dispute.create = AsyncMock(return_value=mock_dispute)
        mock_tx.contract.update = AsyncMock()
        mock_tx.auditlog.create = AsyncMock()
        mock_prisma.tx = MagicMock(return_value=MagicMock(
            __aenter__=AsyncMock(return_value=mock_tx),
            __aexit__=AsyncMock(return_value=None),
        ))

        result = await FreelanceService.create_dispute(
            contract_id=1,
            dispute_data=DisputeCreate(reason="NON_DELIVERY", description="No delivery"),
            user_id=42,
        )

        assert result["id"] == 1
        assert result["reason"] == "NON_DELIVERY"

    async def test_rejects_non_party(self, mock_prisma, mock_cache):
        contract = MagicMock(id=1, clientId=42, freelancerId=99, status="ACTIVE")
        mock_prisma.contract.find_unique = AsyncMock(return_value=contract)

        with pytest.raises(ValueError, match="autorisé"):
            await FreelanceService.create_dispute(
                contract_id=1,
                dispute_data=DisputeCreate(reason="OTHER", description="Test dispute"),
                user_id=1,
            )

    async def test_rejects_duplicate_dispute(self, mock_prisma, mock_cache):
        contract = MagicMock(id=1, clientId=42, freelancerId=99, status="DISPUTED")
        mock_prisma.contract.find_unique = AsyncMock(return_value=contract)

        with pytest.raises(ValueError, match="déjà en cours"):
            await FreelanceService.create_dispute(
                contract_id=1,
                dispute_data=DisputeCreate(reason="OTHER", description="Test dispute"),
                user_id=42,
            )
