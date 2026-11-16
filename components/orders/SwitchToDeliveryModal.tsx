"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import LocationPicker, { type PickedLocation } from "@/components/LocationPicker";
import DriverPicker, { type DriverPick } from "@/components/orders/DriverPicker";
import { describeQuote } from "@/lib/deliveryFee";
import { useDeliveryQuote } from "@/lib/useDeliveryQuote";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * A pickup order the customer now wants delivered: pin the drop-off, see the fee
 * it adds, and (once the order is confirmed) hand it to a driver straight away.
 */
export default function SwitchToDeliveryModal({ order, customer, drivers, driversFailed, onClose, onSwitched }: {
  order: { id: number; status: string; totalAmount: number; deliveryFee?: number; amountPaid?: number };
  customer: string;
  drivers: DriverPick[];
  driversFailed: boolean;
  onClose: () => void;
  onSwitched: (result: { id: number; driver?: { username: string } | null }) => void;
}) {
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [driverId, setDriverId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const delivery = useDeliveryQuote(location);
  const quote = delivery.quote;
  const itemsTotal = Math.round((order.totalAmount - (order.deliveryFee ?? 0)) * 100) / 100;
  const newTotal = Math.round((itemsTotal + (quote?.fee ?? 0)) * 100) / 100;
  const paid = order.amountPaid ?? 0;
  const canPickDriver = order.status === "confirmed";

  async function save() {
    setError("");
    if (!location) { setError("Pin the delivery location on the map."); return; }
    if (delivery.loading) { setError("Still working out the delivery fee — one moment."); return; }
    if (!quote) { setError(delivery.error ?? "Couldn't work out the delivery fee. Move the pin and try again."); return; }
    if (quote.tooFar) { setError("That location is beyond the delivery area."); return; }
    setSaving(true);
    const res = await fetch("/api/orders/switch-to-delivery", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: order.id, deliveryAddress: location.address, latitude: location.lat, longitude: location.lng,
        ...(canPickDriver && driverId ? { driverId: Number(driverId) } : {}),
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Couldn't change the order to delivery."); return; }
    onSwitched(data);
  }

  return (
    <Modal open onClose={onClose} title={`Change to delivery — Order #${order.id}`} icon={<Truck className="size-5" />}
      description={`${customer} wants this delivered instead of picking it up.`} size="lg"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto text-xs text-ink-3">
            New total <span className="num text-sm font-bold text-ink">{peso(newTotal)}</span>
          </div>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={!location} icon={<Truck className="size-4" />}>Change to delivery</Button>
        </div>
      }>
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-2">Drop-off location</p>
          <LocationPicker value={location} onChange={setLocation} />
          {location && delivery.loading && <p className="animate-pulse rounded-lg bg-recess px-3 py-2 text-xs text-ink-3">Checking the road distance…</p>}
          {location && !delivery.loading && delivery.error && <Alert tone="bad" compact>{delivery.error}</Alert>}
          {quote && delivery.settings && (
            <div className={`flex justify-between gap-3 rounded-lg px-3 py-2 text-xs ${quote.tooFar ? "bg-bad-soft" : "bg-info-soft"}`}>
              <span className="text-ink-2">{quote.tooFar ? `About ${quote.roadKm.toFixed(0)} km — beyond the ${delivery.settings.maxKm} km delivery area` : describeQuote(quote, delivery.settings)}</span>
              <span className="num whitespace-nowrap font-bold text-ink">{quote.fee === 0 ? "Free" : peso(quote.fee)}</span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line text-[13px]">
          <div className="flex justify-between px-3.5 py-2 text-ink-2"><span>Items</span><span className="num">{peso(itemsTotal)}</span></div>
          <div className="flex justify-between border-t border-line px-3.5 py-2 text-ink-2">
            <span>Delivery fee</span><span className="num">{quote ? (quote.fee === 0 ? "Free" : peso(quote.fee)) : "Pin a location"}</span>
          </div>
          <div className="flex justify-between border-t border-line bg-subtle px-3.5 py-2 font-semibold text-ink"><span>New total</span><span className="num">{peso(newTotal)}</span></div>
          {paid > 0 && (
            <p className="border-t border-line px-3.5 py-2 text-[12px] text-ink-3">
              Already paid {peso(paid)} · <b className="text-ink-2">{peso(Math.max(0, newTotal - paid))}</b> left to collect on delivery.
            </p>
          )}
        </div>

        {canPickDriver ? (
          <DriverPicker drivers={drivers} value={driverId} onChange={setDriverId} loadFailed={driversFailed} />
        ) : (
          <Alert tone="info" compact>Confirm the order first, then assign a driver from the order list.</Alert>
        )}

        {error && <Alert tone="bad" compact>{error}</Alert>}
      </div>
    </Modal>
  );
}
