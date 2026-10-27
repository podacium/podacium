"""
HuggingFace Hub Connector for AI Model Cards & Dataset Linking.
"""

import logging
import httpx
from typing import Dict, Any
from app.core.prisma import prisma
from app.core.security import decrypt_vault_secret

logger = logging.getLogger(__name__)


class HuggingFaceConnector:
    async def sync_hf_model_card(
        self, user_id: int, model_id: str
    ) -> Dict[str, Any]:
        """Fetch HuggingFace AI Model metadata card."""
        integration = await prisma.userintegration.find_unique(
            where={"userId_provider": {"userId": user_id, "provider": "huggingface"}}
        )
        if not integration or not integration.accessToken:
            raise ValueError("HuggingFace integration not connected")

        raw_token = decrypt_vault_secret(integration.accessToken)

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"https://huggingface.co/api/models/{model_id}",
                headers={"Authorization": f"Bearer {raw_token}"},
            )
            if res.status_code != 200:
                raise ValueError(f"HuggingFace API Error: {res.text}")

            meta = res.json()
            return {
                "status": "SUCCESS",
                "model_id": model_id,
                "author": meta.get("author"),
                "pipeline_tag": meta.get("pipeline_tag"),
                "downloads": meta.get("downloads", 0),
                "likes": meta.get("likes", 0),
            }


huggingface_connector = HuggingFaceConnector()
