# Podacium API Documentation

## Base URL

| Environment | URL                                               |
| ----------- | ------------------------------------------------- |
| Production  | `https://backend-api.podacium.com/api/v1`         |
| Staging     | `https://staging-backend-api.podacium.com/api/v1` |
| Local       | `http://localhost:8000/api/v1`                    |

## Authentication

All authenticated endpoints use **HTTP-only cookies** for JWT tokens. No Bearer tokens in headers.

### Login Flow

```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response: 200 OK
Set-Cookie: access_token=<jwt>; HttpOnly; Secure; SameSite=Lax
Set-Cookie: refresh_token=<jwt>; HttpOnly; Secure; SameSite=Lax

{
  "user": { "id": 1, "email": "...", "fullName": "...", "role": "STUDENT" },
  "message": "Login successful"
}
```

### 2FA Flow (if enabled)

```
POST /api/v1/auth/login → returns { "requires_2fa": true, "temp_token": "..." }
POST /api/v1/2fa/verify  (with temp_token cookie)
  { "code": "123456" }
→ Sets full access_token + refresh_token cookies
```

### Token Refresh

```
POST /api/v1/auth/refresh-token
Cookie: refresh_token=<jwt>

Response: 200 OK (new cookies set)
```

### Logout

```
POST /api/v1/auth/logout
Cookie: access_token=<jwt>

Response: 200 OK (cookies cleared, token revoked)
```

## API Contract & Exploration

> [!IMPORTANT]
> **Single Source of Truth:**
> The complete, normative API contract is auto-generated directly from Pydantic schemas and FastAPI route definitions into [`openapi.json`](file:///home/zuikre/podacium/openapi.json) via `make openapi-gen`.
>
> Never hand-edit the API specification or rely on static markdown tables for request/response schemas.

### Interactive API Explorers

- **Swagger UI:** `http://localhost:8000/api/v1/docs` (Local) / `https://backend-api.podacium.com/api/v1/docs` (Production)
- **ReDoc:** `http://localhost:8000/api/v1/redoc` (Local) / `https://backend-api.podacium.com/api/v1/redoc` (Production)
- **Raw OpenAPI Spec:** [`openapi.json`](file:///home/zuikre/podacium/openapi.json) (root directory)

---

## Router Directory Map

All endpoints are versioned under `/api/v1/` and organized into modular domain routers:

| Domain                        | Router Prefix                                           | Primary Responsibilities                                                        |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Authentication**            | `/auth`                                                 | Registration, login, logout, password reset, OAuth2                             |
| **Two-Factor Auth**           | `/2fa`                                                  | TOTP secret provisioning, QR code, 2FA verification & backup codes              |
| **User & Profile**            | `/me`, `/users`, `/profiles`                            | Current user profile, public profile, skills, settings                          |
| **Education (LMS)**           | `/education`, `/courses`, `/quizzes`, `/certificates`   | Course catalog, lesson progress, quiz attempts, verifiable certificate issuance |
| **Freelancing Hub**           | `/freelancing`, `/projects`, `/proposals`, `/contracts` | Project listings, proposal submissions, milestone contracts, reviews            |
| **Portfolio**                 | `/portfolio`                                            | User portfolio items, media attachments, verified showcase                      |
| **Payments & Billing**        | `/payments`, `/billing`, `/subscriptions`               | Chargily Pay checkout, subscriptions, PodaPoint packs, captive add-ons          |
| **Live Sessions**             | `/live-sessions`                                        | Live events catalog, bookings, LiveKit room token issuance                      |
| **Webhooks**                  | `/webhooks`                                             | Chargily payment webhooks (HMAC-SHA256), LiveKit room webhooks                  |
| **Business Intelligence**     | `/bi/*`                                                 | Algerian Health Score, SME analytics, dashboard data, data exports              |
| **Messaging & Notifications** | `/conversations`, `/notifications`                      | Direct messaging, chat threads, notification feeds                              |
| **Administration**            | `/admin/*`                                              | Dispute management, refund approvals, user management, audit logs               |

---

## Error Handling & Response Format

All error responses return standard HTTP status codes with a structured error payload:

```json
{
  "detail": "Human-readable explanation of the error"
}
```

### Common HTTP Status Codes

| Status  | Meaning               | Typical Scenario                                          |
| ------- | --------------------- | --------------------------------------------------------- |
| **400** | Bad Request           | Business rule violation or invalid input                  |
| **401** | Unauthorized          | Missing, expired, or invalid session cookie               |
| **403** | Forbidden             | Insufficient permissions for user role (e.g. non-admin)   |
| **404** | Not Found             | Requested entity does not exist                           |
| **409** | Conflict              | Duplicate resource (e.g. duplicate email or proposal)     |
| **422** | Unprocessable Entity  | Pydantic validation error (field type or format mismatch) |
| **429** | Too Many Requests     | Rate limit exceeded (Redis-backed counter)                |
| **500** | Internal Server Error | Unhandled server error (tracked in Sentry)                |

---

## Security & Rate Limiting

- **Auth Endpoints:** 60 requests/minute per client IP (Redis sliding window).
- **Global API Endpoints:** 100 requests/second per client IP (Nginx reverse proxy).
- **Brute-Force Account Lockout:** 5 failed login attempts → 5 min lock, 10 attempts → 30 min, 15 attempts → 1 hour.
- **CSRF Protection:** Double-Submit Cookie pattern (`X-CSRF-Token` header validated against session).

---

## Idempotency

Payment and critical state-mutating endpoints support idempotency via the `Idempotency-Key` header:

```http
POST /api/v1/payments/initiate
Content-Type: application/json
Idempotency-Key: 7b8b4a2e-4b72-4d2c-9a25-39281a6c5e82

{
  "amount_cents": 490000,
  "purpose": "SUBSCRIPTION_PLUS"
}
```

If the same `Idempotency-Key` is received within 24 hours, the cached response is returned without re-executing payment processing or creating duplicate transaction records.
