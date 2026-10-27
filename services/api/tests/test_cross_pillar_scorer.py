import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.schemas.auth import UserRole
from app.services.recommendations.scorers.cross_pillar import CrossPillarScorer
from app.services.recommendations.scorers.base import CandidateEntity


@pytest.mark.asyncio
async def test_cross_pillar_scorer_business_profile_fallback():
    scorer = CrossPillarScorer()
    candidate = CandidateEntity(
        entity_id="dataset_123",
        entity_type="dataset",
        tags=["retail", "sales"]
    )

    mock_biz = MagicMock()
    mock_biz.industry = "Retail"
    mock_biz.areasOfExpertise = ["sales", "logistics"]

    mock_user = MagicMock()
    # Ensure User has no business_profile attribute, only businessProfile
    del mock_user.business_profile
    mock_user.businessProfile = mock_biz

    with patch("app.services.recommendations.scorers.cross_pillar.prisma") as mock_prisma:
        mock_prisma.user.find_unique = AsyncMock(return_value=mock_user)

        res = await scorer.score(
            user_id=2,
            role=UserRole.BUSINESS,
            candidates=[candidate],
            context={}
        )

        assert "dataset_123" in res
        assert res["dataset_123"] > 0.0
