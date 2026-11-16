import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/distance";
import { estimateRoadKm, islandAt, quoteForDistance, type DeliveryQuote, type DeliverySettings } from "@/lib/deliveryFee";
import { getDeliverySettings, getStorePin } from "@/lib/deliverySettings";

/**
 * Server-side delivery quotes from the real road distance.
 *
 * The distance comes from OSRM (router.project-osrm.org: free, no API key,
 * OpenStreetMap roads), the same service the driver's turn-by-turn navigation
 * uses. Each store→drop-off distance is saved in RouteDistance, so checkout and
 * the order that follows see the same number, and the service isn't asked twice.
 *
 * Falls back to the straight-line estimate when:
 *  - the drop-off is on an island (no road goes there; a boat fee is added instead),
 *  - the pin is far from any mapped road (the route would be meaningless),
 *  - the service is slow, down, or the answer doesn't make sense.
 */

const OSRM = "https://router.project-osrm.org/route/v1/driving";
const TIMEOUT_MS = 6000;
/** A pin farther than this from a mapped road can't be routed reliably. */
const MAX_SNAP_M = 1500;

/** ~10 m precision, so pins a few steps apart share one lookup. */
const key = (p: { lat: number; lng: number }) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;

export async function roadDistance(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<{ km: number; minutes: number | null } | null> {
  const fromKey = key(from);
  const toKey = key(to);

  const cached = await prisma.routeDistance.findUnique({ where: { fromKey_toKey: { fromKey, toKey } } }).catch(() => null);
  if (cached) return { km: cached.km, minutes: cached.minutes };

  try {
    const res = await fetch(`${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "RM-Hardware/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (data?.code !== "Ok" || !route) return null;
    const snaps: number[] = (data.waypoints ?? []).map((w: { distance?: number }) => w.distance ?? 0);
    if (snaps.some((d) => d > MAX_SNAP_M)) return null;

    const km = Math.round((route.distance / 1000) * 100) / 100;
    // A road is never shorter than the straight line, and on Biliran rarely more
    // than ~3× it. Outside that, the route went somewhere odd (e.g. a ferry).
    const straight = haversineKm(from.lat, from.lng, to.lat, to.lng);
    if (km < straight * 0.95 || (straight > 0.5 && km > straight * 3)) return null;

    const minutes = Math.round(route.duration / 60);
    await prisma.routeDistance
      .upsert({ where: { fromKey_toKey: { fromKey, toKey } }, update: { km, minutes }, create: { fromKey, toKey, km, minutes } })
      .catch(() => {});
    return { km, minutes };
  } catch {
    return null; // offline, timed out, or bad JSON: use the estimate
  }
}

/** The delivery fee to a pin, with the saved settings and store location. */
export async function liveQuote(to: { lat: number; lng: number }): Promise<{ quote: DeliveryQuote; settings: DeliverySettings; store: { lat: number; lng: number } }> {
  const [settings, store] = await Promise.all([getDeliverySettings(), getStorePin()]);
  const island = islandAt(to.lat, to.lng);
  const road = island ? null : await roadDistance(store, to);
  const quote = road
    ? quoteForDistance(settings, road.km, null, "road", road.minutes)
    : quoteForDistance(settings, estimateRoadKm(settings, store, to), island, "estimate");
  return { quote, settings, store };
}
