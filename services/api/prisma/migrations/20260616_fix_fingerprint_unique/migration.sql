-- Drop global unique constraint on fingerprintHash, replace with per-user unique
ALTER TABLE "UserDevice" DROP CONSTRAINT IF EXISTS "UserDevice_fingerprintHash_key";
DROP INDEX IF EXISTS "UserDevice_fingerprintHash_key";

-- Compound unique: same fingerprint allowed across users, unique per user
CREATE UNIQUE INDEX IF NOT EXISTS "UserDevice_userId_fingerprintHash_key" ON "UserDevice"("userId", "fingerprintHash");
