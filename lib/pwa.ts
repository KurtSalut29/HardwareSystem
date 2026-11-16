"use client";

import { useSyncExternalStore } from "react";

/**
 * Installing RM Hardware as an app.
 *
 * Chrome and Edge (Android, Windows, macOS) fire `beforeinstallprompt` when the
 * app can be installed; we keep that event so an "Install app" button can open
 * the browser's install dialog later. iPhone/iPad Safari has no such event —
 * there the app is added from Share → Add to Home Screen.
 */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export type InstallState = "installed" | "available" | "ios" | "unavailable";

let deferred: InstallPromptEvent | null = null;
let justInstalled = false;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/** Called once from the root layout: listen for the install prompt and register the service worker. */
export function startPwa() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the browser's mini-bar
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => { deferred = null; justInstalled = true; emit(); });

  // Only in production builds: in development the service worker would cache
  // files that change on every save.
  if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); }, { once: true });
  }
}

function snapshot(): InstallState {
  if (justInstalled || isStandalone()) return "installed";
  if (deferred) return "available";
  if (isIos()) return "ios";
  return "unavailable";
}

function subscribe(l: () => void) {
  listeners.add(l);
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", l);
  return () => { listeners.delete(l); mq.removeEventListener("change", l); };
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, snapshot, () => "unavailable");
}

/** Opens the browser's install dialog. Resolves true if the user installed. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null; // the event can only be used once
  if (outcome === "accepted") justInstalled = true;
  emit();
  return outcome === "accepted";
}
