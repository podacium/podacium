"""
Podacium API Middleware Module.
All middleware is registered via `register_middleware(app)`.
"""
from .security_headers import security_headers_middleware
from .observability import observability_middleware
from .rate_limit import rate_limit_middleware
from .db_connection import db_connection_middleware
from .audit import audit_403_middleware
from .pii_scan import pii_scan_middleware

__all__ = [
    "security_headers_middleware",
    "observability_middleware",
    "rate_limit_middleware",
    "db_connection_middleware",
    "audit_403_middleware",
    "pii_scan_middleware",
]
