"use client";

import { useEffect, useState } from "react";

export type StorePin = { lat: number; lng: number; name: string };
export type StoreDistance = {
  km: number;
  minutes: number | null;
  /** "road" = measured along the roads; "estimate" = no road route (island, or routing is down). */
  source: "road" | "estimate";
  island: string | null;
  /** The road as [lat, lng] points, when measured by road. */
  path: [number, number][] | null;
};

// One fetch of the store's pin per page load, shared by every map.
let storePromise: Promise<StorePin | null> | null = null;
function loadStore() {
  storePromise ??= fetch("/api/store-location")
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((d) => (d ? { lat: d.lat, lng: d.lng, name: d.name } : (storePromise = null)));
  return storePromise;
}

/** The store's pin, for maps that show it. */
export function useStorePin(enabled: boolean) {
  const [store, setStore] = useState<StorePin | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadStore().then((s) => { if (live && s) setStore(s); });
    return () => { live = false; };
  }, [enabled]);
  return enabled ? store : null;
}

type Result = { key: string; data: StoreDistance | null; error: string | null };

/**
 * How far a pin is from the store by road. Waits a moment after the pin moves,
 * so dragging it doesn't send a request per step.
 */
export function useStoreDistance(to: { lat: number; lng: number } | null) {
  const key = to ? `${to.lat.toFixed(5)},${to.lng.toFixed(5)}` : null;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!key) return;
    const [lat, lng] = key.split(",").map(Number);
    let live = true;
    const t = setTimeout(() => {
      fetch("/api/route-distance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat, lng }) })
        .then(async (r) => {
          const d = await r.json().catch(() => ({}));
          if (!live) return;
          setResult(r.ok ? { key, data: d as StoreDistance, error: null } : { key, data: null, error: d.error ?? "Couldn't measure the distance to the store." });
        })
        .catch(() => { if (live) setResult({ key, data: null, error: "Couldn't reach the server to measure the distance." }); });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [key]);

  const ready = result && result.key === key;
  return {
    data: ready ? result.data : null,
    error: ready ? result.error : null,
    loading: Boolean(key) && !ready,
  };
}
