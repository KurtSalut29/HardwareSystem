"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Receipt, TrendingUp, Clock, AlertTriangle, Package, Truck, ArrowRight, ClipboardList } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { SectionLabel, CardHeader, StatRail, StatRailRow } from "@/components/dashboard/DashboardParts";
import StockLevelBar from "@/components/ui/StockLevelBar";
import Link from "next/link";
import OrderMapWidget from "@/components/OrderMapWidget";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import type { ReorderPlan } from "@/lib/inventory";

type Transaction = { id: number; totalAmount: number; paymentMethod: string; dateTime: string; items: { quantity: number; product: { name: string } }[] };
type Order = { id: number; totalAmount: number; status: string; dateTime: string; customer: { username: string }; items: { quantity: number; product: { name: string } }[]; fulfillmentMode?: string; driverId?: number | null };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Plots the last several actual sales in the order they happened — same numbers as "Recent Transactions" below,
// just charted. Calendar-day buckets look empty for a cashier with only a handful of sales a day; this doesn't.
function recentSalesTrend(transactions: Transaction[]) {
  return [...transactions]
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .slice(-8)
    .map((t) => ({
      label: new Date(t.dateTime).toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      value: Math.round(t.totalAmount),
    }));
}

export default function CashierDashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [plan, setPlan] = useState<ReorderPlan | null>(null);
  const [username, setUsername] = useState("");
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    fetch("/api/transactions").then((r) => r.json()).then((d) => {
      setTransactions(d);
      requestAnimationFrame(() => requestAnimationFrame(() => setBarsReady(true)));
    });
    fetch("/api/orders").then((r) => r.json()).then(setOrders);
    fetch("/api/inventory/reorder", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setPlan(d)).catch(() => {});
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setUsername(d.username ?? "")).catch(() => {});
  }, []);

  const todayTotal = transactions
    .filter((t) => new Date(t.dateTime).toDateString() === new Date().toDateString())
    .reduce((s, t) => s + t.totalAmount, 0);

  const todayCount = transactions.filter((t) => new Date(t.dateTime).toDateString() === new Date().toDateString()).length;
  const today = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });
  const pendingOrders = orders.filter((o) => o.status === "pending");
  // Dispatch is the cashier's job now, so confirmed deliveries with no driver
  // are surfaced here rather than waiting to be noticed on the Orders page.
  const awaitingDriver = orders.filter(
    (o) => o.status === "confirmed" && o.fulfillmentMode !== "pickup" && !o.driverId
  );
  // At or below each product's own reorder point (EOQ planning), out of stock first.
  const lowStockProducts = (plan?.rows ?? [])
    .filter((r) => r.status !== "ok")
    .sort((a, b) => (a.status === b.status ? a.stock / a.reorderPoint - b.stock / b.reorderPoint : a.status === "out" ? -1 : 1));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">{today}</p>
        <h1 className="font-display text-2xl font-extrabold text-gray-900">{greeting()}{username ? `, ${username}` : ""}</h1>
        <p className="text-sm text-gray-400 mt-0.5">Process transactions, manage POS, and dispatch deliveries.</p>
      </div>

      {awaitingDriver.length > 0 && (
        <Link href="/orders"
          className="flex items-start gap-3 rounded-xl border px-4 py-3 transition hover:brightness-[0.98]"
          style={{ background: "var(--warn-soft)", borderColor: "var(--warn)" }}>
          <Truck size={ICON_SIZE.md} className="shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold" style={{ color: "var(--warn)" }}>
              {awaitingDriver.length} {awaitingDriver.length === 1 ? "delivery needs" : "deliveries need"} a driver
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              Order{awaitingDriver.length === 1 ? " " : "s "}{awaitingDriver.map((o) => `#${o.id}`).join(", ")} — open Orders to assign and notify a driver.
            </p>
          </div>
          <ArrowRight size={ICON_SIZE.sm} className="shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
        </Link>
      )}

      {/* Map + Stat Rail — the card stretches to match the map's height so the rows can space out to fill it. */}
      <SectionLabel title="Deliveries & your sales" description="Orders on the road right now, and the sales credited to you." />
      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4">
        <OrderMapWidget />

        <StatRail
          title="Your sales"
          description="Only sales credited to you: what you rang up at the POS, plus online orders you handled once they were delivered."
        >
          <StatRailRow title="Today's Sales" caption="Your sales since midnight" value={`₱${todayTotal.toFixed(2)}`} icon={<TrendingUp size={ICON_SIZE.md} className="text-blue-600" />} iconBg="bg-blue-50" />
          <StatRailRow title="Today's Transactions" caption="Sales you recorded today" value={todayCount} icon={<Receipt size={ICON_SIZE.md} />} iconBg="bg-[var(--accent-soft)]" iconColor="var(--accent-ink)" />
          <StatRailRow title="Your Transactions" caption="All sales you have recorded" value={transactions.length} icon={<ShoppingCart size={ICON_SIZE.md} className="text-gray-500" />} iconBg="bg-gray-100" />
          <StatRailRow
            title="Your Total Sales"
            caption="All time. The chart shows your last 8 sales."
            value={`₱${transactions.reduce((s, t) => s + t.totalAmount, 0).toFixed(2)}`}
            icon={<Clock size={ICON_SIZE.md} className="text-blue-500" />}
            iconBg="bg-blue-50"
            sparkline={transactions.length > 1 ? recentSalesTrend(transactions) : undefined}
            sparklineId="cashier-sales"
          />
        </StatRail>
      </div>

      <SectionLabel title="Today's work" description="Start a sale, confirm new orders, and keep an eye on stock." />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        {/* Left column: New Transaction + Pending Orders + Low Stock */}
        <div className="flex flex-col gap-4">
          <Link href="/pos" className="rounded-2xl p-4 text-white transition shadow-lg flex items-center gap-4" style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-ink))", boxShadow: "0 12px 24px -10px var(--brand)" }}>
            <ShoppingCart size={ICON_SIZE.lg} className="opacity-80 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display font-extrabold text-base">New Transaction</p>
              <p className="text-blue-100 text-sm">Open the POS to ring up a walk-in customer</p>
            </div>
            <ArrowRight size={ICON_SIZE.sm} className="opacity-80 shrink-0" />
          </Link>

          {/* Pending Orders */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <CardHeader
              icon={<ClipboardList size={ICON_SIZE.sm} className="text-amber-600" />}
              title="Pending Orders"
              description="New online orders waiting for you to confirm."
              href="/orders"
              badge={pendingOrders.length > 0 ? (
                <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">{pendingOrders.length}</span>
              ) : undefined}
            />
            <div className="space-y-2">
              {pendingOrders.slice(0, 4).map((o) => (
                <div key={o.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center font-display font-bold text-[11px] text-gray-500 shrink-0">
                    {o.customer.username.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">Order #{o.id} — {o.customer.username}</p>
                    <p className="text-xs text-gray-400 truncate">{o.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 num shrink-0">₱{o.totalAmount.toFixed(2)}</p>
                </div>
              ))}
              {pendingOrders.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No pending orders.</p>
              )}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <CardHeader
              icon={<AlertTriangle size={ICON_SIZE.sm} className="text-amber-500" />}
              title="Low Stock Alerts"
              description="Products at or below their reorder point. Record the supplier delivery on Restocks."
              href="/restocks"
              linkLabel="Restocks"
              badge={lowStockProducts.length > 0 ? (
                <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">{lowStockProducts.length}</span>
              ) : undefined}
            />
            <div className="-mx-5 divide-y divide-gray-50">
              {lowStockProducts.slice(0, 4).map((p) => (
                <div key={p.productId} className="px-5 py-2.5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    {p.stock === 0
                      ? <AlertTriangle size={ICON_SIZE.sm} className="text-red-500 shrink-0" />
                      : <Package size={ICON_SIZE.sm} className="text-amber-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        {p.category} · reorder at {p.reorderPoint}{p.eoq != null ? ` · order ${p.eoq}` : ""}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      p.stock === 0 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
                    }`}>
                      {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                    </span>
                  </div>
                  <StockLevelBar stock={p.stock} threshold={p.reorderPoint} ready={barsReady} />
                </div>
              ))}
              {lowStockProducts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Every product is above its reorder point.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Recent Transactions */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <CardHeader
            icon={<Receipt size={ICON_SIZE.sm} className="text-blue-600" />}
            title="Recent Transactions"
            description="Your 5 latest sales, with what was bought and how it was paid."
            href="/transactions"
          />
          <div className="space-y-2">
            {transactions.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                  <Receipt size={ICON_SIZE.xs} className="text-gray-400" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Transaction #{t.id}</p>
                  <p className="text-xs text-gray-400 truncate">{t.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900 num">₱{t.totalAmount.toFixed(2)}</p>
                  <Badge label={t.paymentMethod} variant="POS" />
                </div>
              </div>
            ))}
            {transactions.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No transactions yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
