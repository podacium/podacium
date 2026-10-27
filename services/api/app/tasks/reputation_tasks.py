"""
EigenTrust & Algorithmic Reputation Celery Periodic Tasks.

Batch computes global network trust transition matrix C and stationary distributions:
1. Gathers all active freelancers and clients with reviews or verified credentials.
2. Constructs UserTrustProfile capturing:
   - Verified Algerian University Degree / Arrêté 1275 Startup Passport (+25% baseline trust)
   - MicroVM capstone pass (+20% baseline trust)
   - ANAE Auto-Entrepreneur registry & KYC (+15% baseline trust)
   - Base identity (+5% baseline trust)
3. Computes normalized baseline pre-trust vector p_i.
4. Assembles stochastic local trust matrix C from non-appealed reviews.
5. Runs power iteration solver until convergence (||t^(k+1) - t^(k)||_1 < epsilon).
6. Derives composite Job Success Score (JSS) with exponential transition decay:
   - Eliminates cold-start bias for university graduates while maintaining Sybil-attack resistance.
7. Persists updated scores directly into FreelancerProfile.metadata for instantaneous search retrieval.

Scheduled via Celery Beat every 6 hours.
"""

from datetime import datetime, timezone
import logging
from typing import Dict, Any, List

from app.core.async_bridge import run_async_in_worker
from app.core.celery import celery_app
from app.core.prisma import connect_prisma, disconnect_prisma, prisma
from app.generated.prisma import Json
from app.services.reputation_service import (
    reputation_service,
    UserTrustProfile,
)

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.reputation_tasks.recompute_eigentrust_network_scores",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def recompute_eigentrust_network_scores(self):
    """
    Celery task entrypoint for periodic batch EigenTrust recomputation.
    """

    async def _run():
        try:
            await connect_prisma()
            result = await recompute_all_freelancer_reputations()
            return result
        except Exception as exc:
            logger.error(f"EigenTrust batch recomputation failed: {exc}", exc_info=True)
            raise self.retry(exc=exc)
        finally:
            await disconnect_prisma()

    return run_async_in_worker(_run())


async def recompute_all_freelancer_reputations() -> Dict[str, Any]:
    """
    Executes global EigenTrust power iteration and persists JSS + EigenTrust metrics.
    Separated from Celery task wrapper for clean unit and integration testing.
    """
    now = datetime.now(timezone.utc)
    logger.info("Starting global EigenTrust batch recomputation...")

    # 1. Fetch all active freelancer profiles
    freelancer_profiles = await prisma.freelancerprofile.find_many(
        include={"user": True}
    )
    if not freelancer_profiles:
        logger.info("No freelancer profiles found to evaluate.")
        return {"total_evaluated": 0, "status": "NO_PROFILES"}

    freelancer_user_ids = [
        fp.userId for fp in freelancer_profiles if fp.user and fp.user.isActive
    ]

    # 2. Gather completed contracts count per freelancer
    completed_contracts_raw = await prisma.contract.group_by(
        by=["freelancerId"],
        where={"status": "COMPLETED", "freelancerId": {"in": freelancer_user_ids}},
        count={"id": True},
    )
    completed_counts = {
        item["freelancerId"]: item["_count"]["id"] for item in completed_contracts_raw
    }

    # 3. Gather public, non-disputed review ratings
    active_reviews = await prisma.contractreview.find_many(
        where={
            "status": "ACTIVE",
            "isPublic": True,
        }
    )

    review_dicts: List[Dict[str, Any]] = [
        {
            "author_id": r.authorId,
            "target_id": r.targetId,
            "rating": float(r.rating),
            "status": r.status,
        }
        for r in active_reviews
    ]

    # Calculate raw average ratings for freelancers
    rating_sums: Dict[int, float] = {}
    rating_counts: Dict[int, int] = {}
    for r in review_dicts:
        tid = r["target_id"]
        rating_sums[tid] = rating_sums.get(tid, 0.0) + r["rating"]
        rating_counts[tid] = rating_counts.get(tid, 0) + 1

    raw_ratings = {uid: rating_sums[uid] / rating_counts[uid] for uid in rating_sums}

    # 4. Gather certificate & capstone counts (MicroVM)
    capstones = await prisma.certificate.find_many(
        where={"userId": {"in": freelancer_user_ids}}
    )
    has_capstone = {c.userId for c in capstones}

    # 4b. Gather disputes count per freelancer (disputes filed against freelancer)
    dispute_counts: Dict[int, int] = {}
    try:
        disputes = await prisma.dispute.find_many(
            where={"opponentId": {"in": freelancer_user_ids}}
        )
        if disputes:
            for d in disputes:
                dispute_counts[d.opponentId] = dispute_counts.get(d.opponentId, 0) + 1
    except Exception as e:
        logger.debug(f"Could not load disputes for reputation task: {e}")

    # 4c. Gather on-time delivery counts from milestone deliveries
    ontime_counts: Dict[int, int] = {}
    delivered_counts: Dict[int, int] = {}
    try:
        milestones = await prisma.contractmilestone.find_many(
            where={
                "contract": {"freelancerId": {"in": freelancer_user_ids}},
                "status": {"in": ["DELIVERED", "APPROVED", "RELEASED"]},
            },
            include={"contract": True},
        )
        if milestones:
            for m in milestones:
                if m.contract and m.contract.freelancerId:
                    fid = m.contract.freelancerId
                    delivered_counts[fid] = delivered_counts.get(fid, 0) + 1
                    if not m.dueDate or (m.deliveredAt and m.deliveredAt <= m.dueDate):
                        ontime_counts[fid] = ontime_counts.get(fid, 0) + 1
    except Exception as e:
        logger.debug(f"Could not load milestones for on-time delivery metric: {e}")

    # 5. Build UserTrustProfiles
    trust_profiles: List[UserTrustProfile] = []
    user_id_to_profile_map: Dict[int, Any] = {}

    for fp in freelancer_profiles:
        if not fp.user or not fp.user.isActive:
            continue
        uid = fp.userId
        user_id_to_profile_map[uid] = fp

        # Degree / Arrêté 1275 verification from profile flags or user metadata
        is_degree_verified = bool(
            fp.skillPassportVerified
            or (
                fp.metadata
                and isinstance(fp.metadata, dict)
                and fp.metadata.get("arrete_1275_verified")
            )
        )
        is_microvm_passed = uid in has_capstone
        is_anae_kyc = bool(fp.isAnaeRegistered or fp.isVerified)

        trust_profiles.append(
            UserTrustProfile(
                user_id=uid,
                has_verified_degree_or_1275=is_degree_verified,
                has_microvm_capstone=is_microvm_passed,
                has_anae_kyc=is_anae_kyc,
                completed_contracts_count=completed_counts.get(uid, 0),
                raw_rating_avg=raw_ratings.get(uid, 0.0),
                dispute_count=dispute_counts.get(uid, 0),
                on_time_delivery_count=ontime_counts.get(uid, 0),
                total_delivered_milestones=delivered_counts.get(uid, 0),
            )
        )

    if not trust_profiles:
        return {"total_evaluated": 0, "status": "EMPTY_TRUST_POOL"}

    # 6. Compute normalized baseline pre-trust vector p
    pre_trust = reputation_service.compute_baseline_pretrust(trust_profiles)

    # 7. Build stochastic local trust matrix C
    all_evaluated_ids = [p.user_id for p in trust_profiles]
    C = reputation_service.build_transition_matrix(
        user_ids=all_evaluated_ids,
        reviews=review_dicts,
        pre_trust=pre_trust,
    )

    # 8. Solve EigenTrust power iteration
    p_vec = [
        pre_trust.get(uid, 1.0 / len(all_evaluated_ids)) for uid in all_evaluated_ids
    ]
    import numpy as np

    eigen_scores = reputation_service.solve_eigentrust(
        C, np.array(p_vec, dtype=np.float64)
    )

    avg_eigentrust = (
        float(np.mean(eigen_scores))
        if len(eigen_scores) > 0
        else 1.0 / len(all_evaluated_ids)
    )

    # 9. Update FreelancerProfile metadata in database
    updated_count = 0
    for idx, p in enumerate(trust_profiles):
        uid = p.user_id
        score = (
            float(eigen_scores[idx])
            if idx < len(eigen_scores)
            else float(pre_trust.get(uid, 0.0))
        )

        wilson_stats = reputation_service.compute_bayesian_reputation_score(
            completed_contracts=p.completed_contracts_count,
            raw_average_rating=p.raw_rating_avg,
            dispute_count=p.dispute_count,
            on_time_delivery_count=p.on_time_delivery_count,
            total_delivered_milestones=p.total_delivered_milestones,
        )

        jss = reputation_service.compute_freelancer_job_success_score(
            user_id=uid,
            eigentrust_score=score,
            average_eigentrust=avg_eigentrust,
            completed_contracts=p.completed_contracts_count,
            raw_average_rating=p.raw_rating_avg,
            dispute_count=p.dispute_count,
            on_time_delivery_count=p.on_time_delivery_count,
            total_delivered_milestones=p.total_delivered_milestones,
        )

        fp = user_id_to_profile_map[uid]
        meta = fp.metadata if isinstance(fp.metadata, dict) else {}
        meta["eigentrust_score"] = round(score, 6)
        meta["job_success_score"] = jss
        meta["wilson_lower_bound"] = wilson_stats["wilson_lower_bound"]
        meta["bayesian_rating"] = wilson_stats["bayesian_rating"]
        meta["dispute_frequency"] = wilson_stats["dispute_rate"]
        meta["on_time_delivery_rate"] = wilson_stats["on_time_rate"]
        meta["last_reputation_computed_at"] = now.isoformat()
        meta["credential_boost_applied"] = bool(
            p.has_verified_degree_or_1275 or p.has_microvm_capstone or p.has_anae_kyc
        )

        await prisma.freelancerprofile.update(
            where={"id": fp.id},
            data={"metadata": Json(meta)},
        )
        updated_count += 1

    logger.info(
        f"EigenTrust batch recomputation finished: updated {updated_count} freelancer profiles. "
        f"Average EigenTrust score: {avg_eigentrust:.6f}"
    )

    return {
        "total_evaluated": updated_count,
        "average_eigentrust": avg_eigentrust,
        "timestamp": now.isoformat(),
        "status": "COMPLETED",
    }
