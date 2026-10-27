"""
Microsoft Teams Connector for Channel Webhook Messaging & BI Alerts.
"""

import logging
import httpx
from typing import Dict, Any

logger = logging.getLogger(__name__)


class TeamsConnector:
    async def post_teams_card(
        self, user_id: int, webhook_url: str, title: str, message: str
    ) -> Dict[str, Any]:
        """Post Adaptive Card to Microsoft Teams Channel."""
        card_payload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": "0076D7",
            "summary": title,
            "sections": [
                {
                    "activityTitle": f"📢 {title}",
                    "activitySubtitle": "Podacium Connect Notification Engine",
                    "text": message,
                }
            ],
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(webhook_url, json=card_payload)
            if res.status_code != 200:
                raise ValueError(f"Microsoft Teams Webhook Error: {res.text}")

            return {
                "status": "SUCCESS",
                "title": title,
                "webhook_url": webhook_url,
            }


teams_connector = TeamsConnector()
