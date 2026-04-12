import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { haversineKm, estimateMinutes, formatDistance, formatDuration } from "@/lib/distance";

async function getPayload(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeLat = parseFloat(process.env.STORE_LAT ?? "11.4573");
  const storeLng = parseFloat(process.env.STORE_LNG ?? "124.5638");

  const baseWhere = {
    latitude: { not: null },
    longitude: { not: null },
  };

  const where =
    payload.role === "customer"
      ? { ...baseWhere, customerId: payload.id }
      : baseWhere;

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      status: true,
      deliveryAddress: true,
      latitude: true,
      longitude: true,
      customer: { select: { username: true } },
    },
  });

  const result = orders.map((o) => {
    const distKm = haversineKm(storeLat, storeLng, o.latitude!, o.longitude!);
    const minutes = estimateMinutes(distKm);
    return {
      ...o,
      distanceKm: parseFloat(distKm.toFixed(2)),
      distanceLabel: formatDistance(distKm),
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
