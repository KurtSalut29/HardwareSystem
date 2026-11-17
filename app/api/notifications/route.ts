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
const day = (d: Date) => d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });

// One feed per role, polled by the bell. Drivers have their own live delivery
// alerts (DriverAlertsProvider), so they get an empty list here.
export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (payload.role === "admin" || payload.role === "cashier") {
    const [pending, plan, registrations, toReview, toRefund, overdue] = await Promise.all([
      prisma.order.findMany({
        where: { status: "pending" },
        orderBy: { dateTime: "desc" },
        select: { id: true, totalAmount: true, dateTime: true, fulfillmentMode: true, customerName: true, customer: { select: { username: true } } },
      }),
      getReorderPlan(),
      // New customers waiting for approval. Only the admin approves them.
      payload.role === "admin"
        ? prisma.user.findMany({
            where: { role: "customer", accountStatus: "pending" },
            orderBy: { createdAt: "desc" },
            select: { id: true, username: true, email: true, createdAt: true },
          })
        : Promise.resolve([]),
      prisma.payment.findMany({
        where: { kind: "payment", status: "pending" },
        orderBy: { createdAt: "desc" },
        include: { order: { select: { id: true, customerName: true, customer: { select: { username: true } } } } },
      }),
      prisma.payment.findMany({
        where: { kind: "refund", status: "pending" },
        orderBy: { createdAt: "desc" },
        include: { order: { select: { id: true, customerName: true, customer: { select: { username: true } } } } },
      }),
      prisma.order.findMany({
        where: { paymentDueAt: { lt: new Date() }, status: { notIn: ["cancelled", "delivered"] } },
        select: { id: true, totalAmount: true, amountPaid: true, paymentDueAt: true, customerName: true, customer: { select: { username: true } } },
      }),
    ]);

    const money: AppNotification[] = [
      ...toReview.map<AppNotification>((p) => ({
        key: `pay-${p.id}`,
        type: "payment_review",
        title: "GCash receipt to check",
        message: `Order #${p.order.id} · ${peso(p.amount)} from ${customerLabel(p.order)}${p.reference ? ` · Ref ${p.reference}` : ""}. Approve it so the order can move.`,
        href: "/orders?view=payments",
        at: p.createdAt.toISOString(),
      })),
      ...toRefund.map<AppNotification>((p) => ({
        key: `refund-${p.id}`,
        type: "refund_due",
        title: "Refund to send",
        message: `${peso(p.amount)} to ${customerLabel(p.order)} for cancelled Order #${p.order.id}${p.method === "GCash" && p.accountNumber ? ` · GCash ${p.accountNumber}` : ""}.`,
        href: "/orders?view=refunds",
        at: p.createdAt.toISOString(),
      })),
      ...overdue.filter((o) => o.totalAmount - o.amountPaid > 0.005).map<AppNotification>((o) => ({
        key: `overdue-${o.id}-${o.paymentDueAt!.toISOString().slice(0, 10)}`,
        type: "balance_overdue",
        title: "Balance overdue",
        message: `Order #${o.id} · ${customerLabel(o)} still owes ${peso(o.totalAmount - o.amountPaid)} (was due ${day(o.paymentDueAt!)}). Remind them, or decide whether to hold the order.`,
        href: "/orders",
        at: o.paymentDueAt!.toISOString(),
      })),
    ];

    const signups = registrations.map<AppNotification>((u) => ({
      key: `signup-${u.id}`,
      type: "new_customer",
      title: "New customer to approve",
      message: `${u.username}${u.email ? ` · ${u.email}` : ""} registered and is waiting for approval.`,
      href: "/users?tab=pending",
      at: u.createdAt.toISOString(),
    }));

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

    return NextResponse.json({ items: [...money, ...signups, ...orders, ...stock] });
  }

  if (payload.role === "customer") {
    const since = new Date(Date.now() - CUSTOMER_WINDOW_DAYS * DAY_MS);
    const [orders, payments, owing] = await Promise.all([
      prisma.order.findMany({
        where: { customerId: payload.id, dateTime: { gte: since }, status: { not: "pending" } },
        orderBy: { dateTime: "desc" },
        select: { id: true, status: true, dateTime: true, fulfillmentMode: true, cancelledBy: true, cancelReason: true, driver: { select: { username: true } } },
      }),
      prisma.payment.findMany({
        where: { order: { customerId: payload.id }, OR: [{ reviewedAt: { gte: since } }, { kind: "refund", createdAt: { gte: since } }] },
        orderBy: { createdAt: "desc" },
        select: { id: true, kind: true, status: true, amount: true, amountReceived: true, method: true, note: true, accountNumber: true, reference: true, orderId: true, createdAt: true, reviewedAt: true },
      }),
      prisma.order.findMany({
        where: { customerId: payload.id, paymentDueAt: { not: null }, status: { notIn: ["cancelled", "delivered"] } },
        select: { id: true, totalAmount: true, amountPaid: true, paymentDueAt: true },
      }),
    ]);

    const money: AppNotification[] = [];
    for (const p of payments) {
      const at = (p.reviewedAt ?? p.createdAt).toISOString();
      if (p.kind === "payment" && p.status === "approved" && p.reviewedAt) {
        money.push({ key: `pay-${p.id}-approved`, type: "payment_update", title: "Payment received", message: `The store confirmed ${peso(p.amountReceived ?? p.amount)} for Order #${p.orderId}.`, href: "/orders", at });
      } else if (p.kind === "payment" && p.status === "rejected") {
        money.push({ key: `pay-${p.id}-rejected`, type: "payment_problem", title: "Payment not accepted", message: `Order #${p.orderId}: ${p.note ?? "the store couldn't match your GCash payment"}. Check your receipt and send it again from My Orders.`, href: "/orders", at });
      } else if (p.kind === "refund" && p.status === "pending") {
        money.push({ key: `refund-${p.id}-pending`, type: "payment_update", title: "Refund on the way", message: `The store will send your ${peso(p.amount)} refund for Order #${p.orderId}${p.method === "GCash" && p.accountNumber ? ` to ${p.accountNumber}` : ""}. You'll get another notice once it's sent.`, href: "/my-transactions", at });
      } else if (p.kind === "refund" && p.status === "sent") {
        money.push({ key: `refund-${p.id}-sent`, type: "refund_sent", title: "Refund sent", message: `${peso(p.amount)} for Order #${p.orderId} was sent${p.method === "GCash" ? ` by GCash${p.reference ? ` (Ref ${p.reference})` : ""}` : " in cash"}.`, href: "/my-transactions", at });
      }
    }
    for (const o of owing) {
      const left = o.totalAmount - o.amountPaid;
      if (left <= 0.005 || !o.paymentDueAt) continue;
      const late = o.paymentDueAt < new Date();
      money.push({
        key: `due-${o.id}-${late ? "late" : o.paymentDueAt.toISOString().slice(0, 10)}`,
        type: "balance_due",
        title: late ? "Balance overdue" : "Balance to pay",
        message: late
          ? `Order #${o.id} still has ${peso(left)} unpaid (due ${day(o.paymentDueAt)}). Please pay it now from My Orders, or call the store.`
          : `Order #${o.id} has ${peso(left)} left to pay by ${day(o.paymentDueAt)}. Pay it by GCash from My Orders.`,
        href: "/orders",
        at: o.paymentDueAt.toISOString(),
      });
    }

    const items = orders.flatMap<AppNotification>((o) => {
      const pickup = o.fulfillmentMode === "pickup";
      const text: Record<string, [string, string]> = {
        confirmed: ["Order confirmed", pickup ? `Order #${o.id} is confirmed and being prepared for pickup.` : `Order #${o.id} is confirmed and being prepared.`],
        out_for_delivery: ["On the way", `Order #${o.id} is out for delivery${o.driver ? ` with ${o.driver.username}` : ""}.`],
        delivered: [pickup ? "Picked up" : "Delivered", pickup ? `Order #${o.id} was picked up. Thank you!` : `Order #${o.id} was delivered. Thank you!`],
        cancelled: ["Order cancelled", o.cancelledBy === "store" ? `The store cancelled Order #${o.id}${o.cancelReason ? `: ${o.cancelReason}` : "."} Anything you paid will be refunded.` : `Order #${o.id} was cancelled.`],
      };
      const entry = text[o.status];
      if (!entry) return [];
      // One key per status, so each step of the order rings once.
      return [{ key: `order-${o.id}-${o.status}`, type: "order_update", title: entry[0], message: entry[1], href: "/orders", at: o.dateTime.toISOString() }];
    });

    return NextResponse.json({ items: [...money, ...items] });
  }

  return NextResponse.json({ items: [] });
}
