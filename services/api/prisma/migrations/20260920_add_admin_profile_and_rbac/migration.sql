-- CreateEnum
CREATE TYPE "AdminDepartment" AS ENUM ('EXECUTIVE', 'SUPER_ADMIN', 'FINANCE_AND_PAYMENTS', 'COMPLIANCE_AND_KYC', 'CONTENT_MODERATION', 'CUSTOMER_SUPPORT', 'SECURITY_AND_OPERATIONS', 'REGIONAL_WILAYA_OPS');

-- CreateEnum
CREATE TYPE "AdminPermissionDomain" AS ENUM ('SYSTEM', 'USERS', 'RBAC', 'KYC', 'BILLING', 'EDUCATION', 'FREELANCING', 'BUSINESS_INTELLIGENCE', 'SUPPORT', 'SECURITY');

-- CreateEnum
CREATE TYPE "AuditActionStatus" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY');

-- CreateTable
CREATE TABLE "AdminProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "employeeId" TEXT,
    "department" "AdminDepartment" NOT NULL DEFAULT 'CUSTOMER_SUPPORT',
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mfaEnforced" BOOLEAN NOT NULL DEFAULT true,
    "hardwareKeyRequired" BOOLEAN NOT NULL DEFAULT false,
    "allowedIpSubnets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clearanceLevel" INTEGER NOT NULL DEFAULT 1,
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "emergencyBreakGlass" BOOLEAN NOT NULL DEFAULT false,
    "lastAdminLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRole" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "hierarchyRank" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminPermission" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" "AdminPermissionDomain" NOT NULL,
    "description" TEXT,
    "isDangerous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRolePermission" (
    "id" SERIAL NOT NULL,
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUserRoleAssignment" (
    "id" SERIAL NOT NULL,
    "adminProfileId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    "assignedById" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditTrail" (
    "id" BIGSERIAL NOT NULL,
    "sequenceNumber" BIGINT NOT NULL,
    "adminProfileId" INTEGER,
    "impersonatorId" INTEGER,
    "action" TEXT NOT NULL,
    "domain" "AdminPermissionDomain" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "status" "AuditActionStatus" NOT NULL,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "geoCountry" TEXT DEFAULT 'DZ',
    "geoWilaya" INTEGER,
    "sessionId" TEXT,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT true,
    "requestId" TEXT,
    "beforeState" JSONB,
    "afterState" JSONB,
    "metadata" JSONB,
    "sha256Hash" TEXT NOT NULL,
    "previousHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditTrail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "adminProfileId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
    "hardwareKeyUsed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_userId_key" ON "AdminProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_employeeId_key" ON "AdminProfile"("employeeId");

-- CreateIndex
CREATE INDEX "AdminProfile_userId_idx" ON "AdminProfile"("userId");

-- CreateIndex
CREATE INDEX "AdminProfile_department_isActive_idx" ON "AdminProfile"("department", "isActive");

-- CreateIndex
CREATE INDEX "AdminProfile_clearanceLevel_idx" ON "AdminProfile"("clearanceLevel");

-- CreateIndex
CREATE INDEX "AdminProfile_isActive_idx" ON "AdminProfile"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRole_slug_key" ON "AdminRole"("slug");

-- CreateIndex
CREATE INDEX "AdminRole_slug_idx" ON "AdminRole"("slug");

-- CreateIndex
CREATE INDEX "AdminRole_hierarchyRank_idx" ON "AdminRole"("hierarchyRank");

-- CreateIndex
CREATE UNIQUE INDEX "AdminPermission_code_key" ON "AdminPermission"("code");

-- CreateIndex
CREATE INDEX "AdminPermission_code_idx" ON "AdminPermission"("code");

-- CreateIndex
CREATE INDEX "AdminPermission_domain_idx" ON "AdminPermission"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRolePermission_roleId_permissionId_key" ON "AdminRolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "AdminUserRoleAssignment_adminProfileId_idx" ON "AdminUserRoleAssignment"("adminProfileId");

-- CreateIndex
CREATE INDEX "AdminUserRoleAssignment_roleId_idx" ON "AdminUserRoleAssignment"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUserRoleAssignment_adminProfileId_roleId_key" ON "AdminUserRoleAssignment"("adminProfileId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAuditTrail_sequenceNumber_key" ON "AdminAuditTrail"("sequenceNumber");

-- CreateIndex
CREATE INDEX "AdminAuditTrail_sequenceNumber_idx" ON "AdminAuditTrail"("sequenceNumber");

-- CreateIndex
CREATE INDEX "AdminAuditTrail_adminProfileId_timestamp_idx" ON "AdminAuditTrail"("adminProfileId", "timestamp");

-- CreateIndex
CREATE INDEX "AdminAuditTrail_action_timestamp_idx" ON "AdminAuditTrail"("action", "timestamp");

-- CreateIndex
CREATE INDEX "AdminAuditTrail_domain_timestamp_idx" ON "AdminAuditTrail"("domain", "timestamp");

-- CreateIndex
CREATE INDEX "AdminAuditTrail_severity_timestamp_idx" ON "AdminAuditTrail"("severity", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminProfileId_revokedAt_idx" ON "AdminSession"("adminProfileId", "revokedAt");

-- CreateIndex
CREATE INDEX "AdminSession_tokenHash_idx" ON "AdminSession"("tokenHash");

-- AddForeignKey
ALTER TABLE "UserKyc" ADD CONSTRAINT "UserKyc_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRolePermission" ADD CONSTRAINT "AdminRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRolePermission" ADD CONSTRAINT "AdminRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "AdminPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserRoleAssignment" ADD CONSTRAINT "AdminUserRoleAssignment_adminProfileId_fkey" FOREIGN KEY ("adminProfileId") REFERENCES "AdminProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserRoleAssignment" ADD CONSTRAINT "AdminUserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserRoleAssignment" ADD CONSTRAINT "AdminUserRoleAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditTrail" ADD CONSTRAINT "AdminAuditTrail_adminProfileId_fkey" FOREIGN KEY ("adminProfileId") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminProfileId_fkey" FOREIGN KEY ("adminProfileId") REFERENCES "AdminProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
