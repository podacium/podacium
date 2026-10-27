import os

os.environ.pop("CORS_ORIGINS", None)
from typing import Optional, List
from dotenv import load_dotenv
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

for path in [
    "/opt/podacium/.env.prod",
    "/opt/podacium/.env",
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        ".env.prod",
    ),
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        ".env",
    ),
]:
    if os.path.exists(path):
        load_dotenv(path, override=False)


from enum import Enum


class FinancialMode(str, Enum):
    NON_CUSTODIAL = "NON_CUSTODIAL"
    LICENSED_PSP = "LICENSED_PSP"


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────────
    APP_NAME: str = "TamWheel API"
    PROJECT_NAME: str = "TamWheel API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    PORT: int = 8000
    # Financial mode gatekeeper: NON_CUSTODIAL (default for launch) vs LICENSED_PSP
    FINANCIAL_MODE: FinancialMode = FinancialMode.NON_CUSTODIAL
    AUTO_ATTESTATION_TIMEOUT_HOURS: int = 72
    PLATFORM_NIF: str = "002016012345678"
    PLATFORM_NIS: str = "002016012345678"
    PLATFORM_RC: str = "16/00-1234567B20"
    PLATFORM_ARTICLE_IMPOSITION: str = "16012345678"
    PLATFORM_TVA_RATE: float = 0.19
    # Redis-backed fail-closed rate limiting. Enabled by default everywhere;
    # the test suite disables it so batch test runs aren't throttled (all
    # tests share one client IP per time window).
    RATE_LIMIT_ENABLED: bool = True
    BASE_URL: str = ""
    FRONTEND_URL: str = ""
    SECRET_KEY: str = "CHANGE_ME_generate_with_openssl_rand_hex_32"
    TURNSTILE_SITE_KEY: str = "0x4AAAAAAEwKsAwhy0wmVegg"
    TURNSTILE_SECRET_KEY: str = ""

    # ── Database ─────────────────────────────────────────────────────────
    DATABASE_URL: str = ""
    DB_HOST: str = ""
    DB_PORT: str = "5432"
    DB_NAME: str = ""
    DB_USER: str = ""
    DB_PASSWORD_FILE: str = ""

    # ── Auth / JWT ───────────────────────────────────────────────────────
    # CURRENT ALGORITHM: HS256 (symmetric, shared secret)
    #
    # RS256 MIGRATION PATH:
    #   1. Generate an RSA keypair:
    #      openssl genrsa -out private.pem 2048
    #      openssl rsa -in private.pem -pubout -out public.pem
    #   2. Set JWT_ALGORITHM=RS256, JWT_PRIVATE_KEY and JWT_PUBLIC_KEY
    #   3. The verify_token() function will try RS256 first, then fall back
    #      to HS256 for tokens signed before the migration. This ensures
    #      zero-downtime key rotation — existing sessions remain valid until
    #      their tokens expire naturally.
    #   4. After all old HS256 tokens have expired (14 days), HS256 fallback
    #      can be disabled by clearing JWT_SECRET_KEY (optional).
    JWT_SECRET_KEY: str = "CHANGE_ME_generate_with_openssl_rand_hex_64"
    JWT_ALGORITHM: str = "HS256"
    JWT_PUBLIC_KEY: Optional[str] = None
    JWT_PRIVATE_KEY: Optional[str] = None
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 14
    RESET_TOKEN_EXPIRE_HOURS: int = 1
    VERIFICATION_TOKEN_EXPIRE_HOURS: int = 1
    COOKIE_DOMAIN: Optional[str] = None
    EDGE_AUTH_SECRET: Optional[str] = None

    # ── OAuth ────────────────────────────────────────────────────────────
    OAUTH_STATE_SECRET: str = "CHANGE_ME_generate_with_openssl_rand_hex_32"
    FRONTEND_OAUTH_REDIRECT_URL: str = ""
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = None
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GITHUB_REDIRECT_URI: Optional[str] = None
    LINKEDIN_CLIENT_ID: Optional[str] = None
    LINKEDIN_CLIENT_SECRET: Optional[str] = None
    LINKEDIN_REDIRECT_URI: Optional[str] = None

    # ── CORS (env-configurable with safe defaults) ───────────────────────
    CORS_ORIGINS_RAW: Optional[str] = None

    @property
    def CORS_ORIGINS(self) -> List[str]:
        if self.CORS_ORIGINS_RAW:
            return [o.strip() for o in self.CORS_ORIGINS_RAW.split(",") if o.strip()]
        return [
            "https://www.podacium.com",
            "https://podacium.com",
        ]

    # ── Email / SMTP ─────────────────────────────────────────────────────
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: Optional[int] = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_USE_SSL: bool = False
    MAIL_FROM: Optional[str] = None  # From address (defaults to SMTP_USER if unset)

    # ── File Upload ──────────────────────────────────────────────────────
    MAX_FILE_SIZE: int = 100 * 1024 * 1024
    UPLOAD_DIR: str = "uploads"

    # ── Subtitles / Captions ─────────────────────────────────────────────
    SUBTITLES_DIR: str = "./data/subtitles"

    # ── WhatsApp Business API ────────────────────────────────────────────
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_ACCESS_TOKEN: Optional[str] = None
    WHATSAPP_API_VERSION: str = "v22.0"
    WHATSAPP_API_URL: str = "https://graph.facebook.com"

    # ── Phone Verification ───────────────────────────────────────────────
    PHONE_VERIFICATION_CODE_LENGTH: int = 6
    PHONE_VERIFICATION_EXPIRE_MINUTES: int = 10
    PHONE_VERIFICATION_MAX_ATTEMPTS: int = 3
    PHONE_VERIFICATION_RATE_LIMIT_MINUTES: int = 1
    PHONE_VERIFICATION_TEMPLATE_NAME: str = "jaspers_market_plain_text_v1"

    # ── Payments ─────────────────────────────────────────────────────────
    PAYMENT_GATEWAY: str = "chargily"
    CHARGILY_API_KEY: Optional[str] = None
    CHARGILY_SECRET_KEY: Optional[str] = None
    CHARGILY_MODE: str = "test"
    CHARGILY_BASE_URL: Optional[str] = None
    CHARGILY_WEBHOOK_SECRET: Optional[str] = None

    # ── Celery / Redis ───────────────────────────────────────────────────
    REDIS_URL: str = ""
    REDIS_CACHE_URL: str = ""
    CELERY_BROKER_URL: str = ""
    CELERY_RESULT_BACKEND: str = ""
    CELERY_TASK_ALWAYS_EAGER: bool = False

    # ── LiveKit (Live Streaming) ─────────────────────────────────────────
    LIVEKIT_URL: str = ""
    LIVEKIT_API_KEY: str = ""
    LIVEKIT_API_SECRET: str = ""
    LIVEKIT_WEBHOOK_SECRET: str = ""

    # ── AWS / S3 (storage, transcoding, backups) ─────────────────────────
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_DEFAULT_REGION: Optional[str] = None
    S3_BACKUP_BUCKET: Optional[str] = None

    # ── Supabase Storage (lesson video fallback) ─────────────────────────
    SUPABASE_URL: Optional[str] = None
    SUPABASE_STORAGE_KEY: Optional[str] = None
    SUPABASE_STORAGE_BUCKET: str = "Lesson"

    # ── AI / Agentic LLM Provider & Support Bot ──────────────────────────
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    GEMINI_FALLBACK_MODELS: str = "gemini-3.8-flash"
    CRISP_WEBHOOK_SECRET: Optional[str] = None
    CRISP_WEBSITE_ID: Optional[str] = None

    LLM_PROVIDER: str = (
        "gemini"  # "gemini" | "openai_compatible" | "sglang" | "vllm" | "mock"
    )
    LLM_MODEL: str = "gemini-3.5-flash-lite"
    LLM_BASE_URL: Optional[str] = None
    LLM_API_KEY: Optional[str] = None
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_OUTPUT_TOKENS: int = 1024
    LLM_REQUEST_TIMEOUT_SECONDS: float = 20.0

    # Fallback & Resilience
    LLM_FALLBACK_PROVIDER: Optional[str] = None
    LLM_CIRCUIT_BREAKER_FAIL_THRESHOLD: int = 5
    LLM_CIRCUIT_BREAKER_RECOVERY_SECONDS: int = 60
    LLM_MAX_RETRIES: int = 3

    # Dual-Tier Context & Session Cache
    AI_CONTEXT_TOKEN_THRESHOLD: int = 4000
    AI_CONTEXT_KEEP_RECENT_TURNS: int = 6
    AI_SESSION_CACHE_TTL_SECONDS: int = 86400

    # ── Monitoring ───────────────────────────────────────────────────────
    SENTRY_DSN: Optional[str] = None
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    SENTRY_ENABLE_LOGS: bool = False
    SENTRY_SEND_DEFAULT_PII: bool = False
    SENTRY_PROFILE_SESSION_SAMPLE_RATE: float = 0.1

    @classmethod
    def prepare_database_url(cls, v):
        if not v:
            return v
        if "localhost" not in v and "127.0.0.1" not in v and "sslmode" not in v:
            v += "&sslmode=require" if "?" in v else "?sslmode=require"
        return v

    @model_validator(mode="after")
    def build_database_url_from_components(self):
        if self.DATABASE_URL:
            return self
        if not all([self.DB_HOST, self.DB_NAME, self.DB_USER]):
            raise ValueError("DATABASE_URL not set and required components missing")
        password = ""
        if self.DB_PASSWORD_FILE:
            try:
                from pathlib import Path

                password = Path(self.DB_PASSWORD_FILE).read_text().strip()
            except Exception:
                import os

                password = os.environ.get("DB_PASSWORD", "")
        encoded = password.replace("@", "%40").replace(":", "%3A")
        self.DATABASE_URL = f"postgresql://{self.DB_USER}:{encoded}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        return self

    @model_validator(mode="after")
    def sync_llm_defaults(self):
        if not self.LLM_API_KEY and self.GEMINI_API_KEY:
            self.LLM_API_KEY = self.GEMINI_API_KEY
        if self.LLM_MODEL == "gemini-2.5-flash" and self.GEMINI_MODEL:
            self.LLM_MODEL = self.GEMINI_MODEL
        return self

    model_config = SettingsConfigDict(
        env_file=(".env.prod", ".env", "/opt/podacium/.env.prod", "/opt/podacium/.env"),
        case_sensitive=True,
        extra="ignore",
    )


setting = Settings()  # type: ignore[call-arg]
