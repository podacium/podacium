"""
Granular RBAC Scope Matrix and Bitmask for Podacium Developer API Keys.
Categorized across the 3 business pillars: EdTech, Freelancing, and Business Intelligence (BI),
as well as billing/invoicing and webhook infrastructure.
"""

from __future__ import annotations

from enum import IntFlag, auto
from typing import Iterable, List


VALID_SCOPES = {
    # 🎓 EDTECH PILLAR
    "read:courses": "View enrolled and catalog courses",
    "write:enrollments": "Enroll in courses and manage student state",
    "education:courses:read": "View enrolled and catalog courses",
    "education:courses:write": "Create and update course content",
    "education:assignments:read": "View assignment details and submissions",
    "education:assignments:write": "Submit assignment files and repositories",
    "education:certificates:read": "View earned certificates",
    "education:certificates:verify": "Cryptographically verify student certificates",
    # 💼 FREELANCING PILLAR
    "read:contracts": "View active contract terms and milestones",
    "write:milestones": "Update and deliver milestone artifacts",
    "freelance:jobs:read": "Browse active client job postings",
    "freelance:proposals:write": "Submit freelancer proposal bids",
    "freelance:contracts:read": "View active contract terms and milestones",
    "freelance:contracts:write": "Update contract milestone submission branches",
    "freelance:payouts:request": "Trigger BaridiMob/CCP payout requests",
    # 💳 BILLING & PAYMENTS
    "read:invoices": "Query and download generated ANAE invoices",
    "create:payouts": "Initiate automated payment disbursements",
    # 🏢 BUSINESS INTELLIGENCE PILLAR
    "bi:datasets:read": "Query BI dataset tables and views",
    "bi:datasets:write": "Ingest CSV/JSON rows into BI datasets",
    "bi:dashboards:read": "Retrieve dashboard metric summaries",
    "bi:dashboards:export": "Export dashboard PDF/PNG snapshots",
    # ⚡ DEVELOPER & WEBHOOK INFRASTRUCTURE
    "manage:webhooks": "Create, rotate, inspect, and replay webhook endpoints",
    # 🔑 SYSTEM & ALL-ACCESS
    "*": "Full unrestricted programmatic API access",
}


class ScopeBitmask(IntFlag):
    NONE = 0
    # EdTech
    READ_COURSES = auto()
    WRITE_ENROLLMENTS = auto()
    EDUCATION_COURSES_READ = auto()
    EDUCATION_COURSES_WRITE = auto()
    EDUCATION_ASSIGNMENTS_READ = auto()
    EDUCATION_ASSIGNMENTS_WRITE = auto()
    EDUCATION_CERTIFICATES_READ = auto()
    EDUCATION_CERTIFICATES_VERIFY = auto()
    # Freelancing
    READ_CONTRACTS = auto()
    WRITE_MILESTONES = auto()
    FREELANCE_JOBS_READ = auto()
    FREELANCE_PROPOSALS_WRITE = auto()
    FREELANCE_CONTRACTS_READ = auto()
    FREELANCE_CONTRACTS_WRITE = auto()
    FREELANCE_PAYOUTS_REQUEST = auto()
    # Billing
    READ_INVOICES = auto()
    CREATE_PAYOUTS = auto()
    # BI
    BI_DATASETS_READ = auto()
    BI_DATASETS_WRITE = auto()
    BI_DASHBOARDS_READ = auto()
    BI_DASHBOARDS_EXPORT = auto()
    # Webhooks
    MANAGE_WEBHOOKS = auto()
    # Superuser Wildcard
    ALL = (1 << 30) - 1


SCOPE_TO_BIT = {
    "read:courses": ScopeBitmask.READ_COURSES | ScopeBitmask.EDUCATION_COURSES_READ,
    "write:enrollments": ScopeBitmask.WRITE_ENROLLMENTS,
    "education:courses:read": ScopeBitmask.EDUCATION_COURSES_READ
    | ScopeBitmask.READ_COURSES,
    "education:courses:write": ScopeBitmask.EDUCATION_COURSES_WRITE,
    "education:assignments:read": ScopeBitmask.EDUCATION_ASSIGNMENTS_READ,
    "education:assignments:write": ScopeBitmask.EDUCATION_ASSIGNMENTS_WRITE,
    "education:certificates:read": ScopeBitmask.EDUCATION_CERTIFICATES_READ,
    "education:certificates:verify": ScopeBitmask.EDUCATION_CERTIFICATES_VERIFY,
    "read:contracts": ScopeBitmask.READ_CONTRACTS
    | ScopeBitmask.FREELANCE_CONTRACTS_READ,
    "write:milestones": ScopeBitmask.WRITE_MILESTONES
    | ScopeBitmask.FREELANCE_CONTRACTS_WRITE,
    "freelance:jobs:read": ScopeBitmask.FREELANCE_JOBS_READ,
    "freelance:proposals:write": ScopeBitmask.FREELANCE_PROPOSALS_WRITE,
    "freelance:contracts:read": ScopeBitmask.FREELANCE_CONTRACTS_READ
    | ScopeBitmask.READ_CONTRACTS,
    "freelance:contracts:write": ScopeBitmask.FREELANCE_CONTRACTS_WRITE
    | ScopeBitmask.WRITE_MILESTONES,
    "freelance:payouts:request": ScopeBitmask.FREELANCE_PAYOUTS_REQUEST
    | ScopeBitmask.CREATE_PAYOUTS,
    "read:invoices": ScopeBitmask.READ_INVOICES,
    "create:payouts": ScopeBitmask.CREATE_PAYOUTS
    | ScopeBitmask.FREELANCE_PAYOUTS_REQUEST,
    "bi:datasets:read": ScopeBitmask.BI_DATASETS_READ,
    "bi:datasets:write": ScopeBitmask.BI_DATASETS_WRITE,
    "bi:dashboards:read": ScopeBitmask.BI_DASHBOARDS_READ,
    "bi:dashboards:export": ScopeBitmask.BI_DASHBOARDS_EXPORT,
    "manage:webhooks": ScopeBitmask.MANAGE_WEBHOOKS,
    "*": ScopeBitmask.ALL,
}


def validate_scopes(requested_scopes: list[str]) -> bool:
    """Check if all requested scopes exist in the valid scope matrix."""
    for s in requested_scopes:
        if s not in VALID_SCOPES:
            return False
    return True


def scopes_to_bitmask(scopes: Iterable[str]) -> int:
    """Encode string scopes into a single bitmask integer for O(1) checking."""
    mask = ScopeBitmask.NONE
    for s in scopes:
        if s == "*":
            return ScopeBitmask.ALL
        if s in SCOPE_TO_BIT:
            mask |= SCOPE_TO_BIT[s]
    return int(mask)


def check_scope_match(granted_scopes: List[str], required_scope: str) -> bool:
    """
    Evaluate hierarchical scope match:
    1. Wildcard '*' matches anything.
    2. Exact match matches.
    3. Category wildcards (e.g. 'read:*' matches 'read:courses').
    4. Bitmask bit overlap check.
    """
    if "*" in granted_scopes:
        return True
    if required_scope in granted_scopes:
        return True

    # Equivalent scope aliases
    if required_scope == "read:courses" and "education:courses:read" in granted_scopes:
        return True
    if required_scope == "education:courses:read" and "read:courses" in granted_scopes:
        return True
    if (
        required_scope == "read:contracts"
        and "freelance:contracts:read" in granted_scopes
    ):
        return True
    if (
        required_scope == "freelance:contracts:read"
        and "read:contracts" in granted_scopes
    ):
        return True
    if (
        required_scope == "write:milestones"
        and "freelance:contracts:write" in granted_scopes
    ):
        return True
    if (
        required_scope == "freelance:contracts:write"
        and "write:milestones" in granted_scopes
    ):
        return True
    if (
        required_scope == "create:payouts"
        and "freelance:payouts:request" in granted_scopes
    ):
        return True
    if (
        required_scope == "freelance:payouts:request"
        and "create:payouts" in granted_scopes
    ):
        return True

    # Category wildcard prefix check (e.g. "education:*" or "read:*")
    parts = required_scope.split(":")
    if len(parts) >= 2:
        if f"{parts[0]}:*" in granted_scopes:
            return True

    # Bitmask check
    granted_mask = scopes_to_bitmask(granted_scopes)
    req_mask = SCOPE_TO_BIT.get(required_scope, ScopeBitmask.NONE)
    if req_mask and (granted_mask & req_mask) == req_mask:
        return True

    return False
