import pytest
from unittest.mock import AsyncMock, patch
from app.services.bi_services.health_score_service import HealthScoreService


@pytest.mark.asyncio
async def test_calculate_trend_with_event_type():
    mock_log = AsyncMock()
    mock_log.eventData = '{"score": 75}'
    mock_log.createdAt = None

    with patch("app.services.bi_services.health_score_service.prisma") as mock_prisma:
        mock_prisma.biauditlog.find_many = AsyncMock(return_value=[mock_log])
        mock_prisma.biauditlog.create = AsyncMock()

        res = await HealthScoreService._calculate_trend(
            organization_id=1, current_score=80, dataset_id=10, user_id=5
        )

        # Ensure find_many was called with eventType (not action)
        mock_prisma.biauditlog.find_many.assert_called_once_with(
            where={
                "organizationId": 1,
                "eventType": "HEALTH_SCORE_SNAPSHOT",
            },
            order={"createdAt": "desc"},
            take=4,
        )

        assert res["direction"] == "up"
        assert res["delta"] == 5


def test_match_column_keyword():
    from app.services.bi_services.health_score_service import _match_column_keyword, REVENUE_KEYWORDS

    # Should NOT match 'ca' inside 'cardiaque'
    assert not _match_column_keyword("Frequence_cardiaque", REVENUE_KEYWORDS)

    # Should match 'ca' as a standalone token or CA_ prefix/suffix
    assert _match_column_keyword("ca", REVENUE_KEYWORDS)
    assert _match_column_keyword("total_ca", REVENUE_KEYWORDS)
    assert _match_column_keyword("revenue_2026", REVENUE_KEYWORDS)
    assert _match_column_keyword("chiffre_affaires", REVENUE_KEYWORDS)


def test_aggregate_financials_skips_text_columns():
    mock_dataset = AsyncMock()
    mock_dataset.filePath = "mock.csv"

    mock_schema = [
        {"name": "Frequence_cardiaque", "type": "text", "native_type": "VARCHAR"},
        {"name": "revenue_amount", "type": "numeric", "native_type": "DOUBLE"},
    ]

    with patch("app.services.bi_services.health_score_service.QueryEngine") as mock_qe:
        mock_qe.get_dataset_schema.return_value = mock_schema
        mock_qe._get_table_expr.return_value = "read_csv_auto('mock.csv')"
        mock_qe.execute_internal_query.side_effect = [
            [{"cnt": 100}],
            [{"val": 5000.0}],
        ]

        rev, exp, debt, buf, cnt = HealthScoreService._aggregate_financials([mock_dataset])

        assert rev == 5000.0
        assert cnt == 100
        # Check that query used TRY_CAST on revenue_amount (and not Frequence_cardiaque)
        assert "TRY_CAST(\"revenue_amount\" AS DOUBLE)" in mock_qe.execute_internal_query.call_args_list[1][0][0]

