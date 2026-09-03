import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocode";
import { isOrderStatus } from "@/lib/orderStatus";

const FULFILLMENT_MODES = ["delivery", "pickup"];
// Card was dropped — online customers pay cash on delivery/pickup or via GCash.
const PAYMENT_METHODS = ["Cash", "GCash"];

// GCash sender numbers are PH mobile numbers; reference numbers are 13 digits.
const GCASH_NUMBER_RE = /^09\d{9}$/;
const GCASH_REFERENCE_RE = /^\d{13}$/;
const stripSpacing = (v: unknown) => String(v ?? "").replace(/[\s-]/g, "");
const round2 = (n: number) => Math.round(n * 100) / 100;

async function getPayload(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where =
    payload.role === "customer" ? { customerId: payload.id } :
    payload.role === "driver" ? { driverId: payload.id } :
    {};
  const orders = await prisma.order.findMany({
    where,
    include: {
      items: { include: { product: true } },
      // Drivers need the customer's number to call ahead on a delivery.
      customer: { select: { username: true, contact: true } },
      driver: { select: { username: true, contact: true } },
    },
    orderBy: { dateTime: "desc" },
  });
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || payload.role !== "customer") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    items,
    deliveryAddress,
    latitude: providedLat,
    longitude: providedLng,
    fulfillmentMode = "delivery",
    paymentMethod = "Cash",
    gcashNumber: rawGcashNumber,
    gcashReference: rawGcashReference,
    amountPaid: rawAmountPaid,
  } = await req.json();
  if (!items?.length) return NextResponse.json({ error: "No items" }, { status: 400 });
  if (!FULFILLMENT_MODES.includes(fulfillmentMode)) return NextResponse.json({ error: "Invalid fulfillment mode" }, { status: 400 });
  if (!PAYMENT_METHODS.includes(paymentMethod)) return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  if (fulfillmentMode === "delivery" && !deliveryAddress && providedLat == null) {
    return NextResponse.json({ error: "Delivery address is required for delivery orders" }, { status: 400 });
  }

  // GCash orders must carry proof of payment — the sender's number and the
  // reference number from their GCash receipt. Cash orders never store these.
  const isGcash = paymentMethod === "GCash";
  const gcashNumber = isGcash ? stripSpacing(rawGcashNumber) : null;
  const gcashReference = isGcash ? stripSpacing(rawGcashReference) : null;
  if (isGcash) {
    if (!GCASH_NUMBER_RE.test(gcashNumber!)) {
      return NextResponse.json({ error: "Enter the GCash number you paid from (11 digits, starts with 09)." }, { status: 400 });
    }
    if (!GCASH_REFERENCE_RE.test(gcashReference!)) {
      return NextResponse.json({ error: "Enter the 13-digit GCash reference number from your receipt." }, { status: 400 });
    }
  }

  const totalAmount = round2(items.reduce((sum: number, i: { price: number; quantity: number }) => sum + i.price * i.quantity, 0));

  // A GCash payer may send less than the full amount — the remainder becomes a
  // balance they settle on delivery or pickup. Defaulting to the full total
  // keeps the common "paid in full" case a no-op for the client.
  let amountPaid = 0;
  if (isGcash) {
    amountPaid = rawAmountPaid == null ? totalAmount : round2(Number(rawAmountPaid));
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      return NextResponse.json({ error: "Enter how much you sent via GCash." }, { status: 400 });
    }
    // A cent of tolerance absorbs float rounding on the client's total.
    if (amountPaid > totalAmount + 0.01) {
      return NextResponse.json({ error: "The amount paid can't be more than the order total." }, { status: 400 });
    }
    if (amountPaid > totalAmount) amountPaid = totalAmount;
  }

  const isPickup = fulfillmentMode === "pickup";
  let latitude: number | null = isPickup ? null : providedLat ?? null;
  let longitude: number | null = isPickup ? null : providedLng ?? null;
  let geocodingFailed = false;

  // Only geocode if coordinates weren't already provided, and never for pickup orders
  if (!isPickup && deliveryAddress && latitude === null) {
    const geo = await geocodeAddress(deliveryAddress);
    if (geo) {
      latitude = geo.lat;
      longitude = geo.lng;
    } else {
      geocodingFailed = true;
    }
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || product.stock < item.quantity) throw new Error(`Insufficient stock for "${product?.name ?? item.productId}"`);
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
      }
      return tx.order.create({
        data: {
          customerId: payload.id,
          totalAmount,
          fulfillmentMode,
          paymentMethod,
          ...(isGcash ? { gcashNumber, gcashReference, amountPaid } : {}),
          ...(!isPickup && deliveryAddress ? { deliveryAddress, latitude, longitude } : {}),
          items: { create: items.map((i: { productId: number; quantity: number; price: number }) => ({ productId: i.productId, quantity: i.quantity, price: i.price })) },
        },
        include: { items: true },
      });
    });
    return NextResponse.json({ ...order, ...(geocodingFailed ? { geocodingFailed: true } : {}) }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status, driverId, paymentVerified, amountPaid } = await req.json();
  if (status !== undefined && !isOrderStatus(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (payload.role === "customer") {
    if (existing.customerId !== payload.id || status !== "cancelled" || driverId !== undefined || paymentVerified !== undefined || amountPaid !== undefined) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!["pending", "confirmed"].includes(existing.status)) {
      return NextResponse.json({ error: "This order can no longer be cancelled" }, { status: 400 });
    }
    const order = await prisma.order.update({ where: { id }, data: { status: "cancelled" } });
    return NextResponse.json(order);
  }

  if (payload.role === "driver") {
    if (existing.driverId !== payload.id || status !== "delivered" || driverId !== undefined || paymentVerified !== undefined || amountPaid !== undefined) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const order = await prisma.order.update({ where: { id }, data: { status: "delivered" } });
    return NextResponse.json(order);
  }

  if (payload.role !== "admin" && payload.role !== "cashier") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (existing.fulfillmentMode === "pickup" && (driverId != null || status === "out_for_delivery")) {
    return NextResponse.json({ error: "Pickup orders cannot be assigned a driver" }, { status: 400 });
  }

  const data: { status?: string; driverId?: number | null; assignedAt?: Date | null; paymentVerified?: boolean; amountPaid?: number } = {};
  if (status !== undefined) data.status = status;

  // Recording a settlement: what the customer has now paid in total, not a
  // delta. Clamped to the order total so a balance can never go negative.
  if (amountPaid !== undefined) {
    const paid = round2(Number(amountPaid));
    if (!Number.isFinite(paid) || paid < 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    data.amountPaid = Math.min(paid, existing.totalAmount);
  }

  if (paymentVerified !== undefined) {
    if (existing.paymentMethod !== "GCash") {
      return NextResponse.json({ error: "Only GCash orders need payment verification" }, { status: 400 });
    }
    data.paymentVerified = Boolean(paymentVerified);
  }

  // Driver dispatch belongs to the cashier — admins can still confirm, cancel
  // and verify payment, but no longer assign deliveries.
  if (driverId !== undefined) {
    if (payload.role !== "cashier") {
      return NextResponse.json({ error: "Only a cashier can assign drivers" }, { status: 403 });
    }
    if (driverId !== null) {
      const driver = await prisma.user.findUnique({ where: { id: driverId } });
      if (!driver || driver.role !== "driver") return NextResponse.json({ error: "Invalid driver" }, { status: 400 });
      data.driverId = driverId;
      // Stamped on every (re)assignment so the driver's client can tell a newly
      // handed-over delivery from one it has already alerted about.
      if (existing.driverId !== driverId) data.assignedAt = new Date();
      if (status === undefined && existing.status === "confirmed") data.status = "out_for_delivery";
    } else {
      data.driverId = null;
      data.assignedAt = null;
      if (status === undefined && existing.status === "out_for_delivery") data.status = "confirmed";
    }
  }

  const order = await prisma.order.update({ where: { id }, data });
  return NextResponse.json(order);
}
