import logging
from app.core.async_bridge import run_async_in_worker
from app.core.celery import celery_app
from app.core.prisma import connect_prisma, disconnect_prisma
from app.services.phone_verification_service import phone_verification_service
from app.services.billing_services.entitlement_service import entitlement_service

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.cleanup_tasks.cleanup_expired_verifications")
def cleanup_expired_verifications():
    """Daily cleanup of expired phone verification records"""

    async def _do_cleanup():
        try:
            await connect_prisma()
            cleaned = await phone_verification_service.cleanup_expired_verifications()
            logger.info(f"Cleanup tasks: Removed {cleaned} expired verifications")
        finally:
            await disconnect_prisma()

    run_async_in_worker(_do_cleanup())


@celery_app.task(name="app.tasks.cleanup_tasks.cleanup_expired_entitlements")
def cleanup_expired_entitlements():
    """Hourly cleanup of expired entitlements"""

    async def _do_cleanup():
        try:
            await connect_prisma()
            if hasattr(entitlement_service, "cleanup_expired"):
                cleaned = await entitlement_service.cleanup_expired()
                logger.info(f"Cleanup tasks: Removed {cleaned} expired entitlements")
        finally:
            await disconnect_prisma()

    run_async_in_worker(_do_cleanup())


@celery_app.task(name="app.tasks.cleanup_tasks.cleanup_expired_tokens")
def cleanup_expired_tokens():
    """Daily cleanup of expired auth tokens from the database."""

    async def _do_cleanup():
        try:
            await connect_prisma()
            from app.services.token_rotation_service import (
                cleanup_expired_tokens as _cleanup,
            )

            cleaned = await _cleanup()
            logger.info(f"Cleanup tasks: Removed {cleaned} expired tokens")
        finally:
            await disconnect_prisma()

    run_async_in_worker(_do_cleanup())


@celery_app.task(name="app.tasks.cleanup_tasks.cleanup_expired_idempotency_keys")
def cleanup_expired_idempotency_keys():
    """Daily cleanup of expired idempotency keys."""

    async def _do_cleanup():
        try:
            await connect_prisma()
            from app.services.idempotency_service import idempotency_service

            cleaned = await idempotency_service.cleanup_expired()
            logger.info(f"Cleanup tasks: Removed {cleaned} expired idempotency keys")
        finally:
            await disconnect_prisma()

    run_async_in_worker(_do_cleanup())
