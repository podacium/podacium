"""Celery tasks for Live Sessions: reminders, no-show refunds, replay expiry."""

import logging
from datetime import datetime, timedelta, timezone

from app.core.async_bridge import run_async_in_worker
from app.core.celery import celery_app as celery
from app.core.prisma import prisma
from app.generated.prisma import Json
from app.services.live_session_service import (
    NO_SHOW_REFUND_PCT,
    NO_SHOW_ATTENDANCE_THRESHOLD,
)

logger = logging.getLogger(__name__)


@celery.task
def send_session_reminders():
    """Send reminders for sessions starting within the next hour."""

    async def _run():
        now = datetime.now(timezone.utc)
        window_start = now + timedelta(minutes=55)
        window_end = now + timedelta(minutes=65)

        sessions = await prisma.livesession.find_many(
            where={
                "status": "SCHEDULED",
                "deletedAt": None,
                "scheduledAt": {"gte": window_start, "lte": window_end},
            }
        )

        for session in sessions:
            bookings = await prisma.livesessionbooking.find_many(
                where={
                    "liveSessionId": session.id,
                    "deletedAt": None,
                    "status": "confirmed",
                },
                include={"user": True},
            )
            for booking in bookings:
                if booking.user and booking.user.email:
                    try:
                        from app.services.email_service import email_service

                        context = {
                            "title": session.title,
                            "scheduled_at": session.scheduledAt.isoformat(),
                        }
                        # Add module context if session is linked to a module
                        if session.moduleId:
                            module = await prisma.module.find_unique(
                                where={"id": session.moduleId}
                            )
                            if module:
                                context["module_title"] = module.title
                                context["module_id"] = module.id

                        await email_service.send_email(
                            to_email=booking.user.email,
                            subject=f"Reminder: '{session.title}' starts soon",
                            template="live_session_reminder",
                            context=context,
                        )
                    except Exception as e:
                        logger.error(
                            f"Failed to send reminder to {booking.user.email}: {e}"
                        )

    run_async_in_worker(_run())


@celery.task
def process_no_show_refunds():
    """Process 50% wallet credit refunds for no-shows (<50% attendance)."""

    async def _run():
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=48)

        # Query all ended sessions past the 48h window that have not had no-show refunds finalized
        sessions = await prisma.livesession.find_many(
            where={
                "status": "ENDED",
                "deletedAt": None,
                "endedAt": {"lte": cutoff},
            }
        )

        for session in sessions:
            metadata = dict(session.roomMetadata) if session.roomMetadata else {}
            if metadata.get("noShowEvaluated") is True:
                continue

            participants = await prisma.livesessionparticipant.find_many(
                where={
                    "liveSessionId": session.id,
                    "role": "PARTICIPANT",
                }
            )

            participant_map = {p.userId: p for p in participants}

            bookings = await prisma.livesessionbooking.find_many(
                where={
                    "liveSessionId": session.id,
                    "deletedAt": None,
                    "status": "confirmed",
                    "refundProcessed": False,
                }
            )

            for booking in bookings:
                user_id = booking.userId
                participant = participant_map.get(user_id)
                attendance_pct = (
                    participant.attendancePct
                    if (participant and participant.attendancePct is not None)
                    else 0.0
                )
                attended = attendance_pct >= NO_SHOW_ATTENDANCE_THRESHOLD

                await prisma.livesessionbooking.update(
                    where={"id": booking.id},
                    data={"attended": attended},
                )

                if attended:
                    continue

                if booking.transactionId:
                    tx = await prisma.transaction.find_unique(
                        where={"id": booking.transactionId}
                    )
                    if tx and tx.amount:
                        refund_amount = max(100, tx.amount * NO_SHOW_REFUND_PCT // 100)
                        try:
                            from app.services.wallet_service import wallet_service
                            from app.generated.prisma import enums

                            async with prisma.tx() as db_tx:
                                wallet = await db_tx.wallet.find_unique(
                                    where={"userId": user_id}
                                )
                                if wallet:
                                    await wallet_service.credit_wallet(
                                        wallet_id=wallet.id,
                                        amount=refund_amount,
                                        purpose=enums.PaymentPurpose.LIVE_SESSION_REFUND,
                                        reference_id=str(booking.id),
                                        description=f"No-show refund for session '{session.title}'",
                                        tx=db_tx,
                                    )

                                await db_tx.livesessionbooking.update(
                                    where={"id": booking.id},
                                    data={"refundProcessed": True},
                                )
                        except Exception as e:
                            logger.error(
                                f"Failed to process no-show refund for booking {booking.id}: {e}"
                            )

            metadata["noShowEvaluated"] = True
            metadata["noShowEvaluatedAt"] = now.isoformat()
            await prisma.livesession.update(
                where={"id": session.id},
                data={"roomMetadata": Json(metadata)},
            )

    run_async_in_worker(_run())


@celery.task
def process_waitlist_promotions():
    """Promote waitlisted users when spots open up."""

    async def _run():
        now = datetime.now(timezone.utc)
        sessions = await prisma.livesession.find_many(
            where={
                "status": {"in": ["SCHEDULED", "LIVE"]},
                "deletedAt": None,
                "approvedAt": {"not": None},
            }
        )
        for session in sessions:
            booking_count = await prisma.livesessionbooking.count(
                where={"liveSessionId": session.id, "deletedAt": None}
            )
            if session.maxParticipants and booking_count >= session.maxParticipants:
                continue

            open_spots = (session.maxParticipants or 999) - booking_count
            if open_spots <= 0:
                continue

            waitlist_entries = await prisma.livesessionwaitlist.find_many(
                where={
                    "liveSessionId": session.id,
                    "deletedAt": None,
                    "notified": False,
                },
                order={"createdAt": "asc"},
                take=open_spots,
            )
            for entry in waitlist_entries:
                await prisma.livesessionwaitlist.update(
                    where={"id": entry.id},
                    data={"notified": True},
                )
                try:
                    from app.services.notification_service import NotificationService
                    from app.schemas.notifications import (
                        NotificationCreate,
                        NotificationCategory,
                        NotificationPriority,
                        NotificationPayload,
                    )

                    await NotificationService.create_notification(
                        NotificationCreate(
                            user_id=entry.userId,
                            type="waitlist_promoted",
                            title="Spot Available",
                            body=f"A spot opened up for '{session.title}' — you've been promoted from the waitlist.",
                            category=NotificationCategory.EDUCATION,
                            priority=NotificationPriority.HIGH,
                            payload=NotificationPayload(
                                entity_type="live_session",
                                entity_id=str(session.id),
                                action_url=f"/hub/live/{session.id}/checkout",
                                metadata={
                                    "session_id": session.id,
                                    "session_title": session.title,
                                },
                            ),
                            data={
                                "session_id": session.id,
                                "session_title": session.title,
                                "action_url": f"/hub/live/{session.id}/checkout",
                            },
                        )
                    )
                except Exception as e:
                    logger.warning(
                        f"Failed to notify waitlist user {entry.userId}: {e}"
                    )

            expired_cutoff = now - timedelta(hours=2)
            expired_entries = await prisma.livesessionwaitlist.find_many(
                where={
                    "liveSessionId": session.id,
                    "deletedAt": None,
                    "notified": True,
                    "createdAt": {"lte": expired_cutoff},
                }
            )
            for entry in expired_entries:
                user_has_booked = await prisma.livesessionbooking.find_unique(
                    where={
                        "liveSessionId_userId": {
                            "liveSessionId": session.id,
                            "userId": entry.userId,
                        }
                    }
                )
                if not user_has_booked or user_has_booked.deletedAt is not None:
                    await prisma.livesessionwaitlist.update(
                        where={"id": entry.id},
                        data={"deletedAt": now},
                    )

    run_async_in_worker(_run())


async def reconcile_orphaned_sessions_async() -> int:
    """End sessions whose LiveKit room has vanished (crashed host, infra loss)
    and trigger the host payout so a missed room_finished webhook never leaves
    a host unpaid. Returns the number of sessions reconciled. Runs on a 5-minute
    cadence via the reconcile_orphaned_sessions Celery task."""
    from app.services.live_session_service import create_session_payout
    from app.services.livekit_service import count_active_rooms, get_room

    # B7: publish the active-room count so the Prometheus gauge stays fresh.
    await count_active_rooms()

    now = datetime.now(timezone.utc)
    sessions = await prisma.livesession.find_many(
        where={
            "status": "LIVE",
            "deletedAt": None,
            "roomName": {"not": None},
        }
    )

    reconciled = 0
    for session in sessions:
        room = await get_room(session.roomName)
        if room is not None:
            continue

        participant_count = await prisma.livesessionparticipant.count(
            where={"liveSessionId": session.id}
        )
        metadata = dict(session.roomMetadata) if session.roomMetadata else {}

        # If session was never started and had 0 participants, it was abandoned: refund attendees and do not pay host
        if (
            session.startedAt is None
            and participant_count == 0
            and session.priceAmount
            and session.priceAmount > 0
        ):
            metadata["abandoned"] = True
            metadata["payoutProcessed"] = True
            await prisma.livesession.update(
                where={"id": session.id},
                data={
                    "status": "CANCELLED",
                    "endedAt": now,
                    "durationMinutes": 0,
                    "roomMetadata": Json(metadata),
                },
            )
            bookings = await prisma.livesessionbooking.find_many(
                where={
                    "liveSessionId": session.id,
                    "deletedAt": None,
                    "status": "confirmed",
                    "refundProcessed": False,
                    "hostCode": None,
                }
            )
            for booking in bookings:
                if booking.transactionId:
                    tx = await prisma.transaction.find_unique(
                        where={"id": booking.transactionId}
                    )
                    if tx and tx.amount:
                        try:
                            from app.services.wallet_service import (
                                wallet_service,
                            )
                            from app.generated.prisma import enums

                            async with prisma.tx() as db_tx:
                                wallet = await db_tx.wallet.find_unique(
                                    where={"userId": booking.userId}
                                )
                                if wallet:
                                    await wallet_service.credit_wallet(
                                        wallet_id=wallet.id,
                                        amount=tx.amount,
                                        purpose=enums.PaymentPurpose.LIVE_SESSION_REFUND,
                                        reference_id=str(booking.id),
                                        description=f"Refund for abandoned session '{session.title}'",
                                        tx=db_tx,
                                    )
                                await db_tx.livesessionbooking.update(
                                    where={"id": booking.id},
                                    data={
                                        "refundProcessed": True,
                                        "status": "cancelled",
                                    },
                                )
                        except Exception as e:
                            logger.error(
                                f"Failed to refund abandoned booking {booking.id}: {e}"
                            )
            logger.info(
                f"Reconciled abandoned session {session.id}: cancelled and refunded {len(bookings)} bookings."
            )
            reconciled += 1
            continue

        started_at = session.startedAt or session.scheduledAt or now
        duration_minutes = max(1, int((now - started_at).total_seconds() // 60))

        metadata["payoutReady"] = True
        session.roomMetadata = metadata
        await prisma.livesession.update(
            where={"id": session.id},
            data={
                "status": "ENDED",
                "endedAt": now,
                "durationMinutes": duration_minutes,
                "roomMetadata": Json(metadata),
            },
        )

        paid = await create_session_payout(session, now)
        logger.info(
            f"Reconciled orphaned session {session.id} (room {session.roomName} gone): "
            f"{duration_minutes}m, payout {'created' if paid else 'skipped'}"
        )
        reconciled += 1

    return reconciled


@celery.task
def reconcile_orphaned_sessions():
    """Celery wrapper for reconcile_orphaned_sessions_async."""
    run_async_in_worker(reconcile_orphaned_sessions_async())


@celery.task
def process_batch_payouts():
    """Weekly batch payout for ended sessions past the 48h no-show window."""

    async def _run():
        from app.services.live_session_service import process_pending_payouts

        count = await process_pending_payouts()
        logger.info(f"Weekly payout batch processed {count} sessions")

    run_async_in_worker(_run())


@celery.task
def expire_replay_access():
    """Remove replay entitlements that have expired."""

    async def _run():
        now = datetime.now(timezone.utc)
        await prisma.livesession.update_many(
            where={
                "replayExpiresAt": {"lte": now},
                "deletedAt": None,
            },
            data={"replayUrl": None, "replayExpiresAt": None},
        )

    run_async_in_worker(_run())
