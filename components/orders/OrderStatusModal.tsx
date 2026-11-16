"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, X, Truck, Ban, ArrowRight, Camera, ClipboardList } from "lucide-react";
import { customerLabel, type OrderCustomer } from "@/lib/customer";
import { driverOption, type DriverAvailability } from "@/lib/driverStatus";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { balanceDue, nextStepText, orderTimeline, type FlowOrder, type Viewer } from "@/lib/orderFlow";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import PaymentCard from "@/components/orders/PaymentCard";

export type StatusModalOrder = FlowOrder & OrderCustomer & {
  id: number; proofImage?: string | null; deliveredAt?: string | null;
  deliveryFee?: number; deliveryFeeNote?: string | null; transactionId?: number | null;
};
type Driver = { id: number; username: string; activeCount: number; maxActive?: number; availability?: DriverAvailability };

type Action = { label: string; confirm: string; run: () => Promise<void> | void; tone?: "primary" | "good" };

function when(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * The order's progress as a timeline, what happens next, and the one action that
 * moves it forward. The action asks once more before it runs, since a status
 * change notifies the customer (and the driver) right away.
 */
export default function OrderStatusModal({
  order, viewer, drivers, canAssign, canCancel, onClose, onStatus, onAssign, onSettle, onCancel, onViewProof, onAdjustFee, onRecordPayment,
}: {
  order: StatusModalOrder;
  viewer: Viewer;
  drivers: Driver[];
  canAssign: boolean;
  canCancel: boolean;
  onClose: () => void;
  onStatus: (id: number, status: string) => Promise<void> | void;
  onAssign: (id: number, driverId: string) => Promise<void> | void;
  onSettle: (id: number, total: number) => Promise<void> | void;
  onCancel: () => void;
  onViewProof?: () => void;
  /** Admin only: change this order's delivery fee, with a reason. */
  onAdjustFee?: (id: number, fee: number, note: string) => Promise<boolean>;
  /** Staff: set how much the customer has paid so far (full, half downpayment, …). */
  onRecordPayment?: (id: number, amount: number) => Promise<boolean>;
}) {
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [driverId, setDriverId] = useState("");
  const [feeEdit, setFeeEdit] = useState<{ fee: string; note: string } | null>(null);
  const [feeSaving, setFeeSaving] = useState(false);

  const steps = orderTimeline(order, viewer);
  const next = nextStepText(order, viewer);
  const pickup = order.fulfillmentMode === "pickup";
  const bal = balanceDue(order);

  let action: Action | null = null;
  if (viewer === "staff") {
    if (order.status === "pending") {
      action = { label: "Confirm order", confirm: `Confirm order #${order.id}? ${customerLabel(order)} will be notified.`, run: () => onStatus(order.id, "confirmed") };
    } else if (order.status === "confirmed" && pickup) {
      action = { label: "Mark picked up", confirm: `Mark order #${order.id} as picked up by ${customerLabel(order)}?`, run: () => onStatus(order.id, "delivered"), tone: "good" };
    } else if (order.status === "out_for_delivery") {
      action = { label: "Mark delivered", confirm: `Mark order #${order.id} as delivered?`, run: () => onStatus(order.id, "delivered"), tone: "good" };
    } else if (order.status === "delivered" && bal > 0) {
      action = { label: `Balance ₱${bal.toFixed(2)} collected`, confirm: `Record that the ₱${bal.toFixed(2)} balance was collected?`, run: () => onSettle(order.id, order.totalAmount), tone: "good" };
    }
  }
  const needsDriver = viewer === "staff" && order.status === "confirmed" && !pickup && !order.driverId;

  async function runPending() {
    if (!pending) return;
    setBusy(true);
    try { await pending.run(); } finally { setBusy(false); }
    setPending(null);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Order #${order.id} — status`} icon={<ClipboardList className="size-5" />} description="Where this order is, and what happens next." size="md">
      <div className="space-y-5">
        {/* What happens next */}
        <div className="rounded-xl px-3.5 py-3 flex items-start gap-2.5" style={{ background: "var(--brand-soft, #EEF3FF)" }}>
          <ArrowRight size={ICON_SIZE.sm} className="shrink-0 mt-0.5 text-brand" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">Next step</p>
            <p className="text-sm text-ink font-medium">{next}</p>
          </div>
        </div>

        {/* Timeline */}
        <ol className="relative">
          {steps.map((s, i) => {
            const last = i === steps.length - 1;
            const color =
              s.state === "cancelled" ? "var(--bad)" :
              s.state === "done" ? "var(--good)" :
              s.state === "current" ? "var(--brand)" : "#D1D5DB";
            return (
              <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
                {!last && (
                  <span aria-hidden className="absolute left-[11px] top-6 bottom-0 w-0.5"
                    style={{ background: s.state === "done" ? "var(--good)" : "#E5E7EB" }} />
                )}
                <span className="relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2"
                  style={{
                    borderColor: color,
                    background: s.state === "done" || s.state === "cancelled" ? color : "white",
                  }}>
                  {s.state === "done" && <Check size={13} className="text-white" strokeWidth={3} />}
                  {s.state === "cancelled" && <X size={13} className="text-white" strokeWidth={3} />}
                  {s.state === "current" && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className={`text-sm font-semibold ${s.state === "upcoming" ? "text-ink-4" : "text-ink"}`}>
                    {s.label}
                    {s.state === "current" && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide align-middle px-1.5 py-0.5 rounded-full" style={{ background: "var(--brand-soft, #EEF3FF)", color: "var(--brand)" }}>Now</span>}
                  </p>
                  <p className={`text-xs ${s.state === "upcoming" ? "text-ink-4" : "text-ink-3"}`}>{s.detail}</p>
                  {when(s.at) && <p className="text-[11px] text-ink-4 mt-0.5 num">{when(s.at)}</p>}
                </div>
              </li>
            );
          })}
        </ol>

        <PaymentCard order={order} onRecord={viewer === "staff" ? onRecordPayment : undefined} />

        {/* Delivery fee: computed from distance; the admin can change it on this order */}
        {!pickup && (
          <div className="rounded-xl border border-line p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-ink-3">Delivery fee</p>
                <p className="text-sm font-semibold text-ink num">
                  {order.deliveryFee ? `₱${order.deliveryFee.toFixed(2)}` : "Free"}
                  <span className="text-xs font-normal text-ink-4"> · total ₱{order.totalAmount.toFixed(2)}</span>
                </p>
                {order.deliveryFeeNote && <p className="text-[11px] text-ink-3">Changed by the store: {order.deliveryFeeNote}</p>}
              </div>
              {onAdjustFee && !feeEdit && !order.transactionId && order.status !== "delivered" && order.status !== "cancelled" && (
                <button onClick={() => setFeeEdit({ fee: String(order.deliveryFee ?? 0), note: "" })}
                  className="text-xs font-semibold text-brand hover:underline shrink-0">Change fee</button>
              )}
            </div>
            {feeEdit && onAdjustFee && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative w-28 shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-4">₱</span>
                    <input aria-label="New delivery fee" type="number" min="0" step="1" value={feeEdit.fee} onChange={(e) => setFeeEdit({ ...feeEdit, fee: e.target.value })}
                      className="w-full border border-line rounded-lg pl-6 pr-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                  </div>
                  <input aria-label="Reason for the new fee" value={feeEdit.note} onChange={(e) => setFeeEdit({ ...feeEdit, note: e.target.value })} maxLength={200}
                    placeholder="Reason, e.g. same trip as order #1021"
                    className="flex-1 min-w-0 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="secondary" onClick={() => setFeeEdit(null)} disabled={feeSaving}>Cancel</Button>
                  <Button size="sm" loading={feeSaving} disabled={feeEdit.fee === "" || !feeEdit.note.trim()}
                    onClick={async () => {
                      setFeeSaving(true);
                      const ok = await onAdjustFee(order.id, Number(feeEdit.fee), feeEdit.note);
                      setFeeSaving(false);
                      if (ok) setFeeEdit(null);
                    }}>Save fee</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {order.proofImage && (
          <button onClick={onViewProof} className="w-full flex items-center gap-3 rounded-xl border border-line p-2.5 hover:bg-subtle transition text-left">
            <span className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-subtle">
              <Image src={order.proofImage} alt="Proof of delivery" fill sizes="56px" className="object-cover" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-semibold text-ink"><Camera size={ICON_SIZE.xs} /> Proof of delivery</span>
              <span className="block text-xs text-ink-3">Photo taken by the driver at the drop-off. Tap to view.</span>
            </span>
          </button>
        )}

        {/* Action, with one confirmation before it runs */}
        {pending ? (
          <div className="rounded-xl border border-line p-3.5 space-y-3">
            <p className="text-sm text-ink">{pending.confirm}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setPending(null)} disabled={busy}>Back</Button>
              <Button size="sm" onClick={runPending} loading={busy}
                style={pending.tone === "good" ? { background: "var(--good)" } : undefined}>
                Yes, continue
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {action && (
              <Button className="w-full" onClick={() => setPending(action)}
                style={action.tone === "good" ? { background: "var(--good)" } : undefined}>
                {action.label}
              </Button>
            )}
            {needsDriver && (canAssign ? (
              drivers.length === 0 ? (
                <p className="text-xs text-center text-warn">No drivers registered yet.</p>
              ) : (
                <div className="flex gap-2">
                  <select value={driverId} onChange={(e) => setDriverId(e.target.value)} aria-label="Driver"
                    className="flex-1 min-w-0 text-sm border border-line rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20">
                    <option value="">Choose a driver…</option>
                    {drivers.map((d) => {
                      const o = driverOption(d);
                      return <option key={d.id} value={d.id} disabled={o.disabled}>{o.label}</option>;
                    })}
                  </select>
                  <Button icon={<Truck size={ICON_SIZE.sm} />} disabled={!driverId}
                    onClick={() => {
                      const d = drivers.find((x) => String(x.id) === driverId);
                      setPending({ label: "Assign", confirm: `Send order #${order.id} out with ${d?.username ?? "this driver"}? They will be notified.`, run: () => onAssign(order.id, driverId) });
                    }}>
                    Assign
                  </Button>
                </div>
              )
            ) : (
              <p className="text-xs text-center text-ink-3">Staff assigns the driver for this order.</p>
            ))}
            {canCancel && (
              <button onClick={onCancel}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg text-bad hover:bg-bad-soft transition">
                <Ban size={ICON_SIZE.xs} /> Cancel order
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
