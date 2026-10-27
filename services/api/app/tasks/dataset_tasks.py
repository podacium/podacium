"""
Celery tasks for dataset parsing and preprocessing in an isolated worker queue.
"""

import os
import resource
import logging
from datetime import datetime, timezone
from typing import Any

from app.core.async_bridge import run_async_in_worker
from app.core.celery import celery_app
from app.core.prisma import prisma, connect_prisma
from app.generated.prisma import Json

logger = logging.getLogger(__name__)


def limit_resources():
    """Limit worker process resource usage to prevent memory leaks and runaway processes."""
    try:
        # Soft and Hard limits for Address Space (RLIMIT_AS) to 3GB
        max_mem = 3 * 1024 * 1024 * 1024  # 3GB in bytes
        resource.setrlimit(resource.RLIMIT_AS, (max_mem, max_mem))
        # Limit CPU time to 60 seconds
        resource.setrlimit(resource.RLIMIT_CPU, (60, 90))
        logger.info("Celery task CPU/Memory resource limits applied successfully.")
    except Exception as e:
        logger.warning(f"Could not enforce resource limits on worker process: {e}")


def run_async(coro):
    """Run a coroutine on the worker's persistent event loop.

    Prisma is bound to that loop; creating a fresh loop per task caused
    ``Event is bound to a different event loop`` failures.
    """

    async def _run():
        if not prisma.is_connected():
            await connect_prisma()
        return await coro

    return run_async_in_worker(_run())


def sanitize_json(obj: Any) -> Any:
    """Recursively sanitize structures for JSON compatibility."""
    import pandas as pd
    import numpy as np
    import math

    if obj is None:
        return None
    try:
        if pd.isna(obj):
            return None
        if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
            return None
    except Exception:
        pass

    if isinstance(obj, (pd.Timestamp, datetime, np.datetime64)):
        return str(obj)
    if isinstance(obj, (np.integer, np.floating)):
        val = float(obj) if isinstance(obj, np.floating) else int(obj)
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None
        return val
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, (np.ndarray, list, tuple, pd.Series, pd.Index)):
        return [sanitize_json(x) for x in obj]
    if isinstance(obj, dict):
        return {k: sanitize_json(v) for k, v in obj.items()}
    return obj


@celery_app.task(bind=True, max_retries=3, default_retry_delay=15)
def process_dataset_task(
    self,
    dataset_id: int,
    file_path: str,
    organization_id: int,
    user_id: int,
    original_filename: str,
    domain: str,
):
    """
    Background Celery task to parse, clean, clean columns, and run analytics
    on uploaded dataset files. Enforces memory boundaries.
    """
    import pandas as pd
    import duckdb

    logger.info(
        f"Background parsing task started for dataset #{dataset_id} at {file_path}"
    )
    limit_resources()

    try:
        # 1. Update status to PROCESSING
        run_async(
            prisma.dataset.update(
                where={"id": dataset_id},
                data={
                    "status": "PROCESSING",
                    "processingStatus": "PROCESSING",
                    "processedAt": datetime.now(timezone.utc),
                },
            )
        )

        # 2. Parse file based on extension
        ext = file_path.split(".")[-1].lower()
        if ext == "csv":
            df = pd.read_csv(file_path, sep=None, engine="python")
        elif ext in ["xls", "xlsx", "xlsm", "xlsb"]:
            df = pd.read_excel(file_path, engine="openpyxl")
        elif ext == "json":
            df = pd.read_json(file_path)
        else:
            df = pd.read_csv(file_path)

        if df.empty:
            raise ValueError("Parsed dataset is empty.")

        # 3. Clean columns and structure
        df.columns = [
            str(c).strip().replace(" ", "_").replace("(", "").replace(")", "")
            for c in df.columns
        ]
        df = (
            df.dropna(how="all", axis=0)
            .dropna(how="all", axis=1)
            .reset_index(drop=True)
        )

        # 4. Save to internal Parquet format
        parquet_filename = f"{os.path.basename(file_path).split('.')[0]}.parquet"
        parquet_path = os.path.join(os.path.dirname(file_path), parquet_filename)

        # Use DuckDB for high performance Parquet conversion
        con = duckdb.connect(database=":memory:")
        con.register("df_table", df)
        con.execute(
            "COPY (SELECT * FROM df_table) TO ? (FORMAT PARQUET)", [parquet_path]
        )

        # 5. Extract metadata & run analytics
        headers = df.columns.tolist()
        row_count = len(df)

        sample_df = df.head(10).where(pd.notnull(df), None)
        sample_records = sample_df.to_dict(orient="records")

        from app.services.bi_services.analytics_service import AnalyticsService

        analytics_result = AnalyticsService.perform_analytics(
            records=sample_records, columns=headers, file_path=parquet_path
        )

        column_analytics = analytics_result.get("internal_technical", {}).get(
            "column_analytics", {}
        )
        quality_indicators = analytics_result.get("internal_technical", {}).get(
            "data_quality_indicators", {}
        )
        business_insights = analytics_result.get("business_insights", [])
        executive_summary = analytics_result.get("executive_summary", "")

        # 6. Save updated metadata and results back to the database
        metadata_dict = {
            "business_insights": business_insights,
            "quality_indicators": quality_indicators,
            "health_summary": executive_summary,
            "sample_records": sanitize_json(sample_records[:5]),
        }

        run_async(
            prisma.dataset.update(
                where={"id": dataset_id},
                data={
                    "status": "PROCESSED",
                    "processingStatus": "COMPLETED",
                    "filePath": parquet_path,
                    "rowCount": row_count,
                    "columnCount": len(headers),
                    "columns": Json(headers),
                    "schema_": Json(column_analytics),
                    "metadata": Json(metadata_dict),
                },
            )
        )

        # 7. Log history
        try:
            from app.services.bi_services.history_service import HistoryService

            run_async(
                HistoryService.log_event(
                    dataset_id=dataset_id,
                    action="PROCESSED",
                    user_id=user_id,
                    details=f"Background preprocessing completed. Converted to Parquet: {row_count} rows, {len(headers)} columns.",
                )
            )
        except Exception as e:
            logger.warning(f"Failed to log history event: {e}")

        # 8. Generate Auto Decisions
        try:
            from app.services.bi_services.decision_service import DecisionService
            from app.services.bi_services.evaluation_service import EvaluationService

            eval_result = EvaluationService.evaluate_trust_risk(
                quality_result={"quality_score": 85, "quality_level": "ACCEPTABLE"},
                analytics_result=analytics_result,
                preprocessing_log=None,
            )

            decision_result = DecisionService.generate_decisions(
                analytics_result=analytics_result,
                evaluation_result=eval_result,
                domain=domain,
            )

            for rec in decision_result.get("recommendations", []):
                run_async(
                    prisma.decision.create(
                        data={
                            "title": rec.get("text", "Draft Decision")[:255],
                            "description": rec.get("expected_benefit"),
                            "impactLevel": rec.get("priority", "MEDIUM").lower(),
                            "rationale": rec.get("category"),
                            "datasetId": dataset_id,
                            "ownerId": user_id,
                            "organizationId": organization_id,
                            "status": "draft",
                        }
                    )
                )
        except Exception as e:
            logger.warning(f"Failed to automatically generate decisions: {e}")

        # 9. Send live WebSocket event notification
        try:
            from app.routers.websocket import notify_user

            run_async(
                notify_user(
                    user_id=user_id,
                    notification_type="notification",
                    data={
                        "title": "Dataset Preprocessed",
                        "message": f"Your dataset '{original_filename}' has been fully ingested and parsed.",
                        "datasetId": dataset_id,
                        "type": "dataset",
                    },
                )
            )
        except Exception as e:
            logger.warning(f"Could not push real-time WS notification: {e}")

        logger.info(
            f"Dataset #{dataset_id} completed worker preprocessing successfully."
        )

        # Cleanup original temporary file if distinct from Parquet
        if os.path.exists(file_path) and file_path != parquet_path:
            try:
                os.remove(file_path)
            except Exception:
                pass

    except MemoryError:
        logger.error(f"OOM limit reached during processing of dataset #{dataset_id}")
        run_async(
            prisma.dataset.update(
                where={"id": dataset_id},
                data={"status": "FAILED", "processingStatus": "FAILED"},
            )
        )
        self.update_state(state="FAILURE", meta={"error": "Worker out-of-memory"})
    except Exception as exc:
        retries = getattr(self.request, "retries", 0)
        max_retries = getattr(self, "max_retries", 3)
        if retries >= max_retries:
            logger.error(
                f"Max retries ({max_retries}) exceeded for dataset #{dataset_id}. Marking as FAILED: {exc}"
            )
            run_async(
                prisma.dataset.update(
                    where={"id": dataset_id},
                    data={"status": "FAILED", "processingStatus": "FAILED"},
                )
            )
            raise
        else:
            logger.warning(
                f"Error during background ingestion for dataset #{dataset_id} "
                f"(retry {retries + 1}/{max_retries}): {exc}"
            )
            raise self.retry(exc=exc)
