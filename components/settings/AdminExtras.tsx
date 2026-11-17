"use client";

import { useEffect, useState } from "react";
import { MailCheck, MapPinned, Route, Truck } from "lucide-react";
import SettingsCard from "@/components/settings/SettingsCard";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import LocationPicker, { type PickedLocation } from "@/components/LocationPicker";
import DeliveryFeeSettingsModal from "@/components/orders/DeliveryFeeSettingsModal";
import { useToast } from "@/components/ui/ToastProvider";
import type { DeliverySettings } from "@/lib/deliveryFee";

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
        {pin ? <LocationPicker value={pin} onChange={setPin} /> : <div className="h-64 animate-pulse rounded-xl bg-recess" />}
        <Alert tone="info" compact>Orders already placed keep the fee they were given. Only new orders use the new pin.</Alert>
        {error && <Alert tone="bad" compact>{error}</Alert>}
      </div>
    </SettingsCard>
  );
}

/** A summary of the delivery fee rules, with the editor one click away. */
export function DeliveryFeesCard() {
  const showToast = useToast();
  const [s, setS] = useState<DeliverySettings | null>(null);
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    const r = await fetch("/api/delivery-settings").catch(() => null);
    if (!r?.ok) { setLoadError(true); return; }
    setS((await r.json()).settings); setLoadError(false);
  }
  useEffect(() => {
    let live = true;
    fetch("/api/delivery-settings").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!live) return;
      if (d) setS(d.settings); else setLoadError(true);
    }).catch(() => { if (live) setLoadError(true); });
    return () => { live = false; };
  }, []);

  const rows: [string, string][] = s ? [
    ["Base fee", `${peso(s.baseFee)} covers the first ${s.freeKm} km`],
    ["Beyond that", `${peso(s.ratePerKm)} per km`],
    ["Island deliveries (by boat)", `+ ${peso(s.islandFee)}`],
    ["Farthest delivery", s.maxKm > 0 ? `${s.maxKm} km by road` : "No limit"],
    ["Deliveries per driver at a time", String(s.driverMaxActive)],
  ] : [];

  return (
    <>
      <SettingsCard title="Delivery fees and drivers" icon={<Truck className="size-5" />}
        description="How the delivery fee is worked out at checkout, and how many stops a driver carries at once."
        footer={<div className="flex justify-end"><Button icon={<Route className="size-4" />} onClick={() => setOpen(true)} disabled={!s}>Edit delivery fees</Button></div>}>
        {loadError && <div className="py-3"><Alert tone="bad" compact action={<Button size="sm" variant="secondary" onClick={load}>Try again</Button>}>Couldn&apos;t load the delivery fees.</Alert></div>}
        {!s && !loadError && <div className="my-4 h-28 animate-pulse rounded-xl bg-recess" />}
        {s && (
          <dl className="divide-y divide-line">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-3 text-[13.5px]">
                <dt className="text-ink-3">{k}</dt><dd className="num text-right font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </SettingsCard>
      {open && (
        <DeliveryFeeSettingsModal onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); void load(); showToast("Delivery fees saved. New orders use them right away."); }} />
      )}
    </>
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
