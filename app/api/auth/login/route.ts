import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

/** Wrong passwords in a row before sign-in is paused, and for how long. */
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

// Same message whether the email exists or not, so the form can't be used to
// find out who has an account.
const BAD_LOGIN = "Incorrect email or password.";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // Customers and staff sign in with their email. Older staff accounts without
  // an email on file can still use their username.
  const identifier = String(body.email ?? body.username ?? "").trim();
  const password = body.password;

  if (!identifier || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }
  if (typeof password !== "string" || identifier.length > 120 || password.length > 128) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const user = identifier.includes("@")
    ? await prisma.user.findUnique({ where: { email: identifier.toLowerCase() } })
    : await prisma.user.findUnique({ where: { username: identifier } });

  if (!user) return NextResponse.json({ error: BAD_LOGIN }, { status: 401 });

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000));
    return NextResponse.json(
      { error: `Too many wrong passwords. For your security, sign-in is paused for ${mins} more minute${mins === 1 ? "" : "s"}.` },
      { status: 429 },
    );
  }

  if (!(await bcrypt.compare(password, user.password))) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED;
    await prisma.user.update({
      where: { id: user.id },
      data: lock ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) } : { failedLogins: failed },
    });
    if (lock) {
      return NextResponse.json({ error: `Too many wrong passwords. For your security, sign-in is paused for ${LOCK_MINUTES} minutes.` }, { status: 429 });
    }
    const left = MAX_FAILED - failed;
    return NextResponse.json(
      { error: left <= 2 ? `${BAD_LOGIN} ${left} more tr${left === 1 ? "y" : "ies"} before sign-in is paused.` : BAD_LOGIN },
      { status: 401 },
    );
  }

  // Right password, but a new customer the admin hasn't approved yet (or turned down).
  if (user.accountStatus === "pending") {
    return NextResponse.json(
      { error: `Your account is waiting for the store's approval. We'll email ${user.email ?? "you"} as soon as it's approved.`, status: "pending" },
      { status: 403 },
    );
  }
  if (user.accountStatus === "rejected") {
    return NextResponse.json(
      { error: `Your registration wasn't approved${user.statusNote ? `: ${user.statusNote}` : "."} Please contact the store.`, status: "rejected" },
      { status: 403 },
    );
  }

  if (user.failedLogins > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  }

  const token = await signToken({ id: user.id, username: user.username, role: user.role });

  const response = NextResponse.json({
    message: "Login successful",
    role: user.role,
    username: user.username,
  });

  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });

  return response;
}
