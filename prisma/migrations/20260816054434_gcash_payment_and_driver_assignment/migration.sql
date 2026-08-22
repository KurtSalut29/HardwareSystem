-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "gcashNumber" TEXT,
ADD COLUMN     "gcashReference" TEXT,
ADD COLUMN     "paymentVerified" BOOLEAN NOT NULL DEFAULT false;
