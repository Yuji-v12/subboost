-- AlterTable
ALTER TABLE "LocalAdmin" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LocalAdmin" ADD COLUMN IF NOT EXISTS "maxSubscriptions" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "LocalAdmin" ADD COLUMN IF NOT EXISTS "maxNodesPerSubscription" INTEGER NOT NULL DEFAULT 300;
ALTER TABLE "LocalAdmin" ADD COLUMN IF NOT EXISTS "maxCustomTemplates" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LocalAdmin" ADD COLUMN IF NOT EXISTS "maxImportSourcesPerType" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "LocalAdmin" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- Existing accounts become unlimited admins
UPDATE "LocalAdmin"
SET
  "isAdmin" = true,
  "maxSubscriptions" = 9999,
  "maxNodesPerSubscription" = 10000,
  "maxCustomTemplates" = 9999,
  "maxImportSourcesPerType" = 9999,
  "expiresAt" = NULL;
