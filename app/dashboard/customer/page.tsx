"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, ClipboardList, Clock, CheckCircle } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import Link from "next/link";

type Order = { id: number; totalAmount: number; status: string; dateTime: string; items: { quantity: number; product: { name: string } }[] };

export default function CustomerDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetch("/api/orders").then((r) => r.json()).then(setOrders);
  }, []);

  const pending = orders.filter((o) => o.status === "pending").length;
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const totalSpent = orders.reduce((s, o) => s + o.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">My Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">Browse products and track your orders.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Orders" value={orders.length} icon={<ClipboardList size={20} className="text-blue-600" />} iconBg="bg-blue-50" />
        <StatCard title="Pending" value={pending} icon={<Clock size={20} className="text-yellow-600" />} iconBg="bg-yellow-50" />
        <StatCard title="Delivered" value={delivered} icon={<CheckCircle size={20} className="text-emerald-600" />} iconBg="bg-emerald-50" />
        <StatCard title="Total Spent" value={`₱${totalSpent.toFixed(2)}`} icon={<ShoppingBag size={20} className="text-purple-600" />} iconBg="bg-purple-50" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Link href="/shop" className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-4 text-white hover:from-purple-700 hover:to-blue-700 transition shadow-lg shadow-purple-500/20 flex items-center gap-4 self-start">
          <ShoppingBag size={24} className="opacity-80 shrink-0" />
          <div>
            <p className="font-bold text-base">Browse Products</p>
            <p className="text-purple-200 text-sm">Shop hardware items</p>
          </div>
        </Link>

        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Orders</h2>
            <Link href="/orders" className="text-xs text-blue-600 hover:underline font-medium">View all</Link>
          </div>
          <div className="space-y-2">
            {orders.slice(0, 5).map((o) => (
              <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">Order #{o.id}</p>
                  <p className="text-xs text-gray-400">{o.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">₱{o.totalAmount.toFixed(2)}</p>
                  <Badge label={o.status} />
                </div>
              </div>
            ))}
            {orders.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No orders yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
