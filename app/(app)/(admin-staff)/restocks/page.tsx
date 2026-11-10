"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Truck, PackagePlus, Wallet, Boxes, Package, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/ToastProvider";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import ReorderPlanner from "@/components/inventory/ReorderPlanner";
import RestockModal, { type Line, type RestockProduct, newLine, lineFromPlan } from "@/components/inventory/RestockModal";
import type { ReorderPlan, ReorderRow } from "@/lib/inventory";
import Image from "next/image";

type Restock = {
  id: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supplierName: string | null;
  note: string | null;
  date: string;
  batchId: number | null;
  product: { id: number; name: string; unit: string; image: string | null };
  recordedBy: { username: string };
  batch: { id: number; supplierName: string | null; referenceNo: string | null; note: string | null; date: string; totalCost: number } | null;
};

/** One supplier delivery and its product lines. Older single-product records are their own delivery. */
type Delivery = {
  key: string;
  date: string;
  supplierName: string | null;
  referenceNo: string | null;
  note: string | null;
  recordedBy: string;
  total: number;
  lines: Restock[];
};

type Adjustment = {
  id: number; change: number; stockAfter: number; reason: string; note: string | null; date: string;
  product: { id: number; name: string; unit: string }; recordedBy: { username: string };
};

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (n: number) => String(Math.round(n * 100) / 100);

function startOfThisMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function RestocksPage() {
  const [restocks, setRestocks] = useState<Restock[]>([]);
  const [products, setProducts] = useState<RestockProduct[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalLines, setModalLines] = useState<Line[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [plan, setPlan] = useState<ReorderPlan | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const showToast = useToast();

  const fetchPlan = useCallback(async () => {
    const res = await fetch("/api/inventory/reorder", { cache: "no-store" });
    if (res.ok) setPlan(await res.json());
  }, []);

  const fetchAll = useCallback(async () => {
    const [rRes, pRes, cRes, aRes] = await Promise.all([fetch("/api/restocks"), fetch("/api/products"), fetch("/api/categories"), fetch("/api/stock-adjustments")]);
    const list = <T,>(d: unknown) => (Array.isArray(d) ? (d as T[]) : []);
    setRestocks(list<Restock>(rRes.ok ? await rRes.json() : []));
    setProducts(list<RestockProduct>(pRes.ok ? await pRes.json() : []));
    setCategories(list<{ id: number; name: string }>(cRes.ok ? await cRes.json() : []));
    setAdjustments(list<Adjustment>(aRes.ok ? await aRes.json() : []));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    fetchPlan();
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setIsAdmin(d.role === "admin")).catch(() => {});
  }, [fetchAll, fetchPlan]);

  const planBy = useMemo(() => new Map((plan?.rows ?? []).map((r) => [r.productId, r])), [plan]);

  // Links from Products: ?new=1 opens a blank delivery, ?product=ID one with that
  // product on it (EOQ quantity and last cost filled in once the plan arrives).
  const [linkHandled, setLinkHandled] = useState(false);
  if (!linkHandled && !loading && plan && typeof window !== "undefined") {
    setLinkHandled(true);
    const params = new URLSearchParams(window.location.search);
    const pid = Number(params.get("product"));
    if (pid) {
      const row = planBy.get(pid);
      setModalLines([row ? lineFromPlan(row) : newLine({ productId: String(pid) })]);
    } else if (params.get("new")) {
      setModalLines([newLine()]);
    }
  }
  // Drop the link's query once it has been used, so a reload doesn't reopen the form.
  useEffect(() => {
    if (linkHandled && window.location.search) window.history.replaceState(null, "", "/restocks");
  }, [linkHandled]);

  const deliveries = useMemo<Delivery[]>(() => {
    const map = new Map<string, Delivery>();
    for (const r of restocks) {
      const key = r.batchId ? `b${r.batchId}` : `r${r.id}`;
      let d = map.get(key);
      if (!d) {
        d = {
          key,
          date: r.batch?.date ?? r.date,
          supplierName: r.batch ? r.batch.supplierName : r.supplierName,
          referenceNo: r.batch?.referenceNo ?? null,
          note: r.batch ? r.batch.note : r.note,
          recordedBy: r.recordedBy.username,
          total: 0,
          lines: [],
        };
        map.set(key, d);
      }
      d.lines.push(r);
      d.total += r.totalCost;
    }
    return [...map.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [restocks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deliveries;
    return deliveries.filter((d) =>
      (d.supplierName ?? "").toLowerCase().includes(q) ||
      (d.referenceNo ?? "").toLowerCase().includes(q) ||
      (d.note ?? "").toLowerCase().includes(q) ||
      d.recordedBy.toLowerCase().includes(q) ||
      d.lines.some((l) => l.product.name.toLowerCase().includes(q))
    );
  }, [deliveries, search]);

  const paging = usePagination(filtered, 10, search);
  const adjPaging = usePagination(adjustments, 8);

  const monthCutoff = startOfThisMonth();
  const thisMonth = restocks.filter((r) => new Date(r.date) >= monthCutoff);
  const spentThisMonth = thisMonth.reduce((s, r) => s + r.totalCost, 0);
  const deliveriesThisMonth = deliveries.filter((d) => new Date(d.date) >= monthCutoff).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Restocks"
        subtitle="Record supplier deliveries. Every product on a delivery is added to stock automatically."
        action={<Button onClick={() => setModalLines([newLine()])} icon={<Plus size={ICON_SIZE.md} />}>Record Delivery</Button>}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Deliveries Recorded" value={deliveries.length} subtitle={`${restocks.length} product lines`} icon={<Truck size={ICON_SIZE.lg} className="text-blue-600" />} iconBg="bg-blue-50" />
        <StatCard title="Spent This Month" value={peso(spentThisMonth)} icon={<Wallet size={ICON_SIZE.lg} className="text-emerald-600" />} iconBg="bg-emerald-50" />
        <StatCard title="Deliveries This Month" value={deliveriesThisMonth} icon={<PackagePlus size={ICON_SIZE.lg} className="text-indigo-600" />} iconBg="bg-indigo-50" />
        <StatCard title="Products Tracked" value={products.length} icon={<Package size={ICON_SIZE.lg} className="text-purple-600" />} iconBg="bg-purple-50" />
      </div>

      <ReorderPlanner
        plan={plan}
        isAdmin={isAdmin}
        onOrder={(row: ReorderRow) => setModalLines([lineFromPlan(row)])}
        onSettingsSaved={() => { fetchPlan(); showToast("EOQ settings saved — suggestions updated."); }}
      />

      {/* Purchase history, one row per delivery */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-3 p-4 border-b border-gray-100">
          <h2 className="font-display font-extrabold text-gray-900 shrink-0 hidden md:block">Purchase history</h2>
          <div className="relative max-w-md flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, supplier, DR no., or who recorded it..."
              className="w-full pl-11 pr-4 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition placeholder:text-gray-400"
            />
          </div>
          <span className="text-xs text-gray-400 ml-auto shrink-0">{filtered.length} deliveries</span>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-16 text-center">Loading...</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={restocks.length === 0 ? "No deliveries recorded yet" : "No matches"}
            description={restocks.length === 0 ? "Record a supplier delivery to start tracking where your stock comes from." : "Try a different search."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-8" />
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Delivery</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Products</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Recorded by</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paging.pageItems.map((d) => {
                  const open = expanded === d.key;
                  return (
                    <React.Fragment key={d.key}>
                      <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setExpanded(open ? null : d.key)}>
                        <td className="pl-4 text-gray-400">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">{d.supplierName || "Supplier not recorded"}</p>
                          <p className="text-[11px] text-gray-400">{d.referenceNo ? `DR ${d.referenceNo}` : d.note || "—"}</p>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {d.lines.length === 1
                            ? <span className="truncate">{d.lines[0].product.name} <span className="text-gray-400">× {qty(d.lines[0].quantity)} {d.lines[0].product.unit}</span></span>
                            : <span>{d.lines.length} products <span className="text-gray-400">· {d.lines.slice(0, 2).map((l) => l.product.name).join(", ")}{d.lines.length > 2 ? "…" : ""}</span></span>}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900 num whitespace-nowrap">{peso(d.total)}</td>
                        <td className="py-3 px-4 text-gray-500 hidden sm:table-cell">{d.recordedBy}</td>
                        <td className="py-3 px-4 text-gray-400 text-xs hidden sm:table-cell whitespace-nowrap">
                          {new Date(d.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-gray-50/60">
                          <td colSpan={6} className="px-4 sm:px-8 py-3">
                            <ul className="divide-y divide-gray-100 bg-white rounded-xl border border-gray-100">
                              {d.lines.map((l) => (
                                <li key={l.id} className="flex items-center gap-3 px-3 py-2">
                                  <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                                    {l.product.image ? <Image src={l.product.image} alt="" width={32} height={32} className="w-full h-full object-cover" /> : <Package size={14} className="text-gray-300" />}
                                  </div>
                                  <span className="flex-1 min-w-0 truncate font-medium text-gray-900">{l.product.name}</span>
                                  <span className="text-xs text-gray-500 num whitespace-nowrap">{qty(l.quantity)} {l.product.unit} × {peso(l.unitCost)}</span>
                                  <span className="text-sm font-semibold text-gray-900 num w-24 text-right">{peso(l.totalCost)}</span>
                                </li>
                              ))}
                            </ul>
                            {d.note && d.referenceNo && <p className="text-[11px] text-gray-500 mt-2">Note: {d.note}</p>}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            <Pagination {...paging} onChange={paging.setPage} noun="deliveries" />
          </div>
        )}
      </div>

      {/* Stock adjustments: every non-sale, non-purchase change, with its reason */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-start gap-3 p-4 border-b border-gray-100">
          <SlidersHorizontal size={ICON_SIZE.md} className="text-gray-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="font-display font-extrabold text-gray-900">Stock adjustments</h2>
            <p className="text-xs text-gray-400 mt-0.5">Damaged, lost, returned, or corrected after a count. Made from Products → Stock.</p>
          </div>
        </div>
        {adjustments.length === 0 ? (
          <EmptyState icon={Boxes} title="No adjustments yet" description="Stock has only changed through sales and deliveries." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Product</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Change</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Reason</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">By</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {adjPaging.pageItems.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5 px-4">
                      <p className="font-medium text-gray-900">{a.product.name}</p>
                      <p className="text-[11px] text-gray-400">now {qty(a.stockAfter)} {a.product.unit}</p>
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold num whitespace-nowrap" style={{ color: a.change < 0 ? "var(--bad)" : "var(--good)" }}>
                      {a.change > 0 ? "+" : ""}{qty(a.change)} {a.product.unit}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600">
                      {a.reason}
                      {a.note && <p className="text-[11px] text-gray-400">{a.note}</p>}
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 hidden sm:table-cell">{a.recordedBy.username}</td>
                    <td className="py-2.5 px-4 text-gray-400 text-xs hidden sm:table-cell whitespace-nowrap">
                      {new Date(a.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination {...adjPaging} onChange={adjPaging.setPage} noun="adjustments" />
          </div>
        )}
      </div>

      <RestockModal
        open={modalLines !== null}
        initialLines={modalLines ?? []}
        products={products}
        categories={categories}
        planBy={planBy}
        onClose={() => setModalLines(null)}
        onSaved={({ lines, total }) => {
          setModalLines(null);
          showToast(`Delivery recorded: ${lines} product${lines === 1 ? "" : "s"}, ${peso(total)}. Stock updated.`);
          fetchAll();
          fetchPlan();
        }}
      />
    </div>
  );
}
