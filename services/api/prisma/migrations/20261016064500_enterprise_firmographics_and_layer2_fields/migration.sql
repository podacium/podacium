-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "tagline" TEXT,
ADD COLUMN "companySizeBracket" TEXT DEFAULT 'MICRO_1_10',
ADD COLUMN "operationalScale" TEXT DEFAULT 'NATIONAL_58_WILAYAS',
ADD COLUMN "primaryLanguages" TEXT[] DEFAULT ARRAY['FRENCH', 'ARABIC']::TEXT[],
ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "internalBulletin" TEXT,
ADD COLUMN "timeZone" TEXT DEFAULT 'Africa/Algiers',
ADD COLUMN "keyContacts" JSONB,
ADD COLUMN "hqAddress" TEXT,
ADD COLUMN "brandAccentColor" TEXT DEFAULT '#1B4D3E',
ADD COLUMN "coverBannerUrl" TEXT,
ADD COLUMN "socialLinks" JSONB;

-- CreateIndex
CREATE INDEX "Organization_isPublic_idx" ON "Organization"("isPublic");
