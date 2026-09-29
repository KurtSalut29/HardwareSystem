"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCheck, ChevronLeft, ChevronRight, Package, CalendarDays, TrendingUp } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type OItem = { id: number; quantity: number; product: { name: string } };
type Order = {
  id: number;
  totalAmount: number;
  status: string;
  dateTime: string;
  customer: { username: string };
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
    if (!selectedKey) return "All completed deliveries";
    const [y, m, d] = selectedKey.split("-").map(Number);
    const date = new Date(y, m, d);
    if (toDateKey(date) === toDateKey(today)) return "Today";
    return date.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  const cells = buildCalendar();

  return (
    <div className="space-y-5">
      <PageHeader title="Delivery History" subtitle="Every delivery you've completed." />

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="This week" value={thisWeek.length} icon={<CalendarDays size={ICON_SIZE.md} style={{ color: "var(--brand)" }} />} bg="var(--brand-soft)" />
        <StatTile label="This month" value={thisMonth.length} icon={<TrendingUp size={ICON_SIZE.md} className="text-indigo-600" />} bg="#EEF2FF" />
        <StatTile label="All time" value={delivered.length} icon={<CheckCheck size={ICON_SIZE.md} className="text-emerald-600" />} bg="#ECFDF5" />
      </div>

      <div className="flex flex-col md:flex-row gap-5 items-start">
        {/* Calendar */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 w-full md:w-72 md:shrink-0">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">
              <ChevronLeft size={ICON_SIZE.sm} />
            </button>
            <span className="text-sm font-semibold text-gray-900">{MONTHS[calMonth]} {calYear}</span>
            <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">
              <ChevronRight size={ICON_SIZE.sm} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const key = `${calYear}-${calMonth}-${day}`;
              const isToday = toDateKey(today) === key;
              const isSelected = selectedKey === key;
              const has = deliveredDateKeys.has(key);
              return (
                <button key={i} onClick={() => setSelectedKey(isSelected ? null : key)}
                  className={`relative w-8 h-8 mx-auto flex items-center justify-center rounded-lg text-xs font-medium transition
                    ${isSelected ? "bg-blue-600 text-white" : isToday ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-700 hover:bg-gray-100"}`}>
                  {day}
                  {has && (
                    <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isSelected ? "bg-white/60" : "bg-emerald-400"}`} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Deliveries</span>
              <span className="font-semibold text-gray-900">{shown.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Total value</span>
              <span className="font-semibold" style={{ color: "var(--brand)" }}>₱{shownValue.toFixed(2)}</span>
            </div>
            {selectedKey && (
              <button onClick={() => setSelectedKey(null)}
                className="w-full mt-2 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg py-1.5 transition border border-gray-200">
                Clear filter — show all
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-w-0 w-full bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-100 bg-gray-50">
            <span className="font-semibold text-gray-900 text-sm">{selectedLabel()}</span>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{shown.length} delivered</span>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 py-12 text-center">Loading...</p>
          ) : shown.length === 0 ? (
            <EmptyState icon={Package} title={selectedKey ? "No deliveries on this date" : "No completed deliveries yet"} />
          ) : (
            <div className="divide-y divide-gray-50">
              {shown.map((o) => (
                <div key={o.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#ECFDF5" }}>
                    <CheckCheck size={ICON_SIZE.sm} className="text-emerald-600" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Order #{o.id} — {o.customer.username}</p>
                    {o.deliveryAddress && <p className="text-xs text-gray-500 truncate">{o.deliveryAddress}</p>}
                    <p className="text-[11px] text-gray-400 truncate">{o.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900 num">₱{o.totalAmount.toFixed(2)}</p>
                    <p className="text-[11px] text-gray-400">{new Date(o.dateTime).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, icon, bg }: { label: string; value: string | number; icon: React.ReactNode; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-3 py-3 flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: bg }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide truncate">{label}</p>
        <p className="font-display text-base font-extrabold text-gray-900 num truncate leading-tight">{value}</p>
      </div>
    </div>
  );
}
