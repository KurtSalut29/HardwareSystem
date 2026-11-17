import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

// Public, unauthenticated catalogue for the landing page. Deliberately a
// separate route from /api/products (which requires a session): visitors get to
// browse what the store carries before they have an account, but only the
// fields a shopfront needs — no cost, no supplier data, no internal ids beyond
// what a "browse then sign in to order" flow requires.
export const dynamic = "force-dynamic";

export async function GET() {
  const [categories, products, settings] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        brand: true,
        price: true,
        unit: true,
        stock: true,
        image: true,
        description: true,
        subcategory: { select: { name: true } },
        categoryId: true,
        category: { select: { id: true, name: true } },
      },
    }),
    getSettings(),
  ]);

  return NextResponse.json({
    storeName: settings.storeName,
    store: { address: settings.storeAddress, contact: settings.storeContact, hours: settings.storeHours },
    lowStockLevel: settings.lowStockLevel,
    showStock: settings.publicShowStock,
    categories,
    // The store wants shoppers to see how many are left, so the on-hand
    // quantity is shown on each product (never below zero).
    products: products.map(({ stock, subcategory, ...p }) => ({
      ...p,
      subcategory: subcategory?.name ?? null,
      // The admin can hide exact counts (Settings → Inventory); then only in/out shows.
      stock: settings.publicShowStock ? Math.max(0, Math.round(stock * 100) / 100) : null,
      inStock: stock > 0,
    })),
  });
}
