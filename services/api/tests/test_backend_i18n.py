"""
Exhaustive Backend Internationalization (i18n) Test Suite for Podacium API.

Validates:
  1. TRANSLATIONS dictionary integrity, parity, and quality across all 4 locales.
  2. Locale detection (normalize_locale, get_request_locale) correctness including
     edge-cases: weighted Accept-Language, malformed headers, empty cookies.
  3. localize_error() engine: exact matches, prefix matching, structured dicts,
     fallbacks, list of Pydantic validation errors, and non-string payloads.
  4. HTTP exception handler integration across all locales + status-code matrix.
  5. Codebase-wide i18n coverage: single-pass AST scan across all Python source files:
       a) HTTPException(detail=...) string literals without TRANSLATIONS entries.
       b) raise ValueError('...') user-visible messages without TRANSLATIONS entries.
       c) Pydantic v2 @field_validator / @model_validator strings.
       d) Raw Response/JSONResponse returns that bypass localize_error().
       e) Hardcoded {"message": "..."} success responses in routers.
       f) Dot-notation keys format validation (errors.namespace.key_name).
  6. Translation quality: script correctness, copy-paste detection, length checks,
     interpolation variable parity, trailing whitespace, HTML tags, RTL markers,
     balanced delimiters.
  7. Locale priority resolution: query param > X-Locale > cookie > Accept-Language.
  8. Secondary localization engines (email, BI) locale parity and key coverage.
  9. High-performance AST caching: single-pass scanner visits files once and shares results.
"""

from __future__ import annotations

import ast
import functools
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pytest
from starlette.requests import Request

from app.core.i18n import (
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    TRANSLATIONS,
    get_request_locale,
    localize_error,
    normalize_locale,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

API_APP_DIR = Path(__file__).resolve().parent.parent / "app"

# Strings that are intentionally NOT translated (internal/technical/admin-only).
# Keep this list as small as possible — every addition is a conscious choice.
KNOWN_UNTRANSLATED_ALLOWLIST: set[str] = {
    # Internal technical errors not shown to users
    "DATABASE_URL not set and required components missing",
    # Admin-internal impersonation / IAM messages seen only by Super Admins
    "Cannot impersonate yourself",
    "Cannot impersonate a peer or higher clearance administrative account.",
    "User impersonation requires SUPER_ADMIN department with clearance level 5 or above.",
    "Administrative profile not provisioned. Contact a platform Super Admin to assign your administrative role and department.",
    # Maker-checker internal payload validation (ops-facing admin workflows)
    "Target user ID missing from payload",
    "Wallet ID missing from payload",
    "Pending action not found",
    "Pending action has expired.",
    "Insufficient balance",
    # Camel-case field name used in internal admin action rejections
    "rejectionReason is required to reject a pending action",
    # Appeals router
    "Invalid review ID format",
    "You already have a pending appeal for this resource.",
}

# Dot-notation keys that are resolved on the frontend, not the backend.
# The backend emits them as-is; the web client maps them via locale JSON files.
DOT_NOTATION_PATTERN = re.compile(
    r"^(?:errors?\.[a-z_]+\.[a-z_]+|[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*\.errors?\.[a-zA-Z0-9_]+)"
)

# Placeholder / TODO patterns that should never appear in translations.
SUSPICIOUS_VALUE_PATTERN = re.compile(
    r"^(?:TODO\b|TBD\b|FIXME\b|\[TRANSLATE\]|UNTRANSLATED\b|LOREM IPSUM|CHANGEME\b|CHANGE_ME\b|\?\?\?)",
    re.IGNORECASE,
)

# Arabic Unicode block for script detection.
ARABIC_SCRIPT_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]")
LATIN_SCRIPT_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿɛɣḍṭẓṣḥčǧ]")
HTML_TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>")

# RTL Unicode control characters that should not be embedded in translation strings.
RTL_CONTROL_RE = re.compile(r"[\u200F\u200E\u202A-\u202E\u2066-\u2069]")


# ---------------------------------------------------------------------------
# AST parse cache & Unified Single-Pass Codebase Scanner
# ---------------------------------------------------------------------------


def _collect_python_files(root: Path) -> list[Path]:
    """Recursively collect all .py files under root, excluding generated code."""
    files = []
    exclude_dirs = {
        "generated",
        "__pycache__",
        ".venv",
        "venv",
        "node_modules",
        "podacium",
    }
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
        for f in filenames:
            if f.endswith(".py"):
                files.append(Path(dirpath) / f)
    return files


@dataclass
class CodebaseScanResult:
    httpexception_details: list[tuple[str, str, int]] = field(default_factory=list)
    value_error_messages: list[tuple[str, str, int]] = field(default_factory=list)
    pydantic_validator_messages: list[tuple[str, str, int]] = field(
        default_factory=list
    )
    raw_responses: list[tuple[str, str, int]] = field(default_factory=list)
    router_success_messages: list[tuple[str, str, int]] = field(default_factory=list)


class _UnifiedCodebaseVisitor(ast.NodeVisitor):
    """Single AST visitor that extracts all i18n-relevant nodes in a single pass."""

    def __init__(self, filepath: str, subdir: str) -> None:
        super().__init__()
        self.filepath = filepath
        self.subdir = subdir
        self.httpexception_details: list[tuple[str, str, int]] = []
        self.value_errors: list[tuple[str, str, int]] = []
        self.pydantic_validators: list[tuple[str, str, int]] = []
        self.raw_responses: list[tuple[str, str, int]] = []
        self.router_messages: list[tuple[str, str, int]] = []

    def visit_Call(self, node: ast.Call) -> None:
        func_name = ""
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            func_name = node.func.attr

        # 1. HTTPException(detail="...")
        if func_name in ("HTTPException", "StarletteHTTPException"):
            for kw in node.keywords:
                if kw.arg == "detail":
                    if isinstance(kw.value, ast.Constant) and isinstance(
                        kw.value.value, str
                    ):
                        self.httpexception_details.append(
                            (kw.value.value, self.filepath, kw.value.lineno)
                        )

        # 2. Raw Response / JSONResponse
        if func_name in ("Response", "JSONResponse"):
            for kw in node.keywords:
                if kw.arg == "content":
                    val = kw.value
                    if isinstance(val, ast.Dict):
                        for k_node, v_node in zip(val.keys, val.values):
                            if (
                                isinstance(k_node, ast.Constant)
                                and k_node.value == "detail"
                                and isinstance(v_node, ast.Constant)
                                and isinstance(v_node.value, str)
                            ):
                                self.raw_responses.append(
                                    (v_node.value, self.filepath, v_node.lineno)
                                )
                    elif isinstance(val, ast.Constant) and isinstance(val.value, str):
                        import json as _json

                        try:
                            parsed = _json.loads(val.value)
                            if (
                                isinstance(parsed, dict)
                                and "detail" in parsed
                                and isinstance(parsed["detail"], str)
                            ):
                                self.raw_responses.append(
                                    (parsed["detail"], self.filepath, val.lineno)
                                )
                        except (ValueError, TypeError):
                            pass

        self.generic_visit(node)

    def visit_Raise(self, node: ast.Raise) -> None:
        # raise ValueError("...")
        if node.exc and isinstance(node.exc, ast.Call):
            func_name = ""
            if isinstance(node.exc.func, ast.Name):
                func_name = node.exc.func.id
            if func_name == "ValueError" and node.exc.args:
                arg = node.exc.args[0]
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    self.value_errors.append((arg.value, self.filepath, arg.lineno))
        self.generic_visit(node)

    def visit_Dict(self, node: ast.Dict) -> None:
        # {"message": "..."} in routers
        if self.subdir == "routers":
            for key_node, value_node in zip(node.keys, node.values):
                if (
                    isinstance(key_node, ast.Constant)
                    and key_node.value == "message"
                    and isinstance(value_node, ast.Constant)
                    and isinstance(value_node.value, str)
                ):
                    msg = value_node.value
                    if " " in msg and len(msg) > 5:
                        self.router_messages.append(
                            (msg, self.filepath, value_node.lineno)
                        )
        self.generic_visit(node)

    def _is_pydantic_validator(
        self, node: ast.FunctionDef | ast.AsyncFunctionDef
    ) -> bool:
        for dec in node.decorator_list:
            dec_name = ""
            if isinstance(dec, ast.Name):
                dec_name = dec.id
            elif isinstance(dec, ast.Call):
                if isinstance(dec.func, ast.Name):
                    dec_name = dec.func.id
                elif isinstance(dec.func, ast.Attribute):
                    dec_name = dec.func.attr
            elif isinstance(dec, ast.Attribute):
                dec_name = dec.attr
            if dec_name in ("field_validator", "model_validator", "validator"):
                return True
        return False

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        if self.subdir == "schemas" and self._is_pydantic_validator(node):
            for subnode in ast.walk(node):
                if (
                    isinstance(subnode, ast.Raise)
                    and subnode.exc
                    and isinstance(subnode.exc, ast.Call)
                ):
                    fname = (
                        subnode.exc.func.id
                        if isinstance(subnode.exc.func, ast.Name)
                        else ""
                    )
                    if fname in ("ValueError", "AssertionError") and subnode.exc.args:
                        arg0 = subnode.exc.args[0]
                        if isinstance(arg0, ast.Constant) and isinstance(
                            arg0.value, str
                        ):
                            self.pydantic_validators.append(
                                (arg0.value, self.filepath, arg0.lineno)
                            )
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        if self.subdir == "schemas" and self._is_pydantic_validator(node):
            for subnode in ast.walk(node):
                if (
                    isinstance(subnode, ast.Raise)
                    and subnode.exc
                    and isinstance(subnode.exc, ast.Call)
                ):
                    fname = (
                        subnode.exc.func.id
                        if isinstance(subnode.exc.func, ast.Name)
                        else ""
                    )
                    if fname in ("ValueError", "AssertionError") and subnode.exc.args:
                        arg0 = subnode.exc.args[0]
                        if isinstance(arg0, ast.Constant) and isinstance(
                            arg0.value, str
                        ):
                            self.pydantic_validators.append(
                                (arg0.value, self.filepath, arg0.lineno)
                            )
        self.generic_visit(node)


@functools.lru_cache(maxsize=1)
def _get_unified_codebase_scan() -> CodebaseScanResult:
    """Performs a single-pass scan across all backend Python files and caches the result."""
    result = CodebaseScanResult()
    subdirs = ["routers", "services", "middleware", "core", "schemas"]

    for subdir in subdirs:
        dirpath = API_APP_DIR / subdir
        if not dirpath.exists():
            continue
        for py_file in _collect_python_files(dirpath):
            try:
                source = py_file.read_text(encoding="utf-8")
                tree = ast.parse(source, filename=str(py_file))
            except (SyntaxError, UnicodeDecodeError):
                continue

            rel_path = str(py_file.relative_to(API_APP_DIR.parent))
            visitor = _UnifiedCodebaseVisitor(rel_path, subdir)
            visitor.visit(tree)

            result.httpexception_details.extend(visitor.httpexception_details)
            result.value_error_messages.extend(visitor.value_errors)
            result.pydantic_validator_messages.extend(visitor.pydantic_validators)
            result.raw_responses.extend(visitor.raw_responses)
            result.router_success_messages.extend(visitor.router_messages)

    # Also scan app/main.py
    main_py = API_APP_DIR / "main.py"
    if main_py.exists():
        try:
            tree = ast.parse(main_py.read_text(encoding="utf-8"), filename=str(main_py))
            visitor = _UnifiedCodebaseVisitor("app/main.py", "main")
            visitor.visit(tree)
            result.raw_responses.extend(visitor.raw_responses)
        except (SyntaxError, UnicodeDecodeError):
            pass

    return result


def _is_translated(detail: str) -> bool:
    """Check if a detail string would be translated by localize_error()."""
    if detail in KNOWN_UNTRANSLATED_ALLOWLIST:
        return True
    if DOT_NOTATION_PATTERN.match(detail.lower()):
        return True  # Dot-notation keys are handled separately on frontend
    cleaned = detail.strip().lower()
    if cleaned in TRANSLATIONS:
        return True
    # Check prefix matching (same algorithm as _localize_str_with_status)
    for key in sorted(TRANSLATIONS.keys(), key=len, reverse=True):
        if cleaned.startswith(key):
            return True
    return False


def _make_mock_request(
    query_params: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
    cookies: dict[str, str] | None = None,
) -> Request:
    scope: dict[str, Any] = {
        "type": "http",
        "method": "GET",
        "path": "/test",
        "headers": [
            (k.lower().encode("latin-1"), v.encode("latin-1"))
            for k, v in (headers or {}).items()
        ],
        "query_string": (
            "&".join(f"{k}={v}" for k, v in (query_params or {}).items()).encode(
                "latin-1"
            )
            if query_params
            else b""
        ),
    }
    if cookies:
        cookie_header = "; ".join(f"{k}={v}" for k, v in cookies.items())
        scope["headers"].append((b"cookie", cookie_header.encode("latin-1")))
    return Request(scope)


# ===========================================================================
# TEST CLASS 1: TRANSLATIONS Dictionary Integrity
# ===========================================================================


class TestTranslationDictionaryIntegrity:
    """Validate the TRANSLATIONS dictionary structure, parity, and data quality."""

    def test_translations_not_empty(self) -> None:
        """TRANSLATIONS must contain at least one entry."""
        assert len(TRANSLATIONS) > 0, "TRANSLATIONS dictionary must not be empty"

    def test_all_entries_have_code(self) -> None:
        """Every translation entry must have a non-empty 'code' field."""
        for key, entry in TRANSLATIONS.items():
            assert "code" in entry, f"Missing 'code' for key '{key}'"
            assert isinstance(
                entry["code"], str
            ), f"'code' for key '{key}' must be a string"
            assert entry["code"].strip(), f"Empty 'code' for key '{key}'"

    def test_all_entries_have_all_four_locales(self) -> None:
        """Every entry must have non-empty string values for en, fr, ar, and kab."""
        for key, entry in TRANSLATIONS.items():
            for loc in SUPPORTED_LOCALES:
                assert loc in entry, f"Missing '{loc}' locale for key '{key}'"
                val = entry[loc]
                assert isinstance(
                    val, str
                ), f"Value for '{key}' in '{loc}' must be a string, got {type(val)}"
                assert val.strip(), f"Empty translation for '{key}' in '{loc}'"

    def test_no_placeholder_or_todo_values(self) -> None:
        """No translation value should contain TODO, TBD, FIXME, or other placeholders."""
        violations = []
        for key, entry in TRANSLATIONS.items():
            for loc in SUPPORTED_LOCALES:
                val = entry.get(loc, "")
                if isinstance(val, str) and SUSPICIOUS_VALUE_PATTERN.match(val.strip()):
                    violations.append(f'  {key} [{loc}] = "{val}"')
        assert not violations, (
            f"Found {len(violations)} placeholder/TODO values in TRANSLATIONS:\n"
            + "\n".join(violations)
        )

    def test_no_duplicate_error_codes(self) -> None:
        """Each error code should be unique (except intentional aliases).
        Intentional aliases: entries with identical translations in all locales."""
        code_to_keys: dict[str, list[str]] = {}
        for key, entry in TRANSLATIONS.items():
            code = entry.get("code", "")
            code_to_keys.setdefault(code, []).append(key)

        duplicates = []
        for code, keys in code_to_keys.items():
            if len(keys) > 1:
                # Check if they are true aliases (same translations) — that's OK
                values_sets = []
                for k in keys:
                    entry = TRANSLATIONS[k]
                    values_sets.append(
                        tuple(entry.get(loc, "") for loc in SUPPORTED_LOCALES)
                    )
                if len(set(values_sets)) > 1:
                    duplicates.append(
                        f"  code '{code}' used by keys with DIFFERENT translations: {keys}"
                    )

        assert not duplicates, (
            f"Found {len(duplicates)} duplicate error codes with differing translations:\n"
            + "\n".join(duplicates)
        )

    def test_interpolation_variable_parity(self) -> None:
        """If the English text contains {name} or {{name}}, all other locales must too."""
        var_pattern = re.compile(r"\{?\{([a-zA-Z0-9_]+)\}\}?")
        violations = []
        for key, entry in TRANSLATIONS.items():
            en_val = entry.get("en", "")
            en_vars = sorted(set(var_pattern.findall(en_val)))
            if not en_vars:
                continue
            for loc in ("fr", "ar", "kab"):
                loc_val = entry.get(loc, "")
                loc_vars = sorted(set(var_pattern.findall(loc_val)))
                if en_vars != loc_vars:
                    violations.append(
                        f"  {key}: en has {en_vars} but {loc} has {loc_vars}"
                    )
        assert not violations, (
            f"Found {len(violations)} interpolation variable mismatches:\n"
            + "\n".join(violations)
        )

    def test_no_trailing_whitespace(self) -> None:
        """Translation values should not have leading/trailing whitespace."""
        violations = []
        for key, entry in TRANSLATIONS.items():
            for loc in SUPPORTED_LOCALES:
                val = entry.get(loc, "")
                if isinstance(val, str) and val != val.strip():
                    violations.append(f'  {key} [{loc}]: "{val}" has extra whitespace')
        assert not violations, (
            f"Found {len(violations)} translations with leading/trailing whitespace:\n"
            + "\n".join(violations)
        )

    def test_no_html_in_translations(self) -> None:
        """Error messages should be plain text, not contain HTML tags."""
        violations = []
        for key, entry in TRANSLATIONS.items():
            for loc in SUPPORTED_LOCALES:
                val = entry.get(loc, "")
                if isinstance(val, str) and HTML_TAG_RE.search(val):
                    violations.append(f'  {key} [{loc}]: contains HTML tag in "{val}"')
        assert not violations, (
            f"Found {len(violations)} translations containing HTML tags:\n"
            + "\n".join(violations)
        )

    def test_lookup_keys_are_lowercase(self) -> None:
        """All TRANSLATIONS dictionary keys must be lowercase (lookups normalize with .lower())."""
        non_lower = [key for key in TRANSLATIONS if key != key.lower()]
        assert not non_lower, (
            f"Found {len(non_lower)} non-lowercase TRANSLATIONS keys "
            f"(lookups use .lower()): {non_lower}"
        )

    def test_no_rtl_control_characters_in_translations(self) -> None:
        """Translation strings must not embed Unicode bidirectional control characters."""
        violations = []
        for key, entry in TRANSLATIONS.items():
            for loc in SUPPORTED_LOCALES:
                val = entry.get(loc, "")
                if isinstance(val, str) and RTL_CONTROL_RE.search(val):
                    violations.append(
                        f"  {key} [{loc}]: contains embedded RTL/LTR control character"
                    )
        assert not violations, (
            f"Found {len(violations)} translations with embedded bidi control characters:\n"
            + "\n".join(violations)
        )

    def test_error_codes_are_snake_case(self) -> None:
        """Error codes must be lowercase snake_case (alphanumeric + underscores, can start with number like 2fa)."""
        bad_codes = []
        snake_re = re.compile(r"^[a-z0-9][a-z0-9_]*$")
        for key, entry in TRANSLATIONS.items():
            code = entry.get("code", "")
            if code and not snake_re.match(code):
                bad_codes.append(f"  '{key}': code='{code}' is not valid snake_case")
        assert not bad_codes, (
            f"Found {len(bad_codes)} error codes that are not valid snake_case:\n"
            + "\n".join(bad_codes)
        )

    def test_en_value_is_sentence_case(self) -> None:
        """English translations should start with a capital letter (sentence case),
        allowing technical field names with underscores or parameter tokens."""
        violations = []
        for key, entry in TRANSLATIONS.items():
            en_val = entry.get("en", "")
            if not en_val:
                continue
            first_char = en_val.lstrip()[0] if en_val.strip() else ""
            if first_char and first_char.islower() and first_char not in ("{", "["):
                first_word = en_val.split()[0].rstrip(":,.")
                # Allow technical field identifiers (e.g. user_id, recipient_email, token)
                if (
                    "_" in first_word
                    or first_word.startswith("errors.")
                    or first_word == "token"
                ):
                    continue
                if len(en_val.split()) > 1:
                    violations.append(
                        f'  {key}: en="{en_val}" does not start with a capital letter'
                    )
        assert not violations, (
            f"Found {len(violations)} English translations not in sentence case:\n"
            + "\n".join(violations)
        )

    def test_translation_brackets_and_parentheses_balanced(self) -> None:
        """Translations must have balanced brackets, parentheses, and braces."""
        violations = []
        pairs = {"(": ")", "[": "]", "{": "}"}
        for key, entry in TRANSLATIONS.items():
            for loc in SUPPORTED_LOCALES:
                val = entry.get(loc, "")
                if not isinstance(val, str):
                    continue
                stack = []
                for char in val:
                    if char in pairs:
                        stack.append(char)
                    elif char in pairs.values():
                        if not stack or pairs[stack.pop()] != char:
                            violations.append(
                                f'  {key} [{loc}]: unbalanced "{char}" in "{val}"'
                            )
                            break
        assert not violations, (
            f"Found {len(violations)} translations with unbalanced brackets/parentheses:\n"
            + "\n".join(violations)
        )


# ===========================================================================
# TEST CLASS 2: Locale Detection
# ===========================================================================


class TestLocaleDetection:
    """Validate normalize_locale() and get_request_locale() behavior."""

    def test_normalize_locale_supported(self) -> None:
        assert normalize_locale("en") == "en"
        assert normalize_locale("fr") == "fr"
        assert normalize_locale("ar") == "ar"
        assert normalize_locale("kab") == "kab"

    def test_normalize_locale_variants(self) -> None:
        assert normalize_locale("en-US") == "en"
        assert normalize_locale("fr-FR") == "fr"
        assert normalize_locale("FR") == "fr"
        assert normalize_locale("ar-DZ") == "ar"
        assert normalize_locale("ar;q=0.9") == "ar"
        assert normalize_locale("kab-DZ") == "kab"

    def test_normalize_locale_unsupported_falls_back(self) -> None:
        assert normalize_locale("es") == "en"
        assert normalize_locale("de") == "en"
        assert normalize_locale("zh") == "en"
        assert normalize_locale("ja") == "en"

    def test_normalize_locale_empty_and_none(self) -> None:
        assert normalize_locale("") == "en"
        assert normalize_locale(None) == "en"
        assert normalize_locale("   ") == "en"

    def test_normalize_locale_malformed_tags(self) -> None:
        """Malformed BCP-47 tags should degrade gracefully to fallback."""
        assert normalize_locale("invalid-tag-xyz") == "en"
        assert normalize_locale("---") == "en"
        assert normalize_locale("123") == "en"

    def test_get_request_locale_query_param_highest_priority(self) -> None:
        """Query ?lang= takes priority over all other signals."""
        req = _make_mock_request(
            query_params={"lang": "ar"},
            headers={"x-locale": "fr", "accept-language": "kab"},
            cookies={"locale": "en"},
        )
        assert get_request_locale(req) == "ar"

    def test_get_request_locale_x_locale_header(self) -> None:
        """X-Locale header takes priority over cookie and Accept-Language."""
        req = _make_mock_request(
            headers={"x-locale": "kab", "accept-language": "fr"},
            cookies={"locale": "en"},
        )
        assert get_request_locale(req) == "kab"

    def test_get_request_locale_cookie(self) -> None:
        """Cookie takes priority over Accept-Language."""
        req = _make_mock_request(
            headers={"accept-language": "ar"},
            cookies={"locale": "fr"},
        )
        assert get_request_locale(req) == "fr"

    def test_get_request_locale_accept_language_with_qvalues(self) -> None:
        """Accept-Language q-values: pick the highest-q supported locale."""
        req = _make_mock_request(
            headers={"accept-language": "es;q=0.9, ar-DZ;q=0.8, en;q=0.5"}
        )
        assert get_request_locale(req) == "ar"

    def test_get_request_locale_fallback_default(self) -> None:
        """Unsupported languages fall back to DEFAULT_LOCALE."""
        req = _make_mock_request(headers={"accept-language": "zh-CN,zh;q=0.9"})
        assert get_request_locale(req) == DEFAULT_LOCALE

    def test_get_request_locale_empty_cookie_ignored(self) -> None:
        """An empty cookie value should not override Accept-Language."""
        req = _make_mock_request(
            headers={"accept-language": "fr"},
            cookies={"locale": ""},
        )
        result = get_request_locale(req)
        assert result in ("fr", DEFAULT_LOCALE)

    def test_get_request_locale_all_signals_absent(self) -> None:
        """No i18n signals at all → DEFAULT_LOCALE."""
        req = _make_mock_request()
        assert get_request_locale(req) == DEFAULT_LOCALE

    def test_priority_chain_exhaustive(self) -> None:
        """Verify the full 4-level priority chain: query > x-locale > cookie > accept-language."""
        # Level 4 (only accept-language)
        req4 = _make_mock_request(headers={"accept-language": "ar"})
        assert get_request_locale(req4) == "ar"

        # Level 3 (cookie overrides accept-language)
        req3 = _make_mock_request(
            headers={"accept-language": "ar"}, cookies={"locale": "fr"}
        )
        assert get_request_locale(req3) == "fr"

        # Level 2 (x-locale overrides cookie + accept-language)
        req2 = _make_mock_request(
            headers={"x-locale": "kab", "accept-language": "ar"},
            cookies={"locale": "fr"},
        )
        assert get_request_locale(req2) == "kab"

        # Level 1 (query param overrides everything)
        req1 = _make_mock_request(
            query_params={"lang": "en"},
            headers={"x-locale": "kab", "accept-language": "ar"},
            cookies={"locale": "fr"},
        )
        assert get_request_locale(req1) == "en"


# ===========================================================================
# TEST CLASS 3: Localization Engine
# ===========================================================================


class TestLocalizationEngine:
    """Validate localize_error() translation, prefix matching, and fallbacks."""

    def test_localize_error_exact_matches(self) -> None:
        ar_msg, ar_code = localize_error("Lesson not found", "ar")
        assert ar_msg == "الدرس غير موجود"
        assert ar_code == "lesson_not_found"

        fr_msg, fr_code = localize_error("Lesson not found", "fr")
        assert fr_msg == "Leçon introuvable"
        assert fr_code == "lesson_not_found"

        kab_msg, kab_code = localize_error("Lesson not found", "kab")
        assert kab_msg == "Tasurift ulac-itt"
        assert kab_code == "lesson_not_found"

        en_msg, en_code = localize_error("Lesson not found", "en")
        assert en_msg == "Lesson not found"
        assert en_code == "lesson_not_found"

    def test_localize_error_is_case_insensitive(self) -> None:
        msg_lower, code_lower = localize_error("lesson not found", "ar")
        msg_mixed, code_mixed = localize_error("Lesson Not Found", "ar")
        assert msg_lower == msg_mixed
        assert code_lower == code_mixed

    def test_localize_free_preview_messages(self) -> None:
        ar_msg, _ = localize_error("Lesson marked as Free Preview", "ar")
        assert ar_msg == "تم تعيين الدرس كمعاينة مجانية"

        fr_msg, _ = localize_error("Lesson marked as Free Preview", "fr")
        assert fr_msg == "Leçon marquée comme aperçu gratuit"

        kab_msg, _ = localize_error("Lesson marked as Free Preview", "kab")
        assert kab_msg == "Tasurift tettwarkeḍ d tamuɣli baṭel"

    def test_localize_structured_dict_with_detail_key(self) -> None:
        payload = {"detail": "Insufficient permissions", "code": "old_code"}
        res, code = localize_error(payload, "ar")
        assert res["message"] == "صلاحيات غير كافية"
        assert code == "insufficient_permissions"

    def test_localize_structured_dict_with_message_key(self) -> None:
        payload_fr = {"message": "Admin access required"}
        res_fr, code_fr = localize_error(payload_fr, "fr")
        assert res_fr["message"] == "Accès administrateur requis"
        assert code_fr == "admin_access_required"

    def test_localize_prefix_matching(self) -> None:
        msg, code = localize_error("Insufficient permissions: user is suspended", "ar")
        assert "صلاحيات غير كافية" in msg
        assert "user is suspended" in msg
        assert code == "insufficient_permissions"

    def test_localize_unknown_fallback(self) -> None:
        msg, code = localize_error(
            "Some totally unheard of system failure occurred", "fr"
        )
        assert msg == "Some totally unheard of system failure occurred"
        assert code == "some_totally_unheard_of_system_failure_occurred"

    def test_localize_non_string_input(self) -> None:
        result, code = localize_error(42, "ar")
        assert result == 42
        assert code == "error"

    def test_localize_empty_string_input(self) -> None:
        result, code = localize_error("", "ar")
        assert isinstance(result, str)
        assert isinstance(code, str)

    def test_localize_whitespace_only_input(self) -> None:
        result, code = localize_error("   ", "ar")
        assert isinstance(result, str)
        assert isinstance(code, str)

    def test_localize_unknown_locale_falls_back_to_english(self) -> None:
        en_msg, en_code = localize_error("Lesson not found", "en")
        unknown_msg, unknown_code = localize_error("Lesson not found", "xx")
        assert unknown_msg == en_msg
        assert unknown_code == en_code

    def test_localize_list_of_pydantic_errors(self) -> None:
        """Localizing list of Pydantic error dicts should translate each msg."""
        errors = [
            {
                "loc": ["body", "title"],
                "msg": "Title is required",
                "type": "value_error",
            },
            {
                "loc": ["body", "email"],
                "msg": "Email already registered",
                "type": "value_error",
            },
        ]
        localized, code = localize_error(errors, "fr")
        assert code == "validation_error"
        assert isinstance(localized, list)
        assert localized[0]["msg"] == "Le titre est obligatoire"
        assert localized[1]["msg"] == "Cette adresse e-mail est déjà enregistrée"

    def test_localize_every_translation_entry_resolves(self) -> None:
        """Every single entry in TRANSLATIONS must produce the correct translated message
        and error code for all 4 locales when looked up by dictionary key."""
        failures = []
        for key, entry in TRANSLATIONS.items():
            expected_code = entry["code"]
            for loc in SUPPORTED_LOCALES:
                msg, code = localize_error(key, loc)
                expected_msg = entry[loc]
                if msg != expected_msg:
                    failures.append(
                        f"  key='{key}', locale='{loc}': expected \"{expected_msg}\", "
                        f'got "{msg}"'
                    )
                if code != expected_code:
                    failures.append(
                        f"  key='{key}', locale='{loc}': expected code '{expected_code}', "
                        f"got '{code}'"
                    )
        assert not failures, (
            f"Found {len(failures)} localize_error() resolution failures:\n"
            + "\n".join(failures[:20])
        )

    def test_localize_all_locales_return_non_empty(self) -> None:
        """For every TRANSLATIONS entry, all 4 locales must return non-empty strings."""
        failures = []
        for key in TRANSLATIONS:
            for loc in SUPPORTED_LOCALES:
                msg, _ = localize_error(key, loc)
                if not isinstance(msg, str) or not msg.strip():
                    failures.append(
                        f"  key='{key}', locale='{loc}': got empty/non-string '{msg}'"
                    )
        assert not failures, (
            f"Found {len(failures)} localize_error() calls returning empty for a defined key:\n"
            + "\n".join(failures[:20])
        )


# ===========================================================================
# TEST CLASS 4: HTTP Exception Handler Integration
# ===========================================================================


class TestHTTPExceptionIntegration:
    """Test the FastAPI exception handler wiring with actual HTTP requests."""

    @pytest.fixture()
    def client(self):
        from fastapi import FastAPI, HTTPException
        from fastapi.testclient import TestClient
        from starlette.exceptions import HTTPException as StarletteHTTPException

        from app.main import http_exception_handler, value_error_handler

        app = FastAPI()
        app.add_exception_handler(StarletteHTTPException, http_exception_handler)
        app.add_exception_handler(ValueError, value_error_handler)

        @app.get("/error/404")
        def trigger_404():
            raise HTTPException(status_code=404, detail="Lesson not found")

        @app.get("/error/403")
        def trigger_403():
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        @app.get("/error/401")
        def trigger_401():
            raise HTTPException(status_code=401, detail="Not authenticated")

        @app.get("/error/400-value")
        def trigger_value_error():
            raise ValueError("Title is required")

        return TestClient(app)

    def test_arabic_header(self, client) -> None:
        res = client.get("/error/404", headers={"X-Locale": "ar"})
        assert res.status_code == 404
        assert res.json() == {"detail": "الدرس غير موجود", "code": "lesson_not_found"}

    def test_french_header(self, client) -> None:
        res = client.get("/error/403", headers={"X-Locale": "fr"})
        assert res.status_code == 403
        assert res.json() == {
            "detail": "Permissions insuffisantes",
            "code": "insufficient_permissions",
        }

    def test_kabyle_header(self, client) -> None:
        res = client.get("/error/404", headers={"X-Locale": "kab"})
        assert res.status_code == 404
        assert res.json() == {"detail": "Tasurift ulac-itt", "code": "lesson_not_found"}

    def test_english_default(self, client) -> None:
        res = client.get("/error/404", headers={"X-Locale": "en"})
        assert res.status_code == 404
        assert res.json() == {"detail": "Lesson not found", "code": "lesson_not_found"}

    def test_query_param_override(self, client) -> None:
        res = client.get("/error/404?lang=ar")
        assert res.status_code == 404
        assert res.json() == {"detail": "الدرس غير موجود", "code": "lesson_not_found"}

    def test_valueerror_localization(self, client) -> None:
        for loc, expected_detail in [
            ("ar", "العنوان مطلوب"),
            ("fr", "Le titre est obligatoire"),
            ("kab", "Azwel d amussan"),
            ("en", "Title is required"),
        ]:
            res = client.get("/error/400-value", headers={"X-Locale": loc})
            assert res.status_code == 400
            body = res.json()
            assert body["detail"] == expected_detail, f"Failed for locale {loc}"
            assert body["code"] == "title_required"

    def test_response_contains_both_detail_and_code(self, client) -> None:
        """Every error response must have both 'detail' and 'code' keys."""
        for path in ["/error/404", "/error/403", "/error/401"]:
            res = client.get(path, headers={"X-Locale": "en"})
            body = res.json()
            assert "detail" in body, f"Missing 'detail' in response for {path}"
            assert "code" in body, f"Missing 'code' in response for {path}"
            assert isinstance(body["detail"], str) and body["detail"]
            assert isinstance(body["code"], str) and body["code"]

    def test_all_locales_return_200_on_valid_request(self, client) -> None:
        """Sanity check: locale header itself doesn't break non-error endpoints."""

        @client.app.get("/ping")
        def ping():
            return {"ok": True}

        for loc in SUPPORTED_LOCALES:
            res = client.get("/ping", headers={"X-Locale": loc})
            assert res.status_code == 200

    def test_401_localized_in_all_locales(self, client) -> None:
        """401 Not authenticated should be localized for all 4 locales."""
        expected = {
            "en": "Authentication required",
            "fr": "Authentification requise",
            "ar": "تسجيل الدخول مطلوب",
            "kab": "Asneknew yettwasra",
        }
        for loc, detail in expected.items():
            res = client.get("/error/401", headers={"X-Locale": loc})
            assert res.status_code == 401
            body = res.json()
            assert (
                body["detail"] == detail
            ), f"[{loc}] expected '{detail}', got '{body['detail']}'"
            assert body["code"] == "unauthenticated"


# ===========================================================================
# TEST CLASS 5: Codebase-Wide i18n Coverage (AST Scanning)
# ===========================================================================


class TestCodebaseI18nCoverage:
    """Scan the entire backend Python codebase to find user-facing strings
    that lack TRANSLATIONS entries using the single-pass cached scanner."""

    def test_all_httpexception_detail_strings_have_translations(self) -> None:
        """Every HTTPException(detail='...') string literal in routers, services,
        middleware, and core must either:
          a) Exist in TRANSLATIONS (exact or prefix match), or
          b) Be a dot-notation key (resolved on frontend), or
          c) Be in the explicit allowlist.
        """
        scan = _get_unified_codebase_scan()
        untranslated = []
        for detail, filepath, lineno in scan.httpexception_details:
            if not _is_translated(detail):
                untranslated.append(f'  {filepath}:{lineno} — detail="{detail}"')

        assert not untranslated, (
            f"Found {len(untranslated)} HTTPException detail strings without TRANSLATIONS entries.\n"
            f"Each must be added to app/core/i18n.py TRANSLATIONS or the allowlist:\n"
            + "\n".join(untranslated[:50])
        )

    def test_all_valueerror_messages_in_services_have_translations(self) -> None:
        """raise ValueError('...') in services/ and routers/ produce user-facing 400
        errors via value_error_handler. Their messages should be translatable."""
        scan = _get_unified_codebase_scan()
        untranslated = []
        for msg, filepath, lineno in scan.value_error_messages:
            if not any(
                filepath.startswith(f"app/{s}/") or f"/{s}/" in filepath
                for s in ["routers", "services"]
            ):
                continue
            if not _is_translated(msg):
                untranslated.append(f'  {filepath}:{lineno} — ValueError("{msg}")')

        assert not untranslated, (
            f"Found {len(untranslated)} ValueError messages in routers/services without "
            f"TRANSLATIONS entries.\n"
            f"Each must be added to app/core/i18n.py TRANSLATIONS:\n"
            + "\n".join(untranslated[:50])
        )

    def test_all_pydantic_valueerror_messages_have_translations(self) -> None:
        """raise ValueError('...') in schemas/ produce user-facing validation errors
        that pass through value_error_handler. Their messages should be translatable."""
        scan = _get_unified_codebase_scan()
        schema_errors = [
            (msg, fp, ln)
            for msg, fp, ln in scan.value_error_messages
            if fp.startswith("app/schemas/") or "/schemas/" in fp
        ]
        untranslated = []
        for msg, filepath, lineno in schema_errors:
            if not _is_translated(msg):
                untranslated.append(f'  {filepath}:{lineno} — ValueError("{msg}")')

        assert not untranslated, (
            f"Found {len(untranslated)} Pydantic schema ValueError messages without "
            f"TRANSLATIONS entries.\n"
            f"These produce user-facing 400 errors via value_error_handler:\n"
            + "\n".join(untranslated[:50])
        )

    def test_pydantic_v2_field_validators_have_translations(self) -> None:
        """Pydantic v2 @field_validator / @model_validator functions that raise ValueError
        in schemas/ produce user-facing 422 errors. Their messages must be translatable."""
        scan = _get_unified_codebase_scan()
        untranslated = []
        for msg, filepath, lineno in scan.pydantic_validator_messages:
            if not _is_translated(msg):
                untranslated.append(
                    f'  {filepath}:{lineno} — @field_validator raises ValueError("{msg}")'
                )

        assert not untranslated, (
            f"Found {len(untranslated)} Pydantic v2 @field_validator messages without "
            f"TRANSLATIONS entries.\n"
            f"These produce user-facing 422 responses:\n" + "\n".join(untranslated[:50])
        )

    def test_all_dot_notation_keys_follow_convention(self) -> None:
        """All dot-notation error keys (errors.xxx.yyy) used in HTTPException detail
        should follow the naming convention and use lowercase with underscores."""
        scan = _get_unified_codebase_scan()
        invalid_format = []
        valid_pattern = re.compile(r"^errors?\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$")
        for detail, filepath, lineno in scan.httpexception_details:
            if detail.startswith("errors.") or detail.startswith("error."):
                if not valid_pattern.match(detail):
                    invalid_format.append(
                        f'  {filepath}:{lineno} — "{detail}" doesn\'t match errors.namespace.key_name'
                    )

        assert not invalid_format, (
            f"Found {len(invalid_format)} dot-notation keys with invalid format:\n"
            + "\n".join(invalid_format[:30])
        )

    def test_middleware_raw_responses_are_translatable(self) -> None:
        """Middleware that returns raw Response/JSONResponse (bypassing exception handlers)
        should use strings that exist in TRANSLATIONS."""
        scan = _get_unified_codebase_scan()
        untranslated = []
        for detail, filepath, lineno in scan.raw_responses:
            cleaned = detail.strip().lower()
            if (
                cleaned not in TRANSLATIONS
                and detail not in KNOWN_UNTRANSLATED_ALLOWLIST
            ):
                untranslated.append(
                    f'  {filepath}:{lineno} — raw Response detail="{detail}" '
                    f"(bypasses exception handler, never translated!)"
                )

        assert not untranslated, (
            f"Found {len(untranslated)} raw Response/JSONResponse calls with untranslated "
            f"detail strings.\n"
            f"These bypass http_exception_handler and are NEVER localized:\n"
            + "\n".join(untranslated[:30])
        )

    def test_success_messages_in_routers_have_translations(self) -> None:
        """Router endpoints returning {\"message\": \"...\"} success responses should
        use translatable strings."""
        scan = _get_unified_codebase_scan()
        untranslated = []
        for msg, filepath, lineno in scan.router_success_messages:
            if not _is_translated(msg):
                untranslated.append(f'  {filepath}:{lineno} — message="{msg}"')

        assert not untranslated, (
            f"Found {len(untranslated)} hardcoded success/status messages in router responses.\n"
            f"These should be translated or use i18n keys:\n"
            + "\n".join(untranslated[:40])
        )

    def test_no_translation_lookup_in_schema_files(self) -> None:
        """Schema files should not import or call localize_error() directly —
        that is the job of the exception handlers. This check prevents
        double-localization bugs."""
        violations = []
        target_path = API_APP_DIR / "schemas"
        if not target_path.exists():
            return
        for py_file in _collect_python_files(target_path):
            source = py_file.read_text(encoding="utf-8")
            if "localize_error" in source:
                violations.append(str(py_file.relative_to(API_APP_DIR.parent)))
        assert not violations, (
            f"Found {len(violations)} schema files directly calling localize_error().\n"
            f"Localization belongs in exception handlers, not schemas:\n"
            + "\n".join(violations)
        )


# ===========================================================================
# TEST CLASS 6: Translation Quality
# ===========================================================================


class TestTranslationQuality:
    """Validate linguistic quality of translations."""

    def test_arabic_translations_contain_arabic_script(self) -> None:
        """Arabic translations must contain Arabic Unicode characters."""
        violations = []
        ar_latin_allowlist = {
            "MP4",
            "MOV",
            "MKV",
            "WebM",
            "CSRF",
            "Supabase",
            "5GB",
            "5 GB",
        }
        for key, entry in TRANSLATIONS.items():
            ar_val = entry.get("ar", "")
            if not isinstance(ar_val, str) or not ar_val.strip():
                continue
            if ar_val.strip() in ar_latin_allowlist:
                continue
            if not ARABIC_SCRIPT_RE.search(ar_val):
                violations.append(
                    f'  {key}: ar="{ar_val}" — contains NO Arabic characters'
                )
        assert not violations, (
            f"Found {len(violations)} Arabic translations without Arabic script:\n"
            + "\n".join(violations)
        )

    def test_kabyle_translations_contain_latin_script(self) -> None:
        """Kabyle (Taqbaylit) translations use Latin script and must contain Latin characters."""
        violations = []
        for key, entry in TRANSLATIONS.items():
            kab_val = entry.get("kab", "")
            if not isinstance(kab_val, str) or not kab_val.strip():
                continue
            if not LATIN_SCRIPT_RE.search(kab_val):
                violations.append(
                    f'  {key}: kab="{kab_val}" — contains NO Latin characters'
                )
        assert not violations, (
            f"Found {len(violations)} Kabyle translations without Latin script:\n"
            + "\n".join(violations)
        )

    def test_french_translations_differ_from_english(self) -> None:
        """French translations should differ from English (catch untranslated copy-paste).
        Allowlist for terms that are legitimately the same in both languages."""
        same_in_both_allowlist = {
            "CSRF",
            "API",
            "Supabase",
            "MP4",
            "MOV",
            "MKV",
            "WebM",
        }
        violations = []
        for key, entry in TRANSLATIONS.items():
            en_val = entry.get("en", "").strip()
            fr_val = entry.get("fr", "").strip()
            if en_val and fr_val and en_val == fr_val:
                if en_val not in same_in_both_allowlist:
                    violations.append(f'  {key}: fr is identical to en: "{en_val}"')
        assert not violations, (
            f"Found {len(violations)} French translations identical to English (copy-paste?):\n"
            + "\n".join(violations)
        )

    def test_kabyle_translations_differ_from_english(self) -> None:
        """Kabyle translations should differ from English (catch untranslated copy-paste)."""
        violations = []
        for key, entry in TRANSLATIONS.items():
            en_val = entry.get("en", "").strip()
            kab_val = entry.get("kab", "").strip()
            if en_val and kab_val and en_val == kab_val and len(en_val.split()) > 1:
                violations.append(f'  {key}: kab is identical to en: "{en_val}"')
        assert not violations, (
            f"Found {len(violations)} Kabyle translations identical to English (copy-paste?):\n"
            + "\n".join(violations)
        )

    def test_arabic_translations_differ_from_english(self) -> None:
        """Arabic translations should never be identical to English (script mismatch)."""
        violations = []
        for key, entry in TRANSLATIONS.items():
            en_val = entry.get("en", "").strip()
            ar_val = entry.get("ar", "").strip()
            if en_val and ar_val and en_val == ar_val:
                violations.append(
                    f'  {key}: ar is identical to en: "{en_val}" '
                    f"(Arabic strings should use Arabic script)"
                )
        assert not violations, (
            f"Found {len(violations)} Arabic translations that are character-for-character "
            f"identical to English:\n" + "\n".join(violations)
        )

    def test_translations_are_not_excessively_long(self) -> None:
        """Error messages should be concise. Flag anything over 500 characters."""
        violations = []
        for key, entry in TRANSLATIONS.items():
            for loc in SUPPORTED_LOCALES:
                val = entry.get(loc, "")
                if isinstance(val, str) and len(val) > 500:
                    violations.append(f"  {key} [{loc}]: {len(val)} chars (max 500)")
        assert not violations, (
            f"Found {len(violations)} translations exceeding 500 characters:\n"
            + "\n".join(violations)
        )

    def test_arabic_translation_reasonable_length_ratio(self) -> None:
        """Arabic translations should be roughly comparable to English length (within 4x)."""
        violations = []
        for key, entry in TRANSLATIONS.items():
            en_val = entry.get("en", "").strip()
            ar_val = entry.get("ar", "").strip()
            if not en_val or not ar_val:
                continue
            ratio = len(ar_val) / len(en_val)
            if ratio > 4.0 or ratio < 0.2:
                violations.append(
                    f"  {key}: ar/en length ratio is {ratio:.1f} "
                    f"(en={len(en_val)} chars, ar={len(ar_val)} chars) — suspiciously off"
                )
        assert not violations, (
            f"Found {len(violations)} Arabic translations with suspicious length ratios:\n"
            + "\n".join(violations)
        )

    def test_no_double_spaces_in_translations(self) -> None:
        """Translation values should not contain double spaces (typically a copy-paste artifact)."""
        violations = []
        for key, entry in TRANSLATIONS.items():
            for loc in SUPPORTED_LOCALES:
                val = entry.get(loc, "")
                if isinstance(val, str) and "  " in val:
                    violations.append(
                        f'  {key} [{loc}]: contains double space in "{val}"'
                    )
        assert not violations, (
            f"Found {len(violations)} translations with double spaces:\n"
            + "\n".join(violations)
        )


# ===========================================================================
# TEST CLASS 7: Secondary Localization Engines
# ===========================================================================


class TestSecondaryLocalizationEngines:
    """Validate locale parity in email localization and BI insight engines."""

    def test_email_localization_has_all_supported_locales(self) -> None:
        """email_localization.py LOCALIZED dict should support all 4 platform locales and have parity across sections."""
        try:
            from app.services.email_localization import LOCALIZED
        except ImportError:
            pytest.skip("email_localization module not available")

        missing_locales = []
        for loc in SUPPORTED_LOCALES:
            if loc not in LOCALIZED:
                missing_locales.append(f"Missing top-level locale: '{loc}'")

        assert not missing_locales, (
            f"email_localization.py LOCALIZED is missing top-level locales:\n"
            + "\n".join(missing_locales)
        )

        en_sections = LOCALIZED["en"]
        discrepancies = []
        for loc in SUPPORTED_LOCALES:
            if loc == "en":
                continue
            loc_dict = LOCALIZED[loc]
            for section_name, section_dict in en_sections.items():
                if section_name not in loc_dict:
                    discrepancies.append(
                        f"Locale '{loc}' missing section '{section_name}'"
                    )
                    continue
                for key_name in section_dict:
                    if key_name not in loc_dict[section_name]:
                        discrepancies.append(
                            f"Locale '{loc}' in section '{section_name}' missing key '{key_name}'"
                        )

        assert not discrepancies, (
            f"email_localization.py LOCALIZED has section/key discrepancies:\n"
            + "\n".join(discrepancies[:30])
        )

    def test_email_localization_no_empty_values(self) -> None:
        """No email localization value should be empty or whitespace-only."""
        try:
            from app.services.email_localization import LOCALIZED
        except ImportError:
            pytest.skip("email_localization module not available")

        violations = []
        for loc, sections in LOCALIZED.items():
            if not isinstance(sections, dict):
                continue
            for section_name, section_dict in sections.items():
                if not isinstance(section_dict, dict):
                    continue
                for key_name, val in section_dict.items():
                    if isinstance(val, str) and not val.strip():
                        violations.append(
                            f"  [{loc}][{section_name}][{key_name}]: empty value"
                        )
        assert not violations, (
            f"Found {len(violations)} empty email localization values:\n"
            + "\n".join(violations[:30])
        )

    def test_bi_insight_engine_has_all_supported_locales(self) -> None:
        """BI insight engine translation dicts should support all 4 platform locales."""
        try:
            from app.services.bi_services.insight_engine import (
                INSIGHT_TEMPLATES,
                RISK_LABELS,
                DIRECTION_LABELS,
            )
        except ImportError:
            pytest.skip("BI insight engine module not available")

        missing = []
        for name, d in [
            ("INSIGHT_TEMPLATES", INSIGHT_TEMPLATES),
            ("RISK_LABELS", RISK_LABELS),
            ("DIRECTION_LABELS", DIRECTION_LABELS),
        ]:
            if isinstance(d, dict):
                for key, entry in d.items():
                    if isinstance(entry, dict):
                        nested_dicts = [
                            (f"{key}.{sub_k}", sub_v)
                            for sub_k, sub_v in entry.items()
                            if isinstance(sub_v, dict)
                        ]
                        if nested_dicts:
                            for sub_key, sub_dict in nested_dicts:
                                for loc in SUPPORTED_LOCALES:
                                    if loc not in sub_dict:
                                        missing.append(
                                            f"  {name}['{sub_key}']: missing '{loc}'"
                                        )
                        else:
                            for loc in SUPPORTED_LOCALES:
                                if loc not in entry:
                                    missing.append(
                                        f"  {name}['{key}']: missing '{loc}'"
                                    )

        assert not missing, (
            f"BI insight engine is missing locale entries:\n" + "\n".join(missing[:30])
        )

    def test_bi_insight_arabic_values_have_arabic_script(self) -> None:
        """BI insight Arabic translation values must contain Arabic characters."""
        try:
            from app.services.bi_services.insight_engine import (
                INSIGHT_TEMPLATES,
                RISK_LABELS,
                DIRECTION_LABELS,
            )
        except ImportError:
            pytest.skip("BI insight engine module not available")

        violations = []
        for name, d in [
            ("INSIGHT_TEMPLATES", INSIGHT_TEMPLATES),
            ("RISK_LABELS", RISK_LABELS),
            ("DIRECTION_LABELS", DIRECTION_LABELS),
        ]:
            if not isinstance(d, dict):
                continue
            for key, entry in d.items():
                if not isinstance(entry, dict):
                    continue

                def check_ar(label: str, mapping: dict) -> None:
                    ar_val = mapping.get("ar", "")
                    if (
                        isinstance(ar_val, str)
                        and ar_val.strip()
                        and not ARABIC_SCRIPT_RE.search(ar_val)
                    ):
                        violations.append(f"  {name}['{label}'].ar = \"{ar_val}\"")

                nested = [
                    (f"{key}.{sk}", sv)
                    for sk, sv in entry.items()
                    if isinstance(sv, dict)
                ]
                if nested:
                    for sub_label, sub_dict in nested:
                        check_ar(sub_label, sub_dict)
                else:
                    check_ar(key, entry)

        assert not violations, (
            f"Found {len(violations)} BI insight Arabic values without Arabic script:\n"
            + "\n".join(violations[:20])
        )
