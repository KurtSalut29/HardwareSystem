-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brand" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountStatus" TEXT NOT NULL DEFAULT 'approved',
ADD COLUMN     "defaultAddress" TEXT,
ADD COLUMN     "defaultLat" DOUBLE PRECISION,
ADD COLUMN     "defaultLng" DOUBLE PRECISION,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "failedLogins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" INTEGER,
ADD COLUMN     "statusNote" TEXT,
ADD COLUMN     "suffix" TEXT;

-- CreateTable
CREATE TABLE "RouteDistance" (
    "id" SERIAL NOT NULL,
    "fromKey" TEXT NOT NULL,
    "toKey" TEXT NOT NULL,
    "km" DOUBLE PRECISION NOT NULL,
    "minutes" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteDistance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RouteDistance_fromKey_toKey_key" ON "RouteDistance"("fromKey", "toKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");


-- Cash is handed over on delivery, so a delivered cash order has been paid in
-- full. amountPaid now means "paid so far" for every payment method (staff can
-- record a downpayment on any order), so bring older cash orders in line.
UPDATE "Order" SET "amountPaid" = "totalAmount" WHERE "paymentMethod" = 'Cash' AND "status" = 'delivered';
