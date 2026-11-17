import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { passwordProblem } from "@/lib/validation";

/** Change your own password: the current one first, then the new one. */
export async function POST(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const current = typeof body.current === "string" ? body.current : "";
  const next = typeof body.next === "string" ? body.next : "";
  if (!current) return NextResponse.json({ error: "Enter your current password.", field: "current" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await bcrypt.compare(current, user.password))) {
    return NextResponse.json({ error: "Your current password isn't right.", field: "current" }, { status: 400 });
  }
  const problem = passwordProblem(next);
  if (problem) return NextResponse.json({ error: problem, field: "next" }, { status: 400 });
  if (await bcrypt.compare(next, user.password)) {
    return NextResponse.json({ error: "Choose a password different from your current one.", field: "next" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(next, 10), failedLogins: 0, lockedUntil: null } });
  return NextResponse.json({ ok: true });
}
