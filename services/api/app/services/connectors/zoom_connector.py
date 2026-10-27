"""
Zoom & LiveKit Connector for EdTech Virtual Classroom Provisioning.
"""

import logging
import httpx
from typing import Dict, Any
from app.core.prisma import prisma
from app.core.security import decrypt_vault_secret

logger = logging.getLogger(__name__)


class ZoomConnector:
    async def provision_live_webinar(
        self, user_id: int, topic: str, start_time_iso: str, duration_minutes: int = 60
    ) -> Dict[str, Any]:
        """Schedule virtual classroom session on Zoom."""
        integration = await prisma.userintegration.find_unique(
            where={"userId_provider": {"userId": user_id, "provider": "zoom"}}
        )
        if not integration or not integration.accessToken:
            raise ValueError("Zoom integration not connected")

        raw_token = decrypt_vault_secret(integration.accessToken)

        payload = {
            "topic": topic,
            "type": 2,  # Scheduled Meeting
            "start_time": start_time_iso,
            "duration": duration_minutes,
            "timezone": "Africa/Algiers",
            "settings": {
                "host_video": True,
                "participant_video": True,
                "join_before_host": False,
                "mute_upon_entry": True,
                "auto_recording": "cloud",
            },
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                "https://api.zoom.us/v2/users/me/meetings",
                headers={
                    "Authorization": f"Bearer {raw_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if res.status_code not in (200, 201):
                raise ValueError(f"Zoom API Error: {res.text}")

            data = res.json()
            return {
                "status": "SUCCESS",
                "meeting_id": data.get("id"),
                "topic": topic,
                "join_url": data.get("join_url"),
                "start_url": data.get("start_url"),
            }


zoom_connector = ZoomConnector()
