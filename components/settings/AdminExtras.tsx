"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, MailCheck, MapPinned, Route, Truck } from "lucide-react";
import SettingsCard from "@/components/settings/SettingsCard";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import LocationPicker, { type PickedLocation } from "@/components/LocationPicker";
import SettingRow, { FormSection, UnitInput } from "@/components/ui/SettingRow";
import { DRIVER_FIELDS, EXAMPLES, FEE_FIELDS, FIELDS, type ExampleDistance, type Field } from "@/components/orders/DeliveryFeeSettingsModal";
import { useToast } from "@/components/ui/ToastProvider";
import { DELIVERY_LIMITS, estimateRoadKm, islandAt, quoteForDistance, type DeliverySettings } from "@/lib/deliveryFee";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

/** Where deliveries start from: the store's pin. Fees and routes are measured from it. */
export function StorePinCard() {
  const showToast = useToast();
  const [pin, setPin] = useState<PickedLocation | null>(null);
  const [saved, setSaved] = useState<PickedLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/store-location").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!live || !d) return;
      const p = { address: d.name ?? "Store", lat: d.lat, lng: d.lng };
      setPin(p); setSaved(p);
    }).catch(() => { if (live) setError("Couldn't load the store's location."); });
    return () => { live = false; };
  }, []);

  const dirty = !!pin && !!saved && (pin.lat !== saved.lat || pin.lng !== saved.lng);

  async function save() {
    if (!pin) return;
    setSaving(true); setError("");
    const res = await fetch("/api/store-location", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: pin.lat, lng: pin.lng }) });
    setSaving(false);
    if (!res.ok) { setError("Couldn't save the store's location. Try again."); showToast("Couldn't save the store's location.", "error"); return; }
    setSaved(pin);
    showToast("Store location saved. New delivery fees are measured from here.");
  }

  return (
    <SettingsCard title="Store location" icon={<MapPinned className="size-5" />}
      description="Deliveries start here: the delivery fee and the driver's route are measured from this pin."
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirty && <span className="mr-auto text-[12px] font-semibold text-warn">The pin moved — save to use it.</span>}
          <Button variant="secondary" disabled={!dirty || saving} onClick={() => setPin(saved)}>Discard</Button>
          <Button onClick={save} loading={saving} disabled={!dirty}>Save location</Button>
        </div>
      }>
      <div className="space-y-3 py-4">
        {pin ? <LocationPicker value={pin} onChange={setPin} measure={false} /> : <div className="h-64 animate-pulse rounded-xl bg-recess" />}
        <Alert tone="info" compact>Orders already placed keep the fee they were given. Only new orders use the new pin.</Alert>
        {error && <Alert tone="bad" compact>{error}</Alert>}
      </div>
    </SettingsCard>
  );
}

const toForm = (s: DeliverySettings) => Object.fromEntries(FIELDS.map((f) => [f.key, String(s[f.key])])) as Record<keyof DeliverySettings, string>;

/**
 * Every delivery fee and driver setting, edited right on the Settings page,
 * with a live preview of what customers in each town will pay.
 */
export function DeliveryFeesCard() {
  const showToast = useToast();
  const [saved, setSaved] = useState<DeliverySettings | null>(null);
  const [form, setForm] = useState<Record<keyof DeliverySettings, string> | null>(null);
  const [store, setStore] = useState<{ lat: number; lng: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Road distance to each example town, from the same routing service checkout uses.
  const [distances, setDistances] = useState<Record<string, ExampleDistance & { minutes: number | null }>>({});

  function apply(d: { settings: DeliverySettings; store?: { lat: number; lng: number } }) {
    setSaved(d.settings); setForm(toForm(d.settings));
    if (d.store) setStore(d.store);
    setLoadError(false);
  }
  async function load() {
    const r = await fetch("/api/delivery-settings").catch(() => null);
    if (!r?.ok) { setLoadError(true); return; }
    apply(await r.json());
  }
  useEffect(() => {
    let live = true;
    fetch("/api/delivery-settings").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!live) return;
      if (d) apply(d); else setLoadError(true);
    }).catch(() => { if (live) setLoadError(true); });
    for (const ex of EXAMPLES) {
      fetch("/api/delivery-quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: ex.lat, lng: ex.lng }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (live && d?.quote) setDistances((p) => ({ ...p, [ex.name]: { roadKm: d.quote.roadKm, source: d.quote.source, island: d.quote.island, minutes: d.quote.minutes } }));
        })
        .catch(() => {});
    }
    return () => { live = false; };
  }, []);

  const changed = form && saved ? FIELDS.filter((f) => form[f.key].trim() === "" || Number(form[f.key]) !== saved[f.key]) : [];
  const dirty = changed.length > 0;
  const current: DeliverySettings | null = form
    ? Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key]) || 0])) as DeliverySettings
    : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true); setError("");
    const res = await fetch("/api/delivery-settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key])]))),
    }).catch(() => null);
    setSaving(false);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      const msg = d?.error ?? "Couldn't save the delivery settings. Try again.";
      setError(msg); showToast(msg, "error"); return;
    }
    apply(d);
    showToast("Delivery settings saved. New orders use them right away.");
  }

  const row = (f: Field) => (
    <SettingRow wide key={f.key} id={`df-${f.key}`} label={f.label} hint={f.hint}>
      <UnitInput id={`df-${f.key}`} required type="number" step={f.step} min={DELIVERY_LIMITS[f.key].min} max={DELIVERY_LIMITS[f.key].max}
        prefix={f.prefix} suffix={f.suffix}
        value={form?.[f.key] ?? ""} onChange={(e) => setForm((p) => (p ? { ...p, [f.key]: e.target.value } : p))} />
    </SettingRow>
  );

  const preview = current && store ? EXAMPLES
    .map((ex) => {
      // Real road distance once it arrives; the straight-line estimate until then.
      const dist = distances[ex.name] ?? { roadKm: estimateRoadKm(current, store, ex), source: "estimate" as const, island: islandAt(ex.lat, ex.lng), minutes: null };
      return { ex, q: quoteForDistance(current, dist.roadKm, dist.island, dist.source, dist.minutes) };
    })
    .sort((x, y) => x.q.fee - y.q.fee || x.q.roadKm - y.q.roadKm) : [];

  return (
    <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_400px]">
      <form onSubmit={save} className="min-w-0">
        <SettingsCard title="Delivery fees and drivers" icon={<Truck className="size-5" />}
          description="How the delivery fee is worked out at checkout, and how many stops a driver carries at once."
          footer={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {dirty
                ? <span className="mr-auto text-[12px] font-semibold text-warn">{changed.length} unsaved {changed.length === 1 ? "change" : "changes"} — the preview already shows them.</span>
                : <span className="mr-auto text-[12px] text-ink-4">Changes apply to new orders right away. Orders already placed keep their fee.</span>}
              <Button type="button" variant="secondary" disabled={!dirty || saving} onClick={() => { if (saved) setForm(toForm(saved)); setError(""); }}>Discard</Button>
              <Button type="submit" loading={saving} disabled={!dirty || !form}>Save delivery settings</Button>
            </div>
          }>
          {loadError && <div className="py-3"><Alert tone="bad" compact action={<Button type="button" size="sm" variant="secondary" onClick={load}>Try again</Button>}>Couldn&apos;t load the delivery settings.</Alert></div>}
          {!form && !loadError && <div className="my-4 h-64 animate-pulse rounded-xl bg-recess" />}
          {form && (
            <div className="space-y-5 py-4">
              <Alert tone="info" compact>
                <b>Fee = base fee + rate × every km past the covered distance</b> (plus the boat fee for islands). The distance is measured by road
                from the store&apos;s pin to the customer&apos;s pin. Customers see the fee and how it was worked out before they order, and staff can still change it on a single order.
              </Alert>
              {store && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-subtle px-4 py-3 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2.5 text-ink-2">
                    <MapPinned className="size-4 shrink-0 text-brand" />
                    <span>Distances are measured from the store&apos;s pin at <span className="num font-semibold text-ink">{store.lat.toFixed(5)}, {store.lng.toFixed(5)}</span></span>
                  </span>
                  <Link href="/settings?tab=store" className="text-[12.5px] font-bold text-brand hover:underline">Move the store pin</Link>
                </div>
              )}
              <FormSection title="Delivery fee" icon={<Route className="size-3.5" />}>{FEE_FIELDS.map(row)}</FormSection>
              <FormSection title="Drivers" icon={<Truck className="size-3.5" />}>{DRIVER_FIELDS.map(row)}</FormSection>
              {error && <Alert tone="bad" compact>{error}</Alert>}
            </div>
          )}
        </SettingsCard>
      </form>

      <div className="min-w-0 2xl:sticky 2xl:top-4">
        <SettingsCard title="What customers will pay" icon={<Eye className="size-5" />}
          description={dirty ? "Showing your unsaved rates. Save to use them." : "Each town centre in Biliran, at the current rates. Updates as you type."}>
          {preview.length === 0 ? (
            <div className="my-4 h-48 animate-pulse rounded-xl bg-recess" />
          ) : (
            <ul className="divide-y divide-line">
              {preview.map(({ ex, q }) => (
                <li key={ex.name} className="flex items-center justify-between gap-3 py-3 text-[13px]">
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{ex.name}</span>
                    <span className="block text-[11.5px] text-ink-4">
                      {q.source === "road" ? "" : "~"}<span className="num">{q.roadKm.toFixed(1)}</span> km{q.source === "road" ? " by road" : " (estimate)"}
                      {q.minutes != null ? ` · about ${q.minutes} min` : ""}{q.island ? ` · boat ₱${q.boatFee}` : ""}
                    </span>
                  </span>
                  <span className={`num shrink-0 rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${q.tooFar ? "bg-bad-soft text-bad" : q.fee === 0 ? "bg-good-soft text-good" : "bg-brand-soft text-brand-ink"}`}>
                    {q.tooFar ? "Too far" : q.fee === 0 ? "Free" : peso(q.fee)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-line py-3 text-[11.5px] text-ink-4">Real orders are priced from the customer&apos;s own pin, so any barangay works.</p>
        </SettingsCard>
      </div>
    </div>
  );
}

/** Checks the store Gmail by sending a test email to the admin. */
export function TestEmailCard() {
  const showToast = useToast();
  const [ready, setReady] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/users/review").then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d) setReady(Boolean(d.mailReady)); }).catch(() => {});
    return () => { live = false; };
  }, []);

  async function send() {
    setSending(true); setResult(null);
    const res = await fetch("/api/settings/test-email", { method: "POST" });
    setSending(false);
    const d = await res.json().catch(() => ({}));
    const ok = res.ok && d.sent;
    const text = ok ? `Test email sent to ${d.to}. Check that inbox (and Spam).` : d.error ?? d.reason ?? "The test email couldn't be sent.";
    setResult({ ok, text });
    showToast(ok ? "Test email sent." : "Test email failed — see the message on the page.", ok ? "success" : "error");
  }

  return (
    <SettingsCard title="Store email" icon={<MailCheck className="size-5" />}
      description="Customers get emails when their account is approved and about their payments and refunds."
      footer={<div className="flex justify-end"><Button variant="secondary" onClick={send} loading={sending} disabled={ready === false}>Send a test email</Button></div>}>
      <div className="space-y-3 py-4">
        {ready === null && <div className="h-10 animate-pulse rounded-xl bg-recess" />}
        {ready === true && <Alert tone="good" compact>The store Gmail is set up. Send a test to make sure it works.</Alert>}
        {ready === false && (
          <Alert tone="warn" compact title="Email isn't set up yet">
            Add <b>GMAIL_USER</b> and <b>GMAIL_APP_PASSWORD</b> to the server settings (the .env file, and the Environment Variables on Vercel), then restart or redeploy. Everything else works without email.
          </Alert>
        )}
        {result && <Alert tone={result.ok ? "good" : "bad"} compact>{result.text}</Alert>}
      </div>
    </SettingsCard>
  );
}
