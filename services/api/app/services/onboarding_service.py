import logging
from datetime import datetime, timezone, timedelta
from app.core.prisma import prisma
from app.core.security import get_password_hash, validate_password_complexity

logger = logging.getLogger(__name__)


class OnboardingService:
    async def submit(self, user_id: int, data: dict) -> dict:
        user = await prisma.user.find_unique(where={"id": user_id})
        if not user:
            raise ValueError("User not found")

        role_map = {
            "student": "STUDENT",
            "professional": "BUSINESS",
            "freelancer": "FREELANCER",
            "entrepreneur": "BUSINESS",
            "researcher": "STUDENT",
            "instructor": "STUDENT",  # Instructor requires administrative vetting
            "other": "STUDENT",
        }

        selected_role_key = data.get("role")
        if not selected_role_key or selected_role_key not in role_map:
            raise ValueError(
                "Valid role selection is required for onboarding submission"
            )

        db_role = role_map.get(selected_role_key)

        user_update_data = {"onboardingCompleted": True}
        if db_role:
            user_update_data["role"] = db_role

        field_of_interest = data.get("fieldOfInterest")

        skills = data.get("skills")
        if skills and isinstance(skills, list):
            existing = set(s.lower() for s in (user.skills or []))
            merged = list(
                existing | set(s.lower().strip() for s in skills if s and s.strip())
            )
            user_update_data["skills"] = merged

        new_password = data.get("password")
        if new_password:
            if not user.passwordHash or user.provider != "EMAIL":
                complexity_error = validate_password_complexity(new_password)
                if complexity_error:
                    raise ValueError(complexity_error)
                user_update_data["passwordHash"] = get_password_hash(new_password)
                logger.info(f"Password updated for user {user_id} during onboarding")
            else:
                logger.warning(
                    f"User {user_id} tried to update password during onboarding but already has one"
                )

        async with prisma.tx() as tx:
            await tx.onboardinganswer.upsert(
                where={"userId": user_id},
                data={
                    "create": {
                        "userId": user_id,
                        "role": selected_role_key,
                        "primaryGoal": data.get("primaryGoal"),
                        "experienceLevel": data.get("experienceLevel"),
                        "fieldOfInterest": field_of_interest,
                        "weeklyTime": data.get("weeklyTime"),
                        "discoverySource": data.get("discoverySource"),
                        "openAnswer": data.get("openAnswer"),
                    },
                    "update": {
                        "role": selected_role_key,
                        "primaryGoal": data.get("primaryGoal"),
                        "experienceLevel": data.get("experienceLevel"),
                        "fieldOfInterest": field_of_interest,
                        "weeklyTime": data.get("weeklyTime"),
                        "discoverySource": data.get("discoverySource"),
                        "openAnswer": data.get("openAnswer"),
                    },
                },
            )
            await tx.user.update(
                where={"id": user_id},
                data=user_update_data,
            )

        logger.info(f"Onboarding completed for user {user_id}")

        if not user.onboardingCompleted:
            self._schedule_welcome_sequence(user_id)

        return {
            "message": "Onboarding completed successfully",
            "role": user_update_data.get("role", user.role),
            "onboardingCompleted": True,
        }

    async def skip(self, user_id: int) -> dict:
        user = await prisma.user.find_unique(where={"id": user_id})
        if not user:
            raise ValueError("User not found")

        if user.onboardingCompleted:
            return {"message": "Onboarding already skipped"}

        async with prisma.tx() as tx:
            await tx.onboardinganswer.upsert(
                where={"userId": user_id},
                data={
                    "create": {"userId": user_id},
                    "update": {},
                },
            )
            await tx.user.update(
                where={"id": user_id},
                data={"onboardingCompleted": True},
            )

        logger.info(f"Onboarding skipped for user {user_id}")
        return {"message": "Onboarding skipped successfully"}

    def _schedule_welcome_sequence(self, user_id: int) -> None:
        try:
            from app.tasks.email_tasks import (
                send_onboarding_welcome_d0,
                send_onboarding_welcome_d1,
                send_onboarding_welcome_d3,
                send_onboarding_welcome_d7,
            )

            send_onboarding_welcome_d0.delay(user_id)
            now = datetime.now(timezone.utc)
            send_onboarding_welcome_d1.apply_async(
                args=[user_id], eta=now + timedelta(hours=24)
            )
            send_onboarding_welcome_d3.apply_async(
                args=[user_id], eta=now + timedelta(hours=72)
            )
            send_onboarding_welcome_d7.apply_async(
                args=[user_id], eta=now + timedelta(hours=168)
            )
            logger.info(f"Scheduled welcome sequence D0/D1/D3/D7 for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to schedule welcome sequence for user {user_id}: {e}")


onboarding_service = OnboardingService()
