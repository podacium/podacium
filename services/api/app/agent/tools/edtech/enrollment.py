"""
services/api/app/agent/tools/edtech/enrollment.py
Tool 4: Enroll in course (HITL Mutating with compensating rollback).
"""

import logging
from typing import Optional, Literal, Any, Dict
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.auth import UserRole

from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.agent.context import AgentSecurityContext
from app.core.prisma import prisma
from app.services.education_service import education_service

logger = logging.getLogger(__name__)


class EnrollCourseArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    course_id: str = Field(
        ..., min_length=1, description="Course / Module ID or slug to enroll into"
    )
    payment_method: Literal[
        "FREE", "SUBSCRIPTION", "WALLET_POINTS", "EXTERNAL_GATEWAY"
    ] = Field(
        default="FREE",
        description="Payment vehicle. Use 'FREE' for free 0 DZD courses or courses already owned. For paid courses with points, use 'WALLET_POINTS'.",
    )
    promo_code: Optional[str] = Field(
        None, max_length=20, description="Optional coupon or promo code"
    )


class EnrollCourseTool(BaseTool):
    name = "enroll_course"
    description = (
        "Enroll the authenticated student into a course. For free courses (0 DZD) or courses "
        "already purchased/entitled, this completes enrollment. For paid courses that have not "
        "been purchased yet, explains the price in DZD and provides checkout directions."
    )
    domain = ToolDomain.EDTECH
    access_roles = [
        UserRole.STUDENT,
        UserRole.INSTRUCTOR,
        UserRole.ADMIN,
        UserRole.MODERATOR,
    ]
    is_mutating = True
    requires_hitl = True
    args_schema = EnrollCourseArgs

    async def preview_impact(
        self, args: Any, context: AgentSecurityContext
    ) -> ToolResult:
        """Simulation and pre-flight check before HITL confirmation."""
        typed_args: EnrollCourseArgs = (
            args
            if isinstance(args, EnrollCourseArgs)
            else self.args_schema.model_validate(args)
        )
        user_id = context.user_id

        module = await prisma.module.find_first(
            where={"id": typed_args.course_id, "deletedAt": None}
        )
        if not module:
            clean_lookup = typed_args.course_id.strip()
            module = await prisma.module.find_first(
                where={
                    "OR": [
                        {"title": {"contains": clean_lookup, "mode": "insensitive"}},
                        {
                            "description": {
                                "contains": clean_lookup,
                                "mode": "insensitive",
                            }
                        },
                    ],
                    "deletedAt": None,
                }
            )

        if not module:
            return ToolResult(
                success=False,
                error=f"Course '{typed_args.course_id}' not found.",
            )

        # Check existing enrollment
        existing = await prisma.enrollment.find_first(
            where={
                "userId": user_id,
                "moduleId": module.id,
                "deletedAt": None,
            }
        )
        if existing:
            return ToolResult(
                success=True,
                data={
                    "already_enrolled": True,
                    "enrollment_id": existing.id,
                    "course_id": module.id,
                    "title": module.title,
                },
                widget_payload={
                    "type": "EnrollmentStatus",
                    "status": "ALREADY_ENROLLED",
                    "course_id": module.id,
                },
            )

        # Check pricing and access
        price_data = education_service._parse_price(module.price)
        original_price = price_data.get("original", 0) or 0
        discounted_price = price_data.get("discounted")
        effective_price = (
            discounted_price if discounted_price is not None else original_price
        )

        if effective_price > 0:
            has_access = await education_service.check_access(user_id, module.id)
            if not has_access and typed_args.payment_method != "WALLET_POINTS":
                formatted_price = f"{effective_price:,.0f} DZD"
                is_ar = (context.locale or "").startswith("ar")
                err_msg = (
                    f"دورة '{module.title}' هي دورة مدفوعة بسعر {formatted_price} وليست مجانية. "
                    f"للتسجيل، يرجى التوجه لصفحة الدورة وإتمام الدفع عبر البطاقة الذهبية أو CIB: /learn/courses/{module.id}"
                    if is_ar
                    else f"Course '{module.title}' is a paid course requiring {formatted_price}. Please complete checkout via EDAHABIA/CIB at /learn/courses/{module.id} to enroll."
                )
                return ToolResult(
                    success=False,
                    error=err_msg,
                    data={
                        "requires_payment": True,
                        "price_dzd": effective_price,
                        "course_id": module.id,
                        "title": module.title,
                        "checkout_url": f"/learn/courses/{module.id}",
                    },
                    widget_payload={
                        "type": "CourseWidgetCard",
                        "id": module.id,
                        "title": module.title,
                        "description": module.description,
                        "price_dzd": effective_price,
                        "url": f"/learn/courses/{module.id}",
                    },
                )

        return ToolResult(
            success=True,
            data={
                "course_id": module.id,
                "title": module.title,
                "price_dzd": effective_price,
            },
        )

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: EnrollCourseArgs = args
        user_id = context.user_id

        module = await prisma.module.find_first(
            where={"id": typed_args.course_id, "deletedAt": None}
        )
        if not module:
            clean_lookup = typed_args.course_id.strip()
            module = await prisma.module.find_first(
                where={
                    "OR": [
                        {"title": {"contains": clean_lookup, "mode": "insensitive"}},
                        {
                            "description": {
                                "contains": clean_lookup,
                                "mode": "insensitive",
                            }
                        },
                    ],
                    "deletedAt": None,
                }
            )

        if not module:
            return ToolResult(
                success=False, error=f"Course '{typed_args.course_id}' not found."
            )

        # Check existing enrollment
        existing = await prisma.enrollment.find_first(
            where={
                "userId": user_id,
                "moduleId": module.id,
                "deletedAt": None,
            }
        )
        if existing:
            return ToolResult(
                success=True,
                data={
                    "already_enrolled": True,
                    "enrollment_id": existing.id,
                    "course_id": module.id,
                },
                widget_payload={
                    "type": "EnrollmentStatus",
                    "status": "ALREADY_ENROLLED",
                    "course_id": module.id,
                },
            )

        # Check pricing and access entitlement
        price_data = education_service._parse_price(module.price)
        original_price = price_data.get("original", 0) or 0
        discounted_price = price_data.get("discounted")
        effective_price = (
            discounted_price if discounted_price is not None else original_price
        )

        has_access = False
        if effective_price > 0:
            has_access = await education_service.check_access(user_id, module.id)
            if not has_access and typed_args.payment_method == "WALLET_POINTS":
                try:
                    from app.services.wallet_service import wallet_service
                    from app.schemas.payment import PaymentPurpose

                    wallet = await wallet_service.get_wallet_by_user_id(user_id)
                    if wallet and wallet.podaPoints >= effective_price:
                        await wallet_service.debit_wallet(
                            wallet_id=wallet.id,
                            amount=float(effective_price),
                            purpose=PaymentPurpose.COURSE_PURCHASE,
                            description=f"Course purchase: {module.title}",
                        )
                        from app.services.entitlement_service import entitlement_service

                        await entitlement_service.grant_entitlement(
                            user_id=user_id,
                            resource_type="course",
                            resource_id=module.id,
                        )
                        has_access = True
                except Exception as e:
                    logger.warning(f"Wallet payment failed for user {user_id}: {e}")

            if not has_access:
                formatted_price = f"{effective_price:,.0f} DZD"
                is_ar = (context.locale or "").startswith("ar")
                return ToolResult(
                    success=False,
                    error=(
                        f"دورة '{module.title}' هي دورة مدفوعة بسعر {formatted_price} وليست مجانية. "
                        f"يرجى إتمام عملية الدفع عبر البطاقة الذهبية أو CIB لتأكيد التسجيل: /learn/courses/{module.id}"
                        if is_ar
                        else f"Course '{module.title}' requires payment of {formatted_price}. Please complete checkout via EDAHABIA/CIB at /learn/courses/{module.id} to enroll."
                    ),
                    data={
                        "requires_payment": True,
                        "price_dzd": effective_price,
                        "course_id": module.id,
                        "title": module.title,
                        "checkout_url": f"/learn/courses/{module.id}",
                    },
                    widget_payload={
                        "type": "CourseWidgetCard",
                        "id": module.id,
                        "title": module.title,
                        "description": module.description,
                        "price_dzd": effective_price,
                        "url": f"/learn/courses/{module.id}",
                    },
                )

        # Execute enrollment via education_service
        enrolled = await education_service.enroll_user(
            module_id=module.id, user_id=user_id
        )
        if not enrolled:
            return ToolResult(
                success=False,
                error="Failed to complete course enrollment. Quota limit or entitlement check failed.",
            )

        return ToolResult(
            success=True,
            data={"enrolled": True, "course_id": module.id, "title": module.title},
            widget_payload={
                "type": "EnrollmentReceipt",
                "course_id": module.id,
                "title": module.title,
                "url": f"/learn/courses/{module.id}",
            },
        )

    async def rollback(
        self, context: AgentSecurityContext, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Compensating action: Deletes 0-progress enrollment record if downstream saga fails."""
        course_id = payload.get("course_id")
        if course_id:
            await prisma.enrollment.delete_many(
                where={
                    "userId": context.user_id,
                    "moduleId": course_id,
                    "progress": 0.0,
                }
            )
            return {
                "status": "COMPENSATED",
                "message": f"Enrollment in {course_id} rolled back.",
            }
        return {
            "status": "NOOP",
            "message": "Missing course_id for enrollment rollback",
        }
