"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Layers } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import Alert from "@/components/ui/Alert";

export type Subcategory = { id: number; name: string; _count?: { products: number } };

const inputCls = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

/**
 * Add, rename and remove a category's subcategories. Removing one that still
 * has products asks where they should go, which is also how two near-duplicate
 * subcategories ("Wires" and "Wires & cable") are merged into one.
 */
export default function SubcategoryManager({ category, onClose, onChanged }: {
  category: { id: number; name: string; subcategories: Subcategory[] };
  onClose: () => void;
  onChanged: () => void;
}) {
  const showToast = useToast();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [removing, setRemoving] = useState<{ sub: Subcategory; moveTo: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const subs = category.subcategories;

  async function call(method: string, body: object) {
    setBusy(true); setError("");
    const res = await fetch("/api/subcategories", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return null; }
    onChanged();
    return data;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    if (await call("POST", { categoryId: category.id, name: newName })) {
      showToast(`Added "${newName.trim()}" to ${category.name}`);
      setNewName("");
    }
  }

  async function rename() {
    if (!editing) return;
    if (await call("PUT", editing)) { showToast("Subcategory renamed"); setEditing(null); }
  }

  async function remove() {
    if (!removing) return;
    const r = await call("DELETE", { id: removing.sub.id, moveTo: removing.moveTo || null });
    if (r) {
      const target = subs.find((s) => String(s.id) === removing.moveTo);
      showToast(target && r.moved ? `Merged into "${target.name}" (${r.moved} product${r.moved === 1 ? "" : "s"} moved)` : `"${removing.sub.name}" removed`);
      setRemoving(null);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Subcategories — ${category.name}`} icon={<Layers className="size-5" />} description="Add, rename, merge or remove the groups inside this category." size="md">
      <div className="space-y-4">
        <Alert tone="info" compact>
          For example <b>Nails</b> and <b>Screws</b> under Fasteners. Customers can switch between products of the same subcategory when adding to cart.
        </Alert>

        <form onSubmit={add} className="flex gap-2">
          <input id="new-subcategory" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New subcategory name"
            className={inputCls} maxLength={60} aria-label="New subcategory name" />
          <Button type="submit" disabled={!newName.trim() || busy} icon={<Plus size={ICON_SIZE.sm} />}>Add</Button>
        </form>

        {error && <Alert tone="bad" compact>{error}</Alert>}

        {subs.length === 0 ? (
          <div className="text-center py-8 text-ink-4">
            <Layers size={ICON_SIZE.xl} className="mx-auto mb-2 text-ink-4" />
            <p className="text-sm">No subcategories yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line border border-line rounded-xl">
            {subs.map((s) => {
              const count = s._count?.products ?? 0;
              if (editing?.id === s.id) {
                return (
                  <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                    <input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); rename(); } if (e.key === "Escape") setEditing(null); }}
                      className={inputCls} aria-label="Subcategory name" maxLength={60} />
                    <button onClick={rename} disabled={busy} aria-label="Save name" className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-white bg-brand"><Check size={14} /></button>
                    <button onClick={() => setEditing(null)} aria-label="Cancel rename" className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-recess text-ink-3"><X size={14} /></button>
                  </li>
                );
              }
              if (removing?.sub.id === s.id) {
                const others = subs.filter((o) => o.id !== s.id);
                return (
                  <li key={s.id} className="px-3 py-3 space-y-2 bg-bad-soft/50">
                    <p className="text-sm text-ink">
                      Remove <b>{s.name}</b>?{count > 0 && <> Its {count} product{count === 1 ? "" : "s"} will move to:</>}
                    </p>
                    {count > 0 && (
                      <select value={removing.moveTo} onChange={(e) => setRemoving({ ...removing, moveTo: e.target.value })} className={`${inputCls} bg-surface`} aria-label="Move products to">
                        <option value="">No subcategory</option>
                        {others.map((o) => <option key={o.id} value={o.id}>{o.name} (merge)</option>)}
                      </select>
                    )}
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="secondary" onClick={() => setRemoving(null)}>Keep</Button>
                      <Button size="sm" variant="danger" loading={busy} onClick={remove}>{removing.moveTo ? "Merge & remove" : "Remove"}</Button>
                    </div>
                  </li>
                );
              }
              return (
                <li key={s.id} className="flex items-center gap-2 px-3 py-2.5">
                  <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate">{s.name}</span>
                  <span className="text-[11px] text-ink-4 whitespace-nowrap">{count} product{count === 1 ? "" : "s"}</span>
                  <button onClick={() => { setEditing({ id: s.id, name: s.name }); setRemoving(null); setError(""); }} aria-label={`Rename ${s.name}`}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2 text-[11.5px] font-semibold text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink"><Pencil className="size-3" /> Rename</button>
                  <button onClick={() => { setRemoving({ sub: s, moveTo: "" }); setEditing(null); setError(""); }} aria-label={`Remove ${s.name}`}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2 text-[11.5px] font-semibold text-bad transition hover:border-bad/40 hover:bg-bad-soft"><Trash2 className="size-3" /> Remove</button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
