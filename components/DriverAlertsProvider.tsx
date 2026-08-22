"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Truck, MapPin, Package, BellRing } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { ICON_SIZE } from "@/lib/constants/icon-size";

export type DeliveryAlert = {
  key: string;
  id: number;
  customer: string;
  address: string | null;
  total: number;
  items: string;
  assignedAt: string;
};

type DriverAlertsValue = {
  alerts: DeliveryAlert[];
  acknowledge: () => void;
  openPopup: () => void;
};

const DriverAlertsContext = createContext<DriverAlertsValue>({
  alerts: [],
  acknowledge: () => {},
  openPopup: () => {},
});

export const useDriverAlerts = () => useContext(DriverAlertsContext);

const POLL_MS = 15000;
const STORAGE_KEY = "driver-acknowledged-deliveries";
const MAX_REMEMBERED = 100;

function readAcknowledged(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeAcknowledged(keys: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys.slice(-MAX_REMEMBERED)));
  } catch { /* storage full or blocked — alerts just repeat next session */ }
}

/** Short two-tone chime via WebAudio, so no audio asset has to ship. */
function playChime() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    [880, 1174].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch { /* audio blocked until the driver interacts with the page — visual alert still fires */ }
}

function pushBrowserNotification(alert: DeliveryAlert) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification("New delivery assigned", {
      body: `Order #${alert.id} — ${alert.customer}${alert.address ? ` · ${alert.address}` : ""}`,
      tag: `delivery-${alert.id}`,
    });
  } catch { /* some browsers require a service worker; the in-app popup still shows */ }
}

type ApiOrder = {
  id: number;
  status: string;
  totalAmount: number;
  assignedAt: string | null;
  deliveryAddress: string | null;
  customer: { username: string };
  items: { quantity: number; product: { name: string } }[];
};

export default function DriverAlertsProvider({ role, children }: { role: string; children: React.ReactNode }) {
  const isDriver = role === "driver";
  const [alerts, setAlerts] = useState<DeliveryAlert[]>([]);
  const [popupOpen, setPopupOpen] = useState(false);
  const knownKeysRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const poll = useCallback(async () => {
    let orders: ApiOrder[];
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) return;
      const data = await res.json();
      orders = Array.isArray(data) ? data : [];
    } catch {
      return; // transient network blip — next tick retries
    }

    const acknowledged = new Set(readAcknowledged());
    const pending = orders
      .filter((o) => o.status === "out_for_delivery" && o.assignedAt)
      .map<DeliveryAlert>((o) => ({
        key: `${o.id}:${o.assignedAt}`,
        id: o.id,
        customer: o.customer?.username ?? "Customer",
        address: o.deliveryAddress ?? null,
        total: o.totalAmount,
        items: o.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", "),
        assignedAt: o.assignedAt!,
      }))
      .filter((a) => !acknowledged.has(a.key));

    // Chime + OS notification only for deliveries that appeared since the last
    // tick — a refresh shouldn't re-sound alerts the driver already heard.
    const freshlyArrived = pending.filter((a) => !knownKeysRef.current.has(a.key));
    knownKeysRef.current = new Set(pending.map((a) => a.key));

    if (pending.length > 0) setPopupOpen(true);
    setAlerts(pending);

    if (freshlyArrived.length > 0 && !firstLoadRef.current) {
      playChime();
      freshlyArrived.forEach(pushBrowserNotification);
    }
    firstLoadRef.current = false;
  }, []);

  useEffect(() => {
    if (!isDriver) return;
    // Ask once, on mount, so alerts can reach the driver with the tab backgrounded.
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [isDriver, poll]);

  const acknowledge = useCallback(() => {
    setAlerts((current) => {
      if (current.length > 0) writeAcknowledged([...readAcknowledged(), ...current.map((a) => a.key)]);
      return [];
    });
    setPopupOpen(false);
  }, []);

  const openPopup = useCallback(() => setPopupOpen(true), []);

  return (
    <DriverAlertsContext.Provider value={{ alerts, acknowledge, openPopup }}>
      {children}
      {isDriver && (
        <Modal
          open={popupOpen && alerts.length > 0}
          onClose={() => setPopupOpen(false)}
          title={alerts.length === 1 ? "New Delivery Assigned" : `${alerts.length} Deliveries Assigned`}
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <BellRing size={ICON_SIZE.md} className="text-indigo-600" />
              </span>
              <p className="text-sm text-gray-600 pt-2">
                {alerts.length === 1
                  ? "The store assigned this delivery to you."
                  : "The store assigned these deliveries to you."}
              </p>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {alerts.map((a) => (
                <div key={a.key} className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <Truck size={ICON_SIZE.xs} className="text-indigo-600 shrink-0" />
                      Order #{a.id} — {a.customer}
                    </p>
                    <span className="text-sm font-bold text-gray-900 num shrink-0">₱{a.total.toFixed(2)}</span>
                  </div>
                  {a.address && (
                    <p className="text-xs text-gray-600 flex items-start gap-1.5 mt-1.5">
                      <MapPin size={ICON_SIZE.xs} className="shrink-0 mt-px" /> {a.address}
                    </p>
                  )}
                  {a.items && (
                    <p className="text-xs text-gray-500 flex items-start gap-1.5 mt-1">
                      <Package size={ICON_SIZE.xs} className="shrink-0 mt-px" /> {a.items}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <Button onClick={acknowledge} className="w-full">
              Got it — start delivering
            </Button>
          </div>
        </Modal>
      )}
    </DriverAlertsContext.Provider>
  );
}
