import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

/**
 * Small numbers for the sidebar, so people see work waiting without opening the page:
 *  - staff/admin, Orders: new orders to confirm + delivery orders still waiting for a driver
 *  - customer, My Orders: their orders still in progress
 *  - driver, My Deliveries: deliveries on hand
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (payload.role === "admin" || payload.role === "cashier") {
    const [pending, needsDriver, toCheck, toRefund] = await Promise.all([
      prisma.order.count({ where: { status: "pending" } }),
      prisma.order.count({ where: { status: "confirmed", fulfillmentMode: { not: "pickup" }, driverId: null } }),
      prisma.payment.count({ where: { kind: "payment", status: "pending" } }),
      prisma.payment.count({ where: { kind: "refund", status: "pending" } }),
    ]);
    return NextResponse.json({
      "/orders": {
        count: pending + needsDriver + toCheck + toRefund,
        detail: [
          pending ? `${pending} new to confirm` : "",
          needsDriver ? `${needsDriver} waiting for a driver` : "",
          toCheck ? `${toCheck} GCash ${toCheck === 1 ? "receipt" : "receipts"} to check` : "",
          toRefund ? `${toRefund} ${toRefund === 1 ? "refund" : "refunds"} to send` : "",
        ].filter(Boolean).join(", "),
      },
    });
  }
  if (payload.role === "customer") {
    const [active, owing] = await Promise.all([
      prisma.order.count({ where: { customerId: payload.id, status: { in: ["pending", "confirmed", "out_for_delivery"] } } }),
      prisma.order.findMany({ where: { customerId: payload.id, status: { in: ["pending", "confirmed", "out_for_delivery"] }, paymentDueAt: { not: null } }, select: { totalAmount: true, amountPaid: true } }),
    ]);
    const toPay = owing.filter((o) => o.totalAmount - o.amountPaid > 0.005).length;
    return NextResponse.json({
      "/orders": { count: active, detail: active ? `${active} in progress` : "" },
      "/my-transactions": { count: toPay, detail: toPay ? `${toPay} with a balance to pay` : "" },
    });
  }
  if (payload.role === "driver") {
    const onHand = await prisma.order.count({ where: { driverId: payload.id, status: "out_for_delivery" } });
    return NextResponse.json({ "/deliveries": { count: onHand, detail: onHand ? `${onHand} to deliver` : "" } });
  }
  return NextResponse.json({});
}
