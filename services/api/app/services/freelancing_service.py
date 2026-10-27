import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import json
import asyncio
from functools import lru_cache
import time

from app.core.prisma import prisma
from app.core.config import setting
from app.core.background import run_background
from app.generated.prisma import Json
from app.services.category_definitions import CATEGORY_KEYWORDS
from app.schemas.freelancing import (
    ProjectCreate,
    ProjectUpdate,
    ProposalCreate,
    ContractCreate,
    DeliveryCreate,
    DisputeCreate,
    FreelancerSearch,
    ProjectSearch,
    ProposalStatus,
    ContractStatus,
    PublicProjectSearch,
    PublicFreelancerSearch,
    ReviewCreate,
    ReviewUpdate,
    ReviewResponse,
    AppealCreate,
    AppealResponse,
)
from app.services.notification_service import NotificationService
from app.services.feature_service import feature_service
from app.schemas.notifications import (
    NotificationCreate,
    NotificationCategory,
    NotificationPriority,
)
from app.services.content_moderation_service import (
    moderate_text,
    mask_disintermediation,
)
from app.services.reputation_service import reputation_service, UserTrustProfile

logger = logging.getLogger(__name__)

# ======================
# OPTIMIZATION: SIMPLE CACHE IMPLEMENTATION
# ======================


class SimpleCache:
    """Simple in-memory cache with TTL and maxsize LRU eviction support"""

    def __init__(self, ttl: int = 300, maxsize: int = 500):
        self.cache = {}
        self.ttl = ttl
        self.maxsize = maxsize

    def get(self, key: str):
        """Get value from cache if not expired"""
        if key in self.cache:
            value, timestamp = self.cache[key]
            if time.time() - timestamp < self.ttl:
                return value
            else:
                del self.cache[key]
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set value in cache with TTL and maxsize eviction"""
        now = time.time()
        effective_ttl = ttl or self.ttl
        if len(self.cache) >= self.maxsize:
            # Purge expired items first
            expired = [
                k for k, (v, ts) in self.cache.items() if now - ts >= effective_ttl
            ]
            if expired:
                for k in expired:
                    self.cache.pop(k, None)
            else:
                # Evict oldest 20% if maxsize reached
                sorted_keys = sorted(self.cache.keys(), key=lambda k: self.cache[k][1])
                for k in sorted_keys[: max(1, self.maxsize // 5)]:
                    self.cache.pop(k, None)
        self.cache[key] = (value, now)

    def delete(self, key: str):
        """Delete key from cache"""
        if key in self.cache:
            del self.cache[key]

    def delete_pattern(self, pattern: str):
        """Delete keys matching pattern"""
        keys_to_delete = [k for k in self.cache.keys() if pattern in k]
        for key in keys_to_delete:
            del self.cache[key]

    def clear(self):
        """Clear all cache"""
        self.cache.clear()


# Global cache instance
cache = SimpleCache(ttl=300, maxsize=500)

# ======================
# FREELANCE SERVICE WITH OPTIMIZATIONS
# ======================


class FreelanceService:
    # ======================
    # OPTIMIZED HELPER METHODS
    # ======================

    @staticmethod
    @lru_cache(maxsize=1000)
    def _can_user_act_as_freelancer_cached(role: str) -> bool:
        """Cached check if role can act as freelancer"""
        return role in {"FREELANCER", "INSTRUCTOR", "ADMIN", "STUDENT"}

    @staticmethod
    @lru_cache(maxsize=1000)
    def _can_user_act_as_client_cached(role: str) -> bool:
        """Cached check if role can act as client"""
        return role in {"BUSINESS", "FREELANCER", "INSTRUCTOR", "ADMIN", "STUDENT"}

    @staticmethod
    async def _check_user_role_batch(user_ids: List[int]) -> Dict[int, str]:
        """Batch check user roles - reduces database queries"""
        if not user_ids:
            return {}

        cache_key = f"user_roles_batch:{hash(tuple(sorted(user_ids)))}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        users = await prisma.user.find_many(where={"id": {"in": user_ids}})
        result = {user.id: user.role for user in users}
        cache.set(cache_key, result)
        return result

    @staticmethod
    async def _can_act_as_client(user_id: int) -> bool:
        """Optimized check if user can act as client"""
        cache_key = f"can_act_client:{user_id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        role_dict = await FreelanceService._check_user_role_batch([user_id])
        if user_id not in role_dict:
            cache.set(cache_key, False)
            return False

        can_act = FreelanceService._can_user_act_as_client_cached(role_dict[user_id])
        cache.set(cache_key, can_act)
        return can_act

    @staticmethod
    async def _can_act_as_freelancer(user_id: int) -> bool:
        """Optimized check if user can act as freelancer"""
        cache_key = f"can_act_freelancer:{user_id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        role_dict = await FreelanceService._check_user_role_batch([user_id])
        if user_id not in role_dict:
            cache.set(cache_key, False)
            return False

        can_act = FreelanceService._can_user_act_as_freelancer_cached(
            role_dict[user_id]
        )
        cache.set(cache_key, can_act)
        return can_act

    @staticmethod
    async def _send_notification(
        user_id: int,
        type: str,
        title: str,
        body: str,
        data: Optional[Dict] = None,
        variables: Optional[Dict[str, str]] = None,
        actions: Optional[List[Dict[str, Any]]] = None,
    ):
        """Send notification - optimized to run asynchronously"""
        try:
            notification = NotificationCreate(
                user_id=user_id,
                type=type,
                title=title,
                body=body,
                data=data or {},
                variables=variables,
                actions=actions,
                category=NotificationCategory.PROJECT,
                priority=NotificationPriority.NORMAL,
            )
            run_background(
                NotificationService.create_notification(notification),
                name=f"notify_{type}_{user_id}",
            )
        except Exception:
            logger.exception("Failed to send notification")

    @staticmethod
    async def _send_notifications_batch(notifications: List[Dict[str, Any]]):
        """Send multiple notifications in batch"""
        tasks = []
        for notif_data in notifications:
            notification = NotificationCreate(
                user_id=notif_data["user_id"],
                type=notif_data["type"],
                title=notif_data["title"],
                body=notif_data["body"],
                data=notif_data.get("data", {}),
                category=notif_data.get("category", NotificationCategory.PROJECT),
                priority=notif_data.get("priority", NotificationPriority.NORMAL),
            )
            tasks.append(NotificationService.create_notification(notification))

        # Run all notifications concurrently
        await asyncio.gather(*tasks, return_exceptions=True)

    @staticmethod
    async def _get_users_with_trust_indicators_batch(
        user_ids: List[int],
    ) -> Dict[int, Dict[str, Any]]:
        """Get multiple users with trust indicators in a single batch query"""
        if not user_ids:
            return {}

        cache_key = f"users_trust_batch:{hash(tuple(sorted(user_ids)))}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        # Get users with their certificates and completed contracts
        users = await prisma.user.find_many(
            where={"id": {"in": user_ids}},
            include={
                "certificates": True,
                "contractsAsFreelancer": {"where": {"status": "COMPLETED"}},
            },
        )

        result = {}
        for user in users:
            result[user.id] = {
                "id": user.id,
                "full_name": user.fullName,
                "bio": user.bio,
                "profile_picture_url": user.profilePictureUrl,
                "skills": user.skills,
                "city": user.city,
                "country": user.country,
                "phone_verified": user.phoneVerified,
                "role": user.role,
                "certificates_count": len(user.certificates),
                "completed_projects": len(user.contractsAsFreelancer),
            }

        cache.set(cache_key, result, ttl=300)
        return result

    @staticmethod
    def _format_contract_response(
        contract,
        include_project=True,
        include_freelancer=True,
        include_client=True,
        include_deliveries=True,
    ):
        return {
            "id": contract.id,
            "projectId": contract.projectId,
            "freelancerId": contract.freelancerId,
            "clientId": contract.clientId,
            "terms": contract.terms,
            "amount": contract.amount,
            "startDate": contract.startDate,
            "endDate": contract.endDate,
            "status": contract.status,
            "createdAt": contract.createdAt,
            "project": None,
            "freelancer": None,
            "client": None,
            "deliveries": None,
        }

    # ======================
    # OPTIMIZED PROJECT METHODS
    # ======================

    @staticmethod
    async def list_projects(
        search_params: ProjectSearch, user_id: int
    ) -> Dict[str, Any]:
        """List projects with filtering - OPTIMIZED with batch queries"""
        try:
            # Create cache key from search parameters
            cache_key = f"projects:user:{user_id}:skip:{search_params.skip}:limit:{search_params.limit}:status:{search_params.status}:search:{search_params.search}:skills:{','.join(search_params.skills) if search_params.skills else 'none'}"
            cached = cache.get(cache_key)
            if cached:
                return cached

            # Build optimized where conditions
            where_conditions = {}

            if search_params.status:
                where_conditions["status"] = search_params.status.value
            else:
                where_conditions["status"] = "OPEN"

            if search_params.search:
                where_conditions["OR"] = [
                    {
                        "title": {
                            "contains": search_params.search,
                            "mode": "insensitive",
                        }
                    },
                    {
                        "description": {
                            "contains": search_params.search,
                            "mode": "insensitive",
                        }
                    },
                ]

            if search_params.skills:
                where_conditions["skills"] = {
                    "has_some": search_params.skills[:10]
                }  # Limit to 10 skills

            # Get projects without owner include (lightweight query)
            # Ranking: featured boost desc → expiring soonest → recency
            projects_results = await asyncio.gather(
                prisma.project.find_many(
                    where=where_conditions,
                    skip=search_params.skip,
                    take=search_params.limit,
                    order=[
                        {"featuredBoost": "desc"},
                        {"featureExpiresAt": {"sort": "asc", "nulls": "last"}},
                        {"createdAt": "desc"},
                    ],
                ),
                prisma.project.count(where=where_conditions),
            )

            projects = projects_results[0]
            total = projects_results[1]

            if not projects:
                result = {
                    "projects": [],
                    "total": total,
                    "skip": search_params.skip,
                    "limit": search_params.limit,
                }
                cache.set(cache_key, result, ttl=60)
                return result

            # Batch queries for owner and proposal data
            project_ids = [project.id for project in projects]
            owner_ids = list(set([project.ownerId for project in projects]))

            owner_dict, user_proposals_list = await asyncio.gather(
                # Batch query: Get all owners
                prisma.user.find_many(where={"id": {"in": owner_ids}}),
                # Batch query: Get user's proposals for these projects
                prisma.proposal.find_many(
                    where={"projectId": {"in": project_ids}, "freelancerId": user_id}
                ),
            )

            # Index results for O(1) lookup - build map of owner data
            owners_map = {}
            for owner in owner_dict:
                owners_map[owner.id] = {
                    "id": owner.id,
                    "fullName": owner.fullName,
                    "profilePictureUrl": owner.profilePictureUrl,
                    "country": owner.country,
                    "city": owner.city,
                    "phoneVerified": owner.phoneVerified,
                }
            user_proposals = {
                proposal.projectId: True for proposal in user_proposals_list
            }

            # Format response efficiently with pre-fetched data
            formatted_projects = []
            for project in projects:
                owner_info = owners_map.get(project.ownerId)

                formatted_projects.append(
                    {
                        "id": project.id,
                        "title": project.title,
                        "description": project.description,
                        "ownerId": project.ownerId,
                        "skills": project.skills,
                        "status": project.status,
                        "createdAt": project.createdAt,
                        "updatedAt": project.updatedAt,
                        "owner": owner_info,
                        "has_applied": project.id in user_proposals,
                        "is_owner": project.ownerId == user_id,
                        "featured": project.featured,
                        "featuredBoost": project.featuredBoost,
                        "featureExpiresAt": project.featureExpiresAt.isoformat()
                        if project.featureExpiresAt
                        else None,
                    }
                )

            result = {
                "projects": formatted_projects,
                "total": total,
                "skip": search_params.skip,
                "limit": search_params.limit,
            }

            # Cache for 60 seconds
            cache.set(cache_key, result, ttl=60)
            return result

        except Exception as e:
            logger.error(f"Error in list_projects: {e}", exc_info=True)
            raise

    @staticmethod
    async def can_manage_project(project: Any, user_id: int) -> bool:
        if getattr(project, "ownerId", None) == user_id:
            return True
        org_id = getattr(project, "organizationId", None)
        if org_id:
            membership = await prisma.organizationmember.find_first(
                where={
                    "organizationId": org_id,
                    "userId": user_id,
                    "deletedAt": None,
                    "role": {"in": ["OWNER", "ADMIN", "HIRING_MANAGER"]},
                }
            )
            if membership is not None:
                return True
            org = await prisma.organization.find_first(
                where={"id": org_id, "deletedAt": None}
            )
            if org and org.ownerId == user_id:
                return True
        return False

    @staticmethod
    async def create_project(
        project_data: ProjectCreate, client_id: int
    ) -> Dict[str, Any]:
        """Create a new project - OPTIMIZED"""
        try:
            # Check if user can act as client
            if not await FreelanceService._can_act_as_client(client_id):
                raise ValueError("Votre type de compte ne peut pas publier de projets")

            await feature_service.consume_project_post(client_id)

            # Resolve corporate organization binding
            org_id = project_data.organizationId
            if org_id:
                from app.core.auth import verify_organization_access

                user = await prisma.user.find_unique(where={"id": client_id})
                await verify_organization_access(org_id, user)

            # Prepare description with budget
            description = project_data.description or ""
            if project_data.budget_range_min or project_data.budget_range_max:
                min_budget = project_data.budget_range_min or 0
                max_budget = project_data.budget_range_max or 0
                budget_text = f"\n\nBudget: {min_budget:,} - {max_budget:,} DA"
                description += budget_text

            clean_title, _ = moderate_text(project_data.title)
            clean_title, _ = mask_disintermediation(clean_title)

            clean_desc, _ = moderate_text(description.strip())
            clean_desc, _ = mask_disintermediation(clean_desc)

            # Create project
            create_data = {
                "title": clean_title,
                "description": clean_desc,
                "skills": project_data.skills[:50],
                "ownerId": client_id,
                "status": "OPEN",
            }
            if org_id:
                create_data["organizationId"] = org_id

            project = await prisma.project.create(data=create_data)

            # Clear relevant cache entries
            cache.delete_pattern("projects:")
            cache.delete_pattern(f"user:{client_id}:")

            # Get owner info for response
            owner_info_data = await prisma.user.find_unique(where={"id": client_id})
            owner_info = None
            if owner_info_data:
                owner_info = {
                    "id": owner_info_data.id,
                    "fullName": owner_info_data.fullName,
                    "profilePictureUrl": owner_info_data.profilePictureUrl,
                    "country": owner_info_data.country,
                    "city": owner_info_data.city,
                    "phoneVerified": owner_info_data.phoneVerified,
                }

            return {
                "id": project.id,
                "title": project.title,
                "description": project.description,
                "ownerId": project.ownerId,
                "skills": project.skills,
                "status": project.status,
                "createdAt": project.createdAt,
                "updatedAt": project.updatedAt,
                "owner": owner_info,
                "has_applied": False,
                "is_owner": True,
            }

        except Exception as e:
            logger.error(f"Error in create_project: {str(e)}", exc_info=True)
            raise

    @staticmethod
    async def get_project(project_id: int, user_id: int) -> Dict[str, Any]:
        """Get project details - OPTIMIZED"""
        try:
            cache_key = f"project:{project_id}:user:{user_id}"
            cached = cache.get(cache_key)
            if cached:
                return cached

            # Single optimized query with all needed data
            project_data = await prisma.project.find_unique(
                where={"id": project_id},
                include={
                    "owner": True,
                    "proposals": {"where": {"freelancerId": user_id}},
                },
            )

            if not project_data:
                raise ValueError("Projet non trouvé")

            owner_info = None
            if project_data.owner:
                owner_info = {
                    "id": project_data.owner.id,
                    "fullName": project_data.owner.fullName,
                    "profilePictureUrl": project_data.owner.profilePictureUrl,
                    "phoneVerified": project_data.owner.phoneVerified,
                    "country": project_data.owner.country,
                    "city": project_data.owner.city,
                }

            result = {
                "id": project_data.id,
                "title": project_data.title,
                "description": project_data.description,
                "ownerId": project_data.ownerId,
                "skills": project_data.skills,
                "status": project_data.status,
                "createdAt": project_data.createdAt,
                "updatedAt": project_data.updatedAt,
                "owner": owner_info,
                "has_applied": len(project_data.proposals) > 0,
                "is_owner": project_data.ownerId == user_id,
            }

            # Cache for 120 seconds
            cache.set(cache_key, result, ttl=120)
            return result

        except ValueError:
            logger.warning(f"Project not found: {project_id}")
            raise
        except Exception as e:
            logger.error(f"Error in get_project: {e}", exc_info=True)
            raise

    @staticmethod
    async def update_project(
        project_id: int, project_data: ProjectUpdate, user_id: int
    ) -> Dict[str, Any]:
        """Update project - OPTIMIZED"""
        try:
            # Verify project exists and user is owner
            project = await prisma.project.find_unique(where={"id": project_id})

            if not project:
                raise ValueError("Projet non trouvé")

            if not await FreelanceService.can_manage_project(project, user_id):
                raise ValueError("Vous n'êtes pas le propriétaire de ce projet")

            # Build update data
            update_data = {}
            if project_data.title is not None:
                update_data["title"] = project_data.title
            if project_data.description is not None:
                update_data["description"] = project_data.description
            if project_data.skills is not None:
                update_data["skills"] = project_data.skills[:50]  # Limit skills
            if project_data.status is not None:
                update_data["status"] = project_data.status.value

            # Update project
            updated_project = await prisma.project.update(
                where={"id": project_id}, data=update_data
            )

            # Clear cache
            cache.delete_pattern(f"project:{project_id}:")
            cache.delete_pattern("projects:")
            cache.delete_pattern(f"user:{user_id}:")

            return {
                "id": updated_project.id,
                "title": updated_project.title,
                "description": updated_project.description,
                "ownerId": updated_project.ownerId,
                "skills": updated_project.skills,
                "status": updated_project.status,
                "createdAt": updated_project.createdAt,
                "updatedAt": updated_project.updatedAt,
                "owner": None,  # Will be fetched if needed
                "has_applied": False,
                "is_owner": True,
            }

        except Exception as e:
            logger.error(f"Error in update_project: {e}")
            raise

    @staticmethod
    async def get_project_proposals(
        project_id: int,
        user_id: int,
        skip: int = 0,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Get proposals for a project - OPTIMIZED"""
        try:
            cache_key = f"project_proposals:{project_id}:user:{user_id}:skip:{skip}:limit:{limit}"
            cached = cache.get(cache_key)
            if cached:
                return cached

            # Verify project exists and user is owner
            project = await prisma.project.find_unique(where={"id": project_id})

            if not project:
                raise ValueError("Projet non trouvé")

            if not await FreelanceService.can_manage_project(project, user_id):
                raise ValueError("Vous n'êtes pas le propriétaire de ce projet")

            where = {"projectId": project_id}
            total, proposals = await asyncio.gather(
                prisma.proposal.count(where=where),
                prisma.proposal.find_many(
                    where=where,
                    include={"freelancer": True},
                    order={"createdAt": "desc"},
                    skip=skip,
                    take=limit,
                ),
            )

            formatted_proposals = []
            for proposal in proposals:
                freelancer_info = None
                if proposal.freelancer:
                    certificates = []
                    if proposal.freelancer.certificates:
                        certificates = [
                            {"fileUrl": cert.fileUrl, "module": cert.module}
                            for cert in proposal.freelancer.certificates
                        ]

                    freelancer_info = {
                        "id": proposal.freelancer.id,
                        "fullName": proposal.freelancer.fullName,
                        "profilePictureUrl": proposal.freelancer.profilePictureUrl,
                        "bio": proposal.freelancer.bio,
                        "skills": proposal.freelancer.skills,
                        "phoneVerified": proposal.freelancer.phoneVerified,
                        "certificates": certificates,
                    }

                formatted_proposals.append(
                    {
                        "id": proposal.id,
                        "projectId": proposal.projectId,
                        "freelancerId": proposal.freelancerId,
                        "message": proposal.message,
                        "amount": proposal.amount,
                        "status": proposal.status,
                        "createdAt": proposal.createdAt,
                        "freelancer": freelancer_info,
                    }
                )

            result = {
                "items": formatted_proposals,
                "total": total,
                "skip": skip,
                "limit": limit,
                "has_more": (skip + limit) < total,
            }
            cache.set(cache_key, result, ttl=60)
            return result

        except Exception as e:
            logger.error(f"Error in get_project_proposals: {e}", exc_info=True)
            raise

    # ======================
    # OPTIMIZED PROPOSAL METHODS
    # ======================

    @staticmethod
    async def submit_proposal(
        project_id: int, proposal_data: ProposalCreate, freelancer_id: int
    ) -> Dict[str, Any]:
        """Submit a proposal - OPTIMIZED"""
        try:
            # Check if user can act as freelancer
            if not await FreelanceService._can_act_as_freelancer(freelancer_id):
                raise ValueError(
                    "Votre type de compte ne peut pas soumettre de propositions"
                )

            # Verify project exists and is open
            project = await prisma.project.find_unique(
                where={"id": project_id, "status": "OPEN"}
            )

            if not project:
                raise ValueError("Projet non trouvé ou non ouvert aux propositions")

            # Check if freelancer is also the project owner
            if project.ownerId == freelancer_id:
                raise ValueError("Vous ne pouvez pas proposer à votre propre projet")

            # Check if already proposed
            existing_proposal = await prisma.proposal.find_first(
                where={"projectId": project_id, "freelancerId": freelancer_id}
            )

            if existing_proposal:
                raise ValueError("Vous avez déjà soumis une proposition pour ce projet")

            async with prisma.tx() as tx:
                existing_proposal = await tx.proposal.find_first(
                    where={"projectId": project_id, "freelancerId": freelancer_id}
                )
                if existing_proposal:
                    raise ValueError(
                        "Vous avez déjà soumis une proposition pour ce projet"
                    )

                clean_msg = proposal_data.message
                if clean_msg:
                    clean_msg, _ = moderate_text(clean_msg)
                    clean_msg, _ = mask_disintermediation(clean_msg)

                # Create proposal
                proposal = await tx.proposal.create(
                    data={
                        "projectId": project_id,
                        "freelancerId": freelancer_id,
                        "message": clean_msg,
                        "amount": proposal_data.amount,
                        "status": "PENDING",
                    }
                )

            # Clear cache
            cache.delete_pattern(f"project:{project_id}:")
            cache.delete_pattern("projects:")
            cache.delete_pattern(f"user_proposals:{freelancer_id}:")

            # Send notification asynchronously
            run_background(
                FreelanceService._send_notification(
                    user_id=project.ownerId,
                    type="NEW_PROPOSAL",
                    title="notifications.project.new_proposal.title",
                    body="notifications.project.new_proposal.message",
                    variables={"project_title": project.title},
                    data={
                        "project_id": project_id,
                        "proposal_id": proposal.id,
                        "freelancer_id": freelancer_id,
                        "action_url": f"/hub/projects/{project_id}/proposals",
                        "url": f"/hub/projects/{project_id}/proposals",
                    },
                    actions=[
                        {
                            "label": "notifications.actions.view_proposal",
                            "variant": "primary",
                            "url": f"/hub/projects/{project_id}/proposals",
                            "target": f"/hub/projects/{project_id}/proposals",
                        }
                    ],
                ),
                name=f"notify_new_proposal_{project_id}",
            )

            # Send proposal email to project owner
            try:
                from app.services.email_service import email_service

                project_owner = await prisma.user.find_unique(
                    where={"id": project.ownerId}
                )
                freelancer_user = await prisma.user.find_unique(
                    where={"id": freelancer_id}
                )
                if project_owner and project_owner.email and freelancer_user:
                    review_url = (
                        f"{setting.FRONTEND_URL}/hub/projects/{project_id}/proposals"
                    )
                    amount_str = (
                        f"{proposal_data.amount:.2f} DZD"
                        if proposal_data.amount
                        else "N/A"
                    )
                    await email_service.send_proposal_email(
                        email=project_owner.email,
                        name=project_owner.fullName or "Project Owner",
                        project_title=project.title,
                        freelancer=freelancer_user.fullName or "Freelancer",
                        amount=amount_str,
                        message=proposal_data.message or "",
                        review_url=review_url,
                        user_id=project.ownerId,
                    )
            except Exception as ex:
                logger.warning(f"Failed to send proposal email: {ex}")

            try:
                from app.middleware.metrics import (
                    FLYWHEEL_EDTECH_TO_FREELANCING,
                    FLYWHEEL_PASSPORT_UTILIZED,
                )

                completed_courses = await prisma.enrollment.count(
                    where={"userId": freelancer_id, "completedAt": {"not": None}}
                )
                if completed_courses > 0:
                    FLYWHEEL_EDTECH_TO_FREELANCING.inc()
                    if proposal_data.certificateId:
                        FLYWHEEL_PASSPORT_UTILIZED.inc()
            except Exception:
                pass

            return {
                "id": proposal.id,
                "projectId": proposal.projectId,
                "freelancerId": proposal.freelancerId,
                "message": proposal.message,
                "amount": proposal.amount,
                "status": proposal.status,
                "createdAt": proposal.createdAt,
                "freelancer": None,
                "project": None,
            }

        except Exception as e:
            logger.error(f"Error in submit_proposal: {e}")
            raise

    @staticmethod
    async def get_user_proposals(
        user_id: int,
        status: Optional[ProposalStatus] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Get user's proposals - OPTIMIZED"""
        try:
            cache_key = f"user_proposals:{user_id}:status:{status.value if status else 'all'}:skip:{skip}:limit:{limit}"
            cached = cache.get(cache_key)
            if cached:
                return cached

            where_conditions = {"freelancerId": user_id}

            if status:
                where_conditions["status"] = status.value

            total, proposals = await asyncio.gather(
                prisma.proposal.count(where=where_conditions),
                prisma.proposal.find_many(
                    where=where_conditions,
                    include={"project": True},
                    order={"createdAt": "desc"},
                    skip=skip,
                    take=limit,
                ),
            )

            formatted_proposals = []
            for proposal in proposals:
                project_info = None
                if proposal.project:
                    owner_info = None
                    if proposal.project.owner:
                        owner_info = {
                            "id": proposal.project.owner.id,
                            "fullName": proposal.project.owner.fullName,
                            "profilePictureUrl": proposal.project.owner.profilePictureUrl,
                        }

                    project_info = {
                        "id": proposal.project.id,
                        "title": proposal.project.title,
                        "description": proposal.project.description,
                        "owner": owner_info,
                    }

                formatted_proposals.append(
                    {
                        "id": proposal.id,
                        "projectId": proposal.projectId,
                        "freelancerId": proposal.freelancerId,
                        "message": proposal.message,
                        "amount": proposal.amount,
                        "status": proposal.status,
                        "createdAt": proposal.createdAt,
                        "project": project_info,
                        "freelancer": None,
                    }
                )

            result = {
                "items": formatted_proposals,
                "total": total,
                "skip": skip,
                "limit": limit,
                "has_more": (skip + limit) < total,
            }
            cache.set(cache_key, result, ttl=60)
            return result

        except Exception as e:
            logger.error(f"ERROR in get_user_proposals: {str(e)}", exc_info=True)
            raise

    @staticmethod
    async def accept_proposal(
        proposal_id: int, client_id: int, contract_data: Optional[ContractCreate] = None
    ) -> Dict[str, Any]:
        """Accept a proposal and create contract - OPTIMIZED"""
        try:
            # Get proposal with project info (generated client does not support
            # nested `select` inside `include` — fetch full project).
            proposal = await prisma.proposal.find_unique(
                where={"id": proposal_id},
                include={"project": True},
            )

            if not proposal:
                raise ValueError("Proposition non trouvée")

            # Verify user is project owner
            if proposal.project.ownerId != client_id:
                raise ValueError(
                    "Seul le propriétaire du projet peut accepter les propositions"
                )

            # Verify proposal is pending
            if proposal.status != "PENDING":
                raise ValueError("La proposition n'est pas en attente")

            # Start transaction
            async with prisma.tx() as transaction:
                # ── Serialize per-project acceptance (P0) ──
                # Row-lock the project so two concurrent accept calls cannot
                # both observe "no contract yet" and create duplicate ACTIVE
                # contracts for the same project.
                locked = await transaction.execute_raw(
                    'SELECT id FROM "Project" WHERE id = $1 FOR UPDATE',
                    proposal.projectId,
                )
                if not locked:
                    raise ValueError("Projet non trouvé")

                # Reject acceptance when the project already has a live contract.
                existing_contract = await transaction.contract.find_first(
                    where={
                        "projectId": proposal.projectId,
                        "status": {"in": ["ACTIVE", "COMPLETED"]},
                    }
                )
                if existing_contract:
                    raise ValueError(
                        "Ce projet possède déjà un contrat actif ou terminé"
                    )

                # Atomic proposal claim: only one caller can flip PENDING->ACCEPTED.
                claimed = await transaction.proposal.update_many(
                    where={"id": proposal_id, "status": "PENDING"},
                    data={"status": "ACCEPTED"},
                )
                if claimed == 0:
                    raise ValueError("La proposition n'est plus en attente")

                # Update project status
                await transaction.project.update(
                    where={"id": proposal.projectId}, data={"status": "IN_PROGRESS"}
                )

                # Create contract
                contract_amount = (
                    contract_data.amount if contract_data else proposal.amount
                )

                # Build contract terms efficiently with ONDA Ordonnance 03-05 IP Transfer Clause
                onda_ip_clause = (
                    "\n\n[Clause de Cession de Droits d'Auteur - Ordonnance n° 03-05]: "
                    "En contrepartie du règlement complet des honoraires du contrat, le prestataire cède au client "
                    "l'intégralité des droits patrimoniaux de reproduction, de représentation, d'adaptation et d'exploitation "
                    "commerciale des livrables. Les droits moraux inaliénables au respect du nom et de l'œuvre sont préservés."
                )
                base_terms = [
                    f"Contrat pour le projet '{proposal.project.title}'",
                    f"Freelancer: ID {proposal.freelancerId}",
                    f"Client: ID {client_id}",
                ]

                if contract_data and contract_data.terms:
                    contract_terms = contract_data.terms + onda_ip_clause
                    if contract_amount:
                        contract_terms += f"\nMontant: {contract_amount:,} centimes DA"
                else:
                    contract_terms = "\n".join(base_terms) + onda_ip_clause
                    if contract_amount:
                        contract_terms += f"\nMontant: {contract_amount:,} centimes DA"

                contract_data_dict = {
                    "projectId": proposal.projectId,
                    "freelancerId": proposal.freelancerId,
                    "clientId": client_id,
                    "status": "ACTIVE",
                    "terms": contract_terms,
                    "amount": contract_amount or 0,
                    "startDate": contract_data.start_date
                    if contract_data
                    else datetime.now(timezone.utc),
                }

                # Add endDate if provided
                if contract_data and contract_data.end_date:
                    contract_data_dict["endDate"] = contract_data.end_date

                contract = await transaction.contract.create(data=contract_data_dict)

                # Reject other proposals for this project in batch
                await transaction.proposal.update_many(
                    where={
                        "projectId": proposal.projectId,
                        "id": {"not": proposal_id},
                        "status": "PENDING",
                    },
                    data={"status": "REJECTED"},
                )

            # Clear cache
            cache.delete_pattern(f"project:{proposal.projectId}:")
            cache.delete_pattern("projects:")
            cache.delete_pattern(f"user_proposals:{proposal.freelancerId}:")
            cache.delete_pattern(f"user_contracts:{client_id}:")
            cache.delete_pattern(f"user_contracts:{proposal.freelancerId}:")

            # Get rejected proposals for notification
            rejected_proposals = await prisma.proposal.find_many(
                where={
                    "projectId": proposal.projectId,
                    "id": {"not": proposal_id},
                    "status": "REJECTED",
                }
            )

            # Prepare notifications for batch sending
            notifications = []

            # Notification for accepted freelancer
            notifications.append(
                {
                    "user_id": proposal.freelancerId,
                    "type": "PROPOSAL_ACCEPTED",
                    "title": "notifications.proposal.accepted.title",
                    "body": "notifications.proposal.accepted.body",
                    "data": {
                        "project_id": proposal.projectId,
                        "project_title": proposal.project.title,
                        "contract_id": contract.id,
                        "client_id": client_id,
                        "action_url": f"/hub/contracts/{contract.id}",
                        "url": f"/hub/contracts/{contract.id}",
                        "variables": {"project_title": proposal.project.title},
                    },
                }
            )

            # Notifications for rejected freelancers
            for rejected_proposal in rejected_proposals:
                notifications.append(
                    {
                        "user_id": rejected_proposal.freelancerId,
                        "type": "PROPOSAL_REJECTED",
                        "title": "notifications.proposal.rejected.title",
                        "body": "notifications.proposal.rejected.body",
                        "data": {
                            "project_id": proposal.projectId,
                            "project_title": proposal.project.title,
                            "action_url": f"/hub/projects/{proposal.projectId}",
                            "url": f"/hub/projects/{proposal.projectId}",
                            "variables": {"project_title": proposal.project.title},
                        },
                    }
                )

            # Send all notifications asynchronously
            run_background(
                FreelanceService._send_notifications_batch(notifications),
                name="batch_notifications",
            )

            # Auto-create messaging conversation for the contract
            try:
                from app.services.messaging_service import MessagingService

                run_background(
                    MessagingService.get_or_create_contract_conversation(
                        contract_id=contract.id,
                        client_id=client_id,
                        freelancer_id=proposal.freelancerId,
                    ),
                    name=f"create_conversation_{contract.id}",
                )
            except Exception as msg_err:
                logger.warning(
                    "Failed to schedule conversation creation for contract %s: %s",
                    contract.id,
                    msg_err,
                )

            return FreelanceService._format_contract_response(contract)

        except Exception as e:
            logger.error(f"Error in accept_proposal: {e}")
            raise

    @staticmethod
    async def reject_proposal(proposal_id: int, client_id: int):
        """Reject a proposal - OPTIMIZED"""
        try:
            # Get proposal with project info (generated client does not support
            # nested `select` inside `include` — fetch full project).
            proposal = await prisma.proposal.find_unique(
                where={"id": proposal_id},
                include={"project": True},
            )

            if not proposal:
                raise ValueError("Proposition non trouvée")

            # Verify user is project owner
            if proposal.project.ownerId != client_id:
                raise ValueError(
                    "Seul le propriétaire du projet peut rejeter les propositions"
                )

            # Verify proposal is pending
            if proposal.status != "PENDING":
                raise ValueError("La proposition n'est pas en attente")

            # Update proposal status
            await prisma.proposal.update(
                where={"id": proposal_id}, data={"status": "REJECTED"}
            )

            # Clear cache
            cache.delete_pattern(f"user_proposals:{proposal.freelancerId}:")
            cache.delete_pattern(f"project:{proposal.projectId}:")

            # Send notification asynchronously
            run_background(
                FreelanceService._send_notification(
                    user_id=proposal.freelancerId,
                    type="PROPOSAL_REJECTED",
                    title="Proposition rejetée",
                    body=f"Votre proposition pour le projet '{proposal.project.title}' a été rejetée",
                    data={"project_id": proposal.projectId},
                ),
                name=f"notify_reject_{proposal.id}",
            )

        except Exception as e:
            logger.error(f"Error in reject_proposal: {e}")
            raise

    @staticmethod
    async def withdraw_proposal(proposal_id: int, freelancer_id: int) -> Dict[str, Any]:
        """Withdraw a pending proposal as the freelancer who submitted it"""
        try:
            proposal = await prisma.proposal.find_unique(where={"id": proposal_id})

            if not proposal:
                raise ValueError("Proposition non trouvée")

            if proposal.freelancerId != freelancer_id:
                raise ValueError("Vous ne pouvez retirer que vos propres propositions")

            if proposal.status != "PENDING":
                raise ValueError(
                    "Seules les propositions en attente peuvent être retirées"
                )

            async with prisma.tx() as transaction:
                current = await transaction.proposal.find_unique(
                    where={"id": proposal_id},
                )
                if not current or current.status != "PENDING":
                    raise ValueError("La proposition n'est plus en attente")

                updated = await transaction.proposal.update(
                    where={"id": proposal_id},
                    data={
                        "status": "WITHDRAWN",
                        "withdrawnAt": datetime.now(timezone.utc),
                    },
                )

            cache.delete_pattern(f"project_proposals:{proposal.projectId}:")
            cache.delete_pattern(f"user_proposals:{freelancer_id}:")
            cache.delete_pattern(f"project:{proposal.projectId}:")

            return {
                "id": updated.id,
                "projectId": updated.projectId,
                "freelancerId": updated.freelancerId,
                "message": updated.message,
                "amount": updated.amount,
                "status": updated.status,
                "createdAt": updated.createdAt,
                "withdrawnAt": updated.withdrawnAt,
                "freelancer": None,
            }

        except Exception as e:
            logger.error(f"Error in withdraw_proposal: {e}")
            raise

    # ======================
    # OPTIMIZED CONTRACT METHODS
    # ======================

    @staticmethod
    async def get_user_contracts(
        user_id: int,
        status: Optional[ContractStatus] = None,
        role: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Get user's contracts - OPTIMIZED with batch queries"""
        try:
            cache_key = (
                f"user_contracts:{user_id}:"
                f"status:{status.value if status else 'all'}:"
                f"role:{role if role else 'all'}:"
                f"skip:{skip}:limit:{limit}"
            )

            cached = cache.get(cache_key)
            if cached:
                return cached

            where_conditions = {"OR": []}

            if role == "freelancer":
                where_conditions["OR"].append({"freelancerId": user_id})
            elif role == "client":
                where_conditions["OR"].append({"clientId": user_id})
            else:
                where_conditions["OR"].extend(
                    [{"freelancerId": user_id}, {"clientId": user_id}]
                )

            if status:
                where_conditions["AND"] = [{"status": status.value}]

            total, contracts = await asyncio.gather(
                prisma.contract.count(where=where_conditions),
                prisma.contract.find_many(
                    where=where_conditions,
                    order={"createdAt": "desc"},
                    skip=skip,
                    take=limit,
                ),
            )

            if not contracts:
                result = {
                    "items": [],
                    "total": total,
                    "skip": skip,
                    "limit": limit,
                    "has_more": (skip + limit) < total,
                }
                cache.set(cache_key, result, ttl=60)
                return result

            # Batch queries for related data
            contract_ids = [c.id for c in contracts]
            project_ids = [c.projectId for c in contracts]
            freelancer_ids = [c.freelancerId for c in contracts]
            client_ids = [c.clientId for c in contracts]

            # Execute all related queries in parallel
            (
                projects_dict,
                freelancers_dict,
                clients_dict,
                deliveries_by_contract,
            ) = await asyncio.gather(
                # Batch query: Get all projects
                prisma.project.find_many(
                    where={"id": {"in": project_ids}},
                ),
                # Batch query: Get all freelancers
                prisma.user.find_many(
                    where={"id": {"in": freelancer_ids}},
                ),
                # Batch query: Get all clients
                prisma.user.find_many(
                    where={"id": {"in": client_ids}},
                ),
                # Batch query: Get all deliveries
                prisma.delivery.find_many(where={"contractId": {"in": contract_ids}}),
            )

            # Index results for O(1) lookup
            projects_map = {p.id: p for p in projects_dict}
            freelancers_map = {f.id: f for f in freelancers_dict}
            clients_map = {c.id: c for c in clients_dict}
            deliveries_map = {}
            for delivery in deliveries_by_contract:
                if delivery.contractId not in deliveries_map:
                    deliveries_map[delivery.contractId] = []
                deliveries_map[delivery.contractId].append(delivery)

            # Format contracts efficiently
            formatted_contracts = []
            for contract in contracts:
                # Get related data from maps (no additional queries)
                deliveries_info = []
                if contract.id in deliveries_map:
                    for delivery in deliveries_map[contract.id]:
                        files_data = None
                        if delivery.files:
                            try:
                                files_data = json.loads(delivery.files)
                            except Exception:
                                files_data = delivery.files

                        deliveries_info.append(
                            {
                                "id": delivery.id,
                                "description": delivery.description,
                                "deliveredAt": delivery.deliveredAt,
                                "files": files_data,
                            }
                        )

                project = projects_map.get(contract.projectId)
                freelancer = freelancers_map.get(contract.freelancerId)
                client = clients_map.get(contract.clientId)

                formatted_contracts.append(
                    {
                        "id": contract.id,
                        "projectId": contract.projectId,
                        "freelancerId": contract.freelancerId,
                        "clientId": contract.clientId,
                        "terms": contract.terms,
                        "amount": contract.amount,
                        "startDate": contract.startDate,
                        "endDate": contract.endDate,
                        "status": contract.status,
                        "createdAt": contract.createdAt,
                        "project": {
                            "id": project.id,
                            "title": project.title,
                            "description": project.description,
                        }
                        if project
                        else None,
                        "freelancer": {
                            "id": freelancer.id,
                            "fullName": freelancer.fullName,
                            "profilePictureUrl": freelancer.profilePictureUrl,
                        }
                        if freelancer
                        else None,
                        "client": {
                            "id": client.id,
                            "fullName": client.fullName,
                            "profilePictureUrl": client.profilePictureUrl,
                        }
                        if client
                        else None,
                        "deliveries": deliveries_info,
                    }
                )

            result = {
                "items": formatted_contracts,
                "total": total,
                "skip": skip,
                "limit": limit,
                "has_more": (skip + limit) < total,
            }
            cache.set(cache_key, result, ttl=60)
            return result

        except Exception as e:
            logger.error(f"Error in get_user_contracts: {e}", exc_info=True)
            raise

    @staticmethod
    async def get_contract(contract_id: int, user_id: int) -> Dict[str, Any]:
        """Get contract details - OPTIMIZED"""
        try:
            cache_key = f"contract:{contract_id}:user:{user_id}"
            cached = cache.get(cache_key)
            if cached:
                return cached

            # First, check if user has access by checking the contract directly
            contract_check = await prisma.contract.find_unique(
                where={"id": contract_id}
            )

            if not contract_check:
                raise ValueError("Contrat non trouvé")

            # Check if user is freelancer or client on this contract
            is_freelancer = contract_check.freelancerId == user_id
            is_client = contract_check.clientId == user_id

            # Check if user is admin
            user = await prisma.user.find_unique(where={"id": user_id})
            is_admin = user and user.role == "ADMIN"

            if not (is_freelancer or is_client or is_admin):
                raise ValueError("Vous n'avez pas accès à ce contrat")

            # Now get full contract data with relations
            contract = await prisma.contract.find_unique(
                where={"id": contract_id},
                include={
                    "project": True,
                    "freelancer": True,
                    "client": True,
                    "deliveries": True,
                },
            )

            if not contract:
                raise ValueError("Contrat non trouvé")

            # Determine user role
            user_role = (
                "freelancer" if is_freelancer else "client" if is_client else "admin"
            )

            # Format deliveries
            deliveries_info = []
            if contract.deliveries:
                for delivery in contract.deliveries:
                    files_data = None
                    if delivery.files:
                        try:
                            files_data = json.loads(delivery.files)
                        except (json.JSONDecodeError, TypeError):
                            files_data = delivery.files

                    deliveries_info.append(
                        {
                            "id": delivery.id,
                            "description": delivery.description,
                            "deliveredAt": delivery.deliveredAt.isoformat()
                            if delivery.deliveredAt
                            else None,
                            "files": files_data,
                        }
                    )

            # Helper function to format dates
            def format_date(date_obj):
                if date_obj and hasattr(date_obj, "isoformat"):
                    return date_obj.isoformat()
                return None

            result = {
                "id": contract.id,
                "projectId": contract.projectId,
                "freelancerId": contract.freelancerId,
                "clientId": contract.clientId,
                "terms": contract.terms,
                "amount": contract.amount,
                "startDate": format_date(contract.startDate),
                "endDate": format_date(contract.endDate),
                "status": contract.status,
                "createdAt": format_date(contract.createdAt),
                "user_role": user_role,
                "project": {
                    "id": contract.project.id,
                    "title": contract.project.title,
                    "description": contract.project.description,
                }
                if contract.project
                else None,
                "freelancer": {
                    "id": contract.freelancer.id,
                    "fullName": contract.freelancer.fullName,
                    "profilePictureUrl": contract.freelancer.profilePictureUrl,
                }
                if contract.freelancer
                else None,
                "client": {
                    "id": contract.client.id,
                    "fullName": contract.client.fullName,
                    "profilePictureUrl": contract.client.profilePictureUrl,
                }
                if contract.client
                else None,
                "deliveries": deliveries_info,
            }

            cache.set(cache_key, result, ttl=120)
            return result

        except ValueError as e:
            logger.warning(f"Contract access error for user {user_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error in get_contract: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to fetch contract: {str(e)}")

    @staticmethod
    async def submit_delivery(
        contract_id: int, delivery_data: DeliveryCreate, freelancer_id: int
    ) -> Dict[str, Any]:
        """Submit delivery for a contract - OPTIMIZED"""
        try:
            # Verify contract exists and freelancer is part of it
            contract = await prisma.contract.find_unique(where={"id": contract_id})

            if not contract:
                raise ValueError("Contrat non trouvé")

            if contract.freelancerId != freelancer_id:
                raise ValueError("Seul le freelancer peut soumettre des livraisons")

            if contract.status != "ACTIVE":
                raise ValueError("Le contrat n'est pas actif")

            # Create delivery
            files_dict = None
            if delivery_data.file_urls:
                # Create a dictionary with index as keys
                files_dict = {
                    str(i): url for i, url in enumerate(delivery_data.file_urls[:20])
                }  # Limit to 20 files

            delivery = await prisma.delivery.create(
                data={
                    "contractId": contract_id,
                    "description": delivery_data.description,
                    "files": Json(files_dict) if files_dict else None,
                    "deliveredAt": datetime.now(timezone.utc),
                }
            )

            # Clear cache
            cache.delete_pattern(f"contract:{contract_id}:")
            cache.delete_pattern(f"user_contracts:{freelancer_id}:")
            cache.delete_pattern(f"user_contracts:{contract.clientId}:")

            # Send notification asynchronously
            run_background(
                FreelanceService._send_notification(
                    user_id=contract.clientId,
                    type="DELIVERY_SUBMITTED",
                    title="Nouvelle livraison",
                    body=f"Une nouvelle livraison a été soumise pour le contrat '{contract_id}'",
                    data={"contract_id": contract_id, "delivery_id": delivery.id},
                ),
                name=f"notify_delivery_{contract_id}",
            )

            return {
                "id": delivery.id,
                "contractId": delivery.contractId,
                "description": delivery.description,
                "deliveredAt": delivery.deliveredAt,
                "files": files_dict,
            }

        except Exception as e:
            logger.error(f"Error in submit_delivery: {e}")
            raise

    @staticmethod
    async def complete_contract(contract_id: int, client_id: int) -> Dict[str, Any]:
        """Mark contract as completed - OPTIMIZED"""
        try:
            # Verify contract exists and client is owner
            contract = await prisma.contract.find_unique(where={"id": contract_id})

            if not contract:
                raise ValueError("Contrat non trouvé")

            if contract.clientId != client_id:
                raise ValueError("Seul le client peut marquer le contrat comme terminé")

            # Anti-collusion defense: prevent wash contracting and rapid review farming
            if contract.freelancerId == client_id:
                raise ValueError("Opération invalide : client et freelance identiques.")

            # Check for minimum contract duration
            if contract.createdAt:
                contract_age = datetime.now(timezone.utc) - contract.createdAt
                # Enforce in production or when explicitly configured
                if (
                    getattr(setting, "ENVIRONMENT", "") == "production"
                    and contract_age.total_seconds() < 48 * 3600
                ):
                    milestones = await prisma.contractmilestone.find_many(
                        where={"contractId": contract_id}
                    )
                    if not milestones or any(
                        m.status != "APPROVED" for m in milestones
                    ):
                        raise ValueError(
                            "Délai minimum de sécurité non respecté (48h requises pour finalisation du contrat)."
                        )

            # ── Atomic terminal transition (P0) ──
            # Only an ACTIVE contract may become COMPLETED. Use a conditional
            # UPDATE scoped to status=ACTIVE so that a concurrent complete/cancel/
            # dispute cannot both win: exactly one state transition per contract.
            async with prisma.tx() as transaction:
                updated = await transaction.contract.update_many(
                    where={"id": contract_id, "status": "ACTIVE"},
                    data={"status": "COMPLETED"},
                )
                if updated == 0:
                    raise ValueError(
                        "Impossible de terminer un contrat qui n'est pas actif"
                    )

                await transaction.project.update(
                    where={"id": contract.projectId}, data={"status": "COMPLETED"}
                )

            # Re-read for response after the atomic transition
            updated_contract = await prisma.contract.find_unique(
                where={"id": contract_id}
            )
            if updated_contract is None:
                updated_contract = contract

            # Clear cache
            cache.delete_pattern(f"contract:{contract_id}:")
            cache.delete_pattern(f"project:{contract.projectId}:")
            cache.delete_pattern(f"user_contracts:{client_id}:")
            cache.delete_pattern(f"user_contracts:{contract.freelancerId}:")
            cache.delete_pattern("projects:")

            # Prepare notifications for batch sending
            notifications = [
                {
                    "user_id": contract.freelancerId,
                    "type": "CONTRACT_COMPLETED",
                    "title": "Contrat terminé",
                    "body": f"Le contrat '{contract_id}' a été marqué comme terminé",
                    "data": {"contract_id": contract_id},
                },
                {
                    "user_id": client_id,
                    "type": "CONTRACT_COMPLETED",
                    "title": "Contrat terminé",
                    "body": f"Vous avez marqué le contrat '{contract_id}' comme terminé",
                    "data": {"contract_id": contract_id},
                },
            ]

            # Send notifications asynchronously
            run_background(
                FreelanceService._send_notifications_batch(notifications),
                name="batch_notifications",
            )

            return FreelanceService._format_contract_response(updated_contract)

        except Exception as e:
            logger.error(f"Error in complete_contract: {e}")
            raise

    @staticmethod
    async def cancel_contract(contract_id: int, user_id: int) -> Dict[str, Any]:
        """Cancel a contract - OPTIMIZED"""
        try:
            # Verify contract exists
            contract = await prisma.contract.find_unique(where={"id": contract_id})

            if not contract:
                raise ValueError("Contrat non trouvé")

            # Check if user is part of the contract
            if contract.freelancerId != user_id and contract.clientId != user_id:
                raise ValueError("Vous n'avez pas accès à ce contrat")

            # ── Atomic terminal transition (P0) ──
            # Only ACTIVE may become CANCELLED; the conditional UPDATE prevents
            # a concurrent complete/dispute from also winning.
            async with prisma.tx() as transaction:
                cancelled = await transaction.contract.update_many(
                    where={"id": contract_id, "status": "ACTIVE"},
                    data={"status": "CANCELLED"},
                )
                if cancelled == 0:
                    raise ValueError("Seuls les contrats actifs peuvent être annulés")

                await transaction.project.update(
                    where={"id": contract.projectId}, data={"status": "CANCELLED"}
                )

            updated_contract = await prisma.contract.find_unique(
                where={"id": contract_id}
            )
            if updated_contract is None:
                updated_contract = contract

            # Clear cache
            cache.delete_pattern(f"contract:{contract_id}:")
            cache.delete_pattern(f"project:{contract.projectId}:")
            cache.delete_pattern(f"user_contracts:{user_id}:")
            cache.delete_pattern("projects:")

            # Notify the other party
            other_party_id = (
                contract.clientId
                if contract.freelancerId == user_id
                else contract.freelancerId
            )

            run_background(
                FreelanceService._send_notification(
                    user_id=other_party_id,
                    type="CONTRACT_CANCELLED",
                    title="Contrat annulé",
                    body=f"Le contrat '{contract_id}' a été annulé",
                    data={"contract_id": contract_id},
                ),
                name=f"notify_cancel_{contract_id}",
            )

            return FreelanceService._format_contract_response(updated_contract)

        except Exception as e:
            logger.error(f"Error in cancel_contract: {e}")
            raise

    # ======================
    # OPTIMIZED FREELANCER METHODS
    # ======================

    @staticmethod
    async def _search_freelancers_common(search_params, include_private_fields=False):
        where_conditions = {
            "role": {"in": ["FREELANCER", "INSTRUCTOR", "ADMIN", "STUDENT"]},
            "isActive": True,
            "deletedAt": None,
        }

        if getattr(search_params, "search", None):
            where_conditions["OR"] = [
                {"fullName": {"contains": search_params.search, "mode": "insensitive"}},
                {"bio": {"contains": search_params.search, "mode": "insensitive"}},
            ]

        if getattr(search_params, "skills", None):
            where_conditions["skills"] = {"hasSome": search_params.skills[:10]}

        if (
            include_private_fields
            and getattr(search_params, "phone_verified", None) is not None
        ):
            where_conditions["phoneVerified"] = search_params.phone_verified

        if getattr(search_params, "category", None) and search_params.category != "all":
            keywords = CATEGORY_KEYWORDS.get(search_params.category, [])
            if keywords:
                skill_or_conditions = []
                for kw in keywords:
                    skill_or_conditions.append({"skills": {"has": kw}})
                if skill_or_conditions:
                    existing_or = where_conditions.pop("OR", None)
                    cat_condition = {"OR": skill_or_conditions}
                    if existing_or:
                        existing_and_or = where_conditions.pop("AND", [])
                        where_conditions["AND"] = existing_and_or + [
                            cat_condition,
                            {"OR": existing_or["OR"]},
                        ]
                    else:
                        where_conditions["OR"] = skill_or_conditions

        total, users = await asyncio.gather(
            prisma.user.count(where=where_conditions),
            prisma.user.find_many(
                where=where_conditions,
                skip=search_params.skip,
                take=search_params.limit,
                order={"createdAt": "desc"},
            ),
        )

        if not users:
            return {
                "freelancers": [],
                "total": total,
                "skip": search_params.skip,
                "limit": search_params.limit,
            }

        user_ids = [user.id for user in users]

        certificate_counts_result, completed_contracts_result = await asyncio.gather(
            prisma.certificate.group_by(
                by=["userId"], where={"userId": {"in": user_ids}}, count={"id": True}
            ),
            prisma.contract.group_by(
                by=["freelancerId"],
                where={"freelancerId": {"in": user_ids}, "status": "COMPLETED"},
                count={"id": True},
            ),
        )
        certificate_counts = {
            item["userId"]: item["_count"]["id"] for item in certificate_counts_result
        }
        completed_contracts = {
            item["freelancerId"]: item["_count"]["id"]
            for item in completed_contracts_result
        }

        avg_ratings = {}
        if user_ids:
            rows = await prisma.query_raw(
                'SELECT "targetId", AVG("rating")::float AS avg_rating FROM "ContractReview" WHERE "targetId" = ANY($1::int[]) AND "status" = \'ACTIVE\' GROUP BY "targetId"',
                user_ids,
            )
            avg_ratings = {row["targetId"]: row["avg_rating"] for row in rows}

        profiles_result = await prisma.freelancerprofile.find_many(
            where={"userId": {"in": user_ids}}
        )
        profile_map = {p.userId: p for p in profiles_result}

        enriched_users = []
        for user in users:
            certificates_count = certificate_counts.get(user.id, 0)
            completed_projects = completed_contracts.get(user.id, 0)
            avg_rating = avg_ratings.get(user.id, 0)
            profile = profile_map.get(user.id)
            metadata = (
                profile.metadata
                if profile and isinstance(profile.metadata, dict)
                else {}
            )
            hourly_rate = None
            if isinstance(metadata, dict):
                hourly_rate = metadata.get("hourly_rate") or metadata.get("hourlyRate")

            if getattr(search_params, "has_certificates", None) is not None:
                has_certs = certificates_count > 0
                if search_params.has_certificates != has_certs:
                    continue

            if (
                getattr(search_params, "min_budget", None) is not None
                and hourly_rate is not None
            ):
                if hourly_rate < search_params.min_budget:
                    continue
            if (
                getattr(search_params, "max_budget", None) is not None
                and hourly_rate is not None
            ):
                if hourly_rate > search_params.max_budget:
                    continue

            if getattr(search_params, "rating_min", None) is not None:
                if avg_rating < search_params.rating_min:
                    continue

            # Resolve Job Success Score & EigenTrust with verified Algerian credential boosts
            jss = metadata.get("job_success_score")
            eigentrust_score = metadata.get("eigentrust_score")
            is_arrete_1275 = bool(
                (profile and profile.skillPassportVerified)
                or metadata.get("arrete_1275_verified")
            )
            is_anae = bool(
                (profile and profile.isAnaeRegistered)
                or (profile and profile.isVerified)
            )
            has_capstone = certificates_count > 0

            if jss is None:
                # Real-time computation for cold-start candidates
                trust_profile = UserTrustProfile(
                    user_id=user.id,
                    has_verified_degree_or_1275=is_arrete_1275,
                    has_microvm_capstone=has_capstone,
                    has_anae_kyc=is_anae,
                    completed_contracts_count=completed_projects,
                    raw_rating_avg=float(avg_rating or 0.0),
                )
                raw_b = reputation_service.compute_user_raw_pretrust(trust_profile)
                jss = reputation_service.compute_freelancer_job_success_score(
                    user_id=user.id,
                    eigentrust_score=raw_b,
                    average_eigentrust=0.25,
                    completed_contracts=completed_projects,
                    raw_average_rating=float(avg_rating or 0.0),
                )
                eigentrust_score = round(raw_b, 4)

            # Algorithmic Match Rank Score
            # Harmonizes historical satisfaction and verifiable Algerian credentials
            match_rank_score = round(
                (0.45 * float(jss or 50.0))
                + (0.30 * (float(avg_rating or 3.5) / 5.0 * 100.0))
                + (0.15 * (100.0 if is_arrete_1275 else 0.0))
                + (0.10 * min(100.0, completed_projects * 20.0)),
                2,
            )

            user_entry = {
                "id": user.id,
                "fullName": user.fullName,
                "bio": user.bio,
                "profilePictureUrl": user.profilePictureUrl,
                "skills": user.skills if user.skills else [],
                "city": user.city,
                "country": user.country,
                "role": user.role,
                "certificates_count": certificates_count,
                "completed_projects": completed_projects,
                "avg_rating": round(float(avg_rating), 2) if avg_rating else None,
                "job_success_score": float(jss),
                "eigentrust_score": float(eigentrust_score)
                if eigentrust_score is not None
                else None,
                "skill_passport_verified": bool(
                    profile.skillPassportVerified if profile else False
                ),
                "is_anae_registered": is_anae,
                "credential_boost_applied": bool(
                    is_arrete_1275 or has_capstone or is_anae
                ),
                "match_rank_score": match_rank_score,
                "hourly_rate": hourly_rate,
                "createdAt": user.createdAt.isoformat() if user.createdAt else None,
            }
            if include_private_fields:
                user_entry["phoneVerified"] = user.phoneVerified
                user_entry["total_earnings"] = 0
                user_entry["updatedAt"] = (
                    user.updatedAt.isoformat() if user.updatedAt else None
                )
            else:
                user_entry["phone_verified"] = user.phoneVerified
            enriched_users.append(user_entry)

        # Default ranking: prioritize match_rank_score descending
        enriched_users.sort(key=lambda u: u.get("match_rank_score", 0), reverse=True)

        return {
            "freelancers": enriched_users,
            "total": total,
            "skip": search_params.skip,
            "limit": search_params.limit,
        }

    @staticmethod
    async def search_freelancers(search_params: FreelancerSearch) -> Dict[str, Any]:
        """Search for freelancers - OPTIMIZED"""
        try:
            cache_key = f"freelancers:search:{search_params.search}:skills:{','.join(search_params.skills) if search_params.skills else 'none'}:certs:{search_params.has_certificates}:phone:{search_params.phone_verified}:budget:{search_params.min_budget}-{search_params.max_budget}:cat:{search_params.category}:rating:{search_params.rating_min}:skip:{search_params.skip}:limit:{search_params.limit}"
            cached = cache.get(cache_key)
            if cached:
                return cached

            result = await FreelanceService._search_freelancers_common(
                search_params, include_private_fields=True
            )
            cache.set(cache_key, result, ttl=60)
            return result

        except Exception as e:
            logger.error(f"Error in search_freelancers: {str(e)}", exc_info=True)
            raise

    @staticmethod
    async def get_freelancer_profile(user_id: int) -> Dict[str, Any]:
        """Get freelancer profile with detailed information - OPTIMIZED"""
        try:
            cache_key = f"freelancer_profile:{user_id}"
            cached = cache.get(cache_key)
            if cached:
                return cached

            # Get user with all related data in optimized queries
            user_task = prisma.user.find_unique(where={"id": user_id})

            certificates_task = prisma.certificate.find_many(
                where={"userId": user_id}, include={"module": True}
            )

            completed_contracts_task = prisma.contract.find_many(
                where={"freelancerId": user_id, "status": "COMPLETED"},
                include={"project": True},
            )

            accepted_proposals_task = prisma.proposal.find_many(
                where={"freelancerId": user_id, "status": "ACCEPTED"},
                include={"project": True},
            )

            skills_details_task = prisma.userskill.find_many(where={"userId": user_id})

            received_reviews_task = prisma.contractreview.find_many(
                where={"targetId": user_id, "isPublic": True},
                include={"author": True, "contract": {"include": {"project": True}}},
            )

            freelancer_profile_task = prisma.freelancerprofile.find_unique(
                where={"userId": user_id}
            )

            # Execute all queries concurrently
            (
                user,
                certificates,
                completed_contracts,
                accepted_proposals,
                skills_details,
                received_reviews,
                freelancer_profile,
            ) = await asyncio.gather(
                user_task,
                certificates_task,
                completed_contracts_task,
                accepted_proposals_task,
                skills_details_task,
                received_reviews_task,
                freelancer_profile_task,
            )

            if not user:
                raise ValueError("Freelancer non trouvé")

            # Calculate stats
            completed_projects = len(completed_contracts)
            accepted_proposals_count = len(accepted_proposals)

            # Calculate total earnings (would come from Transaction model in real implementation)
            total_earnings = 0

            # Calculate trust score & JSS
            metadata = (
                freelancer_profile.metadata
                if freelancer_profile and isinstance(freelancer_profile.metadata, dict)
                else {}
            )
            is_arrete_1275 = bool(
                (freelancer_profile and freelancer_profile.skillPassportVerified)
                or metadata.get("arrete_1275_verified")
            )
            is_anae = bool(
                (freelancer_profile and freelancer_profile.isAnaeRegistered)
                or (freelancer_profile and freelancer_profile.isVerified)
            )
            has_capstone = len(certificates) > 0

            jss = metadata.get("job_success_score")
            eigentrust_score = metadata.get("eigentrust_score")

            if jss is None:
                trust_profile = UserTrustProfile(
                    user_id=user.id,
                    has_verified_degree_or_1275=is_arrete_1275,
                    has_microvm_capstone=has_capstone,
                    has_anae_kyc=is_anae,
                    completed_contracts_count=completed_projects,
                    raw_rating_avg=float(user.averageRating or 0.0),
                )
                raw_b = reputation_service.compute_user_raw_pretrust(trust_profile)
                jss = reputation_service.compute_freelancer_job_success_score(
                    user_id=user.id,
                    eigentrust_score=raw_b,
                    average_eigentrust=0.25,
                    completed_contracts=completed_projects,
                    raw_average_rating=float(user.averageRating or 0.0),
                )
                eigentrust_score = round(raw_b, 4)

            trust_score = (
                (user.phoneVerified * 30)
                + (len(certificates) * 20)
                + (completed_projects * 10)
                + (25 if is_arrete_1275 else 0)
            )

            result = {
                "id": user.id,
                "full_name": user.fullName,
                "bio": user.bio,
                "profile_picture_url": user.profilePictureUrl,
                "skills": user.skills,
                "city": user.city,
                "country": user.country,
                "phone_verified": user.phoneVerified,
                "role": user.role,
                "certificates": certificates,
                "skills_details": skills_details,
                "completed_projects": completed_projects,
                "accepted_proposals": accepted_proposals_count,
                "total_earnings": total_earnings,
                "completed_contracts": completed_contracts,
                "trust_score": trust_score,
                "job_success_score": float(jss),
                "eigentrust_score": float(eigentrust_score)
                if eigentrust_score is not None
                else None,
                "skill_passport_verified": bool(
                    freelancer_profile.skillPassportVerified
                    if freelancer_profile
                    else False
                ),
                "is_anae_registered": is_anae,
                "credential_boost_applied": bool(
                    is_arrete_1275 or has_capstone or is_anae
                ),
                "averageRating": user.averageRating,
                "reviewCount": user.reviewCount,
                "receivedReviews": [
                    {
                        "id": r.id,
                        "clientName": r.author.fullName if r.author else "Client",
                        "clientAvatar": r.author.profilePictureUrl
                        if r.author
                        else None,
                        "rating": r.overallRating,
                        "comment": r.comment,
                        "date": r.createdAt.isoformat() if r.createdAt else None,
                        "project": r.contract.project.title
                        if r.contract and r.contract.project
                        else "Private Project",
                    }
                    for r in received_reviews
                ],
            }

            cache.set(cache_key, result, ttl=300)
            return result

        except Exception as e:
            logger.error(f"Error in get_freelancer_profile: {e}")
            raise

    # ======================
    # OPTIMIZED DASHBOARD METHODS
    # ======================

    @staticmethod
    async def get_dashboard_stats(user_id: int) -> Dict[str, Any]:
        """Get freelance dashboard statistics - OPTIMIZED"""
        try:
            cache_key = f"dashboard_stats:{user_id}"
            cached = cache.get(cache_key)
            if cached:
                return cached

            # Get user info
            user = await prisma.user.find_unique(where={"id": user_id})

            if not user:
                raise ValueError("Utilisateur non trouvé")

            is_freelancer = FreelanceService._can_user_act_as_freelancer_cached(
                user.role
            )
            is_client = FreelanceService._can_user_act_as_client_cached(user.role)

            stats = {
                "is_freelancer": is_freelancer,
                "is_client": is_client,
                "phone_verified": user.phoneVerified,
                "certificates_count": 0,
                "skills_count": len(user.skills) if user.skills else 0,
            }

            # Prepare tasks for parallel execution
            tasks = []

            if is_freelancer:
                tasks.extend(
                    [
                        prisma.proposal.find_many(where={"freelancerId": user_id}),
                        prisma.contract.find_many(where={"freelancerId": user_id}),
                        prisma.certificate.count(where={"userId": user_id}),
                    ]
                )

            if is_client:
                tasks.extend(
                    [
                        prisma.project.find_many(where={"ownerId": user_id}),
                        prisma.contract.find_many(where={"clientId": user_id}),
                    ]
                )

            # Execute all queries in parallel
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results
            result_index = 0

            if is_freelancer:
                proposals = (
                    results[result_index]
                    if not isinstance(results[result_index], Exception)
                    else []
                )
                contracts = (
                    results[result_index + 1]
                    if not isinstance(results[result_index + 1], Exception)
                    else []
                )
                certificates_count = (
                    results[result_index + 2]
                    if not isinstance(results[result_index + 2], Exception)
                    else 0
                )
                result_index += 3

                # Count proposals by status
                proposal_counts = {"ACCEPTED": 0, "PENDING": 0, "REJECTED": 0}
                for p in proposals:
                    proposal_counts[p.status] = proposal_counts.get(p.status, 0) + 1

                # Count contracts by status
                contract_counts = {"ACTIVE": 0, "COMPLETED": 0, "CANCELLED": 0}
                for c in contracts:
                    contract_counts[c.status] = contract_counts.get(c.status, 0) + 1

                stats.update(
                    {
                        "freelancer": {
                            "total_proposals": len(proposals),
                            "accepted_proposals": proposal_counts["ACCEPTED"],
                            "pending_proposals": proposal_counts["PENDING"],
                            "rejected_proposals": proposal_counts["REJECTED"],
                            "active_contracts": contract_counts["ACTIVE"],
                            "completed_contracts": contract_counts["COMPLETED"],
                            "cancelled_contracts": contract_counts["CANCELLED"],
                            "total_earnings": 0,
                            "certificates_count": certificates_count,
                        }
                    }
                )
                stats["certificates_count"] = certificates_count

            if is_client:
                projects = (
                    results[result_index]
                    if not isinstance(results[result_index], Exception)
                    else []
                )
                contracts = (
                    results[result_index + 1]
                    if not isinstance(results[result_index + 1], Exception)
                    else []
                )

                # Count projects by status
                project_counts = {
                    "OPEN": 0,
                    "IN_PROGRESS": 0,
                    "COMPLETED": 0,
                    "CANCELLED": 0,
                }
                for p in projects:
                    project_counts[p.status] = project_counts.get(p.status, 0) + 1

                # Count contracts by status
                contract_counts = {"ACTIVE": 0, "COMPLETED": 0, "CANCELLED": 0}
                for c in contracts:
                    contract_counts[c.status] = contract_counts.get(c.status, 0) + 1

                stats.update(
                    {
                        "client": {
                            "total_projects": len(projects),
                            "open_projects": project_counts["OPEN"],
                            "in_progress_projects": project_counts["IN_PROGRESS"],
                            "completed_projects": project_counts["COMPLETED"],
                            "cancelled_projects": project_counts["CANCELLED"],
                            "active_contracts": contract_counts["ACTIVE"],
                            "completed_contracts": contract_counts["COMPLETED"],
                            "cancelled_contracts": contract_counts["CANCELLED"],
                            "total_spent": 0,
                        }
                    }
                )

            cache.set(cache_key, stats, ttl=60)
            return stats

        except Exception as e:
            logger.error(f"Error in get_dashboard_stats: {e}")
            raise

    # ======================
    # OPTIMIZED DIRECT ASSIGNMENT (Algerian Specific)
    # ======================

    @staticmethod
    async def assign_project_directly(
        project_id: int,
        freelancer_id: int,
        client_id: int,
        contract_data: Optional[ContractCreate] = None,
    ) -> Dict[str, Any]:
        """Directly assign a project to a freelancer (Algerian-style) - OPTIMIZED"""
        try:
            # Verify client can assign
            can_client_assign = await FreelanceService._can_act_as_client(client_id)
            if not can_client_assign:
                raise ValueError("Vous ne pouvez pas assigner de projets")

            # Verify freelancer can accept assignments
            can_freelancer_accept = await FreelanceService._can_act_as_freelancer(
                freelancer_id
            )
            if not can_freelancer_accept:
                raise ValueError("Le freelancer ne peut pas accepter d'assignations")

            # Get project
            project = await prisma.project.find_unique(where={"id": project_id})

            if not project:
                raise ValueError("Projet non trouvé")

            if project.ownerId != client_id:
                raise ValueError("Vous n'êtes pas le propriétaire de ce projet")

            if project.status != "OPEN":
                raise ValueError("Le projet n'est pas ouvert aux assignations")

            # Check if freelancer has already proposed
            existing_proposal = await prisma.proposal.find_first(
                where={"projectId": project_id, "freelancerId": freelancer_id}
            )

            # Start transaction
            async with prisma.tx() as transaction:
                # ── Serialize per-project assignment (P0) ──
                # Row-lock the project so concurrent direct assignments cannot
                # both pass the OPEN re-check and create duplicate contracts.
                locked = await transaction.execute_raw(
                    'SELECT id FROM "Project" WHERE id = $1 FOR UPDATE',
                    project_id,
                )
                if not locked:
                    raise ValueError("Projet non trouvé")

                current = await transaction.project.find_unique(
                    where={"id": project_id}
                )
                if not current or current.status != "OPEN":
                    raise ValueError("Le projet n'est plus ouvert aux assignations")

                # Reject when the project already has a live contract.
                existing_contract = await transaction.contract.find_first(
                    where={
                        "projectId": project_id,
                        "status": {"in": ["ACTIVE", "COMPLETED"]},
                    }
                )
                if existing_contract:
                    raise ValueError(
                        "Ce projet possède déjà un contrat actif ou terminé"
                    )

                # Update project status
                await transaction.project.update(
                    where={"id": project_id}, data={"status": "IN_PROGRESS"}
                )

                # Create contract directly (no proposal needed)
                # Build contract terms
                base_terms = [
                    f"Contrat assigné directement pour le projet '{project.title}'",
                    f"Client: ID {client_id}",
                    f"Freelancer: ID {freelancer_id}",
                ]

                contract_amount = contract_data.amount if contract_data else None

                # Add custom terms if provided
                if contract_data and contract_data.terms:
                    contract_terms = contract_data.terms
                    # Add amount to custom terms if provided
                    if contract_amount:
                        contract_terms += f"\nMontant: {contract_amount:,} centimes DA"
                else:
                    # Use base terms
                    contract_terms = "\n".join(base_terms)
                    # Add amount to base terms if provided
                    if contract_amount:
                        contract_terms += f"\nMontant: {contract_amount:,} centimes DA"

                contract_data_dict = {
                    "projectId": project_id,
                    "freelancerId": freelancer_id,
                    "clientId": client_id,
                    "status": "ACTIVE",
                    "terms": contract_terms,
                    "amount": contract_amount or 0,
                    "startDate": contract_data.start_date
                    if contract_data
                    else datetime.now(timezone.utc),
                }

                # Add endDate if provided
                if contract_data and contract_data.end_date:
                    contract_data_dict["endDate"] = contract_data.end_date

                contract = await transaction.contract.create(data=contract_data_dict)

                # If there was an existing proposal, update it
                if existing_proposal:
                    await transaction.proposal.update(
                        where={"id": existing_proposal.id}, data={"status": "ACCEPTED"}
                    )

            # Clear cache
            cache.delete_pattern(f"project:{project_id}:")
            cache.delete_pattern("projects:")
            cache.delete_pattern(f"user_contracts:{freelancer_id}:")
            cache.delete_pattern(f"user_contracts:{client_id}:")
            cache.delete_pattern(f"user_proposals:{freelancer_id}:")

            # Send notification asynchronously
            run_background(
                FreelanceService._send_notification(
                    user_id=freelancer_id,
                    type="PROJECT_ASSIGNED",
                    title="Projet assigné!",
                    body=f"Le projet '{project.title}' vous a été assigné directement",
                    data={
                        "project_id": project_id,
                        "contract_id": contract.id,
                        "client_id": client_id,
                    },
                ),
                name=f"notify_assign_{freelancer_id}",
            )

            # Auto-create messaging conversation for the contract
            try:
                from app.services.messaging_service import MessagingService

                run_background(
                    MessagingService.get_or_create_contract_conversation(
                        contract_id=contract.id,
                        client_id=client_id,
                        freelancer_id=freelancer_id,
                    ),
                    name=f"create_conversation_{contract.id}",
                )
            except Exception as msg_err:
                logger.warning(
                    "Failed to schedule conversation creation for contract %s: %s",
                    contract.id,
                    msg_err,
                )
            return FreelanceService._format_contract_response(contract)

        except Exception as e:
            logger.error(f"Error in assign_project_directly: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to assign project: {str(e)}")

    # ======================
    # OPTIMIZED PUBLIC INFO METHODS
    # ======================

    @staticmethod
    async def list_public_projects(
        search_params: "PublicProjectSearch",
    ) -> Dict[str, Any]:
        """List projects for public/unauthenticated users - OPTIMIZED"""
        try:
            cache_key = f"public_projects:search:{search_params.search}:skills:{','.join(search_params.skills) if search_params.skills else 'none'}:skip:{search_params.skip}:limit:{search_params.limit}"
            cached = cache.get(cache_key)
            if cached:
                return cached

            # Build where conditions - only show OPEN projects to public
            where_conditions = {"status": "OPEN"}

            if search_params.search:
                where_conditions["OR"] = [
                    {
                        "title": {
                            "contains": search_params.search,
                            "mode": "insensitive",
                        }
                    },
                    {
                        "description": {
                            "contains": search_params.search,
                            "mode": "insensitive",
                        }
                    },
                ]

            if search_params.skills:
                where_conditions["skills"] = {
                    "has_some": search_params.skills[:10]
                }  # Limit to 10 skills

            # Get projects with limited owner info
            projects = await prisma.project.find_many(
                where=where_conditions,
                skip=search_params.skip,
                take=search_params.limit,
                order={"createdAt": "desc"},
                include={"owner": True},
            )

            total = await prisma.project.count(where=where_conditions)

            # Format response with limited info
            formatted_projects = []
            for project in projects:
                owner_info = None
                if project.owner:
                    owner_info = {
                        "id": project.owner.id,
                        "fullName": project.owner.fullName,
                        "profilePictureUrl": project.owner.profilePictureUrl,
                        "country": project.owner.country,
                        "city": project.owner.city,
                    }

                formatted_projects.append(
                    {
                        "id": project.id,
                        "title": project.title,
                        "description": project.description,
                        "skills": project.skills,
                        "status": project.status,
                        "createdAt": project.createdAt,
                        "owner": owner_info,
                    }
                )

            result = {
                "projects": formatted_projects,
                "total": total,
                "skip": search_params.skip,
                "limit": search_params.limit,
            }

            cache.set(cache_key, result, ttl=120)
            return result

        except Exception as e:
            logger.error(f"Error in list_public_projects: {e}", exc_info=True)
            raise

    @staticmethod
    async def search_public_freelancers(
        search_params: "PublicFreelancerSearch",
    ) -> Dict[str, Any]:
        """Search for freelancers for public/unauthenticated users - OPTIMIZED"""
        try:
            cache_key = f"public_freelancers:search:{search_params.search}:skills:{','.join(search_params.skills) if search_params.skills else 'none'}:certs:{search_params.has_certificates}:budget:{search_params.min_budget}-{search_params.max_budget}:cat:{search_params.category}:rating:{search_params.rating_min}:skip:{search_params.skip}:limit:{search_params.limit}"
            cached = cache.get(cache_key)
            if cached:
                return cached

            result = await FreelanceService._search_freelancers_common(
                search_params, include_private_fields=False
            )
            cache.set(cache_key, result, ttl=120)
            return result

        except Exception as e:
            logger.error(f"Error in search_public_freelancers: {str(e)}", exc_info=True)
            raise

    @staticmethod
    async def get_public_project(project_id: int) -> Dict[str, Any]:
        """Get project details for public/unauthenticated users - OPTIMIZED"""
        try:
            cache_key = f"public_project:{project_id}"
            cached = cache.get(cache_key)
            if cached:
                return cached

            project = await prisma.project.find_unique(
                where={"id": project_id, "status": "OPEN"}, include={"owner": True}
            )

            if not project:
                raise ValueError("Projet non trouvé ou non public")

            owner_info = None
            if project.owner:
                owner_info = {
                    "id": project.owner.id,
                    "fullName": project.owner.fullName,
                    "profilePictureUrl": project.owner.profilePictureUrl,
                    "country": project.owner.country,
                    "city": project.owner.city,
                }

            result = {
                "id": project.id,
                "title": project.title,
                "description": project.description,
                "skills": project.skills,
                "status": project.status,
                "createdAt": project.createdAt,
                "owner": owner_info,
            }

            cache.set(cache_key, result, ttl=300)
            return result

        except ValueError:
            logger.warning(f"Public project not found: {project_id}")
            raise
        except Exception as e:
            logger.error(f"Error in get_public_project: {e}", exc_info=True)
            raise

    @staticmethod
    async def get_public_freelancer_profile(user_id: int) -> Dict[str, Any]:
        """Get freelancer profile for public/unauthenticated users - OPTIMIZED"""
        try:
            cache_key = f"public_freelancer_profile:{user_id}"
            cached = cache.get(cache_key)
            if cached:
                return cached

            # Get user
            user = await prisma.user.find_unique(
                where={
                    "id": user_id,
                    "role": {"in": ["FREELANCER", "INSTRUCTOR", "ADMIN", "STUDENT"]},
                    "isActive": True,
                    "deletedAt": None,
                }
            )

            if not user:
                raise ValueError("Freelancer non trouvé")

            # Get limited stats in parallel
            certificates_count_task = prisma.certificate.count(
                where={"userId": user_id}
            )

            completed_projects_task = prisma.contract.count(
                where={"freelancerId": user_id, "status": "COMPLETED"}
            )

            recent_projects_task = prisma.contract.find_many(
                where={"freelancerId": user_id, "status": "COMPLETED"},
                take=5,
                include={"project": True},
                order={"createdAt": "desc"},
            )

            (
                certificates_count,
                completed_projects,
                recent_projects,
            ) = await asyncio.gather(
                certificates_count_task, completed_projects_task, recent_projects_task
            )

            # Format completed projects for public view
            formatted_projects = []
            for contract in recent_projects:
                if contract.project:
                    description = contract.project.description
                    if description and len(description) > 100:
                        description = description[:100] + "..."

                    formatted_projects.append(
                        {
                            "id": contract.project.id,
                            "title": contract.project.title,
                            "description": description,
                        }
                    )

            # Calculate trust score
            trust_score = (
                (user.phoneVerified * 30)
                + (certificates_count * 20)
                + (completed_projects * 10)
            )

            result = {
                "id": user.id,
                "fullName": user.fullName,
                "bio": user.bio,
                "profilePictureUrl": user.profilePictureUrl,
                "skills": user.skills,
                "city": user.city,
                "country": user.country,
                "phone_verified": user.phoneVerified,
                "role": user.role,
                "certificates_count": certificates_count,
                "completed_projects": completed_projects,
                "recent_projects": formatted_projects,
                "trust_score": trust_score,
            }

            cache.set(cache_key, result, ttl=300)
            return result

        except Exception as e:
            logger.error(f"Error in get_public_freelancer_profile: {e}")
            raise

    # ======================
    # DISPUTE METHODS
    # ======================

    @staticmethod
    async def create_dispute(
        contract_id: int, dispute_data: DisputeCreate, user_id: int
    ) -> Dict[str, Any]:
        """Open a dispute for a contract - ATOMIC"""
        try:
            # 1. Fetch contract
            contract = await prisma.contract.find_unique(
                where={"id": contract_id}, include={"project": True}
            )

            if not contract:
                raise ValueError("Contrat non trouvé")

            # 2. Verify user is party to contract
            if user_id != contract.clientId and user_id != contract.freelancerId:
                raise ValueError(
                    "Vous n'êtes pas autorisé à ouvrir un litige pour ce contrat"
                )

            # 3. Verify contract state
            if contract.status in ["CANCELLED", "COMPLETED"]:
                raise ValueError(
                    f"Impossible d'ouvrir un litige pour un contrat {contract.status}"
                )

            if contract.status == "DISPUTED":
                raise ValueError("Un litige est déjà en cours pour ce contrat")

            opponent_id = (
                contract.freelancerId
                if user_id == contract.clientId
                else contract.clientId
            )

            # 4. Atomic Transaction: Create Dispute + Mark Contract
            async with prisma.tx() as tx:
                dispute = await tx.dispute.create(
                    data={
                        "contractId": contract_id,
                        "creatorId": user_id,
                        "opponentId": opponent_id,
                        "reason": dispute_data.reason.value,
                        "description": dispute_data.description,
                        "status": "OPEN",
                        "metadata": Json(
                            {
                                "contract_snapshot": {
                                    "status": contract.status,
                                    "amount": contract.amount,
                                }
                            }
                        ),
                    }
                )

                await tx.contract.update(
                    where={"id": contract_id}, data={"status": "DISPUTED"}
                )

                # Audit Log
                await tx.auditlog.create(
                    data={
                        "eventType": "dispute_opened",
                        "entityType": "dispute",
                        "entityId": str(dispute.id),
                        "actorId": user_id,
                        "metadata": Json(
                            {
                                "contract_id": contract_id,
                                "reason": dispute_data.reason.value,
                            }
                        ),
                    }
                )

            # 5. Notify parties
            run_background(
                FreelanceService._send_notification(
                    user_id=opponent_id,
                    type="CONTRACT_DISPUTED",
                    title="notifications.contract.disputed.title",
                    body="notifications.contract.disputed.message",
                    variables={"contract_id": str(contract_id)},
                    data={"contract_id": contract_id, "dispute_id": dispute.id},
                ),
                name=f"notify_dispute_{dispute.id}",
            )

            return {
                "id": dispute.id,
                "contractId": dispute.contractId,
                "creatorId": dispute.creatorId,
                "opponentId": dispute.opponentId,
                "reason": dispute.reason,
                "description": dispute.description,
                "status": dispute.status,
                "createdAt": dispute.createdAt,
                "updatedAt": dispute.updatedAt,
            }

        except Exception as e:
            logger.error(f"Error creating dispute: {e}")
            raise

    @staticmethod
    async def get_contract_disputes(
        contract_id: int, user_id: int
    ) -> List[Dict[str, Any]]:
        """List disputes for a specific contract"""
        try:
            # Verify user is party to contract
            contract = await prisma.contract.find_unique(where={"id": contract_id})
            if not contract:
                raise ValueError("Contrat non trouvé")

            if user_id != contract.clientId and user_id != contract.freelancerId:
                raise ValueError("Accès refusé")

            disputes = await prisma.dispute.find_many(
                where={"contractId": contract_id}, order={"createdAt": "desc"}
            )

            return [
                {
                    "id": d.id,
                    "contractId": d.contractId,
                    "creatorId": d.creatorId,
                    "opponentId": d.opponentId,
                    "reason": d.reason,
                    "description": d.description,
                    "status": d.status,
                    "createdAt": d.createdAt,
                    "updatedAt": d.updatedAt,
                }
                for d in disputes
            ]
        except Exception as e:
            logger.error(f"Error fetching contract disputes: {e}")
            raise

    # =========================================================================
    # RATING & REVIEWS SYSTEM
    # =========================================================================

    # Core configurable constants
    REVIEW_ELIGIBILITY_DAYS = 30
    REVIEW_EDIT_WINDOW_HOURS = 48
    BLIND_REVIEW_REVEAL_DAYS = 14

    @staticmethod
    async def get_review_eligibility(user_id: int, contract_id: int) -> Dict[str, Any]:
        """Check if user can review this contract, returning metadata."""
        try:
            contract = await prisma.contract.find_unique(
                where={"id": contract_id}, include={"deliveries": True}
            )
            if not contract:
                raise ValueError("Contrat non trouvé")

            is_freelancer = contract.freelancerId == user_id
            is_client = contract.clientId == user_id

            if not is_freelancer and not is_client:
                raise ValueError("Accès refusé")

            status_reason = None
            is_eligible = True

            # Rule 1: Contract must be COMPLETED
            if contract.status != "COMPLETED":
                is_eligible = False
                status_reason = "Le contrat doit être terminé pour laisser un avis."

            # Rule 2: Must have at least 1 delivery (approved work proxy)
            if is_eligible and len(contract.deliveries or []) == 0:
                is_eligible = False
                status_reason = (
                    "Aucun travail (livraison) n'a été enregistré pour ce contrat."
                )

            # Rule 3: Time window
            if is_eligible and contract.updatedAt:
                days_since_comp = (
                    datetime.now(timezone.utc).replace(tzinfo=timezone.utc)
                    - contract.updatedAt
                ).days
                if days_since_comp > FreelanceService.REVIEW_ELIGIBILITY_DAYS:
                    is_eligible = False
                    status_reason = f"La période d'évaluation ({FreelanceService.REVIEW_ELIGIBILITY_DAYS} jours) a expiré."

            # Rule 4: Already reviewed
            existing_review = await prisma.contractreview.find_unique(
                where={
                    "contractId_authorId": {
                        "contractId": contract_id,
                        "authorId": user_id,
                    }
                }
            )
            has_reviewed = existing_review is not None

            if is_eligible and has_reviewed:
                is_eligible = False
                status_reason = "Vous avez déjà laissé un avis pour ce contrat."

            return {
                "is_eligible": is_eligible,
                "has_reviewed": has_reviewed,
                "reason": status_reason,
                "target_id": contract.clientId
                if is_freelancer
                else contract.freelancerId,
                "role": "FREELANCER" if is_freelancer else "CLIENT",
                "review": existing_review.model_dump() if existing_review else None,
            }
        except Exception as e:
            logger.error(f"Error checking review eligibility: {e}")
            raise

    @staticmethod
    async def get_contract_reviews(contract_id: int, user_id: int) -> Dict[str, Any]:
        """Fetch reviews for a contract, respecting blind review rules."""
        try:
            # Check user role on contract
            contract = await prisma.contract.find_unique(where={"id": contract_id})
            if not contract:
                raise ValueError("Contrat non trouvé")

            is_party = contract.clientId == user_id or contract.freelancerId == user_id
            _u = await prisma.user.find_unique(where={"id": user_id})
            is_admin = bool(_u and _u.role == "ADMIN")

            reviews = await prisma.contractreview.find_many(
                where={"contractId": contract_id},
                include={"author": True, "target": True},
            )

            # Check if timeframe has passed for blind reveal
            days_passed = (
                (
                    datetime.now(timezone.utc).replace(tzinfo=timezone.utc)
                    - contract.updatedAt
                ).days
                if contract.updatedAt
                else 0
            )
            blind_expired = days_passed >= FreelanceService.BLIND_REVIEW_REVEAL_DAYS

            # Determine visibility flag
            client_reviewed = any(
                r.reviewType == "CLIENT_TO_FREELANCER" for r in reviews
            )
            freelancer_reviewed = any(
                r.reviewType == "FREELANCER_TO_CLIENT" for r in reviews
            )

            both_reviewed = client_reviewed and freelancer_reviewed

            visible_reviews = []

            for review in reviews:
                is_author = review.authorId == user_id

                # Rule: A review is public if BOTH reviewed, OR the blind period expired, OR the caller is the author/admin
                should_reveal = both_reviewed or blind_expired or is_author or is_admin

                # Update DB state if necessary
                if should_reveal and not review.isPublic:
                    await prisma.contractreview.update(
                        where={"id": review.id}, data={"isPublic": True}
                    )
                    review.isPublic = True

                # Check redaction status
                if review.status == "REDACTED" and not is_admin:
                    continue  # Hide redacted from everyone except admins

                # Output masking
                if should_reveal:
                    visible_reviews.append(
                        ReviewResponse.model_validate(review.model_dump())
                    )
                else:
                    if is_party:
                        # Allow parties to know a review exists, but hide the content
                        masked = ReviewResponse.model_validate(review.model_dump())
                        masked.rating = 0
                        masked.subRatings = {}
                        masked.comment = "Blind Review - Hidden until you leave a review or 14 days pass."
                        visible_reviews.append(masked)

            return {
                "reviews": visible_reviews,
                "both_reviewed": both_reviewed,
                "blind_expired": blind_expired,
            }
        except Exception as e:
            logger.error(f"Error fetching contract reviews: {e}")
            raise

    @staticmethod
    async def submit_review(
        user_id: int, contract_id: int, review_data: ReviewCreate
    ) -> ReviewResponse:
        """Submit a new contract review."""
        try:
            # 1. Check eligibility
            eligibility = await FreelanceService.get_review_eligibility(
                user_id, contract_id
            )
            if not eligibility["is_eligible"]:
                raise ValueError(
                    eligibility.get(
                        "reason", "You are not eligible to review this contract."
                    )
                )

            target_id = eligibility["target_id"]
            review_type = (
                "CLIENT_TO_FREELANCER"
                if eligibility["role"] == "CLIENT"
                else "FREELANCER_TO_CLIENT"
            )

            # 2. Check if the other party has reviewed to determine initial public state
            other_review = await prisma.contractreview.find_unique(
                where={
                    "contractId_authorId": {
                        "contractId": contract_id,
                        "authorId": target_id,
                    }
                }
            )
            has_other_review = other_review is not None

            async with prisma.tx() as tx:
                # 3. Create Review
                review = await tx.contractreview.create(
                    data={
                        "contractId": contract_id,
                        "authorId": user_id,
                        "targetId": target_id,
                        "reviewType": review_type,
                        "rating": review_data.rating,
                        "subRatings": Json(review_data.subRatings),
                        "comment": review_data.comment,
                        "isPublic": has_other_review,
                    }
                )

                # 4. If both reviewed, update the other to be public
                if has_other_review and not other_review.isPublic:
                    await tx.contractreview.update(
                        where={"id": other_review.id}, data={"isPublic": True}
                    )

            # 5. Async recalculate average rating for the target
            run_background(
                FreelanceService.recalculate_user_rating(target_id),
                name=f"recalc_rating_{target_id}",
            )

            return ReviewResponse.model_validate(review.model_dump())
        except Exception as e:
            logger.error(f"Error submitting review: {e}")
            raise

    @staticmethod
    async def edit_review(
        user_id: int, review_id: int, review_data: ReviewUpdate
    ) -> ReviewResponse:
        """Edit a submitted review within the 48 hour window."""
        try:
            review = await prisma.contractreview.find_unique(where={"id": review_id})
            if not review or review.authorId != user_id:
                raise ValueError("Avis introuvable ou accès refusé.")

            # Check 48 hour window
            hours_since_creation = (
                datetime.now(timezone.utc).replace(tzinfo=timezone.utc)
                - review.createdAt
            ).total_seconds() / 3600
            if hours_since_creation > FreelanceService.REVIEW_EDIT_WINDOW_HOURS:
                raise ValueError(
                    f"Vous ne pouvez plus modifier cet avis après {FreelanceService.REVIEW_EDIT_WINDOW_HOURS} heures."
                )

            # Prepare update
            update_data = {
                "editCount": review.editCount + 1,
                "lastEditedAt": datetime.now(timezone.utc),
            }
            if review_data.rating is not None:
                update_data["rating"] = review_data.rating
            if review_data.comment is not None:
                update_data["comment"] = review_data.comment
            if review_data.subRatings is not None:
                update_data["subRatings"] = Json(review_data.subRatings)

            updated = await prisma.contractreview.update(
                where={"id": review_id}, data=update_data
            )

            # Recalculate average rating for the target
            run_background(
                FreelanceService.recalculate_user_rating(updated.targetId),
                name=f"recalc_rating_{updated.targetId}",
            )

            return ReviewResponse.model_validate(updated.model_dump())
        except Exception as e:
            logger.error(f"Error editing review: {e}")
            raise

    @staticmethod
    async def submit_appeal(
        user_id: int, review_id: int, appeal_data: AppealCreate
    ) -> AppealResponse:
        """Target of a review appeals its validity."""
        try:
            review = await prisma.contractreview.find_unique(where={"id": review_id})
            if not review:
                raise ValueError("Avis introuvable.")

            if review.targetId != user_id:
                raise ValueError(
                    "Vous ne pouvez faire appel que des avis vous concernant."
                )

            # Check if active appeal exists
            existing = await prisma.reviewappeal.find_first(
                where={"reviewId": review_id, "status": "PENDING"}
            )
            if existing:
                raise ValueError("Un appel est déjà en cours pour cet avis.")

            appeal = await prisma.reviewappeal.create(
                data={
                    "reviewId": review_id,
                    "appealerId": user_id,
                    "reason": appeal_data.reason,
                    "evidenceUrls": Json(appeal_data.evidenceUrls)
                    if appeal_data.evidenceUrls
                    else None,
                }
            )

            # Mark review as PENDING_APPEAL
            await prisma.contractreview.update(
                where={"id": review_id}, data={"status": "PENDING_APPEAL"}
            )

            return AppealResponse.model_validate(appeal.model_dump())
        except Exception as e:
            logger.error(f"Error submitting appeal: {e}")
            raise

    @staticmethod
    async def recalculate_user_rating(user_id: int):
        """Background task to recalculate a user's average rating based on valid active public reviews."""
        try:
            # We only count ACTIVE and public reviews
            reviews = await prisma.contractreview.find_many(
                where={"targetId": user_id, "status": "ACTIVE", "isPublic": True},
            )

            if not reviews:
                avg = 0.0
            else:
                total = sum([r.rating for r in reviews])
                avg = round(total / len(reviews), 2)

            # Update FreelancerProfile (if user is a freelancer, this will exist)
            profile = await prisma.freelancerprofile.find_unique(
                where={"userId": user_id}
            )
            if profile:
                await prisma.freelancerprofile.update(
                    where={"id": profile.id}, data={"avgRating": avg}
                )

            # Log successful recalculation
            logger.info(
                f"Recalculated rating for user {user_id}: {avg} from {len(reviews)} reviews"
            )
        except Exception as e:
            logger.error(f"Failed to recalculate rating for user {user_id}: {e}")

    @staticmethod
    async def get_freelancer_rating_summary(user_id: int) -> Dict[str, Any]:
        """Get full sub-rating breakdown, distribution, and response rate for a freelancer."""
        try:
            user = await prisma.user.find_unique(where={"id": user_id})
            if not user:
                raise ValueError("Utilisateur non trouvé")

            reviews = await prisma.contractreview.find_many(
                where={"targetId": user_id, "isPublic": True, "status": "ACTIVE"}
            )

            total_reviews = len(reviews)

            distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
            total_score = 0

            for r in reviews:
                dist_score = round(r.overallRating)
                if 1 <= dist_score <= 5:
                    distribution[dist_score] += 1
                total_score += r.overallRating

            average_rating = (
                round(total_score / total_reviews, 2) if total_reviews > 0 else 0.0
            )

            completed_contracts = await prisma.contract.count(
                where={
                    "OR": [{"freelancerId": user_id}, {"clientId": user_id}],
                    "status": "COMPLETED",
                }
            )
            response_rate = round(
                (completed_contracts / total_reviews * 100)
                if total_reviews > 0
                else 100.0,
                1,
            )

            return {
                "totalReviews": total_reviews,
                "averageRating": average_rating,
                "ratingDistribution": distribution,
                "responseRate": response_rate,
            }
        except Exception as e:
            logger.error(f"Error getting rating summary: {e}")
            raise

    @staticmethod
    async def get_contract_review_status(
        contract_id: int, user_id: int
    ) -> Dict[str, Any]:
        """Get the current review state for both parties."""
        try:
            contract = await prisma.contract.find_unique(where={"id": contract_id})
            if not contract:
                raise ValueError("Contrat non trouvé")

            is_freelancer = contract.freelancerId == user_id
            is_client = contract.clientId == user_id
            if not is_freelancer and not is_client:
                raise ValueError("Accès refusé")

            reviews = await prisma.contractreview.find_many(
                where={"contractId": contract_id}
            )

            client_review = next(
                (r for r in reviews if r.authorId == contract.clientId), None
            )
            freelancer_review = next(
                (r for r in reviews if r.authorId == contract.freelancerId), None
            )

            my_review = freelancer_review if is_freelancer else client_review

            is_blind = True
            can_edit = False

            if my_review:
                time_since_creation = (
                    datetime.now(timezone.utc).replace(tzinfo=timezone.utc)
                    - my_review.createdAt
                ).total_seconds() / 3600
                can_edit = (
                    time_since_creation <= FreelanceService.REVIEW_EDIT_WINDOW_HOURS
                    and my_review.status != "PENDING_APPEAL"
                )
                if my_review.isPublic:
                    is_blind = False

            return {
                "clientReviewStatus": client_review.status if client_review else None,
                "freelancerReviewStatus": freelancer_review.status
                if freelancer_review
                else None,
                "isBlind": is_blind
                if not (client_review and freelancer_review)
                else False,
                "canEdit": can_edit,
            }
        except Exception as e:
            logger.error(f"Error getting review status: {e}")
            raise

    @staticmethod
    async def submit_review_report(
        review_id: int, reporter_id: int, reason: str
    ) -> Dict[str, Any]:
        """Submit a soft report on a review."""
        try:
            review = await prisma.contractreview.find_unique(where={"id": review_id})
            if not review:
                raise ValueError("Avis introuvable")

            report = await prisma.reviewreport.create(
                data={
                    "reviewId": review_id,
                    "reporterId": reporter_id,
                    "reason": reason,
                    "status": "PENDING",
                }
            )
            return report.model_dump()
        except Exception as e:
            logger.error(f"Error submitting review report: {e}")
            raise

    # ======================
    # ADMIN METHODS
    # ======================

    @staticmethod
    async def list_all_disputes(
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Admin: List all disputes with optional status filter."""
        try:
            where = {}
            if status:
                where["status"] = status

            total, disputes = await asyncio.gather(
                prisma.dispute.count(where=where),
                prisma.dispute.find_many(
                    where=where,
                    order={"createdAt": "desc"},
                    skip=skip,
                    take=limit,
                    include={
                        "contract": {"include": {"project": True}},
                        "creator": True,
                        "opponent": True,
                    },
                ),
            )

            return {
                "items": [d.model_dump() for d in disputes],
                "total": total,
                "skip": skip,
                "limit": limit,
                "has_more": (skip + limit) < total,
            }
        except Exception as e:
            logger.error(f"Error listing disputes: {e}")
            raise

    @staticmethod
    async def resolve_dispute(
        dispute_id: int,
        admin_id: int,
        resolution: str,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Admin: Resolve a dispute."""
        try:
            dispute = await prisma.dispute.find_unique(
                where={"id": dispute_id}, include={"contract": True}
            )
            if not dispute:
                raise ValueError("Litige non trouvé")

            if dispute.status == "RESOLVED":
                raise ValueError("Ce litige est déjà résolu")

            async with prisma.tx() as tx:
                updated = await tx.dispute.update(
                    where={"id": dispute_id},
                    data={
                        "status": "RESOLVED",
                        "resolutionReason": resolution,
                        "resolutionNotes": notes,
                        "resolvedById": admin_id,
                        "resolvedAt": datetime.now(timezone.utc),
                    },
                )

                if dispute.contract:
                    await tx.contract.update(
                        where={"id": dispute.contract.id}, data={"status": "COMPLETED"}
                    )

            cache.delete_pattern(f"contract:{dispute.contractId}:")
            return updated.model_dump()
        except Exception as e:
            logger.error(f"Error resolving dispute: {e}")
            raise

    @staticmethod
    async def list_all_appeals(
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Admin: List all review appeals with optional status filter."""
        try:
            where = {}
            if status:
                where["status"] = status

            total, appeals = await asyncio.gather(
                prisma.reviewappeal.count(where=where),
                prisma.reviewappeal.find_many(
                    where=where,
                    order={"createdAt": "desc"},
                    skip=skip,
                    take=limit,
                    include={"review": {"include": {"author": True, "target": True}}},
                ),
            )

            return {
                "items": [a.model_dump() for a in appeals],
                "total": total,
                "skip": skip,
                "limit": limit,
                "has_more": (skip + limit) < total,
            }
        except Exception as e:
            logger.error(f"Error listing appeals: {e}")
            raise

    @staticmethod
    async def resolve_appeal(
        appeal_id: int,
        admin_id: int,
        decision: str,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Admin: Approve or reject a review appeal."""
        try:
            appeal = await prisma.reviewappeal.find_unique(
                where={"id": appeal_id}, include={"review": True}
            )
            if not appeal:
                raise ValueError("Appel non trouvé")

            if appeal.status != "PENDING":
                raise ValueError("Cet appel a déjà été traité")

            new_review_status = "ACTIVE" if decision == "REJECTED" else "REDACTED"

            async with prisma.tx() as tx:
                updated = await tx.reviewappeal.update(
                    where={"id": appeal_id},
                    data={
                        "status": "APPROVED" if decision == "APPROVED" else "REJECTED",
                        "resolutionNotes": notes,
                        "resolvedById": admin_id,
                        "resolvedAt": datetime.now(timezone.utc),
                    },
                )

                await tx.contractreview.update(
                    where={"id": appeal.reviewId}, data={"status": new_review_status}
                )

            return updated.model_dump()
        except Exception as e:
            logger.error(f"Error resolving appeal: {e}")
            raise

    @staticmethod
    async def list_review_reports(
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Admin: List all review reports with optional status filter."""
        try:
            where = {}
            if status:
                where["status"] = status

            total, reports = await asyncio.gather(
                prisma.reviewreport.count(where=where),
                prisma.reviewreport.find_many(
                    where=where,
                    order={"createdAt": "desc"},
                    skip=skip,
                    take=limit,
                    include={"review": True, "reporter": True},
                ),
            )

            return {
                "items": [r.model_dump() for r in reports],
                "total": total,
                "skip": skip,
                "limit": limit,
                "has_more": (skip + limit) < total,
            }
        except Exception as e:
            logger.error(f"Error listing reports: {e}")
            raise

    @staticmethod
    async def redact_review(
        review_id: int,
        admin_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Admin: Redact a review (hide it from public view)."""
        try:
            review = await prisma.contractreview.find_unique(where={"id": review_id})
            if not review:
                raise ValueError("Avis non trouvé")

            updated = await prisma.contractreview.update(
                where={"id": review_id}, data={"status": "REDACTED"}
            )

            run_background(
                FreelanceService.recalculate_user_rating(review.targetId),
                name=f"recalc_rating_{review.targetId}",
            )

            return updated.model_dump()
        except Exception as e:
            logger.error(f"Error redacting review: {e}")
            raise

    @staticmethod
    async def get_admin_stats() -> Dict[str, Any]:
        """Admin: Get platform-wide freelancing statistics."""
        try:
            cache_key = "admin_freelance_stats"
            cached = cache.get(cache_key)
            if cached:
                return cached

            (
                total_projects,
                open_projects,
                total_contracts,
                active_contracts,
                total_disputes,
                pending_appeals,
                pending_reports,
            ) = await asyncio.gather(
                prisma.project.count(),
                prisma.project.count(where={"status": "OPEN"}),
                prisma.contract.count(),
                prisma.contract.count(where={"status": "ACTIVE"}),
                prisma.dispute.count(
                    where={"status": {"in": ["OPEN", "UNDER_REVIEW"]}}
                ),
                prisma.reviewappeal.count(where={"status": "PENDING"}),
                prisma.reviewreport.count(where={"status": "PENDING"}),
            )

            result = {
                "total_projects": total_projects,
                "open_projects": open_projects,
                "total_contracts": total_contracts,
                "active_contracts": active_contracts,
                "active_disputes": total_disputes,
                "pending_appeals": pending_appeals,
                "pending_reports": pending_reports,
            }

            cache.set(cache_key, result, ttl=300)
            return result
        except Exception as e:
            logger.error(f"Error getting admin stats: {e}")
            raise
