/**
 * The store's day runs on Philippine time (UTC+8, no daylight saving), whatever
 * timezone the server is in (Vercel runs in UTC). Used for "today" views that
 * reset at midnight, like the staff delivery map.
 */
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Midnight today in the Philippines, as a Date. */
export function startOfStoreDay(now = new Date()): Date {
  const ph = new Date(now.getTime() + PH_OFFSET_MS);
  ph.setUTCHours(0, 0, 0, 0);
  return new Date(ph.getTime() - PH_OFFSET_MS);
}

/** Orders that still need someone to act: they stay on today's map until they're done. */
export const OPEN_STATUSES = ["pending", "confirmed", "out_for_delivery"] as const;

/** True for an order placed today (PH time) or still open from an earlier day. */
export function onTodaysBoard(o: { status: string; dateTime: string | Date }, now = new Date()): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(o.status) || new Date(o.dateTime) >= startOfStoreDay(now);
}
