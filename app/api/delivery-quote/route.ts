import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { isWithinBiliran } from "@/lib/biliran";
import { liveQuote } from "@/lib/deliveryQuote";

/**
 * The delivery fee to a map pin, from the real road distance. Used by the
 * checkout, the staff "New order" form and the Delivery settings preview. The
 * orders API computes the same quote again when the order is saved.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  if (!isWithinBiliran(lat, lng)) return NextResponse.json({ error: "That pin is outside Biliran" }, { status: 400 });

  const { quote, settings } = await liveQuote({ lat, lng });
  return NextResponse.json({ quote, settings: { baseFee: settings.baseFee, freeKm: settings.freeKm, ratePerKm: settings.ratePerKm, maxKm: settings.maxKm } });
}
