"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Check, Tag, Layers } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import SearchField from "@/components/ui/SearchField";
import CategoryGlyph from "@/components/catalog/CategoryGlyph";
import { useToast } from "@/components/ui/ToastProvider";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import SubcategoryManager, { type Subcategory } from "@/components/categories/SubcategoryManager";

type Category = { id: number; name: string; description: string | null; _count?: { products: number }; subcategories: Subcategory[] };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [subsFor, setSubsFor] = useState<number | null>(null);
  const subsCategory = subsFor != null ? categories.find((c) => c.id === subsFor) ?? null : null;
  const showToast = useToast();

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/categories");
    const data = res.ok ? await res.json() : [];
    setCategories(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
    c.subcategories.some((s) => s.name.toLowerCase().includes(search.toLowerCase()))
  );
  const paging = usePagination(filtered, 10, search);

  const totalProductsCategorized = categories.reduce((s, c) => s + (c._count?.products ?? 0), 0);
  const emptyCategories = categories.filter((c) => (c._count?.products ?? 0) === 0).length;
  const totalSubs = categories.reduce((s, c) => s + c.subcategories.length, 0);

  function openAdd() {
    setEditingId(null);
    setForm({ name: "", description: "" });
    setError("");
    setShowForm(true);
  }

  function openEdit(c: Category) {
    setEditingId(c.id);
    setForm({ name: c.name, description: c.description ?? "" });
    setError("");
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", description: "" });
    setError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    const method = editingId ? "PUT" : "POST";
    const body = editingId ? { id: editingId, ...form } : form;
    const res = await fetch("/api/categories", {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    showToast(editingId ? "Category updated successfully" : "Category added successfully");
    cancelForm();
    fetchCategories();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const res = await fetch("/api/categories", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: target.id }),
    });
    if (!res.ok) { showToast((await res.json().catch(() => ({ error: "Failed to delete" }))).error, "error"); return; }
    setDeleteTarget(null);
    showToast(`"${target.name}" deleted`);
    fetchCategories();
  }

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete this category?"
        body={<>Are you sure you want to delete <span className="font-medium text-ink">{deleteTarget?.name}</span>?</>}
        confirmLabel="Yes, delete"
      />

      {subsCategory && (
        <SubcategoryManager category={subsCategory} onClose={() => setSubsFor(null)} onChanged={fetchCategories} />
      )}

      {/* Add / Edit Category */}
      <Modal
        open={showForm}
        onClose={cancelForm}
        title={editingId ? "Edit category" : "Add category"}
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={cancelForm}>Cancel</Button>
            <Button type="submit" form="category-form" className="flex-1" loading={saving} icon={<Check className="size-4" />}>
              {editingId ? "Save changes" : "Add category"}
            </Button>
          </div>
        }
      >
        <form id="category-form" onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="category-name" className="block text-xs font-medium text-ink-2 mb-1">Name</label>
            <input
              id="category-name"
              required autoFocus
              value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
              placeholder="e.g. Nails, Tools, Pipes"
            />
          </div>
          <div>
            <label htmlFor="category-description" className="block text-xs font-medium text-ink-2 mb-1">Description <span className="text-ink-4">(optional)</span></label>
            <textarea
              id="category-description"
              rows={3}
              value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition resize-none"
              placeholder="Brief description of this category..."
            />
          </div>
          {error && <p className="text-sm text-bad bg-bad-soft rounded-lg px-3 py-2">{error}</p>}
        </form>
      </Modal>
      <PageHeader
        eyebrow="Inventory"
        title="Categories"
        subtitle={loading ? "Loading categories…" : (
          <>
            <span className="font-semibold text-ink-2">{categories.length}</span> categories ·{" "}
            <span className="font-semibold text-ink-2">{totalSubs}</span> subcategories ·{" "}
            <span className="font-semibold text-ink-2">{totalProductsCategorized}</span> products
            {emptyCategories > 0 && <> · <span className="font-semibold text-warn">{emptyCategories} empty</span></>}
          </>
        )}
        action={<Button onClick={openAdd} icon={<Plus className="size-4" />}>Add category</Button>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchField value={search} onChange={setSearch} placeholder="Category or subcategory" label="Search categories" className="min-w-0 flex-1 sm:max-w-md" />
        <p className="ml-auto text-[13px] text-ink-3">
          <span className="num font-semibold text-ink">{filtered.length}</span> {filtered.length === 1 ? "category" : "categories"}
        </p>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl border border-line bg-surface" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface">
          <EmptyState icon={Tag} title={categories.length === 0 ? "No categories yet" : "No categories match"}
            description={categories.length === 0 ? "Add the first category to start organising products." : "Try another word."}
            action={categories.length === 0 ? <Button size="sm" onClick={openAdd} icon={<Plus className="size-3.5" />}>Add category</Button> : undefined} />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {paging.pageItems.map((c) => {
              const count = c._count?.products ?? 0;
              return (
                <article key={c.id} className="group flex flex-col rounded-2xl border border-line bg-surface p-4 transition hover:border-line-strong hover:shadow-[0_10px_30px_-18px_rgba(16,24,64,0.35)]">
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                      <CategoryGlyph category={c.name} className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-display text-[17px] font-extrabold tracking-tight text-ink">{c.name}</h2>
                      <p className={`text-[12.5px] font-semibold ${count ? "text-ink-3" : "text-warn"}`}>
                        {count ? `${count} ${count === 1 ? "product" : "products"}` : "No products yet"}
                      </p>
                    </div>
                  </div>
                  {c.description && <p className="mt-2.5 line-clamp-2 text-[13px] text-ink-3">{c.description}</p>}

                  <div className="mt-3 flex-1">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-4">Subcategories · {c.subcategories.length}</p>
                    <SubChips subs={c.subcategories} onManage={() => setSubsFor(c.id)} />
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 border-t border-line pt-3">
                    <button type="button" onClick={() => setSubsFor(c.id)}
                      className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line text-xs font-semibold text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink">
                      <Layers className="size-3.5" /> Subcategories
                    </button>
                    <button type="button" onClick={() => openEdit(c)}
                      className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line text-xs font-semibold text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink">
                      <Pencil className="size-3.5" /> Edit
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(c)} aria-label={`Delete ${c.name}`}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold text-bad transition hover:border-bad/40 hover:bg-bad-soft">
                      <Trash2 className="size-3.5" /> Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination {...paging} onChange={paging.setPage} noun="categories" />
        </>
      )}
    </div>
  );
}

/** The category's subcategories as chips, with a shortcut to manage them. */
function SubChips({ subs, onManage }: { subs: Subcategory[]; onManage: () => void }) {
  const shown = subs.slice(0, 5);
  if (subs.length === 0) {
    return <button type="button" onClick={onManage} className="text-[12.5px] font-semibold text-brand hover:underline">+ Add subcategories</button>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((s) => (
        <span key={s.id} className="whitespace-nowrap rounded-full bg-recess px-2 py-0.5 text-[11.5px] font-medium text-ink-2">
          {s.name}{s._count?.products ? <span className="num text-ink-4"> {s._count.products}</span> : null}
        </span>
      ))}
      {subs.length > shown.length && (
        <button type="button" onClick={onManage} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand-ink hover:bg-brand-soft/70">+{subs.length - shown.length} more</button>
      )}
    </div>
  );
}
