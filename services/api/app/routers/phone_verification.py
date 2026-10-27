# app/routers/phone_verification.py
from fastapi import APIRouter, Depends, HTTPException, status
import logging
from app.schemas.phone_verification import (
    PhoneVerificationRequest,
    PhoneVerificationCodeRequest,
    PhoneVerificationResponse,
    PhoneVerificationStatus,
    BulkPhoneVerificationRequest,
    BulkPhoneVerificationResponse,
    PhoneUpdateRequest,
)
from datetime import datetime, timezone
from app.services.phone_verification_service import phone_verification_service
from app.services.whatsapp_service import whatsapp_service
from app.core.prisma import prisma
from app.core.auth import get_current_active_user
from app.core.config import setting

router = APIRouter(prefix="/phone", tags=["phone verification"])
logger = logging.getLogger(__name__)


@router.post("/verify/request", response_model=PhoneVerificationResponse)
async def request_phone_verification(
    request: PhoneVerificationRequest, current_user=Depends(get_current_active_user)
):
    """
    Request phone verification via WhatsApp

    - Generates a 6-digit code
    - Sends via WhatsApp template
    - Stores code in database with expiration
    """
    logger.info(f"Phone verification requested for: {request.phoneNumber}")

    # Check rate limiting
    if await phone_verification_service.is_rate_limited(request.phoneNumber):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait before requesting another code",
        )

    # Generate verification code
    verification_code = await phone_verification_service.generate_verification_code()
    logger.debug(f"Generated code: {verification_code}")

    # Send via WhatsApp
    sent = await phone_verification_service.send_whatsapp_verification(
        phone_number=request.phoneNumber, verification_code=verification_code
    )

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification code",
        )

    # Update user's phone number if authenticated
    try:
        await prisma.user.update(
            where={"id": current_user.id},
            data={
                "phoneNumber": request.phoneNumber,
                "phoneVerified": False,  # Reset verification status
            },
        )
    except Exception as e:
        logger.warning(f"Failed to update user phone number: {e}")

    return PhoneVerificationResponse(
        success=True,
        message="Verification code sent successfully via WhatsApp",
        verified=False,
        phoneNumber=request.phoneNumber,
    )


@router.post("/verify/code", response_model=PhoneVerificationResponse)
async def verify_phone_code(
    request: PhoneVerificationCodeRequest, current_user=Depends(get_current_active_user)
):
    """
    Verify phone number with code

    - Validates the code
    - Updates user verification status
    - Returns verification result
    """
    logger.info(f"Verifying code for: {request.phoneNumber}")

    # Validate code
    is_valid = await phone_verification_service.validate_verification_code(
        phone_number=request.phoneNumber, code=request.code
    )

    if is_valid:
        # Update user verification status
        await prisma.user.update(
            where={"id": current_user.id},
            data={"phoneVerified": True, "phoneVerifiedAt": datetime.now(timezone.utc)},
        )

        logger.info(f"Phone {request.phoneNumber} verified for user {current_user.id}")

        return PhoneVerificationResponse(
            success=True,
            message="Phone number verified successfully",
            verified=True,
            phoneNumber=request.phoneNumber,
        )
    else:
        # Get verification status for better error message
        status_info = await phone_verification_service.get_verification_status(
            request.phoneNumber
        )

        if status_info["expired"]:
            detail = "Verification code has expired. Please request a new one."
        elif status_info["attempts"] >= setting.PHONE_VERIFICATION_MAX_ATTEMPTS:
            detail = "Maximum attempts reached. Please request a new code."
        else:
            detail = "Invalid verification code"

        return PhoneVerificationResponse(
            success=False,
            message=detail,
            verified=False,
            phoneNumber=request.phoneNumber,
        )


@router.get("/verify/status/{phone_number}", response_model=PhoneVerificationStatus)
async def get_verification_status(
    phone_number: str, current_user=Depends(get_current_active_user)
):
    """
    Get verification status for a phone number
    """
    status_info = await phone_verification_service.get_verification_status(phone_number)
    status_info["rate_limited"] = await phone_verification_service.is_rate_limited(
        phone_number
    )

    return PhoneVerificationStatus(**status_info)


@router.post("/verify/resend", response_model=PhoneVerificationResponse)
async def resend_verification_code(
    request: PhoneVerificationRequest, current_user=Depends(get_current_active_user)
):
    """
    Resend verification code
    """
    logger.info(f"Resending verification to: {request.phoneNumber}")

    # Check rate limiting
    if await phone_verification_service.is_rate_limited(request.phoneNumber):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait before requesting another code",
        )

    # Generate new verification code
    verification_code = await phone_verification_service.generate_verification_code()

    # Send via WhatsApp
    sent = await phone_verification_service.send_whatsapp_verification(
        phone_number=request.phoneNumber, verification_code=verification_code
    )

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resend verification code",
        )

    return PhoneVerificationResponse(
        success=True,
        message="Verification code resent successfully",
        verified=False,
        phoneNumber=request.phoneNumber,
    )


@router.put("/update", response_model=PhoneVerificationResponse)
async def update_phone_number(
    request: PhoneUpdateRequest, current_user=Depends(get_current_active_user)
):
    """
    Update phone number with verification

    - If verification code provided, verify immediately
    - Otherwise, send verification code to new number
    """
    logger.info(
        f"Updating phone for user {current_user.id} to: {request.newPhoneNumber}"
    )

    # Check if phone number already exists for another user
    existing_user = await prisma.user.find_first(
        where={"phoneNumber": request.newPhoneNumber, "id": {"not": current_user.id}}
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered to another account",
        )

    if request.verificationCode:
        # Verify immediately
        is_valid = await phone_verification_service.validate_verification_code(
            phone_number=request.newPhoneNumber, code=request.verificationCode
        )

        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code",
            )

        # Update user phone number
        await prisma.user.update(
            where={"id": current_user.id},
            data={
                "phoneNumber": request.newPhoneNumber,
                "phoneVerified": True,
                "phoneVerifiedAt": datetime.now(timezone.utc),
            },
        )

        return PhoneVerificationResponse(
            success=True,
            message="Phone number updated and verified successfully",
            verified=True,
            phoneNumber=request.newPhoneNumber,
        )
    else:
        # Send verification code
        verification_code = (
            await phone_verification_service.generate_verification_code()
        )

        sent = await phone_verification_service.send_whatsapp_verification(
            phone_number=request.newPhoneNumber, verification_code=verification_code
        )

        if not sent:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send verification code",
            )

        # Temporarily update phone number (not verified yet)
        await prisma.user.update(
            where={"id": current_user.id},
            data={
                "phoneNumber": request.newPhoneNumber,
                "phoneVerified": False,
                "phoneVerifiedAt": None,
            },
        )

        return PhoneVerificationResponse(
            success=True,
            message="Verification code sent to new phone number",
            verified=False,
            phoneNumber=request.newPhoneNumber,
        )


@router.delete("/cleanup")
async def cleanup_expired_verifications(current_user=Depends(get_current_active_user)):
    """
    Clean up expired verification records (Admin only)
    """
    # Check if user is admin
    if current_user.role not in ["ADMIN", "INSTRUCTOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    cleaned = await phone_verification_service.cleanup_expired_verifications()

    return {
        "message": f"Cleaned up {cleaned} expired verification records",
        "cleaned_count": cleaned,
    }


@router.post("/bulk/verify", response_model=BulkPhoneVerificationResponse)
async def bulk_phone_verification(
    request: BulkPhoneVerificationRequest, current_user=Depends(get_current_active_user)
):
    """
    Bulk phone verification for multiple users (Admin only)
    """
    # Check if user is admin
    if current_user.role not in ["ADMIN", "INSTRUCTOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    results = {}
    successful = 0
    failed = 0

    for phone_number in request.phone_numbers:
        try:
            verification_code = (
                await phone_verification_service.generate_verification_code()
            )

            sent = await phone_verification_service.send_whatsapp_verification(
                phone_number=phone_number, verification_code=verification_code
            )

            if sent:
                results[phone_number] = PhoneVerificationResponse(
                    success=True,
                    message="Verification code sent",
                    verified=False,
                    phoneNumber=phone_number,
                )
                successful += 1
            else:
                results[phone_number] = PhoneVerificationResponse(
                    success=False,
                    message="Failed to send verification",
                    verified=False,
                    phoneNumber=phone_number,
                )
                failed += 1

        except Exception as e:
            logger.error(f"Failed to send verification to {phone_number}: {e}")
            results[phone_number] = PhoneVerificationResponse(
                success=False, message=str(e), verified=False, phoneNumber=phone_number
            )
            failed += 1

    return BulkPhoneVerificationResponse(
        total=len(request.phone_numbers),
        successful=successful,
        failed=failed,
        results=results,
    )


# Webhook endpoint for WhatsApp delivery status
@router.post("/webhook/whatsapp")
async def whatsapp_webhook(payload: dict):
    """
    Webhook for WhatsApp message delivery status

    Note: You need to configure this webhook in your WhatsApp Business Account
    """
    logger.info(f"WhatsApp webhook received: {payload}")

    # Handle different webhook events
    if "entry" in payload:
        for entry in payload["entry"]:
            if "changes" in entry:
                for change in entry["changes"]:
                    if change.get("field") == "messages":
                        value = change.get("value", {})
                        messages = value.get("messages", [])

                        for message in messages:
                            # Handle message status updates
                            if "statuses" in message:
                                status_info = message["statuses"][0]
                                phone_number = status_info.get("recipient_id")
                                status = status_info.get("status")

                                logger.info(
                                    f"Message status update: {phone_number} - {status}"
                                )

                                # You can update message status in your database here
                                # For example, track delivery failures

    return {"status": "ok"}


# Test endpoint
@router.post("/test/whatsapp")
async def test_whatsapp_message(
    phone_number: str, current_user=Depends(get_current_active_user)
):
    """
    Test WhatsApp message sending (Admin only)
    """
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    # Send a test template message
    sent = await whatsapp_service.send_template_message(
        phone_number=phone_number,
        template_name=setting.PHONE_VERIFICATION_TEMPLATE_NAME,
        language_code="en_US",
    )

    if sent:
        return {"success": True, "message": "Test message sent successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send test message",
        )
