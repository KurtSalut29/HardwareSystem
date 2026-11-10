import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getReorderPlan } from "@/lib/inventory";

// EOQ and reorder point for every product. Admin and staff both restock, so
// both see the plan; only the admin can change the settings behind it.
export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload || (payload.role !== "admin" && payload.role !== "cashier")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getReorderPlan());
}
