"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Truck, Navigation, CheckCheck, CalendarDays, Trophy, Flag, MapPin, ListChecks, History, CircleStop } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatTile from "@/components/ui/StatTile";
import Button from "@/components/ui/Button";
import { customerLabel } from "@/lib/customer";
import { useToast } from "@/components/ui/ToastProvider";
import OrderMap, { OrderPin } from "@/components/OrderMap";
import { MapLegend } from "@/components/OrderMapWidget";

import DutyStatusCard from "@/components/deliveries/DutyStatusCard";
import Alert from "@/components/ui/Alert";
type OItem = { id: number; quantity: number; price: number; product: { name: string } };
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
};

const SHARE_INTERVAL_MS = 12000;

export default function DriverDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pins, setPins] = useState<OrderPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [username, setUsername] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevActiveCountRef = useRef(0);
  const showToast = useToast();

  /** Returns the freshly-fetched orders so callers can act on current data
   *  instead of the 15s-old copy in state. */
  const loadOrders = useCallback(async (): Promise<Order[]> => {
    let fresh: Order[] = [];
    const [oRes, locRes] = await Promise.all([fetch("/api/orders"), fetch("/api/orders/locations")]);
    if (oRes.ok) {
      const data = await oRes.json();
      fresh = Array.isArray(data) ? data : [];
      setOrders(fresh);
    }
    if (locRes.ok) {
      const data = await locRes.json();
      setPins(Array.isArray(data) ? data : []);
    }
    setLoading(false);
    return fresh;
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.username) setUsername(d.username); }).catch(() => {});
  }, []);

  function pingLocation() {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by this browser.");
      stopSharing();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await fetch("/api/driver/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.activeOrders === 0) {
            stopSharing();
            showToast("No active deliveries — location sharing stopped.", "info");
          }
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError("Location access blocked. Enable location permission in your browser to share your position.");
          stopSharing();
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function startSharing() {
    // The dashboard only refreshes every 15s, so a delivery assigned seconds ago
    // isn't in state yet. Re-check with the server before refusing — otherwise the
    // driver gets "new delivery assigned" and "you have no orders" back to back.
    if (activeOrders.length === 0) {
      const fresh = await loadOrders();
      if (fresh.filter((o) => o.status === "out_for_delivery").length === 0) {
        showToast("You have no orders out for delivery.", "warning");
        return;
      }
    }
    setGeoError("");
    setSharing(true);
    pingLocation();
    intervalRef.current = setInterval(pingLocation, SHARE_INTERVAL_MS);
  }

  function stopSharing() {
    setSharing(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  const activeOrders = orders.filter((o) => o.status === "out_for_delivery");
  const delivered = orders.filter((o) => o.status === "delivered");
  const deliveredCount = delivered.length;
  const todayKey = new Date().toDateString();
  const deliveredToday = delivered.filter((o) => new Date(o.dateTime).toDateString() === todayKey).length;
  const nextStop = activeOrders.slice().sort((a, b) => a.id - b.id)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Auto-start location sharing on a 0 -> N active-deliveries transition, so the
  // driver doesn't have to tap "Start" manually. A manual "Stop" during an
  // unchanged active count isn't overridden by the next 15s poll.
  useEffect(() => {
    const hadNone = prevActiveCountRef.current === 0;
    prevActiveCountRef.current = activeOrders.length;
    if (hadNone && activeOrders.length > 0 && !sharing && !geoError) startSharing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrders.length]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
        title={`${greeting}, ${username || "driver"}`}
        subtitle={loading ? "Loading your day…" : activeOrders.length > 0
          ? <><span className="font-semibold text-ink-2">{activeOrders.length}</span> {activeOrders.length === 1 ? "delivery" : "deliveries"} on hand · <span className="font-semibold text-ink-2">{deliveredToday}</span> done today</>
          : <>No deliveries on hand · <span className="font-semibold text-ink-2">{deliveredToday}</span> done today</>}
      />

      <DutyStatusCard refreshKey={activeOrders.length} />

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile icon={<Truck className="size-5" />} label="On hand" value={loading ? "–" : activeOrders.length} caption="out for delivery" />
        <StatTile icon={<CheckCheck className="size-5" />} tone="good" label="Delivered today" value={loading ? "–" : deliveredToday} caption="so far" />
        <StatTile icon={<CalendarDays className="size-5" />} tone="neutral" label="This week" value={loading ? "–" : delivered.filter((o) => Date.now() - new Date(o.dateTime).getTime() < 7 * 86400000).length} caption="last 7 days" />
        <StatTile icon={<Trophy className="size-5" />} tone="neutral" label="All time" value={loading ? "–" : deliveredCount} caption="completed" />
      </div>

      {/* The next stop, front and centre */}
      {nextStop ? (
        <section className="overflow-hidden rounded-2xl border border-brand/30 bg-surface shadow-[0_18px_40px_-28px_rgba(30,79,216,0.6)]">
          <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-brand to-brand-ink px-4 py-3 text-white">
            <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em]"><Flag className="size-4" /> Next stop</p>
            <span className="font-code text-[13px] font-bold opacity-90">Order #{nextStop.id}</span>
          </div>
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-display text-[19px] font-extrabold leading-tight text-ink">{customerLabel(nextStop)}</p>
              <p className="mt-1 flex items-start gap-1.5 text-[13.5px] text-ink-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-4" /> {nextStop.deliveryAddress || "No address recorded"}
              </p>
              <p className="mt-1 text-[12.5px] text-ink-4">{nextStop.items.length} {nextStop.items.length === 1 ? "item" : "items"} · ₱{nextStop.totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-[300px]">
              <Link href="/deliveries" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line text-[14px] font-semibold text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink">
                <ListChecks className="size-4" /> All stops
              </Link>
              <Link href={`/deliveries/${nextStop.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-[14px] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(30,79,216,0.9)] transition hover:brightness-110">
                <Navigation className="size-4" /> Navigate
              </Link>
            </div>
          </div>
        </section>
      ) : !loading && (
        <section className="flex items-center gap-4 rounded-2xl border border-dashed border-line-strong bg-surface p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-recess text-ink-4"><Truck className="size-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[16px] font-extrabold text-ink">No stops right now</p>
            <p className="text-[13px] text-ink-3">You&apos;ll hear a chime when the store assigns you a delivery.</p>
          </div>
          <Link href="/deliveries/history" className="hidden h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3.5 text-[13px] font-semibold text-ink-2 transition hover:border-brand/40 hover:text-brand-ink sm:inline-flex">
            <History className="size-4" /> History
          </Link>
        </section>
      )}

      {/* Location sharing control */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className={`relative grid size-11 shrink-0 place-items-center rounded-2xl ${sharing ? "bg-brand-soft text-brand" : "bg-recess text-ink-4"}`}>
            <Navigation className="size-5" />
            {sharing && (
              <span className="absolute -right-0.5 -top-0.5 flex size-3">
                <span className="animate-live-ping absolute inline-flex size-full rounded-full bg-brand" />
                <span className="relative inline-flex size-3 rounded-full bg-brand ring-2 ring-surface" />
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold text-ink">{sharing ? "Sharing your location live" : "Location sharing is off"}</p>
            <p className="text-[12.5px] text-ink-3">
              {sharing
                ? "The store and your customers can follow you on the map."
                : activeOrders.length > 0
                ? "Starts by itself for active deliveries — allow location if your browser asks."
                : "Turns on by itself once you have an active delivery."}
            </p>
          </div>
          <Button variant={sharing ? "danger-soft" : "primary"} onClick={() => (sharing ? stopSharing() : startSharing())}
            icon={sharing ? <CircleStop className="size-4" /> : <Navigation className="size-4" />} className="w-full sm:w-auto">
            {sharing ? "Stop sharing" : "Start sharing"}
          </Button>
        </div>
        {geoError && <Alert tone="bad" compact className="mt-3">{geoError}</Alert>}
        <p className="mt-3 border-t border-line pt-3 text-[12px] text-ink-4">
          Keep this page open while delivering. Phones can pause location updates when the tab is closed or the screen locks.
        </p>
      </section>

      {/* Map — the route line starts at the driver's own live position */}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface [isolation:isolate]">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand"><MapPin className="size-4" /></span>
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-extrabold text-ink">Delivery map</h2>
            <p className="text-[12px] text-ink-4">
              {sharing ? "The line shows your route from where you are now." : "Your active drop-offs. Share your location to see the route."}
            </p>
          </div>
        </div>
        <div className="p-3">
          <OrderMap
            pins={pins.filter((p) => activeOrders.some((o) => o.id === p.id))}
            loading={loading}
            routeFrom="driver"
          />
          <MapLegend />
        </div>
      </section>
    </div>
  );
}
