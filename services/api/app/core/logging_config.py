"""
Structured JSON logging configuration.

In production, all logs are emitted as JSON for easy parsing by
log aggregation tools (CloudWatch, Datadog, ELK, etc.).
In development, uses human-readable format.

Correlation ID support:
- Middleware attaches X-Request-ID to every request
- The ID is stored in the current context via contextvars
- All log formatters include it when present
"""

import logging
import sys
from contextvars import ContextVar

from pythonjsonlogger import json as jsonlogger

from app.core.config import setting

request_id_var: ContextVar[str] = ContextVar("request_id", default="")


def get_request_id() -> str:
    return request_id_var.get()


def set_request_id(rid: str):
    request_id_var.set(rid)


class PodaciumJsonFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter with standard fields."""

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record["level"] = record.levelname
        log_record["logger"] = record.name
        log_record["service"] = "podacium-api"
        log_record["environment"] = setting.ENVIRONMENT
        rid = get_request_id()
        if rid:
            log_record["request_id"] = rid


class CorrelationFormatter(logging.Formatter):
    """Development formatter that includes correlation ID."""

    def format(self, record):
        rid = get_request_id()
        if rid:
            record.request_id = rid
            return f"[{self.formatTime(record)}] {record.request_id} | {record.levelname:<8} | {record.name} | {record.getMessage()}"
        return super().format(record)


def configure_logging() -> None:
    """Configure logging based on environment."""
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Remove existing handlers
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)

    formatter: logging.Formatter
    if setting.ENVIRONMENT == "production":
        # JSON format for production
        formatter = PodaciumJsonFormatter(
            fmt="%(asctime)s %(level)s %(name)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )
    else:
        # Human-readable for development with correlation ID
        formatter = CorrelationFormatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%H:%M:%S",
        )

    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("prisma").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
