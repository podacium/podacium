"""
services/api/app/agent/router/self_healer.py
Self-Healing Heuristic & AST Argument Corrector for Sub-200ms In-Memory Repair.
Eliminates costly LLM round-trips by automatically repairing malformed parameters,
type coercion discrepancies, and Algerian domain formats before execution.
"""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple, Type
from pydantic import BaseModel, ValidationError

logger = logging.getLogger("podacium.agent.self_healer")

# Algerian 58 Wilaya normalization dictionary (Name -> Code)
ALGERIAN_WILAYAS: Dict[str, int] = {
    "adrar": 1,
    "chlef": 2,
    "laghouat": 3,
    "oum el bouaghi": 4,
    "batna": 5,
    "bejaia": 6,
    "biskra": 7,
    "bechar": 8,
    "blida": 9,
    "bouira": 10,
    "tamanrasset": 11,
    "tebessa": 12,
    "tlemcen": 13,
    "tiaret": 14,
    "tizi ouzou": 15,
    "alger": 16,
    "algiers": 16,
    "الجزائر": 16,
    "djelfa": 17,
    "djidjelli": 18,
    "jijel": 18,
    "setif": 19,
    "saida": 20,
    "skikda": 21,
    "sidi bel abbes": 22,
    "annaba": 23,
    "guelma": 24,
    "constantine": 25,
    "قسنطينة": 25,
    "medea": 26,
    "mostaganem": 27,
    "m'sila": 28,
    "msila": 28,
    "mascara": 29,
    "ouargla": 30,
    "oran": 31,
    "وهران": 31,
    "el bayadh": 32,
    "illizi": 33,
    "bordj bou arreridj": 34,
    "boumerdes": 35,
    "el tarf": 36,
    "tindouf": 37,
    "tissemsilt": 38,
    "el oued": 39,
    "khenchela": 40,
    "souk ahras": 41,
    "tipaza": 42,
    "mila": 43,
    "ain defla": 44,
    "naama": 45,
    "ain temouchent": 46,
    "ghardaia": 47,
    "relizane": 48,
    "el m'ghair": 49,
    "el menia": 50,
    "ouled djellal": 51,
    "bordj badji mokhtar": 52,
    "beni abbes": 53,
    "timimoun": 54,
    "touggourt": 55,
    "djanet": 56,
    "in salah": 57,
    "in guezzam": 58,
}


class ToolSelfHealer:
    """
    Sub-millisecond heuristic repair engine that automatically heals schema mismatches,
    parses stringified JSON, sanitizes Algerian postal/banking strings, and dry-runs
    Pydantic schemas prior to actual execution.
    """

    @classmethod
    def clean_dzd_amount(cls, val: Any) -> Optional[int]:
        """Cleans currency strings like '250 000 DZD', '45,000 DA' into pure integer."""
        if isinstance(val, (int, float)):
            return int(val)
        if isinstance(val, str):
            cleaned = re.sub(r"(?i)[^\d.-]", "", val)
            try:
                return int(float(cleaned))
            except (ValueError, TypeError):
                return None
        return None

    @classmethod
    def normalize_wilaya(cls, val: Any) -> Optional[int]:
        """Normalizes wilaya names or numbers into canonical 1-58 integer code."""
        if isinstance(val, int) and 1 <= val <= 58:
            return val
        if isinstance(val, str):
            val_clean = val.strip().lower()
            if val_clean.isdigit():
                code = int(val_clean)
                return code if 1 <= code <= 58 else None
            return ALGERIAN_WILAYAS.get(val_clean)
        return None

    @classmethod
    def auto_repair_args(
        cls,
        args_schema: Type[BaseModel],
        raw_args: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], bool, List[str]]:
        """
        Attempts to heal raw tool arguments to conform to the target Pydantic schema.
        Returns: (repaired_args, was_repaired, list_of_repairs)
        """
        repaired = dict(raw_args)
        repairs: List[str] = []

        # 1. First test: if already valid, return immediately
        try:
            clean = {k: v for k, v in repaired.items() if not k.startswith("__")}
            args_schema.model_validate(clean)
            return repaired, False, []
        except ValidationError:
            pass

        schema_fields = args_schema.model_fields

        for field_name, field_info in schema_fields.items():
            if field_name not in repaired and not field_info.is_required():
                continue

            current_val = repaired.get(field_name)
            annotation = field_info.annotation

            # Rule A: String to integer/float coercion
            if current_val is not None:
                if annotation in (int, Optional[int]):
                    if isinstance(current_val, str):
                        # Try DZD amount or general integer cleaning
                        as_int = cls.clean_dzd_amount(current_val)
                        if as_int is not None and as_int != current_val:
                            repaired[field_name] = as_int
                            repairs.append(
                                f"Coerced '{field_name}' from string '{current_val}' to int {as_int}"
                            )

                elif annotation in (float, Optional[float]):
                    if isinstance(current_val, str):
                        cleaned = re.sub(r"[^\d.-]", "", current_val)
                        try:
                            repaired[field_name] = float(cleaned)
                            repairs.append(
                                f"Coerced '{field_name}' to float {repaired[field_name]}"
                            )
                        except ValueError:
                            pass

                # Rule B: String to boolean
                elif annotation in (bool, Optional[bool]):
                    if isinstance(current_val, str):
                        lower = current_val.strip().lower()
                        if lower in ("true", "1", "yes", "oui", "sah"):
                            repaired[field_name] = True
                            repairs.append(f"Coerced '{field_name}' to boolean True")
                        elif lower in ("false", "0", "no", "non", "la"):
                            repaired[field_name] = False
                            repairs.append(f"Coerced '{field_name}' to boolean False")

                # Rule C: Comma-separated string to List
                elif getattr(annotation, "__origin__", None) in (list, List):
                    if isinstance(current_val, str):
                        items = [x.strip() for x in current_val.split(",") if x.strip()]
                        repaired[field_name] = items
                        repairs.append(
                            f"Split comma-separated string in '{field_name}' into list of {len(items)} items"
                        )

                # Rule D: SQL query cleaning (strip trailing semicolons, backticks, formatting tags)
                if field_name in ("sql_query", "query", "sql") and isinstance(
                    current_val, str
                ):
                    clean_sql = re.sub(
                        r"^```(?:sql)?\s*", "", current_val.strip(), flags=re.IGNORECASE
                    )
                    clean_sql = re.sub(r"\s*```$", "", clean_sql).strip()
                    if clean_sql != current_val:
                        repaired[field_name] = clean_sql
                        repairs.append(f"Stripped markdown fences from '{field_name}'")

                # Rule E: Wilaya normalization
                if field_name in ("wilaya", "wilaya_code", "wilaya_id"):
                    norm_code = cls.normalize_wilaya(current_val)
                    if norm_code is not None and norm_code != current_val:
                        repaired[field_name] = norm_code
                        repairs.append(
                            f"Normalized Wilaya '{current_val}' to code {norm_code}"
                        )

                # Rule F: Strip whitespace and formatting from Postal RIP / Bank accounts
                if field_name in ("rip_number", "rip", "account_number") and isinstance(
                    current_val, str
                ):
                    clean_rip = re.sub(r"\D", "", current_val)
                    if clean_rip != current_val:
                        repaired[field_name] = clean_rip
                        repairs.append(f"Sanitized RIP digits in '{field_name}'")

        # 2. Re-verify after heuristic repairs
        try:
            clean = {k: v for k, v in repaired.items() if not k.startswith("__")}
            args_schema.model_validate(clean)
            logger.info(f"Self-healer successfully repaired parameters: {repairs}")
            return repaired, True, repairs
        except ValidationError:
            # Return partial repairs even if still imperfect
            return repaired, bool(repairs), repairs

    @classmethod
    def dry_run_sandbox(
        cls,
        tool_name: str,
        args_schema: Type[BaseModel],
        raw_args: Dict[str, Any],
    ) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Executes an in-memory sandbox dry run.
        Returns: (is_valid, error_reason_if_any, healed_arguments)
        """
        healed_args, was_repaired, repairs = cls.auto_repair_args(args_schema, raw_args)
        try:
            clean = {k: v for k, v in healed_args.items() if not k.startswith("__")}
            args_schema.model_validate(clean)
            return True, None, healed_args
        except ValidationError as e:
            err_msg = "; ".join([f"{err['loc']}: {err['msg']}" for err in e.errors()])
            return (
                False,
                f"Sandbox validation failure for {tool_name}: {err_msg}",
                healed_args,
            )
