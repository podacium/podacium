-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('PLATFORM_FEE', 'FREELANCER_SERVICE', 'COURSE_PURCHASE', 'SUBSCRIPTION');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED');
CREATE TYPE "KycStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "SettlementMethod" AS ENUM ('DIRECT_BARIDIMOB', 'DIRECT_BANK_TRANSFER', 'CHARGILY_EDAHABIA', 'CHARGILY_CIB');

-- AlterTable FreelancerProfile
ALTER TABLE "FreelancerProfile" ADD COLUMN "isAnaeRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "anaeCardNumber" TEXT,
ADD COLUMN "ribCcpNumber" TEXT;

-- AlterTable Organization
ALTER TABLE "Organization" ADD COLUMN "nisNumber" TEXT,
ADD COLUMN "nifNumber" TEXT,
ADD COLUMN "rcNumber" TEXT,
ADD COLUMN "articleImposition" TEXT,
ADD COLUMN "taxRegime" TEXT;

-- AlterTable ContractMilestone
ALTER TABLE "ContractMilestone" ADD COLUMN "settlementMethod" "SettlementMethod",
ADD COLUMN "settlementReference" TEXT,
ADD COLUMN "deliverableKeyReleased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "releasedAt" TIMESTAMP(3);

-- CreateTable Invoice
CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL DEFAULT 'PLATFORM_FEE',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "issuerId" INTEGER,
    "issuerType" TEXT NOT NULL DEFAULT 'PLATFORM',
    "recipientId" INTEGER,
    "recipientType" TEXT NOT NULL DEFAULT 'USER',
    "contractId" INTEGER,
    "milestoneId" INTEGER,
    "subtotalDzd" INTEGER NOT NULL,
    "taxDzd" INTEGER NOT NULL DEFAULT 0,
    "totalDzd" INTEGER NOT NULL,
    "taxRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "legalNotice" TEXT,
    "pdfUrl" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable InvoiceItem
CREATE TABLE "InvoiceItem" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceDzd" INTEGER NOT NULL,
    "totalPriceDzd" INTEGER NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserKyc
CREATE TABLE "UserKyc" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "nationalIdNumber" TEXT,
    "anaeCardNumber" TEXT,
    "anaeCertificateUrl" TEXT,
    "ribCcpNumber" TEXT,
    "status" "KycStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "rejectionReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserKyc_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProjectSubmission
CREATE TABLE "ProjectSubmission" (
    "id" SERIAL NOT NULL,
    "milestoneId" INTEGER NOT NULL,
    "deliverableUrl" TEXT NOT NULL,
    "encryptionKeyHash" TEXT,
    "submissionNotes" TEXT,
    "clientFeedback" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractMilestone_settlementReference_idx" ON "ContractMilestone"("settlementReference");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");
CREATE INDEX "Invoice_issuerId_idx" ON "Invoice"("issuerId");
CREATE INDEX "Invoice_recipientId_idx" ON "Invoice"("recipientId");
CREATE INDEX "Invoice_contractId_idx" ON "Invoice"("contractId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_issuedAt_idx" ON "Invoice"("issuedAt");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "UserKyc_userId_key" ON "UserKyc"("userId");
CREATE INDEX "UserKyc_userId_idx" ON "UserKyc"("userId");
CREATE INDEX "UserKyc_status_idx" ON "UserKyc"("status");
CREATE INDEX "UserKyc_anaeCardNumber_idx" ON "UserKyc"("anaeCardNumber");

-- CreateIndex
CREATE INDEX "ProjectSubmission_milestoneId_idx" ON "ProjectSubmission"("milestoneId");
CREATE INDEX "ProjectSubmission_submittedAt_idx" ON "ProjectSubmission"("submittedAt");

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserKyc" ADD CONSTRAINT "UserKyc_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSubmission" ADD CONSTRAINT "ProjectSubmission_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ContractMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
