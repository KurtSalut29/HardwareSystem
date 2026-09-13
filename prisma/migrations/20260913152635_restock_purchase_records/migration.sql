/*
  Warnings:

  - Added the required column `recordedById` to the `Restock` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalCost` to the `Restock` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitCost` to the `Restock` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Restock" ADD COLUMN     "note" TEXT,
ADD COLUMN     "recordedById" INTEGER NOT NULL,
ADD COLUMN     "supplierName" TEXT,
ADD COLUMN     "totalCost" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "unitCost" DOUBLE PRECISION NOT NULL;

-- CreateIndex
CREATE INDEX "Restock_productId_date_idx" ON "Restock"("productId", "date");

-- AddForeignKey
ALTER TABLE "Restock" ADD CONSTRAINT "Restock_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
