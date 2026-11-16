"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, ImageIcon, PackageSearch, Boxes, PackagePlus, ArrowRight, Package, PackageCheck, PackageX, TriangleAlert } from "lucide-react";
import FilterTiles, { type FilterTile } from "@/components/ui/FilterTiles";
import Link from "next/link";
import Image from "next/image";
import StockModal from "@/components/inventory/StockModal";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import type { ReorderPlan } from "@/lib/inventory";
import ShelfCard from "@/components/catalog/ShelfCard";
import ProductThumb from "@/components/catalog/ProductThumb";
import StockMeter from "@/components/catalog/StockMeter";
import CategoryRail, { type RailValue } from "@/components/catalog/CategoryRail";
import CatalogToolbar, { type SortKey } from "@/components/catalog/CatalogToolbar";
import CategoryGlyph from "@/components/catalog/CategoryGlyph";
import { fmtQty, peso, productCode, stockState, type StockState } from "@/lib/catalog-ui";
import { filterProducts, groupByCategory, railCategories, usePreference } from "@/lib/useCatalog";

type Subcategory = { id: number; name: string };
type Category = { id: number; name: string; description: string | null; subcategories?: Subcategory[] };
type Product = {
  id: number; name: string; categoryId: number; category: Category;
  subcategory: string | null; subcategoryId: number | null; price: number; unit: string; stock: number;
  image: string | null; description: string | null; brand: string | null;
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

const EMPTY_FORM = { id: 0, name: "", brand: "", categoryId: "", subcategoryId: "", price: "", unit: "pc", stock: "", description: "", image: "" };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [rail, setRail] = useState<RailValue>({ categoryId: null, sub: null });
  const [sort, setSort] = useState<SortKey>("category");
  const [stockFilter, setStockFilter] = useState<"all" | StockState>("all");
  const [view, setView] = usePreference("rm-products-view", "grid", ["grid", "list"] as const);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
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

  // Low means at or below the product's own reorder point (EOQ planning); 5 until there's sales history.
  const reorderAtOf = (p: Product) => planBy.get(p.id)?.reorderPoint ?? 5;
  const stateOf = (p: Product) => stockState(p.stock, reorderAtOf(p));
  const stockCounts = { all: products.length, ok: 0, low: 0, out: 0 } as Record<"all" | StockState, number>;
  for (const p of products) stockCounts[stateOf(p)]++;
  const shelfValue = products.reduce((sum, p) => sum + Math.max(0, p.stock) * p.price, 0);

  const rails = railCategories(categories, products);
  const list = filterProducts(products, rail, query, sort, (p) => stockFilter === "all" || stateOf(p) === stockFilter);
  const grouped = view === "grid" && sort === "category" && rail.categoryId === null && !query.trim() ? groupByCategory(list) : null;
  const activeCat = rails.find((c) => c.id === rail.categoryId);
  const filtersOn = rail.categoryId !== null || !!query.trim() || stockFilter !== "all";
  const clearFilters = () => { setRail({ categoryId: null, sub: null }); setQuery(""); setStockFilter("all"); };

  function openAdd() {
    setForm(EMPTY_FORM); setEditing(false); setError(""); setImagePreview(null); setNewSub(null); setShowModal(true);
  }

  function openEdit(p: Product) {
    setForm({
      id: p.id, name: p.name, brand: p.brand ?? "", categoryId: String(p.categoryId),
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

  const pct = (k: StockState) => (products.length ? `${Math.round((stockCounts[k] / products.length) * 100)}%` : undefined);
  const STOCK_TABS: FilterTile<"all" | StockState>[] = [
    { key: "all", label: "All products", value: stockCounts.all, icon: <Package className="size-5" />, tone: "brand" },
    { key: "ok", label: "In stock", value: stockCounts.ok, icon: <PackageCheck className="size-5" />, tone: "good", hint: pct("ok") },
    { key: "low", label: "Running low", value: stockCounts.low, icon: <TriangleAlert className="size-5" />, tone: "warn", hint: pct("low") },
    { key: "out", label: "Out of stock", value: stockCounts.out, icon: <PackageX className="size-5" />, tone: "bad", hint: pct("out") },
  ];

  const FOOT_BTN = "inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-lg border border-line px-1 text-xs font-semibold transition";
  const cardFooter = (p: Product) => (
    <div className="grid grid-cols-3 gap-1.5">
      <button type="button" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}
        className={`${FOOT_BTN} text-ink-2 hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink`}>
        <Pencil className="size-3.5 shrink-0" /> Edit
      </button>
      <button type="button" onClick={() => setStockTarget(p)} aria-label={`Stock for ${p.name}`}
        className={`${FOOT_BTN} text-ink-2 hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink`}>
        <Boxes className="size-3.5 shrink-0" /> Stock
      </button>
      <button type="button" onClick={() => setDeleteTarget(p)} aria-label={`Delete ${p.name}`}
        className={`${FOOT_BTN} text-bad hover:border-bad/40 hover:bg-bad-soft`}>
        <Trash2 className="size-3.5 shrink-0" /> Delete
      </button>
    </div>
  );

  const card = (p: Product) => (
    <ShelfCard key={p.id} product={p} reorderAt={reorderAtOf(p)} audience="staff"
      onOpen={() => openEdit(p)} openLabel={`Edit ${p.name}`} footer={cardFooter(p)} />
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">Inventory</p>
          <h1 className="mt-1 font-display text-[28px] font-extrabold leading-none tracking-tight text-ink">Products</h1>
          <p className="mt-2 text-sm text-ink-3">
            {loading ? "Loading the catalogue…" : <>
              <span className="font-semibold text-ink-2">{products.length}</span> products in <span className="font-semibold text-ink-2">{rails.length}</span> categories
              <span className="hidden sm:inline"> · <span className="num font-semibold text-ink-2">{peso(shelfValue)}</span> on the shelves at selling price</span>
            </>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/restocks?new=1"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink-2 shadow-[0_1px_2px_rgba(16,24,64,0.05)] transition hover:border-line-strong hover:text-ink">
            <PackagePlus className="size-4" /> Add inventory
          </Link>
          <button type="button" onClick={openAdd}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(30,79,216,0.8)] transition hover:brightness-110 active:scale-[0.98]">
            <Plus className="size-4" /> New product
          </button>
        </div>
      </header>

      {/* Stock status: a summary that doubles as a filter */}
      <FilterTiles tiles={STOCK_TABS} value={stockFilter} onChange={setStockFilter} label="Filter by stock" loading={loading} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[232px_minmax(0,1fr)]">
        <CategoryRail categories={rails} total={products.length} value={rail} onChange={setRail} />

        <section className="min-w-0 space-y-4" aria-label="Products">
          <CatalogToolbar query={query} onQuery={setQuery} sort={sort} onSort={setSort}
            sorts={["category", "name", "price_asc", "price_desc", "stock_asc"]} view={view} onView={setView} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-ink-3">
              <span className="font-semibold text-ink">{list.length}</span> {list.length === 1 ? "product" : "products"}
              {activeCat && <> in <span className="font-semibold text-ink-2">{activeCat.name}</span>{rail.sub && <> › <span className="font-semibold text-ink-2">{rail.sub}</span></>}</>}
              {stockFilter !== "all" && <> · {STOCK_TABS.find((t) => t.key === stockFilter)?.label.toLowerCase()}</>}
              {query.trim() && <> matching “<span className="font-semibold text-ink-2">{query.trim()}</span>”</>}
            </p>
            {filtersOn && (
              <button type="button" onClick={clearFilters} className="text-[13px] font-semibold text-brand hover:underline">Clear filters</button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <div className="aspect-[4/3] animate-pulse bg-recess" />
                  <div className="space-y-2 p-3.5">
                    <div className="h-2.5 w-1/3 animate-pulse rounded bg-recess" />
                    <div className="h-3.5 w-4/5 animate-pulse rounded bg-recess" />
                    <div className="h-12 animate-pulse rounded-lg bg-recess" />
                  </div>
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
              <PackageSearch className="size-10 text-ink-4" strokeWidth={1.5} />
              <p className="mt-3 font-display text-lg font-extrabold text-ink">No products match</p>
              <p className="mt-1 max-w-sm text-sm text-ink-3">
                {products.length === 0 ? "Add the first product to start the catalogue." : "Try another word, or clear the filters to see everything."}
              </p>
              <div className="mt-4 flex gap-2">
                {filtersOn && <button type="button" onClick={clearFilters} className="h-9 rounded-lg border border-line px-3.5 text-sm font-semibold text-ink-2 hover:bg-recess">Clear filters</button>}
                <button type="button" onClick={openAdd} className="h-9 rounded-lg bg-brand px-3.5 text-sm font-semibold text-white hover:brightness-110">New product</button>
              </div>
            </div>
          ) : view === "list" ? (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-subtle text-left text-[11px] font-bold uppercase tracking-[0.08em] text-ink-4">
                  <tr>
                    <th className="px-4 py-2.5">Product</th>
                    <th className="hidden px-3 py-2.5 lg:table-cell">Category</th>
                    <th className="px-3 py-2.5 text-right">Price</th>
                    <th className="hidden px-3 py-2.5 sm:table-cell">Stock</th>
                    <th className="hidden px-3 py-2.5 text-right xl:table-cell">Reorder at</th>
                    <th className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map((p) => {
                    const st = stateOf(p);
                    return (
                      <tr key={p.id} className="transition hover:bg-subtle">
                        <td className="px-4 py-2.5">
                          <button type="button" onClick={() => openEdit(p)} className="flex min-w-0 items-center gap-3 text-left">
                            <ProductThumb size="row" image={p.image} name={p.name} category={p.category?.name} subcategory={p.subcategory} />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-ink hover:text-brand">{p.name}</span>
                              <span className="block truncate text-[11.5px] text-ink-4">
                                <span className="font-code">{productCode(p)}</span>
                                {p.brand && <> · <span className="font-semibold text-brand">{p.brand}</span></>}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="hidden px-3 py-2.5 text-[13px] text-ink-3 lg:table-cell">
                          {p.category?.name}{p.subcategory && <span className="text-ink-4"> › {p.subcategory}</span>}
                        </td>
                        <td className="num whitespace-nowrap px-3 py-2.5 text-right font-semibold text-ink">
                          {peso(p.price)}<span className="font-normal text-ink-4">/{p.unit}</span>
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-2.5 sm:table-cell">
                          <span className="flex items-center gap-2">
                            <StockMeter stock={p.stock} reorderAt={reorderAtOf(p)} state={st} />
                            <span className={`num text-[13px] ${st === "out" ? "font-semibold text-bad" : st === "low" ? "font-semibold text-warn" : "text-ink-2"}`}>
                              {fmtQty(p.stock)} <span className="text-ink-4">{p.unit}</span>
                            </span>
                          </span>
                        </td>
                        <td className="num hidden px-3 py-2.5 text-right text-[13px] text-ink-3 xl:table-cell">
                          {planBy.get(p.id) ? <>{fmtQty(reorderAtOf(p))} <span className="text-ink-4">{p.unit}</span></> : <span className="text-ink-4">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink"><Pencil className="size-3.5" /> Edit</button>
                            <button type="button" onClick={() => setStockTarget(p)} aria-label={`Stock for ${p.name}`}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink"><Boxes className="size-3.5" /> Stock</button>
                            <button type="button" onClick={() => setDeleteTarget(p)} aria-label={`Delete ${p.name}`}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold text-bad transition hover:border-bad/40 hover:bg-bad-soft"><Trash2 className="size-3.5" /> Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : grouped ? (
            <div className="space-y-8">
              {grouped.map((g) => {
                return (
                  <section key={g.categoryId} aria-labelledby={`cat-${g.categoryId}`}>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><CategoryGlyph category={g.name} className="size-4" /></span>
                      <h2 id={`cat-${g.categoryId}`} className="font-display text-lg font-extrabold tracking-tight text-ink">{g.name}</h2>
                      <span className="font-code text-xs text-ink-4">{g.items.length}</span>
                      <span aria-hidden className="h-px flex-1 bg-line" />
                      <button type="button" onClick={() => setRail({ categoryId: g.categoryId, sub: null })}
                        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:underline">
                        Only {g.name} <ArrowRight className="size-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">{g.items.map(card)}</div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">{list.map(card)}</div>
          )}
        </section>
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
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Product Name</label>
                  <input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                    placeholder="e.g. Portland Cement 40kg" />
                </div>

                {/* Brand */}
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor="product-brand" className="block text-xs font-medium text-gray-600 mb-1">Brand <span className="text-gray-400">(optional)</span></label>
                  <input id="product-brand" list="product-brands" value={form.brand} maxLength={60}
                    onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                    placeholder="e.g. Holcim, Boysen, Stanley" />
                  {/* Brands already in use, so the same maker is spelled the same way. */}
                  <datalist id="product-brands">
                    {[...new Set(products.map((x) => x.brand).filter((b): b is string => !!b))].sort().map((b) => <option key={b} value={b} />)}
                  </datalist>
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
