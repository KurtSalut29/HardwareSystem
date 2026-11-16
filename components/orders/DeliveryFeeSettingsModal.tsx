"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { DELIVERY_LIMITS, estimateRoadKm, islandAt, quoteForDistance, type DeliverySettings, type DistanceSource } from "@/lib/deliveryFee";

type Field = { key: keyof DeliverySettings; label: string; suffix: string; step: string; hint: string };

const FEE_FIELDS: Field[] = [
  { key: "baseFee", label: "Base delivery fee", suffix: "₱ per delivery", step: "5", hint: "The default fee every delivery pays, however close. Set 0 for free nearby delivery." },
  { key: "freeKm", label: "Distance the base fee covers", suffix: "km by road", step: "0.5", hint: "Deliveries within this distance pay only the base fee." },
  { key: "ratePerKm", label: "Rate beyond that", suffix: "₱ per km", step: "1", hint: "Charged for every kilometre past the covered distance, so farther places pay more." },
  { key: "roadFactor", label: "Road factor (backup only)", suffix: "× straight-line km", step: "0.05", hint: "Distances come from real roads (OpenStreetMap routing). Only if that service is down, or for islands, the straight line × this is used instead." },
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

type ExampleDistance = { roadKm: number; source: DistanceSource; island: string | null };

const toForm = (s: DeliverySettings) => Object.fromEntries(FIELDS.map((f) => [f.key, String(s[f.key])])) as Record<keyof DeliverySettings, string>;

export default function DeliveryFeeSettingsModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<keyof DeliverySettings, string> | null>(null);
  const [store, setStore] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Road distance to each example town, from the same routing service checkout uses.
  const [distances, setDistances] = useState<Record<string, ExampleDistance>>({});

  useEffect(() => {
    fetch("/api/delivery-settings").then((r) => r.json()).then((d) => { setForm(toForm(d.settings)); setStore(d.store); }).catch(() => setError("Couldn't load the settings."));
    let live = true;
    for (const ex of EXAMPLES) {
      fetch("/api/delivery-quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: ex.lat, lng: ex.lng }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!live || !d?.quote) return;
          setDistances((p) => ({ ...p, [ex.name]: { roadKm: d.quote.roadKm, source: d.quote.source, island: d.quote.island } }));
        })
        .catch(() => {});
    }
    return () => { live = false; };
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
            Every delivery pays the base fee, plus a rate per km past the distance it covers. The distance is the real driving
            distance by road from the store&apos;s pin to the customer&apos;s pin (OpenStreetMap routing), so farther places pay more.
            Customers see the fee at checkout before they order, and you can still change it on a single order.
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
                  .map((ex) => {
                    // Real road distance once it arrives; the straight-line estimate until then.
                    const d = distances[ex.name] ?? { roadKm: estimateRoadKm(current, store, ex), source: "estimate" as const, island: islandAt(ex.lat, ex.lng) };
                    return { ex, q: quoteForDistance(current, d.roadKm, d.island, d.source) };
                  })
                  .sort((a, b) => a.q.fee - b.q.fee || a.q.roadKm - b.q.roadKm)
                  .map(({ ex, q }) => {
                  return (
                    <li key={ex.name} className="flex justify-between gap-3 px-3 py-2 text-xs">
                      <span className="text-gray-700">{ex.name} <span className="text-gray-400">· {q.source === "road" ? "" : "~"}{q.roadKm.toFixed(1)} km{q.source === "road" ? " by road" : ""}{q.island ? ` + boat ₱${q.boatFee}` : ""}</span></span>
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
