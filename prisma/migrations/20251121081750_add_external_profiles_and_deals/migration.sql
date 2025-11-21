-- CreateEnum
CREATE TYPE "ExternalPlatform" AS ENUM ('BLOCKET', 'TRADERA');

-- CreateEnum
CREATE TYPE "ExternalProfileStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'REMOVED');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('PENDING_RATING', 'RATED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "DealSource" AS ENUM ('BLOCKET_SCRAPE', 'MANUAL', 'PARTNER_API');

-- AlterTable
ALTER TABLE "Rating" ADD COLUMN     "dealId" TEXT;

-- CreateTable
CREATE TABLE "ExternalProfile" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "platform" "ExternalPlatform" NOT NULL,
    "username" TEXT NOT NULL,
    "encryptedPassword" TEXT,
    "cookiesJson" JSONB,
    "status" "ExternalProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "externalProfileId" TEXT NOT NULL,
    "externalListingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" INTEGER,
    "currency" TEXT DEFAULT 'SEK',
    "status" "ListingStatus" NOT NULL,
    "url" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "listingId" TEXT,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT,
    "source" "DealSource" NOT NULL DEFAULT 'BLOCKET_SCRAPE',
    "status" "DealStatus" NOT NULL DEFAULT 'PENDING_RATING',
    "blocketTitle" TEXT,
    "blocketPrice" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalProfile_customerId_idx" ON "ExternalProfile"("customerId");

-- CreateIndex
CREATE INDEX "ExternalProfile_platform_username_idx" ON "ExternalProfile"("platform", "username");

-- CreateIndex
CREATE INDEX "Listing_externalProfileId_idx" ON "Listing"("externalProfileId");

-- CreateIndex
CREATE INDEX "Listing_externalListingId_idx" ON "Listing"("externalListingId");

-- CreateIndex
CREATE INDEX "Deal_sellerId_idx" ON "Deal"("sellerId");

-- CreateIndex
CREATE INDEX "Deal_buyerId_idx" ON "Deal"("buyerId");

-- CreateIndex
CREATE INDEX "Deal_listingId_idx" ON "Deal"("listingId");

-- CreateIndex
CREATE INDEX "Deal_createdAt_idx" ON "Deal"("createdAt");

-- CreateIndex
CREATE INDEX "Rating_dealId_idx" ON "Rating"("dealId");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalProfile" ADD CONSTRAINT "ExternalProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_externalProfileId_fkey" FOREIGN KEY ("externalProfileId") REFERENCES "ExternalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
