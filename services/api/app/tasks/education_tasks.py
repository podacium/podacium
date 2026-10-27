import logging
from app.core.async_bridge import run_async_in_worker
from app.core.celery import celery_app
from app.core.prisma import connect_prisma, disconnect_prisma

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.education_tasks.generate_bulk_certificates")
def generate_bulk_certificates(user_id: int, path_id: str):
    """Generate all certificates for a path completion (asynchronous)"""

    async def _do_generate():
        try:
            await connect_prisma()
            logger.info(
                f"Generating bulk certificates for user {user_id} and path {path_id}"
            )
        finally:
            await disconnect_prisma()

    run_async_in_worker(_do_generate())
