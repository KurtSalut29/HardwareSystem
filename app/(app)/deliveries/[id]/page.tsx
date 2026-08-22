"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Phone, Package, CheckCircle2, Navigation, Crosshair,
  Banknote, ShieldAlert, Smartphone, Route as RouteIcon, CornerUpLeft, CornerUpRight, ArrowUp, Flag,
} from "lucide-react";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import NavigationMap from "@/components/NavigationMap";
import { fetchDrivingRoute, RouteStep } from "@/lib/route";
import { haversineKm, formatDistance, formatDuration, estimateMinutes } from "@/lib/distance";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type OItem = { id: number; quantity: number; price: number; product: { name: string } };
type Order = {
  id: number;
  totalAmount: number;
  status: string;
  customer: { username: string; contact?: string | null };
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
  if (t.startsWith("arrive")) return <Flag size={ICON_SIZE.xs} className="text-emerald-600" />;
  if (t.includes("left")) return <CornerUpLeft size={ICON_SIZE.xs} style={{ color: "var(--brand)" }} />;
  if (t.includes("right")) return <CornerUpRight size={ICON_SIZE.xs} style={{ color: "var(--brand)" }} />;
  return <ArrowUp size={ICON_SIZE.xs} style={{ color: "var(--brand)" }} />;
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

  async function markDelivered() {
    const res = await fetch("/api/orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, status: "delivered" }),
    });
    if (!res.ok) { showToast("Failed to update order.", "error"); return; }
    showToast("Order #" + orderId + " marked as delivered!");
    router.push("/deliveries");
  }

  if (loading) return <p className="text-sm text-gray-400 py-16 text-center">Loading delivery…</p>;

  if (!order || order.status !== "out_for_delivery") {
    return (
      <div className="space-y-4">
        <Link href="/deliveries" className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--brand)" }}>
          <ArrowLeft size={ICON_SIZE.sm} /> Back to My Deliveries
        </Link>
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <Package size={ICON_SIZE.xl} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm text-gray-500">
            {order ? "This order is no longer out for delivery." : "That delivery is not assigned to you."}
          </p>
        </div>
      </div>
    );
  }

  const hasDest = order.latitude != null && order.longitude != null;
  const collectCash = order.paymentMethod === "Cash";
  const unverifiedGcash = order.paymentMethod === "GCash" && !order.paymentVerified;

  return (
    <div className="space-y-4">
      <ConfirmModal
        open={confirmDeliver}
        onClose={() => setConfirmDeliver(false)}
        onConfirm={markDelivered}
        title="Mark this order delivered?"
        body={<>Order #{order.id} for {order.customer.username} will be marked as delivered.</>}
        variant="info"
        confirmLabel="Yes, Mark Delivered"
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/deliveries" className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--brand)" }}>
          <ArrowLeft size={ICON_SIZE.sm} /> My Deliveries
        </Link>
        <div className="flex items-center gap-2">
          {order.customer.contact && (
            <a href={"tel:" + order.customer.contact}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition hover:bg-blue-50"
              style={{ borderColor: "var(--brand)", color: "var(--brand)" }}>
              <Phone size={ICON_SIZE.xs} /> Call customer
            </a>
          )}
          <Button onClick={() => setConfirmDeliver(true)} size="sm" className="!bg-emerald-600 hover:!bg-emerald-700" icon={<CheckCircle2 size={ICON_SIZE.xs} />}>
            Mark Delivered
          </Button>
        </div>
      </div>

      {/* Trip summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="font-display text-lg font-extrabold text-gray-900">Order #{order.id}</p>
            <p className="text-sm text-gray-600">{order.customer.username}</p>
            <p className="text-xs text-gray-500 flex items-start gap-1.5 mt-1">
              <MapPin size={ICON_SIZE.xs} className="shrink-0 mt-0.5 text-gray-400" />
              {order.deliveryAddress || "No address recorded"}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-xl font-extrabold text-gray-900 num">₱{order.totalAmount.toFixed(2)}</p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
              collectCash ? "bg-emerald-50 text-emerald-600"
                : unverifiedGcash ? "bg-yellow-50 text-yellow-600"
                : "bg-gray-100 text-gray-500"}`}>
              {collectCash ? <><Banknote size={10} /> Collect cash</>
                : unverifiedGcash ? <><ShieldAlert size={10} /> GCash unverified</>
                : <><Smartphone size={10} /> Paid</>}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Distance left</p>
            <p className="font-display text-base font-extrabold text-gray-900">
              {distanceKm != null ? formatDistance(distanceKm) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Travel time</p>
            <p className="font-display text-base font-extrabold text-gray-900">
              {durationMin != null ? formatDuration(durationMin) : "—"}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Items</p>
            <p className="text-xs text-gray-600 line-clamp-2">{order.items.map((i) => i.product.name + " ×" + i.quantity).join(", ")}</p>
          </div>
        </div>
      </div>

      {geoError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{geoError}</p>}

      {/* Map */}
      <div className="bg-white rounded-xl border border-gray-200 p-4" style={{ isolation: "isolate" }}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Navigation size={ICON_SIZE.sm} style={{ color: "var(--brand)" }} /> Navigation
          </h2>
          <button onClick={() => setFollow((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition ${
              follow ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}
            style={follow ? { color: "var(--brand)" } : undefined}>
            <Crosshair size={ICON_SIZE.xs} /> {follow ? "Following you" : "Follow me"}
          </button>
        </div>
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
          <p className="text-sm text-gray-400 py-12 text-center">
            This order has no map location yet — ask the store to set it.
          </p>
        )}
      </div>

      {/* Turn-by-turn */}
      {steps.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
            <RouteIcon size={ICON_SIZE.sm} style={{ color: "var(--brand)" }} /> Directions
          </h2>
          <ol className="divide-y divide-gray-50">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 py-2.5">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--brand-soft)" }}>
                  {stepIcon(s.instruction)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{s.instruction}</p>
                </div>
                {s.distanceMeters > 0 && (
                  <span className="text-xs text-gray-400 shrink-0 num">
                    {s.distanceMeters >= 1000 ? (s.distanceMeters / 1000).toFixed(1) + " km" : s.distanceMeters + " m"}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
