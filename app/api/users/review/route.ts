import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { USER_SELECT } from "@/lib/users";
import { mailReady, sendAccountApproved, sendAccountRejected } from "@/lib/mailer";

async function adminId(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  return payload?.role === "admin" ? payload.id : null;
}

/** Whether approval emails can go out, so the Users page can warn the admin. */
export async function GET(req: NextRequest) {
  if (!(await adminId(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ mailReady: mailReady() });
}

/**
 * The admin approves or turns down a customer who registered. Either way the
 * customer is emailed; an approved customer can sign in right away.
 */
export async function POST(req: NextRequest) {
  const reviewer = await adminId(req);
  if (!reviewer) return NextResponse.json({ error: "Only the admin can approve accounts" }, { status: 403 });

  const { id, decision, note } = await req.json().catch(() => ({}));
  if (decision !== "approve" && decision !== "reject") return NextResponse.json({ error: "Choose approve or reject" }, { status: 400 });
  const reason = String(note ?? "").trim().slice(0, 300);
  if (decision === "reject" && !reason) return NextResponse.json({ error: "Give the customer a reason" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!user || user.role !== "customer") return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      accountStatus: decision === "approve" ? "approved" : "rejected",
      statusNote: decision === "approve" ? null : reason,
      reviewedAt: new Date(),
      reviewedById: reviewer,
    },
    select: USER_SELECT,
  });

  const name = user.firstName ?? user.username;
  const mail = !user.email
    ? { sent: false as const, reason: "This customer has no email on file." }
    : decision === "approve"
      ? await sendAccountApproved(user.email, name, req.nextUrl.origin)
      : await sendAccountRejected(user.email, name, reason);

  return NextResponse.json({ user: updated, emailSent: mail.sent, emailError: mail.sent ? null : mail.reason });
}
