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

  const { items, paymentMethod } = await req.json();
  if (!items?.length || !paymentMethod) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const totalAmount = items.reduce((sum: number, i: { price: number; quantity: number }) => sum + i.price * i.quantity, 0);

  const transaction = await prisma.$transaction(async (tx) => {
    for (const item of items) {
      if (!item.fromOrder) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || product.stock < item.quantity) throw new Error(`Insufficient stock for product ${item.productId}`);
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
      }
    }
    return tx.transaction.create({
      data: {
        userId: payload.id,
        totalAmount,
        paymentMethod,
        type: "POS",
        items: { create: items.map((i: { productId: number; quantity: number; price: number; productName: string }) => ({ productId: i.productId, productName: i.productName ?? "", quantity: i.quantity, price: i.price })) },
      },
      include: { items: true },
    });
  });

  return NextResponse.json(transaction, { status: 201 });
}
