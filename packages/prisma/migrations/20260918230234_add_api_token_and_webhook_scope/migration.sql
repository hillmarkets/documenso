-- CreateEnum
CREATE TYPE "WebhookScope" AS ENUM ('INSTANCE', 'ORGANISATION', 'TEAM');

-- CreateEnum
CREATE TYPE "ApiTokenScope" AS ENUM ('INSTANCE', 'ORGANISATION', 'TEAM');

-- AlterTable
ALTER TABLE "ApiToken" ADD COLUMN     "organisationId" TEXT,
ADD COLUMN     "scope" "ApiTokenScope" NOT NULL DEFAULT 'TEAM',
ALTER COLUMN "teamId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN     "organisationId" TEXT,
ADD COLUMN     "scope" "WebhookScope" NOT NULL DEFAULT 'TEAM',
ALTER COLUMN "teamId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Webhook_scope_teamId_idx" ON "Webhook"("scope", "teamId");

-- CreateIndex
CREATE INDEX "Webhook_scope_organisationId_idx" ON "Webhook"("scope", "organisationId");

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Scope invariants: exactly one tenant shape per scope.
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_scope_check" CHECK (
  ("scope" = 'TEAM'         AND "teamId" IS NOT NULL AND "organisationId" IS NULL) OR
  ("scope" = 'ORGANISATION' AND "teamId" IS NULL     AND "organisationId" IS NOT NULL) OR
  ("scope" = 'INSTANCE'     AND "teamId" IS NULL     AND "organisationId" IS NULL AND "userId" IS NOT NULL)
);

ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_scope_check" CHECK (
  ("scope" = 'TEAM'         AND "teamId" IS NOT NULL AND "organisationId" IS NULL) OR
  ("scope" = 'ORGANISATION' AND "teamId" IS NULL     AND "organisationId" IS NOT NULL) OR
  ("scope" = 'INSTANCE'     AND "teamId" IS NULL     AND "organisationId" IS NULL)
);
