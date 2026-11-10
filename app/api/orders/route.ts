import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocode";
import { isOrderStatus } from "@/lib/orderStatus";
import { quoteDelivery } from "@/lib/deliveryFee";
import { getDeliverySettings, getStorePin } from "@/lib/deliverySettings";
import { canTakeOrder, driverAvailability, unavailableReason } from "@/lib/driverStatus";

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
      // When the sale was recorded: the delivered/picked-up time on the timeline.
      transaction: { select: { dateTime: true } },
    },
    orderBy: { dateTime: "desc" },
  });
  return NextResponse.json(orders);
}

/**
 * Places an order.
 *  - A customer orders for themselves from the shop. It starts as "pending" for
 *    the store to confirm.
 *  - Staff (admin or cashier) take an order by phone or at the counter, for a
 *    customer account or for someone without one (name and number only). Staff
 *    already agreed it with the customer, so it starts "confirmed".
 *
 * Prices come from the product list, never from the browser, and the delivery
 * fee is computed here from the store pin and the drop-off pin.
 */
export async function POST(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isStaff = payload.role === "admin" || payload.role === "cashier";
  if (!isStaff && payload.role !== "customer") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    customerId: rawCustomerId,
    customerName: rawCustomerName,
    customerContact: rawCustomerContact,
  } = await req.json();
  if (!Array.isArray(items) || !items.length) return NextResponse.json({ error: "No items" }, { status: 400 });
  if (!FULFILLMENT_MODES.includes(fulfillmentMode)) return NextResponse.json({ error: "Invalid fulfillment mode" }, { status: 400 });
  if (!PAYMENT_METHODS.includes(paymentMethod)) return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  if (fulfillmentMode === "delivery" && !deliveryAddress && providedLat == null) {
    return NextResponse.json({ error: "Delivery address is required for delivery orders" }, { status: 400 });
  }

  // Who the order is for.
  let customerId: number | null = null;
  let customerName: string | null = null;
  let customerContact: string | null = null;
  if (!isStaff) {
    customerId = payload.id;
  } else if (rawCustomerId) {
    const c = await prisma.user.findUnique({ where: { id: Number(rawCustomerId) } });
    if (!c || c.role !== "customer") return NextResponse.json({ error: "That customer account doesn't exist" }, { status: 400 });
    customerId = c.id;
  } else {
    customerName = String(rawCustomerName ?? "").trim().replace(/\s+/g, " ");
    customerContact = String(rawCustomerContact ?? "").replace(/[\s-]/g, "") || null;
    if (!customerName) return NextResponse.json({ error: "Enter the customer's name" }, { status: 400 });
    if (customerContact && !/^(09\d{9}|\+639\d{9})$/.test(customerContact)) {
      return NextResponse.json({ error: "Contact number should be 11 digits starting with 09" }, { status: 400 });
    }
  }

  // GCash orders from the shop must carry proof of payment — the sender's number
  // and the reference number. Staff may take a GCash order before the money
  // arrives, so for them both are optional (it stays unverified until checked).
  const isGcash = paymentMethod === "GCash";
  const gcashNumber = isGcash ? stripSpacing(rawGcashNumber) || null : null;
  const gcashReference = isGcash ? stripSpacing(rawGcashReference) || null : null;
  if (isGcash && (!isStaff || gcashNumber || gcashReference)) {
    if (!GCASH_NUMBER_RE.test(gcashNumber ?? "")) {
      return NextResponse.json({ error: "Enter the GCash number you paid from (11 digits, starts with 09)." }, { status: 400 });
    }
    if (!GCASH_REFERENCE_RE.test(gcashReference ?? "")) {
      return NextResponse.json({ error: "Enter the 13-digit GCash reference number from your receipt." }, { status: 400 });
    }
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

  // Delivery fee from the saved settings. Without a pin it can't be measured,
  // so it is left at zero and staff set the location (and fee) afterwards.
  let deliveryFee = 0;
  if (!isPickup && latitude != null && longitude != null) {
    const [settings, store] = await Promise.all([getDeliverySettings(), getStorePin()]);
    const quote = quoteDelivery(settings, store, { lat: latitude, lng: longitude });
    if (quote.tooFar) {
      return NextResponse.json({ error: `Sorry, that's about ${quote.roadKm.toFixed(0)} km away — beyond our ${settings.maxKm} km delivery area.` }, { status: 400 });
    }
    deliveryFee = quote.fee;
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const lines: { productId: number; quantity: number; price: number }[] = [];
      for (const item of items as { productId: number; quantity: number }[]) {
        const quantity = round2(Number(item.quantity));
        const product = await tx.product.findUnique({ where: { id: Number(item.productId) } });
        if (!product) throw new Error("A product in this order no longer exists");
        if (!(quantity > 0)) throw new Error(`Enter a quantity for "${product.name}"`);
        if (product.stock < quantity) throw new Error(`Insufficient stock for "${product.name}" (only ${product.stock} ${product.unit} left)`);
        await tx.product.update({ where: { id: product.id }, data: { stock: { decrement: quantity } } });
        lines.push({ productId: product.id, quantity, price: product.price });
      }
      const subtotal = round2(lines.reduce((s, l) => s + l.price * l.quantity, 0));
      const totalAmount = round2(subtotal + deliveryFee);

      // A GCash payer may send less than the full amount — the remainder becomes a
      // balance they settle on delivery or pickup. Defaulting to the full total
      // keeps the common "paid in full" case a no-op for the client.
      let amountPaid = 0;
      if (isGcash && (gcashReference || !isStaff)) {
        amountPaid = rawAmountPaid == null || rawAmountPaid === "" ? totalAmount : round2(Number(rawAmountPaid));
        if (!Number.isFinite(amountPaid) || amountPaid <= 0) throw new Error("Enter how much was sent via GCash.");
        // A cent of tolerance absorbs float rounding on the client's total.
        if (amountPaid > totalAmount + 0.01) throw new Error("The amount paid can't be more than the order total.");
        if (amountPaid > totalAmount) amountPaid = totalAmount;
      }

      return tx.order.create({
        data: {
          customerId,
          customerName,
          customerContact,
          totalAmount,
          deliveryFee,
          fulfillmentMode,
          paymentMethod,
          ...(isStaff ? { status: "confirmed", handledById: payload.id } : {}),
          ...(isGcash ? { gcashNumber, gcashReference, amountPaid } : {}),
          ...(!isPickup && (deliveryAddress || latitude != null) ? { deliveryAddress: deliveryAddress || null, latitude, longitude } : {}),
          items: { create: lines },
        },
        include: {
          items: { include: { product: true } },
          customer: { select: { username: true, contact: true } },
          driver: { select: { username: true, contact: true } },
          transaction: { select: { dateTime: true } },
        },
      });
    });
    return NextResponse.json({ ...order, ...(geocodingFailed ? { geocodingFailed: true } : {}) }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

type OrderUpdate = {
  status?: string;
  driverId?: number | null;
  assignedAt?: Date | null;
  paymentVerified?: boolean;
  amountPaid?: number;
  handledById?: number;
  proofImage?: string;
  deliveredAt?: Date;
  deliveryFee?: number;
  deliveryFeeNote?: string | null;
  totalAmount?: number;
};

/**
 * Applies an order update. The first time an order is marked delivered it is
 * also recorded as an "Online" sale, credited to `creditTo`, so it appears in the
 * staff and store reports. Before this, a delivered order never became a
 * transaction and the reports left it out entirely.
 *
 * The sale is created only while the order has no `transactionId`, claimed with
 * a conditional update inside one database transaction: two people marking the
 * same order delivered at once, or an order already rung up at the POS, can
 * never produce a second sale. Stock is not touched here — it was taken when
 * the order was placed.
 */
async function applyOrderUpdate(id: number, data: OrderUpdate, creditTo: number) {
  if (data.status !== "delivered") return prisma.order.update({ where: { id }, data });

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id, transactionId: null, status: { not: "delivered" } },
      data,
    });
    if (claimed.count === 0) return tx.order.update({ where: { id }, data });

    const order = await tx.order.findUniqueOrThrow({
      where: { id },
      include: { items: { include: { product: { select: { name: true } } } } },
    });
    const sale = await tx.transaction.create({
      data: {
        userId: creditTo,
        totalAmount: order.totalAmount,
        deliveryFee: order.deliveryFee,
        paymentMethod: order.paymentMethod,
        type: "Online",
        items: {
          create: order.items.map((i) => ({
            productId: i.productId,
            productName: i.product.name,
            quantity: i.quantity,
            price: i.price,
          })),
        },
      },
    });
    return tx.order.update({ where: { id }, data: { transactionId: sale.id } });
  });
}

export async function PATCH(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status, driverId, paymentVerified, amountPaid, proofImage, deliveryFee, deliveryFeeNote } = await req.json();
  // Proof photos are images uploaded through /api/upload, nothing else.
  const proof = typeof proofImage === "string" && /^\/api\/uploads\/\d+$/.test(proofImage) ? proofImage : null;
  if (status !== undefined && !isOrderStatus(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (payload.role === "customer") {
    if (existing.customerId !== payload.id || status !== "cancelled" || driverId !== undefined || paymentVerified !== undefined || amountPaid !== undefined || deliveryFee !== undefined) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!["pending", "confirmed"].includes(existing.status)) {
      return NextResponse.json({ error: "This order can no longer be cancelled" }, { status: 400 });
    }
    const order = await prisma.order.update({ where: { id }, data: { status: "cancelled" } });
    return NextResponse.json(order);
  }

  if (payload.role === "driver") {
    if (existing.driverId !== payload.id || status !== "delivered" || driverId !== undefined || paymentVerified !== undefined || amountPaid !== undefined || deliveryFee !== undefined) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // The driver must show the handover: a photo of the items at the drop-off.
    if (!proof) return NextResponse.json({ error: "Take a photo of the delivered items first" }, { status: 400 });
    // A delivery finished by the driver is credited to the staff member who handled
    // the order (usually the one who dispatched it), so it lands in their report.
    const order = await applyOrderUpdate(id, { status: "delivered", proofImage: proof, deliveredAt: new Date() }, existing.handledById ?? payload.id);
    return NextResponse.json(order);
  }

  if (payload.role !== "admin" && payload.role !== "cashier") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (existing.fulfillmentMode === "pickup" && (driverId != null || status === "out_for_delivery")) {
    return NextResponse.json({ error: "Pickup orders cannot be assigned a driver" }, { status: 400 });
  }

  // Whoever works the order is recorded as handling it.
  const data: OrderUpdate = { handledById: payload.id };
  if (status !== undefined) data.status = status;
  if (status === "delivered" && existing.status !== "delivered") data.deliveredAt = new Date();
  if (proof) data.proofImage = proof;

  // The admin can change the computed delivery fee on one order (a regular
  // customer, a shared trip, a road detour), with a reason. Only before the sale
  // is recorded, so the reports never disagree with the order.
  if (deliveryFee !== undefined) {
    if (payload.role !== "admin") return NextResponse.json({ error: "Only the admin can change a delivery fee" }, { status: 403 });
    if (existing.fulfillmentMode === "pickup") return NextResponse.json({ error: "Pickup orders have no delivery fee" }, { status: 400 });
    if (existing.transactionId || existing.status === "delivered" || existing.status === "cancelled") {
      return NextResponse.json({ error: "The fee can't change once the order is delivered or cancelled" }, { status: 400 });
    }
    const fee = round2(Number(deliveryFee));
    if (!Number.isFinite(fee) || fee < 0 || fee > 10000) return NextResponse.json({ error: "Enter a fee from ₱0 to ₱10,000" }, { status: 400 });
    const note = String(deliveryFeeNote ?? "").trim();
    if (!note) return NextResponse.json({ error: "Add a reason for the new fee" }, { status: 400 });
    data.deliveryFee = fee;
    data.deliveryFeeNote = note.slice(0, 200);
    data.totalAmount = round2(existing.totalAmount - existing.deliveryFee + fee);
    // A GCash payment can't exceed the new total.
    if (existing.amountPaid > data.totalAmount) data.amountPaid = data.totalAmount;
  }

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
      // A driver still out on deliveries (up to the admin's limit) or off duty
      // isn't handed another order. Re-saving the same driver is always fine.
      if (existing.driverId !== driverId) {
        const [active, settings] = await Promise.all([
          prisma.order.count({ where: { driverId, status: "out_for_delivery" } }),
          getDeliverySettings(),
        ]);
        const availability = driverAvailability(driver.onDuty, active, settings.driverMaxActive);
        if (!canTakeOrder(availability)) {
          return NextResponse.json({ error: unavailableReason(driver.username, availability, active, settings.driverMaxActive) }, { status: 409 });
        }
      }
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

  const order = await applyOrderUpdate(id, data, payload.id);
  return NextResponse.json(order);
}
