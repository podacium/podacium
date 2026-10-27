import json
import sys
import os

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("services/api"))
from app.main import app

spec = app.openapi()
spec["servers"] = [
    {"url": "https://backend-api.podacium.com", "description": "Production API"}
]

out_path = sys.argv[1] if len(sys.argv) > 1 else "openapi.json"
with open(out_path, "w") as f:
    json.dump(spec, f, indent=2)
print(f"openapi.json regenerated -> {out_path}")
