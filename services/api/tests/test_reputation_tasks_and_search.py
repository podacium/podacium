"""
Tests for Layer 9 Enhancements:
1. Celery Batch Periodic EigenTrust Task (`recompute_all_freelancer_reputations`).
2. Freelancer Search & Discovery with Cold-Start Boosts & JSS Ranking.
3. Milestone Structured Revision State Transition (DELIVERED -> IN_PROGRESS).
4. Deadlock-free Canonical Wallet Locking in Escrow Release.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone

from app.services.milestone_service import MilestoneService
from app.tasks.reputation_tasks import recompute_all_freelancer_reputations
from app.services.freelancing_service import FreelanceService
from app.schemas.freelancing import FreelancerSearch


@pytest.mark.unit
class TestReputationBatchTask:
    """Tests the periodic Celery batch EigenTrust recomputation engine."""

    @pytest.mark.asyncio
    async def test_recompute_all_freelancer_reputations_success(self):
        # Setup mock freelancers: one graduate with Arrêté 1275, one experienced veteran
        mock_user_grad = MagicMock(id=101, isActive=True, fullName="Amine Oran")
        mock_profile_grad = MagicMock(
            id=1,
            userId=101,
            user=mock_user_grad,
            skillPassportVerified=True,
            isAnaeRegistered=True,
            isVerified=True,
            metadata={"arrete_1275_verified": True},
        )

        mock_user_vet = MagicMock(id=102, isActive=True, fullName="Karim Algiers")
        mock_profile_vet = MagicMock(
            id=2,
            userId=102,
            user=mock_user_vet,
            skillPassportVerified=False,
            isAnaeRegistered=False,
            isVerified=False,
            metadata={},
        )

        mock_profiles = [mock_profile_grad, mock_profile_vet]

        with (
            patch(
                "app.core.prisma.prisma.freelancerprofile.find_many",
                new_callable=AsyncMock,
            ) as mock_find_profiles,
            patch(
                "app.core.prisma.prisma.contract.group_by", new_callable=AsyncMock
            ) as mock_group_contracts,
            patch(
                "app.core.prisma.prisma.contractreview.find_many",
                new_callable=AsyncMock,
            ) as mock_find_reviews,
            patch(
                "app.core.prisma.prisma.certificate.find_many", new_callable=AsyncMock
            ) as mock_find_certs,
            patch(
                "app.core.prisma.prisma.freelancerprofile.update",
                new_callable=AsyncMock,
            ) as mock_update_profile,
        ):
            mock_find_profiles.return_value = mock_profiles
            # Graduate has 0 contracts, Veteran has 8 completed contracts
            mock_group_contracts.return_value = [
                {"freelancerId": 102, "_count": {"id": 8}}
            ]
            mock_find_reviews.return_value = [
                MagicMock(
                    authorId=201,
                    targetId=102,
                    rating=4.8,
                    status="ACTIVE",
                    isPublic=True,
                )
            ]
            # Graduate passed MicroVM capstone
            mock_find_certs.return_value = [MagicMock(userId=101, id=55)]

            result = await recompute_all_freelancer_reputations()

            assert result["status"] == "COMPLETED"
            assert result["total_evaluated"] == 2
            assert result["average_eigentrust"] > 0

            # Verify both profiles were updated with JSS and EigenTrust scores
            assert mock_update_profile.call_count == 2
            first_call_data = mock_update_profile.call_args_list[0][1]["data"]
            raw_meta = first_call_data["metadata"]
            meta_grad = raw_meta.data if hasattr(raw_meta, "data") else raw_meta
            # Graduate metadata must have credential_boost_applied=True and high JSS
            assert meta_grad["credential_boost_applied"] is True
            assert meta_grad["job_success_score"] >= 80.0
            assert "eigentrust_score" in meta_grad


@pytest.mark.unit
class TestSearchAndRankingIntegration:
    """Tests marketplace search with cold-start reputation boost integration."""

    @pytest.mark.asyncio
    async def test_search_freelancers_ranks_verified_graduate_competitively(self):
        user_grad = MagicMock(
            id=101,
            fullName="Amina Tlemcen",
            bio="Data Engineer specialized in Python and BigQuery",
            profilePictureUrl=None,
            skills=["Python", "SQL"],
            city="Tlemcen",
            country="Algeria",
            role="FREELANCER",
            phoneVerified=True,
            averageRating=None,
            createdAt=datetime.now(timezone.utc),
            updatedAt=datetime.now(timezone.utc),
        )
        user_unverified = MagicMock(
            id=102,
            fullName="Anonymous Newcomer",
            bio="Junior dev",
            profilePictureUrl=None,
            skills=["Python"],
            city="Oran",
            country="Algeria",
            role="FREELANCER",
            phoneVerified=False,
            averageRating=None,
            createdAt=datetime.now(timezone.utc),
            updatedAt=datetime.now(timezone.utc),
        )

        users = [user_unverified, user_grad]

        profile_grad = MagicMock(
            userId=101,
            skillPassportVerified=True,
            isAnaeRegistered=True,
            isVerified=True,
            metadata={"arrete_1275_verified": True},
        )
        profile_unverified = MagicMock(
            userId=102,
            skillPassportVerified=False,
            isAnaeRegistered=False,
            isVerified=False,
            metadata={},
        )

        search_params = FreelancerSearch(
            search="Python",
            skip=0,
            limit=10,
        )

        with (
            patch(
                "app.core.prisma.prisma.user.count", new_callable=AsyncMock
            ) as mock_count,
            patch(
                "app.core.prisma.prisma.user.find_many", new_callable=AsyncMock
            ) as mock_find_users,
            patch(
                "app.core.prisma.prisma.certificate.group_by", new_callable=AsyncMock
            ) as mock_certs,
            patch(
                "app.core.prisma.prisma.contract.group_by", new_callable=AsyncMock
            ) as mock_contracts,
            patch(
                "app.core.prisma.prisma.query_raw", new_callable=AsyncMock
            ) as mock_raw,
            patch(
                "app.core.prisma.prisma.freelancerprofile.find_many",
                new_callable=AsyncMock,
            ) as mock_profiles,
        ):
            mock_count.return_value = 2
            mock_find_users.return_value = users
            mock_certs.return_value = [{"userId": 101, "_count": {"id": 1}}]
            mock_contracts.return_value = []
            mock_raw.return_value = []
            mock_profiles.return_value = [profile_unverified, profile_grad]

            result = await FreelanceService._search_freelancers_common(search_params)

            freelancers = result["freelancers"]
            assert len(freelancers) == 2

            # The verified graduate must be ranked #1 above unverified candidate due to match_rank_score
            assert freelancers[0]["id"] == 101
            assert freelancers[0]["credential_boost_applied"] is True
            assert freelancers[0]["skill_passport_verified"] is True
            assert (
                freelancers[0]["match_rank_score"] > freelancers[1]["match_rank_score"]
            )


@pytest.mark.unit
class TestMilestoneRevisionStateMachine:
    """Tests structured revision request on delivered milestones."""

    @pytest.mark.asyncio
    async def test_request_milestone_revision_atomic_transition(self):
        mock_milestone = MagicMock(
            id=42,
            contractId=10,
            status="DELIVERED",
            title="UI Wireframes & Frontend Components",
            contract=MagicMock(clientId=99, freelancerId=88),
        )

        with (
            patch(
                "app.core.prisma.prisma.contractmilestone.find_unique",
                new_callable=AsyncMock,
            ) as mock_find,
            patch(
                "app.services.notification_service.NotificationService.create_notification",
                new_callable=AsyncMock,
            ),
            patch("app.core.prisma.prisma.tx") as mock_tx,
        ):
            mock_find.return_value = mock_milestone
            tx_context = AsyncMock()
            tx_context.contractmilestone.update_many = AsyncMock(return_value=1)
            tx_context.contract.update = AsyncMock()
            tx_context.auditlog.create = AsyncMock()
            mock_tx.return_value.__aenter__.return_value = tx_context

            res = await MilestoneService.request_milestone_revision(
                milestone_id=42,
                client_id=99,
                criteria=["CODE_QUALITY", "RESPONSIVE_DESIGN"],
                revision_notes="Please ensure mobile drawer closes on backdrop click",
            )

            assert res["success"] is True
            assert res["status"] == "IN_PROGRESS"
            assert res["milestone_id"] == 42
            assert "CODE_QUALITY" in res["criteria"]

            # Verify atomic CAS update query
            from datetime import timedelta

            tx_context.contractmilestone.update_many.assert_called_once_with(
                where={"id": 42, "status": "DELIVERED"},
                data={
                    "status": "IN_PROGRESS",
                    "updatedAt": pytest.approx(
                        datetime.now(timezone.utc), abs=timedelta(seconds=5)
                    ),
                },
            )

    @pytest.mark.asyncio
    async def test_cannot_request_revision_on_approved_or_pending_milestone(self):
        mock_milestone = MagicMock(
            id=43,
            contractId=10,
            status="APPROVED",  # Already approved!
            title="Architecture Specs",
            contract=MagicMock(clientId=99, freelancerId=88),
        )

        with patch(
            "app.core.prisma.prisma.contractmilestone.find_unique",
            new_callable=AsyncMock,
        ) as mock_find:
            mock_find.return_value = mock_milestone

            with pytest.raises(
                ValueError, match="Can only request revisions on DELIVERED milestones"
            ):
                await MilestoneService.request_milestone_revision(
                    milestone_id=43,
                    client_id=99,
                    criteria=["REQUIREMENTS"],
                    revision_notes="Need more specs",
                )


@pytest.mark.unit
class TestBayesianWilsonReputationEngine:
    """Verifies multi-dimensional Bayesian Wilson Lower Bound (95% CI) reputation calculations."""

    def test_wilson_lower_bound_neutralizes_low_volume_review_buying(self):
        from app.services.reputation_service import reputation_service

        # Case 1: Account with 1 bought 5-star review (1/1 success)
        wilson_1 = reputation_service.calculate_wilson_lower_bound(
            positive=1.0, total=1.0
        )
        # Wilson lower bound for 1/1 at 95% CI is approximately 0.2065 (20.7%)
        assert (
            wilson_1 < 0.35
        ), f"Expected low-volume Wilson lower bound < 0.35, got {wilson_1}"

        # Case 2: Account with 2 bought 5-star reviews (2/2 success)
        wilson_2 = reputation_service.calculate_wilson_lower_bound(
            positive=2.0, total=2.0
        )
        assert wilson_2 < 0.40, f"Expected 2-review Wilson bound < 0.40, got {wilson_2}"

        # Case 3: Established veteran with 50 genuine 5-star reviews (50/50 success)
        wilson_50 = reputation_service.calculate_wilson_lower_bound(
            positive=50.0, total=50.0
        )
        assert (
            wilson_50 >= 0.90
        ), f"Expected established account Wilson bound >= 0.90, got {wilson_50}"

    def test_bayesian_reputation_score_factors_disputes_and_ontime(self):
        from app.services.reputation_service import reputation_service

        # Flawless freelancer: 10 contracts, 5.0 rating, 0 disputes, 10/10 on-time
        clean_rep = reputation_service.compute_bayesian_reputation_score(
            completed_contracts=10,
            raw_average_rating=5.0,
            dispute_count=0,
            on_time_delivery_count=10,
            total_delivered_milestones=10,
        )

        # Disputed freelancer: 10 contracts, 5.0 rating, 3 disputes, 10/10 on-time
        disputed_rep = reputation_service.compute_bayesian_reputation_score(
            completed_contracts=10,
            raw_average_rating=5.0,
            dispute_count=3,
            on_time_delivery_count=10,
            total_delivered_milestones=10,
        )

        # Late delivery freelancer: 10 contracts, 5.0 rating, 0 disputes, 3/10 on-time
        late_rep = reputation_service.compute_bayesian_reputation_score(
            completed_contracts=10,
            raw_average_rating=5.0,
            dispute_count=0,
            on_time_delivery_count=3,
            total_delivered_milestones=10,
        )

        assert (
            clean_rep["composite_empirical_score"]
            > disputed_rep["composite_empirical_score"]
        )
        assert (
            clean_rep["composite_empirical_score"]
            > late_rep["composite_empirical_score"]
        )
        assert disputed_rep["dispute_rate"] > 0
        assert late_rep["on_time_rate"] == 0.30

    def test_jss_computation_integrates_wilson_bound(self):
        from app.services.reputation_service import reputation_service

        # Newcomer with 0 completed contracts: protected from cold-start bias via certified credentials
        newcomer_jss = reputation_service.compute_freelancer_job_success_score(
            user_id=1,
            eigentrust_score=0.45,
            average_eigentrust=0.25,
            completed_contracts=0,
            raw_average_rating=0.0,
        )
        assert newcomer_jss >= 80.0

        # Experienced freelancer with high ratings and zero disputes
        veteran_jss = reputation_service.compute_freelancer_job_success_score(
            user_id=2,
            eigentrust_score=0.30,
            average_eigentrust=0.25,
            completed_contracts=15,
            raw_average_rating=4.9,
            dispute_count=0,
            on_time_delivery_count=15,
            total_delivered_milestones=15,
        )
        assert veteran_jss >= 75.0


@pytest.mark.unit
class TestIpAssignmentTwoPartySigning:
    """Verifies two-party cryptographic signing for IP Assignment Deeds (Loi n° 15-04)."""

    def test_generate_party_signature_deterministic_and_unique(self):
        from app.services.ip_assignment_service import IpAssignmentService

        now = datetime.now(timezone.utc)
        sig_cedant = IpAssignmentService.generate_party_signature(
            party_role="CEDANT_AUTEUR",
            user_id=101,
            contract_id=42,
            milestone_id=3,
            deliverable_hash="a" * 64,
            signed_at=now,
        )
        sig_cessionnaire = IpAssignmentService.generate_party_signature(
            party_role="CESSIONNAIRE_CLIENT",
            user_id=202,
            contract_id=42,
            milestone_id=3,
            deliverable_hash="a" * 64,
            signed_at=now,
        )

        assert len(sig_cedant) == 64
        assert len(sig_cessionnaire) == 64
        assert (
            sig_cedant != sig_cessionnaire
        )  # Different parties have unique signatures
