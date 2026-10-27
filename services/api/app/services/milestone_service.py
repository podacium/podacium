import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
import json

from app.core.prisma import prisma
from app.core.background import run_background
from app.generated.prisma import Json
from app.services.notification_service import NotificationService
from app.schemas.notifications import (
    NotificationCreate,
    NotificationCategory,
    NotificationPriority,
    NotificationPayload,
)

logger = logging.getLogger(__name__)


class MilestoneService:
    """Service for managing contract milestones with auto-release escrow"""

    MILESTONE_AUTO_APPROVE_DAYS = 7

    @staticmethod
    async def create_milestones(
        contract_id: int, milestones_data: List[Dict[str, Any]], client_id: int
    ) -> List[Dict[str, Any]]:
        """Create multiple milestones for a contract"""
        try:
            contract = await prisma.contract.find_unique(
                where={"id": contract_id}, include={"project": True}
            )

            if not contract:
                raise ValueError("Contract not found")

            if contract.clientId != client_id:
                raise ValueError("Only the client can create milestones")

            if contract.status != "ACTIVE":
                raise ValueError("Contract must be active to create milestones")

            existing_milestones = await prisma.contractmilestone.count(
                where={"contractId": contract_id}
            )
            if existing_milestones > 0:
                raise ValueError("Milestones already exist for this contract")

            total_amount = sum(m.get("amount", 0) for m in milestones_data)
            if total_amount != contract.amount and contract.amount is not None:
                raise ValueError(
                    f"Total milestone amounts ({total_amount}) must equal contract amount ({contract.amount})"
                )

            created_milestones = []
            async with prisma.tx() as tx:
                for order, milestone_data in enumerate(milestones_data):
                    due_date = None
                    if milestone_data.get("due_date"):
                        due_date = milestone_data["due_date"]
                        if isinstance(due_date, str):
                            due_date = datetime.fromisoformat(
                                due_date.replace("Z", "+00:00")
                            )

                    deliverables = milestone_data.get("deliverables")
                    if deliverables and not isinstance(deliverables, str):
                        deliverables = json.dumps(deliverables)

                    settlement_ref = f"PODA-CTR{contract_id}-MS{order + 1}"
                    milestone = await tx.contractmilestone.create(
                        data={
                            "contractId": contract_id,
                            "title": milestone_data["title"],
                            "amount": milestone_data["amount"],
                            "currency": milestone_data.get("currency", "DZD"),
                            "dueDate": due_date,
                            "deliverables": deliverables,
                            "order": order,
                            "status": "PENDING",
                            "settlementReference": settlement_ref,
                        }
                    )
                    created_milestones.append(milestone)

            logger.info(
                f"Created {len(created_milestones)} milestones for contract {contract_id}"
            )
            return [MilestoneService._format_milestone(m) for m in created_milestones]

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error creating milestones: {e}")
            raise

    @staticmethod
    async def submit_delivery(
        milestone_id: int, freelancer_id: int, files: List[str], description: str
    ) -> Dict[str, Any]:
        """Submit delivery for a milestone"""
        try:
            milestone = await prisma.contractmilestone.find_unique(
                where={"id": milestone_id}, include={"contract": True}
            )

            if not milestone:
                raise ValueError("Milestone not found")

            if milestone.contract.freelancerId != freelancer_id:
                raise ValueError("Only the assigned freelancer can submit deliveries")

            if milestone.status not in ["PENDING", "DELIVERED"]:
                raise ValueError(
                    f"Cannot submit delivery for milestone with status: {milestone.status}"
                )

            files_dict = (
                {str(i): url for i, url in enumerate(files[:20])} if files else None
            )

            async with prisma.tx() as tx:
                delivery = await tx.delivery.create(
                    data={
                        "contractId": milestone.contractId,
                        "description": description,
                        "files": Json(files_dict) if files_dict else None,
                        "milestoneId": milestone_id,
                        "deliveredAt": datetime.now(timezone.utc),
                    }
                )

                await tx.contractmilestone.update(
                    where={"id": milestone_id},
                    data={
                        "status": "DELIVERED",
                        "deliveredAt": datetime.now(timezone.utc),
                        "updatedAt": datetime.now(timezone.utc),
                    },
                )

                await tx.contract.update(
                    where={"id": milestone.contractId},
                    data={"updatedAt": datetime.now(timezone.utc)},
                )

            await MilestoneService._notify_delivery_submitted(milestone, delivery)

            logger.info(
                f"Delivery submitted for milestone {milestone_id} by freelancer {freelancer_id}"
            )
            return {
                "id": delivery.id,
                "contractId": delivery.contractId,
                "milestoneId": delivery.milestoneId,
                "description": delivery.description,
                "deliveredAt": delivery.deliveredAt,
                "files": files_dict,
            }

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error submitting delivery: {e}")
            raise

    @staticmethod
    async def fund_milestone(milestone_id: int, client_id: int) -> Dict[str, Any]:
        """
        Atomically fund a milestone:
        - Pessimistically locks client wallet via SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE.
        - Transitions funds to HOLD state in the client wallet.
        - Links or updates EscrowHold for the contract.
        """
        from app.services.wallet_service import wallet_service
        from app.generated.prisma import enums as p_enums

        milestone = await prisma.contractmilestone.find_unique(
            where={"id": milestone_id}, include={"contract": True}
        )
        if not milestone:
            raise ValueError("Milestone not found")
        if milestone.contract.clientId != client_id:
            raise ValueError("Only the contract client can fund milestones")
        if milestone.contract.status != "ACTIVE":
            raise ValueError("Contract must be active to fund milestones")

        client_wallet = await prisma.wallet.find_unique(where={"userId": client_id})
        if not client_wallet:
            raise ValueError("Client wallet not found")

        amount = milestone.amount or 0
        if amount <= 0:
            raise ValueError("Milestone amount must be positive")

        async with prisma.tx() as tx:
            # Pessimistic row-lock on client wallet: SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE
            await wallet_service._lock_wallet(tx, client_wallet.id)

            # Re-read milestone under transaction
            locked_ms = await tx.contractmilestone.find_unique(
                where={"id": milestone_id}
            )
            if not locked_ms or locked_ms.status not in ["PENDING", "DELIVERED"]:
                raise ValueError("Milestone cannot be funded in current state")

            # Check existing escrow hold
            escrow_hold = await tx.escrowhold.find_unique(
                where={"contractId": milestone.contractId}
            )

            # Transition funds to HOLD state atomically
            await wallet_service.hold_funds(
                wallet_id=client_wallet.id,
                amount=amount,
                purpose=p_enums.PaymentPurpose.CONTRACT_ESCROW,
                reference_id=str(milestone.contractId),
                description=f"Escrow hold for milestone {milestone.id}: {milestone.title}",
                tx=tx,
            )

            if escrow_hold:
                updated_hold = await tx.escrowhold.update(
                    where={"id": escrow_hold.id},
                    data={
                        "amount": {"increment": amount},
                        "status": "HOLD"
                        if escrow_hold.status == "RELEASED"
                        else escrow_hold.status,
                        "updatedAt": datetime.now(timezone.utc),
                    },
                )
            else:
                updated_hold = await tx.escrowhold.create(
                    data={
                        "contractId": milestone.contractId,
                        "walletId": client_wallet.id,
                        "amount": amount,
                        "currency": milestone.currency,
                        "status": "HOLD",
                        "releaseConditions": Json(
                            {
                                "client_id": client_id,
                                "milestone_id": milestone_id,
                                "funded_at": datetime.now(timezone.utc).isoformat(),
                            }
                        ),
                    }
                )

        logger.info(
            f"Milestone {milestone_id} funded ({amount} DZD) with escrow hold {updated_hold.id}"
        )
        return {
            "success": True,
            "milestone_id": milestone_id,
            "amount_funded": amount,
            "escrow_hold_id": updated_hold.id,
        }

    @staticmethod
    async def approve_delivery(
        milestone_id: int, client_id: int, step_up_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Approve delivery and release escrow for this milestone amount.

        Atomic: the DELIVERED -> APPROVED transition is a conditional UPDATE
        scoped to status=DELIVERED, so a manual click and the Celery
        auto-approve can never both win. The escrow release happens in the
        same transaction, exactly once.

        High-value escrow disbursements (> 100,000 DZD) strictly require valid
        cryptographic step-up authorization token.
        """
        try:
            milestone = await prisma.contractmilestone.find_unique(
                where={"id": milestone_id}, include={"contract": True}
            )

            if not milestone:
                raise ValueError("Milestone not found")

            if milestone.contract.clientId != client_id:
                raise ValueError("Only the client can approve deliveries")

            if milestone.status != "DELIVERED":
                raise ValueError("Can only approve delivered milestones")

            # High-value disbursement check (> 100,000 DZD)
            if milestone.amount > 100_000:
                if not step_up_token:
                    from fastapi import HTTPException, status

                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={
                            "code": "STEP_UP_REQUIRED",
                            "message": "High-value milestone escrow disbursement (> 100,000 DZD) requires cryptographic step-up authorization.",
                            "amount": milestone.amount,
                            "threshold": 100_000,
                        },
                    )
                from app.core.security import verify_token
                from fastapi import HTTPException, status

                payload = verify_token(step_up_token)
                if (
                    not payload
                    or payload.get("type") != "step_up"
                    or payload.get("sub") != str(client_id)
                ):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={
                            "code": "INVALID_STEP_UP_TOKEN",
                            "message": "Invalid or expired step-up authorization token for high-value escrow disbursement.",
                        },
                    )

            claimed = await MilestoneService._claim_and_release(milestone)
            if not claimed:
                raise ValueError("Can only approve delivered milestones")

            await MilestoneService._notify_milestone_approved(milestone)

            logger.info(
                f"Milestone {milestone_id} approved by client {client_id}, escrow released"
            )
            return {
                "success": True,
                "milestone_id": milestone_id,
                "amount_released": milestone.amount,
            }

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error approving delivery: {e}")
            raise

    @staticmethod
    async def _claim_and_release(milestone) -> bool:
        """
        Authoritative single implementation for "approve milestone + release
        its escrow fraction".

        - ``DELIVERED -> APPROVED`` is an atomic conditional transition; the
          caller that claims it (affected_rows == 1) is the only one allowed to
          release escrow. Every other concurrent caller sees 0 rows and backs off.
        - Escrow release is capped at ``released <= amount`` and performed in
          the SAME transaction as the approval, so an approved milestone can
          never be double-released.

        Returns True if this call performed the claim (and release), False if
        the milestone was already claimed by another caller.
        """
        from app.core.prisma import prisma
        from app.core.config import setting, FinancialMode

        now = datetime.now(timezone.utc)
        async with prisma.tx() as tx:
            claimed = await tx.contractmilestone.update_many(
                where={"id": milestone.id, "status": "DELIVERED"},
                data={
                    "status": "APPROVED",
                    "approvedAt": now,
                    "updatedAt": now,
                    "deliverableKeyReleased": True,
                    "releasedAt": now,
                },
            )
            if claimed == 0:
                return False

            await tx.contract.update(
                where={"id": milestone.contractId}, data={"updatedAt": now}
            )

            # In LICENSED_PSP mode, execute escrow hold release.
            # In NON_CUSTODIAL mode, funds were settled direct P2P.
            if (
                getattr(setting, "FINANCIAL_MODE", FinancialMode.NON_CUSTODIAL)
                == FinancialMode.LICENSED_PSP
            ):
                await MilestoneService._release_milestone_escrow(milestone, tx)

        # Generate compliant Triple Document Kit (Contrat, PV Réception, Facture ANAE)
        try:
            from app.services.invoice_service import invoice_service

            await invoice_service.generate_milestone_kit(
                milestone.contractId, milestone.id
            )
        except Exception as e:
            logger.warning(
                f"Could not generate invoice kit for milestone {milestone.id}: {e}"
            )

        # Generate Bilateral IP Assignment Deed (Ordonnance 03-05 ONDA & Loi 22-23 ANAE)
        try:
            from app.services.ip_assignment_service import ip_assignment_service

            await ip_assignment_service.generate_ip_deed_on_milestone_release(
                milestone.id
            )
        except Exception as e:
            logger.warning(
                f"Could not generate IP assignment deed for milestone {milestone.id}: {e}"
            )

        return True

    @staticmethod
    async def _release_milestone_escrow(milestone, tx=None) -> None:
        """
        Release escrow for a specific milestone amount (partial release).

        Must run inside a transaction (``tx``). The EscrowHold row is locked
        (``SELECT ... FOR UPDATE``) before ``releasedAmount`` is read so two
        concurrent partial releases can never both read the same stale balance.
        ``total released`` can never exceed ``escrow amount``.
        """
        from app.services.wallet_service import wallet_service
        from app.generated.prisma import enums as p_enums

        if tx is None:
            raise ValueError("_release_milestone_escrow requires an active transaction")

        escrow_hold = await tx.escrowhold.find_unique(
            where={"contractId": milestone.contractId}
        )

        if not escrow_hold or escrow_hold.status not in ["HOLD", "PARTIALLY_RELEASED"]:
            logger.warning(f"No active escrow hold for contract {milestone.contractId}")
            return

        # Row-lock the escrow hold and re-read the released amount under the lock.
        locked = await tx.query_raw(
            'SELECT id FROM "EscrowHold" WHERE id = $1 FOR UPDATE',
            escrow_hold.id,
        )
        if not locked:
            return
        locked_hold = await tx.escrowhold.find_unique(where={"id": escrow_hold.id})
        if locked_hold is None:
            return

        release_amount = milestone.amount or 0
        if release_amount <= 0:
            return

        released_so_far = locked_hold.releasedAmount or 0
        remaining = locked_hold.amount - released_so_far
        if release_amount > remaining:
            raise ValueError(
                f"Milestone release {release_amount} exceeds remaining escrow "
                f"{remaining} for contract {milestone.contractId}"
            )

        new_released = released_so_far + release_amount
        new_status = (
            "RELEASED" if new_released >= locked_hold.amount else "PARTIALLY_RELEASED"
        )

        # Look up freelancer wallet
        contract = await tx.contract.find_unique(where={"id": milestone.contractId})
        freelancer_wallet = None
        if contract and contract.freelancerId:
            freelancer_wallet = await tx.wallet.find_unique(
                where={"userId": contract.freelancerId}
            )
            if not freelancer_wallet:
                freelancer_wallet = await tx.wallet.create(
                    data={
                        "userId": contract.freelancerId,
                        "currency": locked_hold.currency,
                        "podaPoints": 0,
                    }
                )

        # DEADLOCK PREVENTION: Canonical lock acquisition order across wallets BEFORE any wallet modification
        if freelancer_wallet:
            first_lock, second_lock = sorted(
                [locked_hold.walletId, freelancer_wallet.id]
            )
            await wallet_service._lock_wallet(tx, first_lock)
            if first_lock != second_lock:
                await wallet_service._lock_wallet(tx, second_lock)
        else:
            await wallet_service._lock_wallet(tx, locked_hold.walletId)

        await wallet_service.release_hold(
            wallet_id=locked_hold.walletId,
            amount=release_amount,
            purpose=p_enums.PaymentPurpose.CONTRACT_ESCROW,
            reference_id=str(locked_hold.contractId),
            description=f"Partial release for milestone {milestone.id}: {milestone.title}",
            tx=tx,
        )

        # Debit client wallet
        await wallet_service.debit_wallet(
            wallet_id=locked_hold.walletId,
            amount=release_amount,
            purpose=p_enums.PaymentPurpose.CONTRACT_ESCROW,
            reference_id=str(milestone.id),
            description=f"Escrow payment for milestone {milestone.id}: {milestone.title}",
            tx=tx,
        )

        # Credit freelancer wallet
        if freelancer_wallet:
            await wallet_service.credit_wallet(
                wallet_id=freelancer_wallet.id,
                amount=release_amount,
                purpose=p_enums.PaymentPurpose.CONTRACT_ESCROW,
                reference_id=str(milestone.id),
                description=f"Escrow payout for milestone {milestone.id}: {milestone.title}",
                tx=tx,
            )

        await tx.escrowhold.update(
            where={"id": locked_hold.id},
            data={
                "status": new_status,
                "releasedAmount": new_released,
                "releasedAt": datetime.now(timezone.utc)
                if new_status == "RELEASED"
                else None,
                "updatedAt": datetime.now(timezone.utc),
            },
        )

        await tx.transaction.create(
            data={
                "contractId": milestone.contractId,
                "walletId": locked_hold.walletId,
                "amount": release_amount,
                "currency": locked_hold.currency,
                "purpose": p_enums.PaymentPurpose.CONTRACT_ESCROW,
                "status": p_enums.PaymentStatus.COMPLETED,
                "provider": p_enums.PaymentProvider.OTHER,
                "metadata": Json(
                    {
                        "escrow_hold_id": locked_hold.id,
                        "milestone_id": milestone.id,
                        "milestone_title": milestone.title,
                        "type": "partial_release",
                    }
                ),
            }
        )

        logger.info(
            f"Released {release_amount} for milestone {milestone.id} "
            f"(total released: {new_released}/{locked_hold.amount})"
        )

    @staticmethod
    async def dispute_milestone(
        milestone_id: int, reason: str, user_id: int
    ) -> Dict[str, Any]:
        """Dispute a milestone delivery"""
        try:
            milestone = await prisma.contractmilestone.find_unique(
                where={"id": milestone_id}, include={"contract": True}
            )

            if not milestone:
                raise ValueError("Milestone not found")

            if (
                milestone.contract.freelancerId != user_id
                and milestone.contract.clientId != user_id
            ):
                raise ValueError("Only parties to the contract can dispute milestones")

            if milestone.status != "DELIVERED":
                raise ValueError(
                    "Can only dispute delivered milestones awaiting approval"
                )

            opponent_id = (
                milestone.contract.freelancerId
                if milestone.contract.clientId == user_id
                else milestone.contract.clientId
            )

            async with prisma.tx() as tx:
                existing_dispute = await tx.dispute.find_first(
                    where={"contractId": milestone.contractId, "status": "OPEN"}
                )
                if existing_dispute:
                    raise ValueError("Un litige est déjà en cours pour ce contrat")

                now = datetime.now(timezone.utc)
                updated = await tx.contractmilestone.update_many(
                    where={"id": milestone_id, "status": "DELIVERED"},
                    data={
                        "status": "DISPUTED",
                        "disputedAt": now,
                        "updatedAt": now,
                    },
                )
                if updated == 0:
                    raise ValueError(
                        "Milestone is no longer in DELIVERED state or has already been approved"
                    )

                dispute = await tx.dispute.create(
                    data={
                        "contractId": milestone.contractId,
                        "milestoneId": milestone_id,
                        "creatorId": user_id,
                        "opponentId": opponent_id,
                        "reason": "POOR_QUALITY",
                        "description": f"Milestone dispute: {reason}",
                        "status": "OPEN",
                        "metadata": {
                            "milestone_id": milestone_id,
                            "milestone_title": milestone.title,
                            "dispute_reason": reason,
                        },
                    }
                )

                await tx.contract.update(
                    where={"id": milestone.contractId},
                    data={
                        "status": "DISPUTED",
                        "updatedAt": now,
                    },
                )

                await tx.auditlog.create(
                    data={
                        "eventType": "milestone_disputed",
                        "entityType": "dispute",
                        "entityId": str(dispute.id),
                        "actorId": user_id,
                        "metadata": {
                            "contract_id": milestone.contractId,
                            "milestone_id": milestone_id,
                            "reason": reason,
                        },
                    }
                )

            await MilestoneService._notify_milestone_disputed(
                milestone, dispute, user_id
            )

            logger.info(f"Milestone {milestone_id} disputed by user {user_id}")
            return {
                "success": True,
                "dispute_id": dispute.id,
                "milestone_id": milestone_id,
                "message": "Dispute created successfully",
            }

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error disputing milestone: {e}")
            raise

    @staticmethod
    async def request_milestone_revision(
        milestone_id: int,
        client_id: int,
        criteria: List[str],
        revision_notes: str,
    ) -> Dict[str, Any]:
        """
        Client requests structured revisions for a delivered milestone.
        Transitions status from DELIVERED -> IN_PROGRESS.
        Atomic conditional update ensures state cannot race with auto-approval or dispute.
        """
        try:
            milestone = await prisma.contractmilestone.find_unique(
                where={"id": milestone_id}, include={"contract": True}
            )
            if not milestone:
                raise ValueError("Milestone not found")
            if milestone.contract.clientId != client_id:
                raise ValueError("Only the contract client can request revisions")
            if milestone.status != "DELIVERED":
                raise ValueError(
                    f"Can only request revisions on DELIVERED milestones, current status is {milestone.status}"
                )

            now = datetime.now(timezone.utc)
            async with prisma.tx() as tx:
                claimed = await tx.contractmilestone.update_many(
                    where={"id": milestone_id, "status": "DELIVERED"},
                    data={
                        "status": "IN_PROGRESS",
                        "updatedAt": now,
                    },
                )
                if claimed == 0:
                    raise ValueError(
                        "Milestone is no longer in DELIVERED state (may have been approved or disputed)"
                    )

                await tx.contract.update(
                    where={"id": milestone.contractId},
                    data={"updatedAt": now},
                )

                await tx.auditlog.create(
                    data={
                        "eventType": "milestone_revision_requested",
                        "entityType": "milestone",
                        "entityId": str(milestone_id),
                        "actorId": client_id,
                        "metadata": {
                            "contract_id": milestone.contractId,
                            "milestone_id": milestone_id,
                            "criteria": criteria,
                            "notes": revision_notes,
                        },
                    }
                )

            # Send notification to freelancer
            try:
                from app.services.notification_service import NotificationService
                from app.schemas.notifications import (
                    NotificationCreate,
                    NotificationCategory,
                    NotificationPriority,
                )

                action_url = f"/hub/contracts/{milestone.contractId}"
                run_background(
                    NotificationService.create_notification(
                        NotificationCreate(
                            userId=milestone.contract.freelancerId,
                            type="MILESTONE_REVISION_REQUESTED",
                            category=NotificationCategory.PROJECT,
                            priority=NotificationPriority.HIGH,
                            title="Demande de révision sur le jalon",
                            body=f"Le client a demandé des ajustements sur le jalon '{milestone.title}': {revision_notes[:100]}...",
                            data={
                                "contract_id": milestone.contractId,
                                "milestone_id": milestone.id,
                                "criteria": criteria,
                                "notes": revision_notes,
                                "action_url": action_url,
                            },
                        )
                    ),
                    name=f"notify_milestone_revision_{milestone.id}",
                )
            except Exception as e:
                logger.warning(f"Could not notify freelancer of revision request: {e}")

            logger.info(
                f"Revision requested for milestone {milestone_id} by client {client_id}"
            )
            return {
                "success": True,
                "milestone_id": milestone_id,
                "status": "IN_PROGRESS",
                "criteria": criteria,
                "revision_notes": revision_notes,
            }

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error requesting revision for milestone {milestone_id}: {e}")
            raise

    @staticmethod
    async def auto_approve_after_timeout() -> Dict[str, Any]:
        """Celery task: Auto-approve milestones delivered more than 7 days ago"""
        try:
            now = datetime.now(timezone.utc)
            cutoff = now - timedelta(days=MilestoneService.MILESTONE_AUTO_APPROVE_DAYS)

            stale_milestones = await prisma.contractmilestone.find_many(
                where={
                    "status": "DELIVERED",
                    "deliveredAt": {"lt": cutoff},
                },
                include={"contract": True},
            )

            approved_count = 0
            for milestone in stale_milestones:
                try:
                    claimed = await MilestoneService._auto_approve_milestone(milestone)
                    if claimed:
                        approved_count += 1
                except Exception as e:
                    logger.error(
                        f"Failed to auto-approve milestone {milestone.id}: {e}"
                    )

            logger.info(
                f"Auto-approved {approved_count} milestones after {MilestoneService.MILESTONE_AUTO_APPROVE_DAYS}-day timeout"
            )
            return {
                "checked": len(stale_milestones),
                "auto_approved": approved_count,
                "timestamp": now.isoformat(),
            }

        except Exception as e:
            logger.error(f"Error in auto_approve_after_timeout: {e}")
            raise

    @staticmethod
    async def _auto_approve_milestone(milestone) -> bool:
        """Auto-approve a single milestone (authoritative implementation).

        The Celery task delegates here instead of duplicating the money logic.
        Returns True if milestone was claimed and released, False otherwise.
        """
        claimed = await MilestoneService._claim_and_release(milestone)
        if claimed:
            await MilestoneService._notify_auto_approved(milestone)
            return True
        else:
            logger.warning(
                f"Milestone {milestone.id} could not be claimed for auto-approval"
            )
            return False

    @staticmethod
    async def _notify_delivery_submitted(milestone, delivery) -> None:
        """Notify client about delivery submission"""
        action_url = f"/hub/contracts/{milestone.contractId}"
        run_background(
            NotificationService.create_notification(
                NotificationCreate(
                    userId=milestone.contract.clientId,
                    type="MILESTONE_DELIVERED",
                    title="Milestone Delivered",
                    body=f"Milestone '{milestone.title}' has been delivered for review",
                    data={
                        "contract_id": milestone.contractId,
                        "milestone_id": milestone.id,
                        "delivery_id": delivery.id,
                        "action_url": action_url,
                        "url": action_url,
                    },
                    payload=NotificationPayload(
                        entity_type="contract",
                        entity_id=str(milestone.contractId),
                        action_url=action_url,
                        metadata={
                            "milestone_id": milestone.id,
                            "delivery_id": delivery.id,
                        },
                    ),
                    category=NotificationCategory.PROJECT,
                    priority=NotificationPriority.NORMAL,
                )
            ),
            name=f"notify_milestone_delivered_{milestone.id}",
        )

    @staticmethod
    async def _notify_milestone_approved(milestone) -> None:
        """Notify freelancer about approval"""
        action_url = f"/hub/contracts/{milestone.contractId}"
        run_background(
            NotificationService.create_notification(
                NotificationCreate(
                    userId=milestone.contract.freelancerId,
                    type="MILESTONE_APPROVED",
                    title="Milestone Approved",
                    body=f"Milestone '{milestone.title}' has been approved. Payment released!",
                    data={
                        "contract_id": milestone.contractId,
                        "milestone_id": milestone.id,
                        "amount_released": milestone.amount,
                        "action_url": action_url,
                        "url": action_url,
                    },
                    payload=NotificationPayload(
                        entity_type="contract",
                        entity_id=str(milestone.contractId),
                        action_url=action_url,
                        metadata={
                            "milestone_id": milestone.id,
                            "amount_released": milestone.amount,
                        },
                    ),
                    category=NotificationCategory.PROJECT,
                    priority=NotificationPriority.HIGH,
                )
            ),
            name=f"notify_milestone_approved_{milestone.id}",
        )

    @staticmethod
    async def _notify_auto_approved(milestone) -> None:
        """Notify about auto-approval"""
        action_url = f"/hub/contracts/{milestone.contractId}"
        run_background(
            NotificationService.create_notification(
                NotificationCreate(
                    userId=milestone.contract.freelancerId,
                    type="MILESTONE_AUTO_APPROVED",
                    title="Milestone Auto-Approved",
                    body=f"Milestone '{milestone.title}' was auto-approved after {MilestoneService.MILESTONE_AUTO_APPROVE_DAYS} days. Payment released!",
                    data={
                        "contract_id": milestone.contractId,
                        "milestone_id": milestone.id,
                        "amount_released": milestone.amount,
                        "action_url": action_url,
                        "url": action_url,
                    },
                    payload=NotificationPayload(
                        entity_type="contract",
                        entity_id=str(milestone.contractId),
                        action_url=action_url,
                        metadata={
                            "milestone_id": milestone.id,
                            "amount_released": milestone.amount,
                        },
                    ),
                    category=NotificationCategory.PROJECT,
                    priority=NotificationPriority.HIGH,
                )
            ),
            name=f"notify_auto_approved_{milestone.id}",
        )

        run_background(
            NotificationService.create_notification(
                NotificationCreate(
                    userId=milestone.contract.clientId,
                    type="MILESTONE_AUTO_APPROVED_CLIENT",
                    title="Milestone Auto-Approved",
                    body=f"Milestone '{milestone.title}' was auto-approved after {MilestoneService.MILESTONE_AUTO_APPROVE_DAYS} days of inactivity. Payment released to freelancer.",
                    data={
                        "contract_id": milestone.contractId,
                        "milestone_id": milestone.id,
                        "action_url": action_url,
                        "url": action_url,
                    },
                    payload=NotificationPayload(
                        entity_type="contract",
                        entity_id=str(milestone.contractId),
                        action_url=action_url,
                        metadata={"milestone_id": milestone.id},
                    ),
                    category=NotificationCategory.PROJECT,
                    priority=NotificationPriority.NORMAL,
                )
            ),
            name=f"notify_auto_approved_client_{milestone.id}",
        )

    @staticmethod
    async def _notify_milestone_disputed(milestone, dispute, user_id: int) -> None:
        """Notify about milestone dispute"""
        opponent_id = (
            milestone.contract.freelancerId
            if milestone.contract.clientId == user_id
            else milestone.contract.clientId
        )
        action_url = f"/hub/disputes/{dispute.id}"

        run_background(
            NotificationService.create_notification(
                NotificationCreate(
                    userId=opponent_id,
                    type="MILESTONE_DISPUTED",
                    title="Milestone Disputed",
                    body=f"Milestone '{milestone.title}' has been disputed. Please review.",
                    data={
                        "contract_id": milestone.contractId,
                        "milestone_id": milestone.id,
                        "dispute_id": dispute.id,
                        "action_url": action_url,
                        "url": action_url,
                    },
                    payload=NotificationPayload(
                        entity_type="dispute",
                        entity_id=str(dispute.id),
                        action_url=action_url,
                        metadata={
                            "contract_id": milestone.contractId,
                            "milestone_id": milestone.id,
                        },
                    ),
                    category=NotificationCategory.PROJECT,
                    priority=NotificationPriority.HIGH,
                )
            ),
            name=f"notify_milestone_disputed_{milestone.id}",
        )

    @staticmethod
    def _format_milestone(milestone) -> Dict[str, Any]:
        """Format milestone for response"""
        deliverables = None
        if milestone.deliverables:
            try:
                deliverables = json.loads(milestone.deliverables)
            except (json.JSONDecodeError, TypeError):
                deliverables = milestone.deliverables

        return {
            "id": milestone.id,
            "contractId": milestone.contractId,
            "title": milestone.title,
            "amount": milestone.amount,
            "currency": milestone.currency,
            "dueDate": milestone.dueDate.isoformat() if milestone.dueDate else None,
            "deliverables": deliverables,
            "status": milestone.status,
            "order": milestone.order,
            "createdAt": milestone.createdAt.isoformat()
            if milestone.createdAt
            else None,
            "updatedAt": milestone.updatedAt.isoformat()
            if milestone.updatedAt
            else None,
            "deliveredAt": milestone.deliveredAt.isoformat()
            if milestone.deliveredAt
            else None,
            "approvedAt": milestone.approvedAt.isoformat()
            if milestone.approvedAt
            else None,
            "disputedAt": milestone.disputedAt.isoformat()
            if milestone.disputedAt
            else None,
        }

    @staticmethod
    async def get_contract_milestones(
        contract_id: int, user_id: int
    ) -> List[Dict[str, Any]]:
        """Get all milestones for a contract"""
        contract = await prisma.contract.find_unique(where={"id": contract_id})
        if not contract:
            raise ValueError("Contract not found")

        if contract.clientId != user_id and contract.freelancerId != user_id:
            raise ValueError("Not authorized to view these milestones")

        milestones = await prisma.contractmilestone.find_many(
            where={"contractId": contract_id}, order={"order": "asc"}
        )

        return [MilestoneService._format_milestone(m) for m in milestones]

    @staticmethod
    async def get_milestone(milestone_id: int, user_id: int) -> Dict[str, Any]:
        """Get a single milestone with its deliveries"""
        milestone = await prisma.contractmilestone.find_unique(
            where={"id": milestone_id}, include={"contract": True, "deliveries": True}
        )

        if not milestone:
            raise ValueError("Milestone not found")

        if (
            milestone.contract.clientId != user_id
            and milestone.contract.freelancerId != user_id
        ):
            raise ValueError("Not authorized to view this milestone")

        deliveries = []
        for d in milestone.deliveries:
            files_data = None
            if d.files:
                try:
                    files_data = json.loads(d.files)
                except (json.JSONDecodeError, TypeError):
                    files_data = d.files
            deliveries.append(
                {
                    "id": d.id,
                    "description": d.description,
                    "deliveredAt": d.deliveredAt.isoformat() if d.deliveredAt else None,
                    "files": files_data,
                }
            )

        result = MilestoneService._format_milestone(milestone)
        result["deliveries"] = deliveries
        return result
