import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { liveQuote } from "@/lib/deliveryQuote";
import { checkDriverForNewDelivery } from "@/lib/driverAssign";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A pickup order the customer now wants delivered. Staff pin the drop-off, the
 * delivery fee is added to the order like at checkout, and they may hand it to a
 * driver at the same time (only once the order is confirmed).
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload || (payload.role !== "admin" && payload.role !== "cashier")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, deliveryAddress, latitude, longitude, driverId: rawDriverId } = await req.json();
  const existing = await prisma.order.findUnique({ where: { id: Number(id) } });
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (existing.fulfillmentMode !== "pickup") return NextResponse.json({ error: "This order is already for delivery" }, { status: 400 });
  if (existing.transactionId || (existing.status !== "pending" && existing.status !== "confirmed")) {
    return NextResponse.json({ error: "Only an order that hasn't been picked up or cancelled can switch to delivery" }, { status: 400 });
  }
  const lat = Number(latitude), lng = Number(longitude);
  if (latitude == null || longitude == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Pin the delivery location on the map" }, { status: 400 });
  }

  const { quote, settings } = await liveQuote({ lat, lng });
  if (quote.tooFar) {
    return NextResponse.json({ error: `That's about ${quote.roadKm.toFixed(0)} km away — beyond the ${settings.maxKm} km delivery area.` }, { status: 400 });
  }

  let driverId: number | null = null;
  if (rawDriverId != null && rawDriverId !== "") {
    if (existing.status !== "confirmed") return NextResponse.json({ error: "Confirm the order before assigning a driver" }, { status: 400 });
    const check = await checkDriverForNewDelivery(rawDriverId);
    if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
    driverId = check.id;
  }

  const totalAmount = round2(existing.totalAmount - existing.deliveryFee + quote.fee);
  const order = await prisma.order.update({
    where: { id: existing.id },
    data: {
      fulfillmentMode: "delivery",
      deliveryAddress: String(deliveryAddress ?? "").trim() || null,
      latitude: lat,
      longitude: lng,
      deliveryFee: quote.fee,
      totalAmount,
      handledById: payload.id,
      ...(driverId ? { driverId, assignedAt: new Date(), status: "out_for_delivery" } : {}),
    },
    include: { driver: { select: { username: true } } },
  });
  return NextResponse.json(order);
}
