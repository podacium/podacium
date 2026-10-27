"""
Tests for Layer 9: Freelance Marketplace, Escrow Concurrency & Reputation Engine.

Covers:
1. [CRITICAL-HUB-01] Approved milestones cannot be disputed & concurrent approve vs dispute atomic CAS.
2. [HIGH-HUB-02] Dropped auto-approval return value fixed in Celery/MilestoneService.
3. [MEDIUM-HUB-03] Mathematical EigenTrust power-iteration convergence & Algerian credential-boost pre-trust seeding.
4. Bilateral IP Assignment Deed generation conforming to Ordonnance 03-05 (ONDA) & Loi 22-23 (ANAE) with Ed25519 seal.
"""

import os
import hashlib
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, AsyncMock, patch
from cryptography.hazmat.primitives.asymmetric import ed25519
from fastapi import HTTPException

from app.services.milestone_service import MilestoneService
from app.services.escrow_service import escrow_service
from app.schemas.payment import EscrowReleaseRequest
from app.services.reputation_service import (
    reputation_service,
    UserTrustProfile,
    CredentialBoostWeights,
)
from app.services.ip_assignment_service import ip_assignment_service


# ── 1. Escrow Concurrency & Dispute Invariant Tests ─────────────────────────


class TestEscrowDisputeConcurrency:
    @pytest.mark.asyncio
    async def test_cannot_dispute_approved_or_released_milestone(self):
        """Milestones in APPROVED or RELEASED state must NEVER be disputed."""
        mock_milestone = MagicMock(
            id=101,
            contractId=42,
            status="APPROVED",
            contract=MagicMock(clientId=1, freelancerId=2),
        )

        with patch(
            "app.core.prisma.prisma.contractmilestone.find_unique",
            AsyncMock(return_value=mock_milestone),
        ):
            with pytest.raises(ValueError, match="awaiting approval"):
                await MilestoneService.dispute_milestone(
                    milestone_id=101, reason="Work not satisfied", user_id=1
                )

    @pytest.mark.asyncio
    async def test_dispute_milestone_requires_delivered_state_atomic_cas(self):
        """Dispute fails if concurrent approval changes status before CAS executes."""
        mock_milestone = MagicMock(
            id=102,
            contractId=42,
            title="Design Phase",
            status="DELIVERED",
            contract=MagicMock(clientId=1, freelancerId=2),
        )

        mock_tx = MagicMock()
        # Simulate race: existing dispute check passes, but update_many sees 0 rows because approve won the race
        mock_tx.dispute.find_first = AsyncMock(return_value=None)
        mock_tx.contractmilestone.update_many = AsyncMock(
            return_value=0
        )  # 0 rows affected!

        with patch(
            "app.core.prisma.prisma.contractmilestone.find_unique",
            AsyncMock(return_value=mock_milestone),
        ):
            with patch(
                "app.core.prisma.prisma.tx",
                MagicMock(
                    return_value=MagicMock(
                        __aenter__=AsyncMock(return_value=mock_tx),
                        __aexit__=AsyncMock(return_value=None),
                    )
                ),
            ):
                with pytest.raises(ValueError, match="no longer in DELIVERED state"):
                    await MilestoneService.dispute_milestone(
                        milestone_id=102, reason="Dispute attempt", user_id=1
                    )

    @pytest.mark.asyncio
    async def test_auto_approve_boolean_propagation_and_rejection_handling(self):
        """Verify _auto_approve_milestone propagates claim boolean and rejects false claims."""
        mock_milestone = MagicMock(id=201, contractId=50)

        # Case A: _claim_and_release returns True
        with patch.object(
            MilestoneService, "_claim_and_release", AsyncMock(return_value=True)
        ):
            with patch.object(
                MilestoneService, "_notify_auto_approved", AsyncMock()
            ) as mock_notify:
                result = await MilestoneService._auto_approve_milestone(mock_milestone)
                assert result is True
                mock_notify.assert_called_once_with(mock_milestone)

        # Case B: _claim_and_release returns False (already claimed concurrently)
        with patch.object(
            MilestoneService, "_claim_and_release", AsyncMock(return_value=False)
        ):
            with patch.object(
                MilestoneService, "_notify_auto_approved", AsyncMock()
            ) as mock_notify:
                result = await MilestoneService._auto_approve_milestone(mock_milestone)
                assert result is False
                # Must NEVER notify if claim was not performed!
                mock_notify.assert_not_called()

    @pytest.mark.asyncio
    async def test_high_value_milestone_requires_step_up(self):
        """Milestones > 100,000 DZD strictly require cryptographic step-up verification."""
        mock_milestone = MagicMock(
            id=301,
            contractId=60,
            amount=150_000,
            status="DELIVERED",
            contract=MagicMock(clientId=1, freelancerId=2),
        )

        with patch(
            "app.core.prisma.prisma.contractmilestone.find_unique",
            AsyncMock(return_value=mock_milestone),
        ):
            # Missing step-up token -> 403 STEP_UP_REQUIRED
            with pytest.raises(HTTPException) as exc_info:
                await MilestoneService.approve_delivery(
                    milestone_id=301, client_id=1, step_up_token=None
                )
            assert exc_info.value.status_code == 403
            assert exc_info.value.detail["code"] == "STEP_UP_REQUIRED"

            # Invalid step-up token -> 403 INVALID_STEP_UP_TOKEN
            with patch(
                "app.core.security.verify_token",
                return_value={"type": "access", "sub": "1"},
            ):
                with pytest.raises(HTTPException) as exc_info:
                    await MilestoneService.approve_delivery(
                        milestone_id=301, client_id=1, step_up_token="bad_token"
                    )
                assert exc_info.value.status_code == 403
                assert exc_info.value.detail["code"] == "INVALID_STEP_UP_TOKEN"

    @pytest.mark.asyncio
    async def test_high_value_escrow_release_requires_step_up(self):
        """Escrow disbursement > 100,000 DZD requires cryptographic step-up token."""
        mock_hold = MagicMock(
            id=501,
            contractId=80,
            amount=200_000,
            status="HOLD",
        )
        req = EscrowReleaseRequest(contract_id=80, amount=120_000)

        with patch(
            "app.services.escrow_service.is_feature_based_mode", return_value=False
        ):
            with patch(
                "app.core.prisma.prisma.escrowhold.find_unique",
                AsyncMock(return_value=mock_hold),
            ):
                # Without step-up token -> 403 STEP_UP_REQUIRED
                with pytest.raises(HTTPException) as exc_info:
                    await escrow_service.release_escrow(request=req, step_up_token=None)
                assert exc_info.value.status_code == 403
                assert exc_info.value.detail["code"] == "STEP_UP_REQUIRED"

    @pytest.mark.asyncio
    async def test_milestone_escrow_release_locks_wallets_in_canonical_order(self):
        """Wallet locks must be acquired in sorted ID order to prevent ABBA deadlocks."""
        mock_milestone = MagicMock(
            id=401,
            contractId=70,
            amount=50_000,
            title="Frontend Dev",
        )
        mock_hold = MagicMock(
            id=901,
            contractId=70,
            walletId=50,
            amount=50_000,
            releasedAmount=0,
            currency="DZD",
            status="HOLD",
        )
        mock_contract = MagicMock(id=70, freelancerId=99)
        mock_freelancer_wallet = MagicMock(id=20, userId=99)

        mock_tx = MagicMock()
        mock_tx.escrowhold.find_unique = AsyncMock(return_value=mock_hold)
        mock_tx.query_raw = AsyncMock(return_value=[{"id": 901}])
        mock_tx.contract.find_unique = AsyncMock(return_value=mock_contract)
        mock_tx.wallet.find_unique = AsyncMock(return_value=mock_freelancer_wallet)
        mock_tx.escrowhold.update = AsyncMock(return_value=mock_hold)
        mock_tx.transaction.create = AsyncMock()

        locked_order = []

        async def fake_lock(tx, wallet_id):
            locked_order.append(wallet_id)

        with patch(
            "app.services.wallet_service.wallet_service._lock_wallet",
            side_effect=fake_lock,
        ):
            with patch(
                "app.services.wallet_service.wallet_service.release_hold", AsyncMock()
            ):
                with patch(
                    "app.services.wallet_service.wallet_service.debit_wallet",
                    AsyncMock(),
                ):
                    with patch(
                        "app.services.wallet_service.wallet_service.credit_wallet",
                        AsyncMock(),
                    ):
                        await MilestoneService._release_milestone_escrow(
                            mock_milestone, tx=mock_tx
                        )

        # Assert wallet locks were acquired in sorted order: [20, 50]
        assert locked_order == [20, 50]

    @pytest.mark.asyncio
    async def test_milestone_and_dispute_sla_constants_and_tasks(self):
        """Verifies 7-day milestone auto-approval and 14-day dispute auto-resolution SLAs."""
        from app.tasks.milestone_tasks import (
            MILESTONE_AUTO_APPROVE_DAYS,
            DISPUTE_AUTO_RESOLVE_DAYS,
            _auto_approve_stale_milestones,
        )

        assert MILESTONE_AUTO_APPROVE_DAYS == 7
        assert DISPUTE_AUTO_RESOLVE_DAYS == 14

        mock_stale_ms = MagicMock(id=601, contractId=12)
        with patch(
            "app.core.prisma.prisma.contractmilestone.find_many",
            AsyncMock(return_value=[mock_stale_ms]),
        ):
            with patch.object(
                MilestoneService,
                "_auto_approve_milestone",
                AsyncMock(return_value=True),
            ):
                with patch(
                    "app.core.prisma.prisma.contractmilestone.count",
                    AsyncMock(return_value=0),
                ):
                    res = await _auto_approve_stale_milestones()
                    assert res["auto_approved"] == 1
                    assert res["checked"] == 1


# ── 2. EigenTrust & Algerian Credential-Boost Tests ──────────────────────────


class TestEigenTrustAndCredentialBoost:
    def test_raw_pretrust_calculation_for_algerian_graduates(self):
        """Verifies Algerian university graduate under Arrêté 1275 receives expected baseline trust."""
        # Uncredentialed account
        p_basic = UserTrustProfile(user_id=1)
        b_basic = reputation_service.compute_user_raw_pretrust(p_basic)
        assert b_basic == CredentialBoostWeights.BASE_IDENTITY  # 0.05

        # Algerian graduate with Arrêté 1275 Startup Passport
        p_grad = UserTrustProfile(
            user_id=2,
            has_verified_degree_or_1275=True,
        )
        b_grad = reputation_service.compute_user_raw_pretrust(p_grad)
        assert b_grad == pytest.approx(0.05 + 0.25, 0.001)  # 0.30

        # Fully credentialed Algerian auto-entrepreneur with Arrêté 1275 + MicroVM capstone + ANAE
        p_full = UserTrustProfile(
            user_id=3,
            has_verified_degree_or_1275=True,
            has_microvm_capstone=True,
            has_anae_kyc=True,
        )
        b_full = reputation_service.compute_user_raw_pretrust(p_full)
        assert b_full == pytest.approx(0.05 + 0.25 + 0.20 + 0.15, 0.001)  # 0.65

    def test_eigentrust_power_iteration_convergence(self):
        """EigenTrust power iteration must converge to a normalized stationary distribution."""
        profiles = [
            UserTrustProfile(user_id=10, has_verified_degree_or_1275=True),
            UserTrustProfile(user_id=20, has_microvm_capstone=True),
            UserTrustProfile(user_id=30),
        ]
        pre_trust = reputation_service.compute_baseline_pretrust(profiles)
        assert sum(pre_trust.values()) == pytest.approx(1.0, 1e-6)

        user_ids = [10, 20, 30]
        reviews = [
            {"author_id": 10, "target_id": 20, "rating": 5.0, "status": "ACTIVE"},
            {"author_id": 20, "target_id": 10, "rating": 4.5, "status": "ACTIVE"},
        ]
        C = reputation_service.build_transition_matrix(user_ids, reviews, pre_trust)

        import numpy as np

        p_vec = np.array([pre_trust[uid] for uid in user_ids])
        t_stationary = reputation_service.solve_eigentrust(C, p_vec)

        # Must sum to 1.0
        assert np.sum(t_stationary) == pytest.approx(1.0, 1e-5)
        # Highly rated and credentialed user 10 and 20 must have higher trust than uncredentialed 30
        assert t_stationary[0] > t_stationary[2]
        assert t_stationary[1] > t_stationary[2]

    def test_cold_start_jss_boost_for_newcomers(self):
        """Newcomer with 0 contracts and verified credentials must receive an immediate entry JSS."""
        avg_trust = 0.333
        newcomer_trust = 0.55  # Graduate with Arrêté 1275 & MicroVM

        # 0 completed contracts
        jss_newcomer = reputation_service.compute_freelancer_job_success_score(
            user_id=1,
            eigentrust_score=newcomer_trust,
            average_eigentrust=avg_trust,
            completed_contracts=0,
            raw_average_rating=0.0,
        )
        # Entry score should be robust and competitive (~82.6%)
        assert jss_newcomer >= 80.0
        assert jss_newcomer <= 100.0

    def test_cold_start_sybil_weighted_rating_with_credentials(self):
        """calculate_sybil_weighted_rating provides initial star baseline for credentialed newcomers."""
        p_grad = UserTrustProfile(
            user_id=99,
            has_verified_degree_or_1275=True,
            has_microvm_capstone=True,
        )
        res = reputation_service.calculate_sybil_weighted_rating(
            reviews=[], user_profile=p_grad
        )
        assert res["credential_boost_applied"] is True
        assert res["weighted_rating"] > 4.0
        assert res["baseline_trust_score"] == 0.50


# ── 3. Bilateral IP Assignment Deed (Ordonnance 03-05) Tests ─────────────────


class TestBilateralIpAssignmentDeed:
    def test_pdf_rendering_and_ed25519_seal_verification(self, tmp_path):
        """Generates certified bilingual IP Assignment Deed PDF and verifies platform Ed25519 signature."""
        output_file = str(tmp_path / "IP-TEST-DEED.pdf")
        now = datetime.now(timezone.utc)
        deliverable_hash = hashlib.sha256(b"codebase_release_v1_zip").hexdigest()

        file_path, doc_hash, signature_hex = (
            ip_assignment_service.render_ip_assignment_deed_pdf(
                deed_number="IP-2026-CTR42-MS01",
                contract_id=42,
                milestone_id=1,
                milestone_title="Smart Contract MicroVM Backend",
                amount_dzd=75000,
                freelancer_name="Karim Mansouri",
                freelancer_anae="162400998811",
                client_name="Fintech Algerie EURL",
                client_tax_id="000131012345678",
                deliverable_sha256=deliverable_hash,
                signed_at=now,
                output_file_path=output_file,
            )
        )

        assert os.path.exists(file_path)
        assert len(doc_hash) == 64
        assert len(signature_hex) == 128  # 64 bytes = 128 hex chars in Ed25519

        # Verify cryptographic signature using platform public key
        _, pub_key_hex = ip_assignment_service._get_platform_ed25519_keys()
        public_key = ed25519.Ed25519PublicKey.from_public_bytes(
            bytes.fromhex(pub_key_hex)
        )

        # Verification must not raise InvalidSignature
        public_key.verify(bytes.fromhex(signature_hex), doc_hash.encode("utf-8"))
