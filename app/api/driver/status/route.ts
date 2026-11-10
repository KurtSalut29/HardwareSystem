import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDeliverySettings } from "@/lib/deliverySettings";
import { driverAvailability } from "@/lib/driverStatus";

async function driver(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  return payload?.role === "driver" ? payload : null;
}

async function statusOf(id: number) {
  const [user, active, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { onDuty: true } }),
    prisma.order.count({ where: { driverId: id, status: "out_for_delivery" } }),
    getDeliverySettings(),
  ]);
  const onDuty = user?.onDuty ?? true;
  return { onDuty, active, maxActive: settings.driverMaxActive, availability: driverAvailability(onDuty, active, settings.driverMaxActive) };
}

/** The signed-in driver's own status. */
export async function GET(req: NextRequest) {
  const payload = await driver(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await statusOf(payload.id));
}

/** A driver goes on or off duty. Off duty stops new assignments; deliveries on hand stay theirs. */
export async function PATCH(req: NextRequest) {
  const payload = await driver(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { onDuty } = await req.json();
  if (typeof onDuty !== "boolean") return NextResponse.json({ error: "onDuty must be true or false" }, { status: 400 });
  await prisma.user.update({ where: { id: payload.id }, data: { onDuty } });
  return NextResponse.json(await statusOf(payload.id));
}
