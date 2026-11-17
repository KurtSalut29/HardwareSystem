"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Package, CheckCircle2, Navigation, Crosshair,
  Banknote, ShieldAlert, Smartphone, Route as RouteIcon, CornerUpLeft, CornerUpRight, ArrowUp, Flag,
} from "lucide-react";
import Button from "@/components/ui/Button";
import ContactCustomer from "@/components/deliveries/ContactCustomer";
import ProofOfDeliveryModal from "@/components/deliveries/ProofOfDeliveryModal";
import { useToast } from "@/components/ui/ToastProvider";
import NavigationMap from "@/components/NavigationMap";
import { fetchDrivingRoute, RouteStep } from "@/lib/route";
import { haversineKm, formatDistance, formatDuration, estimateMinutes } from "@/lib/distance";
import EmptyState from "@/components/ui/EmptyState";

import { customerLabel, customerPhone } from "@/lib/customer";
import Alert from "@/components/ui/Alert";
type OItem = { id: number; quantity: number; price: number; product: { name: string } };
type Order = {
  id: number;
  totalAmount: number;
  status: string;
  customer: { username: string; contact?: string | null } | null;
  customerName?: string | null;
  customerContact?: string | null;
  amountPaid?: number;
  recipientName?: string | null;
  recipientContact?: string | null;
  deliveryNotes?: string | null;
  payments?: { amount: number }[];
  items: OItem[];
  deliveryAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  paymentMethod?: string;
  paymentVerified?: boolean;
};

const PING_MS = 12000;
/** Re-route only once the driver has actually moved, not on GPS jitter. */
const REROUTE_METERS = 60;

function stepIcon(instruction: string) {
  const t = instruction.toLowerCase();
  if (t.startsWith("arrive")) return <Flag className="size-4 text-good" />;
  if (t.includes("left")) return <CornerUpLeft className="size-4 text-brand" />;
  if (t.includes("right")) return <CornerUpRight className="size-4 text-brand" />;
  return <ArrowUp className="size-4 text-brand" />;
}

export default function DeliveryNavigationPage() {
  const params = useParams();
  const router = useRouter();
  const showToast = useToast();
  const orderId = Number(params?.id);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState("");
  const [route, setRoute] = useState<[number, number][]>([]);
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [follow, setFollow] = useState(true);
  const [confirmDeliver, setConfirmDeliver] = useState(false);

  const lastRoutedFrom = useRef<{ lat: number; lng: number } | null>(null);
  const watchRef = useRef<number | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/orders");
    if (res.ok) {
      const data = await res.json();
      const found = Array.isArray(data) ? data.find((o: Order) => o.id === orderId) : null;
      setOrder(found ?? null);
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  // Live position — while navigating, the browser is the source of truth.
  useEffect(() => {
    if (!navigator.geolocation) { setGeoError("This browser can't provide your location."); return; }
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => { setGeoError(""); setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGeoError("Location is blocked. Enable location access to navigate.");
        else setGeoError("Couldn't get your location yet.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  // Keep the store's live tracking fed while this screen is open
  useEffect(() => {
    if (!pos) return;
    const push = () => {
      fetch("/api/driver/location", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: pos.lat, lng: pos.lng }),
      }).catch(() => {});
    };
    push();
    pingRef.current = setInterval(push, PING_MS);
    return () => { if (pingRef.current) clearInterval(pingRef.current); };
  }, [pos]);

  // (Re)compute the road route once the driver has meaningfully moved
  useEffect(() => {
    const destLat = order?.latitude;
    const destLng = order?.longitude;
    if (!pos || destLat == null || destLng == null) return;

    const prev = lastRoutedFrom.current;
    const movedKm = prev ? haversineKm(prev.lat, prev.lng, pos.lat, pos.lng) : Infinity;
    if (movedKm * 1000 < REROUTE_METERS) return;

    let cancelled = false;
    (async () => {
      const r = await fetchDrivingRoute(pos.lat, pos.lng, destLat, destLng);
      if (cancelled) return;
      lastRoutedFrom.current = pos;
      if (r) {
        setRoute(r.coords);
        setSteps(r.steps);
        setDistanceKm(r.distanceKm);
        setDurationMin(r.durationMin);
      } else {
        // OSRM unreachable — still give a heading and an estimate
        const km = haversineKm(pos.lat, pos.lng, destLat, destLng);
        setRoute([[pos.lat, pos.lng], [destLat, destLng]]);
        setSteps([]);
        setDistanceKm(km);
        setDurationMin(estimateMinutes(km));
      }
    })();
    return () => { cancelled = true; };
  }, [pos, order?.latitude, order?.longitude]);

  function onDelivered() {
    showToast("Order #" + orderId + " marked as delivered — photo saved as proof.");
    router.push("/deliveries");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-recess" />
        <div className="h-48 animate-pulse rounded-2xl border border-line bg-surface" />
        <div className="h-80 animate-pulse rounded-2xl border border-line bg-surface" />
      </div>
    );
  }

  if (!order || order.status !== "out_for_delivery") {
    return (
      <div className="space-y-4">
        <Link href="/deliveries" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 text-[13.5px] font-semibold text-ink-2 transition hover:border-brand/40 hover:text-brand-ink">
          <ArrowLeft className="size-4" /> My deliveries
        </Link>
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface">
          <EmptyState icon={Package}
            title={order ? "This order is no longer out for delivery" : "That delivery isn't assigned to you"}
            description="Head back to your list for the stops you still have." />
        </div>
      </div>
    );
  }

  const hasDest = order.latitude != null && order.longitude != null;
  const collectCash = order.paymentMethod === "Cash";
  const unverifiedGcash = order.paymentMethod === "GCash" && !order.paymentVerified;
  // Still owed at the door: the total less any downpayment or GCash transfer.
  const due = Math.max(0, Math.round((order.totalAmount - (order.amountPaid ?? 0) - (order.payments ?? []).reduce((t, p) => t + p.amount, 0)) * 100) / 100);
  const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      {confirmDeliver && (
        <ProofOfDeliveryModal
          orderId={order.id}
          customer={customerLabel(order)}
          collect={due}
          onClose={() => setConfirmDeliver(false)}
          onDelivered={onDelivered}
        />
      )}

      {/* Back, and the one action that ends the trip */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/deliveries" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 text-[13.5px] font-semibold text-ink-2 transition hover:border-brand/40 hover:text-brand-ink">
          <ArrowLeft className="size-4" /> My deliveries
        </Link>
        <Button variant="success" onClick={() => setConfirmDeliver(true)} icon={<CheckCircle2 className="size-4" />}>
          Mark delivered
        </Button>
      </div>

      {/* Trip summary */}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="bg-gradient-to-r from-brand to-brand-ink px-4 py-4 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">Delivering order #{order.id}</p>
          <p className="mt-0.5 font-display text-[21px] font-extrabold leading-tight">{customerLabel(order)}</p>
          <p className="mt-1 flex items-start gap-1.5 text-[13.5px] opacity-90">
            <MapPin className="mt-0.5 size-4 shrink-0" /> {order.deliveryAddress || "No address recorded"}
          </p>
          {order.deliveryNotes && <p className="mt-1 text-[13px] opacity-90"><b>Exact spot:</b> {order.deliveryNotes}</p>}
          {order.recipientName && <p className="mt-0.5 text-[13px] opacity-90"><b>Give it to:</b> {order.recipientName}{order.recipientContact ? ` · ${order.recipientContact}` : ""}</p>}
        </div>

        <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold text-ink-4">Distance left</p>
            <p className="num font-display text-[18px] font-extrabold text-ink">{distanceKm != null ? formatDistance(distanceKm) : "—"}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold text-ink-4">Travel time</p>
            <p className="num font-display text-[18px] font-extrabold text-ink">{durationMin != null ? formatDuration(durationMin) : "—"}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold text-ink-4">{due > 0 ? "Collect" : "Total"}</p>
            <p className={`num font-display text-[18px] font-extrabold ${due > 0 ? "text-good" : "text-ink"}`}>{peso(due > 0 ? due : order.totalAmount)}</p>
          </div>
        </div>

        <div className="space-y-3.5 p-4">
          <div className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold ${
            collectCash || due > 0 ? "bg-good-soft text-good" : unverifiedGcash ? "bg-warn-soft text-warn" : "bg-subtle text-ink-3"}`}>
            {collectCash ? <Banknote className="size-4" /> : unverifiedGcash ? <ShieldAlert className="size-4" /> : <Smartphone className="size-4" />}
            {due > 0
              ? (order.amountPaid ?? 0) > 0 ? `Collect the balance — ${peso(order.amountPaid ?? 0)} already paid` : `Collect ${peso(due)} in cash`
              : unverifiedGcash ? "Paid by GCash — the store is still checking it" : `Already paid by ${order.paymentMethod}`}
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-4">{order.items.length} {order.items.length === 1 ? "item" : "items"} to hand over</p>
            <ul className="flex flex-wrap gap-1.5">
              {order.items.map((i) => (
                <li key={i.id} className="rounded-lg bg-recess px-2.5 py-1 text-[12.5px] text-ink-2">
                  {i.product.name} <span className="num font-semibold text-ink">×{Number(i.quantity.toFixed(2))}</span>
                </li>
              ))}
            </ul>
          </div>

          <ContactCustomer phone={order.recipientContact ?? customerPhone(order)} name={order.recipientName ? `${order.recipientName} (receiver)` : customerLabel(order)} orderId={order.id} />
        </div>
      </section>

      {geoError && <Alert tone="bad" compact>{geoError}</Alert>}

      {/* Map */}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface [isolation:isolate]">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-extrabold text-ink">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><Navigation className="size-4" /></span> Navigation
          </h2>
          <button type="button" onClick={() => setFollow((v) => !v)} aria-pressed={follow}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-semibold transition ${
              follow ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-3 hover:border-line-strong"}`}>
            <Crosshair className="size-4" /> {follow ? "Following you" : "Follow me"}
          </button>
        </div>
        <div className="p-3">
          {hasDest ? (
            <NavigationMap
              driverLat={pos?.lat ?? null}
              driverLng={pos?.lng ?? null}
              destLat={order.latitude as number}
              destLng={order.longitude as number}
              destLabel={order.deliveryAddress ?? "Order #" + order.id}
              route={route}
              follow={follow}
            />
          ) : (
            <EmptyState icon={MapPin} title="No map location yet" description="Ask the store to pin this order's drop-off." />
          )}
        </div>
      </section>

      {/* Turn-by-turn */}
      {steps.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 font-display text-[15px] font-extrabold text-ink">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><RouteIcon className="size-4" /></span> Directions
            <span className="num font-sans text-[13px] font-normal text-ink-4">{steps.length} steps</span>
          </h2>
          <ol className="divide-y divide-line">
            {steps.map((s, i) => (
              <li key={i} className={`flex items-center gap-3 px-4 py-3 ${i === 0 ? "bg-brand-soft/40" : ""}`}>
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft">{stepIcon(s.instruction)}</span>
                <p className={`min-w-0 flex-1 text-[14px] ${i === 0 ? "font-semibold text-ink" : "text-ink-2"}`}>{s.instruction}</p>
                {s.distanceMeters > 0 && (
                  <span className="num shrink-0 rounded-full bg-recess px-2 py-0.5 text-[12px] font-semibold text-ink-3">
                    {s.distanceMeters >= 1000 ? (s.distanceMeters / 1000).toFixed(1) + " km" : s.distanceMeters + " m"}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
