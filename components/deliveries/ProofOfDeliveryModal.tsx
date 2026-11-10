"use client";

import { useRef, useState } from "react";
import { Camera, RefreshCw, CheckCircle2, Banknote } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { compressImage, uploadImage } from "@/lib/image";
import { ICON_SIZE } from "@/lib/constants/icon-size";

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
    <Modal open onClose={busy === "saving" ? () => {} : onClose} title={`Proof of delivery — Order #${orderId}`} size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Take a clear photo of the items at the drop-off — with <b>{customer}</b> or at their door. It is saved with the order as proof it was delivered.
        </p>

        {collect != null && collect > 0 && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--good-soft)", color: "var(--good)" }}>
            <Banknote size={ICON_SIZE.sm} /> Collect <b className="num">₱{collect.toFixed(2)}</b> before you leave.
          </div>
        )}

        <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} aria-label="Delivery photo" />

        {preview ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not a served image */}
            <img src={preview} alt="Delivery photo preview" className="w-full max-h-72 object-contain rounded-xl border border-gray-200 bg-gray-50" />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={!!busy}
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg text-gray-600 bg-gray-100 hover:bg-gray-200 transition">
              <RefreshCw size={ICON_SIZE.xs} /> Retake photo
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={!!busy}
            className="w-full rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/40 py-10 flex flex-col items-center gap-2 transition">
            <span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>
              <Camera size={ICON_SIZE.lg} />
            </span>
            <span className="text-sm font-semibold text-gray-800">{busy === "processing" ? "Preparing photo…" : "Take photo"}</span>
            <span className="text-[11px] text-gray-400">Opens the camera on your phone</span>
          </button>
        )}

        {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy === "saving"}>Cancel</Button>
          <Button className="flex-1" style={{ background: "var(--good)" }} disabled={!photo || busy === "processing"} loading={busy === "saving"}
            icon={<CheckCircle2 size={ICON_SIZE.sm} />} onClick={confirm}>
            Mark delivered
          </Button>
        </div>
      </div>
    </Modal>
  );
}
