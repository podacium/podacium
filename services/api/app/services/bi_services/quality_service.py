"""
Data Quality Assessment Service
Computes data quality scores and metrics.
"""

import statistics
from typing import Any, Dict, List, Optional, Tuple
from decimal import Decimal, InvalidOperation


class QualityService:
    """Service for assessing data quality"""
    
    @staticmethod
    def detect_outliers_zscore(values: List[float], threshold: float = 3.0) -> List[int]:
        """Detect outliers using Z-score method"""
        if len(values) < 3:
            return []
        
        try:
            mean = statistics.mean(values)
            stdev = statistics.stdev(values) if len(values) > 1 else 0
            
            if stdev == 0:
                return []
            
            outliers = []
            for i, value in enumerate(values):
                z_score = abs((value - mean) / stdev)
                if z_score > threshold:
                    outliers.append(i)
            
            return outliers
        except statistics.StatisticsError:
            return []
    
    @staticmethod
    def calculate_completeness_score(
        records: List[Dict[str, Any]],
        columns: List[str]
    ) -> float:
        """Calculate completeness score (0-100) based on non-null values"""
        if not records or not columns:
            return 0.0
        
        total_cells = len(records) * len(columns)
        if total_cells == 0:
            return 0.0
        
        non_null_count = 0
        for record in records:
            for col in columns:
                value = record.get(col)
                if value is not None and not (isinstance(value, str) and value.strip() == ""):
                    non_null_count += 1
        
        return (non_null_count / total_cells) * 100
    
    @staticmethod
    def calculate_duplicate_ratio(
        records: List[Dict[str, Any]],
        columns: List[str]
    ) -> float:
        """Calculate ratio of duplicate records"""
        if not records or len(records) < 2:
            return 0.0
        
        # Convert records to tuples for hashing
        record_tuples = []
        for record in records:
            # Create tuple of values for specified columns
            values = tuple(str(record.get(col, "")) for col in columns)
            record_tuples.append(values)
        
        # Count duplicates
        total_records = len(record_tuples)
        unique_records = len(set(record_tuples))
        
        if total_records == 0:
            return 0.0
        
        duplicate_count = total_records - unique_records
        return (duplicate_count / total_records) * 100
    
    @classmethod
    def calculate_outlier_ratio(
        cls,
        records: List[Dict[str, Any]],
        columns: List[str],
        validation_result: Optional[Dict[str, Any]] = None
    ) -> Tuple[float, List[str]]:
        """Calculate outlier ratio for numeric columns"""
        warnings: List[str] = []
        
        if not records or not columns:
            return 0.0, warnings
        
        # Find numeric columns
        numeric_columns = []
        if validation_result and "inferred_schema" in validation_result:
            for col, schema in validation_result["inferred_schema"].items():
                if schema.get("inferred_type") == "number":
                    numeric_columns.append(col)
        else:
            # Fallback: try to infer numeric columns
            for col in columns:
                numeric_values = []
                for record in records:
                    value = record.get(col)
                    if value is not None:
                        try:
                            if isinstance(value, (int, float, Decimal)):
                                numeric_values.append(float(value))
                            elif isinstance(value, str):
                                cleaned = value.replace(',', '').strip()
                                if cleaned:
                                    numeric_values.append(float(cleaned))
                        except (ValueError, InvalidOperation):
                            pass
                
                if len(numeric_values) >= 3:  # Need at least 3 values for meaningful stats
                    numeric_columns.append(col)
        
        if not numeric_columns:
            warnings.append("No numeric columns found for outlier detection")
            return 0.0, warnings
        
        # Calculate outlier ratio for each numeric column
        total_outliers = 0
        total_numeric_values = 0
        
        for col in numeric_columns:
            numeric_values = []
            for record in records:
                value = record.get(col)
                if value is not None:
                    try:
                        if isinstance(value, (int, float, Decimal)):
                            numeric_values.append(float(value))
                        elif isinstance(value, str):
                            cleaned = value.replace(',', '').strip()
                            if cleaned:
                                numeric_values.append(float(cleaned))
                    except (ValueError, InvalidOperation):
                        pass
            
            if len(numeric_values) >= 3:
                outliers = cls.detect_outliers_zscore(numeric_values)
                total_outliers += len(outliers)
                total_numeric_values += len(numeric_values)
            else:
                warnings.append(f"Column '{col}' has insufficient numeric values for outlier detection")
        
        if total_numeric_values == 0:
            warnings.append("No valid numeric values found for outlier detection")
            return 0.0, warnings
        
        outlier_ratio = (total_outliers / total_numeric_values) * 100
        return outlier_ratio, warnings
    
    @classmethod
    def assess_quality(
        cls,
        records: List[Dict[str, Any]],
        columns: List[str],
        validation_result: Optional[Dict[str, Any]] = None,
        column_analytics: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Assess overall data quality"""
        # Calculate individual scores
        
        # Completeness: Use pre-computed analytics if available
        if column_analytics:
            total_cells = len(records) * len(columns)
            total_nulls = sum(
                (analytics.get("statistics") or {}).get("null_count", 0) 
                for analytics in column_analytics.values()
            )
            completeness_score = ((total_cells - total_nulls) / total_cells * 100) if total_cells > 0 else 0
        else:
            completeness_score = cls.calculate_completeness_score(records, columns)

        duplicate_ratio = cls.calculate_duplicate_ratio(records, columns)
        
        # Outliers: Use pre-computed analytics if available
        if column_analytics:
            outlier_ratio = 0.0
            outlier_warnings: List[str] = []
            
            numeric_cols = [c for c, a in column_analytics.items() if a.get("type") == "numeric"]
            
            for col in numeric_cols:
                column_analytics[col].get("statistics", {})
                # Note: Exact outlier count isn't in basic stats unless we add it to AnalyticsService.
                # For now, we might still need to scan for outliers if detailed distribution isn't available
                # Or we can estimate based on min/max vs stddev (Pseudo-detection)
                
                # Let's fallback to actual detection for now to keep it accurate, 
                # but we can reuse the known numeric column list
                pass # Logic continues below using the helper but optimized
                
            # Re-running outlier detection on known numeric columns is safer for accuracy
            outlier_ratio, outlier_warnings = cls.calculate_outlier_ratio(
                records, columns, validation_result
            )
        else:
            outlier_ratio, outlier_warnings = cls.calculate_outlier_ratio(
                records, columns, validation_result
            )
        
        # Calculate overall quality score (0-100)
        # Weights: completeness 50%, duplicates 30%, outliers 20%
        completeness_weight = 0.5
        duplicate_weight = 0.3
        outlier_weight = 0.2
        
        # Convert ratios to scores (higher is better)
        completeness_component = completeness_score * completeness_weight
        duplicate_component = (100 - duplicate_ratio) * duplicate_weight
        outlier_component = (100 - outlier_ratio) * outlier_weight
        
        quality_score = completeness_component + duplicate_component + outlier_component
        
        # Determine quality level
        if quality_score >= 80:
            quality_level = "EXCELLENT"
        elif quality_score >= 60:
            quality_level = "ACCEPTABLE"
        else:
            quality_level = "POOR"
        
        # Generate human-readable summary
        summary_keys: List[Dict[str, Any]] = []
        
        if completeness_score >= 90:
            summary_keys.append({"key": "quality.summary.completeness.excellent"})
        elif completeness_score >= 70:
            summary_keys.append({"key": "quality.summary.completeness.good"})
        else:
            summary_keys.append({"key": "quality.summary.completeness.poor"})
        
        if duplicate_ratio < 5:
            summary_keys.append({"key": "quality.summary.duplicates.few"})
        elif duplicate_ratio < 20:
            summary_keys.append({"key": "quality.summary.duplicates.some"})
        else:
            summary_keys.append({"key": "quality.summary.duplicates.high"})
        
        if outlier_ratio < 5:
            summary_keys.append({"key": "quality.summary.outliers.minimal"})
        elif outlier_ratio < 15:
            summary_keys.append({"key": "quality.summary.outliers.some"})
        else:
            summary_keys.append({"key": "quality.summary.outliers.many"})
        
        if outlier_warnings:
            summary_keys.append({"key": "quality.summary.warnings.count", "params": {"count": str(len(outlier_warnings))}})
        
        # Keep legacy string for backward compatibility with unstructured DB logs if needed
        human_summary = " ".join([k["key"] for k in summary_keys])
        
        return {
            "quality_score": round(quality_score, 2),
            "quality_level": quality_level,
            "completeness_score": round(completeness_score, 2),
            "duplicate_ratio": round(duplicate_ratio, 2),
            "outlier_ratio": round(outlier_ratio, 2),
            "breakdown": {
                "completeness": {
                    "score": round(completeness_score, 2),
                    "weight": completeness_weight,
                    "component": round(completeness_component, 2)
                },
                "duplicates": {
                    "ratio": round(duplicate_ratio, 2),
                    "weight": duplicate_weight,
                    "component": round(duplicate_component, 2)
                },
                "outliers": {
                    "ratio": round(outlier_ratio, 2),
                    "weight": outlier_weight,
                    "component": round(outlier_component, 2)
                }
            },
            "warnings": outlier_warnings,
            "human_summary": human_summary,
            "summary_keys": summary_keys,
            "recommendation_keys": cls._generate_quality_recommendations(
                completeness_score, duplicate_ratio, outlier_ratio, quality_level
            ),
            # Legacy field mapping
            "recommendations": [r["key"] for r in cls._generate_quality_recommendations(
                completeness_score, duplicate_ratio, outlier_ratio, quality_level
            )]
        }
    
    @staticmethod
    def _generate_quality_recommendations(
        completeness: float,
        duplicate_ratio: float,
        outlier_ratio: float,
        quality_level: str
    ) -> List[Dict[str, Any]]:
        """Generate recommendations based on quality assessment (i18n payloads)"""
        recommendation_keys = []
        
        if completeness < 70:
            recommendation_keys.append({"key": "quality.recommendations.impute_missing"})
            recommendation_keys.append({"key": "quality.recommendations.review_collection"})
        
        if duplicate_ratio > 10:
            recommendation_keys.append({"key": "quality.recommendations.detect_duplicates"})
            recommendation_keys.append({"key": "quality.recommendations.remove_duplicates"})
        
        if outlier_ratio > 10:
            recommendation_keys.append({"key": "quality.recommendations.investigate_outliers"})
            recommendation_keys.append({"key": "quality.recommendations.treat_outliers"})
        
        if quality_level == "POOR":
            recommendation_keys.append({"key": "quality.recommendations.poor_quality"})
        
        if not recommendation_keys:
            recommendation_keys.append({"key": "quality.recommendations.good_quality"})
        
        return recommendation_keys