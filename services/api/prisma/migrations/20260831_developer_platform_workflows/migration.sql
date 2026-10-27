-- CreateTable ApiKey if not exists
CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ipWhitelist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedPaths" JSONB,
    "allowedMethods" JSONB,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "graceExpiresAt" TIMESTAMP(3),
    "successorKeyId" INTEGER,
    "replacedKeyId" INTEGER,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable WebhookEndpoint if not exists
CREATE TABLE IF NOT EXISTS "WebhookEndpoint" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "previousSecret" TEXT,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "circuit_state" TEXT NOT NULL DEFAULT 'CLOSED',
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_failure_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- AlterTable ApiKey
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "allowedPaths" JSONB;
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "allowedMethods" JSONB;
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "graceExpiresAt" TIMESTAMP(3);
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "successorKeyId" INTEGER;
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "replacedKeyId" INTEGER;

-- AlterTable WebhookEndpoint
ALTER TABLE "WebhookEndpoint" ADD COLUMN IF NOT EXISTS "previousSecret" TEXT;
ALTER TABLE "WebhookEndpoint" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WebhookEndpoint" ADD COLUMN IF NOT EXISTS "circuitState" TEXT NOT NULL DEFAULT 'CLOSED';
ALTER TABLE "WebhookEndpoint" ADD COLUMN IF NOT EXISTS "failureCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WebhookEndpoint" ADD COLUMN IF NOT EXISTS "lastFailureAt" TIMESTAMP(3);

-- AlterTable UserIntegration
ALTER TABLE "UserIntegration" ADD COLUMN IF NOT EXISTS "providerId" TEXT;
ALTER TABLE "UserIntegration" ADD COLUMN IF NOT EXISTS "accountLabel" TEXT;
ALTER TABLE "UserIntegration" ADD COLUMN IF NOT EXISTS "accessToken" TEXT;
ALTER TABLE "UserIntegration" ADD COLUMN IF NOT EXISTS "refreshToken" TEXT;
ALTER TABLE "UserIntegration" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "UserIntegration" ADD COLUMN IF NOT EXISTS "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "UserIntegration" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "UserIntegration" ADD COLUMN IF NOT EXISTS "settings" JSONB;
ALTER TABLE "UserIntegration" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "UserIntegration" ADD COLUMN IF NOT EXISTS "syncStatus" TEXT NOT NULL DEFAULT 'IDLE';
ALTER TABLE "UserIntegration" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "UserIntegration" ADD COLUMN IF NOT EXISTS "errorCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserIntegration" ADD COLUMN IF NOT EXISTS "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "UserIntegration" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

-- CreateTable IntegrationWorkflow
CREATE TABLE IF NOT EXISTS "IntegrationWorkflow" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "triggerType" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable WorkflowNode
CREATE TABLE IF NOT EXISTS "WorkflowNode" (
    "id" SERIAL NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable WorkflowEdge
CREATE TABLE IF NOT EXISTS "WorkflowEdge" (
    "id" SERIAL NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "sourceNodeId" INTEGER NOT NULL,
    "targetNodeId" INTEGER NOT NULL,
    "condition" TEXT,

    CONSTRAINT "WorkflowEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable WorkflowExecution
CREATE TABLE IF NOT EXISTS "WorkflowExecution" (
    "id" SERIAL NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "telemetry" JSONB NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable WebhookDeadLetter
CREATE TABLE IF NOT EXISTS "WebhookDeadLetter" (
    "id" SERIAL NOT NULL,
    "endpointId" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "failureReason" TEXT NOT NULL,
    "quarantinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WebhookDeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- AddForeignKey
ALTER TABLE "ApiKey" DROP CONSTRAINT IF EXISTS "ApiKey_userId_fkey";
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" DROP CONSTRAINT IF EXISTS "WebhookEndpoint_userId_fkey";
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationWorkflow" DROP CONSTRAINT IF EXISTS "IntegrationWorkflow_userId_fkey";
ALTER TABLE "IntegrationWorkflow" ADD CONSTRAINT "IntegrationWorkflow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNode" DROP CONSTRAINT IF EXISTS "WorkflowNode_workflowId_fkey";
ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "IntegrationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEdge" DROP CONSTRAINT IF EXISTS "WorkflowEdge_workflowId_fkey";
ALTER TABLE "WorkflowEdge" ADD CONSTRAINT "WorkflowEdge_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "IntegrationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution" DROP CONSTRAINT IF EXISTS "WorkflowExecution_workflowId_fkey";
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "IntegrationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDeadLetter" DROP CONSTRAINT IF EXISTS "WebhookDeadLetter_endpointId_fkey";
ALTER TABLE "WebhookDeadLetter" ADD CONSTRAINT "WebhookDeadLetter_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
