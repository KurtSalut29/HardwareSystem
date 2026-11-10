import { haversineKm } from "@/lib/distance";

/**
 * Delivery fee: free up to a set distance from the store, then a rate per km.
 *
 * Distance is measured in a straight line, which is always shorter than the
 * road, so it is multiplied by a road factor (≈1.3 on Biliran's coastal roads)
 * before charging. Islands reached by boat (Maripipi, Higatangan) pay the same
 * distance-based fee plus a boat fee on top. Every number here is set by the
 * admin; nothing is fixed in code.
 *
 * Shared by the checkout (to show the fee) and the orders API (which recomputes
 * it, so the amount saved never comes from the browser).
 */
export type DeliverySettings = {
  /** Kilometres of road delivered free. */
  freeKm: number;
  /** Pesos per kilometre beyond the free distance. */
  ratePerKm: number;
  /** Straight-line km × this ≈ road km. */
  roadFactor: number;
  /** Added to the distance fee for island deliveries reached by boat. */
  islandFee: number;
  /** Farthest road distance the store delivers to; 0 means no limit. */
  maxKm: number;
  /** Deliveries one driver may carry at once; no more are assigned until they finish. */
  driverMaxActive: number;
};

export const DELIVERY_DEFAULTS: DeliverySettings = { freeKm: 3, ratePerKm: 15, roadFactor: 1.3, islandFee: 150, maxKm: 0, driverMaxActive: 1 };

export const DELIVERY_LIMITS: Record<keyof DeliverySettings, { min: number; max: number }> = {
  freeKm: { min: 0, max: 100 },
  ratePerKm: { min: 0, max: 1000 },
  roadFactor: { min: 1, max: 3 },
  islandFee: { min: 0, max: 10000 },
  maxKm: { min: 0, max: 500 },
  driverMaxActive: { min: 1, max: 20 },
};

export const DELIVERY_SETTING_KEYS: Record<keyof DeliverySettings, string> = {
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

export type DeliveryQuote = {
  /** Estimated road distance in km. */
  roadKm: number;
  chargedKm: number;
  /** The distance part of the fee. */
  distanceFee: number;
  /** The boat part, for islands. */
  boatFee: number;
  fee: number;
  island: string | null;
  /** Beyond the store's delivery limit. */
  tooFar: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function quoteDelivery(s: DeliverySettings, store: { lat: number; lng: number }, to: { lat: number; lng: number }): DeliveryQuote {
  const roadKm = round2(haversineKm(store.lat, store.lng, to.lat, to.lng) * s.roadFactor);
  const island = islandAt(to.lat, to.lng);
  const chargedKm = Math.max(0, round2(roadKm - s.freeKm));
  // Whole pesos: a rider quotes "₱210", not "₱209.55".
  const distanceFee = Math.round(chargedKm * s.ratePerKm);
  const boatFee = island ? Math.round(s.islandFee) : 0;
  return {
    roadKm, chargedKm, distanceFee, boatFee, fee: distanceFee + boatFee, island,
    // The limit is about how far a rider drives, so it doesn't stop island trips.
    tooFar: !island && s.maxKm > 0 && roadKm > s.maxKm,
  };
}

export function describeQuote(q: DeliveryQuote, s: DeliverySettings): string {
  const dist = q.distanceFee === 0
    ? `~${q.roadKm.toFixed(1)} km — within the free ${s.freeKm} km`
    : `~${q.roadKm.toFixed(1)} km: first ${s.freeKm} km free, ${q.chargedKm.toFixed(1)} km × ₱${s.ratePerKm}`;
  return q.island ? `${q.island} (island): ${dist} + ₱${q.boatFee} boat fee` : dist;
}
