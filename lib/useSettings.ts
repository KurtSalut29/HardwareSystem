"use client";

import { useEffect, useSyncExternalStore } from "react";
import { defaultSettings, type AppSettings } from "@/lib/settings-schema";

/**
 * The store's settings in the browser: fetched once per page load and shared by
 * every component. Until they arrive, the defaults are used, so screens never
 * wait on them. After the admin saves, refreshSettings() updates everyone.
 */
let current: AppSettings = defaultSettings();
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function refreshSettings(): Promise<void> {
  inflight = fetch("/api/settings", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data) { current = { ...defaultSettings(), ...data }; loaded = true; listeners.forEach((l) => l()); }
    })
    .catch(() => {})
    .finally(() => { inflight = null; });
  return inflight;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useSettings(): AppSettings & { loaded: boolean } {
  const s = useSyncExternalStore(subscribe, () => current, () => current);
  useEffect(() => { if (!loaded && !inflight) void refreshSettings(); }, []);
  return { ...s, loaded };
}
