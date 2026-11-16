"use client";

import { useRef, useState } from "react";
import { Camera, RefreshCw, CheckCircle2, Banknote } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { compressImage, uploadImage } from "@/lib/image";
import Alert from "@/components/ui/Alert";

/**
 * The driver's last step: take a photo of the items at the drop-off (with the
 * customer or at their door), then mark the order delivered. The photo is the
 * proof of delivery staff and the customer see on the order afterwards.
 */
export default function ProofOfDeliveryModal({ orderId, customer, collect, onClose, onDelivered }: {
  orderId: number;
  customer: string;
  /** Cash still to collect at the door, if any. */
  collect?: number;
  onClose: () => void;
  onDelivered: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState<"" | "processing" | "saving">("");
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(""); setBusy("processing");
    try {
      const blob = await compressImage(file);
      if (preview) URL.revokeObjectURL(preview);
      setPhoto(blob);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that photo.");
    }
    setBusy("");
  }

  async function confirm() {
    if (!photo) return;
    setError(""); setBusy("saving");
    try {
      const url = await uploadImage(photo, `proof-order-${orderId}.jpg`);
      const res = await fetch("/api/orders", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: "delivered", proofImage: url }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't mark the order delivered.");
      onDelivered();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy("");
    }
  }

  return (
    <Modal open onClose={busy === "saving" ? () => {} : onClose} title={`Proof of delivery — Order #${orderId}`} icon={<Camera className="size-5" />}
      description="Take a photo at the drop-off to finish this delivery." size="md"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy === "saving"}>Cancel</Button>
          <Button variant="success" className="flex-1" disabled={!photo || busy === "processing"} loading={busy === "saving"}
            icon={<CheckCircle2 className="size-4" />} onClick={confirm}>
            Mark delivered
          </Button>
        </div>
      }>
      <div className="space-y-4">
        {collect != null && collect > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-good-soft px-4 py-3">
            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-good"><Banknote className="size-4" /> Collect before you leave</span>
            <span className="num font-display text-[20px] font-extrabold text-good">₱{collect.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
          </div>
        )}

        <p className="text-[13.5px] leading-relaxed text-ink-2">
          Photograph the items at the drop-off — with <b className="text-ink">{customer}</b> or at their door. The photo is saved with the order as proof.
        </p>

        <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} aria-label="Delivery photo" />

        {preview ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not a served image */}
            <img src={preview} alt="Delivery photo preview" className="max-h-72 w-full rounded-2xl border border-line bg-subtle object-contain" />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={!!busy}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-line text-[13px] font-semibold text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink">
              <RefreshCw className="size-4" /> Retake photo
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={!!busy}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-subtle py-10 transition hover:border-brand hover:bg-brand-soft/40">
            <span className="grid size-14 place-items-center rounded-2xl bg-brand text-white shadow-[0_10px_22px_-12px_rgba(30,79,216,0.9)]">
              <Camera className="size-6" />
            </span>
            <span className="text-[15px] font-semibold text-ink">{busy === "processing" ? "Preparing photo…" : "Take photo"}</span>
            <span className="text-[12px] text-ink-4">Opens the camera on your phone</span>
          </button>
        )}

        {error && <Alert tone="bad" compact>{error}</Alert>}
      </div>
    </Modal>
  );
}
