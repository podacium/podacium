# app/tasks/certificate_backfill.py
"""
Background task: every 2 minutes scan for enrollments that have reached
100% progress but still have no certificateId, then auto-generate the
missing certificates.

Started by main.py lifespan on server startup.
Cancelled cleanly on shutdown.
"""

import asyncio
import logging

logger = logging.getLogger(__name__)

INTERVAL_SECONDS = 120  # 2 minutes


async def _run_once() -> None:
    """Find completed-but-uncertified enrollments and generate their certs."""
    from app.core.prisma import prisma, ensure_connection
    from app.services.certificate_service import certificate_service

    try:
        await ensure_connection()
        # Find all module enrollments at 100% with no certificate yet
        pending = await prisma.enrollment.find_many(
            where={
                "progress": {"gte": 100},
                "certificateId": None,
                "moduleId": {"not": None},
                "deletedAt": None,
            },
            include={"user": True},
        )

        if not pending:
            return

        logger.info(
            f"[cert-backfill] Found {len(pending)} enrollment(s) missing a certificate — generating…"
        )

        ok = fail = skipped = 0
        for e in pending:
            user_label = e.user.email if e.user else f"userId={e.userId}"
            try:
                cert = await certificate_service.generate_module_certificate(
                    e.userId, e.moduleId
                )
                if cert:
                    logger.info(
                        f"[cert-backfill] ✅ Generated {cert['id']} "
                        f"for {user_label} / module={e.moduleId}"
                    )
                    ok += 1
                else:
                    # Eligibility check inside generate returned None (e.g. quiz not passed)
                    logger.debug(
                        f"[cert-backfill] ⚠️  Skipped {user_label} / module={e.moduleId} "
                        "(eligibility not met)"
                    )
                    skipped += 1
            except Exception as exc:
                logger.error(
                    f"[cert-backfill] ❌ Error for {user_label} / module={e.moduleId}: {exc}"
                )
                fail += 1

        logger.info(
            f"[cert-backfill] Done — generated={ok}, skipped={skipped}, errors={fail}"
        )

    except Exception as exc:
        logger.error(f"[cert-backfill] Scan failed: {exc}")


async def certificate_backfill_loop() -> None:
    """Infinite loop that runs _run_once() every INTERVAL_SECONDS."""
    logger.info(f"[cert-backfill] Scheduler started — interval={INTERVAL_SECONDS}s")

    # Initial delay before first pass so API boots cleanly without PDF generation spike
    await asyncio.sleep(30)
    await _run_once()

    while True:
        try:
            await asyncio.sleep(INTERVAL_SECONDS)
            await _run_once()
        except asyncio.CancelledError:
            logger.info("[cert-backfill] Scheduler cancelled — shutting down.")
            break
        except Exception as exc:
            # Log but never die — sleep before retrying
            logger.error(f"[cert-backfill] Unexpected error in loop: {exc}")
            await asyncio.sleep(10)
