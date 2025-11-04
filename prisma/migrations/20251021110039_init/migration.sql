-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('FRAUD', 'IMPERSONATION', 'NON_DELIVERY', 'COUNTERFEIT', 'PAYMENT_ABUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "subjectRef" TEXT NOT NULL,
    "legalName" TEXT,
    "orgRef" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "currency" TEXT DEFAULT 'SEK',
    "occurredAt" TIMESTAMP(3),
    "externalRef" TEXT,
    "evidenceUrl" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "transactionId" TEXT,
    "score" INTEGER NOT NULL,
    "text" TEXT,
    "raterName" TEXT,
    "proofRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "customerId" TEXT NOT NULL,
    "trustScore" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("customerId")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reportedCustomerId" TEXT NOT NULL,
    "transactionId" TEXT,
    "ratingId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "evidenceUrl" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_subjectRef_key" ON "Customer"("subjectRef");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedCustomerId_fkey" FOREIGN KEY ("reportedCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "Rating"("id") ON DELETE SET NULL ON UPDATE CASCADE;
