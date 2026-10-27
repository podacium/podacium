import logging

logger = logging.getLogger(__name__)
import json
import uuid
import os
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    import pandas as pd

try:
    import aiofiles

    HAS_AIOFILES = True
except ImportError:
    HAS_AIOFILES = False
    aiofiles = None
from fastapi import UploadFile, HTTPException, status

from app.core.prisma import prisma
from app.generated.prisma import Json
from app.core.config import setting
from .errors import BIError, DatasetNotFoundError


class IngestionService:
    """Service for ingesting CSV and JSON datasets"""

    STORAGE_DIR = "storage/datasets"

    # Ensure storage directory exists
    os.makedirs(STORAGE_DIR, exist_ok=True)

    @classmethod
    def _clean_dataframe(cls, df: "pd.DataFrame") -> "pd.DataFrame":
        """Standardize and clean dataframe for downstream analysis"""
        import pandas as pd

        # 1. Stringify headers and remove special chars
        df.columns = [
            str(c).strip().replace(" ", "_").replace("(", "").replace(")", "")
            for c in df.columns
        ]

        # 2. Drop empty columns/rows if they are entirely null
        df = df.dropna(how="all", axis=0).dropna(how="all", axis=1)

        # 3. Reset index
        df = df.reset_index(drop=True)

        # 4. Convert objects to best possible types & neutralize CSV formula injection (DDE attacks)
        for col in df.columns:
            try:
                if df[col].dtype == "object":
                    # Neutralize potential spreadsheet formula triggers (=, +, -, @)
                    def _sanitize_cell(val: Any) -> Any:
                        if (
                            isinstance(val, str)
                            and len(val) > 1
                            and val[0] in ("=", "@", "+", "-")
                        ):
                            try:
                                float(val)
                            except ValueError:
                                return f"'{val}"
                        return val

                    df[col] = df[col].apply(_sanitize_cell)
                    # Try numeric conversion
                    df[col] = pd.to_numeric(df[col], errors="ignore")
                    # Try datetime conversion if it looks like a date
                    if "date" in str(col).lower() or "time" in str(col).lower():
                        df[col] = pd.to_datetime(df[col], errors="ignore")
            except Exception as e:
                logger.exception("Failed to convert column types: %s", str(e))

        return df

    @classmethod
    async def _save_file(cls, content: bytes, extension: str) -> str:
        """Save content to storage and return file path"""
        from app.services.storage import storage_manager

        filename = f"{uuid.uuid4()}.{extension}"
        file_path = os.path.join(cls.STORAGE_DIR, filename)
        abs_path = os.path.abspath(file_path)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)

        if HAS_AIOFILES:
            async with aiofiles.open(abs_path, "wb") as f:
                await f.write(content)
        else:
            with open(abs_path, "wb") as f:
                f.write(content)

        # Also backup to active datasets driver if configured
        try:
            await storage_manager.upload_file(
                content=content,
                filename=filename,
                category="datasets",
                content_type="application/octet-stream"
                if extension == "parquet"
                else "text/csv",
            )
        except Exception as e:
            logger.debug(f"Async dataset driver backup note: {e}")

        return abs_path

    @staticmethod
    def _sanitize_json(obj: Any) -> Any:
        """Ensure all objects are JSON serializable (handle Timestamps, NaNs, NumPy)"""
        import pandas as pd
        import numpy as np
        import datetime
        import decimal
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

        # Handle Pandas/Numpy timestamps and dates
        if isinstance(
            obj, (pd.Timestamp, datetime.date, datetime.datetime, np.datetime64)
        ):
            return str(obj)

        # Handle Numpy numerics (int/float)
        if isinstance(obj, (np.integer, np.floating)):
            val = float(obj) if isinstance(obj, np.floating) else int(obj)
            if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                return None
            return val

        # Handle Numpy bool
        if isinstance(obj, np.bool_):
            return bool(obj)

        # Handle arrays/lists/tuples
        if isinstance(obj, (np.ndarray, list, tuple, pd.Series, pd.Index)):
            return [IngestionService._sanitize_json(x) for x in obj]

        # Handle dicts
        if isinstance(obj, dict):
            return {k: IngestionService._sanitize_json(v) for k, v in obj.items()}

        # Handle Decimal
        if isinstance(obj, decimal.Decimal):
            val = float(obj)
            if math.isnan(val) or math.isinf(val):
                return None
        return obj

    @staticmethod
    def safe_read_csv(file_path: str, **kwargs) -> Any:
        """Read CSV or Excel file safely trying formats, encodings, separators, and skipping bad lines if malformed."""
        import pandas as pd

        # Check if file is an Excel spreadsheet (.xlsx / .xls)
        if file_path.endswith((".xlsx", ".xls")):
            try:
                return pd.read_excel(file_path, **kwargs)
            except Exception:
                pass

        # Check binary magic bytes for PK zip / excel file header
        try:
            if os.path.exists(file_path):
                with open(file_path, "rb") as f:
                    header = f.read(4)
                    if header.startswith(b"PK\x03\x04"):
                        try:
                            return pd.read_excel(file_path, **kwargs)
                        except Exception:
                            pass
        except Exception:
            pass

        # Clean kwargs for CSV read
        read_kwargs = {"on_bad_lines": "skip", **kwargs}

        encodings = ["utf-8", "utf-8-sig", "latin1", "iso-8859-1", "cp1252"]
        for enc in encodings:
            try:
                return pd.read_csv(file_path, encoding=enc, **read_kwargs)
            except Exception:
                continue

        # Try with sep=None auto-detection
        for enc in encodings:
            try:
                return pd.read_csv(
                    file_path, encoding=enc, sep=None, engine="python", **read_kwargs
                )
            except Exception:
                continue

        # Ultimate fallback with encoding_errors replace
        try:
            return pd.read_csv(
                file_path, encoding="utf-8", encoding_errors="replace", **read_kwargs
            )
        except Exception:
            return pd.read_csv(file_path, encoding="latin1", on_bad_lines="skip")

    @classmethod
    async def _save_json_file(cls, records: List[Dict], extension: str = "json") -> str:
        """Save JSON records to storage and return file path"""
        filename = f"{uuid.uuid4()}.{extension}"
        file_path = os.path.join(cls.STORAGE_DIR, filename)
        abs_path = os.path.abspath(file_path)

        if HAS_AIOFILES:
            async with aiofiles.open(abs_path, "w", encoding="utf-8") as f:
                await f.write(json.dumps(records))
        else:
            # Fallback to synchronous file write
            with open(abs_path, "w", encoding="utf-8") as f:
                f.write(json.dumps(records))

        return abs_path

    @classmethod
    async def create_dataset_record(
        cls,
        organization_id: int,
        user_id: int,
        name: str,
        domain: str,
        column_count: int,
        row_count: int,
        columns: List[str],
        original_filename: Optional[str],
        file_path: str,
        file_size: int,
        format: str,
        description: Optional[str] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Create dataset record in database"""
        try:
            # Create in Prisma
            dataset = await prisma.dataset.create(
                data={
                    "name": name,
                    "description": description,
                    "organizationId": organization_id,
                    "userId": user_id,
                    "domain": domain,
                    "originalFilename": original_filename,
                    "filePath": file_path,
                    "fileSize": file_size,
                    "rowCount": row_count,
                    "columnCount": column_count,
                    "columns": Json(columns),
                    "status": "UPLOADED",
                    "processedAt": datetime.now(timezone.utc),
                    "format": format.lower(),  # Normalize to lowercase for schema compatibility
                    "sourceType": "UPLOAD",
                    "processingStatus": "COMPLETED",
                    "schema_": Json(kwargs.get("schema_data", {})),
                    "metadata": Json(kwargs.get("metadata_data", {})),
                }
            )

            # Convert to schema-compatible dictionary
            return {
                "dataset_id": str(dataset.id),
                "name": dataset.name,
                "description": dataset.description,
                "domain": dataset.domain,
                "format": dataset.format,
                "original_filename": dataset.originalFilename,
                "organization_id": dataset.organizationId,
                "uploaded_by": dataset.userId,
                "row_count": dataset.rowCount or 0,
                "column_count": dataset.columnCount or 0,
                "columns": columns,
                "file_size": dataset.fileSize,
                "status": dataset.status or "UPLOADED",
                "quality_score": dataset.qualityScore,
                "quality_metrics": json.loads(dataset.metadata)
                if isinstance(dataset.metadata, str)
                else (dataset.metadata or {}),
                "column_metadata": json.loads(dataset.schema_)
                if isinstance(dataset.schema_, str)
                else (dataset.schema_ or {}),
                "created_at": dataset.createdAt,
                "updated_at": dataset.updatedAt,
                "processed_at": dataset.processedAt,
            }
        except Exception as e:
            logger.exception("Failed to create dataset record: %s", str(e))
            raise BIError(
                f"Failed to create dataset record: {str(e)}", "database_error"
            ) from e

    @classmethod
    async def ingest_file(
        cls,
        file: UploadFile,
        organization_id: str,
        user_id: str,
        domain: str = "unknown",
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Ingest generic file asynchronously via Celery worker with strict resource boundaries.
        Returns the initial pending dataset record immediately.
        """
        max_size = getattr(setting, "MAX_FILE_SIZE", 100 * 1024 * 1024)  # 100MB limit
        content = await file.read()

        if len(content) > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds limit",
            )

        from app.services.file_validator import validate_file_content

        val_result = validate_file_content(
            content, category="datasets", content_type=file.content_type
        )
        if not val_result.is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=val_result.error or "Invalid dataset file content",
            )

        filename = file.filename or "data.csv"
        ext = filename.split(".")[-1].lower() if "." in filename else "csv"

        # Normalize format for schema validation
        format_map = {
            "xlsx": "excel",
            "xls": "excel",
            "xlsm": "excel",
            "xlsb": "excel",
            "odf": "excel",
            "ods": "excel",
            "odt": "excel",
            "json": "json",
            "csv": "csv",
            "parquet": "parquet",
        }
        dataset_format = format_map.get(ext, "csv")

        # 1. Step: Save raw file content in temporary storage
        temp_dir = os.path.join(cls.STORAGE_DIR, "temp")
        os.makedirs(temp_dir, exist_ok=True)
        temp_filename = f"raw_{uuid.uuid4()}.{ext}"
        temp_file_path = os.path.abspath(os.path.join(temp_dir, temp_filename))

        with open(temp_file_path, "wb") as f:
            f.write(content)

        # 1.5 Step: Synchronously extract columns and row count so metadata is
        # available immediately even if the Celery task is delayed or fails.
        try:
            import pandas as pd

            if ext in ["xls", "xlsx", "xlsm", "xlsb"] or content.startswith(
                b"PK\x03\x04"
            ):
                try:
                    df_sample = pd.read_excel(temp_file_path)
                except Exception:
                    df_sample = cls.safe_read_csv(temp_file_path, nrows=5)
                sync_row_count = len(df_sample)
                sync_columns = [
                    str(c).strip().replace(" ", "_").replace("(", "").replace(")", "")
                    for c in df_sample.columns
                ]
            elif ext == "json":
                with open(temp_file_path, "r", encoding="utf-8", errors="ignore") as fh:
                    import json as _json

                    data = _json.load(fh)
                    sync_row_count = len(data) if isinstance(data, list) else 1
                df_sample = pd.read_json(temp_file_path, nrows=1)
                sync_columns = [
                    str(c).strip().replace(" ", "_").replace("(", "").replace(")", "")
                    for c in df_sample.columns
                ]
            else:
                df_sample = cls.safe_read_csv(temp_file_path, nrows=5)
                sync_columns = [
                    str(c).strip().replace(" ", "_").replace("(", "").replace(")", "")
                    for c in df_sample.columns
                ]
                with open(temp_file_path, "r", encoding="utf-8", errors="ignore") as fh:
                    sync_row_count = max(0, sum(1 for _ in fh) - 1)
            schema_data = {
                c: {
                    "column_name": c,
                    "column_type": "unknown",
                    "statistics": {
                        "null_count": 0,
                        "null_percentage": 0.0,
                        "count": sync_row_count,
                    },
                }
                for c in sync_columns
            }
        except Exception as e:
            logger.warning(f"Could not extract initial schema: {e}")
            sync_columns = []
            sync_row_count = 0
            schema_data = {}

        # 2. Step: Create database record immediately with real metadata
        name_from_file = file.filename or "Untitled Dataset"
        dataset = await cls.create_dataset_record(
            organization_id=int(organization_id),
            user_id=int(user_id),
            name=name_from_file,
            description=description,
            domain=domain,
            column_count=len(sync_columns),
            row_count=sync_row_count,
            columns=sync_columns,
            original_filename=file.filename,
            file_path=temp_file_path,
            file_size=len(content),
            format=dataset_format,
            schema_data=schema_data,
            metadata_data={"sample_records": []},
        )

        # Force status to PENDING on creation since it is run asynchronously
        await prisma.dataset.update(
            where={"id": int(dataset["dataset_id"])},
            data={"status": "PENDING", "processingStatus": "PENDING"},
        )
        dataset["status"] = "PENDING"

        # 3. Step: Dispatch processing Celery task to isolated worker queues
        from app.tasks.dataset_tasks import process_dataset_task

        process_dataset_task.delay(
            dataset_id=int(dataset["dataset_id"]),
            file_path=temp_file_path,
            organization_id=int(organization_id),
            user_id=int(user_id),
            original_filename=filename,
            domain=domain,
        )

        return {**dataset, "sample_records": []}

    @classmethod
    async def ingest_json(
        cls,
        records: List[Dict[str, Any]],
        organization_id: str,
        user_id: str,
        domain: str = "unknown",
        name: str = "JSON Dataset",
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Ingest JSON records and create dataset metadata"""
        if not records:
            raise BIError("No records provided", "json_error")

        # Determine columns
        columns = list(records[0].keys())

        # Save to disk
        file_path = await cls._save_json_file(records, "json")

        # Convert to Parquet for consistency
        # Convert to Parquet for consistency
        dataset_uuid = str(uuid.uuid4())
        storage_file_path = os.path.join(cls.STORAGE_DIR, f"{dataset_uuid}.parquet")

        try:
            df = pd.DataFrame(records)
            import duckdb

            con = duckdb.connect(database=":memory:")
            con.register("df_table", df)
            con.execute(
                "COPY (SELECT * FROM df_table) TO ? (FORMAT PARQUET)",
                [storage_file_path],
            )
        except Exception as e:
            logger.exception(
                "Failed to convert to Parquet, falling back to JSON: %s", str(e)
            )
            storage_file_path = file_path

        # Perform analytics on the normalized file
        try:
            from app.services.bi_services.analytics_service import AnalyticsService

            analytics_result = AnalyticsService.perform_analytics(
                records=records,  # Kept for backward compatibility
                columns=columns,
                file_path=storage_file_path,
            )

            column_analytics = analytics_result.get("internal_technical", {}).get(
                "column_analytics", {}
            )
            quality_indicators = analytics_result.get("internal_technical", {}).get(
                "data_quality_indicators", {}
            )
            business_insights = analytics_result.get("business_insights", [])
            executive_summary = analytics_result.get("executive_summary", "")

            metadata_storage = {
                "business_insights": business_insights,
                "quality_indicators": quality_indicators,
                "health_summary": executive_summary,
                "sample_records": cls._sanitize_json(records[:5]),
                "analytics_result": analytics_result,
            }
        except Exception as e:
            logger.exception(
                "Failed to perform analytics during JSON ingest: %s", str(e)
            )
            column_analytics = {}
            metadata_storage = {"sample_records": cls._sanitize_json(records[:5])}

        # Create dataset
        dataset = await cls.create_dataset_record(
            organization_id=int(organization_id),
            user_id=int(user_id),
            name=name,
            description=description,
            domain=domain,
            column_count=len(columns),
            row_count=len(records),
            columns=columns,
            original_filename="manual_input.json",
            file_path=storage_file_path,
            file_size=len(records) * 100,  # Estimated
            format="json",  # Original format
            schema_data=column_analytics,
            metadata_data=metadata_storage,
        )

        # Generate Decisions automatically
        try:
            from app.services.bi_services.decision_service import DecisionService
            from app.services.bi_services.evaluation_service import EvaluationService

            eval_result = EvaluationService.evaluate_trust_risk(
                quality_result={
                    "quality_score": dataset.get("quality_score", 0),
                    "quality_level": "ACCEPTABLE",
                },
                analytics_result=analytics_result,
                preprocessing_log=None,
            )

            decision_result = DecisionService.generate_decisions(
                analytics_result=analytics_result,
                evaluation_result=eval_result,
                domain=domain,
            )

            for rec in decision_result.get("recommendations", []):
                await prisma.decision.create(
                    data={
                        "title": rec.get("text", "Draft Decision")[:255],
                        "description": rec.get("expected_benefit"),
                        "impactLevel": rec.get("priority", "MEDIUM").lower(),
                        "rationale": rec.get("category"),
                        "datasetId": int(dataset["dataset_id"]),
                        "ownerId": int(user_id),
                        "organizationId": int(organization_id),
                        "status": "draft",
                    }
                )
        except Exception as e:
            logger.exception(
                "Failed to generate decisions during JSON ingest: %s", str(e)
            )

        return {**dataset, "sample_records": cls._sanitize_json(records[:5])}

    @classmethod
    def map_to_metadata(cls, dataset: Any) -> Dict[str, Any]:
        """Map Prisma dataset model to schema-compatible dictionary"""
        # Normalize status to match DatasetStatus schema
        status_map = {
            "PENDING": "UPLOADED",
            "COMPLETED": "PROCESSED",
        }
        raw_status = dataset.status or "UPLOADED"
        normalized_status = status_map.get(raw_status, raw_status)

        # Ensure status is uppercase for BI schema
        if normalized_status:
            normalized_status = normalized_status.upper()

        import ast

        # Parse columns safely
        columns_data = []
        if isinstance(dataset.columns, list):
            columns_data = dataset.columns
        elif isinstance(dataset.columns, str):
            try:
                columns_data = json.loads(dataset.columns)
            except json.JSONDecodeError:
                try:
                    # Try parsing python list string (single quotes)
                    columns_data = ast.literal_eval(dataset.columns)
                except Exception:
                    columns_data = []

        # Normalize format value for UI/Enum
        format_val = (dataset.format or "csv").lower()
        # Map common mismatches or allow parquet
        if format_val not in ["csv", "json", "excel", "parquet"]:
            if "xls" in format_val:
                format_val = "excel"
            elif "json" in format_val:
                format_val = "json"
            else:
                format_val = "csv"  # Fallback to csv if unknown to satisfy Enum

        # Metadata and Sample Records extraction
        metadata_dict = (
            dataset.metadata
            if isinstance(dataset.metadata, dict)
            else (
                json.loads(dataset.metadata)
                if isinstance(dataset.metadata, str)
                else {}
            )
        )
        raw_column_metadata = (
            dataset.schema_
            if isinstance(dataset.schema_, dict)
            else (
                json.loads(dataset.schema_) if isinstance(dataset.schema_, str) else {}
            )
        )
        sample_records = metadata_dict.get("sample_records", [])
        first_col_str = str(columns_data[0]) if columns_data else ""
        is_corrupt_pk = (
            not raw_column_metadata
            or list(raw_column_metadata.keys()) == ["PK"]
            or "PK\x03\x04" in first_col_str
            or "PK" in first_col_str
            or (len(columns_data) == 1 and "PK" in first_col_str)
        )
        if is_corrupt_pk and dataset.filePath and os.path.exists(dataset.filePath):
            try:
                from app.services.bi_services.query_engine import QueryEngine
                from app.services.bi_services.analytics_service import AnalyticsService

                schema_list = QueryEngine.get_dataset_schema(dataset.filePath)
                if schema_list:
                    raw_column_metadata = {}
                    columns_data = []
                    sample_records = QueryEngine.query_dataset(dataset.filePath)
                    if len(sample_records) > 15:
                        sample_records = sample_records[:15]

                    metadata_dict["sample_records"] = sample_records

                    for item in schema_list:
                        cname = item["name"]
                        columns_data.append(cname)
                        itype = item.get("type", "text")
                        ntype = item.get("native_type", "VARCHAR")

                        col_sample_vals = [
                            r.get(cname)
                            for r in sample_records
                            if isinstance(r, dict) and r.get(cname) is not None
                        ]

                        sem_hint = AnalyticsService._generate_semantic_hints(
                            col_sample_vals, column_name=cname
                        )

                        data_type_val = ntype
                        lower_cname = cname.lower().strip()
                        if lower_cname in ["age", "âge"] or "age" in lower_cname:
                            data_type_val = "INTEGER"
                        elif itype == "numeric":
                            data_type_val = ntype if ntype != "VARCHAR" else "FLOAT"

                        raw_column_metadata[cname] = {
                            "type": data_type_val,
                            "data_type": data_type_val,
                            "semantic_type": (
                                sem_hint
                                or ("NUMERIC" if itype == "numeric" else "STRING")
                            ).upper(),
                        }
            except Exception as e:
                logger.warning(
                    f"Could not derive column_metadata in map_to_metadata: {e}"
                )

        return {
            "dataset_id": str(dataset.id),
            "name": dataset.name,
            "description": dataset.description,
            "domain": dataset.domain,
            "format": format_val,
            "original_filename": dataset.originalFilename,
            "organization_id": dataset.organizationId,
            "uploaded_by": dataset.userId or 0,
            "row_count": dataset.rowCount or 0,
            "column_count": dataset.columnCount or 0,
            "columns": columns_data,
            "file_size": dataset.fileSize,
            "status": normalized_status or "UPLOADED",
            "quality_score": dataset.qualityScore,
            "quality_metrics": metadata_dict,
            "column_metadata": raw_column_metadata or {},
            "created_at": dataset.createdAt,
            "updated_at": dataset.updatedAt,
            "processed_at": dataset.processedAt,
            "file_path": dataset.filePath,
            "sample_records": sample_records,
            "organization": {
                "id": dataset.organization.id,
                "name": dataset.organization.name,
                "description": dataset.organization.description,
            }
            if getattr(dataset, "organization", None)
            else None,
            "uploader": {
                "id": dataset.ownerUser.id,
                "fullName": dataset.ownerUser.fullName,
                "email": dataset.ownerUser.email,
                "profilePictureUrl": dataset.ownerUser.profilePictureUrl,
            }
            if getattr(dataset, "ownerUser", None)
            else None,
        }

    @classmethod
    async def get_dataset(
        cls, dataset_id: str, organization_id: str, user_id: str
    ) -> Dict[str, Any]:
        """Retrieve dataset metadata"""
        if not dataset_id.isdigit():
            raise DatasetNotFoundError(dataset_id)

        try:
            dataset = await prisma.dataset.find_unique(
                where={"id": int(dataset_id)},
                include={"organization": True, "ownerUser": True},
            )
        except Exception as e:
            logger.exception("Failed to fetch dataset: %s", str(e))
            raise DatasetNotFoundError(dataset_id) from e

        if not dataset or dataset.deletedAt is not None:
            raise DatasetNotFoundError(dataset_id)

        # Security: Enforce organization boundary or owner/membership access
        uid = int(user_id) if user_id and str(user_id).isdigit() else None

        is_authorized = False
        if uid and dataset.ownerUserId == uid:
            is_authorized = True
        elif uid and dataset.organizationId:
            # Verify the requesting user is actually a member of the dataset's organization
            member_count = await prisma.organizationmember.count(
                where={"userId": uid, "organizationId": dataset.organizationId}
            )
            if member_count > 0:
                is_authorized = True

        if not is_authorized:
            raise BIError("Unauthorized dataset access", "unauthorized")

        result = cls.map_to_metadata(dataset)
        return result

    @classmethod
    async def list_datasets(
        cls, organization_id: str, user_id: str, search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List all datasets for an organization with optional search"""
        try:
            where_clause = {"organizationId": int(organization_id), "deletedAt": None}

            if search:
                where_clause["OR"] = [
                    {"name": {"contains": search, "mode": "insensitive"}},
                    {"description": {"contains": search, "mode": "insensitive"}},
                ]

            datasets = await prisma.dataset.find_many(
                where=where_clause,
                order={"createdAt": "desc"},
                include={"organization": True, "ownerUser": True},
            )
            return [cls.map_to_metadata(d) for d in datasets]
        except Exception as e:
            logger.exception("Failed to list datasets: %s", str(e))
            return []

    @classmethod
    async def update_dataset_metadata(
        cls,
        dataset_id: str,
        organization_id: str,
        user_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Update dataset name and description"""
        if not dataset_id.isdigit():
            raise DatasetNotFoundError(dataset_id)

        try:
            id_int = int(dataset_id)
            # Verify existance and access
            dataset = await prisma.dataset.find_unique(where={"id": id_int})

            if not dataset or dataset.deletedAt is not None:
                raise DatasetNotFoundError(dataset_id)

            if dataset.organizationId != int(organization_id):
                raise BIError("Unauthorized dataset update", "unauthorized")

            update_data = {}
            if name is not None:
                update_data["name"] = name
            if description is not None:
                update_data["description"] = description

            if not update_data:
                return cls.map_to_metadata(dataset)

            updated = await prisma.dataset.update(
                where={"id": id_int},
                data=update_data,
                include={"organization": True, "ownerUser": True},
            )

            return cls.map_to_metadata(updated)
        except DatasetNotFoundError:
            raise
        except Exception as e:
            logger.exception("Failed to update dataset metadata: %s", str(e))
            raise BIError(f"Update failed: {str(e)}", "update_error") from e

    @classmethod
    async def delete_dataset(
        cls, dataset_id: str, organization_id: str, user_id: str
    ) -> bool:
        """Perform soft-delete on a dataset"""
        if not dataset_id.isdigit():
            raise DatasetNotFoundError(dataset_id)

        try:
            # Verify ownership/access first
            id_int = int(dataset_id)
            dataset = await prisma.dataset.find_unique(where={"id": id_int})

            if not dataset or dataset.deletedAt is not None:
                raise DatasetNotFoundError(dataset_id)

            # Simple permission check: must match org or be admin (logic simplified for BI)
            if dataset.organizationId != (
                int(organization_id)
                if organization_id.isdigit()
                else dataset.organizationId
            ):
                raise BIError("Unauthorized dataset deletion", "unauthorized")

            await prisma.dataset.update(
                where={"id": id_int}, data={"deletedAt": datetime.now(timezone.utc)}
            )
            return True
        except DatasetNotFoundError:
            raise
        except Exception as e:
            logger.exception("Failed to delete dataset: %s", str(e))
            raise BIError(f"Delete failed: {str(e)}", "delete_error") from e

    @classmethod
    async def get_dataset_preview(
        cls, dataset_id: str, organization_id: str, user_id: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get preview of dataset records using optimized QueryEngine"""
        try:
            dataset = await cls.get_dataset(dataset_id, organization_id, user_id)
            file_path = dataset.get("file_path")

            if not file_path or not os.path.exists(file_path):
                return []

            from app.services.bi_services.query_engine import QueryEngine

            table_name = dataset.get("table_name", "dataset")
            records = QueryEngine.query_dataset(
                file_path, query=f"SELECT * FROM {table_name} LIMIT {limit}"
            )
            return cls._sanitize_json(records)

        except Exception as e:
            logger.exception("Failed to get dataset preview: %s", str(e))
            return []
