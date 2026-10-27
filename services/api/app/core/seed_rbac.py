# services/api/app/core/seed_rbac.py
"""
Seeding script for the 65 granular RBAC permissions and 6 default system roles.
"""

import asyncio
import logging
from typing import Any, Dict, List
from app.core.prisma import prisma
from app.generated.prisma import enums as p_enums

logger = logging.getLogger("podacium.seed_rbac")

# Master Permissions Catalog
PERMISSIONS_DATA: List[Dict[str, Any]] = [
    # 1. Admin Console & Analytics
    {
        "code": "admin:access",
        "name": "Admin Console Access",
        "domain": "SYSTEM",
        "description": "Access the admin control plane shell",
    },
    {
        "code": "dashboard:read",
        "name": "View Dashboard KPIs",
        "domain": "SYSTEM",
        "description": "View top-level platform KPI summary",
    },
    {
        "code": "analytics:read",
        "name": "View Platform Analytics",
        "domain": "SYSTEM",
        "description": "View aggregated revenue, growth and retention",
    },
    {
        "code": "audit:read",
        "name": "Inspect Audit Trail",
        "domain": "SYSTEM",
        "description": "Inspect cryptographic activity audit logs",
        "isDangerous": True,
    },
    # 2. Staff IAM & User Management
    {
        "code": "users:read",
        "name": "Search & View Users",
        "domain": "USERS",
        "description": "Search and inspect user profiles and roles",
    },
    {
        "code": "users:write",
        "name": "Modify User Details",
        "domain": "USERS",
        "description": "Modify user bio, wilaya, email verification status",
    },
    {
        "code": "users:ban",
        "name": "Suspend / Ban Users",
        "domain": "USERS",
        "description": "Suspend, freeze, or unban user accounts",
        "isDangerous": True,
    },
    {
        "code": "iam:roles:read",
        "name": "View Staff Roles & Permissions",
        "domain": "RBAC",
        "description": "Inspect available administrative roles and permissions",
    },
    {
        "code": "iam:roles:assign",
        "name": "Assign Staff Roles",
        "domain": "RBAC",
        "description": "Assign or revoke staff administrative tiers",
        "isDangerous": True,
    },
    {
        "code": "iam:sessions:revoke",
        "name": "Revoke Staff Sessions",
        "domain": "RBAC",
        "description": "Terminate staff sessions and revoke tokens",
        "isDangerous": True,
    },
    # 3. Identity, KYC & Fraud Prevention
    {
        "code": "kyc:read",
        "name": "View KYC Submissions",
        "domain": "KYC",
        "description": "View submitted government ID and biometric documents",
    },
    {
        "code": "kyc:review",
        "name": "Approve/Reject KYC",
        "domain": "KYC",
        "description": "Approve, reject, or request KYC re-upload",
        "isDangerous": True,
    },
    {
        "code": "security:devices:read",
        "name": "Inspect Device Fingerprints",
        "domain": "SECURITY",
        "description": "Inspect user hardware fingerprints and IP history",
    },
    {
        "code": "security:devices:override",
        "name": "Override Device Trust",
        "domain": "SECURITY",
        "description": "Whitelist or blacklist hardware devices",
        "isDangerous": True,
    },
    {
        "code": "security:events:read",
        "name": "View Security Events",
        "domain": "SECURITY",
        "description": "View login anomalies and velocity spikes",
    },
    # 4. Community, Appeals & Reviews
    {
        "code": "appeals:read",
        "name": "View Appeals",
        "domain": "SUPPORT",
        "description": "View suspension and sanction appeals",
    },
    {
        "code": "appeals:resolve",
        "name": "Resolve Appeals",
        "domain": "SUPPORT",
        "description": "Accept or dismiss user appeals",
        "isDangerous": True,
    },
    {
        "code": "reviews:reports:read",
        "name": "View Review Reports",
        "domain": "SUPPORT",
        "description": "Inspect reported course and freelancer reviews",
    },
    {
        "code": "reviews:redact",
        "name": "Redact Reviews",
        "domain": "SUPPORT",
        "description": "Redact or hide abusive reviews",
        "isDangerous": True,
    },
    {
        "code": "reviews:appeals:decide",
        "name": "Decide Review Appeals",
        "domain": "SUPPORT",
        "description": "Rule on freelancer review disputes",
        "isDangerous": True,
    },
    # 5. Customer Support & Tickets
    {
        "code": "tickets:read",
        "name": "View Support Tickets",
        "domain": "SUPPORT",
        "description": "View support tickets, stats, SLA breaches",
    },
    {
        "code": "tickets:assign",
        "name": "Assign Tickets",
        "domain": "SUPPORT",
        "description": "Assign tickets to staff or wilaya agents",
    },
    {
        "code": "tickets:reply",
        "name": "Reply to Tickets",
        "domain": "SUPPORT",
        "description": "Reply to customer tickets and add internal notes",
    },
    {
        "code": "tickets:close",
        "name": "Close Tickets",
        "domain": "SUPPORT",
        "description": "Mark tickets as resolved or closed",
    },
    # 6. Curriculum CMS & Course Review
    {
        "code": "content:paths:read",
        "name": "View Learning Paths",
        "domain": "EDUCATION",
        "description": "View structured career learning paths",
    },
    {
        "code": "content:paths:write",
        "name": "Manage Learning Paths",
        "domain": "EDUCATION",
        "description": "Create, edit, and reorder learning paths",
    },
    {
        "code": "content:paths:delete",
        "name": "Delete Learning Paths",
        "domain": "EDUCATION",
        "description": "Delete learning career paths",
        "isDangerous": True,
    },
    {
        "code": "content:courses:read",
        "name": "View Course Catalog",
        "domain": "EDUCATION",
        "description": "View course catalog and draft modules",
    },
    {
        "code": "content:courses:write",
        "name": "Manage Courses",
        "domain": "EDUCATION",
        "description": "Create and edit courses, prerequisites, tags",
    },
    {
        "code": "content:courses:bulk",
        "name": "Bulk Course Actions",
        "domain": "EDUCATION",
        "description": "Bulk publish, unpublish, archive modules",
        "isDangerous": True,
    },
    {
        "code": "content:lessons:write",
        "name": "Author Lessons",
        "domain": "EDUCATION",
        "description": "Author lessons, rich content, subtitles",
    },
    {
        "code": "content:quizzes:write",
        "name": "Author Quizzes",
        "domain": "EDUCATION",
        "description": "Author quiz questions, options, passing score",
    },
    {
        "code": "content:review:read",
        "name": "View Course Reviews",
        "domain": "EDUCATION",
        "description": "View pending course submissions from creators",
    },
    {
        "code": "content:review:decide",
        "name": "Decide Course Submissions",
        "domain": "EDUCATION",
        "description": "Approve, reject, or request course revisions",
        "isDangerous": True,
    },
    # 7. Video Ingestion & CDN Routing
    {
        "code": "video:upload",
        "name": "Upload Video Assets",
        "domain": "EDUCATION",
        "description": "Direct video file ingestion to S3/Bunny",
    },
    {
        "code": "video:migrate",
        "name": "Migrate Video CDN",
        "domain": "EDUCATION",
        "description": "Non-destructive CDN migration (Bunny <-> AWS)",
    },
    {
        "code": "video:config:read",
        "name": "View Video Config",
        "domain": "SYSTEM",
        "description": "Inspect active video provider routing",
    },
    {
        "code": "video:config:write",
        "name": "Update Video Config",
        "domain": "SYSTEM",
        "description": "Rotate Bunny API keys, AWS S3 keys",
        "isDangerous": True,
    },
    {
        "code": "video:test",
        "name": "Test Video Diagnostics",
        "domain": "SYSTEM",
        "description": "Run connection diagnostic test on video providers",
    },
    # 8. Live Learning & Streaming
    {
        "code": "live:sessions:read",
        "name": "View Live Sessions",
        "domain": "EDUCATION",
        "description": "View scheduled, live, and ended sessions",
    },
    {
        "code": "live:sessions:approve",
        "name": "Approve Live Sessions",
        "domain": "EDUCATION",
        "description": "Approve or reject pending live session booking",
    },
    {
        "code": "live:sessions:terminate",
        "name": "Terminate Live Session",
        "domain": "EDUCATION",
        "description": "Force-kill live room due to abuse/ToS",
        "isDangerous": True,
    },
    {
        "code": "live:stats:read",
        "name": "View Live Stream Stats",
        "domain": "EDUCATION",
        "description": "View live stream WebRTC egress and stats",
    },
    # 9. Freelance Marketplace & Disputes
    {
        "code": "freelance:stats:read",
        "name": "View Freelance Stats",
        "domain": "FREELANCING",
        "description": "Inspect platform GMV, active contracts",
    },
    {
        "code": "freelance:disputes:read",
        "name": "View Freelance Disputes",
        "domain": "FREELANCING",
        "description": "View client-freelancer open disputes",
    },
    {
        "code": "freelance:disputes:arbitrate",
        "name": "Arbitrate Disputes",
        "domain": "FREELANCING",
        "description": "Issue binding arbitration ruling on escrow funds",
        "isDangerous": True,
    },
    # 10. Financial Controls & Billing
    {
        "code": "finance:rates:read",
        "name": "View Commission Rates",
        "domain": "BILLING",
        "description": "View Algerian platform commission tiers",
    },
    {
        "code": "finance:rates:write",
        "name": "Adjust Commission Rates",
        "domain": "BILLING",
        "description": "Adjust commission percentages and bounds",
        "isDangerous": True,
    },
    {
        "code": "finance:gateways:read",
        "name": "View Payment Gateways",
        "domain": "BILLING",
        "description": "Inspect active payment gateways",
    },
    {
        "code": "finance:gateways:write",
        "name": "Update Payment Gateways",
        "domain": "BILLING",
        "description": "Update Chargily/Stripe secret keys and webhooks",
        "isDangerous": True,
    },
    {
        "code": "finance:tiers:write",
        "name": "Manage Subscription Tiers",
        "domain": "BILLING",
        "description": "Create & update B2B/B2C subscription plans",
        "isDangerous": True,
    },
    {
        "code": "finance:payouts:approve",
        "name": "Approve Payouts",
        "domain": "BILLING",
        "description": "Approve freelancer DZD bank/CCP payouts",
        "isDangerous": True,
    },
    {
        # Referenced by GET /wallets/admin/withdrawals. Without a definition the
        # endpoint was effectively SUPER_ADMIN-only even for finance-admin.
        "code": "finance:payouts:read",
        "name": "View Payouts",
        "domain": "BILLING",
        "description": "Inspect withdrawal requests and their review state",
    },
    {
        "code": "finance:payouts:reject",
        "name": "Reject Payouts",
        "domain": "BILLING",
        "description": "Reject freelancer DZD payouts with a documented reason",
        "isDangerous": True,
    },
    {
        "code": "finance:wallets:read",
        "name": "View Wallets",
        "domain": "BILLING",
        "description": "Inspect user and organization PodaPoints wallets",
    },
    {
        "code": "finance:wallets:adjust",
        "name": "Adjust Wallet Balances",
        "domain": "BILLING",
        "description": "Manually credit or debit a wallet (capped, audited, idempotent)",
        "isDangerous": True,
    },
    # 11. DevOps, Flags & Infrastructure
    {
        "code": "infra:flags:read",
        "name": "View Feature Flags",
        "domain": "SYSTEM",
        "description": "Inspect feature flags, rules, and rollouts",
    },
    {
        "code": "infra:flags:write",
        "name": "Manage Feature Flags",
        "domain": "SYSTEM",
        "description": "Create, toggle, or alter rollout percentage",
        "isDangerous": True,
    },
    {
        "code": "infra:limits:write",
        "name": "Manage Platform Limits",
        "domain": "SYSTEM",
        "description": "Update system-wide rate limits & thresholds",
        "isDangerous": True,
    },
    {
        "code": "infra:security:write",
        "name": "Manage Security Settings",
        "domain": "SYSTEM",
        "description": "Modify CORS origins, session TTL, auth policy",
        "isDangerous": True,
    },
    {
        "code": "notifications:config:write",
        "name": "Manage Notification Gateways",
        "domain": "SYSTEM",
        "description": "Update Twilio/Resend/FCM keys & quotas",
        "isDangerous": True,
    },
    {
        "code": "trending:recalculate",
        "name": "Recalculate Trending",
        "domain": "SYSTEM",
        "description": "Trigger on-demand algorithm recalculation",
    },
    # 12. Organizations, Enrollments & Waitlist
    {
        "code": "orgs:read",
        "name": "View Organizations",
        "domain": "USERS",
        "description": "View enterprise/academic organizations",
    },
    {
        "code": "orgs:write",
        "name": "Manage Organizations",
        "domain": "USERS",
        "description": "Edit organization quota, plan, sector",
    },
    {
        "code": "orgs:delete",
        "name": "Delete Organization",
        "domain": "USERS",
        "description": "Deactivate/delete an organization workspace",
        "isDangerous": True,
    },
    {
        "code": "enrollments:read",
        "name": "View Enrollments",
        "domain": "EDUCATION",
        "description": "Search student course enrollments & progress",
    },
    {
        "code": "enrollments:grant",
        "name": "Grant Enrollment",
        "domain": "EDUCATION",
        "description": "Manually grant student course enrollment",
    },
    {
        "code": "enrollments:revoke",
        "name": "Revoke Enrollment",
        "domain": "EDUCATION",
        "description": "Revoke student access from a module",
        "isDangerous": True,
    },
    {
        "code": "waitlist:read",
        "name": "View Waitlist",
        "domain": "USERS",
        "description": "View pre-launch registrations & conversion stats",
    },
    {
        "code": "waitlist:export",
        "name": "Export Waitlist",
        "domain": "USERS",
        "description": "Export sanitized waitlist database to CSV",
    },
]

# Standard System Roles Definition
SYSTEM_ROLES: Dict[str, Dict[str, Any]] = {
    "super-admin": {
        "name": "Super Administrator (Owner)",
        "description": "Unrestricted platform owner with break-glass mutation rights across all domains.",
        "hierarchyRank": 1,
        "permissions": [p["code"] for p in PERMISSIONS_DATA],
    },
    "tech-admin": {
        "name": "Technical / DevOps Administrator",
        "description": "Infrastructure operations, feature flags, video provider configurations, platform limits.",
        "hierarchyRank": 10,
        "permissions": [
            "admin:access",
            "dashboard:read",
            "analytics:read",
            "audit:read",
            "iam:sessions:revoke",
            "security:devices:read",
            "security:devices:override",
            "security:events:read",
            "video:migrate",
            "video:config:read",
            "video:config:write",
            "video:test",
            "live:sessions:read",
            "live:sessions:terminate",
            "live:stats:read",
            "infra:flags:read",
            "infra:flags:write",
            "infra:limits:write",
            "notifications:config:write",
            "trending:recalculate",
        ],
    },
    "finance-admin": {
        "name": "Finance & Billing Administrator",
        "description": "Platform commissions, payment gateways, subscription plans, freelancer payouts.",
        "hierarchyRank": 20,
        "permissions": [
            "admin:access",
            "dashboard:read",
            "analytics:read",
            "freelance:stats:read",
            "freelance:disputes:read",
            "freelance:disputes:arbitrate",
            "finance:rates:read",
            "finance:rates:write",
            "finance:gateways:read",
            "finance:gateways:write",
            "finance:tiers:write",
            "finance:payouts:approve",
            "finance:payouts:read",
            "finance:payouts:reject",
            "finance:wallets:read",
            "finance:wallets:adjust",
        ],
    },
    "content-admin": {
        "name": "Content & Curriculum Administrator",
        "description": "Learning paths, courses, lessons, quizzes, submissions review, video uploading.",
        "hierarchyRank": 30,
        "permissions": [
            "admin:access",
            "content:paths:read",
            "content:paths:write",
            "content:paths:delete",
            "content:courses:read",
            "content:courses:write",
            "content:courses:bulk",
            "content:lessons:write",
            "content:quizzes:write",
            "content:review:read",
            "content:review:decide",
            "video:upload",
            "video:migrate",
            "video:config:read",
            "live:sessions:read",
            "live:sessions:approve",
            "enrollments:read",
            "enrollments:grant",
            "enrollments:revoke",
        ],
    },
    "trust-safety-admin": {
        "name": "Trust, Safety & Support Administrator",
        "description": "User bans, KYC document verification, customer tickets, dispute and review arbitration.",
        "hierarchyRank": 40,
        "permissions": [
            "admin:access",
            "users:read",
            "users:write",
            "users:ban",
            "kyc:read",
            "kyc:review",
            "security:devices:read",
            "security:devices:override",
            "security:events:read",
            "appeals:read",
            "appeals:resolve",
            "reviews:reports:read",
            "reviews:redact",
            "reviews:appeals:decide",
            "tickets:read",
            "tickets:assign",
            "tickets:reply",
            "tickets:close",
            "live:sessions:read",
            "live:sessions:approve",
            "live:sessions:terminate",
            "freelance:disputes:read",
            "freelance:disputes:arbitrate",
            "orgs:read",
            "orgs:write",
            "enrollments:read",
            "enrollments:grant",
            "enrollments:revoke",
        ],
    },
    "auditor-analyst": {
        "name": "Auditor / BI Analyst",
        "description": "Read-only inspection of analytics, dashboard, audit trails, and waitlist data.",
        "hierarchyRank": 50,
        "permissions": [
            "admin:access",
            "dashboard:read",
            "analytics:read",
            "audit:read",
            "security:events:read",
            "live:stats:read",
            "freelance:stats:read",
            "finance:rates:read",
            "orgs:read",
            "enrollments:read",
            "waitlist:read",
            "waitlist:export",
        ],
    },
}


async def seed_rbac_permissions_and_roles() -> None:
    """Seed base granular permissions and system roles."""
    if not prisma.is_connected():
        await prisma.connect()
    logger.info("Seeding RBAC permissions...")
    perm_code_to_id: Dict[str, int] = {}

    for p in PERMISSIONS_DATA:
        domain_enum = getattr(
            p_enums.AdminPermissionDomain,
            p["domain"],
            p_enums.AdminPermissionDomain.SYSTEM,
        )
        perm = await prisma.adminpermission.upsert(
            where={"code": p["code"]},
            data={
                "create": {
                    "code": p["code"],
                    "name": p["name"],
                    "domain": domain_enum,
                    "description": p.get("description"),
                    "isDangerous": p.get("isDangerous", False),
                },
                "update": {
                    "name": p["name"],
                    "domain": domain_enum,
                    "description": p.get("description"),
                    "isDangerous": p.get("isDangerous", False),
                },
            },
        )
        perm_code_to_id[p["code"]] = perm.id

    logger.info(f"Seeded {len(perm_code_to_id)} permissions. Seeding system roles...")

    for slug, r_data in SYSTEM_ROLES.items():
        role = await prisma.adminrole.upsert(
            where={"slug": slug},
            data={
                "create": {
                    "slug": slug,
                    "name": r_data["name"],
                    "description": r_data["description"],
                    "hierarchyRank": r_data["hierarchyRank"],
                    "isSystem": True,
                },
                "update": {
                    "name": r_data["name"],
                    "description": r_data["description"],
                    "hierarchyRank": r_data["hierarchyRank"],
                    "isSystem": True,
                },
            },
        )

        # Clear existing role permissions and re-attach
        await prisma.adminrolepermission.delete_many(where={"roleId": role.id})
        for code in r_data["permissions"]:
            if code in perm_code_to_id:
                await prisma.adminrolepermission.create(
                    data={
                        "roleId": role.id,
                        "permissionId": perm_code_to_id[code],
                    }
                )

    # Ensure admin users without a profile receive a default SUPER_ADMIN AdminProfile
    admin_users = await prisma.user.find_many(where={"role": "ADMIN"})
    super_admin_role = await prisma.adminrole.find_unique(where={"slug": "super-admin"})

    for admin_user in admin_users:
        existing_profile = await prisma.adminprofile.find_unique(
            where={"userId": admin_user.id}
        )
        if not existing_profile:
            profile = await prisma.adminprofile.create(
                data={
                    "userId": admin_user.id,
                    "department": p_enums.AdminDepartment.SUPER_ADMIN,
                    "title": "Super Administrator",
                    "clearanceLevel": 10,
                    "mfaEnforced": True,
                    "isActive": True,
                },
            )
            if super_admin_role:
                await prisma.adminuserroleassignment.upsert(
                    where={
                        "adminProfileId_roleId": {
                            "adminProfileId": profile.id,
                            "roleId": super_admin_role.id,
                        }
                    },
                    data={
                        "create": {
                            "adminProfileId": profile.id,
                            "roleId": super_admin_role.id,
                            "assignedById": profile.id,
                        },
                        "update": {},
                    },
                )
        elif (
            super_admin_role
            and existing_profile.department == p_enums.AdminDepartment.SUPER_ADMIN
        ):
            await prisma.adminuserroleassignment.upsert(
                where={
                    "adminProfileId_roleId": {
                        "adminProfileId": existing_profile.id,
                        "roleId": super_admin_role.id,
                    }
                },
                data={
                    "create": {
                        "adminProfileId": existing_profile.id,
                        "roleId": super_admin_role.id,
                        "assignedById": existing_profile.id,
                    },
                    "update": {},
                },
            )

    logger.info("RBAC permissions and system roles seeded successfully.")


if __name__ == "__main__":
    asyncio.run(seed_rbac_permissions_and_roles())
