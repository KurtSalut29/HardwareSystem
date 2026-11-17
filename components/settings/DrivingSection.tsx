"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Coffee, MonitorSmartphone, Navigation, Phone, Store, Truck } from "lucide-react";
import SettingsCard from "@/components/settings/SettingsCard";
import SettingRow from "@/components/ui/SettingRow";
import Switch from "@/components/ui/Switch";
import Alert from "@/components/ui/Alert";
import { useToast } from "@/components/ui/ToastProvider";
import { useSettings } from "@/lib/useSettings";
import { setDriverPref, useDriverPref } from "@/lib/driverPrefs";
import type { DriverAvailability } from "@/lib/driverStatus";

const noop = () => () => {};

type Status = { onDuty: boolean; active: number; maxActive: number; availability: DriverAvailability };

/** The driver's own work settings: duty, location sharing, navigation, and the store's contact. */
export default function DrivingSection() {
  const showToast = useToast();
  const settings = useSettings();
  const autoShare = useDriverPref("autoShare");
  const keepAwake = useDriverPref("keepAwake");
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  // Read after hydration (the server can't know the browser), so the page renders the same on both.
  const wakeSupported = useSyncExternalStore(noop, () => "wakeLock" in navigator, () => true);

  useEffect(() => {
    let live = true;
    fetch("/api/driver/status").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!live) return;
      if (d) setStatus(d); else setLoadError(true);
    }).catch(() => { if (live) setLoadError(true); });
    return () => { live = false; };
  }, []);

  async function setDuty(onDuty: boolean) {
    if (!status) return;
    setSaving(true);
    const res = await fetch("/api/driver/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ onDuty }) }).catch(() => null);
    setSaving(false);
    if (!res?.ok) { showToast("Couldn't change your status. Check your connection and try again.", "error"); return; }
    const next: Status = await res.json();
    setStatus(next);
    showToast(next.onDuty ? "You're on duty — the store can assign you deliveries." : "You're off duty — no new deliveries will be assigned.", next.onDuty ? "success" : "info");
  }

  const free = status ? Math.max(0, status.maxActive - status.active) : 0;

  return (
    <div className="space-y-5">
      <SettingsCard title="Duty" icon={<Truck className="size-5" />}
        description="Whether the store can give you new deliveries. The store sees this when picking a driver.">
        {loadError && <div className="py-3"><Alert tone="bad" compact>Couldn&apos;t load your status. Refresh the page to try again.</Alert></div>}
        {!status && !loadError && <div className="my-4 h-14 animate-pulse rounded-xl bg-recess" />}
        {status && (
          <>
            <SettingRow wide id="drv-duty" label="On duty" hint="Go off duty for a break or at the end of your shift. Deliveries already on hand stay yours."
              tone={status.onDuty ? "good" : "neutral"}
              status={status.onDuty
                ? <span><b className="text-good">On duty</b> <span className="text-ink-4">· {status.availability === "full" ? "at your limit — finish a stop to get more" : "the store can assign you deliveries"}</span></span>
                : <span className="flex items-center gap-1.5"><Coffee className="size-4 shrink-0 text-ink-4" /><span><b className="text-ink-3">Off duty</b> <span className="text-ink-4">· nothing new will be assigned</span></span></span>}>
              <Switch id="drv-duty" checked={status.onDuty} disabled={saving} onChange={setDuty} label="On duty" />
            </SettingRow>
            <SettingRow wide id="drv-load" label="Deliveries at a time" hint="Set by the store. You get no new delivery while you carry this many."
              status={<span><b className="num text-ink">{status.active}</b> <span className="text-ink-4">of</span> <b className="num text-ink">{status.maxActive}</b> <span className="text-ink-4">on hand</span></span>}>
              <span className="rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-ink-3 ring-1 ring-line">
                {free > 0 ? `Room for ${free} more` : "Full"}
              </span>
            </SettingRow>
          </>
        )}
      </SettingsCard>

      <SettingsCard title="Location and navigation" icon={<Navigation className="size-5" />}
        description="Saved on this phone. The store and the customer see where you are only while you have a delivery on the road.">
        <SettingRow wide id="drv-share" label="Share my location automatically" hint="Starts sharing by itself when a delivery is assigned to you, and stops when you have none left. You can still start or stop it on the dashboard."
          tone={autoShare ? "good" : "neutral"}
          status={autoShare
            ? <span><b className="text-good">On</b> <span className="text-ink-4">· starts with your next delivery</span></span>
            : <span><b className="text-ink-3">Off</b> <span className="text-ink-4">· tap &ldquo;Start sharing&rdquo; on the dashboard yourself</span></span>}>
          <Switch id="drv-share" checked={autoShare} label="Share my location automatically"
            onChange={(on) => { setDriverPref("autoShare", on); showToast(on ? "Location sharing will start by itself when you get a delivery." : "Automatic sharing is off. Start it from the dashboard when you head out.", "info"); }} />
        </SettingRow>
        <SettingRow wide id="drv-awake" label="Keep the screen on while navigating" hint="Stops the phone from locking on the navigation screen, so directions stay in view. Uses a little more battery."
          tone={keepAwake && wakeSupported ? "good" : "neutral"}
          status={!wakeSupported
            ? <span className="flex items-center gap-1.5"><MonitorSmartphone className="size-4 shrink-0 text-ink-4" /><span className="text-ink-4">This browser can&apos;t keep the screen on. Raise the screen timeout in your phone&apos;s settings instead.</span></span>
            : keepAwake
              ? <span><b className="text-good">On</b> <span className="text-ink-4">· the screen stays on during navigation</span></span>
              : <span><b className="text-ink-3">Off</b> <span className="text-ink-4">· the phone locks as usual</span></span>}>
          <Switch id="drv-awake" checked={keepAwake && wakeSupported} disabled={!wakeSupported} label="Keep the screen on while navigating"
            onChange={(on) => { setDriverPref("keepAwake", on); showToast(on ? "The screen will stay on while you navigate." : "The screen will lock as usual while navigating.", "info"); }} />
        </SettingRow>
        <div className="pb-4 pt-1">
          <Alert tone="info" compact>Keep the delivery page open while driving. Phones can pause location updates when the screen locks or you switch apps.</Alert>
        </div>
      </SettingsCard>

      <SettingsCard title="The store" icon={<Store className="size-5" />} description="Who to call if a customer can't be reached or something goes wrong on the road.">
        <SettingRow wide id="drv-store" label={settings.storeName || "RM Hardware"} hint={[settings.storeAddress, settings.storeHours].filter(Boolean).join(" · ") || "Store details are set by the admin."}
          status={settings.storeContact
            ? <span className="num font-semibold text-ink">{settings.storeContact}</span>
            : <span className="text-ink-4">The store hasn&apos;t added a contact number yet.</span>}>
          {settings.storeContact && (
            <a href={`tel:${settings.storeContact}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-semibold text-white transition hover:brightness-110">
              <Phone className="size-4" /> Call the store
            </a>
          )}
        </SettingRow>
      </SettingsCard>
    </div>
  );
}
