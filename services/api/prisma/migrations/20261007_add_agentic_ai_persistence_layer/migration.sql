-- CreateEnum
CREATE TYPE "AiSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('SYSTEM', 'USER', 'ASSISTANT', 'TOOL');

-- CreateEnum
CREATE TYPE "AiToolStatus" AS ENUM ('PENDING', 'SUCCESS', 'ERROR', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "AiIntentStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'REJECTED', 'EXECUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AiAgentType" AS ENUM ('GENERAL_ASSISTANT', 'FREELANCE_ADVISOR', 'BI_ANALYST', 'COURSE_TUTOR', 'SUPPORT_AGENT');

-- CreateTable
CREATE TABLE "AiSession" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "organizationId" INTEGER,
    "agentType" "AiAgentType" NOT NULL DEFAULT 'GENERAL_ASSISTANT',
    "status" "AiSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "systemPromptOverride" TEXT,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "contextTokens" INTEGER NOT NULL DEFAULT 0,
    "summaryState" TEXT,
    "compactedUntilSequence" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AiSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "isCompacted" BOOLEAN NOT NULL DEFAULT false,
    "isSummary" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT,
    "finishReason" TEXT,
    "costMicroCents" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiToolTrace" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT,
    "toolName" TEXT NOT NULL,
    "toolCallId" TEXT,
    "inputArgs" JSONB NOT NULL,
    "outputResult" JSONB,
    "errorMessage" TEXT,
    "status" "AiToolStatus" NOT NULL DEFAULT 'PENDING',
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiToolTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiActionIntent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT,
    "intentType" TEXT NOT NULL,
    "targetEntity" TEXT,
    "targetEntityId" TEXT,
    "payload" JSONB NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" "AiIntentStatus" NOT NULL DEFAULT 'PROPOSED',
    "requiresHumanApproval" BOOLEAN NOT NULL DEFAULT false,
    "confirmedByUserId" INTEGER,
    "confirmedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiActionIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiLog" (
    "id" BIGSERIAL NOT NULL,
    "sessionId" TEXT,
    "userId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL,
    "costMicroCents" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "previousHash" TEXT NOT NULL,
    "entryHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiSession_userId_updatedAt_idx" ON "AiSession"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "AiSession_organizationId_createdAt_idx" ON "AiSession"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiSession_status_updatedAt_idx" ON "AiSession"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "AiSession_agentType_status_idx" ON "AiSession"("agentType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiMessage_sessionId_sequence_key" ON "AiMessage"("sessionId", "sequence");

-- CreateIndex
CREATE INDEX "AiMessage_sessionId_isCompacted_sequence_idx" ON "AiMessage"("sessionId", "isCompacted", "sequence" ASC);

-- CreateIndex
CREATE INDEX "AiMessage_sessionId_createdAt_idx" ON "AiMessage"("sessionId", "createdAt" ASC);

-- CreateIndex
CREATE INDEX "AiToolTrace_sessionId_startedAt_idx" ON "AiToolTrace"("sessionId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "AiToolTrace_toolName_status_startedAt_idx" ON "AiToolTrace"("toolName", "status", "startedAt");

-- CreateIndex
CREATE INDEX "AiToolTrace_messageId_idx" ON "AiToolTrace"("messageId");

-- CreateIndex
CREATE INDEX "AiActionIntent_sessionId_status_idx" ON "AiActionIntent"("sessionId", "status");

-- CreateIndex
CREATE INDEX "AiActionIntent_status_requiresHumanApproval_idx" ON "AiActionIntent"("status", "requiresHumanApproval");

-- CreateIndex
CREATE INDEX "AiActionIntent_confirmedByUserId_createdAt_idx" ON "AiActionIntent"("confirmedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AiLog_sessionId_createdAt_idx" ON "AiLog"("sessionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AiLog_userId_createdAt_idx" ON "AiLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AiLog_eventType_createdAt_idx" ON "AiLog"("eventType", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AiSession" ADD CONSTRAINT "AiSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSession" ADD CONSTRAINT "AiSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiToolTrace" ADD CONSTRAINT "AiToolTrace_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiToolTrace" ADD CONSTRAINT "AiToolTrace_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AiMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiActionIntent" ADD CONSTRAINT "AiActionIntent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiActionIntent" ADD CONSTRAINT "AiActionIntent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AiMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiActionIntent" ADD CONSTRAINT "AiActionIntent_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiLog" ADD CONSTRAINT "AiLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiLog" ADD CONSTRAINT "AiLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
