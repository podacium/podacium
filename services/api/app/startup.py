"""
Application startup and shutdown lifecycle management.
Handles database connections, background tasks, Sentry initialization,
and production safety guards.
"""

import os
import logging
import asyncio
from contextlib import asynccontextmanager
from datetime import timedelta

from fastapi import FastAPI

from app.core.config import setting
from app.core.prisma import connect_prisma, disconnect_prisma, prisma
from app.core.redis_blocklist import token_blocklist
from app.services.oauth_state_store import oauth_state_store

logger = logging.getLogger(__name__)


def _validate_production_config() -> None:
    """
    Validate critical configuration for production environments.
    Raises RuntimeError if unsafe configuration is detected.
    """
    if setting.ENVIRONMENT == "production":
        # CRITICAL: Never allow mock payment gateway in production
        if setting.PAYMENT_GATEWAY == "mock":
            raise RuntimeError(
                "FATAL: PAYMENT_GATEWAY=mock is not allowed in production. "
                "Set PAYMENT_GATEWAY to 'chargily', 'satim', 'cib', or 'edahabia'."
            )

        # CRITICAL: Ensure JWT secret is not a default/test value
        if setting.JWT_SECRET_KEY in (
            "test_secret_key_for_ci_only",
            "CHANGE_ME_generate_with_openssl_rand_hex_64",
        ):
            raise RuntimeError(
                "FATAL: JWT_SECRET_KEY is set to a default/test value in production. "
                "Generate a real secret: openssl rand -hex 64"
            )

        # CRITICAL: HS256 uses a symmetric key — if compromised, all tokens can be
        # forged by anyone who obtains the shared secret. RS256 (asymmetric) limits
        # the blast radius: the private key signs, the public key verifies. Even if
        # the public key leaks, tokens cannot be forged.
        if setting.JWT_ALGORITHM == "HS256":
            # In production this is a hard blocker. Developers can still use HS256
            # locally for convenience by setting ENVIRONMENT=development.
            raise RuntimeError(
                "FATAL: JWT_ALGORITHM=HS256 is not allowed in production. "
                "Set JWT_ALGORITHM=RS256 with JWT_PRIVATE_KEY and JWT_PUBLIC_KEY "
                "(PEM-encoded). Generate a keypair:\n"
                "  openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048\n"
                "  openssl rsa -pubout -in private.pem -out public.pem\n"
                "Then base64-encode each and set as JWT_PRIVATE_KEY / JWT_PUBLIC_KEY."
            )

        # CRITICAL: If RS256/ES256 is configured, the private key MUST be present
        # in ALL environments (not just production). Without it, token creation
        # will crash at runtime. We fail fast here so the developer knows immediately.
        if setting.JWT_ALGORITHM.startswith(("RS", "ES")):
            if not setting.JWT_PRIVATE_KEY or not setting.JWT_PUBLIC_KEY:
                raise RuntimeError(
                    f"FATAL: JWT_ALGORITHM={setting.JWT_ALGORITHM} requires both "
                    "JWT_PRIVATE_KEY and JWT_PUBLIC_KEY to be set (PEM-encoded). "
                    "Generate a keypair:\n"
                    "  openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048\n"
                    "  openssl rsa -pubout -in private.pem -out public.pem\n"
                    "Then set the contents as JWT_PRIVATE_KEY and JWT_PUBLIC_KEY."
                )

        # CRITICAL: Ensure SECRET_KEY is not empty or a default/test value
        if not setting.SECRET_KEY:
            raise RuntimeError(
                "FATAL: SECRET_KEY is empty. Generate a real secret: openssl rand -hex 32"
            )
        if setting.SECRET_KEY in (
            "test_secret_for_ci",
            "CHANGE_ME_generate_with_openssl_rand_hex_32",
        ):
            raise RuntimeError(
                "FATAL: SECRET_KEY is set to a default/test value in production. "
                "Generate a real secret: openssl rand -hex 32"
            )

        # WARN: Debug mode should never be on in production
        if setting.DEBUG:
            logger.warning(
                "⚠️  DEBUG=True in production — this exposes stack traces to users"
            )

        if setting.CORS_ORIGINS_RAW:
            raw = setting.CORS_ORIGINS_RAW
            if (
                "localhost" in raw
                or "127.0.0.1" in raw
                or not raw.startswith("https://")
            ):
                logger.warning(f"⚠️  CORS_ORIGINS_RAW contains non-HTTPS origins: {raw}")
        else:
            for origin in setting.CORS_ORIGINS:
                if "localhost" in origin or "127.0.0.1" in origin:
                    logger.warning(f"⚠️  CORS default list contains localhost: {origin}")


def init_sentry():
    """Initialize Sentry error tracking if DSN is configured."""
    if not setting.SENTRY_DSN:
        return

    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=setting.SENTRY_DSN,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            StarletteIntegration(transaction_style="endpoint"),
        ],
        traces_sample_rate=setting.SENTRY_TRACES_SAMPLE_RATE,
        environment=setting.ENVIRONMENT,
        release="podacium-api@1.0.0",
        send_default_pii=setting.SENTRY_SEND_DEFAULT_PII,
        enable_logs=setting.SENTRY_ENABLE_LOGS,
        profile_session_sample_rate=setting.SENTRY_PROFILE_SESSION_SAMPLE_RATE,
    )
    logger.info("Sentry initialized for error tracking")


async def _ensure_search_vector_support() -> None:
    """Ensure tsvector columns, GIN indexes, triggers, and backfills exist.

    Safe to run on every boot. The API starts two uvicorn workers that execute
    this concurrently, so a transaction-scoped advisory lock serializes the DDL
    (without it, Postgres aborts one worker with "tuple concurrently updated").

    The columns are also declared in schema.prisma as Unsupported("tsvector")
    so migrations/`db push` preserve them. This helper still matters for
    databases created with `db push`, which does not create the SQL triggers.
    """
    async with prisma.tx(
        max_wait=timedelta(seconds=30),
        timeout=timedelta(seconds=120),
    ) as tx:
        await tx.execute_raw(
            "SELECT pg_advisory_xact_lock(hashtext('podacium:search-vector-init'));"
        )
        await tx.execute_raw(
            'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;'
        )
        await tx.execute_raw(
            'ALTER TABLE "Module" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;'
        )
        await tx.execute_raw(
            'ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;'
        )
        await tx.execute_raw(
            'CREATE INDEX IF NOT EXISTS "user_search_idx" '
            'ON "User" USING GIN ("search_vector");'
        )
        await tx.execute_raw(
            'CREATE INDEX IF NOT EXISTS "module_search_idx" '
            'ON "Module" USING GIN ("search_vector");'
        )
        await tx.execute_raw(
            'CREATE INDEX IF NOT EXISTS "project_search_idx" '
            'ON "Project" USING GIN ("search_vector");'
        )
        await tx.execute_raw(
            "CREATE OR REPLACE FUNCTION module_search_vector_update() RETURNS trigger AS $$ "
            "BEGIN "
            '  NEW."search_vector" := '
            "    setweight(to_tsvector('simple', COALESCE(NEW.\"title\", '')), 'A') || "
            "    setweight(to_tsvector('simple', COALESCE(NEW.\"description\", '')), 'B') || "
            "    setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.\"skills\", ' '), '')), 'C') || "
            "    setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.\"tags\", ' '), '')), 'C'); "
            "  RETURN NEW; "
            "END; "
            "$$ LANGUAGE plpgsql;"
        )
        await tx.execute_raw('DROP TRIGGER IF EXISTS module_search_update ON "Module";')
        await tx.execute_raw(
            "CREATE TRIGGER module_search_update "
            '  BEFORE INSERT OR UPDATE OF "title", "description", "skills", "tags" '
            '  ON "Module" FOR EACH ROW '
            "  EXECUTE FUNCTION module_search_vector_update();"
        )
        await tx.execute_raw(
            "CREATE OR REPLACE FUNCTION project_search_vector_update() RETURNS trigger AS $$ "
            "BEGIN "
            '  NEW."search_vector" := '
            "    setweight(to_tsvector('simple', COALESCE(NEW.\"title\", '')), 'A') || "
            "    setweight(to_tsvector('simple', COALESCE(NEW.\"description\", '')), 'B') || "
            "    setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.\"skills\", ' '), '')), 'C'); "
            "  RETURN NEW; "
            "END; "
            "$$ LANGUAGE plpgsql;"
        )
        await tx.execute_raw(
            'DROP TRIGGER IF EXISTS project_search_update ON "Project";'
        )
        await tx.execute_raw(
            "CREATE TRIGGER project_search_update "
            '  BEFORE INSERT OR UPDATE OF "title", "description", "skills" '
            '  ON "Project" FOR EACH ROW '
            "  EXECUTE FUNCTION project_search_vector_update();"
        )
        await tx.execute_raw(
            'UPDATE "Module" SET "search_vector" = '
            "  setweight(to_tsvector('simple', COALESCE(\"title\", '')), 'A') || "
            "  setweight(to_tsvector('simple', COALESCE(\"description\", '')), 'B') || "
            "  setweight(to_tsvector('simple', COALESCE(array_to_string(\"skills\", ' '), '')), 'C') || "
            "  setweight(to_tsvector('simple', COALESCE(array_to_string(\"tags\", ' '), '')), 'C') "
            'WHERE "search_vector" IS NULL;'
        )
        await tx.execute_raw(
            'UPDATE "Project" SET "search_vector" = '
            "  setweight(to_tsvector('simple', COALESCE(\"title\", '')), 'A') || "
            "  setweight(to_tsvector('simple', COALESCE(\"description\", '')), 'B') || "
            "  setweight(to_tsvector('simple', COALESCE(array_to_string(\"skills\", ' '), '')), 'C') "
            'WHERE "search_vector" IS NULL;'
        )
        await tx.execute_raw(
            'UPDATE "User" SET "search_vector" = '
            "  setweight(to_tsvector('simple', COALESCE(\"fullName\", '')), 'A') || "
            "  setweight(to_tsvector('simple', COALESCE(\"bio\", '')), 'B') || "
            "  setweight(to_tsvector('simple', COALESCE(array_to_string(\"skills\", ' '), '')), 'C') "
            'WHERE "search_vector" IS NULL;'
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown hooks."""
    # --- Startup ---
    logger.info("Starting Podacium API...")

    # CRITICAL: Guard against CSP bypass via dev-mode misconfiguration.
    # This runs even in dev/test to catch accidental deployment with weak CSP.
    # In production, 'unsafe-eval' in CSP would allow script injection.
    env_raw = os.environ.get("ENVIRONMENT", "").lower()
    if setting.ENVIRONMENT == "production" and env_raw in ("development", "dev", ""):
        raise RuntimeError(
            "FATAL: ENVIRONMENT resolves to 'development' (or empty) while "
            "setting.ENVIRONMENT is 'production'. This disables CSP protections "
            "(allows 'unsafe-eval'). Set the ENVIRONMENT env var to 'production'."
        )

    # Production safety checks (will raise RuntimeError if critical issues found)
    _validate_production_config()

    # Verify Redis connectivity (critical — rate limiter, blocklist, OAuth state, caching all depend on it)
    if setting.REDIS_URL:
        try:
            import redis.asyncio as aioredis

            r = aioredis.from_url(
                setting.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            await r.ping()
            await r.close()
            logger.info("Redis connection verified")
        except Exception as e:
            logger.critical(
                f"Redis connection FAILED: {e}. "
                f"The rate limiter will fall back to a per-instance in-memory store, "
                f"which does NOT work across multiple workers. "
                f"Fix Redis connectivity or set REDIS_URL correctly."
            )

    # Connect Redis blocklist
    try:
        await token_blocklist.connect()
    except Exception as e:
        logger.warning(f"Redis blocklist connection failed (degraded mode): {e}")

    # Connect OAuth state store (same Redis, separate key namespace)
    try:
        await oauth_state_store.connect()
    except Exception as e:
        logger.warning(f"OAuth state store connection failed (degraded mode): {e}")

    # Connect Redis Pub/Sub for distributed WebSockets across multi-workers
    try:
        from app.routers.websocket import redis_pubsub

        await redis_pubsub.connect()
    except Exception as e:
        logger.warning(f"Redis Pub/Sub connection failed (local mode): {e}")

    # Pre-connect entitlement service Redis cache pool
    try:
        from app.services.billing_services.entitlement_service import (
            entitlement_service,
        )

        await entitlement_service.connect()
    except Exception as e:
        logger.warning(
            f"Entitlement service Redis connection failed (degraded mode): {e}"
        )

    # Connect database
    try:
        await connect_prisma()
        logger.info("Database connected successfully")

        # Ensure fulltext search columns/triggers exist (worker-safe).
        try:
            await _ensure_search_vector_support()
        except Exception as e:
            logger.warning(f"Failed to ensure search_vector columns or triggers: {e}")

        try:
            user_count = await prisma.user.count()
            logger.info(f"Database verified: {user_count} users")
        except Exception as e:
            logger.warning(f"Database verification failed: {e}")

    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        logger.warning("Application running without database connection")

    # Start background tasks
    from app.tasks.certificate_backfill import certificate_backfill_loop
    from app.tasks.cleanup_idempotency_keys import idempotency_cleanup_loop

    _cert_task = asyncio.create_task(certificate_backfill_loop())
    _idemp_cleanup_task = asyncio.create_task(idempotency_cleanup_loop())

    # B7: keep the Prisma pool-waiting gauge fresh from the query engine's own
    # metrics. On failure (engine metrics disabled/unreachable) publish -1 so the
    # >5 alert never fires on a broken probe — it fires on a real backlog.
    async def _prisma_pool_metrics_loop() -> None:
        from app.middleware.metrics import PRISMA_POOL_WAITING_QUERIES

        while True:
            try:
                if prisma.is_connected():
                    m = await prisma._engine.metrics(format="json")  # type: ignore[attr-defined]
                    for gauge in (m or {}).get("gauges", []):
                        if gauge.get("key") == "prisma_datasource_queries_waiting":
                            PRISMA_POOL_WAITING_QUERIES.set(
                                float(gauge.get("value", 0))
                            )
                            break
            except Exception:
                PRISMA_POOL_WAITING_QUERIES.set(-1)
            await asyncio.sleep(5)

    _prisma_metrics_task = asyncio.create_task(_prisma_pool_metrics_loop())

    # B8: verify external service config + reachability on boot (strict in prod).
    if setting.ENVIRONMENT != "test":
        try:
            from app.scripts.startup_check import run_startup_checks

            await run_startup_checks(strict=setting.ENVIRONMENT == "production")
        except RuntimeError:
            raise
        except Exception as e:
            logger.warning(f"startup_check could not run: {e}")

    # Force garbage collection to free import/boot allocation memory
    import gc

    gc.collect()

    yield  # Application runs here

    # --- Shutdown ---
    _cert_task.cancel()
    _idemp_cleanup_task.cancel()
    _prisma_metrics_task.cancel()
    try:
        await _cert_task
    except asyncio.CancelledError:
        pass
    try:
        await _idemp_cleanup_task
    except asyncio.CancelledError:
        pass
    try:
        await _prisma_metrics_task
    except asyncio.CancelledError:
        pass

    # Close Redis blocklist
    try:
        await token_blocklist.close()
    except Exception:
        pass

    # Close OAuth state store
    try:
        await oauth_state_store.close()
    except Exception:
        pass

    # Close Redis Pub/Sub
    try:
        from app.routers.websocket import redis_pubsub

        if redis_pubsub._pubsub:
            await redis_pubsub._pubsub.unsubscribe("ws_distributed")
        if redis_pubsub._redis:
            await redis_pubsub._redis.close()
    except Exception:
        pass

    # Close entitlement service Redis pool
    try:
        from app.services.billing_services.entitlement_service import (
            entitlement_service,
        )

        await entitlement_service.disconnect()
    except Exception:
        pass

    # Close the rate-limiter's Redis connection pool (B8)
    try:
        pool = getattr(app.state, "redis_pool", None)
        if pool is not None:
            await pool.aclose()
            app.state.redis_pool = None
            logger.info("Rate-limiter Redis pool closed")
    except Exception:
        pass

    try:
        await disconnect_prisma()
        logger.info("Database disconnected")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

    # Close external HTTP clients
    try:
        from app.services.payment_providers.chargily import chargily_client

        await chargily_client.close()
    except Exception:
        pass
    try:
        from app.services.whatsapp_service import whatsapp_service

        await whatsapp_service.close()
    except Exception:
        pass
