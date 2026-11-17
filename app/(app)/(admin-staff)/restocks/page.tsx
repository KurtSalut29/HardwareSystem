"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Truck, Boxes, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import FilterTiles, { type FilterTile } from "@/components/ui/FilterTiles";
import SearchField from "@/components/ui/SearchField";
import ProductThumb from "@/components/catalog/ProductThumb";
import EmptyState from "@/components/ui/EmptyState";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/ToastProvider";
import ReorderPlanner from "@/components/inventory/ReorderPlanner";
import RestockModal, { type Line, type RestockProduct, newLine, lineFromPlan } from "@/components/inventory/RestockModal";
import type { ReorderPlan, ReorderRow } from "@/lib/inventory";

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

type Section = "plan" | "deliveries" | "adjustments";

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
  const toOrder = (plan?.rows ?? []).filter((r) => r.status !== "ok").length;

  // Which section is open. Starts on the reorder plan only when something needs ordering.
  const [tabChoice, setTab] = useState<Section | null>(null);
  const tab: Section = tabChoice ?? (plan && toOrder === 0 ? "deliveries" : "plan");

  const TILES: FilterTile<Section>[] = [
    { key: "plan", label: "To reorder", value: plan ? toOrder : "–", icon: <ClipboardList className="size-5" />, tone: toOrder ? "warn" : "good", urgent: toOrder > 0, hint: plan ? `of ${plan.rows.length}` : undefined },
    { key: "deliveries", label: "Deliveries", value: deliveries.length, icon: <Truck className="size-5" />, tone: "brand", hint: `${deliveriesThisMonth} this month` },
    { key: "adjustments", label: "Stock adjustments", value: adjustments.length, icon: <SlidersHorizontal className="size-5" />, tone: "neutral" },
  ];

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title="Restocks"
        subtitle={loading ? "Loading deliveries…" : (
          <>
            <span className="font-semibold text-ink-2">{deliveriesThisMonth}</span> {deliveriesThisMonth === 1 ? "delivery" : "deliveries"} this month
            <span className="num"> · <span className="font-semibold text-ink-2">{peso(spentThisMonth)}</span> spent</span>
            {toOrder > 0 && <> · <span className="font-semibold text-warn">{toOrder} to reorder</span></>}
          </>
        )}
        action={<Button onClick={() => setModalLines([newLine()])} icon={<Plus className="size-4" />}>Record delivery</Button>}
      />

      <FilterTiles tiles={TILES} value={tab} onChange={setTab} label="Restock sections" loading={loading} cols={3} />

      {tab === "plan" && (
        <ReorderPlanner
          plan={plan}
          isAdmin={isAdmin}
          onOrder={(row: ReorderRow) => setModalLines([lineFromPlan(row)])}
          onSettingsSaved={() => { fetchPlan(); showToast("EOQ settings saved — suggestions updated."); }}
        />
      )}

      {/* Purchase history, one row per delivery */}
      {tab === "deliveries" && (
        <section aria-label="Supplier deliveries" className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
            <SearchField value={search} onChange={setSearch} placeholder="Product, supplier, DR no. or staff" label="Search deliveries" className="min-w-0 flex-1" />
            <p className="ml-auto text-[13px] text-ink-3">
              <span className="num font-semibold text-ink">{filtered.length}</span> {filtered.length === 1 ? "delivery" : "deliveries"}
              {filtered.length > 0 && <span className="num"> · {peso(filtered.reduce((s, d) => s + d.total, 0))}</span>}
            </p>
          </div>

          {loading ? (
            <ul className="divide-y divide-line">
              {Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="flex items-center gap-4 px-4 py-4">
                  <div className="h-4 w-40 animate-pulse rounded bg-recess" /><div className="h-4 flex-1 animate-pulse rounded bg-recess" />
                </li>
              ))}
            </ul>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Truck}
              title={restocks.length === 0 ? "No deliveries recorded yet" : "No deliveries match"}
              description={restocks.length === 0 ? "Record a supplier delivery to start tracking where your stock comes from." : "Try another product, supplier or DR number."}
              action={restocks.length === 0 ? <Button size="sm" onClick={() => setModalLines([newLine()])} icon={<Plus className="size-3.5" />}>Record delivery</Button> : undefined}
            />
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_130px_120px] gap-4 border-b border-line px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-4 md:grid">
                <span>Supplier</span><span>Products</span><span>Received</span><span className="text-right">Total</span>
              </div>
              <ul className="divide-y divide-line">
                {paging.pageItems.map((d) => {
                  const open = expanded === d.key;
                  return (
                    <li key={d.key} className={open ? "bg-subtle" : ""}>
                      <button type="button" onClick={() => setExpanded(open ? null : d.key)} aria-expanded={open}
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 text-left transition hover:bg-subtle md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_130px_120px]">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Truck className="size-4" /></span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1 truncate text-[14px] font-semibold text-ink">
                              {d.supplierName || "Supplier not recorded"}
                              {open ? <ChevronUp className="size-3.5 shrink-0 text-ink-4" /> : <ChevronDown className="size-3.5 shrink-0 text-ink-4" />}
                            </span>
                            <span className="block truncate font-code text-[11.5px] text-ink-4">{d.referenceNo ? `DR ${d.referenceNo}` : "No DR number"}</span>
                          </span>
                        </span>
                        <span className="num col-start-2 row-start-1 text-right font-display text-[15px] font-extrabold text-ink md:col-start-4">{peso(d.total)}</span>
                        <span className="col-span-2 truncate pl-[42px] text-[12.5px] text-ink-3 md:col-span-1 md:col-start-2 md:row-start-1 md:pl-0">
                          {d.lines.length === 1 ? d.lines[0].product.name : `${d.lines[0].product.name} +${d.lines.length - 1} more`}
                        </span>
                        <span className="col-span-2 pl-[42px] text-[12px] text-ink-4 md:col-span-1 md:col-start-3 md:row-start-1 md:pl-0">
                          {fmtDate(d.date)}<span className="hidden md:block">by {d.recordedBy}</span>
                        </span>
                      </button>
                      {open && (
                        <div className="px-4 pb-4">
                          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                            {d.lines.map((l) => (
                              <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                                <ProductThumb size="row" image={l.product.image} name={l.product.name} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13.5px] font-semibold text-ink">{l.product.name}</span>
                                  <span className="num block text-[12px] text-ink-4">{qty(l.quantity)} {l.product.unit} × {peso(l.unitCost)}</span>
                                </span>
                                <span className="num shrink-0 text-[13.5px] font-semibold text-ink">{peso(l.totalCost)}</span>
                              </li>
                            ))}
                            <li className="flex items-center justify-between bg-subtle px-3 py-2.5 font-display text-[14px] font-extrabold text-ink">
                              <span>Total · {d.lines.length} {d.lines.length === 1 ? "product" : "products"}</span><span className="num">{peso(d.total)}</span>
                            </li>
                          </ul>
                          <p className="mt-2 text-[12px] text-ink-4">
                            Recorded by {d.recordedBy} on {new Date(d.date).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
                            {d.note && <> · Note: <span className="text-ink-3">{d.note}</span></>}
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Pagination {...paging} onChange={paging.setPage} noun="deliveries" />
            </>
          )}
        </section>
      )}

      {/* Stock adjustments: every non-sale, non-purchase change, with its reason */}
      {tab === "adjustments" && (
        <section aria-label="Stock adjustments" className="overflow-hidden rounded-2xl border border-line bg-surface">
          <p className="flex items-center gap-2 border-b border-line px-4 py-3 text-[13px] text-ink-3">
            <SlidersHorizontal className="size-4 shrink-0 text-ink-4" />
            Damaged, lost, returned, or corrected after a count. Made from Products → Stock.
          </p>
          {adjustments.length === 0 ? (
            <EmptyState icon={Boxes} title="No adjustments yet" description="Stock has only changed through sales and deliveries." />
          ) : (
            <>
              <ul className="divide-y divide-line">
                {adjPaging.pageItems.map((a) => (
                  <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_110px_minmax(0,1fr)_130px]">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-ink">{a.product.name}</span>
                      <span className="num block text-[12px] text-ink-4">Now {qty(a.stockAfter)} {a.product.unit}</span>
                    </span>
                    <span className={`num text-right font-display text-[15px] font-extrabold ${a.change < 0 ? "text-bad" : "text-good"}`}>
                      {a.change > 0 ? "+" : ""}{qty(a.change)} <span className="text-[12px] font-semibold">{a.product.unit}</span>
                    </span>
                    <span className="col-span-2 min-w-0 text-[13px] text-ink-2 md:col-span-1">
                      {a.reason}{a.note && <span className="block truncate text-[12px] text-ink-4">{a.note}</span>}
                    </span>
                    <span className="col-span-2 text-[12px] text-ink-4 md:col-span-1">{fmtDate(a.date)}<span className="md:block"> · by {a.recordedBy.username}</span></span>
                  </li>
                ))}
              </ul>
              <Pagination {...adjPaging} onChange={adjPaging.setPage} noun="adjustments" />
            </>
          )}
        </section>
      )}

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
