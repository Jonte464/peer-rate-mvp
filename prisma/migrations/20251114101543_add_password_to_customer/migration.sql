/*
  Warnings:

  - You are about to drop the column `legalName` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `orgRef` on the `Customer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "legalName",
DROP COLUMN "orgRef",
ADD COLUMN     "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");
