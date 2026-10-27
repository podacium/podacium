"""KYC & Identity Verification Service.

Handles freelancer national identity verification, ANAE registration,
RIB/CCP verification, and admin approval workflows.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional

from app.core.prisma import prisma
from app.services.notification_service import NotificationService
from app.schemas.notifications import (
    NotificationCreate,
    NotificationCategory,
    NotificationPriority,
)

logger = logging.getLogger(__name__)


class KycService:
    async def get_user_kyc(self, user_id: int) -> Dict[str, Any]:
        """Fetch KYC verification status for a user."""
        kyc = await prisma.userkyc.find_unique(where={"userId": user_id})
        if not kyc:
            return {"status": "NOT_SUBMITTED", "kyc": None}
        return {"status": kyc.status, "kyc": kyc}

    async def submit_kyc(
        self,
        user_id: int,
        national_id_number: Optional[str] = None,
        anae_card_number: Optional[str] = None,
        anae_certificate_url: Optional[str] = None,
        rib_ccp_number: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Submit or update user KYC documentation and sync with freelancer profile."""
        existing = await prisma.userkyc.find_unique(where={"userId": user_id})
        data = {
            "nationalIdNumber": national_id_number,
            "anaeCardNumber": anae_card_number,
            "anaeCertificateUrl": anae_certificate_url,
            "ribCcpNumber": rib_ccp_number,
            "status": "PENDING_REVIEW",
            "rejectionReason": None,
        }

        if existing:
            kyc = await prisma.userkyc.update(
                where={"userId": user_id},
                data=data,
            )
        else:
            kyc = await prisma.userkyc.create(
                data={"userId": user_id, **data},
            )

        if anae_card_number or rib_ccp_number:
            profile = await prisma.freelancerprofile.find_unique(
                where={"userId": user_id}
            )
            if profile:
                profile_updates: Dict[str, Any] = {}
                if anae_card_number:
                    profile_updates["anaeCardNumber"] = anae_card_number
                if rib_ccp_number:
                    profile_updates["ribCcpNumber"] = rib_ccp_number
                if profile_updates:
                    await prisma.freelancerprofile.update(
                        where={"userId": user_id},
                        data=profile_updates,
                    )

        logger.info(f"KYC submitted for review by user {user_id}")
        return {
            "status": kyc.status,
            "message": "KYC submitted successfully for review",
            "kyc": kyc,
        }

    async def review_kyc(
        self,
        user_id: int,
        status: str,
        admin_id: int,
        rejection_reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Admin review of submitted KYC with automated in-app notification."""
        if status not in ["APPROVED", "REJECTED"]:
            raise ValueError("Invalid KYC review status")

        kyc = await prisma.userkyc.find_unique(where={"userId": user_id})
        if not kyc:
            raise LookupError("KYC record not found")

        updated_kyc = await prisma.userkyc.update(
            where={"userId": user_id},
            data={
                "status": status,
                "rejectionReason": rejection_reason if status == "REJECTED" else None,
                "reviewedAt": datetime.now(timezone.utc),
                "reviewedByUserId": admin_id,
            },
        )

        if status == "APPROVED":
            await prisma.user.update(
                where={"id": user_id},
                data={"isVerified": True},
            )
            # Update FreelancerProfile ANAE verified status
            if kyc.anaeCardNumber:
                await prisma.freelancerprofile.update_many(
                    where={"userId": user_id},
                    data={
                        "isAnaeRegistered": True,
                        "anaeCardNumber": kyc.anaeCardNumber,
                    },
                )
            try:
                await NotificationService.create_notification(
                    NotificationCreate(
                        user_id=user_id,
                        title="Identity Verification Approved",
                        body="Your KYC identity verification documents have been verified and approved.",
                        category=NotificationCategory.SECURITY,
                        priority=NotificationPriority.NORMAL,
                        payload={
                            "entity_type": "security",
                            "entity_id": str(user_id),
                            "action_url": "/settings/verification",
                        },
                    )
                )
            except Exception as e:
                logger.warning(f"Failed to dispatch KYC approval notification: {e}")
        elif status == "REJECTED":
            try:
                reason_text = f" Reason: {rejection_reason}" if rejection_reason else ""
                await NotificationService.create_notification(
                    NotificationCreate(
                        user_id=user_id,
                        title="Identity Verification Update",
                        body=f"Your identity verification submission was not approved.{reason_text} Please review and resubmit.",
                        category=NotificationCategory.SECURITY,
                        priority=NotificationPriority.HIGH,
                        payload={
                            "entity_type": "security",
                            "entity_id": str(user_id),
                            "action_url": "/settings/verification",
                        },
                    )
                )
            except Exception as e:
                logger.warning(f"Failed to dispatch KYC rejection notification: {e}")

        logger.info(
            f"KYC reviewed for user {user_id}: status={status} by admin {admin_id}"
        )
        return {
            "status": updated_kyc.status,
            "message": f"KYC {status.lower()} successfully",
            "kyc": updated_kyc,
        }


kyc_service = KycService()
