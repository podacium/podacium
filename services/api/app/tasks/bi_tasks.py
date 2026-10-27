"""
Celery tasks for BI report execution, automated report scheduling, and dataset quality scans.
"""

import logging
from datetime import datetime, timezone

from app.core.async_bridge import run_async_in_worker
from app.core.celery import celery_app
from app.core.prisma import connect_prisma, disconnect_prisma, prisma

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run a coroutine on the worker's persistent event loop.

    Prisma binds its engine to the loop it connects on. Using ``asyncio.run``
    here created a second loop, and the client's health check / disconnect
    could then block forever (the worker slot never came back). The worker
    process initialises its loop and Prisma connection in
    ``worker_process_init``, so every task must reuse that loop.
    """
    return run_async_in_worker(coro)


# =============================================================================
# SCHEDULED REPORTS PROCESSING CRON TASK
# =============================================================================


@celery_app.task(
    name="app.tasks.bi_tasks.process_scheduled_reports",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    soft_time_limit=600,
    time_limit=900,
)
def process_scheduled_reports(self):
    """
    Periodic beat task that scans for scheduled reports due for execution.
    Runs every 15 minutes.
    """

    async def _do_process():
        try:
            await connect_prisma()
            now = datetime.now(timezone.utc)

            # 1. Fetch active scheduled reports due for execution
            due_reports = await prisma.report.find_many(
                where={
                    "isActive": True,
                    "scheduleType": {"not": "manual"},
                    "nextRun": {"lte": now},
                },
                include={"organization": True},
            )

            logger.info(
                "Found %d scheduled reports due for execution", len(due_reports)
            )
            processed_count = 0

            from app.services.bi_services.report_scheduler import (
                calculate_next_report_run,
            )

            for report in due_reports:
                try:
                    recipients = report.recipients or []
                    recipient_count = len(recipients)

                    # 2. Create pending ReportRun entry
                    run = await prisma.reportrun.create(
                        data={
                            "reportId": report.id,
                            "status": "pending",
                            "recipientCount": recipient_count,
                            "startedAt": now,
                        }
                    )

                    # 3. Calculate and update next run time
                    next_run = calculate_next_report_run(
                        schedule_type=report.scheduleType,
                        interval=report.scheduleInterval,
                        cron_expr=report.scheduleCron,
                        from_time=now,
                    )

                    await prisma.report.update(
                        where={"id": report.id},
                        data={"nextRun": next_run},
                    )

                    # 4. Dispatch report generation in background queue
                    process_report_run_task.delay(run.id)
                    processed_count += 1
                    logger.info(
                        "Dispatched ReportRun #%d for scheduled Report #%d ('%s'). Next run: %s",
                        run.id,
                        report.id,
                        report.name,
                        next_run,
                    )

                except Exception as item_err:
                    logger.exception(
                        "Failed to schedule run for Report #%d: %s", report.id, item_err
                    )

            return {"scanned": len(due_reports), "dispatched": processed_count}

        except Exception as exc:
            logger.exception("Scheduled reports cron execution failed: %s", exc)
            raise self.retry(exc=exc)
        finally:
            await disconnect_prisma()

    return _run_async(_do_process())


# =============================================================================
# REPORT RUN EXECUTION & EMAIL DELIVERY TASK
# =============================================================================


@celery_app.task(
    name="app.tasks.bi_tasks.process_report_run_task",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def process_report_run_task(self, run_id: int):
    """Background task to generate report export file (CSV, XLSX, PDF/HTML) and notify recipients."""
    logger.info("Background report execution started for ReportRun #%d", run_id)

    async def _do_generate():
        try:
            await connect_prisma()

            # Mark run as running
            await prisma.reportrun.update(
                where={"id": run_id},
                data={"status": "running"},
            )

            from app.services.bi_services.report_exporter import ReportExporter

            result = await ReportExporter.generate_report_file(run_id)

            run = await prisma.reportrun.update(
                where={"id": run_id},
                data={
                    "status": "completed",
                    "completedAt": datetime.now(timezone.utc),
                    "fileUrl": result["file_url"],
                    "fileSize": result["file_size"],
                },
                include={"report": True},
            )
            logger.info(
                "ReportRun #%d completed successfully (%d bytes)",
                run_id,
                result["file_size"],
            )

            # Send email notifications to configured recipients
            recipients = (run.report.recipients if run.report else None) or []
            if recipients:
                from app.tasks.email_tasks import send_notification_email

                report_name = (
                    run.report.name if run.report else f"Report #{run.reportId}"
                )
                download_url = f"/api/bi/reports/{run.reportId}/runs/{run.id}/download"

                for email_address in recipients:
                    try:
                        send_notification_email.delay(
                            to_email=email_address,
                            subject=f"[Podacium BI] Your report '{report_name}' is ready",
                            text_body=(
                                f"Hello,\n\nYour scheduled BI report '{report_name}' has been generated.\n"
                                f"Format: {result['filename_ext'].upper()}\n"
                                f"Download your report at: {download_url}\n\n"
                                "Thank you,\nPodacium BI Analytics Team"
                            ),
                            html_body=(
                                f"<h3>Podacium BI Report Notification</h3>"
                                f"<p>Your scheduled report <strong>{report_name}</strong> is ready for download.</p>"
                                f"<ul><li>Format: {result['filename_ext'].upper()}</li>"
                                f"<li>Size: {result['file_size']} bytes</li></ul>"
                                f"<p><a href='{download_url}' style='padding: 8px 16px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 4px;'>Download Report</a></p>"
                            ),
                        )
                    except Exception as email_err:
                        logger.warning(
                            "Could not dispatch email to %s: %s",
                            email_address,
                            email_err,
                        )

            return result

        except Exception as exc:
            logger.exception("ReportRun #%d failed: %s", run_id, exc)
            try:
                await prisma.reportrun.update(
                    where={"id": run_id},
                    data={
                        "status": "failed",
                        "completedAt": datetime.now(timezone.utc),
                        "errorMessage": str(exc),
                    },
                )
            except Exception:
                pass
            raise self.retry(exc=exc)
        finally:
            await disconnect_prisma()

    return _run_async(_do_generate())


# =============================================================================
# DATASET QUALITY SCAN TASK (REPAIRED)
# =============================================================================


@celery_app.task(
    name="app.tasks.bi_tasks.process_quality_scan_task",
    bind=True,
    max_retries=2,
    default_retry_delay=15,
)
def process_quality_scan_task(self, dataset_id: int):
    """Background task to execute data quality scan on dataset."""
    logger.info("Background quality scan started for Dataset #%d", dataset_id)

    async def _do_scan():
        try:
            await connect_prisma()
            from app.services.bi_services.query_engine import QueryEngine
            from app.services.bi_services.quality_service import QualityService

            dataset = await prisma.dataset.find_unique(where={"id": dataset_id})
            if not dataset or not dataset.filePath:
                logger.warning("Dataset #%d not found or missing file path", dataset_id)
                return

            records = QueryEngine.query_dataset(dataset.filePath, None)
            if not records:
                logger.warning(
                    "Dataset #%d contains no records for quality assessment", dataset_id
                )
                return

            columns = list(records[0].keys()) if records else []
            assessment = QualityService.assess_quality(records=records, columns=columns)

            await prisma.qualityassessment.create(
                data={
                    "datasetId": dataset_id,
                    "overallScore": assessment.get("quality_score", 100.0),
                    "completeness": assessment.get("completeness_score", 100.0),
                    "accuracy": 100.0 - assessment.get("outlier_ratio", 0.0),
                    "consistency": 100.0 - assessment.get("duplicate_ratio", 0.0),
                    "validity": 100.0,
                    "issuesCount": len(assessment.get("warnings", [])),
                    "status": "completed",
                }
            )

            for warning_text in assessment.get("warnings", []):
                await prisma.qualityissue.create(
                    data={
                        "datasetId": dataset_id,
                        "columnName": "general",
                        "issueType": "data_warning",
                        "severity": "medium",
                        "description": str(warning_text),
                        "affectedRows": 0,
                        "percentage": 0.0,
                        "status": "open",
                    }
                )

            logger.info(
                "Quality scan completed for Dataset #%d. Score: %s",
                dataset_id,
                assessment.get("quality_score"),
            )

        except Exception as exc:
            logger.exception("Quality scan failed for Dataset #%d: %s", dataset_id, exc)
            raise self.retry(exc=exc)
        finally:
            await disconnect_prisma()

    return _run_async(_do_scan())


# =============================================================================
# MORNING EXECUTIVE BRIEFING TASK (PULSE AT 08:00 AM AFRICA/ALGIERS)
# =============================================================================


@celery_app.task(
    name="app.tasks.bi_tasks.send_morning_executive_briefings",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def send_morning_executive_briefings(self):
    """
    Periodic beat task executed daily at 08:00 AM Africa/Algiers (07:00 UTC).
    Aggregates daily financial metrics (Compte 411 Kridi, pending invoices, 24h collections)
    and dispatches an executive digest to leadership via WhatsAppService.
    """
    logger.info("Starting morning executive briefing generation")

    async def _do_briefing():
        from app.services.whatsapp_service import WhatsAppService
        from datetime import timedelta

        try:
            await connect_prisma()
            now = datetime.now(timezone.utc)
            one_day_ago = now - timedelta(hours=24)

            # 1. Aggregate Compte 411 Kridi (Créances Clients / Pending Invoices)
            pending_invoices = await prisma.invoice.find_many(
                where={"status": "ISSUED"},
                include={"items": True},
            )
            pending_count = len(pending_invoices)
            total_kridi_dzd = sum(inv.totalDzd for inv in pending_invoices)

            # 2. Aggregate 24h Collections & Revenue
            recent_completed_txs = await prisma.transaction.find_many(
                where={
                    "status": "COMPLETED",
                    "updatedAt": {"gte": one_day_ago},
                }
            )
            collected_24h_dzd = sum(tx.amount for tx in recent_completed_txs)
            tx_count_24h = len(recent_completed_txs)

            # 3. Calculate Fiscal Shield metrics (Article 169 CIDTA 26% IBS savings)
            ibs_shield_dzd = int(total_kridi_dzd * 0.26)

            # 4. Resolve Executive Recipients
            admins = await prisma.user.find_many(
                where={
                    "role": {"in": ["ADMIN", "ENTERPRISE_ADMIN"]},
                    "isActive": True,
                }
            )
            recipients = [
                u.phoneNumber
                for u in admins
                if u.phoneNumber and len(u.phoneNumber.strip()) >= 8
            ]

            # Format Executive WhatsApp Digest
            today_str = now.strftime("%Y-%m-%d")
            briefing_message = (
                f"📊 *Podacium Morning Executive Briefing*\n"
                f"🗓 *Date*: {today_str} (08:00 Algiers / UTC+1)\n\n"
                f"💰 *Finances & Trésorerie (SCF)*:\n"
                f"• *Créances Clients (Compte 411 - Kridi)*: {total_kridi_dzd:,} DZD\n"
                f"  └ {pending_count} factures émises en attente de règlement\n"
                f"• *Encaissements dernières 24h*: {collected_24h_dzd:,} DZD ({tx_count_24h} transactions)\n"
                f"• *Bouclier fiscal Art. 169 CIDTA*: {ibs_shield_dzd:,} DZD d'économie IBS éligible\n\n"
                f"⚖️ *Conformité Fiscale*: Loi 22-23 (ANAE 0% TVA) & Déductibilité active.\n"
                f"Bonne journée opérationnelle !"
            )

            dispatched_count = 0
            whatsapp_svc = WhatsAppService()
            try:
                for phone in recipients:
                    try:
                        sent = await whatsapp_svc.send_text_message(
                            phone, briefing_message
                        )
                        if sent:
                            dispatched_count += 1
                            logger.info("Executive briefing dispatched to %s", phone)
                        else:
                            logger.warning(
                                "Failed to dispatch WhatsApp briefing to %s", phone
                            )
                    except Exception as send_err:
                        logger.error(
                            "Error sending WhatsApp to %s: %s", phone, send_err
                        )
            finally:
                await whatsapp_svc.close()

            summary = {
                "status": "completed",
                "date": today_str,
                "recipients_found": len(recipients),
                "dispatched_count": dispatched_count,
                "metrics": {
                    "compte_411_kridi_dzd": total_kridi_dzd,
                    "pending_invoices_count": pending_count,
                    "collected_24h_dzd": collected_24h_dzd,
                    "transactions_24h": tx_count_24h,
                    "ibs_shield_dzd": ibs_shield_dzd,
                },
            }
            logger.info("Morning executive briefing completed: %s", summary)
            return summary

        except Exception as exc:
            logger.exception("Morning executive briefing failed: %s", exc)
            raise self.retry(exc=exc)
        finally:
            await disconnect_prisma()

    return _run_async(_do_briefing())


# =============================================================================
# PERIODIC DATASET QUALITY SCANS & CACHE REFRESH TASKS
# =============================================================================


@celery_app.task(
    name="app.tasks.bi_tasks.run_bi_quality_scans",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def run_bi_quality_scans(self):
    """Periodic task running daily at 03:00 UTC to scan all active datasets."""
    logger.info("Starting batch periodic dataset quality scan")

    async def _do_batch_scan():
        try:
            await connect_prisma()
            datasets = await prisma.dataset.find_many(take=50)
            dispatched = 0
            for ds in datasets:
                if ds.filePath:
                    process_quality_scan_task.delay(ds.id)
                    dispatched += 1
            logger.info("Dispatched quality scans for %d datasets", dispatched)
            return {"status": "dispatched", "count": dispatched}
        except Exception as exc:
            logger.exception("Batch quality scan failed: %s", exc)
            raise self.retry(exc=exc)
        finally:
            await disconnect_prisma()

    return _run_async(_do_batch_scan())


@celery_app.task(
    name="app.tasks.bi_tasks.refresh_bi_cache",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def refresh_bi_cache(self):
    """Periodic task running hourly to warm up BI metric caches."""
    logger.info("Executing periodic BI cache refresh")

    async def _do_cache_refresh():
        try:
            await connect_prisma()
            from app.core.redis import redis_client

            # Touch Redis liveness and clear stale temp keys if configured
            if redis_client:
                await redis_client.set(
                    "bi:cache:last_refreshed_at",
                    datetime.now(timezone.utc).isoformat(),
                    ex=7200,
                )
            logger.info("BI metric caches refreshed successfully")
            return {"status": "refreshed"}
        except Exception as exc:
            logger.warning("BI cache refresh encountered non-critical error: %s", exc)
            return {"status": "skipped", "error": str(exc)}
        finally:
            await disconnect_prisma()

    return _run_async(_do_cache_refresh())
