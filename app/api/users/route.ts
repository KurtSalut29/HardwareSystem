import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verifyToken } from "@/lib/auth";
import { normalizeEmail, normalizePhone, passwordProblem, PHONE_HINT } from "@/lib/validation";
import { USER_SELECT } from "@/lib/users";

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.role === "admin";
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const users = await prisma.user.findMany({ select: USER_SELECT, orderBy: { createdAt: "desc" } });
  return NextResponse.json(users);
}

// Roles that already exist in the system and stay editable.
const VALID_ROLES = ["admin", "cashier", "customer", "driver"];

// What the admin is allowed to *create* here: internal accounts only. Customers
// come in through public signup, and an extra admin isn't handed out from this
// form. Mirrors CREATABLE_ROLES on the Users page.
const CREATABLE_ROLES = ["cashier", "driver"];

/** Checks the optional contact and email fields shared by create and edit. */
async function contactFields(raw: { contact?: unknown; email?: unknown }, selfId?: number) {
  const out: { contact?: string | null; email?: string | null } = {};
  if (raw.contact !== undefined) {
    if (String(raw.contact ?? "").trim() === "") out.contact = null;
    else {
      const c = normalizePhone(raw.contact);
      if (!c) return { error: `Contact number should be ${PHONE_HINT}.` };
      out.contact = c;
    }
  }
  if (raw.email !== undefined) {
    if (String(raw.email ?? "").trim() === "") out.email = null;
    else {
      const e = normalizeEmail(raw.email);
      if (!e) return { error: "Enter a valid email address." };
      const taken = await prisma.user.findUnique({ where: { email: e } });
      if (taken && taken.id !== selfId) return { error: "That email is already used by another account." };
      out.email = e;
    }
  }
  return { values: out };
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { username, password, role, contact, email } = await req.json();
  if (!username || !password || !role) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (!CREATABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: "Only staff and driver accounts can be created here" }, { status: 400 });
  }
  if (!email) return NextResponse.json({ error: "Enter an email. Staff and drivers sign in with it." }, { status: 400 });
  const pwError = passwordProblem(String(password));
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });
  const checked = await contactFields({ contact, email });
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  const name = String(username).trim();
  const existing = await prisma.user.findUnique({ where: { username: name } });
  if (existing) return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username: name, password: hashed, role, ...checked.values },
    select: USER_SELECT,
  });
  return NextResponse.json(user, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, role, contact, email } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const data: { role?: string; contact?: string | null; email?: string | null } = {};
  if (role !== undefined) {
    if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    data.role = role;
  }
  const checked = await contactFields({ contact, email }, id);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  Object.assign(data, checked.values);
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  try {
    const user = await prisma.user.update({ where: { id }, data, select: USER_SELECT });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
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
