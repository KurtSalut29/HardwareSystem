import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { flattenProduct, productInclude } from "@/lib/catalog";

async function getRole(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return (await verifyToken(token))?.role ?? null;
}

// Catalogue upkeep — creating, editing, and removing listings — is shared
// day-to-day operational work between admin and staff.
function canManage(role: string | null) {
  return role === "admin" || role === "cashier";
}

export async function GET(req: NextRequest) {
  const role = await getRole(req);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: productInclude,
  });
  return NextResponse.json(products.map(flattenProduct));
}

export async function POST(req: NextRequest) {
  if (!canManage(await getRole(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { name, categoryId, subcategoryId, price, unit, stock, image, description } = await req.json();
    if (!name || !categoryId || price == null) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const sub = await checkSubcategory(subcategoryId, Number(categoryId));
    if (sub === false) return NextResponse.json({ error: "That subcategory belongs to another category" }, { status: 400 });
    const initialStock = Number(stock) || 0;
    if (initialStock < 0) return NextResponse.json({ error: "Opening stock can't be negative" }, { status: 400 });
    const product = await prisma.product.create({
      data: {
        name,
        categoryId: Number(categoryId),
        subcategoryId: sub,
        price: Number(price),
        unit: unit || "pc",
        // Opening stock is set once, when the product is added. After that,
        // stock only changes through purchases, sales and recorded adjustments.
        stock: initialStock,
        image: image || null,
        description: description || null,
      },
      include: productInclude,
    });
    return NextResponse.json(flattenProduct(product), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!canManage(await getRole(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Stock is deliberately not editable here: use a purchase (Restocks) or a
    // stock adjustment, so every change has a record.
    const { id, name, categoryId, subcategoryId, price, unit, image, description } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing product ID" }, { status: 400 });
    const sub = await checkSubcategory(subcategoryId, Number(categoryId));
    if (sub === false) return NextResponse.json({ error: "That subcategory belongs to another category" }, { status: 400 });
    const product = await prisma.product.update({
      where: { id: Number(id) },
      data: {
        name,
        categoryId: Number(categoryId),
        subcategoryId: sub,
        price: Number(price),
        unit: unit || "pc",
        image: image || null,
        description: description || null,
      },
      include: productInclude,
    });
    return NextResponse.json(flattenProduct(product));
  } catch (e) {
    console.error("PUT /api/products error:", e);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

/** The subcategory id to save, null for none, or false if it isn't in the product's category. */
async function checkSubcategory(raw: unknown, categoryId: number): Promise<number | null | false> {
  if (raw == null || raw === "") return null;
  const sub = await prisma.subcategory.findUnique({ where: { id: Number(raw) } });
  return sub && sub.categoryId === categoryId ? sub.id : false;
}

export async function DELETE(req: NextRequest) {
  if (!canManage(await getRole(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await req.json();
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ message: "Product deleted" });
  } catch {
    return NextResponse.json({ error: "Cannot delete product with existing orders or transactions" }, { status: 400 });
  }
}
