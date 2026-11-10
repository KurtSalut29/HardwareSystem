import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

async function canManage(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const role = token ? (await verifyToken(token))?.role : null;
  return role === "admin" || role === "cashier";
}

const clean = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ");

/** Another subcategory in the same category with this name, ignoring case. */
async function findClash(categoryId: number, name: string, exceptId?: number) {
  return prisma.subcategory.findFirst({
    where: { categoryId, name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
  });
}

export async function POST(req: NextRequest) {
  if (!(await canManage(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = clean(body.name);
  const categoryId = Number(body.categoryId);
  if (!name || !categoryId) return NextResponse.json({ error: "Enter a subcategory name" }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: "Keep the name under 60 characters" }, { status: 400 });
  if (await findClash(categoryId, name)) return NextResponse.json({ error: `"${name}" is already in this category` }, { status: 400 });
  const sub = await prisma.subcategory.create({ data: { name, categoryId } });
  return NextResponse.json(sub, { status: 201 });
}

export async function PUT(req: NextRequest) {
  if (!(await canManage(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const id = Number(body.id);
  const name = clean(body.name);
  const sub = await prisma.subcategory.findUnique({ where: { id } });
  if (!sub) return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });
  if (!name) return NextResponse.json({ error: "Enter a subcategory name" }, { status: 400 });
  if (await findClash(sub.categoryId, name, id)) return NextResponse.json({ error: `"${name}" is already in this category` }, { status: 400 });
  const updated = await prisma.subcategory.update({ where: { id }, data: { name } });
  return NextResponse.json(updated);
}

/**
 * Removes a subcategory. Its products move to `moveTo` (another subcategory in
 * the same category), which is also how two near-duplicates are merged; without
 * `moveTo` they are left with no subcategory.
 */
export async function DELETE(req: NextRequest) {
  if (!(await canManage(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const id = Number(body.id);
  const sub = await prisma.subcategory.findUnique({ where: { id } });
  if (!sub) return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });

  let moveTo: number | null = null;
  if (body.moveTo != null && body.moveTo !== "") {
    const target = await prisma.subcategory.findUnique({ where: { id: Number(body.moveTo) } });
    if (!target || target.categoryId !== sub.categoryId || target.id === sub.id) {
      return NextResponse.json({ error: "Pick another subcategory in the same category" }, { status: 400 });
    }
    moveTo = target.id;
  }

  const moved = await prisma.$transaction(async (tx) => {
    const r = await tx.product.updateMany({ where: { subcategoryId: id }, data: { subcategoryId: moveTo } });
    await tx.subcategory.delete({ where: { id } });
    return r.count;
  });
  return NextResponse.json({ ok: true, moved });
}
