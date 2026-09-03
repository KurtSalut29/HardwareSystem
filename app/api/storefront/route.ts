import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveStoreName } from "@/lib/brand";

// Public, unauthenticated catalogue for the landing page. Deliberately a
// separate route from /api/products (which requires a session): visitors get to
// browse what the store carries before they have an account, but only the
// fields a shopfront needs — no cost, no supplier data, no internal ids beyond
// what a "browse then sign in to order" flow requires.
export const dynamic = "force-dynamic";

export async function GET() {
  const [categories, products, storeName] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        price: true,
        unit: true,
        stock: true,
        image: true,
        description: true,
        subcategory: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
      },
    }),
    prisma.setting.findUnique({ where: { key: "store_name" } }),
  ]);

  return NextResponse.json({
    storeName: resolveStoreName(storeName?.value),
    categories,
    // Stock is exposed only as an in/out flag — browsers don't need exact
    // on-hand quantities, and it keeps the landing page honest about
    // availability without leaking inventory levels publicly.
    products: products.map(({ stock, ...p }) => ({ ...p, inStock: stock > 0 })),
  });
}
