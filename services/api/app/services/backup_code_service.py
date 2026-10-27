"""Backup Code Service for 2FA recovery.

Generates 10 single-use backup codes in XXXX-XXXX format,
hashes them with Argon2 via passlib, stores in SecuritySettings.backupCodes,
verifies with single-use consumption (removes used hash from array).
"""

import secrets
import logging

from app.core.prisma import prisma
from app.core.security import get_password_hash, verify_password

logger = logging.getLogger(__name__)

CODE_COUNT = 10
SEGMENT_LENGTH = 4  # characters per segment


class BackupCodeService:
    """Generate, store, verify, and regenerate backup codes."""

    @staticmethod
    def _generate_single_code() -> str:
        """Generate one 8-character code in XXXX-XXXX format."""
        part1 = secrets.token_hex(2).upper()
        part2 = secrets.token_hex(2).upper()
        return f"{part1}-{part2}"

    @staticmethod
    async def generate_codes() -> list[str]:
        """Generate 10 backup codes. Returns raw codes for one-time display."""
        return [BackupCodeService._generate_single_code() for _ in range(CODE_COUNT)]

    @staticmethod
    async def store_codes(user_id: int, raw_codes: list[str]) -> None:
        """Hash codes with Argon2 and store in SecuritySettings."""
        hashed = [
            get_password_hash(c.replace("-", "").strip().upper()) for c in raw_codes
        ]
        await prisma.securitysettings.upsert(
            where={"userId": user_id},
            data={
                "update": {"backupCodes": hashed},
                "create": {"userId": user_id, "backupCodes": hashed},
            },
        )

    @staticmethod
    async def verify_code(user_id: int, code: str) -> bool:
        """Verify a backup code. Single-use — removes hash on match with distributed lock."""
        from app.core.redis import get_redis

        redis_client = await get_redis()
        lock_key = f"lock:backup_code:{user_id}"
        lock_acquired = False

        if redis_client:
            try:
                # Acquire distributed lock (10 seconds TTL)
                lock_acquired = bool(
                    await redis_client.set(lock_key, "1", ex=10, nx=True)
                )
                if not lock_acquired:
                    logger.warning(
                        f"Concurrent backup code verification blocked for user {user_id}"
                    )
                    return False
            except Exception as e:
                logger.warning(f"Backup code lock failed: {e}")

        try:
            settings = await prisma.securitysettings.find_unique(
                where={"userId": user_id},
            )
            if not settings or not settings.backupCodes:
                return False

            clean_code = code.replace("-", "").strip().upper()
            raw_code = code.strip().upper()
            hashed_codes = list(settings.backupCodes)

            for i, hashed in enumerate(hashed_codes):
                if verify_password(clean_code, hashed) or verify_password(
                    raw_code, hashed
                ):
                    hashed_codes.pop(i)
                    await prisma.securitysettings.update(
                        where={"userId": user_id},
                        data={"backupCodes": hashed_codes},
                    )
                    logger.info(
                        f"Backup code consumed for user {user_id} ({len(hashed_codes)} remaining)"
                    )
                    return True
            return False
        finally:
            if redis_client and lock_acquired:
                try:
                    await redis_client.delete(lock_key)
                except Exception:
                    pass

    @staticmethod
    async def regenerate_codes(user_id: int) -> list[str]:
        """Replace all backup codes with new ones. Invalidates old codes."""
        raw = await BackupCodeService.generate_codes()
        await BackupCodeService.store_codes(user_id, raw)
        return raw

    @staticmethod
    async def get_remaining_count(user_id: int) -> int:
        """Get count of remaining unused backup codes."""
        settings = await prisma.securitysettings.find_unique(
            where={"userId": user_id},
        )
        return len(settings.backupCodes) if settings and settings.backupCodes else 0


backup_code_service = BackupCodeService()
