-- CreateEnum
CREATE TYPE "PlatformAppealTargetType" AS ENUM ('REVIEW', 'COURSE_REJECTION', 'ACCOUNT_BAN', 'WALLET_FREEZE');

-- CreateEnum
CREATE TYPE "PlatformAppealStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PendingActionStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformAppeal" (
    "id" SERIAL NOT NULL,
    "targetType" "PlatformAppealTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "appealerId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PlatformAppealStatus" NOT NULL DEFAULT 'PENDING',
    "resolutionNotes" TEXT,
    "resolvedById" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PendingAdminAction" (
    "id" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetResource" TEXT NOT NULL,
    "targetId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "PendingActionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "initiatorId" INTEGER NOT NULL,
    "approverId" INTEGER,
    "rejectionReason" TEXT,
    "approvalNotes" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingAdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformAppeal_targetType_targetId_idx" ON "PlatformAppeal"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "PlatformAppeal_appealerId_idx" ON "PlatformAppeal"("appealerId");
CREATE INDEX IF NOT EXISTS "PlatformAppeal_status_idx" ON "PlatformAppeal"("status");
CREATE INDEX IF NOT EXISTS "PlatformAppeal_createdAt_idx" ON "PlatformAppeal"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PendingAdminAction_actionType_status_idx" ON "PendingAdminAction"("actionType", "status");
CREATE INDEX IF NOT EXISTS "PendingAdminAction_initiatorId_idx" ON "PendingAdminAction"("initiatorId");
CREATE INDEX IF NOT EXISTS "PendingAdminAction_approverId_idx" ON "PendingAdminAction"("approverId");
CREATE INDEX IF NOT EXISTS "PendingAdminAction_status_expiresAt_idx" ON "PendingAdminAction"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "PlatformAppeal" ADD CONSTRAINT "PlatformAppeal_appealerId_fkey" FOREIGN KEY ("appealerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformAppeal" ADD CONSTRAINT "PlatformAppeal_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingAdminAction" ADD CONSTRAINT "PendingAdminAction_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PendingAdminAction" ADD CONSTRAINT "PendingAdminAction_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
