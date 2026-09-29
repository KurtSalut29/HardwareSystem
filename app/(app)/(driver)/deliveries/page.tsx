"use client";

import { useCallback, useEffect, useState } from "react";
import { Truck, MapPin, CheckCircle2, Navigation, Phone, Package, Banknote, Smartphone, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { haversineKm, formatDistance } from "@/lib/distance";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type OItem = { id: number; quantity: number; price: number; product: { name: string } };
type Order = {
  id: number;
  totalAmount: number;
  status: string;
  dateTime: string;
  customer: { username: string; contact?: string | null };
  items: OItem[];
  deliveryAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  paymentMethod?: string;
  paymentVerified?: boolean;
  amountPaid?: number;
};

export default function DeliveriesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliverTarget, setDeliverTarget] = useState<Order | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const showToast = useToast();

  const load = useCallback(async () => {
    const res = await fetch("/api/orders");
    if (res.ok) {
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  // One position read is enough here — it only orders the stop list.
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  async function handleMarkDelivered() {
    if (!deliverTarget) return;
    const id = deliverTarget.id;
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "delivered" }),
    });
    if (!res.ok) { showToast("Failed to update order.", "error"); return; }
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "delivered" } : o)));
    setDeliverTarget(null);
    showToast(`Order #${id} marked as delivered!`);
  }

  // With several deliveries at once, work the closest one first. Without a GPS
  // fix we fall back to oldest-order-first so the list is still deterministic.
  const active = orders
    .filter((o) => o.status === "out_for_delivery")
    .map((o) => ({
      order: o,
      km: pos && o.latitude != null && o.longitude != null
        ? haversineKm(pos.lat, pos.lng, o.latitude, o.longitude)
        : null,
    }))
    .sort((a, b) => {
      if (a.km != null && b.km != null) return a.km - b.km;
      if (a.km != null) return -1;
      if (b.km != null) return 1;
      return a.order.id - b.order.id;
    });
  const totalValue = active.reduce((s, a) => s + a.order.totalAmount, 0);
  // What the driver actually has to come back with: the full amount on a
  // cash order, and whatever is still outstanding on a partly-paid GCash one.
  const balanceOf = (o: Order) =>
    o.paymentMethod === "Cash"
      ? o.totalAmount
      : Math.max(0, Math.round((o.totalAmount - (o.amountPaid ?? 0)) * 100) / 100);
  const toCollect = active.reduce((s, a) => s + balanceOf(a.order), 0);

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={!!deliverTarget}
        onClose={() => setDeliverTarget(null)}
        onConfirm={handleMarkDelivered}
        title="Mark this order delivered?"
        body={deliverTarget ? <>Order #{deliverTarget.id} for {deliverTarget.customer.username} will be marked as delivered. This can&apos;t be undone from here.</> : null}
        variant="info"
        confirmLabel="Yes, Mark Delivered"
      />

      <PageHeader title="My Deliveries" subtitle="Your assigned stops, closest first." />

      {/* At-a-glance run summary */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryTile label="To deliver" value={active.length} icon={<Truck size={ICON_SIZE.md} className="text-indigo-600" />} bg="#EEF2FF" />
        <SummaryTile label="Order value" value={`₱${totalValue.toFixed(2)}`} icon={<Package size={ICON_SIZE.md} style={{ color: "var(--brand)" }} />} bg="var(--brand-soft)" />
        <SummaryTile label="Cash to collect" value={`₱${toCollect.toFixed(2)}`} icon={<Banknote size={ICON_SIZE.md} className="text-emerald-600" />} bg="#ECFDF5" />
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-12 text-center">Loading...</p>
      ) : active.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState icon={Truck} title="No deliveries right now" description="When the store assigns you a delivery you'll be notified, and it will show up here." />
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(({ order: o, km }, idx) => {
            const collectCash = o.paymentMethod === "Cash";
            const unverifiedGcash = o.paymentMethod === "GCash" && !o.paymentVerified;
            const due = balanceOf(o);
            const partiallyPaid = o.paymentMethod === "GCash" && due > 0;
            return (
              <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex items-start gap-3">
                    {active.length > 1 && (
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-display font-extrabold text-xs"
                        style={{ background: "var(--brand-soft)", color: "var(--brand)" }} title={`Stop ${idx + 1}`}>
                        {idx + 1}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="font-display text-base font-extrabold text-gray-900">Order #{o.id}</p>
                      <p className="text-sm text-gray-600">
                        {o.customer.username}
                        {km != null && <span className="text-gray-400"> · {formatDistance(km)} away</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display text-lg font-extrabold text-gray-900 num">₱{o.totalAmount.toFixed(2)}</p>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      collectCash ? "bg-emerald-50 text-emerald-600"
                        : unverifiedGcash ? "bg-yellow-50 text-yellow-600"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {collectCash ? <><Banknote size={10} /> Collect cash</>
                        : unverifiedGcash ? <><ShieldAlert size={10} /> GCash unverified</>
                        : <><Smartphone size={10} /> Paid ({o.paymentMethod})</>}
                    </span>
                    {partiallyPaid && (
                      <p className="mt-1 text-[11px] font-bold" style={{ color: "var(--warn)" }}>
                        Collect ₱{due.toFixed(2)} balance
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg px-3 py-2.5 space-y-2" style={{ background: "var(--bg-muted)" }}>
                  <p className="text-xs text-gray-700 flex items-start gap-1.5">
                    <MapPin size={ICON_SIZE.xs} className="shrink-0 mt-0.5 text-gray-400" />
                    <span>{o.deliveryAddress || "No address recorded — contact the store."}</span>
                  </p>
                  {o.customer.contact && (
                    <p className="text-xs text-gray-700 flex items-center gap-1.5">
                      <Phone size={ICON_SIZE.xs} className="shrink-0 text-gray-400" />
                      <a href={`tel:${o.customer.contact}`} className="font-medium hover:underline" style={{ color: "var(--brand)" }}>
                        {o.customer.contact}
                      </a>
                    </p>
                  )}
                  <p className="text-xs text-gray-500 flex items-start gap-1.5">
                    <Package size={ICON_SIZE.xs} className="shrink-0 mt-0.5 text-gray-400" />
                    <span>{o.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}</span>
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    href={`/deliveries/${o.id}`}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg border text-sm font-semibold py-2.5 transition hover:bg-blue-50"
                    style={{ borderColor: "var(--brand)", color: "var(--brand)" }}
                  >
                    <Navigation size={ICON_SIZE.sm} /> Navigate
                  </Link>
                  <Button
                    onClick={() => setDeliverTarget(o)}
                    className="flex-1 !bg-emerald-600 hover:!bg-emerald-700"
                    icon={<CheckCircle2 size={ICON_SIZE.sm} />}
                  >
                    Mark Delivered
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, icon, bg }: { label: string; value: string | number; icon: React.ReactNode; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-3 py-3 flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: bg }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide truncate">{label}</p>
        <p className="font-display text-base font-extrabold text-gray-900 num truncate leading-tight">{value}</p>
      </div>
    </div>
  );
}
