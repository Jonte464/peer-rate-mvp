-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "amount" DECIMAL(12,2),
ADD COLUMN     "counterpartyLink" TEXT,
ADD COLUMN     "currency" TEXT DEFAULT 'SEK',
ADD COLUMN     "occurredAt" TIMESTAMP(3),
ADD COLUMN     "reporterConsent" BOOLEAN DEFAULT false;

-- CreateTable
CREATE TABLE "ReportFile" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportFile_reportId_idx" ON "ReportFile"("reportId");

-- CreateIndex
CREATE INDEX "Rating_createdAt_idx" ON "Rating"("createdAt");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- AddForeignKey
ALTER TABLE "ReportFile" ADD CONSTRAINT "ReportFile_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
