"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Search, Pencil, Trash2, X, ChevronDown, ChevronRight, ImageIcon } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Toast from "@/components/ui/Toast";
import Image from "next/image";

type Category = { id: number; name: string; description: string | null };
type Product = {
  id: number; name: string; categoryId: number; category: Category;
  subcategory: string | null; price: number; unit: string; stock: number;
  image: string | null; description: string | null;
};

const UNITS = [
  { value: "pc", label: "per pc" },
  { value: "kg", label: "per kg" },
  { value: "g", label: "per g" },
  { value: "meter", label: "per meter" },
  { value: "ft", label: "per ft" },
  { value: "bag", label: "per bag" },
  { value: "pack", label: "per pack" },
  { value: "box", label: "per box" },
  { value: "roll", label: "per roll" },
  { value: "bundle", label: "per bundle" },
  { value: "pair", label: "per pair" },
  { value: "set", label: "per set" },
  { value: "sheet", label: "per sheet" },
  { value: "liter", label: "per liter" },
  { value: "gallon", label: "per gallon" },
  { value: "length", label: "per length" },
  { value: "sack", label: "per sack" },
];

const EMPTY_FORM = { id: 0, name: "", categoryId: "", subcategory: "", price: "", unit: "pc", stock: "", description: "", image: "" };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeSub, setActiveSub] = useState<Record<string, string>>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" | "warning" | "info" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string, variant: "success" | "error" | "warning" | "info" = "success") {
    setToast({ msg, variant });
    setTimeout(() => setToast(null), 3000);
  }

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [pRes, cRes] = await Promise.all([fetch("/api/products"), fetch("/api/categories")]);
    setProducts(await pRes.json());
    setCategories(await cRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const subcategories = [...new Set(
    products.filter((p) => String(p.categoryId) === form.categoryId && p.subcategory).map((p) => p.subcategory!)
  )];

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) || (p.subcategory ?? "").toLowerCase().includes(q);
    const matchCat = filterCat === "All" || p.category.name === filterCat;
    return matchSearch && matchCat;
  });

  const grouped = categories.reduce<Record<string, Product[]>>((acc, cat) => {
    const items = filtered.filter((p) => p.categoryId === cat.id);
    if (items.length > 0) acc[cat.name] = items;
    return acc;
  }, {});

  function getSubcats(items: Product[]) {
    const seen = new Map<string, string>();
    items.forEach((p) => {
      if (!p.subcategory) return;
      const key = p.subcategory.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, p.subcategory);
    });
    return [...seen.values()];
  }

  function openAdd() {
    setForm(EMPTY_FORM); setEditing(false); setError(""); setImagePreview(null); setShowModal(true);
  }

  function openEdit(p: Product) {
    setForm({
      id: p.id, name: p.name, categoryId: String(p.categoryId),
      subcategory: p.subcategory ?? "", price: String(p.price),
      unit: p.unit || "pc", stock: String(p.stock),
      description: p.description ?? "", image: p.image ?? "",
    });
    setImagePreview(p.image ?? null);
    setEditing(true); setError(""); setShowModal(true);
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    const { url } = await res.json();
    setForm((prev) => ({ ...prev, image: url }));
    setImagePreview(url);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const method = editing ? "PUT" : "POST";
    const res = await fetch("/api/products", {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, categoryId: Number(form.categoryId), price: Number(form.price), stock: Number(form.stock) }),
    });
    if (!res.ok) { setError((await res.json().catch(() => ({ error: "Something went wrong" }))).error); return; }
    setShowModal(false);
    showToast(editing ? "Product updated successfully" : "Product added successfully", "success");
    fetchAll();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const res = await fetch("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: target.id }) });
    setDeleteTarget(null);
    if (!res.ok) { showToast((await res.json().catch(() => ({ error: "Failed to delete" }))).error, "error"); return; }
    setProducts((prev) => prev.filter((p) => p.id !== target.id));
    showToast("Product deleted successfully");
  }

  return (
    <div className="space-y-5">
      <Toast message={toast?.msg ?? ""} variant={toast?.variant} />
      <PageHeader
        title="Products"
        subtitle="Manage inventory by category"
        action={
          <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm shadow-blue-500/20">
            <Plus size={16} /> Add Product
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition shadow-sm" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["All", ...categories.map((c) => c.name)].map((c) => (
            <button key={c} onClick={() => setFilterCat(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterCat === c ? "bg-blue-600 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Product Cards */}
      <div className="space-y-6">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">Loading...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">No products found.</div>
        ) : Object.entries(grouped).map(([catName, items]) => (
          <div key={catName}>
            <button onClick={() => setCollapsed((prev) => ({ ...prev, [catName]: !prev[catName] }))}
              className="flex items-center gap-2.5 mb-3">
              {collapsed[catName] ? <ChevronRight size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
              <span className="font-bold text-gray-900 text-sm">{catName}</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{items.length}</span>
            </button>

            {!collapsed[catName] && (() => {
              const subcats = getSubcats(items);
              const currentSub = activeSub[catName] ?? "All";
              const visibleItems = currentSub === "All" ? items : items.filter((p) =>
                p.subcategory?.trim().toLowerCase() === currentSub.trim().toLowerCase()
              );
              return (
                <>
                  {subcats.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-3">
                      {["All", ...subcats].map((s) => (
                        <button key={s} onClick={() => setActiveSub((prev) => ({ ...prev, [catName]: s }))}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition border ${currentSub === s ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {visibleItems.map((p) => (
                      <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col hover:border-blue-200 hover:shadow-sm transition flex-shrink-0 w-48">
                        {/* Image */}
                        <div className="w-full h-36 bg-gray-50 flex items-center justify-center border-b border-gray-100 overflow-hidden">
                          {p.image ? (
                            <Image src={p.image} alt={p.name} width={192} height={144} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 font-bold text-xl">
                                {p.name.charAt(0)}
                              </div>
                              <span className="text-[10px] text-gray-300">No image</span>
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="p-3 flex flex-col flex-1">
                          <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{p.name}</p>
                          {p.subcategory && <span className="text-[10px] text-blue-500 font-medium mt-0.5">{p.subcategory}</span>}
                          {p.description && <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{p.description}</p>}

                          <div className="mt-auto pt-2 space-y-1">
                            <div className="flex items-baseline gap-1">
                              <span className="text-base font-bold text-gray-900">₱{p.price.toFixed(2)}</span>
                              <span className="text-[11px] text-gray-400 font-medium">per {p.unit}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-gray-500">Stock:</span>
                              <span className={`text-[11px] font-bold ${p.stock === 0 ? "text-red-500" : p.stock <= 5 ? "text-orange-500" : "text-green-600"}`}>
                                {p.stock === 0 ? "Out of stock" : p.stock}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 p-3 border-t border-gray-100">
                          <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                            <Pencil size={12} /> Edit
                          </button>
                          <button onClick={() => setDeleteTarget(p)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition">
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto mb-4">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h2 className="text-center font-semibold text-gray-900 mb-1">Delete Product?</h2>
            <p className="text-center text-sm text-gray-500 mb-5">
              Are you sure you want to delete <span className="font-medium text-gray-800">{deleteTarget.name}</span>?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2 text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2 text-sm font-semibold transition">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-800">{editing ? "Edit Product" : "Add New Product"}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"><X size={16} /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">

              {/* Image Upload */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Product Image <span className="text-gray-400">(optional)</span></label>
                <div onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition min-h-[100px]">
                  {imagePreview ? (
                    <div className="relative">
                      <Image src={imagePreview} alt="Preview" width={80} height={80} className="w-20 h-20 object-cover rounded-xl" />
                      <button type="button" onClick={(e) => { e.stopPropagation(); setImagePreview(null); setForm((p) => ({ ...p, image: "" })); }}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">×</button>
                    </div>
                  ) : (
                    <>
                      <ImageIcon size={24} className="text-gray-300 mb-1" />
                      <p className="text-xs text-gray-400">{uploading ? "Uploading..." : "Click to upload image"}</p>
                      <p className="text-[10px] text-gray-300 mt-0.5">PNG, JPG, WEBP up to 2MB</p>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Product Name */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Product Name</label>
                  <input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                    placeholder="e.g. Common Wire Nail" />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select required value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value, subcategory: "" }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition bg-white">
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Subcategory */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type / Subcategory <span className="text-gray-400">(optional)</span></label>
                  <input value={form.subcategory} onChange={(e) => setForm((p) => ({ ...p, subcategory: e.target.value }))}
                    list="subcategory-suggestions"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                    placeholder="e.g. Roofing Nails" />
                  <datalist id="subcategory-suggestions">
                    {subcategories.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>

                {/* Price + Unit side by side */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Price & Unit</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">₱</span>
                      <input required type="number" min="0" step="0.01" value={form.price}
                        onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                        placeholder="0.00" />
                    </div>
                    <span className="flex items-center text-sm text-gray-500 font-medium">per</span>
                    <select value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition bg-white">
                      {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                  </div>
                  {form.price && (
                    <p className="text-[11px] text-blue-500 font-medium mt-1.5">₱{Number(form.price).toFixed(2)} per {form.unit}</p>
                  )}
                </div>

                {/* Stock */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Stock <span className="text-gray-400">({form.unit})</span></label>
                  <input required type="number" min="0" value={form.stock}
                    onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                    placeholder="0" />
                </div>

                {/* Description */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-gray-400">(optional)</span></label>
                  <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition resize-none"
                    placeholder="Brief product description..." />
                </div>
              </div>

              {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2 text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={uploading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl py-2 text-sm font-semibold transition">
                  {editing ? "Save Changes" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
