import type { ReceiptData } from "@/components/receipts/Receipt";
import { customerLabel, customerPhone, type OrderCustomer } from "@/lib/customer";
import { STATUS_LABELS, isOrderStatus } from "@/lib/orderStatus";

export type ReceiptOrder = OrderCustomer & {
  id: number;
  dateTime: string;
  status: string;
  totalAmount: number;
  deliveryFee?: number;
  fulfillmentMode?: string;
  deliveryAddress?: string | null;
  paymentMethod?: string;
  gcashNumber?: string | null;
  gcashReference?: string | null;
  paymentVerified?: boolean;
  amountPaid?: number;
  deliveryFeeNote?: string | null;
  driver?: { username: string } | null;
  handledBy?: { username: string } | null;
  deliveredAt?: string | null;
  transaction?: { dateTime: string } | null;
  items: { quantity: number; price: number; product: { name: string; unit?: string } }[];
};

/** An order as a receipt: items, delivery fee, payment and any balance still due. */
export function orderReceipt(o: ReceiptOrder): ReceiptData {
  const pickup = o.fulfillmentMode === "pickup";
  const payment: ReceiptData["payment"] = [{ label: "Payment method", value: o.paymentMethod === "Cash" || !o.paymentMethod ? (pickup ? "Cash" : "Cash on delivery") : o.paymentMethod }];
  if (o.paymentMethod === "GCash") {
    if (o.gcashNumber) payment.push({ label: "GCash No.", value: o.gcashNumber });
    if (o.gcashReference) payment.push({ label: "Ref. No.", value: o.gcashReference });
    payment.push({ label: "GCash payment", value: o.paymentVerified ? "Verified" : "Not verified yet", tone: o.paymentVerified ? "good" : "warn" });
  }
  // A delivered cash order was paid in full at the door.
  const amountPaid = o.status === "delivered" && o.paymentMethod !== "GCash" ? o.totalAmount : o.amountPaid ?? 0;
  const done = o.status === "delivered";
  return {
    number: `Order #${o.id}`,
    date: o.dateTime,
    customer: customerLabel(o),
    contact: customerPhone(o),
    fulfillment: pickup ? "Pickup" : "Delivery",
    address: pickup ? null : o.deliveryAddress ?? null,
    driver: pickup ? null : o.driver?.username ?? null,
    servedBy: o.handledBy?.username ?? null,
    status: isOrderStatus(o.status) ? (pickup && o.status === "delivered" ? "Picked up" : STATUS_LABELS[o.status]) : o.status,
    completedAt: done ? o.deliveredAt ?? o.transaction?.dateTime ?? null : null,
    items: o.items.map((i) => ({ name: i.product.name, quantity: i.quantity, unit: i.product.unit, price: i.price })),
    deliveryFee: o.deliveryFee ?? 0,
    deliveryFeeNote: pickup ? null : o.deliveryFeeNote ?? null,
    total: o.totalAmount,
    payment,
    amountPaid: o.status === "cancelled" && !amountPaid ? null : amountPaid,
    balanceLabel: pickup ? "Balance at pickup" : "Balance on delivery",
  };
}
