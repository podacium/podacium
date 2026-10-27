# Podacium Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                      │
│  Browser (Next.js SSR/CSR)  │  Mobile (future)  │  API consumers    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NGINX REVERSE PROXY                             │
│  • TLS termination (Let's Encrypt)                                  │
│  • Rate limiting (100r/s burst=20)                                  │
│  • Security headers (HSTS, CSP, X-Frame-Options)                    │
│  • Static asset serving (_next/static/, /public/)                   │
│  • WebSocket upgrade support                                        │
├─────────────────────────────────────────────────────────────────────┤
│  podacium.com → :3000       │  backend-api.podacium.com → :8000            │
└──────────────┬──────────────┴──────────────────┬────────────────────┘
               │                                  │
               ▼                                  ▼
┌──────────────────────────┐    ┌─────────────────────────────────────┐
│    NEXT.JS 15 FRONTEND   │    │         FASTAPI BACKEND             │
│                          │    │                                     │
│  • App Router (SSR/SSG)  │    │  • 25 routers (versioned /api/v1/)  │
│  • React 18 + TypeScript │    │  • Service layer (business logic)   │
│  • Tailwind CSS 4        │    │  • Pydantic v2 schemas (validation) │
│  • React Context (state) │    │  • Middleware stack:                │
│  • TanStack Query v5     │    │    - Security headers               │
│  • Custom i18n (lib/i18n)│    │    - CSRF protection                │
│  • Framer Motion         │    │    - Rate limiting (Redis)          │
│  • Podacium Design System│    │    - Observability (timing, IDs)    │
│                          │    │    - DB connection health           │
│  Locales: en, fr, ar, kab│    │  • WebSocket (real-time messaging)  │
│  (with full RTL support) │    │  • Live Sessions router (LiveKit)   │
│                          │    │  • Sentry (error tracking)          │
└──────────────────────────┘    └──────────────┬──────────────────────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          │                    │                    │
                          ▼                    ▼                    ▼
              ┌────────────────────┐ ┌──────────────────┐ ┌────────────────┐
              │   POSTGRESQL 16    │ │    REDIS 7       │ │  CELERY WORKER │
              │                    │ │                  │ │                │
              │  • Prisma ORM      │ │  • Rate limiting │ │  • Email tasks │
              │  • 80+ models      │ │  • Token cache   │ │  • Video proc  │
              │  • CHECK constraints│ │  • WS Pub/Sub   │ │  • Cert gen    │
              │  • Perf indexes    │ │  • Session store │ │  • Cleanup     │
              │  • Soft deletes    │ │  • Celery broker │ │  • Financial   │
              └────────────────────┘ └──────────────────┘ └────────────────┘

                          ┌────────────────────────────────────────────┐
                          │            EXTERNAL SERVICES                │
                          ├────────────────────────────────────────────┤
                          │  • AWS S3 + CloudFront (video/HLS)         │
                          │  • AWS MediaConvert (video transcoding)     │
                          │  • Supabase (file storage)                  │
                          │  • Chargily (Algerian payment gateway)      │
                          │  • WhatsApp Business API (phone verify)     │
                          │  • SMTP (email delivery)                    │
                          │  • Google/GitHub/LinkedIn (OAuth2)          │
                          │  • Sentry (error monitoring)                │
                          │  • Prometheus (metrics & alerts)            │
                          │  • LiveKit Cloud (video streaming, MVP)     │
                          └────────────────────────────────────────────┘
```

## Data Flow

### Authentication Flow

```
Client → POST /api/v1/auth/login
  → Verify credentials (Argon2)
  → Check 2FA status
  → If 2FA enabled: return { requires_2fa: true }
  → Client submits TOTP code → POST /api/v1/2fa/verify
  → Issue JWT pair (access + refresh)
  → Set HTTP-only cookies (access_token, refresh_token)
  → Refresh token stored as SHA-256 hash in DB (rotation)
```

### Payment Flow

```
Client → POST /api/v1/payments/initiate
  → Validate amount (CHECK constraints: > 0)
  → Create Transaction (PENDING)
  → Redirect to Chargily checkout
  → Webhook: POST /api/v1/webhooks/chargily
  → Verify HMAC-SHA256 signature
  → Update Transaction (COMPLETED)
  → If escrow: create EscrowHold
  → If subscription: activate entitlements
```

### Real-time Messaging

```
Client → WS /ws?token=<jwt>
  → Authenticate via JWT
  → Register in ConnectionManager
  → Redis Pub/Sub for cross-instance delivery
  → Typing indicators, read receipts, new messages
```

### Live Session Flow

```
Client → GET /api/v1/live-sessions (browse upcoming)
  → Book: POST /live-sessions/:id/book
    → Initiate payment (Chargily)
    → On success: create Booking (CONFIRMED)
    → Reminder emails (24h, 1h before)

Client → POST /live-sessions/:id/join (start or join)
  → Validate booking (paid? capacity? not ended?)
  → Generate LiveKit JWT token (expires 15 min after session end)
  → Return token + LiveKit server URL

Client → WSS <livekit-server> (LiveKit SDK)
  → Connect to room with token
  → Publish/subscribe video/audio/data streams
  → Chat via DataChannel
  → LiveKit fires webhooks: participant_joined, participant_left, egress_ended

Backend → POST /webhooks/livekit
  → Verify HMAC-SHA256 signature
  → Record attendance (join/leave times, duration)
  → Update LiveSession status (room_started → LIVE, room_finished → ENDED)
  → Save recording URL (egress_ended)

Post-session → Celery task (48h after end)
  → Calculate attendance % per booking
  → If < 50%: auto-refund 50% as wallet credit
  → Update booking status (ATTENDED / NO_SHOW / REFUNDED)
```

## Security Layers

| Layer               | Mechanism                                                     |
| ------------------- | ------------------------------------------------------------- |
| Transport           | TLS 1.3 (HSTS preload)                                        |
| Authentication      | JWT (HTTP-only cookies) + TOTP 2FA                            |
| Authorization       | Role-based (STUDENT, FREELANCER, BUSINESS, INSTRUCTOR, ADMIN) |
| Token Security      | Refresh rotation + replay detection                           |
| CSRF                | Double-Submit Cookie pattern (`app/middleware/csrf.py`)       |
| Password            | Argon2id (OWASP parameters)                                   |
| API Protection      | Rate limiting (Redis-backed)                                  |
| Input Validation    | Pydantic schemas (strict)                                     |
| File Uploads        | Extension + MIME + magic byte validation                      |
| Financial Integrity | DB CHECK constraints                                          |
| Monitoring          | Sentry + Prometheus alerts                                    |
| Headers             | CSP (no unsafe-inline), HSTS, X-Frame-Options                 |

## Deployment Architecture

### Current (VPS)

- Single Ubuntu VPS with Nginx + Docker Compose
- PostgreSQL + Redis in containers
- Celery worker + beat in containers
- Let's Encrypt for TLS

### Target (AWS — defined in Terraform)

- ECS Fargate (API containers)
- RDS PostgreSQL 16 (multi-AZ in production)
- ElastiCache Redis (encrypted, failover)
- ALB (load balancing)
- S3 + CloudFront (static assets + video)
- VPC with private subnets
