"use client";

import { useSyncExternalStore } from "react";

/**
 * A driver's own preferences, kept on this phone (like the alert sound):
 *  - autoShare: start sharing location by itself when a delivery is assigned
 *  - keepAwake: keep the screen on while the navigation screen is open
 * Both default to on.
 */
export type DriverPref = "autoShare" | "keepAwake";

const KEY: Record<DriverPref, string> = { autoShare: "driver:auto-share", keepAwake: "driver:keep-awake" };
const listeners = new Set<() => void>();

export function getDriverPref(p: DriverPref): boolean {
  try { return localStorage.getItem(KEY[p]) !== "off"; } catch { return true; }
}

export function setDriverPref(p: DriverPref, on: boolean) {
  try { localStorage.setItem(KEY[p], on ? "on" : "off"); } catch { /* storage blocked: lasts until reload */ }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key && Object.values(KEY).includes(e.key)) l(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}

/** The preference, read safely on the server (defaults to on) and live in the browser. */
export function useDriverPref(p: DriverPref): boolean {
  return useSyncExternalStore(subscribe, () => getDriverPref(p), () => true);
}
