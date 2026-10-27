-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('AWS', 'BUNNY', 'CLOUDFLARE', 'YOUTUBE', 'VIMEO', 'DAILYMOTION', 'SUPABASE', 'CUSTOM_HLS');
CREATE TYPE "VideoTranscodeStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "UploadSessionStatus" AS ENUM ('PENDING', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable SystemSetting
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'video',
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable SystemSettingAudit
CREATE TABLE "SystemSettingAudit" (
    "id" TEXT NOT NULL,
    "settingKey" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSettingAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable VideoAsset
CREATE TABLE "VideoAsset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "storageProvider" "StorageProvider" NOT NULL DEFAULT 'AWS',
    "providerAssetId" TEXT,
    "providerLibraryId" TEXT,
    "youtubeVideoId" TEXT,
    "vimeoVideoId" TEXT,
    "dailymotionVideoId" TEXT,
    "isYoutubeUnlisted" BOOLEAN NOT NULL DEFAULT false,
    "isExternalUnlisted" BOOLEAN NOT NULL DEFAULT false,
    "rawPath" TEXT,
    "hlsPath" TEXT,
    "dashPath" TEXT,
    "thumbnailUrl" TEXT,
    "storyboardUrl" TEXT,
    "status" "VideoTranscodeStatus" NOT NULL DEFAULT 'PENDING',
    "transcodeProgress" INTEGER NOT NULL DEFAULT 0,
    "transcodeJobId" TEXT,
    "errorReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VideoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable VideoRendition
CREATE TABLE "VideoRendition" (
    "id" TEXT NOT NULL,
    "videoAssetId" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bitrateKbps" INTEGER NOT NULL,
    "frameRate" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
    "videoCodec" TEXT NOT NULL DEFAULT 'H264',
    "audioCodec" TEXT NOT NULL DEFAULT 'AAC',
    "playlistPath" TEXT NOT NULL,
    "fileSizeBytes" BIGINT,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoRendition_pkey" PRIMARY KEY ("id")
);

-- CreateTable VideoUploadSession
CREATE TABLE "VideoUploadSession" (
    "id" TEXT NOT NULL,
    "tusId" TEXT,
    "userId" INTEGER NOT NULL,
    "lessonId" TEXT,
    "videoAssetId" TEXT,
    "storageProvider" "StorageProvider" NOT NULL DEFAULT 'AWS',
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "uploadedBytes" BIGINT NOT NULL DEFAULT 0,
    "chunkSizeBytes" INTEGER NOT NULL DEFAULT 5242880,
    "lastByteOffset" BIGINT NOT NULL DEFAULT 0,
    "magicBytesVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "UploadSessionStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoUploadSession_pkey" PRIMARY KEY ("id")
);

-- AlterTable Lesson
ALTER TABLE "Lesson" ADD COLUMN "videoAssetId" TEXT;

-- Indexes SystemSetting
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");
CREATE INDEX "SystemSetting_category_idx" ON "SystemSetting"("category");
CREATE INDEX "SystemSetting_key_idx" ON "SystemSetting"("key");

-- Indexes SystemSettingAudit
CREATE INDEX "SystemSettingAudit_settingKey_idx" ON "SystemSettingAudit"("settingKey");
CREATE INDEX "SystemSettingAudit_createdAt_idx" ON "SystemSettingAudit"("createdAt");

-- Indexes VideoAsset
CREATE INDEX "VideoAsset_storageProvider_idx" ON "VideoAsset"("storageProvider");
CREATE INDEX "VideoAsset_status_idx" ON "VideoAsset"("status");
CREATE INDEX "VideoAsset_providerAssetId_idx" ON "VideoAsset"("providerAssetId");
CREATE INDEX "VideoAsset_youtubeVideoId_idx" ON "VideoAsset"("youtubeVideoId");
CREATE INDEX "VideoAsset_vimeoVideoId_idx" ON "VideoAsset"("vimeoVideoId");
CREATE INDEX "VideoAsset_dailymotionVideoId_idx" ON "VideoAsset"("dailymotionVideoId");

-- Indexes VideoRendition
CREATE UNIQUE INDEX "VideoRendition_videoAssetId_resolution_key" ON "VideoRendition"("videoAssetId", "resolution");
CREATE INDEX "VideoRendition_videoAssetId_idx" ON "VideoRendition"("videoAssetId");

-- Indexes VideoUploadSession
CREATE UNIQUE INDEX "VideoUploadSession_tusId_key" ON "VideoUploadSession"("tusId");
CREATE INDEX "VideoUploadSession_userId_idx" ON "VideoUploadSession"("userId");
CREATE INDEX "VideoUploadSession_tusId_idx" ON "VideoUploadSession"("tusId");
CREATE INDEX "VideoUploadSession_status_idx" ON "VideoUploadSession"("status");

-- ForeignKeys
ALTER TABLE "VideoRendition" ADD CONSTRAINT "VideoRendition_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "VideoAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoUploadSession" ADD CONSTRAINT "VideoUploadSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoUploadSession" ADD CONSTRAINT "VideoUploadSession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoUploadSession" ADD CONSTRAINT "VideoUploadSession_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "VideoAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "VideoAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
