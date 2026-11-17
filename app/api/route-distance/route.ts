import { NextRequest, NextResponse } from "next/server";
import { isWithinBiliran } from "@/lib/biliran";
import { roadDistance } from "@/lib/deliveryQuote";
import { estimateRoadKm, islandAt } from "@/lib/deliveryFee";
import { getDeliverySettings, getStorePin } from "@/lib/deliverySettings";

/**
 * How far a map pin is from the store, by road, with the road to draw. Used by
 * every location map (sign-up, saved addresses, staff order forms) so people
 * always see the distance to the store. No fee here: prices come from
 * /api/delivery-quote for signed-in users.
 *
 * Open to visitors (the sign-up form has a map), so each address is limited to
 * a few lookups a minute. Results are cached in RouteDistance anyway.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, { n: number; reset: number }>();

function limited(ip: string) {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  const h = hits.get(ip);
  if (!h || h.reset < now) { hits.set(ip, { n: 1, reset: now + WINDOW_MS }); return false; }
  h.n += 1;
  return h.n > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many distance checks. Wait a minute and try again." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  if (!isWithinBiliran(lat, lng)) return NextResponse.json({ error: "That pin is outside Biliran" }, { status: 400 });

  const [settings, store] = await Promise.all([getDeliverySettings(), getStorePin()]);
  const to = { lat, lng };
  const island = islandAt(lat, lng);
  const road = island ? null : await roadDistance(store, to, { withPath: true });

  return NextResponse.json(road
    ? { km: road.km, minutes: road.minutes, source: "road", island: null, path: road.path, store }
    : { km: estimateRoadKm(settings, store, to), minutes: null, source: "estimate", island, path: null, store });
}
