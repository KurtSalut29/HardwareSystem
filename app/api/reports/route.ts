import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { buildSummary, startOfDay, endOfDay } from "@/lib/reporting";

async function getPayload(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Reports a staff member has sent to the admin.
 * Admin sees every report; staff see the ones they sent themselves.
 */
export async function GET(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || (payload.role !== "admin" && payload.role !== "cashier")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reports = await prisma.report.findMany({
    where: payload.role === "cashier" ? { authorId: payload.id } : {},
    include: { author: { select: { id: true, username: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(reports);
}

/**
 * Staff compile and send an accomplishment report for a period.
 *
 * The client sends only the window and an optional note — every figure is
 * recomputed here from that staff member's own transactions, so a report can't
 * be inflated from the browser. The result is snapshotted onto the row, which is
 * what makes it a *report* rather than a live query: it keeps showing what was
 * reported at the time even if a transaction is corrected afterwards.
 */
export async function POST(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || payload.role !== "cashier") {
    return NextResponse.json({ error: "Only staff can send an accomplishment report" }, { status: 403 });
  }

  const { from, to, note, title } = await req.json();
  const fromDate = from ? new Date(`${from}T00:00:00`) : new Date();
  const toDate = to ? new Date(`${to}T00:00:00`) : fromDate;
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  if (toDate < fromDate) {
    return NextResponse.json({ error: "The end date can't be before the start date" }, { status: 400 });
  }

  const periodStart = startOfDay(fromDate);
  const periodEnd = endOfDay(toDate);
  const summary = await buildSummary(periodStart, periodEnd, payload.id);

  const sameDay = periodStart.toDateString() === startOfDay(toDate).toDateString();
  const fallbackTitle = sameDay
    ? `Daily sales — ${periodStart.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}`
    : `Sales report — ${periodStart.toLocaleDateString("en-PH", { month: "short", day: "numeric" })} to ${periodEnd.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;

  const report = await prisma.report.create({
    data: {
      authorId: payload.id,
      title: typeof title === "string" && title.trim() ? title.trim().slice(0, 120) : fallbackTitle,
      periodStart,
      periodEnd,
      totalSales: summary.totalSales,
      totalTransactions: summary.totalTransactions,
      itemsSold: summary.itemsSold,
      cashTotal: summary.cashTotal,
      gcashTotal: summary.gcashTotal,
      otherTotal: summary.otherTotal,
      payload: JSON.stringify({ topProducts: summary.topProducts, lines: summary.lines, orders: summary.orders }),
      note: typeof note === "string" && note.trim() ? note.trim().slice(0, 2000) : null,
    },
    include: { author: { select: { id: true, username: true, role: true } } },
  });

  return NextResponse.json(report, { status: 201 });
}

/** The admin marks a received report as read. */
export async function PATCH(req: NextRequest) {
  const payload = await getPayload(req);
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing report id" }, { status: 400 });

  try {
    const report = await prisma.report.update({
      where: { id: Number(id) },
      data: { status: "read", readAt: new Date() },
      include: { author: { select: { id: true, username: true, role: true } } },
    });
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
}
