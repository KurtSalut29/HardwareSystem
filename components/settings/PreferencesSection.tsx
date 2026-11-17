"use client";

import { createElement, useState, useSyncExternalStore } from "react";
import { BellRing, CheckCheck, Monitor, Moon, Palette, Smartphone, Sun, Volume2, VolumeX } from "lucide-react";
import SettingsCard from "@/components/settings/SettingsCard";
import SettingRow from "@/components/ui/SettingRow";
import Switch from "@/components/ui/Switch";
import Button from "@/components/ui/Button";
import InstallAppCard from "@/components/pwa/InstallAppCard";
import { useTheme } from "@/components/ThemeProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { isSoundOn, playAlert, setSoundOn, subscribeSound, unlockAudio, type AlertSound } from "@/lib/sounds";
import { desktopPermission, requestDesktop } from "@/lib/desktopNotify";

const noop = () => () => {};
function readFollowsSystem() {
  try { return !localStorage.getItem("theme"); } catch { return false; }
}

const TEST_SOUND: Record<string, AlertSound> = { admin: "new_order", cashier: "new_order", customer: "order_update", driver: "delivery" };

/** Appearance, alert sound, desktop pop-ups and the app install. Saved on this device. */
export default function PreferencesSection({ role }: { role: string }) {
  const { theme, toggle } = useTheme();
  const showToast = useToast();
  const soundOn = useSyncExternalStore(subscribeSound, isSoundOn, () => true);
  // Read from the browser after the first paint, so the server and browser agree.
  const storedSystem = useSyncExternalStore(noop, readFollowsSystem, () => false);
  const [override, setFollowSystem] = useState<boolean | null>(null);
  const followSystem = override ?? storedSystem;
  const [asked, setAsked] = useState(0);
  const perm = useSyncExternalStore(noop, () => (asked >= 0 ? desktopPermission() : "default"), () => "default");

  function pick(mode: "light" | "dark" | "system") {
    if (mode === "system") {
      const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      toggle(sys);
      try { localStorage.removeItem("theme"); } catch { /* storage blocked */ }
      setFollowSystem(true);
      showToast("Appearance now follows your device.", "info");
    } else {
      toggle(mode);
      setFollowSystem(false);
      showToast(mode === "dark" ? "Dark mode on." : "Light mode on.", "info");
    }
  }

  const options = [
    { key: "light" as const, label: "Light", icon: Sun, on: !followSystem && theme === "light" },
    { key: "dark" as const, label: "Dark", icon: Moon, on: !followSystem && theme === "dark" },
    { key: "system" as const, label: "Device", icon: Monitor, on: followSystem },
  ];

  return (
    <div className="space-y-5">
      <SettingsCard title="Appearance" icon={<Palette className="size-5" />} description="Saved on this device only.">
        <div className="py-4">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-recess p-1" role="radiogroup" aria-label="Appearance">
            {options.map((o) => (
              <button key={o.key} type="button" role="radio" aria-checked={o.on} onClick={() => pick(o.key)}
                className={`flex flex-col items-center gap-1 rounded-lg py-2.5 text-[12.5px] font-semibold transition ${o.on ? "bg-surface text-brand-ink shadow-[0_1px_3px_rgba(16,24,64,0.12)] ring-1 ring-brand/25" : "text-ink-3 hover:text-ink"}`}>
                {createElement(o.icon, { className: "size-4" })}{o.label}
              </button>
            ))}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Alerts" icon={<BellRing className="size-5" />}
        description={role === "driver" ? "How you hear about new deliveries." : "How you hear about new orders, payments and updates."}>
        <SettingRow wide id="pref-sound" label="Alert sound" hint="Plays when something new needs you. The red count on the bell shows either way."
          tone={soundOn ? "good" : "neutral"}
          status={
            <span className="flex items-center gap-2.5">
              <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${soundOn ? "bg-surface text-good" : "bg-recess text-ink-4"}`}>
                {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </span>
              <span><b className={soundOn ? "text-good" : "text-ink-3"}>{soundOn ? "On" : "Muted"}</b> <span className="text-ink-4">· {soundOn ? "you'll hear new alerts" : "alerts arrive silently"}</span></span>
            </span>
          }>
          <Button size="sm" variant="secondary" onClick={() => { unlockAudio(); playAlert(TEST_SOUND[role] ?? "new_order", { force: true }); }}>Test sound</Button>
          <Switch id="pref-sound" checked={soundOn} label="Alert sound" onChange={(on) => { unlockAudio(); setSoundOn(on); showToast(on ? "Alert sound on." : "Alert sound muted.", "info"); }} />
        </SettingRow>
        {role !== "driver" && (
          <SettingRow wide id="pref-desktop" label="Pop-ups outside the app" hint="Show alerts on your computer or phone even while you're on another tab or app."
            tone={perm === "granted" ? "good" : perm === "denied" ? "warn" : "neutral"}
            status={
              perm === "granted" ? <span className="flex items-center gap-2"><CheckCheck className="size-4 shrink-0 text-good" /><span><b className="text-good">On for this browser</b> <span className="text-ink-4">· alerts pop up even in other tabs</span></span></span>
              : perm === "denied" ? <span className="text-warn"><b>Blocked.</b> Allow notifications for this site from the lock icon in the address bar.</span>
              : perm === "unsupported" ? <span className="text-ink-4">This browser doesn&apos;t support them.</span>
              : <span><b className="text-ink-3">Off</b> <span className="text-ink-4">· your browser will ask to allow them</span></span>
            }>
            {perm === "granted" || perm === "denied" || perm === "unsupported" ? null : (
              <Button size="sm" onClick={async () => {
                unlockAudio();
                const p = await requestDesktop();
                setAsked((n) => n + 1);
                showToast(p === "granted" ? "Pop-ups are on." : "Pop-ups weren't allowed. You can allow them later from the address bar.", p === "granted" ? "success" : "warning");
              }}>Turn on</Button>
            )}
          </SettingRow>
        )}
      </SettingsCard>

      <SettingsCard title="App" icon={<Smartphone className="size-5" />} description="Install RM Hardware so it opens in its own window from your home screen or taskbar.">
        <div className="-mx-5"><InstallAppCard labelClass="hidden" fallback bare /></div>
      </SettingsCard>
    </div>
  );
}
