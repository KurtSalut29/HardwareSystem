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
  items: { quantity: number; price: number; product: { name: string; unit?: string } }[];
};

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** An order as a receipt: items, delivery fee, payment and any balance still due. */
export function orderReceipt(o: ReceiptOrder): ReceiptData {
  const pickup = o.fulfillmentMode === "pickup";
  const payment: ReceiptData["payment"] = [{ label: "Payment", value: o.paymentMethod ?? "Cash" }];
  if (o.paymentMethod === "GCash") {
    if (o.gcashNumber) payment.push({ label: "GCash No.", value: o.gcashNumber });
    if (o.gcashReference) payment.push({ label: "Ref. No.", value: o.gcashReference });
    payment.push({ label: "GCash payment", value: o.paymentVerified ? "Verified" : "Not verified yet", tone: o.paymentVerified ? "good" : "warn" });
    const paid = o.amountPaid ?? 0;
    payment.push({ label: "Amount paid", value: peso(paid) });
    const bal = Math.round((o.totalAmount - paid) * 100) / 100;
    if (bal > 0.005) payment.push({ label: "Balance due", value: peso(bal), tone: "warn" });
  } else if (o.status !== "delivered") {
    payment.push({ label: pickup ? "Pay at pickup" : "Cash on delivery", value: peso(o.totalAmount) });
  }
  return {
    number: `Order #${o.id}`,
    date: o.dateTime,
    customer: customerLabel(o),
    contact: customerPhone(o),
    fulfillment: pickup ? "Pickup" : "Delivery",
    address: pickup ? null : o.deliveryAddress ?? null,
    status: isOrderStatus(o.status) ? STATUS_LABELS[o.status] : o.status,
    items: o.items.map((i) => ({ name: i.product.name, quantity: i.quantity, unit: i.product.unit, price: i.price })),
    deliveryFee: o.deliveryFee ?? 0,
    total: o.totalAmount,
    payment,
  };
}
