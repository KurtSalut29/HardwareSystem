"use client";

import { Eye, Route, Truck } from "lucide-react";
import SettingRow, { FormSection, UnitInput } from "@/components/ui/SettingRow";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { DELIVERY_LIMITS, estimateRoadKm, islandAt, quoteForDistance, type DeliverySettings, type DistanceSource } from "@/lib/deliveryFee";
import Alert from "@/components/ui/Alert";

export type Field = { key: keyof DeliverySettings; label: string; prefix?: string; suffix: string; step: string; hint: string };

export const FEE_FIELDS: Field[] = [
  { key: "baseFee", label: "Base delivery fee", prefix: "₱", suffix: "/ delivery", step: "5", hint: "What every delivery pays, however close. 0 makes nearby delivery free." },
  { key: "freeKm", label: "Covered by the base fee", suffix: "km", step: "0.5", hint: "Deliveries within this road distance pay only the base fee." },
  { key: "ratePerKm", label: "Rate beyond that", prefix: "₱", suffix: "/ km", step: "1", hint: "Added for every kilometre past the covered distance." },
  { key: "islandFee", label: "Boat fee for islands", prefix: "₱", suffix: "added", step: "10", hint: "For Maripipi and Higatangan drop-offs, on top of the distance fee." },
  { key: "maxKm", label: "Farthest delivery", suffix: "km", step: "1", hint: "Mainland orders farther than this can't choose delivery. 0 = no limit." },
  { key: "roadFactor", label: "Road factor (backup)", prefix: "×", suffix: "straight km", step: "0.05", hint: "Only used when road routing is down: straight-line distance × this." },
];

export const DRIVER_FIELDS: Field[] = [
  { key: "driverMaxActive", label: "Deliveries per driver at a time", suffix: "orders", step: "1", hint: "A driver carrying this many gets no new order until one is delivered." },
];

export const FIELDS = [...FEE_FIELDS, ...DRIVER_FIELDS];

/**
 * The town centre (poblacion) of every municipality in Biliran, plus Higatangan
 * island, so the admin sees what customers across the province will pay. Real
 * orders are priced from the customer's own pin, so any barangay works.
 */
export const EXAMPLES = [
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

export type ExampleDistance = { roadKm: number; source: DistanceSource; island: string | null };

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

  const field = (f: Field) => (
    <SettingRow key={f.key} id={`df-${f.key}`} label={f.label} hint={f.hint}>
      <UnitInput id={`df-${f.key}`} required type="number" step={f.step} min={DELIVERY_LIMITS[f.key].min} max={DELIVERY_LIMITS[f.key].max}
        prefix={f.prefix} suffix={f.suffix}
        value={form?.[f.key] ?? ""} onChange={(e) => setForm((p) => (p ? { ...p, [f.key]: e.target.value } : p))} />
    </SettingRow>
  );

  return (
    <Modal open onClose={onClose} title="Delivery settings" icon={<Route className="size-5" />} description="The base fee, the rate per kilometre, and the free distance." size="lg"
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="delivery-fee-form" className="flex-1" loading={saving} disabled={!form}>Save</Button>
        </div>
      }>
      {!form ? (
        <p className="text-sm text-ink-4 py-8 text-center">{error || "Loading..."}</p>
      ) : (
        <form id="delivery-fee-form" onSubmit={save} className="space-y-5">
          <Alert tone="info" compact>
            Fee = base fee + the rate for every km past the covered distance, measured by road from the store&apos;s pin to the
            customer&apos;s. Customers see it at checkout, and you can still change it on a single order.
          </Alert>

          <FormSection title="Delivery fee" icon={<Route className="size-3.5" />}>
            {FEE_FIELDS.map((f) => field(f))}
          </FormSection>

          <FormSection title="Drivers" icon={<Truck className="size-3.5" />}>
            {DRIVER_FIELDS.map((f) => field(f))}
          </FormSection>

          {current && store && (
            <div className="overflow-hidden rounded-2xl border border-line">
              <div className="flex items-start gap-2.5 bg-subtle px-4 py-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Eye className="size-4" /></span>
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">Preview — try your rates before saving</p>
                  <p className="text-[12px] text-ink-4">Updates as you type. Real orders are priced from the customer&apos;s own pin.</p>
                </div>
              </div>
              <ul className="divide-y divide-line">
                {EXAMPLES
                  .map((ex) => {
                    // Real road distance once it arrives; the straight-line estimate until then.
                    const d = distances[ex.name] ?? { roadKm: estimateRoadKm(current, store, ex), source: "estimate" as const, island: islandAt(ex.lat, ex.lng) };
                    return { ex, q: quoteForDistance(current, d.roadKm, d.island, d.source) };
                  })
                  .sort((a, b) => a.q.fee - b.q.fee || a.q.roadKm - b.q.roadKm)
                  .map(({ ex, q }) => {
                  return (
                    <li key={ex.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                      <span className="min-w-0">
                        <span className="font-semibold text-ink">{ex.name}</span>
                        <span className="block text-[11.5px] text-ink-4">{q.source === "road" ? "" : "~"}{q.roadKm.toFixed(1)} km{q.source === "road" ? " by road" : ""}{q.island ? ` + boat ₱${q.boatFee}` : ""}</span>
                      </span>
                      <span className={`num shrink-0 rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${q.tooFar ? "bg-bad-soft text-bad" : q.fee === 0 ? "bg-good-soft text-good" : "bg-brand-soft text-brand-ink"}`}>
                        {q.tooFar ? "Too far" : q.fee === 0 ? "Free" : `₱${q.fee}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {error && <Alert tone="bad" compact>{error}</Alert>}
        </form>
      )}
    </Modal>
  );
}
