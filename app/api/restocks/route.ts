import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

async function getPayload(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Purchase records — logging what the store bought from a supplier, and the
// only path that increases a product's stock. Admin-only: stock purchasing
// is an owner decision in this system, same tier as Products/Categories.
export async function GET(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restocks = await prisma.restock.findMany({
    include: {
      product: { select: { id: true, name: true, unit: true, image: true } },
      recordedBy: { select: { username: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(restocks);
}

export async function POST(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productId, quantity, unitCost, supplierName, note } = await req.json();

  if (!productId || !(Number(quantity) > 0) || Number(unitCost) < 0 || unitCost == null) {
    return NextResponse.json({ error: "Product, a positive quantity, and a unit cost are required" }, { status: 400 });
  }

  const qty = Number(quantity);
  const cost = Number(unitCost);
  const totalCost = Math.round(qty * cost * 100) / 100;

  try {
    const restock = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: Number(productId) } });
      if (!product) throw new Error("Product not found");

      await tx.product.update({ where: { id: product.id }, data: { stock: { increment: qty } } });

      return tx.restock.create({
        data: {
          productId: product.id,
          quantity: qty,
          unitCost: cost,
          totalCost,
          supplierName: supplierName?.trim() || null,
          note: note?.trim() || null,
          recordedById: payload.id,
        },
        include: {
          product: { select: { id: true, name: true, unit: true, image: true } },
          recordedBy: { select: { username: true } },
        },
      });
    });

    return NextResponse.json(restock, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to record purchase" }, { status: 400 });
  }
}
