/**
 * How much of an order is paid, for any payment method.
 *
 * `amountPaid` is what the customer has paid so far. Staff can record a
 * downpayment (say half) when the order is taken, or later from the order's
 * status window; the rest is collected on delivery or at pickup. Cash orders
 * count as paid in full once delivered, since the driver collects the balance.
 */

export type PayNow = "full" | "half" | "later" | "other";

export const PAY_NOW_OPTIONS: { value: PayNow; label: string }[] = [
  { value: "full", label: "Full" },
  { value: "half", label: "Half (50%)" },
  { value: "later", label: "Pay later" },
  { value: "other", label: "Other amount" },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The peso amount for a "paid now" choice; null when "other" isn't a valid number yet. */
export function payNowAmount(choice: PayNow, total: number, other: string): number | null {
  if (choice === "full") return round2(total);
  if (choice === "half") return round2(total / 2);
  if (choice === "later") return 0;
  if (other.trim() === "") return null;
  const n = round2(Number(other));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** What is still owed on the order. Nothing for a cancelled one. */
export function outstanding(o: { status: string; totalAmount: number; amountPaid?: number | null }): number {
  if (o.status === "cancelled") return 0;
  return Math.max(0, round2(o.totalAmount - (o.amountPaid ?? 0)));
}

/** "Paid in full", "Downpayment", "Not paid yet" — for chips and receipts. */
export function paymentState(o: { status: string; totalAmount: number; amountPaid?: number | null }): "paid" | "partial" | "unpaid" {
  const paid = o.amountPaid ?? 0;
  if (outstanding(o) <= 0.005) return "paid";
  return paid > 0 ? "partial" : "unpaid";
}
