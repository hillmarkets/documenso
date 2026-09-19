-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN "brandingLogoDark" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN "brandingLogoDark" TEXT;
