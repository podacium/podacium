import logging

logger = logging.getLogger(__name__)
"""
History Service
Manages dataset activity logging and history retrieval.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from app.core.prisma import prisma

class HistoryService:
    """Service for tracking dataset history events"""
    
    @staticmethod
    async def log_event(
        dataset_id: int,
        action: str,
        user_id: int,
        details: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log a history event for a dataset.
        
        Args:
            dataset_id: ID of the dataset
            action: Action name (e.g. "UPLOADED", "ANALYZED", "QUALITY_CHECKED")
            user_id: ID of the user performing the action
            details: Human-readable details
            metadata: Structured metadata for the event
        """
        try:
            # We assume there is a model for DatasetHistory or we use a generic audit log
            import json
            
            dataset = await prisma.dataset.find_unique(where={"id": dataset_id})
            if not dataset:
                return

            current_metadata = dataset.metadata
            if isinstance(current_metadata, str):
                current_metadata = json.loads(current_metadata)
            if not isinstance(current_metadata, dict):
                current_metadata = {}
                
            history = current_metadata.get("history", [])
            
            # Add new event
            new_event = {
                "action": action,
                "user_id": user_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "details": details,
                "metadata": metadata or {}
            }
            
            history.insert(0, new_event) # Newest first
            
            # Keep log size reasonable
            if len(history) > 50:
                history = history[:50]
                
            current_metadata["history"] = history
            
            from app.generated.prisma import Json
            
            await prisma.dataset.update(
                where={"id": dataset_id},
                data={"metadata": Json(current_metadata)}
            )
            
        except Exception as e:
            logger.exception("Failed to log history event: %s", str(e))

    @staticmethod
    async def get_history(dataset_id: int) -> List[Dict[str, Any]]:
        """Get history events for a dataset"""
        try:
            import json
            dataset = await prisma.dataset.find_unique(where={"id": dataset_id})
            if not dataset:
                return []
                
            metadata = dataset.metadata
            if isinstance(metadata, str):
                metadata = json.loads(metadata)
            if not isinstance(metadata, dict):
                metadata = {}
                
            history = metadata.get("history", [])
            
            # If history is empty, synthesize basic events from timestamps
            if not history:
                events = []
                if dataset.createdAt:
                    events.append({
                        "action": "UPLOADED",
                        "user_id": dataset.userId,
                        "timestamp": dataset.createdAt.isoformat(),
                        "details": f"Dataset uploaded as {dataset.originalFilename or dataset.name}"
                    })
                if dataset.processedAt:
                    events.append({
                        "action": "PROCESSED",
                        "user_id": "SYSTEM",
                        "timestamp": dataset.processedAt.isoformat(),
                        "details": f"Processed {dataset.rowCount} rows"
                    })
                if dataset.updatedAt and dataset.updatedAt != dataset.createdAt:
                     events.append({
                        "action": "UPDATED",
                        "user_id": "SYSTEM", # We don't know who updated if not tracked
                        "timestamp": dataset.updatedAt.isoformat(),
                        "details": "Dataset metadata updated"
                    })
                
                # Sort by timestamp desc
                events.sort(key=lambda x: x["timestamp"], reverse=True)
                return events
                
            return history
            
        except Exception as e:
            logger.exception("Failed to get history: %s", str(e))
            return []
