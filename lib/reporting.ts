import { prisma } from "@/lib/prisma";

export type ReportSummary = {
  periodStart: string;
  periodEnd: string;
  totalSales: number;
  totalTransactions: number;
  itemsSold: number;
  cashTotal: number;
  gcashTotal: number;
  otherTotal: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  lines: {
    id: number;
    dateTime: string;
    totalAmount: number;
    paymentMethod: string;
    itemCount: number;
    staff: string;
  }[];
  /** Online-order activity for the same window. Kept separate from `totalSales`
   *  so an order isn't counted twice — an online order only becomes revenue once
   *  a staff member rings it up at the counter, which creates a transaction. */
  orders: {
    placed: number;
    placedValue: number;
    delivered: number;
    cancelled: number;
    outstandingBalance: number;
  };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// The store operates in one timezone (Asia/Manila, UTC+8, no DST), so "today"
// for a report always means the Philippine calendar day — regardless of which
// timezone the server process happens to run in. This matters because Vercel's
// serverless functions run in UTC: parsing a plain "YYYY-MM-DD" with no offset
// (the old `new Date(`${d}T00:00:00`)` pattern) or reading it back with
// `.getFullYear()`/`.getMonth()`/`.getDate()` resolves against the *server's*
// local time, not the Philippines'. Locally that bug was invisible because the
// dev machine happens to also sit at UTC+8 — but on Vercel it silently shifted
// every report window by 8 hours, so orders placed in the first third of the PH
// day landed in "yesterday" as far as the report query was concerned.
const PH_UTC_OFFSET = "+08:00";
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True if `s` is a plain "YYYY-MM-DD" date (the shape the reports UI sends). */
export function isDateOnly(s: string): boolean {
  return DATE_ONLY_RE.test(s);
}

/** Today's date, as a "YYYY-MM-DD" string in the Philippines' calendar — not the server's. */
export function todayPH(): string {
  // Shift the current instant by the fixed PH offset, then read the *UTC*
  // calendar fields off that shifted instant. This lands on the right day
  // regardless of the server process's own timezone.
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The instant 00:00:00.000 Asia/Manila on the given "YYYY-MM-DD" date. */
export function startOfDayPH(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000${PH_UTC_OFFSET}`);
}

/** The instant 23:59:59.999 Asia/Manila on the given "YYYY-MM-DD" date. */
export function endOfDayPH(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999${PH_UTC_OFFSET}`);
}

/**
 * Builds a sales summary for a window.
 *
 * `staffId` scopes it to one person's own takings — that is what a staff
 * accomplishment report is. Omitting it reports the whole store, which is the
 * admin's view.
 */
export async function buildSummary(
  periodStart: Date,
  periodEnd: Date,
  staffId?: number,
): Promise<ReportSummary> {
  const range = { gte: periodStart, lte: periodEnd };

  const [transactions, orders] = await Promise.all([
    prisma.transaction.findMany({
      where: { dateTime: range, ...(staffId != null ? { userId: staffId } : {}) },
      include: {
        items: { select: { productName: true, quantity: true, price: true, product: { select: { name: true } } } },
        user: { select: { username: true } },
      },
      orderBy: { dateTime: "asc" },
    }),
    prisma.order.findMany({
      where: { dateTime: range },
      select: { status: true, totalAmount: true, amountPaid: true, paymentMethod: true },
    }),
  ]);

  let totalSales = 0;
  let itemsSold = 0;
  let cashTotal = 0;
  let gcashTotal = 0;
  let otherTotal = 0;
  const productTally = new Map<string, { quantity: number; revenue: number }>();

  for (const t of transactions) {
    totalSales += t.totalAmount;

    const method = (t.paymentMethod || "").toLowerCase();
    if (method === "cash") cashTotal += t.totalAmount;
    else if (method === "gcash") gcashTotal += t.totalAmount;
    else otherTotal += t.totalAmount;

    for (const i of t.items) {
      itemsSold += i.quantity;
      const name = i.product?.name ?? i.productName ?? "Deleted product";
      const prev = productTally.get(name) ?? { quantity: 0, revenue: 0 };
      productTally.set(name, {
        quantity: prev.quantity + i.quantity,
        revenue: prev.revenue + i.price * i.quantity,
      });
    }
  }

  const topProducts = [...productTally.entries()]
    .map(([name, v]) => ({ name, quantity: round2(v.quantity), revenue: round2(v.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Outstanding balance is a GCash concept: it is the shortfall left when a
  // customer sent less than the order total. Cash orders are settled in full at
  // handover, so they are never carried here as debt.
  const outstandingBalance = orders
    .filter((o) => o.status !== "cancelled" && o.paymentMethod === "GCash")
    .reduce((s, o) => s + Math.max(0, o.totalAmount - o.amountPaid), 0);

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalSales: round2(totalSales),
    totalTransactions: transactions.length,
    itemsSold: round2(itemsSold),
    cashTotal: round2(cashTotal),
    gcashTotal: round2(gcashTotal),
    otherTotal: round2(otherTotal),
    topProducts,
    lines: transactions.map((t) => ({
      id: t.id,
      dateTime: t.dateTime.toISOString(),
      totalAmount: round2(t.totalAmount),
      paymentMethod: t.paymentMethod,
      itemCount: t.items.length,
      staff: t.user?.username ?? "—",
    })),
    orders: {
      placed: orders.length,
      placedValue: round2(orders.reduce((s, o) => s + o.totalAmount, 0)),
      delivered: orders.filter((o) => o.status === "delivered").length,
      cancelled: orders.filter((o) => o.status === "cancelled").length,
      outstandingBalance: round2(outstandingBalance),
    },
  };
}
