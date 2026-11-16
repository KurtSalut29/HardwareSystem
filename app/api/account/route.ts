import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { isWithinBiliran } from "@/lib/biliran";

async function me(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  return token ? await verifyToken(token) : null;
}

/** The signed-in person's own details, including their default delivery location. */
export async function GET(req: NextRequest) {
  const payload = await me(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: {
      username: true, email: true, contact: true, firstName: true, middleName: true, lastName: true, suffix: true,
      defaultAddress: true, defaultLat: true, defaultLng: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

/** A customer changes their default delivery location (e.g. from checkout). */
export async function PATCH(req: NextRequest) {
  const payload = await me(req);
  if (!payload || payload.role !== "customer") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const lat = Number(body.defaultLat);
  const lng = Number(body.defaultLng);
  const address = String(body.defaultAddress ?? "").trim().slice(0, 300);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !address) return NextResponse.json({ error: "Pin a location on the map" }, { status: 400 });
  if (!isWithinBiliran(lat, lng)) return NextResponse.json({ error: "Pin a location inside Biliran" }, { status: 400 });
  const user = await prisma.user.update({
    where: { id: payload.id },
    data: { defaultAddress: address, defaultLat: lat, defaultLng: lng },
    select: { defaultAddress: true, defaultLat: true, defaultLng: true },
  });
  return NextResponse.json(user);
}
