"use client";

import { useEffect, useState } from "react";
import { Ban, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

type Quote = { allowed: boolean; reason: string | null; by: "customer" | "store"; paid: number; fee: number; refund: number; pendingReview: number; policy: string };

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STORE_REASONS = ["Out of stock", "Customer asked to cancel", "Can't deliver to that location", "Payment never arrived"];

/**
 * Cancelling an order, with the money spelled out first: what was paid, any
 * fee under the store's policy, and what comes back. Staff must give a reason
 * (the customer sees it).
 */
export default function CancelOrderModal({ orderId, onClose, onDone }: {
  orderId: number;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetch(`/api/orders/cancel?id=${orderId}`).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!live) return;
      if (!r.ok) setLoadError(d.error ?? "Couldn't check this order."); else setQuote(d);
    }).catch(() => { if (live) setLoadError("Couldn't reach the server."); });
    return () => { live = false; };
  }, [orderId]);

  const store = quote?.by === "store";

  async function cancel() {
    if (store && !reason.trim()) { setError("Choose or write the reason. The customer will see it."); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/orders/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: orderId, reason }) });
    setSaving(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Couldn't cancel the order."); return; }
    const back = d.refund > 0
      ? store ? ` A ${peso(d.refund)} refund was added to "Refunds to send".` : ` Your ${peso(d.refund)} refund is being prepared — we'll notify you when it's sent.`
      : "";
    onDone(`Order #${orderId} cancelled. Its items are back in stock.${back}`);
  }

  return (
    <Modal open onClose={onClose} size="md" icon={<Ban className="size-5" />} title={`Cancel Order #${orderId}?`}
      description={store ? "The customer is notified with your reason." : "Check what happens to your payment first."}
      footer={quote?.allowed ? (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Keep the order</Button>
          <Button variant="danger" className="flex-1" loading={saving} onClick={cancel}>Cancel order</Button>
        </div>
      ) : (
        <Button variant="secondary" className="w-full" onClick={onClose}>Close</Button>
      )}>
      {!quote && !loadError && <div className="grid h-32 place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>}
      {loadError && <Alert tone="bad" compact>{loadError}</Alert>}
      {quote && !quote.allowed && <Alert tone="warn" compact title="This order can't be cancelled here">{quote.reason}</Alert>}
      {quote?.allowed && (
        <div className="space-y-4">
          <dl className="divide-y divide-line rounded-xl border border-line text-[13.5px]">
            <div className="flex justify-between px-3.5 py-2.5"><dt className="text-ink-3">Paid and approved</dt><dd className="num font-semibold text-ink">{peso(quote.paid)}</dd></div>
            {quote.fee > 0 && <div className="flex justify-between px-3.5 py-2.5"><dt className="text-ink-3">Cancellation fee (store policy)</dt><dd className="num font-semibold text-bad">− {peso(quote.fee)}</dd></div>}
            <div className="flex justify-between bg-subtle px-3.5 py-2.5"><dt className="font-semibold text-ink">{store ? "To refund the customer" : "You get back"}</dt><dd className="num font-bold text-good">{peso(quote.refund)}</dd></div>
          </dl>
          {quote.pendingReview > 0 && (
            <Alert tone="info" compact>{peso(quote.pendingReview)} {store ? "the customer sent" : "you sent"} is still being checked. If it&apos;s approved, it&apos;s refunded in full.</Alert>
          )}
          {quote.refund > 0 && (
            <Alert tone="info" compact>{store
              ? "After cancelling, send the refund from \"Refunds to send\" and record its reference."
              : "The store sends refunds to the GCash number you paid from, or in cash at the store. You'll be notified when it's sent."}</Alert>
          )}
          {!store && <p className="whitespace-pre-line rounded-xl bg-subtle px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-3">{quote.policy}</p>}
          {store && (
            <div className="space-y-2">
              <p className="text-[12.5px] font-semibold text-ink-2">Reason (the customer sees this)</p>
              <div className="flex flex-wrap gap-1.5">
                {STORE_REASONS.map((r) => (
                  <button key={r} type="button" onClick={() => setReason(r)}
                    className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${reason === r ? "border-bad/40 bg-bad-soft text-bad" : "border-line text-ink-2 hover:border-line-strong"}`}>{r}</button>
                ))}
              </div>
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Or write the reason"
                className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" />
            </div>
          )}
          <Alert tone="warn" compact>Cancelling can&apos;t be undone. The items go back on the shelf.</Alert>
          {error && <Alert tone="bad" compact>{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}
