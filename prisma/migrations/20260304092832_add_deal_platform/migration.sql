/*
  Warnings:

  - A unique constraint covering the columns `[platform,externalProofRef]` on the table `Deal` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "DealSource" ADD VALUE 'TRADERA_EXTENSION';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "amount" DECIMAL(12,2),
ADD COLUMN     "currency" TEXT DEFAULT 'SEK',
ADD COLUMN     "externalItemId" TEXT,
ADD COLUMN     "externalPageUrl" TEXT,
ADD COLUMN     "externalProofRef" TEXT,
ADD COLUMN     "platform" "ExternalPlatform" NOT NULL DEFAULT 'BLOCKET',
ADD COLUMN     "title" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Deal_platform_idx" ON "Deal"("platform");

-- CreateIndex
CREATE INDEX "Deal_externalProofRef_idx" ON "Deal"("externalProofRef");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_platform_externalProofRef_key" ON "Deal"("platform", "externalProofRef");
