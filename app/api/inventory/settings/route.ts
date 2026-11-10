import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getEoqSettings, parseEoqSettings, saveEoqSettings } from "@/lib/inventory";

async function getPayload(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  return token ? verifyToken(token) : null;
}

// The numbers EOQ is computed from. Staff can read them (the Restocks page
// explains how each suggestion was reached); only the admin can change them.
export async function GET(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || (payload.role !== "admin" && payload.role !== "cashier")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getEoqSettings());
}

export async function PATCH(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Only the admin can change EOQ settings." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const parsed = parseEoqSettings(body as Record<string, unknown>);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await saveEoqSettings(parsed.values);
  return NextResponse.json(await getEoqSettings());
}
