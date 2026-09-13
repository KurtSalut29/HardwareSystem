import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { buildSummary, startOfDayPH, endOfDayPH, todayPH, isDateOnly } from "@/lib/reporting";

// Live figures for a date range. Staff always see their own takings only; the
// admin sees the whole store. Nothing is stored here — this is what the report
// pages render before a report is sent, and what the admin's own store-wide
// report reads from.
export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload || (payload.role !== "admin" && payload.role !== "cashier")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  // A missing param defaults to today; a *present but malformed* one is a
  // caller bug and should 400, not silently fall back to today's figures.
  if ((fromParam && !isDateOnly(fromParam)) || (toParam && !isDateOnly(toParam))) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  // "Today" always means the Philippines' calendar day — see the comment on
  // todayPH() for why this can't just be `new Date()` on the server.
  const fromStr = fromParam ?? todayPH();
  const toStr = toParam ?? fromStr;

  const from = startOfDayPH(fromStr);
  const to = endOfDayPH(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  if (toStr < fromStr) {
    return NextResponse.json({ error: "The end date can't be before the start date" }, { status: 400 });
  }

  // A staff member's report covers their own sales; the admin's covers everyone's.
  const staffId = payload.role === "cashier" ? payload.id : undefined;
  const summary = await buildSummary(from, to, staffId);

  return NextResponse.json(summary);
}
