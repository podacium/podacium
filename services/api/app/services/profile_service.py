"""Profile service — profile resolution, privacy enforcement, unified profile building."""

import logging
from typing import List, Optional

from app.core.prisma import prisma

logger = logging.getLogger(__name__)

DEFAULT_PRIVACY = {
    "profileVisibility": "PUBLIC",
    "searchVisibility": True,
    "activityStatus": True,
    "readReceipts": True,
    "showBio": "INHERIT",
    "showSkills": "INHERIT",
    "showPortfolio": "INHERIT",
    "showCertificates": "INHERIT",
    "showReviews": "INHERIT",
    "showEnrollments": "INHERIT",
    "showContactInfo": "INHERIT",
    "showOrganization": "INHERIT",
    "showTagline": "INHERIT",
    "showHeadline": "INHERIT",
    "showPronouns": "INHERIT",
    "showAvailability": "INHERIT",
    "showRating": "INHERIT",
    "showEmail": False,
    "showPhone": False,
    "showLastActive": True,
}

RESERVED_USERNAMES = frozenset(
    {
        "admin",
        "support",
        "podacium",
        "api",
        "login",
        "signup",
        "settings",
        "dashboard",
        "profile",
        "search",
        "notification",
        "message",
        "payment",
        "about",
        "help",
        "terms",
        "privacy",
        "security",
        "status",
        "team",
        "careers",
        "contact",
        "feedback",
        "developer",
        "moderator",
        "staff",
        "official",
        "system",
        "root",
        "null",
        "undefined",
        "administrator",
        "webmaster",
        "hostmaster",
        "postmaster",
        "info",
        "mail",
        "email",
        "billing",
        "invoice",
        "receipt",
        "wallet",
        "escrow",
        "edtech",
        "freelancing",
        "business",
        "bi",
        "analytics",
        "learn",
        "work",
        "analyze",
        "grow",
        "skill",
        "passport",
        "certificate",
        "course",
        "module",
        "lesson",
        "quiz",
        "project",
        "contract",
        "proposal",
        "milestone",
        "dispute",
        "review",
        "rating",
    }
)


class ProfileVisibilityResolver:
    """Resolves what sections a requesting user can see on a target user's profile."""

    def __init__(self, target_user_id: int, requesting_user_id: Optional[int] = None):
        self.target = target_user_id
        self.requestor = requesting_user_id
        self.is_own = requesting_user_id == target_user_id
        self._privacy: Optional[dict] = None
        self._is_blocked: Optional[bool] = None
        self._is_following: Optional[bool] = None

    async def can_view_profile(self) -> bool:
        """Global gate: can the requesting user see this profile at all?"""
        if self.is_own:
            return True
        if await self._is_blocked_by_target():
            return False
        pv = await self._get_profile_visibility()
        if pv == "PUBLIC":
            return True
        if pv == "CONNECTIONS":
            return await self._is_following_user()
        return False

    async def can_view_section(self, section: str) -> bool:
        """Per-section check: can the requesting user see this specific section?"""
        if self.is_own:
            return True
        if not await self.can_view_profile():
            return False
        privacy = await self._get_privacy_settings()

        # Handle boolean privacy flags (email, phone, lastActive)
        if section.lower() in ("email", "phone", "lastactive"):
            section_key = f"show{section[0].upper()}{section[1:]}"
            val = privacy.get(section_key, False)
            if isinstance(val, bool):
                return val
            if isinstance(val, str):
                if val == "PRIVATE":
                    return False
                if val == "CONNECTIONS":
                    return await self._is_following_user()
                if val == "PUBLIC":
                    return True
            return False

        section_key = f"show{section[0].upper()}{section[1:]}"
        override = privacy.get(section_key, "INHERIT")
        if override == "PRIVATE":
            return False
        if override == "CONNECTIONS":
            return await self._is_following_user()
        if override == "PUBLIC":
            return True
        pv = privacy.get("profileVisibility", "PUBLIC")
        if pv == "CONNECTIONS":
            return await self._is_following_user()
        return pv == "PUBLIC"

    async def get_visible_sections(self, sections: List[str]) -> List[str]:
        """Return only the sections the requesting user can see."""
        visible = []
        for section in sections:
            if await self.can_view_section(section):
                visible.append(section)
        return visible

    async def _get_profile_visibility(self) -> str:
        settings = await self._get_privacy_settings()
        return settings.get("profileVisibility", "PUBLIC")

    async def _get_privacy_settings(self) -> dict:
        if self._privacy is None:
            settings = await prisma.privacysettings.find_unique(
                where={"userId": self.target}
            )
            if settings:
                self._privacy = _privacy_to_dict(settings)
            else:
                self._privacy = dict(DEFAULT_PRIVACY)
        return self._privacy

    async def _is_following_user(self) -> bool:
        if not self.requestor:
            return False
        if self._is_following is not None:
            return self._is_following
        follow = await prisma.userfollow.find_unique(
            where={
                "followerId_followingId": {
                    "followerId": self.requestor,
                    "followingId": self.target,
                }
            }
        )
        self._is_following = follow is not None
        return self._is_following

    async def _is_blocked_by_target(self) -> bool:
        if not self.requestor:
            return False
        if self._is_blocked is not None:
            return self._is_blocked
        block = await prisma.userblock.find_first(
            where={
                "OR": [
                    {"blockerId": self.target, "blockedId": self.requestor},
                    {"blockerId": self.requestor, "blockedId": self.target},
                ]
            }
        )
        self._is_blocked = block is not None
        return self._is_blocked


def _privacy_to_dict(settings) -> dict:
    """Convert a PrivacySettings model instance to a flat dict."""
    return {
        "profileVisibility": getattr(settings, "profileVisibility", "PUBLIC")
        or "PUBLIC",
        "searchVisibility": getattr(settings, "searchVisibility", True),
        "activityStatus": getattr(settings, "activityStatus", True),
        "readReceipts": getattr(settings, "readReceipts", True),
        "showBio": getattr(settings, "showBio", "INHERIT") or "INHERIT",
        "showSkills": getattr(settings, "showSkills", "INHERIT") or "INHERIT",
        "showPortfolio": getattr(settings, "showPortfolio", "INHERIT") or "INHERIT",
        "showCertificates": getattr(settings, "showCertificates", "INHERIT")
        or "INHERIT",
        "showReviews": getattr(settings, "showReviews", "INHERIT") or "INHERIT",
        "showEnrollments": getattr(settings, "showEnrollments", "INHERIT") or "INHERIT",
        "showContactInfo": getattr(settings, "showContactInfo", "INHERIT") or "INHERIT",
        "showOrganization": getattr(settings, "showOrganization", "INHERIT")
        or "INHERIT",
        "showTagline": getattr(settings, "showTagline", "INHERIT") or "INHERIT",
        "showHeadline": getattr(settings, "showHeadline", "INHERIT") or "INHERIT",
        "showPronouns": getattr(settings, "showPronouns", "INHERIT") or "INHERIT",
        "showAvailability": getattr(settings, "showAvailability", "INHERIT")
        or "INHERIT",
        "showRating": getattr(settings, "showRating", "INHERIT") or "INHERIT",
        "showEmail": getattr(settings, "showEmail", False),
        "showPhone": getattr(settings, "showPhone", False),
        "showLastActive": getattr(settings, "showLastActive", True),
    }


# ── USERNAME VALIDATION ──────────────────────────────────────────────

import re

USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{1,28}[a-zA-Z0-9]$")
USERNAME_MIN_LENGTH = 3
USERNAME_MAX_LENGTH = 30
USERNAME_CHANGE_COOLDOWN_DAYS = 14
USERNAME_REDIRECT_TTL_DAYS = 90


def validate_username(username: str) -> Optional[str]:
    """Validate a username. Returns an error message or None if valid."""
    if not username or len(username) < USERNAME_MIN_LENGTH:
        return f"Username must be at least {USERNAME_MIN_LENGTH} characters"
    if len(username) > USERNAME_MAX_LENGTH:
        return f"Username must be at most {USERNAME_MAX_LENGTH} characters"
    if not USERNAME_REGEX.match(username):
        return "Username must be 3-30 characters, start and end with alphanumeric, and contain only letters, numbers, hyphens, and underscores"
    lower = username.lower()
    if lower in RESERVED_USERNAMES:
        return "This username is reserved"
    return None


def slugify(text: str) -> str:
    """Create an SEO-friendly slug from a username."""
    return text.lower().replace("_", "-").replace(" ", "-")


class ProfileService:
    """High-level profile operations — resolution, enrichment, privacy-aware retrieval."""

    async def resolve_profile(self, identifier: str) -> Optional[dict]:
        """Resolve a profile identifier (ID or username) to a user.

        Handles:
        - Numeric IDs: direct lookup
        - Usernames: direct lookup, then redirect lookup (for old usernames)
        """
        from datetime import datetime, timezone

        if identifier.isdigit():
            user = await prisma.user.find_unique(where={"id": int(identifier)})
            if user:
                return user
        else:
            user = await prisma.user.find_unique(where={"username": identifier})
            if user:
                return user
            redirect = await prisma.usernameredirect.find_first(
                where={
                    "oldUsername": identifier,
                    "expiresAt": {"gt": datetime.now(timezone.utc)},
                }
            )
            if redirect:
                return await prisma.user.find_unique(where={"id": redirect.newUserId})
        return None

    async def get_public_profile_data(
        self, user, resolver: ProfileVisibilityResolver
    ) -> dict:
        """Build the public-facing profile dict from a user record, privacy-filtered."""

        profile = {
            "id": user.id,
            "username": getattr(user, "username", None),
            "full_name": user.fullName,
            "role": user.role,
            "avatar_url": user.profilePictureUrl,
            "member_since": user.createdAt.isoformat() if user.createdAt else None,
        }
        sections = []

        if await resolver.can_view_section("bio") and user.bio:
            profile["bio"] = user.bio
            sections.append("bio")

        if await resolver.can_view_section("headline"):
            headline = getattr(user, "title", None)
            if headline:
                profile["headline"] = headline
                sections.append("headline")

        if await resolver.can_view_section("tagline"):
            tagline = None
            if tagline:
                profile["tagline"] = tagline
                sections.append("tagline")

        if await resolver.can_view_section("pronouns"):
            pronouns = None
            if pronouns:
                profile["pronouns"] = pronouns
                sections.append("pronouns")

        if await resolver.can_view_section("contact_info"):
            email = user.email
            phone = user.phoneNumber
            profile["contact"] = {}
            can_show_email = await resolver.can_view_section("email")
            can_show_phone = await resolver.can_view_section("phone")
            if email and user.email and can_show_email:
                profile["contact"]["email"] = email
            if phone and user.phoneNumber and can_show_phone:
                profile["contact"]["phone"] = phone
            social = user.socialLinks
            if social:
                profile["contact"]["social_links"] = social
            sections.append("contact")

        if await resolver.can_view_section("country"):
            if user.country:
                profile["country"] = user.country
            if user.city:
                profile["city"] = user.city
            sections.append("location")

        if await resolver.can_view_section("skills"):
            profile["skills"] = user.skills or []
            sections.append("skills")

        if await resolver.can_view_section("availability"):
            availability = getattr(user, "availability", None)
            if availability:
                profile["availability"] = availability
                sections.append("availability")

        if await resolver.can_view_section("rating"):
            avg_rating = getattr(user, "averageRating", None)
            review_count = getattr(user, "reviewCount", 0)
            if avg_rating:
                profile["average_rating"] = float(avg_rating)
                profile["review_count"] = review_count
                sections.append("rating")

        follower_count = await prisma.userfollow.count(where={"followingId": user.id})
        following_count = await prisma.userfollow.count(where={"followerId": user.id})
        profile["follower_count"] = follower_count
        profile["following_count"] = following_count
        profile["sections"] = sections
        return profile


profile_service = ProfileService()
