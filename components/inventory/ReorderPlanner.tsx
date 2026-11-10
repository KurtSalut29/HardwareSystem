"use client";

import { useState } from "react";
import { Calculator, SlidersHorizontal, PackagePlus, ChevronDown } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import type { EoqSettings, ReorderPlan, ReorderRow } from "@/lib/inventory";

const qty = (n: number) => String(Math.round(n * 100) / 100);
const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_STYLE = {
  out: { label: "Out of stock", fg: "var(--bad)", bg: "var(--bad-soft)" },
  reorder: { label: "Reorder now", fg: "var(--warn)", bg: "var(--warn-soft)" },
  ok: { label: "OK", fg: "var(--good)", bg: "var(--good-soft)" },
} as const;

export function StatusChip({ status }: { status: ReorderRow["status"] }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="inline-block text-[10px] font-bold px-2 py-[3px] rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

/**
 * EOQ reorder planner for the Restocks page: which products to order, how many
 * (EOQ), and when (reorder point), with the formula and the settings behind it.
 */
export default function ReorderPlanner({
  plan,
  isAdmin,
  onOrder,
  onSettingsSaved,
}: {
  plan: ReorderPlan | null;
  isAdmin: boolean;
  onOrder: (row: ReorderRow) => void;
  onSettingsSaved: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const rows = plan?.rows ?? [];
  const rank = { out: 0, reorder: 1, ok: 2 } as const;
  const attention = rows
    .filter((r) => r.status !== "ok")
    .sort((a, b) => rank[a.status] - rank[b.status] || a.stock / a.reorderPoint - b.stock / b.reorderPoint);
  const outCount = attention.filter((r) => r.status === "out").length;
  const reorderCount = attention.length - outCount;
  const visible = showAll
    ? [...rows].sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name))
    : attention;
  const paging = usePagination(visible, 10);
  const s = plan?.settings;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex flex-wrap items-start gap-3 p-4 border-b border-gray-100">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>
            <Calculator size={ICON_SIZE.md} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display font-extrabold text-gray-900 flex items-center gap-2">
              Reorder planner
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--bg-muted)", color: "var(--text-muted)" }}>EOQ</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              What to order, how many, and when, based on the last {plan?.windowDays ?? 90} days of sales.
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)} icon={<SlidersHorizontal size={ICON_SIZE.sm} />}>
            EOQ settings
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>
          {outCount} out of stock
        </span>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
          {reorderCount} at reorder point
        </span>
        <div className="ml-auto flex rounded-lg border border-gray-200 p-0.5 text-xs font-semibold" role="tablist" aria-label="Products shown">
          {[
            { all: false, label: `Needs ordering (${attention.length})` },
            { all: true, label: `All products (${rows.length})` },
          ].map((t) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={showAll === t.all}
              onClick={() => { setShowAll(t.all); paging.setPage(1); }}
              className="px-2.5 py-1 rounded-md transition"
              style={showAll === t.all ? { background: "var(--brand)", color: "#fff" } : { color: "var(--text-muted)" }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!plan ? (
        <p className="text-sm text-gray-400 py-10 text-center">Loading...</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">Nothing needs ordering right now. Every product is above its reorder point.</p>
      ) : (
        <div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Product</th>
                <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">In stock</th>
                <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell" title="Average units sold per day">Sold / day</th>
                <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide" title="Order again when stock falls to this">Reorder at</th>
                <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide" title="Economic Order Quantity: how many to order">Order qty</th>
                <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell" title="Days until stock runs out at the current pace">Days left</th>
                <th className="py-2.5 px-4" aria-label="Action" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paging.pageItems.map((r) => (
                <tr key={r.productId} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-2.5 px-4">
                    <p className="font-medium text-gray-900 truncate max-w-[220px]">{r.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <StatusChip status={r.status} />
                      <span className="text-[11px] text-gray-400 truncate">{r.category}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold num whitespace-nowrap" style={{ color: STATUS_STYLE[r.status].fg }}>
                    {qty(r.stock)} <span className="text-[11px] font-normal text-gray-400">{r.unit}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-500 num hidden md:table-cell">{r.dailyDemand > 0 ? qty(r.dailyDemand) : "—"}</td>
                  <td className="py-2.5 px-4 text-right text-gray-700 num" title={r.reorderBasis === "default" ? "No sales yet: a fixed minimum is used" : undefined}>
                    {r.reorderPoint}{r.reorderBasis === "default" && <span className="text-[10px] text-gray-400"> *</span>}
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-gray-900 num" title={r.costSource === "price" ? "No purchase cost recorded yet: selling price used as an estimate" : undefined}>
                    {r.eoq ?? "—"}{r.eoq != null && r.costSource === "price" && <span className="text-[10px] font-normal text-gray-400"> est.</span>}
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-500 num hidden md:table-cell">{r.daysLeft == null ? "—" : r.daysLeft}</td>
                  <td className="py-2.5 px-4 text-right">
                    <Button size="sm" variant={r.status === "ok" ? "secondary" : "primary"} onClick={() => onOrder(r)} icon={<PackagePlus size={ICON_SIZE.sm} />}>
                      <span className="whitespace-nowrap">{r.eoq != null ? `Order ${r.eoq}` : "Order"}</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...paging} onChange={paging.setPage} noun="products" />
        </div>
      )}

      {s && (
        <details className="group border-t border-gray-100">
          <summary className="flex items-center gap-2 px-4 py-3 text-xs font-semibold cursor-pointer select-none list-none" style={{ color: "var(--brand)" }}>
            <ChevronDown size={ICON_SIZE.sm} className="transition-transform group-open:rotate-180" />
            How these numbers are computed
          </summary>
          <div className="px-4 pb-4 grid gap-3 md:grid-cols-2 text-xs text-gray-600 leading-relaxed">
            <div className="rounded-lg p-3" style={{ background: "var(--bg-muted)" }}>
              <p className="font-bold text-gray-900 mb-1">Order quantity: EOQ = √(2 × D × S ÷ H)</p>
              <p><b>D</b> = yearly demand: units sold in the last {plan.windowDays} days, scaled to a year.</p>
              <p><b>S</b> = cost of placing one order: <b>{peso(s.orderCost)}</b>.</p>
              <p><b>H</b> = yearly cost of keeping one unit in stock: <b>{s.holdingRate}%</b> of its unit cost (the latest purchase cost on this page).</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: "var(--bg-muted)" }}>
              <p className="font-bold text-gray-900 mb-1">Reorder point = sold per day × (lead time + safety days)</p>
              <p>Lead time: <b>{s.leadTimeDays} {s.leadTimeDays === 1 ? "day" : "days"}</b> from ordering until stock arrives.</p>
              <p>Safety stock: <b>{s.safetyDays} {s.safetyDays === 1 ? "day" : "days"}</b> of extra sales, for late deliveries or busy days.</p>
              <p className="mt-1 text-gray-400">* No sales yet: reorder at 5. <i>est.</i> No purchase recorded yet: the selling price stands in for the unit cost.</p>
            </div>
          </div>
        </details>
      )}

      {isAdmin && s && (
        <EoqSettingsModal
          open={settingsOpen}
          initial={s}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => { setSettingsOpen(false); onSettingsSaved(); }}
        />
      )}
    </div>
  );
}

const FIELDS: { key: keyof EoqSettings; label: string; suffix: string; step: string; hint: string }[] = [
  { key: "orderCost", label: "Ordering cost (S)", suffix: "₱ per order", step: "1", hint: "Delivery fee, transport and time spent on one supplier order." },
  { key: "holdingRate", label: "Holding cost", suffix: "% of unit cost per year", step: "1", hint: "Storage, damage and money tied up in stock. 20 to 25% is typical." },
  { key: "leadTimeDays", label: "Supplier lead time", suffix: "days", step: "1", hint: "Days from placing an order until the stock arrives." },
  { key: "safetyDays", label: "Safety stock", suffix: "days of sales", step: "1", hint: "Extra cover for late deliveries or unusually busy days." },
];

function EoqSettingsModal({ open, initial, onClose, onSaved }: { open: boolean; initial: EoqSettings; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(() => toForm(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [wasOpen, setWasOpen] = useState(open);

  // Start from the saved values each time the modal opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setForm(toForm(initial)); setError(""); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/inventory/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key])]))),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "Couldn't save the settings."); return; }
    onSaved();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="EOQ settings"
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="eoq-settings-form" className="flex-1" loading={saving}>Save</Button>
        </div>
      }
    >
      <form id="eoq-settings-form" onSubmit={save} className="space-y-4">
        <p className="text-xs text-gray-500">These apply to every product. Order quantities and reorder points update as soon as you save.</p>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`eoq-${f.key}`} className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
            <div className="flex items-center gap-2">
              <input
                id={`eoq-${f.key}`}
                required
                type="number"
                min={f.key === "holdingRate" ? 1 : 0}
                step={f.step}
                value={form[f.key]}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                className="w-32 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
              />
              <span className="text-xs text-gray-500">{f.suffix}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">{f.hint}</p>
          </div>
        ))}
        {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      </form>
    </Modal>
  );
}

function toForm(s: EoqSettings): Record<keyof EoqSettings, string> {
  return { orderCost: String(s.orderCost), holdingRate: String(s.holdingRate), leadTimeDays: String(s.leadTimeDays), safetyDays: String(s.safetyDays) };
}
