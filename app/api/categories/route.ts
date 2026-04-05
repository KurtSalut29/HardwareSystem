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
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  if (await getRole(req) !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { name, description } = await req.json();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const category = await prisma.category.create({ data: { name, description: description || null } });
    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Category already exists" }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  if (await getRole(req) !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, name, description } = await req.json();
    const category = await prisma.category.update({ where: { id }, data: { name, description: description || null } });
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (await getRole(req) !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await req.json();
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ message: "Category deleted" });
  } catch {
    return NextResponse.json({ error: "Cannot delete category with existing products" }, { status: 400 });
  }
}
