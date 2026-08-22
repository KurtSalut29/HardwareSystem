-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fulfillmentMode" TEXT NOT NULL DEFAULT 'delivery',
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'Cash';
