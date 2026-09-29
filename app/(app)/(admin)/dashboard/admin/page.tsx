"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, Package, ShoppingCart, Users, AlertTriangle } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Sparkline from "@/components/ui/Sparkline";
import StockLevelBar from "@/components/ui/StockLevelBar";
import OrderMapWidget from "@/components/OrderMapWidget";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type Stats = { totalUsers: number; totalProducts: number; totalOrders: number; totalRevenue: number };
type MonthlySale = { month: string; sales: number };
type MonthlyCount = { month: string; count: number };
type Order = { id: number; totalAmount: number; status: string; dateTime: string; customer: { username: string }; items: { product: { name: string }; quantity: number }[] };
type LowStock = { id: number; name: string; category: string; stock: number };
type Trend = { value: string; up: boolean };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const LOW_STOCK_THRESHOLD = 5; // matches the `stock <= 5` filter the /api/dashboard route already queries with

// Real month-over-month change from an actual series — returns null (no badge) rather than guessing when there's
// nothing to compare against yet (e.g. the metric was 0 last month, so a percentage would be undefined/misleading).
function monthOverMonth(series: { month: string; value: number }[]): Trend | null {
  if (series.length < 2) return null;
  const prev = series[series.length - 2].value;
  const curr = series[series.length - 1].value;
  if (prev === 0) return null;
  const pct = ((curr - prev) / prev) * 100;
  return { value: `${Math.abs(Math.round(pct))}%`, up: pct >= 0 };
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [monthlySales, setMonthlySales] = useState<MonthlySale[]>([]);
  const [monthlyOrders, setMonthlyOrders] = useState<MonthlyCount[]>([]);
  const [monthlyUsers, setMonthlyUsers] = useState<MonthlyCount[]>([]);
  const [monthlyProducts, setMonthlyProducts] = useState<MonthlyCount[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStock, setLowStock] = useState<LowStock[]>([]);
  const [username, setUsername] = useState("");
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then((d) => {
      setStats(d.stats);
      setMonthlySales(d.monthlySales);
      setMonthlyOrders(d.monthlyOrders);
      setMonthlyUsers(d.monthlyUsers);
      setMonthlyProducts(d.monthlyProducts);
      setRecentOrders(d.recentOrders);
      setLowStock(d.lowStock);
      // Bars start at 0 width and animate in on the next paint, so the fill reads as a motion cue, not a static bar.
      requestAnimationFrame(() => requestAnimationFrame(() => setBarsReady(true)));
    });
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setUsername(d.username ?? "")).catch(() => {});
  }, []);

  const today = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });

  const revenueTrend = monthOverMonth(monthlySales.map((m) => ({ month: m.month, value: m.sales })));
  const ordersTrend = monthOverMonth(monthlyOrders.map((m) => ({ month: m.month, value: m.count })));
  const usersTrend = monthOverMonth(monthlyUsers.map((m) => ({ month: m.month, value: m.count })));
  const productsTrend = monthOverMonth(monthlyProducts.map((m) => ({ month: m.month, value: m.count })));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">{today}</p>
        <h1 className="font-display text-2xl font-extrabold text-gray-900">{greeting()}{username ? `, ${username}` : ""}</h1>
        <p className="text-sm text-gray-400 mt-0.5">Here&apos;s how the branch is running right now.</p>
      </div>

      {/* Growth first: this is what the branch is here to see before anything else */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Sales Chart */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-extrabold text-gray-900">Sales Overview</h2>
              <p className="text-xs text-gray-400">Last 6 months revenue</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlySales} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E4FD8" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#1E4FD8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${v}`} />
              <Tooltip formatter={(v) => [`₱${Number(v).toLocaleString()}`, "Sales"]} contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
              <Area type="monotone" dataKey="sales" stroke="#1E4FD8" strokeWidth={2.5} fill="url(#salesGrad)" dot={{ r: 3, fill: "#1E4FD8", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#12327F", strokeWidth: 2, stroke: "#fff" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={ICON_SIZE.sm} className="text-amber-500" />
            <h2 className="font-display font-extrabold text-gray-900">Low Stock Alert</h2>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">All products are well stocked.</p>
          ) : (
            <div className="-mx-5 divide-y divide-gray-50">
              {lowStock.map((p) => (
                <div key={p.id} className="px-5 py-2.5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.category}</p>
                    </div>
                    <Badge label={p.stock === 0 ? "Out" : `${p.stock} left`} variant={p.stock === 0 ? "cancelled" : "low"} />
                  </div>
                  <StockLevelBar stock={p.stock} threshold={LOW_STOCK_THRESHOLD} ready={barsReady} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Map + Stat Rail — the card stretches to match the map's height so the rows can space out to fill it,
          instead of clumping at the top and leaving bare page background beside the lower half of the map. */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4">
        <OrderMapWidget />

        <div className="h-full flex flex-col bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          <StatRailRow
            title="Revenue"
            value={`₱${(stats?.totalRevenue ?? 0).toLocaleString("en", { minimumFractionDigits: 2 })}`}
            icon={<DollarSign size={ICON_SIZE.md} className="text-blue-600" />}
            iconBg="bg-blue-50"
            trend={revenueTrend}
            sparkline={monthlySales.map((m) => ({ label: m.month, value: m.sales }))}
            sparklineId="admin-revenue"
          />
          <StatRailRow
            title="Products"
            value={stats?.totalProducts ?? 0}
            icon={<Package size={ICON_SIZE.md} />}
            iconBg="bg-[var(--accent-soft)]"
            iconColor="var(--accent-ink)"
            trend={productsTrend}
            sparkline={monthlyProducts.map((m) => ({ label: m.month, value: m.count }))}
            sparklineId="admin-products"
            sparklineValuePrefix=""
          />
          <StatRailRow
            title="Orders"
            value={stats?.totalOrders ?? 0}
            icon={<ShoppingCart size={ICON_SIZE.md} className="text-blue-500" />}
            iconBg="bg-blue-50"
            trend={ordersTrend}
            sparkline={monthlyOrders.map((m) => ({ label: m.month, value: m.count }))}
            sparklineId="admin-orders"
            sparklineValuePrefix=""
          />
          <StatRailRow
            title="Users"
            value={stats?.totalUsers ?? 0}
            icon={<Users size={ICON_SIZE.md} className="text-gray-500" />}
            iconBg="bg-gray-100"
            trend={usersTrend}
            sparkline={monthlyUsers.map((m) => ({ label: m.month, value: m.count }))}
            sparklineId="admin-users"
            sparklineValuePrefix=""
          />
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-extrabold text-gray-900">Recent Orders</h2>
          <a href="/orders" className="text-xs font-semibold hover:underline" style={{ color: "var(--brand)" }}>View all</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Order</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Items</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentOrders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-gray-900">#{o.id}</td>
                  <td className="py-3 px-4 text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center font-display font-bold text-[10px] text-gray-500 shrink-0">
                        {o.customer.username.charAt(0).toUpperCase()}
                      </span>
                      {o.customer.username}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs hidden md:table-cell">{o.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}</td>
                  <td className="py-3 px-4 font-semibold text-gray-900 num">₱{o.totalAmount.toFixed(2)}</td>
                  <td className="py-3 px-4"><Badge label={o.status} /></td>
                  <td className="py-3 px-4 text-gray-400 text-xs hidden md:table-cell">{new Date(o.dateTime).toLocaleDateString()}</td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatRailRow({
  title, value, icon, iconBg, iconColor, trend, sparkline, sparklineId, sparklineValuePrefix = "₱",
}: {
  title: string; value: string | number; icon: React.ReactNode; iconBg: string; iconColor?: string;
  trend?: Trend | null; sparkline?: { label: string; value: number }[]; sparklineId?: string; sparklineValuePrefix?: string;
}) {
  return (
    <div className="flex-1 flex items-center gap-3 px-5 py-4">
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`} style={iconColor ? { color: iconColor } : undefined}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
        <p className="font-display text-lg font-extrabold text-gray-900 num truncate">{value}</p>
      </div>
      {sparkline && sparkline.length > 1 && sparklineId ? (
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <Sparkline gradientId={sparklineId} data={sparkline} valuePrefix={sparklineValuePrefix} />
          {trend && (
            <span className="text-[11px] font-semibold" style={{ color: trend.up ? "var(--good)" : "var(--bad)" }}>
              {trend.up ? "↑" : "↓"} {trend.value}
            </span>
          )}
        </div>
      ) : (
        trend && (
          <span className="text-xs font-semibold shrink-0" style={{ color: trend.up ? "var(--good)" : "var(--bad)" }}>
            {trend.up ? "↑" : "↓"} {trend.value}
          </span>
        )
      )}
    </div>
  );
}
