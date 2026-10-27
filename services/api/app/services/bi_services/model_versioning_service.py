"""
ML Model Versioning Service.

Tracks model versions, parameters, metrics, and artifacts.
Uses a lightweight versioning approach (DB-backed) with optional MLflow integration.
"""
import logging
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pathlib import Path

from app.core.prisma import prisma

logger = logging.getLogger(__name__)

# Model storage directory
MODEL_STORAGE_DIR = Path("uploads/models")
MODEL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)


class ModelVersion:
    """Represents a versioned ML model."""
    def __init__(self, model_id: int, version: int, params: dict, metrics: dict, artifact_path: str):
        self.model_id = model_id
        self.version = version
        self.params = params
        self.metrics = metrics
        self.artifact_path = artifact_path


async def register_model_version(
    model_id: int,
    params: Dict[str, Any],
    metrics: Dict[str, float],
    artifact_bytes: Optional[bytes] = None,
    artifact_format: str = "pkl",
) -> Dict[str, Any]:
    """
    Register a new version of an ML model.
    
    - Increments version number automatically.
    - Stores parameters and metrics as JSON.
    - Optionally stores the model artifact on disk.
    """
    # Get current model
    model = await prisma.mlmodel.find_unique(where={"id": model_id})
    if not model:
        raise ValueError(f"Model {model_id} not found")

    # Determine version number
    existing_params = model.params or {}
    version_history = existing_params.get("_versions", [])
    new_version = len(version_history) + 1

    # Store artifact if provided
    artifact_path = None
    if artifact_bytes:
        artifact_dir = MODEL_STORAGE_DIR / str(model_id)
        artifact_dir.mkdir(parents=True, exist_ok=True)
        artifact_path = str(artifact_dir / f"v{new_version}.{artifact_format}")
        Path(artifact_path).write_bytes(artifact_bytes)

    # Create version record
    version_record = {
        "version": new_version,
        "params": params,
        "metrics": metrics,
        "artifact_path": artifact_path,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_production": False,
    }

    # Update model with new version
    version_history.append(version_record)
    updated_params = {
        **existing_params,
        "_versions": version_history,
        "_latest_version": new_version,
    }

    await prisma.mlmodel.update(
        where={"id": model_id},
        data={
            "params": json.dumps(updated_params),
            "metrics": json.dumps(metrics),
            "modelPath": artifact_path,
        }
    )

    logger.info(f"Registered model {model_id} version {new_version} (metrics: {metrics})")
    return version_record


async def promote_to_production(model_id: int, version: int) -> bool:
    """Mark a specific version as the production model."""
    model = await prisma.mlmodel.find_unique(where={"id": model_id})
    if not model:
        return False

    params = model.params or {}
    if isinstance(params, str):
        params = json.loads(params)
    
    versions = params.get("_versions", [])
    
    # Demote all, promote target
    for v in versions:
        v["is_production"] = (v["version"] == version)

    params["_versions"] = versions
    params["_production_version"] = version

    # Update artifact path to production version
    production_version = next((v for v in versions if v["version"] == version), None)
    artifact_path = production_version["artifact_path"] if production_version else model.modelPath

    await prisma.mlmodel.update(
        where={"id": model_id},
        data={
            "params": json.dumps(params),
            "modelPath": artifact_path,
        }
    )

    logger.info(f"Promoted model {model_id} version {version} to production")
    return True


async def get_model_versions(model_id: int) -> List[Dict[str, Any]]:
    """Get all versions of a model."""
    model = await prisma.mlmodel.find_unique(where={"id": model_id})
    if not model:
        return []

    params = model.params or {}
    if isinstance(params, str):
        params = json.loads(params)
    
    return params.get("_versions", [])


async def get_production_model(model_id: int) -> Optional[Dict[str, Any]]:
    """Get the current production version of a model."""
    versions = await get_model_versions(model_id)
    return next((v for v in versions if v.get("is_production")), None)


async def compare_versions(model_id: int, version_a: int, version_b: int) -> Dict[str, Any]:
    """Compare metrics between two model versions."""
    versions = await get_model_versions(model_id)
    
    va = next((v for v in versions if v["version"] == version_a), None)
    vb = next((v for v in versions if v["version"] == version_b), None)

    if not va or not vb:
        raise ValueError("One or both versions not found")

    return {
        "version_a": {"version": version_a, "metrics": va["metrics"], "params": va["params"]},
        "version_b": {"version": version_b, "metrics": vb["metrics"], "params": vb["params"]},
        "metric_diff": {
            k: vb["metrics"].get(k, 0) - va["metrics"].get(k, 0)
            for k in set(list(va["metrics"].keys()) + list(vb["metrics"].keys()))
        },
    }
