# Contributing to Podacium

Welcome to the Podacium project! This document provides getting started instructions for human contributors.

> [!IMPORTANT]
> **Primary Source of Truth:**
> For detailed coding standards, quality gate thresholds, and rules of engagement, refer to:
>
> - [`AGENTS.md`](file:///home/zuikre/podacium/AGENTS.md) — Monorepo engineering rules, verify commands, testing requirements, and invariants.
> - [`DESIGN.md`](file:///home/zuikre/podacium/DESIGN.md) — UI/UX design system, tokens, and frontend invariants.
> - [`docs/ARCHITECTURE.md`](file:///home/zuikre/podacium/docs/ARCHITECTURE.md) — System architecture, data flow, and services.

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL client (`psql`) & Redis CLI (optional, for debugging)

### Quickstart

1. **Start Infrastructure (PostgreSQL 16 & Redis 7):**

   ```bash
   make dev-infra
   ```

2. **Start Backend & Frontend Services:**

   ```bash
   # Terminal 1: FastAPI Backend (:8000)
   make dev-api

   # Terminal 2: Next.js Frontend (:3001)
   make dev-web
   ```

3. **Database Setup:**
   ```bash
   make db-generate   # Generate Prisma Python client
   make db-migrate    # Apply database migrations
   ```

---

## Verification & Quality Gates

Run the relevant gates locally before pushing changes or opening a pull request:

```bash
make lint          # Lint backend (ruff) + frontend (eslint)
make typecheck     # Typecheck backend (mypy) + frontend (tsc)
make test          # Unit test suites (pytest + vitest)
make security-scan # Security auditing (bandit, semgrep, gitleaks, npm audit)
make perfect       # Lint + tests + repository self-audit gate
```

### End-to-End Testing (Playwright)

```bash
cd apps/web
npm run test:e2e       # Headless mode
npm run test:e2e:ui    # Interactive browser mode
```

---

## Repository Map

```
podacium/
├── apps/web/                 # Next.js 15 App Router frontend (TypeScript, Tailwind CSS 4)
│   ├── src/app/              # App Router pages and layouts
│   ├── src/components/       # UI components (use design-system/Podacium* components)
│   ├── src/lib/              # Custom i18n (src/lib/i18n.tsx), API client, utility functions
│   ├── src/hooks/            # TanStack Query & React hooks
│   └── locales/              # i18n dictionaries (en, fr, ar, kab)
├── services/api/             # FastAPI monolith backend
│   ├── app/routers/          # HTTP routers (thin controllers)
│   ├── app/services/         # Business logic layer
│   ├── app/schemas/          # Pydantic v2 validation models
│   ├── app/core/             # Auth, security, config, Prisma client
│   ├── app/middleware/       # Middleware pipeline (security, rate limiting, observability)
│   ├── app/tasks/            # Celery background jobs & schedules
│   └── prisma/               # Schema and migration history
├── infra/                    # Caddy, Nginx, Prometheus, Terraform configurations
├── docs/                     # Architecture documentation, ADRs, and runbooks
│   ├── adr/                  # Architecture Decision Records
│   └── runbooks/             # Operational deployment & on-call runbooks
├── docker-compose.yml        # Development infrastructure (postgres, redis)
└── Makefile                  # Quality gates and development commands
```

---

## Core Contribution Guidelines

1. **Named Exports Only:** All React components must use named exports (default exports only for `page.tsx`/`layout.tsx`).
2. **Design System:** Always use `Podacium*` design system components (`apps/web/src/components/design-system/`). Do not hand-roll custom lookalikes.
3. **Layered Backend Architecture:** Routers remain thin, services house domain logic, Pydantic v2 schemas validate boundaries, and Prisma handles data access.
4. **Git Workflow:**
   - Conventional commit messages only (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
   - Branch naming: `feat/...`, `fix/...`, `hotfix/...`.
   - Never commit secrets or edit generated files (`openapi.json`, `app/generated/prisma/`).
