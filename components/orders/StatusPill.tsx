import { createElement } from "react";
import { CheckCheck, CheckCircle, Clock, Store, Truck, XCircle } from "lucide-react";

export const ORDER_STATUS_STYLE: Record<string, { label: string; pill: string; dot: string }> = {
  pending: { label: "Pending", pill: "bg-warn-soft text-warn", dot: "bg-warn" },
  confirmed: { label: "Confirmed", pill: "bg-info-soft text-info", dot: "bg-info" },
  out_for_delivery: { label: "Out for delivery", pill: "bg-brand-soft text-brand-ink", dot: "bg-brand" },
  delivered: { label: "Delivered", pill: "bg-good-soft text-good", dot: "bg-good" },
  cancelled: { label: "Cancelled", pill: "bg-bad-soft text-bad", dot: "bg-bad" },
};

/** Pickup orders read differently: "To pick up" instead of "Confirmed", "Picked up" instead of "Delivered". */
const PICKUP_LABEL: Record<string, string> = { confirmed: "To pick up", delivered: "Picked up" };

export function statusLabel(status: string, pickup = false) {
  return (pickup && PICKUP_LABEL[status]) || ORDER_STATUS_STYLE[status]?.label || status;
}

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Clock, confirmed: CheckCircle, out_for_delivery: Truck, delivered: CheckCheck, cancelled: XCircle,
};

/** An order's status as a soft pill. */
export default function StatusPill({ status, pickup = false }: { status: string; pickup?: boolean }) {
  const st = ORDER_STATUS_STYLE[status] ?? ORDER_STATUS_STYLE.pending;
  const icon = pickup && status === "confirmed" ? Store : ICON[status] ?? Clock;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${st.pill}`}>
      {createElement(icon, { className: "size-3" })} {statusLabel(status, pickup)}
    </span>
  );
}
