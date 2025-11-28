-- CreateEnum
CREATE TYPE "TraderaOrderRole" AS ENUM ('BUYER', 'SELLER');

-- AlterTable
ALTER TABLE "ExternalProfile" ADD COLUMN     "authToken" TEXT,
ADD COLUMN     "authTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "externalUserId" TEXT,
ADD COLUMN     "profileJson" JSONB;

-- CreateTable
CREATE TABLE "TraderaOrder" (
    "id" TEXT NOT NULL,
    "externalProfileId" TEXT NOT NULL,
    "traderaOrderId" TEXT NOT NULL,
    "traderaItemId" TEXT,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "currency" TEXT DEFAULT 'SEK',
    "role" "TraderaOrderRole" NOT NULL DEFAULT 'SELLER',
    "counterpartyAlias" TEXT,
    "counterpartyEmail" TEXT,
    "completedAt" TIMESTAMP(3),
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraderaOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TraderaOrder_externalProfileId_idx" ON "TraderaOrder"("externalProfileId");

-- CreateIndex
CREATE INDEX "TraderaOrder_traderaOrderId_idx" ON "TraderaOrder"("traderaOrderId");

-- CreateIndex
CREATE INDEX "TraderaOrder_completedAt_idx" ON "TraderaOrder"("completedAt");

-- AddForeignKey
ALTER TABLE "TraderaOrder" ADD CONSTRAINT "TraderaOrder_externalProfileId_fkey" FOREIGN KEY ("externalProfileId") REFERENCES "ExternalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
