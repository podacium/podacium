"""
Kaggle API Connector for BI/ML Dataset Ingestion.
"""

import logging
import httpx
from typing import Dict, Any
from app.core.prisma import prisma
from app.core.security import decrypt_vault_secret

logger = logging.getLogger(__name__)


class KaggleConnector:
    async def ingest_kaggle_dataset(
        self, user_id: int, dataset_handle: str, target_dataset_id: int
    ) -> Dict[str, Any]:
        """Fetch metadata and ingest Kaggle dataset into Podacium BI Hub."""
        integration = await prisma.userintegration.find_unique(
            where={"userId_provider": {"userId": user_id, "provider": "kaggle"}}
        )
        if not integration or not integration.accessToken:
            raise ValueError("Kaggle integration not connected")

        raw_token = decrypt_vault_secret(integration.accessToken)

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"https://www.kaggle.com/api/v1/datasets/view/{dataset_handle}",
                headers={"Authorization": f"Bearer {raw_token}"},
            )
            if res.status_code != 200:
                raise ValueError(f"Kaggle API Error: {res.text}")

            meta = res.json()
            return {
                "status": "SUCCESS",
                "dataset_handle": dataset_handle,
                "title": meta.get("title", dataset_handle),
                "total_bytes": meta.get("totalBytes", 0),
                "license_name": meta.get("licenseName", "Unknown"),
                "target_dataset_id": target_dataset_id,
            }


kaggle_connector = KaggleConnector()
