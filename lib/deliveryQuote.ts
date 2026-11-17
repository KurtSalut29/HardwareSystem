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
/** The cache key RouteDistance uses for a pin. */
export const pinKey = key;

/** A road path as [lat, lng] points, from the store's road to the drop-off's road. */
export type RoadPath = [number, number][];

/**
 * Road paths drawn on the checkout map. Kept in memory only (they're big and
 * only for display); the distance itself is saved in RouteDistance.
 */
const paths = new Map<string, RoadPath>();
const MAX_PATHS = 300;
function rememberPath(k: string, path: RoadPath) {
  if (paths.size >= MAX_PATHS) paths.delete(paths.keys().next().value as string);
  paths.set(k, path);
}

/** Asks OSRM for the driving route. null when there is no sensible road route. */
async function fetchRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  try {
    const res = await fetch(`${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`, {
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

    const coords: [number, number][] = route.geometry?.coordinates ?? [];
    const r5 = (n: number) => Math.round(n * 1e5) / 1e5;
    const path: RoadPath = coords.map(([lng, lat]) => [r5(lat), r5(lng)]);
    return { km, minutes: Math.round(route.duration / 60), path };
  } catch {
    return null; // offline, timed out, or bad JSON
  }
}

/**
 * The driving distance from one pin to another, and (when asked) the road path
 * to draw it. The saved distance always wins, so the fee shown at checkout is
 * the one the order is saved with.
 */
export async function roadDistance(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  opts: { withPath?: boolean } = {},
): Promise<{ km: number; minutes: number | null; path: RoadPath | null } | null> {
  const fromKey = key(from);
  const toKey = key(to);
  const k = `${fromKey}|${toKey}`;

  const cached = await prisma.routeDistance.findUnique({ where: { fromKey_toKey: { fromKey, toKey } } }).catch(() => null);
  if (cached && (!opts.withPath || paths.has(k))) return { km: cached.km, minutes: cached.minutes, path: paths.get(k) ?? null };

  const fresh = await fetchRoute(from, to);
  if (fresh) rememberPath(k, fresh.path);
  if (cached) return { km: cached.km, minutes: cached.minutes, path: fresh?.path ?? null };
  if (!fresh) return null; // use the estimate

  await prisma.routeDistance
    .upsert({ where: { fromKey_toKey: { fromKey, toKey } }, update: { km: fresh.km, minutes: fresh.minutes }, create: { fromKey, toKey, km: fresh.km, minutes: fresh.minutes } })
    .catch(() => {});
  return { km: fresh.km, minutes: fresh.minutes, path: fresh.path };
}

/** The delivery fee to a pin, with the saved settings and store location. `withPath` also returns the road to draw. */
export async function liveQuote(
  to: { lat: number; lng: number },
  opts: { withPath?: boolean } = {},
): Promise<{ quote: DeliveryQuote; settings: DeliverySettings; store: { lat: number; lng: number }; path: RoadPath | null }> {
  const [settings, store] = await Promise.all([getDeliverySettings(), getStorePin()]);
  const island = islandAt(to.lat, to.lng);
  const road = island ? null : await roadDistance(store, to, opts);
  const quote = road
    ? quoteForDistance(settings, road.km, null, "road", road.minutes)
    : quoteForDistance(settings, estimateRoadKm(settings, store, to), island, "estimate");
  return { quote, settings, store, path: road?.path ?? null };
}
