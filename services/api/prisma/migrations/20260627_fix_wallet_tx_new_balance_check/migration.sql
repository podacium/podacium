-- Fix WalletTransaction_newBalance_matches CHECK constraint
-- The original constraint assumed all transactions are CREDIT (addition),
-- but DEBIT and TRANSFER_OUT use subtraction, while HOLD/RELEASE keep balance unchanged.
--
-- Replaced with a type-aware constraint that validates the newBalance
-- based on the transaction type.
--
-- Safe to run repeatedly (idempotent DO blocks).

DO $$ BEGIN
  ALTER TABLE "WalletTransaction" DROP CONSTRAINT IF EXISTS "WalletTransaction_newBalance_matches";
END $$;

DO $$ BEGIN
  ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_newBalance_matches"
    CHECK (
      ("type" IN ('CREDIT', 'TRANSFER_IN') AND "newBalance" = "previousBalance" + "amount")
      OR
      ("type" IN ('DEBIT', 'TRANSFER_OUT') AND "newBalance" = "previousBalance" - "amount")
      OR
      ("type" IN ('HOLD', 'RELEASE') AND "newBalance" = "previousBalance")
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
