"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, PackagePlus, Sparkles } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import type { ReorderRow } from "@/lib/inventory";
import { ICON_SIZE } from "@/lib/constants/icon-size";

export type RestockProduct = { id: number; name: string; unit: string; stock: number; category: { id: number; name: string } | null };
type Category = { id: number; name: string };

export type Line = {
  key: number;
  productId: string;
  quantity: string;
  unitCost: string;
  /** Set when this line adds a product that isn't in the system yet. */
  newProduct?: { name: string; categoryId: string; unit: string; price: string };
};

const UNITS = ["pc", "kg", "g", "meter", "ft", "bag", "pack", "box", "roll", "bundle", "pair", "set", "sheet", "liter", "gallon", "length", "sack"];
const inputCls = "w-full border border-line rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition bg-surface";
const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

let nextKey = 1;
export function newLine(partial: Partial<Line> = {}): Line {
  return { key: nextKey++, productId: "", quantity: "", unitCost: "", ...partial };
}

/** A line pre-filled from the reorder plan: the EOQ quantity and the last price paid. */
export function lineFromPlan(row: ReorderRow): Line {
  return newLine({
    productId: String(row.productId),
    quantity: row.eoq != null ? String(row.eoq) : "",
    unitCost: row.costSource === "restock" ? String(row.unitCost) : "",
  });
}

/**
 * Records one supplier delivery: who it came from, the delivery receipt (DR)
 * number, and every product on it. A product not in the system yet can be added
 * right here, so the delivery doesn't have to wait for a trip to Products.
 */
export default function RestockModal({ open, initialLines, products, categories, planBy, onClose, onSaved }: {
  open: boolean;
  initialLines: Line[];
  products: RestockProduct[];
  categories: Category[];
  planBy: Map<number, ReorderRow>;
  onClose: () => void;
  onSaved: (summary: { lines: number; total: number }) => void;
}) {
  const [lines, setLines] = useState<Line[]>(initialLines);
  const [supplierName, setSupplierName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [wasOpen, setWasOpen] = useState(false);

  // Start fresh, from the lines handed in, each time the modal opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLines(initialLines.length ? initialLines : [newLine()]);
      setSupplierName(""); setReferenceNo(""); setNote(""); setError("");
    }
  }

  const byCategory = useMemo(() => {
    const groups = new Map<string, RestockProduct[]>();
    for (const p of products) {
      const key = p.category?.name ?? "Uncategorized";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({ category, items: [...items].sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [products]);

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const updateNew = (key: number, patch: Partial<NonNullable<Line["newProduct"]>>) =>
    setLines((ls) => ls.map((l) => (l.key === key && l.newProduct ? { ...l, newProduct: { ...l.newProduct, ...patch } } : l)));
  const remove = (key: number) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  const lineTotal = (l: Line) => (Number(l.quantity) > 0 && Number(l.unitCost) >= 0 ? Number(l.quantity) * Number(l.unitCost) : 0);
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  const chosen = new Set(lines.map((l) => l.productId).filter(Boolean));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/restocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierName, referenceNo, note,
        items: lines.map((l) => ({
          productId: l.newProduct ? undefined : Number(l.productId),
          quantity: Number(l.quantity),
          unitCost: l.unitCost === "" ? "" : Number(l.unitCost),
          newProduct: l.newProduct ? { ...l.newProduct, categoryId: Number(l.newProduct.categoryId), price: Number(l.newProduct.price) } : undefined,
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "Failed to record the delivery"); return; }
    onSaved({ lines: lines.length, total });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a supplier delivery"
      size="xl"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-ink-3 mr-auto">
            {lines.length} product{lines.length === 1 ? "" : "s"} · <span className="font-bold text-ink text-sm num">{peso(total)}</span>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="restock-form" loading={saving}>Save delivery</Button>
        </div>
      }
    >
      <form id="restock-form" onSubmit={save} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="rs-supplier" className="block text-xs font-medium text-ink-2 mb-1">Supplier <span className="text-ink-4">(optional)</span></label>
            <input id="rs-supplier" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={inputCls} placeholder="e.g. ABC Steel Supply" />
          </div>
          <div>
            <label htmlFor="rs-ref" className="block text-xs font-medium text-ink-2 mb-1">DR / receipt no. <span className="text-ink-4">(optional)</span></label>
            <input id="rs-ref" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className={inputCls} placeholder="e.g. DR-10482" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-ink-2">Products on this delivery</p>
            <p className="text-[11px] text-ink-4">Quantity × unit cost (what you paid per unit)</p>
          </div>
          <ul className="space-y-2">
            {lines.map((l, i) => {
              const product = products.find((p) => String(p.id) === l.productId);
              const plan = product ? planBy.get(product.id) : undefined;
              const unit = l.newProduct ? l.newProduct.unit : product?.unit;
              return (
                <li key={l.key} className="rounded-xl border border-line p-2.5 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 mt-2 rounded-full bg-recess text-[10px] font-bold text-ink-3 flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0 space-y-2">
                      {l.newProduct ? (
                        <div className="rounded-lg p-2 space-y-2 bg-info-soft">
                          <p className="text-[11px] font-semibold flex items-center gap-1 text-brand"><Sparkles size={11} /> New product — added to Products with this delivery</p>
                          <input aria-label="New product name" required value={l.newProduct.name} onChange={(e) => updateNew(l.key, { name: e.target.value })} className={inputCls} placeholder="Product name" />
                          <div className="grid grid-cols-3 gap-2">
                            <select aria-label="Category" required value={l.newProduct.categoryId} onChange={(e) => updateNew(l.key, { categoryId: e.target.value })} className={inputCls}>
                              <option value="">Category</option>
                              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select aria-label="Unit" value={l.newProduct.unit} onChange={(e) => updateNew(l.key, { unit: e.target.value })} className={inputCls}>
                              {UNITS.map((u) => <option key={u} value={u}>per {u}</option>)}
                            </select>
                            <input aria-label="Selling price" required type="number" min="0" step="0.01" value={l.newProduct.price} onChange={(e) => updateNew(l.key, { price: e.target.value })} className={inputCls} placeholder="Sell ₱" />
                          </div>
                        </div>
                      ) : (
                        <select aria-label={`Product, line ${i + 1}`} required value={l.productId}
                          onChange={(e) => {
                            const p = planBy.get(Number(e.target.value));
                            update(l.key, { productId: e.target.value, unitCost: l.unitCost || (p?.costSource === "restock" ? String(p.unitCost) : "") });
                          }}
                          className={inputCls}>
                          <option value="">Select a product</option>
                          {byCategory.map(({ category, items }) => (
                            <optgroup key={category} label={category}>
                              {items.map((p) => (
                                <option key={p.id} value={p.id} disabled={chosen.has(String(p.id)) && String(p.id) !== l.productId}>
                                  {p.name} — {p.stock} {p.unit} in stock
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      )}
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                        <div className="relative">
                          <input aria-label={`Quantity, line ${i + 1}`} required type="number" step="0.01" min="0.01" value={l.quantity}
                            onChange={(e) => update(l.key, { quantity: e.target.value })} className={`${inputCls} pr-10`} placeholder="Qty" />
                          {unit && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-4 pointer-events-none">{unit}</span>}
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-4 pointer-events-none">₱</span>
                          <input aria-label={`Unit cost, line ${i + 1}`} required type="number" step="0.01" min="0" value={l.unitCost}
                            onChange={(e) => update(l.key, { unitCost: e.target.value })} className={`${inputCls} pl-6`} placeholder="Unit cost" />
                        </div>
                        <span className="text-sm font-semibold text-ink num w-[92px] text-right">{peso(lineTotal(l))}</span>
                      </div>
                      {plan && (
                        <p className="text-[11px] text-ink-3 flex flex-wrap items-center gap-x-2">
                          {plan.eoq != null ? <>EOQ suggests <b>{plan.eoq} {plan.unit}</b></> : <>No sales yet, no EOQ suggestion</>}
                          <span className="text-ink-4">·</span> reorder at {plan.reorderPoint}
                          {plan.costSource === "restock" && <><span className="text-ink-4">·</span> last paid {peso(plan.unitCost)}</>}
                          {plan.eoq != null && l.quantity !== String(plan.eoq) && (
                            <button type="button" className="font-semibold hover:underline text-brand"
                              onClick={() => update(l.key, { quantity: String(plan.eoq) })}>Use {plan.eoq}</button>
                          )}
                        </p>
                      )}
                    </div>
                    <button type="button" onClick={() => remove(l.key)} disabled={lines.length === 1} aria-label={`Remove line ${i + 1}`}
                      className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-bad transition hover:bg-bad-soft disabled:opacity-30 disabled:hover:bg-transparent">
                      <Trash2 className="size-3.5" /> Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" onClick={() => setLines((ls) => [...ls, newLine()])}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-brand bg-brand-soft hover:bg-brand-soft transition">
              <Plus size={ICON_SIZE.xs} /> Add another product
            </button>
            <button type="button" onClick={() => setLines((ls) => [...ls, newLine({ newProduct: { name: "", categoryId: "", unit: "pc", price: "" } })])}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-ink-2 bg-recess hover:bg-line transition">
              <PackagePlus size={ICON_SIZE.xs} /> New product (not in the system yet)
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="rs-note" className="block text-xs font-medium text-ink-2 mb-1">Note <span className="text-ink-4">(optional)</span></label>
          <input id="rs-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="Remarks about this delivery" />
        </div>

        {error && <p className="text-sm text-bad bg-bad-soft rounded-lg px-3 py-2">{error}</p>}
      </form>
    </Modal>
  );
}
