"""
Slack Web API Connector for BI Snapshot Broadcasts & Alert Messaging.
"""

import logging
import httpx
from typing import Dict, Any
from app.core.prisma import prisma
from app.core.security import decrypt_vault_secret

logger = logging.getLogger(__name__)


class SlackConnector:
    async def post_bi_dashboard_snapshot(
        self, user_id: int, channel: str, dashboard_name: str, kpi_summary: str
    ) -> Dict[str, Any]:
        """Send Block-Kit formatted KPI report to Slack channel."""
        integration = await prisma.userintegration.find_unique(
            where={"userId_provider": {"userId": user_id, "provider": "slack"}}
        )
        if not integration or not integration.accessToken:
            raise ValueError("Slack integration not connected")

        raw_token = decrypt_vault_secret(integration.accessToken)

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"📊 Podacium BI Report: {dashboard_name}",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Automated BI Snapshot*\n{kpi_summary}",
                },
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": "Sent via *Podacium Connect Hub* • Algerian EdTech & BI Platform",
                    }
                ],
            },
        ]

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                "https://slack.com/api/chat.postMessage",
                headers={
                    "Authorization": f"Bearer {raw_token}",
                    "Content-Type": "application/json; charset=utf-8",
                },
                json={"channel": channel, "blocks": blocks},
            )
            if res.status_code != 200:
                raise ValueError(f"Slack API error: {res.text}")

            data = res.json()
            if not data.get("ok"):
                raise ValueError(f"Slack posting error: {data.get('error')}")

            return {
                "status": "SUCCESS",
                "channel": channel,
                "ts": data.get("ts"),
            }


slack_connector = SlackConnector()
