import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { customerLabel } from "@/lib/customer";
import { getSettings } from "@/lib/settings";
import { GCASH_NUMBER_RE, GCASH_REFERENCE_RE, referenceTaken, refundLateApproval, syncOrderPaid } from "@/lib/payments";
import { sendPaymentApproved, sendPaymentRejected, sendRefundSent } from "@/lib/mailer";

const round2 = (n: number) => Math.round(n * 100) / 100;
const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function who(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  return token ? await verifyToken(token) : null;
}
const isStaffRole = (r: string) => r === "admin" || r === "cashier";

const ORDER_SELECT = {
  id: true, status: true, totalAmount: true, amountPaid: true, paymentMethod: true, fulfillmentMode: true, dateTime: true,
  paymentDueAt: true, customerId: true, customerName: true, customerContact: true,
  customer: { select: { username: true, contact: true, email: true, emailUpdates: true, firstName: true } },
} as const;

/**
 * Payments and refunds.
 *  - Staff: ?scope=review (receipts to check), ?scope=refunds (refunds to send), or ?orderId=…
 *  - Customer: their own payments and refunds (for Transactions), or ?orderId=…
 */
export async function GET(req: NextRequest) {
  const payload = await who(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = req.nextUrl.searchParams.get("scope");
  const orderId = Number(req.nextUrl.searchParams.get("orderId")) || null;
  const staff = isStaffRole(payload.role);
  if (!staff && payload.role !== "customer") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = {
    ...(orderId ? { orderId } : {}),
    ...(!staff ? { order: { customerId: payload.id } } : {}),
    ...(staff && scope === "review" ? { kind: "payment", status: "pending" } : {}),
    ...(staff && scope === "refunds" ? { kind: "refund", status: "pending" } : {}),
  };
  const rows = await prisma.payment.findMany({
    where,
    orderBy: { createdAt: staff && (scope === "review" || scope === "refunds") ? "asc" : "desc" },
    take: 500,
    include: {
      order: { select: ORDER_SELECT },
      reviewedBy: { select: { username: true } },
      createdBy: { select: { username: true, role: true } },
    },
  });
  return NextResponse.json(rows.map((p) => ({
    ...p,
    order: { ...p.order, customer: undefined, customerLabel: customerLabel(p.order) },
  })));
}

/**
 * Add a payment to an order.
 *  - Customer: a GCash payment toward their balance (receipt screenshot, reference,
 *    number and amount). Waits for the store to check it.
 *  - Staff: a payment they received (cash at the counter, or GCash they already
 *    checked). Counts right away.
 */
export async function POST(req: NextRequest) {
  const payload = await who(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const staff = isStaffRole(payload.role);
  if (!staff && payload.role !== "customer") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const order = await prisma.order.findUnique({ where: { id: Number(body.orderId) }, include: { payments: true } });
  if (!order || (!staff && order.customerId !== payload.id)) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status === "cancelled") return NextResponse.json({ error: "This order was cancelled, so no more payments are taken for it." }, { status: 400 });

  const pending = round2(order.payments.filter((p) => p.kind === "payment" && p.status === "pending").reduce((s, p) => s + p.amount, 0));
  const balance = round2(order.totalAmount - order.amountPaid);
  const amount = round2(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Enter how much was paid." }, { status: 400 });
  if (balance <= 0) return NextResponse.json({ error: "This order is already fully paid." }, { status: 400 });

  if (!staff) {
    if (amount > round2(balance - pending) + 0.01) {
      return NextResponse.json({ error: pending > 0
        ? `You have ${peso(pending)} still being checked. The most you can send now is ${peso(Math.max(0, balance - pending))}.`
        : `The balance is only ${peso(balance)}.` }, { status: 400 });
    }
    const reference = String(body.reference ?? "").replace(/\s/g, "");
    const accountNumber = String(body.accountNumber ?? "").replace(/[\s-]/g, "");
    const proofImage = String(body.proofImage ?? "");
    if (!GCASH_NUMBER_RE.test(accountNumber)) return NextResponse.json({ error: "Enter the GCash number you paid from (11 digits, starts with 09)." }, { status: 400 });
    if (!GCASH_REFERENCE_RE.test(reference)) return NextResponse.json({ error: "Enter the 13-digit reference number from your GCash receipt." }, { status: 400 });
    if (!proofImage.startsWith("/api/uploads/")) return NextResponse.json({ error: "Upload the screenshot of your GCash receipt." }, { status: 400 });
    const dup = await referenceTaken(reference);
    if (dup) return NextResponse.json({ error: `That reference number was already used${dup.orderId === order.id ? " on this order" : ""}. Check your GCash receipt.` }, { status: 409 });
    const p = await prisma.payment.create({
      data: { orderId: order.id, kind: "payment", method: "GCash", amount, reference, accountNumber, proofImage, status: "pending", createdById: payload.id },
    });
    return NextResponse.json(p, { status: 201 });
  }

  // Staff recording money they received.
  const method = body.method === "GCash" ? "GCash" : "Cash";
  if (amount > balance + 0.01) return NextResponse.json({ error: `The balance is only ${peso(balance)}.` }, { status: 400 });
  const reference = String(body.reference ?? "").replace(/\s/g, "") || null;
  if (reference && method === "GCash") {
    if (!GCASH_REFERENCE_RE.test(reference)) return NextResponse.json({ error: "A GCash reference number has 13 digits." }, { status: 400 });
    if (await referenceTaken(reference)) return NextResponse.json({ error: "That reference number was already used on another payment." }, { status: 409 });
  }
  const s = await getSettings();
  const p = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        orderId: order.id, kind: "payment", method, amount, amountReceived: amount, reference, status: "approved",
        createdById: payload.id, reviewedById: payload.id, reviewedAt: new Date(), note: String(body.note ?? "").trim().slice(0, 200) || null,
      },
    });
    await syncOrderPaid(tx, order.id);
    const after = await tx.order.findUnique({ where: { id: order.id }, select: { totalAmount: true, amountPaid: true, paymentDueAt: true } });
    if (after) {
      const left = round2(after.totalAmount - after.amountPaid);
      await tx.order.update({
        where: { id: order.id },
        data: { handledById: payload.id, paymentDueAt: left <= 0 ? null : after.paymentDueAt ?? new Date(Date.now() + s.balanceDueDays * 86400000) },
      });
    }
    return created;
  });
  return NextResponse.json(p, { status: 201 });
}

/**
 * Staff review a payment or send a refund:
 *  { id, action: "approve", amountReceived }   — the receipt checks out
 *  { id, action: "reject", reason }            — it doesn't (customer is told why)
 *  { id, action: "refund_sent", reference?, proofImage?, method?, accountNumber? } — refund handed over
 */
export async function PATCH(req: NextRequest) {
  const payload = await who(req);
  if (!payload || !isStaffRole(payload.role)) return NextResponse.json({ error: "Only staff can review payments." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const pay = await prisma.payment.findUnique({ where: { id: Number(body.id) }, include: { order: { select: ORDER_SELECT } } });
  if (!pay) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  const s = await getSettings();
  const cust = pay.order.customer;
  const canEmail = s.emailCustomerUpdates && !!cust?.email && cust.emailUpdates;
  const name = cust?.firstName ?? cust?.username ?? "there";

  if (body.action === "approve" || body.action === "reject") {
    if (pay.kind !== "payment") return NextResponse.json({ error: "That isn't a payment." }, { status: 400 });
    if (pay.status !== "pending") return NextResponse.json({ error: `This payment was already ${pay.status}. Refresh to see the latest.` }, { status: 409 });

    if (body.action === "reject") {
      const reason = String(body.reason ?? "").trim();
      if (!reason) return NextResponse.json({ error: "Tell the customer why, e.g. \"The reference number doesn't match our GCash.\"" }, { status: 400 });
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.payment.update({ where: { id: pay.id }, data: { status: "rejected", note: reason.slice(0, 300), reviewedById: payload.id, reviewedAt: new Date() } });
        await syncOrderPaid(tx, pay.orderId);
        return u;
      });
      const mail = canEmail ? await sendPaymentRejected(cust!.email!, name, pay.orderId, pay.amount, reason, req.nextUrl.origin) : null;
      return NextResponse.json({ payment: updated, emailed: mail?.sent ?? false });
    }

    const received = round2(Number(body.amountReceived ?? pay.amount));
    if (!Number.isFinite(received) || received <= 0) return NextResponse.json({ error: "Enter the amount that actually arrived in the store's GCash." }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const u = await tx.payment.update({ where: { id: pay.id }, data: { status: "approved", amountReceived: received, reviewedById: payload.id, reviewedAt: new Date() } });
      let refund = null;
      if (pay.order.status === "cancelled") {
        // The order was cancelled while this payment waited: it's owed back.
        refund = await refundLateApproval(tx, pay.orderId, received, "GCash", pay.accountNumber, payload.id);
      } else {
        await syncOrderPaid(tx, pay.orderId);
      }
      const after = await tx.order.findUnique({ where: { id: pay.orderId }, select: { totalAmount: true, amountPaid: true, paymentDueAt: true } });
      const left = after ? round2(after.totalAmount - after.amountPaid) : 0;
      const due = left > 0 && pay.order.status !== "cancelled" ? after?.paymentDueAt ?? new Date(Date.now() + s.balanceDueDays * 86400000) : null;
      await tx.order.update({ where: { id: pay.orderId }, data: { paymentDueAt: due, handledById: payload.id } });
      return { u, left, due, refund };
    });
    const dueText = result.due ? result.due.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" }) : null;
    const mail = canEmail && pay.order.status !== "cancelled"
      ? await sendPaymentApproved(cust!.email!, name, pay.orderId, received, result.left, dueText, req.nextUrl.origin) : null;
    return NextResponse.json({ payment: result.u, balance: result.left, dueAt: result.due, refund: result.refund, emailed: mail?.sent ?? false });
  }

  if (body.action === "refund_sent") {
    if (pay.kind !== "refund") return NextResponse.json({ error: "That isn't a refund." }, { status: 400 });
    if (pay.status !== "pending") return NextResponse.json({ error: "This refund was already marked as sent." }, { status: 409 });
    const method = body.method === "Cash" ? "Cash" : body.method === "GCash" ? "GCash" : pay.method;
    const reference = String(body.reference ?? "").replace(/\s/g, "") || null;
    const accountNumber = String(body.accountNumber ?? pay.accountNumber ?? "").replace(/[\s-]/g, "") || null;
    if (method === "GCash") {
      if (!accountNumber || !GCASH_NUMBER_RE.test(accountNumber)) return NextResponse.json({ error: "Enter the customer's GCash number the refund was sent to (11 digits)." }, { status: 400 });
      if (!reference || !GCASH_REFERENCE_RE.test(reference)) return NextResponse.json({ error: "Enter the 13-digit reference number of the refund you sent." }, { status: 400 });
    }
    const proofImage = String(body.proofImage ?? "") || null;
    if (proofImage && !proofImage.startsWith("/api/uploads/")) return NextResponse.json({ error: "Upload the screenshot again." }, { status: 400 });
    const updated = await prisma.payment.update({
      where: { id: pay.id },
      data: { status: "sent", method, reference, accountNumber, proofImage, reviewedById: payload.id, reviewedAt: new Date(), amountReceived: pay.amount },
    });
    const details = method === "GCash"
      ? `It was sent to ${accountNumber}. GCash reference number: ${reference}.`
      : "It was handed to you in cash at the store.";
    const mail = canEmail ? await sendRefundSent(cust!.email!, name, pay.orderId, pay.amount, method, details) : null;
    return NextResponse.json({ payment: updated, emailed: mail?.sent ?? false });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
