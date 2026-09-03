-- Orders placed before partial GCash payments existed were always paid in full,
-- so their new amountPaid column (which defaults to 0) would otherwise read as a
-- 100% outstanding balance. Backfill those to the order total.
--
-- Cash orders are deliberately left at 0: they are settled at handover, and the
-- app treats a balance as a GCash-only concept.
UPDATE "Order"
SET "amountPaid" = "totalAmount"
WHERE "paymentMethod" = 'GCash'
  AND "amountPaid" = 0;
