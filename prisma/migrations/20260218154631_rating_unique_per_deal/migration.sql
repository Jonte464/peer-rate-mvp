/*
  Warnings:

  - A unique constraint covering the columns `[customerId,ratingSource,proofRef,raterName]` on the table `Rating` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Rating_customerId_ratingSource_proofRef_raterName_key" ON "Rating"("customerId", "ratingSource", "proofRef", "raterName");
