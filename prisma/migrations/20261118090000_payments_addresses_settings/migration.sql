-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" TEXT,
ADD COLUMN     "deliveryNotes" TEXT,
ADD COLUMN     "paymentDueAt" TIMESTAMP(3),
ADD COLUMN     "recipientContact" TEXT,
ADD COLUMN     "recipientName" TEXT;

-- AlterTable
ALTER TABLE "Upload" ADD COLUMN     "ownerId" INTEGER,
ADD COLUMN     "private" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailUpdates" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'payment',
    "method" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "amountReceived" DOUBLE PRECISION,
    "reference" TEXT,
    "accountNumber" TEXT,
    "proofImage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "createdById" INTEGER,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedAddress" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "recipientName" TEXT,
    "recipientContact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_kind_status_idx" ON "Payment"("kind", "status");

-- CreateIndex
CREATE INDEX "SavedAddress_userId_idx" ON "SavedAddress"("userId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedAddress" ADD CONSTRAINT "SavedAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing payments become history rows. A GCash payment on an open order that
-- staff never verified goes to the review list instead of counting as paid.
INSERT INTO "Payment" ("orderId", "kind", "method", "amount", "amountReceived", "reference", "accountNumber", "status", "reviewedAt", "createdAt")
SELECT o."id", 'payment', o."paymentMethod", o."amountPaid",
       CASE WHEN o."paymentMethod" = 'GCash' AND NOT o."paymentVerified" AND o."status" IN ('pending', 'confirmed', 'out_for_delivery') THEN NULL ELSE o."amountPaid" END,
       o."gcashReference", o."gcashNumber",
       CASE WHEN o."paymentMethod" = 'GCash' AND NOT o."paymentVerified" AND o."status" IN ('pending', 'confirmed', 'out_for_delivery') THEN 'pending' ELSE 'approved' END,
       CASE WHEN o."paymentMethod" = 'GCash' AND NOT o."paymentVerified" AND o."status" IN ('pending', 'confirmed', 'out_for_delivery') THEN NULL ELSE o."dateTime" END,
       o."dateTime"
FROM "Order" o
WHERE o."amountPaid" > 0;

UPDATE "Order" SET "amountPaid" = 0
WHERE "paymentMethod" = 'GCash' AND NOT "paymentVerified" AND "status" IN ('pending', 'confirmed', 'out_for_delivery') AND "amountPaid" > 0;
