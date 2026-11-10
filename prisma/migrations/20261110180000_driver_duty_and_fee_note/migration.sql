-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryFeeNote" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onDuty" BOOLEAN NOT NULL DEFAULT true;

