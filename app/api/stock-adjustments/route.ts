import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { ADJUST_REASONS } from "@/lib/stock";

async function staff(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  return payload && (payload.role === "admin" || payload.role === "cashier") ? payload : null;
}

/** Recent stock adjustments, newest first. */
export async function GET(req: NextRequest) {
  if (!(await staff(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.stockAdjustment.findMany({
    include: {
      product: { select: { id: true, name: true, unit: true } },
      recordedBy: { select: { username: true } },
    },
    orderBy: { date: "desc" },
    take: 200,
  });
  return NextResponse.json(rows);
}

/**
 * Records a stock change that isn't a sale or a purchase. `mode: "set"` takes the
 * counted quantity (a physical count); `mode: "change"` takes a signed amount
 * (e.g. -3 for three damaged). Either way the difference is what gets recorded.
 */
export async function POST(req: NextRequest) {
  const payload = await staff(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId, mode, value, reason, note } = await req.json();
  const v = Number(value);
  if (!productId || !Number.isFinite(v)) return NextResponse.json({ error: "Enter a quantity" }, { status: 400 });
  if (!ADJUST_REASONS.includes(reason)) return NextResponse.json({ error: "Pick a reason" }, { status: 400 });
  if (reason === "Other" && !String(note ?? "").trim()) return NextResponse.json({ error: "Add a note explaining the adjustment" }, { status: 400 });

  try {
    const row = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: Number(productId) } });
      if (!product) throw new Error("Product not found");
      const target = mode === "set" ? v : product.stock + v;
      const change = Math.round((target - product.stock) * 100) / 100;
      if (target < 0) throw new Error(`Stock can't go below zero (only ${product.stock} ${product.unit} on hand)`);
      if (change === 0) throw new Error("That leaves the stock unchanged");
      const after = Math.round(target * 100) / 100;
      await tx.product.update({ where: { id: product.id }, data: { stock: after } });
      return tx.stockAdjustment.create({
        data: { productId: product.id, change, stockAfter: after, reason, note: String(note ?? "").trim() || null, recordedById: payload.id },
        include: { product: { select: { id: true, name: true, unit: true } }, recordedBy: { select: { username: true } } },
      });
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to adjust stock" }, { status: 400 });
  }
}
