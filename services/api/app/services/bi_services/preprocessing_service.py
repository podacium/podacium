"""
Data Preprocessing Service
Cleans and transforms data with full traceability.
"""

import re
import statistics
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from decimal import Decimal, InvalidOperation
from collections import Counter


class PreprocessingService:
    """Service for preprocessing and cleaning data"""

    @staticmethod
    def _detect_date_format(value: str) -> Optional[str]:
        """Detect common date formats"""
        patterns = {
            r"^\d{4}-\d{2}-\d{2}$": "%Y-%m-%d",
            r"^\d{2}/\d{2}/\d{4}$": "%d/%m/%Y",
            r"^\d{4}/\d{2}/\d{2}$": "%Y/%m/%d",
            r"^\d{2}-\d{2}-\d{4}$": "%d-%m-%Y",
            r"^\d{2}/\d{2}/\d{2}$": "%d/%m/%y",
        }

        for pattern, date_format in patterns.items():
            if re.match(pattern, value):
                return date_format

        return None

    @classmethod
    def preprocess_dataset(
        cls,
        records: List[Dict[str, Any]],
        columns: List[str],
        validation_result: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Preprocess dataset with traceable transformations"""
        transformations_log: List[Dict[str, Any]] = []
        processed_records: List[Dict[str, Any]] = []

        if not records:
            return processed_records, transformations_log

        # Step 1: Analyze column types if not provided
        column_analysis = {}
        if validation_result and "inferred_schema" in validation_result:
            column_analysis = validation_result["inferred_schema"]
        else:
            # Simple type inference
            for col in columns:
                column_analysis[col] = {"inferred_type": "unknown", "sample_values": []}

        # Step 2: Handle missing values
        missing_handled = cls._handle_missing_values(
            records, columns, column_analysis, transformations_log
        )

        # Step 3: Trim whitespace for string columns
        trimmed = cls._trim_whitespace(missing_handled, columns, transformations_log)

        # Step 4: Normalize date formats if detected
        normalized = cls._normalize_dates(trimmed, columns, transformations_log)

        # Step 5: Convert numeric strings to numbers
        converted = cls._convert_numeric_strings(
            normalized, columns, transformations_log
        )

        processed_records = converted

        return processed_records, transformations_log

    @classmethod
    def _handle_missing_values(
        cls,
        records: List[Dict[str, Any]],
        columns: List[str],
        column_analysis: Dict[str, Any],
        transformations_log: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Handle missing values with appropriate imputation"""
        processed_records = []

        # Calculate column statistics for imputation
        column_stats = {}
        for col in columns:
            col_type = column_analysis.get(col, {}).get("inferred_type", "unknown")
            values = []

            for record in records:
                value = record.get(col)
                if value is not None and not (
                    isinstance(value, str) and value.strip() == ""
                ):
                    if col_type == "number":
                        try:
                            if isinstance(value, (int, float, Decimal)):
                                values.append(float(value))
                            elif isinstance(value, str):
                                cleaned = value.replace(",", "").strip()
                                if cleaned:
                                    values.append(float(cleaned))
                        except (ValueError, InvalidOperation):
                            pass
                    else:
                        values.append(value)

            column_stats[col] = {
                "type": col_type,
                "values": values,
                "median": statistics.median(values)
                if values and col_type == "number"
                else None,
                "mode": Counter(values).most_common(1)[0][0]
                if values and col_type != "number"
                else None,
            }

        # Impute missing values
        for record in records:
            processed_record = record.copy()

            for col in columns:
                value = record.get(col)

                # Check if value is missing
                if value is None or (isinstance(value, str) and value.strip() == ""):
                    stats = column_stats[col]

                    if stats["type"] == "number" and stats["median"] is not None:
                        processed_record[col] = stats["median"]
                        imputation_method = "median"
                    elif stats["type"] != "number" and stats["mode"] is not None:
                        processed_record[col] = stats["mode"]
                        imputation_method = "mode"
                    else:
                        processed_record[col] = (
                            "UNKNOWN" if stats["type"] == "text" else None
                        )
                        imputation_method = "constant"

                    # Log transformation
                    transformations_log.append(
                        {
                            "step_name": "missing_value_imputation",
                            "columns_affected": [col],
                            "details": f"Imputed missing value with {imputation_method}: {processed_record[col]}",
                            "record_count_affected": 1,
                        }
                    )

            processed_records.append(processed_record)

        # Log summary
        if any(
            "missing_value_imputation" in t["step_name"] for t in transformations_log
        ):
            missing_count = len(
                [
                    t
                    for t in transformations_log
                    if t["step_name"] == "missing_value_imputation"
                ]
            )
            transformations_log.append(
                {
                    "step_name": "missing_value_summary",
                    "columns_affected": columns,
                    "details": f"Imputed missing values in {missing_count} fields across {len(records)} records",
                    "record_count_affected": len(records),
                }
            )

        return processed_records

    @classmethod
    def _trim_whitespace(
        cls,
        records: List[Dict[str, Any]],
        columns: List[str],
        transformations_log: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Trim whitespace from string columns"""
        processed_records = []
        trimmed_count = 0

        for record in records:
            processed_record = record.copy()

            for col in columns:
                value = record.get(col)
                if isinstance(value, str):
                    trimmed = value.strip()
                    if trimmed != value:
                        processed_record[col] = trimmed
                        trimmed_count += 1

            processed_records.append(processed_record)

        if trimmed_count > 0:
            transformations_log.append(
                {
                    "step_name": "whitespace_trimming",
                    "columns_affected": columns,
                    "details": f"Trimmed whitespace from {trimmed_count} string values",
                    "record_count_affected": len(records),
                }
            )

        return processed_records

    @classmethod
    def _normalize_dates(
        cls,
        records: List[Dict[str, Any]],
        columns: List[str],
        transformations_log: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Normalize date formats to ISO format"""
        processed_records = []
        normalized_count = 0
        date_columns = []

        for record in records:
            processed_record = record.copy()

            for col in columns:
                value = record.get(col)
                if isinstance(value, str):
                    date_format = cls._detect_date_format(value)
                    if date_format:
                        try:
                            date_obj = datetime.strptime(value, date_format)
                            normalized = date_obj.strftime("%Y-%m-%d")
                            if normalized != value:
                                processed_record[col] = normalized
                                normalized_count += 1
                                if col not in date_columns:
                                    date_columns.append(col)
                        except ValueError:
                            pass

            processed_records.append(processed_record)

        if normalized_count > 0:
            transformations_log.append(
                {
                    "step_name": "date_normalization",
                    "columns_affected": date_columns,
                    "details": f"Normalized {normalized_count} dates to ISO format (YYYY-MM-DD)",
                    "record_count_affected": len(
                        [
                            r
                            for r in records
                            if any(isinstance(r.get(c), str) for c in date_columns)
                        ]
                    ),
                }
            )

        return processed_records


def parse_dzd_number(raw_val: str) -> Optional[Any]:
    """Parse DZD and multi-format numeric strings without 100x decimal inflation."""
    if not isinstance(raw_val, str):
        return raw_val
    cleaned = raw_val.strip()
    if not cleaned:
        return None

    # Strip currency labels
    cleaned = re.sub(
        r"(?i)\b(?:dzd|da|dinars?|dinars?\s+algerien|دج|دينار|دينار\s+جزائري)\b",
        "",
        cleaned,
    )
    cleaned = cleaned.replace("€", "").replace("$", "").strip()
    if not cleaned:
        return None

    # Replace non-breaking spaces
    cleaned = cleaned.replace("\xa0", " ").replace("\u202f", " ")

    # Both dot and comma present
    if "." in cleaned and "," in cleaned:
        last_dot = cleaned.rfind(".")
        last_comma = cleaned.rfind(",")
        if last_comma > last_dot:
            # French/Algerian standard: 1.250,50 -> 1250.50
            cleaned = cleaned.replace(".", "").replace(" ", "").replace(",", ".")
        else:
            # Anglo standard: 1,250.50 -> 1250.50
            cleaned = cleaned.replace(",", "").replace(" ", "")
    elif "," in cleaned:
        parts = cleaned.split(",")
        if len(parts) == 2 and len(parts[1].strip()) in (1, 2):
            # Decimal comma: 1250,50 -> 1250.50
            cleaned = (
                parts[0].replace(" ", "").replace(".", "") + "." + parts[1].strip()
            )
        else:
            cleaned = cleaned.replace(",", "").replace(" ", "")
    elif " " in cleaned:
        cleaned = cleaned.replace(" ", "")

    try:
        if "." in cleaned:
            val = float(cleaned)
            return int(val) if val.is_integer() else val
        return int(cleaned)
    except (ValueError, TypeError):
        return None

    @classmethod
    def _convert_numeric_strings(
        cls,
        records: List[Dict[str, Any]],
        columns: List[str],
        transformations_log: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Convert numeric strings to actual numbers using parse_dzd_number"""
        processed_records = []
        converted_count = 0
        numeric_columns = []

        for record in records:
            processed_record = record.copy()

            for col in columns:
                value = record.get(col)
                if isinstance(value, str) and value.strip():
                    parsed = parse_dzd_number(value)
                    if parsed is not None:
                        processed_record[col] = parsed
                        converted_count += 1
                        if col not in numeric_columns:
                            numeric_columns.append(col)

            processed_records.append(processed_record)

        if converted_count > 0:
            transformations_log.append(
                {
                    "step_name": "numeric_conversion",
                    "columns_affected": numeric_columns,
                    "details": f"Converted {converted_count} string values to numeric types",
                    "record_count_affected": len(
                        [
                            r
                            for r in records
                            if any(isinstance(r.get(c), str) for c in numeric_columns)
                        ]
                    ),
                }
            )

        return processed_records
