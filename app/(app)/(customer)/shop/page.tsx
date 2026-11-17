"use client";

import { useEffect, useState, useCallback } from "react";
import { ShoppingCart, PackageSearch, Banknote, Truck, Store } from "lucide-react";
import { STORE_NAME } from "@/lib/brand";
import AddToCartModal from "@/components/shop/AddToCartModal";
import CartCheckout, { type CartLine } from "@/components/shop/CartCheckout";
import type { DeliverySettings } from "@/lib/deliveryFee";
import { useSettings } from "@/lib/useSettings";
import { useToast } from "@/components/ui/ToastProvider";
import ShelfCard from "@/components/catalog/ShelfCard";
import CategoryRail, { type RailValue } from "@/components/catalog/CategoryRail";
import CatalogToolbar, { type SortKey } from "@/components/catalog/CatalogToolbar";
import CategoryGlyph from "@/components/catalog/CategoryGlyph";
import { peso } from "@/lib/catalog-ui";
import { filterProducts, groupByCategory, railCategories } from "@/lib/useCatalog";

type Category = { id: number; name: string };
type Product = { id: number; name: string; brand?: string | null; category: Category; categoryId: number; subcategory: string | null; price: number; unit: string; stock: number; image: string | null; description: string | null };
type CartItem = Product & { quantity: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [rail, setRail] = useState<RailValue>({ categoryId: null, sub: null });
  const [sort, setSort] = useState<SortKey>("category");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [pickProduct, setPickProduct] = useState<Product | null>(null);
  const [fees, setFees] = useState<{ settings: DeliverySettings; store: { lat: number; lng: number } } | null>(null);
  const [homeAddress, setHomeAddress] = useState<string | null>(null);
  const showToast = useToast();
  const settings = useSettings();

  const fetchProducts = useCallback(async () => {
    const [pRes, cRes] = await Promise.all([fetch("/api/products"), fetch("/api/categories")]);
    setProducts(await pRes.json());
    setCategories(await cRes.json());
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => {
    fetch("/api/delivery-settings").then((r) => (r.ok ? r.json() : null)).then(setFees).catch(() => {});
    fetch("/api/account").then((r) => (r.ok ? r.json() : null)).then((a) => { if (a?.defaultAddress) setHomeAddress(a.defaultAddress); }).catch(() => {});
  }, []);

  // "Only a few left" line, set by the admin in Settings → Inventory.
  const LOW_AT = settings.lowStockLevel;
  const rails = railCategories(categories, products);
  const list = filterProducts(products, rail, search, sort, (p) => !inStockOnly || p.stock > 0);
  const grouped = sort === "category" && rail.categoryId === null && !search.trim() ? groupByCategory(list) : null;
  const activeCat = rails.find((c) => c.id === rail.categoryId);
  const filtersOn = rail.categoryId !== null || !!search.trim() || inStockOnly;
  const clearFilters = () => { setRail({ categoryId: null, sub: null }); setSearch(""); setInStockOnly(false); };

  function addToCart(product: Product, qty = 1) {
    if (product.stock === 0) return;
    setCart((prev) => {
      const ex = prev.find((i) => i.id === product.id);
      if (ex) {
        const next = round2(ex.quantity + qty);
        if (next > product.stock) return prev;
        return prev.map((i) => i.id === product.id ? { ...i, quantity: next } : i);
      }
      if (qty > product.stock) return prev;
      return [...prev, { ...product, quantity: qty }];
    });
  }


  const subtotal = cart.reduce((t, i) => t + i.price * i.quantity, 0);
  const cartCount = cart.reduce((t, i) => t + i.quantity, 0);

  return (
    <div className={`space-y-6 ${cartCount > 0 ? "pb-24" : ""}`}>
      {pickProduct && (
        <AddToCartModal
          product={pickProduct}
          siblings={pickProduct.subcategory
            ? products.filter((x) => x.id !== pickProduct.id && x.categoryId === pickProduct.categoryId && x.subcategory === pickProduct.subcategory)
            : []}
          inCart={cart.find((i) => i.id === pickProduct.id)?.quantity ?? 0}
          onSwitch={(x) => setPickProduct(x as Product)}
          onAdd={(x, qty) => {
            addToCart(x as Product, qty);
            setPickProduct(null);
            showToast(`${x.name} × ${qty} ${x.unit} added to cart`);
          }}
          onClose={() => setPickProduct(null)}
        />
      )}
      {/* Header: what the shop is, and the cart always in reach */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">{STORE_NAME} shop</p>
          <h1 className="mt-1 font-display text-[28px] font-extrabold leading-none tracking-tight text-ink">Shop</h1>
          <p className="mt-2 text-sm text-ink-3">Today&apos;s shelf prices. Delivered to your pin, or ready for pickup at the store.</p>
        </div>
        <button type="button" onClick={() => setShowCart(true)}
          className={`inline-flex h-11 items-center gap-2.5 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] ${
            cartCount > 0 ? "bg-brand text-white shadow-[0_8px_18px_-10px_rgba(30,79,216,0.8)] hover:brightness-110" : "border border-line bg-surface text-ink-2 hover:border-line-strong"}`}>
          <ShoppingCart className="size-4" />
          {cartCount > 0 ? <>Cart · {cart.length} item{cart.length === 1 ? "" : "s"} <span className="num opacity-80">· {peso(subtotal)}</span></> : "Cart is empty"}
        </button>
      </header>


      {/* Where it goes and what delivery costs, before they start shopping */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line bg-surface px-4 py-3 text-[13px]">
        <span className="flex min-w-0 items-center gap-2 text-ink-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Truck className="size-4" /></span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-4">Delivering to</span>
            <span className="block truncate font-semibold text-ink">{homeAddress ?? "Choose a place at checkout"}</span>
          </span>
        </span>
        {fees && (
          <span className="flex items-center gap-2 text-ink-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-recess text-ink-3"><Banknote className="size-4" /></span>
            <span>Delivery from <b className="num text-ink">{peso(fees.settings.baseFee)}</b>, first {fees.settings.freeKm} km by road</span>
          </span>
        )}
        <span className="flex items-center gap-2 text-ink-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-recess text-ink-3"><Store className="size-4" /></span>
          <span>Or pick up for free at the store</span>
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[232px_minmax(0,1fr)]">
        <CategoryRail categories={rails} total={products.length} value={rail} onChange={setRail} />

        <section className="min-w-0 space-y-4" aria-label="Products">
          <CatalogToolbar query={search} onQuery={setSearch} sort={sort} onSort={setSort}
            sorts={["category", "name", "price_asc", "price_desc"]} placeholder="Search cement, nails, PVC pipe…" />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-ink-3">
              <span className="font-semibold text-ink">{list.length}</span> {list.length === 1 ? "product" : "products"}
              {activeCat && <> in <span className="font-semibold text-ink-2">{activeCat.name}</span>{rail.sub && <> › <span className="font-semibold text-ink-2">{rail.sub}</span></>}</>}
              {search.trim() && <> matching “<span className="font-semibold text-ink-2">{search.trim()}</span>”</>}
            </p>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-2">
                <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="size-4 rounded accent-[var(--brand)]" />
                In stock only
              </label>
              {filtersOn && <button type="button" onClick={clearFilters} className="text-[13px] font-semibold text-brand hover:underline">Clear filters</button>}
            </div>
          </div>

          {list.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
              <PackageSearch className="size-10 text-ink-4" strokeWidth={1.5} />
              <p className="mt-3 font-display text-lg font-extrabold text-ink">{products.length === 0 ? "Loading the shelves…" : "Nothing matches that"}</p>
              {products.length > 0 && <p className="mt-1 max-w-sm text-sm text-ink-3">Try a simpler word like “nail” or “pipe”, or clear the filters.</p>}
              {filtersOn && <button type="button" onClick={clearFilters} className="mt-4 h-9 rounded-lg border border-line px-3.5 text-sm font-semibold text-ink-2 hover:bg-recess">Clear filters</button>}
            </div>
          ) : (
            <div className="space-y-8">
              {(grouped ?? [{ name: "", categoryId: -1, items: list }]).map((g) => (
                <section key={g.categoryId} aria-label={g.name || "Products"}>
                  {grouped && (
                    <div className="mb-3 flex items-center gap-3">
                      <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><CategoryGlyph category={g.name} className="size-4" /></span>
                      <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">{g.name}</h2>
                      <span className="font-code text-xs text-ink-4">{g.items.length}</span>
                      <span aria-hidden className="h-px flex-1 bg-line" />
                      <button type="button" onClick={() => setRail({ categoryId: g.categoryId, sub: null })}
                        className="text-[12.5px] font-semibold text-brand hover:underline">See all</button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {g.items.map((p) => {
                      const inCart = cart.find((i) => i.id === p.id)?.quantity ?? 0;
                      const out = p.stock <= 0;
                      return (
                        <ShelfCard key={p.id} product={p} reorderAt={LOW_AT} audience="customer" inCart={inCart}
                          onOpen={out ? undefined : () => setPickProduct(p)} openLabel={`Add ${p.name} to cart`}
                          footer={
                            <button type="button" onClick={() => setPickProduct(p)} disabled={out}
                              className={`inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition disabled:cursor-not-allowed ${
                                out ? "bg-recess text-ink-4" : inCart ? "bg-brand-soft text-brand-ink hover:bg-brand hover:text-white" : "border border-brand/35 text-brand hover:border-brand hover:bg-brand hover:text-white"}`}>
                              {out ? "Out of stock" : inCart ? "Add more" : <><ShoppingCart className="size-4" /> Add to cart</>}
                            </button>
                          } />
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* The cart stays on screen while scrolling: a bar on phones, a floating card on desktops */}
      {cartCount > 0 && !showCart && (
        <button type="button" onClick={() => setShowCart(true)} aria-label={`Open cart: ${cart.length} items, ${peso(subtotal)}`}
          className="group fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 lg:bottom-4 flex items-center justify-between gap-4 rounded-2xl bg-brand px-5 py-3.5 text-white shadow-[0_18px_40px_-14px_rgba(18,50,127,0.7)] transition hover:brightness-110 lg:inset-x-auto lg:bottom-6 lg:right-8 lg:min-w-[320px] lg:animate-rise-in">
          <span className="flex items-center gap-2.5 text-sm font-semibold">
            <span className="relative grid size-9 place-items-center rounded-xl bg-white/15">
              <ShoppingCart className="size-4" />
              <span className="num absolute -right-1.5 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-surface px-1 text-[10.5px] font-bold text-brand">{cart.length}</span>
            </span>
            <span className="text-left leading-tight">
              <span className="block">Your cart</span>
              <span className="block text-[11.5px] font-medium text-white/75">Review and place order</span>
            </span>
          </span>
          <span className="num font-display text-lg font-extrabold">{peso(subtotal)}</span>
        </button>
      )}

      <CartCheckout
        open={showCart}
        onClose={() => setShowCart(false)}
        cart={cart}
        setCart={(fn) => setCart((prev) => fn(prev as CartLine[]) as CartItem[])}
        onPlaced={() => { setShowCart(false); fetchProducts(); }}
      />
    </div>
  );
}
