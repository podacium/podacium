-- Migration: Add LiveSession and related models
--
-- Creates LiveSession, LiveSessionParticipant, LiveSessionBooking,
-- LiveSessionWaitlist, and LiveSessionCoHost tables along with
-- their supporting enums and indexes.
-- All operations wrapped in DO blocks for idempotency.

-- ── Enums ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "LiveSessionStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LiveSessionVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LiveSessionParticipantRole" AS ENUM ('HOST', 'CO_HOST', 'PARTICIPANT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── LiveSession ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TABLE "LiveSession" (
    "id"              TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "description"     TEXT,
    "thumbnailUrl"    TEXT,
    "category"        TEXT,
    "tags"            TEXT[] NOT NULL DEFAULT '{}',
    "status"          "LiveSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "visibility"      "LiveSessionVisibility" NOT NULL DEFAULT 'PUBLIC',
    "ownerId"         INTEGER NOT NULL,
    "scheduledAt"     TIMESTAMP(3) NOT NULL,
    "startedAt"       TIMESTAMP(3),
    "endedAt"         TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "maxParticipants" INTEGER DEFAULT 100,
    "priceAmount"     INTEGER,
    "currency"        TEXT NOT NULL DEFAULT 'DZD',
    "roomName"        TEXT,
    "roomSid"         TEXT,
    "roomMetadata"    JSONB,
    "recordingUrl"    TEXT,
    "replayUrl"       TEXT,
    "replayExpiresAt" TIMESTAMP(3),
    "transactionId"   INTEGER,
    "moduleId"        INTEGER,
    "lessonId"        INTEGER,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    "deletedAt"       TIMESTAMP(3),
    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LiveSession_transactionId_key" UNIQUE ("transactionId"),
    CONSTRAINT "LiveSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- ── LiveSessionParticipant ──────────────────────────────────────────────
DO $$ BEGIN
  CREATE TABLE "LiveSessionParticipant" (
    "id"              SERIAL NOT NULL,
    "liveSessionId"   TEXT NOT NULL,
    "userId"          INTEGER NOT NULL,
    "role"            "LiveSessionParticipantRole" NOT NULL DEFAULT 'PARTICIPANT',
    "joinedAt"        TIMESTAMP(3),
    "leftAt"          TIMESTAMP(3),
    "attendancePct"   DOUBLE PRECISION,
    "metadata"        JSONB,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    "deletedAt"       TIMESTAMP(3),
    CONSTRAINT "LiveSessionParticipant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LiveSessionParticipant_liveSessionId_userId_key" UNIQUE ("liveSessionId", "userId"),
    CONSTRAINT "LiveSessionParticipant_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE,
    CONSTRAINT "LiveSessionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- ── LiveSessionBooking ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TABLE "LiveSessionBooking" (
    "id"               SERIAL NOT NULL,
    "liveSessionId"    TEXT NOT NULL,
    "userId"           INTEGER NOT NULL,
    "transactionId"    INTEGER NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'confirmed',
    "cancelledAt"      TIMESTAMP(3),
    "refundProcessed"  BOOLEAN NOT NULL DEFAULT false,
    "attended"         BOOLEAN,
    "hostCode"         TEXT,
    "metadata"         JSONB,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    "deletedAt"        TIMESTAMP(3),
    CONSTRAINT "LiveSessionBooking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LiveSessionBooking_transactionId_key" UNIQUE ("transactionId"),
    CONSTRAINT "LiveSessionBooking_liveSessionId_userId_key" UNIQUE ("liveSessionId", "userId"),
    CONSTRAINT "LiveSessionBooking_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE,
    CONSTRAINT "LiveSessionBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT,
    CONSTRAINT "LiveSessionBooking_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- ── LiveSessionWaitlist ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TABLE "LiveSessionWaitlist" (
    "id"             SERIAL NOT NULL,
    "liveSessionId"  TEXT NOT NULL,
    "userId"         INTEGER NOT NULL,
    "notified"       BOOLEAN NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"      TIMESTAMP(3),
    CONSTRAINT "LiveSessionWaitlist_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LiveSessionWaitlist_liveSessionId_userId_key" UNIQUE ("liveSessionId", "userId"),
    CONSTRAINT "LiveSessionWaitlist_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE,
    CONSTRAINT "LiveSessionWaitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- ── LiveSessionCoHost ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TABLE "LiveSessionCoHost" (
    "id"             SERIAL NOT NULL,
    "liveSessionId"  TEXT NOT NULL,
    "userId"         INTEGER NOT NULL,
    "permissions"    TEXT NOT NULL DEFAULT 'all',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"      TIMESTAMP(3),
    CONSTRAINT "LiveSessionCoHost_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LiveSessionCoHost_liveSessionId_userId_key" UNIQUE ("liveSessionId", "userId"),
    CONSTRAINT "LiveSessionCoHost_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE,
    CONSTRAINT "LiveSessionCoHost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- ── Indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "LiveSession_ownerId_idx" ON "LiveSession"("ownerId");
CREATE INDEX IF NOT EXISTS "LiveSession_status_idx" ON "LiveSession"("status");
CREATE INDEX IF NOT EXISTS "LiveSession_scheduledAt_idx" ON "LiveSession"("scheduledAt");
CREATE INDEX IF NOT EXISTS "LiveSession_category_idx" ON "LiveSession"("category");
CREATE INDEX IF NOT EXISTS "LiveSession_visibility_status_scheduledAt_idx" ON "LiveSession"("visibility", "status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "LiveSession_deletedAt_idx" ON "LiveSession"("deletedAt");

CREATE INDEX IF NOT EXISTS "LiveSessionParticipant_userId_idx" ON "LiveSessionParticipant"("userId");
CREATE INDEX IF NOT EXISTS "LiveSessionParticipant_liveSessionId_idx" ON "LiveSessionParticipant"("liveSessionId");
CREATE INDEX IF NOT EXISTS "LiveSessionParticipant_liveSessionId_role_idx" ON "LiveSessionParticipant"("liveSessionId", "role");
CREATE INDEX IF NOT EXISTS "LiveSessionParticipant_deletedAt_idx" ON "LiveSessionParticipant"("deletedAt");

CREATE INDEX IF NOT EXISTS "LiveSessionBooking_userId_idx" ON "LiveSessionBooking"("userId");
CREATE INDEX IF NOT EXISTS "LiveSessionBooking_liveSessionId_idx" ON "LiveSessionBooking"("liveSessionId");
CREATE INDEX IF NOT EXISTS "LiveSessionBooking_transactionId_idx" ON "LiveSessionBooking"("transactionId");
CREATE INDEX IF NOT EXISTS "LiveSessionBooking_status_idx" ON "LiveSessionBooking"("status");
CREATE INDEX IF NOT EXISTS "LiveSessionBooking_deletedAt_idx" ON "LiveSessionBooking"("deletedAt");

CREATE INDEX IF NOT EXISTS "LiveSessionWaitlist_liveSessionId_idx" ON "LiveSessionWaitlist"("liveSessionId");
CREATE INDEX IF NOT EXISTS "LiveSessionWaitlist_userId_idx" ON "LiveSessionWaitlist"("userId");
CREATE INDEX IF NOT EXISTS "LiveSessionWaitlist_deletedAt_idx" ON "LiveSessionWaitlist"("deletedAt");

CREATE INDEX IF NOT EXISTS "LiveSessionCoHost_liveSessionId_idx" ON "LiveSessionCoHost"("liveSessionId");
CREATE INDEX IF NOT EXISTS "LiveSessionCoHost_userId_idx" ON "LiveSessionCoHost"("userId");
CREATE INDEX IF NOT EXISTS "LiveSessionCoHost_deletedAt_idx" ON "LiveSessionCoHost"("deletedAt");
