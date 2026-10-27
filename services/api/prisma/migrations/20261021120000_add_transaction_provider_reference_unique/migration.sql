-- Idempotent payment finalization depends on a gateway reference resolving to at
-- most one Transaction. The previous non-unique index allowed two rows to share
-- a checkout reference, so a duplicate webhook could be finalized twice against
-- the "wrong" row (and, before the CAS fix, credit a wallet twice).
--
-- Postgres allows multiple NULLs in a unique index, so transactions without a
-- provider reference (internal wallet movements, admins adjustments, etc.) are
-- unaffected.
--
-- NOTE: this migration fails loudly if duplicates already exist. Resolve them
-- manually (they indicate a real double-finalization incident) before retrying.

DROP INDEX IF EXISTS "Transaction_providerReference_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_providerReference_key" ON "Transaction"("providerReference");
