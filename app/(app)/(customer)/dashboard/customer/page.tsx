"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, ClipboardList, Clock, CheckCircle, Package } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Link from "next/link";
import Image from "next/image";
import OrderMapWidget from "@/components/OrderMapWidget";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import { SectionLabel, CardHeader } from "@/components/dashboard/DashboardParts";

type Order = { id: number; totalAmount: number; status: string; dateTime: string; items: { quantity: number; product: { name: string } }[] };
type Category = { id: number; name: string };
type Product = { id: number; name: string; category: Category; categoryId: number; price: number; unit: string; stock: number; image: string | null };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function CustomerDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState("All");
  const [username, setUsername] = useState("");

  useEffect(() => {
    fetch("/api/orders").then((r) => r.json()).then(setOrders);
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setUsername(d.username ?? "")).catch(() => {});
    fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const pending = orders.filter((o) => o.status === "pending").length;
  const delivered = orders.filter((o) => o.status === "delivered").length;
  // Cancelled orders were never paid for, so they don't count as spending.
  const totalSpent = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.totalAmount, 0);
  const today = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });

  const inStock = products.filter((p) => p.stock > 0);
  const visibleProducts = (activeCat === "All" ? inStock : inStock.filter((p) => p.category?.name === activeCat)).slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-ink-4 mb-1">{today}</p>
        <h1 className="font-display text-2xl font-extrabold text-ink">{greeting()}{username ? `, ${username}` : ""}</h1>
        <p className="text-sm text-ink-4 mt-0.5">Browse products and track your orders.</p>
      </div>

      {/* Stat row — products first, since shopping is what this dashboard is for */}
      <SectionLabel title="Your account" description="A quick look at the shop and your orders." />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile title="Products Available" value={inStock.length} hint="In stock and ready to order" icon={<Package size={ICON_SIZE.md} className="text-brand" />} iconBg="var(--brand-soft)" />
        <StatTile title="Your Orders" value={orders.length} hint={`${delivered} delivered so far`} icon={<ClipboardList size={ICON_SIZE.md} className="text-brand" />} iconBg="#EFF6FF" />
        <StatTile title="Pending" value={pending} hint="Waiting for the store to confirm" icon={<Clock size={ICON_SIZE.md} className="text-warn" />} iconBg="#FEFCE8" />
        <StatTile title="Total Spent" value={`₱${totalSpent.toFixed(2)}`} hint="All your orders, except cancelled" icon={<ShoppingBag size={ICON_SIZE.md} className="text-good" />} iconBg="#ECFDF5" />
      </div>

      <SectionLabel title="Shop & track" description="Pick something to order, and follow orders already on the way." />

      {/* Products lead; map and order history ride along in a narrower right rail. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">

        {/* Products */}
        <div className="bg-surface rounded-xl border border-line p-5">
          <CardHeader
            icon={<Package size={ICON_SIZE.sm} className="text-brand" />}
            title="Products"
            description={`A preview of the ${inStock.length} items in stock. Pick a category, then open the Shop to order.`}
            href="/shop"
            linkLabel="Open Shop"
          />

          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 md:flex-wrap md:overflow-visible">
            {["All", ...categories.map((c) => c.name)].map((c) => (
              <button key={c} onClick={() => setActiveCat(c)}
                className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeCat === c ? "bg-brand text-white shadow-sm" : "bg-surface border border-line text-ink-2 hover:bg-subtle"
                }`}>
                {c}
              </button>
            ))}
          </div>

          {visibleProducts.length === 0 ? (
            <div className="py-12 text-center">
              <Package size={ICON_SIZE.xl} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-ink-4">No products available in this category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleProducts.map((p) => (
                <Link key={p.id} href="/shop"
                  className="group rounded-xl border border-line overflow-hidden flex flex-col bg-surface transition-[transform,border-color] duration-200 hover:border-brand/30 hover:-translate-y-0.5">
                  <div className="relative w-full aspect-[4/3] bg-subtle overflow-hidden">
                    {p.image ? (
                      <Image src={p.image} alt={p.name} fill sizes="(max-width: 640px) 50vw, 20vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.06]" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-display font-extrabold"
                          style={{ background: "linear-gradient(155deg, var(--brand), var(--brand-ink))" }}>
                          {p.name.charAt(0)}
                        </div>
                      </div>
                    )}
                    {p.stock <= 5 && (
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-[2px] rounded-full bg-warn-soft text-warn">
                        {p.stock} left
                      </span>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col flex-1">
                    <p className="text-xs font-semibold text-ink leading-snug line-clamp-2">{p.name}</p>
                    <div className="mt-auto pt-1.5 flex items-baseline gap-1">
                      <span className="font-display text-sm font-extrabold text-ink num">₱{p.price.toFixed(2)}</span>
                      <span className="text-[10px] text-ink-4">/ {p.unit}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <Link href="/shop"
            className="mt-4 flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition bg-brand">
            <ShoppingBag size={ICON_SIZE.sm} /> Browse all products
          </Link>
        </div>

        {/* Right rail — map shrunk to a glance, then recent orders */}
        <div className="space-y-4">
          <OrderMapWidget compact title="Your Deliveries" description="Where your orders are on the map. Updates every 15 seconds." />

          <div className="bg-surface rounded-xl border border-line p-5">
            <CardHeader
              title="Recent Orders"
              description="Your 4 latest orders and their status."
              href="/orders"
              className="mb-3"
            />
            <div className="space-y-2">
              {orders.slice(0, 4).map((o) => (
                <div key={o.id} className="flex items-center gap-2.5 py-2 border-b border-line last:border-0">
                  <span className="w-7 h-7 rounded-md bg-recess flex items-center justify-center font-display font-bold text-[11px] text-ink-3 shrink-0">
                    #{o.id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink truncate">{o.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}</p>
                    <p className="text-[11px] text-ink-4">{new Date(o.dateTime).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-ink num">₱{o.totalAmount.toFixed(2)}</p>
                    <Badge label={o.status} />
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="py-6 text-center">
                  <CheckCircle size={ICON_SIZE.lg} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-xs text-ink-4">No orders yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({ title, value, hint, icon, iconBg }: { title: string; value: string | number; hint?: string; icon: React.ReactNode; iconBg: string }) {
  return (
    <div className="flex items-center gap-3 bg-surface rounded-xl border border-line px-4 py-3.5">
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-ink-4 uppercase tracking-wide truncate">{title}</p>
        <p className="font-display text-lg font-extrabold text-ink num truncate leading-tight">{value}</p>
        {hint && <p className="text-[10px] text-ink-4 truncate">{hint}</p>}
      </div>
    </div>
  );
}
