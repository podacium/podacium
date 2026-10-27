# ADR-005: Middleware Modularization

## Status
Accepted

## Context
The `main.py` file had grown to 800+ lines, containing all middleware inline. This made it difficult to:
- Test individual middleware in isolation
- Understand the middleware execution order
- Modify one middleware without risk of breaking others

## Decision
Extract all middleware into `app/middleware/` module with one file per concern:
- `security_headers.py` — HSTS, CSP, X-Frame-Options, etc.
- `observability.py` — Request timing, request IDs, slow request logging
- `rate_limit.py` — Redis-backed rate limiting with in-memory fallback
- `db_connection.py` — Database connection health check
- `audit.py` — Security audit logging for 403 responses
- `csrf.py` — Double-Submit Cookie CSRF protection
- `metrics.py` — Prometheus metrics collection

## Consequences
- **Positive**: Each middleware is independently testable
- **Positive**: `main.py` reduced to ~150 lines (app creation + route registration)
- **Positive**: Clear separation of concerns
- **Negative**: Slightly more files to navigate (mitigated by `__init__.py` barrel export)

## Middleware Execution Order
Last registered = first executed:
1. CORS (outermost — handles preflight)
2. Audit 403
3. Rate Limiting
4. Observability (timing)
5. DB Connection
6. Security Headers (innermost — adds headers to response)
7. GZip (compression)
