import type { AlertSound } from "@/lib/sounds";

export type NotificationType =
  | "new_order" | "new_customer" | "low_stock" | "out_of_stock" | "order_update"
  // Staff: a GCash receipt to check, a refund to send, a balance past its due date.
  | "payment_review" | "refund_due" | "balance_overdue"
  // Customer: a payment approved or rejected, a balance to pay, a refund sent.
  | "payment_update" | "payment_problem" | "balance_due" | "refund_sent";

export type AppNotification = {
  /** Stable for as long as the situation lasts, so the same alert never rings twice. */
  key: string;
  type: NotificationType;
  title: string;
  message: string;
  href: string;
  at: string;
};

/** The sound each kind of notification plays. */
export const SOUND_FOR: Record<NotificationType, AlertSound> = {
  new_order: "new_order",
  new_customer: "order_update",
  low_stock: "low_stock",
  out_of_stock: "out_of_stock",
  order_update: "order_update",
  payment_review: "new_order",
  refund_due: "low_stock",
  balance_overdue: "low_stock",
  payment_update: "order_update",
  payment_problem: "out_of_stock",
  balance_due: "order_update",
  refund_sent: "order_update",
};
