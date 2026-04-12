import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULTS = { lat: 11.4573, lng: 124.5638, name: "Hardware Store" };

async function getSetting(key: string) {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function GET() {
  const [lat, lng, name] = await Promise.all([
    getSetting("store_lat"),
    getSetting("store_lng"),
    getSetting("store_name"),
  ]);
  return NextResponse.json({
    lat: lat ? parseFloat(lat) : DEFAULTS.lat,
    lng: lng ? parseFloat(lng) : DEFAULTS.lng,
    name: name ?? DEFAULTS.name,
  });
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { lat, lng, name } = await req.json();
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  await Promise.all([
    prisma.setting.upsert({ where: { key: "store_lat" }, update: { value: String(lat) }, create: { key: "store_lat", value: String(lat) } }),
    prisma.setting.upsert({ where: { key: "store_lng" }, update: { value: String(lng) }, create: { key: "store_lng", value: String(lng) } }),
    ...(name ? [prisma.setting.upsert({ where: { key: "store_name" }, update: { value: name }, create: { key: "store_name", value: name } })] : []),
  ]);

  return NextResponse.json({ lat, lng, name: name ?? DEFAULTS.name });
}
