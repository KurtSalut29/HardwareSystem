"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, Calculator, CreditCard, Smartphone, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Receipt, Clock, CalendarDays, Globe, Store } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import PageHeader from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";
import Segmented from "@/components/ui/Segmented";
import ProductThumb from "@/components/catalog/ProductThumb";
import EmptyState from "@/components/ui/EmptyState";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import { CardHeader } from "@/components/dashboard/DashboardParts";

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
  const [showCalendar, setShowCalendar] = useState(false);
  const [view, setView] = useState<"list" | "insights">("list");

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales"
        title="Transactions"
        subtitle={loading ? "Loading sales…" : (
          <>
            <span className="font-semibold text-ink-2">{label}</span>
            {multiDay && <> ({dayCount} days)</>}
            {" · "}<span className="num font-semibold text-ink-2">{stats.count.toLocaleString()}</span> {stats.count === 1 ? "sale" : "sales"}
            <span className="num"> · <span className="font-semibold text-ink-2">{peso(stats.total)}</span></span>
          </>
        )}
      />

      {/* Calendar: pick one day */}
      <Modal open={showCalendar} onClose={() => setShowCalendar(false)} title="Show sales from" size="sm">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={prevMonth} aria-label="Previous month" className="grid size-8 place-items-center rounded-lg text-ink-3 transition hover:bg-recess">
            <ChevronLeft className="size-4" />
          </button>
          <span className="font-display text-sm font-extrabold text-ink">{MONTHS[calMonth]} {calYear}</span>
          <button type="button" onClick={nextMonth} aria-label="Next month" className="grid size-8 place-items-center rounded-lg text-ink-3 transition hover:bg-recess">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="mb-1 grid grid-cols-7">
          {DAYS.map((d) => <div key={d} className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-ink-4">{d}</div>)}
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
              <button key={i} type="button" onClick={() => { selectDay(date); setShowCalendar(false); }}
                className={`num relative mx-auto grid size-9 place-items-center rounded-lg text-xs font-semibold transition ${
                  single ? "bg-brand text-white" : inSel ? "bg-brand-soft text-brand-ink" : isToday ? "bg-brand-soft font-bold text-brand-ink" : "text-ink-2 hover:bg-recess"}`}>
                {day}
                {hasTxns && <span className={`absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full ${single ? "bg-white/70" : "bg-brand"}`} />}
              </button>
            );
          })}
        </div>
        <p className="mt-4 border-t border-line pt-3 text-[11px] text-ink-4">Tap a date to see that day only. Dots mark days with sales.</p>
      </Modal>

      {/* Period */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented options={MODE_TABS} value={range.mode === "day" ? ("none" as Exclude<Mode, "day">) : range.mode} onChange={selectMode} label="Period" />
        <button type="button" onClick={() => { setCalYear(range.from.getFullYear()); setCalMonth(range.from.getMonth()); setShowCalendar(true); }} aria-haspopup="dialog"
          className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold transition ${
            range.mode === "day" ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong"}`}>
          <CalendarDays className="size-4" /> {range.mode === "day" ? label : "Pick a day"}
        </button>
        {range.mode === "custom" && (
          <div className="flex items-center gap-1.5 text-xs">
            <input type="date" aria-label="From" value={inputValue(range.from)} max={inputValue(range.to)}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: startOfDay(fromInput(e.target.value)) }))}
              className="h-9 rounded-xl border border-line bg-surface px-2.5 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
            <span className="text-ink-4">to</span>
            <input type="date" aria-label="To" value={inputValue(range.to)} min={inputValue(range.from)} max={inputValue(today)}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: endOfDay(fromInput(e.target.value)) }))}
              className="h-9 rounded-xl border border-line bg-surface px-2.5 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        <SummaryTile icon={<Receipt className="size-5" />} label="Sales" value={loading ? "–" : stats.count.toLocaleString()}
          caption={multiDay ? `about ${(stats.count / dayCount).toFixed(1)} a day` : "transactions recorded"} />
        <SummaryTile icon={<Banknote className="size-5" />} label="Total taken in" value={loading ? "–" : peso(stats.total)}
          caption={multiDay ? `about ${pesoShort(stats.total / dayCount)} a day` : "cash, GCash and card"} />
        <div className="col-span-2 lg:col-span-1">
          <SummaryTile icon={<Calculator className="size-5" />} label="Average sale" value={loading ? "–" : peso(stats.average)} caption="per transaction" />
        </div>
      </div>

      {/* Where the money came from: how customers paid, and counter vs online */}
      <div className="grid gap-2.5 md:grid-cols-2">
        <Breakdown title="How customers paid" total={stats.total} rows={[
          { label: "Cash", icon: <Banknote className="size-4" />, amount: stats.cash, count: stats.cashCount },
          { label: "GCash", icon: <Smartphone className="size-4" />, amount: stats.gcash, count: stats.gcashCount },
          ...(stats.otherCount ? [{ label: "Card", icon: <CreditCard className="size-4" />, amount: stats.other, count: stats.otherCount }] : []),
        ]} />
        <Breakdown title="Where the sale happened" total={stats.total} rows={[
          { label: "Counter (POS)", icon: <Store className="size-4" />, amount: stats.pos, count: stats.posCount },
          { label: "Online orders", icon: <Globe className="size-4" />, amount: stats.online, count: stats.onlineCount },
        ]} />
      </div>

      <Segmented options={[{ key: "list", label: "Sales list", count: stats.count }, { key: "insights", label: "Insights" }]}
        value={view} onChange={setView} label="Show" />

      {view === "insights" && !loading && (
        <div className={`grid gap-5 ${multiDay ? "lg:grid-cols-2" : ""}`}>
          {multiDay && (
            <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              <CardHeader className="px-5 pb-3 pt-5" icon={<CalendarDays className="size-3.5 text-brand" />} title="Sales per day"
                description="Tap a day to see its sales." />
              <ul className="flex-1 divide-y divide-line border-t border-line">
                {dayPaging.pageItems.map((d) => (
                  <li key={d.date.getTime()}>
                    <button type="button" onClick={() => { selectDay(d.date); setView("list"); }}
                      className="grid w-full grid-cols-[110px_40px_minmax(0,1fr)_96px] items-center gap-3 px-5 py-2.5 text-left transition hover:bg-subtle">
                      <span className="whitespace-nowrap text-[13px] font-semibold text-ink">
                        {d.date.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                      <span className={`num text-right text-[13px] ${d.count ? "text-ink-2" : "text-ink-4"}`}>{d.count}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-recess">
                        <span className="block h-full rounded-full bg-brand" style={{ width: `${(d.total / bestDayTotal) * 100}%` }} />
                      </span>
                      <span className={`num text-right text-[13px] font-semibold ${d.total ? "text-ink" : "text-ink-4"}`}>{peso(d.total)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination {...dayPaging} onChange={dayPaging.setPage} noun="days" />
            </div>
          )}

          <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            <CardHeader className="px-5 pb-3 pt-5" icon={<Clock className="size-3.5 text-brand" />} title="Peak hours"
              description={peak
                ? `Busiest at ${peak.label}–${hourLabel((peak.hour + 1) % 24)} with ${peak.count} sale${peak.count === 1 ? "" : "s"}. Plan staff around the tall bars.`
                : "When customers buy, hour by hour. No sales in this period yet."} />
            <div className="min-h-[240px] flex-1 px-2 pb-3 pt-1">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 240 }}>
                <BarChart data={hourly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={6} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip cursor={{ fill: "var(--bg-muted)" }}
                    formatter={(v, name, item) => name === "count" ? [`${v} sale${v === 1 ? "" : "s"} · ${peso((item.payload as { total: number }).total)}`, "Sales"] : [v, name]}
                    labelFormatter={(l) => `${l}`}
                    contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: "12px" }} />
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
      )}

      {/* Transaction list for the period */}
      {view === "list" && (
        <section aria-label="Sales" className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="hidden grid-cols-[150px_minmax(0,1fr)_110px_130px] gap-4 border-b border-line px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-4 md:grid">
            <span>Sale</span><span>Handled by</span><span>Payment</span><span className="text-right">Amount</span>
          </div>
          {loading ? (
            <ul className="divide-y divide-line">
              {Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="flex items-center gap-4 px-4 py-4"><div className="h-4 w-24 animate-pulse rounded bg-recess" /><div className="h-4 flex-1 animate-pulse rounded bg-recess" /></li>
              ))}
            </ul>
          ) : inRange.length === 0 ? (
            <EmptyState icon={Receipt} title="No sales in this period" description="Pick another period or day to see its sales." />
          ) : (
            <ul className="divide-y divide-line">
              {paging.pageItems.map((t) => {
                const open = expanded === t.id;
                const online = t.type === "Online";
                return (
                  <li key={t.id} className={open ? "bg-subtle" : ""}>
                    <button type="button" onClick={() => setExpanded(open ? null : t.id)} aria-expanded={open}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition hover:bg-subtle md:grid-cols-[150px_minmax(0,1fr)_110px_130px]">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${online ? "bg-brand-soft text-brand" : "bg-recess text-ink-3"}`} title={online ? "Online order" : "Counter sale"}>
                          {online ? <Globe className="size-4" /> : <Store className="size-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1 font-code text-[14px] font-bold text-ink">
                            #{t.id} {open ? <ChevronUp className="size-3.5 text-ink-4" /> : <ChevronDown className="size-3.5 text-ink-4" />}
                          </span>
                          <span className="block text-[11.5px] text-ink-4">
                            {multiDay
                              ? new Date(t.dateTime).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                              : new Date(t.dateTime).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </span>
                      </span>
                      <span className="num col-start-2 row-start-1 text-right font-display text-[15px] font-extrabold text-ink md:col-start-4">{peso(t.totalAmount)}</span>
                      <span className="col-span-2 truncate pl-[42px] text-[12.5px] text-ink-3 md:col-span-1 md:col-start-2 md:row-start-1 md:pl-0 md:text-[13.5px] md:text-ink-2">
                        {t.user.username} <span className="text-ink-4">· {online ? "Online" : "Counter"} · {t.items.length} {t.items.length === 1 ? "item" : "items"}</span>
                        <span className="text-ink-4 md:hidden"> · {t.paymentMethod}</span>
                      </span>
                      <span className="hidden text-[13px] text-ink-3 md:col-start-3 md:row-start-1 md:block">{t.paymentMethod}</span>
                    </button>
                    {open && (
                      <div className="px-4 pb-4">
                        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                          {t.items.map((i) => (
                            <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                              <ProductThumb size="row" image={i.product.image} name={i.product.name} subcategory={i.product.subcategory} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13.5px] font-semibold text-ink">{i.product.name}</span>
                                <span className="num block text-[12px] text-ink-4">{Number(i.quantity.toFixed(2))} × {peso(i.price)}{i.product.subcategory && <> · {i.product.subcategory}</>}</span>
                              </span>
                              <span className="num shrink-0 text-[13.5px] font-semibold text-ink">{peso(i.price * i.quantity)}</span>
                            </li>
                          ))}
                          <li className="flex items-center justify-between bg-subtle px-3 py-2.5 font-display text-[14px] font-extrabold text-ink">
                            <span>Total · {t.paymentMethod}</span><span className="num">{peso(t.totalAmount)}</span>
                          </li>
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination {...paging} onChange={(p) => { paging.setPage(p); setExpanded(null); }} noun="sales" />
        </section>
      )}
    </div>
  );
}

function SummaryTile({ icon, label, value, caption }: { icon: React.ReactNode; label: string; value: string; caption: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-ink-3">{label}</p>
        <p className="num truncate font-display text-xl font-extrabold leading-tight text-ink sm:text-[22px]">{value}</p>
        <p className="truncate text-[11.5px] text-ink-4">{caption}</p>
      </div>
    </div>
  );
}

/** One way of splitting the period's sales: a row per part, each with its share of the total. */
function Breakdown({ title, rows, total }: {
  title: string;
  total: number;
  rows: { label: string; icon: React.ReactNode; amount: number; count: number }[];
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="mb-3 text-[12px] font-semibold text-ink-3">{title}</h3>
      <ul className="space-y-3">
        {rows.map((r) => {
          const share = total > 0 ? (r.amount / total) * 100 : 0;
          return (
            <li key={r.label} className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">{r.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13.5px] font-semibold text-ink">
                    {r.label} <span className="num text-[12px] font-normal text-ink-4">· {r.count} {r.count === 1 ? "sale" : "sales"}</span>
                  </span>
                  <span className="num shrink-0 text-[13.5px] font-bold text-ink">{peso(r.amount)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-recess">
                    <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${share}%` }} />
                  </div>
                  <span className="num w-9 shrink-0 text-right text-[11.5px] font-semibold text-ink-3">{Math.round(share)}%</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
