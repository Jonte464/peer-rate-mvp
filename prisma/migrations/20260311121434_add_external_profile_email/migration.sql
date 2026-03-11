/*
  Warnings:

  - A unique constraint covering the columns `[customerId,platform]` on the table `ExternalProfile` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExternalPlatform" ADD VALUE 'AIRBNB';
ALTER TYPE "ExternalPlatform" ADD VALUE 'TIPTAP';
ALTER TYPE "ExternalPlatform" ADD VALUE 'HYGGLO';
ALTER TYPE "ExternalPlatform" ADD VALUE 'HUSKNUTEN';
ALTER TYPE "ExternalPlatform" ADD VALUE 'FACEBOOK';

-- AlterEnum
ALTER TYPE "ExternalProfileStatus" ADD VALUE 'NO_ACCOUNT';

-- AlterTable
ALTER TABLE "ExternalProfile" ADD COLUMN     "email" TEXT;

-- CreateIndex
CREATE INDEX "ExternalProfile_platform_email_idx" ON "ExternalProfile"("platform", "email");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalProfile_customerId_platform_key" ON "ExternalProfile"("customerId", "platform");
