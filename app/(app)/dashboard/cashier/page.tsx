"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Receipt, TrendingUp, Clock, AlertTriangle, Package, Truck, ArrowRight } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Sparkline from "@/components/ui/Sparkline";
import StockLevelBar from "@/components/ui/StockLevelBar";
import Link from "next/link";
import OrderMapWidget from "@/components/OrderMapWidget";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type Transaction = { id: number; totalAmount: number; paymentMethod: string; dateTime: string; items: { quantity: number; product: { name: string } }[] };
type Order = { id: number; totalAmount: number; status: string; dateTime: string; customer: { username: string }; items: { quantity: number; product: { name: string } }[]; fulfillmentMode?: string; driverId?: number | null };
type Product = { id: number; name: string; stock: number; category: { name: string } };

const LOW_STOCK_THRESHOLD = 10; // matches the `stock <= 10` filter this page already uses below

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
  const [products, setProducts] = useState<Product[]>([]);
  const [username, setUsername] = useState("");
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    fetch("/api/transactions").then((r) => r.json()).then((d) => {
      setTransactions(d);
      requestAnimationFrame(() => requestAnimationFrame(() => setBarsReady(true)));
    });
    fetch("/api/orders").then((r) => r.json()).then(setOrders);
    fetch("/api/products").then((r) => r.json()).then(setProducts);
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
  const lowStockProducts = products.filter((p) => p.stock <= 10);

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
      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4">
        <OrderMapWidget />

        <div className="h-full flex flex-col bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          <StatRailRow title="Today's Sales" value={`₱${todayTotal.toFixed(2)}`} icon={<TrendingUp size={ICON_SIZE.md} className="text-blue-600" />} iconBg="bg-blue-50" />
          <StatRailRow title="Today's Transactions" value={todayCount} icon={<Receipt size={ICON_SIZE.md} />} iconBg="bg-[var(--accent-soft)]" iconColor="var(--accent-ink)" />
          <StatRailRow title="Total Transactions" value={transactions.length} icon={<ShoppingCart size={ICON_SIZE.md} className="text-gray-500" />} iconBg="bg-gray-100" />
          <StatRailRow
            title="All Time Revenue"
            value={`₱${transactions.reduce((s, t) => s + t.totalAmount, 0).toFixed(2)}`}
            icon={<Clock size={ICON_SIZE.md} className="text-blue-500" />}
            iconBg="bg-blue-50"
            sparkline={transactions.length > 1 ? recentSalesTrend(transactions) : undefined}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        {/* Left column: New Transaction + Pending Orders + Low Stock */}
        <div className="flex flex-col gap-4">
          <Link href="/pos" className="rounded-2xl p-4 text-white transition shadow-lg flex items-center gap-4" style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-ink))", boxShadow: "0 12px 24px -10px var(--brand)" }}>
            <ShoppingCart size={ICON_SIZE.lg} className="opacity-80 shrink-0" />
            <div>
              <p className="font-display font-extrabold text-base">New Transaction</p>
              <p className="text-blue-200 text-sm">Open POS system</p>
            </div>
          </Link>

          {/* Pending Orders */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-display font-extrabold text-gray-900">Pending Orders</h2>
                {pendingOrders.length > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                    {pendingOrders.length}
                  </span>
                )}
              </div>
              <Link href="/orders" className="text-xs font-semibold hover:underline" style={{ color: "var(--brand)" }}>View all</Link>
            </div>
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-display font-extrabold text-gray-900">Low Stock Alerts</h2>
                {lowStockProducts.length > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">
                    {lowStockProducts.length}
                  </span>
                )}
              </div>
            </div>
            <div className="-mx-5 divide-y divide-gray-50">
              {lowStockProducts.slice(0, 4).map((p) => (
                <div key={p.id} className="px-5 py-2.5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    {p.stock === 0
                      ? <AlertTriangle size={ICON_SIZE.sm} className="text-red-500 shrink-0" />
                      : <Package size={ICON_SIZE.sm} className="text-amber-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.category.name}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      p.stock === 0 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
                    }`}>
                      {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                    </span>
                  </div>
                  <StockLevelBar stock={p.stock} threshold={LOW_STOCK_THRESHOLD} ready={barsReady} />
                </div>
              ))}
              {lowStockProducts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">All products are well stocked.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Recent Transactions */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-extrabold text-gray-900">Recent Transactions</h2>
            <Link href="/transactions" className="text-xs font-semibold hover:underline" style={{ color: "var(--brand)" }}>View all</Link>
          </div>
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

function StatRailRow({ title, value, icon, iconBg, iconColor, sparkline }: { title: string; value: string | number; icon: React.ReactNode; iconBg: string; iconColor?: string; sparkline?: { label: string; value: number }[] }) {
  return (
    <div className="flex-1 flex items-center gap-3 px-5 py-4">
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`} style={iconColor ? { color: iconColor } : undefined}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
        <p className="font-display text-lg font-extrabold text-gray-900 num truncate">{value}</p>
      </div>
      {sparkline && sparkline.length > 0 && (
        <Sparkline gradientId="revSparkGrad-cashier" data={sparkline} />
      )}
    </div>
  );
}
