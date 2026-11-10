"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, Package, ShoppingCart, Users, AlertTriangle, TrendingUp, ClipboardList } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { SectionLabel, CardHeader, StatRail, StatRailRow, type Trend } from "@/components/dashboard/DashboardParts";
import StockLevelBar from "@/components/ui/StockLevelBar";
import OrderMapWidget from "@/components/OrderMapWidget";
import { ICON_SIZE } from "@/lib/constants/icon-size";

import { customerLabel } from "@/lib/customer";
type Stats = { totalUsers: number; totalProducts: number; totalOrders: number; totalRevenue: number };
type MonthlySale = { month: string; sales: number };
type MonthlyCount = { month: string; count: number };
type Order = { id: number; totalAmount: number; status: string; dateTime: string; customer: { username: string } | null; customerName?: string | null; customerContact?: string | null; items: { product: { name: string }; quantity: number }[] };
type LowStock = { id: number; name: string; category: string; unit: string; stock: number; reorderPoint: number; eoq: number | null; status: "out" | "reorder" | "ok" };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}


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
  const sixMonthTotal = monthlySales.reduce((s, m) => s + m.sales, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">{today}</p>
        <h1 className="font-display text-2xl font-extrabold text-gray-900">{greeting()}{username ? `, ${username}` : ""}</h1>
        <p className="text-sm text-gray-400 mt-0.5">Here&apos;s how the branch is running right now.</p>
      </div>

      {/* Growth first: this is what the branch is here to see before anything else */}
      <SectionLabel title="Sales & stock" description="How much the store is selling, and what needs restocking." />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Sales Chart */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
          <CardHeader
            icon={<TrendingUp size={ICON_SIZE.sm} className="text-blue-600" />}
            title="Sales Overview"
            description={`Money collected each month from counter (POS) sales and delivered online orders, over the last 6 months. Total: ₱${sixMonthTotal.toLocaleString("en-PH")}.`}
            href="/reports"
            linkLabel="Sales reports"
          />
          {/* The chart fills whatever height the row gives the card, so no blank band is left under it. */}
          <div className="flex-1 min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlySales} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E4FD8" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#1E4FD8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => (v >= 1000000 ? `₱${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `₱${Math.round(v / 1000)}k` : `₱${v}`)} />
              <Tooltip formatter={(v) => [`₱${Number(v).toLocaleString()}`, "Sales"]} contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
              <Area type="monotone" dataKey="sales" stroke="#1E4FD8" strokeWidth={2.5} fill="url(#salesGrad)" dot={{ r: 3, fill: "#1E4FD8", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#12327F", strokeWidth: 2, stroke: "#fff" }} />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <CardHeader
            icon={<AlertTriangle size={ICON_SIZE.sm} className="text-amber-500" />}
            title="Low Stock Alert"
            description="Products at or below their reorder point. The bar shows how much stock is left before that point; order the suggested quantity on Restocks."
            href="/restocks"
            linkLabel="Restocks"
          />
          {lowStock.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Every product is above its reorder point.</p>
          ) : (
            <div className="-mx-5 divide-y divide-gray-50">
              {lowStock.map((p) => (
                <div key={p.id} className="px-5 py-2.5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        {p.category} · reorder at {p.reorderPoint}{p.eoq != null ? ` · order ${p.eoq}` : ""}
                      </p>
                    </div>
                    <Badge label={p.stock <= 0 ? "Out" : `${p.stock} left`} variant={p.stock <= 0 ? "cancelled" : "low"} />
                  </div>
                  <StockLevelBar stock={p.stock} threshold={p.reorderPoint} ready={barsReady} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Map + Stat Rail — the card stretches to match the map's height so the rows can space out to fill it,
          instead of clumping at the top and leaving bare page background beside the lower half of the map. */}
      <SectionLabel title="Deliveries & store totals" description="Orders on the road right now, and the store's running totals." />
      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4">
        <OrderMapWidget />

        <StatRail
          title="Store totals"
          description="All-time figures. The small chart shows the last 6 months; the % compares this month so far with all of last month."
        >
          <StatRailRow
            title="Revenue"
            caption="Total sales, all time"
            value={`₱${(stats?.totalRevenue ?? 0).toLocaleString("en", { minimumFractionDigits: 2 })}`}
            icon={<DollarSign size={ICON_SIZE.md} className="text-blue-600" />}
            iconBg="bg-blue-50"
            trend={revenueTrend}
            sparkline={monthlySales.map((m) => ({ label: m.month, value: m.sales }))}
            sparklineId="admin-revenue"
          />
          <StatRailRow
            title="Products"
            caption="Items in the catalogue"
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
            caption="Online orders placed by customers"
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
            caption="Accounts: admin, staff, customers, drivers"
            value={stats?.totalUsers ?? 0}
            icon={<Users size={ICON_SIZE.md} className="text-gray-500" />}
            iconBg="bg-gray-100"
            trend={usersTrend}
            sparkline={monthlyUsers.map((m) => ({ label: m.month, value: m.count }))}
            sparklineId="admin-users"
            sparklineValuePrefix=""
          />
        </StatRail>
      </div>

      {/* Recent Orders */}
      <SectionLabel title="Online orders" description="The latest orders customers placed through the shop." />
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <CardHeader
          icon={<ClipboardList size={ICON_SIZE.sm} className="text-blue-600" />}
          title="Recent Orders"
          description="The 5 newest online orders and where each one is. Open Orders to confirm, assign a driver, or mark them done."
          href="/orders"
        />
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
                        {customerLabel(o).charAt(0).toUpperCase()}
                      </span>
                      {customerLabel(o)}
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
