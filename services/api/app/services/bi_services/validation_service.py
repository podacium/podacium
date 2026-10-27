"""
Data Validation Service
Validates dataset structure and content.
"""

import re
from datetime import datetime
from typing import Any, Dict, List
from decimal import Decimal, InvalidOperation

from .errors import ValidationError


class ValidationService:
    """Service for validating dataset structure and content"""
    
    @staticmethod
    def infer_type(value: Any) -> str:
        """Infer data type from a value"""
        if value is None:
            return "null"
        
        if isinstance(value, (int, float, Decimal)):
            return "number"
        
        if isinstance(value, bool):
            return "boolean"
        
        if isinstance(value, datetime):
            return "datetime"
        
        if isinstance(value, str):
            # Try to parse as number
            try:
                # Remove commas and whitespace
                cleaned = value.replace(',', '').strip()
                if cleaned:
                    float(cleaned)
                    return "number"
            except (ValueError, InvalidOperation):
                pass
            
            # Try to parse as date
            date_patterns = [
                r'^\d{4}-\d{2}-\d{2}$',
                r'^\d{2}/\d{2}/\d{4}$',
                r'^\d{4}/\d{2}/\d{2}$',
                r'^\d{2}-\d{2}-\d{4}$',
            ]
            
            for pattern in date_patterns:
                if re.match(pattern, value):
                    return "date"
            
            return "text"
        
        return "unknown"
    
    @classmethod
    def validate_dataset(
        cls,
        records: List[Dict[str, Any]],
        columns: List[str]
    ) -> Dict[str, Any]:
        """Validate dataset structure and content"""
        errors = []
        warnings = []
        
        # 1. Check if dataset is empty
        if not records:
            errors.append("Dataset contains no records")
            return {
                "valid": False,
                "errors": errors,
                "warnings": warnings
            }
        
        # 2. Check if columns exist and are unique
        if not columns:
            errors.append("Dataset has no columns defined")
        
        if len(columns) != len(set(columns)):
            duplicate_cols = [col for col in columns if columns.count(col) > 1]
            errors.append(f"Duplicate column names found: {list(set(duplicate_cols))}")
        
        # 3. Check for entirely empty columns
        column_stats = {}
        for col in columns:
            column_stats[col] = {
                "null_count": 0,
                "type_counts": {},
                "sample_values": []
            }
        
        # 4. Analyze each record
        for i, record in enumerate(records, start=1):
            # Check if record has all columns
            record_keys = set(record.keys())
            expected_keys = set(columns)
            
            missing_keys = expected_keys - record_keys
            if missing_keys:
                errors.append(f"Record {i} missing columns: {missing_keys}")
                continue  # Skip further analysis for this record
            
            extra_keys = record_keys - expected_keys
            if extra_keys:
                warnings.append(f"Record {i} has extra columns: {extra_keys}")
            
            # Analyze each column value
            for col in columns:
                value = record.get(col)
                
                # Count nulls
                if value is None or (isinstance(value, str) and value.strip() == ""):
                    column_stats[col]["null_count"] += 1
                else:
                    # Take sample values (max 5)
                    if len(column_stats[col]["sample_values"]) < 5:
                        column_stats[col]["sample_values"].append(value)
                
                # Infer and count types
                value_type = cls.infer_type(value)
                column_stats[col]["type_counts"][value_type] = \
                    column_stats[col]["type_counts"].get(value_type, 0) + 1
        
        # 5. Generate column-specific warnings
        for col, stats in column_stats.items():
            total_records = len(records)
            null_ratio = stats["null_count"] / total_records if total_records > 0 else 1
            
            if null_ratio == 1:
                warnings.append(f"Column '{col}' is entirely empty")
            elif null_ratio > 0.5:
                warnings.append(f"Column '{col}' has more than 50% missing values ({null_ratio:.1%})")
            
            # Check for type consistency
            type_counts = stats["type_counts"]
            if len(type_counts) > 1:
                main_type = max(type_counts.items(), key=lambda x: x[1])
                other_types = [t for t in type_counts.keys() if t != main_type[0] and t != "null"]
                if other_types:
                    warnings.append(f"Column '{col}' has mixed types: mainly {main_type[0]} but also {other_types}")
        
        # 6. Determine inferred schema
        inferred_schema = {}
        for col, stats in column_stats.items():
            type_counts = stats["type_counts"]
            if type_counts:
                # Find most common non-null type
                non_null_types = {k: v for k, v in type_counts.items() if k != "null"}
                if non_null_types:
                    main_type = max(non_null_types.items(), key=lambda x: x[1])[0]
                else:
                    main_type = "unknown"
                
                inferred_schema[col] = {
                    "inferred_type": main_type,
                    "null_count": stats["null_count"],
                    "null_ratio": stats["null_count"] / len(records) if records else 0,
                    "type_distribution": type_counts
                }
        
        # 7. Determine if valid
        valid = len(errors) == 0
        
        if not valid:
            raise ValidationError(errors, warnings)
        
        return {
            "valid": valid,
            "errors": errors,
            "warnings": warnings,
            "inferred_schema": inferred_schema,
            "record_count": len(records),
            "column_count": len(columns),
            "column_stats": column_stats
        }