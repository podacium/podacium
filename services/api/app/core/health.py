"""
Production Health Check Endpoint

Provides comprehensive health checks for all critical dependencies:
- PostgreSQL database
- Redis cache
- Celery workers
- S3/Backblaze B2 storage
"""

import asyncio
import logging
import time
from typing import Dict, Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.config import setting
from app.core.prisma import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["health"])


class HealthCheck(BaseModel):
    """Individual health check result."""
    healthy: bool
    latency_ms: float
    details: Dict[str, Any] = {}


class HealthResponse(BaseModel):
    """Overall health response."""
    status: str
    timestamp: float
    checks: Dict[str, HealthCheck]
    version: str = "1.0.0"
    environment: str


async def check_database() -> HealthCheck:
    """Check PostgreSQL connectivity."""
    start = time.perf_counter()
    try:
        await prisma.execute_raw("SELECT 1")
        latency = (time.perf_counter() - start) * 1000
        return HealthCheck(healthy=True, latency_ms=round(latency, 2), details={"query": "SELECT 1"})
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        logger.error(f"Database health check failed: {e}")
        return HealthCheck(
            healthy=False,
            latency_ms=round(latency, 2),
            details={"error": str(e)}
        )


async def check_redis() -> HealthCheck:
    """Check Redis connectivity."""
    start = time.perf_counter()
    try:
        if not setting.REDIS_URL:
            return HealthCheck(
                healthy=False,
                latency_ms=0,
                details={"error": "REDIS_URL not configured"}
            )

        import redis.asyncio as aioredis
        r = aioredis.from_url(
            setting.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        await r.ping()
        await r.close()
        latency = (time.perf_counter() - start) * 1000
        return HealthCheck(healthy=True, latency_ms=round(latency, 2), details={"operation": "PING"})
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        logger.error(f"Redis health check failed: {e}")
        return HealthCheck(
            healthy=False,
            latency_ms=round(latency, 2),
            details={"error": str(e)}
        )


async def check_celery() -> HealthCheck:
    """Check Celery worker availability."""
    start = time.perf_counter()
    try:
        if not setting.CELERY_BROKER_URL:
            return HealthCheck(
                healthy=False,
                latency_ms=0,
                details={"error": "CELERY_BROKER_URL not configured"}
            )

        # Try to inspect active workers
        from celery import Celery
        app = Celery("health_check")
        app.conf.broker_url = setting.CELERY_BROKER_URL
        app.conf.result_backend = setting.CELERY_RESULT_BACKEND

        inspect = app.control.inspect(timeout=3.0)
        stats = inspect.stats()
        active = inspect.active()

        if stats is None or active is None:
            latency = (time.perf_counter() - start) * 1000
            return HealthCheck(
                healthy=False,
                latency_ms=round(latency, 2),
                details={"error": "No workers responding"}
            )

        worker_count = len(stats)
        latency = (time.perf_counter() - start) * 1000
        return HealthCheck(
            healthy=True,
            latency_ms=round(latency, 2),
            details={
                "workers": worker_count,
                "active_tasks": sum(len(tasks) for tasks in active.values()) if active else 0
            }
        )
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        logger.error(f"Celery health check failed: {e}")
        return HealthCheck(
            healthy=False,
            latency_ms=round(latency, 2),
            details={"error": str(e)}
        )


async def check_s3() -> HealthCheck:
    """Check S3/Backblaze B2 connectivity."""
    start = time.perf_counter()
    try:
        # Check if S3 credentials are configured
        if not all([
            setting.AWS_ACCESS_KEY_ID,
            setting.AWS_SECRET_ACCESS_KEY,
            setting.AWS_DEFAULT_REGION,
        ]):
            return HealthCheck(
                healthy=False,
                latency_ms=0,
                details={"error": "S3 credentials not fully configured"}
            )

        import boto3
        from botocore.config import Config

        # Use a short timeout for health checks
        config = Config(
            connect_timeout=3,
            read_timeout=3,
            retries={"max_attempts": 1}
        )

        s3 = boto3.client(
            "s3",
            region_name=setting.AWS_DEFAULT_REGION,
            aws_access_key_id=setting.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=setting.AWS_SECRET_ACCESS_KEY,
            config=config,
        )

        # Use head_bucket for lightweight check (no data transfer)
        bucket = getattr(setting, "S3_BACKUP_BUCKET", "podacium-backups")
        s3.head_bucket(Bucket=bucket)

        latency = (time.perf_counter() - start) * 1000
        return HealthCheck(
            healthy=True,
            latency_ms=round(latency, 2),
            details={"bucket": bucket, "operation": "head_bucket"}
        )
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        logger.error(f"S3 health check failed: {e}")
        return HealthCheck(
            healthy=False,
            latency_ms=round(latency, 2),
            details={"error": str(e)}
        )


@router.get(
    "",
    response_model=HealthResponse,
    summary="Comprehensive health check",
    description="Checks all critical dependencies. Returns 200 if all healthy, 503 if any fail.",
)
async def health_check():
    """
    Comprehensive health check endpoint.

    Returns:
    - 200 OK: All checks pass
    - 503 Service Unavailable: At least one check fails

    Response body includes individual check results with latency.
    """
    # Run all checks concurrently
    db_check, redis_check, celery_check, s3_check = await asyncio.gather(
        check_database(),
        check_redis(),
        check_celery(),
        check_s3(),
        return_exceptions=True,
    )

    # Handle exceptions from gather
    checks = {
        "database": db_check if isinstance(db_check, HealthCheck) else HealthCheck(healthy=False, latency_ms=0, details={"error": str(db_check)}),
        "redis": redis_check if isinstance(redis_check, HealthCheck) else HealthCheck(healthy=False, latency_ms=0, details={"error": str(redis_check)}),
        "celery": celery_check if isinstance(celery_check, HealthCheck) else HealthCheck(healthy=False, latency_ms=0, details={"error": str(celery_check)}),
        "s3": s3_check if isinstance(s3_check, HealthCheck) else HealthCheck(healthy=False, latency_ms=0, details={"error": str(s3_check)}),
    }

    all_healthy = all(check.healthy for check in checks.values())
    overall_status = "healthy" if all_healthy else "unhealthy"

    response = HealthResponse(
        status=overall_status,
        timestamp=time.time(),
        checks=checks,
        environment=setting.ENVIRONMENT,
    )

    if not all_healthy:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=response.model_dump()
        )

    return response


@router.get(
    "/live",
    summary="Liveness probe",
    description="Simple liveness check for Kubernetes/container orchestrators.",
)
async def liveness():
    """Kubernetes liveness probe - returns 200 if process is alive."""
    return {"status": "alive", "timestamp": time.time()}


@router.get(
    "/ready",
    summary="Readiness probe",
    description="Readiness check - returns 200 if ready to serve traffic (DB + Redis up).",
)
async def readiness():
    """
    Kubernetes readiness probe.

    Returns 200 if database and Redis are accessible.
    Returns 503 if critical dependencies are down.
    """
    db_check = await check_database()
    redis_check = await check_redis()

    ready = db_check.healthy and redis_check.healthy

    response = {
        "status": "ready" if ready else "not_ready",
        "timestamp": time.time(),
        "database": "healthy" if db_check.healthy else "unhealthy",
        "redis": "healthy" if redis_check.healthy else "unhealthy",
    }

    if not ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=response
        )

    return response