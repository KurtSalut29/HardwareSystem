"use client";

import React, { useEffect, useState } from "react";
import { Search, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, CheckCheck, Receipt, Printer, X, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Toast from "@/components/ui/Toast";
import OrderMap, { OrderPin } from "@/components/OrderMap";
import LocationPicker, { PickedLocation } from "@/components/LocationPicker";

type OItem = { id: number; quantity: number; price: number; product: { name: string } };
type Order = {
  id: number;
  totalAmount: number;
  status: string;
  dateTime: string;
  customer: { username: string };
  items: OItem[];
  deliveryAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

// ── Set Location Modal ──────────────────────────────────────────────────────
function SetLocationModal({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(
    order.latitude && order.longitude
      ? { address: order.deliveryAddress ?? "", lat: order.latitude, lng: order.longitude }
      : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!pickedLocation) { setError("Please pick a location on the map."); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/orders/locations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: order.id,
        deliveryAddress: pickedLocation.address,
        latitude: pickedLocation.lat,
        longitude: pickedLocation.lng,
      }),
    });
    setSaving(false);
    if (!res.ok) { setError("Failed to save location."); return; }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-[201]">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-blue-600" />
            <div>
              <span className="font-semibold text-gray-800 text-sm">Delivery Location — Order #{order.id}</span>
              <p className="text-xs text-gray-400">Customer: {order.customer.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-4">
          <LocationPicker value={pickedLocation} onChange={setPickedLocation} />
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving || !pickedLocation}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Location"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Store Location Modal ────────────────────────────────────────────────────
function StoreLocationModal({ current, onClose, onSaved }: {
  current: { lat: number; lng: number; name: string } | null;
  onClose: () => void;
  onSaved: (loc: { lat: number; lng: number; name: string }) => void;
}) {
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(
    current ? { address: current.name, lat: current.lat, lng: current.lng } : null
  );
  const [storeName, setStoreName] = useState(current?.name ?? "Hardware Store");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!pickedLocation) { setError("Please pick the store location on the map."); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/store-location", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: pickedLocation.lat, lng: pickedLocation.lng, name: storeName }),
    });
    setSaving(false);
    if (!res.ok) { setError("Failed to save store location."); return; }
    onSaved({ lat: pickedLocation.lat, lng: pickedLocation.lng, name: storeName });
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-[201]">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-blue-600" />
            <span className="font-semibold text-gray-800 text-sm">Store Location</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Store Name</label>
            <input value={storeName} onChange={(e) => setStoreName(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Store Location on Map</label>
            <LocationPicker value={pickedLocation} onChange={setPickedLocation} />
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button onClick={handleSave} disabled={saving || !pickedLocation}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-60">
            {saving ? "Saving…" : "Save Store Location"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pins, setPins] = useState<OrderPin[]>([]);
  const [pinsLoading, setPinsLoading] = useState(true);
  const [role, setRole] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" | "warning" | "info" } | null>(null);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [locationOrder, setLocationOrder] = useState<Order | null>(null);
  const [storeLocation, setStoreLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [showStoreEditor, setShowStoreEditor] = useState(false);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null); // null = show all

  const PER_PAGE = 10;

  async function refreshPins() {
    setPinsLoading(true);
    try {
      const res = await fetch("/api/orders/locations");
      const data = res.ok ? await res.json() : [];
      setPins(Array.isArray(data) ? data : []);
    } catch { setPins([]); }
    setPinsLoading(false);
  }

  useEffect(() => {
    async function load() {
      const [oRes, meRes, locRes] = await Promise.all([fetch("/api/orders"), fetch("/api/auth/me"), fetch("/api/orders/locations")]);
      if (!oRes.ok) { setLoading(false); setPinsLoading(false); return; }
      const data = await oRes.json();
      const me = meRes.ok ? await meRes.json() : {};
      setOrders(Array.isArray(data) ? data : []);
      setRole(me.role ?? "");
      setLoading(false);
      try {
        const locData = locRes.ok ? await locRes.json() : [];
        setPins(Array.isArray(locData) ? locData : []);
      } catch {
        setPins([]);
      }
      setPinsLoading(false);
      // Fetch store location
      const storeRes = await fetch("/api/store-location");
      if (storeRes.ok) setStoreLocation(await storeRes.json());
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
    // Sync pin color immediately — no refresh needed
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    showToast(status);
  }

  const filtered = orders.filter((o) => {
    const matchSearch = o.customer.username.toLowerCase().includes(search.toLowerCase()) || String(o.id).includes(search);
    const matchDate = selectedKey ? toDateKey(new Date(o.dateTime)) === selectedKey : true;
    return matchSearch && matchDate;
  });

  // Filter map pins to match the selected date
  const filteredPins = selectedKey
    ? pins.filter((p) => {
        const order = orders.find((o) => o.id === p.id);
        return order ? toDateKey(new Date(order.dateTime)) === selectedKey : false;
      })
    : pins;
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Calendar helpers
  const orderDateKeys = new Set(orders.map((o) => toDateKey(new Date(o.dateTime))));

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

  function selectedLabel() {
    if (!selectedKey) return "All Orders";
    const [y, m, d] = selectedKey.split("-").map(Number);
    const date = new Date(y, m, d);
    if (toDateKey(date) === toDateKey(today)) return "Today";
    return date.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  const cells = buildCalendar();

  return (
    <div className="space-y-5">
      {receipt && <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />}
      {locationOrder && (
        <SetLocationModal
          order={locationOrder}
          onClose={() => setLocationOrder(null)}
          onSaved={() => { refreshPins(); setToast({ msg: "Location saved!", variant: "success" }); setTimeout(() => setToast(null), 3000); }}
        />
      )}
      {showStoreEditor && (
        <StoreLocationModal
          current={storeLocation}
          onClose={() => setShowStoreEditor(false)}
          onSaved={(loc) => {
            setStoreLocation(loc);
            setShowStoreEditor(false);
            setToast({ msg: "Store location updated!", variant: "success" });
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}
      <Toast message={toast?.msg ?? ""} variant={toast?.variant} />

      <PageHeader title="Orders" subtitle="Online orders from customers" />

      {/* Map */}
      <div className="bg-white rounded-xl border border-gray-200 p-4" style={{ isolation: 'isolate' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Delivery Locations</h2>
          {(role === "admin" || role === "cashier") && (
            <button onClick={() => setShowStoreEditor(true)}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-200 px-2.5 py-1.5 rounded-lg transition">
              <MapPin size={12} /> {storeLocation ? "Edit Store Location" : "Set Store Location"}
            </button>
          )}
        </div>
        <OrderMap
          pins={filteredPins}
          loading={pinsLoading}
          storeLat={storeLocation?.lat}
          storeLng={storeLocation?.lng}
          storeName={storeLocation?.name}
        />
      </div>

      {/* Calendar + Orders */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* Calendar sidebar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 w-full lg:w-72 lg:shrink-0">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-gray-900">{MONTHS[calMonth]} {calYear}</span>
            <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">
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
              const key = `${calYear}-${calMonth}-${day}`;
              const isToday = toDateKey(today) === key;
              const isSelected = selectedKey === key;
              const hasOrders = orderDateKeys.has(key);
              return (
                <button key={i} onClick={() => { setSelectedKey(isSelected ? null : key); setPage(1); }}
                  className={`relative w-8 h-8 mx-auto flex items-center justify-center rounded-lg text-xs font-medium transition
                    ${isSelected ? "bg-blue-600 text-white" : isToday ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-700 hover:bg-gray-100"}`}>
                  {day}
                  {hasOrders && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
                  )}
                  {hasOrders && isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/60" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Orders</span>
              <span className="font-semibold text-gray-900">{filtered.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Total Value</span>
              <span className="font-semibold text-blue-600">₱{filtered.reduce((s, o) => s + o.totalAmount, 0).toFixed(2)}</span>
            </div>
            {selectedKey && (
              <button onClick={() => { setSelectedKey(null); setPage(1); }}
                className="w-full mt-2 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg py-1.5 transition border border-gray-200">
                Clear filter — show all
              </button>
            )}
          </div>
        </div>

        {/* Orders table */}
        <div className="flex-1 min-w-0 max-w-full bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-100 bg-gray-50">
            <span className="font-semibold text-gray-900 text-sm">{selectedLabel()}</span>
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">{filtered.length} orders</span>
            <div className="relative ml-auto w-full sm:w-auto">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by ID or customer..."
                className="w-full sm:w-48 pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" />
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide w-8"></th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Order</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Customer</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Date</th>
                  <th className="py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400">No orders {selectedKey ? "on this date" : "found"}.</td></tr>
                ) : paginated.map((o) => (
                  <React.Fragment key={o.id}>
                    <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                      <td className="py-3 px-3 text-gray-400">
                        {expanded === o.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </td>
                      <td className="py-3 px-3 font-medium text-gray-900">
                        <span>#{o.id}</span>
                        <p className="text-xs text-gray-400 sm:hidden">{o.customer.username}</p>
                      </td>
                      <td className="py-3 px-3 text-gray-600 hidden sm:table-cell">{o.customer.username}</td>
                      <td className="py-3 px-3 font-semibold text-gray-900">₱{o.totalAmount.toFixed(2)}</td>
                      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
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
                      <td className="py-3 px-3 text-gray-400 text-xs hidden lg:table-cell">{new Date(o.dateTime).toLocaleString()}</td>
                      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1">
                          {(o.status === "confirmed" || o.status === "delivered") && (
                            <button onClick={() => setReceipt(o)}
                              className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition whitespace-nowrap">
                              <Receipt size={11} /> Receipt
                            </button>
                          )}
                          {(role === "admin" || role === "cashier") && (
                            <button onClick={() => setLocationOrder(o)}
                              className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition whitespace-nowrap">
                              <MapPin size={11} /> Location
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === o.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-4 sm:px-8 py-3">
                          <div className="text-xs text-gray-600 space-y-1">
                            <p className="font-semibold text-gray-700 mb-2">Items:</p>
                            {o.items.map((i) => (
                              <div key={i.id} className="flex justify-between max-w-sm">
                                <span>{i.product.name} × {i.quantity}</span>
                                <span className="font-medium">₱{(i.price * i.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                            {(() => {
                              const pin = pins.find((p) => p.id === o.id);
                              return pin?.distanceLabel ? (
                                <div className="mt-2 pt-2 border-t border-gray-200 flex gap-4">
                                  <span className="text-gray-500">🛣️ {pin.distanceLabel} from store</span>
                                  <span className="text-gray-500">🕐 {pin.durationLabel}</span>
                                </div>
                              ) : null;
                            })()}
                            <p className="text-gray-400 mt-2 lg:hidden">{new Date(o.dateTime).toLocaleString()}</p>
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
    </div>
  );
}
