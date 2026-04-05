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

  const where = payload.role === "customer" ? { customerId: payload.id } : {};
  const orders = await prisma.order.findMany({
    where,
    include: { items: { include: { product: true } }, customer: { select: { username: true } } },
    orderBy: { dateTime: "desc" },
  });
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || payload.role !== "customer") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { items } = await req.json();
  if (!items?.length) return NextResponse.json({ error: "No items" }, { status: 400 });

  const totalAmount = items.reduce((sum: number, i: { price: number; quantity: number }) => sum + i.price * i.quantity, 0);

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
          items: { create: items.map((i: { productId: number; quantity: number; price: number }) => ({ productId: i.productId, quantity: i.quantity, price: i.price })) },
        },
        include: { items: true },
      });
    });
    return NextResponse.json(order, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || (payload.role !== "admin" && payload.role !== "cashier"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();
  const order = await prisma.order.update({ where: { id }, data: { status } });
  return NextResponse.json(order);
}
