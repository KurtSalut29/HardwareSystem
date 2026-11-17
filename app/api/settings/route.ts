import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getSettings, parseSettingsUpdate, publicView, saveSettings } from "@/lib/settings";

async function who(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  return token ? await verifyToken(token) : null;
}

/**
 * Store settings. Everyone gets the public ones (store details, GCash details,
 * payment and cancellation rules shown at checkout); the admin gets them all.
 */
export async function GET(req: NextRequest) {
  const payload = await who(req);
  const s = await getSettings();
  return NextResponse.json(payload?.role === "admin" ? s : publicView(s));
}

/** Admin: change any number of settings at once. Applies immediately. */
export async function PATCH(req: NextRequest) {
  const payload = await who(req);
  if (!payload || payload.role !== "admin") return NextResponse.json({ error: "Only the admin can change store settings." }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  const parsed = parseSettingsUpdate(body as Record<string, unknown>);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.rows.length === 0) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  await saveSettings(parsed.rows);
  return NextResponse.json(await getSettings());
}
