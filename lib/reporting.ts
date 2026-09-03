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

/** Start of the given day in local time. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** End of the given day in local time (inclusive of the last millisecond). */
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
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
