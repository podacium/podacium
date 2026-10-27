import logging

logger = logging.getLogger(__name__)
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
    status,
)
from typing import List, Optional
from datetime import datetime
from app.core.auth import get_current_user
from app.core.prisma import prisma
from app.schemas.organizations import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationListResponse,
    OrganizationMemberResponse,
    MemberInviteRequest,
    MemberUpdateRequest,
    InvitationResponse,
    DepartmentCreate,
    DepartmentResponse,
    BranchCreate,
    BranchResponse,
    TeamLicensePoolCreate,
    TeamLicensePoolResponse,
    SeatAllocateRequest,
    SeatAllocationResponse,
    OrganizationKybCreate,
    OrganizationKybResponse,
    OrganizationKybReviewRequest,
    OrganizationKybReviewResponse,
    CorporateDocumentResponse,
    CompanyCaseStudyCreate,
    CompanyCaseStudyResponse,
    CompanyLeadershipCreate,
    CompanyLeadershipResponse,
    CompanyReviewCreate,
    CompanyReviewResponse,
    EscrowReleaseRequestCreate,
    EscrowApproveRequest,
    SsoDomainConfigUpdate,
    SsoDomainConfigResponse,
    PublicOrganizationProfileResponse,
    PublicOrganizationSummaryResponse,
    ProformaGenerateRequest,
)
from app.services.kyb_service import KybService
from app.services.maker_checker_service import MakerCheckerService
from app.generated.prisma import Json
from app.generated.prisma.enums import Country, City, OrganizationSector
from app.services.email_service import EmailService, email_service as email_svc
from app.services.notification_service import NotificationService, NotificationCreate
from app.core.config import setting
import secrets
from datetime import timedelta, timezone


router = APIRouter()

CITY_BY_COUNTRY = {
    Country.ALGERIA: [
        City.ADRAR,
        City.CHLEF,
        City.LAGHOUAT,
        City.OUM_EL_BOUAGHI,
        City.BATNA,
        City.BEJAIA,
        City.BISKRA,
        City.BECHAR,
        City.BLIDA,
        City.BOUIRA,
        City.TAMANRASSET,
        City.TEBESSA,
        City.TLEMCEN,
        City.TIARET,
        City.TIZI_OUZOU,
        City.ALGIERS,
        City.DJELFA,
        City.JIJEL,
        City.SETIF,
        City.SAIDA,
        City.SKIKDA,
        City.SIDI_BEL_ABBES,
        City.ANNABA,
        City.GUELMA,
        City.CONSTANTINE,
        City.MEDEA,
        City.MOSTAGANEM,
        City.MSILA,
        City.MASCARA,
        City.OUARGLA,
        City.ORAN,
        City.EL_BAYADH,
        City.ILLIZI,
        City.BORDJ_BOU_ARRERIDJ,
        City.BOUMERDES,
        City.EL_TARF,
        City.TINDOUF,
        City.TISSEMSILT,
        City.EL_OUED,
        City.KHENCHELA,
        City.SOUK_AHRAS,
        City.TIPAZA,
        City.MILA,
        City.AIN_DEFLA,
        City.NAAMA,
        City.AIN_TEMOUCHENT,
        City.GHARDAIA,
        City.RELIZANE,
        City.TIMIMOUN,
        City.BORDJ_BADJI_MOKHTAR,
        City.OULED_DJELLAL,
        City.BENI_ABBES,
        City.IN_SALAH,
        City.IN_GUEZZAM,
        City.TOUGGOURT,
        City.DJANET,
        City.EL_MGHAIR,
        City.EL_MENIAA,
        City.AFLOU,
        City.BARIKA,
        City.KSAR_CHELLALA,
        City.MESSAAD,
        City.AIN_OUSSERA,
        City.BOU_SAADA,
        City.EL_ABIODH_SIDI_CHEIKH,
        City.EL_KANTARA,
        City.BIR_EL_ATER,
        City.KSAR_EL_BOUKHARI,
        City.EL_ARICHA,
    ],
    Country.EGYPT: [City.CAIRO, City.ALEXANDRIA, City.GIZA, City.PORT_SAID, City.SUEZ],
    Country.MOROCCO: [
        City.CASABLANCA,
        City.RABAT,
        City.MARRAKESH,
        City.TANGIER,
        City.FES,
    ],
    Country.TUNISIA: [
        City.TUNIS,
        City.SFAX,
        City.SOUSSE,
        City.ETTADHAMEN,
        City.KAIROUAN,
    ],
    Country.LIBYA: [City.TRIPOLI, City.BENGHAZI, City.MISRATA, City.SIRTE, City.SABHA],
}


def validate_city_country(city: City, country: Country):
    if city not in CITY_BY_COUNTRY.get(country, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"City {city} does not belong to {country}",
        )


async def get_org_with_permission(
    org_id: int, user_id: int, required_role: str = "MEMBER"
):
    """
    Helper to get organization and check permissions.
    required_role can be: "OWNER", "ADMIN", "MEMBER"
    """
    org = await prisma.organization.find_unique(
        where={"id": org_id},
        include={
            "members": {"where": {"userId": user_id}},
        },
    )

    if not org or org.deletedAt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found"
        )

    is_owner = org.ownerId == user_id
    membership = org.members[0] if org.members else None
    user_role = "OWNER" if is_owner else (membership.role if membership else None)

    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization",
        )

    # Permission check logic
    role_hierarchy = {"OWNER": 3, "ADMIN": 2, "MEMBER": 1}
    if role_hierarchy.get(user_role, 0) < role_hierarchy.get(required_role, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required: {required_role}",
        )

    return org


@router.get("/organizations", response_model=OrganizationListResponse)
async def list_organizations(current_user: dict = Depends(get_current_user)):
    """List all organizations the user owns or is a member of"""
    user_id = current_user.id

    # Get all owned organizations (exclude deleted)
    owned_orgs = await prisma.organization.find_many(
        where={"ownerId": user_id, "deletedAt": None}, include={"members": True}
    )
    owned_org_ids = {o.id for o in owned_orgs}

    # Get memberships (exclude deleted organizations)
    memberships = await prisma.organizationmember.find_many(
        where={"userId": user_id, "organization": {"deletedAt": None}},
        include={"organization": {"include": {"members": True}}},
    )

    organizations = []

    for owned_org in owned_orgs:
        org_data = owned_org.dict()
        org_data["isOwner"] = True
        org_data["userRole"] = "OWNER"
        org_data["memberCount"] = max(1, len(owned_org.members))
        org_data["members"] = []  # Initialize empty members list for schema compliance
        organizations.append(org_data)

    for membership in memberships:
        org = membership.organization
        if org.id in owned_org_ids:
            continue

        org_data = org.dict()
        org_data["isOwner"] = False
        org_data["userRole"] = membership.role
        org_data["memberCount"] = max(1, len(org.members))
        org_data["members"] = []  # Initialize empty members list for schema compliance
        organizations.append(org_data)

    return {"organizations": organizations, "total": len(organizations)}


@router.post("/organizations", response_model=OrganizationResponse)
async def create_organization(
    data: OrganizationCreate, current_user: dict = Depends(get_current_user)
):
    """Create a new organization with atomic owner membership and fiscal data."""
    user_id = current_user.id
    validate_city_country(data.city, data.country)

    base_slug = data.name.lower().replace(" ", "-").replace("_", "-")[:40]
    base_slug = (
        "".join(c for c in base_slug if c.isalnum() or c in "-") or f"org-{user_id}"
    )
    slug = base_slug
    counter = 1
    while await prisma.organization.find_unique(where={"slug": slug}):
        slug = f"{base_slug}-{counter}"
        counter += 1

    async with prisma.tx() as tx:
        raw_payload = {
            "name": data.name,
            "slug": slug,
            "description": data.description,
            "country": data.country,
            "city": data.city,
            "website": data.website,
            "sector": data.sector,
            "ownerId": user_id,
            "rcNumber": data.rcNumber,
            "nifNumber": data.nifNumber,
            "nisNumber": data.nisNumber,
            "articleImposition": data.articleImposition,
            "taxRegime": data.taxRegime,
            "tagline": data.tagline,
            "companySizeBracket": data.companySizeBracket or "MICRO_1_10",
            "operationalScale": data.operationalScale or "NATIONAL_58_WILAYAS",
            "primaryLanguages": data.primaryLanguages or ["FRENCH", "ARABIC"],
            "isPublic": data.isPublic if data.isPublic is not None else True,
            "internalBulletin": data.internalBulletin,
            "timeZone": data.timeZone or "Africa/Algiers",
            "keyContacts": (
                Json(data.keyContacts)
                if data.keyContacts is not None
                and not isinstance(data.keyContacts, Json)
                else data.keyContacts
            ),
            "hqAddress": data.hqAddress,
            "brandAccentColor": data.brandAccentColor or "#1B4D3E",
            "coverBannerUrl": data.coverBannerUrl,
            "socialLinks": (
                Json(data.socialLinks)
                if data.socialLinks is not None
                and not isinstance(data.socialLinks, Json)
                else data.socialLinks
            ),
        }
        create_payload = {k: v for k, v in raw_payload.items() if v is not None}
        new_org = await tx.organization.create(data=create_payload)
        # 1. Insert Owner into OrganizationMember table
        await tx.organizationmember.create(
            data={
                "organizationId": new_org.id,
                "userId": user_id,
                "role": "OWNER",
            }
        )
        # 2. Update primaryOrganizationId if user has none
        if not getattr(current_user, "primaryOrganizationId", None):
            await tx.user.update(
                where={"id": user_id},
                data={"primaryOrganizationId": new_org.id},
            )

    org_data = new_org.dict()
    org_data["isOwner"] = True
    org_data["userRole"] = "OWNER"
    org_data["memberCount"] = 1
    org_data["members"] = []
    return org_data


@router.get(
    "/organizations/public/directory",
    response_model=List[PublicOrganizationSummaryResponse],
)
async def list_public_organizations(
    sector: Optional[OrganizationSector] = None,
    city: Optional[City] = None,
    search: Optional[str] = None,
    companySizeBracket: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """List public organizations for the ecosystem discovery directory."""
    where_clause: dict = {"deletedAt": None, "isPublic": True}
    if sector:
        where_clause["sector"] = sector
    if city:
        where_clause["city"] = city
    if companySizeBracket:
        where_clause["companySizeBracket"] = companySizeBracket
    if search:
        where_clause["OR"] = [
            {"name": {"contains": search, "mode": "insensitive"}},
            {"description": {"contains": search, "mode": "insensitive"}},
            {"tagline": {"contains": search, "mode": "insensitive"}},
        ]

    orgs = await prisma.organization.find_many(
        where=where_clause,
        take=min(limit, 100),
        skip=offset,
        order={"createdAt": "desc"},
        include={
            "kyb": True,
            "companyReviews": True,
            "caseStudies": True,
        },
    )

    summaries = []
    for org in orgs:
        reviews = org.companyReviews or []
        avg_rating = (
            sum(r.overallRating for r in reviews) / len(reviews) if reviews else 0.0
        )
        kyb_rec = org.kyb
        is_verified = bool(kyb_rec and kyb_rec.status == "APPROVED")
        status_val = kyb_rec.status if kyb_rec else "NOT_SUBMITTED"

        summaries.append(
            PublicOrganizationSummaryResponse(
                id=org.id,
                name=org.name,
                slug=org.slug or f"org-{org.id}",
                city=org.city,
                country=org.country,
                sector=org.sector,
                website=org.website,
                tagline=org.tagline,
                companySizeBracket=org.companySizeBracket or "MICRO_1_10",
                operationalScale=org.operationalScale or "NATIONAL_58_WILAYAS",
                primaryLanguages=org.primaryLanguages or ["FRENCH", "ARABIC"],
                brandAccentColor=org.brandAccentColor or "#1B4D3E",
                coverBannerUrl=org.coverBannerUrl,
                isKybVerified=is_verified,
                kybStatus=status_val,
                averageRating=round(avg_rating, 1),
                reviewCount=len(reviews),
                caseStudyCount=len(org.caseStudies or []),
                createdAt=org.createdAt,
            )
        )
    return summaries


@router.get(
    "/organizations/by-slug/{slug}",
    response_model=PublicOrganizationProfileResponse,
)
async def get_organization_by_slug(slug: str):
    """Get rich public organization profile by slug."""
    org = await prisma.organization.find_first(
        where={"slug": slug, "deletedAt": None},
        include={
            "orgProfile": True,
            "kyb": True,
            "caseStudies": True,
            "leadership": True,
            "companyReviews": True,
        },
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    member_count = await prisma.organizationmember.count(
        where={"organizationId": org.id}
    )

    reviews = org.companyReviews or []
    avg_rating = (
        sum(r.overallRating for r in reviews) / len(reviews) if reviews else 0.0
    )
    kyb_rec = org.kyb
    is_verified = bool(kyb_rec and kyb_rec.status == "APPROVED")

    org_data = org.dict()
    org_data["slug"] = org.slug or slug
    org_data["memberCount"] = member_count + 1
    org_data["isKybVerified"] = is_verified
    org_data["kybStatus"] = kyb_rec.status if kyb_rec else "NOT_SUBMITTED"
    org_data["kybRiskScore"] = kyb_rec.riskScore if kyb_rec else 10.0
    org_data["averageRating"] = round(avg_rating, 1)
    org_data["reviewCount"] = len(reviews)
    org_data["caseStudies"] = org.caseStudies or []
    org_data["leadership"] = org.leadership or []
    org_data["companyReviews"] = reviews
    org_data["orgProfile"] = org.orgProfile
    return org_data


@router.get("/organizations/{org_id}", response_model=OrganizationResponse)
async def get_organization(org_id: int, current_user: dict = Depends(get_current_user)):
    """Get organization details"""
    org = await get_org_with_permission(org_id, current_user.id)
    # Fetch full member count
    member_count = await prisma.organizationmember.count(
        where={"organizationId": org_id}
    )

    # Fetch pending invitations
    invitations = await prisma.invitation.find_many(
        where={
            "organizationId": org_id,
            "status": "PENDING",
            "expiresAt": {"gt": datetime.now()},
        },
        include={"inviter": True},
    )

    org_data = org.dict()
    org_data["isOwner"] = org.ownerId == current_user.id
    if org_data["isOwner"]:
        org_data["userRole"] = "OWNER"
    else:
        # We included this in get_org_with_permission
        org_data["userRole"] = org.members[0].role if org.members else "MEMBER"

    org_data["memberCount"] = member_count + 1  # +1 for owner
    org_data["members"] = []  # Initialize empty members list for schema compliance
    org_data["invitations"] = invitations
    kyb_rec = await prisma.organizationkyb.find_unique(where={"organizationId": org_id})
    org_data["isKybVerified"] = bool(kyb_rec and kyb_rec.status == "APPROVED")
    org_data["kybStatus"] = kyb_rec.status if kyb_rec else "NOT_SUBMITTED"
    return org_data


@router.put("/organizations/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: int,
    data: OrganizationUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update organization details (Owner/Admin only)"""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")

    # Validate city-country dependency if both provided or if one is updated
    if data.city or data.country:
        current_org = await prisma.organization.find_unique(where={"id": org_id})
        city = data.city or City(current_org.city)
        country = data.country or Country(current_org.country)
        validate_city_country(city, country)

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if (
        "keyContacts" in update_data
        and update_data["keyContacts"] is not None
        and not isinstance(update_data["keyContacts"], Json)
    ):
        update_data["keyContacts"] = Json(update_data["keyContacts"])
    if (
        "socialLinks" in update_data
        and update_data["socialLinks"] is not None
        and not isinstance(update_data["socialLinks"], Json)
    ):
        update_data["socialLinks"] = Json(update_data["socialLinks"])

    updated_org = await prisma.organization.update(
        where={"id": org_id}, data=update_data
    )

    org_data = updated_org.dict()
    org_data["isOwner"] = updated_org.ownerId == current_user.id
    org_data["userRole"] = "OWNER" if org_data["isOwner"] else "ADMIN"
    # Fetch count
    member_count = await prisma.organizationmember.count(
        where={"organizationId": org_id}
    )
    org_data["memberCount"] = member_count + 1
    org_data["members"] = []  # Initialize empty members list to satisfy response schema
    kyb_rec = await prisma.organizationkyb.find_unique(where={"organizationId": org_id})
    org_data["isKybVerified"] = bool(kyb_rec and kyb_rec.status == "APPROVED")
    org_data["kybStatus"] = kyb_rec.status if kyb_rec else "NOT_SUBMITTED"

    return org_data


@router.delete("/organizations/{org_id}")
async def delete_organization(
    org_id: int, current_user: dict = Depends(get_current_user)
):
    """Delete an organization (Owner only)"""
    await get_org_with_permission(org_id, current_user.id, required_role="OWNER")

    # Check for active resources before deletion
    dataset_count = await prisma.dataset.count(where={"organizationId": org_id})
    dashboard_count = await prisma.dashboard.count(where={"organizationId": org_id})
    subscription_count = await prisma.subscription.count(
        where={"organizationId": org_id, "status": "ACTIVE"}
    )

    # Build error message for resources that prevent deletion
    blocking_resources = []
    if dataset_count > 0:
        blocking_resources.append(f"{dataset_count} dataset(s)")
    if dashboard_count > 0:
        blocking_resources.append(f"{dashboard_count} dashboard(s)")
    if subscription_count > 0:
        blocking_resources.append(f"{subscription_count} active subscription(s)")

    if blocking_resources:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete organization with {', '.join(blocking_resources)}. Please clean up these resources first.",
        )

    from datetime import datetime

    # Soft delete the organization and release the ownerId
    await prisma.organization.update(
        where={"id": org_id},
        data={
            "deletedAt": datetime.now(timezone.utc),
            "ownerId": None,  # Release the unique constraint so user can create a new org
        },
    )

    return {"success": True, "message": "Organization deleted successfully"}


@router.put("/organizations/{org_id}/slug")
async def change_organization_slug(
    org_id: int, slug: str, current_user: dict = Depends(get_current_user)
):
    """Change organization slug (Owner only)."""
    await get_org_with_permission(org_id, current_user.id, required_role="OWNER")
    clean_slug = slug.lower().replace(" ", "-").replace("_", "-")[:50]
    clean_slug = "".join(c for c in clean_slug if c.isalnum() or c in "-")
    if not clean_slug:
        raise HTTPException(status_code=400, detail="Invalid slug")
    existing = await prisma.organization.find_unique(where={"slug": clean_slug})
    if existing and existing.id != org_id:
        raise HTTPException(status_code=409, detail="Slug already taken")
    await prisma.organization.update(where={"id": org_id}, data={"slug": clean_slug})
    return {"slug": clean_slug}


@router.post("/organizations/{org_id}/switch")
async def switch_organization(
    org_id: int, current_user: dict = Depends(get_current_user)
):
    """Switch primary organization"""
    # Verify membership
    await get_org_with_permission(org_id, current_user.id, required_role="MEMBER")

    await prisma.user.update(
        where={"id": current_user.id}, data={"primaryOrganizationId": org_id}
    )

    return {"success": True, "message": f"Switched to organization {org_id}"}


# -----------------------------------------------------------------------------
# Member Management
# -----------------------------------------------------------------------------


@router.get(
    "/organizations/{org_id}/members", response_model=List[OrganizationMemberResponse]
)
async def list_organization_members(
    org_id: int, current_user: dict = Depends(get_current_user)
):
    """List all members of an organization"""
    await get_org_with_permission(org_id, current_user.id)

    members = await prisma.organizationmember.find_many(
        where={"organizationId": org_id}, include={"user": True}
    )

    # Also fetch the owner
    org = await prisma.organization.find_unique(
        where={"id": org_id}, include={"owner": True}
    )

    # Check if owner is returned in members (usually unlikely if they are just owner and not added as member)
    # But we want to ensure they are in the list
    owner_in_list = any(m.userId == org.ownerId for m in members)

    result = []
    if not owner_in_list and org.owner:
        # Create a virtual member entry for the owner
        # We use -1 as ID to indicate it's not a real OrganizationMember record
        owner_entry = {
            "id": -1,
            "organizationId": org_id,
            "userId": org.ownerId,
            "role": "OWNER",
            "createdAt": org.createdAt,
            "user": org.owner,
        }
        result.append(owner_entry)

    result.extend(members)

    return result


@router.post("/organizations/{org_id}/members", response_model=InvitationResponse)
async def invite_member(
    org_id: int,
    invite: MemberInviteRequest,
    current_user: dict = Depends(get_current_user),
):
    """Invite a user to the organization (Owner/Admin only)"""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")

    # 1. Check if user is already a member
    # Note: We check by email if the user exists, but we also support inviting by email even if they don't have an account (optional, but good practice).
    # For now, let's stick to existing invitation logic but improved.

    target_user = await prisma.user.find_unique(where={"email": invite.email})

    if target_user:
        # Check if already member
        existing_member = await prisma.organizationmember.find_unique(
            where={
                "organizationId_userId": {
                    "organizationId": org_id,
                    "userId": target_user.id,
                }
            }
        )
        if existing_member:
            raise HTTPException(status_code=400, detail="User is already a member")

        target_id = target_user.id
    else:
        # If user doesn't exist, we can still invite them (store invitation).
        # But our current implementation might rely on user ID.
        # The Invitation model stores email, so it's fine.
        # However, for notification service, we need a user ID. We'll skip notification if user doesn't exist.
        target_id = None

    # 2. Check for pending invitation
    existing_invitation = await prisma.invitation.find_first(
        where={"organizationId": org_id, "email": invite.email, "status": "PENDING"}
    )
    if existing_invitation:
        raise HTTPException(
            status_code=400, detail="Invitation already sent to this email"
        )

    # 3. Create Invitation
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    invitation = await prisma.invitation.create(
        data={
            "email": invite.email,
            "role": invite.role,
            "token": token,
            "organizationId": org_id,
            "inviterId": current_user.id,
            "expiresAt": expires_at,
            "status": "PENDING",
        },
        include={"organization": True, "inviter": True},
    )

    # 4. Send Email with professional template
    org_name = invitation.organization.name
    inviter_name = (
        invitation.inviter.fullName
        if invitation.inviter.fullName
        else invitation.inviter.email
    )

    invite_url = f"{setting.FRONTEND_URL}/bi/organizations/invitations/{token}"

    try:
        email_service = EmailService()
        await email_service.send_organization_invitation_email(
            email=invite.email,
            org_name=org_name,
            inviter_name=inviter_name,
            role=invite.role,
            invite_url=invite_url,
        )
    except Exception as e:
        logger.error(f"Operation failed: {e}")
        # Don't fail the request, but log it.

    # 5. Send In-App Notification (if user exists) with actionable data
    if target_id:
        try:
            await NotificationService.create_notification(
                NotificationCreate(
                    user_id=target_id,
                    type="ORGANIZATION_INVITE",
                    title="notifications.invitation.title",
                    body="notifications.invitation.message",
                    variables={
                        "inviterName": inviter_name,
                        "orgName": org_name,
                        "role": invite.role.lower(),
                    },
                    actions=[
                        {
                            "label": "notifications.actions.accept",
                            "action": "accept_invitation",
                            "variant": "primary",
                            "data": {"token": token},
                        },
                        {
                            "label": "notifications.actions.decline",
                            "action": "decline_invitation",
                            "variant": "danger",
                            "data": {"token": token},
                        },
                    ],
                    data={
                        "invitation_id": invitation.id,
                        "organization_id": org_id,
                        "token": token,
                    },
                    category="SYSTEM",
                    priority="HIGH",
                )
            )
        except Exception as e:
            logger.error(f"Operation failed: {e}")

    return invitation


@router.get("/organizations/invitations/me", response_model=List[InvitationResponse])
async def list_my_invitations(current_user: dict = Depends(get_current_user)):
    """List pending invitations for the current user"""
    invitations = await prisma.invitation.find_many(
        where={
            "email": current_user.email,
            "status": "PENDING",
            "expiresAt": {"gt": datetime.now(timezone.utc)},
        },
        include={"organization": True, "inviter": True},
    )
    return invitations


@router.get("/organizations/invitations/{token}")
async def get_invitation_by_token(token: str):
    """Get invitation details by token (public endpoint for acceptance page)"""
    invitation = await prisma.invitation.find_unique(
        where={"token": token}, include={"organization": True, "inviter": True}
    )

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation.status != "PENDING":
        raise HTTPException(status_code=400, detail="Invitation has already been used")

    if invitation.expiresAt < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invitation has expired")

    return {
        "id": invitation.id,
        "email": invitation.email,
        "role": invitation.role,
        "status": invitation.status,
        "expiresAt": invitation.expiresAt.isoformat(),
        "organization": {
            "id": invitation.organization.id,
            "name": invitation.organization.name,
            "description": invitation.organization.description,
        },
        "inviter": {
            "id": invitation.inviter.id,
            "fullName": invitation.inviter.fullName,
            "email": invitation.inviter.email,
        },
    }


@router.post("/organizations/invitations/{token}/accept")
async def accept_invitation(token: str, current_user: dict = Depends(get_current_user)):
    """Accept an invitation"""
    # 1. Find invitation
    invitation = await prisma.invitation.find_unique(
        where={"token": token}, include={"organization": True}
    )

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation.status != "PENDING":
        raise HTTPException(
            status_code=400, detail=f"Invitation is {invitation.status.lower()}"
        )

    if invitation.expiresAt < datetime.now(timezone.utc):
        await prisma.invitation.update(
            where={"id": invitation.id}, data={"status": "EXPIRED"}
        )
        raise HTTPException(status_code=400, detail="Invitation expired")

    if invitation.email != current_user.email:
        raise HTTPException(
            status_code=403, detail="This invitation was sent to another email address"
        )

    # 2. Check if already member
    existing_member = await prisma.organizationmember.find_unique(
        where={
            "organizationId_userId": {
                "organizationId": invitation.organizationId,
                "userId": current_user.id,
            }
        }
    )

    if existing_member:
        # Just mark as accepted if already member (idempotency-ish)
        await prisma.invitation.update(
            where={"id": invitation.id}, data={"status": "ACCEPTED"}
        )
        return {"success": True, "message": "You are already a member"}

    # 3. Create Member
    await prisma.organizationmember.create(
        data={
            "organizationId": invitation.organizationId,
            "userId": current_user.id,
            "role": invitation.role,
            "invitedById": invitation.inviterId,
        }
    )

    # 4. Update Invitation
    await prisma.invitation.update(
        where={"id": invitation.id}, data={"status": "ACCEPTED"}
    )

    # 5. Notify Inviter (in-app + email)
    try:
        await NotificationService.create_notification(
            NotificationCreate(
                user_id=invitation.inviterId,
                type="INVITE_ACCEPTED",
                title="notifications.invitation.accepted.title",
                body="notifications.invitation.accepted.message",
                variables={
                    "userName": current_user.fullName,
                    "orgName": invitation.organization.name,
                },
                data={
                    "user_id": current_user.id,
                    "organization_id": invitation.organizationId,
                },
                category="SYSTEM",
                priority="NORMAL",
            )
        )
        # Send email to inviter
        inviter = await prisma.user.find_unique(where={"id": invitation.inviterId})
        if inviter and inviter.email:
            await email_svc.send_invite_accepted_email(
                email=inviter.email,
                inviter_name=inviter.fullName or "User",
                user_name=current_user.fullName or "User",
                org_name=invitation.organization.name,
                role=invitation.role,
            )
    except Exception as e:
        logger.error(f"Operation failed: {e}")

    return {"success": True, "message": "Invitation accepted"}


@router.post("/organizations/invitations/{token}/decline")
async def decline_invitation(
    token: str, current_user: dict = Depends(get_current_user)
):
    """Decline an invitation"""
    invitation = await prisma.invitation.find_unique(where={"token": token})

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation.email != current_user.email:
        raise HTTPException(status_code=403, detail="Not authorized")

    await prisma.invitation.update(
        where={"id": invitation.id}, data={"status": "DECLINED"}
    )

    return {"success": True, "message": "Invitation declined"}


@router.post("/organizations/invitations/{token}/cancel")
async def cancel_invitation(token: str, current_user: dict = Depends(get_current_user)):
    """Cancel a pending invitation (org admins/owners only)"""
    invitation = await prisma.invitation.find_unique(
        where={"token": token}, include={"organization": True}
    )

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    # Check if user is organization owner
    is_owner = invitation.organization.ownerId == current_user.id

    # Also check member role if not owner
    member = await prisma.organizationmember.find_unique(
        where={
            "organizationId_userId": {
                "organizationId": invitation.organizationId,
                "userId": current_user.id,
            }
        }
    )

    is_admin = member and member.role in ["OWNER", "ADMIN"]

    if not is_owner and not is_admin:
        raise HTTPException(
            status_code=403, detail="Not authorized to cancel invitations"
        )

    if invitation.status != "PENDING":
        raise HTTPException(
            status_code=400, detail="Only pending invitations can be cancelled"
        )

    await prisma.invitation.update(
        where={"id": invitation.id}, data={"status": "CANCELLED"}
    )

    return {"success": True, "message": "Invitation cancelled"}


@router.post("/organizations/invitations/{token}/resend")
async def resend_invitation(token: str, current_user: dict = Depends(get_current_user)):
    """Resend an invitation email (org admins/owners only)"""
    invitation = await prisma.invitation.find_unique(
        where={"token": token}, include={"organization": True, "inviter": True}
    )

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    # Check if user is organization owner
    is_owner = invitation.organization.ownerId == current_user.id

    # Also check member role if not owner
    member = await prisma.organizationmember.find_unique(
        where={
            "organizationId_userId": {
                "organizationId": invitation.organizationId,
                "userId": current_user.id,
            }
        }
    )

    is_admin = member and member.role in ["OWNER", "ADMIN"]

    if not is_owner and not is_admin:
        raise HTTPException(
            status_code=403, detail="Not authorized to resend invitations"
        )

    if invitation.status != "PENDING":
        raise HTTPException(
            status_code=400, detail="Only pending invitations can be resent"
        )

    # Extend expiration
    new_expiry = datetime.now(timezone.utc) + timedelta(days=7)
    await prisma.invitation.update(
        where={"id": invitation.id}, data={"expiresAt": new_expiry}
    )

    # Resend email
    org_name = invitation.organization.name
    inviter_name = (
        invitation.inviter.fullName
        if invitation.inviter.fullName
        else invitation.inviter.email
    )
    invite_url = f"{setting.FRONTEND_URL}/bi/organizations/invitations/{token}"

    try:
        email_service = EmailService()
        await email_service.send_organization_invitation_email(
            email=invitation.email,
            org_name=org_name,
            inviter_name=inviter_name,
            role=invitation.role,
            invite_url=invite_url,
        )
    except Exception as e:
        logger.error(f"Operation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email")

    return {"success": True, "message": "Invitation resent"}


@router.get(
    "/organizations/{org_id}/invitations", response_model=List[InvitationResponse]
)
async def list_organization_invitations(
    org_id: int, current_user: dict = Depends(get_current_user)
):
    """List all pending invitations for an organization (admin/owner only)"""
    # First check if user is the organization owner
    org = await prisma.organization.find_unique(where={"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    is_owner = org.ownerId == current_user.id

    # Also check member role if not owner
    member = await prisma.organizationmember.find_unique(
        where={
            "organizationId_userId": {
                "organizationId": org_id,
                "userId": current_user.id,
            }
        }
    )

    is_admin = member and member.role in ["OWNER", "ADMIN"]

    if not is_owner and not is_admin:
        raise HTTPException(
            status_code=403, detail="Not authorized to view invitations"
        )

    invitations = await prisma.invitation.find_many(
        where={"organizationId": org_id, "status": "PENDING"},
        include={"organization": True, "inviter": True},
        order={"createdAt": "desc"},
    )

    return invitations


@router.delete("/organizations/{org_id}/leave")
async def leave_organization(
    org_id: int, current_user: dict = Depends(get_current_user)
):
    """Leave an organization"""
    user_id = current_user.id

    # Check membership
    member = await prisma.organizationmember.find_unique(
        where={"organizationId_userId": {"organizationId": org_id, "userId": user_id}}
    )

    if not member:
        raise HTTPException(
            status_code=404, detail="You are not a member of this organization"
        )

    # Check if owner
    org = await prisma.organization.find_unique(where={"id": org_id})
    if org.ownerId == user_id:
        raise HTTPException(
            status_code=400,
            detail="Owners cannot leave their organization. Transfer ownership or delete the organization.",
        )

    await prisma.organizationmember.delete(where={"id": member.id})

    return {"success": True, "message": "You have left the organization"}


@router.delete("/organizations/{org_id}/members/{member_id}")
async def remove_member(
    org_id: int, member_id: int, current_user: dict = Depends(get_current_user)
):
    """Remove a member from the organization (Owner/Admin only)"""
    # Admin can remove, but we need to check if they are removing themselves or another admin
    org = await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")

    # Check existence
    member = await prisma.organizationmember.find_unique(where={"id": member_id})
    if not member or member.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Member not found")

    # Permission logic:
    # 1. Owner can remove anyone except themselves (they should delete org)
    # 2. Admin can remove members, but not other admins or owner
    is_owner = org.ownerId == current_user.id

    if not is_owner:
        # User is Admin. Check target role.
        if member.role != "MEMBER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins can only remove regular members. Owners must handle other roles.",
            )

    await prisma.organizationmember.delete(where={"id": member_id})

    # Send member removed email
    try:
        removed_user = await prisma.user.find_unique(where={"id": member.userId})
        if removed_user and removed_user.email:
            await email_svc.send_member_removed_email(
                email=removed_user.email,
                name=removed_user.fullName or "User",
                org_name=org.name,
            )
    except Exception as e:
        logger.error(f"Operation failed: {e}")

    return {"success": True, "message": "Member removed"}


@router.put("/organizations/{org_id}/members/{member_id}")
async def update_member_role(
    org_id: int,
    member_id: int,
    data: MemberUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update a member's role (Owner only)"""
    org = await get_org_with_permission(org_id, current_user.id, required_role="OWNER")

    member = await prisma.organizationmember.find_unique(where={"id": member_id})
    if not member or member.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Member not found")

    old_role = member.role or "MEMBER"
    await prisma.organizationmember.update(
        where={"id": member_id}, data={"role": data.role}
    )

    # Send role changed email and in-app notification
    try:
        org = await prisma.organization.find_unique(where={"id": org_id})
        org_name = org.name if org else "Organization"
        affected_user = await prisma.user.find_unique(where={"id": member.userId})
        new_role_str = (
            data.role.value if hasattr(data.role, "value") else str(data.role)
        )

        if affected_user and affected_user.email:
            await email_svc.send_role_changed_email(
                email=affected_user.email,
                name=affected_user.fullName or "User",
                org_name=org_name,
                old_role=old_role,
                new_role=new_role_str,
            )

        from app.services.notification_service import NotificationService
        from app.schemas.notifications import (
            NotificationCreate,
            NotificationCategory,
            NotificationPriority,
            NotificationPayload,
        )

        await NotificationService.create_notification(
            NotificationCreate(
                user_id=member.userId,
                type="organization_role_changed",
                title="Organization Role Updated",
                body=f"Your role in {org_name} has been updated to {new_role_str}.",
                category=NotificationCategory.SYSTEM,
                priority=NotificationPriority.NORMAL,
                payload=NotificationPayload(
                    entity_type="organization",
                    entity_id=str(org_id),
                    action_url="/settings/organization",
                    metadata={
                        "org_id": org_id,
                        "org_name": org_name,
                        "new_role": new_role_str,
                    },
                ),
            )
        )
    except Exception as e:
        logger.error(f"Failed to send role changed notification: {e}")

    return {"success": True, "message": "Role updated"}


# =========================================================================
# Enterprise KYB & Compliance Endpoints
# =========================================================================


@router.get("/organizations/{org_id}/kyb", response_model=OrganizationKybResponse)
async def get_organization_kyb(
    org_id: int, current_user: dict = Depends(get_current_user)
):
    """Retrieve corporate KYB profile and document verification status."""
    await get_org_with_permission(org_id, current_user.id, required_role="MEMBER")
    kyb = await KybService.get_or_create_kyb(organization_id=org_id)
    return kyb


@router.post("/organizations/{org_id}/kyb", response_model=OrganizationKybResponse)
async def submit_organization_kyb(
    org_id: int,
    data: OrganizationKybCreate,
    current_user: dict = Depends(get_current_user),
):
    """Submit corporate registration and tax details for KYB verification."""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    kyb = await KybService.get_or_create_kyb(organization_id=org_id, data=data.dict())
    return kyb


@router.get("/organizations/{org_id}/kyb/documents/{doc_id}/ephemeral-url")
async def get_document_ephemeral_url(
    org_id: int,
    doc_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Generate 15-minute ephemeral signed URL with compliance audit logging."""
    await get_org_with_permission(org_id, current_user.id, required_role="MEMBER")
    return await KybService.generate_ephemeral_document_url(
        document_id=doc_id,
        viewer_id=current_user.id,
        organization_id=org_id,
    )


@router.post("/admin/kyb/{id}/review", response_model=OrganizationKybReviewResponse)
@router.post(
    "/organizations/{id}/kyb/review", response_model=OrganizationKybReviewResponse
)
async def review_organization_kyb_admin(
    id: int,
    data: OrganizationKybReviewRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Admin review endpoint for corporate KYB verification.
    Wired with Maker-Checker (Two-Person Integrity) governance:
    - If actionId is supplied: Checker approves and executes the pending maker-checker action,
      strictly enforcing separation of duties (maker != checker).
    - If requestDualApproval is requested: Maker creates a pending dual-authorization request.
    - Otherwise: Executes review directly if the user has appropriate administrative role.
    """
    user_id = getattr(current_user, "id", None) or (
        current_user.get("id") if isinstance(current_user, dict) else 0
    )
    user_role = getattr(current_user, "role", None) or (
        current_user.get("role") if isinstance(current_user, dict) else None
    )

    # Verify admin or staff privileges
    if user_role not in ("ADMIN", "SUPER_ADMIN", "INSTRUCTOR"):
        admin_profile = await prisma.adminprofile.find_unique(where={"userId": user_id})
        if not admin_profile:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required to review corporate KYB dossiers",
            )

    # Resolve KYB record by kyb.id or organizationId
    kyb = await prisma.organizationkyb.find_unique(
        where={"id": id},
        include={"documents": True, "verificationLogs": True},
    )
    if not kyb:
        kyb = await prisma.organizationkyb.find_unique(
            where={"organizationId": id},
            include={"documents": True, "verificationLogs": True},
        )
    if not kyb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Corporate KYB record {id} not found",
        )

    # 1. Checker executing dual approval on pending maker action
    if data.actionId:
        execution_result = await MakerCheckerService.approve_and_execute(
            action_id=data.actionId,
            approver_id=user_id,
            approval_notes=data.notes or data.reason,
        )
        updated_kyb = await prisma.organizationkyb.find_unique(
            where={"id": kyb.id},
            include={"documents": True, "verificationLogs": True},
        )
        return OrganizationKybReviewResponse(
            success=True,
            requires_approval=False,
            message="kyb_approved_via_dual_authorization",
            kyb=updated_kyb,
            executionResult=execution_result,
        )

    # 2. Maker creating a pending action for dual approval
    if data.requestDualApproval:
        pending_action = await MakerCheckerService.create_kyb_approval_request(
            maker_id=user_id,
            kyb_id=kyb.id,
            organization_id=kyb.organizationId,
            decision=data.decision,
            reason=data.reason,
            notes=data.notes,
        )
        return OrganizationKybReviewResponse(
            success=True,
            requires_approval=True,
            message="kyb_review_requires_dual_approval",
            pendingAction=pending_action,
        )

    # 3. Direct review execution
    updated_kyb = await KybService.review_kyb_submission(
        kyb_id=kyb.id,
        admin_id=user_id,
        new_status=data.decision,
        reason=data.reason,
    )
    return OrganizationKybReviewResponse(
        success=True,
        requires_approval=False,
        message="kyb_review_completed",
        kyb=updated_kyb,
    )


# =========================================================================
# Departments & Branches Endpoints
# =========================================================================


@router.get(
    "/organizations/{org_id}/departments", response_model=List[DepartmentResponse]
)
async def list_departments(org_id: int, current_user: dict = Depends(get_current_user)):
    """List all corporate departments and cost centers."""
    await get_org_with_permission(org_id, current_user.id, required_role="MEMBER")
    depts = await prisma.department.find_many(
        where={"organizationId": org_id, "deletedAt": None},
        order={"name": "asc"},
    )
    return depts


@router.post("/organizations/{org_id}/departments", response_model=DepartmentResponse)
async def create_department(
    org_id: int,
    data: DepartmentCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new department or cost center."""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    slug = data.slug or data.name.lower().replace(" ", "-")[:40]
    slug = "".join(c for c in slug if c.isalnum() or c in "-") or "dept"

    # ensure unique slug within org
    base_slug = slug
    counter = 1
    while await prisma.department.find_first(
        where={"organizationId": org_id, "slug": slug}
    ):
        slug = f"{base_slug}-{counter}"
        counter += 1

    dept = await prisma.department.create(
        data={
            "organizationId": org_id,
            "name": data.name,
            "slug": slug,
            "code": data.code,
            "description": data.description,
        }
    )
    return dept


@router.delete("/organizations/{org_id}/departments/{dept_id}")
async def delete_department(
    org_id: int,
    dept_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Soft delete a department."""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    await prisma.department.update(
        where={"id": dept_id},
        data={"deletedAt": datetime.now(timezone.utc)},
    )
    return {"success": True, "message": "Department deleted"}


@router.get("/organizations/{org_id}/branches", response_model=List[BranchResponse])
async def list_branches(org_id: int, current_user: dict = Depends(get_current_user)):
    """List physical branches across Algeria's 58 wilayas."""
    await get_org_with_permission(org_id, current_user.id, required_role="MEMBER")
    branches = await prisma.branch.find_many(
        where={"organizationId": org_id},
        order={"wilayaCode": "asc"},
    )
    return branches


@router.post("/organizations/{org_id}/branches", response_model=BranchResponse)
async def create_branch(
    org_id: int,
    data: BranchCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a regional or wilaya branch."""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    branch = await prisma.branch.create(
        data={
            "organizationId": org_id,
            "name": data.name,
            "code": data.code,
            "wilayaCode": data.wilayaCode,
            "city": data.city,
            "address": data.address,
            "phoneNumber": data.phoneNumber,
            "isHeadquarters": data.isHeadquarters,
        }
    )
    return branch


@router.delete("/organizations/{org_id}/branches/{branch_id}")
async def delete_branch(
    org_id: int,
    branch_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Remove a branch."""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    await prisma.branch.delete(where={"id": branch_id})
    return {"success": True, "message": "Branch deleted"}


# =========================================================================
# EdTech: Corporate Multi-Seat License Pools
# =========================================================================


@router.get(
    "/organizations/{org_id}/edtech/pools", response_model=List[TeamLicensePoolResponse]
)
async def list_team_license_pools(
    org_id: int, current_user: dict = Depends(get_current_user)
):
    """List all corporate EdTech license pools and allocated seats."""
    await get_org_with_permission(org_id, current_user.id, required_role="MEMBER")
    pools = await prisma.teamlicensepool.find_many(
        where={"organizationId": org_id},
        include={"allocations": {"include": {"user": True}}},
        order={"createdAt": "desc"},
    )
    return pools


@router.post(
    "/organizations/{org_id}/edtech/pools", response_model=TeamLicensePoolResponse
)
async def create_team_license_pool(
    org_id: int,
    data: TeamLicensePoolCreate,
    current_user: dict = Depends(get_current_user),
):
    """Provision a corporate multi-seat training license pool."""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    pool = await prisma.teamlicensepool.create(
        data={
            "organizationId": org_id,
            "moduleId": data.moduleId,
            "pathId": data.pathId,
            "totalSeats": data.totalSeats,
            "allocatedSeats": 0,
            "expiresAt": data.expiresAt,
        },
        include={"allocations": True},
    )
    return pool


@router.post(
    "/organizations/{org_id}/edtech/pools/{pool_id}/allocate",
    response_model=SeatAllocationResponse,
)
async def allocate_seat_to_employee(
    org_id: int,
    pool_id: int,
    data: SeatAllocateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Allocate an EdTech license seat to an employee by email."""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    pool = await prisma.teamlicensepool.find_unique(where={"id": pool_id})
    if not pool or pool.organizationId != org_id:
        raise HTTPException(status_code=404, detail="License pool not found")

    if pool.allocatedSeats >= pool.totalSeats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="License pool is exhausted. No remaining seats.",
        )

    employee = await prisma.user.find_unique(where={"email": data.email})
    if not employee:
        raise HTTPException(
            status_code=404, detail=f"User with email {data.email} not found"
        )

    # Check if already allocated
    existing = await prisma.seatallocation.find_first(
        where={"poolId": pool_id, "userId": employee.id}
    )
    if existing and existing.revokedAt is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee already has an active seat in this pool.",
        )

    async with prisma.tx() as tx:
        if existing:
            allocation = await tx.seatallocation.update(
                where={"id": existing.id},
                data={"revokedAt": None, "assignedAt": datetime.now(timezone.utc)},
                include={"user": True},
            )
        else:
            allocation = await tx.seatallocation.create(
                data={"poolId": pool_id, "userId": employee.id},
                include={"user": True},
            )
        await tx.teamlicensepool.update(
            where={"id": pool_id},
            data={"allocatedSeats": pool.allocatedSeats + 1},
        )

    return allocation


@router.delete("/organizations/{org_id}/edtech/pools/{pool_id}/allocate/{user_id}")
async def revoke_employee_seat(
    org_id: int,
    pool_id: int,
    user_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Revoke an allocated seat from an employee, returning it to the pool."""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    pool = await prisma.teamlicensepool.find_unique(where={"id": pool_id})
    if not pool or pool.organizationId != org_id:
        raise HTTPException(status_code=404, detail="License pool not found")

    allocation = await prisma.seatallocation.find_first(
        where={"poolId": pool_id, "userId": user_id, "revokedAt": None}
    )
    if not allocation:
        raise HTTPException(status_code=404, detail="Active allocation not found")

    async with prisma.tx() as tx:
        await tx.seatallocation.update(
            where={"id": allocation.id},
            data={"revokedAt": datetime.now(timezone.utc)},
        )
        new_allocated = max(0, pool.allocatedSeats - 1)
        await tx.teamlicensepool.update(
            where={"id": pool_id},
            data={"allocatedSeats": new_allocated},
        )

    return {"success": True, "message": "Seat revoked successfully"}


@router.get("/organizations/{org_id}/lms/analytics")
async def get_corporate_lms_analytics(
    org_id: int, current_user: dict = Depends(get_current_user)
):
    """Aggregate corporate L&D / LMS completion and skill readiness analytics."""
    await get_org_with_permission(org_id, current_user.id, required_role="MEMBER")
    pools = await prisma.teamlicensepool.find_many(
        where={"organizationId": org_id},
        include={"allocations": True},
    )
    total_seats = sum(p.totalSeats for p in pools)
    allocated_seats = sum(p.allocatedSeats for p in pools)
    active_user_ids = list(
        {
            alloc.userId
            for p in pools
            for alloc in (p.allocations or [])
            if alloc.revokedAt is None
        }
    )

    completed_enrollments = 0
    total_enrollments = 0
    if active_user_ids:
        enrollments = await prisma.enrollment.find_many(
            where={"userId": {"in": active_user_ids}}
        )
        total_enrollments = len(enrollments)
        completed_enrollments = sum(
            1
            for e in enrollments
            if getattr(e, "completedAt", None) is not None
            or getattr(e, "progress", 0) >= 100
        )

    completion_rate = (
        round((completed_enrollments / total_enrollments) * 100.0, 1)
        if total_enrollments > 0
        else 0.0
    )

    return {
        "organizationId": org_id,
        "totalPools": len(pools),
        "totalSeats": total_seats,
        "allocatedSeats": allocated_seats,
        "utilizationRate": (
            round((allocated_seats / total_seats) * 100.0, 1)
            if total_seats > 0
            else 0.0
        ),
        "activeLearners": len(active_user_ids),
        "totalEnrollments": total_enrollments,
        "completedEnrollments": completed_enrollments,
        "completionRatePercent": completion_rate,
    }


@router.get("/organizations/{org_id}/audit-logs")
async def get_organization_audit_logs(
    org_id: int,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    """Retrieve immutable compliance and operational audit logs (ANPDP Law 18-07)."""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    bi_logs = await prisma.biauditlog.find_many(
        where={"organizationId": org_id},
        take=min(limit, 100),
        order={"createdAt": "desc"},
        include={"user": True},
    )
    return {
        "organizationId": org_id,
        "count": len(bi_logs),
        "logs": bi_logs,
    }


@router.get("/organizations/{org_id}/treasury")
async def get_organization_treasury(
    org_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Get corporate treasury balances, escrow holds, and fiscal exemption status."""
    await get_org_with_permission(org_id, current_user.id, required_role="MEMBER")
    from app.services.wallet_service import wallet_service

    wallet = await wallet_service.get_organization_wallet(org_id)
    if not wallet:
        try:
            wallet = await wallet_service.create_organization_wallet(org_id)
        except Exception:
            wallet = None

    # Compute escrow from active contract milestones
    escrow_aggr = await prisma.contractmilestone.aggregate(
        where={
            "contract": {"organizationId": org_id},
            "status": "ESCROW_LOCKED",
        },
        sum={"amount": True},
    )
    in_escrow = float(escrow_aggr.get("sum", {}).get("amount", 0.0) or 0.0)

    # Compute pending clearance invoices
    pending_aggr = await prisma.invoice.aggregate(
        where={
            "organizationId": org_id,
            "status": "PENDING",
        },
        sum={"amount": True},
    )
    pending_clearance = float(pending_aggr.get("sum", {}).get("amount", 0.0) or 0.0)

    available_balance = float(wallet.podaPoints if wallet else 0.0)

    return {
        "organizationId": org_id,
        "walletId": wallet.id if wallet else None,
        "availableBalanceDzd": available_balance,
        "inEscrowDzd": in_escrow,
        "pendingClearanceDzd": pending_clearance,
        "currency": "DZD",
        "timbreFiscalExempt": True,
        "timbreFiscalClause": "Exonéré de droit de timbre fiscal (Art. 34 LF 2024 / Règlement SATIM Monétique)",
    }


@router.post("/organizations/{org_id}/proforma")
async def generate_organization_proforma(
    org_id: int,
    data: ProformaGenerateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate Facture Proforma with RIP and Article 169 & 224 CIDTA fiscal tax shield."""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    from app.services.proforma_service import ProformaService

    items_dicts = [item.dict() for item in data.items]
    return await ProformaService.generate_proforma(
        organization_id=org_id,
        requester_id=current_user.id,
        items=items_dicts,
        notes=data.notes,
        article_169_eligible=data.article169Eligible,
    )


@router.get("/organizations/{org_id}/invoices")
async def list_organization_invoices(
    org_id: int,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    """List certified invoices and triple document kits for this organization."""
    await get_org_with_permission(org_id, current_user.id, required_role="MEMBER")
    invoices = await prisma.invoice.find_many(
        where={"organizationId": org_id},
        include={"items": True},
        order={"issuedAt": "desc"},
        take=limit,
        skip=offset,
    )
    return {"invoices": invoices, "count": len(invoices)}


# =========================================================================
# KYB Optical QR Code Scanner & Document Upload Endpoints
# =========================================================================


@router.post(
    "/organizations/{org_id}/kyb/documents", response_model=CorporateDocumentResponse
)
async def upload_kyb_corporate_document(
    org_id: int,
    document_type: str = Form("CNRC_EXTRAIT_RC"),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a corporate KYB document (Extrait CNRC, NIF, Statuts) and trigger optical QR scanning."""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    kyb = await KybService.get_or_create_kyb(organization_id=org_id)
    file_bytes = await file.read()
    doc = await KybService.add_document(
        kyb_id=kyb.id,
        document_type=document_type,
        file_name=file.filename or "document.pdf",
        file_bytes=file_bytes,
        mime_type=file.content_type or "application/pdf",
        enqueue_qr_scan=True,
    )
    return doc


@router.post("/organizations/{org_id}/kyb/documents/{doc_id}/scan-qr")
async def trigger_document_qr_scan(
    org_id: int,
    doc_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Manually trigger or re-verify optical QR code scanning on a KYB corporate document."""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    return await KybService.scan_and_verify_document_qr(document_id=doc_id)


# =========================================================================
# Corporate Escrow Maker-Checker + Hardware WebAuthn Step-Up (>100,000 DZD)
# =========================================================================


@router.post("/organizations/{org_id}/escrow/release-request")
async def request_corporate_escrow_release(
    org_id: int,
    data: EscrowReleaseRequestCreate,
    current_user: dict = Depends(get_current_user),
):
    """Maker (Project Lead / Hiring Manager) requests milestone escrow release."""
    await get_org_with_permission(org_id, current_user.id, required_role="MEMBER")
    return await MakerCheckerService.create_corporate_escrow_release_request(
        maker_id=current_user.id,
        organization_id=org_id,
        contract_id=data.contractId,
        milestone_id=data.milestoneId,
        amount_dzd=data.amountDzd,
        notes=data.notes,
    )


@router.post("/organizations/{org_id}/escrow/{action_id}/approve")
async def approve_corporate_escrow_release(
    org_id: int,
    action_id: str,
    data: EscrowApproveRequest,
    x_webauthn_step_up: Optional[str] = Header(None, alias="X-WebAuthn-Step-Up"),
    x_step_up_token: Optional[str] = Header(None, alias="X-Step-Up-Token"),
    current_user: dict = Depends(get_current_user),
):
    """
    Checker (DAF / Admin / Owner) approves and executes milestone escrow release.
    Enforces Two-Person Integrity (Maker != Checker) and Hardware WebAuthn Step-Up for > 100,000 DZD.
    """
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    is_webauthn = False

    # 1. Cryptographically verify signed RFC 9470 Step-Up JWT
    candidate_token = (
        x_step_up_token
        or (
            x_webauthn_step_up
            if (
                x_webauthn_step_up
                and len(x_webauthn_step_up) > 30
                and "." in x_webauthn_step_up
            )
            else None
        )
        or data.stepUpToken
    )
    if candidate_token:
        from app.core.security import verify_step_up_token

        is_webauthn = verify_step_up_token(
            candidate_token,
            expected_user_id=current_user.id,
            required_method="webauthn",
        )

    # 2. Or verify digital WebAuthn assertion signature directly
    if not is_webauthn and data.assertionResponse:
        from app.services.webauthn_service import webauthn_service

        verified = await webauthn_service.verify_authentication(
            current_user.id, data.assertionResponse
        )
        if verified:
            is_webauthn = True

    return await MakerCheckerService.approve_and_execute(
        action_id=action_id,
        approver_id=current_user.id,
        approval_notes=data.approvalNotes,
        auth_method="webauthn" if is_webauthn else data.authMethod,
        webauthn_verified=is_webauthn,
    )


# =========================================================================
# Discrete Relational Models: Case Studies, Leadership, 2-Sided Reviews
# =========================================================================


@router.get(
    "/organizations/{org_id}/case-studies",
    response_model=List[CompanyCaseStudyResponse],
)
async def list_company_case_studies(org_id: int):
    """List verified B2B case studies and ROI benchmarks for an organization."""
    return await prisma.companycasestudy.find_many(
        where={"organizationId": org_id},
        order={"createdAt": "desc"},
    )


@router.post(
    "/organizations/{org_id}/case-studies",
    response_model=CompanyCaseStudyResponse,
    status_code=201,
)
async def create_company_case_study(
    org_id: int,
    data: CompanyCaseStudyCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a B2B case study with problem-solution-ROI metrics."""
    from app.generated.prisma import Json

    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    base_slug = (data.slug or data.title.lower().replace(" ", "-"))[:60]
    slug = "".join(c for c in base_slug if c.isalnum() or c == "-") or "case-study"
    counter = 1
    candidate = slug
    while await prisma.companycasestudy.find_first(
        where={"organizationId": org_id, "slug": candidate}
    ):
        candidate = f"{slug}-{counter}"
        counter += 1

    study_payload = {
        "organizationId": org_id,
        "title": data.title,
        "slug": candidate,
        "clientName": data.clientName,
        "industry": data.industry,
        "problemStatement": data.problemStatement,
        "solutionSummary": data.solutionSummary,
        "roiMetrics": Json(data.roiMetrics) if data.roiMetrics is not None else None,
        "technologies": data.technologies,
        "isFeatured": data.isFeatured,
        "publishedAt": datetime.now(timezone.utc),
    }
    return await prisma.companycasestudy.create(
        data={k: v for k, v in study_payload.items() if v is not None}
    )


@router.delete("/organizations/{org_id}/case-studies/{study_id}")
async def delete_company_case_study(
    org_id: int,
    study_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Delete a company case study."""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    study = await prisma.companycasestudy.find_unique(where={"id": study_id})
    if not study or study.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Case study not found")
    await prisma.companycasestudy.delete(where={"id": study_id})
    return {"success": True, "message": "Case study deleted"}


@router.get(
    "/organizations/{org_id}/leadership", response_model=List[CompanyLeadershipResponse]
)
async def list_company_leadership(org_id: int):
    """List C-suite and executive leadership roster for an organization."""
    return await prisma.companyleadership.find_many(
        where={"organizationId": org_id},
        order={"displayOrder": "asc"},
    )


@router.post(
    "/organizations/{org_id}/leadership",
    response_model=CompanyLeadershipResponse,
    status_code=201,
)
async def create_company_leadership(
    org_id: int,
    data: CompanyLeadershipCreate,
    current_user: dict = Depends(get_current_user),
):
    """Add an executive or leadership member to the organization profile."""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    return await prisma.companyleadership.create(
        data={
            "organizationId": org_id,
            "fullName": data.fullName,
            "roleTitle": data.roleTitle,
            "bio": data.bio,
            "avatarUrl": data.avatarUrl,
            "linkedinUrl": data.linkedinUrl,
            "displayOrder": data.displayOrder,
            "isExecutive": data.isExecutive,
        }
    )


@router.delete("/organizations/{org_id}/leadership/{leader_id}")
async def delete_company_leadership(
    org_id: int,
    leader_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Remove a leadership entry from the organization profile."""
    await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    leader = await prisma.companyleadership.find_unique(where={"id": leader_id})
    if not leader or leader.organizationId != org_id:
        raise HTTPException(status_code=404, detail="Leadership entry not found")
    await prisma.companyleadership.delete(where={"id": leader_id})
    return {"success": True, "message": "Leadership entry deleted"}


@router.get(
    "/organizations/{org_id}/company-reviews",
    response_model=List[CompanyReviewResponse],
)
async def list_company_reviews(org_id: int):
    """List 2-sided B2B/freelancer reviews for an organization."""
    return await prisma.companyreview.find_many(
        where={"organizationId": org_id},
        order={"createdAt": "desc"},
    )


@router.post(
    "/organizations/{org_id}/company-reviews",
    response_model=CompanyReviewResponse,
    status_code=201,
)
async def create_company_review(
    org_id: int,
    data: CompanyReviewCreate,
    current_user: dict = Depends(get_current_user),
):
    """Submit a 2-sided review (payment promptness, scope clarity, communication) for an organization."""
    org = await prisma.organization.find_unique(where={"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if org.ownerId == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Organization owners cannot review their own organization",
        )

    is_verified = False
    if data.contractId:
        contract = await prisma.contract.find_unique(where={"id": data.contractId})
        if contract and (
            contract.freelancerId == current_user.id
            or contract.clientId == current_user.id
        ):
            is_verified = True

    return await prisma.companyreview.create(
        data={
            "organizationId": org_id,
            "reviewerId": current_user.id,
            "contractId": data.contractId,
            "reviewerType": data.reviewerType,
            "overallRating": data.overallRating,
            "paymentPromptnessRating": data.paymentPromptnessRating,
            "scopeClarityRating": data.scopeClarityRating,
            "communicationRating": data.communicationRating,
            "title": data.title,
            "comment": data.comment,
            "isVerifiedContract": is_verified,
        }
    )


# =========================================================================
# Enterprise SSO & Domain Claiming Configuration
# =========================================================================


@router.get(
    "/organizations/{org_id}/sso/config", response_model=SsoDomainConfigResponse
)
async def get_organization_sso_config(
    org_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Retrieve SAML 2.0 SSO and SCIM 2.0 directory sync configuration for an organization."""
    org = await get_org_with_permission(org_id, current_user.id, required_role="ADMIN")
    return SsoDomainConfigResponse(
        organizationId=org.id,
        verifiedDomains=getattr(org, "verifiedDomains", None) or [],
        samlEntityId=getattr(org, "samlEntityId", None),
        samlMetadataUrl=getattr(org, "samlMetadataUrl", None),
        scimEnabled=bool(getattr(org, "scimEnabled", False)),
    )


@router.put(
    "/organizations/{org_id}/sso/config", response_model=SsoDomainConfigResponse
)
async def update_organization_sso_config(
    org_id: int,
    data: SsoDomainConfigUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update SAML 2.0 SSO, verified corporate domains, and SCIM 2.0 provisioning state."""
    await get_org_with_permission(org_id, current_user.id, required_role="OWNER")
    update_payload = {}
    if data.verifiedDomains is not None:
        update_payload["verifiedDomains"] = [
            d.strip().lower() for d in data.verifiedDomains if d.strip()
        ]
    if data.samlEntityId is not None:
        update_payload["samlEntityId"] = data.samlEntityId
    if data.samlMetadataUrl is not None:
        update_payload["samlMetadataUrl"] = data.samlMetadataUrl
    if data.scimEnabled is not None:
        update_payload["scimEnabled"] = data.scimEnabled

    updated = await prisma.organization.update(
        where={"id": org_id},
        data=update_payload,
    )
    return SsoDomainConfigResponse(
        organizationId=updated.id,
        verifiedDomains=getattr(updated, "verifiedDomains", None) or [],
        samlEntityId=getattr(updated, "samlEntityId", None),
        samlMetadataUrl=getattr(updated, "samlMetadataUrl", None),
        scimEnabled=bool(getattr(updated, "scimEnabled", False)),
    )
