import logging

logger = logging.getLogger(__name__)
from app.core.prisma import prisma
from app.schemas.settings import *
from typing import Optional
from datetime import datetime, timedelta


class SettingsService:
    def __init__(self):
        self.db = prisma

    # Account Settings
    async def get_account_settings(
        self, user_id: int
    ) -> Optional[AccountSettingsResponse]:
        """Get account settings with FRESH user data"""
        try:
            logger.debug("Operation processed")

            # Get FRESH user data directly from database using include (not select)
            user = await self.db.user.find_unique(
                where={"id": user_id},
                include={
                    "ownedOrganizations": True,
                    "primaryOrganization": True,
                    "userSettings": True,
                },
            )

            if not user:
                logger.error(f"Error: {user_id}")
                return None

            logger.info("Operation completed")
            logger.debug("Operation processed")

            user_settings = user.userSettings

            return AccountSettingsResponse(
                email=user.email,
                phone_number=user.phoneNumber,
                subscribe_newsletter=user.subscribeNewsletter,
                language=user_settings.language if user_settings else "en",
                timezone=user_settings.timezone if user_settings else "UTC",
                date_format=user_settings.dateFormat if user_settings else "MM/DD/YYYY",
                time_format=user_settings.timeFormat if user_settings else "12h",
                full_name=user.fullName,
                avatar_url=user.profilePictureUrl,
                headline=user.headline,
                bio=user.bio,
                email_verified=user.emailVerified,  # This should now be correct
                phone_verified=user.phoneVerified,  # This should now be correct
                created_at=user.createdAt,
                updated_at=user.updatedAt,
            )

        except Exception as e:
            logger.error(f"Error: {str(e)}")
            logger.debug("Operation processed")
            return None

    async def update_account_settings(
        self, user_id: int, settings: AccountSettingsUpdate
    ) -> AccountSettingsResponse:
        """Update account settings with proper verification handling and uniqueness checks"""
        try:
            logger.debug("Operation processed")
            logger.debug("Operation processed")

            # Get current user data first
            current_user = await self.db.user.find_unique(where={"id": user_id})
            if not current_user:
                raise ValueError("User not found")

            # Update user fields
            user_update_data = {}

            # Handle email change - reset verification if email changed
            if settings.email is not None and settings.email != current_user.email:
                # Check if new email is already used by another user
                existing_email_user = await self.db.user.find_first(
                    where={
                        "email": settings.email,
                        "id": {"not": user_id},  # Exclude current user
                    }
                )
                if existing_email_user:
                    raise ValueError(
                        f"Email {settings.email} is already registered to another account"
                    )

                user_update_data["email"] = settings.email
                user_update_data["emailVerified"] = False
                logger.debug("Operation processed")

            # Handle phone number change - reset verification if phone changed
            if (
                settings.phone_number is not None
                and settings.phone_number != current_user.phoneNumber
            ):
                # Check if phone number is already used by another user
                existing_phone_user = await self.db.user.find_first(
                    where={
                        "phoneNumber": settings.phone_number,
                        "id": {"not": user_id},  # Exclude current user
                    }
                )
                if existing_phone_user:
                    raise ValueError(
                        f"Phone number {settings.phone_number} is already registered to another account"
                    )

                user_update_data["phoneNumber"] = settings.phone_number
                user_update_data["phoneVerified"] = False
                logger.debug("Operation processed")

            # Handle newsletter subscription
            if settings.subscribe_newsletter is not None:
                user_update_data["subscribeNewsletter"] = settings.subscribe_newsletter

            # Handle full_name update
            if settings.full_name is not None:
                user_update_data["fullName"] = settings.full_name

            # Handle avatar_url update
            if settings.avatar_url is not None:
                user_update_data["profilePictureUrl"] = settings.avatar_url

            # Handle headline & bio updates
            if settings.headline is not None:
                user_update_data["headline"] = settings.headline
            if settings.bio is not None:
                user_update_data["bio"] = settings.bio

            if user_update_data:
                logger.debug("Operation processed")
                await self.db.user.update(where={"id": user_id}, data=user_update_data)
                logger.debug("Operation processed")
            else:
                logger.debug("Operation processed")

            # Update regional settings in UserSettings table
            regional_data = {}
            if settings.language is not None:
                regional_data["language"] = settings.language
            if settings.timezone is not None:
                regional_data["timezone"] = settings.timezone
            if settings.date_format is not None:
                regional_data["dateFormat"] = settings.date_format
            if settings.time_format is not None:
                regional_data["timeFormat"] = settings.time_format

            if regional_data:
                await self.db.usersettings.upsert(
                    where={"userId": user_id},
                    data={
                        "create": {"userId": user_id, **regional_data},
                        "update": regional_data,
                    },
                )

            return await self.get_account_settings(user_id)

        except ValueError as e:
            # Re-raise validation errors to be handled by the router
            logger.error(f"Error: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error: {str(e)}")
            # Handle database unique constraint errors gracefully
            if "Unique constraint" in str(e) or "phoneNumber" in str(e):
                raise ValueError(
                    "Phone number is already registered to another account"
                )
            raise

    # Appearance Settings
    async def get_appearance_settings(
        self, user_id: int
    ) -> Optional[AppearanceSettingsResponse]:
        """Get appearance settings from database or return defaults"""
        try:
            appearance = await self.db.appearancesettings.find_unique(
                where={"userId": user_id}
            )
            if appearance:
                return AppearanceSettingsResponse(
                    theme=appearance.theme.lower()
                    if hasattr(appearance, "theme") and appearance.theme
                    else "system",
                    reduced_motion=appearance.reducedMotion,
                    high_contrast=appearance.highContrast,
                    font_size=appearance.fontSize,
                    density=appearance.density,
                    user_id=user_id,
                    created_at=appearance.createdAt,
                    updated_at=appearance.updatedAt,
                )

            # Default fallback if row doesn't exist
            return AppearanceSettingsResponse(
                theme="system",
                reduced_motion=False,
                high_contrast=False,
                font_size="medium",
                density="comfortable",
                user_id=user_id,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
        except Exception as e:
            logger.error(f"Error: {str(e)}")
            return None

    async def update_appearance_settings(
        self, user_id: int, settings: AppearanceSettingsUpdate
    ) -> Optional[AppearanceSettingsResponse]:
        """Update or create appearance settings"""
        try:
            theme_val = settings.theme.upper() if settings.theme else "SYSTEM"

            await self.db.appearancesettings.upsert(
                where={"userId": user_id},
                data={
                    "create": {
                        "userId": user_id,
                        "theme": theme_val,
                        "reducedMotion": settings.reduced_motion,
                        "highContrast": settings.high_contrast,
                        "fontSize": settings.font_size,
                        "density": settings.density,
                    },
                    "update": {
                        "theme": theme_val,
                        "reducedMotion": settings.reduced_motion,
                        "highContrast": settings.high_contrast,
                        "fontSize": settings.font_size,
                        "density": settings.density,
                    },
                },
            )
            return await self.get_appearance_settings(user_id)
        except Exception as e:
            logger.error(f"Error: {str(e)}")
            return None

    # Privacy Settings
    async def get_privacy_settings(
        self, user_id: int
    ) -> Optional[PrivacySettingsResponse]:
        """Get privacy settings from database or return defaults"""
        try:
            privacy = await self.db.privacysettings.find_unique(
                where={"userId": user_id}
            )
            if privacy:
                return PrivacySettingsResponse(
                    profile_visibility=privacy.profileVisibility.lower()
                    if hasattr(privacy, "profileVisibility")
                    and privacy.profileVisibility
                    else "public",
                    search_visibility=privacy.searchVisibility,
                    activity_status=privacy.activityStatus,
                    read_receipts=privacy.readReceipts,
                    show_bio=_section_val(privacy, "showBio"),
                    show_skills=_section_val(privacy, "showSkills"),
                    show_portfolio=_section_val(privacy, "showPortfolio"),
                    show_certificates=_section_val(privacy, "showCertificates"),
                    show_reviews=_section_val(privacy, "showReviews"),
                    show_enrollments=_section_val(privacy, "showEnrollments"),
                    show_contact_info=_section_val(privacy, "showContactInfo"),
                    show_organization=_section_val(privacy, "showOrganization"),
                    show_tagline=_section_val(privacy, "showTagline"),
                    show_headline=_section_val(privacy, "showHeadline"),
                    show_pronouns=_section_val(privacy, "showPronouns"),
                    show_availability=_section_val(privacy, "showAvailability"),
                    show_rating=_section_val(privacy, "showRating"),
                    show_email=privacy.showEmail,
                    show_phone=privacy.showPhone,
                    show_last_active=privacy.showLastActive,
                    user_id=user_id,
                    created_at=privacy.createdAt,
                    updated_at=privacy.updatedAt,
                )

            return PrivacySettingsResponse(
                profile_visibility="public",
                search_visibility=True,
                activity_status=True,
                read_receipts=True,
                show_bio="inherit",
                show_skills="inherit",
                show_portfolio="inherit",
                show_certificates="inherit",
                show_reviews="inherit",
                show_enrollments="inherit",
                show_contact_info="inherit",
                show_organization="inherit",
                show_tagline="inherit",
                show_headline="inherit",
                show_pronouns="inherit",
                show_availability="inherit",
                show_rating="inherit",
                show_email=False,
                show_phone=False,
                show_last_active=True,
                user_id=user_id,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
        except Exception as e:
            logger.error(f"Error: {str(e)}")
            return None

    async def update_privacy_settings(
        self, user_id: int, settings: PrivacySettingsUpdate
    ) -> Optional[PrivacySettingsResponse]:
        """Update or create privacy settings"""
        try:
            visibility_val = (
                settings.profile_visibility.upper()
                if settings.profile_visibility
                else "PUBLIC"
            )

            data = {
                "profileVisibility": visibility_val,
                "searchVisibility": settings.search_visibility,
                "activityStatus": settings.activity_status,
                "readReceipts": settings.read_receipts,
                "showBio": settings.show_bio.upper(),
                "showSkills": settings.show_skills.upper(),
                "showPortfolio": settings.show_portfolio.upper(),
                "showCertificates": settings.show_certificates.upper(),
                "showReviews": settings.show_reviews.upper(),
                "showEnrollments": settings.show_enrollments.upper(),
                "showContactInfo": settings.show_contact_info.upper(),
                "showOrganization": settings.show_organization.upper(),
                "showTagline": settings.show_tagline.upper(),
                "showHeadline": settings.show_headline.upper(),
                "showPronouns": settings.show_pronouns.upper(),
                "showAvailability": settings.show_availability.upper(),
                "showRating": settings.show_rating.upper(),
                "showEmail": settings.show_email,
                "showPhone": settings.show_phone,
                "showLastActive": settings.show_last_active,
            }

            await self.db.privacysettings.upsert(
                where={"userId": user_id},
                data={
                    "create": {"userId": user_id, **data},
                    "update": data,
                },
            )
            return await self.get_privacy_settings(user_id)
        except Exception as e:
            logger.error(f"Error: {str(e)}")
            return None

    # Usage Tracking
    async def get_usage_metrics(self, user_id: int) -> UsageResponse:
        user_projects = await self.db.project.count(where={"ownerId": user_id})
        user_datasets = await self.db.dataset.count(where={"userId": user_id})
        user_dashboards = await self.db.dashboard.count(where={"ownerId": user_id})

        plan = "free"
        try:
            plan_row = await self.db.subscription.find_first(
                where={"userId": user_id, "status": {"in": ["ACTIVE", "GRACE_PERIOD"]}},
                order={"createdAt": "desc"},
            )
            if plan_row and plan_row.plan:
                plan = plan_row.plan.lower()
        except Exception:
            pass

        period_start = datetime.now().replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )

        storage_used = 0
        bandwidth_used = 0
        try:
            storage_recs = await self.db.usagetracking.find_many(
                where={
                    "userId": user_id,
                    "metricType": "storage_bytes",
                    "periodStart": {"gte": period_start},
                }
            )
            if storage_recs:
                storage_used = int(
                    sum(
                        r.value
                        for r in storage_recs
                        if getattr(r, "value", None) is not None
                    )
                )

            bandwidth_recs = await self.db.usagetracking.find_many(
                where={
                    "userId": user_id,
                    "metricType": "bandwidth_bytes",
                    "periodStart": {"gte": period_start},
                }
            )
            if bandwidth_recs:
                bandwidth_used = int(
                    sum(
                        r.value
                        for r in bandwidth_recs
                        if getattr(r, "value", None) is not None
                    )
                )
        except Exception:
            storage_used = user_datasets * 10 * 1024 * 1024
            bandwidth_used = user_projects * 5 * 1024 * 1024

        actual_collaborators = 0
        try:
            actual_collaborators = await self.db.organizationmember.count(
                where={"userId": user_id, "deletedAt": None}
            )
        except Exception:
            actual_collaborators = user_dashboards

        limits_by_plan = {
            "free": {
                "storage": 100 * 1024 * 1024,
                "bandwidth": 100 * 1024 * 1024,
                "projects": 5,
                "collaborators": 2,
            },
            "pro": {
                "storage": 1024 * 1024 * 1024,
                "bandwidth": 500 * 1024 * 1024,
                "projects": 50,
                "collaborators": 10,
            },
            "enterprise": {
                "storage": 10 * 1024 * 1024 * 1024,
                "bandwidth": 5000 * 1024 * 1024,
                "projects": 500,
                "collaborators": 100,
            },
        }
        limits = limits_by_plan.get(plan, limits_by_plan["free"])

        period_end = period_start.replace(day=28) + timedelta(days=4)
        if period_end.month != period_start.month:
            period_end = period_start.replace(day=1) + timedelta(days=32)
            period_end = period_end.replace(day=1) - timedelta(days=1)
        period_end = period_end.replace(
            hour=23, minute=59, second=59, microsecond=999999
        )

        metrics = UsageMetrics(
            storage=storage_used,
            storage_limit=limits["storage"],
            bandwidth=bandwidth_used,
            bandwidth_limit=limits["bandwidth"],
            projects=user_projects,
            projects_limit=limits["projects"],
            collaborators=actual_collaborators,
            collaborators_limit=limits["collaborators"],
        )

        return UsageResponse(
            metrics=metrics, period_start=period_start, period_end=period_end
        )


def _section_val(obj, field: str) -> str:
    """Get a SectionVisibility enum value as lowercase string, defaulting to 'inherit'."""
    val = getattr(obj, field, None)
    if val is None:
        return "inherit"
    return val.lower()


# Singleton instance
settings_service = SettingsService()
