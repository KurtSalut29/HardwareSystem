"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Search, Trash2, X, Check, Tag, Package, FolderX } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import StatCard from "@/components/ui/StatCard";
import { useToast } from "@/components/ui/ToastProvider";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type Category = { id: number; name: string; description: string | null; _count?: { products: number } };

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
  const showToast = useToast();

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/categories");
    setCategories(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalProductsCategorized = categories.reduce((s, c) => s + (c._count?.products ?? 0), 0);
  const emptyCategories = categories.filter((c) => (c._count?.products ?? 0) === 0).length;

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
    <div className="space-y-5">
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Category?"
        body={<>Are you sure you want to delete <span className="font-medium text-gray-800">{deleteTarget?.name}</span>?</>}
        confirmLabel="Yes, Delete"
      />
      <PageHeader
        title="Categories"
        subtitle="Organize your products into categories"
        action={<Button onClick={openAdd} icon={<Plus size={ICON_SIZE.sm} />}>Add Category</Button>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard title="Total Categories" value={categories.length} icon={<Tag size={ICON_SIZE.lg} className="text-blue-600" />} iconBg="bg-blue-50" />
        <StatCard title="Products Categorized" value={totalProductsCategorized} icon={<Package size={ICON_SIZE.lg} className="text-blue-500" />} iconBg="bg-blue-50" />
        <StatCard title="Empty Categories" value={emptyCategories} icon={<FolderX size={ICON_SIZE.lg} className="text-gray-500" />} iconBg="bg-gray-100" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Add / Edit Form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-fit">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900 text-sm">{editingId ? "Edit Category" : "New Category"}</p>
              <IconButton icon={<X size={ICON_SIZE.sm} />} onClick={cancelForm} title="Close" />
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input
                  required autoFocus
                  value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                  placeholder="e.g. Nails, Tools, Pipes"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description <span className="text-gray-300">(optional)</span></label>
                <textarea
                  rows={3}
                  value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition resize-none"
                  placeholder="Brief description of this category..."
                />
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="secondary" className="flex-1" onClick={cancelForm}>Cancel</Button>
                <Button type="submit" className="flex-1" loading={saving} icon={<Check size={ICON_SIZE.sm} />}>
                  {editingId ? "Save" : "Add"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Categories Table */}
        <div className={`bg-white rounded-xl border border-gray-200 ${showForm ? "xl:col-span-2" : "xl:col-span-3"}`}>
          <div className="flex items-center gap-3 p-4 border-b border-gray-100">
            <div className="relative max-w-md flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories by name..."
                className="w-full pl-11 pr-4 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition placeholder:text-gray-400"
              />
            </div>
            <span className="text-xs text-gray-400 ml-auto shrink-0">{filtered.length} categories</span>
          </div>

          {/* Table — tablet and up */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Category</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Products</th>
                  <th className="py-2.5 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={4} className="py-12 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center">
                      <Tag size={ICON_SIZE.xl} className="mx-auto text-gray-200 mb-2" />
                      <p className="text-sm text-gray-400">No categories yet. Add one to get started.</p>
                    </td>
                  </tr>
                ) : filtered.map((c) => (
                  <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${editingId === c.id ? "bg-blue-50/40" : ""}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white" style={{ background: "linear-gradient(155deg, var(--brand), var(--brand-ink))" }}>
                          <Tag size={ICON_SIZE.sm} />
                        </div>
                        <span className="font-display font-bold text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs max-w-xs">
                      {c.description ?? <span className="text-gray-200">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
                        {c._count?.products ?? 0} products
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={() => openEdit(c)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                          <Pencil size={ICON_SIZE.xs} /> Edit
                        </button>
                        <button onClick={() => setDeleteTarget(c)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
                          <Trash2 size={ICON_SIZE.xs} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Card list — phones only */}
          <div className="md:hidden divide-y divide-gray-100">
            {loading ? (
              <p className="py-12 text-center text-gray-400 text-sm">Loading...</p>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Tag size={ICON_SIZE.xl} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No categories yet. Add one to get started.</p>
              </div>
            ) : filtered.map((c) => (
              <div key={c.id} className={`p-4 ${editingId === c.id ? "bg-blue-50/40" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white" style={{ background: "linear-gradient(155deg, var(--brand), var(--brand-ink))" }}>
                    <Tag size={ICON_SIZE.sm} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-gray-900 truncate">{c.name}</span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
                        {c._count?.products ?? 0} products
                      </span>
                    </div>
                    {c.description && <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => openEdit(c)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                    <Pencil size={ICON_SIZE.xs} /> Edit
                  </button>
                  <button onClick={() => setDeleteTarget(c)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
                    <Trash2 size={ICON_SIZE.xs} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
