"""Seed reserved usernames for profile system."""
import logging
from app.core.prisma import prisma

logger = logging.getLogger(__name__)

RESERVED_USERNAMES = [
    # Platform & system
    "admin", "support", "podacium", "api", "login", "signup", "settings",
    "dashboard", "profile", "search", "notification", "message", "payment",
    "about", "help", "terms", "privacy", "security", "status", "team",
    "careers", "contact", "feedback", "developer", "moderator", "staff",
    "official", "system", "root", "null", "undefined",
    "administrator", "webmaster", "hostmaster", "postmaster", "info",
    "mail", "email", "billing", "invoice", "receipt", "wallet", "escrow",
    # Pillar names
    "edtech", "freelancing", "business", "bi", "analytics", "learn",
    "work", "analyze", "grow", "skill", "passport", "certificate",
    "course", "module", "lesson", "quiz", "project", "contract",
    "proposal", "milestone", "dispute", "review", "rating",
    # Common reserved
    "ceo", "cto", "founder", "manager", "director", "president",
    "ceo", "vp", "sre", "devops", "engineer", "admin0",
    # Common squats
    "test", "demo", "example", "sample", "temp", "new", "user",
    "guest", "anonymous", "nobody", "ghost", "bot", "service",
]

async def seed_reserved_usernames():
    """Seed reserved usernames into the database."""
    count = 0
    for name in RESERVED_USERNAMES:
        try:
            await prisma.reservedusername.upsert(
                where={"name": name},
                data={
                    "create": {"name": name},
                    "update": {},
                },
            )
            count += 1
        except Exception as e:
            logger.warning(f"Failed to seed reserved username '{name}': {e}")
    logger.info(f"Seeded {count} reserved usernames")
    return count