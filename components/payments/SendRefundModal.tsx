"use client";

import { useRef, useState } from "react";
import { Banknote, ImagePlus, Loader2, Smartphone, Undo2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import type { PaymentRow } from "@/components/payments/PaymentHistory";
import { compressImage } from "@/lib/image";
import { limitPhoneInput } from "@/lib/validation";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const FIELD = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-4 transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

/**
 * Staff record a refund they handed over: by GCash (the customer's number, the
 * reference of the transfer, optionally its screenshot) or in cash at the store.
 * The system can't send money itself — this records that the store did.
 */
export default function SendRefundModal({ refund, orderId, customer, onClose, onDone }: {
  refund: PaymentRow;
  orderId: number;
  customer: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [method, setMethod] = useState<"GCash" | "Cash">(refund.method === "Cash" ? "Cash" : "GCash");
  const [number, setNumber] = useState(refund.accountNumber ?? "");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true); setError("");
    try {
      const blob = await compressImage(file, 1600, 0.8);
      const fd = new FormData();
      fd.append("file", new File([blob], "refund.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/payments/proof", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.url) throw new Error(d.error ?? "Couldn't upload the screenshot.");
      setProof(d.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload the screenshot.");
    } finally { setUploading(false); }
  }

  async function save() {
    setError("");
    if (method === "GCash" && !/^09\d{9}$/.test(number)) { setError("Enter the customer's 11-digit GCash number."); return; }
    if (method === "GCash" && !/^\d{13}$/.test(reference)) { setError("Enter the 13-digit reference number of the refund you sent."); return; }
    setSaving(true);
    const res = await fetch("/api/payments", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: refund.id, action: "refund_sent", method, accountNumber: number, reference, proofImage: proof }),
    });
    setSaving(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Couldn't record the refund."); return; }
    onDone(`Refund of ${peso(refund.amount)} recorded as sent. ${customer} was notified${d.emailed ? " and emailed" : ""}.`);
  }

  return (
    <Modal open onClose={onClose} size="md" icon={<Undo2 className="size-5" />}
      title={`Send refund — Order #${orderId}`}
      description={`${customer} is owed ${peso(refund.amount)} for this cancelled order.`}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Not yet</Button>
          <Button className="flex-1" loading={saving} onClick={save}>I sent {peso(refund.amount)}</Button>
        </div>
      }>
      <div className="space-y-4">
        {refund.note && <Alert tone="info" compact>{refund.note}</Alert>}
        <div className="grid grid-cols-2 gap-2">
          {([["GCash", Smartphone, "Sent by GCash"], ["Cash", Banknote, "Handed over in cash"]] as const).map(([m, Icon, label]) => (
            <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m}
              className={`flex items-center gap-2 rounded-xl border p-3 text-[13px] font-semibold transition ${method === m ? "border-brand bg-brand-soft text-brand-ink ring-2 ring-brand/15" : "border-line text-ink-2 hover:border-brand/40"}`}>
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>

        {method === "GCash" ? (
          <>
            <Alert tone="info" compact>Send {peso(refund.amount)} from the store&apos;s GCash first, then fill this in from your GCash receipt.</Alert>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="rf-num" className="mb-1 block text-[12.5px] font-semibold text-ink-2">Customer&apos;s GCash number</label>
                <input id="rf-num" inputMode="numeric" value={number} onChange={(e) => setNumber(limitPhoneInput(e.target.value))} maxLength={13} className={`${FIELD} num`} placeholder="09171234567" />
              </div>
              <div>
                <label htmlFor="rf-ref" className="mb-1 block text-[12.5px] font-semibold text-ink-2">Reference no. of your transfer</label>
                <input id="rf-ref" inputMode="numeric" value={reference} onChange={(e) => setReference(e.target.value.replace(/\D/g, "").slice(0, 13))} className={`${FIELD} num`} placeholder="13 digits" />
              </div>
            </div>
            <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
            <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={uploading}
              icon={uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}>
              {proof ? "Screenshot attached — replace" : "Attach the GCash screenshot (optional)"}
            </Button>
          </>
        ) : (
          <Alert tone="info" compact>Hand {peso(refund.amount)} to the customer, then record it here. They&apos;ll see it in their Transactions.</Alert>
        )}
        {error && <Alert tone="bad" compact>{error}</Alert>}
      </div>
    </Modal>
  );
}
