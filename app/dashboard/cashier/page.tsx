"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Receipt, TrendingUp, Clock, AlertTriangle, Package } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import Link from "next/link";

type Transaction = { id: number; totalAmount: number; paymentMethod: string; dateTime: string; items: { quantity: number; product: { name: string } }[] };
type Order = { id: number; totalAmount: number; status: string; dateTime: string; customer: { username: string }; items: { quantity: number; product: { name: string } }[] };
type Product = { id: number; name: string; stock: number; category: { name: string } };

export default function CashierDashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch("/api/transactions").then((r) => r.json()).then(setTransactions);
    fetch("/api/orders").then((r) => r.json()).then(setOrders);
    fetch("/api/products").then((r) => r.json()).then(setProducts);
  }, []);

  const todayTotal = transactions
    .filter((t) => new Date(t.dateTime).toDateString() === new Date().toDateString())
    .reduce((s, t) => s + t.totalAmount, 0);

  const todayCount = transactions.filter((t) => new Date(t.dateTime).toDateString() === new Date().toDateString()).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Cashier Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">Process transactions and manage POS.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Today's Sales" value={`₱${todayTotal.toFixed(2)}`} icon={<TrendingUp size={20} className="text-blue-600" />} iconBg="bg-blue-50" />
        <StatCard title="Today's Transactions" value={todayCount} icon={<Receipt size={20} className="text-purple-600" />} iconBg="bg-purple-50" />
        <StatCard title="Total Transactions" value={transactions.length} icon={<ShoppingCart size={20} className="text-emerald-600" />} iconBg="bg-emerald-50" />
        <StatCard title="All Time Revenue" value={`₱${transactions.reduce((s, t) => s + t.totalAmount, 0).toFixed(2)}`} icon={<Clock size={20} className="text-orange-600" />} iconBg="bg-orange-50" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        {/* Left column: New Transaction + Pending Orders + Low Stock */}
        <div className="flex flex-col gap-4">
          <Link href="/pos" className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 text-white hover:from-blue-700 hover:to-blue-800 transition shadow-lg shadow-blue-500/20 flex items-center gap-4">
            <ShoppingCart size={24} className="opacity-80 shrink-0" />
            <div>
              <p className="font-bold text-base">New Transaction</p>
              <p className="text-blue-200 text-sm">Open POS system</p>
            </div>
          </Link>

          {/* Pending Orders */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">Pending Orders</h2>
                {orders.filter((o) => o.status === "pending").length > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">
                    {orders.filter((o) => o.status === "pending").length}
                  </span>
                )}
              </div>
              <Link href="/orders" className="text-xs text-blue-600 hover:underline font-medium">View all</Link>
            </div>
            <div className="space-y-2">
              {orders.filter((o) => o.status === "pending").slice(0, 4).map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Order #{o.id} — {o.customer.username}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[160px]">{o.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">₱{o.totalAmount.toFixed(2)}</p>
                </div>
              ))}
              {orders.filter((o) => o.status === "pending").length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No pending orders.</p>
              )}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">Low Stock Alerts</h2>
                {products.filter((p) => p.stock <= 10).length > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">
                    {products.filter((p) => p.stock <= 10).length}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {products.filter((p) => p.stock <= 10).slice(0, 4).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    {p.stock === 0
                      ? <AlertTriangle size={14} className="text-red-500 shrink-0" />
                      : <Package size={14} className="text-orange-400 shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.category.name}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    p.stock === 0 ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                  }`}>
                    {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                  </span>
                </div>
              ))}
              {products.filter((p) => p.stock <= 10).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">All products are well stocked.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Recent Transactions */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
            <Link href="/transactions" className="text-xs text-blue-600 hover:underline font-medium">View all</Link>
          </div>
          <div className="space-y-2">
            {transactions.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">Transaction #{t.id}</p>
                  <p className="text-xs text-gray-400">{t.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">₱{t.totalAmount.toFixed(2)}</p>
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
