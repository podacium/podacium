import json
import sys
import os

# Set fallback development environment variables for schema generation
os.environ.setdefault("DATABASE_URL", "postgresql://tamwheel:localdev_only@localhost:5432/tamwheel?schema=public")
os.environ.setdefault("JWT_SECRET_KEY", "tamwheel_production_contract_spec_secret_key_32chars_min")
os.environ.setdefault("PRISMA_PY_DEBUG_GENERATOR", "1")

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("services/api"))
from app.main import app

spec = app.openapi()
spec["servers"] = [
    {"url": "https://api.tamwheel.dz", "description": "TamWheel Production API"}
]

out_path = sys.argv[1] if len(sys.argv) > 1 else "openapi.json"
with open(out_path, "w") as f:
    json.dump(spec, f, indent=2)
print(f"openapi.json regenerated -> {out_path}")
