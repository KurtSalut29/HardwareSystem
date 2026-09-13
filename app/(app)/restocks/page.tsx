"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Truck, PackagePlus, Wallet, Boxes, Package } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import Image from "next/image";

type Product = { id: number; name: string; unit: string; stock: number; image: string | null; category: { id: number; name: string } };
type Restock = {
  id: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supplierName: string | null;
  note: string | null;
  date: string;
  product: { id: number; name: string; unit: string; image: string | null };
  recordedBy: { username: string };
};

const EMPTY_FORM = { productId: "", quantity: "", unitCost: "", supplierName: "", note: "" };

// A month's worth of purchase history is a sensible default window — mirrors
// what an owner actually wants to see first: "what have we bought recently."
function startOfThisMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function RestocksPage() {
  const [restocks, setRestocks] = useState<Restock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const showToast = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [rRes, pRes] = await Promise.all([fetch("/api/restocks"), fetch("/api/products")]);
    setRestocks(await rRes.json());
    setProducts(await pRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function openAdd() {
    setForm(EMPTY_FORM);
    setError("");
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.productId) { setError("Choose a product"); return; }
    const quantity = Number(form.quantity);
    const unitCost = Number(form.unitCost);
    if (!(quantity > 0)) { setError("Enter a quantity greater than zero"); return; }
    if (!(unitCost >= 0)) { setError("Enter a valid unit cost"); return; }

    setSaving(true);
    const res = await fetch("/api/restocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: Number(form.productId),
        quantity,
        unitCost,
        supplierName: form.supplierName || undefined,
        note: form.note || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error || "Failed to record purchase"); return; }
    setShowModal(false);
    showToast("Purchase recorded — stock updated.");
    fetchAll();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return restocks;
    return restocks.filter(
      (r) =>
        r.product.name.toLowerCase().includes(q) ||
        (r.supplierName ?? "").toLowerCase().includes(q) ||
        r.recordedBy.username.toLowerCase().includes(q)
    );
  }, [restocks, search]);

  const monthCutoff = startOfThisMonth();
  const thisMonth = restocks.filter((r) => new Date(r.date) >= monthCutoff);
  const spentThisMonth = thisMonth.reduce((s, r) => s + r.totalCost, 0);
  const unitsThisMonth = thisMonth.reduce((s, r) => s + r.quantity, 0);

  const selectedProduct = products.find((p) => p.id === Number(form.productId));
  const previewTotal = form.quantity && form.unitCost ? Number(form.quantity) * Number(form.unitCost) : 0;

  // Grouped by category, alphabetically both ways — a long flat list of 70+
  // products is hard to scan; grouping mirrors how the Products page itself
  // is organized, so the admin finds things where they expect them.
  const productsByCategory = useMemo(() => {
    const groups = new Map<string, Product[]>();
    for (const p of products) {
      const key = p.category?.name ?? "Uncategorized";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({
        category,
        items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [products]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Restocks"
        subtitle="Record hardware purchased from suppliers — every purchase logged here updates stock automatically."
        action={<Button onClick={openAdd} icon={<Plus size={ICON_SIZE.md} />}>Record Purchase</Button>}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Purchases Recorded" value={restocks.length} icon={<PackagePlus size={ICON_SIZE.lg} className="text-blue-600" />} iconBg="bg-blue-50" />
        <StatCard title="Spent This Month" value={`₱${spentThisMonth.toFixed(2)}`} icon={<Wallet size={ICON_SIZE.lg} className="text-emerald-600" />} iconBg="bg-emerald-50" />
        <StatCard title="Units Restocked This Month" value={unitsThisMonth} icon={<Boxes size={ICON_SIZE.lg} className="text-indigo-600" />} iconBg="bg-indigo-50" />
        <StatCard title="Products Tracked" value={products.length} icon={<Package size={ICON_SIZE.lg} className="text-purple-600" />} iconBg="bg-purple-50" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-3 p-4 border-b border-gray-100">
          <div className="relative max-w-md flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product, supplier, or who recorded it..."
              className="w-full pl-11 pr-4 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition placeholder:text-gray-400"
            />
          </div>
          <span className="text-xs text-gray-400 ml-auto shrink-0">{filtered.length} records</span>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-16 text-center">Loading...</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={restocks.length === 0 ? "No purchases recorded yet" : "No matches"}
            description={restocks.length === 0 ? "Log a supplier delivery to start tracking where your stock comes from." : "Try a different search."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Product</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Supplier</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Qty</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Unit Cost</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Recorded by</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {r.product.image ? (
                            <Image src={r.product.image} alt={r.product.name} width={32} height={32} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={14} className="text-gray-300" />
                          )}
                        </div>
                        <span className="font-medium text-gray-900 truncate">{r.product.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{r.supplierName || "—"}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{r.quantity}{r.product.unit === "kg" ? " kg" : ""}</td>
                    <td className="py-3 px-4 text-right text-gray-500">₱{r.unitCost.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">₱{r.totalCost.toFixed(2)}</td>
                    <td className="py-3 px-4 text-gray-500 hidden sm:table-cell">{r.recordedBy.username}</td>
                    <td className="py-3 px-4 text-gray-400 text-xs hidden sm:table-cell">
                      {new Date(r.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Record a Purchase"
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" form="restock-form" className="flex-1" loading={saving}>Record Purchase</Button>
          </div>
        }
      >
        <form id="restock-form" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Product</label>
            <select
              required
              value={form.productId}
              onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition bg-white"
            >
              <option value="">Select a product</option>
              {productsByCategory.map(({ category, items }) => (
                <optgroup key={category} label={category}>
                  {items.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.stock} {p.unit} in stock</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Quantity {selectedProduct ? `(${selectedProduct.unit})` : ""}
              </label>
              <input
                required type="number" step="0.01" min="0.01" value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unit Cost (₱)</label>
              <input
                required type="number" step="0.01" min="0" value={form.unitCost}
                onChange={(e) => setForm((p) => ({ ...p, unitCost: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                placeholder="0.00"
              />
            </div>
          </div>

          {previewTotal > 0 && (
            <div className="bg-blue-50 rounded-lg px-3 py-2 flex justify-between text-sm">
              <span className="text-blue-600">Total cost</span>
              <span className="font-bold text-blue-700">₱{previewTotal.toFixed(2)}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Supplier <span className="text-gray-400">(optional)</span></label>
            <input
              value={form.supplierName}
              onChange={(e) => setForm((p) => ({ ...p, supplierName: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
              placeholder="e.g. ABC Steel Supply"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Note <span className="text-gray-400">(optional)</span></label>
            <input
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
              placeholder="Delivery receipt no., remarks, etc."
            />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
