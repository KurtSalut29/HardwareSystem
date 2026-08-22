import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload || payload.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [totalUsers, totalProducts, totalOrders, transactions, orders, lowStock, allOrderDates, allUserDates, allProductDates] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.transaction.findMany({ include: { items: true } }),
    prisma.order.findMany({ orderBy: { dateTime: "desc" }, take: 5, include: { customer: { select: { username: true } }, items: { include: { product: true } } } }),
    prisma.product.findMany({ where: { stock: { lte: 5 } }, orderBy: { stock: "asc" }, take: 5 }),
    prisma.order.findMany({ select: { dateTime: true } }),
    prisma.user.findMany({ select: { createdAt: true } }),
    prisma.product.findMany({ select: { createdAt: true } }),
  ]);

  const totalRevenue = transactions.reduce((s, t) => s + t.totalAmount, 0);

  // Last 6 calendar months, oldest first — shared by all three trend series below so they line up on the same axis.
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (5 - i), 1));
  const sameMonth = (d: Date, m: Date) => d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();

  // Monthly sales for chart (last 6 months)
  const monthlySales = months.map((m) => {
    const total = transactions
      .filter((t) => sameMonth(new Date(t.dateTime), m))
      .reduce((s, t) => s + t.totalAmount, 0);
    return { month: m.toLocaleString("default", { month: "short" }), sales: Math.round(total) };
  });

  // Orders placed per month — an activity/flow metric, like sales, not a running total.
  const monthlyOrders = months.map((m) => ({
    month: m.toLocaleString("default", { month: "short" }),
    count: allOrderDates.filter((o) => sameMonth(new Date(o.dateTime), m)).length,
  }));

  // Total registered users as of the end of each month — a running headcount, so this is cumulative, not per-month.
  const monthlyUsers = months.map((m) => {
    const endOfMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59);
    return {
      month: m.toLocaleString("default", { month: "short" }),
      count: allUserDates.filter((u) => new Date(u.createdAt) <= endOfMonth).length,
    };
  });

  // Total catalog size as of the end of each month — also a running headcount, like Users.
  // `createdAt` was only just added, so every product created before that migration shares one backfilled date;
  // the curve becomes genuinely meaningful as new products are added going forward.
  const monthlyProducts = months.map((m) => {
    const endOfMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59);
    return {
      month: m.toLocaleString("default", { month: "short" }),
      count: allProductDates.filter((p) => new Date(p.createdAt) <= endOfMonth).length,
    };
  });

  return NextResponse.json({
    stats: { totalUsers, totalProducts, totalOrders, totalRevenue },
    monthlySales,
    monthlyOrders,
    monthlyUsers,
    monthlyProducts,
    recentOrders: orders,
    lowStock,
  });
}
