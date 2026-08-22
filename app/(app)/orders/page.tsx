"use client";

import React, { useEffect, useState } from "react";
import { Search, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, CheckCheck, Receipt, Printer, MapPin, ChevronLeft, ChevronRight, Truck, Ban, Smartphone, ShieldCheck, ShieldAlert, Upload, Calendar as CalendarIcon } from "lucide-react";
import Image from "next/image";
import PageHeader from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import OrderMap, { OrderPin } from "@/components/OrderMap";
import LocationPicker, { PickedLocation } from "@/components/LocationPicker";
import { ORDER_STATUSES } from "@/lib/orderStatus";
import { ICON_SIZE } from "@/lib/constants/icon-size";

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
  driverId?: number | null;
  driver?: { username: string; contact?: string | null } | null;
  fulfillmentMode?: string;
  paymentMethod?: string;
  gcashNumber?: string | null;
  gcashReference?: string | null;
  paymentVerified?: boolean;
};

type StorePayment = { gcashName: string | null; gcashNumber: string | null; gcashQr: string | null };

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
    <Modal open onClose={onClose} title={`Delivery Location — Order #${order.id}`}>
      <div className="space-y-4">
        <p className="text-xs text-gray-400 -mt-2">Customer: {order.customer.username}</p>
        <LocationPicker value={pickedLocation} onChange={setPickedLocation} />
        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <Button onClick={handleSave} loading={saving} disabled={!pickedLocation} className="w-full">
          Save Location
        </Button>
      </div>
    </Modal>
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
    <Modal open onClose={onClose} title="Store Location">
      <div className="space-y-4">
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
        <Button onClick={handleSave} loading={saving} disabled={!pickedLocation} className="w-full">
          Save Store Location
        </Button>
      </div>
    </Modal>
  );
}

// ── GCash Settings Modal (admin) ────────────────────────────────────────────
function GcashSettingsModal({ current, onClose, onSaved }: {
  current: StorePayment | null;
  onClose: () => void;
  onSaved: (p: StorePayment) => void;
}) {
  const [gcashName, setGcashName] = useState(current?.gcashName ?? "");
  const [gcashNumber, setGcashNumber] = useState(current?.gcashNumber ?? "");
  const [gcashQr, setGcashQr] = useState(current?.gcashQr ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleQrUpload(file: File) {
    setUploading(true); setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) { setError((await res.json().catch(() => ({ error: "Upload failed" }))).error); return; }
    setGcashQr((await res.json()).url);
  }

  async function handleSave() {
    if (!/^09\d{9}$/.test(gcashNumber)) {
      setError("GCash number must be 11 digits starting with 09.");
      return;
    }
    setSaving(true); setError("");
    const res = await fetch("/api/store-payment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gcashName, gcashNumber, gcashQr }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json().catch(() => ({ error: "Failed to save" }))).error); return; }
    onSaved({ gcashName, gcashNumber, gcashQr });
  }

  return (
    <Modal open onClose={onClose} title="GCash Payment Details" size="sm">
      <div className="space-y-4">
        <p className="text-xs text-gray-500 -mt-2">
          Customers see this QR code and number at checkout when they pay with GCash.
        </p>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Account Name</label>
          <input value={gcashName} onChange={(e) => setGcashName(e.target.value)} placeholder="e.g. Juan D."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">GCash Number</label>
          <input value={gcashNumber} onChange={(e) => setGcashNumber(e.target.value.replace(/\D/g, "").slice(0, 11))}
            inputMode="numeric" placeholder="09XXXXXXXXX"
            className="w-full text-sm num border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">QR Code Image</label>
          <div className="flex items-center gap-3">
            <div className="relative w-24 h-24 shrink-0 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
              {gcashQr ? (
                <Image src={gcashQr} alt="GCash QR code" fill sizes="96px" className="object-contain p-1" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-[10px] text-center px-2">No QR yet</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg cursor-pointer transition">
                <Upload size={ICON_SIZE.xs} /> {uploading ? "Uploading..." : gcashQr ? "Replace QR" : "Upload QR"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleQrUpload(f); }} />
              </label>
              <p className="text-[10px] text-gray-400 mt-1.5">Screenshot your GCash &ldquo;Receive Money&rdquo; QR. PNG/JPG, max 2MB.</p>
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <Button onClick={handleSave} loading={saving} disabled={uploading} className="w-full">
          Save GCash Details
        </Button>
      </div>
    </Modal>
  );
}

function ReceiptModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Order Receipt" size="sm">
      <div>
        {/* Receipt Body */}
        <div id="receipt-print" className="space-y-4">
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

          {/* Payment */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Paid via</span>
              <span className="font-semibold text-gray-800">{order.paymentMethod ?? "Cash"}</span>
            </div>
            {order.paymentMethod === "GCash" && (
              <>
                {order.gcashNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">GCash No.</span>
                    <span className="font-semibold text-gray-800">{order.gcashNumber}</span>
                  </div>
                )}
                {order.gcashReference && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ref. No.</span>
                    <span className="font-semibold text-gray-800">{order.gcashReference}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment</span>
                  <span className={`font-semibold ${order.paymentVerified ? "text-green-600" : "text-yellow-600"}`}>
                    {order.paymentVerified ? "Verified" : "Unverified"}
                  </span>
                </div>
              </>
            )}
          </div>

          <p className="text-center text-[10px] text-gray-400 pt-1">Thank you for your purchase!</p>
        </div>

        {/* Print */}
        <Button
          onClick={() => {
            const content = document.getElementById("receipt-print")?.innerHTML ?? "";
            const win = window.open("", "_blank", "width=400,height=600");
            if (!win) return;
            win.document.write(`<html><head><title>Receipt</title><style>body{font-family:sans-serif;padding:20px;max-width:320px;margin:auto}hr{border:none;border-top:1px dashed #ccc;margin:12px 0}.flex{display:flex;justify-content:space-between;font-size:12px;margin:4px 0}.bold{font-weight:700}.center{text-align:center}.total{font-size:16px;font-weight:700}</style></head><body>${content}</body></html>`);
            win.document.close();
            win.print();
          }}
          icon={<Printer size={ICON_SIZE.sm} />}
          className="w-full mt-4"
        >
          Print Receipt
        </Button>
      </div>
    </Modal>
  );
}

const STATUSES = [...ORDER_STATUSES];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string; border: string }> = {
  pending:   { label: "Pending",   icon: <Clock size={ICON_SIZE.xs} />,     bg: "bg-yellow-50",  text: "text-yellow-600", border: "border-yellow-200" },
  confirmed: { label: "Confirmed", icon: <CheckCircle size={ICON_SIZE.xs} />, bg: "bg-blue-50",  text: "text-blue-600",   border: "border-blue-200" },
  out_for_delivery: { label: "Out for Delivery", icon: <Truck size={ICON_SIZE.xs} />, bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-200" },
  delivered: { label: "Delivered", icon: <CheckCheck size={ICON_SIZE.xs} />, bg: "bg-green-50",  text: "text-green-600",  border: "border-green-200" },
  cancelled: { label: "Cancelled", icon: <XCircle size={ICON_SIZE.xs} />,   bg: "bg-red-50",    text: "text-red-500",    border: "border-red-200" },
};

const TOAST_CONFIG: Record<string, { msg: string; variant: "success" | "error" | "warning" | "info" }> = {
  confirmed: { msg: "Order confirmed successfully!",  variant: "info" },
  out_for_delivery: { msg: "Order is out for delivery!", variant: "info" },
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


type Driver = { id: number; username: string; activeCount: number };

/** Driver picker sized for a table cell. Lives in the fixed "Next Step" column,
 *  so assigning is always in the same place on every row that needs it. */
function AssignDriverSelect({ drivers, onAssign, reassign = false }: {
  drivers: Driver[];
  onAssign: (driverId: string) => void;
  reassign?: boolean;
}) {
  if (drivers.length === 0) {
    return <span className="text-[11px]" style={{ color: "var(--warn)" }}>No drivers registered</span>;
  }
  return (
    <div className="relative inline-block w-[152px]">
      <select
        value=""
        onChange={(e) => { if (e.target.value) onAssign(e.target.value); }}
        className={`w-full appearance-none cursor-pointer rounded-lg text-[11px] font-bold py-1.5 pl-7 pr-6 transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
          reassign
            ? "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
        }`}
      >
        <option value="">{reassign ? "Reassign" : "Assign Driver"}</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id} className="bg-white text-gray-900 font-medium">
            {d.username} ({d.activeCount} active)
          </option>
        ))}
      </select>
      <Truck size={11} className={`absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${reassign ? "text-gray-400" : "text-white"}`} />
      <ChevronDown size={11} className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${reassign ? "text-gray-400" : "text-white/80"}`} />
    </div>
  );
}

/** The single next action for a row — always in the same column. */
function NextStepCell({ order, drivers, canAssign, onStatus, onAssign }: {
  order: Order;
  drivers: Driver[];
  /** Only the cashier dispatches drivers; admins see the state, not the control. */
  canAssign: boolean;
  onStatus: (id: number, status: string) => void;
  onAssign: (id: number, driverId: string) => void;
}) {
  const isPickup = order.fulfillmentMode === "pickup";

  if (order.status === "pending") {
    return (
      <button onClick={() => onStatus(order.id, "confirmed")}
        className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-3 py-1.5 transition shadow-sm whitespace-nowrap">
        Confirm Order
      </button>
    );
  }
  if (order.status === "confirmed" && !isPickup && !order.driverId) {
    if (!canAssign) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap"
          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
          <Truck size={11} /> Cashier to assign
        </span>
      );
    }
    return <AssignDriverSelect drivers={drivers} onAssign={(d) => onAssign(order.id, d)} />;
  }
  if (order.status === "confirmed" && isPickup) {
    return (
      <button onClick={() => onStatus(order.id, "delivered")}
        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 transition shadow-sm whitespace-nowrap">
        Mark Picked Up
      </button>
    );
  }
  if (order.status === "out_for_delivery") {
    // Reassigning is secondary and already available in the expanded row, so
    // this column stays one button wide for every row.
    return (
      <button onClick={() => onStatus(order.id, "delivered")}
        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 transition shadow-sm whitespace-nowrap">
        Mark Delivered
      </button>
    );
  }
  return <span className="text-[11px] text-gray-300">—</span>;
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
  const showToast = useToast();
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [locationOrder, setLocationOrder] = useState<Order | null>(null);
  const [storeLocation, setStoreLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [showStoreEditor, setShowStoreEditor] = useState(false);
  const [storePayment, setStorePayment] = useState<StorePayment | null>(null);
  const [showGcashEditor, setShowGcashEditor] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [drivers, setDrivers] = useState<{ id: number; username: string; activeCount: number }[]>([]);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

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
      if (me.role === "admin" || me.role === "cashier") {
        const dRes = await fetch("/api/drivers");
        if (dRes.ok) setDrivers(await dRes.json());
      }
      try {
        const locData = locRes.ok ? await locRes.json() : [];
        setPins(Array.isArray(locData) ? locData : []);
      } catch {
        setPins([]);
      }
      setPinsLoading(false);
      // Fetch store location + GCash details
      const [storeRes, payRes] = await Promise.all([fetch("/api/store-location"), fetch("/api/store-payment")]);
      if (storeRes.ok) setStoreLocation(await storeRes.json());
      if (payRes.ok) setStorePayment(await payRes.json());
    }
    load();

    // Silent background poll so driver movement shows up without a loading flicker
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/orders/locations");
        if (res.ok) {
          const data = await res.json();
          setPins(Array.isArray(data) ? data : []);
        }
      } catch { /* ignore transient poll failures */ }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  function notifyStatus(status: string) {
    const cfg = TOAST_CONFIG[status];
    if (cfg) showToast(cfg.msg, cfg.variant);
  }

  async function updateStatus(id: number, status: string) {
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) { showToast((await res.json().catch(() => ({ error: "Failed to update order" }))).error, "error"); return; }
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    // Sync pin color immediately — no refresh needed
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    notifyStatus(status);
  }

  async function handleCancelConfirm() {
    if (!cancelTarget) return;
    await updateStatus(cancelTarget.id, "cancelled");
    setCancelTarget(null);
  }

  async function assignDriver(id: number, driverIdStr: string) {
    const driverId = driverIdStr === "" ? null : Number(driverIdStr);
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, driverId }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    const driver = driverId ? drivers.find((d) => d.id === driverId) ?? null : null;
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, driverId: updated.driverId, driver, status: updated.status } : o)));
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, status: updated.status } : p)));
    if (driver) showToast(`${driver.username} was notified about Order #${id}.`, "success");
    else notifyStatus(updated.status);
  }

  async function setPaymentVerified(id: number, verified: boolean) {
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, paymentVerified: verified }),
    });
    if (!res.ok) { showToast((await res.json().catch(() => ({ error: "Failed to update payment" }))).error, "error"); return; }
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, paymentVerified: verified } : o)));
    showToast(verified ? `GCash payment for Order #${id} marked verified.` : `Order #${id} payment set back to unverified.`, verified ? "success" : "warning");
  }

  const isStaff = role === "admin" || role === "cashier";
  // Dispatch moved to the cashier; the admin keeps confirm/cancel/payment duties.
  const canAssign = role === "cashier";
  const outForDeliveryCount = orders.filter((o) => o.status === "out_for_delivery").length;

  // Tabs are a *filter over the one list* — never a second copy of it.
  const matchesFilter = (o: Order, f: string) => {
    switch (f) {
      case "pending": return o.status === "pending";
      case "needs_driver": return o.status === "confirmed" && o.fulfillmentMode !== "pickup" && !o.driverId;
      case "active": return o.status === "out_for_delivery" || (o.status === "confirmed" && o.fulfillmentMode === "pickup");
      case "done": return o.status === "delivered" || o.status === "cancelled";
      default: return true;
    }
  };

  const TABS: { key: string; label: string; urgent?: boolean }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending", urgent: true },
    { key: "needs_driver", label: "Needs Driver", urgent: true },
    { key: "active", label: "In Progress" },
    { key: "done", label: "Completed" },
  ];

  const filtered = orders.filter((o) => {
    const matchSearch = o.customer.username.toLowerCase().includes(search.toLowerCase()) || String(o.id).includes(search);
    const matchDate = selectedKey ? toDateKey(new Date(o.dateTime)) === selectedKey : true;
    return matchSearch && matchDate && matchesFilter(o, statusFilter);
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
          onSaved={() => { refreshPins(); showToast("Location saved!"); }}
        />
      )}
      {showStoreEditor && (
        <StoreLocationModal
          current={storeLocation}
          onClose={() => setShowStoreEditor(false)}
          onSaved={(loc) => {
            setStoreLocation(loc);
            setShowStoreEditor(false);
            showToast("Store location updated!");
          }}
        />
      )}
      {showGcashEditor && (
        <GcashSettingsModal
          current={storePayment}
          onClose={() => setShowGcashEditor(false)}
          onSaved={(p) => {
            setStorePayment(p);
            setShowGcashEditor(false);
            showToast("GCash details updated!");
          }}
        />
      )}

      <ConfirmModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirm}
        title="Cancel this order?"
        body={cancelTarget ? <>Order #{cancelTarget.id} (₱{cancelTarget.totalAmount.toFixed(2)}) will be cancelled. This can&apos;t be undone.</> : null}
        confirmLabel="Yes, Cancel Order"
        cancelLabel="Keep Order"
      />

      <PageHeader
        title="Orders"
        subtitle="Online orders from customers"
        action={role === "admin" ? (
          <button onClick={() => setShowGcashEditor(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-600 bg-white hover:bg-blue-50 border border-gray-200 px-3 py-2 rounded-xl transition shadow-sm">
            <Smartphone size={ICON_SIZE.xs} /> {storePayment?.gcashNumber ? "GCash Details" : "Set Up GCash"}
          </button>
        ) : undefined}
      />

      {/* Map — collapsed by default so the workflow owns the top of the page */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ isolation: 'isolate' }}>
        <button onClick={() => setShowMap((v) => !v)}
          className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-gray-50 transition text-left">
          <MapPin size={ICON_SIZE.sm} className="text-gray-400 shrink-0" />
          <span className="text-sm font-semibold text-gray-700">Delivery Map</span>
          {outForDeliveryCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#EEF2FF", color: "#4F46E5" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4F46E5" }} />
              {outForDeliveryCount} out
            </span>
          )}
          <span className="ml-auto text-xs text-gray-400">{showMap ? "Hide" : "Show"}</span>
          {showMap ? <ChevronUp size={ICON_SIZE.sm} className="text-gray-400" /> : <ChevronDown size={ICON_SIZE.sm} className="text-gray-400" />}
        </button>
        {showMap && (
          <div className="px-4 pb-4">
            {isStaff && (
              <div className="flex justify-end mb-2">
                <button onClick={() => setShowStoreEditor(true)}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-200 px-2.5 py-1.5 rounded-lg transition">
                  <MapPin size={ICON_SIZE.xs} /> {storeLocation ? "Edit Store Location" : "Set Store Location"}
                </button>
              </div>
            )}
            <OrderMap
              pins={filteredPins}
              loading={pinsLoading}
              storeLat={storeLocation?.lat}
              storeLng={storeLocation?.lng}
              storeName={storeLocation?.name}
            />
          </div>
        )}
      </div>

      {/* One list. Tabs filter it, search is always on screen. */}
      <div className="flex flex-col md:flex-row gap-5 items-start">

        {/* Calendar sidebar — off by default so the table gets the full width */}
        <div className={`bg-white rounded-xl border border-gray-200 p-5 w-full md:w-72 md:shrink-0 ${showCalendar ? "" : "hidden"}`}>
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">
              <ChevronLeft size={ICON_SIZE.sm} />
            </button>
            <span className="text-sm font-semibold text-gray-900">{MONTHS[calMonth]} {calYear}</span>
            <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">
              <ChevronRight size={ICON_SIZE.sm} />
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
            <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
              <button onClick={() => setShowCalendar((v) => !v)}
                className={`flex items-center gap-1.5 shrink-0 text-xs font-semibold px-3 py-2 rounded-lg border transition whitespace-nowrap ${
                  selectedKey || showCalendar
                    ? "bg-blue-50 text-blue-600 border-blue-200"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                }`}>
                <CalendarIcon size={ICON_SIZE.xs} />
                {selectedKey ? selectedLabel() : "Any date"}
              </button>
              <div className="relative flex-1 sm:flex-none">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by ID or customer..."
                  className="w-full sm:w-60 pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition placeholder:text-gray-400" />
              </div>
            </div>
          </div>

          {/* Status tabs — a filter over this same table, not a second list */}
          {isStaff && (
            <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 border-b border-gray-100">
              {TABS.map((t) => {
                const count = orders.filter((o) => matchesFilter(o, t.key)).length;
                const active = statusFilter === t.key;
                const flag = t.urgent && count > 0 && !active;
                return (
                  <button key={t.key} onClick={() => { setStatusFilter(t.key); setPage(1); }}
                    className={`shrink-0 flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                      active
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}>
                    {t.label}
                    <span className={`text-[10px] font-bold px-1.5 py-px rounded-full ${
                      active ? "bg-white/25 text-white"
                        : flag ? "text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                      style={flag ? { background: "var(--warn)" } : undefined}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide w-8"></th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Order</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Customer</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  {/* w-px + nowrap makes these hug their content, so the slack
                      lands in the text columns instead of gaping on the right. */}
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden xl:table-cell w-px whitespace-nowrap">Date</th>
                  <th className="py-2.5 px-2 w-px"></th>
                  {isStaff && <th className="text-right py-2.5 px-4 text-xs font-semibold uppercase tracking-wide whitespace-nowrap w-px" style={{ color: "var(--brand)" }}>Next Step</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={isStaff ? 8 : 7} className="py-12 text-center text-gray-400">Loading...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={isStaff ? 8 : 7}><EmptyState icon={Receipt} title={`No orders ${selectedKey ? "on this date" : "found"}`} /></td></tr>
                ) : paginated.map((o) => (
                  <React.Fragment key={o.id}>
                    <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                      <td className="py-3 px-4 text-gray-400">
                        {expanded === o.id ? <ChevronUp size={ICON_SIZE.sm} /> : <ChevronDown size={ICON_SIZE.sm} />}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">
                        <span title={o.fulfillmentMode === "pickup" ? "Pickup at Store" : "Delivery"}>
                          {o.fulfillmentMode === "pickup" ? "🏪" : "🚚"} #{o.id}
                        </span>
                        <p className="text-xs text-gray-400 sm:hidden">{o.customer.username}</p>
                      </td>
                      <td className="py-3 px-4 text-gray-600 hidden sm:table-cell">{o.customer.username}</td>
                      <td className="py-3 px-4 font-semibold text-gray-900">₱{o.totalAmount.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={o.status} />
                          {o.paymentMethod === "GCash" && !o.paymentVerified && o.status !== "cancelled" && (
                            <span title="GCash payment not verified yet">
                              <ShieldAlert size={13} style={{ color: "var(--warn)" }} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs hidden xl:table-cell whitespace-nowrap w-px">
                        {new Date(o.dateTime).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      {/* Secondary actions stay icon-only so the Next Step column
                          at the end always has room to render in full. */}
                      <td className="py-3 px-2 w-px" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {(o.status === "confirmed" || o.status === "delivered" || o.status === "out_for_delivery") && (
                            <button onClick={() => setReceipt(o)} title="View receipt" aria-label="View receipt"
                              className="w-7 h-7 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                              <Receipt size={ICON_SIZE.xs} />
                            </button>
                          )}
                          {isStaff && (
                            <button onClick={() => setLocationOrder(o)} title="Set delivery location" aria-label="Set delivery location"
                              className="w-7 h-7 flex items-center justify-center text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition">
                              <MapPin size={ICON_SIZE.xs} />
                            </button>
                          )}
                          {((role === "customer" && (o.status === "pending" || o.status === "confirmed")) ||
                            (isStaff && o.status !== "delivered" && o.status !== "cancelled")) && (
                            <button onClick={() => setCancelTarget(o)} title="Cancel order" aria-label="Cancel order"
                              className="w-7 h-7 flex items-center justify-center text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition">
                              <Ban size={ICON_SIZE.xs} />
                            </button>
                          )}
                        </div>
                      </td>
                      {isStaff && (
                        <td className="py-3 px-4 text-right w-px whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end">
                            <NextStepCell order={o} drivers={drivers} canAssign={canAssign} onStatus={updateStatus} onAssign={assignDriver} />
                          </div>
                        </td>
                      )}
                    </tr>
                    {expanded === o.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={isStaff ? 8 : 7} className="px-4 sm:px-8 py-3">
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
                            <div className="mt-2 pt-2 border-t border-gray-200 flex gap-4">
                              <span className="text-gray-500">{o.fulfillmentMode === "pickup" ? "🏪 Pickup at Store" : "🚚 Delivery"}</span>
                              {o.paymentMethod && <span className="text-gray-500">💳 {o.paymentMethod}</span>}
                            </div>

                            {o.paymentMethod === "GCash" && (
                              <div className="mt-2 pt-2 border-t border-gray-200 flex flex-wrap items-center gap-x-4 gap-y-2">
                                <span className="inline-flex items-center gap-1.5 text-gray-500">
                                  <Smartphone size={ICON_SIZE.xs} className="text-blue-500 shrink-0" />
                                  From <span className="font-medium text-gray-700 num">{o.gcashNumber ?? "—"}</span>
                                </span>
                                <span className="text-gray-500">
                                  Ref. No. <span className="font-medium text-gray-700 num">{o.gcashReference ?? "—"}</span>
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  o.paymentVerified ? "bg-green-50 text-green-600 border-green-200" : "bg-yellow-50 text-yellow-600 border-yellow-200"
                                }`}>
                                  {o.paymentVerified ? <ShieldCheck size={ICON_SIZE.xs} /> : <ShieldAlert size={ICON_SIZE.xs} />}
                                  {o.paymentVerified ? "Payment verified" : "Payment unverified"}
                                </span>
                                {(role === "admin" || role === "cashier") && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setPaymentVerified(o.id, !o.paymentVerified); }}
                                    className={`text-[11px] font-semibold px-2 py-1 rounded-lg transition ${
                                      o.paymentVerified
                                        ? "text-gray-500 bg-gray-100 hover:bg-gray-200"
                                        : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                                    }`}
                                  >
                                    {o.paymentVerified ? "Undo verification" : "Mark as received"}
                                  </button>
                                )}
                              </div>
                            )}
                            {o.fulfillmentMode === "pickup" ? (
                              <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-2 text-gray-400">
                                <Truck size={ICON_SIZE.xs} className="shrink-0" />
                                <span>Pickup — no driver needed</span>
                              </div>
                            ) : canAssign ? (
                              <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Truck size={ICON_SIZE.xs} className="text-indigo-500 shrink-0" />
                                <span className="text-gray-500">Driver:</span>
                                <select
                                  value={o.driverId ?? ""}
                                  onChange={(e) => assignDriver(o.id, e.target.value)}
                                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                >
                                  <option value="">— Unassigned —</option>
                                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.username} ({d.activeCount} active)</option>)}
                                </select>
                              </div>
                            ) : o.driver ? (
                              <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-2">
                                <Truck size={ICON_SIZE.xs} className="text-indigo-500 shrink-0" />
                                <span className="text-gray-500">
                                  Driver: <span className="font-medium text-gray-700">{o.driver.username}</span>
                                  {o.driver.contact && <span className="text-gray-400"> · {o.driver.contact}</span>}
                                </span>
                              </div>
                            ) : null}
                            {/* Manual status override for the rare case the
                                Next Step button doesn't cover (e.g. reverting). */}
                            {isStaff && (
                              <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <span className="text-gray-500">Change status:</span>
                                <select
                                  value={o.status}
                                  onChange={(e) => (e.target.value === "cancelled" ? setCancelTarget(o) : updateStatus(o.id, e.target.value))}
                                  className={`text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold cursor-pointer
                                    ${STATUS_CONFIG[o.status]?.bg} ${STATUS_CONFIG[o.status]?.text} ${STATUS_CONFIG[o.status]?.border}`}
                                >
                                  {(o.fulfillmentMode === "pickup" ? STATUSES.filter((s) => s !== "out_for_delivery") : STATUSES)
                                    .map((s) => <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>)}
                                </select>
                              </div>
                            )}
                            <p className="text-gray-400 mt-2 xl:hidden">{new Date(o.dateTime).toLocaleString()}</p>
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
