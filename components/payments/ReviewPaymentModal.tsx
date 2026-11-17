"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, ScanSearch, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { UnitInput } from "@/components/ui/SettingRow";
import type { PaymentRow } from "@/components/payments/PaymentHistory";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const REASONS = [
  "The reference number doesn't match any payment in our GCash.",
  "The amount on the receipt is different from what arrived.",
  "The screenshot is unclear. Please upload a clearer one.",
  "This receipt was already used for another order.",
];

/**
 * Staff check a customer's GCash payment: the receipt beside what the customer
 * entered, then Approve (with the amount that actually arrived) or Reject with a
 * reason the customer will see.
 */
export default function ReviewPaymentModal({ payment, orderId, customer, orderTotal, alreadyPaid, onClose, onDone }: {
  payment: PaymentRow;
  orderId: number;
  customer: string;
  orderTotal: number;
  alreadyPaid: number;
  onClose: () => void;
  /** Called with a message for the toast after the review is saved. */
  onDone: (message: string, tone: "success" | "warning" | "info") => void;
}) {
  const [mode, setMode] = useState<"check" | "reject">("check");
  const [received, setReceived] = useState(String(payment.amount));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const receivedNum = Number(received);
  const after = Math.max(0, Math.round((orderTotal - alreadyPaid - (Number.isFinite(receivedNum) ? receivedNum : 0)) * 100) / 100);

  async function submit(action: "approve" | "reject") {
    setError("");
    if (action === "approve" && (!Number.isFinite(receivedNum) || receivedNum <= 0)) { setError("Enter the amount that actually arrived in the store's GCash."); return; }
    if (action === "reject" && !reason.trim()) { setError("Choose or write the reason the customer will see."); return; }
    setSaving(true);
    const res = await fetch("/api/payments", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "approve" ? { id: payment.id, action, amountReceived: receivedNum } : { id: payment.id, action, reason }),
    });
    setSaving(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Couldn't save the review. Try again."); return; }
    const mailed = d.emailed ? " They were also emailed." : "";
    if (action === "reject") onDone(`Payment rejected. ${customer} was notified to send it again.${mailed}`, "warning");
    else if (d.refund) onDone(`Approved — this order was already cancelled, so a ${peso(receivedNum)} refund was added to send back.`, "info");
    else onDone(d.balance > 0 ? `Payment approved. ${customer} still owes ${peso(d.balance)} and was notified.${mailed}` : `Payment approved. Order #${orderId} is fully paid.${mailed}`, "success");
  }

  return (
    <Modal open onClose={onClose} size="lg" icon={<ScanSearch className="size-5" />}
      title={`Check payment — Order #${orderId}`}
      description={`${customer} says they sent ${peso(payment.amount)} by GCash.`}
      footer={mode === "check" ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="danger-soft" className="mr-auto" icon={<XCircle className="size-4" />} onClick={() => { setMode("reject"); setError(""); }}>It doesn&apos;t match</Button>
          <Button variant="secondary" onClick={onClose}>Later</Button>
          <Button variant="success" loading={saving} icon={<CheckCircle2 className="size-4" />} onClick={() => submit("approve")}>Approve {Number.isFinite(receivedNum) && receivedNum > 0 ? peso(receivedNum) : ""}</Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => { setMode("check"); setError(""); }}>Back</Button>
          <Button variant="danger" className="flex-1" loading={saving} onClick={() => submit("reject")}>Reject payment</Button>
        </div>
      )}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          {payment.proofImage ? (
            <a href={payment.proofImage} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-2xl border border-line bg-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element -- private receipt served with the session */}
              <img src={payment.proofImage} alt="Customer's GCash receipt" className="max-h-[420px] w-full object-contain" />
              <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-surface/90 px-2 py-1 text-[11.5px] font-semibold text-ink-2 shadow">
                <ExternalLink className="size-3.5" /> Open full size
              </span>
            </a>
          ) : (
            <div className="grid h-48 place-items-center rounded-2xl border border-dashed border-line-strong text-[12.5px] text-ink-4">No screenshot was attached.</div>
          )}
        </div>
        <div className="space-y-3">
          <dl className="divide-y divide-line rounded-xl border border-line text-[13px]">
            {([
              ["Reference no.", payment.reference ?? "—"],
              ["Sent from", payment.accountNumber ?? "—"],
              ["Amount they entered", peso(payment.amount)],
              ["Order total", peso(orderTotal)],
              ["Already approved", peso(alreadyPaid)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 px-3 py-2"><dt className="text-ink-3">{k}</dt><dd className="num text-right font-semibold text-ink">{v}</dd></div>
            ))}
          </dl>

          {mode === "check" ? (
            <>
              <Alert tone="info" compact title="How to check">
                Open the store&apos;s GCash app and find this reference number. Make sure the amount and sender match, then approve the amount that actually arrived.
              </Alert>
              <div>
                <label htmlFor="rv-amt" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Amount that arrived</label>
                <UnitInput id="rv-amt" prefix="₱" inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value.replace(/[^\d.]/g, ""))} />
                <p className="mt-1 text-[12px] text-ink-4">{after > 0 ? <>After approving, <b className="text-warn">{peso(after)}</b> is still owed. The customer is told the due date.</> : "After approving, the order is fully paid."}</p>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-[12.5px] font-semibold text-ink-2">Why doesn&apos;t it match? The customer sees this.</p>
              {REASONS.map((r) => (
                <label key={r} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-[12.5px] transition ${reason === r ? "border-bad/40 bg-bad-soft text-ink" : "border-line text-ink-2 hover:border-line-strong"}`}>
                  <input type="radio" name="reason" className="mt-0.5" checked={reason === r} onChange={() => setReason(r)} /> {r}
                </label>
              ))}
              <textarea value={REASONS.includes(reason) ? "" : reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300}
                placeholder="Or write your own reason" className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" />
              <Alert tone="warn" compact>The customer is notified and asked to send the payment again. Nothing is taken from what they already paid.</Alert>
            </div>
          )}
          {error && <Alert tone="bad" compact>{error}</Alert>}
        </div>
      </div>
    </Modal>
  );
}
