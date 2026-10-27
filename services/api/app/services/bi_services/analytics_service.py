import logging

logger = logging.getLogger(__name__)
"""
Analytics Service
Performs descriptive analytics and trend detection.
"""

import statistics
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from collections import Counter


class AnalyticsService:
    """Service for performing data analytics"""

    @staticmethod
    def analyze_numeric_column(
        values: List[float],
        file_path: Optional[str] = None,
        column_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Analyze numeric column statistics"""

        # Method 1: Use DuckDB if file provided (Faster for large data)
        if file_path and column_name:
            try:
                from app.services.bi_services.query_engine import QueryEngine

                table_expr = QueryEngine._get_table_expr(file_path)

                # Use DuckDB for aggregations with robust type casting
                col_cast = f'TRY_CAST("{column_name}" AS DOUBLE)'
                query = f"""
                    SELECT 
                        COUNT({col_cast}) as count,
                        AVG({col_cast}) as mean,
                        MEDIAN({col_cast}) as median,
                        MIN({col_cast}) as min,
                        MAX({col_cast}) as max,
                        STDDEV({col_cast}) as std_dev,
                        SUM({col_cast}) as sum
                    FROM {table_expr}
                """
                results = QueryEngine.execute_internal_query(query)
                if results:
                    row = results[0]
                    return {
                        "count": row.get("count", 0),
                        "mean": row.get("mean"),
                        "median": row.get("median"),
                        "min": row.get("min"),
                        "max": row.get("max"),
                        "std_dev": row.get("std_dev"),
                        "sum": row.get("sum"),
                        "null_count": 0,  # DuckDB handles nulls in count implicitly, but we might want explicit count
                        "null_percentage": 0.0,
                    }
            except Exception as e:
                logger.exception("SQL analytics fallback to Python: %s", str(e))

        # Method 2: Use Python statistics (Fallback / Small data)
        if not values:
            return {
                "count": 0,
                "mean": None,
                "median": None,
                "min": None,
                "max": None,
                "std_dev": None,
                "sum": None,
            }

        try:
            total_len = len(values)
            non_null_values = [v for v in values if v is not None]
            null_count = total_len - len(non_null_values)

            if not non_null_values:
                return {
                    "count": 0,
                    "mean": None,
                    "median": None,
                    "min": None,
                    "max": None,
                    "std_dev": None,
                    "sum": None,
                    "null_count": total_len,
                    "null_percentage": 100.0,
                }

            # Outlier detection
            outliers = []
            if non_null_values:
                mean = statistics.mean(non_null_values)
                stdev = (
                    statistics.stdev(non_null_values) if len(non_null_values) > 1 else 0
                )
                if stdev > 0:
                    outliers = [
                        v for v in non_null_values if abs((v - mean) / stdev) > 3
                    ]

            return {
                "count": len(non_null_values),
                "mean": statistics.mean(non_null_values),
                "median": statistics.median(non_null_values),
                "min": min(non_null_values),
                "max": max(non_null_values),
                "std_dev": statistics.stdev(non_null_values)
                if len(non_null_values) > 1
                else 0,
                "sum": sum(non_null_values),
                "null_count": null_count,
                "null_percentage": (null_count / total_len * 100)
                if total_len > 0
                else 0,
                "outlier_count": len(outliers),
                "outlier_percentage": (len(outliers) / len(non_null_values) * 100)
                if non_null_values
                else 0,
                "sample_outliers": outliers[:5],
            }
        except statistics.StatisticsError:
            return {
                "count": len(values),
                "mean": None,
                "median": None,
                "min": min(values) if values else None,
                "max": max(values) if values else None,
                "std_dev": None,
                "sum": sum(values) if values else None,
                "null_count": 0,
                "null_percentage": 0.0,
                "outlier_count": 0,
                "outlier_percentage": 0,
                "sample_outliers": [],
            }

    @staticmethod
    def analyze_categorical_column(
        values: List[Any],
        top_n: int = 5,
        file_path: Optional[str] = None,
        column_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Analyze categorical column statistics"""

        # Method 1: DuckDB (Faster)
        if file_path and column_name:
            try:
                from app.services.bi_services.query_engine import QueryEngine

                table_expr = QueryEngine._get_table_expr(file_path)

                # Get unique count
                count_query = f"""
                    SELECT COUNT(DISTINCT "{column_name}") as unique_count, COUNT(*) as total
                    FROM {table_expr}
                """
                count_res = QueryEngine.execute_internal_query(count_query)[0]

                # Get top N categories
                top_query = f"""
                    SELECT "{column_name}" as value, COUNT(*) as count
                    FROM {table_expr}
                    GROUP BY "{column_name}"
                    ORDER BY count DESC
                    LIMIT {top_n}
                """
                top_items = QueryEngine.execute_internal_query(top_query)

                total = count_res["total"]

                top_categories = [
                    {
                        "value": str(item["value"]),
                        "count": item["count"],
                        "percentage": (item["count"] / total * 100) if total > 0 else 0,
                    }
                    for item in top_items
                ]

                return {
                    "count": total,
                    "unique_count": count_res["unique_count"],
                    "top_categories": top_categories,
                    "value_counts": {
                        str(item["value"]): item["count"] for item in top_items
                    },  # Approximation for top N
                }
            except Exception as e:
                logger.exception("DuckDB categorical analysis failed: %s", str(e))

        # Method 2: Python (Fallback)
        if not values:
            return {
                "count": 0,
                "unique_count": 0,
                "top_categories": [],
                "value_counts": {},
            }

        # Count frequencies
        total_len = len(values)
        non_null_values = [v for v in values if v is not None and str(v).strip() != ""]
        null_count = total_len - len(non_null_values)

        counter = Counter(non_null_values)

        # Get top N categories
        top_items = counter.most_common(top_n)
        top_categories = [
            {
                "value": str(value),
                "count": count,
                "percentage": (count / len(non_null_values)) * 100
                if non_null_values
                else 0,
            }
            for value, count in top_items
        ]

        return {
            "count": len(non_null_values),
            "unique_count": len(counter),
            "top_categories": top_categories,
            "value_counts": {str(k): v for k, v in counter.items()},
            "null_count": null_count,
            "null_percentage": (null_count / total_len * 100) if total_len > 0 else 0,
        }

    @classmethod
    def detect_trends(
        cls,
        records: List[Dict[str, Any]],
        date_column: Optional[str] = None,
        value_column: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Detect trends in time-series data"""
        if not date_column or not value_column:
            return {
                "trend_detected": False,
                "reason": "No date or value column specified",
                "trend_direction": None,
                "trend_strength": None,
                "percentage_change": None,
            }

        # Extract and sort by date
        dated_values = []
        for record in records:
            date_val = record.get(date_column)
            value_val = record.get(value_column)

            if date_val and value_val:
                try:
                    # Try to parse date
                    if isinstance(date_val, datetime):
                        date_obj = date_val
                    elif isinstance(date_val, str):
                        # Try common formats
                        for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"]:
                            try:
                                date_obj = datetime.strptime(date_val, fmt)
                                break
                            except ValueError:
                                continue
                        else:
                            continue  # Skip if date can't be parsed
                    else:
                        continue

                    # Try to parse value
                    if isinstance(value_val, (int, float)):
                        numeric_val = float(value_val)
                    elif isinstance(value_val, str):
                        try:
                            numeric_val = float(value_val.replace(",", ""))
                        except ValueError:
                            continue
                    else:
                        continue

                    dated_values.append((date_obj, numeric_val))
                except (ValueError, AttributeError):
                    continue

        if len(dated_values) < 3:
            return {
                "trend_detected": False,
                "reason": "Insufficient data points for trend analysis",
                "trend_direction": None,
                "trend_strength": None,
                "percentage_change": None,
            }

        # Sort by date
        dated_values.sort(key=lambda x: x[0])

        # Split into first and last thirds for comparison
        n = len(dated_values)
        first_n = max(1, n // 3)
        last_n = max(1, n // 3)

        first_values = [v for _, v in dated_values[:first_n]]
        last_values = [v for _, v in dated_values[-last_n:]]

        # Calculate averages
        first_avg = statistics.mean(first_values) if first_values else 0
        last_avg = statistics.mean(last_values) if last_values else 0

        # Determine trend
        if last_avg > first_avg * 1.1:  # 10% increase
            trend_direction = "INCREASING"
            percentage_change = (
                ((last_avg - first_avg) / first_avg * 100) if first_avg != 0 else 0
            )
        elif last_avg < first_avg * 0.9:  # 10% decrease
            trend_direction = "DECREASING"
            percentage_change = (
                ((first_avg - last_avg) / first_avg * 100) if first_avg != 0 else 0
            )
        else:
            trend_direction = "STABLE"
            percentage_change = 0

        # Calculate trend strength (simple heuristic)
        if abs(percentage_change) > 20:
            trend_strength = "STRONG"
        elif abs(percentage_change) > 5:
            trend_strength = "MODERATE"
        else:
            trend_strength = "WEAK"

        return {
            "trend_detected": True,
            "trend_direction": trend_direction,
            "trend_strength": trend_strength,
            "percentage_change": round(percentage_change, 2),
            "first_period_avg": round(first_avg, 2),
            "last_period_avg": round(last_avg, 2),
            "data_points": n,
            "time_range": {
                "start": dated_values[0][0].isoformat() if dated_values else None,
                "end": dated_values[-1][0].isoformat() if dated_values else None,
            },
        }

    # Algerian Wilayas (Names and 2-digit Codes)
    ALGERIAN_WILAYAS = {
        "adrar",
        "chlef",
        "laghouat",
        "oum el bouaghi",
        "batna",
        "béjaïa",
        "bejaia",
        "biskra",
        "béchar",
        "bechar",
        "blida",
        "bouira",
        "tamanghasset",
        "tamenrasset",
        "tébessa",
        "tebessa",
        "tlemcen",
        "tiaret",
        "tizi ouzou",
        "alger",
        "algiers",
        "djelfa",
        "jijel",
        "sétif",
        "setif",
        "saïda",
        "saida",
        "skikda",
        "sidi bel abbès",
        "sidi bel abbes",
        "annaba",
        "guelma",
        "constantine",
        "médéa",
        "medea",
        "mostaganem",
        "m'sila",
        "msila",
        "mascara",
        "ouargla",
        "oran",
        "el bayadh",
        "illizi",
        "bordj bou arréridj",
        "bordj bou arreridj",
        "boumerdès",
        "boumerdes",
        "el tarf",
        "tindouf",
        "tissemsilt",
        "el oued",
        "khenchela",
        "souk ahras",
        "tipaza",
        "mila",
        "aïn defla",
        "ain defla",
        "naâma",
        "naama",
        "aïn témouchent",
        "ain temouchent",
        "ghardaïa",
        "ghardaia",
        "relizane",
        "timimoun",
        "bordj badji mokhtar",
        "ouled djellal",
        "béni abbès",
        "beni abbes",
        "in salah",
        "in guezzam",
        "touggourt",
        "djanet",
        "el m'ghair",
        "el meniaa",
    }

    # Algerian Communes Sample Set
    ALGERIAN_COMMUNES = {
        "bab el oued",
        "hydra",
        "sidi m'hamed",
        "oran",
        "constantine",
        "annaba",
        "blida",
        "setif",
        "tlemcen",
        "bejaia",
        "batna",
        "biskra",
        "djelfa",
        "skikda",
        "chlef",
        "medea",
        "saida",
        "mostaganem",
        "el oued",
        "tiaret",
        "tizi ouzou",
        "bordj bou arreridj",
        "mascara",
        "souk ahras",
        "khenchela",
        "jijel",
        "guelma",
        "relizane",
        "el tarf",
        "ouargla",
        "laghouat",
        "bouira",
        "el biar",
        "kouba",
        "alger centre",
        "algiers centre",
        "hussein dey",
        "dely ibrahim",
        "cheraga",
    }

    # Gender Values Set
    GENDER_VALUES = {
        "male",
        "female",
        "m",
        "f",
        "man",
        "woman",
        "homme",
        "femme",
        "h",
        "f",
        "ذكر",
        "أنثى",
        "non-binary",
        "other",
        "boy",
        "girl",
    }

    # Extended Semantic Regex Patterns
    SEMANTIC_PATTERNS = {
        "email": r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
        "url": r"^(https?://)?(www\.)?([a-zA-Z0-9.-]+)(\.[a-z]{2,})+(/.*)?$",
        "phone": r"^(\+?213|0)[5-79]\d{8}$|^\+\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}$|^\d{3,4}[-.\s]\d{3,4}[-.\s]\d{3,4}$",
        "currency": r"^[\$€£¥₹DA\s]*[\d,.]+(\s*(DZD|DA|د\.ج|\$|€|£|USD|EUR))?$",
        "percentage": r"^-?[\d,.]+\s*%$",
        "ip_address": r"^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$",
        "mac_address": r"^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$",
        "credit_card": r"^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$",
        "uuid": r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
        "date_iso": r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$",
        "date_slash": r"^\d{1,2}[/\.-]\d{1,2}[/\.-]\d{2,4}$",
        "date_named": r"^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)[a-z]*\s+\d{2,4}$",
        "duration": r"^P(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$|^\d{1,2}:\d{2}(:\d{2})?$",
        "postal_code": r"^\d{5}$",
    }

    @classmethod
    def _generate_semantic_hints(
        cls, values: List[Any], column_name: str = "", threshold: float = 0.6
    ) -> Optional[str]:
        """
        Multi-stage classifier for dataset columns:
        Stage 1: Deep Sample Value Analysis (Pattern, Range, & Set Matching).
        Stage 2: Column Name Keyword Heuristics fallback.
        """
        import re

        col_clean = column_name.lower().strip().replace(" ", "_").replace("-", "_")
        valid_values = [
            str(v).strip() for v in values if v is not None and str(v).strip() != ""
        ]
        count = len(valid_values)

        # -------------------------------------------------------------------------
        # STAGE 1: SAMPLE VALUE STATISTICAL & PATTERN MATCHING
        # -------------------------------------------------------------------------
        if valid_values and count > 0:
            # 1.1 Geo Coordinates Range & Keyword Check
            numeric_vals = []
            for v in valid_values:
                try:
                    numeric_vals.append(float(v))
                except ValueError:
                    pass
            if len(numeric_vals) / count >= threshold:
                if any(k in col_clean for k in ["lat", "latitude"]) and all(
                    -90 <= v <= 90 for v in numeric_vals
                ):
                    return "latitude"
                if any(k in col_clean for k in ["lon", "lng", "longitude"]) and all(
                    -180 <= v <= 180 for v in numeric_vals
                ):
                    return "longitude"

            # 1.2 Credit Card Match
            cc_matches = sum(
                1
                for v in valid_values
                if re.match(cls.SEMANTIC_PATTERNS["credit_card"], v)
            )
            if cc_matches / count >= threshold:
                return "credit_card"

            # 1.3 Gender Match
            matches_gender = sum(
                1 for v in valid_values if v.lower() in cls.GENDER_VALUES
            )
            if matches_gender / count >= threshold:
                return "gender"

            # 1.4 Algerian Wilaya Match
            matches_wilaya = sum(
                1 for v in valid_values if v.lower() in cls.ALGERIAN_WILAYAS
            )
            if matches_wilaya / count >= 0.4:
                return "algerian_wilaya"

            # 1.5 Algerian Commune Match
            matches_commune = sum(
                1 for v in valid_values if v.lower() in cls.ALGERIAN_COMMUNES
            )
            if matches_commune / count >= 0.4:
                return "commune"

            # 1.6 Regex Pattern Matching
            for type_name, pattern in cls.SEMANTIC_PATTERNS.items():
                if type_name == "credit_card":
                    continue
                matches = sum(
                    1 for v in valid_values if re.match(pattern, v, re.IGNORECASE)
                )
                if matches / count >= threshold:
                    if type_name in ["date_iso", "date_slash", "date_named"]:
                        return "datetime"
                    if type_name == "uuid":
                        return "identifier"
                    return type_name

            # 1.7 Boolean Match
            bool_map = {
                "true",
                "false",
                "yes",
                "no",
                "1",
                "0",
                "y",
                "n",
                "oui",
                "non",
                "vrai",
                "faux",
            }
            matches_bool = sum(1 for v in valid_values if v.lower() in bool_map)
            if matches_bool / count >= threshold:
                return "boolean"

        # -------------------------------------------------------------------------
        # STAGE 2: COLUMN NAME KEYWORD HEURISTICS (FALLBACK)
        # -------------------------------------------------------------------------
        if any(
            k in col_clean for k in ["gender", "sex", "sexe", "jins", "جنس", "الجنس"]
        ):
            return "gender"
        if any(k in col_clean for k in ["email", "courriel", "e_mail"]):
            return "email"
        if any(k in col_clean for k in ["phone", "tel", "mobile", "telephone", "fax"]):
            return "phone"
        if any(k in col_clean for k in ["url", "website", "link", "site_url", "uri"]):
            return "url"
        if any(
            k in col_clean
            for k in ["fumeur", "smoker", "tabac", "تدخين", "smoke", "smoking"]
        ):
            return "status"
        if any(
            k in col_clean for k in ["antecedent", "antecedents", "sawabik", "سوابق"]
        ):
            return "status"
        if any(k in col_clean for k in ["maladie", "disease", "marad", "مرض"]):
            return "status"
        if "wilaya" in col_clean or "province_dz" in col_clean:
            return "algerian_wilaya"
        if "commune" in col_clean or "baladiya" in col_clean or "بلدية" in col_clean:
            return "commune"
        if any(k in col_clean for k in ["latitude", "lat"]):
            return "latitude"
        if any(k in col_clean for k in ["longitude", "lon", "lng"]):
            return "longitude"
        if any(k in col_clean for k in ["mac", "mac_address", "hardware_id"]):
            return "mac_address"
        if any(
            k in col_clean
            for k in ["card_number", "credit_card", "pan", "carte_bancaire"]
        ):
            return "credit_card"
        if any(
            k in col_clean
            for k in ["duration", "duree", "time_spent", "elapsed", "runtime"]
        ):
            return "duration"
        if (
            any(
                k in col_clean
                for k in [
                    "price",
                    "cost",
                    "salary",
                    "revenue",
                    "amount",
                    "budget",
                    "dzd",
                    "montant",
                    "prix",
                    "balance",
                    "gdp",
                    "pib",
                    "export",
                    "exportations",
                    "import",
                    "importations",
                    "gfcf",
                    "fbcg",
                    "spending",
                    "investment",
                    "capital",
                ]
            )
            or col_clean == "g"
        ):
            return "currency"
        if any(
            k in col_clean
            for k in [
                "rate",
                "ratio",
                "pct",
                "percentage",
                "percent",
                "discount",
                "margin",
                "taux",
                "inf",
                "inflation",
                "unemployment",
                "chomage",
                "exch",
                "exchange",
                "interest",
                "yield",
            ]
        ):
            return "percentage"
        if any(
            k in col_clean for k in ["ip_address", "client_ip", "user_ip", "remote_ip"]
        ):
            return "ip_address"
        if any(k in col_clean for k in ["country", "pays", "nation"]):
            return "country"
        if any(k in col_clean for k in ["city", "ville", "town"]):
            return "city"
        if any(k in col_clean for k in ["zip", "postal_code", "code_postal"]):
            return "postal_code"
        if any(
            k in col_clean
            for k in [
                "created_at",
                "updated_at",
                "deleted_at",
                "timestamp",
                "birth_date",
                "dob",
                "date",
            ]
        ):
            return "datetime"
        if any(k in col_clean for k in ["year", "annee", "yr"]):
            return "year"
        if any(k in col_clean for k in ["age", "âge", "عمر", "العمر"]):
            return "age"
        if any(
            k in col_clean
            for k in [
                "first_name",
                "last_name",
                "full_name",
                "customer_name",
                "user_name",
                "nom",
                "prenom",
            ]
        ):
            return "person_name"
        if any(
            k in col_clean
            for k in [
                "company",
                "organization",
                "entreprise",
                "vendor",
                "supplier",
                "societe",
            ]
        ):
            return "company_name"
        if any(k in col_clean for k in ["status", "state", "stage", "phase", "etat"]):
            return "status"
        if any(k in col_clean for k in ["category", "genre", "department", "tier"]):
            return "category"
        if (
            col_clean.endswith("_id")
            or col_clean == "id"
            or col_clean.endswith("_uuid")
            or col_clean.endswith("_code")
        ):
            return "identifier"

        return None

    @classmethod
    def _detect_semantic_type_heuristic(
        cls, column_name: str, values: List[Any]
    ) -> str:
        """Alias for _generate_semantic_hints returning uppercase string hint."""
        hint = cls._generate_semantic_hints(values, column_name=column_name)
        return (hint or "STRING").upper()

    @classmethod
    def _detect_mixed_types_duckdb(cls, file_path: str, column_name: str) -> bool:
        """
        Check if a column has mixed types (e.g. numbers mixed with text)
        using DuckDB's TRY_CAST.
        """
        from app.services.bi_services.query_engine import QueryEngine

        try:
            table_expr = QueryEngine._get_table_expr(file_path)
            # Check how many values can be cast to numeric vs total non-null
            query = f"""
                SELECT 
                    COUNT(*) as total,
                    COUNT(TRY_CAST("{column_name}" AS DOUBLE)) as numeric_count
                FROM {table_expr}
                WHERE "{column_name}" IS NOT NULL
            """
            result = QueryEngine.execute_internal_query(query)[0]
            total = result["total"]
            numeric = result["numeric_count"]

            # If we have a mix (some numeric, some not) it's potentially mixed type
            # We assume a column is mixed if 10% < numeric < 90%
            if total > 0:
                ratio = numeric / total
                return 0.1 < ratio < 0.9
            return False
        except Exception as e:
            logger.exception("DuckDB mixed-type detection failed: %s", str(e))
            return False

    @classmethod
    def _detect_invalid_values_duckdb(
        cls,
        file_path: str,
        column_name: str,
        col_type: str,
        semantic_type: Optional[str],
    ) -> Tuple[int, List[Any]]:
        """
        Detect invalid values in a column based on its type and semantic type.
        Returns (count, sample_invalid_values).
        """
        from app.services.bi_services.query_engine import QueryEngine

        invalid_count = 0
        samples = []

        try:
            if col_type == "numeric":
                # Check for non-numeric values that shouldn't be there (DuckDB handles this via weak typing usually, but we can check castability)
                # But if the column IS numeric type in DuckDB, it won't have non-numerics.
                # So we only check this if the column ended up being TEXT but we think it should be numeric?
                # Actually, effectively specific 'invalid' checks are domain specific.
                pass

            elif col_type == "text" and semantic_type == "email":
                table_expr = QueryEngine._get_table_expr(file_path)
                # Check for invalid emails
                pattern = cls.SEMANTIC_PATTERNS["email"]
                query = f"""
                    SELECT "{column_name}" 
                    FROM {table_expr} 
                    WHERE "{column_name}" IS NOT NULL 
                    AND NOT regexp_matches("{column_name}", '{pattern}')
                    LIMIT 20
                """
                res = QueryEngine.execute_internal_query(query)
                samples = [r[column_name] for r in res]

                count_query = f"""
                    SELECT COUNT(*) as count
                    FROM {table_expr} 
                    WHERE "{column_name}" IS NOT NULL 
                    AND NOT regexp_matches("{column_name}", '{pattern}')
                """
                count_res = QueryEngine.execute_internal_query(count_query)
                invalid_count = count_res[0]["count"] if count_res else 0

        except Exception as e:
            logger.exception("DuckDB invalid value detection failed: %s", str(e))

        return invalid_count, [
            str(s) for s in samples[:5]
        ]  # Ensure validation samples are strings

    @staticmethod
    def _make_json_serializable(obj: Any) -> Any:
        import datetime
        import decimal
        import math

        try:
            import pandas as pd
            import numpy as np
        except ImportError:
            pd = None
            np = None

        if obj is None:
            return None

        try:
            if pd.isna(obj):
                return None
        except Exception:
            pass

        # Handle Python float & Numpy float
        if isinstance(obj, (float, np.floating)):
            if math.isnan(obj) or math.isinf(obj):
                return None
            return float(obj)

        # Handle Numpy integer
        if isinstance(obj, np.integer):
            return int(obj)

        # Handle Numpy bool
        if isinstance(obj, np.bool_):
            return bool(obj)

        # Handle Pandas/Numpy timestamps and dates
        if isinstance(
            obj, (pd.Timestamp, datetime.date, datetime.datetime, np.datetime64)
        ):
            return str(obj)

        # Handle arrays/lists/tuples
        if isinstance(obj, (np.ndarray, list, tuple, pd.Series, pd.Index)):
            return [AnalyticsService._make_json_serializable(x) for x in obj]

        # Handle dicts
        if isinstance(obj, dict):
            return {
                k: AnalyticsService._make_json_serializable(v) for k, v in obj.items()
            }

        # Handle Decimal
        if isinstance(obj, decimal.Decimal):
            val = float(obj)
            if math.isnan(val) or math.isinf(val):
                return None
            return val

        return obj

    @staticmethod
    def _calculate_data_health(
        column_analytics: Dict[str, Any], total_rows: int
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive data health scores (Completeness, Validity, Consistency).
        Returns overall score, metrics, and plain language issues.
        """
        if total_rows == 0:
            return {
                "score": 0.0,
                "status": "POOR",
                "issues": ["Dataset is empty"],
                "metrics": {"completeness": 0, "validity": 0, "consistency": 0},
            }

        total_cells = total_rows * len(column_analytics)
        total_nulls = 0
        total_invalid = 0
        mixed_type_columns = 0

        issues = []

        for col, data in column_analytics.items():
            stats = data.get("statistics", {})
            null_count = stats.get("null_count", 0)
            if null_count == 0 and "null_percentage" in stats and total_rows > 0:
                null_count = int((stats["null_percentage"] / 100) * total_rows)

            total_nulls += null_count

            null_percentage = stats.get("null_percentage", 0)
            if null_percentage > 20:
                issues.append(
                    {
                        "key": "bi.datasets.detail.tabs.quality.issues.dynamic.high_nulls",
                        "params": {"column": col, "pct": f"{null_percentage:.1f}"},
                    }
                )

            if data.get("is_mixed_type"):
                mixed_type_columns += 1
                issues.append(
                    {
                        "key": "bi.datasets.detail.tabs.quality.issues.dynamic.mixed_types",
                        "params": {"column": col},
                    }
                )

            invalid_count = data.get("invalid_count", 0)
            total_invalid += invalid_count
            if invalid_count > 0:
                issues.append(
                    {
                        "key": "bi.datasets.detail.tabs.quality.issues.dynamic.outliers",
                        "params": {"column": col, "count": invalid_count},
                    }
                )

        # Calculations
        completeness_score = 100.0
        if total_cells > 0:
            completeness_score = ((total_cells - total_nulls) / total_cells) * 100

        validity_score = 100.0
        if total_cells > 0:
            validity_score = ((total_cells - total_invalid) / total_cells) * 100

        consistency_score = 100.0
        if len(column_analytics) > 0:
            consistency_score = max(0, 100 - (mixed_type_columns * 20))

        quality_score = (
            (completeness_score * 0.4)
            + (validity_score * 0.4)
            + (consistency_score * 0.2)
        )

        status = (
            "EXCELLENT"
            if quality_score >= 90
            else "GOOD"
            if quality_score >= 70
            else "AVERAGE"
            if quality_score >= 50
            else "POOR"
        )

        return {
            "quality_score": quality_score,
            "completeness": completeness_score,
            "validity": validity_score,
            "consistency": consistency_score,
            "status": status,
            "issues": issues,  # List of structured issues
            "total_nulls": total_nulls,
            "total_invalid": total_invalid,
        }

    @classmethod
    def perform_analytics(
        cls,
        records: List[Dict[str, Any]],  # Kept for backwards compatibility, but unused
        columns: List[str],
        preprocessing_result: Optional[Dict[str, Any]] = None,
        file_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Perform comprehensive analytics on dataset using DuckDB for file-based processing.

        This method uses DuckDB exclusively for all analytics to handle large files efficiently.
        The 'records' parameter is kept for API compatibility but is not used.
        """
        from app.services.bi_services.query_engine import QueryEngine

        # Validate we have a file to analyze
        if not file_path:
            return {
                "internal_technical": {"record_count": 0, "column_count": 0},
                "business_insights": [],
                "executive_summary": "No file path provided for analysis.",
                "column_analytics": {},
            }

        try:
            # Step 1: Get schema from file
            schema = QueryEngine.get_dataset_schema(file_path)
            if not schema:
                return {
                    "internal_technical": {"record_count": 0, "column_count": 0},
                    "business_insights": [],
                    "executive_summary": "Could not read schema from file.",
                    "column_analytics": {},
                }

            # Build column list and type map
            columns = [col["name"] for col in schema]
            type_map = {}
            for col in schema:
                duckdb_type = col["type"].upper()
                if any(
                    t in duckdb_type
                    for t in [
                        "INT",
                        "DOUBLE",
                        "FLOAT",
                        "DECIMAL",
                        "NUMERIC",
                        "BIGINT",
                        "SMALLINT",
                        "REAL",
                    ]
                ):
                    type_map[col["name"]] = "numeric"
                elif "BOOL" in duckdb_type:
                    type_map[col["name"]] = "boolean"
                elif any(t in duckdb_type for t in ["DATE", "TIME", "TIMESTAMP"]):
                    type_map[col["name"]] = "date"
                else:
                    type_map[col["name"]] = "text"

            # Step 2: Get record count
            table_expr = QueryEngine._get_table_expr(file_path)
            count_result = QueryEngine.execute_internal_query(
                f"SELECT COUNT(*) as count FROM {table_expr}"
            )
            record_count = count_result[0]["count"] if count_result else 0

            # Step 3: Analyze each column
            column_analytics = {}
            numeric_columns = []
            categorical_columns = []
            date_columns = []

            for col_name in columns:
                col_type = type_map.get(col_name, "text")
                stats = {}
                semantic_type = None
                is_mixed = False

                # Detect mixed types (only for text columns normally, but DuckDB types can be lenient)
                if col_type == "text":
                    is_mixed = cls._detect_mixed_types_duckdb(file_path, col_name)

                table_expr = QueryEngine._get_table_expr(file_path)
                # Fetch sample of non-null distinct values for semantic analysis
                try:
                    sample_query = f"""
                        SELECT DISTINCT "{col_name}" 
                        FROM {table_expr}
                        WHERE "{col_name}" IS NOT NULL 
                        LIMIT 100
                    """
                    sample_res = QueryEngine.execute_internal_query(sample_query)
                    sample_values = [row[col_name] for row in sample_res]
                    semantic_type = cls._generate_semantic_hints(
                        sample_values, column_name=col_name
                    )
                except Exception:
                    semantic_type = cls._generate_semantic_hints(
                        [], column_name=col_name
                    )

                if col_type == "numeric":
                    # Numeric statistics via DuckDB
                    stats = cls._analyze_numeric_column_duckdb(
                        file_path, col_name, record_count
                    )
                    numeric_columns.append(col_name)

                    # Check if it might be ID (all unique integers)
                    if (
                        semantic_type is None
                        and stats.get("unique_count") == stats.get("count")
                        and "INT" in schema[columns.index(col_name)]["type"].upper()
                    ):
                        semantic_type = "identifier"

                elif col_type == "date":
                    # Date statistics
                    stats = cls._analyze_date_column_duckdb(
                        file_path, col_name, record_count
                    )
                    date_columns.append(col_name)
                    if semantic_type is None:
                        semantic_type = "datetime"
                else:
                    # Categorical/Text statistics
                    stats = cls._analyze_categorical_column_duckdb(
                        file_path, col_name, record_count
                    )
                    if stats.get("unique_count", 0) < record_count * 0.5:
                        col_type = "categorical"
                        categorical_columns.append(col_name)

                # Check for ID heuristics in text columns
                if (
                    col_type in ["text", "categorical"]
                    and stats.get("unique_count", 0) == stats.get("count", 0)
                    and record_count > 0
                ):
                    if (
                        semantic_type is None
                    ):  # Don't override strict semantic types like email
                        semantic_type = "identifier"

                # Detect invalid values
                invalid_count, invalid_samples = cls._detect_invalid_values_duckdb(
                    file_path, col_name, col_type, semantic_type
                )

                column_analytics[col_name] = {
                    "column_name": col_name,
                    "column_type": col_type,
                    "semantic_type": semantic_type,
                    "is_mixed_type": is_mixed,
                    "statistics": stats,
                    "invalid_count": invalid_count,
                    "invalid_samples": invalid_samples,
                }

            # Step 4: Data Health Scoring
            health_assessment = cls._calculate_data_health(
                column_analytics, record_count
            )

            # Step 5: Calculate deep analytics (distributions & correlations)
            distributions = cls._calculate_distributions_duckdb(
                file_path, column_analytics
            )
            correlations = cls._calculate_correlations_duckdb(
                file_path, numeric_columns
            )

            # Step 6: Generate final insights including correlations
            business_insights = cls._generate_business_insights(
                column_analytics, correlations, record_count
            )
            health_assessment = cls._calculate_data_health(
                column_analytics, record_count
            )

            # Add health warning if score is low
            if health_assessment["status"] != "EXCELLENT":
                business_insights.append(
                    {
                        "title": "Data Health Alert",
                        "description": f"Dataset health is {health_assessment['status']}. Score: {health_assessment['quality_score']:.1f}/100. Issues found: {len(health_assessment['issues'])}",
                        "type": "quality",
                        "importance": "HIGH",
                    }
                )

            # Step 7: Prepare result
            internal_technical = {
                "record_count": record_count,
                "column_count": len(columns),
                "numeric_columns": numeric_columns,
                "categorical_columns": categorical_columns,
                "date_columns": date_columns,
                "column_analytics": column_analytics,
                "distributions": distributions,
                "correlations": correlations,
                "trend_analysis": {},
                "data_quality_indicators": {
                    "completeness": round(health_assessment["completeness"], 1),
                    "validity": round(health_assessment["validity"], 1),
                    "consistency": round(health_assessment["consistency"], 1),
                    "quality_score": round(health_assessment["quality_score"], 1),
                    "status": health_assessment["status"],
                    "issues": health_assessment["issues"],
                },
            }

            result = {
                "internal_technical": internal_technical,
                "business_insights": business_insights,
                "executive_summary": cls._generate_executive_summary(
                    business_insights, {}
                ),
                "column_analytics": column_analytics,
                "distributions": distributions,
                "correlations": correlations,
                "insight_count": len(business_insights),
                "record_count": record_count,
                "column_count": len(columns),
            }

            return cls._make_json_serializable(result)

        except Exception as e:
            logger.exception("Full analytics failed: %s", str(e))
            error_result = {
                "executive_summary": f"Analysis partially failed: {str(e)}",
                "business_insights": [],
                "insight_count": 0,
                "record_count": 0,
                "column_count": 0,
                "column_analytics": {},
                "internal_technical": {
                    "record_count": 0,
                    "column_count": 0,
                    "error": str(e),
                    "data_quality_indicators": {
                        "completeness": 0,
                        "validity": 0,
                        "consistency": 0,
                        "quality_score": 0,
                        "status": "POOR",
                        "issues": [f"Analysis error: {str(e)}"],
                    },
                },
                "distributions": {},
                "correlations": [],
            }
            return cls._make_json_serializable(error_result)

    @classmethod
    def _analyze_numeric_column_duckdb(
        cls, file_path: str, column_name: str, total_rows: int
    ) -> Dict[str, Any]:
        """Analyze numeric column using DuckDB aggregations."""
        from app.services.bi_services.query_engine import QueryEngine

        try:
            table_expr = QueryEngine._get_table_expr(file_path)
            query = f"""
                SELECT 
                    COUNT("{column_name}") as count,
                    COUNT(*) - COUNT("{column_name}") as null_count,
                    AVG("{column_name}") as mean,
                    MEDIAN("{column_name}") as median,
                    MIN("{column_name}") as min,
                    MAX("{column_name}") as max,
                    STDDEV("{column_name}") as std_dev,
                    SUM("{column_name}") as sum,
                    approx_count_distinct("{column_name}") as unique_count
                FROM {table_expr}
            """
            result = QueryEngine.execute_internal_query(query)
            if result:
                row = result[0]
                null_count = row.get("null_count", 0)
                base_stats = {
                    "count": row.get("count", 0),
                    "null_count": null_count,
                    "null_percentage": (null_count / total_rows * 100)
                    if total_rows > 0
                    else 0,
                    "mean": row.get("mean"),
                    "median": row.get("median"),
                    "min": row.get("min"),
                    "max": row.get("max"),
                    "std_dev": row.get("std_dev"),
                    "sum": row.get("sum"),
                    "unique_count": row.get("unique_count", 0),
                    "outlier_count": 0,  # To be filled below
                    "outlier_percentage": 0.0,
                    "sample_outliers": [],
                }

                # Detect outliers using Z-score > 3
                if (
                    base_stats["count"] > 2
                    and base_stats["std_dev"]
                    and base_stats["std_dev"] > 0
                ):
                    try:
                        outlier_query = f"""
                            WITH stats AS (
                                SELECT 
                                    AVG("{column_name}") as mean,
                                    STDDEV("{column_name}") as stddev
                                FROM {table_expr}
                            )
                            SELECT 
                                "{column_name}" as value
                            FROM {table_expr}, stats
                            WHERE ABS(("{column_name}" - stats.mean) / stats.stddev) > 3
                            LIMIT 10
                        """
                        outlier_samples = QueryEngine.execute_internal_query(
                            outlier_query
                        )
                        outlier_count_query = f"""
                            WITH stats AS (
                                SELECT 
                                    AVG("{column_name}") as mean,
                                    STDDEV("{column_name}") as stddev
                                FROM {table_expr}
                            )
                            SELECT COUNT(*) as count
                            FROM {table_expr}, stats
                            WHERE ABS(("{column_name}" - stats.mean) / stats.stddev) > 3
                        """
                        outlier_count_res = QueryEngine.execute_internal_query(
                            outlier_count_query
                        )

                        base_stats["outlier_count"] = (
                            outlier_count_res[0]["count"] if outlier_count_res else 0
                        )
                        base_stats["outlier_percentage"] = (
                            base_stats["outlier_count"] / base_stats["count"] * 100
                        )
                        base_stats["sample_outliers"] = [
                            r["value"] for r in outlier_samples
                        ]
                    except Exception as e:
                        logger.exception("Outlier detection failed: %s", str(e))

                return base_stats
        except Exception as e:
            logger.exception("Numeric column DuckDB analysis failed: %s", str(e))

        return {"count": 0, "null_count": 0, "null_percentage": 0, "outlier_count": 0}

    @classmethod
    def _analyze_categorical_column_duckdb(
        cls, file_path: str, column_name: str, total_rows: int
    ) -> Dict[str, Any]:
        """Analyze categorical column using DuckDB."""
        from app.services.bi_services.query_engine import QueryEngine

        try:
            table_expr = QueryEngine._get_table_expr(file_path)
            # Get unique count and top values
            query = f"""
                SELECT 
                    COUNT(DISTINCT "{column_name}") as unique_count,
                    COUNT(*) - COUNT("{column_name}") as null_count
                FROM {table_expr}
            """
            result = QueryEngine.execute_internal_query(query)
            unique_count = result[0]["unique_count"] if result else 0
            null_count = result[0]["null_count"] if result else 0

            # Get top 5 values with counts
            top_query = f"""
                SELECT "{column_name}" as value, COUNT(*) as count
                FROM {table_expr}
                WHERE "{column_name}" IS NOT NULL
                GROUP BY "{column_name}"
                ORDER BY count DESC
                LIMIT 5
            """
            top_result = QueryEngine.execute_internal_query(top_query)

            # Calculate percentage for each top category
            non_null_count = (
                total_rows - null_count if total_rows > null_count else total_rows
            )
            top_categories = []
            if top_result:
                for r in top_result:
                    count = r["count"]
                    percentage = (
                        (count / non_null_count * 100) if non_null_count > 0 else 0
                    )
                    top_categories.append(
                        {
                            "value": str(r["value"]),
                            "count": count,
                            "percentage": round(percentage, 1),
                        }
                    )

            return {
                "unique_count": unique_count,
                "null_count": null_count,
                "null_percentage": (null_count / total_rows * 100)
                if total_rows > 0
                else 0,
                "top_categories": top_categories,
            }
        except Exception as e:
            logger.exception("Categorical column DuckDB analysis failed: %s", str(e))

        return {
            "unique_count": 0,
            "null_count": 0,
            "null_percentage": 0,
            "top_categories": [],
        }

    @classmethod
    def _analyze_date_column_duckdb(
        cls, file_path: str, column_name: str, total_rows: int
    ) -> Dict[str, Any]:
        """Analyze date column using DuckDB."""
        from app.services.bi_services.query_engine import QueryEngine

        try:
            table_expr = QueryEngine._get_table_expr(file_path)
            query = f"""
                SELECT 
                    COUNT("{column_name}") as count,
                    COUNT(*) - COUNT("{column_name}") as null_count,
                    MIN("{column_name}") as min_date,
                    MAX("{column_name}") as max_date
                FROM {table_expr}
            """
            result = QueryEngine.execute_internal_query(query)
            if result:
                row = result[0]
                null_count = row.get("null_count", 0)
                return {
                    "count": row.get("count", 0),
                    "null_count": null_count,
                    "null_percentage": (null_count / total_rows * 100)
                    if total_rows > 0
                    else 0,
                    "min_date": str(row.get("min_date"))
                    if row.get("min_date")
                    else None,
                    "max_date": str(row.get("max_date"))
                    if row.get("max_date")
                    else None,
                }
        except Exception as e:
            logger.exception("Date column DuckDB analysis failed: %s", str(e))

        return {"count": 0, "null_count": 0, "null_percentage": 0}

    @classmethod
    def _calculate_completeness_duckdb(
        cls, file_path: str, columns: List[str], total_rows: int
    ) -> float:
        """Calculate overall data completeness using DuckDB."""
        from app.services.bi_services.query_engine import QueryEngine

        if not columns or total_rows == 0:
            return 0.0

        try:
            table_expr = QueryEngine._get_table_expr(file_path)
            # Count non-null values across all columns
            count_expressions = [f'COUNT("{col}")' for col in columns]
            query = f"SELECT {', '.join(count_expressions)} FROM {table_expr}"
            result = QueryEngine.execute_internal_query(query)

            if result:
                row = result[0]
                total_non_null = sum(row.values())
                total_cells = total_rows * len(columns)
                return (
                    round((total_non_null / total_cells) * 100, 2)
                    if total_cells > 0
                    else 0.0
                )
        except Exception as e:
            logger.exception("Completeness DuckDB calculation failed: %s", str(e))

        return 0.0

    @classmethod
    def _generate_business_insights(
        cls,
        column_analytics: Dict[str, Any],
        correlations: List[Dict[str, Any]],
        record_count: int,
    ) -> List[Dict[str, Any]]:
        """Generate greedy business insights to be as detailed as possible."""
        insights = []

        # 1. Column-by-Column Data Quality & Stats (The "Greedy" part)
        for col, analytics in column_analytics.items():
            stats = analytics.get("statistics", {})
            col_type = analytics.get("column_type")

            # --- Completeness Insights ---
            null_pct = stats.get("null_percentage", 0)
            if null_pct == 0:
                insights.append(
                    {
                        "title": "bi.datasets.detail.tabs.analytics.insights.high_completeness.title",
                        "description": "bi.datasets.detail.tabs.analytics.insights.high_completeness.description",
                        "params": {"column": col, "pct": "100"},
                        "type": "success",
                        "importance": "LOW",
                    }
                )
            elif null_pct > 10:
                insights.append(
                    {
                        "title": "bi.datasets.detail.tabs.analytics.insights.low_completeness.title",
                        "description": "bi.datasets.detail.tabs.analytics.insights.low_completeness.description",
                        "params": {"column": col, "pct": f"{null_pct:.1f}"},
                        "type": "warning",
                        "importance": "MEDIUM",
                    }
                )

            # --- Cardinality / Diversity ---
            unique = stats.get("unique_count", 0)
            if unique == 1 and record_count > 1:
                insights.append(
                    {
                        "title": "bi.datasets.detail.tabs.analytics.insights.constant_column.title",
                        "description": "bi.datasets.detail.tabs.analytics.insights.constant_column.description",
                        "params": {"column": col},
                        "type": "info",
                        "importance": "LOW",
                    }
                )
            elif unique > 0 and record_count > 0:
                cardinality_ratio = unique / record_count
                if cardinality_ratio > 0.9 and col_type != "numeric":
                    insights.append(
                        {
                            "title": "bi.datasets.detail.tabs.analytics.insights.high_cardinality.title",
                            "description": "bi.datasets.detail.tabs.analytics.insights.high_cardinality.description",
                            "params": {"column": col, "count": unique},
                            "type": "info",
                            "importance": "LOW",
                        }
                    )

            # --- Type Specific Insights ---
            if col_type == "numeric":
                # Range Insight
                if stats.get("min") is not None and stats.get("max") is not None:
                    insights.append(
                        {
                            "title": "bi.datasets.detail.tabs.analytics.insights.data_range.title",
                            "description": "bi.datasets.detail.tabs.analytics.insights.data_range.description",
                            "params": {
                                "column": col,
                                "min": f"{stats['min']:.2f}",
                                "max": f"{stats['max']:.2f}",
                            },
                            "type": "info",
                            "importance": "LOW",
                        }
                    )

                # Outliers
                if stats.get("outlier_count", 0) > 0:
                    pct = stats.get("outlier_percentage", 0)
                    insights.append(
                        {
                            "title": "bi.datasets.detail.tabs.analytics.insights.outliers.title",
                            "description": "bi.datasets.detail.tabs.analytics.insights.outliers.description",
                            "params": {
                                "column": col,
                                "pct": f"{pct:.1f}",
                                "count": stats["outlier_count"],
                            },
                            "type": "warning",
                            "importance": pct > 5 and "HIGH" or "MEDIUM",
                        }
                    )

            elif col_type == "categorical":
                top_cats = stats.get("top_categories", [])
                if top_cats:
                    top = top_cats[0]
                    if top["percentage"] > 30:  # Lowered from 50
                        insights.append(
                            {
                                "title": "bi.datasets.detail.tabs.analytics.insights.dominant_category.title",
                                "description": "bi.datasets.detail.tabs.analytics.insights.dominant_category.description",
                                "params": {
                                    "value": str(top["value"]),
                                    "pct": f"{top['percentage']:.1f}",
                                    "column": col,
                                },
                                "type": "dominance",
                                "importance": "MEDIUM",
                            }
                        )

        # Insight: Outliers
        for col, analytics in column_analytics.items():
            if analytics["column_type"] == "numeric":
                stats = analytics.get("statistics", {})
                if stats.get("outlier_count", 0) > 0:
                    pct = stats.get("outlier_percentage", 0)
                    if pct > 5:
                        insights.append(
                            {
                                "title": "bi.datasets.detail.tabs.analytics.insights.outliers.title",
                                "description": "bi.datasets.detail.tabs.analytics.insights.outliers.description",
                                "params": {
                                    "column": col,
                                    "pct": f"{pct:.1f}",
                                    "count": stats["outlier_count"],
                                },
                                "type": "warning",
                                "importance": "HIGH",
                            }
                        )

        return insights

    @classmethod
    def _generate_executive_summary(
        cls, business_insights: List[Dict[str, Any]], trends: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate a structured executive summary."""
        high_count = sum(1 for i in business_insights if i.get("importance") == "HIGH")
        total = len(business_insights)

        return {
            "key": "bi.datasets.detail.tabs.analytics.executiveSummaryDetail.template",
            "params": {"total": total, "high": high_count},
        }

    @classmethod
    def _calculate_distributions_duckdb(
        cls, file_path: str, column_analytics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate histograms and frequency distributions using DuckDB."""
        from app.services.bi_services.query_engine import QueryEngine

        distributions = {}
        table_expr = QueryEngine._get_table_expr(file_path)

        for col_name, col_meta in column_analytics.items():
            col_type = col_meta.get("column_type", "text")
            try:
                if col_type == "numeric":
                    stats = col_meta.get("statistics", {})
                    min_val = stats.get("min")
                    max_val = stats.get("max")
                    count = stats.get("count", 0)

                    if (
                        min_val is not None
                        and max_val is not None
                        and max_val > min_val
                        and count > 0
                    ):
                        bin_count = 10
                        width = (max_val - min_val) / bin_count
                        if width <= 0:
                            width = 1

                        sql = f"""
                            SELECT 
                                floor(("{col_name}" - {min_val}) / {width}) as bin,
                                count(*) as count
                            FROM {table_expr}
                            WHERE "{col_name}" IS NOT NULL
                            GROUP BY bin
                            ORDER BY bin
                         """
                        res = QueryEngine.execute_internal_query(sql)

                        dist_data = []
                        for r in res:
                            if r["bin"] is None:
                                continue
                            b = int(r["bin"])
                            if b >= bin_count:
                                b = bin_count - 1
                            start = min_val + b * width
                            end = start + width
                            dist_data.append(
                                {
                                    "bin": b,
                                    "label": f"{start:,.1f} - {end:,.1f}",
                                    "count": r["count"],
                                }
                            )
                        distributions[col_name] = dist_data
                elif col_type in ["categorical", "text"]:
                    sql = f"""
                        SELECT "{col_name}" as label, count(*) as count
                        FROM {table_expr}
                        WHERE "{col_name}" IS NOT NULL
                        GROUP BY label
                        ORDER BY count DESC
                        LIMIT 10
                    """
                    res = QueryEngine.execute_internal_query(sql)
                    distributions[col_name] = [
                        {"label": str(r["label"]), "count": r["count"]} for r in res
                    ]
            except Exception as e:
                logger.exception(
                    "Distribution calculation failed for column: %s", str(e)
                )

        return distributions

    @classmethod
    def _calculate_correlations_duckdb(
        cls, file_path: str, numeric_columns: List[str]
    ) -> List[Dict[str, Any]]:
        """Calculate Pearson correlation matrix."""
        from app.services.bi_services.query_engine import QueryEngine

        if len(numeric_columns) < 2:
            return []

        table_expr = QueryEngine._get_table_expr(file_path)
        correlations = []
        cols_to_check = numeric_columns[:15]  # limit to 15 columns

        for i in range(len(cols_to_check)):
            for j in range(i + 1, len(cols_to_check)):
                c1 = cols_to_check[i]
                c2 = cols_to_check[j]
                try:
                    c1_cast = f'TRY_CAST("{c1}" AS DOUBLE)'
                    c2_cast = f'TRY_CAST("{c2}" AS DOUBLE)'
                    sql = f"SELECT corr({c1_cast}, {c2_cast}) as correlation FROM {table_expr}"
                    res = QueryEngine.execute_internal_query(sql)
                    val = res[0]["correlation"]
                    import math

                    if val is not None and not (
                        isinstance(val, float) and (math.isnan(val) or math.isinf(val))
                    ):
                        correlations.append(
                            {
                                "column1": c1,
                                "column2": c2,
                                "value": round(float(val), 4),
                            }
                        )
                except Exception as e:
                    logger.exception(
                        "Correlation calculation failed for %s vs %s: %s",
                        c1,
                        c2,
                        str(e),
                    )
                    continue

        correlations.sort(key=lambda x: abs(x["value"]), reverse=True)
        return correlations
