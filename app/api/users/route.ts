import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verifyToken } from "@/lib/auth";

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.role === "admin";
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, contact: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { username, password, role, contact } = await req.json();
  if (!username || !password || !role) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, password: hashed, role, contact: contact || null },
    select: { id: true, username: true, role: true, contact: true, createdAt: true },
  });
  return NextResponse.json(user, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();

  const token = req.cookies.get("token")?.value;
  const payload = await verifyToken(token!);
  if (payload?.id === id) return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: "User deleted" });
  } catch {
    return NextResponse.json({ error: "Cannot delete this user — they may have existing orders or transactions" }, { status: 400 });
  }
}
