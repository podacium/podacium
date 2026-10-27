"""
Google Calendar & Outlook Connector for Course Timetables & Contract Milestones.
"""

import logging
import httpx
from typing import Dict, Any
from app.core.prisma import prisma
from app.core.security import decrypt_vault_secret

logger = logging.getLogger(__name__)


class CalendarConnector:
    async def create_calendar_event(
        self,
        user_id: int,
        summary: str,
        description: str,
        start_time_iso: str,
        end_time_iso: str,
    ) -> Dict[str, Any]:
        """Create Google Calendar Event for Course Lectures or Freelance Milestones."""
        integration = await prisma.userintegration.find_unique(
            where={"userId_provider": {"userId": user_id, "provider": "google"}}
        )
        if not integration or not integration.accessToken:
            raise ValueError("Google Calendar integration not connected")

        raw_token = decrypt_vault_secret(integration.accessToken)

        event_payload = {
            "summary": summary,
            "description": description,
            "start": {"dateTime": start_time_iso, "timeZone": "Africa/Algiers"},
            "end": {"dateTime": end_time_iso, "timeZone": "Africa/Algiers"},
            "reminders": {
                "useDefault": False,
                "overrides": [{"method": "popup", "minutes": 30}],
            },
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                headers={
                    "Authorization": f"Bearer {raw_token}",
                    "Content-Type": "application/json",
                },
                json=event_payload,
            )
            if res.status_code not in (200, 201):
                raise ValueError(f"Google Calendar API Error: {res.text}")

            data = res.json()
            return {
                "status": "SUCCESS",
                "event_id": data.get("id"),
                "html_link": data.get("htmlLink"),
                "summary": summary,
            }


calendar_connector = CalendarConnector()
