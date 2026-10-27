"""Backfill usernames for existing users who don't have one.
Run once after migration adds the username column.
Usage: python -m app.scripts.backfill_usernames
"""
import asyncio
import logging
import re
from app.core.prisma import prisma
from app.services.profile_service import slugify, RESERVED_USERNAMES

logger = logging.getLogger(__name__)

USERNAME_REGEX = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_-]{1,28}[a-zA-Z0-9]$')


def generate_username(email: str | None, full_name: str | None, user_id: int) -> str:
    if email:
        base = email.split("@")[0].lower()
        base = re.sub(r'[^a-zA-Z0-9_-]', '', base)
        if base and len(base) >= 3 and USERNAME_REGEX.match(base) and base.lower() not in RESERVED_USERNAMES:
            return base

    if full_name:
        base = full_name.lower().replace(" ", "-").replace("_", "-")
        base = re.sub(r'[^a-zA-Z0-9-]', '', base)
        base = base[:25]
        if base and len(base) >= 3 and USERNAME_REGEX.match(base) and base.lower() not in RESERVED_USERNAMES:
            return base

    return f"user-{user_id}"


async def backfill_usernames(dry_run: bool = True) -> int:
    await prisma.connect()
    try:
        users = await prisma.user.find_many(where={"username": None})
        if not users:
            logger.info("No users need backfill")
            return 0

        logger.info(f"Found {len(users)} users without usernames")
        count = 0

        for user in users:
            candidate = generate_username(user.email, user.fullName, user.id)
            existing = await prisma.user.find_unique(where={"username": candidate})
            if existing:
                candidate = f"{candidate}-{user.id}"
            new_slug = slugify(candidate)

            if dry_run:
                logger.info(f"[DRY RUN] User {user.id} ({user.fullName}): username={candidate}, slug={new_slug}")
            else:
                await prisma.user.update(
                    where={"id": user.id},
                    data={"username": candidate, "slug": new_slug},
                )
                logger.info(f"User {user.id}: set username={candidate}")
            count += 1

        if dry_run:
            logger.info(f"Dry run complete. Would update {count} users. Run with dry_run=False to apply.")
        else:
            logger.info(f"Updated {count} users with usernames")

        return count
    finally:
        await prisma.disconnect()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import sys
    dry = "--apply" not in sys.argv
    asyncio.run(backfill_usernames(dry_run=dry))
