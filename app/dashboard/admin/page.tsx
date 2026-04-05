"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, Package, ShoppingCart, Users, AlertTriangle } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";

type Stats = { totalUsers: number; totalProducts: number; totalOrders: number; totalRevenue: number };
type MonthlySale = { month: string; sales: number };
type Order = { id: number; totalAmount: number; status: string; dateTime: string; customer: { username: string }; items: { product: { name: string }; quantity: number }[] };
type LowStock = { id: number; name: string; category: string; stock: number };

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [monthlySales, setMonthlySales] = useState<MonthlySale[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStock, setLowStock] = useState<LowStock[]>([]);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then((d) => {
      setStats(d.stats);
      setMonthlySales(d.monthlySales);
      setRecentOrders(d.recentOrders);
      setLowStock(d.lowStock);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-sm text-gray-400 mt-0.5">Welcome back! Here&apos;s what&apos;s happening today.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={`₱${(stats?.totalRevenue ?? 0).toLocaleString("en", { minimumFractionDigits: 2 })}`} icon={<DollarSign size={20} className="text-blue-600" />} iconBg="bg-blue-50" trend={{ value: "12%", up: true }} />
        <StatCard title="Total Products" value={stats?.totalProducts ?? 0} icon={<Package size={20} className="text-purple-600" />} iconBg="bg-purple-50" trend={{ value: "3%", up: true }} />
        <StatCard title="Total Orders" value={stats?.totalOrders ?? 0} icon={<ShoppingCart size={20} className="text-emerald-600" />} iconBg="bg-emerald-50" trend={{ value: "8%", up: true }} />
        <StatCard title="Total Users" value={stats?.totalUsers ?? 0} icon={<Users size={20} className="text-orange-600" />} iconBg="bg-orange-50" trend={{ value: "5%", up: true }} />
      </div>

      {/* Chart + Low Stock */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Sales Chart */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Sales Overview</h2>
              <p className="text-xs text-gray-400">Last 6 months revenue</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlySales} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${v}`} />
              <Tooltip formatter={(v) => [`₱${Number(v).toLocaleString()}`, "Sales"]} contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
              <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} fill="url(#salesGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-orange-500" />
            <h2 className="font-semibold text-gray-900">Low Stock Alert</h2>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">All products are well stocked.</p>
          ) : (
            <div className="space-y-3">
              {lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[140px]">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.category}</p>
                  </div>
                  <Badge label={p.stock === 0 ? "Out" : `${p.stock} left`} variant={p.stock === 0 ? "cancelled" : "low"} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Recent Orders</h2>
          <a href="/orders" className="text-xs text-blue-600 hover:underline font-medium">View all</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Order</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Items</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentOrders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-3 font-medium text-gray-900">#{o.id}</td>
                  <td className="py-3 px-3 text-gray-600">{o.customer.username}</td>
                  <td className="py-3 px-3 text-gray-400 text-xs hidden md:table-cell">{o.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}</td>
                  <td className="py-3 px-3 font-semibold text-gray-900">₱{o.totalAmount.toFixed(2)}</td>
                  <td className="py-3 px-3"><Badge label={o.status} /></td>
                  <td className="py-3 px-3 text-gray-400 text-xs hidden md:table-cell">{new Date(o.dateTime).toLocaleDateString()}</td>
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
