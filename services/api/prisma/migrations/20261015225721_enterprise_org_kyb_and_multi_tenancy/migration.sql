/*
  Warnings:

  - You are about to drop the column `search_vector` on the `Module` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `circuit_state` on the `WebhookEndpoint` table. All the data in the column will be lost.
  - You are about to drop the column `failure_count` on the `WebhookEndpoint` table. All the data in the column will be lost.
  - You are about to drop the column `last_failure_at` on the `WebhookEndpoint` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "KybStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING_VERIFICATION', 'REQUIRES_CLARIFICATION', 'APPROVED', 'REJECTED', 'SUSPENDED_FRAUD');

-- CreateEnum
CREATE TYPE "CorporateDocumentType" AS ENUM ('CNRC_EXTRAIT_RC', 'NIF_ATTESTATION', 'DECLARATION_G8', 'STATUTS_SOCIETE', 'CARTE_AUTO_ENTREPRENEUR', 'CARTE_ARTISAN', 'PROCURATION_NOTARIEE', 'ATTESTATION_CNAS_CASNOS');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'BILLING_ADMIN', 'HIRING_MANAGER', 'ANALYST', 'VIEWER', 'AUDITOR');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'MODERATOR';

-- DropForeignKey
ALTER TABLE "BiAuditLog" DROP CONSTRAINT "BiAuditLog_datasetId_fkey";

-- DropForeignKey
ALTER TABLE "BiAuditLog" DROP CONSTRAINT "BiAuditLog_organizationId_fkey";

-- DropIndex
DROP INDEX "module_search_idx";

-- DropIndex
DROP INDEX "Organization_ownerId_key";

-- DropIndex
DROP INDEX "project_search_idx";

-- DropIndex
DROP INDEX "user_search_idx";

-- AlterTable
ALTER TABLE "Dashboard" ADD COLUMN     "departmentId" INTEGER;

-- AlterTable
ALTER TABLE "Dataset" ADD COLUMN     "departmentId" INTEGER;

-- AlterTable
ALTER TABLE "IntegrationWorkflow" ALTER COLUMN "triggerConfig" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "organizationId" INTEGER,
ADD COLUMN     "userId" INTEGER,
ALTER COLUMN "recipientType" SET DEFAULT 'ORGANIZATION';

-- AlterTable
ALTER TABLE "LiveSession" ADD COLUMN     "recordingEgressId" TEXT;

-- AlterTable
ALTER TABLE "MailAccount" ALTER COLUMN "imapHost" SET DEFAULT 'imap.purelymail.com',
ALTER COLUMN "smtpHost" SET DEFAULT 'smtp.purelymail.com';

-- AlterTable
ALTER TABLE "Module" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "OrganizationMember" ADD COLUMN     "departmentId" INTEGER;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "WebhookEndpoint" DROP COLUMN "circuit_state",
DROP COLUMN "failure_count",
DROP COLUMN "last_failure_at",
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "RowLevelPolicy" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "datasetId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "userAttribute" TEXT,
    "columnName" TEXT NOT NULL,
    "operator" TEXT NOT NULL DEFAULT 'eq',
    "valuePredicate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RowLevelPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardComment" (
    "id" SERIAL NOT NULL,
    "dashboardId" INTEGER NOT NULL,
    "widgetId" INTEGER,
    "authorId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "content" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DashboardComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardBookmark" (
    "id" SERIAL NOT NULL,
    "dashboardId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(255),
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "filterState" JSONB NOT NULL,
    "layoutState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardSnapshot" (
    "id" SERIAL NOT NULL,
    "dashboardId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "filterState" JSONB NOT NULL,
    "frozenData" JSONB NOT NULL,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardShareLink" (
    "id" SERIAL NOT NULL,
    "dashboardId" INTEGER NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "passwordHash" VARCHAR(255),
    "expiresAt" TIMESTAMP(3),
    "maxViews" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "canFilter" BOOLEAN NOT NULL DEFAULT true,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "defaultFilters" JSONB,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMP(3),

    CONSTRAINT "DashboardShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardTemplate" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "config" JSONB,
    "layout" JSONB,
    "theme" JSONB,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" INTEGER,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" SERIAL NOT NULL,
    "jobType" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationKyb" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "legalStructure" TEXT NOT NULL,
    "shareCapitalDzd" BIGINT,
    "rcNumber" TEXT NOT NULL,
    "rcWilayaCode" TEXT NOT NULL,
    "rcDateImmatriculation" TIMESTAMP(3),
    "nifNumber" TEXT NOT NULL,
    "nisNumber" TEXT,
    "articleImposition" TEXT,
    "taxRegime" TEXT,
    "headquartersAddress" TEXT NOT NULL,
    "city" "City" NOT NULL DEFAULT 'ALGIERS',
    "status" "KybStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "rejectionReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" INTEGER,
    "qrVerifiedAt" TIMESTAMP(3),
    "qrVerificationReceipt" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationKyb_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporateDocument" (
    "id" SERIAL NOT NULL,
    "kybId" INTEGER NOT NULL,
    "documentType" "CorporateDocumentType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "fileSize" INTEGER NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT true,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "CorporateDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationKybLog" (
    "id" SERIAL NOT NULL,
    "kybId" INTEGER NOT NULL,
    "adminId" INTEGER,
    "previousStatus" "KybStatus" NOT NULL,
    "newStatus" "KybStatus" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationKybLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "wilayaCode" INTEGER NOT NULL,
    "city" "City" NOT NULL,
    "address" TEXT,
    "phoneNumber" TEXT,
    "isHeadquarters" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamLicensePool" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "moduleId" TEXT,
    "pathId" TEXT,
    "totalSeats" INTEGER NOT NULL,
    "allocatedSeats" INTEGER NOT NULL DEFAULT 0,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamLicensePool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatAllocation" (
    "id" SERIAL NOT NULL,
    "poolId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "SeatAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RowLevelPolicy_datasetId_idx" ON "RowLevelPolicy"("datasetId");

-- CreateIndex
CREATE INDEX "RowLevelPolicy_organizationId_idx" ON "RowLevelPolicy"("organizationId");

-- CreateIndex
CREATE INDEX "RowLevelPolicy_role_idx" ON "RowLevelPolicy"("role");

-- CreateIndex
CREATE INDEX "RowLevelPolicy_isActive_idx" ON "RowLevelPolicy"("isActive");

-- CreateIndex
CREATE INDEX "DashboardComment_dashboardId_isResolved_idx" ON "DashboardComment"("dashboardId", "isResolved");

-- CreateIndex
CREATE INDEX "DashboardComment_widgetId_idx" ON "DashboardComment"("widgetId");

-- CreateIndex
CREATE INDEX "DashboardComment_authorId_idx" ON "DashboardComment"("authorId");

-- CreateIndex
CREATE INDEX "DashboardComment_parentId_idx" ON "DashboardComment"("parentId");

-- CreateIndex
CREATE INDEX "DashboardBookmark_dashboardId_userId_idx" ON "DashboardBookmark"("dashboardId", "userId");

-- CreateIndex
CREATE INDEX "DashboardBookmark_dashboardId_isShared_idx" ON "DashboardBookmark"("dashboardId", "isShared");

-- CreateIndex
CREATE INDEX "DashboardSnapshot_dashboardId_createdAt_idx" ON "DashboardSnapshot"("dashboardId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardShareLink_token_key" ON "DashboardShareLink"("token");

-- CreateIndex
CREATE INDEX "DashboardShareLink_token_isRevoked_idx" ON "DashboardShareLink"("token", "isRevoked");

-- CreateIndex
CREATE INDEX "DashboardShareLink_dashboardId_idx" ON "DashboardShareLink"("dashboardId");

-- CreateIndex
CREATE INDEX "DashboardTemplate_category_idx" ON "DashboardTemplate"("category");

-- CreateIndex
CREATE INDEX "DashboardTemplate_organizationId_idx" ON "DashboardTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "DashboardTemplate_isOfficial_idx" ON "DashboardTemplate"("isOfficial");

-- CreateIndex
CREATE INDEX "ScheduledJob_jobType_idx" ON "ScheduledJob"("jobType");

-- CreateIndex
CREATE INDEX "ScheduledJob_status_idx" ON "ScheduledJob"("status");

-- CreateIndex
CREATE INDEX "ScheduledJob_nextRunAt_idx" ON "ScheduledJob"("nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationKyb_organizationId_key" ON "OrganizationKyb"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationKyb_rcNumber_key" ON "OrganizationKyb"("rcNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationKyb_nifNumber_key" ON "OrganizationKyb"("nifNumber");

-- CreateIndex
CREATE INDEX "OrganizationKyb_status_idx" ON "OrganizationKyb"("status");

-- CreateIndex
CREATE INDEX "OrganizationKyb_rcNumber_idx" ON "OrganizationKyb"("rcNumber");

-- CreateIndex
CREATE INDEX "OrganizationKyb_nifNumber_idx" ON "OrganizationKyb"("nifNumber");

-- CreateIndex
CREATE INDEX "OrganizationKyb_rcWilayaCode_idx" ON "OrganizationKyb"("rcWilayaCode");

-- CreateIndex
CREATE INDEX "CorporateDocument_kybId_documentType_idx" ON "CorporateDocument"("kybId", "documentType");

-- CreateIndex
CREATE INDEX "CorporateDocument_fileSha256_idx" ON "CorporateDocument"("fileSha256");

-- CreateIndex
CREATE INDEX "OrganizationKybLog_kybId_idx" ON "OrganizationKybLog"("kybId");

-- CreateIndex
CREATE INDEX "OrganizationKybLog_createdAt_idx" ON "OrganizationKybLog"("createdAt");

-- CreateIndex
CREATE INDEX "Department_organizationId_idx" ON "Department"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_slug_key" ON "Department"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "Branch_organizationId_idx" ON "Branch"("organizationId");

-- CreateIndex
CREATE INDEX "Branch_wilayaCode_idx" ON "Branch"("wilayaCode");

-- CreateIndex
CREATE INDEX "TeamLicensePool_organizationId_idx" ON "TeamLicensePool"("organizationId");

-- CreateIndex
CREATE INDEX "SeatAllocation_userId_idx" ON "SeatAllocation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAllocation_poolId_userId_key" ON "SeatAllocation"("poolId", "userId");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "BiAuditLog_eventType_idx" ON "BiAuditLog"("eventType");

-- CreateIndex
CREATE INDEX "BiAuditLog_organizationId_createdAt_idx" ON "BiAuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "BiAuditLog_datasetId_createdAt_idx" ON "BiAuditLog"("datasetId", "createdAt");

-- CreateIndex
CREATE INDEX "Dashboard_departmentId_idx" ON "Dashboard"("departmentId");

-- CreateIndex
CREATE INDEX "Dataset_departmentId_idx" ON "Dataset"("departmentId");

-- CreateIndex
CREATE INDEX "Decision_organizationId_status_idx" ON "Decision"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Decision_organizationId_createdAt_idx" ON "Decision"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationWorkflow_userId_idx" ON "IntegrationWorkflow"("userId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");

-- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_status_issuedAt_idx" ON "Invoice"("organizationId", "status", "issuedAt");

-- CreateIndex
CREATE INDEX "OrganizationMember_departmentId_idx" ON "OrganizationMember"("departmentId");

-- CreateIndex
CREATE INDEX "QualityIssue_datasetId_status_idx" ON "QualityIssue"("datasetId", "status");

-- CreateIndex
CREATE INDEX "QualityIssue_datasetId_severity_idx" ON "QualityIssue"("datasetId", "severity");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_userId_idx" ON "WebhookEndpoint"("userId");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_circuitState_idx" ON "WebhookEndpoint"("circuitState");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RowLevelPolicy" ADD CONSTRAINT "RowLevelPolicy_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RowLevelPolicy" ADD CONSTRAINT "RowLevelPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dashboard" ADD CONSTRAINT "Dashboard_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardComment" ADD CONSTRAINT "DashboardComment_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardComment" ADD CONSTRAINT "DashboardComment_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "Widget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardComment" ADD CONSTRAINT "DashboardComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardComment" ADD CONSTRAINT "DashboardComment_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardComment" ADD CONSTRAINT "DashboardComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DashboardComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardBookmark" ADD CONSTRAINT "DashboardBookmark_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardBookmark" ADD CONSTRAINT "DashboardBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardSnapshot" ADD CONSTRAINT "DashboardSnapshot_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardSnapshot" ADD CONSTRAINT "DashboardSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardShareLink" ADD CONSTRAINT "DashboardShareLink_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardShareLink" ADD CONSTRAINT "DashboardShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionHistory" ADD CONSTRAINT "DecisionHistory_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionHistory" ADD CONSTRAINT "DecisionHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionComment" ADD CONSTRAINT "DecisionComment_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionComment" ADD CONSTRAINT "DecisionComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardTemplate" ADD CONSTRAINT "DashboardTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardTemplate" ADD CONSTRAINT "DashboardTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiAuditLog" ADD CONSTRAINT "BiAuditLog_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiAuditLog" ADD CONSTRAINT "BiAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationKyb" ADD CONSTRAINT "OrganizationKyb_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationKyb" ADD CONSTRAINT "OrganizationKyb_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateDocument" ADD CONSTRAINT "CorporateDocument_kybId_fkey" FOREIGN KEY ("kybId") REFERENCES "OrganizationKyb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationKybLog" ADD CONSTRAINT "OrganizationKybLog_kybId_fkey" FOREIGN KEY ("kybId") REFERENCES "OrganizationKyb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationKybLog" ADD CONSTRAINT "OrganizationKybLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamLicensePool" ADD CONSTRAINT "TeamLicensePool_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "TeamLicensePool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
