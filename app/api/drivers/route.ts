import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

async function getPayload(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || (payload.role !== "admin" && payload.role !== "cashier"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const drivers = await prisma.user.findMany({
    where: { role: "driver" },
    select: {
      id: true,
      username: true,
      _count: { select: { driverOrders: { where: { status: "out_for_delivery" } } } },
    },
    orderBy: { username: "asc" },
  });
  return NextResponse.json(drivers.map((d) => ({ id: d.id, username: d.username, activeCount: d._count.driverOrders })));
}
