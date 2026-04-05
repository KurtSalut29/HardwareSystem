"use client";

import React, { useEffect, useState } from "react";
import { Search, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, CheckCheck, Receipt, Printer, X } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Toast from "@/components/ui/Toast";

type OItem = { id: number; quantity: number; price: number; product: { name: string } };
type Order = { id: number; totalAmount: number; status: string; dateTime: string; customer: { username: string }; items: OItem[] };

function ReceiptModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-blue-600" />
            <span className="font-semibold text-gray-800 text-sm">Order Receipt</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"><X size={15} /></button>
        </div>

        {/* Receipt Body */}
        <div id="receipt-print" className="p-5 space-y-4">
          {/* Store */}
          <div className="text-center">
            <p className="font-bold text-gray-900 text-base">Hardware Store</p>
            <p className="text-xs text-gray-400 mt-0.5">Official Receipt</p>
          </div>

          <div className="border-t border-dashed border-gray-200" />

          {/* Order Info */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Order #</span>
              <span className="font-semibold text-gray-800">{order.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Customer</span>
              <span className="font-semibold text-gray-800">{order.customer.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="font-semibold text-gray-800">{new Date(order.dateTime).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`font-semibold ${order.status === "delivered" ? "text-green-600" : "text-blue-600"}`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-200" />

          {/* Items */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">Items</p>
            {order.items.map((i) => (
              <div key={i.id} className="flex justify-between text-xs">
                <span className="text-gray-600">{i.product.name} <span className="text-gray-400">× {i.quantity}</span></span>
                <span className="font-medium text-gray-800">₱{(i.price * i.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-200" />

          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-bold text-lg text-gray-900">₱{order.totalAmount.toFixed(2)}</span>
          </div>

          <p className="text-center text-[10px] text-gray-400 pt-1">Thank you for your purchase!</p>
        </div>

        {/* Print */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => {
              const content = document.getElementById("receipt-print")?.innerHTML ?? "";
              const win = window.open("", "_blank", "width=400,height=600");
              if (!win) return;
              win.document.write(`<html><head><title>Receipt</title><style>body{font-family:sans-serif;padding:20px;max-width:320px;margin:auto}hr{border:none;border-top:1px dashed #ccc;margin:12px 0}.flex{display:flex;justify-content:space-between;font-size:12px;margin:4px 0}.bold{font-weight:700}.center{text-align:center}.total{font-size:16px;font-weight:700}</style></head><body>${content}</body></html>`);
              win.document.close();
              win.print();
            }}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition"
          >
            <Printer size={15} /> Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUSES = ["pending", "confirmed", "delivered", "cancelled"];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string; border: string }> = {
  pending:   { label: "Pending",   icon: <Clock size={11} />,     bg: "bg-yellow-50",  text: "text-yellow-600", border: "border-yellow-200" },
  confirmed: { label: "Confirmed", icon: <CheckCircle size={11} />, bg: "bg-blue-50",  text: "text-blue-600",   border: "border-blue-200" },
  delivered: { label: "Delivered", icon: <CheckCheck size={11} />, bg: "bg-green-50",  text: "text-green-600",  border: "border-green-200" },
  cancelled: { label: "Cancelled", icon: <XCircle size={11} />,   bg: "bg-red-50",    text: "text-red-500",    border: "border-red-200" },
};

const TOAST_CONFIG: Record<string, { msg: string; variant: "success" | "error" | "warning" | "info" }> = {
  confirmed: { msg: "Order confirmed successfully!",  variant: "info" },
  delivered: { msg: "Order marked as delivered!",     variant: "success" },
  cancelled: { msg: "Order has been cancelled.",      variant: "error" },
  pending:   { msg: "Order set back to pending.",     variant: "warning" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [role, setRole] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" | "warning" | "info" } | null>(null);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const PER_PAGE = 10;

  useEffect(() => {
    async function load() {
      const [oRes, meRes] = await Promise.all([fetch("/api/orders"), fetch("/api/auth/me")]);
      if (!oRes.ok) { setLoading(false); return; }
      const data = await oRes.json();
      const me = meRes.ok ? await meRes.json() : {};
      setOrders(Array.isArray(data) ? data : []);
      setRole(me.role ?? "");
      setLoading(false);
    }
    load();
  }, []);

  function showToast(status: string) {
    const cfg = TOAST_CONFIG[status];
    if (!cfg) return;
    setToast(cfg);
    setTimeout(() => setToast(null), 3000);
  }

  async function updateStatus(id: number, status: string) {
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) return;
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    showToast(status);
  }

  const filtered = orders.filter(
    (o) => o.customer.username.toLowerCase().includes(search.toLowerCase()) || String(o.id).includes(search)
  );
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="space-y-5">
      {/* Toast */}
      {receipt && <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />}
      <Toast message={toast?.msg ?? ""} variant={toast?.variant} />

      <PageHeader title="Orders" subtitle="Online orders from customers" />

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by ID or customer..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" />
          </div>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} orders</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide w-8"></th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Order</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Date</th>
                <th className="py-2.5 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">No orders found.</td></tr>
              ) : paginated.map((o) => (
                <React.Fragment key={o.id}>
                  <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                    <td className="py-3 px-4 text-gray-400">
                      {expanded === o.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">#{o.id}</td>
                    <td className="py-3 px-4 text-gray-600">{o.customer.username}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">₱{o.totalAmount.toFixed(2)}</td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      {(role === "admin" || role === "cashier") ? (
                        <select
                          value={o.status}
                          onChange={(e) => updateStatus(o.id, e.target.value)}
                          className={`text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold cursor-pointer
                            ${STATUS_CONFIG[o.status]?.bg} ${STATUS_CONFIG[o.status]?.text} ${STATUS_CONFIG[o.status]?.border}`}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>)}
                        </select>
                      ) : (
                        <StatusBadge status={o.status} />
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs hidden md:table-cell">{new Date(o.dateTime).toLocaleString()}</td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      {(o.status === "confirmed" || o.status === "delivered") && (
                        <button onClick={() => setReceipt(o)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition">
                          <Receipt size={11} /> Receipt
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === o.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-8 py-3">
                        <div className="text-xs text-gray-600 space-y-1">
                          <p className="font-semibold text-gray-700 mb-2">Items:</p>
                          {o.items.map((i) => (
                            <div key={i.id} className="flex justify-between max-w-sm">
                              <span>{i.product.name} × {i.quantity}</span>
                              <span className="font-medium">₱{(i.price * i.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium transition ${p === page ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
