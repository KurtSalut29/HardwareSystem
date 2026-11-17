"use client";

import { useEffect, useState } from "react";
import type { DeliveryQuote, DeliverySettings } from "@/lib/deliveryFee";

export type QuoteSettings = Pick<DeliverySettings, "baseFee" | "freeKm" | "ratePerKm" | "maxKm">;

/** The road the distance was measured along: [lat, lng] points, plus the store pin it starts from. */
export type QuoteRoute = { store: { lat: number; lng: number }; path: [number, number][] };

type Result = { key: string; quote: DeliveryQuote | null; settings: QuoteSettings | null; route: QuoteRoute | null; error: string | null };

/**
 * The delivery fee for a pin, asked from the server (real road distance).
 * Waits a moment after the pin moves so dragging it doesn't fire a request per step.
 */
export function useDeliveryQuote(to: { lat: number; lng: number } | null) {
  const key = to ? `${to.lat.toFixed(5)},${to.lng.toFixed(5)}` : null;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!key) return;
    const [lat, lng] = key.split(",").map(Number);
    let live = true;
    const t = setTimeout(() => {
      fetch("/api/delivery-quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat, lng }) })
        .then(async (r) => {
          const d = await r.json().catch(() => ({}));
          if (!live) return;
          setResult(r.ok ? { key, quote: d.quote, settings: d.settings, route: d.route ?? null, error: null } : { key, quote: null, settings: null, route: null, error: d.error ?? "Couldn't work out the delivery fee." });
        })
        .catch(() => { if (live) setResult({ key, quote: null, settings: null, route: null, error: "Couldn't reach the server for the delivery fee." }); });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [key]);

  const ready = result && result.key === key;
  return {
    quote: ready ? result.quote : null,
    settings: ready ? result.settings : null,
    route: ready ? result.route : null,
    error: ready ? result.error : null,
    loading: Boolean(key) && !ready,
  };
}
