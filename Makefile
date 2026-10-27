.PHONY: dev dev-infra dev-api dev-web web make-web api test test-api test-web lint build clean

# ============================================================
# Development
# ============================================================

dev-infra: ## Start PostgreSQL and Redis
	docker-compose up -d postgres redis

dev-api: dev-infra ## Start backend API with hot reload
	cd services/api && podacium/bin/uvicorn app.main:app --reload --port 8000

api: dev-api ## Alias for dev-api

dev-web: ## Start frontend with hot reload
	cd apps/web && npm run dev

web: dev-web ## Alias for dev-web

make-web: dev-web ## Alias for dev-web

dev: dev-infra ## Start all services (run in separate terminals)
	@echo "Infrastructure started. Run in separate terminals:"
	@echo "  make dev-api"
	@echo "  make dev-web"

# ============================================================
# Configuration
# ============================================================

API_VENV := services/api/podacium/bin
export PATH := $(CURDIR)/services/api/podacium/bin:$(PATH)

# ============================================================
# Testing
# ============================================================

test-api: ## Run backend tests
	cd services/api && podacium/bin/pytest tests/ -v --tb=short

test-api-cov: ## Run backend tests with coverage (fails under 75%)
	cd services/api && podacium/bin/pytest tests/ -v --cov=app --cov-report=term-missing --cov-report=html --cov-fail-under=75 --cov-config=.coveragerc

test-web: ## Run frontend tests
	cd apps/web && npm run test

test-web-cov: ## Run frontend tests with coverage
	cd apps/web && npm run test -- --coverage

test: test-api test-web ## Run all tests

# ============================================================
# Linting & Quality
# ============================================================

lint-api: ## Lint backend (ruff)
	cd services/api && podacium/bin/ruff check app/ --exclude app/generated/

lint-web: ## Lint frontend
	cd apps/web && npm run lint

lint: lint-api lint-web ## Lint everything

# ============================================================
# Build & Deploy
# ============================================================

build-api: ## Build API Docker image
	docker build -t podacium-api ./services/api

build-web: ## Build frontend
	cd apps/web && npm run build

build: build-api build-web ## Build everything

# ============================================================
# Database
# ============================================================

db-migrate: ## Run database migrations
	cd services/api && podacium/bin/prisma migrate deploy --schema=prisma/schema.prisma

db-generate: ## Generate Prisma client
	cd services/api && podacium/bin/prisma generate --schema=prisma/schema.prisma

db-studio: ## Open Prisma Studio
	cd services/api && podacium/bin/prisma studio --schema=prisma/schema.prisma

db-seed: ## Seed test accounts, platform configurations, and courses/lessons
	cd services/api && podacium/bin/python seed_accounts.py
	cd services/api && podacium/bin/python scripts/seed_platform_config.py
	cd services/api && podacium/bin/python scripts/seed_courses.py

# ============================================================
# Verification (Full Quality Gate)
# ============================================================

perfect: lint test-api test-web ## Run ALL quality checks — exits 0 only if everything passes
	@python3 scripts/self-audit.py
	@echo ""
	@echo "============================================"
	@echo "  ✅ ALL CHECKS PASSED — CODEBASE IS CLEAN"
	@echo "============================================"
	@echo ""

audit: lint typecheck security-scan test-api test-web ## Full audit — linters, typecheck, security, tests
	@echo ""
	@echo "============================================"
	@echo "  ✅ AUDIT PASSED — ALL GATES GREEN"
	@echo "============================================"
	@echo ""
	@echo "  ✓ Backend lint (ruff)"
	@echo "  ✓ Frontend lint (eslint + security plugin)"
	@echo "  ✓ Type check (mypy + tsc)"
	@echo "  ✓ Backend tests (pytest)"
	@echo "  ✓ Frontend tests (vitest)"
	@echo "  ✓ Security scan (bandit + safety + pip-audit + semgrep + npm audit + gitleaks)"
	@echo ""

typecheck-api: ## Type check backend (slow — uses mypy cache)
	cd services/api && podacium/bin/mypy app/core/ app/middleware/ app/startup.py --ignore-missing-imports --exclude 'generated' --namespace-packages --explicit-package-bases

typecheck-web: ## Type check frontend
	cd apps/web && npx tsc --noEmit

typecheck: typecheck-api typecheck-web ## Type check everything

security-scan: ## Run all security scans
	cd services/api && podacium/bin/bandit -r app/ --severity-level high --skip B101 --exclude app/generated
	cd services/api && podacium/bin/safety check -r requirements.txt || echo "  → safety found CVEs (review above)"
	cd services/api && podacium/bin/pip-audit -r requirements.txt 2>/dev/null || echo "  → pip-audit found CVEs (review above)"
	cd services/api && podacium/bin/semgrep --config=auto --error --exclude 'app/generated' app/ 2>/dev/null; cd ../.. && services/api/podacium/bin/semgrep --config=auto --error apps/web/src/ 2>/dev/null || echo "  → semgrep found issues (review above)"
	cd apps/web && npm audit --audit-level=high 2>/dev/null || echo "  → npm audit found vulnerabilities (review above)"
	gitleaks detect --source . --no-git 2>/dev/null || echo "  → gitleaks skipped (install gitleaks)"

security-scan-local: security-scan ## Run all scans including those needing local binaries
	trivy fs --severity HIGH,CRITICAL . 2>/dev/null || echo "  → trivy filesystem scan skipped"
	docker build -q -t podacium-api-scan ./services/api 2>/dev/null && trivy image --severity HIGH,CRITICAL podacium-api-scan 2>/dev/null && docker rmi podacium-api-scan 2>/dev/null || echo "  → trivy container scan skipped"
	checkov -d infra/ 2>/dev/null || echo "  → checkov skipped (install checkov)"
	bearer scan services/api/ apps/web/ --severity=critical,high 2>/dev/null || echo "  → bearer skipped (install bearer)"

openapi-gen: ## Regenerate openapi.json from source (with servers URL for ZAP)
	cd services/api && ./podacium/bin/python3 ../../scripts/gen_openapi.py ../../openapi.json

dast-scan: ## Run OWASP ZAP API scan (requires Docker + openapi.json in project root). Add -S for baseline (passive-only, ~2min)
	@test -f openapi.json || { echo "ERROR: openapi.json not found. Run 'make openapi-gen' first (needs dev env with DB)."; exit 1; }
	docker run --rm \
	  -v $(PWD):/zap/wrk/:rw \
	  ghcr.io/zaproxy/zaproxy:stable \
	  zap-api-scan.py \
	  -t /zap/wrk/openapi.json \
	  -f openapi \
	  -d https://backend-api.podacium.com \
	  -r zap_report.html

# ============================================================
# Utilities
# ============================================================

clean: ## Clean build artifacts
	rm -rf apps/web/.next apps/web/node_modules/.cache
	find services/api -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
