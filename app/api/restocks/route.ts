import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

async function getPayload(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

const lineInclude = {
  product: { select: { id: true, name: true, unit: true, image: true } },
  recordedBy: { select: { username: true } },
  batch: { select: { id: true, supplierName: true, referenceNo: true, note: true, date: true, totalCost: true } },
} as const;

// Purchase records — logging what the store bought from a supplier, and the
// only path that increases a product's stock besides a recorded adjustment.
// Admin and staff both record purchases day to day.
export async function GET(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || (payload.role !== "admin" && payload.role !== "cashier")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restocks = await prisma.restock.findMany({ include: lineInclude, orderBy: [{ date: "desc" }, { id: "asc" }] });
  return NextResponse.json(restocks);
}

type LineInput = {
  productId?: number | string;
  quantity: number | string;
  unitCost: number | string;
  /** A product that isn't in the system yet, created with this delivery. */
  newProduct?: { name: string; categoryId: number | string; unit?: string; price: number | string };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Records one supplier delivery: a supplier, a delivery receipt (DR) number and
 * any number of product lines. Every line raises that product's stock, all in
 * one database transaction, so a delivery is saved whole or not at all.
 *
 * Also accepts the older single-product body ({ productId, quantity, unitCost }).
 */
export async function POST(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || (payload.role !== "admin" && payload.role !== "cashier")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const lines: LineInput[] = Array.isArray(body.items)
    ? body.items
    : [{ productId: body.productId, quantity: body.quantity, unitCost: body.unitCost }];

  if (lines.length === 0) return NextResponse.json({ error: "Add at least one product" }, { status: 400 });
  for (const [i, l] of lines.entries()) {
    const n = i + 1;
    if (!(Number(l.quantity) > 0)) return NextResponse.json({ error: `Line ${n}: enter a quantity greater than zero` }, { status: 400 });
    if (l.unitCost === "" || l.unitCost == null || !(Number(l.unitCost) >= 0)) return NextResponse.json({ error: `Line ${n}: enter the unit cost` }, { status: 400 });
    if (l.newProduct) {
      if (!String(l.newProduct.name ?? "").trim() || !Number(l.newProduct.categoryId)) return NextResponse.json({ error: `Line ${n}: new product needs a name and category` }, { status: 400 });
      if (!(Number(l.newProduct.price) >= 0)) return NextResponse.json({ error: `Line ${n}: new product needs a selling price` }, { status: 400 });
    } else if (!Number(l.productId)) {
      return NextResponse.json({ error: `Line ${n}: choose a product` }, { status: 400 });
    }
  }
  const ids = lines.filter((l) => !l.newProduct).map((l) => Number(l.productId));
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "A product is listed twice. Put its total quantity on one line." }, { status: 400 });
  }

  const supplierName = String(body.supplierName ?? "").trim() || null;
  const referenceNo = String(body.referenceNo ?? "").trim() || null;
  const note = String(body.note ?? "").trim() || null;

  try {
    const batch = await prisma.$transaction(async (tx) => {
      const resolved: { productId: number; qty: number; cost: number }[] = [];
      for (const l of lines) {
        let productId: number;
        if (l.newProduct) {
          const created = await tx.product.create({
            data: {
              name: String(l.newProduct.name).trim(),
              categoryId: Number(l.newProduct.categoryId),
              unit: l.newProduct.unit || "pc",
              price: Number(l.newProduct.price),
              stock: 0,
            },
          });
          productId = created.id;
        } else {
          const product = await tx.product.findUnique({ where: { id: Number(l.productId) } });
          if (!product) throw new Error("A product on this delivery no longer exists");
          productId = product.id;
        }
        resolved.push({ productId, qty: Number(l.quantity), cost: Number(l.unitCost) });
      }

      const totalCost = round2(resolved.reduce((s, r) => s + r.qty * r.cost, 0));
      const created = await tx.restockBatch.create({
        data: { supplierName, referenceNo, note, totalCost, recordedById: payload.id },
      });
      for (const r of resolved) {
        await tx.product.update({ where: { id: r.productId }, data: { stock: { increment: r.qty } } });
        await tx.restock.create({
          data: {
            productId: r.productId,
            quantity: r.qty,
            unitCost: r.cost,
            totalCost: round2(r.qty * r.cost),
            supplierName,
            // The DR number also lands on each line, so a line read alone still says where it came from.
            note: [referenceNo && `DR ${referenceNo}`, note].filter(Boolean).join(" · ") || null,
            recordedById: payload.id,
            batchId: created.id,
            date: created.date,
          },
        });
      }
      return created;
    });

    return NextResponse.json({ ...batch, lines: lines.length }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to record purchase" }, { status: 400 });
  }
}
