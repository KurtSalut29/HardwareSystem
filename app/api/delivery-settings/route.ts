import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getDeliverySettings, getStorePin, parseDeliverySettings, saveDeliverySettings } from "@/lib/deliverySettings";

async function role(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  return token ? (await verifyToken(token))?.role ?? null : null;
}

/** Delivery fee settings and the store pin, for the checkout's fee preview. Any signed-in user. */
export async function GET(req: NextRequest) {
  if (!(await role(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [settings, store] = await Promise.all([getDeliverySettings(), getStorePin()]);
  return NextResponse.json({ settings, store });
}

/** Only the admin sets the store's delivery prices. */
export async function PATCH(req: NextRequest) {
  if ((await role(req)) !== "admin") return NextResponse.json({ error: "Only the admin can change delivery fees" }, { status: 403 });
  const parsed = parseDeliverySettings(await req.json());
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  await saveDeliverySettings(parsed.values);
  return NextResponse.json({ settings: await getDeliverySettings() });
}
