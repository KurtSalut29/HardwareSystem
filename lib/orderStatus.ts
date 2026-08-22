export const ORDER_STATUSES = ["pending", "confirmed", "out_for_delivery", "delivered", "cancelled"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

// Kept in sync with the semantic status tokens in globals.css (--warn/--info/--brand-ink/--good/--bad).
export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "#B4670A",
  confirmed: "#2D6FE0",
  out_for_delivery: "#12327F",
  delivered: "#128A4A",
  cancelled: "#D1362A",
};
