"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Truck, Navigation, CheckCircle2, Package, ArrowRight } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { useToast } from "@/components/ui/ToastProvider";
import OrderMap, { OrderPin } from "@/components/OrderMap";
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
};

const SHARE_INTERVAL_MS = 12000;

export default function DriverDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pins, setPins] = useState<OrderPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [geoError, setGeoError] = useState("");
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
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;

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
      <PageHeader title="Driver Dashboard" subtitle="Your delivery status and live location sharing." />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="Active Deliveries" value={activeOrders.length} icon={<Truck size={ICON_SIZE.lg} className="text-indigo-600" />} iconBg="bg-indigo-50" />
        <StatCard title="Delivered (all time)" value={deliveredCount} icon={<CheckCircle2 size={ICON_SIZE.lg} className="text-emerald-600" />} iconBg="bg-emerald-50" />
      </div>

      {/* Location sharing control */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Navigation size={ICON_SIZE.md} className={sharing ? "text-indigo-600" : "text-gray-400"} />
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {sharing ? "Sharing your location live" : "Location sharing is off"}
              </p>
              <p className="text-xs text-gray-400">
                {sharing
                  ? "Customers and the store can see your position."
                  : activeOrders.length > 0
                  ? "Starts automatically for active deliveries — grant location access if your browser prompts you."
                  : "Turns on automatically once you have an active delivery."}
              </p>
            </div>
          </div>
          <button
            onClick={() => (sharing ? stopSharing() : startSharing())}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
              sharing ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {sharing ? "Stop Sharing Location" : "Start Sharing Location"}
          </button>
        </div>
        {geoError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-3">{geoError}</p>}
        <p className="text-[11px] text-gray-400 mt-3">
          Note: your browser may pause location updates if this tab is closed, backgrounded, or your screen locks — keep this page open while delivering for the most reliable tracking.
        </p>
      </div>

      {/* Map — the route line starts at the driver's own live position */}
      <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ isolation: "isolate" }}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Delivery Map</h2>
          <p className="text-[11px] text-gray-400">
            {sharing
              ? "The line shows your route to the drop-off."
              : "Start sharing your location to see your route to the drop-off."}
          </p>
        </div>
        <OrderMap
          pins={pins.filter((p) => activeOrders.some((o) => o.id === p.id))}
          loading={loading}
          routeFrom="driver"
        />
      </div>

      {/* Lists live on /deliveries and /deliveries/history now — the dashboard
          stays a summary so the same deliveries never appear in two places. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/deliveries" className="group bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 transition hover:border-blue-300 hover:-translate-y-0.5">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#EEF2FF" }}>
            <Truck size={ICON_SIZE.lg} className="text-indigo-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-extrabold text-gray-900">My Deliveries</p>
            <p className="text-xs text-gray-400">
              {activeOrders.length === 0
                ? "Nothing to deliver right now"
                : `${activeOrders.length} waiting — addresses, contacts & navigation`}
            </p>
          </div>
          <ArrowRight size={ICON_SIZE.sm} className="text-gray-300 shrink-0 transition group-hover:translate-x-0.5" style={{ color: "var(--brand)" }} />
        </Link>

        <Link href="/deliveries/history" className="group bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 transition hover:border-blue-300 hover:-translate-y-0.5">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#ECFDF5" }}>
            <Package size={ICON_SIZE.lg} className="text-emerald-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-extrabold text-gray-900">Delivery History</p>
            <p className="text-xs text-gray-400">{deliveredCount} completed all time</p>
          </div>
          <ArrowRight size={ICON_SIZE.sm} className="text-gray-300 shrink-0 transition group-hover:translate-x-0.5" style={{ color: "var(--brand)" }} />
        </Link>
      </div>

    </div>
  );
}
