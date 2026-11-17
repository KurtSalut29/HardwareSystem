"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Check, Copy, ImagePlus, Loader2, QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import { compressImage } from "@/lib/image";
import { useSettings } from "@/lib/useSettings";
import { limitPhoneInput } from "@/lib/validation";

export type GcashDraft = { accountNumber: string; reference: string; amount: string; proofImage: string | null };
export const EMPTY_GCASH: GcashDraft = { accountNumber: "", reference: "", amount: "", proofImage: null };

export const GCASH_NUMBER_RE = /^09\d{9}$/;
export const GCASH_REFERENCE_RE = /^\d{13}$/;
const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** What's still missing before this GCash payment can be sent, in plain words (null = ready). */
export function gcashProblem(d: GcashDraft, min: number, max: number): string | null {
  const amount = Number(d.amount);
  if (!d.proofImage) return "Upload the screenshot of your GCash receipt.";
  if (!GCASH_REFERENCE_RE.test(d.reference)) return "Enter the 13-digit reference number from your GCash receipt.";
  if (!GCASH_NUMBER_RE.test(d.accountNumber)) return "Enter the GCash number you paid from (11 digits, starts with 09).";
  if (!d.amount || !Number.isFinite(amount) || amount <= 0) return "Enter how much you sent.";
  if (amount + 0.01 < min) return `Send at least ${peso(min)}.`;
  if (amount > max + 0.01) return `The most to send is ${peso(max)}.`;
  return null;
}

const FIELD = "h-10 w-full rounded-xl border bg-surface px-3 text-sm text-ink placeholder:text-ink-4 shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:outline-none focus:ring-4";

/**
 * The store's GCash details (QR and number) and the four things the customer
 * fills in after paying: the screenshot, reference number, their number and the
 * amount. Shared by checkout and "Pay balance".
 */
export default function GcashPayFields({ value, onChange, amountHint, payTo }: {
  value: GcashDraft;
  onChange: (next: GcashDraft) => void;
  /** e.g. "At least ₱500 (50%) — up to ₱1,000" */
  amountHint: React.ReactNode;
  /** How much to send, shown in the heading. */
  payTo: number;
}) {
  const s = useSettings();
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<GcashDraft>) => onChange({ ...value, ...patch });

  async function copy() {
    if (!s.gcashNumber) return;
    try { await navigator.clipboard.writeText(s.gcashNumber); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the number is on screen */ }
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setUploadError("");
    if (!file.type.startsWith("image/")) { setUploadError("Choose a screenshot or photo of the receipt."); return; }
    setUploading(true);
    try {
      const blob = await compressImage(file, 1600, 0.8);
      const fd = new FormData();
      fd.append("file", new File([blob], "gcash-receipt.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/payments/proof", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.url) throw new Error(d.error ?? "Couldn't upload the screenshot.");
      set({ proofImage: d.url });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Couldn't upload the screenshot. Try again.");
    } finally {
      setUploading(false);
    }
  }

  const badRef = value.reference !== "" && !GCASH_REFERENCE_RE.test(value.reference);
  const badNum = value.accountNumber !== "" && value.accountNumber.length >= 11 && !GCASH_NUMBER_RE.test(value.accountNumber);

  if (!s.gcashNumber && !s.gcashQr) {
    return <p className="rounded-xl bg-warn-soft px-3.5 py-3 text-[12.5px] text-warn">The store hasn&apos;t set up its GCash details yet. Choose cash, or contact the store.</p>;
  }

  return (
    <div className="space-y-3.5">
      {/* Step 1: pay */}
      <div className="rounded-2xl border border-brand/25 bg-brand-soft/50 p-3.5">
        <p className="flex items-center gap-2 text-[13px] font-bold text-brand-ink">
          <span className="grid size-6 place-items-center rounded-full bg-brand text-[11px] text-white">1</span>
          Send {peso(payTo)} in your GCash app
        </p>
        <div className="mt-3 flex items-center gap-3">
          {s.gcashQr && (
            <div className="relative size-28 shrink-0 overflow-hidden rounded-xl border border-brand/25 bg-surface">
              <Image src={s.gcashQr} alt="Store GCash QR code" fill sizes="112px" className="object-contain p-1" unoptimized />
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand-ink/80"><QrCode className="mr-1 inline size-3.5" />Scan, or send to</p>
            <p className="truncate text-[14px] font-bold text-ink">{s.gcashName || s.storeName}</p>
            {s.gcashNumber && (
              <button type="button" onClick={copy} className="num inline-flex items-center gap-1.5 text-[15px] font-bold text-brand hover:underline">
                {s.gcashNumber} {copied ? <Check className="size-3.5 text-good" /> : <Copy className="size-3.5" />}
              </button>
            )}
            <p className="text-[11px] text-ink-3">{copied ? "Number copied." : "Tap the number to copy it."}</p>
          </div>
        </div>
      </div>

      {/* Step 2: proof */}
      <div className="rounded-2xl border border-line p-3.5">
        <p className="flex items-center gap-2 text-[13px] font-bold text-ink">
          <span className="grid size-6 place-items-center rounded-full bg-ink text-[11px] text-surface">2</span>
          Upload your receipt and fill in its details
        </p>

        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        <div className="mt-3">
          {value.proofImage ? (
            <div className="flex items-center gap-3 rounded-xl border border-good/30 bg-good-soft/60 p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- private image served with the user's session */}
              <img src={value.proofImage} alt="Your GCash receipt" className="size-16 rounded-lg border border-line bg-surface object-cover" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-good"><ShieldCheck className="size-4" /> Receipt uploaded</p>
                <p className="text-[11.5px] text-ink-3">Only the store can see it.</p>
              </div>
              <button type="button" onClick={() => input.current?.click()} disabled={uploading}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12px] font-semibold text-ink-2 hover:border-brand/40">
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Change
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => input.current?.click()} disabled={uploading}
              className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-line-strong bg-subtle py-6 transition hover:border-brand hover:bg-brand-soft/40">
              {uploading ? <Loader2 className="size-6 animate-spin text-brand" /> : <ImagePlus className="size-6 text-brand" />}
              <span className="text-[13.5px] font-semibold text-ink">{uploading ? "Uploading…" : "Upload GCash receipt screenshot"}</span>
              <span className="text-[11.5px] text-ink-4">The confirmation screen GCash shows after you pay</span>
            </button>
          )}
          {uploadError && <p className="mt-1.5 text-[12px] font-medium text-bad">{uploadError}</p>}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="gc-ref" className="mb-1 block text-[12px] font-semibold text-ink-2">Reference number (Ref. No.)</label>
            <input id="gc-ref" inputMode="numeric" value={value.reference} placeholder="13 digits, e.g. 1012345678901"
              onChange={(e) => set({ reference: e.target.value.replace(/\D/g, "").slice(0, 13) })}
              className={`${FIELD} num ${badRef ? "border-bad/50 focus:ring-bad/10" : "border-line focus:border-brand focus:ring-brand/10"}`} />
            <p className={`mt-1 text-[11px] ${badRef ? "text-bad" : "text-ink-4"}`}>{badRef ? `${value.reference.length}/13 digits` : "Printed on your receipt as “Ref. No.”"}</p>
          </div>
          <div>
            <label htmlFor="gc-num" className="mb-1 block text-[12px] font-semibold text-ink-2">Your GCash number</label>
            <input id="gc-num" inputMode="numeric" value={value.accountNumber} placeholder="09171234567" maxLength={13}
              onChange={(e) => set({ accountNumber: limitPhoneInput(e.target.value) })}
              className={`${FIELD} num ${badNum ? "border-bad/50 focus:ring-bad/10" : "border-line focus:border-brand focus:ring-brand/10"}`} />
            <p className="mt-1 text-[11px] text-ink-4">Refunds, if any, go back here.</p>
          </div>
          <div>
            <label htmlFor="gc-amt" className="mb-1 block text-[12px] font-semibold text-ink-2">Amount you sent</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-3">₱</span>
              <input id="gc-amt" inputMode="decimal" value={value.amount} placeholder={payTo.toFixed(2)}
                onChange={(e) => set({ amount: e.target.value.replace(/[^\d.]/g, "").slice(0, 10) })}
                className={`${FIELD} num border-line pl-7 focus:border-brand focus:ring-brand/10`} />
            </div>
            <p className="mt-1 text-[11px] text-ink-4">{amountHint}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
