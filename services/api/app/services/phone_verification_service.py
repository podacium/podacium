# app/services/phone_verification_service.py
from datetime import datetime, timedelta, timezone
from typing import Dict, Any
import logging
from app.core.config import setting
from app.core.prisma import prisma
from app.services.whatsapp_service import whatsapp_service
from app.core.security import generate_numeric_verification_code

import hashlib
import hmac

logger = logging.getLogger(__name__)


class PhoneVerificationService:
    def __init__(self):
        self.code_length = setting.PHONE_VERIFICATION_CODE_LENGTH
        self.expire_minutes = setting.PHONE_VERIFICATION_EXPIRE_MINUTES
        self.max_attempts = setting.PHONE_VERIFICATION_MAX_ATTEMPTS
        self.rate_limit_minutes = setting.PHONE_VERIFICATION_RATE_LIMIT_MINUTES

    async def generate_verification_code(self) -> str:
        """
        Generate a numeric verification code

        Returns:
            str: 6-digit verification code
        """
        return generate_numeric_verification_code(self.code_length)

    async def store_verification_code(
        self, phone_number: str, verification_code: str
    ) -> bool:
        """
        Store verification code in database with expiration (hashed via SHA-256)

        Args:
            phone_number: Phone number to verify
            verification_code: Verification code

        Returns:
            bool: True if stored successfully, False otherwise
        """
        try:
            now = datetime.now(timezone.utc)
            expires_at = now + timedelta(minutes=self.expire_minutes)
            hashed_code = hashlib.sha256(verification_code.strip().encode()).hexdigest()

            # Check if verification exists
            existing = await prisma.phoneverification.find_unique(
                where={"phone_number": phone_number}
            )

            if existing:
                # Update existing verification
                await prisma.phoneverification.update(
                    where={"phone_number": phone_number},
                    data={
                        "verification_code": hashed_code,
                        "expires_at": expires_at,
                        "attempts": 0,
                        "verified": False,
                        "updated_at": now,
                    },
                )
            else:
                # Create new verification
                await prisma.phoneverification.create(
                    data={
                        "phone_number": phone_number,
                        "verification_code": hashed_code,
                        "expires_at": expires_at,
                        "attempts": 0,
                        "verified": False,
                    }
                )

            logger.info(f"Verification code stored securely for {phone_number}")
            return True

        except Exception as e:
            logger.error(f"Failed to store verification code: {e}")
            return False

    async def validate_verification_code(self, phone_number: str, code: str) -> bool:
        """
        Validate verification code

        Args:
            phone_number: Phone number to verify
            code: Verification code entered by user

        Returns:
            bool: True if code is valid, False otherwise
        """
        try:
            verification = await prisma.phoneverification.find_unique(
                where={"phone_number": phone_number}
            )

            if not verification:
                logger.warning(f"No verification found for {phone_number}")
                return False

            # Check if expired
            now = datetime.now(timezone.utc)
            expires_at = verification.expires_at

            # Make expires_at timezone-aware if it's naive
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            if expires_at < now:
                logger.warning(f"Verification code expired for {phone_number}")
                await self._increment_attempts(phone_number)
                return False

            # Check max attempts
            if verification.attempts >= self.max_attempts:
                logger.warning(f"Max attempts reached for {phone_number}")
                return False

            # Validate code with constant-time comparison (supporting both hashed and raw legacy)
            input_code = code.strip()
            input_hash = hashlib.sha256(input_code.encode()).hexdigest()
            stored = verification.verification_code or ""

            is_valid = hmac.compare_digest(stored, input_hash) or hmac.compare_digest(
                stored, input_code
            )

            if is_valid:
                # Mark as verified
                await prisma.phoneverification.update(
                    where={"phone_number": phone_number},
                    data={"verified": True, "updated_at": datetime.now(timezone.utc)},
                )
                logger.info(f"Phone {phone_number} verified successfully")
                return True
            else:
                # Increment attempts
                await self._increment_attempts(phone_number)
                logger.warning(f"Invalid code for {phone_number}")
                return False

        except Exception as e:
            logger.error(f"Failed to validate verification code: {e}")
            return False

    async def _increment_attempts(self, phone_number: str) -> None:
        """Increment verification attempts"""
        try:
            await prisma.phoneverification.update(
                where={"phone_number": phone_number},
                data={
                    "attempts": {"increment": 1},
                    "updated_at": datetime.now(timezone.utc),
                },
            )
        except Exception as e:
            logger.error(f"Failed to increment attempts: {e}")

    async def is_rate_limited(self, phone_number: str) -> bool:
        """
        Check if phone number is rate limited

        Args:
            phone_number: Phone number to check

        Returns:
            bool: True if rate limited, False otherwise
        """
        try:
            verification = await prisma.phoneverification.find_unique(
                where={"phone_number": phone_number}
            )

            if not verification:
                return False

            # Check if last attempt was within rate limit window
            # Use timezone-aware datetime to match database timestamps
            from datetime import timezone as tz

            now = datetime.now(tz.utc)
            updated_at = verification.updated_at

            # Make updated_at timezone-aware if it's naive
            if updated_at.tzinfo is None:
                updated_at = updated_at.replace(tzinfo=tz.utc)

            time_since_last = now - updated_at
            return time_since_last < timedelta(minutes=self.rate_limit_minutes)

        except Exception as e:
            logger.error(f"Failed to check rate limit: {e}")
            return False

    async def send_whatsapp_verification(
        self, phone_number: str, verification_code: str
    ) -> bool:
        """
        Send verification code via WhatsApp

        Args:
            phone_number: Phone number to verify
            verification_code: Verification code

        Returns:
            bool: True if sent successfully, False otherwise
        """
        try:
            # Store code first
            stored = await self.store_verification_code(phone_number, verification_code)
            if not stored:
                return False

            # Send via WhatsApp
            return await whatsapp_service.send_verification_code(
                phone_number=phone_number, verification_code=verification_code
            )

        except Exception as e:
            logger.error(f"Failed to send WhatsApp verification: {e}")
            return False

    async def get_verification_status(self, phone_number: str) -> Dict[str, Any]:
        """
        Get verification status for a phone number

        Args:
            phone_number: Phone number to check

        Returns:
            Dict with verification status
        """
        try:
            verification = await prisma.phoneverification.find_unique(
                where={"phone_number": phone_number}
            )

            if not verification:
                return {
                    "exists": False,
                    "verified": False,
                    "expired": True,
                    "attempts": 0,
                }

            return {
                "exists": True,
                "verified": verification.verified,
                "expired": verification.expires_at < datetime.now(timezone.utc),
                "attempts": verification.attempts,
                "expires_at": verification.expires_at.isoformat(),
            }

        except Exception as e:
            logger.error(f"Failed to get verification status: {e}")
            return {"exists": False, "verified": False, "expired": True, "attempts": 0}

    async def cleanup_expired_verifications(self) -> int:
        """
        Clean up expired verification records

        Returns:
            int: Number of records deleted
        """
        try:
            expired_time = datetime.now(timezone.utc) - timedelta(hours=24)
            result = await prisma.phoneverification.delete_many(
                where={
                    "OR": [
                        {"expires_at": {"lt": expired_time}},
                        {"verified": True, "created_at": {"lt": expired_time}},
                    ]
                }
            )
            logger.info(f"Cleaned up {result} expired verification records")
            return result
        except Exception as e:
            logger.error(f"Failed to cleanup expired verifications: {e}")
            return 0


# Singleton instance
phone_verification_service = PhoneVerificationService()
