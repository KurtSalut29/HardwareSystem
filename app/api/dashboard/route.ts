import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload || payload.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [totalUsers, totalProducts, totalOrders, transactions, orders, lowStock] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.transaction.findMany({ include: { items: true } }),
    prisma.order.findMany({ orderBy: { dateTime: "desc" }, take: 5, include: { customer: { select: { username: true } }, items: { include: { product: true } } } }),
    prisma.product.findMany({ where: { stock: { lte: 5 } }, orderBy: { stock: "asc" }, take: 5 }),
  ]);

  const totalRevenue = transactions.reduce((s, t) => s + t.totalAmount, 0);

  // Monthly sales for chart (last 6 months)
  const now = new Date();
  const monthlySales = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleString("default", { month: "short" });
    const total = transactions
      .filter((t) => {
        const td = new Date(t.dateTime);
        return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
      })
      .reduce((s, t) => s + t.totalAmount, 0);
    return { month: label, sales: Math.round(total) };
  });

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  transactions.forEach((t) =>
    t.items.forEach((item) => {
      categoryMap["Sales"] = (categoryMap["Sales"] ?? 0) + item.price * item.quantity;
    })
  );

  return NextResponse.json({
    stats: { totalUsers, totalProducts, totalOrders, totalRevenue },
    monthlySales,
    recentOrders: orders,
    lowStock,
  });
}
