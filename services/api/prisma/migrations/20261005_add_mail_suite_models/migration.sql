-- CreateEnum
CREATE TYPE "MailAccountType" AS ENUM ('PERSONAL', 'DEPARTMENTAL', 'SHARED');
CREATE TYPE "MailAccountStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'AUTH_ERROR', 'SYNCING', 'DISABLED');
CREATE TYPE "MailboxType" AS ENUM ('INBOX', 'SENT', 'DRAFTS', 'TRASH', 'SPAM', 'ARCHIVE', 'STARRED', 'CUSTOM');
CREATE TYPE "MailMessageStatus" AS ENUM ('RECEIVED', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'DRAFT', 'BOUNCED');
CREATE TYPE "MailPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable MailAccount
CREATE TABLE IF NOT EXISTS "MailAccount" (
    "id" SERIAL NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" INTEGER,
    "organizationId" INTEGER,
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "type" "MailAccountType" NOT NULL DEFAULT 'PERSONAL',
    "status" "MailAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "imapHost" TEXT NOT NULL DEFAULT 'mail.purelymail.com',
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "imapUseSsl" BOOLEAN NOT NULL DEFAULT true,
    "smtpHost" TEXT NOT NULL DEFAULT 'mail.purelymail.com',
    "smtpPort" INTEGER NOT NULL DEFAULT 465,
    "smtpUseSsl" BOOLEAN NOT NULL DEFAULT true,
    "encryptedPassword" TEXT NOT NULL,
    "dekWrapped" TEXT NOT NULL,
    "dekNonce" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "syncCursor" TEXT,
    "quotaBytes" BIGINT,
    "usedBytes" BIGINT DEFAULT 0,
    "signatureHtml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable MailAccountAdminAssignment
CREATE TABLE IF NOT EXISTS "MailAccountAdminAssignment" (
    "id" SERIAL NOT NULL,
    "mailAccountId" INTEGER NOT NULL,
    "adminProfileId" INTEGER NOT NULL,
    "canRead" BOOLEAN NOT NULL DEFAULT true,
    "canSend" BOOLEAN NOT NULL DEFAULT false,
    "canManage" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailAccountAdminAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable Mailbox
CREATE TABLE IF NOT EXISTS "Mailbox" (
    "id" SERIAL NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "mailAccountId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "remoteName" TEXT NOT NULL,
    "type" "MailboxType" NOT NULL DEFAULT 'CUSTOM',
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "uidValidity" BIGINT,
    "lastSeenUid" BIGINT,
    "parentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable MailThread
CREATE TABLE IF NOT EXISTS "MailThread" (
    "id" SERIAL NOT NULL,
    "threadId" TEXT NOT NULL,
    "mailAccountId" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "snippet" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageCount" INTEGER NOT NULL DEFAULT 1,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "isUnread" BOOLEAN NOT NULL DEFAULT true,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "ticketId" INTEGER,
    "contractId" INTEGER,
    "disputeId" INTEGER,
    "invoiceId" INTEGER,
    "moduleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable MailMessage
CREATE TABLE IF NOT EXISTS "MailMessage" (
    "id" SERIAL NOT NULL,
    "messageId" TEXT NOT NULL,
    "internetMessageId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mailAccountId" INTEGER NOT NULL,
    "mailboxId" INTEGER NOT NULL,
    "threadId" INTEGER,
    "uid" BIGINT,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "toAddresses" TEXT[] NOT NULL,
    "ccAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bccAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "replyToAddress" TEXT,
    "subject" TEXT NOT NULL,
    "snippet" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "headers" JSONB,
    "status" "MailMessageStatus" NOT NULL DEFAULT 'RECEIVED',
    "priority" "MailPriority" NOT NULL DEFAULT 'NORMAL',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "ticketId" INTEGER,
    "contractId" INTEGER,
    "disputeId" INTEGER,
    "invoiceId" INTEGER,
    "moduleId" TEXT,
    "receivedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable MailAttachment
CREATE TABLE IF NOT EXISTS "MailAttachment" (
    "id" SERIAL NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "mailMessageId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "contentId" TEXT,
    "storagePath" TEXT NOT NULL,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "envelopeMetadata" JSONB,
    "sha256Checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable EmailAuditLog
CREATE TABLE IF NOT EXISTS "EmailAuditLog" (
    "id" BIGSERIAL NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT,
    "actorId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "previousHash" TEXT NOT NULL,
    "entryHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailAuditLog_pkey" PRIMARY KEY ("id")
);

-- Unique & Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "MailAccount_accountId_key" ON "MailAccount"("accountId");
CREATE UNIQUE INDEX IF NOT EXISTS "MailAccount_emailAddress_key" ON "MailAccount"("emailAddress");
CREATE INDEX IF NOT EXISTS "MailAccount_userId_idx" ON "MailAccount"("userId");
CREATE INDEX IF NOT EXISTS "MailAccount_organizationId_idx" ON "MailAccount"("organizationId");
CREATE INDEX IF NOT EXISTS "MailAccount_emailAddress_idx" ON "MailAccount"("emailAddress");
CREATE INDEX IF NOT EXISTS "MailAccount_status_idx" ON "MailAccount"("status");
CREATE INDEX IF NOT EXISTS "MailAccount_type_idx" ON "MailAccount"("type");

CREATE UNIQUE INDEX IF NOT EXISTS "MailAccountAdminAssignment_mailAccountId_adminProfileId_key" ON "MailAccountAdminAssignment"("mailAccountId", "adminProfileId");
CREATE INDEX IF NOT EXISTS "MailAccountAdminAssignment_adminProfileId_idx" ON "MailAccountAdminAssignment"("adminProfileId");
CREATE INDEX IF NOT EXISTS "MailAccountAdminAssignment_mailAccountId_idx" ON "MailAccountAdminAssignment"("mailAccountId");

CREATE UNIQUE INDEX IF NOT EXISTS "Mailbox_mailboxId_key" ON "Mailbox"("mailboxId");
CREATE UNIQUE INDEX IF NOT EXISTS "Mailbox_mailAccountId_remoteName_key" ON "Mailbox"("mailAccountId", "remoteName");
CREATE INDEX IF NOT EXISTS "Mailbox_mailAccountId_idx" ON "Mailbox"("mailAccountId");
CREATE INDEX IF NOT EXISTS "Mailbox_mailAccountId_type_idx" ON "Mailbox"("mailAccountId", "type");

CREATE UNIQUE INDEX IF NOT EXISTS "MailThread_threadId_key" ON "MailThread"("threadId");
CREATE INDEX IF NOT EXISTS "MailThread_mailAccountId_idx" ON "MailThread"("mailAccountId");
CREATE INDEX IF NOT EXISTS "MailThread_mailAccountId_lastMessageAt_idx" ON "MailThread"("mailAccountId", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "MailThread_ticketId_idx" ON "MailThread"("ticketId");
CREATE INDEX IF NOT EXISTS "MailThread_contractId_idx" ON "MailThread"("contractId");
CREATE INDEX IF NOT EXISTS "MailThread_disputeId_idx" ON "MailThread"("disputeId");
CREATE INDEX IF NOT EXISTS "MailThread_invoiceId_idx" ON "MailThread"("invoiceId");
CREATE INDEX IF NOT EXISTS "MailThread_moduleId_idx" ON "MailThread"("moduleId");

CREATE UNIQUE INDEX IF NOT EXISTS "MailMessage_messageId_key" ON "MailMessage"("messageId");
CREATE INDEX IF NOT EXISTS "MailMessage_mailAccountId_idx" ON "MailMessage"("mailAccountId");
CREATE INDEX IF NOT EXISTS "MailMessage_mailboxId_idx" ON "MailMessage"("mailboxId");
CREATE INDEX IF NOT EXISTS "MailMessage_threadId_idx" ON "MailMessage"("threadId");
CREATE INDEX IF NOT EXISTS "MailMessage_internetMessageId_idx" ON "MailMessage"("internetMessageId");
CREATE INDEX IF NOT EXISTS "MailMessage_fromAddress_idx" ON "MailMessage"("fromAddress");
CREATE INDEX IF NOT EXISTS "MailMessage_isRead_createdAt_idx" ON "MailMessage"("isRead", "createdAt");
CREATE INDEX IF NOT EXISTS "MailMessage_ticketId_idx" ON "MailMessage"("ticketId");
CREATE INDEX IF NOT EXISTS "MailMessage_contractId_idx" ON "MailMessage"("contractId");
CREATE INDEX IF NOT EXISTS "MailMessage_disputeId_idx" ON "MailMessage"("disputeId");
CREATE INDEX IF NOT EXISTS "MailMessage_invoiceId_idx" ON "MailMessage"("invoiceId");
CREATE INDEX IF NOT EXISTS "MailMessage_moduleId_idx" ON "MailMessage"("moduleId");

CREATE UNIQUE INDEX IF NOT EXISTS "MailAttachment_attachmentId_key" ON "MailAttachment"("attachmentId");
CREATE INDEX IF NOT EXISTS "MailAttachment_mailMessageId_idx" ON "MailAttachment"("mailMessageId");
CREATE INDEX IF NOT EXISTS "MailAttachment_attachmentId_idx" ON "MailAttachment"("attachmentId");

CREATE INDEX IF NOT EXISTS "EmailAuditLog_threadId_createdAt_idx" ON "EmailAuditLog"("threadId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailAuditLog_actorId_createdAt_idx" ON "EmailAuditLog"("actorId", "createdAt");

-- Foreign Keys
ALTER TABLE "MailAccount" ADD CONSTRAINT "MailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailAccount" ADD CONSTRAINT "MailAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MailAccountAdminAssignment" ADD CONSTRAINT "MailAccountAdminAssignment_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "MailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailAccountAdminAssignment" ADD CONSTRAINT "MailAccountAdminAssignment_adminProfileId_fkey" FOREIGN KEY ("adminProfileId") REFERENCES "AdminProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Mailbox" ADD CONSTRAINT "Mailbox_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "MailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mailbox" ADD CONSTRAINT "Mailbox_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MailThread" ADD CONSTRAINT "MailThread_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "MailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailThread" ADD CONSTRAINT "MailThread_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MailThread" ADD CONSTRAINT "MailThread_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MailThread" ADD CONSTRAINT "MailThread_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MailThread" ADD CONSTRAINT "MailThread_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MailThread" ADD CONSTRAINT "MailThread_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "MailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MailAttachment" ADD CONSTRAINT "MailAttachment_mailMessageId_fkey" FOREIGN KEY ("mailMessageId") REFERENCES "MailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailAuditLog" ADD CONSTRAINT "EmailAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
