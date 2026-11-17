"use client";

import { useCallback, useEffect, useState } from "react";
import { Truck, MapPin, CheckCircle2, Navigation, Package, Banknote, Smartphone, ShieldAlert, Route, StickyNote, UserRound } from "lucide-react";
import Link from "next/link";
import { haversineKm, formatDistance } from "@/lib/distance";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import StatTile from "@/components/ui/StatTile";
import ProofOfDeliveryModal from "@/components/deliveries/ProofOfDeliveryModal";
import DutyStatusCard from "@/components/deliveries/DutyStatusCard";
import ContactCustomer from "@/components/deliveries/ContactCustomer";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import { customerLabel, customerPhone } from "@/lib/customer";

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
  paymentMethod?: string;
  paymentVerified?: boolean;
  amountPaid?: number;
  recipientName?: string | null;
  recipientContact?: string | null;
  deliveryNotes?: string | null;
  /** GCash payments the store is still checking — not collected at the door. */
  payments?: { amount: number }[];
};

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  function handleDelivered() {
    if (!deliverTarget) return;
    const id = deliverTarget.id;
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "delivered" } : o)));
    setDeliverTarget(null);
    showToast(`Order #${id} marked as delivered — photo saved as proof.`);
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
  // What's still owed at the door: the total, less any downpayment or GCash transfer.
  const balanceOf = (o: Order) => Math.max(0, Math.round((o.totalAmount - (o.amountPaid ?? 0) - (o.payments ?? []).reduce((t, p) => t + p.amount, 0)) * 100) / 100);
  const toCollect = active.reduce((s, a) => s + balanceOf(a.order), 0);

  return (
    <div className="space-y-6">
      {deliverTarget && (
        <ProofOfDeliveryModal
          orderId={deliverTarget.id}
          customer={customerLabel(deliverTarget)}
          collect={balanceOf(deliverTarget)}
          onClose={() => setDeliverTarget(null)}
          onDelivered={handleDelivered}
        />
      )}

      <PageHeader
        eyebrow="Deliveries"
        title="My deliveries"
        subtitle={loading ? "Loading your stops…" : active.length === 0 ? "Nothing on hand right now." : (
          <>
            <span className="font-semibold text-ink-2">{active.length}</span> {active.length === 1 ? "stop" : "stops"}, closest first
            {toCollect > 0 && <> · <span className="num font-semibold text-good">{peso(toCollect)}</span> to collect</>}
          </>
        )}
      />

      <DutyStatusCard refreshKey={active.length} />

      {/* At-a-glance run summary */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <StatTile icon={<Truck className="size-5" />} label="To deliver" value={loading ? "–" : active.length} caption={active.length === 1 ? "stop" : "stops"} />
        <StatTile icon={<Banknote className="size-5" />} tone="good" label="Cash to collect" value={loading ? "–" : peso(toCollect)} caption="at the door" />
        <StatTile className="col-span-2 md:col-span-1" icon={<Package className="size-5" />} tone="neutral" label="Order value" value={loading ? "–" : peso(totalValue)} caption="everything you carry" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl border border-line bg-surface" />)}
        </div>
      ) : active.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface">
          <EmptyState icon={Truck} title="No deliveries right now"
            description="When the store assigns you a delivery you'll hear a chime, and it shows up here." />
        </div>
      ) : (
        <ol className="space-y-3">
          {active.map(({ order: o, km }, idx) => {
            const collectCash = o.paymentMethod === "Cash";
            const unverifiedGcash = o.paymentMethod === "GCash" && !o.paymentVerified;
            const due = balanceOf(o);
            const partiallyPaid = due > 0 && (o.amountPaid ?? 0) > 0;
            return (
              <li key={o.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                {/* Stop header */}
                <div className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-brand-soft to-surface px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand font-display text-[15px] font-extrabold text-white" title={`Stop ${idx + 1}`}>
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand">{idx === 0 ? "Next stop" : `Stop ${idx + 1}`}</p>
                    <p className="font-code text-[14px] font-bold text-ink">Order #{o.id}</p>
                  </div>
                  {km != null && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[12px] font-semibold text-brand-ink ring-1 ring-brand/20">
                      <Route className="size-3.5" /> {formatDistance(km)}
                    </span>
                  )}
                </div>

                <div className="space-y-3.5 p-4">
                  {/* Who and where */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-[18px] font-extrabold leading-tight text-ink">{customerLabel(o)}</p>
                      <p className="mt-1 flex items-start gap-1.5 text-[13.5px] text-ink-2">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-ink-4" />
                        <span>{o.deliveryAddress || "No address recorded — contact the store."}</span>
                      </p>
                    </div>
                  </div>

                  {/* Exact spot and who receives it */}
                  {(o.deliveryNotes || o.recipientName) && (
                    <div className="space-y-1 rounded-xl border border-brand/20 bg-brand-soft/50 px-3.5 py-2.5 text-[13px] text-ink-2">
                      {o.deliveryNotes && <p className="flex items-start gap-1.5"><StickyNote className="mt-0.5 size-4 shrink-0 text-brand" /> <span><b className="text-ink">Exact spot:</b> {o.deliveryNotes}</span></p>}
                      {o.recipientName && <p className="flex items-start gap-1.5"><UserRound className="mt-0.5 size-4 shrink-0 text-brand" /> <span><b className="text-ink">Give it to:</b> {o.recipientName}{o.recipientContact ? ` · ${o.recipientContact}` : ""}</span></p>}
                    </div>
                  )}

                  {/* Money at the door */}
                  <div className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 ${
                    collectCash || partiallyPaid ? "bg-good-soft" : unverifiedGcash ? "bg-warn-soft" : "bg-subtle"}`}>
                    <span className={`flex items-center gap-2 text-[13px] font-semibold ${
                      collectCash || partiallyPaid ? "text-good" : unverifiedGcash ? "text-warn" : "text-ink-3"}`}>
                      {collectCash ? <Banknote className="size-4" /> : unverifiedGcash ? <ShieldAlert className="size-4" /> : <Smartphone className="size-4" />}
                      {due > 0 ? (partiallyPaid ? `Collect the balance (${peso(o.amountPaid ?? 0)} paid)` : "Collect cash")
                        : unverifiedGcash ? "GCash — store still checking" : `Paid by ${o.paymentMethod}`}
                    </span>
                    <span className="num text-right">
                      <span className={`block font-display text-[18px] font-extrabold leading-tight ${due > 0 ? "text-good" : "text-ink"}`}>{peso(due > 0 ? due : o.totalAmount)}</span>
                      {due > 0 && due !== o.totalAmount && <span className="block text-[11px] text-ink-4">of {peso(o.totalAmount)}</span>}
                    </span>
                  </div>

                  {/* What to hand over */}
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-4">{o.items.length} {o.items.length === 1 ? "item" : "items"} to hand over</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {o.items.map((i) => (
                        <li key={i.id} className="rounded-lg bg-recess px-2.5 py-1 text-[12.5px] text-ink-2">
                          {i.product.name} <span className="num font-semibold text-ink">×{Number(i.quantity.toFixed(2))}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <ContactCustomer phone={o.recipientContact ?? customerPhone(o)} name={o.recipientName ? `${o.recipientName} (receiver)` : customerLabel(o)} orderId={o.id} />

                  <div className="grid grid-cols-2 gap-2 border-t border-line pt-3.5">
                    <Link href={`/deliveries/${o.id}`}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[15px] font-semibold text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink active:scale-[0.98]">
                      <Navigation className="size-4" /> Navigate
                    </Link>
                    <Button variant="success" size="lg" onClick={() => setDeliverTarget(o)} icon={<CheckCircle2 className="size-4" />}>
                      Mark delivered
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
