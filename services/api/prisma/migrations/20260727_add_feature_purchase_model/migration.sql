-- Feature Purchase & Boost Decay Migration
-- Adds FeaturePurchase model, boost score columns, and skill passport verification.
--
-- Safe to run repeatedly (idempotent DO blocks with IF NOT EXISTS).

-- =============================================================================
-- 1. Project: add featuredBoost column
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Project' AND column_name = 'featuredBoost'
  ) THEN
    ALTER TABLE "Project" ADD COLUMN "featuredBoost" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
  END IF;
END $$;

-- =============================================================================
-- 2. FreelancerProfile: add featuredBoost, skillPassportVerified & skillPassportVerifiedAt
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'FreelancerProfile' AND column_name = 'featuredBoost'
  ) THEN
    ALTER TABLE "FreelancerProfile" ADD COLUMN "featuredBoost" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'FreelancerProfile' AND column_name = 'skillPassportVerified'
  ) THEN
    ALTER TABLE "FreelancerProfile" ADD COLUMN "skillPassportVerified" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'FreelancerProfile' AND column_name = 'skillPassportVerifiedAt'
  ) THEN
    ALTER TABLE "FreelancerProfile" ADD COLUMN "skillPassportVerifiedAt" TIMESTAMP(3);
  END IF;
END $$;

-- =============================================================================
-- 3. FeaturePurchase table
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FeaturePurchase') THEN
    CREATE TABLE "FeaturePurchase" (
      "id"                  SERIAL       NOT NULL,
      "userId"              INTEGER      NOT NULL,
      "featureKey"          TEXT         NOT NULL,
      "quantity"            INTEGER      NOT NULL DEFAULT 1,
      "usedCount"           INTEGER      NOT NULL DEFAULT 0,
      "referenceId"         TEXT,
      "walletTransactionId" INTEGER,
      "expiresAt"           TIMESTAMP(3),
      "purchasedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "FeaturePurchase_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "FeaturePurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    );

    CREATE INDEX "FeaturePurchase_userId_featureKey_idx" ON "FeaturePurchase" ("userId", "featureKey");
    CREATE INDEX "FeaturePurchase_userId_featureKey_expiresAt_idx" ON "FeaturePurchase" ("userId", "featureKey", "expiresAt");
    CREATE INDEX "FeaturePurchase_featureKey_expiresAt_idx" ON "FeaturePurchase" ("featureKey", "expiresAt");
  END IF;
END $$;

-- =============================================================================
-- 4. Update FreelancerProfile existing rows: set featuredBoost = 1.0 for active featured profiles
-- =============================================================================
DO $$
BEGIN
  UPDATE "FreelancerProfile"
  SET "featuredBoost" = 1.0
  WHERE featured = true AND "featuredUntil" > NOW() AND "featuredBoost" = 0.0;
END $$;

-- =============================================================================
-- 5. Update Project existing rows: set featuredBoost = 1.0 for active featured projects
-- =============================================================================
DO $$
BEGIN
  UPDATE "Project"
  SET "featuredBoost" = 1.0
  WHERE featured = true AND "featureExpiresAt" > NOW() AND "featuredBoost" = 0.0;
END $$;
