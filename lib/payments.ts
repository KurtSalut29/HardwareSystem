import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cancellationFee, type AppSettings } from "@/lib/settings-schema";

type Tx = Prisma.TransactionClient;
const round2 = (n: number) => Math.round(n * 100) / 100;

export const GCASH_NUMBER_RE = /^09\d{9}$/;
export const GCASH_REFERENCE_RE = /^\d{13}$/;

/**
 * Recomputes an order's amountPaid from its approved payments, and whether its
 * GCash payments are all checked. Call after any payment is added or reviewed.
 */
export async function syncOrderPaid(tx: Tx, orderId: number) {
  const [order, payments] = await Promise.all([
    tx.order.findUnique({ where: { id: orderId }, select: { totalAmount: true } }),
    tx.payment.findMany({ where: { orderId, kind: "payment" }, select: { status: true, method: true, amountReceived: true, amount: true } }),
  ]);
  if (!order) return;
  const approved = payments.filter((p) => p.status === "approved");
  const paid = round2(approved.reduce((s, p) => s + (p.amountReceived ?? p.amount), 0));
  const gcash = payments.filter((p) => p.method === "GCash");
  const verified = gcash.length > 0 && gcash.some((p) => p.status === "approved") && !gcash.some((p) => p.status === "pending");
  await tx.order.update({
    where: { id: orderId },
    data: { amountPaid: Math.min(paid, order.totalAmount), paymentVerified: verified },
  });
}

/** Is this GCash reference already used by another payment that wasn't rejected? */
export async function referenceTaken(reference: string, exceptPaymentId?: number) {
  const hit = await prisma.payment.findFirst({
    where: { reference, kind: "payment", status: { not: "rejected" }, ...(exceptPaymentId ? { NOT: { id: exceptPaymentId } } : {}) },
    select: { orderId: true },
  });
  return hit;
}

/** The least a GCash downpayment may be for this total, per Settings. */
export function minimumDownpayment(total: number, s: Pick<AppSettings, "minDownpaymentPct">) {
  return Math.min(total, Math.ceil((total * s.minDownpaymentPct) / 100));
}

export type CancelQuote = {
  /** Approved payments so far. */
  paid: number;
  /** Kept by the store under the cancellation policy. */
  fee: number;
  /** Comes back to the customer. */
  refund: number;
  /** Payments still waiting for the store to check them (refunded once approved). */
  pendingReview: number;
};

/** What happens to the money if this order is cancelled now, by the customer or by the store. */
export function quoteCancellation(
  order: { status: string; payments: { kind: string; status: string; amount: number; amountReceived: number | null }[] },
  by: "customer" | "store",
  s: Pick<AppSettings, "cancelFeeType" | "cancelFeeValue">,
): CancelQuote {
  const pays = order.payments.filter((p) => p.kind === "payment");
  const paid = round2(pays.filter((p) => p.status === "approved").reduce((t, p) => t + (p.amountReceived ?? p.amount), 0));
  const pendingReview = round2(pays.filter((p) => p.status === "pending").reduce((t, p) => t + p.amount, 0));
  // A fee applies only when the customer cancels after the store confirmed (it may already be preparing).
  const fee = by === "customer" && order.status !== "pending" ? cancellationFee(paid, s) : 0;
  return { paid, fee, refund: round2(paid - fee), pendingReview };
}

/** Can the customer cancel this order themselves, per Settings? */
export function customerMayCancel(status: string, s: Pick<AppSettings, "customerCancelUntil">) {
  if (status === "pending") return true;
  if (status === "confirmed") return s.customerCancelUntil === "confirmed";
  return false;
}

/**
 * Cancels an order: puts the items back on the shelf, records who cancelled and
 * why, and opens a refund for whatever was paid (minus the policy's fee when the
 * customer cancels after confirmation). Returns the refund created, if any.
 */
export async function cancelOrder(orderId: number, by: "customer" | "store", reason: string, actorId: number, s: AppSettings) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true },
    });
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled") throw new Error("This order is already cancelled");
    if (order.status === "delivered" || order.transactionId) throw new Error("A completed order can't be cancelled");

    const quote = quoteCancellation(order, by, s);
    // Claim the cancellation first so two clicks can't both restock.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: { notIn: ["cancelled", "delivered"] }, transactionId: null },
      data: {
        status: "cancelled", cancelledAt: new Date(), cancelledBy: by, cancelReason: reason.slice(0, 300),
        driverId: null, assignedAt: null, handledById: by === "store" ? actorId : order.handledById,
      },
    });
    if (claimed.count === 0) throw new Error("This order was just updated. Refresh and try again.");

    for (const it of order.items) {
      await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } });
    }

    let refund = null;
    if (quote.refund > 0) {
      const lastGcash = [...order.payments].reverse().find((p) => p.kind === "payment" && p.status === "approved" && p.method === "GCash");
      refund = await tx.payment.create({
        data: {
          orderId, kind: "refund", method: lastGcash ? "GCash" : "Cash", amount: quote.refund,
          accountNumber: lastGcash?.accountNumber ?? null, status: "pending", createdById: actorId,
          note: quote.fee > 0 ? `Cancellation fee of ₱${quote.fee.toFixed(2)} kept per the store's policy.` : null,
        },
      });
    }
    return { quote, refund };
  });
}

/** When a payment is approved on an order that was already cancelled, it is owed back in full. */
export async function refundLateApproval(tx: Tx, orderId: number, amount: number, method: string, accountNumber: string | null, actorId: number) {
  if (amount <= 0) return null;
  return tx.payment.create({
    data: {
      orderId, kind: "refund", method, amount: round2(amount), accountNumber, status: "pending", createdById: actorId,
      note: "Payment arrived after the order was cancelled.",
    },
  });
}
