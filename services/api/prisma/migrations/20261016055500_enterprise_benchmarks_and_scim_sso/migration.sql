-- AlterTable: Add SCIM 2.0 & SAML SSO fields to Organization
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "verifiedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "samlEntityId" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "samlMetadataUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "scimEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add Optical QR & OCR fields to CorporateDocument
ALTER TABLE "CorporateDocument" ADD COLUMN IF NOT EXISTS "qrCodeVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CorporateDocument" ADD COLUMN IF NOT EXISTS "qrCodeRawData" TEXT;
ALTER TABLE "CorporateDocument" ADD COLUMN IF NOT EXISTS "ocrExtractedData" JSONB;

-- CreateTable: CompanyCaseStudy
CREATE TABLE IF NOT EXISTS "CompanyCaseStudy" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "clientName" TEXT,
    "industry" TEXT,
    "problemStatement" TEXT NOT NULL,
    "solutionSummary" TEXT NOT NULL,
    "roiMetrics" JSONB,
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyCaseStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CompanyLeadership
CREATE TABLE IF NOT EXISTS "CompanyLeadership" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "linkedinUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isExecutive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyLeadership_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CompanyReview
CREATE TABLE IF NOT EXISTS "CompanyReview" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "reviewerId" INTEGER NOT NULL,
    "contractId" INTEGER,
    "reviewerType" TEXT NOT NULL DEFAULT 'FREELANCER',
    "overallRating" DOUBLE PRECISION NOT NULL,
    "paymentPromptnessRating" DOUBLE PRECISION,
    "scopeClarityRating" DOUBLE PRECISION,
    "communicationRating" DOUBLE PRECISION,
    "title" TEXT,
    "comment" TEXT,
    "isVerifiedContract" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyCaseStudy_organizationId_slug_key" ON "CompanyCaseStudy"("organizationId", "slug");
CREATE INDEX IF NOT EXISTS "CompanyCaseStudy_organizationId_idx" ON "CompanyCaseStudy"("organizationId");
CREATE INDEX IF NOT EXISTS "CompanyLeadership_organizationId_displayOrder_idx" ON "CompanyLeadership"("organizationId", "displayOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyReview_organizationId_reviewerId_contractId_key" ON "CompanyReview"("organizationId", "reviewerId", "contractId");
CREATE INDEX IF NOT EXISTS "CompanyReview_organizationId_idx" ON "CompanyReview"("organizationId");
CREATE INDEX IF NOT EXISTS "CompanyReview_reviewerId_idx" ON "CompanyReview"("reviewerId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyCaseStudy_organizationId_fkey') THEN
        ALTER TABLE "CompanyCaseStudy" ADD CONSTRAINT "CompanyCaseStudy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyLeadership_organizationId_fkey') THEN
        ALTER TABLE "CompanyLeadership" ADD CONSTRAINT "CompanyLeadership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyReview_organizationId_fkey') THEN
        ALTER TABLE "CompanyReview" ADD CONSTRAINT "CompanyReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
