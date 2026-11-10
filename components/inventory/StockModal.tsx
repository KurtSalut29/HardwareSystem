"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, SlidersHorizontal, ArrowRight } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { ADJUST_REASONS } from "@/lib/stock";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type P = { id: number; name: string; unit: string; stock: number };

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition bg-white";
const fmt = (n: number) => String(Math.round(n * 100) / 100);

/**
 * The two ways a product's stock changes by hand:
 *  - Add inventory: a purchase from a supplier, recorded on the Restocks page
 *    with its cost (this is what EOQ learns the unit cost from).
 *  - Adjust stock: damaged, lost, returned, or a correction after counting,
 *    recorded with a reason.
 */
export default function StockModal({ product, onClose, onAdjusted }: { product: P; onClose: () => void; onAdjusted: () => void }) {
  const router = useRouter();
  const showToast = useToast();
  const [view, setView] = useState<"choose" | "adjust">("choose");
  const [mode, setMode] = useState<"change" | "set">("change");
  const [direction, setDirection] = useState<"remove" | "add">("remove");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState<string>("Damaged");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const n = Number(value);
  const valid = value !== "" && Number.isFinite(n) && n >= 0;
  const after = !valid ? null : mode === "set" ? n : direction === "add" ? product.stock + n : product.stock - n;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) { setError("Enter a quantity"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/stock-adjustments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, mode, value: mode === "set" ? n : direction === "add" ? n : -n, reason, note }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Couldn't save"); return; }
    const row = await res.json();
    showToast(`${product.name}: stock ${row.change > 0 ? "+" : ""}${fmt(row.change)} ${product.unit} (${reason})`);
    onAdjusted();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={view === "choose" ? `Stock — ${product.name}` : `Adjust stock — ${product.name}`} size="md">
      <div className="space-y-4">
        <div className="rounded-xl px-4 py-3 flex items-baseline justify-between" style={{ background: "var(--bg-muted)" }}>
          <span className="text-xs text-gray-500">On hand now</span>
          <span className="font-display text-xl font-extrabold text-gray-900 num">{fmt(product.stock)} <span className="text-sm font-semibold text-gray-400">{product.unit}</span></span>
        </div>

        {view === "choose" ? (
          <div className="grid gap-2.5">
            <button onClick={() => router.push(`/restocks?product=${product.id}`)}
              className="text-left rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 p-4 flex items-start gap-3 transition group">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><PackagePlus size={ICON_SIZE.md} /></span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-gray-900">Add inventory</span>
                <span className="block text-xs text-gray-500 mt-0.5">Stock bought from a supplier. Recorded on the Restocks page with its cost, which the EOQ uses.</span>
              </span>
              <ArrowRight size={ICON_SIZE.sm} className="text-gray-300 group-hover:text-blue-500 mt-1" />
            </button>
            <button onClick={() => setView("adjust")}
              className="text-left rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 p-4 flex items-start gap-3 transition group">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-gray-100 text-gray-600"><SlidersHorizontal size={ICON_SIZE.md} /></span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-gray-900">Adjust stock</span>
                <span className="block text-xs text-gray-500 mt-0.5">Damaged, lost, returned, or the shelf count doesn&apos;t match. Saved with a reason.</span>
              </span>
              <ArrowRight size={ICON_SIZE.sm} className="text-gray-300 group-hover:text-blue-500 mt-1" />
            </button>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs font-semibold">
              {([["change", "Add or remove"], ["set", "Set counted total"]] as const).map(([m, label]) => (
                <button key={m} type="button" onClick={() => { setMode(m); if (m === "set") setReason("Count correction"); }}
                  className="flex-1 px-2.5 py-1.5 rounded-md transition"
                  style={mode === m ? { background: "var(--brand)", color: "#fff" } : { color: "var(--text-muted)" }}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-end">
              {mode === "change" && (
                <div>
                  <label htmlFor="adj-dir" className="block text-xs font-medium text-gray-600 mb-1">Change</label>
                  <select id="adj-dir" value={direction} onChange={(e) => setDirection(e.target.value as "add" | "remove")} className={inputCls}>
                    <option value="remove">Remove −</option>
                    <option value="add">Add +</option>
                  </select>
                </div>
              )}
              <div className="flex-1">
                <label htmlFor="adj-qty" className="block text-xs font-medium text-gray-600 mb-1">
                  {mode === "set" ? "Counted on the shelf" : "Quantity"} <span className="text-gray-400">({product.unit})</span>
                </label>
                <input id="adj-qty" type="number" min="0" step="any" required autoFocus value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} placeholder="0" />
              </div>
            </div>

            {after != null && (
              <p className="text-xs text-gray-600">
                Stock becomes <b className={after < 0 ? "text-red-600" : "text-gray-900"}>{fmt(after)} {product.unit}</b>
                {" "}({after - product.stock >= 0 ? "+" : ""}{fmt(after - product.stock)})
                {after < 0 && <span className="text-red-600"> — can&apos;t go below zero</span>}
              </p>
            )}

            <div>
              <label htmlFor="adj-reason" className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
              <select id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
                {ADJUST_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="adj-note" className="block text-xs font-medium text-gray-600 mb-1">Note <span className="text-gray-400">{reason === "Other" ? "(required)" : "(optional)"}</span></label>
              <input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="e.g. 2 bags got wet in the rain" maxLength={200} />
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setView("choose")}>Back</Button>
              <Button type="submit" className="flex-1" loading={saving} disabled={after == null || after < 0}>Save adjustment</Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
