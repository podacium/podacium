"""
Graph-Based Anti-Collusion, Sybil Mitigation & Reputation Forensics Service.

1. True Mathematical EigenTrust graph algorithm with stationary power iteration convergence.
2. Algerian Sovereign Credential-Boost Pre-Trust Seeding (p_i):
   - Baseline phone/identity: +0.05
   - Verified Algerian University Degree / Arrêté 1275 Startup Passport: +0.25 (+25% baseline trust)
   - Passed MicroVM capstone / skill assessments: +0.20 (+20% baseline trust)
   - Verified ANAE Auto-Entrepreneur registry and identity verification: +0.15 (+15% baseline trust)
   - Eliminates cold-start bias for university graduates while maintaining Sybil-attack resistance.
3. Composite Job Success Score (JSS) with exponential transition decay:
   - For newcomers with 0 completed contracts, score is driven by verified credentials.
   - For experienced freelancers, delivery ratings dominate smoothly.
4. Device & Hardware Fingerprint Clustering (Canvas hash, WebGL vendor, /24 subnet, user-agent).
5. Tiered Transaction Velocity Limiter capping unverified GMV volume:
   - Tier 0 (Email only): 30,000 DZD / month
   - Tier 1 (NIN Verified): 150,000 DZD / month
   - Tier 2 (Biometric KYC): 500,000 DZD / month
   - Tier 3 (Verified ANAE Card): Unlimited GMV
"""

import hashlib
import logging
from typing import Dict, Any, List, Optional
import numpy as np
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Monthly GMV Limits in DZD
TIER_MONTHLY_VELOCITY_LIMITS_DZD = {
    "TIER_0_EMAIL": 30_000,
    "TIER_1_NIN": 150_000,
    "TIER_2_BIOMETRIC": 500_000,
    "TIER_3_ANAE": float("inf"),
}


class CredentialBoostWeights:
    BASE_IDENTITY: float = 0.05
    ARRETE_1275_OR_DEGREE: float = 0.25
    MICROVM_CAPSTONE: float = 0.20
    ANAE_AUTO_ENTREPRENEUR: float = 0.15


class UserTrustProfile(BaseModel):
    user_id: int
    has_verified_degree_or_1275: bool = False
    has_microvm_capstone: bool = False
    has_anae_kyc: bool = False
    completed_contracts_count: int = 0
    raw_rating_avg: float = 0.0
    dispute_count: int = 0
    on_time_delivery_count: int = 0
    total_delivered_milestones: int = 0
    wilson_lower_bound: float = 0.0


class DeviceClusterInfo(BaseModel):
    canvas_hash: Optional[str] = None
    webgl_vendor: Optional[str] = None
    ip_address: Optional[str] = None
    ip_subnet_24: Optional[str] = None
    user_agent: Optional[str] = None
    cluster_fingerprint: str


class VelocityLimitCheckResult(BaseModel):
    is_allowed: bool
    current_tier: str
    monthly_limit_dzd: float
    current_month_gmv_dzd: float
    remaining_allowance_dzd: float
    upgrade_required_tier: Optional[str] = None


class CollusionRiskResult(BaseModel):
    is_collusion_risk: bool
    risk_score: float  # 0.0 - 1.0
    matched_factors: List[str]
    action: str  # "ALLOW", "FLAG_REVIEW", "BLOCK"


class ReputationForensicsService:
    """Computes Sybil-resistant EigenTrust scores and enforces AML velocity clamps."""

    def __init__(
        self,
        damping_factor: float = 0.15,
        max_iterations: int = 50,
        epsilon: float = 1e-5,
    ):
        self.alpha = damping_factor
        self.max_iterations = max_iterations
        self.epsilon = epsilon

    @staticmethod
    def calculate_device_cluster_fingerprint(
        canvas_hash: Optional[str],
        webgl_vendor: Optional[str],
        ip_address: Optional[str],
        user_agent: Optional[str],
    ) -> DeviceClusterInfo:
        """Derives hardware & network cluster fingerprint."""
        subnet = None
        if ip_address:
            parts = ip_address.strip().split(".")
            if len(parts) == 4:
                subnet = f"{parts[0]}.{parts[1]}.{parts[2]}.0/24"
            else:
                subnet = ip_address

        raw = f"{canvas_hash or 'N/A'}|{webgl_vendor or 'N/A'}|{subnet or 'N/A'}|{user_agent or 'N/A'}"
        cluster_fp = hashlib.sha256(raw.encode("utf-8")).hexdigest()

        return DeviceClusterInfo(
            canvas_hash=canvas_hash,
            webgl_vendor=webgl_vendor,
            ip_address=ip_address,
            ip_subnet_24=subnet,
            user_agent=user_agent,
            cluster_fingerprint=cluster_fp,
        )

    def detect_collusion_between_parties(
        self,
        party_a_device: DeviceClusterInfo,
        party_b_device: DeviceClusterInfo,
    ) -> CollusionRiskResult:
        """
        Detects self-dealing or collusion between client and freelancer (same machine or network).
        """
        factors = []
        score = 0.0

        # Exact cluster fingerprint match (same browser + same subnet)
        if party_a_device.cluster_fingerprint == party_b_device.cluster_fingerprint:
            factors.append("EXACT_HARDWARE_CLUSTER_MATCH")
            score += 0.95

        # Canvas fingerprint match
        if (
            party_a_device.canvas_hash
            and party_a_device.canvas_hash == party_b_device.canvas_hash
        ):
            factors.append("IDENTICAL_CANVAS_FINGERPRINT")
            score += 0.80

        # Same IP / Subnet match
        if (
            party_a_device.ip_subnet_24
            and party_a_device.ip_subnet_24 == party_b_device.ip_subnet_24
        ):
            factors.append("SHARED_IP_SUBNET_24")
            score += 0.40

        score = min(score, 1.0)
        is_risk = score >= 0.70
        action = (
            "BLOCK" if score >= 0.80 else ("FLAG_REVIEW" if score >= 0.40 else "ALLOW")
        )

        return CollusionRiskResult(
            is_collusion_risk=is_risk,
            risk_score=score,
            matched_factors=factors,
            action=action,
        )

    # ── EIGENTRUST & CREDENTIAL-BOOST SUITE ───────────────────────────────────

    @staticmethod
    def compute_user_raw_pretrust(profile: UserTrustProfile) -> float:
        """
        Computes raw baseline trust endowment b_i for a user based on verified credentials:
        - Base identity: +0.05
        - Verified Degree / Arrêté 1275 Startup Passport: +0.25
        - MicroVM Capstone / Skill Assessment: +0.20
        - ANAE Auto-Entrepreneur Card & KYC: +0.15
        Maximum raw baseline: 0.65.
        """
        b_i = CredentialBoostWeights.BASE_IDENTITY
        if profile.has_verified_degree_or_1275:
            b_i += CredentialBoostWeights.ARRETE_1275_OR_DEGREE
        if profile.has_microvm_capstone:
            b_i += CredentialBoostWeights.MICROVM_CAPSTONE
        if profile.has_anae_kyc:
            b_i += CredentialBoostWeights.ANAE_AUTO_ENTREPRENEUR
        return round(b_i, 3)

    def compute_baseline_pretrust(
        self, profiles: List[UserTrustProfile]
    ) -> Dict[int, float]:
        """Calculates normalized pre-trust vector p_i for all participants (sum(p_i) == 1.0)."""
        raw_scores: Dict[int, float] = {}
        for p in profiles:
            raw_scores[p.user_id] = self.compute_user_raw_pretrust(p)

        total_b = sum(raw_scores.values()) or 1.0
        return {uid: score / total_b for uid, score in raw_scores.items()}

    def build_transition_matrix(
        self,
        user_ids: List[int],
        reviews: List[Dict[str, Any]],
        pre_trust: Dict[int, float],
    ) -> np.ndarray:
        """
        Constructs stochastic local trust matrix C where C[i, j] represents normalized trust of i in j.
        Dangling nodes (users with no outgoing reviews) fall back to the pre-trust vector p.
        """
        n = len(user_ids)
        idx_map = {uid: i for i, uid in enumerate(user_ids)}
        S = np.zeros((n, n), dtype=np.float64)

        for r in reviews:
            if r.get("status") in ["REDACTED", "PENDING_APPEAL"]:
                continue
            u = r.get("author_id")
            v = r.get("target_id")
            if u in idx_map and v in idx_map and u != v:
                rating = float(r.get("rating", 3.0))
                # Standard EigenTrust: satisfaction s_ij = max(0, rating - 3.0)
                satisfaction = max(0.0, rating - 3.0)
                S[idx_map[u], idx_map[v]] += satisfaction

        C = np.zeros((n, n), dtype=np.float64)
        p_vec = np.array(
            [pre_trust.get(uid, 1.0 / max(1, n)) for uid in user_ids], dtype=np.float64
        )
        p_norm = np.sum(p_vec)
        if p_norm > 0:
            p_vec = p_vec / p_norm

        for i in range(n):
            row_sum = np.sum(S[i, :])
            if row_sum > 0:
                C[i, :] = S[i, :] / row_sum
            else:
                C[i, :] = p_vec

        return C

    def solve_eigentrust(
        self,
        C: np.ndarray,
        p_vec: np.ndarray,
    ) -> np.ndarray:
        """
        Computes stationary distribution via power iteration:
        t^(k+1) = (1 - alpha) * C^T * t^(k) + alpha * p
        Guaranteed to converge when C is stochastic and alpha in (0, 1).
        """
        n = C.shape[0]
        if n == 0:
            return np.array([], dtype=np.float64)
        t = p_vec.copy()

        for _ in range(self.max_iterations):
            t_next = (1.0 - self.alpha) * np.dot(C.T, t) + self.alpha * p_vec
            delta = np.linalg.norm(t_next - t, 1)
            t = t_next
            if delta < self.epsilon:
                break

        norm = np.sum(t)
        return t / norm if norm > 0 else p_vec

    @staticmethod
    def calculate_wilson_lower_bound(
        positive: float,
        total: float,
        confidence: float = 0.95,
    ) -> float:
        """
        Calculates the Wilson score lower bound (95% confidence interval by default)
        for a Bernoulli parameter, following Edwin Bidwell Wilson (1927).

        Formula:
            w_minus = (p + z^2 / (2n) - z * sqrt((p * (1 - p) + z^2 / (4n)) / n)) / (1 + z^2 / n)
        where:
            z = 1.95996 for 95% confidence interval
            n = total observations
            p = positive / total

        Eliminates review-buying fraud on low-volume accounts:
        - 1 review of 5.0 stars (1/1) -> lower bound ~ 0.2065 (20.7%)
        - 2 reviews of 5.0 stars (2/2) -> lower bound ~ 0.3424 (34.2%)
        - 10 reviews of 5.0 stars (10/10) -> lower bound ~ 0.7225 (72.3%)
        - 50 reviews of 5.0 stars (50/50) -> lower bound ~ 0.9287 (92.9%)
        """
        if total <= 0 or positive <= 0:
            return 0.0

        # z-score for two-sided confidence interval (default 95% -> z = 1.95996)
        z = (
            1.95996
            if confidence == 0.95
            else (1.64485 if confidence == 0.90 else 2.57583)
        )
        p = min(1.0, max(0.0, float(positive) / float(total)))
        n = float(total)
        z2 = z * z

        denominator = 1.0 + (z2 / n)
        center = p + (z2 / (2.0 * n))
        spread = z * np.sqrt((p * (1.0 - p) / n) + (z2 / (4.0 * n * n)))

        lower = (center - spread) / denominator
        return round(float(np.clip(lower, 0.0, 1.0)), 4)

    @staticmethod
    def compute_bayesian_reputation_score(
        completed_contracts: int,
        raw_average_rating: float,
        dispute_count: int = 0,
        on_time_delivery_count: int = 0,
        total_delivered_milestones: int = 0,
        confidence: float = 0.95,
        prior_weight: float = 2.0,
        prior_mean: float = 0.70,
    ) -> Dict[str, Any]:
        """
        Multi-dimensional Bayesian Wilson Lower Bound (95% CI) reputation calculator.
        Factors:
        1. Completed contracts volume (n)
        2. Empirical review satisfaction rating (1.0 - 5.0 scale normalized to [0, 1])
        3. Dispute frequency (disputes heavily penalize positive outcome rate)
        4. On-time delivery rate (ontime / delivered milestones)

        Combines an uninformative Beta prior (prior_weight=2.0, prior_mean=0.70)
        with empirical observations, then passes the posterior parameter through the
        Wilson Score Lower Bound (95% CI) to eradicate review-buying fraud on low-volume accounts.
        """
        # 1. Direct rating proportion
        if raw_average_rating > 0:
            p_rating = float(np.clip(raw_average_rating / 5.0, 0.0, 1.0))
        else:
            p_rating = 0.0

        # 2. On-time delivery proportion
        if total_delivered_milestones > 0:
            p_ontime = float(
                np.clip(
                    on_time_delivery_count / max(1, total_delivered_milestones),
                    0.0,
                    1.0,
                )
            )
        else:
            p_ontime = 1.0

        # 3. Dispute frequency penalty
        total_engagements = completed_contracts + dispute_count
        dispute_rate = float(dispute_count / max(1, total_engagements))
        # Severe dispute multiplier: disputes heavily discount the empirical score
        dispute_multiplier = float(np.clip(1.0 - (2.0 * dispute_rate), 0.0, 1.0))

        # 4. Multi-dimensional positive empirical success rate
        if total_delivered_milestones > 0:
            p_empirical = (0.70 * p_rating + 0.30 * p_ontime) * dispute_multiplier
        else:
            p_empirical = p_rating * dispute_multiplier

        # 5. Bayesian smoothing with prior
        n_empirical = max(0, completed_contracts)
        n_effective = n_empirical + prior_weight
        k_effective = (p_empirical * n_empirical) + (prior_mean * prior_weight)
        p_bayesian = float(np.clip(k_effective / max(1e-6, n_effective), 0.0, 1.0))

        # 6. Wilson Lower Bound at 95% Confidence Interval
        wilson_lower = ReputationForensicsService.calculate_wilson_lower_bound(
            positive=k_effective,
            total=n_effective,
            confidence=confidence,
        )

        # 7. Composite empirical score balancing posterior mean and 95% lower bound
        # For high-volume accounts with good standing, wilson_lower approaches p_bayesian.
        # For low-volume accounts with bought reviews (e.g. 1 review), wilson_lower is ~0.20-0.30,
        # effectively eliminating review-buying fraud.
        composite_empirical = (0.50 * p_bayesian) + (0.50 * wilson_lower)

        return {
            "wilson_lower_bound": round(wilson_lower, 4),
            "bayesian_rating": round(p_bayesian * 5.0, 2),
            "composite_empirical_score": round(composite_empirical, 4),
            "dispute_rate": round(dispute_rate, 4),
            "on_time_rate": round(p_ontime, 4),
            "sample_size": n_empirical,
        }

    def compute_freelancer_job_success_score(
        self,
        user_id: int,
        eigentrust_score: float,
        average_eigentrust: float,
        completed_contracts: int,
        raw_average_rating: float,
        dispute_count: int = 0,
        on_time_delivery_count: int = 0,
        total_delivered_milestones: int = 0,
    ) -> float:
        """
        Computes composite JSS (0.0 - 100.0%) balancing peer trust, direct client satisfaction,
        and multi-dimensional Bayesian Wilson Lower Bound (95% CI):
        - For newcomers (completed_contracts == 0): JSS is driven 100% by certified credential trust.
        - As completed_contracts grow: exponential decay alpha = exp(-completed_contracts / 3)
          smoothly shifts weight to empirical client performance.
        - The empirical performance incorporates the Bayesian Wilson lower bound (95% CI)
          factoring completed contracts volume, disputes, and on-time delivery rates to eliminate
          review-buying fraud on low-volume accounts.
        """
        relative_trust = min(2.0, eigentrust_score / (average_eigentrust or 1e-6))
        trust_normalized_100 = min(100.0, relative_trust * 50.0)

        if completed_contracts == 0:
            return round(trust_normalized_100, 1)

        alpha = np.exp(-completed_contracts / 3.0)

        # Multi-dimensional Bayesian Wilson Lower Bound
        wilson_stats = self.compute_bayesian_reputation_score(
            completed_contracts=completed_contracts,
            raw_average_rating=raw_average_rating,
            dispute_count=dispute_count,
            on_time_delivery_count=on_time_delivery_count,
            total_delivered_milestones=total_delivered_milestones,
        )

        empirical_score_100 = wilson_stats["composite_empirical_score"] * 100.0

        jss = (alpha * trust_normalized_100) + ((1.0 - alpha) * empirical_score_100)
        return round(float(np.clip(jss, 0.0, 100.0)), 1)

    @staticmethod
    def calculate_sybil_weighted_rating(
        reviews: List[
            Dict[str, Any]
        ],  # [{"rating": 5, "client_completed_orders": 1}, ...]
        user_profile: Optional[UserTrustProfile] = None,
    ) -> Dict[str, Any]:
        """
        Modified EigenTrust down-weighting:
        - Clients with 0-1 prior completed contracts have review weight = 0.10 (90% down-weighted).
        - Clients with 2-4 prior contracts have review weight = 0.50.
        - Established clients (5+ contracts) have full review weight = 1.0.

        Cold-start resolution:
        - If freelancer has 0 reviews, verifiable credentials (Arrêté 1275, MicroVM, ANAE)
          seed an initial baseline star rating rather than stranding at 0.0.
        """
        if not reviews:
            if user_profile:
                raw_b = ReputationForensicsService.compute_user_raw_pretrust(
                    user_profile
                )
                # Map raw baseline trust (0.05 to 0.65) to [3.2, 4.85] stars
                baseline_stars = round(3.2 + (raw_b / 0.65) * 1.65, 2)
                return {
                    "weighted_rating": baseline_stars,
                    "raw_average": baseline_stars,
                    "total_reviews": 0,
                    "sybil_discount_applied": False,
                    "credential_boost_applied": True,
                    "baseline_trust_score": raw_b,
                }
            return {
                "weighted_rating": 0.0,
                "raw_average": 0.0,
                "total_reviews": 0,
                "sybil_discount_applied": False,
                "credential_boost_applied": False,
                "baseline_trust_score": 0.0,
            }

        total_weighted_points = 0.0
        total_weights = 0.0
        raw_points = 0.0

        for r in reviews:
            rating = float(r.get("rating", 5.0))
            client_orders = int(r.get("client_completed_orders", 0))

            if client_orders <= 1:
                weight = 0.10
            elif client_orders <= 4:
                weight = 0.50
            else:
                weight = 1.00

            total_weighted_points += rating * weight
            total_weights += weight
            raw_points += rating

        weighted_avg = (
            round(total_weighted_points / total_weights, 2)
            if total_weights > 0
            else 0.0
        )
        raw_avg = round(raw_points / len(reviews), 2)

        return {
            "weighted_rating": weighted_avg,
            "raw_average": raw_avg,
            "total_reviews": len(reviews),
            "sybil_discount_applied": weighted_avg != raw_avg,
            "credential_boost_applied": False,
        }

    @staticmethod
    def check_transaction_velocity_limit(
        user_tier: str,
        current_month_gmv_dzd: float,
        proposed_contract_amount_dzd: float,
    ) -> VelocityLimitCheckResult:
        """
        Enforces monthly GMV volume caps based on user KYC / ANAE status.
        """
        tier_key = (
            user_tier
            if user_tier in TIER_MONTHLY_VELOCITY_LIMITS_DZD
            else "TIER_0_EMAIL"
        )
        limit = TIER_MONTHLY_VELOCITY_LIMITS_DZD[tier_key]

        projected_total = current_month_gmv_dzd + proposed_contract_amount_dzd
        is_allowed = projected_total <= limit

        remaining = (
            max(0.0, limit - current_month_gmv_dzd)
            if limit != float("inf")
            else float("inf")
        )

        upgrade_required = None
        if not is_allowed:
            if tier_key == "TIER_0_EMAIL":
                upgrade_required = "TIER_1_NIN"
            elif tier_key == "TIER_1_NIN":
                upgrade_required = "TIER_2_BIOMETRIC"
            elif tier_key == "TIER_2_BIOMETRIC":
                upgrade_required = "TIER_3_ANAE"

        return VelocityLimitCheckResult(
            is_allowed=is_allowed,
            current_tier=tier_key,
            monthly_limit_dzd=limit,
            current_month_gmv_dzd=current_month_gmv_dzd,
            remaining_allowance_dzd=remaining,
            upgrade_required_tier=upgrade_required,
        )


reputation_service = ReputationForensicsService()
