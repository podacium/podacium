"""
Notion API Connector for EdTech Course Study Guides & Notes Export.
"""

import logging
import httpx
from typing import Dict, Any
from app.core.prisma import prisma
from app.core.security import decrypt_vault_secret

logger = logging.getLogger(__name__)


class NotionConnector:
    async def export_study_guide_to_notion(
        self, user_id: int, page_title: str, content_markdown: str
    ) -> Dict[str, Any]:
        """Export EdTech course notes to Notion workspace page."""
        integration = await prisma.userintegration.find_unique(
            where={"userId_provider": {"userId": user_id, "provider": "notion"}}
        )
        if not integration or not integration.accessToken:
            raise ValueError("Notion integration not connected")

        raw_token = decrypt_vault_secret(integration.accessToken)

        payload = {
            "parent": {"type": "workspace", "workspace": True},
            "properties": {
                "title": {
                    "title": [{"type": "text", "text": {"content": page_title}}]
                }
            },
            "children": [
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [
                            {"type": "text", "text": {"content": content_markdown}}
                        ]
                    },
                }
            ],
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                "https://api.notion.com/v1/pages",
                headers={
                    "Authorization": f"Bearer {raw_token}",
                    "Notion-Version": "2022-06-28",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if res.status_code not in (200, 201):
                raise ValueError(f"Notion API Error: {res.text}")

            data = res.json()
            return {
                "status": "SUCCESS",
                "page_id": data.get("id"),
                "url": data.get("url"),
                "title": page_title,
            }


notion_connector = NotionConnector()
