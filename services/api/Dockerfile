# =============================================================================
# Multi-stage Dockerfile for Podacium API
# Stage 1: Build dependencies
# Stage 2: Production runtime (minimal image)
# =============================================================================

# --- Stage 1: Builder ---
FROM python:3.11-slim AS builder

WORKDIR /build

# System deps for building native extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements-prod.txt ./requirements.txt
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# --- Stage 2: Production Runtime ---
FROM python:3.11-slim AS runtime

WORKDIR /app

# Only runtime deps (no gcc, no build tools)
# libpq5: PostgreSQL client library
# libatomic1: required by Prisma CLI's embedded Node.js binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 libatomic1 curl && \
    rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy only what's needed — no secrets leak risk (no COPY . . )
# The .dockerignore further blocks .env, __pycache__, and other unwanted files.
COPY requirements-prod.txt ./requirements.txt
COPY app/ ./app/
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations/ ./prisma/migrations/

# Generate Prisma client and ensure binary has execute permissions
RUN prisma generate --schema=prisma/schema.prisma && \
    chmod -R a+rx /root/.cache/prisma-python && \
    find /root/.cache/prisma-python -name "query-engine*" -type f -exec chmod +x {} \; && \
    find /root/.cache/prisma-python -name "migration-engine*" -type f -exec chmod +x {} \;

# Non-root user for security
RUN useradd -m -r -s /bin/false appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
