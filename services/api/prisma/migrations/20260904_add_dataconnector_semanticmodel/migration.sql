-- CreateTable
CREATE TABLE "DataConnector" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "engine" TEXT NOT NULL DEFAULT 'postgres',
    "encryptedHost" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 5432,
    "databaseName" TEXT NOT NULL,
    "encryptedUsername" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "ssl" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataConnector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemanticModel" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "datasetId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "config" JSONB,
    "dimensions" JSONB,
    "measures" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SemanticModel_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Dataset" ADD COLUMN     "connectorId" INTEGER,
ADD COLUMN     "storageBucket" TEXT,
ADD COLUMN     "storageKey" TEXT;

-- AlterTable
ALTER TABLE "Widget" ADD COLUMN     "semanticModelId" INTEGER;

-- CreateIndex
CREATE INDEX "DataConnector_organizationId_idx" ON "DataConnector"("organizationId");

-- CreateIndex
CREATE INDEX "DataConnector_createdById_idx" ON "DataConnector"("createdById");

-- CreateIndex
CREATE INDEX "DataConnector_engine_idx" ON "DataConnector"("engine");

-- CreateIndex
CREATE INDEX "DataConnector_createdAt_idx" ON "DataConnector"("createdAt");

-- CreateIndex
CREATE INDEX "SemanticModel_datasetId_idx" ON "SemanticModel"("datasetId");

-- CreateIndex
CREATE INDEX "SemanticModel_organizationId_idx" ON "SemanticModel"("organizationId");

-- CreateIndex
CREATE INDEX "SemanticModel_createdAt_idx" ON "SemanticModel"("createdAt");

-- CreateIndex
CREATE INDEX "Dataset_connectorId_idx" ON "Dataset"("connectorId");

-- CreateIndex
CREATE INDEX "Widget_semanticModelId_idx" ON "Widget"("semanticModelId");

-- AddForeignKey
ALTER TABLE "DataConnector" ADD CONSTRAINT "DataConnector_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataConnector" ADD CONSTRAINT "DataConnector_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemanticModel" ADD CONSTRAINT "SemanticModel_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemanticModel" ADD CONSTRAINT "SemanticModel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "DataConnector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Widget" ADD CONSTRAINT "Widget_semanticModelId_fkey" FOREIGN KEY ("semanticModelId") REFERENCES "SemanticModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
