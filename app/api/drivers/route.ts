import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { customerLabel } from "@/lib/customer";
import { getDeliverySettings } from "@/lib/deliverySettings";
import { driverAvailability } from "@/lib/driverStatus";

async function getPayload(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Every driver with what they're doing right now: the orders they have on the
 * road, their last GPS position (sent while delivering, stored on the order),
 * and how many deliveries they finished today.
 */
export async function GET(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || (payload.role !== "admin" && payload.role !== "cashier"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [drivers, deliveredToday, lastFixes, settings] = await Promise.all([
    prisma.user.findMany({
      where: { role: "driver" },
      select: {
        id: true,
        username: true,
        contact: true,
        onDuty: true,
        driverOrders: {
          where: { status: "out_for_delivery" },
          select: { id: true, deliveryAddress: true, assignedAt: true, customerName: true, customer: { select: { username: true } } },
          orderBy: { assignedAt: "asc" },
        },
      },
      orderBy: { username: "asc" },
    }),
    // Finished today = delivered orders whose sale was recorded today.
    prisma.order.groupBy({
      by: ["driverId"],
      where: { status: "delivered", driverId: { not: null }, transaction: { dateTime: { gte: startOfToday } } },
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: { driverId: { not: null }, driverLocationUpdatedAt: { not: null }, driverLat: { not: null }, driverLng: { not: null } },
      select: { driverId: true, driverLat: true, driverLng: true, driverLocationUpdatedAt: true },
      orderBy: { driverLocationUpdatedAt: "desc" },
      distinct: ["driverId"],
    }),
    getDeliverySettings(),
  ]);

  return NextResponse.json(drivers.map((d) => {
    const fix = lastFixes.find((f) => f.driverId === d.id);
    return {
      id: d.id,
      username: d.username,
      contact: d.contact,
      activeCount: d.driverOrders.length,
      onDuty: d.onDuty,
      maxActive: settings.driverMaxActive,
      availability: driverAvailability(d.onDuty, d.driverOrders.length, settings.driverMaxActive),
      activeOrders: d.driverOrders.map((o) => ({
        id: o.id,
        customer: customerLabel(o),
        address: o.deliveryAddress,
        assignedAt: o.assignedAt,
      })),
      deliveredToday: deliveredToday.find((g) => g.driverId === d.id)?._count._all ?? 0,
      lastLocation: fix ? { lat: fix.driverLat!, lng: fix.driverLng!, updatedAt: fix.driverLocationUpdatedAt! } : null,
    };
  }));
}
