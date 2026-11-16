"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Truck, MapPin, Package, Navigation } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { playAlert } from "@/lib/sounds";

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
      playAlert("delivery");
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
          title={alerts.length === 1 ? "New delivery assigned" : `${alerts.length} deliveries assigned`} icon={<Truck className="size-5" />} description={alerts.length === 1 ? "The store just gave you a new stop." : "The store just gave you new stops."}
          size="sm"
          footer={<Button onClick={acknowledge} size="lg" className="w-full" icon={<Navigation className="size-4" />}>Got it — start delivering</Button>}
        >
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {alerts.map((a) => (
              <div key={a.key} className="overflow-hidden rounded-2xl border border-brand/25">
                <div className="flex items-center justify-between gap-3 bg-brand-soft px-3.5 py-2.5">
                  <span className="font-code text-[13px] font-bold text-brand-ink">Order #{a.id}</span>
                  <span className="num font-display text-[15px] font-extrabold text-ink">₱{a.total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="space-y-1.5 px-3.5 py-3">
                  <p className="text-[15px] font-semibold text-ink">{a.customer}</p>
                  {a.address && (
                    <p className="flex items-start gap-1.5 text-[13px] text-ink-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-4" /> {a.address}</p>
                  )}
                  {a.items && (
                    <p className="flex items-start gap-1.5 text-[12.5px] text-ink-3"><Package className="mt-0.5 size-3.5 shrink-0 text-ink-4" /> {a.items}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </DriverAlertsContext.Provider>
  );
}
