import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { estimateMinutes, formatDistance, formatDuration } from "@/lib/distance";
import { pinKey, roadDistance } from "@/lib/deliveryQuote";
import { estimateRoadKm } from "@/lib/deliveryFee";
import { getDeliverySettings } from "@/lib/deliverySettings";
import { OPEN_STATUSES, startOfStoreDay } from "@/lib/storeDay";

async function getPayload(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Distances are measured from the store pin the admin saved (the same one the
  // map draws), falling back to the same default the store-location API uses.
  const pinRows = await prisma.setting.findMany({ where: { key: { in: ["store_lat", "store_lng"] } } });
  const pin = (key: string) => {
    const n = parseFloat(pinRows.find((r) => r.key === key)?.value ?? "");
    return Number.isFinite(n) ? n : null;
  };
  const storeLat = pin("store_lat") ?? parseFloat(process.env.STORE_LAT ?? "11.4573");
  const storeLng = pin("store_lng") ?? parseFloat(process.env.STORE_LNG ?? "124.5638");

  const baseWhere = {
    latitude: { not: null },
    longitude: { not: null },
  };

  // Staff see today's board: orders placed today (PH time) plus any still open
  // from earlier days, so the map starts fresh every midnight without losing an
  // unfinished delivery. ?scope=all returns every order (the Orders page uses it
  // when a specific date is picked).
  const allTime = req.nextUrl.searchParams.get("scope") === "all";
  const todays = { OR: [{ dateTime: { gte: startOfStoreDay() } }, { status: { in: [...OPEN_STATUSES] } }] };
  const where =
    payload.role === "customer" ? { ...baseWhere, customerId: payload.id } :
    payload.role === "driver" ? { ...baseWhere, driverId: payload.id } :
    allTime ? baseWhere : { ...baseWhere, ...todays };

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      status: true,
      dateTime: true,
      deliveryAddress: true,
      latitude: true,
      longitude: true,
      driverId: true,
      driverLat: true,
      driverLng: true,
      driverLocationUpdatedAt: true,
      customer: { select: { username: true } },
      driver: { select: { username: true } },
    },
  });

  // Road distance from the store to each drop-off: the saved one (the same
  // number checkout priced the order with), else measured now for a few open
  // orders per request, else the straight-line estimate × road factor.
  const store = { lat: storeLat, lng: storeLng };
  const settings = await getDeliverySettings();
  const storeKey = pinKey(store);
  const toKeys = [...new Set(orders.map((o) => pinKey({ lat: o.latitude!, lng: o.longitude! })))];
  const saved = await prisma.routeDistance.findMany({ where: { fromKey: storeKey, toKey: { in: toKeys } } }).catch(() => []);
  const road = new Map(saved.map((r) => [r.toKey, { km: r.km, minutes: r.minutes }]));
  const missing = orders.filter((o) => !["delivered", "cancelled"].includes(o.status) && !road.has(pinKey({ lat: o.latitude!, lng: o.longitude! }))).slice(0, 4);
  await Promise.all(missing.map(async (o) => {
    const to = { lat: o.latitude!, lng: o.longitude! };
    const r = await roadDistance(store, to);
    if (r) road.set(pinKey(to), { km: r.km, minutes: r.minutes });
  }));

  const result = orders.map((o) => {
    const to = { lat: o.latitude!, lng: o.longitude! };
    const r = road.get(pinKey(to));
    const km = r ? r.km : estimateRoadKm(settings, store, to);
    const minutes = r?.minutes ?? estimateMinutes(km);
    return {
      ...o,
      distanceKm: parseFloat(km.toFixed(2)),
      distanceSource: r ? "road" : "estimate",
      distanceLabel: r ? `${formatDistance(km)} by road` : `~${formatDistance(km)}`,
      durationLabel: formatDuration(minutes),
    };
  });

  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role === "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, deliveryAddress, latitude, longitude } = await req.json();

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const updated = await prisma.order.update({
    where: { id },
    data: {
      ...(deliveryAddress !== undefined && { deliveryAddress }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
    },
  });

  return NextResponse.json(updated);
}
