"""
services/api/app/agent/providers/normalizer.py
Bidirectional schema normalizer between JSON Schema and Gemini FunctionDeclarations.
"""

import copy
import re
from typing import Dict, Any, List
from app.agent.schemas import ToolDefinition


class ToolSchemaNormalizer:
    """Normalizes tool definitions between OpenAI JSON Schema and Google Gemini schemas."""

    TYPE_MAP_OPENAI_TO_GEMINI = {
        "string": "STRING",
        "integer": "INTEGER",
        "number": "NUMBER",
        "boolean": "BOOLEAN",
        "array": "ARRAY",
        "object": "OBJECT",
    }

    TYPE_MAP_GEMINI_TO_OPENAI = {v: k for k, v in TYPE_MAP_OPENAI_TO_GEMINI.items()}

    ALLOWED_GEMINI_SCHEMA_KEYS = {
        "type",
        "format",
        "description",
        "nullable",
        "enum",
        "properties",
        "required",
        "items",
    }

    @classmethod
    def to_gemini_declaration(cls, tool: ToolDefinition) -> Dict[str, Any]:
        """Converts an OpenAI-style ToolDefinition into a Gemini functionDeclaration."""
        safe_name = re.sub(r"[^a-zA-Z0-9_.:-]", "_", tool.name)[:64]
        safe_description = (tool.description or "")[:1024]
        clean_parameters = cls._sanitize_for_gemini(tool.parameters)

        if not isinstance(clean_parameters, dict):
            clean_parameters = {"type": "OBJECT", "properties": {}}
        if clean_parameters.get("type") != "OBJECT":
            clean_parameters["type"] = "OBJECT"
        if "properties" not in clean_parameters:
            clean_parameters["properties"] = {}

        return {
            "name": safe_name,
            "description": safe_description,
            "parameters": clean_parameters,
        }

    @classmethod
    def _sanitize_for_gemini(cls, raw_schema: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(raw_schema, dict):
            return raw_schema

        schema = copy.deepcopy(raw_schema)

        # Handle anyOf / oneOf / allOf (e.g., Optional[T] in Pydantic v2)
        for union_key in ("anyOf", "oneOf", "allOf"):
            if union_key in schema and isinstance(schema[union_key], list):
                variants = schema.pop(union_key)
                has_null = False
                non_null_variants: List[Dict[str, Any]] = []
                for v in variants:
                    if isinstance(v, dict):
                        if v.get("type") == "null":
                            has_null = True
                        else:
                            non_null_variants.append(v)
                if non_null_variants:
                    primary = non_null_variants[0]
                    for k, val in primary.items():
                        if k not in schema:
                            schema[k] = val
                if has_null:
                    schema["nullable"] = True

        sanitized: Dict[str, Any] = {}

        # 1. Type normalization
        raw_type = schema.get("type")
        if isinstance(raw_type, str):
            sanitized["type"] = cls.TYPE_MAP_OPENAI_TO_GEMINI.get(
                raw_type.lower(), "STRING"
            )
        elif isinstance(raw_type, list):
            valid_types = [t for t in raw_type if t.lower() != "null"]
            if len(valid_types) < len(raw_type):
                sanitized["nullable"] = True
            sanitized["type"] = cls.TYPE_MAP_OPENAI_TO_GEMINI.get(
                valid_types[0].lower() if valid_types else "string", "STRING"
            )
        else:
            if "properties" in schema:
                sanitized["type"] = "OBJECT"
            elif "items" in schema:
                sanitized["type"] = "ARRAY"
            else:
                sanitized["type"] = "STRING"

        # 2. Description
        if "description" in schema and isinstance(schema["description"], str):
            sanitized["description"] = schema["description"][:1024]

        # 3. Format
        if "format" in schema and isinstance(schema["format"], str):
            sanitized["format"] = schema["format"]

        # 4. Nullable
        if schema.get("nullable") is True:
            sanitized["nullable"] = True

        # 5. Enum
        if "enum" in schema and isinstance(schema["enum"], list):
            sanitized["enum"] = [str(item) for item in schema["enum"]]

        # 6. Properties (recursive)
        if "properties" in schema and isinstance(schema["properties"], dict):
            sanitized["properties"] = {
                prop_name: cls._sanitize_for_gemini(prop_schema)
                for prop_name, prop_schema in schema["properties"].items()
            }
        elif sanitized["type"] == "OBJECT":
            sanitized["properties"] = {}

        # 7. Items (recursive)
        if "items" in schema and isinstance(schema["items"], dict):
            sanitized["items"] = cls._sanitize_for_gemini(schema["items"])
        elif sanitized["type"] == "ARRAY":
            sanitized["items"] = {"type": "STRING"}

        # 8. Required
        if "required" in schema and isinstance(schema["required"], list):
            props = sanitized.get("properties", {})
            sanitized["required"] = [
                field for field in schema["required"] if field in props
            ]

        # Filter strictly to allowed keys only
        return {
            k: v for k, v in sanitized.items() if k in cls.ALLOWED_GEMINI_SCHEMA_KEYS
        }

    @classmethod
    def from_gemini_declaration(cls, decl: Dict[str, Any]) -> ToolDefinition:
        """Converts a Gemini declaration back to standard OpenAI JSON Schema."""
        return ToolDefinition(
            name=decl["name"],
            description=decl.get("description", ""),
            parameters=cls._sanitize_from_gemini(decl.get("parameters", {})),
        )

    @classmethod
    def _sanitize_from_gemini(cls, schema: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(schema, dict):
            return schema

        sanitized: Dict[str, Any] = {}
        for key, value in schema.items():
            if key == "type" and isinstance(value, str):
                sanitized["type"] = cls.TYPE_MAP_GEMINI_TO_OPENAI.get(
                    value.upper(), value.lower()
                )
            elif key == "properties" and isinstance(value, dict):
                sanitized["properties"] = {
                    prop_name: cls._sanitize_from_gemini(prop_schema)
                    for prop_name, prop_schema in value.items()
                }
            elif key == "items" and isinstance(value, dict):
                sanitized["items"] = cls._sanitize_from_gemini(value)
            else:
                sanitized[key] = value

        return sanitized
