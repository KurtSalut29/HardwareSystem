"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { DELIVERY_LIMITS, quoteDelivery, type DeliverySettings } from "@/lib/deliveryFee";

type Field = { key: keyof DeliverySettings; label: string; suffix: string; step: string; hint: string };

const FEE_FIELDS: Field[] = [
  { key: "freeKm", label: "Free delivery distance", suffix: "km by road", step: "0.5", hint: "Customers this close to the store pay no delivery fee." },
  { key: "ratePerKm", label: "Rate beyond that", suffix: "₱ per km", step: "1", hint: "Charged for every kilometre past the free distance, so farther places pay more." },
  { key: "roadFactor", label: "Road factor", suffix: "× straight-line km", step: "0.05", hint: "Roads curve, so the map's straight line is shorter than the drive. 1.3 suits Biliran's coastal roads." },
  { key: "islandFee", label: "Boat fee for islands (Maripipi, Higatangan)", suffix: "₱ added", step: "10", hint: "Added on top of the distance fee for island drop-offs. Set 0 to charge islands by distance only." },
  { key: "maxKm", label: "Farthest delivery", suffix: "km (0 = no limit)", step: "1", hint: "Mainland orders farther than this can't choose delivery." },
];

const DRIVER_FIELDS: Field[] = [
  { key: "driverMaxActive", label: "Deliveries per driver at a time", suffix: "orders", step: "1", hint: "A driver carrying this many isn't given another order until one is delivered. 1 = one delivery at a time." },
];

const FIELDS = [...FEE_FIELDS, ...DRIVER_FIELDS];

/**
 * The town centre (poblacion) of every municipality in Biliran, plus Higatangan
 * island, so the admin sees what customers across the province will pay. Real
 * orders are priced from the customer's own pin, so any barangay works.
 */
const EXAMPLES = [
  { name: "Almeria", lat: 11.620278, lng: 124.381667 },
  { name: "Biliran", lat: 11.466574, lng: 124.474097 },
  { name: "Cabucgayan", lat: 11.472953, lng: 124.574997 },
  { name: "Caibiran", lat: 11.57232, lng: 124.581336 },
  { name: "Culaba", lat: 11.655596, lng: 124.540621 },
  { name: "Kawayan", lat: 11.679951, lng: 124.357023 },
  { name: "Maripipi", lat: 11.776523, lng: 124.348595 },
  { name: "Naval", lat: 11.56179, lng: 124.396527 },
  { name: "Higatangan Is. (Naval)", lat: 11.564109, lng: 124.274366 },
];

const toForm = (s: DeliverySettings) => Object.fromEntries(FIELDS.map((f) => [f.key, String(s[f.key])])) as Record<keyof DeliverySettings, string>;

export default function DeliveryFeeSettingsModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<keyof DeliverySettings, string> | null>(null);
  const [store, setStore] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/delivery-settings").then((r) => r.json()).then((d) => { setForm(toForm(d.settings)); setStore(d.store); }).catch(() => setError("Couldn't load the settings."));
  }, []);

  const current: DeliverySettings | null = form ? Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key]) || 0])) as DeliverySettings : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true); setError("");
    const res = await fetch("/api/delivery-settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key])]))),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Couldn't save."); return; }
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Delivery settings" size="lg"
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="delivery-fee-form" className="flex-1" loading={saving} disabled={!form}>Save</Button>
        </div>
      }>
      {!form ? (
        <p className="text-sm text-gray-400 py-8 text-center">{error || "Loading..."}</p>
      ) : (
        <form id="delivery-fee-form" onSubmit={save} className="space-y-4">
          <p className="text-xs text-gray-500">
            The fee depends on distance: it is measured from the store&apos;s map pin to the customer&apos;s pin, so farther places pay more.
            Customers see it at checkout before they order, and you can still change it on a single order.
          </p>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide pt-1">Delivery fee</p>
          {FEE_FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`df-${f.key}`} className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <div className="flex items-center gap-2">
                <input id={`df-${f.key}`} required type="number" step={f.step} min={DELIVERY_LIMITS[f.key].min} max={DELIVERY_LIMITS[f.key].max}
                  value={form[f.key]} onChange={(e) => setForm((p) => (p ? { ...p, [f.key]: e.target.value } : p))}
                  className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" />
                <span className="text-xs text-gray-500">{f.suffix}</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{f.hint}</p>
            </div>
          ))}

          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide pt-2 border-t border-gray-100">Drivers</p>
          {DRIVER_FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`df-${f.key}`} className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <div className="flex items-center gap-2">
                <input id={`df-${f.key}`} required type="number" step={f.step} min={DELIVERY_LIMITS[f.key].min} max={DELIVERY_LIMITS[f.key].max}
                  value={form[f.key]} onChange={(e) => setForm((p) => (p ? { ...p, [f.key]: e.target.value } : p))}
                  className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" />
                <span className="text-xs text-gray-500">{f.suffix}</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{f.hint}</p>
            </div>
          ))}

          {current && store && (
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-3 py-2" style={{ background: "var(--bg-muted)" }}>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Preview — try your rates before saving</p>
                <p className="text-[10.5px] text-gray-400 mt-0.5">
                  Not a price list. This changes as you type, so you can check the rates above before you save.
                  Real orders are priced automatically from the customer&apos;s pin.
                </p>
              </div>
              <ul className="divide-y divide-gray-50">
                {EXAMPLES
                  .map((ex) => ({ ex, q: quoteDelivery(current, store, ex) }))
                  .sort((a, b) => a.q.fee - b.q.fee || a.q.roadKm - b.q.roadKm)
                  .map(({ ex, q }) => {
                  return (
                    <li key={ex.name} className="flex justify-between gap-3 px-3 py-2 text-xs">
                      <span className="text-gray-700">{ex.name} <span className="text-gray-400">· ~{q.roadKm.toFixed(1)} km{q.island ? ` + boat ₱${q.boatFee}` : ""}</span></span>
                      <span className="font-semibold text-gray-900 num">{q.tooFar ? "Too far" : q.fee === 0 ? "Free" : `₱${q.fee}`}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </form>
      )}
    </Modal>
  );
}
