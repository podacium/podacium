import logging
from datetime import datetime, timezone
from typing import Optional
from app.core.prisma import prisma

logger = logging.getLogger(__name__)


class PromoCodeError(Exception):
    def __init__(self, message: str, code: str):
        self.message = message
        self.code = code
        super().__init__(message)


class PromoCodeResult:
    def __init__(self, code: str, discount_type: str, discount_value: int,
                 original_amount: int, discounted_amount: int, description: Optional[str] = None):
        self.code = code
        self.discount_type = discount_type
        self.discount_value = discount_value
        self.original_amount = original_amount
        self.discounted_amount = discounted_amount
        self.description = description


def apply_discount(amount: int, discount_type: str, discount_value: int) -> int:
    if discount_type == "PERCENTAGE":
        discount = int(amount * discount_value / 100)
        return max(amount - discount, 0)
    elif discount_type == "FIXED_AMOUNT":
        return max(amount - discount_value, 0)
    return amount


class PromoCodeService:

    async def _validate(
        self,
        promo,
        user_id: int,
        amount: int,
        plan_type: Optional[str] = None,
        product_id: Optional[str] = None,
    ):
        if not promo.isActive:
            raise PromoCodeError("Promo code is no longer active", "PROMO_INACTIVE")
        if promo.expiresAt and promo.expiresAt.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            raise PromoCodeError("Promo code has expired", "PROMO_EXPIRED")
        if promo.redemptionCount >= promo.maxRedemptions:
            raise PromoCodeError("Promo code has reached max redemptions", "PROMO_EXHAUSTED")
        if promo.minPurchaseAmount and amount < promo.minPurchaseAmount:
            raise PromoCodeError(
                f"Minimum purchase amount of {promo.minPurchaseAmount} DZD required",
                "PROMO_MIN_AMOUNT",
            )
        if promo.maxUsagesPerUser:
            usage_count = await prisma.transaction.count(
                where={
                    "userId": user_id,
                    "metadata": {"path": ["promo_code"], "equals": promo.code},
                    "status": {"in": ["COMPLETED", "PENDING"]},
                }
            )
            if usage_count >= promo.maxUsagesPerUser:
                raise PromoCodeError("You have already used this promo code", "PROMO_USER_LIMIT")
        if promo.applicablePlans and plan_type:
            plans = promo.applicablePlans
            if isinstance(plans, dict):
                plans = plans.get("plans", [])
            if isinstance(plans, list) and plan_type not in plans:
                raise PromoCodeError(
                    "This promo code does not apply to the selected plan",
                    "PROMO_NOT_APPLICABLE",
                )

    async def validate_only(
        self,
        code: str,
        user_id: int,
        amount: int,
        plan_type: Optional[str] = None,
        product_id: Optional[str] = None,
    ) -> PromoCodeResult:
        promo = await prisma.promocode.find_first(
            where={"code": code, "deletedAt": None}
        )
        if not promo:
            raise PromoCodeError("Promo code not found", "PROMO_NOT_FOUND")

        await self._validate(promo, user_id, amount, plan_type, product_id)

        discounted = apply_discount(amount, promo.discountType, promo.discountValue)
        return PromoCodeResult(
            code=promo.code,
            discount_type=promo.discountType,
            discount_value=promo.discountValue,
            original_amount=amount,
            discounted_amount=discounted,
            description=promo.description,
        )

    async def validate_and_apply(
        self,
        code: str,
        user_id: int,
        amount: int,
        plan_type: Optional[str] = None,
        product_id: Optional[str] = None,
    ) -> PromoCodeResult:
        promo = await prisma.promocode.find_first(
            where={"code": code, "deletedAt": None}
        )
        if not promo:
            raise PromoCodeError("Promo code not found", "PROMO_NOT_FOUND")

        await self._validate(promo, user_id, amount, plan_type, product_id)

        discounted = apply_discount(amount, promo.discountType, promo.discountValue)
        await prisma.promocode.update(
            where={"id": promo.id},
            data={"redemptionCount": promo.redemptionCount + 1},
        )
        return PromoCodeResult(
            code=promo.code,
            discount_type=promo.discountType,
            discount_value=promo.discountValue,
            original_amount=amount,
            discounted_amount=discounted,
            description=promo.description,
        )

    async def create_promo_code(
        self,
        code: str,
        discount_type: str,
        discount_value: int,
        description: Optional[str] = None,
        min_purchase_amount: Optional[int] = None,
        max_redemptions: int = 100,
        max_usages_per_user: Optional[int] = None,
        expires_at: Optional[datetime] = None,
        applicable_plans: Optional[list] = None,
    ):
        existing = await prisma.promocode.find_unique(where={"code": code})
        if existing:
            raise PromoCodeError("Promo code already exists", "PROMO_DUPLICATE")
        return await prisma.promocode.create(
            data={
                "code": code,
                "description": description,
                "discountType": discount_type,
                "discountValue": discount_value,
                "minPurchaseAmount": min_purchase_amount,
                "maxRedemptions": max_redemptions,
                "maxUsagesPerUser": max_usages_per_user,
                "expiresAt": expires_at,
                "applicablePlans": {"plans": applicable_plans} if applicable_plans else None,
            }
        )

    async def list_promo_codes(self, include_inactive: bool = False):
        where = {"deletedAt": None}
        if not include_inactive:
            where["isActive"] = True
        return await prisma.promocode.find_many(
            where=where,
            order={"createdAt": "desc"},
        )

    async def deactivate_promo_code(self, code: str):
        promo = await prisma.promocode.find_unique(where={"code": code})
        if not promo:
            raise PromoCodeError("Promo code not found", "PROMO_NOT_FOUND")
        return await prisma.promocode.update(
            where={"id": promo.id},
            data={"isActive": False},
        )


promo_code_service = PromoCodeService()
