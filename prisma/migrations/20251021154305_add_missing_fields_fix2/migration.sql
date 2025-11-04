-- Add missing columns (safe idempotent migration)
ALTER TABLE "Rating"
  ADD COLUMN IF NOT EXISTS "raterEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "reportedSuspectedFraud" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "verificationId" TEXT;

ALTER TABLE "Report"
  ADD COLUMN IF NOT EXISTS "verificationId" TEXT;

-- Create indexes if they do not exist (to avoid duplicate errors)
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "Rating_customerId_idx" ON "Rating"("customerId");
  CREATE INDEX IF NOT EXISTS "Rating_transactionId_idx" ON "Rating"("transactionId");
  CREATE INDEX IF NOT EXISTS "Report_reportedCustomerId_idx" ON "Report"("reportedCustomerId");
  CREATE INDEX IF NOT EXISTS "Report_transactionId_idx" ON "Report"("transactionId");
  CREATE INDEX IF NOT EXISTS "Report_ratingId_idx" ON "Report"("ratingId");
  CREATE INDEX IF NOT EXISTS "Transaction_customerId_idx" ON "Transaction"("customerId");
END $$;
