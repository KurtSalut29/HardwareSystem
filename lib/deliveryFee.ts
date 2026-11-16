import { haversineKm } from "@/lib/distance";

/**
 * Delivery fee = base fee + a rate per km past the distance the base covers,
 * plus a boat fee for islands.
 *
 *   fee = baseFee + max(0, roadKm − freeKm) × ratePerKm  (+ islandFee)
 *
 * roadKm is the real driving distance from the store's pin to the customer's,
 * from the OSRM routing service (see lib/deliveryQuote.ts). When that can't be
 * reached, or for islands that no road goes to (Maripipi, Higatangan), it falls
 * back to the straight-line distance × a road factor (≈1.3 on Biliran's
 * coastal roads). Every number here is set by the admin; nothing is fixed in code.
 *
 * Shared by the checkout (to show the fee) and the orders API (which recomputes
 * it, so the amount saved never comes from the browser).
 */
export type DeliverySettings = {
  /** Charged on every delivery, however close. */
  baseFee: number;
  /** Kilometres of road the base fee already covers. */
  freeKm: number;
  /** Pesos per kilometre beyond the covered distance. */
  ratePerKm: number;
  /** Straight-line km × this ≈ road km, used when the road route isn't available. */
  roadFactor: number;
  /** Added to the distance fee for island deliveries reached by boat. */
  islandFee: number;
  /** Farthest road distance the store delivers to; 0 means no limit. */
  maxKm: number;
  /** Deliveries one driver may carry at once; no more are assigned until they finish. */
  driverMaxActive: number;
};

export const DELIVERY_DEFAULTS: DeliverySettings = {
  baseFee: 50, freeKm: 3, ratePerKm: 15, roadFactor: 1.3, islandFee: 150, maxKm: 0, driverMaxActive: 1,
};

export const DELIVERY_LIMITS: Record<keyof DeliverySettings, { min: number; max: number }> = {
  baseFee: { min: 0, max: 5000 },
  freeKm: { min: 0, max: 100 },
  ratePerKm: { min: 0, max: 1000 },
  roadFactor: { min: 1, max: 3 },
  islandFee: { min: 0, max: 10000 },
  maxKm: { min: 0, max: 500 },
  driverMaxActive: { min: 1, max: 20 },
};

export const DELIVERY_SETTING_KEYS: Record<keyof DeliverySettings, string> = {
  baseFee: "delivery_base_fee",
  freeKm: "delivery_free_km",
  ratePerKm: "delivery_rate_per_km",
  roadFactor: "delivery_road_factor",
  islandFee: "delivery_island_fee",
  maxKm: "delivery_max_km",
  driverMaxActive: "driver_max_active",
};

/** Islands off Biliran that are reached by boat, as rough boxes around their barangays. */
const ISLANDS: { name: string; test: (lat: number, lng: number) => boolean }[] = [
  { name: "Maripipi", test: (lat, lng) => lat >= 11.745 && lng <= 124.355 },
  { name: "Higatangan", test: (lat, lng) => lat >= 11.53 && lat <= 11.6 && lng <= 124.3 },
];

export function islandAt(lat: number, lng: number): string | null {
  return ISLANDS.find((i) => i.test(lat, lng))?.name ?? null;
}

/** Where the distance came from: the road route, or the straight-line estimate. */
export type DistanceSource = "road" | "estimate";

export type DeliveryQuote = {
  /** Road distance in km (measured, or estimated when source is "estimate"). */
  roadKm: number;
  source: DistanceSource;
  /** Driving time from the routing service, when known. */
  minutes: number | null;
  baseFee: number;
  /** Km charged at the per-km rate (past the distance the base fee covers). */
  chargedKm: number;
  /** The per-km part of the fee. */
  distanceFee: number;
  /** The boat part, for islands. */
  boatFee: number;
  fee: number;
  island: string | null;
  /** Beyond the store's delivery limit. */
  tooFar: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Straight-line distance × road factor: the fallback when no road route is available. */
export function estimateRoadKm(s: DeliverySettings, store: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  return round2(haversineKm(store.lat, store.lng, to.lat, to.lng) * s.roadFactor);
}

/** The fee for a known road distance. */
export function quoteForDistance(
  s: DeliverySettings,
  roadKm: number,
  island: string | null,
  source: DistanceSource,
  minutes: number | null = null,
): DeliveryQuote {
  const km = round2(roadKm);
  const chargedKm = Math.max(0, round2(km - s.freeKm));
  // Whole pesos: a rider quotes "₱210", not "₱209.55".
  const baseFee = Math.round(s.baseFee);
  const distanceFee = Math.round(chargedKm * s.ratePerKm);
  const boatFee = island ? Math.round(s.islandFee) : 0;
  return {
    roadKm: km, source, minutes, baseFee, chargedKm, distanceFee, boatFee,
    fee: baseFee + distanceFee + boatFee,
    island,
    // The limit is about how far a rider drives, so it doesn't stop island trips.
    tooFar: !island && s.maxKm > 0 && km > s.maxKm,
  };
}

/** Estimated quote without the routing service (used for previews and as a fallback). */
export function quoteDelivery(s: DeliverySettings, store: { lat: number; lng: number }, to: { lat: number; lng: number }): DeliveryQuote {
  return quoteForDistance(s, estimateRoadKm(s, store, to), islandAt(to.lat, to.lng), "estimate");
}

/** One line explaining the fee to the customer. */
export function describeQuote(q: DeliveryQuote, s: Pick<DeliverySettings, "freeKm" | "ratePerKm">): string {
  const dist = `${q.source === "road" ? "" : "~"}${q.roadKm.toFixed(1)} km${q.source === "road" ? " by road" : ""}`;
  const parts = [`₱${q.baseFee} base fee${s.freeKm > 0 ? ` (first ${s.freeKm} km)` : ""}`];
  if (q.distanceFee > 0) parts.push(`${q.chargedKm.toFixed(1)} km × ₱${s.ratePerKm}`);
  if (q.boatFee > 0) parts.push(`₱${q.boatFee} boat fee`);
  return `${q.island ? `${q.island} (island) · ` : ""}${dist}: ${parts.join(" + ")}`;
}
