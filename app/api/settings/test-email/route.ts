import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mailReady, sendTestEmail } from "@/lib/mailer";

/** Admin: send a test email to their own address (or the store Gmail) to check the setup. */
export async function POST(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload || payload.role !== "admin") return NextResponse.json({ error: "Only the admin can send a test email." }, { status: 403 });
  if (!mailReady()) return NextResponse.json({ error: "Email isn't set up yet: add GMAIL_USER and GMAIL_APP_PASSWORD to the server settings." }, { status: 400 });

  const me = await prisma.user.findUnique({ where: { id: payload.id }, select: { email: true } });
  const to = me?.email || process.env.GMAIL_USER!;
  const result = await sendTestEmail(to);
  if (!result.sent) return NextResponse.json({ sent: false, error: `Gmail refused it: ${result.reason}` }, { status: 502 });
  return NextResponse.json({ sent: true, to });
}
