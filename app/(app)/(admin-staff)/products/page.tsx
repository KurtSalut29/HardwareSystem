"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight, ImageIcon, PackageSearch, Boxes, PackagePlus } from "lucide-react";
import Link from "next/link";
import StockModal from "@/components/inventory/StockModal";
import PageHeader from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import type { ReorderPlan } from "@/lib/inventory";
import Image from "next/image";

type Subcategory = { id: number; name: string };
type Category = { id: number; name: string; description: string | null; subcategories?: Subcategory[] };
type Product = {
  id: number; name: string; categoryId: number; category: Category;
  subcategory: string | null; subcategoryId: number | null; price: number; unit: string; stock: number;
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

const EMPTY_FORM = { id: 0, name: "", categoryId: "", subcategoryId: "", price: "", unit: "pc", stock: "", description: "", image: "" };

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
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [newSub, setNewSub] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const showToast = useToast();

  const [plan, setPlan] = useState<ReorderPlan | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [pRes, cRes, planRes] = await Promise.all([fetch("/api/products"), fetch("/api/categories"), fetch("/api/inventory/reorder", { cache: "no-store" })]);
    setProducts(await pRes.json());
    setCategories(await cRes.json());
    if (planRes.ok) setPlan(await planRes.json());
    setLoading(false);
  }, []);

  // Each product's reorder point and EOQ, for the stock chip and the line under the price.
  const planBy = new Map((plan?.rows ?? []).map((r) => [r.productId, r]));

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // The chosen category's managed subcategories, for the dropdown.
  const subcategories = categories.find((c) => String(c.id) === form.categoryId)?.subcategories ?? [];
  const editingProduct = editing ? products.find((p) => p.id === form.id) ?? null : null;

  async function addSubcategory() {
    const name = (newSub ?? "").trim();
    if (!name || !form.categoryId) return;
    const res = await fetch("/api/subcategories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: Number(form.categoryId), name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Couldn't add the subcategory"); return; }
    const cRes = await fetch("/api/categories");
    if (cRes.ok) setCategories(await cRes.json());
    setForm((p) => ({ ...p, subcategoryId: String(data.id) }));
    setNewSub(null); setError("");
  }

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
    setForm(EMPTY_FORM); setEditing(false); setError(""); setImagePreview(null); setNewSub(null); setShowModal(true);
  }

  function openEdit(p: Product) {
    setForm({
      id: p.id, name: p.name, categoryId: String(p.categoryId),
      subcategoryId: p.subcategoryId ? String(p.subcategoryId) : "", price: String(p.price),
      unit: p.unit || "pc", stock: String(p.stock),
      description: p.description ?? "", image: p.image ?? "",
    });
    setImagePreview(p.image ?? null);
    setEditing(true); setError(""); setNewSub(null); setShowModal(true);
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
      body: JSON.stringify({
        ...form,
        categoryId: Number(form.categoryId),
        subcategoryId: form.subcategoryId ? Number(form.subcategoryId) : null,
        price: Number(form.price),
        ...(editing ? {} : { stock: Number(form.stock) || 0 }),
      }),
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
    if (!res.ok) { showToast((await res.json().catch(() => ({ error: "Failed to delete" }))).error, "error"); return; }
    setProducts((prev) => prev.filter((p) => p.id !== target.id));
    setDeleteTarget(null);
    showToast("Product deleted successfully");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products"
        subtitle="Manage inventory by category"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/restocks?new=1"
              className="inline-flex items-center gap-2 rounded-[10px] font-semibold py-2.5 px-4 text-sm bg-white border text-gray-700 hover:bg-gray-50 transition"
              style={{ borderColor: "var(--border)" }}>
              <PackagePlus size={ICON_SIZE.md} /> Add Inventory
            </Link>
            <Button onClick={openAdd} icon={<Plus size={ICON_SIZE.md} />}>Add New Product</Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="space-y-3">
        {/* Search — its own row, filled background, so it reads as an input, not another pill */}
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products by name..."
            className="w-full pl-11 pr-4 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition placeholder:text-gray-400" />
        </div>

        {/* Horizontal swipe strip on phones (how a native app would show category chips),
            wraps to multiple lines once there's room for it on tablet/desktop. */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible md:pb-0">
          {["All", ...categories.map((c) => c.name)].map((c) => (
            <button key={c} onClick={() => setFilterCat(c)}
              style={filterCat === c ? { background: "var(--brand)" } : undefined}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterCat === c ? "text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
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
          <div className="bg-white rounded-xl border border-gray-200">
            <EmptyState icon={PackageSearch} title="No products found" description="Try adjusting your search or add a new product to get started." />
          </div>
        ) : Object.entries(grouped).map(([catName, items]) => (
          <div key={catName}>
            <button onClick={() => setCollapsed((prev) => ({ ...prev, [catName]: !prev[catName] }))}
              className="flex items-center gap-2.5 mb-3">
              {collapsed[catName] ? <ChevronRight size={ICON_SIZE.sm} className="text-gray-400" /> : <ChevronDown size={ICON_SIZE.sm} className="text-gray-400" />}
              <span className="font-display font-extrabold text-gray-900 text-sm">{catName}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>{items.length}</span>
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
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible md:pb-0 mb-3">
                      {["All", ...subcats].map((s) => (
                        <button key={s} onClick={() => setActiveSub((prev) => ({ ...prev, [catName]: s }))}
                          className={`shrink-0 whitespace-nowrap px-3 py-1 rounded-lg text-xs font-medium transition border ${currentSub === s ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                    {visibleItems.map((p) => {
                      // Low means at or below this product's own reorder point (EOQ planning).
                      const reorder = planBy.get(p.id);
                      const reorderAt = reorder?.reorderPoint ?? 5;
                      const stockStyle =
                        p.stock <= 0
                          ? { background: "var(--bad-soft)", color: "var(--bad)" }
                          : p.stock <= reorderAt
                          ? { background: "var(--warn-soft)", color: "var(--warn)" }
                          : { background: "var(--good-soft)", color: "var(--good)" };
                      const stockLabel = p.stock <= 0 ? "Out of stock" : p.stock <= reorderAt ? `${p.stock} left` : "In stock";
                      return (
                        <div
                          key={p.id}
                          className="group bg-white rounded-2xl border border-[color:var(--border-strong)] overflow-hidden flex flex-col shadow-sm transition-[transform,border-color] duration-200 hover:border-blue-300 hover:-translate-y-1"
                        >
                          {/* Image */}
                          <div className="relative w-full aspect-[4/3] bg-gray-50 overflow-hidden">
                            {p.image ? (
                              <Image
                                src={p.image}
                                alt={p.name}
                                fill
                                sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
                                className="object-cover transition-transform duration-300 group-hover:scale-[1.06]"
                              />
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                                <div
                                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-display font-extrabold text-lg shadow-sm"
                                  style={{ background: "linear-gradient(155deg, var(--brand), var(--brand-ink))" }}
                                >
                                  {p.name.charAt(0)}
                                </div>
                                <span className="text-[10px] text-gray-300 font-medium">No image</span>
                              </div>
                            )}

                            {/* Stock chip */}
                            <span
                              className="absolute top-2 left-2 text-[10px] font-bold px-2 py-[3px] rounded-full shadow-sm"
                              style={stockStyle}
                            >
                              {stockLabel}
                            </span>
                          </div>

                          {/* Details */}
                          <div className="p-3 flex flex-col flex-1">
                            {p.subcategory && (
                              <span
                                className="self-start text-[9.5px] font-bold px-1.5 py-[3px] rounded uppercase tracking-wider mb-1"
                                style={{ background: "var(--bg-muted)", color: "var(--text-muted)" }}
                              >
                                {p.subcategory}
                              </span>
                            )}
                            <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{p.name}</p>
                            {p.description && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{p.description}</p>}

                            <div className="mt-auto pt-2.5 border-t border-gray-50 flex items-baseline gap-1">
                              <span className="font-display text-base font-extrabold text-gray-900 num">₱{p.price.toFixed(2)}</span>
                              <span className="text-[11px] text-gray-400 font-medium">/{p.unit}</span>
                            </div>
                            {reorder && (
                              <p className="text-[10.5px] text-gray-400 mt-1 num" title="Reorder point and Economic Order Quantity, from the last 90 days of sales">
                                Reorder at {reorder.reorderPoint} · EOQ {reorder.eoq ?? "—"}
                              </p>
                            )}
                          </div>

                          {/* Actions — labeled, not icon-only, so they're unambiguous at a glance */}
                          <div className="flex gap-1.5 p-2.5 border-t border-gray-100">
                            <button onClick={() => openEdit(p)}
                              className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                              <Pencil size={13} /> Edit
                            </button>
                            <button onClick={() => setStockTarget(p)}
                              className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                              <Boxes size={13} /> Stock
                            </button>
                            <button onClick={() => setDeleteTarget(p)} aria-label={`Delete ${p.name}`} title="Delete"
                              className="w-9 shrink-0 flex items-center justify-center py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        ))}
      </div>

      {stockTarget && (
        <StockModal
          product={products.find((x) => x.id === stockTarget.id) ?? stockTarget}
          onClose={() => setStockTarget(null)}
          onAdjusted={fetchAll}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Product?"
        body={<>Are you sure you want to delete <span className="font-medium text-gray-800">{deleteTarget?.name}</span>?</>}
        confirmLabel="Yes, Delete"
      />

      {/* Add/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit Product" : "Add New Product"}
        size="lg"
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" form="product-form" className="flex-1" loading={uploading}>
              {editing ? "Save Changes" : "Add Product"}
            </Button>
          </div>
        }
      >
        <form id="product-form" onSubmit={handleSave} className="space-y-4">

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
                      <ImageIcon size={ICON_SIZE.xl} className="text-gray-300 mb-1" />
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
                  <select required value={form.categoryId} onChange={(e) => { setForm((p) => ({ ...p, categoryId: e.target.value, subcategoryId: "" })); setNewSub(null); }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition bg-white">
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Subcategory */}
                <div>
                  <label htmlFor="product-subcategory" className="block text-xs font-medium text-gray-600 mb-1">Subcategory <span className="text-gray-400">(optional)</span></label>
                  {newSub === null ? (
                    <select id="product-subcategory" value={form.subcategoryId} disabled={!form.categoryId}
                      onChange={(e) => e.target.value === "__new" ? setNewSub("") : setForm((p) => ({ ...p, subcategoryId: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition bg-white disabled:bg-gray-50 disabled:text-gray-400">
                      <option value="">{form.categoryId ? "None" : "Pick a category first"}</option>
                      {subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      {form.categoryId && <option value="__new">+ New subcategory…</option>}
                    </select>
                  ) : (
                    <div className="flex gap-1.5">
                      <input autoFocus value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="e.g. Roofing Nails" maxLength={60}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubcategory(); } if (e.key === "Escape") { e.preventDefault(); setNewSub(null); } }}
                        aria-label="New subcategory name"
                        className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" />
                      <button type="button" onClick={addSubcategory} className="px-3 rounded-xl text-xs font-semibold text-white" style={{ background: "var(--brand)" }}>Add</button>
                      <button type="button" onClick={() => setNewSub(null)} className="px-2.5 rounded-xl text-xs font-semibold text-gray-500 bg-gray-100">Cancel</button>
                    </div>
                  )}
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

                {/* Stock: set once when the product is added; later changes go through
                    a purchase or a recorded adjustment, so each one leaves a trail. */}
                {editing ? (
                  <div className="col-span-2 rounded-xl border border-gray-100 px-3 py-2.5 flex flex-wrap items-center gap-2" style={{ background: "var(--bg-muted)" }}>
                    <span className="text-xs text-gray-500">Stock on hand</span>
                    <span className="font-semibold text-gray-900 num">{editingProduct?.stock ?? form.stock} {form.unit}</span>
                    <button type="button" onClick={() => { if (editingProduct) { setShowModal(false); setStockTarget(editingProduct); } }}
                      className="ml-auto text-xs font-semibold text-blue-600 hover:underline">Add inventory or adjust →</button>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="product-stock" className="block text-xs font-medium text-gray-600 mb-1">Opening stock <span className="text-gray-400">({form.unit})</span></label>
                    <input id="product-stock" type="number" min="0" step={form.unit === "kg" ? "0.01" : "1"} value={form.stock}
                      onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                      placeholder="0" />
                    <p className="text-[10.5px] text-gray-400 mt-1">What&apos;s on the shelf today. Later stock comes in through Add Inventory.</p>
                  </div>
                )}

                {/* Description */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-gray-400">(optional)</span></label>
                  <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition resize-none"
                    placeholder="Brief product description..." />
                </div>
              </div>

              {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
