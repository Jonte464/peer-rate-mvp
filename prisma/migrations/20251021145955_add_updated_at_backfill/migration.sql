/*
  Warnings:

  - Added the required column `updatedAt` to the `Rating` table without a default value. 
    This is not possible if the table is not empty. 
    ✅ FIXED: we now add it with DEFAULT NOW() to backfill existing rows.
*/

-- AlterTable: Rating
ALTER TABLE "Rating"
ADD COLUMN "raterEmail" TEXT,
ADD COLUMN "reportedSuspectedFraud" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
ADD COLUMN "verificationId" TEXT;

-- AlterTable: Report
ALTER TABLE "Report"
ADD COLUMN "verificationId" TEXT;

-- CreateIndex: for query performance and relations
CREATE INDEX "Rating_customerId_idx" ON "Rating"("customerId");
CREATE INDEX "Rating_transactionId_idx" ON "Rating"("transactionId");
CREATE INDEX "Report_reportedCustomerId_idx" ON "Report"("reportedCustomerId");
CREATE INDEX "Report_transactionId_idx" ON "Report"("transactionId");
CREATE INDEX "Report_ratingId_idx" ON "Report"("ratingId");
CREATE INDEX "Transaction_customerId_idx" ON "Transaction"("customerId");
