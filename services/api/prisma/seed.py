import os
import json
from pathlib import Path

# --- CONFIG: project root and frontend folders ---
# Dynamically resolve apps/web/src from repo root referentially
REPO_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = str(REPO_ROOT / "apps" / "web" / "src")
FOLDERS_TO_READ = [
    "lib",          # api.ts
    "contexts",     # AuthContext.tsx
    "hooks"         # useAuthGuard.ts, etc.
]

# --- FUNCTION: read folder recursively ---
def read_folder(folder_path):
    result = {}
    for root, dirs, files in os.walk(folder_path):
        rel_root = os.path.relpath(root, folder_path)
        current = result
        if rel_root != ".":
            for part in rel_root.split(os.sep):
                current = current.setdefault(part, {})
        for file_name in files:
            file_path = os.path.join(root, file_name)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    current[file_name] = f.read()
            except Exception as e:
                current[file_name] = f"<ERROR reading file: {e}>"
    return result

# --- MAIN: build JSON ---
output = {}
for folder in FOLDERS_TO_READ:
    abs_path = os.path.join(PROJECT_ROOT, folder)
    if not os.path.exists(abs_path):
        print(f"Warning: folder does not exist -> {abs_path}")
        continue
    output[folder] = read_folder(abs_path)

# --- WRITE JSON ---
json_output_path = os.path.join(PROJECT_ROOT, "frontend_files.json")
with open(json_output_path, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2)

print(f"✅ JSON file created at {json_output_path}")
