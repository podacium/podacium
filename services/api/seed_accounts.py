"""Seed script to create test accounts for Podacium.

Creates all platform test accounts including all administrative account tiers:
- Super Administrator (Owner): roubhizakarya@podacium.com
- Super Administrator (Platform Root): podacium@podacium.com
- Technical / DevOps Admin: tech@podacium.com
- Finance & Billing Admin: merhabahmed@podacium.com
- Content & Curriculum Admins: habibredha@podacium.com & benkacimiimadeddine@podacium.com
- Trust, Safety & Support Admin: support@podacium.com
- Auditor / Data Protection Officer (Law 18-07): dpo@podacium.com

All accounts are created with default password 'Podacium=2026+ESE'.
Never run against production unless SEED_ALLOW_PROD=1 is set.
"""

import asyncio
import getpass
import os
import sys
from dotenv import load_dotenv

if os.path.exists("/opt/podacium/.env.prod"):
    load_dotenv("/opt/podacium/.env.prod")
load_dotenv()

# Ensure services/api is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.security import get_password_hash
from app.core.prisma import prisma
from app.generated.prisma import enums as p_enums
from app.core.seed_rbac import seed_rbac_permissions_and_roles
from app.seed.profiles import seed_reserved_usernames
from app.services.envelope_encryption_service import envelope_encryption_service
import uuid

DEFAULT_PASSWORD = "Podacium=2026+ESE"

ADMIN_ACCOUNTS = [
    {
        "email": "roubhizakarya@podacium.com",
        "fullName": "Zakarya Roubhi",
        "role": "ADMIN",
        "adminRoleSlug": "super-admin",
        "department": p_enums.AdminDepartment.SUPER_ADMIN,
        "title": "Super Administrator (Owner)",
        "clearanceLevel": 10,
        "env_var": "SEED_ADMIN_PASSWORD",
        "default_password": DEFAULT_PASSWORD,
    },
    {
        "email": "podacium@podacium.com",
        "fullName": "Podacium Platform",
        "role": "ADMIN",
        "adminRoleSlug": "super-admin",
        "department": p_enums.AdminDepartment.SUPER_ADMIN,
        "title": "Super Administrator (Platform Root)",
        "clearanceLevel": 10,
        "env_var": "SEED_PLATFORM_ADMIN_PASSWORD",
        "default_password": DEFAULT_PASSWORD,
    },
    {
        "email": "tech@podacium.com",
        "fullName": "Technical DevOps Admin",
        "role": "ADMIN",
        "adminRoleSlug": "tech-admin",
        "department": p_enums.AdminDepartment.SECURITY_AND_OPERATIONS,
        "title": "Technical / DevOps Administrator",
        "clearanceLevel": 10,
        "env_var": "SEED_TECH_ADMIN_PASSWORD",
        "default_password": DEFAULT_PASSWORD,
    },
    {
        "email": "merhabahmed@podacium.com",
        "fullName": "Ahmed Merhab",
        "role": "ADMIN",
        "adminRoleSlug": "finance-admin",
        "department": p_enums.AdminDepartment.FINANCE_AND_PAYMENTS,
        "title": "Finance & Billing Administrator",
        "clearanceLevel": 8,
        "env_var": "SEED_FINANCE_ADMIN_PASSWORD",
        "default_password": DEFAULT_PASSWORD,
    },
    {
        "email": "habibredha@podacium.com",
        "fullName": "Redha Habib",
        "role": "ADMIN",
        "adminRoleSlug": "content-admin",
        "department": p_enums.AdminDepartment.CONTENT_MODERATION,
        "title": "Content & Curriculum Administrator",
        "clearanceLevel": 7,
        "env_var": "SEED_CONTENT_ADMIN_PASSWORD",
        "default_password": DEFAULT_PASSWORD,
    },
    {
        "email": "benkacimiimadeddine@podacium.com",
        "fullName": "Imad Eddine Benkacimi",
        "role": "ADMIN",
        "adminRoleSlug": "content-admin",
        "department": p_enums.AdminDepartment.CONTENT_MODERATION,
        "title": "Content & Curriculum Administrator",
        "clearanceLevel": 7,
        "env_var": "SEED_CONTENT_ADMIN_CO_PASSWORD",
        "default_password": DEFAULT_PASSWORD,
    },
    {
        "email": "support@podacium.com",
        "fullName": "Trust & Safety Support Admin",
        "role": "ADMIN",
        "adminRoleSlug": "trust-safety-admin",
        "department": p_enums.AdminDepartment.CUSTOMER_SUPPORT,
        "title": "Trust, Safety & Support Administrator",
        "clearanceLevel": 6,
        "env_var": "SEED_TRUST_SAFETY_ADMIN_PASSWORD",
        "default_password": DEFAULT_PASSWORD,
    },
    {
        "email": "dpo@podacium.com",
        "fullName": "Data Protection Officer",
        "role": "ADMIN",
        "adminRoleSlug": "auditor-analyst",
        "department": p_enums.AdminDepartment.EXECUTIVE,
        "title": "Data Protection Officer / Auditor",
        "clearanceLevel": 5,
        "env_var": "SEED_AUDITOR_ADMIN_PASSWORD",
        "default_password": DEFAULT_PASSWORD,
    },
]

USER_ACCOUNTS = [
    {
        "email": "ossis@podacium.com",
        "fullName": "Ossis Bartum",
        "role": "BUSINESS",
        "env_var": "SEED_BUSINESS_PASSWORD",
        "default_password": DEFAULT_PASSWORD,
    },
    {
        "email": "gadasa@podacium.com",
        "fullName": "Gadasa Khleba",
        "role": "FREELANCER",
        "env_var": "SEED_FREELANCER_PASSWORD",
        "default_password": DEFAULT_PASSWORD,
    },
    {
        "email": "instructor@podacium.com",
        "fullName": "Houari Ibrahim",
        "role": "INSTRUCTOR",
        "env_var": "SEED_INSTRUCTOR_PASSWORD",
        "default_password": DEFAULT_PASSWORD,
    },
    {
        "email": "xerxes@podacium.com",
        "fullName": "Xerxes Megistos",
        "role": "STUDENT",
        "env_var": "SEED_STUDENT_PASSWORD",
        "default_password": DEFAULT_PASSWORD,
    },
]

ACCOUNTS = ADMIN_ACCOUNTS + USER_ACCOUNTS


def prompt_superadmin_password() -> str:
    """Prompt the operator in the terminal for the Superadmin password.

    When running interactively, prompts securely for a custom Superadmin password.
    Falls back to SEED_SUPERADMIN_PASSWORD / SEED_ADMIN_PASSWORD env vars,
    or to DEFAULT_PASSWORD if left blank or run in non-interactive CI/CD.
    """
    env_pwd = os.environ.get("SEED_SUPERADMIN_PASSWORD") or os.environ.get(
        "SEED_ADMIN_PASSWORD"
    )
    if env_pwd:
        print("  🔑 Superadmin password supplied via environment variable.")
        return env_pwd

    if sys.stdin.isatty():
        print("\n" + "=" * 65)
        print("🔐 SUPERADMIN CREDENTIALS CONFIGURATION")
        print("Enter a custom secure password for the Superadmin accounts:")
        print("  • roubhizakarya@podacium.com")
        print("  • podacium@podacium.com")
        print("(Press ENTER without typing to use default: Podacium=2026+ESE)")
        print("=" * 65)
        while True:
            try:
                pwd = getpass.getpass("Enter Superadmin password: ").strip()
                if not pwd:
                    print("  ↳ Using default password: Podacium=2026+ESE")
                    return DEFAULT_PASSWORD
                confirm = getpass.getpass("Confirm Superadmin password: ").strip()
                if pwd != confirm:
                    print("❌ Passwords do not match. Please try again.\n")
                    continue
                print("  ✅ Superadmin password configured successfully.")
                return pwd
            except (EOFError, KeyboardInterrupt):
                print("\n  ↳ Using default password.")
                return DEFAULT_PASSWORD

    return DEFAULT_PASSWORD


async def seed():
    if os.environ.get("ENVIRONMENT") == "production" and not os.environ.get(
        "SEED_ALLOW_PROD"
    ):
        raise SystemExit(
            "Refusing to seed in production. Set SEED_ALLOW_PROD=1 to override (not recommended)."
        )

    # Prompt or resolve the Superadmin password before database operations
    superadmin_pwd = prompt_superadmin_password()

    await prisma.connect()

    # 1. First ensure RBAC granular permissions and system roles are seeded
    print("🔒 Seeding RBAC permissions and system roles...")
    await seed_rbac_permissions_and_roles()

    # 2. Compute passwords mapping per email
    passwords = {}
    for account in ACCOUNTS:
        if account.get("adminRoleSlug") == "super-admin":
            password = superadmin_pwd
            passwords[account["email"]] = password
            print(
                f"  🔑 Set {account['role']} ({account['email']}) password: [SUPERADMIN CONFIGURED]"
            )
        else:
            default_pwd = account.get("default_password", DEFAULT_PASSWORD)
            password = os.environ.get(account["env_var"], default_pwd)
            passwords[account["email"]] = password
            print(
                f"  🔑 Set {account['role']} ({account['email']}) password to: {password}"
            )

    # 3. Create or update user accounts
    for account in ACCOUNTS:
        existing = await prisma.user.find_unique(where={"email": account["email"]})
        if existing:
            user = await prisma.user.update(
                where={"id": existing.id},
                data={
                    "role": account["role"],
                    "passwordHash": get_password_hash(passwords[account["email"]]),
                    "emailVerified": True,
                    "isActive": True,
                },
            )
            print(
                f"  🔄 Updated {account['role']}: {account['email']} (id={user.id}) with updated credentials"
            )
        else:
            user = await prisma.user.create(
                data={
                    "email": account["email"],
                    "fullName": account["fullName"],
                    "role": account["role"],
                    "passwordHash": get_password_hash(passwords[account["email"]]),
                    "emailVerified": True,
                    "isActive": True,
                    "acceptedTerms": True,
                    "onboardingCompleted": True,
                    "provider": "EMAIL",
                }
            )
            print(f"  ✅ Created {account['role']}: {account['email']} (id={user.id})")

        # 4. If account is an admin type, configure AdminProfile and AdminUserRoleAssignment
        if "adminRoleSlug" in account:
            profile = await prisma.adminprofile.upsert(
                where={"userId": user.id},
                data={
                    "create": {
                        "userId": user.id,
                        "department": account["department"],
                        "title": account["title"],
                        "clearanceLevel": account["clearanceLevel"],
                        "mfaEnforced": True,
                        "isActive": True,
                    },
                    "update": {
                        "department": account["department"],
                        "title": account["title"],
                        "clearanceLevel": account["clearanceLevel"],
                        "isActive": True,
                    },
                },
            )

            role = await prisma.adminrole.find_unique(
                where={"slug": account["adminRoleSlug"]}
            )
            if role:
                await prisma.adminuserroleassignment.upsert(
                    where={
                        "adminProfileId_roleId": {
                            "adminProfileId": profile.id,
                            "roleId": role.id,
                        }
                    },
                    data={
                        "create": {
                            "adminProfileId": profile.id,
                            "roleId": role.id,
                            "assignedById": profile.id,
                        },
                        "update": {},
                    },
                )
                print(
                    f"     🛡️ Attached role '{account['adminRoleSlug']}' to {account['email']}"
                )

    # 5. Create organizations for platform root and enterprise client
    for org_owner_email in ["podacium@podacium.com", "ossis@podacium.com"]:
        owner_user = await prisma.user.find_unique(where={"email": org_owner_email})
        if owner_user:
            existing_org = await prisma.organization.find_first(
                where={"ownerId": owner_user.id}
            )
            if existing_org:
                print(
                    f"  ⏭️  Organization '{existing_org.name}' already exists (id={existing_org.id})"
                )
            else:
                org_name = (
                    "Podacium"
                    if org_owner_email == "podacium@podacium.com"
                    else "Ossis Corp"
                )
                org = await prisma.organization.create(
                    data={
                        "name": org_name,
                        "description": "Podacium - Learn. Work. Analyze. Grow.",
                        "ownerId": owner_user.id,
                    }
                )
                await prisma.user.update(
                    where={"id": owner_user.id},
                    data={"primaryOrganizationId": org.id},
                )
                print(
                    f"  ✅ Created organization '{org_name}' (id={org.id}) for {owner_user.email}"
                )

    # 6. Create corporate MailAccount records with standard mailboxes
    print("\n📬 Provisioning corporate mail accounts (Purelymail)...")
    purelymail_accounts = [
        # Shared departmental accounts
        {
            "email": "podacium@podacium.com",
            "displayName": "Podacium Platform",
            "type": p_enums.MailAccountType.SHARED,
            "userEmail": None,
        },
        {
            "email": "support@podacium.com",
            "displayName": "Podacium Support",
            "type": p_enums.MailAccountType.DEPARTMENTAL,
            "userEmail": "support@podacium.com",
        },
        {
            "email": "tech@podacium.com",
            "displayName": "Podacium Tech Ops",
            "type": p_enums.MailAccountType.DEPARTMENTAL,
            "userEmail": "tech@podacium.com",
        },
        # Executive & staff personal corporate mailboxes
        {
            "email": "roubhizakarya@podacium.com",
            "displayName": "Zakarya Roubhi",
            "type": p_enums.MailAccountType.PERSONAL,
            "userEmail": "roubhizakarya@podacium.com",
        },
        {
            "email": "habibredha@podacium.com",
            "displayName": "Redha Habib",
            "type": p_enums.MailAccountType.PERSONAL,
            "userEmail": "habibredha@podacium.com",
        },
        {
            "email": "merhabahmed@podacium.com",
            "displayName": "Ahmed Merhab",
            "type": p_enums.MailAccountType.PERSONAL,
            "userEmail": "merhabahmed@podacium.com",
        },
        {
            "email": "benkacimiimadeddine@podacium.com",
            "displayName": "Imad Eddine Benkacimi",
            "type": p_enums.MailAccountType.PERSONAL,
            "userEmail": "benkacimiimadeddine@podacium.com",
        },
        {
            "email": "dpo@podacium.com",
            "displayName": "Data Protection Officer",
            "type": p_enums.MailAccountType.PERSONAL,
            "userEmail": "dpo@podacium.com",
        },
    ]

    standard_mailboxes = [
        ("Inbox", "INBOX", p_enums.MailboxType.INBOX),
        ("Sent", "Sent", p_enums.MailboxType.SENT),
        ("Drafts", "Drafts", p_enums.MailboxType.DRAFTS),
        ("Trash", "Trash", p_enums.MailboxType.TRASH),
        ("Spam", "Junk", p_enums.MailboxType.SPAM),
        ("Archive", "Archive", p_enums.MailboxType.ARCHIVE),
    ]

    for m_acc in purelymail_accounts:
        if m_acc["email"] == "podacium@podacium.com":
            mail_pwd = os.environ.get("SMTP_PASSWORD", DEFAULT_PASSWORD)
        else:
            mail_pwd = passwords.get(m_acc["email"], DEFAULT_PASSWORD)

        existing = await prisma.mailaccount.find_unique(
            where={"emailAddress": m_acc["email"]}
        )
        if existing:
            print(f"  ⏭️  MailAccount '{m_acc['email']}' already exists")
            continue

        account_uuid = str(uuid.uuid4())
        ct, wrapped_dek, nonce = (
            envelope_encryption_service.encrypt_credentials_triplet(
                password=mail_pwd,
                account_id=account_uuid,
                email=m_acc["email"],
            )
        )

        owner_user_id = None
        if m_acc["userEmail"]:
            u = await prisma.user.find_unique(where={"email": m_acc["userEmail"]})
            if u:
                owner_user_id = u.id

        created_acc = await prisma.mailaccount.create(
            data={
                "accountId": account_uuid,
                "emailAddress": m_acc["email"],
                "displayName": m_acc["displayName"],
                "type": m_acc["type"],
                "status": p_enums.MailAccountStatus.ACTIVE,
                "imapHost": "imap.purelymail.com",
                "imapPort": 993,
                "imapUseSsl": True,
                "smtpHost": "smtp.purelymail.com",
                "smtpPort": 465,
                "smtpUseSsl": True,
                "encryptedPassword": ct,
                "dekWrapped": wrapped_dek,
                "dekNonce": nonce,
                "userId": owner_user_id,
            }
        )

        for mb_name, remote_name, mb_type in standard_mailboxes:
            await prisma.mailbox.create(
                data={
                    "mailboxId": str(uuid.uuid4()),
                    "mailAccountId": created_acc.id,
                    "name": mb_name,
                    "remoteName": remote_name,
                    "type": mb_type,
                    "unreadCount": 0,
                    "totalCount": 0,
                }
            )

        print(
            f"  ✅ Provisioned MailAccount '{m_acc['email']}' with standard mailboxes"
        )

    print("\n🏷️ Seeding reserved usernames...")
    await seed_reserved_usernames()

    await prisma.disconnect()
    print("\n🎉 Seed complete! All accounts, admin tiers, and mailboxes provisioned.")


if __name__ == "__main__":
    asyncio.run(seed())
