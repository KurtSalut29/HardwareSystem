"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

/**
 * Quantity in the cart: − and + for small changes, or type the amount straight
 * into the box (e.g. 50 bags). The typed amount is checked when the box loses
 * focus or Enter is pressed: whole numbers for pieces, and never more than is
 * in stock.
 */
export default function CartQty({ name, quantity, unit, max, step, onChange }: {
  name: string;
  quantity: number;
  unit: string;
  /** How many are in stock. */
  max: number;
  step: number;
  onChange: (qty: number) => void;
}) {
  const isKg = unit === "kg";
  const [draft, setDraft] = useState(String(quantity));
  const [note, setNote] = useState("");
  // When − or + changes the quantity, show the new amount in the box.
  const [shown, setShown] = useState(quantity);
  if (shown !== quantity) {
    setShown(quantity);
    setDraft(String(quantity));
  }

  function commit() {
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(n) || n <= 0) {
      setDraft(String(quantity));
      setNote(n === 0 && draft.trim() !== "" ? "To take it out, use Remove." : "");
      return;
    }
    let q = isKg ? Math.round(n * 100) / 100 : Math.round(n);
    let msg = !isKg && !Number.isInteger(n) ? "Whole numbers only." : "";
    if (q > max) { q = max; msg = `Only ${max} ${unit} in stock.`; }
    if (q <= 0) q = quantity;
    setNote(msg);
    setDraft(String(q));
    if (q !== quantity) onChange(q);
  }

  const btn = "grid size-8 shrink-0 place-items-center rounded-lg border border-line text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <button type="button" aria-label={`One less ${name}`} className={btn} disabled={quantity - step <= 0}
          onClick={() => { setNote(""); onChange(Math.round((quantity - step) * 100) / 100); }}>
          <Minus className="size-3.5" />
        </button>
        <label className="relative">
          <span className="sr-only">Quantity of {name}</span>
          <input
            type="text"
            inputMode={isKg ? "decimal" : "numeric"}
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(isKg ? /[^\d.]/g : /\D/g, "").slice(0, 7))}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            onFocus={(e) => e.target.select()}
            className={`num h-8 w-14 rounded-lg border border-line bg-surface text-center text-[13.5px] font-semibold text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${isKg ? "pr-5" : ""}`}
          />
          {isKg && <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-4">kg</span>}
        </label>
        <button type="button" aria-label={`One more ${name}`} className={btn} disabled={quantity + step > max + 1e-9}
          onClick={() => { setNote(""); onChange(Math.round((quantity + step) * 100) / 100); }}>
          <Plus className="size-3.5" />
        </button>
      </div>
      {note && <p className="text-[11px] font-medium text-warn">{note}</p>}
    </div>
  );
}
