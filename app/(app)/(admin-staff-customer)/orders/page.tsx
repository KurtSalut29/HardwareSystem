"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList, ShoppingBag, UserRoundSearch, ChevronDown, CheckCircle, Clock, CheckCheck, Receipt, Plus, Camera, Phone, MapPin, ChevronLeft, ChevronRight, Truck, Ban, Smartphone, ShieldCheck, ShieldAlert, Upload, Wallet, Undo2, StickyNote, UserRound, ArrowUpRight, Calendar as CalendarIcon, Store, Route, CreditCard, X, CalendarDays } from "lucide-react";
import Image from "next/image";
import PageHeader from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import FilterTiles, { type FilterTile } from "@/components/ui/FilterTiles";
import Segmented, { type SegmentOption } from "@/components/ui/Segmented";
import SearchField from "@/components/ui/SearchField";
import StatusPill, { ORDER_STATUS_STYLE, statusLabel } from "@/components/orders/StatusPill";
import { useToast } from "@/components/ui/ToastProvider";
import OrderMap, { OrderPin, MapFocus } from "@/components/OrderMap";
import LocationPicker, { PickedLocation } from "@/components/LocationPicker";
import { ORDER_STATUSES } from "@/lib/orderStatus";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import { STORE_NAME } from "@/lib/brand";
import ReceiptModal from "@/components/receipts/Receipt";
import NewOrderModal from "@/components/orders/NewOrderModal";
import SwitchToDeliveryModal from "@/components/orders/SwitchToDeliveryModal";
import DeliveryFeeSettingsModal from "@/components/orders/DeliveryFeeSettingsModal";
import { orderReceipt } from "@/lib/receipts";
import { customerLabel, customerPhone, isWalkIn } from "@/lib/customer";
import OrderStatusModal from "@/components/orders/OrderStatusModal";
import DriversPanel, { DriverStatusChip, driverState, type DriverInfo } from "@/components/orders/DriversPanel";
import Drawer from "@/components/ui/Drawer";
import { driverOption, canTakeOrder } from "@/lib/driverStatus";
import { outstanding, paymentState } from "@/lib/payment";
import { onTodaysBoard } from "@/lib/storeDay";
import Alert from "@/components/ui/Alert";
import PaymentHistory, { type PaymentRow } from "@/components/payments/PaymentHistory";
import ReviewPaymentModal from "@/components/payments/ReviewPaymentModal";
import SendRefundModal from "@/components/payments/SendRefundModal";
import PayBalanceModal from "@/components/payments/PayBalanceModal";
import CancelOrderModal from "@/components/orders/CancelOrderModal";
import { useSettings } from "@/lib/useSettings";

type OItem = { id: number; quantity: number; price: number; product: { name: string; unit?: string } };
type Order = {
  id: number;
  totalAmount: number;
  status: string;
  dateTime: string;
  customer: { username: string; contact?: string | null } | null;
  customerName?: string | null;
  customerContact?: string | null;
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
  amountPaid?: number;
  assignedAt?: string | null;
  transaction?: { dateTime: string } | null;
  deliveryFee?: number;
  deliveryFeeNote?: string | null;
  transactionId?: number | null;
  payments?: PaymentRow[];
  recipientName?: string | null;
  recipientContact?: string | null;
  deliveryNotes?: string | null;
  paymentDueAt?: string | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  proofImage?: string | null;
  deliveredAt?: string | null;
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
    <Modal open onClose={onClose} title={`Delivery Location — Order #${order.id}`} icon={<MapPin className="size-5" />} description={`Where to drop off ${customerLabel(order)}'s order.`}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!pickedLocation} className="flex-1">Save location</Button>
        </div>
      }>
      <div className="space-y-4">
        <LocationPicker value={pickedLocation} onChange={setPickedLocation} />
        {error && <Alert tone="bad" compact>{error}</Alert>}
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
  const [storeName, setStoreName] = useState(current?.name ?? STORE_NAME);
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
    <Modal open onClose={onClose} title="Store Location" icon={<Store className="size-5" />} description="Where every delivery starts. Routes and fees are measured from here."
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!pickedLocation} className="flex-1">Save store location</Button>
        </div>
      }>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Store Name</label>
          <input value={storeName} onChange={(e) => setStoreName(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" />
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Store Location on Map</label>
          <LocationPicker value={pickedLocation} onChange={setPickedLocation} measure={false} />
        </div>
        {error && <Alert tone="bad" compact>{error}</Alert>}
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
    <Modal open onClose={onClose} title="GCash Payment Details" icon={<Smartphone className="size-5" />} description="Customers see this QR code and number when they pay with GCash." size="sm"
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={uploading} className="flex-1">Save GCash details</Button>
        </div>
      }>
      <div className="space-y-4">

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Account Name</label>
          <input value={gcashName} onChange={(e) => setGcashName(e.target.value)} placeholder="e.g. Juan D."
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" />
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">GCash Number</label>
          <input value={gcashNumber} onChange={(e) => setGcashNumber(e.target.value.replace(/\D/g, "").slice(0, 11))}
            inputMode="numeric" placeholder="09XXXXXXXXX"
            className="w-full num rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" />
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">QR Code Image</label>
          <div className="flex items-center gap-3">
            <div className="relative w-24 h-24 shrink-0 rounded-lg border border-line bg-subtle overflow-hidden">
              {gcashQr ? (
                <Image src={gcashQr} alt="GCash QR code" fill sizes="96px" className="object-contain p-1" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-ink-4 text-[10px] text-center px-2">No QR yet</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand-soft hover:bg-brand-soft px-3 py-2 rounded-lg cursor-pointer transition">
                <Upload size={ICON_SIZE.xs} /> {uploading ? "Uploading..." : gcashQr ? "Replace QR" : "Upload QR"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleQrUpload(f); }} />
              </label>
              <p className="text-[10px] text-ink-4 mt-1.5">Screenshot your GCash &ldquo;Receive Money&rdquo; QR. PNG/JPG, max 2MB.</p>
            </div>
          </div>
        </div>

        {error && <Alert tone="bad" compact>{error}</Alert>}
      </div>
    </Modal>
  );
}

const STATUSES = [...ORDER_STATUSES];

const TOAST_CONFIG: Record<string, { msg: string; variant: "success" | "error" | "warning" | "info" }> = {
  confirmed: { msg: "Order confirmed successfully!",  variant: "info" },
  out_for_delivery: { msg: "Order is out for delivery!", variant: "info" },
  delivered: { msg: "Order marked as delivered!",     variant: "success" },
  cancelled: { msg: "Order has been cancelled.",      variant: "error" },
  pending:   { msg: "Order set back to pending.",     variant: "warning" },
};

type ModeFilter = "all" | "delivery" | "pickup";
type StatusFilter = "all" | "pending" | "needs_driver" | "active" | "open" | "done" | "payments" | "refunds";

type Driver = DriverInfo;

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "Today, 2:15 PM", "Yesterday, 9:02 AM" or "Nov 14, 2:15 PM". */
function fmtWhen(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  const now = new Date();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (toDateKey(d) === toDateKey(now)) return `Today, ${time}`;
  if (toDateKey(d) === toDateKey(y)) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-PH", { month: "short", day: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) })}, ${time}`;
}

/** "Portland Cement +3 more" — the full list is in the opened order. */
function itemsLine(items: OItem[]) {
  if (items.length === 0) return "No items";
  return items.length > 1 ? `${items[0].product.name} +${items.length - 1} more` : items[0].product.name;
}

/** Driver picker sized for a list row. Lives in the fixed "Next step" slot,
 *  so assigning is always in the same place on every row that needs it. */
function AssignDriverSelect({ drivers, onAssign }: { drivers: Driver[]; onAssign: (driverId: string) => void }) {
  if (drivers.length === 0) return <span className="text-[12px] font-semibold text-warn">No drivers registered</span>;
  return (
    <div className="relative w-full lg:w-[168px]">
      <select value="" onChange={(e) => { if (e.target.value) onAssign(e.target.value); }} aria-label="Assign a driver"
        className="h-9 w-full cursor-pointer appearance-none rounded-xl border border-brand/40 bg-brand-soft pl-8 pr-7 text-[12.5px] font-bold text-brand-ink transition hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30">
        <option value="">Assign driver</option>
        {drivers.map((d) => {
          const o = driverOption(d);
          return <option key={d.id} value={d.id} disabled={o.disabled} className="bg-surface font-medium text-ink">{o.label}</option>;
        })}
      </select>
      <Truck className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-brand" />
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-brand" />
    </div>
  );
}

const NEXT_BTN = "inline-flex h-9 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-[12.5px] font-bold transition active:scale-[0.98] lg:w-[168px]";

const pendingPayments = (o: Order) => (o.payments ?? []).filter((p) => p.kind === "payment" && p.status === "pending");
const pendingRefunds = (o: Order) => (o.payments ?? []).filter((p) => p.kind === "refund" && p.status === "pending");
const pendingSum = (o: Order) => pendingPayments(o).reduce((t, p) => t + p.amount, 0);
const dueDay = (d: string) => new Date(d).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });

/** The single next action for a row — always in the same place. */
function NextStepCell({ order, drivers, canAssign, onStatus, onAssign, onCheck }: {
  order: Order;
  /** Opens the oldest GCash receipt waiting to be checked. */
  onCheck: (o: Order) => void;
  drivers: Driver[];
  /** Only the cashier dispatches drivers; admins see the state, not the control. */
  canAssign: boolean;
  onStatus: (id: number, status: string) => void;
  onAssign: (id: number, driverId: string) => void;
}) {
  const isPickup = order.fulfillmentMode === "pickup";

  if (pendingPayments(order).length > 0 && order.status !== "cancelled") {
    return (
      <button type="button" onClick={() => onCheck(order)}
        className={`${NEXT_BTN} bg-brand text-white shadow-[0_8px_18px_-10px_rgba(30,79,216,0.8)] hover:brightness-110`}>
        <ShieldCheck className="size-3.5" /> Check payment
      </button>
    );
  }
  if (order.status === "pending") {
    return (
      <button type="button" onClick={() => onStatus(order.id, "confirmed")}
        className={`${NEXT_BTN} bg-brand text-white shadow-[0_8px_18px_-10px_rgba(30,79,216,0.8)] hover:brightness-110`}>
        <CheckCircle className="size-3.5" /> Confirm order
      </button>
    );
  }
  if (order.status === "confirmed" && !isPickup && !order.driverId) {
    if (!canAssign) {
      const free = drivers.filter((d) => canTakeOrder(d.availability ?? "available")).length;
      return (
        <span title={drivers.length === 0 ? "No drivers yet" : free ? `${free} driver${free === 1 ? "" : "s"} free` : "All drivers busy"}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-warn-soft px-3 text-[12.5px] font-semibold text-warn lg:w-[168px]">
          <Truck className="size-3.5" /> Waiting for a driver
        </span>
      );
    }
    return <AssignDriverSelect drivers={drivers} onAssign={(d) => onAssign(order.id, d)} />;
  }
  if ((order.status === "confirmed" && isPickup) || order.status === "out_for_delivery") {
    return (
      <button type="button" onClick={() => onStatus(order.id, "delivered")}
        className={`${NEXT_BTN} border border-good/40 bg-good-soft text-good hover:border-good`}>
        <CheckCheck className="size-3.5" /> {isPickup ? "Mark picked up" : "Mark delivered"}
      </button>
    );
  }
  return null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** A labelled block inside an opened order. */
function DetailBlock({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-surface p-3.5">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-4">{icon} {title}</h3>
      <div className="space-y-2 text-[13px] text-ink-2">{children}</div>
    </section>
  );
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
  const [switchOrder, setSwitchOrder] = useState<Order | null>(null);
  const [storeLocation, setStoreLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [showStoreEditor, setShowStoreEditor] = useState(false);
  const [storePayment, setStorePayment] = useState<StorePayment | null>(null);
  const [showGcashEditor, setShowGcashEditor] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showDrivers, setShowDrivers] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const params = useSearchParams();
  const viewParam = params.get("view");
  const fromParam = (v: string | null): StatusFilter => (v === "payments" || v === "refunds" || v === "pending" ? v : "all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => fromParam(viewParam));
  // A notification link (e.g. "?view=payments") while already on this page switches the filter.
  const [seenView, setSeenView] = useState(viewParam);
  if (seenView !== viewParam) { setSeenView(viewParam); setStatusFilter(fromParam(viewParam)); }
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  /** The driver list failed to load, so an empty list doesn't mean "no drivers". */
  const [driversError, setDriversError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const staffRef = useRef(false);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ order: Order; payment: PaymentRow } | null>(null);
  const [refundTarget, setRefundTarget] = useState<{ order: Order; payment: PaymentRow } | null>(null);
  const [payTarget, setPayTarget] = useState<Order | null>(null);
  const settings = useSettings();
  const [statusOrderId, setStatusOrderId] = useState<number | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showFeeEditor, setShowFeeEditor] = useState(false);
  const [proofView, setProofView] = useState<Order | null>(null);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null); // null = show all
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");

  const PER_PAGE = 10;

  async function refreshDrivers() {
    try {
      const res = await fetch("/api/drivers");
      if (res.ok) { setDrivers(await res.json()); setDriversError(false); }
      else setDriversError(true);
    } catch { setDriversError(true); /* keep the last list */ }
  }

  function showDriverOnMap(d: DriverInfo) {
    if (!d.lastLocation) return;
    const onRoad = d.activeOrders?.map((o) => `#${o.id}`).join(", ");
    setShowDrivers(false);
    setShowMap(true);
    setMapFocus({
      lat: d.lastLocation.lat, lng: d.lastLocation.lng, key: Date.now(), label: d.username,
      detail: onRoad ? `Delivering ${onRoad}` : "Last known location",
    });
  }

  async function refreshPins() {
    setPinsLoading(true);
    try {
      const res = await fetch("/api/orders/locations?scope=all");
      const data = res.ok ? await res.json() : [];
      setPins(Array.isArray(data) ? data : []);
    } catch { setPins([]); }
    setPinsLoading(false);
  }

  useEffect(() => {
    async function load() {
      const [oRes, meRes, locRes] = await Promise.all([fetch("/api/orders"), fetch("/api/auth/me"), fetch("/api/orders/locations?scope=all")]);
      if (!oRes.ok) { setLoading(false); setPinsLoading(false); return; }
      const data = await oRes.json();
      const me = meRes.ok ? await meRes.json() : {};
      setOrders(Array.isArray(data) ? data : []);
      setRole(me.role ?? "");
      setLoading(false);
      if (me.role === "admin" || me.role === "cashier") {
        staffRef.current = true;
        refreshDrivers();
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
      setNow(Date.now());
      if (staffRef.current) refreshDrivers();
      try {
        const res = await fetch("/api/orders/locations?scope=all");
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
    if (isStaff) refreshDrivers();
    notifyStatus(status);
  }

  /** Reloads every order (after a payment, refund or cancellation changed several fields). */
  async function reloadOrders() {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) { const d = await res.json(); setOrders(Array.isArray(d) ? d : []); }
    } catch { /* the list stays as it was; the next action reloads it */ }
  }

  function openFirstPayment(o: Order) {
    const p = pendingPayments(o)[0];
    if (p) setReviewTarget({ order: o, payment: p });
  }

  async function assignDriver(id: number, driverIdStr: string) {
    const driverId = driverIdStr === "" ? null : Number(driverIdStr);
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, driverId }),
    });
    if (!res.ok) {
      showToast((await res.json().catch(() => ({}))).error ?? "Couldn't assign the driver.", "error");
      refreshDrivers();
      return;
    }
    const updated = await res.json();
    const driver = driverId ? drivers.find((d) => d.id === driverId) ?? null : null;
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, driverId: updated.driverId, driver, status: updated.status } : o)));
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, status: updated.status } : p)));
    refreshDrivers();
    if (driver) showToast(`${driver.username} was notified about Order #${id}.`, "success");
    else notifyStatus(updated.status);
  }

  /** Admin: change one order's delivery fee, with the reason shown on the order. */
  async function adjustFee(id: number, fee: number, note: string) {
    const res = await fetch("/api/orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, deliveryFee: fee, deliveryFeeNote: note }),
    });
    if (!res.ok) { showToast((await res.json().catch(() => ({}))).error ?? "Couldn't change the fee.", "error"); return false; }
    const u = await res.json();
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, deliveryFee: u.deliveryFee, deliveryFeeNote: u.deliveryFeeNote, totalAmount: u.totalAmount, amountPaid: u.amountPaid } : o)));
    showToast(`Order #${id}: delivery fee is now ₱${Number(u.deliveryFee).toFixed(2)}.`);
    return true;
  }

  /** Staff set how much the customer has paid so far: full, a half downpayment, nothing, or another amount. */
  async function recordPayment(id: number, amount: number) {
    const res = await fetch("/api/orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, amountPaid: amount }),
    });
    if (!res.ok) { showToast((await res.json().catch(() => ({}))).error ?? "Couldn't record the payment.", "error"); return false; }
    const u = await res.json();
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, amountPaid: u.amountPaid } : o)));
    const left = Math.max(0, Math.round((u.totalAmount - u.amountPaid) * 100) / 100);
    showToast(left > 0 ? `Order #${id}: ₱${u.amountPaid.toFixed(2)} paid, ₱${left.toFixed(2)} left to collect.` : `Order #${id} is paid in full.`);
    return true;
  }

  /** Record that the outstanding balance on a partly-paid order has been collected. */
  async function settleBalance(id: number, total: number) {
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, amountPaid: total }),
    });
    if (!res.ok) { showToast("Failed to record the payment.", "error"); return; }
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, amountPaid: total } : o)));
    showToast(`Balance for order #${id} marked as settled.`);
  }



  const isStaff = role === "admin" || role === "cashier";
  // Dispatch moved to the cashier; the admin keeps confirm/cancel/payment duties.
  const canAssign = role === "cashier";
  const freeDrivers = drivers.filter((d) => driverState(d) === "available").length;
  const busyDrivers = drivers.filter((d) => driverState(d) === "delivering" || driverState(d) === "full").length;
  const outForDeliveryCount = orders.filter((o) => o.status === "out_for_delivery").length;
  const statusOrder = statusOrderId != null ? orders.find((o) => o.id === statusOrderId) ?? null : null;
  const canCancelOrder = (o: Order) =>
    (role === "customer" && (o.status === "pending" || o.status === "confirmed")) ||
    (isStaff && o.status !== "delivered" && o.status !== "cancelled");

  // Tiles are a *filter over the one list* — never a second copy of it.
  const matchesFilter = (o: Order, f: StatusFilter) => {
    switch (f) {
      case "pending": return o.status === "pending";
      case "needs_driver": return o.status === "confirmed" && o.fulfillmentMode !== "pickup" && !o.driverId;
      case "active": return o.status === "out_for_delivery" || (o.status === "confirmed" && (o.fulfillmentMode === "pickup" || !!o.driverId));
      case "open": return o.status === "pending" || o.status === "confirmed" || o.status === "out_for_delivery";
      case "done": return o.status === "delivered" || o.status === "cancelled";
      case "payments": return pendingPayments(o).length > 0;
      case "refunds": return pendingRefunds(o).length > 0;
      default: return true;
    }
  };

  // Delivery or pickup: a second filter alongside the status tiles.
  const matchesMode = (o: Order, m: ModeFilter) =>
    m === "all" || (m === "pickup" ? o.fulfillmentMode === "pickup" : o.fulfillmentMode !== "pickup");
  const inMode = orders.filter((o) => matchesMode(o, modeFilter));
  const countOf = (f: StatusFilter) => inMode.filter((o) => matchesFilter(o, f)).length;

  const TILES: FilterTile<StatusFilter>[] = isStaff
    ? [
        { key: "all", label: "All orders", value: inMode.length, icon: <ClipboardList className="size-5" />, tone: "brand" },
        { key: "pending", label: "To confirm", value: countOf("pending"), icon: <Clock className="size-5" />, tone: countOf("pending") > 0 ? "warn" : "neutral", urgent: countOf("pending") > 0 },
        // Pickup orders never need a driver.
        ...(modeFilter === "pickup" ? [] : [{ key: "needs_driver" as const, label: "Needs a driver", value: countOf("needs_driver"), icon: <UserRoundSearch className="size-5" />, tone: countOf("needs_driver") > 0 ? "warn" as const : "neutral" as const, urgent: countOf("needs_driver") > 0 }]),
        { key: "active", label: modeFilter === "pickup" ? "Ready for pickup" : modeFilter === "delivery" ? "On the way" : "In progress", value: countOf("active"), icon: <Truck className="size-5" />, tone: "brand" },
        { key: "done", label: "Completed", value: countOf("done"), icon: <CheckCheck className="size-5" />, tone: "good" },
      ]
    : [
        { key: "all", label: "All my orders", value: inMode.length, icon: <ShoppingBag className="size-5" />, tone: "brand" },
        { key: "open", label: "In progress", value: countOf("open"), icon: <Truck className="size-5" />, tone: "brand" },
        { key: "done", label: "Completed", value: countOf("done"), icon: <CheckCheck className="size-5" />, tone: "good" },
      ];

  const MODES: SegmentOption<ModeFilter>[] = [
    { key: "all", label: "All", count: orders.length },
    { key: "delivery", label: "Delivery", icon: <Truck className="size-3.5" />, count: orders.filter((o) => matchesMode(o, "delivery")).length },
    { key: "pickup", label: "Pickup", icon: <Store className="size-3.5" />, count: orders.filter((o) => matchesMode(o, "pickup")).length },
  ];

  const q = search.trim().toLowerCase();
  const filtered = inMode.filter((o) => {
    const matchSearch = !q || customerLabel(o).toLowerCase().includes(q) || String(o.id).includes(q)
      || o.items.some((i) => i.product.name.toLowerCase().includes(q));
    const matchDate = selectedKey ? toDateKey(new Date(o.dateTime)) === selectedKey : true;
    return matchSearch && matchDate && matchesFilter(o, statusFilter);
  });

  // A picked date shows that day's orders. Otherwise staff see today's board:
  // orders placed today plus any still open, so the map starts fresh each midnight.
  const filteredPins = pins.filter((p) => {
    const order = orders.find((o) => o.id === p.id);
    if (!order) return false;
    if (selectedKey) return toDateKey(new Date(order.dateTime)) === selectedKey;
    return !isStaff || onTodaysBoard(order);
  });
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const currentPage = Math.min(page, Math.max(1, totalPages));
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  // Header summary: what today looks like at a glance.
  const todayKey = toDateKey(today);
  const todays = orders.filter((o) => toDateKey(new Date(o.dateTime)) === todayKey && o.status !== "cancelled");
  const todaysValue = todays.reduce((s, o) => s + o.totalAmount, 0);
  const waiting = orders.filter((o) => matchesFilter(o, "pending") || matchesFilter(o, "needs_driver")).length;
  const filtersOn = statusFilter !== "all" || modeFilter !== "all" || !!selectedKey || !!q;
  function clearFilters() { setStatusFilter("all"); setModeFilter("all"); setSelectedKey(null); setSearch(""); setPage(1); }

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
    if (!selectedKey) return "All dates";
    const [y, m, d] = selectedKey.split("-").map(Number);
    const date = new Date(y, m, d);
    if (toDateKey(date) === toDateKey(today)) return "Today";
    return date.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  const cells = buildCalendar();
  const DETAIL_BTN = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink";
  // One column template for the header and every row, so they line up.
  const COLS = isStaff
    ? "lg:grid-cols-[150px_minmax(0,1.3fr)_120px_minmax(0,1fr)_168px]"
    : "lg:grid-cols-[150px_minmax(0,1.3fr)_120px_minmax(0,1fr)_96px]";

  return (
    <div className="space-y-6">
      {receipt && <ReceiptModal title="Order receipt" data={orderReceipt(receipt)} onClose={() => setReceipt(null)} />}
      {showNewOrder && (
        <NewOrderModal
          onClose={() => setShowNewOrder(false)}
          onCreated={async (created) => {
            setShowNewOrder(false);
            const res = await fetch("/api/orders");
            const list: Order[] = res.ok ? await res.json() : [];
            setOrders(list);
            refreshPins();
            const fresh = list.find((o) => o.id === created.id);
            if (fresh) setReceipt(fresh);
            if (created.driver) {
              refreshDrivers();
              showToast(`Order #${created.id} created and handed to ${created.driver.username}.`);
            } else {
              showToast(`Order #${created.id} created — it's confirmed and ready to prepare.`);
            }
          }}
        />
      )}
      {showFeeEditor && (
        <DeliveryFeeSettingsModal onClose={() => setShowFeeEditor(false)} onSaved={() => { setShowFeeEditor(false); showToast("Delivery settings saved. New orders use them right away."); refreshDrivers(); }} />
      )}
      {statusOrder && (
        <OrderStatusModal
          order={statusOrder}
          viewer={isStaff ? "staff" : "customer"}
          drivers={drivers}
          canAssign={canAssign}
          canCancel={canCancelOrder(statusOrder)}
          onClose={() => setStatusOrderId(null)}
          onStatus={updateStatus}
          onAssign={assignDriver}
          onSettle={settleBalance}
          onCancel={() => { setCancelId(statusOrder.id); setStatusOrderId(null); }}
          onViewProof={() => { setProofView(statusOrder); setStatusOrderId(null); }}
          onAdjustFee={role === "admin" ? adjustFee : undefined}
          onRecordPayment={isStaff ? recordPayment : undefined}
        />
      )}
      {switchOrder && (
        <SwitchToDeliveryModal
          order={switchOrder}
          customer={customerLabel(switchOrder)}
          drivers={drivers.map((d) => ({ id: d.id, username: d.username, activeCount: d.activeCount, maxActive: d.maxActive ?? 1, availability: d.availability ?? "available" }))}
          driversFailed={driversError && drivers.length === 0}
          onClose={() => setSwitchOrder(null)}
          onSwitched={async (r) => {
            setSwitchOrder(null);
            const res = await fetch("/api/orders");
            if (res.ok) setOrders(await res.json());
            refreshPins();
            refreshDrivers();
            showToast(r.driver ? `Order #${r.id} is now a delivery — ${r.driver.username} was notified.` : `Order #${r.id} is now a delivery. Assign a driver when it's ready.`, "success");
          }}
        />
      )}
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

      {proofView?.proofImage && (
        <Modal open onClose={() => setProofView(null)} title={`Proof of delivery — Order #${proofView.id}`} icon={<Camera className="size-5" />} description="The photo the driver took at the drop-off." size="lg">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-line bg-subtle">
            <Image src={proofView.proofImage} alt={`Order #${proofView.id} at the drop-off`} fill sizes="512px" className="object-contain" />
          </div>
          <p className="mt-3 text-xs text-ink-3">
            Delivered to {customerLabel(proofView)}
            {proofView.deliveredAt && <> on {new Date(proofView.deliveredAt).toLocaleString("en-PH", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</>}
            {proofView.driver && <> by {proofView.driver.username}</>}.
          </p>
        </Modal>
      )}

      {cancelId != null && (
        <CancelOrderModal orderId={cancelId} onClose={() => setCancelId(null)}
          onDone={(msg) => { setCancelId(null); setExpanded(null); showToast(msg, "success"); void reloadOrders(); if (isStaff) refreshDrivers(); }} />
      )}
      {reviewTarget && (
        <ReviewPaymentModal payment={reviewTarget.payment} orderId={reviewTarget.order.id} customer={customerLabel(reviewTarget.order)}
          orderTotal={reviewTarget.order.totalAmount} alreadyPaid={reviewTarget.order.amountPaid ?? 0}
          onClose={() => setReviewTarget(null)}
          onDone={(msg, tone) => { setReviewTarget(null); showToast(msg, tone); void reloadOrders(); }} />
      )}
      {refundTarget && (
        <SendRefundModal refund={refundTarget.payment} orderId={refundTarget.order.id} customer={customerLabel(refundTarget.order)}
          onClose={() => setRefundTarget(null)}
          onDone={(msg) => { setRefundTarget(null); showToast(msg, "success"); void reloadOrders(); }} />
      )}
      {payTarget && (
        <PayBalanceModal orderId={payTarget.id} balance={Math.max(0, payTarget.totalAmount - (payTarget.amountPaid ?? 0))} pending={pendingSum(payTarget)}
          dueAt={payTarget.paymentDueAt ?? null} onClose={() => setPayTarget(null)}
          onDone={(msg) => { setPayTarget(null); showToast(msg, "success"); void reloadOrders(); }} />
      )}

      {/* Date picker: a modal, so the list always keeps the full width */}
      <Modal open={showCalendar} onClose={() => setShowCalendar(false)} title="Show orders from" icon={<CalendarDays className="size-5" />} description="Pick a day to see only its orders." size="sm">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <button type="button" onClick={prevMonth} aria-label="Previous month" className="grid size-8 place-items-center rounded-lg text-ink-3 transition hover:bg-recess">
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-display text-sm font-extrabold text-ink">{MONTHS[calMonth]} {calYear}</span>
            <button type="button" onClick={nextMonth} aria-label="Next month" className="grid size-8 place-items-center rounded-lg text-ink-3 transition hover:bg-recess">
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {DAYS.map((d) => <div key={d} className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-ink-4">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const key = `${calYear}-${calMonth}-${day}`;
              const isToday = toDateKey(today) === key;
              const isSelected = selectedKey === key;
              const hasOrders = orderDateKeys.has(key);
              return (
                <button key={i} type="button" onClick={() => { setSelectedKey(isSelected ? null : key); setPage(1); setShowCalendar(false); }}
                  aria-label={`${MONTHS[calMonth]} ${day}, ${calYear}${hasOrders ? " (has orders)" : ""}`} aria-pressed={isSelected}
                  className={`num relative mx-auto grid size-9 place-items-center rounded-lg text-xs font-semibold transition ${
                    isSelected ? "bg-brand text-white" : isToday ? "bg-brand-soft font-bold text-brand-ink" : "text-ink-2 hover:bg-recess"}`}>
                  {day}
                  {hasOrders && <span className={`absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full ${isSelected ? "bg-white/70" : "bg-brand"}`} />}
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-1.5 border-t border-line pt-4">
            <p className="text-[11px] text-ink-4">A dot marks days with orders. Pick a day to see only its orders.</p>
            <div className="flex justify-between text-xs">
              <span className="text-ink-3">{selectedKey ? "Orders that day" : "Orders"}</span>
              <span className="num font-semibold text-ink">{filtered.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-ink-3">Total value</span>
              <span className="num font-semibold text-brand">{peso(filtered.reduce((s, o) => s + o.totalAmount, 0))}</span>
            </div>
            {selectedKey && (
              <button type="button" onClick={() => { setSelectedKey(null); setPage(1); setShowCalendar(false); }}
                className="mt-2 h-9 w-full rounded-lg border border-line text-xs font-semibold text-ink-2 transition hover:bg-recess">
                Show all dates
              </button>
            )}
          </div>
        </div>
      </Modal>

      <PageHeader
        eyebrow={isStaff ? "Sales" : "My account"}
        title="Orders"
        subtitle={loading ? "Loading orders…" : isStaff ? (
          <>
            <span className="font-semibold text-ink-2">{todays.length}</span> {todays.length === 1 ? "order" : "orders"} today
            <span className="num"> · <span className="font-semibold text-ink-2">{peso(todaysValue)}</span></span>
            {waiting > 0 && <> · <span className="font-semibold text-warn">{waiting} waiting on you</span></>}
          </>
        ) : <>Everything you&apos;ve ordered from {STORE_NAME}, and where it is now</>}
        action={isStaff ? (
          <>
            {role === "admin" && (
              <>
                <Button variant="secondary" onClick={() => setShowFeeEditor(true)} icon={<Truck className="size-4" />}>Delivery settings</Button>
                <Button variant="secondary" onClick={() => setShowGcashEditor(true)} icon={<Smartphone className="size-4" />}>
                  {storePayment?.gcashNumber ? "GCash details" : "Set up GCash"}
                </Button>
              </>
            )}
            <Button onClick={() => setShowNewOrder(true)} icon={<Plus className="size-4" />}>New order</Button>
          </>
        ) : undefined}
      />

      {/* Where each order stands: a summary that doubles as the status filter */}
      {isStaff && (() => {
        const toCheck = orders.filter((o) => pendingPayments(o).length > 0).length;
        const toRefund = orders.filter((o) => pendingRefunds(o).length > 0).length;
        if (!toCheck && !toRefund) return null;
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            {toCheck > 0 && (
              <button type="button" onClick={() => { setStatusFilter(statusFilter === "payments" ? "all" : "payments"); setPage(1); }} aria-pressed={statusFilter === "payments"}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${statusFilter === "payments" ? "border-brand bg-brand-soft ring-2 ring-brand/15" : "border-brand/30 bg-surface hover:border-brand"}`}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white"><ShieldCheck className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-ink">{toCheck} GCash {toCheck === 1 ? "receipt" : "receipts"} to check</span>
                  <span className="block text-[12px] text-ink-3">Customers are waiting. Approve or reject so their orders can move.</span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-brand" />
              </button>
            )}
            {toRefund > 0 && (
              <button type="button" onClick={() => { setStatusFilter(statusFilter === "refunds" ? "all" : "refunds"); setPage(1); }} aria-pressed={statusFilter === "refunds"}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${statusFilter === "refunds" ? "border-warn bg-warn-soft ring-2 ring-warn/15" : "border-warn/40 bg-surface hover:border-warn"}`}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warn text-white"><Undo2 className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-ink">{toRefund} {toRefund === 1 ? "refund" : "refunds"} to send</span>
                  <span className="block text-[12px] text-ink-3">Cancelled orders the customer already paid for.</span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-warn" />
              </button>
            )}
          </div>
        );
      })()}
      {!isStaff && (() => {
        const owing = orders.filter((o) => o.status !== "cancelled" && o.status !== "delivered" && (o.totalAmount - (o.amountPaid ?? 0) - pendingSum(o)) > 0.005 && o.paymentDueAt);
        const rejected = orders.filter((o) => o.status !== "cancelled" && (o.payments ?? []).some((p) => p.kind === "payment" && p.status === "rejected") && pendingPayments(o).length === 0 && (o.amountPaid ?? 0) === 0);
        if (!owing.length && !rejected.length) return null;
        return (
          <div className="space-y-2">
            {rejected.map((o) => (
              <Alert key={`rej-${o.id}`} tone="bad" title={`Order #${o.id}: your payment wasn't accepted`}
                action={<Button size="sm" onClick={() => setPayTarget(o)}>Send again</Button>}>
                {(o.payments ?? []).filter((p) => p.status === "rejected").slice(-1)[0]?.note ?? "The store couldn't match your GCash payment."}
              </Alert>
            ))}
            {owing.map((o) => {
              const late = new Date(o.paymentDueAt!) < new Date();
              return (
                <Alert key={`owe-${o.id}`} tone={late ? "bad" : "warn"} title={`Order #${o.id}: ${peso(o.totalAmount - (o.amountPaid ?? 0) - pendingSum(o))} left to pay`}
                  action={<Button size="sm" onClick={() => setPayTarget(o)}>Pay balance</Button>}>
                  {late ? `It was due ${dueDay(o.paymentDueAt!)}. Please pay now, or call the store.` : `Due ${dueDay(o.paymentDueAt!)}.`}
                  {settings.allowBalanceOnDelivery ? ` You can also pay it in cash ${o.fulfillmentMode === "pickup" ? "at pickup" : "on delivery"}.` : ""}
                </Alert>
              );
            })}
          </div>
        );
      })()}

      <FilterTiles tiles={TILES} value={statusFilter} onChange={(k) => { setStatusFilter(k); setPage(1); }}
        label="Filter orders by status" loading={loading} cols={isStaff ? (TILES.length === 5 ? 5 : 4) : 3} />

      {/* Map and drivers open in side panels, so the order list owns the page. Date and search sit beside them. */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setShowMap(true)} aria-haspopup="dialog"
          className="inline-flex h-11 min-w-0 grow basis-[calc(50%-4px)] items-center gap-2.5 rounded-xl border border-line bg-surface pl-1.5 pr-3.5 text-left sm:grow-0 sm:basis-auto shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition hover:border-brand/40 hover:bg-brand-soft/40">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><MapPin className="size-4" /></span>
          <span className="text-[13.5px] font-semibold text-ink">Delivery map</span>
          <span className="num hidden text-[12px] text-ink-4 sm:inline">{isStaff ? `Today · ${filteredPins.length}` : `${filteredPins.length} pinned`}</span>
          {outForDeliveryCount > 0 && (
            <span className="hidden items-center gap-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-ink sm:inline-flex">
              <span className="size-1.5 animate-pulse rounded-full bg-brand" /> {outForDeliveryCount} on the road
            </span>
          )}
        </button>
        {isStaff && (
          <button type="button" onClick={() => setShowDrivers(true)} aria-haspopup="dialog"
            className="inline-flex h-11 min-w-0 grow basis-[calc(50%-4px)] items-center gap-2.5 rounded-xl border border-line bg-surface pl-1.5 pr-3.5 text-left sm:grow-0 sm:basis-auto shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition hover:border-brand/40 hover:bg-brand-soft/40">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Truck className="size-4" /></span>
            <span className="text-[13.5px] font-semibold text-ink">Drivers <span className="num font-normal text-ink-4">{drivers.length}</span></span>
            {driversError && drivers.length === 0 ? (
              <span className="text-[11.5px] font-semibold text-warn">Couldn&apos;t load</span>
            ) : (
              <>
                {freeDrivers > 0 && <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-bold text-good"><span className="size-1.5 rounded-full bg-good" />{freeDrivers} free</span>}
                {busyDrivers > 0 && <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-bold text-brand-ink"><span className="size-1.5 rounded-full bg-brand" />{busyDrivers} busy</span>}
              </>
            )}
          </button>
        )}
          <div className="flex w-full items-center gap-2 lg:ml-auto lg:w-auto lg:min-w-[440px] lg:flex-1 lg:justify-end">
            <div className={`flex h-11 shrink-0 items-center rounded-xl border transition ${
              selectedKey ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong"}`}>
              <button type="button" onClick={() => setShowCalendar(true)} aria-haspopup="dialog"
                className="flex items-center gap-1.5 whitespace-nowrap px-3 text-[13px] font-semibold">
                <CalendarIcon className="size-4" />
                {selectedKey ? selectedLabel() : "Any date"}
              </button>
              {selectedKey && (
                <button type="button" onClick={() => { setSelectedKey(null); setPage(1); }} aria-label="Clear date — show all orders" title="Show all dates"
                  className="-ml-1.5 pr-2.5 hover:text-brand">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={isStaff ? "Order #, customer or item" : "Order # or item"}
              label="Search orders" className="min-w-0 flex-1" />
          </div>
      </div>

      <Drawer open={showMap} onClose={() => setShowMap(false)} width="xl" placement="center"
        title={<><MapPin className="size-4 text-brand" /> Delivery map</>}>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] text-ink-3">
              {selectedKey ? `${filteredPins.length} orders on ${selectedLabel()}` : isStaff ? `Today · ${filteredPins.length} order${filteredPins.length === 1 ? "" : "s"} · starts fresh at midnight` : `${filteredPins.length} of your orders`}
            </p>
            {isStaff && (
              <button type="button" onClick={() => setShowStoreEditor(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink">
                <MapPin className="size-3.5" /> {storeLocation ? "Edit store location" : "Set store location"}
              </button>
            )}
          </div>
          <div className="h-[min(62vh,600px)] overflow-hidden rounded-xl border border-line [isolation:isolate]">
            {showMap && (
              <OrderMap
                pins={filteredPins}
                loading={pinsLoading}
                height="min(62vh, 600px)"
                storeLat={storeLocation?.lat}
                storeLng={storeLocation?.lng}
                storeName={storeLocation?.name}
                focus={mapFocus}
              />
            )}
          </div>
        </div>
      </Drawer>

      {isStaff && (
        <Drawer open={showDrivers} onClose={() => setShowDrivers(false)} width="xl" placement="center"
          title={<><Truck className="size-4 text-brand" /> Drivers</>}>
          <div className="p-4">
            <DriversPanel bare drivers={drivers} now={now} onShowOnMap={showDriverOnMap} loadError={driversError} onRetry={refreshDrivers} />
          </div>
        </Drawer>
      )}

      {/* One list. The tiles above and the toolbar here filter it. */}
      <section aria-label="Orders" className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line p-3">
          <Segmented options={MODES} value={modeFilter} label="Delivery or pickup"
            onChange={(k) => { setModeFilter(k); if (k === "pickup" && statusFilter === "needs_driver") setStatusFilter("all"); setPage(1); }} />
          <p className="text-[13px] text-ink-3">
            <span className="num font-semibold text-ink">{filtered.length}</span> {filtered.length === 1 ? "order" : "orders"}
            {selectedKey && <> on <span className="font-semibold text-ink-2">{selectedLabel()}</span></>}
            {modeFilter !== "all" && <> · {modeFilter === "pickup" ? "picked up at the store" : "delivered by a driver"}</>}
            {filtered.length > 0 && <span className="num"> · {peso(filtered.reduce((s, o) => s + o.totalAmount, 0))}</span>}
          </p>
          {filtersOn && <button type="button" onClick={clearFilters} className="ml-auto text-[13px] font-semibold text-brand hover:underline">Clear filters</button>}
        </div>

        {/* Column labels, desktop only — rows stack into cards on smaller screens */}
        <div className={`hidden gap-4 border-b border-line px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-4 lg:grid ${COLS}`}>
          <span>Order</span><span>{isStaff ? <>Customer &amp; items</> : "Items"}</span><span className="text-right">Total</span><span>Status</span>
          <span className={isStaff ? "" : "sr-only"}>{isStaff ? "Next step" : "Track"}</span>
        </div>

        {loading ? (
          <ul className="divide-y divide-line">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="h-4 w-24 animate-pulse rounded bg-recess" />
                <div className="h-4 flex-1 animate-pulse rounded bg-recess" />
                <div className="h-8 w-28 animate-pulse rounded-lg bg-recess" />
              </li>
            ))}
          </ul>
        ) : paginated.length === 0 ? (
          <EmptyState icon={Receipt}
            title={orders.length === 0 ? (isStaff ? "No orders yet" : "You haven't ordered yet") : "No orders match"}
            description={orders.length === 0
              ? (isStaff ? "Online orders show up here the moment a customer places one. Take a phone or counter order with New order." : "Browse the shop and place your first order — you can follow it here.")
              : "Try another search, or clear the filters to see every order."}
            action={filtersOn ? <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined} />
        ) : (
          <ul className="divide-y divide-line">
            {paginated.map((o) => {
              const isPickup = o.fulfillmentMode === "pickup";
              const open = expanded === o.id;
              const pay = paymentState(o);
              const pin = pins.find((p) => p.id === o.id);
              const liveDriver = o.driverId ? drivers.find((x) => x.id === o.driverId) : undefined;
              const toCheck = pendingPayments(o).length > 0 && o.status !== "cancelled";
              const toRefund = pendingRefunds(o).length > 0;
              const owing = o.status !== "cancelled" && o.status !== "delivered" ? Math.max(0, o.totalAmount - (o.amountPaid ?? 0)) : 0;
              return (
                <li key={o.id}>
                  <div onClick={() => setExpanded(open ? null : o.id)}
                    className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2.5 px-4 py-3.5 transition hover:bg-subtle lg:items-center lg:gap-4 ${COLS}`}>

                    {/* Order: number, how it reaches the customer, when */}
                    <div className="min-w-0">
                      <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded(open ? null : o.id); }} aria-expanded={open}
                        aria-label={`Open order ${o.id}`}
                        className="flex items-center gap-2 text-left">
                        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${isPickup ? "bg-recess text-ink-3" : "bg-brand-soft text-brand"}`}
                          title={isPickup ? "Pickup at the store" : "Delivery"}>
                          {isPickup ? <Store className="size-4" /> : <Truck className="size-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1 font-code text-[14px] font-bold text-ink">
                            #{o.id}
                            <ArrowUpRight className="size-3.5 text-ink-4" />
                          </span>
                          <span className="block truncate text-[11.5px] text-ink-4">{fmtWhen(o.dateTime)}</span>
                        </span>
                      </button>
                    </div>

                    {/* Total — top-right on phones, its own column on desktop */}
                    <div className="col-start-2 row-start-1 text-right lg:col-start-3">
                      <p className="num font-display text-[15px] font-extrabold text-ink">{peso(o.totalAmount)}</p>
                      {o.status !== "cancelled" && pay === "partial" ? (
                        <p className="num whitespace-nowrap text-[11px] font-semibold text-warn">{peso(outstanding(o))} left</p>
                      ) : null}
                    </div>

                    {/* Customer and what they bought */}
                    <div className="col-span-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1">
                      <p className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[14px] font-semibold text-ink">{isStaff ? customerLabel(o) : `${o.items.length} ${o.items.length === 1 ? "item" : "items"}`}</span>
                        {isWalkIn(o) && <span className="shrink-0 rounded bg-recess px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ink-3">WALK-IN</span>}
                      </p>
                      <p className="truncate text-[12px] text-ink-3" title={o.items.map((i) => `${i.product.name} ×${i.quantity}`).join("\n")}>
                        {itemsLine(o.items)}
                      </p>
                    </div>

                    {/* Status, driver, what happens next */}
                    <div className="col-span-2 min-w-0 lg:col-span-1 lg:col-start-4 lg:row-start-1" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button type="button" onClick={() => setStatusOrderId(o.id)} title="See order progress" aria-label={`Order #${o.id} progress`}
                          className="rounded-full transition hover:ring-2 hover:ring-brand/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                          <StatusPill status={o.status} pickup={isPickup} />
                        </button>
                        {toCheck && (
                          <span title="A GCash payment is waiting to be checked" className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-ink">
                            <ShieldAlert className="size-3" /> {isStaff ? "Receipt to check" : "Payment being checked"}
                          </span>
                        )}
                        {toRefund && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">
                            <Undo2 className="size-3" /> {isStaff ? "Refund to send" : "Refund on the way"}
                          </span>
                        )}
                        {!isStaff && !toCheck && owing > 0.005 && o.paymentDueAt && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">
                            <Wallet className="size-3" /> {peso(owing)} due {dueDay(o.paymentDueAt)}
                          </span>
                        )}
                        {isStaff && !isPickup && o.driverId && (o.status === "confirmed" || o.status === "out_for_delivery") && (
                          <span className="inline-flex min-w-0 items-center gap-1 text-[12px] text-ink-3">
                            <Truck className="size-3 shrink-0 text-ink-4" />
                            <span className="max-w-[120px] truncate font-medium text-ink-2">{liveDriver?.username ?? o.driver?.username ?? "Driver"}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* The one next step — everything else lives in the opened order */}
                    <div className="col-span-2 flex items-center lg:col-span-1 lg:col-start-5 lg:row-start-1 lg:justify-end" onClick={(e) => e.stopPropagation()}>
                      {isStaff ? (
                        <NextStepCell order={o} drivers={drivers} canAssign={canAssign} onStatus={updateStatus} onAssign={assignDriver} onCheck={openFirstPayment} />
                      ) : (
                        <button type="button" onClick={() => setStatusOrderId(o.id)}
                          className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-semibold text-brand transition hover:bg-brand-soft">
                          Track <ChevronRight className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Opened order: a modal with the items, getting it there, and the money */}
                  {open && (
                    <Modal open onClose={() => setExpanded(null)} size="xl" icon={isPickup ? <Store className="size-5" /> : <Truck className="size-5" />}
                      title={`Order #${o.id}`}
                      description={`${isStaff ? `${customerLabel(o)} · ` : ""}${statusLabel(o.status, isPickup)} · placed ${fmtWhen(o.dateTime)}`}
                      footer={
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => setStatusOrderId(o.id)} className={DETAIL_BTN}>
                            <Clock className="size-3.5" /> Order progress
                          </button>
                          {(o.status === "confirmed" || o.status === "delivered" || o.status === "out_for_delivery") && (
                            <button type="button" onClick={() => setReceipt(o)} className={DETAIL_BTN}>
                              <Receipt className="size-3.5" /> Receipt
                            </button>
                          )}
                          {isStaff && isPickup && (o.status === "pending" || o.status === "confirmed") && !o.transactionId && (
                            <button type="button" onClick={() => setSwitchOrder(o)} className={DETAIL_BTN}>
                              <Truck className="size-3.5" /> Change to delivery
                            </button>
                          )}
                          {isStaff && !isPickup && o.status !== "delivered" && o.status !== "cancelled" && (
                            <button type="button" onClick={() => setLocationOrder(o)} className={DETAIL_BTN}>
                              <MapPin className="size-3.5" /> {o.latitude ? "Change delivery pin" : "Pin delivery location"}
                            </button>
                          )}
                          {canCancelOrder(o) && (
                            <button type="button" onClick={() => setCancelId(o.id)}
                              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-bad transition hover:bg-bad-soft">
                              <Ban className="size-3.5" /> Cancel order
                            </button>
                          )}
                        </div>
                      }>
                    {o.status === "cancelled" && (
                      <div className="mb-3"><Alert tone="bad" compact title={o.cancelledBy === "store" ? "Cancelled by the store" : "Cancelled"}>
                        {o.cancelReason ?? "This order was cancelled."} The items went back on the shelf.
                      </Alert></div>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                      <DetailBlock title="Items" icon={<Receipt className="size-3.5" />}>
                        <ul className="space-y-1.5">
                          {o.items.map((i) => (
                            <li key={i.id} className="flex items-baseline justify-between gap-3">
                              <span className="min-w-0">
                                <span className="text-ink">{i.product.name}</span>
                                <span className="num block text-[11.5px] text-ink-4">{Number(i.quantity.toFixed(2))} {i.product.unit ?? "pc"} × {peso(i.price)}</span>
                              </span>
                              <span className="num shrink-0 font-semibold text-ink">{peso(i.price * i.quantity)}</span>
                            </li>
                          ))}
                        </ul>
                        {!isPickup && (
                          <div className="flex justify-between border-t border-dashed border-line pt-2 text-ink-3">
                            <span>Delivery fee{o.deliveryFeeNote && <span className="block text-[11px] text-ink-4">Changed: {o.deliveryFeeNote}</span>}</span>
                            <span className="num">{o.deliveryFee ? peso(o.deliveryFee) : "Free"}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-line pt-2 font-display text-[15px] font-extrabold text-ink">
                          <span>Total</span><span className="num">{peso(o.totalAmount)}</span>
                        </div>
                      </DetailBlock>

                      <DetailBlock title={isPickup ? "Pickup" : "Delivery"} icon={isPickup ? <Store className="size-3.5" /> : <Truck className="size-3.5" />}>
                        {isPickup ? (
                          <>
                            <p className="text-ink-3">The customer collects this at the store — no driver needed.</p>
                            {isStaff && (o.status === "pending" || o.status === "confirmed") && !o.transactionId && (
                              <p className="text-[12px] text-ink-4">Customer wants it delivered instead? Use <b className="text-ink-3">Change to delivery</b> below.</p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="flex items-start gap-1.5">
                              <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-4" />
                              <span>{o.deliveryAddress || <span className="text-ink-4">No address pinned yet</span>}</span>
                            </p>
                            {o.deliveryNotes && (
                              <p className="flex items-start gap-1.5 rounded-lg bg-subtle px-2 py-1.5"><StickyNote className="mt-0.5 size-3.5 shrink-0 text-ink-4" /> <span><b className="text-ink">Exact spot:</b> {o.deliveryNotes}</span></p>
                            )}
                            {o.recipientName && (
                              <p className="flex flex-wrap items-center gap-1.5">
                                <UserRound className="size-3.5 text-ink-4" /> Receiver: <b className="text-ink">{o.recipientName}</b>
                                {o.recipientContact && <a href={`tel:${o.recipientContact}`} className="num font-semibold text-brand hover:underline">{o.recipientContact}</a>}
                              </p>
                            )}
                            {pin?.distanceLabel && (
                              <p className="flex flex-wrap gap-x-3 text-ink-3">
                                <span className="inline-flex items-center gap-1"><Route className="size-3.5" /> {pin.distanceLabel} from the store</span>
                                <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {pin.durationLabel}</span>
                              </p>
                            )}
                            {canAssign ? (
                              <label className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <span className="text-ink-3">Driver</span>
                                <select value={o.driverId ?? ""} onChange={(e) => assignDriver(o.id, e.target.value)}
                                  className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20">
                                  <option value="">— Unassigned —</option>
                                  {drivers.map((d) => {
                                    const opt = driverOption(d);
                                    // The driver already on this order stays selectable.
                                    return <option key={d.id} value={d.id} disabled={opt.disabled && d.id !== o.driverId}>{opt.label}</option>;
                                  })}
                                </select>
                              </label>
                            ) : o.driver ? (
                              <p className="flex flex-wrap items-center gap-1.5">
                                <Truck className="size-3.5 text-ink-4" />
                                <span className="font-semibold text-ink">{o.driver.username}</span>
                                {o.driver.contact && <a href={`tel:${o.driver.contact}`} className="num text-brand hover:underline">{o.driver.contact}</a>}
                                {liveDriver && <DriverStatusChip driver={liveDriver} />}
                              </p>
                            ) : (
                              <p className="text-ink-4">No driver yet</p>
                            )}
                          </>
                        )}
                        {customerPhone(o) && isStaff && (
                          <a href={`tel:${customerPhone(o)}`} onClick={(e) => e.stopPropagation()} className="num inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
                            <Phone className="size-3.5" /> Call {customerPhone(o)}
                          </a>
                        )}
                        {o.proofImage && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setProofView(o); }}
                            className="flex w-full items-center gap-3 rounded-lg border border-line p-2 text-left transition hover:bg-subtle">
                            <span className="relative size-12 shrink-0 overflow-hidden rounded-md border border-line">
                              <Image src={o.proofImage} alt="Proof of delivery" fill sizes="48px" className="object-cover" />
                            </span>
                            <span className="text-[12px] text-ink-3">
                              <span className="flex items-center gap-1 font-semibold text-ink"><Camera className="size-3.5" /> Proof of delivery</span>
                              {o.deliveredAt && <>{new Date(o.deliveredAt).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{o.driver ? ` · ${o.driver.username}` : ""}</>}
                            </span>
                          </button>
                        )}
                      </DetailBlock>

                      <div className="md:col-span-2">
                      <DetailBlock title="Payment" icon={<CreditCard className="size-3.5" />}>
                        {(() => {
                          const paid = o.amountPaid ?? 0;
                          const checking = pendingSum(o);
                          const left = Math.max(0, o.totalAmount - paid);
                          const canPay = !isStaff && o.status !== "cancelled" && o.status !== "delivered" && left - checking > 0.005 && settings.gcashEnabled;
                          return (
                            <>
                              <dl className="space-y-1">
                                <div className="flex justify-between"><dt className="text-ink-3">Method</dt><dd className="font-semibold text-ink">{o.paymentMethod === "Cash" ? (isPickup ? "Cash at pickup" : "Cash on delivery") : o.paymentMethod}</dd></div>
                                <div className="flex justify-between"><dt className="text-ink-3">Paid (approved)</dt><dd className="num font-semibold text-good">{peso(paid)}</dd></div>
                                {checking > 0 && <div className="flex justify-between"><dt className="text-ink-3">Being checked</dt><dd className="num font-semibold text-brand-ink">{peso(checking)}</dd></div>}
                                {o.status !== "cancelled" && (
                                  <div className="flex justify-between border-t border-line pt-1"><dt className="font-semibold text-ink">{left > 0.005 ? "Balance" : "Balance"}</dt>
                                    <dd className={`num font-bold ${left > 0.005 ? "text-warn" : "text-good"}`}>{left > 0.005 ? peso(left) : "Paid in full"}</dd></div>
                                )}
                                {left > 0.005 && o.paymentDueAt && o.status !== "cancelled" && o.status !== "delivered" && (
                                  <p className={`text-[12px] ${new Date(o.paymentDueAt) < new Date() ? "font-semibold text-bad" : "text-ink-3"}`}>
                                    Due {dueDay(o.paymentDueAt)}{new Date(o.paymentDueAt) < new Date() ? " — overdue" : ""}{settings.allowBalanceOnDelivery ? ` · or in cash ${isPickup ? "at pickup" : "on delivery"}` : ""}
                                  </p>
                                )}
                              </dl>
                              <PaymentHistory payments={o.payments ?? []} viewer={isStaff ? "staff" : "customer"}
                                onReview={(p) => setReviewTarget({ order: o, payment: p })}
                                onSendRefund={(p) => setRefundTarget({ order: o, payment: p })} />
                              {canPay && <Button size="sm" className="w-full" icon={<Wallet className="size-4" />} onClick={() => setPayTarget(o)}>Pay balance by GCash</Button>}
                              {isStaff && o.status !== "cancelled" && left > 0.005 && (
                                <button type="button" onClick={() => setStatusOrderId(o.id)}
                                  className="h-8 w-full rounded-lg border border-line px-3 text-[12px] font-semibold text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink">
                                  Record a payment received
                                </button>
                              )}
                            </>
                          );
                        })()}
                        {isStaff && (
                          <label className="flex items-center gap-2 border-t border-line pt-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-ink-3">Status</span>
                            <select value={o.status}
                              onChange={(e) => (e.target.value === "cancelled" ? setCancelId(o.id) : updateStatus(o.id, e.target.value))}
                              className={`h-8 min-w-0 flex-1 cursor-pointer rounded-lg border border-line px-2 text-[12.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-brand/20 ${ORDER_STATUS_STYLE[o.status]?.pill ?? ""}`}>
                              {(isPickup ? STATUSES.filter((s) => s !== "out_for_delivery") : STATUSES)
                                .map((s) => <option key={s} value={s} className="bg-surface text-ink">{statusLabel(s, isPickup)}</option>)}
                            </select>
                          </label>
                        )}
                        <p className="text-[11.5px] text-ink-4">Placed {new Date(o.dateTime).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</p>
                      </DetailBlock>
                      </div>

                    </div>
                    </Modal>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <Pagination page={currentPage} totalPages={Math.max(1, totalPages)} total={filtered.length} pageSize={PER_PAGE} onChange={setPage} noun="orders" />
      </section>
    </div>
  );
}
