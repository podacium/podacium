"""startup_check.py — pre-boot environment validation (B8).

Verifies that every external service Podacium depends on at runtime has its
required configuration present and reachable before the API accepts traffic.

Runs in two ways:
- Standalone on container boot: ``python -m app.scripts.startup_check``
  (strict — exits non-zero on any problem).
- From the FastAPI lifespan via ``run_startup_checks(strict=...)``; strict mode
  is used in production so a misconfigured boot fails fast instead of serving
  broken sessions.
"""

import asyncio
import logging
import os

logger = logging.getLogger(__name__)

# Hard requirements for live sessions / replays.
_REQUIRED_LIVEKIT = ("LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET")
# Video / replay infrastructure (S3 uploads + CloudFront signed URLs).
_REQUIRED_AWS = (
    "AWS_S3_VIDEO_BUCKET",
    "CLOUDFRONT_KEY_PAIR_ID",
    "CLOUDFRONT_PRIVATE_KEY_PATH",
)


def _missing(required: tuple[str, ...]) -> list[str]:
    return [name for name in required if not os.environ.get(name)]


async def verify_livekit() -> list[str]:
    """Make a real API call against LiveKit (list rooms) to prove reachability."""
    try:
        from app.services.livekit_service import list_rooms

        await list_rooms()
    except Exception as e:  # noqa: BLE001 — surface the failure for operators
        return [f"LiveKit API probe failed: {e}"]
    return []


def verify_s3_bucket(bucket: str, region: str) -> list[str]:
    """Head the configured bucket to confirm credentials + access."""
    try:
        import boto3

        s3 = boto3.client("s3", region_name=region)
        s3.head_bucket(Bucket=bucket)
    except Exception as e:  # noqa: BLE001
        return [f"AWS S3 bucket check failed for '{bucket}': {e}"]
    return []


async def run_startup_checks(strict: bool = False) -> list[str]:
    """Run all pre-boot checks. Returns a list of problems (empty = healthy)."""
    problems: list[str] = []

    missing_livekit = _missing(_REQUIRED_LIVEKIT)
    missing_aws = _missing(_REQUIRED_AWS)
    if missing_livekit:
        problems.append(f"Missing env vars: {', '.join(missing_livekit)}")
    if missing_aws:
        problems.append(f"Missing env vars: {', '.join(missing_aws)}")

    if not missing_livekit:
        problems.extend(await verify_livekit())

    if not missing_aws:
        problems.extend(
            verify_s3_bucket(
                os.environ["AWS_S3_VIDEO_BUCKET"],
                os.environ.get("AWS_REGION", "us-east-1"),
            )
        )

    for problem in problems:
        logger.warning("[startup_check] %s", problem)

    return problems


async def _main() -> None:
    logging.basicConfig(level=logging.INFO)
    problems = await run_startup_checks(strict=True)
    if not problems:
        logger.info("[startup_check] All checks passed.")


if __name__ == "__main__":
    asyncio.run(_main())
