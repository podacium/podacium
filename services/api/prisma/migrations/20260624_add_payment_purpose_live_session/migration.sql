-- Add LIVE_SESSION_PURCHASE and LIVE_SESSION_REFUND to PaymentPurpose enum
-- These values exist in schema.prisma but were never added to the DB enum.

DO $$ BEGIN
  ALTER TYPE "PaymentPurpose" ADD VALUE 'LIVE_SESSION_PURCHASE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "PaymentPurpose" ADD VALUE 'LIVE_SESSION_REFUND';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
