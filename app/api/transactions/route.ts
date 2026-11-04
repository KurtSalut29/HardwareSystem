import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

async function getPayload(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = payload.role === "cashier" ? { userId: payload.id } : {};
  const transactions = await prisma.transaction.findMany({
    where,
    include: { items: { include: { product: true } }, user: { select: { username: true } } },
    orderBy: { dateTime: "desc" },
  });
  // Merge productName fallback for deleted products
  const result = transactions.map((t) => ({
    ...t,
    items: t.items.map((i) => ({
      ...i,
      product: i.product ?? { name: i.productName || "Deleted Product", image: null, subcategory: null },
    })),
  }));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || payload.role !== "cashier") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { items, paymentMethod, orderIds } = await req.json();
  if (!items?.length || !paymentMethod) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  // Online orders loaded into this checkout. Linking them marks them as sold, so
  // marking one delivered later doesn't record the same sale a second time.
  const linkedOrderIds: number[] = Array.isArray(orderIds) ? orderIds.filter((n: unknown) => Number.isInteger(n)) : [];

  const totalAmount = items.reduce((sum: number, i: { price: number; quantity: number }) => sum + i.price * i.quantity, 0);

  const transaction = await prisma.$transaction(async (tx) => {
    for (const item of items) {
      // Stock for an online order's items was taken when the order was placed.
      // `orderQuantity` is that already-reserved share of the line; anything above
      // it is a walk-in addition and is taken from stock now.
      const reserved = item.orderQuantity != null
        ? Math.min(item.quantity, Math.max(0, Number(item.orderQuantity) || 0))
        : item.fromOrder ? item.quantity : 0;
      const take = item.quantity - reserved;
      if (take > 0) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || product.stock < take) throw new Error(`Insufficient stock for product ${item.productId}`);
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: take } } });
      }
    }
    const sale = await tx.transaction.create({
      data: {
        userId: payload.id,
        totalAmount,
        paymentMethod,
        type: "POS",
        items: { create: items.map((i: { productId: number; quantity: number; price: number; productName: string }) => ({ productId: i.productId, productName: i.productName ?? "", quantity: i.quantity, price: i.price })) },
      },
      include: { items: true },
    });
    if (linkedOrderIds.length) {
      await tx.order.updateMany({
        where: { id: { in: linkedOrderIds }, transactionId: null },
        data: { transactionId: sale.id, handledById: payload.id },
      });
    }
    return sale;
  });

  return NextResponse.json(transaction, { status: 201 });
}
