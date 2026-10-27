"""Validate OpenAPI spec conformance without full app init."""
import json
import sys
import importlib.util

spec_path = sys.argv[1] if len(sys.argv) > 1 else "openapi.json"

with open(spec_path) as f:
    spec = json.load(f)

errors = []
for path, methods in spec.get("paths", {}).items():
    for method, details in methods.items():
        if "responses" not in details:
            errors.append(f"{method.upper()} {path}: missing responses")
        if "operationId" not in details:
            errors.append(f"{method.upper()} {path}: missing operationId")
if errors:
    print("OpenAPI validation errors:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print("OpenAPI spec is valid")
