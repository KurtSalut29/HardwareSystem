-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerContact" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "proofImage" TEXT,
ALTER COLUMN "customerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "subcategoryId" INTEGER;

-- AlterTable
ALTER TABLE "Restock" ADD COLUMN     "batchId" INTEGER;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Subcategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestockBatch" (
    "id" SERIAL NOT NULL,
    "supplierName" TEXT,
    "referenceNo" TEXT,
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "recordedById" INTEGER NOT NULL,

    CONSTRAINT "RestockBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "change" DOUBLE PRECISION NOT NULL,
    "stockAfter" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" INTEGER NOT NULL,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subcategory_categoryId_name_key" ON "Subcategory"("categoryId", "name");

-- CreateIndex
CREATE INDEX "RestockBatch_date_idx" ON "RestockBatch"("date");

-- CreateIndex
CREATE INDEX "StockAdjustment_productId_date_idx" ON "StockAdjustment"("productId", "date");

-- CreateIndex
CREATE INDEX "Restock_batchId_idx" ON "Restock"("batchId");

-- AddForeignKey
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restock" ADD CONSTRAINT "Restock_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "RestockBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestockBatch" ADD CONSTRAINT "RestockBatch_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Data: free-text subcategories become managed rows ───────────────────────
-- One row per category and name, ignoring case and stray spaces; the spelling
-- used by the oldest product wins.
INSERT INTO "Subcategory" ("name", "categoryId")
SELECT DISTINCT ON ("categoryId", lower(btrim("subcategory"))) btrim("subcategory"), "categoryId"
FROM "Product"
WHERE "subcategory" IS NOT NULL AND btrim("subcategory") <> ''
ORDER BY "categoryId", lower(btrim("subcategory")), "id";

UPDATE "Product" p
SET "subcategoryId" = s."id"
FROM "Subcategory" s
WHERE s."categoryId" = p."categoryId"
  AND lower(s."name") = lower(btrim(p."subcategory"));

ALTER TABLE "Product" DROP COLUMN "subcategory";

-- ── Data: delivered orders get their delivery time from the recorded sale ───
UPDATE "Order" o
SET "deliveredAt" = t."dateTime"
FROM "Transaction" t
WHERE o."transactionId" = t."id" AND o."status" = 'delivered' AND o."deliveredAt" IS NULL;
