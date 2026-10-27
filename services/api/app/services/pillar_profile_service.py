"""Pillar profile service — student, instructor, freelancer, business profile enrichment."""

import logging
from typing import Any, Dict, Optional

from app.core.prisma import prisma

logger = logging.getLogger(__name__)


class PillarProfileService:
    """Handles enrichment and CRUD for pillar-specific profile data."""

    # ── STUDENT PROFILE ─────────────────────────────────────────────────

    async def get_student_profile(self, user_id: int) -> Optional[Dict[str, Any]]:
        profile = await prisma.studentprofile.find_unique(where={"userId": user_id})
        if not profile:
            return None
        return self._student_to_dict(profile)

    async def upsert_student_profile(self, user_id: int, data: dict) -> Dict[str, Any]:
        profile = await prisma.studentprofile.upsert(
            where={"userId": user_id},
            data={
                "create": {"userId": user_id, **data},
                "update": data,
            },
        )
        return self._student_to_dict(profile)

    async def get_student_learning_stats(self, user_id: int) -> Dict[str, Any]:
        enrollments = await prisma.enrollment.find_many(
            where={"userId": user_id, "deletedAt": None},
            include={"module": True, "path": True},
        )
        completed = [e for e in enrollments if e.completedAt]
        total_minutes = 0.0
        for e in enrollments:
            if e.module and e.module.durationMinutes:
                total_minutes += float(e.module.durationMinutes) * (
                    float(e.progress or 0) / 100.0
                )
            elif e.path and getattr(e.path, "durationMinutes", None):
                total_minutes += float(e.path.durationMinutes or 0) * (
                    float(e.progress or 0) / 100.0
                )
        total_hours = total_minutes / 60.0
        return {
            "total_enrollments": len(enrollments),
            "completed_courses": len(completed),
            "in_progress": len(enrollments) - len(completed),
            "total_learning_hours": round(total_hours, 1),
            "average_progress": round(
                sum(e.progress for e in enrollments) / max(len(enrollments), 1), 1
            ),
        }

    def _student_to_dict(self, profile) -> Dict[str, Any]:
        return {
            "id": profile.id,
            "user_id": profile.userId,
            "headline": profile.headline,
            "learning_goals": profile.learningGoals,
            "career_path": profile.careerPath,
            "total_learning_hours": profile.totalLearningHours,
            "completed_courses": profile.completedCourses,
            "average_quiz_score": profile.averageQuizScore,
            "best_subject": profile.bestSubject,
            "badges": profile.badges,
            "wishlist": profile.wishlist,
            "created_at": profile.createdAt.isoformat() if profile.createdAt else None,
            "updated_at": profile.updatedAt.isoformat() if profile.updatedAt else None,
        }

    # ── INSTRUCTOR PROFILE ──────────────────────────────────────────────

    async def get_instructor_profile(self, user_id: int) -> Optional[Dict[str, Any]]:
        profile = await prisma.instructorprofile.find_unique(where={"userId": user_id})
        if not profile:
            return None
        return self._instructor_to_dict(profile)

    async def upsert_instructor_profile(
        self, user_id: int, data: dict
    ) -> Dict[str, Any]:
        profile = await prisma.instructorprofile.upsert(
            where={"userId": user_id},
            data={
                "create": {"userId": user_id, **data},
                "update": data,
            },
        )
        return self._instructor_to_dict(profile)

    async def get_instructor_teaching_stats(self, user_id: int) -> Dict[str, Any]:
        modules = await prisma.module.find_many(
            where={"instructorId": user_id, "deletedAt": None}
        )
        module_ids = [m.id for m in modules]
        total_students = 0
        if module_ids:
            total_students = await prisma.enrollment.count(
                where={"moduleId": {"in": module_ids}, "deletedAt": None}
            )
            reviews = await prisma.coursereview.find_many(
                where={"moduleId": {"in": module_ids}}
            )
            ratings = [r.rating for r in reviews if r.rating is not None]
            avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else None
            total_reviews = len(reviews)
        else:
            avg_rating = None
            total_reviews = 0
        return {
            "total_courses": len(modules),
            "total_students": total_students,
            "average_rating": avg_rating,
            "total_reviews": total_reviews,
        }

    def _instructor_to_dict(self, profile) -> Dict[str, Any]:
        return {
            "id": profile.id,
            "user_id": profile.userId,
            "headline": profile.headline,
            "total_students": profile.totalStudents,
            "total_courses": profile.totalCourses,
            "total_course_hours": profile.totalCourseHours,
            "average_rating": profile.averageRating,
            "review_count": profile.reviewCount,
            "response_rate": profile.responseRate,
            "response_time_hours": profile.responseTimeHours,
            "languages": profile.languages,
            "credentials": profile.credentials,
            "work_experience": profile.workExperience,
            "publications": profile.publications,
            "teaching_categories": profile.teachingCategories,
            "featured_course_id": profile.featuredCourseId,
            "instructor_since": profile.instructorSince.isoformat()
            if profile.instructorSince
            else None,
            "satisfaction_rate": profile.satisfactionRate,
            "curriculum_vitae": profile.curriculumVitae,
            "research_interests": profile.researchInterests,
            "created_at": profile.createdAt.isoformat() if profile.createdAt else None,
            "updated_at": profile.updatedAt.isoformat() if profile.updatedAt else None,
        }

    # ── BUSINESS PROFILE ────────────────────────────────────────────────

    async def get_business_profile(self, user_id: int) -> Optional[Dict[str, Any]]:
        profile = await prisma.businessprofile.find_unique(where={"userId": user_id})
        if not profile:
            return None
        return self._business_to_dict(profile)

    async def upsert_business_profile(self, user_id: int, data: dict) -> Dict[str, Any]:
        profile = await prisma.businessprofile.upsert(
            where={"userId": user_id},
            data={
                "create": {"userId": user_id, **data},
                "update": data,
            },
        )
        return self._business_to_dict(profile)

    def _business_to_dict(self, profile) -> Dict[str, Any]:
        return {
            "id": profile.id,
            "user_id": profile.userId,
            "headline": profile.headline,
            "company_role": profile.companyRole,
            "department": profile.department,
            "industry": profile.industry,
            "company_size": profile.companySize,
            "years_of_experience": profile.yearsOfExperience,
            "areas_of_expertise": profile.areasOfExpertise,
            "linked_in": profile.linkedIn,
            "portfolio_url": profile.portfolioUrl,
            "created_at": profile.createdAt.isoformat() if profile.createdAt else None,
            "updated_at": profile.updatedAt.isoformat() if profile.updatedAt else None,
        }

    # ── FREELANCER SERVICE CATALOG ──────────────────────────────────────

    async def list_services(self, user_id: int, active_only: bool = True) -> list:
        where = {"userId": user_id}
        if active_only:
            where["isActive"] = True
        services = await prisma.freelancerservice.find_many(
            where=where, order={"createdAt": "desc"}
        )
        return [self._service_to_dict(s) for s in services]

    async def create_service(self, user_id: int, data: dict) -> Dict[str, Any]:
        service = await prisma.freelancerservice.create(
            data={"userId": user_id, **data}
        )
        return self._service_to_dict(service)

    async def update_service(
        self, service_id: int, user_id: int, data: dict
    ) -> Optional[Dict[str, Any]]:
        service = await prisma.freelancerservice.find_unique(where={"id": service_id})
        if not service or service.userId != user_id:
            return None
        updated = await prisma.freelancerservice.update(
            where={"id": service_id}, data=data
        )
        return self._service_to_dict(updated)

    async def delete_service(self, service_id: int, user_id: int) -> bool:
        service = await prisma.freelancerservice.find_unique(where={"id": service_id})
        if not service or service.userId != user_id:
            return False
        await prisma.freelancerservice.delete(where={"id": service_id})
        return True

    def _service_to_dict(self, s) -> Dict[str, Any]:
        return {
            "id": s.id,
            "user_id": s.userId,
            "title": s.title,
            "description": s.description,
            "category": s.category,
            "subcategory": s.subcategory,
            "pricing_type": s.pricingType,
            "price": s.price,
            "basic_price": s.basicPrice,
            "basic_description": s.basicDescription,
            "standard_price": s.standardPrice,
            "standard_description": s.standardDescription,
            "premium_price": s.premiumPrice,
            "premium_description": s.premiumDescription,
            "delivery_days": s.deliveryDays,
            "revisions": s.revisions,
            "images": s.images,
            "video": s.video,
            "is_active": s.isActive,
            "is_boosted": s.isBoosted,
            "order_count": s.orderCount,
            "average_rating": s.averageRating,
            "review_count": s.reviewCount,
            "view_count": s.viewCount,
            "tags": s.tags,
            "faq": s.faq,
            "requirements": s.requirements,
            "created_at": s.createdAt.isoformat() if s.createdAt else None,
        }

    # ── SKILL ENDORSEMENTS ──────────────────────────────────────────────

    async def endorse_skill(
        self, endorser_id: int, endorsed_id: int, skill_name: str
    ) -> dict:
        await prisma.skillendorsement.upsert(
            where={
                "skillName_endorserId_endorsedId": {
                    "skillName": skill_name,
                    "endorserId": endorser_id,
                    "endorsedId": endorsed_id,
                }
            },
            data={
                "create": {
                    "skillName": skill_name,
                    "endorserId": endorser_id,
                    "endorsedId": endorsed_id,
                },
                "update": {},
            },
        )
        count = await prisma.skillendorsement.count(
            where={"endorsedId": endorsed_id, "skillName": skill_name}
        )
        return {"skill": skill_name, "endorsements": count, "endorsed": True}

    async def remove_endorsement(
        self, endorser_id: int, endorsed_id: int, skill_name: str
    ) -> dict:
        await prisma.skillendorsement.delete_many(
            where={
                "skillName": skill_name,
                "endorserId": endorser_id,
                "endorsedId": endorsed_id,
            }
        )
        count = await prisma.skillendorsement.count(
            where={"endorsedId": endorsed_id, "skillName": skill_name}
        )
        return {"skill": skill_name, "endorsements": count, "endorsed": False}

    async def get_endorsements(self, user_id: int) -> list:
        endorsements = await prisma.skillendorsement.find_many(
            where={"endorsedId": user_id},
            include={"endorser": True},
            order={"createdAt": "desc"},
        )
        result = {}
        for e in endorsements:
            skill = e.skillName
            if skill not in result:
                result[skill] = {"skill": skill, "count": 0, "endorsers": []}
            result[skill]["count"] += 1
            result[skill]["endorsers"].append(
                {
                    "id": e.endorser.id,
                    "username": e.endorser.username,
                    "full_name": e.endorser.fullName,
                    "avatar_url": e.endorser.profilePictureUrl,
                }
            )
        return list(result.values())

    # ── ORGANIZATION PROFILE ────────────────────────────────────────────

    async def get_org_profile(self, org_id: int) -> Optional[Dict[str, Any]]:
        profile = await prisma.orgprofile.find_unique(where={"organizationId": org_id})
        if not profile:
            return None
        org = await prisma.organization.find_unique(where={"id": org_id})
        return {
            **self._org_profile_to_dict(profile),
            "organization_name": org.name if org else None,
            "organization_slug": org.slug if org else None,
        }

    async def upsert_org_profile(self, org_id: int, data: dict) -> Dict[str, Any]:
        profile = await prisma.orgprofile.upsert(
            where={"organizationId": org_id},
            data={
                "create": {"organizationId": org_id, **data},
                "update": data,
            },
        )
        return self._org_profile_to_dict(profile)

    def _org_profile_to_dict(self, p) -> Dict[str, Any]:
        return {
            "id": p.id,
            "organization_id": p.organizationId,
            "long_description": p.longDescription,
            "specialties": p.specialties,
            "technologies": p.technologies,
            "competitors": p.competitors,
            "funding_round": p.fundingRound,
            "funding_amount": p.fundingAmount,
            "revenue_range": p.revenueRange,
            "products": p.products,
            "jobs": p.jobs,
            "culture": p.culture,
            "benefits": p.benefits,
            "mission": p.mission,
            "achievements": p.achievements,
            "certifications": p.certifications,
            "map_location": p.mapLocation,
            "algerian_health_score": p.algerianHealthScore,
            "created_at": p.createdAt.isoformat() if p.createdAt else None,
            "updated_at": p.updatedAt.isoformat() if p.updatedAt else None,
        }

    # ── ORGANIZATION REVIEWS ────────────────────────────────────────────

    async def create_org_review(
        self, org_id: int, user_id: int, data: dict
    ) -> Dict[str, Any]:
        existing = await prisma.orgreview.find_unique(
            where={
                "organizationId_userId": {"organizationId": org_id, "userId": user_id}
            }
        )
        if existing:
            raise ValueError("You have already reviewed this organization")
        review = await prisma.orgreview.create(
            data={"organizationId": org_id, "userId": user_id, **data}
        )
        await self._update_org_avg_rating(org_id)
        return self._review_to_dict(review)

    async def get_org_reviews(self, org_id: int) -> list:
        reviews = await prisma.orgreview.find_many(
            where={"organizationId": org_id},
            include={"user": True},
            order={"createdAt": "desc"},
            take=50,
        )
        return [self._review_to_dict(r) for r in reviews]

    async def _update_org_avg_rating(self, org_id: int):
        reviews = await prisma.orgreview.find_many(where={"organizationId": org_id})
        if reviews:
            avg = sum(r.rating for r in reviews) / len(reviews)
            await prisma.organization.update(
                where={"id": org_id},
                data={"avgRating": round(avg, 2), "reviewCount": len(reviews)},
            )

    def _review_to_dict(self, r) -> Dict[str, Any]:
        return {
            "id": r.id,
            "organization_id": r.organizationId,
            "user_id": r.userId,
            "user_name": getattr(r.user, "fullName", None)
            if hasattr(r, "user")
            else None,
            "user_avatar": getattr(r.user, "profilePictureUrl", None)
            if hasattr(r, "user")
            else None,
            "rating": r.rating,
            "title": r.title,
            "comment": r.comment,
            "is_recommended": r.isRecommended,
            "created_at": r.createdAt.isoformat() if r.createdAt else None,
        }

    # ── ORGANIZATION FOLLOW ─────────────────────────────────────────────

    async def follow_org(self, org_id: int, user_id: int) -> dict:
        await prisma.orgfollow.upsert(
            where={
                "organizationId_userId": {"organizationId": org_id, "userId": user_id}
            },
            data={
                "create": {"organizationId": org_id, "userId": user_id},
                "update": {},
            },
        )
        count = await prisma.orgfollow.count(where={"organizationId": org_id})
        await prisma.organization.update(
            where={"id": org_id}, data={"followerCount": count}
        )
        return {"status": "following", "follower_count": count}

    async def unfollow_org(self, org_id: int, user_id: int) -> dict:
        await prisma.orgfollow.delete_many(
            where={"organizationId": org_id, "userId": user_id}
        )
        count = await prisma.orgfollow.count(where={"organizationId": org_id})
        await prisma.organization.update(
            where={"id": org_id}, data={"followerCount": count}
        )
        return {"status": "unfollowed", "follower_count": count}

    async def get_org_followers(self, org_id: int) -> list:
        follows = await prisma.orgfollow.find_many(
            where={"organizationId": org_id},
            include={"user": True},
            order={"createdAt": "desc"},
            take=50,
        )
        return [
            {
                "id": f.user.id,
                "username": f.user.username,
                "full_name": f.user.fullName,
                "avatar_url": f.user.profilePictureUrl,
                "followed_at": f.createdAt.isoformat() if f.createdAt else None,
            }
            for f in follows
        ]

    # ── PUBLIC DASHBOARD ────────────────────────────────────────────────

    async def list_public_dashboards(
        self, user_id: Optional[int] = None, org_id: Optional[int] = None
    ) -> list:
        where = {"isPublic": True}
        if user_id:
            where["userId"] = user_id
        if org_id:
            where["organizationId"] = org_id
        dashboards = await prisma.publicdashboard.find_many(
            where=where, order={"createdAt": "desc"}, take=50
        )
        return [self._dashboard_to_dict(d) for d in dashboards]

    async def create_public_dashboard(self, data: dict) -> Dict[str, Any]:
        dashboard = await prisma.publicdashboard.create(data=data)
        return self._dashboard_to_dict(dashboard)

    def _dashboard_to_dict(self, d) -> Dict[str, Any]:
        return {
            "id": d.id,
            "title": d.title,
            "description": d.description,
            "thumbnail_url": d.thumbnailUrl,
            "tags": d.tags,
            "is_public": d.isPublic,
            "view_count": d.viewCount,
            "like_count": d.likeCount,
            "embed_url": d.embedUrl,
            "created_at": d.createdAt.isoformat() if d.createdAt else None,
        }


pillar_profile_service = PillarProfileService()


def _avg(iterable):
    items = [x for x in iterable if x is not None]
    return round(sum(items) / len(items), 2) if items else None
