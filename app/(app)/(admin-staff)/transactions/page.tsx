"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Package, Receipt, Banknote, TrendingUp, Calculator, Clock, CalendarDays } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import { CardHeader } from "@/components/dashboard/DashboardParts";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import Image from "next/image";

type TItem = { id: number; quantity: number; price: number; product: { name: string; image: string | null; subcategory: string | null } };
type Transaction = { id: number; totalAmount: number; paymentMethod: string; dateTime: string; type: string; user: { username: string }; items: TItem[] };

type Mode = "today" | "week" | "month" | "day" | "custom";
type Range = { mode: Mode; from: Date; to: Date };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const inputValue = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromInput = (v: string) => { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d); };
const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pesoShort = (n: number) => n >= 1000000 ? `₱${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `₱${(n / 1000).toFixed(1)}k` : `₱${Math.round(n)}`;
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "AM" : "PM"}`;

function rangeFor(mode: Exclude<Mode, "day" | "custom">, now = new Date()): Range {
  const to = endOfDay(now);
  if (mode === "today") return { mode, from: startOfDay(now), to };
  if (mode === "week") {
    // Weeks start on Monday, the way the store counts its week.
    const offset = (now.getDay() + 6) % 7;
    return { mode, from: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)), to };
  }
  return { mode, from: new Date(now.getFullYear(), now.getMonth(), 1), to };
}

function rangeLabel(r: Range) {
  const today = new Date();
  const sameDay = dayKey(r.from) === dayKey(r.to);
  if (sameDay) {
    if (dayKey(r.from) === dayKey(today)) return "Today";
    return r.from.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const sameYear = r.from.getFullYear() === r.to.getFullYear();
  return `${r.from.toLocaleDateString("en-PH", sameYear ? opts : { ...opts, year: "numeric" })} – ${r.to.toLocaleDateString("en-PH", { ...opts, year: "numeric" })}`;
}

const MODE_TABS: { key: Exclude<Mode, "day">; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [range, setRange] = useState<Range>(() => rangeFor("today"));

  useEffect(() => {
    fetch("/api/transactions")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setTransactions(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const txDateKeys = useMemo(() => new Set(transactions.map((t) => dayKey(new Date(t.dateTime)))), [transactions]);

  const inRange = useMemo(() => {
    const from = range.from.getTime(), to = range.to.getTime();
    return transactions.filter((t) => { const ts = new Date(t.dateTime).getTime(); return ts >= from && ts <= to; });
  }, [transactions, range]);

  const rangeKey = `${range.mode}:${range.from.getTime()}:${range.to.getTime()}`;
  const paging = usePagination(inRange, 10, rangeKey);

  // ── Summary ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = inRange.reduce((s, t) => s + t.totalAmount, 0);
    const sum = (f: (t: Transaction) => boolean) => inRange.filter(f).reduce((s, t) => s + t.totalAmount, 0);
    const count = (f: (t: Transaction) => boolean) => inRange.filter(f).length;
    const isCash = (t: Transaction) => t.paymentMethod === "Cash";
    const isGcash = (t: Transaction) => t.paymentMethod === "GCash";
    const isOnline = (t: Transaction) => t.type === "Online";
    return {
      count: inRange.length,
      total,
      average: inRange.length ? total / inRange.length : 0,
      cash: sum(isCash), cashCount: count(isCash),
      gcash: sum(isGcash), gcashCount: count(isGcash),
      other: sum((t) => !isCash(t) && !isGcash(t)), otherCount: count((t) => !isCash(t) && !isGcash(t)),
      pos: sum((t) => !isOnline(t)), posCount: count((t) => !isOnline(t)),
      online: sum(isOnline), onlineCount: count(isOnline),
    };
  }, [inRange]);

  // Days covered so far: a range that runs into the future only counts up to today.
  const lastDayTs = Math.min(range.to.getTime(), endOfDay(today).getTime());
  const fromTs = range.from.getTime();
  const dayCount = Math.max(1, Math.round((startOfDay(new Date(lastDayTs)).getTime() - startOfDay(range.from).getTime()) / DAY_MS) + 1);
  const multiDay = dayCount > 1;

  // ── Per-day breakdown, newest first, every day in the range ───────────────
  const perDay = useMemo(() => {
    if (!multiDay) return [];
    const map = new Map<string, { count: number; total: number }>();
    for (const t of inRange) {
      const k = dayKey(new Date(t.dateTime));
      const e = map.get(k) ?? { count: 0, total: 0 };
      e.count += 1; e.total += t.totalAmount;
      map.set(k, e);
    }
    const days: { date: Date; count: number; total: number }[] = [];
    for (let d = startOfDay(new Date(lastDayTs)); d.getTime() >= fromTs; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)) {
      const e = map.get(dayKey(d)) ?? { count: 0, total: 0 };
      days.push({ date: d, ...e });
    }
    return days;
  }, [inRange, multiDay, lastDayTs, fromTs]);
  const bestDayTotal = Math.max(1, ...perDay.map((d) => d.total));
  const dayPaging = usePagination(perDay, 7, rangeKey);

  // ── Peak hours ───────────────────────────────────────────────────────────
  const hourly = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: hourLabel(h), count: 0, total: 0 }));
    for (const t of inRange) {
      const h = new Date(t.dateTime).getHours();
      counts[h].count += 1; counts[h].total += t.totalAmount;
    }
    const used = counts.filter((c) => c.count > 0).map((c) => c.hour);
    // Store hours by default, widened if a sale happened outside them.
    const first = Math.min(7, ...used), last = Math.max(18, ...used);
    return counts.slice(first, last + 1);
  }, [inRange]);
  const peak = hourly.reduce<(typeof hourly)[number] | null>((best, h) => (h.count > (best?.count ?? 0) ? h : best), null);

  // ── Calendar ─────────────────────────────────────────────────────────────
  function selectDay(d: Date) {
    setRange({ mode: "day", from: startOfDay(d), to: endOfDay(d) });
    setExpanded(null);
  }
  function selectMode(mode: Exclude<Mode, "day">) {
    setExpanded(null);
    if (mode === "custom") {
      setRange((r) => ({ mode: "custom", from: r.mode === "today" || r.mode === "day" ? startOfDay(new Date(today.getTime() - 6 * DAY_MS)) : r.from, to: r.to }));
      return;
    }
    setRange(rangeFor(mode));
  }

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
  const cells = buildCalendar();
  const label = rangeLabel(range);

  return (
    <div className="space-y-5">
      <PageHeader title="Transactions" subtitle="Sales rung up at the POS and delivered online orders" />

      {/* Period picker */}
      <div className="bg-white rounded-xl border border-gray-200 px-3 py-2.5 flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {MODE_TABS.map((t) => {
            const active = range.mode === t.key;
            return (
              <button key={t.key} onClick={() => selectMode(t.key)} aria-pressed={active}
                className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                  active ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}>
                {t.label}
              </button>
            );
          })}
        </div>
        {range.mode === "custom" && (
          <div className="flex items-center gap-1.5 text-xs">
            <input type="date" aria-label="From" value={inputValue(range.from)} max={inputValue(range.to)}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: startOfDay(fromInput(e.target.value)) }))}
              className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            <span className="text-gray-400">to</span>
            <input type="date" aria-label="To" value={inputValue(range.to)} min={inputValue(range.from)} max={inputValue(today)}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: endOfDay(fromInput(e.target.value)) }))}
              className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          <CalendarDays size={ICON_SIZE.xs} className="text-gray-400" />
          {label}{multiDay && <span className="text-gray-400 font-medium">· {dayCount} days</span>}
        </span>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">Loading...</div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <SummaryTile icon={<Receipt size={ICON_SIZE.sm} />} label="Transactions" value={stats.count.toLocaleString()}
              caption={multiDay ? `about ${(stats.count / dayCount).toFixed(1)} per day` : "sales recorded"} />
            <SummaryTile icon={<TrendingUp size={ICON_SIZE.sm} />} label="Total sales" value={peso(stats.total)}
              caption={multiDay ? `about ${pesoShort(stats.total / dayCount)} per day` : "money taken in"} />
            <SummaryTile className="col-span-2 sm:col-span-1" icon={<Calculator size={ICON_SIZE.sm} />} label="Average sale" value={peso(stats.average)} caption="per transaction" />
            <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 sm:col-span-3 lg:col-span-1 space-y-2.5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5"><Banknote size={ICON_SIZE.xs} /> Breakdown</p>
              <SplitBar total={stats.total} parts={[
                { label: "Cash", amount: stats.cash, count: stats.cashCount },
                { label: "GCash", amount: stats.gcash, count: stats.gcashCount },
                ...(stats.otherCount ? [{ label: "Card", amount: stats.other, count: stats.otherCount }] : []),
              ]} />
              <SplitBar total={stats.total} parts={[
                { label: "POS", amount: stats.pos, count: stats.posCount },
                { label: "Online", amount: stats.online, count: stats.onlineCount },
              ]} />
            </div>
          </div>

          {/* Per-day + peak hours */}
          <div className={`grid gap-5 ${multiDay ? "lg:grid-cols-2" : ""}`}>
            {multiDay && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                <CardHeader className="px-5 pt-5 pb-3" icon={<CalendarDays size={ICON_SIZE.sm} className="text-blue-600" />} title="Sales per day"
                  description="Number of transactions and total for each day. Tap a day to see its sales." />
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left py-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Day</th>
                        <th className="text-right py-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Sales</th>
                        <th className="text-right sm:text-left py-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {dayPaging.pageItems.map((d) => (
                        <tr key={d.date.getTime()} onClick={() => selectDay(d.date)} className="cursor-pointer hover:bg-blue-50/40 transition-colors">
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="font-medium text-gray-900">{d.date.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}</span>
                            {dayKey(d.date) === dayKey(today) && <span className="ml-1.5 text-[10px] font-bold text-blue-600">TODAY</span>}
                          </td>
                          <td className={`py-2.5 px-4 text-right num ${d.count ? "text-gray-700" : "text-gray-300"}`}>{d.count}</td>
                          <td className="py-2.5 px-4 w-1/2">
                            <div className="flex items-center gap-2">
                              <div className="hidden sm:block flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden min-w-[40px]">
                                <div className="h-full rounded-full" style={{ width: `${(d.total / bestDayTotal) * 100}%`, background: "var(--brand)" }} />
                              </div>
                              <span className={`num text-xs font-semibold whitespace-nowrap ml-auto sm:w-[84px] text-right ${d.total ? "text-gray-900" : "text-gray-300"}`}>{peso(d.total)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...dayPaging} onChange={dayPaging.setPage} noun="days" />
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
              <CardHeader className="px-5 pt-5 pb-3" icon={<Clock size={ICON_SIZE.sm} className="text-blue-600" />} title="Peak hours"
                description={peak
                  ? `Busiest at ${peak.label}–${hourLabel((peak.hour + 1) % 24)} with ${peak.count} sale${peak.count === 1 ? "" : "s"}. Plan staff around the tall bars.`
                  : "When customers buy, hour by hour. No sales in this period yet."} />
              <div className="px-2 pb-3 pt-1 flex-1 min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 220 }}>
                  <BarChart data={hourly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={6} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip cursor={{ fill: "#f1f5f9" }}
                      formatter={(v, name, item) => name === "count" ? [`${v} sale${v === 1 ? "" : "s"} · ${peso((item.payload as { total: number }).total)}`, "Sales"] : [v, name]}
                      labelFormatter={(l) => `${l}`}
                      contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                      {hourly.map((h) => (
                        <Cell key={h.hour} fill={peak && h.hour === peak.hour ? "#12327F" : "#1E4FD8"} fillOpacity={peak && h.hour === peak.hour ? 1 : 0.55} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-5 items-start">
            {/* Calendar: pick one day */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 w-full md:w-72 md:shrink-0">
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} aria-label="Previous month" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">
                  <ChevronLeft size={15} />
                </button>
                <span className="text-sm font-semibold text-gray-900">{MONTHS[calMonth]} {calYear}</span>
                <button onClick={nextMonth} aria-label="Next month" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">
                  <ChevronRight size={15} />
                </button>
              </div>

              <div className="grid grid-cols-7 mb-1">
                {DAYS.map((d) => (
                  <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-1">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const date = new Date(calYear, calMonth, day);
                  const key = dayKey(date);
                  const isToday = dayKey(today) === key;
                  const ts = date.getTime();
                  const inSel = ts >= startOfDay(range.from).getTime() && ts <= range.to.getTime();
                  const single = inSel && !multiDay;
                  const hasTxns = txDateKeys.has(key);
                  return (
                    <button key={i} onClick={() => selectDay(date)}
                      className={`relative w-8 h-8 mx-auto flex items-center justify-center rounded-lg text-xs font-medium transition
                        ${single ? "bg-blue-600 text-white" : inSel ? "bg-blue-100 text-blue-700" : isToday ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-700 hover:bg-gray-100"}`}>
                      {day}
                      {hasTxns && (
                        <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${single ? "bg-white/60" : "bg-blue-400"}`} />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400">Tap a date to see that day only. Dots mark days with sales.</p>
            </div>

            {/* Transaction list for the period */}
            <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-gray-50">
                <span className="font-semibold text-gray-900 text-sm">{label}</span>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">{stats.count} transactions</span>
                {stats.count > 0 && (
                  <span className="ml-auto text-xs font-semibold text-gray-700">Total: {peso(stats.total)}</span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide w-8"></th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">ID</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Handled by</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Type</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Payment</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">{multiDay ? "Date" : "Time"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {inRange.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState icon={Receipt} title="No transactions in this period" description="Pick another period or date to view its transactions." />
                        </td>
                      </tr>
                    ) : paging.pageItems.map((t) => (
                      <React.Fragment key={t.id}>
                        <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                          <td className="py-3 px-4 text-gray-400">
                            {expanded === t.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">#{t.id}</td>
                          <td className="py-3 px-4 text-gray-600 hidden sm:table-cell">{t.user.username}</td>
                          <td className="py-3 px-4 hidden sm:table-cell"><Badge label={t.type} /></td>
                          <td className="py-3 px-4 text-gray-500">{t.paymentMethod}</td>
                          <td className="py-3 px-4 font-semibold text-gray-900">{peso(t.totalAmount)}</td>
                          <td className="py-3 px-4 text-gray-400 text-xs hidden sm:table-cell whitespace-nowrap">
                            {multiDay
                              ? new Date(t.dateTime).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                              : new Date(t.dateTime).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                        </tr>
                        {expanded === t.id && (
                          <tr className="bg-blue-50/30">
                            <td colSpan={7} className="px-6 py-4">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Items Purchased</p>
                              <div className="flex flex-col gap-2">
                                {t.items.map((i) => (
                                  <div key={i.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-3 py-2.5">
                                    <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                      {i.product.image ? (
                                        <Image src={i.product.image} alt={i.product.name} width={40} height={40} className="w-full h-full object-cover" />
                                      ) : (
                                        <Package size={16} className="text-gray-300" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">{i.product.name}</p>
                                      {i.product.subcategory && <p className="text-[11px] text-blue-500">{i.product.subcategory}</p>}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <p className="text-xs text-gray-400">₱{i.price.toFixed(2)} × {i.quantity}</p>
                                      <p className="text-sm font-semibold text-gray-900">₱{(i.price * i.quantity).toFixed(2)}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
                                <span className="text-xs text-gray-500 mr-2">Total</span>
                                <span className="text-sm font-bold text-gray-900">{peso(t.totalAmount)}</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...paging} onChange={(p) => { paging.setPage(p); setExpanded(null); }} noun="transactions" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryTile({ icon, label, value, caption, className = "" }: { icon: React.ReactNode; label: string; value: string; caption: string; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 min-w-0 ${className}`}>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
        <span className="text-blue-600">{icon}</span> {label}
      </p>
      <p className="font-display text-lg sm:text-xl font-extrabold text-gray-900 num mt-1.5 truncate">{value}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{caption}</p>
    </div>
  );
}

const SPLIT_COLORS = ["var(--brand)", "#93B4F5", "#CBD5E1"];

/** Shares of the total in one bar, with each part's amount and count. */
function SplitBar({ parts, total }: { parts: { label: string; amount: number; count: number }[]; total: number }) {
  return (
    <div>
      <div className="flex flex-wrap justify-between text-[11px] mb-1 gap-x-3 gap-y-0.5">
        {parts.map((p, i) => (
          <span key={p.label} className="inline-flex items-center gap-1 text-gray-600 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: SPLIT_COLORS[i] }} />
            <span className="font-semibold text-gray-900">{p.label}</span> {pesoShort(p.amount)} <span className="text-gray-400">({p.count})</span>
          </span>
        ))}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden flex bg-gray-100">
        {total > 0 && parts.map((p, i) => (
          <div key={p.label} style={{ width: `${(p.amount / total) * 100}%`, background: SPLIT_COLORS[i] }} />
        ))}
      </div>
    </div>
  );
}
