-- Add CREATOR_ROYALTY to PaymentPurpose enum

DO $$ BEGIN
  ALTER TYPE "PaymentPurpose" ADD VALUE 'CREATOR_ROYALTY';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
