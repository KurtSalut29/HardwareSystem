import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

/** Customer accounts, for staff taking an order on someone's behalf. Names and numbers only. */
export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload || (payload.role !== "admin" && payload.role !== "cashier")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const customers = await prisma.user.findMany({
    where: { role: "customer" },
    select: { id: true, username: true, contact: true },
    orderBy: { username: "asc" },
  });
  return NextResponse.json(customers);
}
