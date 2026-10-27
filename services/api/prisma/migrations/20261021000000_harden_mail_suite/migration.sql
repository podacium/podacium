-- Harden the Corporate Mail Suite: attachment ownership, scan metadata,
-- audit-log retention, and duplicate-message protection.

-- ── MailAttachment: own uploads before they are attached to a message ────────
ALTER TABLE "MailAttachment" ADD COLUMN IF NOT EXISTS "mailAccountId" INTEGER;
ALTER TABLE "MailAttachment" ADD COLUMN IF NOT EXISTS "scanStatus" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "MailAttachment" ADD COLUMN IF NOT EXISTS "scanEngine" TEXT;

-- Backfill account ownership from the parent message where possible.
UPDATE "MailAttachment" a
SET "mailAccountId" = m."mailAccountId"
FROM "MailMessage" m
WHERE a."mailMessageId" = m."id" AND a."mailAccountId" IS NULL;

-- Compose uploads exist before a message does.
ALTER TABLE "MailAttachment" ALTER COLUMN "mailMessageId" DROP NOT NULL;

ALTER TABLE "MailAttachment" DROP CONSTRAINT IF EXISTS "MailAttachment_mailMessageId_fkey";
ALTER TABLE "MailAttachment" ADD CONSTRAINT "MailAttachment_mailMessageId_fkey"
    FOREIGN KEY ("mailMessageId") REFERENCES "MailMessage"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MailAttachment" DROP CONSTRAINT IF EXISTS "MailAttachment_mailAccountId_fkey";
ALTER TABLE "MailAttachment" ADD CONSTRAINT "MailAttachment_mailAccountId_fkey"
    FOREIGN KEY ("mailAccountId") REFERENCES "MailAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "MailAttachment_mailAccountId_idx"
    ON "MailAttachment"("mailAccountId");

-- ── EmailAuditLog: deleting a user must not erase the audit trail ───────────
ALTER TABLE "EmailAuditLog" DROP CONSTRAINT IF EXISTS "EmailAuditLog_actorId_fkey";
ALTER TABLE "EmailAuditLog" ALTER COLUMN "actorId" DROP NOT NULL;
ALTER TABLE "EmailAuditLog" ADD CONSTRAINT "EmailAuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Prevent duplicate messages from concurrent syncs ────────────────────────
-- Keep the earliest row per (account, Message-ID) and per (mailbox, UID).
DELETE FROM "MailMessage" a
USING "MailMessage" b
WHERE a.id > b.id
  AND a."mailAccountId" = b."mailAccountId"
  AND a."internetMessageId" IS NOT NULL
  AND a."internetMessageId" = b."internetMessageId";

DELETE FROM "MailMessage" a
USING "MailMessage" b
WHERE a.id > b.id
  AND a."mailboxId" = b."mailboxId"
  AND a.uid IS NOT NULL
  AND a.uid = b.uid;

CREATE UNIQUE INDEX IF NOT EXISTS "MailMessage_mailAccountId_internetMessageId_key"
    ON "MailMessage"("mailAccountId", "internetMessageId");
CREATE UNIQUE INDEX IF NOT EXISTS "MailMessage_mailboxId_uid_key"
    ON "MailMessage"("mailboxId", "uid");
