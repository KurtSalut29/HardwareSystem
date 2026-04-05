import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { username, password, contact, role } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (username.length < 3 || username.length > 50) {
    return NextResponse.json({ error: "Username must be 3–50 characters" }, { status: 400 });
  }

  if (password.length < 6 || password.length > 128) {
    return NextResponse.json({ error: "Password must be 6–128 characters" }, { status: 400 });
  }

  // Public registration only allows customer — admin/cashier created by admin only
  const isPublic = !req.headers.get("x-admin-create");
  const allowedRole = isPublic ? "customer" : role;
  const validRoles = ["admin", "cashier", "customer"];
  if (!allowedRole || !validRoles.includes(allowedRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      username: username.trim(),
      password: hashed,
      role: allowedRole,
      contact: contact || null,
    },
  });

  return NextResponse.json({ message: "Account created successfully" }, { status: 201 });
}
