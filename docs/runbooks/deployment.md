# Deployment Runbook

## Runtime Model (IMPORTANT)

| Thing                            | Runs under              | Notes                                                           |
| -------------------------------- | ----------------------- | --------------------------------------------------------------- |
| `podacium-web` (Next.js 15)      | **pm2**                 | `next start` on port 3000, cwd `/opt/podacium/apps/web`         |
| `podacium-api` (FastAPI/uvicorn) | **pm2**                 | via `start-api.sh`, uvicorn on 8000, 2 workers, venv `venv312/` |
| PostgreSQL, Redis                | **Docker Compose**      | infra only; also Celery worker/beat _if containerized_          |
| Reverse proxy                    | nginx (`/opt/podacium`) | TLS, CORS/static passthrough to FastAPI                         |

**The web and API tiers are NOT Docker containers in production.** They are processes managed by
pm2. Docker Compose is reserved for infrastructure (PostgreSQL, Redis) and optional Celery workers.
Do not `docker compose up` the `web` or `api` services in production — run them under pm2.

---

## Gated Deployment Decision Matrix

| Condition / Modified Path                                                        | Gate                           | Actions Executed                                                                                                                                                              | If Unchanged                   |
| :------------------------------------------------------------------------------- | :----------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------- |
| **`services/api/prisma/schema.prisma`** or **`services/api/prisma/migrations/`** | **Gate 1: DB Schema & Client** | • `prisma migrate deploy --schema prisma/schema.prisma`<br>• `prisma migrate status` (fails on pending/diverged history)<br>• `prisma generate --schema prisma/schema.prisma` | **BYPASS** (Saves ~15s)        |
| **`services/api/scripts/seed_*.py`** or **`services/api/app/core/seed_rbac.py`** | **Gate 2: Database Seeding**   | • `seed_platform_config.py`<br>• `seed_accounts.py` (`SEED_ALLOW_PROD=1`)<br>• `seed_courses.py`<br>• `python -m app.core.seed_rbac`                                          | **BYPASS** (Saves ~30s)        |
| **`apps/web/`** (Components, pages, locales, styles)                             | **Gate 3: Frontend Build**     | • `npm install --ignore-scripts` (if deps changed)<br>• `npm run build`<br>• `pm2 restart podacium-web --update-env`                                                          | **BYPASS** (Saves ~90s)        |
| **`services/api/app/`**, **`start-api.sh`**, or **`.env.prod`**                  | **Gate 4: Backend Process**    | • `pm2 restart podacium-api --update-env`                                                                                                                                     | **BYPASS** (Keeps API running) |

---

## Production Server Access

- SSH: `ssh podacium-vps` → `ssh root@212.47.79.68`
- Repo: `/opt/podacium`
- Env secrets: `/opt/podacium/.env.prod` and `/opt/podacium/secrets/` (both gitignored)
- pm2 apps: `podacium-api`, `podacium-web` (config: `ecosystem.config.js`)
- Reverse proxy: nginx serving `podacium.com`, `www.podacium.com`, `backend-api.podacium.com`

---

## Schema Changes: `migrate deploy`

Production history was **baselined on 2026-10-21**: `_prisma_migrations` now records all 27
migrations, and `prisma migrate status` reports “Database schema is up to date!”. From now on
**`prisma migrate deploy` is authoritative** and Gate 1 uses it; `db push` is no longer part of
the deploy path because it never records history.

Rules for schema changes:

- Every `schema.prisma` change must ship with a migration under `prisma/migrations/`.
- Back up the database (`pg_dump`) before a deploy that alters tables or indexes.
- Keep migration SQL idempotent (`IF NOT EXISTS`, guarded `DO` blocks) where practical.
- `migrate deploy` never accepts data loss implicitly: destructive DDL must be written in the
  migration itself and reviewed in the PR.
- `search_vector` (`User`, `Module`, `Project`) is a PostgreSQL `tsvector` maintained by SQL
  triggers. It is declared in `schema.prisma` as `Unsupported("tsvector")` so schema tooling
  preserves the columns and their GIN indexes.
- If a manual `db push` is ever used in an emergency, follow up immediately with
  `migrate resolve --applied <name>` for the affected migrations, otherwise history diverges.

---

## Automated (Canonical) Gated Deploy

Run the intelligent automated deploy script from the repository root:

```bash
./scripts/deploy.sh               # Auto-detects modified components and executes only required gates
./scripts/deploy.sh --force-all   # Force all gates: migrations, seeds, web build, restarts
./scripts/deploy.sh --force-db    # Force migration run + Prisma generate
./scripts/deploy.sh --force-seed  # Force platform, account, course & RBAC seeds
./scripts/deploy.sh --skip-seed   # Never run the destructive seed pipeline
./scripts/deploy.sh --force-web   # Force frontend rebuild
./scripts/deploy.sh --force-api   # Force backend restart
```

> **Seed gate is destructive:** `seed_courses.py` clears 12 education tables before recreating
> the catalog. When a seed file changed but you do not want to wipe enrollments/progress, pass
> `--skip-seed` (it overrides the auto-detection and `--force-all`).
>
> **Build memory:** Gate 3 pauses `podacium-api` when `MemAvailable` is below 4 GiB, then resumes
> it after the build (or after a failed build). This avoids the OOM kill that the Next.js build
> triggers on the 8 GB VPS alongside two uvicorn workers.

---

## Manual Step-by-Step Gated Deploy

1. **Local:** `git push v1 main` (use `v1` remote; `origin` is a broken host).
2. **SSH:** `podacium-vps`
3. **Pull & Diff:**
   ```bash
   cd /opt/podacium
   PREV_SHA=$(git rev-parse HEAD)
   git reset --hard origin/main && git pull origin main
   NEW_SHA=$(git rev-parse HEAD)
   git diff --name-only $PREV_SHA $NEW_SHA
   ```
4. **Gate 1 — Backend DB Schema (if `prisma/` changed):**
   ```bash
   cd /opt/podacium/services/api
   export PATH="$PWD/venv312/bin:$PATH"
   prod_url=$(grep -E "^DATABASE_URL=" /opt/podacium/.env.prod | sed -E "s|^DATABASE_URL=['\"]?([^'\"]*)['\"]?|\1|")
   export DATABASE_URL="$prod_url"
   ./venv312/bin/prisma migrate deploy --schema prisma/schema.prisma
   ./venv312/bin/prisma migrate status --schema prisma/schema.prisma
   ./venv312/bin/prisma generate --schema prisma/schema.prisma
   ```
5. **Gate 2 — Database Seeding (if seeds changed / after DB rebuild):**
   ```bash
   cd /opt/podacium/services/api
   export PATH="$PWD/venv312/bin:$PATH"
   export DATABASE_URL=$(grep -E "^DATABASE_URL=" /opt/podacium/.env.prod | sed -E 's|^DATABASE_URL="?([^"]*)"?|\1|')
   ./venv312/bin/python scripts/seed_platform_config.py
   SEED_ALLOW_PROD=1 ./venv312/bin/python seed_accounts.py
   ./venv312/bin/python scripts/seed_courses.py
   ./venv312/bin/python -m app.core.seed_rbac
   ```
6. **Gate 3 — Frontend Build (if `apps/web/` changed):**
   ```bash
   cd /opt/podacium/apps/web
   npm install --ignore-scripts --no-audit --no-fund
   npm run build
   ```
7. **Gate 4 — Restart pm2 & verify:**
   ```bash
   cd /opt/podacium
   pm2 restart podacium-api --update-env    # if backend changed
   pm2 restart podacium-web --update-env    # if frontend changed
   pm2 status
   curl -s http://127.0.0.1:8000/healthz
   curl -s -o /dev/null -w "Local Web: %{http_code}\n" http://127.0.0.1:3000
   ```

---

## Rollback

```bash
podacium-vps
cd /opt/podacium
git reset --hard <good-sha>     # or git reset --hard origin/main@{1}
./scripts/deploy.sh --force-all --no-push
```

---

## Post-Deployment Verification

1. `curl https://backend-api.podacium.com/healthz` (200 OK)
2. Visit https://podacium.com in an incognito window (200 OK)
3. Google OAuth login flow (CORS/`Access-Control-Allow-Origin` for `https://podacium.com`)
4. Sentry: check for new errors in last 5 min
5. `pm2 status` both apps `online`, restart counter not climbing
