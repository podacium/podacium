"""
P0 FINANCIAL INVARIANTS — contract + milestone + payout state transitions
(real PostgreSQL).

Verifies:
- contract terminal transitions are atomic (ACTIVE -> COMPLETED/CANCELLED only)
- proposal acceptance and direct assignment cannot create duplicate ACTIVE
  contracts for the same project (concurrent-safe)
- milestone DELIVERED -> APPROVED is claimed exactly once; escrow release is
  capped at the escrow amount; a second approve/auto-approve is a no-op
- payout states are claimed atomically (a second worker cannot process or
  fail the same payout twice / cannot refund twice)
"""
import asyncio

import pytest

from app.core.prisma import prisma
from app.services.freelancing_service import FreelanceService
from app.services.milestone_service import MilestoneService
from app.services.payout_service import PayoutService
from app.schemas.payment import PayoutRequest, WalletTransferRequest, PaymentPurpose

payout_service = PayoutService()


# ── Helpers ─────────────────────────────────────────────────────────────────

async def _make_user(prisma, email: str, role: str = "STUDENT"):
    return await prisma.user.create(
        data={
            "email": email,
            "fullName": f"User {email}",
            "role": role,
            "acceptedTerms": True,
        }
    )


async def _make_wallet(prisma, user_id: int, poda_points: int = 0):
    return await prisma.wallet.create(
        data={
            "userId": user_id,
            "podaPoints": poda_points,
            "currency": "PODAPOINT",
            "isActive": True,
        }
    )


async def _make_project(prisma, owner_id: int, status: str = "OPEN"):
    return await prisma.project.create(
        data={"title": "Test project", "ownerId": owner_id, "status": status}
    )


async def _make_proposal(prisma, project, freelancer_id: int, amount: int = 50000, status: str = "PENDING"):
    return await prisma.proposal.create(
        data={
            "projectId": project.id,
            "freelancerId": freelancer_id,
            "amount": amount,
            "status": status,
        }
    )


async def _make_contract(prisma, project, client_id: int, freelancer_id: int, status: str = "ACTIVE"):
    return await prisma.contract.create(
        data={
            "projectId": project.id,
            "clientId": client_id,
            "freelancerId": freelancer_id,
            "status": status,
            "terms": "test terms",
            "amount": 100000,
        }
    )


async def _make_escrow(prisma, contract_id: int, wallet_id: int, amount: int = 100000):
    return await prisma.escrowhold.create(
        data={
            "contractId": contract_id,
            "walletId": wallet_id,
            "amount": amount,
            "currency": "DZD",
            "status": "HOLD",
        }
    )


# ── CONTRACT state machines ─────────────────────────────────────────────────

class TestContractAtomicTransitions:

    @pytest.mark.integration
    async def test_complete_only_from_active(self, prisma, make_user):
        client = await _make_user(prisma, "client@x", "BUSINESS")
        freelancer = await _make_user(prisma, "freelancer@x")
        project = await _make_project(prisma, client.id, status="OPEN")
        contract = await _make_contract(prisma, project, client.id, freelancer.id, status="ACTIVE")

        result = await FreelanceService.complete_contract(contract.id, client.id)
        assert result["status"] == "COMPLETED"

        # Second completion is a terminal-state rejection.
        with pytest.raises(ValueError, match="actif"):
            await FreelanceService.complete_contract(contract.id, client.id)

        db = await prisma.contract.find_unique(where={"id": contract.id})
        assert db.status == "COMPLETED"

    @pytest.mark.integration
    async def test_cancel_only_active(self, prisma, make_user):
        client = await _make_user(prisma, "client@2.com", "BUSINESS")
        freelancer = await _make_user(prisma, "freelancer@2.com")
        project = await _make_project(prisma, client.id, status="OPEN")
        contract = await _make_contract(prisma, project, client.id, freelancer.id, status="CANCELLED")

        with pytest.raises(ValueError):
            await FreelanceService.complete_contract(contract.id, client.id)
        db = await prisma.contract.find_unique(where={"id": contract.id})
        assert db.status == "CANCELLED"

    @pytest.mark.integration
    async def test_dispute_blocks_completion(self, prisma, make_user):
        client = await _make_user(prisma, "client@3.com", "BUSINESS")
        freelancer = await _make_user(prisma, "freelancer@3.com")
        project = await _make_project(prisma, client.id, status="IN_PROGRESS")
        contract = await _make_contract(prisma, project, client.id, freelancer.id, status="DISPUTED")

        with pytest.raises(ValueError, match="actif"):
            await FreelanceService.complete_contract(contract.id, client.id)
        db = await prisma.contract.find_unique(where={"id": contract.id})
        assert db.status == "DISPUTED"

    @pytest.mark.integration
    async def test_concurrent_complete_only_one_wins(self, prisma, make_user):
        """Two concurrent complete_contract calls — only one may flip ACTIVE->COMPLETED."""
        client = await _make_user(prisma, "client@conc.com", "BUSINESS")
        freelancer = await _make_user(prisma, "freelancer@conc.com")
        project = await _make_project(prisma, client.id, status="OPEN")
        contract = await _make_contract(prisma, project, client.id, freelancer.id, status="ACTIVE")

        results = await asyncio.gather(
            FreelanceService.complete_contract(contract.id, client.id),
            FreelanceService.complete_contract(contract.id, client.id),
            return_exceptions=True,
        )
        succeeded = sum(1 for r in results if isinstance(r, dict) and r.get("status") == "COMPLETED")
        assert succeeded == 1

        db = await prisma.contract.find_unique(where={"id": contract.id})
        assert db.status == "COMPLETED"


class TestAcceptProposalConcurrency:

    @pytest.mark.integration
    async def test_duplicate_accept_creates_single_contract(self, prisma, make_user):
        client = await _make_user(prisma, "client@acc.com", "BUSINESS")
        freelancer = await _make_user(prisma, "freelancer@acc.com")
        project = await _make_project(prisma, client.id, status="OPEN")
        proposal = await _make_proposal(prisma, project, freelancer.id)

        results = await asyncio.gather(
            FreelanceService.accept_proposal(proposal.id, client.id),
            FreelanceService.accept_proposal(proposal.id, client.id),
            return_exceptions=True,
        )
        ok = sum(1 for r in results if isinstance(r, dict) and r.get("status") == "ACTIVE")
        assert ok == 1

        contracts = await prisma.contract.find_many(where={"projectId": project.id})
        assert len(contracts) == 1

        db_proposal = await prisma.proposal.find_unique(where={"id": proposal.id})
        assert db_proposal.status == "ACCEPTED"


class TestAssignProjectDirectly:

    @pytest.mark.integration
    async def test_duplicate_assign_single_contract(self, prisma, make_user):
        client = await _make_user(prisma, "client@assign.com", "BUSINESS")
        freelancer = await _make_user(prisma, "freelancer@assign.com")
        project = await _make_project(prisma, client.id, status="OPEN")

        async def _assign():
            from unittest.mock import AsyncMock, patch
            with patch.object(FreelanceService, "_can_act_as_client", new_callable=AsyncMock, return_value=True):
                with patch.object(FreelanceService, "_can_act_as_freelancer", new_callable=AsyncMock, return_value=True):
                    return await FreelanceService.assign_project_directly(
                        project.id, freelancer.id, client.id, None
                    )

        results = await asyncio.gather(_assign(), _assign(), return_exceptions=True)
        ok = sum(1 for r in results if isinstance(r, dict) and r.get("status") == "ACTIVE")
        assert ok == 1

        contracts = await prisma.contract.find_many(where={"projectId": project.id})
        assert len(contracts) == 1


# ── MILESTONES / ESCROW ─────────────────────────────────────────────────────

class TestMilestoneEscrow:

    async def _make(self, prisma):
        client = await _make_user(prisma, "m.client@dom.com", "BUSINESS")
        freelancer = await _make_user(prisma, "m.freelancer@dom.com")
        project = await _make_project(prisma, client.id, status="IN_PROGRESS")
        contract = await _make_contract(prisma, project, client.id, freelancer.id, status="ACTIVE")
        wallet = await _make_wallet(prisma, client.id, poda_points=200_000)
        escrow = await _make_escrow(prisma, contract.id, wallet.id, amount=100_000)
        milestone = await prisma.contractmilestone.create(
            data={
                "contractId": contract.id,
                "title": "M1",
                "amount": 40_000,
                "status": "DELIVERED",
                "deliveredAt": None,
            }
        )
        return client, freelancer, contract, wallet, escrow, milestone

    @pytest.mark.integration
    async def test_approve_releases_once_and_caps(self, prisma, make_user):
        client, freelancer, contract, wallet, escrow, m1 = await self._make(prisma)

        # Milestone 1 releases 40k.
        await MilestoneService.approve_delivery(m1.id, client.id)

        db_escrow = await prisma.escrowhold.find_unique(where={"id": escrow.id})
        assert db_escrow.releasedAmount == 40_000
        assert db_escrow.status == "PARTIALLY_RELEASED"

        # Second approval is a no-op (already APPROVED) — no double release.
        with pytest.raises(ValueError):
            await MilestoneService.approve_delivery(m1.id, client.id)
        db_escrow = await prisma.escrowhold.find_unique(where={"id": escrow.id})
        assert db_escrow.releasedAmount == 40_000

    @pytest.mark.integration
    async def test_concurrent_manual_and_auto_approval_releases_once(self, prisma, make_user):
        client, freelancer, contract, wallet, escrow, m1 = await self._make(prisma)

        # Auto path and manual path race; exactly one may claim and release.
        async def _manual():
            return await MilestoneService.approve_delivery(m1.id, client.id)

        async def _auto():
            from app.services.milestone_service import MilestoneService as MS
            ms = await prisma.contractmilestone.find_unique(where={"id": m1.id})
            try:
                await MS._auto_approve_milestone(ms)
                return True
            except ValueError:
                return False

        results = await asyncio.gather(_manual(), _auto(), return_exceptions=True)
        # only one claim succeeded (approve_delivery returns dict success)
        wins = [r for r in results if isinstance(r, dict) and r.get("success")]
        assert len(wins) == 1

        db_escrow = await prisma.escrowhold.find_unique(where={"id": escrow.id})
        assert db_escrow.releasedAmount == 40_000
        txs = await prisma.transaction.find_many(
            where={"contractId": contract.id}
        )
        release_txs = [t for t in txs if t.metadata and t.metadata.get("milestone_id") == m1.id]
        assert len(release_txs) == 1

    @pytest.mark.integration
    async def test_cannot_release_beyond_escrow(self, prisma, make_user):
        client = await _make_user(prisma, "cap.c@dom.com", "BUSINESS")
        freelancer = await _make_user(prisma, "cap.f@dom.com")
        project = await _make_project(prisma, client.id, status="IN_PROGRESS")
        contract = await _make_contract(prisma, project, client.id, freelancer.id, status="ACTIVE")
        wallet = await _make_wallet(prisma, client.id, poda_points=200_000)
        escrow = await _make_escrow(prisma, contract.id, wallet.id, amount=100_000)

        # Two milestones each 70k > 100k escrow → second release must fail.
        m1 = await prisma.contractmilestone.create(
            data={"contractId": contract.id, "title": "A", "amount": 70_000, "status": "DELIVERED"}
        )
        m2 = await prisma.contractmilestone.create(
            data={"contractId": contract.id, "title": "B", "amount": 70_000, "status": "DELIVERED"}
        )

        await MilestoneService.approve_delivery(m1.id, client.id)
        with pytest.raises(ValueError, match="exceeds remaining escrow"):
            await MilestoneService.approve_delivery(m2.id, client.id)

        db_escrow = await prisma.escrowhold.find_unique(where={"id": escrow.id})
        assert db_escrow.releasedAmount == 70_000
        assert db_escrow.status == "PARTIALLY_RELEASED"


# ── PAYOUTS ─────────────────────────────────────────────────────────────────

class TestPayoutAtomic:

    @pytest.mark.integration
    async def test_payout_claimed_once(self, prisma, make_user):
        user = await _make_user(prisma, "pay@dom.com", "BUSINESS")
        wallet = await _make_wallet(prisma, user.id, poda_points=10_000)

        # FEATURE_BASED_MODE short-circuits real payout creation on this code
        # branch — the state machine is exercised directly with a crafted row.
        payout = await prisma.payout.create(
            data={
                "walletId": wallet.id,
                "amount": 1000,
                "currency": "DZD",
                "method": "BANK_TRANSFER",
                "status": "PENDING",
            }
        )

        # Two workers race to claim PENDING -> PROCESSING.
        results = await asyncio.gather(
            payout_service.process_payout(payout.id, "worker-A"),
            payout_service.process_payout(payout.id, "worker-B"),
            return_exceptions=True,
        )
        from fastapi import HTTPException
        # A successful claim returns a PayoutResponse (not an HTTPException).
        ok = [r for r in results if isinstance(r, Exception) is False]
        conflicts = [r for r in results if isinstance(r, HTTPException) and r.status_code == 409]
        assert len(ok) == 1
        assert len(conflicts) == 1

        db = await prisma.payout.find_unique(where={"id": payout.id})
        assert db.status == "PROCESSING"

    @pytest.mark.integration
    async def test_complete_vs_fail_race(self, prisma, make_user):
        user = await _make_user(prisma, "race@dom.com", "BUSINESS")
        wallet = await _make_wallet(prisma, user.id, poda_points=10_000)
        payout = await prisma.payout.create(
            data={
                "walletId": wallet.id,
                "amount": 1000,
                "currency": "DZD",
                "method": "BANK_TRANSFER",
                "status": "PROCESSING",
            }
        )

        async def _complete():
            from fastapi import HTTPException
            try:
                return ("complete", await payout_service.complete_payout(payout.id, "ext"))
            except HTTPException as e:
                return ("complete-conflict", e.status_code)

        async def _fail():
            from fastapi import HTTPException
            try:
                return ("fail", await payout_service.fail_payout(payout.id, "boom"))
            except HTTPException as e:
                return ("fail-conflict", e.status_code)

        results = await asyncio.gather(_complete(), _fail(), return_exceptions=True)
        # Exactly one terminal outcome wins; the other must conflict.
        db = await prisma.payout.find_unique(where={"id": payout.id})
        assert db.status in ("COMPLETED", "FAILED")

        wins = [r for r in results if isinstance(r, tuple) and not str(r[1]).startswith("CONFLICT") and "conflict" not in r[0]]
        assert len(wins) == 1

    @pytest.mark.integration
    async def test_already_completed_cannot_fail_or_complete(self, prisma, make_user):
        user = await _make_user(prisma, "done@dom.com", "BUSINESS")
        wallet = await _make_wallet(prisma, user.id, poda_points=10_000)
        payout = await prisma.payout.create(
            data={
                "walletId": wallet.id,
                "amount": 1000,
                "currency": "DZD",
                "method": "BANK_TRANSFER",
                "status": "COMPLETED",
            }
        )

        from fastapi import HTTPException
        with pytest.raises(HTTPException):
            await payout_service.complete_payout(payout.id)
        with pytest.raises(HTTPException):
            await payout_service.fail_payout(payout.id, "late")
        # Balance unchanged after late fail (no double refund on bank side).
        wallet_db = await prisma.wallet.find_unique(where={"id": wallet.id})
        assert wallet_db.podaPoints == 10_000