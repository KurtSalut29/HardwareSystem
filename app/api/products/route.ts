import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

async function getRole(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return (await verifyToken(token))?.role ?? null;
}

export async function GET(req: NextRequest) {
  const role = await getRole(req);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: { category: true },
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  if (await getRole(req) !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { name, categoryId, subcategory, price, unit, stock, image, description } = await req.json();
    if (!name || !categoryId || price == null) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const product = await prisma.product.create({
      data: {
        name,
        categoryId: Number(categoryId),
        subcategory: subcategory || null,
        price: Number(price),
        unit: unit || "pc",
        stock: Number(stock) || 0,
        image: image || null,
        description: description || null,
      },
      include: { category: true },
    });
    return NextResponse.json(product, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (await getRole(req) !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, name, categoryId, subcategory, price, unit, stock, image, description } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing product ID" }, { status: 400 });
    const product = await prisma.product.update({
      where: { id: Number(id) },
      data: {
        name,
        categoryId: Number(categoryId),
        subcategory: subcategory || null,
        price: Number(price),
        unit: unit || "pc",
        stock: Number(stock),
        image: image || null,
        description: description || null,
      },
      include: { category: true },
    });
    return NextResponse.json(product);
  } catch (e) {
    console.error("PUT /api/products error:", e);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (await getRole(req) !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await req.json();
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ message: "Product deleted" });
  } catch {
    return NextResponse.json({ error: "Cannot delete product with existing orders or transactions" }, { status: 400 });
  }
}
