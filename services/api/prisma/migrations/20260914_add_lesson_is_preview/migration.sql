-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "isPreview" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lesson_isPreview_idx" ON "Lesson"("isPreview");
