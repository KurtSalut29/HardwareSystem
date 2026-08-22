import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const KEYS = { name: "gcash_name", number: "gcash_number", qr: "gcash_qr" } as const;

// GCash numbers in PH are the account's mobile number: 11 digits starting with 09.
const GCASH_NUMBER_RE = /^09\d{9}$/;

export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  const get = (key: string) => rows.find((r) => r.key === key)?.value ?? null;

  return NextResponse.json({
    gcashName: get(KEYS.name),
    gcashNumber: get(KEYS.number),
    gcashQr: get(KEYS.qr),
  });
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { gcashName, gcashNumber, gcashQr } = await req.json();

  if (gcashNumber != null && gcashNumber !== "" && !GCASH_NUMBER_RE.test(String(gcashNumber))) {
    return NextResponse.json({ error: "GCash number must be 11 digits starting with 09." }, { status: 400 });
  }
  // Only accept paths produced by our own upload route — never an arbitrary URL.
  if (gcashQr != null && gcashQr !== "" && !String(gcashQr).startsWith("/uploads/")) {
    return NextResponse.json({ error: "Invalid QR image." }, { status: 400 });
  }

  const upsert = (key: string, value: string) =>
    prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });

  await Promise.all([
    ...(gcashName != null ? [upsert(KEYS.name, String(gcashName))] : []),
    ...(gcashNumber != null ? [upsert(KEYS.number, String(gcashNumber))] : []),
    ...(gcashQr != null ? [upsert(KEYS.qr, String(gcashQr))] : []),
  ]);

  return NextResponse.json({ gcashName, gcashNumber, gcashQr });
}
