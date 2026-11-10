/**
 * What happens next on an order, and the steps it goes through, worded for
 * whoever is looking at it. Shared by the order list and the status modal so
 * both always say the same thing.
 */

export type FlowOrder = {
  status: string;
  fulfillmentMode?: string;
  driverId?: number | null;
  driver?: { username: string } | null;
  paymentMethod?: string;
  paymentVerified?: boolean;
  totalAmount: number;
  amountPaid?: number;
  dateTime: string;
  assignedAt?: string | null;
  transaction?: { dateTime: string } | null;
  deliveredAt?: string | null;
};

export type Viewer = "staff" | "customer";

const isPickup = (o: FlowOrder) => o.fulfillmentMode === "pickup";

/** Balance still owed on a GCash order paid in part. Cash orders are paid on handover. */
export function balanceDue(o: FlowOrder) {
  if (o.paymentMethod !== "GCash") return 0;
  return Math.max(0, Math.round((o.totalAmount - (o.amountPaid ?? 0)) * 100) / 100);
}

/** One line telling the viewer what the order is waiting on. */
export function nextStepText(o: FlowOrder, viewer: Viewer): string {
  const driver = o.driver?.username;
  const gcashUnchecked = o.paymentMethod === "GCash" && !o.paymentVerified;

  if (viewer === "customer") {
    switch (o.status) {
      case "pending": return "Waiting for the store to confirm your order";
      case "confirmed":
        return isPickup(o) ? "Being prepared — pick it up at the store" : "Confirmed — waiting for a driver to be assigned";
      case "out_for_delivery": return driver ? `${driver} is on the way with your order` : "Your order is on the way";
      case "delivered": return isPickup(o) ? "Picked up — thank you!" : "Delivered — thank you!";
      case "cancelled": return "This order was cancelled";
      default: return "";
    }
  }

  switch (o.status) {
    case "pending":
      return gcashUnchecked ? "Check the GCash payment, then confirm" : "Confirm the order and prepare the items";
    case "confirmed":
      if (isPickup(o)) return "Prepare the items — customer picks up at the store";
      return o.driverId ? "Driver assigned — waiting to leave" : "Assign a driver to start the delivery";
    case "out_for_delivery":
      return `${driver ?? "Driver"} is delivering — mark delivered once received`;
    case "delivered": {
      const bal = balanceDue(o);
      return bal > 0 ? `Collect the ₱${bal.toFixed(2)} balance` : "Completed";
    }
    case "cancelled": return "Cancelled — no further action";
    default: return "";
  }
}

export type TimelineStep = {
  key: string;
  label: string;
  detail: string;
  state: "done" | "current" | "upcoming" | "cancelled";
  /** When it happened, if the system records it. */
  at?: string | null;
};

/**
 * The order's path, from placed to delivered (or picked up). A cancelled order
 * shows the steps it reached, then the cancellation.
 */
export function orderTimeline(o: FlowOrder, viewer: Viewer): TimelineStep[] {
  const pickup = isPickup(o);
  const base = [
    {
      key: "pending", label: "Order placed",
      detail: viewer === "customer" ? "We received your order" : "Waiting for the store to confirm",
      at: o.dateTime,
    },
    {
      key: "confirmed", label: "Confirmed",
      detail: pickup ? "Items are being prepared for pickup" : "Items are being prepared for delivery",
      at: null,
    },
    ...(pickup ? [] : [{
      key: "out_for_delivery", label: "Out for delivery",
      detail: o.driver?.username ? `With ${o.driver.username}` : "A driver takes the order",
      at: o.assignedAt ?? null,
    }]),
    {
      key: "delivered", label: pickup ? "Picked up" : "Delivered",
      detail: pickup ? "Customer collected the order" : "Customer received the order",
      at: o.status === "delivered" ? o.deliveredAt ?? o.transaction?.dateTime ?? null : null,
    },
  ];

  if (o.status === "cancelled") {
    // We only know how far it got from what was recorded on it.
    const reached = o.driverId && !pickup ? 3 : 1;
    return [
      ...base.slice(0, reached).map((s) => ({ ...s, state: "done" as const })),
      { key: "cancelled", label: "Cancelled", detail: "The order was cancelled", state: "cancelled" as const, at: null },
    ];
  }

  const idx = base.findIndex((s) => s.key === o.status);
  return base.map((s, i) => ({
    ...s,
    state: i < idx ? "done" : i === idx ? (o.status === "delivered" ? "done" : "current") : "upcoming",
    at: i <= idx ? s.at : null,
  }));
}
