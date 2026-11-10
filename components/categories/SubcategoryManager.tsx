"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Layers } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { ICON_SIZE } from "@/lib/constants/icon-size";

export type Subcategory = { id: number; name: string; _count?: { products: number } };

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition";

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
    <Modal open onClose={onClose} title={`Subcategories — ${category.name}`} size="md">
      <div className="space-y-4">
        <p className="text-xs text-gray-500 -mt-1">
          Subcategories group similar products inside a category, e.g. <i>Nails</i> and <i>Screws</i> under Fasteners.
          Products pick one from this list, and customers can switch between products of the same subcategory when adding to cart.
        </p>

        <form onSubmit={add} className="flex gap-2">
          <input id="new-subcategory" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New subcategory name"
            className={inputCls} maxLength={60} aria-label="New subcategory name" />
          <Button type="submit" disabled={!newName.trim() || busy} icon={<Plus size={ICON_SIZE.sm} />}>Add</Button>
        </form>

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        {subs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Layers size={ICON_SIZE.xl} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm">No subcategories yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
            {subs.map((s) => {
              const count = s._count?.products ?? 0;
              if (editing?.id === s.id) {
                return (
                  <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                    <input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); rename(); } if (e.key === "Escape") setEditing(null); }}
                      className={inputCls} aria-label="Subcategory name" maxLength={60} />
                    <button onClick={rename} disabled={busy} aria-label="Save name" className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-white" style={{ background: "var(--brand)" }}><Check size={14} /></button>
                    <button onClick={() => setEditing(null)} aria-label="Cancel rename" className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500"><X size={14} /></button>
                  </li>
                );
              }
              if (removing?.sub.id === s.id) {
                const others = subs.filter((o) => o.id !== s.id);
                return (
                  <li key={s.id} className="px-3 py-3 space-y-2 bg-red-50/40">
                    <p className="text-sm text-gray-800">
                      Remove <b>{s.name}</b>?{count > 0 && <> Its {count} product{count === 1 ? "" : "s"} will move to:</>}
                    </p>
                    {count > 0 && (
                      <select value={removing.moveTo} onChange={(e) => setRemoving({ ...removing, moveTo: e.target.value })} className={`${inputCls} bg-white`} aria-label="Move products to">
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
                  <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">{s.name}</span>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">{count} product{count === 1 ? "" : "s"}</span>
                  <button onClick={() => { setEditing({ id: s.id, name: s.name }); setRemoving(null); setError(""); }} aria-label={`Rename ${s.name}`}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition"><Pencil size={ICON_SIZE.xs} /></button>
                  <button onClick={() => { setRemoving({ sub: s, moveTo: "" }); setEditing(null); setError(""); }} aria-label={`Remove ${s.name}`}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition"><Trash2 size={ICON_SIZE.xs} /></button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
