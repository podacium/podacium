# AGENTS.md

Podacium is an Algerian EdTech, freelancing, and business-intelligence platform. This is a
hybrid monorepo: a Next.js frontend (`apps/web`) and a single FastAPI backend (`services/api`).
Turbo drives the npm workspace; a root `Makefile` drives quality gates for both sides.

These are instructions for AI coding agents. Read the entire file before editing anything.
The universal source of truth is `AGENTS.md`; `CLAUDE.md` holds Claude-Code-specific
coordination rules and may import this file.

## Orientation

| Topic                                         | Where                                              |
| --------------------------------------------- | -------------------------------------------------- |
| Design system, colors, UI/UX, invariants      | `DESIGN.md` (read before UI or structural changes) |
| System architecture & data flow               | `docs/ARCHITECTURE.md`                             |
| Decision records (why things are as they are) | `docs/adr/`                                        |
| Setup & usage for humans                      | `README.md`                                        |
| Marketing skills & growth operating system    | `.agent/skills/MARKETING_SKILLS_INDEX.md`          |
| Branch strategy                               | `docs/branch-strategy.md`                          |
| API contract                                  | `openapi.json` (generated — never hand-edit)       |

> **Marketing & Growth Operations**: When performing marketing tasks, first read `.agent/skills/MARKETING_SKILLS_INDEX.md` and load the relevant `SKILL.md` files.

## Commands

Node ≥ 20, Python 3.11. Package manager is **npm** (CI runs `npm ci`). The API venv lives at
`services/api/podacium/` (most `make` targets call its binaries directly).

```bash
# Install
npm install                      # web + root tooling (workspaces: apps/*)
cd services/api && pip install -r requirements-dev.txt   # after creating venv

# Dev (infra first: postgres + redis on 127.0.0.1)
make dev-infra                   # docker compose up -d postgres redis
make dev-api                     # uvicorn app.main:app on :8000 --reload
make dev-web                     # next dev on :3001 --turbopack
make dev                         # prints instructions to run both

# Verify (run the relevant ones before declaring work complete)
make lint                        # ruff (api) + eslint (web)
make typecheck                   # mypy (api) + tsc --noEmit (web)
make test                        # pytest (api) + vitest (web)
make security-scan               # bandit, safety, semgrep, gitleaks, npm audit, ...
make audit                       # full gate: lint + typecheck + security-scan + tests
make perfect                     # lint + tests + scripts/self-audit.py

# Build
make build                       # docker build api + next build (web also runs tsc --noEmit)

# Database (Prisma — schema at services/api/prisma/schema.prisma)
make db-generate                 # regenerate Prisma client (after schema edits)
make db-migrate                  # prisma migrate deploy
make db-studio                   # prisma studio

# OpenAPI
make openapi-gen                 # regenerate openapi.json (never edit it by hand)
```

Web-only shortcuts (`cd apps/web`): `npm run lint`, `npm run test` (vitest), `npm run type-check`,
`npm run build`, `npm test -- path/to/file.test.tsx` for a single file.
API-only shortcuts (`cd services/api`): `./podacium/bin/pytest tests/ -v --tb=short`,
`./podacium/bin/ruff check app/ --exclude app/generated/`.

CI also enforces: API pytest coverage ≥ 75%, vitest thresholds 70/60/70/70 (statements/
branches/functions/lines), Playwright e2e, k6 performance gate, Lighthouse, mutation score ≥ 50%,
OWASP ZAP DAST, and secrets scans (gitleaks, trufflehog, detect-secrets). Match these locally.

## Repository map

- `apps/web` — Next.js 15 (App Router) / React 18 / TypeScript / Tailwind CSS 4.
  `src/app/` routes, `src/components/design-system/` (`Podacium*` components),
  `src/lib/` (i18n, api client, animation presets), `src/hooks/` (TanStack Query), `locales/{en,fr,ar,kab}/`.
- `services/api` — FastAPI + Prisma + Celery monolith.
  `app/routers/` (thin HTTP), `app/services/` (business logic), `app/schemas/` (Pydantic v2),
  `app/core/` (config, security, auth deps, prisma client), `app/middleware/`, `app/tasks/` (Celery),
  `app/generated/prisma/` (generated client — never edit), `prisma/schema.prisma` + `prisma/migrations/`.
- `infra/` — Caddy, Coraza WAF, Prometheus, Terraform, systemd. `k8s/` — Kubernetes manifests.
- `docs/` — ADRs, architecture, runbooks. `scripts/` — ops/QA tooling. `openapi.json` — generated spec.
- `secrets/`, `uploads/`, `storage/` — runtime/data dirs; `secrets/` is gitignored except examples.

## Code style

### Frontend (apps/web)

- Functional components only; **named exports** (default exports only for `page.tsx`/`layout.tsx`).
- TypeScript strict; `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge) for conditional classes.
- **Use the `Podacium*` design-system components** (`src/components/design-system/`) for buttons,
  cards, inputs, badges, tabs, modals, etc. Do not hand-roll lookalikes. See `DESIGN.md`.
- Tailwind v4 CSS-first: tokens live in `src/app/globals.css` under `@theme` and `:root`
  (`--primary`, `--muted`, `--radius`, …). Prefer tokens over raw hex. Extend the design system
  only via `class-variance-authority` variants on existing components.
- **i18n**: always use the custom system — `useTranslations`/`useLocale`/`useBidi` from
  `src/lib/i18n.tsx`, keys in `locales/<locale>/`. Do not add new translation libraries.
- **RTL**: Arabic (`ar`) renders RTL with Baloo Bhaijaan 2. Use logical utilities
  (`ms-*`, `me-*`, `start-*`, `end-*`, `rtl:*`) and test both directions.
- Server data: TanStack Query hooks in `src/hooks/`; client state: React Context.
  Do not introduce new state libraries (zustand/swr are present but not the active systems).
- Unit tests: co-located `*.test.tsx` next to components (vitest + testing-library).
  Add tests for any new component/logic; keep CI thresholds green.

### Backend (services/api)

- Layering: **routers are thin** (HTTP in/out, call services) → **services hold business logic** →
  Pydantic v2 schemas validate at the boundary → Prisma for all data access. Never put business
  logic in routers, never use raw SQL where Prisma works.
- Pydantic v2 (`app/schemas/`) for every request/response shape; `extra="ignore"` where appropriate.
- Auth via dependencies from `app/core/auth.py` (`get_current_user`, `get_current_admin_user`, …).
- Error handling: convert `ValueError` → 400, re-raise `HTTPException`, generic → 500 with a
  structured `{"detail": {...}}`. Domain errors extend a base error with a `code`.
- Async-first (FastAPI + Prisma). Type hints everywhere (mypy must pass). Python 3.11.
- Formatting: `ruff format`; lint `ruff check`. Match surrounding code.

## Testing requirements

- **Frontend**: add/update co-located `.test.tsx` for changed components. Run `npm run test`
  and `npm run type-check`. Playwright e2e exists for critical flows (`npm run test:e2e`).
- **Backend**: add/update `tests/test_*.py` for changed behavior (unit for logic, integration for
  DB flows, `-k "integration or contract or api"` for the CI contract suite). Run
  `./podacium/bin/pytest tests/ -v --tb=short`. Coverage ≥ 75% on `app/` (excludes `generated`, `tasks`).
- **Rules**: never delete a failing test to make CI pass. Do not mock the real database in
  integration tests — use the test Postgres. `factory-boy` for test data.

## Git workflow

- Conventional commits only: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`,
  `build:`, `ci:`, `chore:`, `revert:` (enforced by commitlint + husky). Example: `fix(auth): block HS256 in prod`.
- Branch naming: `feat/...`, `fix/...`, `hotfix/...` (kebab-case). Never commit directly to `main`
  (blocked by pre-commit + branch protection); feature branches merge to `develop`.
- Pre-commit (husky + lint-staged) auto-formats: prettier on `*.md`, ruff on `*.py`,
  eslint + prettier on web `*.{js,jsx,ts,tsx}`. Ruff is also run from pre-commit.
- Do not commit without a conventional, descriptive message; never `--no-verify` unless asked.

## Boundaries

**Always do**

- Run the relevant lint/typecheck/tests before declaring a change complete (see Commands).
- Use the `Podacium*` design-system components and existing design tokens (`DESIGN.md`).
- Add tests for new code; keep coverage/quality gates green.
- Read `DESIGN.md` before UI changes and before structural changes; read `docs/adr/` when touching
  areas covered by a decision record (auth, websockets, middleware, file uploads, infra).

**Ask first**

- Database schema changes (`prisma/schema.prisma`) or migration changes.
- Adding/removing dependencies (update the correct lockfile via `npm install`, never `yarn`).
- Anything in `infra/`, `k8s/`, `.github/workflows/`, `docker-compose*.yml`, or CI config.
- Changing auth/security behavior (JWT, cookies, middleware, rate limiting, payment gateways).
- Introducing a new external service or a new system-wide library.

**Never do**

- Commit secrets: no `.env`, `.env.*`, `secrets/*` values, API keys, or private keys (blocked by
  pre-commit + CI secret scans). Reference env var _names_ only.
- Edit `services/api/app/generated/prisma/` — it is generated (`make db-generate`).
- Edit an existing migration in `prisma/migrations/` — migrations are append-only.
- Hand-edit `openapi.json` (generated via `make openapi-gen`), `package-lock.json`/`yarn.lock` by hand,
  `ruvector.db`, `dump.rdb`, or `node_modules/`.
- Use yarn in this repo (npm only).
- "Fix" things DESIGN.md lists as intentional (e.g., dark mode not yet wired, custom i18n).

## Completion report

When finishing a task, report: what changed (file paths), which verification commands ran and their
result, and any deviation from these instructions. If a gate cannot pass locally, say so explicitly
instead of claiming success.
