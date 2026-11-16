"use client";

import { useEffect, useState, useCallback } from "react";
import { ShoppingCart, Trash2, CheckCircle, PackageSearch, Banknote, Smartphone, Copy, Check, QrCode, AlertTriangle, Truck, Store, CreditCard, Receipt, MapPin } from "lucide-react";
import Drawer from "@/components/ui/Drawer";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Image from "next/image";
import LocationPicker, { PickedLocation } from "@/components/LocationPicker";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import { STORE_NAME } from "@/lib/brand";
import AddToCartModal from "@/components/shop/AddToCartModal";
import { describeQuote, type DeliverySettings } from "@/lib/deliveryFee";
import { useDeliveryQuote } from "@/lib/useDeliveryQuote";
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
type StorePayment = { gcashName: string | null; gcashNumber: string | null; gcashQr: string | null };

const round2 = (n: number) => Math.round(n * 100) / 100;
const stepFor = (unit: string) => (unit === "kg" ? 0.25 : 1);

// Must mirror the server-side rules in /api/orders.
const GCASH_NUMBER_RE = /^09\d{9}$/;
const GCASH_REFERENCE_RE = /^\d{13}$/;
const digitsOnly = (v: string) => v.replace(/\D/g, "");

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [rail, setRail] = useState<RailValue>({ categoryId: null, sub: null });
  const [sort, setSort] = useState<SortKey>("category");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(null);
  // The customer's default delivery spot from registration. Checkout starts there.
  const [savedLocation, setSavedLocation] = useState<PickedLocation | null>(null);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [fulfillmentMode, setFulfillmentMode] = useState<"delivery" | "pickup">("delivery");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [storeInfo, setStoreInfo] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [pickProduct, setPickProduct] = useState<Product | null>(null);
  const [fees, setFees] = useState<{ settings: DeliverySettings; store: { lat: number; lng: number } } | null>(null);
  const showToast = useToast();
  const [showReview, setShowReview] = useState(false);
  const [storePayment, setStorePayment] = useState<StorePayment | null>(null);
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashReference, setGcashReference] = useState("");
  // Blank means "paid the full total" — the common case, so the customer only
  // has to touch this when they actually sent less.
  const [gcashAmount, setGcashAmount] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchProducts = useCallback(async () => {
    const [pRes, cRes] = await Promise.all([fetch("/api/products"), fetch("/api/categories")]);
    setProducts(await pRes.json());
    setCategories(await cRes.json());
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => {
    fetch("/api/store-location").then((r) => (r.ok ? r.json() : null)).then(setStoreInfo).catch(() => {});
    fetch("/api/store-payment").then((r) => (r.ok ? r.json() : null)).then(setStorePayment).catch(() => {});
    fetch("/api/delivery-settings").then((r) => (r.ok ? r.json() : null)).then(setFees).catch(() => {});
    fetch("/api/account").then((r) => (r.ok ? r.json() : null)).then((a) => {
      if (!a || a.defaultLat == null || a.defaultLng == null) return;
      const saved = { address: a.defaultAddress ?? "My default location", lat: a.defaultLat, lng: a.defaultLng };
      setSavedLocation(saved);
      setPickedLocation((p) => p ?? saved);
    }).catch(() => {});
  }, []);

  // Customers see "running low" at 5 or fewer, the same line the old shop used.
  const LOW_AT = 5;
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

  function updateQty(id: number, qty: number) {
    const rounded = round2(qty);
    if (rounded <= 0) { setCart((prev) => prev.filter((i) => i.id !== id)); return; }
    const p = products.find((p) => p.id === id);
    if (p && rounded > p.stock) return;
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, quantity: rounded } : i));
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  // Delivery fee, shown before ordering. The server computes the same figure
  // from the same settings when the order is placed.
  // Fee from the real road distance, worked out by the server (the same quote the order is saved with).
  const delivery = useDeliveryQuote(fulfillmentMode === "delivery" ? pickedLocation : null);
  const quote = fulfillmentMode === "delivery" ? delivery.quote : null;
  const usingSaved = !!pickedLocation && !!savedLocation && pickedLocation.lat === savedLocation.lat && pickedLocation.lng === savedLocation.lng;
  const deliveryFee = quote && !quote.tooFar ? quote.fee : 0;
  const total = round2(subtotal + deliveryFee);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const gcashNumberValid = GCASH_NUMBER_RE.test(gcashNumber);
  const gcashReferenceValid = GCASH_REFERENCE_RE.test(gcashReference);

  // What the customer says they sent. Anything short of the total becomes a
  // balance they settle on delivery or pickup.
  const paidEntered = gcashAmount.trim() === "" ? total : Number(gcashAmount);
  const gcashAmountValid = Number.isFinite(paidEntered) && paidEntered > 0 && paidEntered <= total + 0.01;
  const amountPaid = gcashAmountValid ? Math.min(paidEntered, total) : 0;
  const balance = Math.max(0, round2(total - amountPaid));
  const isPartialPayment = paymentMethod === "GCash" && gcashAmountValid && balance > 0;

  const gcashReady = paymentMethod !== "GCash" || (gcashNumberValid && gcashReferenceValid && gcashAmountValid);

  async function copyGcashNumber() {
    if (!storePayment?.gcashNumber) return;
    try {
      await navigator.clipboard.writeText(storePayment.gcashNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the number is still visible on screen */ }
  }

  function openReview() {
    if (!cart.length) return;
    if (fulfillmentMode === "delivery" && !pickedLocation) {
      setError("Please set a delivery location.");
      return;
    }
    if (fulfillmentMode === "delivery" && delivery.loading) {
      setError("Still working out the delivery fee — one moment.");
      return;
    }
    if (fulfillmentMode === "delivery" && !quote) {
      setError(delivery.error ?? "Couldn't work out the delivery fee for that spot. Move the pin and try again.");
      return;
    }
    if (quote?.tooFar) {
      setError("That location is beyond our delivery area. Choose pickup instead.");
      return;
    }
    if (paymentMethod === "GCash") {
      if (!gcashNumberValid) {
        setError("Enter the GCash number you paid from (11 digits, starts with 09).");
        return;
      }
      if (!gcashReferenceValid) {
        setError("Enter the 13-digit reference number from your GCash receipt.");
        return;
      }
    }
    setError("");
    setShowReview(true);
  }

  async function handleOrder() {
    setError(""); setLoading(true);
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((i) => ({ productId: i.id, quantity: i.quantity, price: i.price })),
        fulfillmentMode,
        paymentMethod,
        ...(paymentMethod === "GCash" ? { gcashNumber, gcashReference, amountPaid } : {}),
        ...(fulfillmentMode === "delivery" && pickedLocation ? {
          deliveryAddress: pickedLocation.address,
          latitude: pickedLocation.lat,
          longitude: pickedLocation.lng,
        } : {}),
      }),
    });
    setLoading(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    // "Use this as my default delivery location" — the next checkout starts here.
    let nextDefault = savedLocation;
    if (saveAsDefault && fulfillmentMode === "delivery" && pickedLocation && !usingSaved) {
      const saved = await fetch("/api/account", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultAddress: pickedLocation.address, defaultLat: pickedLocation.lat, defaultLng: pickedLocation.lng }),
      }).then((r) => r.ok).catch(() => false);
      if (saved) { nextDefault = pickedLocation; setSavedLocation(pickedLocation); }
    }
    setSaveAsDefault(false);
    setCart([]); setPickedLocation(nextDefault); setFulfillmentMode("delivery"); setPaymentMethod("Cash");
    setGcashNumber(""); setGcashReference(""); setGcashAmount("");
    setShowReview(false); setShowCart(false); setSuccess(true); fetchProducts();
    setTimeout(() => setSuccess(false), 4000);
  }

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

      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-good/30 bg-good-soft px-4 py-3 text-sm font-medium text-good" role="status">
          <CheckCircle className="size-5 shrink-0" /> Order placed. You can follow it under My Orders.
        </div>
      )}

      {/* Where it goes and what delivery costs, before they start shopping */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line bg-surface px-4 py-3 text-[13px]">
        <span className="flex min-w-0 items-center gap-2 text-ink-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Truck className="size-4" /></span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-4">Delivering to</span>
            <span className="block truncate font-semibold text-ink">{savedLocation?.address ?? "Pin your spot at checkout"}</span>
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
          className="group fixed inset-x-4 bottom-4 z-30 flex items-center justify-between gap-4 rounded-2xl bg-brand px-5 py-3.5 text-white shadow-[0_18px_40px_-14px_rgba(18,50,127,0.7)] transition hover:brightness-110 lg:inset-x-auto lg:bottom-6 lg:right-8 lg:min-w-[320px] lg:animate-rise-in">
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

      {/* Cart Drawer */}
      <Drawer
        open={showCart}
        onClose={() => setShowCart(false)}
        placement="center"
        width="lg"
        title={<><ShoppingCart size={ICON_SIZE.md} /> Your Cart</>}
        footer={cart.length > 0 ? (
          <div className="p-5 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-ink-3"><span>Subtotal</span><span className="num">₱{subtotal.toFixed(2)}</span></div>
              {fulfillmentMode === "delivery" && (
                <div className="flex justify-between text-ink-3">
                  <span>Delivery fee</span>
                  <span className="num">{quote ? (quote.tooFar ? "Too far" : quote.fee === 0 ? "Free" : `₱${quote.fee.toFixed(2)}`) : pickedLocation && delivery.loading ? "Checking…" : "Pin your location"}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-ink pt-1">
                <span>Total</span>
                <span className="text-lg num">₱{total.toFixed(2)}</span>
              </div>
            </div>
            {error && <p className="text-xs text-bad bg-bad-soft rounded-lg px-3 py-2">{error}</p>}
            <Button onClick={openReview} disabled={!gcashReady} className="w-full">
              Review Order
            </Button>
          </div>
        ) : undefined}
      >
        <div className="p-5 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-ink-4">
              <ShoppingCart size={ICON_SIZE.xl} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Your cart is empty</p>
            </div>
          ) : cart.map((i) => (
            <div key={i.id} className="flex items-center gap-3">
              {i.image ? (
                <Image src={i.image} alt={i.name} width={40} height={40} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-line" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-brand-soft flex items-center justify-center text-brand font-bold text-sm shrink-0">{i.name.charAt(0)}</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{i.name}</p>
                <p className="text-xs text-ink-4">₱{i.price.toFixed(2)} / {i.unit}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(i.id, i.quantity - stepFor(i.unit))} className="w-6 h-6 rounded-lg bg-recess hover:bg-line text-xs font-bold transition flex items-center justify-center">−</button>
                <span className="min-w-[2.5rem] text-center text-sm">{i.quantity}{i.unit === "kg" ? " kg" : ""}</span>
                <button onClick={() => updateQty(i.id, i.quantity + stepFor(i.unit))} className="w-6 h-6 rounded-lg bg-recess hover:bg-line text-xs font-bold transition flex items-center justify-center">+</button>
              </div>
              <button type="button" onClick={() => setCart((prev) => prev.filter((c) => c.id !== i.id))} aria-label={`Remove ${i.name}`} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11.5px] font-semibold text-bad transition hover:bg-bad-soft"><Trash2 className="size-3" /> Remove</button>
            </div>
          ))}

          {/* Checkout options live in the scrollable body — the GCash panel and
              the map picker together are far taller than a pinned footer can hold. */}
          {cart.length > 0 && (
            <div className="pt-4 mt-2 border-t border-line space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Fulfillment</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setFulfillmentMode("delivery")}
                  className={`py-2 rounded-lg text-xs font-semibold border transition inline-flex items-center justify-center gap-1.5 ${fulfillmentMode === "delivery" ? "bg-brand text-white border-brand" : "bg-surface border-line text-ink-2 hover:bg-subtle"}`}>
                  <Truck size={14} /> Delivery
                </button>
                <button type="button" onClick={() => setFulfillmentMode("pickup")}
                  className={`py-2 rounded-lg text-xs font-semibold border transition inline-flex items-center justify-center gap-1.5 ${fulfillmentMode === "pickup" ? "bg-brand text-white border-brand" : "bg-surface border-line text-ink-2 hover:bg-subtle"}`}>
                  <Store size={14} /> Pickup at Store
                </button>
              </div>
            </div>

            {fulfillmentMode === "delivery" ? (
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-medium text-ink-2">Delivery Location</label>
                  {savedLocation && !usingSaved && (
                    <button type="button" onClick={() => { setPickedLocation(savedLocation); setSaveAsDefault(false); }}
                      className="text-[11px] font-semibold text-brand hover:underline">Use my default location</button>
                  )}
                </div>
                {usingSaved && (
                  <p className="text-[11px] text-good mb-1.5 flex items-center gap-1"><MapPin size={11} /> Your default location. Move the pin to deliver somewhere else.</p>
                )}
                <LocationPicker value={pickedLocation} onChange={setPickedLocation} />
                {pickedLocation && delivery.loading && (
                  <p className="mt-2 rounded-lg px-3 py-2 text-xs text-ink-3 animate-pulse bg-recess">Checking the road distance…</p>
                )}
                {pickedLocation && !delivery.loading && delivery.error && (
                  <p className="mt-2 rounded-lg px-3 py-2 text-xs bg-bad-soft text-bad">{delivery.error}</p>
                )}
                {quote && delivery.settings && (
                  <div className="mt-2 rounded-lg px-3 py-2 text-xs flex justify-between gap-3" style={{ background: quote.tooFar ? "var(--bad-soft)" : "var(--info-soft)" }}>
                    <span className="text-ink-2">
                      {quote.tooFar ? `About ${quote.roadKm.toFixed(0)} km away — beyond our ${delivery.settings.maxKm} km delivery area. Choose pickup instead.` : describeQuote(quote, delivery.settings)}
                      {!quote.tooFar && quote.minutes != null && <span className="text-ink-4"> · about {quote.minutes} min drive</span>}
                    </span>
                    {!quote.tooFar && <span className="font-bold text-ink whitespace-nowrap num">{quote.fee === 0 ? "Free" : `₱${quote.fee}`}</span>}
                  </div>
                )}
                {pickedLocation && savedLocation && !usingSaved && (
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-ink-2 cursor-pointer">
                    <input type="checkbox" checked={saveAsDefault} onChange={(e) => setSaveAsDefault(e.target.checked)} className="rounded" />
                    Make this my default delivery location
                  </label>
                )}
                {!pickedLocation && fees && (
                  <p className="text-[11px] text-ink-4 mt-1.5">
                    Delivery is ₱{fees.settings.baseFee} for the first {fees.settings.freeKm} km by road, then ₱{fees.settings.ratePerKm} per km. Pin your location to see the fee.
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-brand-soft border border-brand/30 rounded-lg px-3 py-2.5 text-xs text-brand">
                <p className="font-semibold">{storeInfo?.name ?? STORE_NAME}</p>
                <p className="text-brand mt-0.5">We&apos;ll notify you when your order is ready for pickup.</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "Cash", icon: Banknote, label: fulfillmentMode === "delivery" ? "Cash on Delivery" : "Cash on Pickup" },
                  { value: "GCash", icon: Smartphone, label: "GCash" },
                ].map((m) => (
                  <button key={m.value} type="button" onClick={() => { setPaymentMethod(m.value); setError(""); }}
                    className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border text-[11px] font-semibold leading-tight text-center transition ${
                      paymentMethod === m.value ? "bg-brand text-white border-brand" : "bg-surface border-line text-ink-2 hover:bg-subtle"
                    }`}>
                    <m.icon size={ICON_SIZE.sm} />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === "GCash" && (
              <div className="rounded-xl border border-brand/30 bg-blue-50/60 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <QrCode size={ICON_SIZE.sm} className="text-brand shrink-0" />
                  <p className="text-xs font-bold text-brand-ink">Pay ₱{total.toFixed(2)} via GCash</p>
                </div>

                {storePayment?.gcashQr || storePayment?.gcashNumber ? (
                  <>
                    <p className="text-[11px] text-brand leading-relaxed">
                      <span className="font-semibold">1.</span> Pay in your GCash app &nbsp;
                      <span className="font-semibold">2.</span> Enter your number &amp; ref. no. below &nbsp;
                      <span className="font-semibold">3.</span> Tap Review Order to place it
                    </p>
                    <div className="flex gap-3 items-center">
                      {storePayment.gcashQr && (
                        <div className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-brand/30 bg-surface">
                          <Image src={storePayment.gcashQr} alt="Store GCash QR code" fill sizes="96px" className="object-contain p-1" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">Send payment to</p>
                        <p className="text-sm font-bold text-ink truncate">{storePayment.gcashName ?? storeInfo?.name ?? STORE_NAME}</p>
                        {storePayment.gcashNumber && (
                          <button type="button" onClick={copyGcashNumber}
                            className="flex items-center gap-1.5 text-sm font-bold text-brand num hover:underline">
                            {storePayment.gcashNumber}
                            {copied ? <Check size={ICON_SIZE.xs} className="text-good" /> : <Copy size={ICON_SIZE.xs} className="text-brand" />}
                          </button>
                        )}
                        <p className="text-[10px] text-brand">{copied ? "Number copied!" : "Scan the QR or send to this number."}</p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1 border-t border-brand/30">
                      <div>
                        <label className="block text-[11px] font-semibold text-ink-2 mb-1 mt-2">Your GCash number</label>
                        <input
                          value={gcashNumber}
                          onChange={(e) => setGcashNumber(digitsOnly(e.target.value).slice(0, 11))}
                          inputMode="numeric" placeholder="09XXXXXXXXX"
                          className={`w-full text-sm num border rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 transition ${
                            gcashNumber && !gcashNumberValid ? "border-bad/30 focus:ring-red-500/20" : "border-line focus:ring-brand/20 focus:border-brand"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-ink-2 mb-1">GCash reference number</label>
                        <input
                          value={gcashReference}
                          onChange={(e) => setGcashReference(digitsOnly(e.target.value).slice(0, 13))}
                          inputMode="numeric" placeholder="13-digit ref. no."
                          className={`w-full text-sm num border rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 transition ${
                            gcashReference && !gcashReferenceValid ? "border-bad/30 focus:ring-red-500/20" : "border-line focus:ring-brand/20 focus:border-brand"
                          }`}
                        />
                        <p className="text-[10px] text-ink-3 mt-1">
                          Found on your GCash receipt as &ldquo;Ref. No.&rdquo; — the store checks this before releasing your order.
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-ink-2">Amount you sent</label>
                          {gcashAmount.trim() !== "" && (
                            <button type="button" onClick={() => setGcashAmount("")}
                              className="text-[10px] font-bold text-brand hover:underline">
                              Paid in full
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-4">₱</span>
                          <input
                            value={gcashAmount}
                            onChange={(e) => setGcashAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                            inputMode="decimal"
                            placeholder={total.toFixed(2)}
                            className={`w-full text-sm num border rounded-lg pl-7 pr-3 py-2 bg-surface focus:outline-none focus:ring-2 transition ${
                              gcashAmount.trim() !== "" && !gcashAmountValid
                                ? "border-bad/30 focus:ring-red-500/20"
                                : "border-line focus:ring-brand/20 focus:border-brand"
                            }`}
                          />
                        </div>
                        {gcashAmount.trim() !== "" && !gcashAmountValid ? (
                          <p className="text-[10px] text-bad mt-1">
                            Enter an amount between ₱0.01 and the order total of ₱{total.toFixed(2)}.
                          </p>
                        ) : (
                          <p className="text-[10px] text-ink-3 mt-1">
                            Leave this blank if you paid the full ₱{total.toFixed(2)}.
                          </p>
                        )}
                      </div>

                      {/* Partial payment — spell out the balance before they commit. */}
                      {isPartialPayment && (
                        <div className="rounded-lg border px-3 py-2.5 border-warn bg-warn-soft">
                          <p className="text-[11px] font-bold flex items-center gap-1.5 text-warn">
                            <AlertTriangle size={ICON_SIZE.xs} /> You will still owe ₱{balance.toFixed(2)}
                          </p>
                          <p className="text-[10px] mt-1 leading-relaxed text-warn">
                            You&apos;re sending ₱{amountPaid.toFixed(2)} of the ₱{total.toFixed(2)} total. The remaining
                            ₱{balance.toFixed(2)} must be paid {fulfillmentMode === "delivery" ? "to the driver on delivery" : "at the counter when you pick up"}.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-brand">
                    The store hasn&apos;t set up its GCash details yet. Please choose another payment method or contact the store.
                  </p>
                )}
              </div>
            )}

            </div>
          )}
        </div>
      </Drawer>

      {/* Order Review Modal */}
      <Modal open={showReview} onClose={() => setShowReview(false)} title="Review Your Order" size="sm">
        <div className="space-y-4">
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {cart.map((i) => (
              <div key={i.id} className="flex justify-between text-sm">
                <span className="text-ink-2">{i.name} <span className="text-ink-4">× {i.quantity}{i.unit === "kg" ? " kg" : ""}</span></span>
                <span className="font-medium text-ink">₱{(i.price * i.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-line pt-3 space-y-1">
            {fulfillmentMode === "delivery" && (
              <>
                <div className="flex justify-between text-sm text-ink-3"><span>Subtotal</span><span className="num">₱{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm text-ink-3"><span>Delivery fee</span><span className="num">{deliveryFee === 0 ? "Free" : `₱${deliveryFee.toFixed(2)}`}</span></div>
              </>
            )}
            <div className="flex justify-between font-bold text-ink">
              <span>Total</span>
              <span className="num">₱{total.toFixed(2)}</span>
            </div>
          </div>
          <div className="bg-subtle rounded-lg px-3 py-2.5 text-xs text-ink-2 space-y-1">
            <p className="flex items-start gap-1.5">
              {fulfillmentMode === "delivery" ? <Truck size={13} className="shrink-0 mt-px" /> : <Store size={13} className="shrink-0 mt-px" />}
              <span>{fulfillmentMode === "delivery" ? "Delivery" : "Pickup at Store"}{fulfillmentMode === "delivery" && pickedLocation ? ` — ${pickedLocation.address}` : ""}</span>
            </p>
            <p className="flex items-center gap-1.5"><CreditCard size={13} className="shrink-0" /> {paymentMethod}{paymentMethod === "Cash" ? (fulfillmentMode === "delivery" ? " on Delivery" : " on Pickup") : ""}</p>
            {paymentMethod === "GCash" && (
              <>
                <p className="flex items-center gap-1.5"><Smartphone size={13} className="shrink-0" /> Paid from <span className="num font-medium text-ink-2">{gcashNumber}</span></p>
                <p className="flex items-center gap-1.5"><Receipt size={13} className="shrink-0" /> Ref. No. <span className="num font-medium text-ink-2">{gcashReference}</span></p>
                <p className="flex items-center gap-1.5"><Banknote size={13} className="shrink-0" /> Amount sent <span className="num font-medium text-ink-2">₱{amountPaid.toFixed(2)}</span></p>
              </>
            )}
          </div>
          {isPartialPayment && (
            <div className="rounded-lg border px-3 py-2.5 border-warn bg-warn-soft">
              <p className="text-xs font-bold flex items-center gap-1.5 text-warn">
                <AlertTriangle size={ICON_SIZE.sm} /> Outstanding balance: ₱{balance.toFixed(2)}
              </p>
              <p className="text-[11px] mt-1 leading-relaxed text-warn">
                This order is only partly paid. Please settle the remaining ₱{balance.toFixed(2)}
                {fulfillmentMode === "delivery" ? " with the driver on delivery" : " at the counter on pickup"}.
              </p>
            </div>
          )}
          {paymentMethod === "GCash" && (
            <p className="text-[11px] text-ink-3 -mt-1">
              The store will verify this reference number against their GCash account before confirming your order.
            </p>
          )}
          {error && <p className="text-xs text-bad bg-bad-soft rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowReview(false)} disabled={loading}>Back to Cart</Button>
            <Button className="flex-1" onClick={handleOrder} loading={loading}>Confirm & Place Order</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
