import { NextRequest, NextResponse } from "next/server";
import { customerLabel } from "@/lib/customer";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getReorderPlan, needsAttention } from "@/lib/inventory";
import type { AppNotification } from "@/lib/notifications";

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far back a customer's order updates are listed. */
const CUSTOMER_WINDOW_DAYS = 14;

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (n: number) => String(Math.round(n * 100) / 100);

// One feed per role, polled by the bell. Drivers have their own live delivery
// alerts (DriverAlertsProvider), so they get an empty list here.
export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (payload.role === "admin" || payload.role === "cashier") {
    const [pending, plan] = await Promise.all([
      prisma.order.findMany({
        where: { status: "pending" },
        orderBy: { dateTime: "desc" },
        select: { id: true, totalAmount: true, dateTime: true, fulfillmentMode: true, customerName: true, customer: { select: { username: true } } },
      }),
      getReorderPlan(),
    ]);

    const orders = pending.map<AppNotification>((o) => ({
      key: `order-${o.id}`,
      type: "new_order",
      title: "New order",
      message: `Order #${o.id} from ${customerLabel(o)} · ${peso(o.totalAmount)} · ${o.fulfillmentMode === "pickup" ? "Pickup" : "Delivery"}`,
      href: "/orders",
      at: o.dateTime.toISOString(),
    }));

    const stock = needsAttention(plan.rows).map<AppNotification>((r) => {
      const out = r.status === "out";
      const order = r.eoq != null ? ` Suggested order (EOQ): ${r.eoq} ${r.unit}.` : "";
      return {
        // The key changes when a product goes from low to out, so that rings again.
        key: `stock-${r.status}-${r.productId}`,
        type: out ? "out_of_stock" : "low_stock",
        title: out ? "Out of stock" : "Reorder now",
        message: out
          ? `${r.name} is out of stock.${order}`
          : `${r.name}: ${qty(r.stock)} ${r.unit} left, at or below its reorder point of ${r.reorderPoint}.${order}`,
        href: "/restocks",
        at: plan.generatedAt,
      };
    });

    return NextResponse.json({ items: [...orders, ...stock] });
  }

  if (payload.role === "customer") {
    const since = new Date(Date.now() - CUSTOMER_WINDOW_DAYS * DAY_MS);
    const orders = await prisma.order.findMany({
      where: { customerId: payload.id, dateTime: { gte: since }, status: { not: "pending" } },
      orderBy: { dateTime: "desc" },
      select: { id: true, status: true, dateTime: true, fulfillmentMode: true, driver: { select: { username: true } } },
    });

    const items = orders.flatMap<AppNotification>((o) => {
      const pickup = o.fulfillmentMode === "pickup";
      const text: Record<string, [string, string]> = {
        confirmed: ["Order confirmed", pickup ? `Order #${o.id} is confirmed and being prepared for pickup.` : `Order #${o.id} is confirmed and being prepared.`],
        out_for_delivery: ["On the way", `Order #${o.id} is out for delivery${o.driver ? ` with ${o.driver.username}` : ""}.`],
        delivered: [pickup ? "Picked up" : "Delivered", pickup ? `Order #${o.id} was picked up. Thank you!` : `Order #${o.id} was delivered. Thank you!`],
        cancelled: ["Order cancelled", `Order #${o.id} was cancelled.`],
      };
      const entry = text[o.status];
      if (!entry) return [];
      // One key per status, so each step of the order rings once.
      return [{ key: `order-${o.id}-${o.status}`, type: "order_update", title: entry[0], message: entry[1], href: "/orders", at: o.dateTime.toISOString() }];
    });

    return NextResponse.json({ items });
  }

  return NextResponse.json({ items: [] });
}
