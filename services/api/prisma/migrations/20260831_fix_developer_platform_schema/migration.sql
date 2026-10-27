-- Fix WebhookEndpoint columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'WebhookEndpoint' AND column_name = 'created_at') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'WebhookEndpoint' AND column_name = 'createdAt') THEN
    ALTER TABLE "WebhookEndpoint" RENAME COLUMN "created_at" TO "createdAt";
  END IF;
END $$;

ALTER TABLE "WebhookEndpoint" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "WebhookEndpoint" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Fix ApiKey columns (allowedPaths, allowedMethods)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ApiKey' AND column_name = 'allowedPaths' AND data_type = 'jsonb') THEN
    ALTER TABLE "ApiKey" DROP COLUMN "allowedPaths";
    ALTER TABLE "ApiKey" ADD COLUMN "allowedPaths" TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ApiKey' AND column_name = 'allowedMethods' AND data_type = 'jsonb') THEN
    ALTER TABLE "ApiKey" DROP COLUMN "allowedMethods";
    ALTER TABLE "ApiKey" ADD COLUMN "allowedMethods" TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;

-- Create ApiKeyUsage
CREATE TABLE IF NOT EXISTS "ApiKeyUsage" (
    "id" SERIAL NOT NULL,
    "apiKeyId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "responseTimeMs" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeyUsage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ApiKeyUsage_apiKeyId_idx" ON "ApiKeyUsage"("apiKeyId");
CREATE INDEX IF NOT EXISTS "ApiKeyUsage_timestamp_idx" ON "ApiKeyUsage"("timestamp");
ALTER TABLE "ApiKeyUsage" DROP CONSTRAINT IF EXISTS "ApiKeyUsage_apiKeyId_fkey";
ALTER TABLE "ApiKeyUsage" ADD CONSTRAINT "ApiKeyUsage_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create WebhookDelivery
CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
    "id" SERIAL NOT NULL,
    "webhookEndpointId" INTEGER NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "responseStatusCode" INTEGER,
    "responseBody" TEXT,
    "durationMs" INTEGER,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WebhookDelivery_webhookEndpointId_idx" ON "WebhookDelivery"("webhookEndpointId");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_eventId_idx" ON "WebhookDelivery"("eventId");
ALTER TABLE "WebhookDelivery" DROP CONSTRAINT IF EXISTS "WebhookDelivery_webhookEndpointId_fkey";
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookEndpointId_fkey" FOREIGN KEY ("webhookEndpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fix WebhookDeadLetter
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'WebhookDeadLetter' AND column_name = 'endpointId') THEN
    ALTER TABLE "WebhookDeadLetter" RENAME COLUMN "endpointId" TO "webhookEndpointId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'WebhookDeadLetter' AND column_name = 'event') THEN
    ALTER TABLE "WebhookDeadLetter" RENAME COLUMN "event" TO "eventType";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'WebhookDeadLetter' AND column_name = 'quarantinedAt') THEN
    ALTER TABLE "WebhookDeadLetter" RENAME COLUMN "quarantinedAt" TO "createdAt";
  END IF;
END $$;

ALTER TABLE "WebhookDeadLetter" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "WebhookDeadLetter" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "WebhookDeadLetter" DROP COLUMN IF EXISTS "resolved";

CREATE INDEX IF NOT EXISTS "WebhookDeadLetter_webhookEndpointId_idx" ON "WebhookDeadLetter"("webhookEndpointId");
ALTER TABLE "WebhookDeadLetter" DROP CONSTRAINT IF EXISTS "WebhookDeadLetter_endpointId_fkey";
ALTER TABLE "WebhookDeadLetter" DROP CONSTRAINT IF EXISTS "WebhookDeadLetter_webhookEndpointId_fkey";
ALTER TABLE "WebhookDeadLetter" ADD CONSTRAINT "WebhookDeadLetter_webhookEndpointId_fkey" FOREIGN KEY ("webhookEndpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create ConnectorLog
CREATE TABLE IF NOT EXISTS "ConnectorLog" (
    "id" SERIAL NOT NULL,
    "userIntegrationId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ConnectorLog_userIntegrationId_idx" ON "ConnectorLog"("userIntegrationId");
CREATE INDEX IF NOT EXISTS "ConnectorLog_provider_action_idx" ON "ConnectorLog"("provider", "action");
CREATE INDEX IF NOT EXISTS "ConnectorLog_createdAt_idx" ON "ConnectorLog"("createdAt");
ALTER TABLE "ConnectorLog" DROP CONSTRAINT IF EXISTS "ConnectorLog_userIntegrationId_fkey";
ALTER TABLE "ConnectorLog" ADD CONSTRAINT "ConnectorLog_userIntegrationId_fkey" FOREIGN KEY ("userIntegrationId") REFERENCES "UserIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fix IntegrationWorkflow
ALTER TABLE "IntegrationWorkflow" ADD COLUMN IF NOT EXISTS "triggerConfig" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "IntegrationWorkflow" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'IntegrationWorkflow' AND column_name = 'created_at') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'IntegrationWorkflow' AND column_name = 'createdAt') THEN
    ALTER TABLE "IntegrationWorkflow" RENAME COLUMN "created_at" TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'IntegrationWorkflow' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'IntegrationWorkflow' AND column_name = 'updatedAt') THEN
    ALTER TABLE "IntegrationWorkflow" RENAME COLUMN "updated_at" TO "updatedAt";
  END IF;
END $$;

ALTER TABLE "IntegrationWorkflow" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "IntegrationWorkflow" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "IntegrationWorkflow" DROP COLUMN IF EXISTS "status";

-- Recreate WorkflowNode, WorkflowEdge, WorkflowExecution
DROP TABLE IF EXISTS "WorkflowExecution" CASCADE;
DROP TABLE IF EXISTS "WorkflowEdge" CASCADE;
DROP TABLE IF EXISTS "WorkflowNode" CASCADE;

CREATE TABLE "WorkflowNode" (
    "id" TEXT NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT,
    "config" JSONB NOT NULL,

    CONSTRAINT "WorkflowNode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkflowNode_workflowId_idx" ON "WorkflowNode"("workflowId");
ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "IntegrationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkflowEdge" (
    "id" TEXT NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "condition" TEXT,

    CONSTRAINT "WorkflowEdge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkflowEdge_workflowId_idx" ON "WorkflowEdge"("workflowId");
ALTER TABLE "WorkflowEdge" ADD CONSTRAINT "WorkflowEdge_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "IntegrationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkflowExecution" (
    "id" SERIAL NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "logs" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkflowExecution_workflowId_idx" ON "WorkflowExecution"("workflowId");
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "IntegrationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
