import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

async function getPayload(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || payload.role !== "driver") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lat, lng } = await req.json();
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const { count } = await prisma.order.updateMany({
    where: { driverId: payload.id, status: "out_for_delivery" },
    data: { driverLat: lat, driverLng: lng, driverLocationUpdatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, activeOrders: count });
}
