"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCheck, ChevronLeft, ChevronRight, Package, CalendarDays, TrendingUp, MapPin, X } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import StatTile from "@/components/ui/StatTile";

import { customerLabel } from "@/lib/customer";
type OItem = { id: number; quantity: number; product: { name: string } };
type Order = {
  id: number;
  totalAmount: number;
  status: string;
  dateTime: string;
  customer: { username: string } | null; customerName?: string | null; customerContact?: string | null;
  items: OItem[];
  deliveryAddress?: string | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startOfWeek(d: Date) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

export default function DeliveryHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/orders");
    if (res.ok) {
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const delivered = orders.filter((o) => o.status === "delivered");

  const weekStart = startOfWeek(today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisWeek = delivered.filter((o) => new Date(o.dateTime) >= weekStart);
  const thisMonth = delivered.filter((o) => new Date(o.dateTime) >= monthStart);

  const shown = selectedKey
    ? delivered.filter((o) => toDateKey(new Date(o.dateTime)) === selectedKey)
    : delivered;
  const shownValue = shown.reduce((s, o) => s + o.totalAmount, 0);
  const paging = usePagination(shown, 10, selectedKey);

  const deliveredDateKeys = new Set(delivered.map((o) => toDateKey(new Date(o.dateTime))));

  function buildCalendar() {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  }

  function selectedLabel() {
    if (!selectedKey) return "All dates";
    const [y, m, d] = selectedKey.split("-").map(Number);
    const date = new Date(y, m, d);
    if (toDateKey(date) === toDateKey(today)) return "Today";
    return date.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
  }

  const cells = buildCalendar();
  const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Deliveries"
        title="Delivery history"
        subtitle={loading ? "Loading…" : <><span className="font-semibold text-ink-2">{delivered.length}</span> deliveries completed · <span className="font-semibold text-ink-2">{thisWeek.length}</span> this week</>}
      />

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <StatTile icon={<CalendarDays className="size-5" />} label="This week" value={loading ? "–" : thisWeek.length} caption="since Sunday" />
        <StatTile icon={<TrendingUp className="size-5" />} tone="neutral" label="This month" value={loading ? "–" : thisMonth.length} caption={MONTHS[today.getMonth()]} />
        <StatTile className="col-span-2 md:col-span-1" icon={<CheckCheck className="size-5" />} tone="good" label="All time" value={loading ? "–" : delivered.length} caption="completed" />
      </div>

      {/* Calendar: pick one day */}
      <Modal open={showCalendar} onClose={() => setShowCalendar(false)} title="Show deliveries from" icon={<CalendarDays className="size-5" />} description="Pick a day to see only its deliveries." size="sm">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={prevMonth} aria-label="Previous month" className="grid size-8 place-items-center rounded-lg text-ink-3 transition hover:bg-recess"><ChevronLeft className="size-4" /></button>
          <span className="font-display text-sm font-extrabold text-ink">{MONTHS[calMonth]} {calYear}</span>
          <button type="button" onClick={nextMonth} aria-label="Next month" className="grid size-8 place-items-center rounded-lg text-ink-3 transition hover:bg-recess"><ChevronRight className="size-4" /></button>
        </div>
        <div className="mb-1 grid grid-cols-7">
          {DAYS.map((d) => <div key={d} className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-ink-4">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const key = `${calYear}-${calMonth}-${day}`;
            const isToday = toDateKey(today) === key;
            const isSelected = selectedKey === key;
            const has = deliveredDateKeys.has(key);
            return (
              <button key={i} type="button" onClick={() => { setSelectedKey(isSelected ? null : key); setShowCalendar(false); }}
                className={`num relative mx-auto grid size-9 place-items-center rounded-lg text-xs font-semibold transition ${
                  isSelected ? "bg-brand text-white" : isToday ? "bg-brand-soft font-bold text-brand-ink" : "text-ink-2 hover:bg-recess"}`}>
                {day}
                {has && <span className={`absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full ${isSelected ? "bg-white/70" : "bg-good"}`} />}
              </button>
            );
          })}
        </div>
        <p className="mt-4 border-t border-line pt-3 text-[11.5px] text-ink-4">A green dot marks days you delivered.</p>
      </Modal>

      <section aria-label="Completed deliveries" className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className={`flex h-10 items-center rounded-xl border transition ${selectedKey ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong"}`}>
            <button type="button" onClick={() => setShowCalendar(true)} aria-haspopup="dialog" className="flex items-center gap-1.5 px-3 text-[13px] font-semibold">
              <CalendarDays className="size-4" /> {selectedKey ? selectedLabel() : "Any date"}
            </button>
            {selectedKey && (
              <button type="button" onClick={() => setSelectedKey(null)} aria-label="Show all dates" className="-ml-1.5 pr-2.5 hover:text-brand"><X className="size-3.5" /></button>
            )}
          </div>
          <p className="ml-auto text-[13px] text-ink-3">
            <span className="num font-semibold text-ink">{shown.length}</span> delivered
            {shown.length > 0 && <span className="num"> · {peso(shownValue)}</span>}
          </p>
        </div>

        {loading ? (
          <ul className="divide-y divide-line">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-4"><div className="size-9 animate-pulse rounded-xl bg-recess" /><div className="h-4 flex-1 animate-pulse rounded bg-recess" /></li>
            ))}
          </ul>
        ) : shown.length === 0 ? (
          <EmptyState icon={Package} title={selectedKey ? "No deliveries on this date" : "No completed deliveries yet"}
            description={selectedKey ? "Pick another day, or show all dates." : "Orders you deliver show up here."} />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {paging.pageItems.map((o) => (
                <li key={o.id} className="flex items-start gap-3 px-4 py-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-good-soft text-good"><CheckCheck className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-[14px] font-semibold text-ink">
                      {customerLabel(o)} <span className="font-code text-[12px] font-bold text-ink-4">#{o.id}</span>
                    </p>
                    {o.deliveryAddress && <p className="flex items-start gap-1 truncate text-[12.5px] text-ink-3"><MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-4" /><span className="truncate">{o.deliveryAddress}</span></p>}
                    <p className="truncate text-[12px] text-ink-4">{o.items.length > 1 ? `${o.items[0].product.name} +${o.items.length - 1} more` : o.items[0]?.product.name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num font-display text-[15px] font-extrabold text-ink">{peso(o.totalAmount)}</p>
                    <p className="text-[11.5px] text-ink-4">{new Date(o.dateTime).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination {...paging} onChange={paging.setPage} noun="deliveries" />
          </>
        )}
      </section>
    </div>
  );
}
