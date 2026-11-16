"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import Button from "@/components/ui/Button";
import { PAY_NOW_OPTIONS, outstanding, payNowAmount, paymentState, type PayNow } from "@/lib/payment";
import { ICON_SIZE } from "@/lib/constants/icon-size";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type PayOrder = { id: number; status: string; totalAmount: number; amountPaid?: number | null; paymentMethod?: string; fulfillmentMode?: string };

const STATE_LOOK = {
  paid: { label: "Paid in full", bg: "var(--good-soft)", fg: "var(--good)" },
  partial: { label: "Downpayment", bg: "var(--warn-soft)", fg: "var(--warn)" },
  unpaid: { label: "Not paid yet", bg: "var(--bg-muted)", fg: "var(--text-muted)" },
} as const;

/**
 * What's been paid on an order and what's left. Staff and the admin set how
 * much the customer has paid so far: all of it, half as a downpayment, nothing
 * yet, or another amount. The rest is collected on delivery or at pickup.
 */
export default function PaymentCard({ order, onRecord }: {
  order: PayOrder;
  /** Staff only; without it the card is read-only (the customer's view). */
  onRecord?: (id: number, amount: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<PayNow>("half");
  const [other, setOther] = useState("");
  const [saving, setSaving] = useState(false);

  const paid = order.amountPaid ?? 0;
  const left = outstanding(order);
  const state = paymentState(order);
  const look = STATE_LOOK[state];
  const pickup = order.fulfillmentMode === "pickup";
  const amount = payNowAmount(choice, order.totalAmount, other);
  const invalid = amount == null || amount > order.totalAmount + 0.005;
  const canEdit = !!onRecord && order.status !== "cancelled" && !(order.status === "delivered" && state === "paid");

  if (order.status === "cancelled") return null;

  return (
    <div className="rounded-xl border border-line p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-ink-3 flex items-center gap-1.5"><Wallet size={ICON_SIZE.xs} /> Payment · {order.paymentMethod ?? "Cash"}</p>
          <p className="text-sm text-ink num mt-0.5">
            Paid <b>{peso(paid)}</b> of {peso(order.totalAmount)}
            {left > 0 && <span className="text-ink-3"> · <b className="text-warn">{peso(left)}</b> {order.status === "delivered" ? "still owed" : `to collect ${pickup ? "at pickup" : "on delivery"}`}</span>}
          </p>
        </div>
        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0" style={{ background: look.bg, color: look.fg }}>{look.label}</span>
      </div>

      {canEdit && !editing && (
        <button onClick={() => { setEditing(true); setChoice(state === "unpaid" ? "half" : "full"); setOther(""); }}
          className="text-xs font-semibold text-brand hover:underline">
          Record a payment
        </button>
      )}

      {canEdit && editing && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-lg border border-line p-1" role="group" aria-label="How much has the customer paid?">
            {PAY_NOW_OPTIONS.map((o) => (
              <button key={o.value} type="button" onClick={() => setChoice(o.value)} aria-pressed={choice === o.value}
                className="rounded-md py-1.5 px-1 text-[11px] font-semibold leading-tight transition"
                style={choice === o.value ? { background: "var(--brand)", color: "#fff" } : { color: "var(--text-muted)" }}>
                {o.value === "later" ? "None yet" : o.label}
                {o.value !== "other" && <span className="block text-[10px] font-normal opacity-80 num">{peso(payNowAmount(o.value, order.totalAmount, "") ?? 0)}</span>}
              </button>
            ))}
          </div>
          {choice === "other" && (
            <div className="relative w-40">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-4">₱</span>
              <input aria-label="Amount paid so far" type="number" min="0" step="0.01" value={other} onChange={(e) => setOther(e.target.value)}
                className="w-full border border-line rounded-lg pl-6 pr-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" placeholder="0.00" />
            </div>
          )}
          <p className="text-[11px] text-ink-3">
            {invalid ? `Enter an amount from ₱0 to ${peso(order.totalAmount)}.`
              : `Total paid so far becomes ${peso(amount!)}; ${peso(Math.max(0, order.totalAmount - amount!))} left.`}
          </p>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" loading={saving} disabled={invalid}
              onClick={async () => {
                if (invalid || !onRecord) return;
                setSaving(true);
                const ok = await onRecord(order.id, amount!);
                setSaving(false);
                if (ok) setEditing(false);
              }}>Save payment</Button>
          </div>
        </div>
      )}
    </div>
  );
}
