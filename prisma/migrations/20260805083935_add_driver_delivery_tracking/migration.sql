-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "driverId" INTEGER,
ADD COLUMN     "driverLat" DOUBLE PRECISION,
ADD COLUMN     "driverLng" DOUBLE PRECISION,
ADD COLUMN     "driverLocationUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "stock" SET DEFAULT 0,
ALTER COLUMN "stock" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Restock" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "TransactionItem" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Order_driverId_status_idx" ON "Order"("driverId", "status");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
