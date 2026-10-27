import pytest
from unittest.mock import AsyncMock, patch
from app.services.connectors.chargily_connector import chargily_connector
from app.services.connectors.teams_connector import teams_connector


@pytest.mark.asyncio
async def test_chargily_escrow_deposit():
    res = await chargily_connector.create_escrow_deposit(
        contract_id=101, milestone_id=2, amount_dzd=50000.0, payment_method="edahabia"
    )
    assert res["status"] == "SUCCESS"
    assert "pay.chargily.com" in res["checkout_url"]
    assert res["amount_dzd"] == 50000.0


@pytest.mark.asyncio
async def test_baridimob_payout():
    res = await chargily_connector.request_baridimob_payout(
        freelancer_id=512, rip_number="00799999000123456789", amount_dzd=25000.0
    )
    assert res["status"] == "PENDING_APPROVAL"
    assert res["freelancer_id"] == 512
    assert res["amount_dzd"] == 25000.0


@pytest.mark.asyncio
async def test_teams_card():
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value.status_code = 200
        res = await teams_connector.post_teams_card(
            user_id=1,
            webhook_url="https://outlook.office.com/webhook/test",
            title="BI Alert",
            message="KPI threshold exceeded",
        )
        assert res["status"] == "SUCCESS"
        assert res["title"] == "BI Alert"
