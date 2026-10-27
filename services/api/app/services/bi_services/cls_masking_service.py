"""
Column-Level Security (CLS) & Data Masking Service
Dynamically masks sensitive columns (PII, financial data) based on user roles and security policies.
"""

import hashlib
import hmac
import logging
import re
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


class CLSMaskingService:
    """Service for masking sensitive data columns based on security entitlements and role policies."""

    SENSITIVE_PATTERNS = [
        r"(?i)ssn",
        r"(?i)social_security",
        r"(?i)phone",
        r"(?i)mobile",
        r"(?i)credit_card",
        r"(?i)card_number",
        r"(?i)edahabia",
        r"(?i)cib",
        r"(?i)passport",
        r"(?i)salary",
        r"(?i)compensation",
        r"(?i)tax_id",
        r"(?i)nif",
        r"(?i)nis",
        r"(?i)nin",
        r"(?i)iban",
        r"(?i)rib",
        r"(?i)password",
        r"(?i)secret",
        r"(?i)email",
        r"(?i)revenue",
        r"(?i)amount",
        r"(?i)balance",
        r"(?i)profit",
        r"(?i)(?<!dataset_)(?<!table_)(?<!column_)name",
    ]

    UNMASKED_ROLES = {"ADMIN", "ANALYST_FULL", "DATA_OWNER", "SUPERUSER"}

    @classmethod
    def is_sensitive_column(cls, column_name: str) -> bool:
        """Check if column matches sensitive PII/financial naming patterns."""
        if not column_name:
            return False
        for pattern in cls.SENSITIVE_PATTERNS:
            if re.search(pattern, column_name):
                return True
        return False

    @classmethod
    def mask_email(cls, email: str) -> str:
        """Mask email address while preserving domain structure (e.g. z***@podacium.com)."""
        if not email or "@" not in email:
            return "******@masked.local"
        user_part, domain_part = email.split("@", 1)
        if len(user_part) <= 1:
            masked_user = "*"
        else:
            masked_user = user_part[0] + "*" * (len(user_part) - 1)
        return f"{masked_user}@{domain_part}"

    @classmethod
    def mask_phone(cls, phone: str) -> str:
        """Mask phone numbers preserving prefix/suffix (e.g. 05****12)."""
        clean = str(phone).strip()
        if len(clean) >= 6:
            return clean[:2] + "*" * (len(clean) - 4) + clean[-2:]
        return "******"

    @classmethod
    def mask_card(cls, card_num: str) -> str:
        """Mask payment card number preserving first 4 and last 4 (e.g. 6280 **** **** 1234)."""
        digits = re.sub(r"\D", "", str(card_num))
        if len(digits) >= 12:
            return digits[:4] + " **** **** " + digits[-4:]
        elif len(digits) >= 6:
            return digits[:2] + "*" * (len(digits) - 4) + digits[-2:]
        return "************"

    @classmethod
    def mask_fiscal_id(cls, fiscal_id: str) -> str:
        """Mask NIF/NIS/NIN preserving prefix and suffix."""
        clean = str(fiscal_id).strip()
        if len(clean) >= 8:
            return clean[:3] + "*" * (len(clean) - 5) + clean[-2:]
        return "********"

    @classmethod
    def get_organization_pepper(cls, organization_id: Optional[Any] = None) -> bytes:
        """Derive an organization-specific pepper key for salted HMAC hashing."""
        try:
            from app.core.config import setting

            base_secret = (
                getattr(setting, "SECRET_KEY", "podacium_cls_pepper_seed")
                or "podacium_cls_pepper_seed"
            )
        except Exception:
            base_secret = "podacium_cls_pepper_seed"
        org_component = (
            str(organization_id) if organization_id is not None else "global"
        )
        return hashlib.sha256(
            f"{base_secret}:cls_org_pepper:{org_component}".encode("utf-8")
        ).digest()

    @classmethod
    def mask_value(
        cls,
        value: Any,
        column_name: str,
        mask_type: str = "auto",
        organization_id: Optional[Any] = None,
        pepper: Optional[bytes] = None,
    ) -> Any:
        """Apply targeted masking transformation to a cell value."""
        if value is None:
            return None

        str_val = str(value).strip()
        col_lower = column_name.lower()
        mode = (mask_type or "auto").lower()

        if mode == "auto":
            if "email" in col_lower:
                return cls.mask_email(str_val)
            elif "phone" in col_lower or "mobile" in col_lower:
                return cls.mask_phone(str_val)
            elif any(
                k in col_lower
                for k in ["edahabia", "cib", "card_number", "credit_card"]
            ):
                return cls.mask_card(str_val)
            elif any(k in col_lower for k in ["nif", "nis", "nin", "tax_id"]):
                return cls.mask_fiscal_id(str_val)
            elif any(
                k in col_lower
                for k in [
                    "salary",
                    "compensation",
                    "amount",
                    "revenue",
                    "balance",
                    "profit",
                ]
            ):
                return "██████"
            elif len(str_val) > 4:
                return "X" * (len(str_val) - 4) + str_val[-4:]
            else:
                return "XXXX"

        elif mode == "redact":
            return "████████"
        elif mode == "hash":
            key = (
                pepper
                if pepper is not None
                else cls.get_organization_pepper(organization_id)
            )
            if isinstance(key, str):
                key = key.encode("utf-8")
            return hmac.new(key, str_val.encode("utf-8"), hashlib.sha256).hexdigest()
        elif mode == "partial":
            if len(str_val) > 4:
                return "X" * (len(str_val) - 4) + str_val[-4:]
            return "XXXX"

        return "XXXX"

    @classmethod
    def apply_cls_masking(
        cls,
        records: List[Dict[str, Any]],
        user_role: str = "VIEWER",
        restricted_columns: Optional[List[str]] = None,
        custom_mask_rules: Optional[Dict[str, str]] = None,
        organization_id: Optional[Any] = None,
        pepper: Optional[bytes] = None,
    ) -> List[Dict[str, Any]]:
        """
        Apply CLS masking across dataset record dictionaries based on user role.
        If user_role is in UNMASKED_ROLES, raw data remains intact.
        """
        if not records:
            return []

        if user_role.upper() in cls.UNMASKED_ROLES:
            return records

        cols_to_mask: Set[str] = set(restricted_columns or [])
        all_keys = set().union(*(r.keys() for r in records))

        for col in all_keys:
            if cls.is_sensitive_column(col):
                cols_to_mask.add(col)

        if not cols_to_mask:
            return records

        org_pepper = (
            pepper
            if pepper is not None
            else cls.get_organization_pepper(organization_id)
        )
        rules = custom_mask_rules or {}
        masked_records = []

        for row in records:
            masked_row = dict(row)
            for col in cols_to_mask:
                if col in masked_row and masked_row[col] is not None:
                    rule_type = rules.get(col, "auto")
                    masked_row[col] = cls.mask_value(
                        masked_row[col],
                        col,
                        mask_type=rule_type,
                        organization_id=organization_id,
                        pepper=org_pepper,
                    )
            masked_records.append(masked_row)

        logger.debug(
            f"Applied CLS masking for role '{user_role}' on columns: {list(cols_to_mask)}"
        )
        return masked_records

    @classmethod
    async def create_row_level_policy(
        cls,
        name: str,
        dataset_id: int,
        organization_id: int,
        role: str = "VIEWER",
        user_attribute: Optional[str] = None,
        column_name: str = "",
        operator: str = "eq",
        value_predicate: str = "",
        is_active: bool = True,
    ) -> Dict[str, Any]:
        """Persist a RowLevelPolicy record in Prisma DB."""
        from app.core.prisma import prisma

        policy = await prisma.rowlevelpolicy.create(
            data={
                "name": name,
                "datasetId": dataset_id,
                "organizationId": organization_id,
                "role": role,
                "userAttribute": user_attribute,
                "columnName": column_name,
                "operator": operator,
                "valuePredicate": value_predicate,
                "isActive": is_active,
            }
        )
        return policy.model_dump()

    @classmethod
    async def save_row_level_policy(
        cls,
        name: str,
        dataset_id: int,
        organization_id: int,
        role: str = "VIEWER",
        user_attribute: Optional[str] = None,
        column_name: str = "",
        operator: str = "eq",
        value_predicate: str = "",
        is_active: bool = True,
        policy_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Persist or update a RowLevelPolicy record in Prisma DB (alias to create_row_level_policy)."""
        from app.core.prisma import prisma

        if policy_id:
            existing = await prisma.rowlevelpolicy.find_unique(where={"id": policy_id})
            if existing and existing.organizationId == organization_id:
                policy = await prisma.rowlevelpolicy.update(
                    where={"id": policy_id},
                    data={
                        "name": name,
                        "datasetId": dataset_id,
                        "role": role,
                        "userAttribute": user_attribute,
                        "columnName": column_name,
                        "operator": operator,
                        "valuePredicate": value_predicate,
                        "isActive": is_active,
                    },
                )
                return policy.model_dump()

        return await cls.create_row_level_policy(
            name=name,
            dataset_id=dataset_id,
            organization_id=organization_id,
            role=role,
            user_attribute=user_attribute,
            column_name=column_name,
            operator=operator,
            value_predicate=value_predicate,
            is_active=is_active,
        )

    @classmethod
    async def list_row_level_policies(
        cls, organization_id: int, dataset_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Fetch RLS policies from Prisma DB."""
        from app.core.prisma import prisma

        where: Dict[str, Any] = {"organizationId": organization_id}
        if dataset_id:
            where["datasetId"] = dataset_id

        policies = await prisma.rowlevelpolicy.find_many(
            where=where,
            order={"createdAt": "desc"},
        )
        return [p.model_dump() for p in policies]

    @classmethod
    async def delete_row_level_policy(
        cls, policy_id: int, organization_id: int
    ) -> bool:
        """Delete an RLS policy record from Prisma DB."""
        from app.core.prisma import prisma

        policy = await prisma.rowlevelpolicy.find_unique(where={"id": policy_id})
        if policy and policy.organizationId == organization_id:
            await prisma.rowlevelpolicy.delete(where={"id": policy_id})
            return True
        return False
