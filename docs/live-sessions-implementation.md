# Live Events Marketplace — Implementation Plan

**Version:** 1.0  
**Status:** Build-ready  
**Target:** Q3 2026 (Phase 1 — MVP), Q4 2026 (Phase 2 — Scale)  
**Dependencies:** Phase 1 Architecture (router decomposition), Payment system (existing Chargily integration), Feature flags (existing)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Decision Log](#2-decision-log)
3. [Architecture Overview](#3-architecture-overview)
4. [Database Schema](#4-database-schema)
5. [API Endpoints](#5-api-endpoints)
6. [Frontend Routes & Components](#6-frontend-routes--components)
7. [LiveKit Integration](#7-livekit-integration)
8. [User Flows](#8-user-flows)
9. [Payment & Refund Flows](#9-payment--refund-flows)
10. [Policies: Cancellation, No-Show, Chargeback](#10-policies-cancellation-no-show-chargeback)
11. [Phased Implementation Plan](#11-phased-implementation-plan)
12. [Infrastructure & Environment](#12-infrastructure--environment)
13. [Testing Strategy](#13-testing-strategy)

---

## 1. Executive Summary

The Live Events Marketplace is a **standalone platform capability** — not a course feature bolt-on — that enables creators to host real-time video sessions with ticketing, monetization, attendance tracking, and replay. Designed for cross-pillar extensibility (Education → Freelancing → BI) from day one.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Provider** | LiveKit Cloud (MVP) → Self-hosted (scale) | No Daily.co detour — adopt LiveKit-native from day one |
| **Session model** | Standalone with optional module/lesson FK | Zero disruption to existing tables; cross-pillar future |
| **Minimum price** | 100 DZD (no free sessions by default) | Research: commitment fee drops no-shows 60-80% |
| **Revenue share** | 80% creator / 20% platform | Competitive with global benchmarks |
| **Recording** | Auto-record all sessions, 90-day replay included | #1 no-show mitigation; industry standard |
| **No-show refund** | 50% wallet credit if attendance < 50% | Fair to both sides; automated |
| **Moderation** | Direct Q&A (<50 attn) or Moderated (50+) | Scales from intimate to large sessions |
| **Content review** | Private: instant. Public: DRAFT → APPROVED | Balances autonomy with quality |
| **Organization sessions** | Phase 2 | Excluded from MVP |
| **Co-hosts** | Up to 3 | Ship in Phase 2 |

---

## 2. Decision Log

All 25+ decisions captured during the design phase. Each has a unique ID for cross-referencing in code and PRs.

### 2.1 Core Architecture

| ID | Decision | Value | Source |
|----|----------|-------|--------|
| DA-01 | Live provider strategy | LiveKit Cloud (MVP) → Self-hosted (scale) | Replaces Daily.co plan |
| DA-02 | Session model | Standalone with optional moduleId/lessonId/orgId | Zero disruption; cross-pillar |
| DA-03 | Token expiration | 15 minutes after session end | Security + reconnect |
| DA-04 | Multi-device support | Max 2 connections per user | Common phone+laptop use case |
| DA-05 | Late arrivals | No cutoff for paid; 15 min soft cutoff for free | Respects payment |
| DA-06 | Cross-pillar design | context_type + context_id polymorphic pattern | Future freelancing/BI reuse |

### 2.2 Monetization

| ID | Decision | Value | Source |
|----|----------|-------|--------|
| MO-01 | Minimum ticket price | 100 DZD (no free tickets) | 100 DZD ≈ $0.70; filters no-shows |
| MO-02 | Revenue share | 80% creator / 20% platform | Competes with Teachable, Maven |
| MO-03 | Creator payouts | Weekly batch, 48h hold for no-shows | Cash flow + refund safety |
| MO-04 | Early-bird pricing | Optional, creator-configurable | Drives early registration |
| MO-05 | Free coupon system | 5 "host codes" per month per creator | Promotional use without undermining 100 DZD min |

### 2.3 Session State Machine

| ID | Decision | Value | Source |
|----|----------|-------|--------|
| SS-01 | Session statuses | SCHEDULED → [LIVE | CANCELLED] → ENDED → ARCHIVED | Simple, deterministic |
| SS-02 | Booking statuses | CONFIRMED → [ATTENDED | NO_SHOW | REFUNDED | CANCELLED] | Covers all outcomes |
| SS-03 | Moderation mode | INTEGER = DIRECT (<50) or MODERATED (50+) | Creator sets per session |
| SS-04 | Max sessions | 30 concurrent LiveKit sessions (MVP target) | Cost model: <$5/mo |

### 2.4 Content & Creator Policy

| ID | Decision | Value | Source |
|----|----------|-------|--------|
| CC-01 | Creator eligibility | UserRole.INSTRUCTOR required | Aligns with existing role system |
| CC-02 | Public session review | DRAFT → SUBMITTED → APPROVED (admin) | Mirrors module moderation |
| CC-03 | Private session rules | Instant publish, public link, no discovery listing | No administrative overhead |
| CC-04 | Co-hosts | Up to 3 per session (Phase 2) | MVP: host only |
| CC-05 | Clone session | Resets bookings, waitlist, date/time. Preserves template data | Template pattern |

### 2.5 Registration & Ticketing

| ID | Decision | Value | Source |
|----|----------|-------|--------|
| RT-01 | Transferable tickets | Yes, up to 24h before session | Anti-scalping + flexibility |
| RT-02 | Waitlist | Yes, with 2-hour claim window | Urgency + data |
| RT-03 | Multiple tickets per user | One ticket per user per session | Prevents scalping |
| RT-04 | Captcha on registration | Yes, for paid sessions | Anti-bot |

### 2.6 Cancellation & Refund Policy

| ID | Decision | Value | Source |
|----|----------|-------|--------|
| CR-01 | Creator cancels >48h | Full refund to attendees; no penalty to creator | Generous + fair |
| CR-02 | Creator cancels 24-48h | Full refund + 20% coupon; warning on profile | Moderate |
| CR-03 | Creator cancels <24h | Full refund + 100% coupon; strike on account | Strong deterrent |
| CR-04 | Cancellation trumps no-show | If session cancelled, no-show rules don't apply. Coupon only for attendees who joined. | Refund = service not rendered |
| CR-05 | No-show refund | 50% wallet credit if attendance < 50% of session | Automated; fair to both sides |
| CR-06 | No-show refund timing | Processed within 48h of session end | Matches payout hold |
| CR-07 | Chargeback — first | Platform absorbs | Industry standard |
| CR-08 | Chargeback — repeat | Creator pays (future holdings) | Deters abuse |

### 2.7 Post-Session & Recording

| ID | Decision | Value | Source |
|----|----------|-------|--------|
| PS-01 | Replay access | 90-day default on every ticket | Industry standard |
| PS-02 | Replay tiers | Phase 2 (tiered: 7/90/lifetime) | Wait for data |
| PS-03 | Replay download | Phase 2 | Wait for data |
| PS-04 | Recording storage | S3 + CloudFront (signed URLs) | Reuse existing pipeline |

### 2.8 Discovery & UI

| ID | Decision | Value | Source |
|----|----------|-------|--------|
| UI-01 | Discovery page | `/live` with upcoming + trending tabs | Marketplace model |
| UI-02 | Trending algorithm | `COUNT(bookings 7d) × urgency_boost` (MVP) | Simplified: no engagement data yet |
| UI-03 | Urgency boost formula | `starts_within_24h AND empty_seats > 0 ? (empty/capacity) × 5 : 0` | Fill empty seats |
| UI-04 | Category filter | Static list: PROGRAMMING, DATA_SCIENCE, DESIGN, BUSINESS, MARKETING, LANGUAGES, OTHER | Matches module categories |
| UI-05 | Language filter | Creator-declared: Arabic, French, English, multilingual | Content creator choice |
| UI-06 | RTL for live room | Enforced globally via CSS logical properties | Arabic market; French/English bidirectional |
| UI-07 | Social proof | Attendee avatars (up to 3) + registered count on session cards | FOMO + trust |
| UI-08 | Arabic-first default | UI auto-detects browser locale, defaults to Arabic for Algerian users | Primary market |

### 2.9 Phase Decisions

| ID | Decision | Phase | Source |
|----|----------|-------|--------|
| PH-01 | Organization sessions | Phase 2 | Add `organizationId` FK now (nullable), ship UI later |
| PH-02 | Co-hosts | Phase 2 | MVP: host-only stream |
| PH-03 | Replay tiers | Phase 2 | MVP: 90-day default |
| PH-04 | Trending (full formula) | Phase 2 | MVP: simplified bookings-only |
| PH-05 | Transferable tickets | Phase 2 | MVP: non-transferable |
| PH-06 | Waitlist auto-notify | Phase 2 | MVP: "Sold out" text only |

---

## 3. Architecture Overview

### 3.1 System Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LIVE EVENTS MARKETPLACE                      │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Discovery   │  │ Registration │  │  Live Room   │             │
│  │  (/live)     │  │  (Booking)   │  │  (LiveKit)   │             │
│  │              │  │              │  │              │             │
│  │ • Browse     │  │ • 100 DZD    │  │ • Pre-join   │             │
│  │ • Search     │  │ • Chargily   │  │ • Video grid │             │
│  │ • Filters    │  │ • Calendar   │  │ • Chat (RTL) │             │
│  │ • Trending   │  │ • Reminders  │  │ • Q&A        │             │
│  │ • Profiles   │  │              │  │ • Recording  │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                CREATOR DASHBOARD                             │  │
│  │  Create session → Manage bookings → Analytics → Clone       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

                    ▼                          ▼
          ┌──────────────────┐      ┌──────────────────────┐
          │  EXISTING SVCs   │      │    NEW SERVICES      │
          │  • Payment svc   │      │  • LiveSessionSvc    │
          │  • Notification  │      │  • LiveKitService    │
          │  • Wallet svc    │      │  • BookingService    │
          │  • Feature flags │      │  • RefundService     │
          └──────────────────┘      └──────────────────────┘
```

### 3.2 Isolation Principle

Zero changes to existing infrastructure:

| Layer | Strategy |
|-------|----------|
| **Database** | New tables only (`LiveSession`, `LiveSessionParticipant`, `LiveSessionBooking`) |
| **Backend** | New router `live_sessions.py` + services (`live_session_service.py`, `livekit_service.py`) |
| **Frontend** | New route group `app/live/` + components `components/live/` |
| **API** | New endpoints under `/api/v1/live-sessions/*` |
| **Environment** | New env vars (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) |

### 3.3 Data Flow: Booking a Paid Session

```
Attendee                          Backend                         Chargily          LiveKit
    │                                │                               │                 │
    │  POST /live-sessions/:id/book  │                               │                 │
    │───────────────────────────────►│                               │                 │
    │                                │  Validate: capacity, time,    │                 │
    │                                │  duplicate booking, price     │                 │
    │                                │──────────────────────────────►│                 │
    │  Return checkout URL           │  Create Transaction (PENDING) │                 │
    │◄───────────────────────────────│  Create Booking (PENDING)     │                 │
    │                                │◄──────────────────────────────│                 │
    │  Redirect to Chargily          │                               │                 │
    │───────────────────────────────────────────────────────────────►│                 │
    │                                │                               │  Complete        │
    │                                │                               │─────────────────►│
    │                                │  POST /webhooks/chargily      │                 │
    │                                │◄──────────────────────────────│                 │
    │                                │  Update Transaction (COMPLETED)│                 │
    │                                │  Update Booking (CONFIRMED)   │                 │
    │                                │  Create LiveKit room          │                 │
    │                                │──────────────────────────────►│                 │
    │                                │  Room ready                   │                 │
    │                                │◄──────────────────────────────│                 │
    │                                │  Schedule reminder emails     │                 │
    │                                │  Return session details       │                 │
```

---

## 4. Database Schema

### 4.1 New Models

Add to `services/api/prisma/schema.prisma`:

```prisma
// ─── Live Session ─────────────────────────────────────────────────────
model LiveSession {
  id                String      @id @default(cuid())
  title             String      @db.VarChar(200)
  description       String      @db.Text
  coverImageUrl     String?

  // Host
  hostId            Int
  host              User        @relation(fields: [hostId], references: [id])

  // Optional context: course, lesson, or standalone
  moduleId          String?
  module            Module?     @relation(fields: [moduleId], references: [id])
  lessonId          String?
  lesson            Lesson?     @relation(fields: [lessonId], references: [id])

  // Future: organization private sessions (Phase 2)
  organizationId    Int?
  organization      Organization? @relation(fields: [organizationId], references: [id])

  // Content
  language          String      @default("ar")      // ar, fr, en, multi
  agenda            String?     @db.Text
  materials         Json?                           // [{name, url, type}]

  // Scheduling
  status            LiveSessionStatus @default(SCHEDULED)
  startTime         DateTime
  endTime           DateTime
  timezone          String      @default("Africa/Algiers")
  maxAttendees      Int         @default(50)

  // Monetization
  priceCents        Int         @default(100)        // Minimum: 100 DZD
  earlyBirdPriceCents Int?
  earlyBirdDeadline DateTime?

  // LiveKit
  livekitRoomName   String      @unique @default(cuid())
  livekitRoomSid    String?

  // Recording
  isRecorded        Boolean     @default(true)
  recordingUrl      String?
  recordingDuration Int?

  // Settings
  isPublic          Boolean     @default(true)
  allowChat         Boolean     @default(true)
  allowQa           Boolean     @default(true)
  allowScreenShare  Boolean     @default(false)
  moderationMode    ModerationMode @default(DIRECT)

  // Live state
  startedAt         DateTime?
  endedAt           DateTime?
  actualAttendees   Int         @default(0)

  // Relations
  participants      LiveSessionParticipant[]
  bookings          LiveSessionBooking[]
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@index([hostId])
  @@index([status])
  @@index([startTime])
  @@index([priceCents])
  @@index([isPublic])
  @@index([organizationId])
  @@index([startTime, status])
}

// ─── Session Participant (attendance tracking) ───────────────────────
model LiveSessionParticipant {
  id                String      @id @default(cuid())
  liveSessionId     String
  liveSession       LiveSession @relation(fields: [liveSessionId], references: [id], onDelete: Cascade)
  userId            Int
  user              User        @relation(fields: [userId], references: [id])

  joinedAt          DateTime?
  leftAt            DateTime?
  durationSeconds   Int?

  // Engagement
  chatMessagesCount Int         @default(0)
  questionsAsked    Int         @default(0)

  createdAt         DateTime    @default(now())

  @@unique([liveSessionId, userId])
  @@index([liveSessionId])
  @@index([userId])
}

// ─── Booking (registration ticket) ───────────────────────────────────
model LiveSessionBooking {
  id                String      @id @default(cuid())
  liveSessionId     String
  liveSession       LiveSession @relation(fields: [liveSessionId], references: [id], onDelete: Cascade)
  userId            Int
  user              User        @relation(fields: [userId], references: [id])

  // Pricing snapshot
  pricePaidCents    Int
  currency          String      @default("DZD")

  // Payment
  transactionId     Int
  transaction       Transaction @relation(fields: [transactionId], references: [id])

  // Status
  status            BookingStatus @default(CONFIRMED)

  // Refund
  refundCents       Int         @default(0)
  refundReason      String?
  refundedAt        DateTime?

  // Attendance (for no-show refund logic)
  attendancePercent Float?                     // 0.0 - 1.0

  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@unique([liveSessionId, userId])
  @@index([liveSessionId])
  @@index([userId])
  @@index([status])
}

// ─── New Enums ────────────────────────────────────────────────────────
enum LiveSessionStatus {
  SCHEDULED
  LIVE
  ENDED
  CANCELLED
  ARCHIVED
}

enum BookingStatus {
  CONFIRMED
  ATTENDED
  NO_SHOW
  REFUNDED
  CANCELLED
}

enum ModerationMode {
  DIRECT
  MODERATED
}
```

### 4.2 Enum Extensions

Add to existing `PaymentPurpose` enum:

```prisma
enum PaymentPurpose {
  // ... existing values ...
  LIVE_SESSION_PURCHASE
  LIVE_SESSION_REFUND
}
```

### 4.3 Index Strategy

| Table | Index | Purpose |
|-------|-------|---------|
| `LiveSession` | `[hostId]` | Creator's session list |
| `LiveSession` | `[status]` | Filter by state |
| `LiveSession` | `[startTime]` | Chronological ordering |
| `LiveSession` | `[priceCents]` | Price filtering |
| `LiveSession` | `[startTime, status]` | "Upcoming" queries (most common) |
| `LiveSession` | `[organizationId]` | Phase 2 org sessions |
| `LiveSessionParticipant` | `[liveSessionId, userId]` | Unique constraint + attendance lookup |
| `LiveSessionBooking` | `[liveSessionId]` | Booking list per session |
| `LiveSessionBooking` | `[status]` | Refund/attendance processing |

---

## 5. API Endpoints

### 5.1 New Router: `/api/v1/live-sessions`

Register in `services/api/app/routes.py` as a new router with tag `"Live Sessions"`.

#### Discovery

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/live-sessions` | Public | List upcoming public sessions with filters |
| GET | `/live-sessions/search` | Public | Full-text search |
| GET | `/live-sessions/trending` | Public | Trending sessions (bookings 7d × urgency boost) |
| GET | `/live-sessions/:id` | Public | Session detail |
| GET | `/live-sessions/:id/preview` | Public | Minimal info for share preview (Open Graph) |

**GET /live-sessions query params:**

```
?status=SCHEDULED
&category=PROGRAMMING
&language=ar
&price_min=0
&price_max=5000
&date_from=2026-07-01
&date_to=2026-07-31
&sort=startTime|price|popularity
&page=1
&limit=20
```

#### Registration (Attendee)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/live-sessions/:id/book` | Auth | Register (free) or initiate purchase (paid) |
| POST | `/live-sessions/:id/cancel-booking` | Auth | Cancel own booking |
| GET | `/live-sessions/my-bookings` | Auth | List user's booked sessions (upcoming + past) |
| POST | `/live-sessions/:id/transfer` | Auth | Transfer ticket to another user (24h window) |

**POST /live-sessions/:id/book response (paid):**

```json
{
  "bookingId": "abc123",
  "status": "PENDING",
  "checkoutUrl": "https://pay.chargily.com/checkout/xyz",
  "expiresAt": "2026-09-23T14:00:00Z"
}
```

**POST /live-sessions/:id/book response (free):** Same without `checkoutUrl`.

#### Session Participation

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/live-sessions/:id/join` | Auth | Get LiveKit JWT token (validates booking) |
| POST | `/live-sessions/:id/leave` | Auth | Record leave time, disconnect from room |
| GET | `/live-sessions/:id/recording` | Auth | Get recording URL (if session is ENDED/ARCHIVED and user was booked) |

#### Creator

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/live-sessions` | INSTRUCTOR | Create session |
| PUT | `/live-sessions/:id` | INSTRUCTOR (owner) | Edit session (only if SCHEDULED) |
| DELETE | `/live-sessions/:id` | INSTRUCTOR (owner) | Cancel session (triggers refund policy) |
| GET | `/live-sessions/my` | INSTRUCTOR | List own sessions |
| GET | `/live-sessions/:id/bookings` | INSTRUCTOR (owner) | List bookings with attendance |
| GET | `/live-sessions/:id/analytics` | INSTRUCTOR (owner) | Attendance, revenue, engagement |
| POST | `/live-sessions/:id/clone` | INSTRUCTOR (owner) | Duplicate as template |

#### Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/live-sessions/pending-review` | ADMIN | Public sessions awaiting approval |
| POST | `/admin/live-sessions/:id/approve` | ADMIN | Approve public session |
| POST | `/admin/live-sessions/:id/reject` | ADMIN | Reject with reason |

#### Webhooks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhooks/livekit` | LiveKit HMAC | Attendance, recording state changes |
| POST | `/webhooks/chargily` | Chargily HMAC | Payment confirmation (reuse existing) |

**LiveKit webhook events handled:**

| Event | Action |
|-------|--------|
| `room_started` | Update LiveSession status → LIVE, set startedAt |
| `participant_joined` | Create/update LiveSessionParticipant (joinedAt) |
| `participant_left` | Update LiveSessionParticipant (leftAt, durationSeconds) |
| `egress_ended` | Store recordingUrl, duration |
| `room_finished` | Update LiveSession status → ENDED, set endedAt, trigger no-show processing |

---

## 6. Frontend Routes & Components

### 6.1 Route Map

```
apps/web/src/app/live/
├── page.tsx                          # Discovery: "Upcoming" + "Trending" tabs
├── [id]/page.tsx                     # Session detail + booking CTA
├── [id]/preview/page.tsx             # Open Graph share preview
├── stream/[id]/page.tsx              # Live room (pre-join + in-session)
├── my/page.tsx                       # User's booked sessions
├── my/replays/page.tsx               # Recorded sessions with replay access
├── create/page.tsx                   # Creator: new session form
├── create/success/page.tsx           # Session created confirmation
├── manage/page.tsx                   # Creator: session list
├── manage/[id]/page.tsx              # Creator: edit session
├── manage/[id]/bookings/page.tsx     # Creator: booking list
├── manage/[id]/analytics/page.tsx    # Creator: analytics dashboard
└── manage/[id]/clone/page.tsx        # Creator: duplicate session
```

### 6.2 Component Architecture

```
apps/web/src/components/live/
├── LiveSessionProvider.tsx           # React context: Room, connection state
├── PreJoinForm.tsx                   # Mic/camera preview + name input
├── VideoConference.tsx               # Grid: participant tiles, active speaker
├── ParticipantTile.tsx               # Single participant: video, name, mic
├── ChatSidebar.tsx                   # RTL-aware chat panel
├── QAPanel.tsx                       # Q&A with upvoting (direct/moderated)
├── ScreenShareOverlay.tsx            # Full-screen screen share
├── RecordingIndicator.tsx            # Red dot when recording
├── ConnectionStatus.tsx              # Signal strength indicator
├── AudioOnlyToggle.tsx               # Bandwidth-saving audio mode
├── HandRaiseButton.tsx               # Animated hand raise
├── LiveKitRoom.tsx                   # Wrapper: Room connect, disconnect
├── PendingQuestions.tsx              # (Moderated) pending queue for creator
└── EmojiReactionPicker.tsx           # In-session emoji reactions
```

### 6.3 Discovery Page (`/live`)

```
┌──────────────────────────────────────────────────────────────┐
│  🔍 Search: ______________  [Category ▾] [Date ▾] [Price ▾] │
├──────────────────────────────────────────────────────────────┤
│  TABS: [Upcoming for You] [Trending]                         │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│  │ 📅 Mastering     │ │ 🎙️ React         │ │ 📊 Data Sci │ │
│  │    Python        │ │    Patterns      │ │    Workshop  │ │
│  │    Jul 20 14:00  │ │    Jul 22 10:00  │ │    Jul 28   │ │
│  │    1,500 DA      │ │    1,000 DA      │ │    2,000 DA │ │
│  │    👤 Ahmed B.   │ │    👤 Sara K.    │ │    👤 Ali M. │ │
│  │    👥 42/50      │ │    👥 18/30      │ │    👥 8/20   │ │
│  │    🔥 Trending   │ │                  │ │              │ │
│  └──────────────────┘ └──────────────────┘ └──────────────┘ │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│  │ ...more cards    │ │                  │ │              │ │
└──────────────────────────────────────────────────────────────┘
```

### 6.4 Trending Algorithm (MVP)

```sql
WITH trending AS (
  SELECT
    s.id,
    s.title,
    COUNT(b.id) AS bookings_7d,
    s.max_attendees,
    (s.max_attendees - COUNT(b.id)) AS empty_seats,
    EXTRACT(EPOCH FROM (s.start_time - NOW())) / 3600 AS hours_until_start
  FROM live_sessions s
  LEFT JOIN live_session_bookings b
    ON b.live_session_id = s.id
    AND b.created_at > NOW() - INTERVAL '7 days'
    AND b.status = 'CONFIRMED'
  WHERE s.status = 'SCHEDULED'
    AND s.is_public = true
    AND s.start_time > NOW()
  GROUP BY s.id, s.title, s.max_attendees, s.start_time
)
SELECT *,
  CASE
    WHEN hours_until_start <= 24 AND empty_seats > 0
    THEN CAST(empty_seats AS FLOAT) / max_attendees * 5
    ELSE 0
  END AS urgency_boost,
  (bookings_7d + CASE
    WHEN hours_until_start <= 24 AND empty_seats > 0
    THEN CAST(empty_seats AS FLOAT) / max_attendees * 5
    ELSE 0
  END) AS trending_score
FROM trending
ORDER BY trending_score DESC
LIMIT 20;
```

---

## 7. LiveKit Integration

### 7.1 LiveKit Cloud Setup

| Step | Action | Notes |
|------|--------|-------|
| 1 | Create LiveKit Cloud account | Build plan ($0/mo, 5,000 WebRTC min free) |
| 2 | Create project + API key | Generate `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` |
| 3 | Configure webhook endpoint | `https://backend-api.podacium.com/api/v1/webhooks/livekit` |
| 4 | Set environment variables | See Section 12 |
| 5 | Configure S3 egress (recording) | LiveKit → AWS S3 bucket |
| 6 | Verify token generation | Test with LiveKit CLI or test client |

### 7.2 Server-Side SDK (Python)

```python
# app/services/livekit_service.py
from livekit import api
from livekit.api import RoomServiceClient, RoomConfig, EgressInfo

class LiveKitService:
    def __init__(self):
        self.client = api.LiveKitAPI(
            url=settings.LIVEKIT_URL,
            api_key=settings.LIVEKIT_API_KEY,
            api_secret=settings.LIVEKIT_API_SECRET,
        )

    async def create_room(self, session_id: str, max_participants: int) -> str:
        """Create a LiveKit room for this session. Returns room name."""
        room_name = f"live_{session_id}"
        await self.client.room_service.create_room(
            api.RoomConfig(
                name=room_name,
                max_participants=max_participants + 3,  # + host + co-hosts
                empty_timeout=300,  # 5 min empty before auto-close
            )
        )
        return room_name

    async def generate_token(
        self, room_name: str, user_id: int, user_name: str,
        is_host: bool = False, session_end_time: datetime
    ) -> str:
        """Generate JWT token valid until 15 min after session end."""
        token = api.AccessToken(
            api_key=settings.LIVEKIT_API_KEY,
            api_secret=settings.LIVEKIT_API_SECRET,
        ) with api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=is_host,
            can_publish_data=True,
            can_subscribe=True,
        ) as grants:
            token.grants = grants
            token.identity = str(user_id)
            token.name = user_name
            token.ttl = int((session_end_time + timedelta(minutes=15)).timestamp())
        return token.to_jwt()

    async def get_participants(self, room_name: str) -> list:
        """List current participants in a room."""
        return await self.client.room_service.list_participants(room_name)

    async def close_room(self, room_name: str):
        """Force close a room."""
        await self.client.room_service.delete_room(room_name)
```

### 7.3 Frontend Integration (React)

```tsx
// components/live/LiveKitRoom.tsx
import { LiveKitRoom as LKLiveKitRoom } from '@livekit/components-react';

interface Props {
  token: string;
  serverUrl: string;
  onDisconnected: () => void;
  children: React.ReactNode;
}

export function LiveKitRoom({ token, serverUrl, onDisconnected, children }: Props) {
  return (
    <LKLiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      options={{
        adaptiveStream: true,
        dynacast: true,
      }}
      onDisconnected={onDisconnected}
    >
      {children}
    </LKLiveKitRoom>
  );
}
```

### 7.4 Webhook Handling

```python
# app/routers/live_sessions.py (webhook handler portion)
from livekit.api import WebhookReceiver

webhook_receiver = WebhookReceiver(
    api_key=settings.LIVEKIT_API_KEY,
    api_secret=settings.LIVEKIT_API_SECRET,
)

@router.post("/webhooks/livekit")
async def handle_livekit_webhook(request: Request):
    body = await request.body()
    auth_header = request.headers.get("Authorization", "")

    # Verify webhook signature
    try:
        event = webhook_receiver.receive(body, auth_header)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Route event to handler
    handlers = {
        "room_started": handle_room_started,
        "participant_joined": handle_participant_joined,
        "participant_left": handle_participant_left,
        "egress_ended": handle_egress_ended,
        "room_finished": handle_room_finished,
    }

    handler = handlers.get(event.event)
    if handler:
        await handler(event)

    return {"status": "ok"}
```

### 7.5 Cost Projection

| Month | Sessions | Avg Attend | Minutes/Mo | Plan | Cost |
|-------|----------|-----------|------------|------|------|
| Month 1 | 500 | 4 × 45min | ~1,500 | Build (5,000 free) | $0 |
| Month 3 | 900 | 6 × 50min | ~4,500 | Build (5,000 free) | $0 |
| Month 6 | 1,800 | 8 × 55min | ~13,200 | Build (over free) | ~$4.10/mo |
| Month 12 | 3,600 | 10 × 60min | ~36,000 | Ship ($50/mo) | ~$15.50/mo |

---

## 8. User Flows

### 8.1 Attendee Journey

```
1. DISCOVERY
   └── Browse /live → See session cards (upcoming + trending)
       └── Use filters: category, date, price, language

2. SESSION DETAIL
   └── Click session → See title, description, host profile, agenda, price
       └── See capacity (42/50 filled), attendee avatars
           └── Click "Get Ticket" (100 DZD minimum)

3. CHECKOUT
   └── Review order: 1 ticket × 1,500 DZD
       └── Choose payment: Chargily or wallet
           └── Chargily: redirect → pay → callback
           └── Wallet: confirm → deduct balance

4. PRE-SESSION
   └── Calendar invite (.ics) sent
       └── Reminder: 24h before (email + in-app)
       └── Reminder: 1h before (email + in-app)
       └── 15 min before: "Join" button activates

5. LIVE ROOM (15 min before → session end)
   └── Phase 1 — Pre-join lobby (test mic/camera, set name)
       └── Phase 2 — In-session:
           └── Video grid, active speaker spotlight
           └── Chat (RTL, full history from Redis)
           └── Q&A (direct or moderated)
           └── Emoji reactions, hand raise
           └── Polls (if host starts one)

6. POST-SESSION
   └── Recording processing → available within 5 min
       └── 90-day replay access included
       └── Rating + review prompt
       └── No-show? Auto-refund processes within 48h
```

### 8.2 Creator Journey

```
1. ELIGIBILITY
   └── Must have INSTRUCTOR role (admin-approved)

2. CREATE SESSION
   └── Title, description, cover image
       └── Date, start time, end time, timezone
       └── Price (min 100 DZD) + early-bird option
       └── Capacity, language, category
       └── Agenda, materials (links/files)
       └── Settings: public vs private, Q&A mode, recording

3. SUBMIT (public) or PUBLISH (private)
   └── Public: DRAFT → SUBMITTED → admin approves → SCHEDULED
       └── Private: instantly SCHEDULED, link-only access

4. PRE-SESSION
   └── View bookings, send message to attendees
       └── Download attendee list (CSV)

5. LIVE ROOM
   └── Host controls: mute all, spotlight, start recording, end session
       └── Screen sharing, Q&A management
       └── Real-time analytics: attendee count, engagement

6. POST-SESSION
   └── Analytics: registration→attendance rate, avg watch time, chat%, revenue
       └── Recording library (download or share link)
       └── Clone session for next date
```

### 8.3 Session State Machine

```
                    ┌─────────────┐
                    │  SCHEDULED  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌─────────┐  ┌──────────┐  ┌───────────┐
        │  LIVE   │  │CANCELLED │  │CANCELLED  │
        │(on time)│  │(by host) │  │(no show)  │
        └────┬────┘  └──────────┘  └───────────┘
             │
             ▼
        ┌─────────┐
        │  ENDED  │
        └────┬────┘
             │
             ▼
        ┌──────────┐
        │ ARCHIVED │  (after 90-day replay window)
        └──────────┘
```

---

## 9. Payment & Refund Flows

### 9.1 Payment Processing

Reuses existing `PaymentService.initiate_payment()` with `LIVE_SESSION_PURCHASE` purpose.

**Flow:**
1. `POST /live-sessions/:id/book` → calls `PaymentService.initiate_payment()`
2. Creates `Transaction` with `purpose = LIVE_SESSION_PURCHASE`
3. If amount > 0: redirect to Chargily checkout
4. Chargily webhook → `Transaction.COMPLETED` → `Booking.CONFIRMED`
5. If amount = 0 (shouldn't happen on MVP): `Booking.CONFIRMED` immediately

### 9.2 Creator Payout Flow

```
Session ends
    │
    ▼
48h hold (process no-show refunds)
    │
    ▼
Weekly batch (every Monday):
    1. Calculate: revenue - refunds - platform_fee(20%)
    2. Credit creator's wallet
    3. Generate payout record
    4. Creator sees "Available for withdrawal"
```

### 9.3 No-Show Refund Automation

```python
def process_no_show_refunds(session: LiveSession):
    for booking in session.bookings:
        if booking.status != "CONFIRMED":
            continue

        # Find participant record
        participant = session.participants.find(booking.userId)
        if not participant:
            # Never joined at all
            attendance_pct = 0.0
        else:
            total_duration = (session.endedAt - session.startedAt).seconds
            attendance_pct = participant.durationSeconds / total_duration if total_duration > 0 else 0.0

        # Update booking attendance
        booking.attendancePercent = attendance_pct

        if attendance_pct < 0.5 and booking.pricePaidCents > 0:
            # 50% wallet credit refund
            refund_amount = booking.pricePaidCents // 2
            wallet_service.credit_wallet(
                user_id=booking.userId,
                amount_cents=refund_amount,
                purpose="LIVE_SESSION_REFUND",
                reference_id=booking.id,
            )
            booking.status = "REFUNDED"
            booking.refundCents = refund_amount
            booking.refundReason = "no_show_<50%"
            booking.refundedAt = now()
        elif attendance_pct >= 0.5:
            booking.status = "ATTENDED"
        else:
            booking.status = "NO_SHOW"
```

---

## 10. Policies: Cancellation, No-Show, Chargeback

### 10.1 Creator Cancellation Policy

| Timing | Refund to Attendees | Coupon | Creator Penalty |
|--------|---------------------|--------|-----------------|
| **>48h** before start | Full refund (original method) | None | None |
| **24-48h** before start | Full refund (original method) | 20% off next session | Warning on profile |
| **<24h** before start | Full refund (original method) | 100% off next session (full value) | Strike on account; 3 strikes = 30d ban |

**Important:** If creator cancels, no-show refund rules do NOT apply. The cancellation policy is the sole governing policy — refunding is about the service not being rendered, not about attendance.

**Coupon distribution:**
- Only attendees who **actually joined** (participant record exists) get the coupon
- No-shows get their refund but not the goodwill coupon — they didn't experience the disruption

### 10.2 No-Show Refund Policy

| Condition | Outcome |
|-----------|---------|
| Attendee joined ≥ 50% of session | Full price kept by creator |
| Attendee joined < 50% of session | 50% auto-refunded as wallet credit |
| Attendee never joined (no participant record) | 50% auto-refunded as wallet credit |

**Processing:** Automated via Celery task 48h after session ends.

### 10.3 Chargeback / Dispute Policy

| Scenario | Outcome |
|----------|---------|
| First chargeback on creator's account | Platform absorbs — creator warned |
| Second+ within 90 days | Creator's future session earnings held 60 days before payout |
| Habitual (>5% of sessions disputed) | Account suspension, review |

---

## 11. Phased Implementation Plan

### 11.1 Phase 1 — MVP (Weeks 1-4)

**Goal:** Creators can host paid live sessions. Attendees can discover, book, and join.

#### Week 1: Foundation

| Day | Task | Backend | Frontend |
|-----|------|---------|----------|
| 1 | Prisma schema migration | `LiveSession`, `LiveSessionParticipant`, `LiveSessionBooking` models + enums | — |
| 2 | LiveKit service | `livekit_service.py` — token, room create/close | — |
| 3 | Session CRUD | `live_session_service.py` + router endpoints | — |
| 4 | Discovery API | `GET /live-sessions` with filters + trending | — |
| 5 | Discovery page | — | `/live` page with tabs, filters, cards |

#### Week 2: Registration & Payment

| Day | Task | Backend | Frontend |
|-----|------|---------|----------|
| 6 | Booking + payment flow | Book endpoint + Chargily integration | — |
| 7 | Session detail page | — | `/live/[id]` page |
| 8 | Checkout flow | — | Payment integration |
| 9 | My bookings page | `GET /live-sessions/my-bookings` | `/live/my` page |
| 10 | Reminder emails | Celery task for 24h + 1h reminders | — |

#### Week 3: Live Room

| Day | Task | Backend | Frontend |
|-----|------|---------|----------|
| 11 | LiveKit webhook handler | Attendance tracking via webhooks | — |
| 12 | Pre-join lobby + LiveKitRoom | — | `PreJoinForm`, `LiveKitRoom` |
| 13 | Video conference + Chat | Redis chat history endpoint | `VideoConference`, `ChatSidebar` |
| 14 | Q&A panel + Reactions | — | `QAPanel`, `EmojiReactionPicker` |
| 15 | Stream page + reconnect | Token expiration (15 min after end) | `/live/stream/[id]` page |

#### Week 4: Creator Dashboard & Polish

| Day | Task | Backend | Frontend |
|-----|------|---------|----------|
| 16 | Create + edit session | `POST/PUT /live-sessions` | `/live/create`, `/live/manage/[id]` |
| 17 | Creator session list | `GET /live-sessions/my` | `/live/manage` |
| 18 | Booking management | `GET /live-sessions/:id/bookings` | `/live/manage/[id]/bookings` |
| 19 | No-show refund automation | Celery task for auto-refund | — |
| 20 | Feature flag + testing | Seed `live_sessions` flag | Flag-gated UI |

### 11.2 Phase 2 — Scale (Weeks 5-8)

**Goal:** Organization private sessions, co-hosts, advanced features.

| Feature | Backend | Frontend |
|---------|---------|----------|
| Organization sessions | Org FK checks, invite-only flows | Invite UI (link, email, notification) |
| Co-hosts (up to 3) | Co-host permission model | Co-host controls in live room |
| Transferable tickets | Ticket transfer endpoint + 24h lock | Transfer UI in booking management |
| Waitlist | Waitlist table + auto-notify on opening | "Join Waitlist" on session detail |
| Replay tiers | Tiered entitlement (7/90/lifetime) | Replay library page |
| Download recordings | Signed URL generation for download | Download button |
| Full trending algorithm | Engagement tracking + weighted formula | Trending tab update |
| Analytics dashboard | Aggregated metrics materialized view | `/live/manage/[id]/analytics` |
| Profanity filter (server-side) | WebSocket interceptor + audit log | Client-side live filter |

### 11.3 Phase 3 — Self-Hosted LiveKit (Future)

| Step | Detail | Trigger |
|------|--------|---------|
| Deploy LiveKit server on staging | 2× AWS EC2, TURN server | Phase 2 complete |
| Update DNS | `livekit.podacium.com` → self-hosted LB | Staging verified |
| Update env vars | Rotate API_KEY/API_SECRET | Cutover |
| Parallel run | 4 weeks both cloud + self-hosted | Monitor stability |
| Switch default | Self-hosted → primary; Cloud → rollback | Confidence met |

---

## 12. Infrastructure & Environment

### 12.1 Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `LIVEKIT_URL` | LiveKit server URL (`wss://...`) | LiveKit Cloud dashboard |
| `LIVEKIT_API_KEY` | LiveKit API key | LiveKit Cloud dashboard |
| `LIVEKIT_API_SECRET` | LiveKit API secret | LiveKit Cloud dashboard |
| `LIVEKIT_WEBHOOK_SECRET` | Webhook HMAC secret | LiveKit Cloud dashboard |
| `LIVE_SESSIONS_ENABLED` | Feature flag (boolean) | Seeded in FeatureFlag table |

### 12.2 Feature Flag

Seeded in database:

```json
{
  "key": "live_sessions",
  "name": "Live Sessions Marketplace",
  "description": "Enable live session discovery, booking, and streaming",
  "isEnabled": false,
  "category": "edtech"
}
```

---

## 13. Testing Strategy

### 13.1 Backend Tests

| Test Category | Scenarios | Count |
|---------------|-----------|-------|
| **Session CRUD** | Create, edit, cancel, clone, list | 8 |
| **Booking** | Book (free), book (paid + successful payment), book (paid + failed), cancel booking | 8 |
| **No-show refund** | <50% attendance → 50% wallet credit, ≥50% → no refund, never joined | 6 |
| **Cancellation** | >48h, 24-48h, <24h — verify refund + coupon logic | 9 |
| **LiveKit** | Token generation, room creation, room closing, webhook signature verification | 6 |
| **Permissions** | Non-instructor cannot create, non-owner cannot edit, non-booked cannot join | 6 |
| **Edge cases** | Capacity full, duplicate booking, session already started, expired token | 6 |
| **Total** | | **49** |

### 13.2 Frontend Tests

| Component | Scenarios |
|-----------|-----------|
| Discovery page | Render sessions, filter by category, filter by price, empty state |
| Session detail | Booking CTA, waitlist display, past session (replay) |
| Pre-join form | Camera/mic selector, name validation, RTL layout |
| Video conference | Participant grid, active speaker, screen share |
| Chat sidebar | Send message, RTL, history on reconnect, profanity filter |
| Creator dashboard | Create session, view bookings, view analytics, clone |

### 13.3 E2E Tests (Playwright)

| Test | Flow |
|------|------|
| Attendee books and joins session | Register (100 DZD) → join live room → chat → leave → see replay |
| Creator creates and hosts session | Create → set price → publish → start room → share screen → end |
| Cancellation triggers refund | Creator cancels → attendee gets refund email + wallet credit |
| No-show auto-refund | Attendee books but never joins → wallet credited within 48h |

---

## 14. Rabbit Holes & Traps

| Trap | Mitigation |
|------|------------|
| **Free-tier LiveKit limits** (5,000 min/mo) | Monitor usage via Cloud dashboard. Set alert at 4,000 min. Upgrade to Ship plan before hitting cap. |
| **Chargily refunds are slow** (3-7 business days) | Use wallet credit for <1000 DZD refunds (which is most sessions). Avoid gateway refunds entirely for MVP. |
| **Redis memory for chat history** | Set TTL: 24h after session end. Use sorted sets with `EXPIRE`. One session's chat at 10 msg/sec × 2h ≈ 72k messages ≈ ~10MB. Negligible. |
| **Webhook delivery failures** | LiveKit retries with exponential backoff (up to 5 times, 10 min). If still failing, poll `ListParticipants` API every 60s as fallback. |
| **Session starts late (creator no-show)** | After 15 min past start time with no host: auto-cancel, full refunds, no goodwill coupon (service was never rendered). |
| **Token leaks — attendee generates their own token** | Backend must validate booking before issuing token. Never expose API_SECRET to client. Use server-side token generation only. |
| **Creator double-books time slot** | Show existing sessions on creator's calendar when creating new one. Soft warning, not a hard block. |
| **Arabic RTL in chat + video grid** | Apply RTL at the document level via `dir` attribute. Use CSS logical properties (`margin-inline-start` vs `margin-left`). Test with Arabic, French, English text. |

---

## 15. Appendix: Key Constants

| Constant | Value | Location |
|----------|-------|----------|
| Minimum ticket price | 100 DZD (100 cents) | `LiveSession.priceCents` |
| No-show refund threshold | 50% attendance | `RefundService` |
| No-show refund percentage | 50% of ticket price | `RefundService` |
| No-show processing delay | 48 hours after session end | Celery task |
| Payout schedule | Weekly (Monday) | `wallet_service.py` |
| Token validity buffer | 15 minutes after session end | `LiveKitService` |
| Max concurrent LiveKit sessions | 30 | Infrastructure target |
| Replay access duration | 90 days (MVP), tiered (Phase 2) | Entitlement |
| Chat history TTL | 24h after session end | Redis config |
| Co-host limit | 3 (Phase 2) | Permission model |
| Transfer window | Up to 24h before session | Booking policy |
| Waitlist claim window | 2 hours | Booking policy |
| Early-bird deadline | Creator-configurable | `LiveSession.earlyBirdDeadline` |
| Free host codes per month | 5 per creator | Creator promotion |
| Max connections per user | 2 | LiveKit identity config |
| Late-join cutoff (free sessions) | 15 min past start | `LiveSessionService` |
| Minutes threshold for trending | 7 days | `TrendingService` |
| Urgency boost window | 24h before start, has empty seats | `TrendingService` |
| Urgency boost multiplier | ×5 | `TrendingService` |
| Chargeback — platform absorbs | First per creator | `DisputeService` |
| Creator strike limit | 3 strikes = 30d ban | `ModerationService` |
| Room empty timeout | 300s (5 min) | LiveKit room config |

### Legacy: Live Classroom (Education-Attached Sessions)

*This section is preserved from `docs/lms-enhancement-plan/05-live-classroom.md` (superseded).*

The original "Live Classroom" concept was designed as modules/lessons-attached sessions with a Daily.co MVP → LiveKit migration path. The Live Events Marketplace (§1-14) replaced this design. Key differences:

| Old Plan (Classroom) | New Plan (Marketplace) | Rationale |
|----------------------|----------------------|-----------|
| Daily.co MVP → LiveKit scale | **LiveKit Cloud from day one** → Self-host later | Skip provider migration |
| Attached to Module/Lesson | **Standalone model** with optional FKs | Zero disruption; cross-pillar |
| Free sessions | **100 DZD minimum** | Commitment fee drops no-shows |
| Attendance tracking only | **Full marketplace**: discovery, booking, replay, refunds | Revenue-generating |
| No ticketing | **Ticketed events** with Chargily | Monetization from day one |

When a live session is linked to a `moduleId`:
- Only enrolled students can book (in addition to paid ticketing)
- Session appears on the course/module page as "Live Q&A"
- Attendance contributes to course completion (future: optional)
- Recording becomes accessible in course materials (future: optional)
