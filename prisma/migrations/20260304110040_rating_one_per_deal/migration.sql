/*
  Warnings:

  - A unique constraint covering the columns `[customerId,dealId]` on the table `Rating` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Rating_customerId_ratingSource_proofRef_raterName_key";

-- CreateIndex
CREATE UNIQUE INDEX "Rating_customerId_dealId_key" ON "Rating"("customerId", "dealId");
