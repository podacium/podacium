"""
AWS Multi-Party Approval Engine (Two-Person Integrity / Four-Eyes Principle).
Governs destructive administrative actions across IAM, Education, and Billing.
"""

from datetime import datetime, timezone, timedelta
import logging
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status

from app.core.prisma import prisma
from app.generated.prisma import enums as p_enums, Json
from app.services.audit_trail_service import AuditTrailService

logger = logging.getLogger("podacium.maker_checker")

ACTION_DEPROVISION_SUBADMIN = "DEPROVISION_SUBADMIN"
ACTION_BULK_DELETE_COURSES = "BULK_DELETE_COURSES"
ACTION_MANUAL_BALANCE_ADJUSTMENT = "MANUAL_BALANCE_ADJUSTMENT"
ACTION_CORPORATE_ESCROW_RELEASE = "CORPORATE_ESCROW_RELEASE"
ACTION_APPROVE_KYB = "APPROVE_KYB"
ACTION_GRANT_PRIVILEGED_ROLE = "GRANT_PRIVILEGED_ROLE"

DESTRUCTIVE_ACTIONS = {
    ACTION_DEPROVISION_SUBADMIN,
    ACTION_BULK_DELETE_COURSES,
    ACTION_MANUAL_BALANCE_ADJUSTMENT,
    ACTION_CORPORATE_ESCROW_RELEASE,
    ACTION_APPROVE_KYB,
    ACTION_GRANT_PRIVILEGED_ROLE,
}


class MakerCheckerService:
    @staticmethod
    async def create_pending_action(
        initiator_id: int,
        action_type: str,
        target_resource: str,
        payload: Dict[str, Any],
        target_id: Optional[str] = None,
        expires_in_hours: int = 24,
    ) -> Dict[str, Any]:
        """
        Initiates a multi-party governance action entering PENDING_APPROVAL.
        """
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=expires_in_hours)

        action = await prisma.pendingadminaction.create(
            data={
                "actionType": action_type,
                "targetResource": target_resource,
                "targetId": target_id,
                "payload": Json(payload),
                "status": p_enums.PendingActionStatus.PENDING_APPROVAL,
                "initiatorId": initiator_id,
                "expiresAt": expires_at,
            },
            include={"initiator": True},
        )

        await AuditTrailService.log_action(
            actor_id=initiator_id,
            action=f"GOVERNANCE_ACTION_REQUESTED_{action_type}",
            domain="IAM",
            resource_type="PendingAdminAction",
            resource_id=action.id,
            before_state=None,
            after_state={"status": "PENDING_APPROVAL", "payload": payload},
        )

        return {
            "id": action.id,
            "status": "PENDING_APPROVAL",
            "message": "Action created and requires second administrator approval (Two-Person Integrity).",
            "actionType": action.actionType,
            "targetResource": action.targetResource,
            "targetId": action.targetId,
            "expiresAt": action.expiresAt.isoformat(),
        }

    @staticmethod
    async def list_pending_actions(
        status_filter: Optional[str] = "PENDING_APPROVAL",
    ) -> List[Dict[str, Any]]:
        where: Dict[str, Any] = {}
        if status_filter and status_filter != "ALL":
            status_enum = getattr(
                p_enums.PendingActionStatus, status_filter.upper(), None
            )
            if status_enum:
                where["status"] = status_enum

        actions = await prisma.pendingadminaction.find_many(
            where=where,
            order={"createdAt": "desc"},
            include={"initiator": True, "approver": True},
        )

        return [
            {
                "id": a.id,
                "actionType": a.actionType,
                "targetResource": a.targetResource,
                "targetId": a.targetId,
                "payload": a.payload,
                "status": a.status.name,
                "initiatorId": a.initiatorId,
                "initiatorName": a.initiator.fullName if a.initiator else "Unknown",
                "initiatorEmail": a.initiator.email if a.initiator else "Unknown",
                "approverId": a.approverId,
                "approverName": a.approver.fullName if a.approver else None,
                "approvalNotes": a.approvalNotes,
                "rejectionReason": a.rejectionReason,
                "expiresAt": a.expiresAt.isoformat(),
                "executedAt": a.executedAt.isoformat() if a.executedAt else None,
                "createdAt": a.createdAt.isoformat(),
            }
            for a in actions
        ]

    @staticmethod
    async def approve_and_execute(
        action_id: str,
        approver_id: int,
        approval_notes: Optional[str] = None,
        auth_method: Optional[str] = None,
        webauthn_verified: bool = False,
        step_up_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Approves and atomically executes a pending action enforcing Two-Person Integrity.
        Transactions exceeding 100,000 DZD strictly enforce FIDO2/WebAuthn hardware step-up.
        """
        action = await prisma.pendingadminaction.find_unique(where={"id": action_id})
        if not action:
            raise HTTPException(status_code=404, detail="Pending action not found")

        if action.status != p_enums.PendingActionStatus.PENDING_APPROVAL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Action is not pending approval (current status: {action.status.name})",
            )

        now = datetime.now(timezone.utc)
        if action.expiresAt < now:
            await prisma.pendingadminaction.update(
                where={"id": action_id},
                data={"status": p_enums.PendingActionStatus.EXPIRED},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pending action has expired.",
            )

        # SEPARATION OF DUTIES: Approver cannot be the initiator
        if action.initiatorId == approver_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "SEPARATION_OF_DUTIES_VIOLATION",
                    "message": "Two-Person Integrity violation: the approving administrator must be distinct from the initiating administrator.",
                },
            )

        # ATOMIC EXECUTION based on actionType
        payload = action.payload if isinstance(action.payload, dict) else {}
        execution_result: Dict[str, Any] = {}

        if action.actionType == ACTION_DEPROVISION_SUBADMIN:
            raw_target_id = action.targetId or payload.get("userId")
            if not raw_target_id:
                raise HTTPException(
                    status_code=400, detail="Target user ID missing from payload"
                )
            target_user_id = int(raw_target_id)
            profile = await prisma.adminprofile.find_unique(
                where={"userId": target_user_id}
            )
            if profile:
                await prisma.adminuserroleassignment.delete_many(
                    where={"adminProfileId": profile.id}
                )
                await prisma.adminsession.update_many(
                    where={"adminProfileId": profile.id, "revokedAt": None},
                    data={"revokedAt": now},
                )
                await prisma.adminprofile.update(
                    where={"id": profile.id},
                    data={
                        "isActive": False,
                        "deletedAt": now,
                        "suspendedAt": now,
                        "suspensionReason": f"Deprovisioned via Multi-Party Dual Approval (Initiator #{action.initiatorId}, Approver #{approver_id})",
                    },
                )
                await prisma.user.update(
                    where={"id": target_user_id},
                    data={"role": "STUDENT"},
                )
                from app.core.rbac import invalidate_permission_cache

                await invalidate_permission_cache(target_user_id)
                from app.core.security import add_user_to_blocklist

                await add_user_to_blocklist(target_user_id)
            execution_result = {"deprovisionedUserId": target_user_id}

        elif action.actionType == ACTION_BULK_DELETE_COURSES:
            module_ids = payload.get("moduleIds", [])
            for mid in module_ids:
                await prisma.module.update(
                    where={"id": mid},
                    data={"deletedAt": now},
                )
            execution_result = {"deletedModulesCount": len(module_ids)}

        elif action.actionType == ACTION_MANUAL_BALANCE_ADJUSTMENT:
            raw_wallet_id = action.targetId or payload.get("walletId")
            if not raw_wallet_id:
                raise HTTPException(
                    status_code=400, detail="Wallet ID missing from payload"
                )
            wallet_id = int(raw_wallet_id)
            amount = float(payload.get("amount", 0))
            reason = payload.get("reason", "Manual balance adjustment")

            async with prisma.tx() as tx:
                wallet = await tx.wallet.find_unique(where={"id": wallet_id})
                if not wallet:
                    raise HTTPException(status_code=404, detail="Wallet not found")
                new_balance = wallet.podaPoints + amount
                if new_balance < 0:
                    raise HTTPException(status_code=400, detail="Insufficient balance")
                await tx.wallet.update(
                    where={"id": wallet_id},
                    data={"podaPoints": new_balance},
                )
                await tx.transaction.create(
                    data={
                        "userId": wallet.userId,
                        "amount": abs(amount),
                        "type": "CREDIT" if amount > 0 else "DEBIT",
                        "status": "COMPLETED",
                        "currency": "DZD",
                        "description": f"Admin balance adjustment: {reason}",
                    }
                )
            execution_result = {
                "walletId": wallet_id,
                "adjustment": amount,
                "newBalance": new_balance,
            }

        elif action.actionType == ACTION_CORPORATE_ESCROW_RELEASE:
            milestone_id = payload.get("milestoneId")
            contract_id = payload.get("contractId")
            amount_dzd = float(payload.get("amountDzd", 0))
            is_high_value = amount_dzd > 100000.0 or bool(payload.get("isHighValue"))

            # HARDWARE WEBAUTHN / FIDO2 STEP-UP ENFORCEMENT FOR > 100,000 DZD
            is_step_up_satisfied = bool(webauthn_verified)
            if is_high_value and not is_step_up_satisfied:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "code": "WEBAUTHN_STEP_UP_REQUIRED",
                        "message": "Corporate escrow releases exceeding 100,000 DZD require hardware FIDO2 / WebAuthn biometric step-up verification.",
                        "amountDzd": amount_dzd,
                        "thresholdDzd": 100000.0,
                    },
                )

            if not milestone_id:
                raise HTTPException(
                    status_code=400, detail="Milestone ID missing from payload"
                )

            async with prisma.tx() as tx:
                milestone = await tx.contractmilestone.find_unique(
                    where={"id": int(milestone_id)}
                )
                if not milestone:
                    raise HTTPException(status_code=404, detail="Milestone not found")

                await tx.contractmilestone.update(
                    where={"id": int(milestone_id)},
                    data={
                        "status": p_enums.MilestoneStatus.APPROVED,
                        "approvedAt": now,
                        "releasedAt": now,
                        "deliverableKeyReleased": True,
                    },
                )

            execution_result = {
                "milestoneId": milestone_id,
                "contractId": contract_id,
                "amountDzd": amount_dzd,
                "status": "APPROVED_AND_RELEASED",
                "twoPersonIntegritySatisfied": True,
                "webauthnStepUpVerified": bool(is_step_up_satisfied),
            }

        elif action.actionType == ACTION_APPROVE_KYB:
            raw_kyb_id = action.targetId or payload.get("kybId")
            if not raw_kyb_id:
                raise HTTPException(
                    status_code=400, detail="KYB ID missing from payload"
                )
            kyb_id = int(raw_kyb_id)
            from app.services.kyb_service import KybService

            decision = payload.get("decision", "APPROVED")
            reason = payload.get("reason") or approval_notes
            updated_kyb = await KybService.review_kyb_submission(
                kyb_id=kyb_id,
                admin_id=approver_id,
                new_status=decision,
                reason=reason,
            )
            execution_result = {
                "kybId": kyb_id,
                "status": (
                    updated_kyb.status.name
                    if hasattr(updated_kyb.status, "name")
                    else str(updated_kyb.status)
                ),
                "verifiedAt": (
                    updated_kyb.verifiedAt.isoformat()
                    if updated_kyb.verifiedAt
                    else None
                ),
                "verifiedBy": approver_id,
                "twoPersonIntegritySatisfied": True,
            }

        elif action.actionType == ACTION_GRANT_PRIVILEGED_ROLE:
            target_user_id = int(action.targetId or payload.get("targetUserId", 0))
            role_slug = payload.get("roleSlug")
            dept_name = payload.get("department", "CUSTOMER_SUPPORT")
            title = payload.get("title")
            role = await prisma.adminrole.find_unique(where={"slug": role_slug})
            if not role:
                raise HTTPException(status_code=404, detail="Role not found")
            profile = await prisma.adminprofile.find_unique(
                where={"userId": target_user_id}
            )
            dept_enum = getattr(
                p_enums.AdminDepartment,
                dept_name,
                p_enums.AdminDepartment.CUSTOMER_SUPPORT,
            )
            if not profile:
                profile = await prisma.adminprofile.create(
                    data={
                        "userId": target_user_id,
                        "department": dept_enum,
                        "title": title or f"{role.name} Staff",
                        "clearanceLevel": min(role.hierarchyRank, 10),
                        "isActive": True,
                    }
                )
            else:
                profile = await prisma.adminprofile.update(
                    where={"id": profile.id},
                    data={
                        "department": dept_enum,
                        "title": title or profile.title,
                        "clearanceLevel": max(
                            profile.clearanceLevel, role.hierarchyRank
                        ),
                    },
                )
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
                        "assignedById": approver_id,
                    },
                    "update": {
                        "assignedById": approver_id,
                    },
                },
            )
            from app.core.rbac import invalidate_permission_cache

            await invalidate_permission_cache(target_user_id)
            execution_result = {
                "targetUserId": target_user_id,
                "roleSlug": role_slug,
                "clearanceLevel": profile.clearanceLevel,
                "twoPersonIntegritySatisfied": True,
            }

        # Update action status to EXECUTED
        await prisma.pendingadminaction.update(
            where={"id": action_id},
            data={
                "status": p_enums.PendingActionStatus.EXECUTED,
                "approverId": approver_id,
                "approvalNotes": approval_notes,
                "executedAt": now,
            },
        )

        # Record in cryptographic audit vault recording BOTH initiator_id and approver_id
        await AuditTrailService.log_action(
            actor_id=approver_id,
            action=f"GOVERNANCE_ACTION_EXECUTED_{action.actionType}",
            domain="IAM",
            resource_type="PendingAdminAction",
            resource_id=action_id,
            metadata={
                "initiatorId": action.initiatorId,
                "approverId": approver_id,
                "actionType": action.actionType,
                "targetResource": action.targetResource,
                "targetId": action.targetId,
                "notes": approval_notes,
                "executionResult": execution_result,
            },
        )

        return {
            "success": True,
            "status": "EXECUTED",
            "actionId": action_id,
            "initiatorId": action.initiatorId,
            "approverId": approver_id,
            "executionResult": execution_result,
        }

    @staticmethod
    async def reject(
        action_id: str,
        approver_id: int,
        rejection_reason: str,
    ) -> Dict[str, Any]:
        action = await prisma.pendingadminaction.find_unique(where={"id": action_id})
        if not action:
            raise HTTPException(status_code=404, detail="Pending action not found")

        if action.status != p_enums.PendingActionStatus.PENDING_APPROVAL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Action is not pending approval (current status: {action.status.name})",
            )

        if action.initiatorId == approver_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "SEPARATION_OF_DUTIES_VIOLATION",
                    "message": "Two-Person Integrity violation: cannot reject own initiated request as checker.",
                },
            )

        await prisma.pendingadminaction.update(
            where={"id": action_id},
            data={
                "status": p_enums.PendingActionStatus.REJECTED,
                "approverId": approver_id,
                "rejectionReason": rejection_reason,
            },
        )

        await AuditTrailService.log_action(
            actor_id=approver_id,
            action=f"GOVERNANCE_ACTION_REJECTED_{action.actionType}",
            domain="IAM",
            resource_type="PendingAdminAction",
            resource_id=action_id,
            metadata={
                "initiatorId": action.initiatorId,
                "approverId": approver_id,
                "reason": rejection_reason,
            },
        )

        return {
            "success": True,
            "status": "REJECTED",
            "actionId": action_id,
            "rejectionReason": rejection_reason,
        }

    @staticmethod
    async def create_corporate_escrow_release_request(
        maker_id: int,
        organization_id: int,
        contract_id: int,
        milestone_id: int,
        amount_dzd: float,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Maker (Hiring Manager) initiates milestone escrow release.
        Requires Checker (DAF/Admin/Owner) approval before funds and keys are released.
        """
        payload = {
            "organizationId": organization_id,
            "contractId": contract_id,
            "milestoneId": milestone_id,
            "amountDzd": amount_dzd,
            "isHighValue": amount_dzd > 100000.0,
            "notes": notes,
        }
        return await MakerCheckerService.create_pending_action(
            initiator_id=maker_id,
            action_type=ACTION_CORPORATE_ESCROW_RELEASE,
            target_resource="ContractMilestone",
            target_id=str(milestone_id),
            payload=payload,
            expires_in_hours=72,
        )

    @staticmethod
    async def create_kyb_approval_request(
        maker_id: int,
        kyb_id: int,
        organization_id: int,
        decision: str = "APPROVED",
        reason: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Maker (Compliance Officer) initiates an Enterprise KYB approval request.
        Requires Checker (Senior Compliance Officer / Platform Admin) dual approval.
        """
        payload = {
            "kybId": kyb_id,
            "organizationId": organization_id,
            "decision": decision,
            "reason": reason,
            "notes": notes,
        }
        return await MakerCheckerService.create_pending_action(
            initiator_id=maker_id,
            action_type=ACTION_APPROVE_KYB,
            target_resource="OrganizationKyb",
            target_id=str(kyb_id),
            payload=payload,
            expires_in_hours=72,
        )
