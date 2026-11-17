import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { cancelOrder, customerMayCancel, quoteCancellation } from "@/lib/payments";

async function who(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  return token ? await verifyToken(token) : null;
}

/** GET ?id= — what cancelling would mean right now: allowed?, refund, fee. Shown before confirming. */
export async function GET(req: NextRequest) {
  const payload = await who(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  const order = await prisma.order.findUnique({ where: { id }, include: { payments: true } });
  const staff = payload.role === "admin" || payload.role === "cashier";
  if (!order || (!staff && order.customerId !== payload.id)) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const s = await getSettings();
  const by = staff ? "store" : "customer";
  const closed = order.status === "cancelled" || order.status === "delivered" || !!order.transactionId;
  const allowed = !closed && (staff || customerMayCancel(order.status, s));
  const reason = closed ? "This order is already finished or cancelled."
    : allowed ? null
    : order.status === "out_for_delivery" ? "Your order is already on the way. Call the store if you need to stop it."
    : "The store is already preparing your order. Call the store if you need to cancel it.";
  return NextResponse.json({ allowed, reason, by, ...quoteCancellation(order, by, s), policy: s.refundPolicy });
}

/** POST { id, reason } — cancel the order and open a refund for what was paid. */
export async function POST(req: NextRequest) {
  const payload = await who(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const staff = payload.role === "admin" || payload.role === "cashier";
  if (!staff && payload.role !== "customer") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const order = await prisma.order.findUnique({ where: { id: Number(body.id) } });
  if (!order || (!staff && order.customerId !== payload.id)) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const s = await getSettings();
  if (!staff && !customerMayCancel(order.status, s)) {
    return NextResponse.json({ error: order.status === "out_for_delivery"
      ? "Your order is already on the way. Call the store if you need to stop it."
      : "This order can no longer be cancelled here. Call the store." }, { status: 400 });
  }
  const reason = String(body.reason ?? "").trim();
  if (staff && !reason) return NextResponse.json({ error: "Tell the customer why the store is cancelling (e.g. out of stock)." }, { status: 400 });
  try {
    const { quote, refund } = await cancelOrder(order.id, staff ? "store" : "customer", reason || "Cancelled by the customer", payload.id, s);
    return NextResponse.json({ ok: true, ...quote, refundId: refund?.id ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't cancel the order." }, { status: 400 });
  }
}
