"use client";

import { Banknote, CheckCircle2, Clock, ImageIcon, Smartphone, Undo2, XCircle } from "lucide-react";

export type PaymentRow = {
  id: number;
  kind: string;
  method: string;
  amount: number;
  amountReceived: number | null;
  reference: string | null;
  accountNumber: string | null;
  proofImage: string | null;
  status: string;
  note: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy?: { username: string } | null;
  createdBy?: { username: string; role: string } | null;
};

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (d: string) => new Date(d).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Status pill and wording for a payment or refund, the same everywhere. */
export function paymentStatus(p: Pick<PaymentRow, "kind" | "status">): { label: string; cls: string; icon: typeof Clock } {
  if (p.kind === "refund") {
    return p.status === "sent"
      ? { label: "Refund sent", cls: "bg-good-soft text-good", icon: CheckCircle2 }
      : { label: "Refund to send", cls: "bg-warn-soft text-warn", icon: Undo2 };
  }
  if (p.status === "approved") return { label: "Approved", cls: "bg-good-soft text-good", icon: CheckCircle2 };
  if (p.status === "rejected") return { label: "Not accepted", cls: "bg-bad-soft text-bad", icon: XCircle };
  return { label: "Being checked", cls: "bg-brand-soft text-brand-ink", icon: Clock };
}

/**
 * Every payment and refund on an order, newest last: how much, how, its
 * reference and receipt, and where it stands. Staff get the actions to check a
 * receipt or record a refund as sent.
 */
export default function PaymentHistory({ payments, viewer, onReview, onSendRefund }: {
  payments: PaymentRow[];
  viewer: "staff" | "customer";
  onReview?: (p: PaymentRow) => void;
  onSendRefund?: (p: PaymentRow) => void;
}) {
  if (payments.length === 0) {
    return <p className="rounded-xl bg-subtle px-3 py-2.5 text-[12.5px] text-ink-4">No payments yet.</p>;
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
      {payments.map((p) => {
        const st = paymentStatus(p);
        const Icon = p.kind === "refund" ? Undo2 : p.method === "GCash" ? Smartphone : Banknote;
        const shown = p.amountReceived != null && p.status === "approved" ? p.amountReceived : p.amount;
        return (
          <li key={p.id} className="flex flex-wrap items-start gap-3 bg-surface px-3 py-2.5">
            <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${p.kind === "refund" ? "bg-warn-soft text-warn" : "bg-recess text-ink-3"}`}><Icon className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-ink">
                <span className="num">{p.kind === "refund" ? "− " : ""}{peso(shown)}</span>
                <span className="font-normal text-ink-3">{p.kind === "refund" ? `refund · ${p.method}` : p.method}</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}><st.icon className="size-3" />{st.label}</span>
              </p>
              <p className="text-[11.5px] text-ink-4">
                {when(p.createdAt)}
                {p.reference && <> · Ref <span className="num">{p.reference}</span></>}
                {p.accountNumber && <> · {p.kind === "refund" ? "to" : "from"} <span className="num">{p.accountNumber}</span></>}
                {viewer === "staff" && p.reviewedBy && <> · {p.kind === "refund" ? "sent" : p.status} by {p.reviewedBy.username}</>}
                {viewer === "staff" && !p.reviewedBy && p.createdBy && p.createdBy.role !== "customer" && <> · by {p.createdBy.username}</>}
              </p>
              {p.amountReceived != null && p.status === "approved" && p.amountReceived !== p.amount && p.kind === "payment" && (
                <p className="text-[11.5px] text-warn">Customer said {peso(p.amount)}; the store received {peso(p.amountReceived)}.</p>
              )}
              {p.note && <p className={`mt-0.5 text-[12px] ${p.status === "rejected" ? "text-bad" : "text-ink-3"}`}>{p.status === "rejected" ? "Reason: " : ""}{p.note}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {p.proofImage && (
                <a href={p.proofImage} target="_blank" rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2.5 text-[12px] font-semibold text-ink-2 hover:border-brand/40 hover:text-brand-ink">
                  <ImageIcon className="size-3.5" /> Receipt
                </a>
              )}
              {viewer === "staff" && p.kind === "payment" && p.status === "pending" && onReview && (
                <button type="button" onClick={() => onReview(p)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand px-2.5 text-[12px] font-semibold text-white hover:brightness-110">Check</button>
              )}
              {viewer === "staff" && p.kind === "refund" && p.status === "pending" && onSendRefund && (
                <button type="button" onClick={() => onSendRefund(p)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-warn px-2.5 text-[12px] font-semibold text-white hover:brightness-110">Send refund</button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
