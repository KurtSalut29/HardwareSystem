import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocode";
import { isOrderStatus } from "@/lib/orderStatus";
import { liveQuote } from "@/lib/deliveryQuote";
import { getDeliverySettings } from "@/lib/deliverySettings";
import { canTakeOrder, driverAvailability, unavailableReason } from "@/lib/driverStatus";
import { checkDriverForNewDelivery } from "@/lib/driverAssign";
import { getSettings } from "@/lib/settings";
import { cancelOrder, customerMayCancel, minimumDownpayment, referenceTaken, syncOrderPaid } from "@/lib/payments";
import { normalizePhone } from "@/lib/validation";

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
      handledBy: { select: { username: true } },
      // Payment history (drivers only need the totals, so they don't get it).
      // Drivers only need what's still being checked, so they don't collect it twice.
      ...(payload.role === "driver" ? { payments: { where: { kind: "payment", status: "pending" }, select: { amount: true } } } : {
        payments: {
          orderBy: { createdAt: "asc" as const },
          include: { reviewedBy: { select: { username: true } }, createdBy: { select: { username: true, role: true } } },
        },
      }),
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
    driverId: rawDriverId,
    recipientName: rawRecipientName,
    recipientContact: rawRecipientContact,
    deliveryNotes: rawDeliveryNotes,
    // Customers: the GCash payment sent with the order (full or a downpayment),
    // with the receipt screenshot. Staff record payments with amountPaid instead.
    payment: rawPayment,
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

  // The store's rules from Settings (what customers may choose at checkout).
  const settings = await getSettings();
  if (!isStaff) {
    if (fulfillmentMode === "delivery" && !settings.deliveryEnabled) return NextResponse.json({ error: "The store isn't taking delivery orders right now. Choose pickup at the store." }, { status: 400 });
    if (fulfillmentMode === "pickup" && !settings.pickupEnabled) return NextResponse.json({ error: "Pickup isn't available right now. Choose delivery." }, { status: 400 });
    if (paymentMethod === "Cash" && !settings.codEnabled) return NextResponse.json({ error: "The store only accepts GCash right now." }, { status: 400 });
    if (paymentMethod === "GCash" && !settings.gcashEnabled) return NextResponse.json({ error: "GCash isn't available right now. Choose cash." }, { status: 400 });
  }

  // Someone else receiving the delivery, and the exact spot. All optional.
  const recipientName = fulfillmentMode === "delivery" ? String(rawRecipientName ?? "").trim().replace(/\s+/g, " ").slice(0, 80) || null : null;
  const recipientRaw = fulfillmentMode === "delivery" ? String(rawRecipientContact ?? "").trim() : "";
  const recipientContact = recipientRaw ? normalizePhone(recipientRaw) : null;
  if (recipientRaw && !recipientContact) return NextResponse.json({ error: "The receiver's number should be 11 digits starting with 09." }, { status: 400 });
  if (recipientContact && !recipientName) return NextResponse.json({ error: "Add the receiver's name with their number." }, { status: 400 });
  const deliveryNotes = fulfillmentMode === "delivery" ? String(rawDeliveryNotes ?? "").trim().slice(0, 200) || null : null;

  // GCash orders from the shop must carry proof of payment — the sender's number
  // and the reference number. Staff may take a GCash order before the money
  // arrives, so for them both are optional (it stays unverified until checked).
  const isGcash = paymentMethod === "GCash";
  const gcashNumber = isGcash ? stripSpacing(rawGcashNumber) || null : null;
  const gcashReference = isGcash ? stripSpacing(rawGcashReference) || null : null;
  if (isGcash && isStaff && (gcashNumber || gcashReference)) {
    if (!GCASH_NUMBER_RE.test(gcashNumber ?? "")) {
      return NextResponse.json({ error: "Enter the GCash number you paid from (11 digits, starts with 09)." }, { status: 400 });
    }
    if (!GCASH_REFERENCE_RE.test(gcashReference ?? "")) {
      return NextResponse.json({ error: "Enter the 13-digit GCash reference number from your receipt." }, { status: 400 });
    }
  }

  const isPickup = fulfillmentMode === "pickup";

  type CustomerPayment = { amount: number; reference: string; accountNumber: string; proofImage: string };
  let customerPayment: CustomerPayment | null = null;
  if (!isStaff && rawPayment && typeof rawPayment === "object") {
    const rp = rawPayment as Record<string, unknown>;
    customerPayment = {
      amount: round2(Number(rp.amount)),
      reference: stripSpacing(rp.reference),
      accountNumber: stripSpacing(rp.accountNumber),
      proofImage: String(rp.proofImage ?? ""),
    };
    if (!GCASH_NUMBER_RE.test(customerPayment.accountNumber)) return NextResponse.json({ error: "Enter the GCash number you paid from (11 digits, starts with 09)." }, { status: 400 });
    if (!GCASH_REFERENCE_RE.test(customerPayment.reference)) return NextResponse.json({ error: "Enter the 13-digit reference number from your GCash receipt." }, { status: 400 });
    if (!customerPayment.proofImage.startsWith("/api/uploads/")) return NextResponse.json({ error: "Upload the screenshot of your GCash receipt." }, { status: 400 });
    if (!(customerPayment.amount > 0)) return NextResponse.json({ error: "Enter how much you sent by GCash." }, { status: 400 });
    if (await referenceTaken(customerPayment.reference)) return NextResponse.json({ error: "That GCash reference number was already used on another order. Check your receipt." }, { status: 409 });
  }
  if (!isStaff && isGcash && !customerPayment) return NextResponse.json({ error: "Send your GCash payment and upload the receipt to place this order." }, { status: 400 });

  // Staff may hand a delivery to a driver as they take the order. The same
  // availability rule as dispatching from the order list applies.
  let driverId: number | null = null;
  if (rawDriverId != null && rawDriverId !== "") {
    if (!isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (isPickup) return NextResponse.json({ error: "Pickup orders cannot be assigned a driver" }, { status: 400 });
    const check = await checkDriverForNewDelivery(rawDriverId);
    if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
    driverId = check.id;
  }

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
    // Same road-distance quote the checkout showed (cached per drop-off point).
    const { quote, settings } = await liveQuote({ lat: latitude, lng: longitude });
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

      // Customers: the GCash payment (or a downpayment on a large cash order) is
      // checked against the store's rules, then waits for staff to approve it.
      if (!isStaff) {
        const needsDownpayment = paymentMethod === "Cash" && settings.requireDownpaymentOver > 0 && totalAmount > settings.requireDownpaymentOver;
        if (needsDownpayment && !customerPayment) {
          throw new Error(`Orders over ₱${settings.requireDownpaymentOver.toLocaleString("en-PH")} need a GCash downpayment of at least ₱${minimumDownpayment(totalAmount, settings).toLocaleString("en-PH")} first.`);
        }
        if (customerPayment) {
          const least = minimumDownpayment(totalAmount, settings);
          if (customerPayment.amount + 0.01 < least) {
            throw new Error(least >= totalAmount
              ? `Please pay the full ₱${totalAmount.toFixed(2)} by GCash.`
              : `The GCash downpayment must be at least ₱${least.toLocaleString("en-PH")} (${settings.minDownpaymentPct}% of the total).`);
          }
          if (customerPayment.amount > totalAmount + 0.01) throw new Error(`You only need to send ₱${totalAmount.toFixed(2)}.`);
          customerPayment.amount = Math.min(customerPayment.amount, totalAmount);
        }
      }

      let amountPaid = 0;
      if (isStaff && rawAmountPaid != null && rawAmountPaid !== "") {
        // Staff record what was paid when the order was taken: in full, a
        // downpayment (e.g. half), or nothing yet. Any payment method.
        amountPaid = round2(Number(rawAmountPaid));
        if (!Number.isFinite(amountPaid) || amountPaid < 0) throw new Error("Enter how much the customer paid.");
        if (amountPaid > totalAmount + 0.01) throw new Error("The amount paid can't be more than the order total.");
        if (amountPaid > totalAmount) amountPaid = totalAmount;
      }

      const created = await tx.order.create({
        data: {
          customerId,
          customerName,
          customerContact,
          totalAmount,
          deliveryFee,
          fulfillmentMode,
          paymentMethod,
          ...(isStaff ? { status: driverId ? "out_for_delivery" : "confirmed", handledById: payload.id } : {}),
          ...(driverId ? { driverId, assignedAt: new Date() } : {}),
          ...(isGcash ? { gcashNumber, gcashReference } : {}),
          ...(customerPayment ? { gcashNumber: customerPayment.accountNumber, gcashReference: customerPayment.reference } : {}),
          amountPaid,
          paymentVerified: isStaff && isGcash && amountPaid > 0,
          // Staff took a partial payment: the rest is due within the store's window.
          ...(isStaff && amountPaid > 0 && amountPaid < totalAmount ? { paymentDueAt: new Date(Date.now() + settings.balanceDueDays * 86400000) } : {}),
          recipientName, recipientContact, deliveryNotes,
          ...(!isPickup && (deliveryAddress || latitude != null) ? { deliveryAddress: deliveryAddress || null, latitude, longitude } : {}),
          items: { create: lines },
        },
      });

      // The payment behind amountPaid, as a record.
      if (isStaff && amountPaid > 0) {
        await tx.payment.create({
          data: {
            orderId: created.id, kind: "payment", method: paymentMethod, amount: amountPaid, amountReceived: amountPaid,
            reference: gcashReference, accountNumber: gcashNumber, status: "approved",
            createdById: payload.id, reviewedById: payload.id, reviewedAt: new Date(), note: "Paid when the order was taken",
          },
        });
      }
      if (customerPayment) {
        await tx.payment.create({
          data: {
            orderId: created.id, kind: "payment", method: "GCash", amount: customerPayment.amount, reference: customerPayment.reference,
            accountNumber: customerPayment.accountNumber, proofImage: customerPayment.proofImage, status: "pending", createdById: payload.id,
          },
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          items: { include: { product: true } },
          customer: { select: { username: true, contact: true } },
          driver: { select: { username: true, contact: true } },
          transaction: { select: { dateTime: true } },
          payments: true,
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

  const body = await req.json();
  const { id, status, driverId, paymentVerified, amountPaid, proofImage, deliveryFee, deliveryFeeNote } = body;
  // Proof photos are images uploaded through /api/upload, nothing else.
  const proof = typeof proofImage === "string" && /^\/api\/uploads\/\d+$/.test(proofImage) ? proofImage : null;
  if (status !== undefined && !isOrderStatus(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (payload.role === "customer") {
    if (existing.customerId !== payload.id || status !== "cancelled" || driverId !== undefined || paymentVerified !== undefined || amountPaid !== undefined || deliveryFee !== undefined) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const s = await getSettings();
    if (!customerMayCancel(existing.status, s)) {
      return NextResponse.json({ error: existing.status === "out_for_delivery" ? "Your order is already on the way. Call the store if you need to stop it." : "This order can no longer be cancelled here. Call the store." }, { status: 400 });
    }
    try {
      await cancelOrder(id, "customer", "Cancelled by the customer", payload.id, s);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't cancel the order" }, { status: 400 });
    }
    return NextResponse.json(await prisma.order.findUnique({ where: { id } }));
  }

  if (payload.role === "driver") {
    if (existing.driverId !== payload.id || status !== "delivered" || driverId !== undefined || paymentVerified !== undefined || amountPaid !== undefined || deliveryFee !== undefined) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // The driver must show the handover: a photo of the items at the drop-off.
    if (!proof) return NextResponse.json({ error: "Take a photo of the delivered items first" }, { status: 400 });
    // A delivery finished by the driver is credited to the staff member who handled
    // the order (usually the one who dispatched it), so it lands in their report.
    await recordCollectedBalance(id, payload.id, "Collected by the driver on delivery");
    const order = await applyOrderUpdate(id, { status: "delivered", proofImage: proof, deliveredAt: new Date() }, existing.handledById ?? payload.id);
    return NextResponse.json(order);
  }

  if (payload.role !== "admin" && payload.role !== "cashier") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (existing.fulfillmentMode === "pickup" && (driverId != null || status === "out_for_delivery")) {
    return NextResponse.json({ error: "Pickup orders cannot be assigned a driver" }, { status: 400 });
  }

  const s = await getSettings();

  // Cancelling goes through the shared cancel: items back in stock, refund opened.
  if (status === "cancelled") {
    try {
      await cancelOrder(id, "store", String(body.cancelReason ?? "").trim() || "Cancelled by the store", payload.id, s);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't cancel the order" }, { status: 400 });
    }
    return NextResponse.json(await prisma.order.findUnique({ where: { id }, include: { payments: true } }));
  }

  const payments = await prisma.payment.findMany({ where: { orderId: id, kind: "payment" } });
  const gcashPays = payments.filter((p) => p.method === "GCash");
  const pendingAmount = round2(payments.filter((p) => p.status === "pending").reduce((t, p) => t + p.amount, 0));
  const balance = round2(existing.totalAmount - existing.amountPaid);

  // Settings → Payments: GCash orders are confirmed only after a payment is approved.
  if (status === "confirmed" && existing.status === "pending" && s.prepareAfterDownpayment && gcashPays.length > 0 && !gcashPays.some((p) => p.status === "approved")) {
    return NextResponse.json({ error: gcashPays.some((p) => p.status === "pending")
      ? "Check the customer's GCash receipt first: approve it under Payments, then confirm the order."
      : "This order has no approved GCash payment yet. The customer needs to send it again." }, { status: 409 });
  }
  // Settings → Payments: the balance must be paid before the order goes out.
  const goingOut = status === "out_for_delivery" || (driverId != null && driverId !== existing.driverId);
  if (goingOut && !s.allowBalanceOnDelivery && balance - pendingAmount > 0.005) {
    return NextResponse.json({ error: `The customer still owes ₱${balance.toFixed(2)}. The store's settings require it to be paid before the order goes out.` }, { status: 409 });
  }

  // Whoever works the order is recorded as handling it.
  const data: OrderUpdate = { handledById: payload.id };
  if (status !== undefined) data.status = status;
  if (status === "delivered" && existing.status !== "delivered") {
    data.deliveredAt = new Date();
    // The balance is handed over on delivery or at pickup, so it's now paid.
    await recordCollectedBalance(id, payload.id, existing.fulfillmentMode === "pickup" ? "Collected at pickup" : "Collected on delivery");
  }
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
    if (existing.status === "cancelled") return NextResponse.json({ error: "This order was cancelled" }, { status: 400 });
    const paid = round2(Number(amountPaid));
    if (!Number.isFinite(paid) || paid < 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (paid > (data.totalAmount ?? existing.totalAmount) + 0.01) {
      return NextResponse.json({ error: "That's more than the order total" }, { status: 400 });
    }
    if (paid + 0.005 < existing.amountPaid) {
      return NextResponse.json({ error: "To lower what was paid, reject the wrong payment in the order's payment list." }, { status: 400 });
    }
    const delta = round2(paid - existing.amountPaid);
    if (delta > 0) {
      await prisma.payment.create({
        data: {
          orderId: id, kind: "payment", method: body.method === "GCash" ? "GCash" : "Cash", amount: delta, amountReceived: delta, status: "approved",
          createdById: payload.id, reviewedById: payload.id, reviewedAt: new Date(), note: "Recorded by staff",
        },
      });
    }
  }

  // "Mark as verified": approves the order's GCash payments still waiting for review.
  if (paymentVerified !== undefined) {
    if (!paymentVerified) return NextResponse.json({ error: "To undo a payment, reject it in the order's payment list." }, { status: 400 });
    await prisma.payment.updateMany({
      where: { orderId: id, kind: "payment", method: "GCash", status: "pending" },
      data: { status: "approved", reviewedById: payload.id, reviewedAt: new Date() },
    });
    const approvedNoAmount = await prisma.payment.findMany({ where: { orderId: id, status: "approved", amountReceived: null } });
    for (const p of approvedNoAmount) await prisma.payment.update({ where: { id: p.id }, data: { amountReceived: p.amount } });
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
  if (amountPaid !== undefined || paymentVerified !== undefined || deliveryFee !== undefined) {
    await prisma.$transaction(async (tx) => {
      await syncOrderPaid(tx, id);
      const after = await tx.order.findUnique({ where: { id }, select: { totalAmount: true, amountPaid: true, paymentDueAt: true } });
      if (after) {
        const left = round2(after.totalAmount - after.amountPaid);
        await tx.order.update({ where: { id }, data: { paymentDueAt: left <= 0 ? null : after.paymentDueAt ?? new Date(Date.now() + s.balanceDueDays * 86400000) } });
      }
    });
    return NextResponse.json(await prisma.order.findUnique({ where: { id }, include: { payments: true } }));
  }
  return NextResponse.json(order);
}

/**
 * On handover the customer pays whatever is left (cash to the driver, or at the
 * counter), so that balance is recorded as a payment. Payments still waiting for
 * review aren't collected twice.
 */
async function recordCollectedBalance(orderId: number, actorId: number, note: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { payments: true } });
    if (!order) return;
    const pending = round2(order.payments.filter((p) => p.kind === "payment" && p.status === "pending").reduce((t, p) => t + p.amount, 0));
    const due = round2(order.totalAmount - order.amountPaid - pending);
    if (due <= 0.005) return;
    await tx.payment.create({
      data: { orderId, kind: "payment", method: "Cash", amount: due, amountReceived: due, status: "approved", createdById: actorId, reviewedById: actorId, reviewedAt: new Date(), note },
    });
    await syncOrderPaid(tx, orderId);
    await tx.order.update({ where: { id: orderId }, data: { paymentDueAt: null } });
  });
}
