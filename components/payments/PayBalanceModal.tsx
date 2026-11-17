"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import GcashPayFields, { EMPTY_GCASH, gcashProblem, type GcashDraft } from "@/components/payments/GcashPayFields";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A customer pays the rest of an order by GCash, with the receipt. Staff check it like any payment. */
export default function PayBalanceModal({ orderId, balance, pending, dueAt, onClose, onDone }: {
  orderId: number;
  balance: number;
  /** Payments already sent and still being checked. */
  pending: number;
  dueAt: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const max = Math.max(0, Math.round((balance - pending) * 100) / 100);
  const [draft, setDraft] = useState<GcashDraft>({ ...EMPTY_GCASH, amount: max ? String(max) : "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const problem = gcashProblem(draft, 1, max);

  async function send() {
    if (problem) { setError(problem); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, amount: Number(draft.amount), reference: draft.reference, accountNumber: draft.accountNumber, proofImage: draft.proofImage }),
    });
    setSaving(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Couldn't send your payment. Try again."); return; }
    onDone(`Payment of ${peso(Number(draft.amount))} sent for checking. We'll notify you when the store approves it.`);
  }

  return (
    <Modal open onClose={onClose} size="md" icon={<Wallet className="size-5" />}
      title={`Pay balance — Order #${orderId}`}
      description={`You owe ${peso(balance)}${dueAt ? `, due ${new Date(dueAt).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}` : ""}.`}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" loading={saving} disabled={!!problem || max <= 0} onClick={send}>Send for checking</Button>
        </div>
      }>
      <div className="space-y-4">
        {pending > 0 && <Alert tone="info" compact>{peso(pending)} you sent earlier is still being checked. You can send up to {peso(max)} more.</Alert>}
        {max <= 0 ? (
          <Alert tone="good" compact>Everything you owe has been sent. The store is checking it now.</Alert>
        ) : (
          <GcashPayFields value={draft} onChange={setDraft} payTo={Number(draft.amount) || max} amountHint={`Up to ${peso(max)}. You can pay part now and the rest later.`} />
        )}
        <p className="text-[12px] text-ink-4">The store checks your receipt, then updates your balance. You&apos;ll get a notification either way.</p>
        {error && <Alert tone="bad" compact>{error}</Alert>}
      </div>
    </Modal>
  );
}
